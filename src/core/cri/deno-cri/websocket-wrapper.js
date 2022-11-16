/*
 * websocket-wrapper.js
 *
 * Copyright (c) 2021 Andrea Cardaci <cyrus.and@gmail.com>
 *
 * Deno port Copyright (C) 2022 Posit Software, PBC
 */

import EventEmitter from "events/mod.ts";

// wrapper around the Node.js ws module
// for use in browsers
export class WebSocketWrapper extends EventEmitter {
  constructor(url) {
    super();
    this._ws = new WebSocket(url); // eslint-disable-line no-undef
    this._ws.onopen = () => {
      this.emit("open");
    };
    this._ws.onclose = () => {
      this.emit("close");
    };
    this._ws.onmessage = (event) => {
      this.emit("message", event.data);
    };
    this._ws.onerror = () => {
      this.emit("error", new Error("WebSocket error"));
    };
  }

  close() {
    this._ws.close();
  }

  send(data, callback) {
    try {
      this._ws.send(data);
      callback();
    } catch (err) {
      callback(err);
    }
  }
}
