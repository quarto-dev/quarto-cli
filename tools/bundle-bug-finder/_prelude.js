/* definitions which exist in Deno's global scope and are ok for us to ignore */
/*global Deno, globalThis, console, Uint8Array, URL, ArrayBuffer, setTimeout, clearTimeout, Promise, Symbol, TextEncoder, addEventListener, removeEventListener, Map, window, self, global, TransformStream, AggregateError, ReadableStream, WritableStream, TextDecoder, Set, Int32Array, performance, Response, WebAssembly, atob, EventTarget, DOMException, localStorage, fetch, FormData, btoa, Buffer, Headers, WebSocket, File, Blob, Request, CompressionStream, URLSearchParams, AbortController, Atomics, SharedArrayBuffer, setInterval, clearInterval, BigInt, crypto, Uint32Array, Uint16Array, Float32Array, Float64Array, Int16Array, Int8Array, DataView, Proxy, Reflect, Intl, FinalizationRegistry, WeakMap */

// globals that deno-dom is leaking currently and we need to ignore them
// tracking on https://github.com/b-fuze/deno-dom/issues/151
/*global i, l, result */

/* deno-dom browser-only codepath: */
/*global document, Element, Document, DocumentFragment */

/* Emscripten prelude: */
/* global PATH, noExitRuntime */

/* commonjs etc globals, guarded by `typeof`, eslint analysis fails here: */
/*global define, module */

/*eslint no-undef: "error"*/
