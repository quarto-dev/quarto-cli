/*
 * index.js
 *
 * Copyright (c) 2021 Andrea Cardaci <cyrus.and@gmail.com>
 *
 * Deno port Copyright (C) 2022 Posit Software, PBC
 */

import EventEmitter from "events/mod.ts";
import Chrome from "./chrome.js";

export default CDP;
export { Protocol, List, New, Activate, Close, Version } from "./devtools.js";
import { nextTick } from "../../deno/next-tick.ts";

// const EventEmitter = require('events');
// const dns = require('dns');

/* const devtools = require('./lib/devtools.js');
const Chrome = require('./lib/chrome.js');
 */
// XXX reset the default that has been changed in
// (https://github.com/nodejs/node/pull/39987) to prefer IPv4. since
// implementations alway bind on 127.0.0.1 this solution should be fairly safe
// (see #467)
/*if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}*/

function CDP(options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }
  const notifier = new EventEmitter();
  if (typeof callback === "function") {
    // allow to register the error callback later
    nextTick(() => {
      new Chrome(options, notifier);
    });
    return notifier.once("connect", callback);
  } else {
    return new Promise((fulfill, reject) => {
      notifier.once("connect", fulfill);
      notifier.once("error", reject);
      new Chrome(options, notifier);
    });
  }
}
