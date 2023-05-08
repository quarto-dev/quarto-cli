/*
 * chrome.js
 *
 * Copyright (c) 2021 Andrea Cardaci <cyrus.and@gmail.com>
 *
 * Deno port Copyright (C) 2022 Posit Software, PBC
 */

import EventEmitter from "events/mod.ts";

import { nextTick } from "../../deno/next-tick.ts";

import * as api from "./api.js";
import * as defaults from "./defaults.js";
import * as devtools from "./devtools.js";

/* const api = require('./api.js');
const defaults = require('./defaults.js');
const devtools = require('./devtools.js');
 */

class ProtocolError extends Error {
  constructor(request, response) {
    let { message } = response;
    if (response.data) {
      message += ` (${response.data})`;
    }
    super(message);
    // attach the original response as well
    this.request = request;
    this.response = response;
  }
}

async function tryUntilTimeout(cb, timeout = 3000) {
  const interval = 50;
  let soFar = 0;
  let lastE;

  do {
    try {
      const result = await cb();
      return result;
    } catch (e) {
      lastE = e;
      soFar += interval;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  } while (soFar < timeout);
  throw lastE;
}

export default class Chrome extends EventEmitter {
  constructor(options, notifier) {
    super();
    // options
    const defaultTarget = async (targets) => {
      let target;
      // If no targets available in browser, create a new one
      // Related to https://github.com/quarto-dev/quarto-cli/issues/4653
      if (!targets.length) {
        target = await devtools.New(options);
        if (!target.id) {
          throw new Error("No inspectable targets and unable to create one");
        }
      } else {
        // prefer type = 'page' inspectable targets as they represents
        // browser tabs (fall back to the first inspectable target
        // otherwise)
        let backup;
        target = targets.find((target) => {
          if (target.webSocketDebuggerUrl) {
            backup = backup || target;
            return target.type === "page";
          } else {
            return false;
          }
        });
        target = target || backup;
      }
      if (target) {
        return target;
      } else {
        throw new Error("No inspectable targets");
      }
    };
    options = options || {};
    this.host = options.host || defaults.HOST;
    this.port = options.port || defaults.PORT;
    this.secure = !!options.secure;
    this.useHostName = !!options.useHostName;
    this.alterPath = options.alterPath || ((path) => path);
    this.protocol = options.protocol;
    this.local = !!options.local;
    this.target = options.target || defaultTarget;
    // locals
    this._notifier = notifier;
    this._callbacks = {};
    this._nextCommandId = 1;
    // properties
    this.webSocketUrl = undefined;
    // operations
    this._start();
  }

  // avoid misinterpreting protocol's members as custom util.inspect functions
  inspect(_depth, options) {
    options.customInspect = false;
    return Deno.inspect(this, options);
  }

  send(method, params, sessionId, callback) {
    // handle optional arguments
    const optionals = Array.from(arguments).slice(1);
    params = optionals.find((x) => typeof x === "object");
    sessionId = optionals.find((x) => typeof x === "string");
    callback = optionals.find((x) => typeof x === "function");
    // return a promise when a callback is not provided
    if (typeof callback === "function") {
      this._enqueueCommand(method, params, sessionId, callback);
      return undefined;
    } else {
      return new Promise((fulfill, reject) => {
        this._enqueueCommand(method, params, sessionId, (error, response) => {
          if (error) {
            const request = { method, params, sessionId };
            reject(
              error instanceof Error
                ? error // low-level WebSocket error
                : new ProtocolError(request, response)
            );
          } else {
            fulfill(response);
          }
        });
      });
    }
  }

  close(callback) {
    const closeWebSocket = (callback) => {
      // don't close if it's already closed
      if (this._ws.readyState === 3) {
        callback();
      } else {
        // don't notify on user-initiated shutdown ('disconnect' event)
        //this._ws.removeAllListeners('close');
        const onclose = this._ws.onclose;
        this._ws.onclose = () => {
          //    this._ws.removeAllListeners();
          callback();
          this._ws.onclose = onclose;
          this._ws.onclose && this._ws.onclose();
        };
        this._ws.close();
      }
    };
    if (typeof callback === "function") {
      closeWebSocket(callback);
      return undefined;
    } else {
      return new Promise((fulfill, _reject) => {
        closeWebSocket(fulfill);
      });
    }
  }

  // initiate the connection process
  async _start() {
    const options = {
      host: this.host,
      port: this.port,
      secure: this.secure,
      useHostName: this.useHostName,
      alterPath: this.alterPath,
    };
    try {
      // fetch the WebSocket debugger URL
      const url = await this._fetchDebuggerURL(options);
      // allow the user to alter the URL
      const urlObject = new URL(url);
      urlObject.pathname = options.alterPath(urlObject.pathname);
      this.webSocketUrl = urlObject.href;
      // update the connection parameters using the debugging URL
      options.host = urlObject.hostname;
      options.port = urlObject.port || options.port;
      // fetch the protocol and prepare the API
      const protocol = await this._fetchProtocol(options);
      api.prepare(this, protocol);
      // finally connect to the WebSocket
      await this._connectToWebSocket();
      // since the handler is executed synchronously, the emit() must be
      // performed in the next tick so that uncaught errors in the client code
      // are not intercepted by the Promise mechanism and therefore reported
      // via the 'error' event
      nextTick(() => {
        this._notifier.emit("connect", this);
      });
    } catch (err) {
      this._notifier.emit("error", err);
    }
  }

  // fetch the WebSocket URL according to 'target'
  async _fetchDebuggerURL(options) {
    const userTarget = this.target;
    switch (typeof userTarget) {
      case "string": {
        let idOrUrl = userTarget;
        // use default host and port if omitted (and a relative URL is specified)
        if (idOrUrl.startsWith("/")) {
          idOrUrl = `ws://${this.host}:${this.port}${idOrUrl}`;
        }
        // a WebSocket URL is specified by the user (e.g., node-inspector)
        if (idOrUrl.match(/^wss?:/i)) {
          return idOrUrl; // done!
        }
        // a target id is specified by the user
        else {
          const targets = await tryUntilTimeout(async () => {
            return await devtools.List(options);
          });
          const object = targets.find((target) => target.id === idOrUrl);
          return object.webSocketDebuggerUrl;
        }
      }
      case "object": {
        const object = userTarget;
        return object.webSocketDebuggerUrl;
      }
      case "function": {
        const func = userTarget;
        const targets = await devtools.List(options);
        const result = await func(targets);
        const object = typeof result === "number" ? targets[result] : result;
        return object.webSocketDebuggerUrl;
      }
      default:
        throw new Error(`Invalid target argument "${this.target}"`);
    }
  }

  // fetch the protocol according to 'protocol' and 'local'
  async _fetchProtocol(options) {
    // if a protocol has been provided then use it
    if (this.protocol) {
      return this.protocol;
    }
    // otherwise user either the local or the remote version
    else {
      options.local = this.local;
      return await devtools.Protocol(options);
    }
  }

  // establish the WebSocket connection and start processing user commands
  _connectToWebSocket() {
    return new Promise((fulfill, reject) => {
      // create the WebSocket
      try {
        if (this.secure) {
          this.webSocketUrl = this.webSocketUrl.replace(/^ws:/i, "wss:");
        }
        this._ws = new WebSocket(this.webSocketUrl);
      } catch (err) {
        // handles bad URLs
        reject(err);
        return;
      }
      // set up event handlers
      this._ws.onopen = () => {
        fulfill();
      };
      this._ws.onmessage = (data) => {
        const message = JSON.parse(data.data);
        this._handleMessage(message);
      };
      this._ws.onclose = (_code) => {
        this.emit("disconnect");
      };
      this._ws.onerror = (err) => {
        reject(err);
      };
    });
  }

  // handle the messages read from the WebSocket
  _handleMessage(message) {
    // command response
    if (message.id) {
      const callback = this._callbacks[message.id];
      if (!callback) {
        return;
      }
      // interpret the lack of both 'error' and 'result' as success
      // (this may happen with node-inspector)
      if (message.error) {
        callback(true, message.error);
      } else {
        callback(false, message.result || {});
      }
      // unregister command response callback
      delete this._callbacks[message.id];
      // notify when there are no more pending commands
      if (Object.keys(this._callbacks).length === 0) {
        this.emit("ready");
      }
    }
    // event
    else if (message.method) {
      const { method, params, sessionId } = message;
      this.emit("event", message);
      this.emit(method, params, sessionId);
      this.emit(`${method}.${sessionId}`, params, sessionId);
    }
  }

  // send a command to the remote endpoint and register a callback for the reply
  _enqueueCommand(method, params, sessionId, callback) {
    const id = this._nextCommandId++;
    const message = {
      id,
      method,
      sessionId,
      params: params || {},
    };
    this._ws.send(JSON.stringify(message));
    this._callbacks[id] = callback;
  }
}
