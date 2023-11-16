/*global Deno, document, globalThis, console, Uint8Array, URL, ArrayBuffer, setTimeout, clearTimeout, Promise, Symbol, TextEncoder, addEventListener, removeEventListener, Map, window, self, global, TransformStream, AggregateError, ReadableStream, WritableStream, TextDecoder, Set, Int32Array, performance, Response, WebAssembly, atob, EventTarget, DOMException, localStorage, fetch, FormData, btoa, Buffer, Headers, WebSocket, File, Blob, Request, CompressionStream, URLSearchParams, AbortController, Atomics, SharedArrayBuffer, setInterval, clearInterval, BigInt, crypto, Uint32Array, Uint16Array, Float32Array, Float64Array, Int16Array, Int8Array, DataView, Document, Element, PATH, Proxy, noExitRuntime, Reflect, Intl, module, define, DocumentFragment, FinalizationRegistry, WeakMap */
// these are globals that deno-dom is leaking currently and we need to ignore them
// tracking on https://github.com/b-fuze/deno-dom/issues/151
/*global i, l, result */
/*eslint no-undef: "error"*/
