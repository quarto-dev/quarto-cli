// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import * as asyncWrap from "./async_wrap.ts";
import * as buffer from "./buffer.ts";
import * as config from "./config.ts";
import * as caresWrap from "./cares_wrap.ts";
import * as constants from "./constants.ts";
import * as contextify from "./contextify.ts";
import * as crypto from "./crypto.ts";
import * as credentials from "./credentials.ts";
import * as errors from "./errors.ts";
import * as fs from "./fs.ts";
import * as fsDir from "./fs_dir.ts";
import * as fsEventWrap from "./fs_event_wrap.ts";
import * as heapUtils from "./heap_utils.ts";
import * as httpParser from "./http_parser.ts";
import * as icu from "./icu.ts";
import * as inspector from "./inspector.ts";
import * as jsStream from "./js_stream.ts";
import * as messaging from "./messaging.ts";
import * as moduleWrap from "./module_wrap.ts";
import * as nativeModule from "./native_module.ts";
import * as natives from "./natives.ts";
import * as options from "./options.ts";
import * as os from "./os.ts";
import * as pipeWrap from "./pipe_wrap.ts";
import * as performance from "./performance.ts";
import * as processMethods from "./process_methods.ts";
import * as report from "./report.ts";
import * as serdes from "./serdes.ts";
import * as signalWrap from "./signal_wrap.ts";
import * as spawnSync from "./spawn_sync.ts";
import * as streamWrap from "./stream_wrap.ts";
import * as stringDecoder from "./string_decoder.ts";
import * as symbols from "./symbols.ts";
import * as taskQueue from "./task_queue.ts";
import * as tcpWrap from "./tcp_wrap.ts";
import * as timers from "./timers.ts";
import * as tlsWrap from "./tls_wrap.ts";
import * as traceEvents from "./trace_events.ts";
import * as ttyWrap from "./tty_wrap.ts";
import * as types from "./types.ts";
import * as udpWrap from "./udp_wrap.ts";
import * as url from "./url.ts";
import * as util from "./util.ts";
import * as uv from "./uv.ts";
import * as v8 from "./v8.ts";
import * as worker from "./worker.ts";
import * as zlib from "./zlib.ts";

const modules = {
  "async_wrap": asyncWrap,
  buffer,
  "cares_wrap": caresWrap,
  config,
  constants,
  contextify,
  credentials,
  crypto,
  errors,
  fs,
  "fs_dir": fsDir,
  "fs_event_wrap": fsEventWrap,
  "heap_utils": heapUtils,
  "http_parser": httpParser,
  icu,
  inspector,
  "js_stream": jsStream,
  messaging,
  "module_wrap": moduleWrap,
  "native_module": nativeModule,
  natives,
  options,
  os,
  performance,
  "pipe_wrap": pipeWrap,
  "process_methods": processMethods,
  report,
  serdes,
  "signal_wrap": signalWrap,
  "spawn_sync": spawnSync,
  "stream_wrap": streamWrap,
  "string_decoder": stringDecoder,
  symbols,
  "task_queue": taskQueue,
  "tcp_wrap": tcpWrap,
  timers,
  "tls_wrap": tlsWrap,
  "trace_events": traceEvents,
  "tty_wrap": ttyWrap,
  types,
  "udp_wrap": udpWrap,
  url,
  util,
  uv,
  v8,
  worker,
  zlib,
};

export type BindingName = keyof typeof modules;

export function getBinding(name: BindingName) {
  const mod = modules[name];
  if (!mod) {
    throw new Error(`No such module: ${name}`);
  }
  return mod;
}
