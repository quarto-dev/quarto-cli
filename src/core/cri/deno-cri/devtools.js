/*
 * devtools.js
 *
 * Copyright (c) 2021 Andrea Cardaci <cyrus.and@gmail.com>
 *
 * Deno port Copyright (C) 2022 Posit Software, PBC
 */

import * as defaults from "./defaults.js";
import externalRequest from "./external-request.js";

// don't load localDescriptor for now
// import localDescriptor from "./protocol.json" assert { type: "json" };

// options.path must be specified; callback(err, data)
function devToolsInterface(options, callback) {
  options.host = options.host || defaults.HOST;
  options.port = options.port || defaults.PORT;
  options.secure = !!options.secure;
  options.useHostName = !!options.useHostName;
  options.alterPath = options.alterPath || ((path) => path);
  // allow the user to alter the path
  const newOptions = { ...options };
  newOptions.path = options.alterPath(options.path);
  newOptions.protocol = options.secure ? "https" : "http";
  return externalRequest(newOptions, callback);
}

export async function Protocol(options) {
  // this version doesn't support options.local
  /*if (options.local) {
    return localDescriptor;
  }*/

  // try to fetch the protocol remotely
  options.path = "/json/protocol";
  const result = await devToolsInterface(options);
  return JSON.parse(result);
}

export async function List(options) {
  options.path = "/json/list";

  const result = await devToolsInterface(options);
  return JSON.parse(result);
}

export async function New(options) {
  options.path = "/json/new";
  if (Object.prototype.hasOwnProperty.call(options, "url")) {
    options.path += `?${options.url}`;
  }
  // we don't mutate here because we don't want other
  // calls to have PUT as the method
  //
  // 2023-03-28: We use PUT since that works on the Chromium release given
  // by puppeteer as well as the later chromium versions which require PUT
  options = {
    ...options,
    method: "PUT",
  };
  const result = await devToolsInterface(options);
  return JSON.parse(result);
}

export async function Activate(options) {
  options.path = "/json/activate/" + options.id;
  await devToolsInterface(options);
  return null;
}

export async function Close(options) {
  options.path = "/json/close/" + options.id;
  await devToolsInterface(options);
  return null;
}

export async function Version(options) {
  options.path = "/json/version";
  const result = await devToolsInterface(options);
  return JSON.parse(result);
}
