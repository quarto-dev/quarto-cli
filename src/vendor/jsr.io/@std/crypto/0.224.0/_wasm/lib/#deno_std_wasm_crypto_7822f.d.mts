// deno-lint-ignore-file
// deno-fmt-ignore-file

export interface InstantiateResult {
  instance: WebAssembly.Instance;
  exports: {
    digest: typeof digest;
    DigestContext : typeof DigestContext 
  };
}

/** Gets if the Wasm module has been instantiated. */
export function isInstantiated(): boolean;


/** Instantiates an instance of the Wasm module returning its functions.
* @remarks It is safe to call this multiple times and once successfully
* loaded it will always return a reference to the same object. */
export function instantiate(): InstantiateResult["exports"];

/** Instantiates an instance of the Wasm module along with its exports.
 * @remarks It is safe to call this multiple times and once successfully
 * loaded it will always return a reference to the same object. */
export function instantiateWithInstance(): InstantiateResult;

/**
* Returns the digest of the given `data` using the given hash `algorithm`.
*
* `length` will usually be left `undefined` to use the default length for
* the algorithm. For algorithms with variable-length output, it can be used
* to specify a non-negative integer number of bytes.
*
* An error will be thrown if `algorithm` is not a supported hash algorithm or
* `length` is not a supported length for the algorithm.
* @param {string} algorithm
* @param {Uint8Array} data
* @param {number | undefined} [length]
* @returns {Uint8Array}
*/
export function digest(algorithm: string, data: Uint8Array, length?: number): Uint8Array;
/**
* A context for incrementally computing a digest using a given hash algorithm.
*/
export class DigestContext {
  free(): void;
/**
* Creates a new context incrementally computing a digest using the given
* hash algorithm.
*
* An error will be thrown if `algorithm` is not a supported hash algorithm.
* @param {string} algorithm
*/
  constructor(algorithm: string);
/**
* Update the digest's internal state with the additional input `data`.
*
* If the `data` array view is large, it will be split into subarrays (via
* JavaScript bindings) which will be processed sequentially in order to
* limit the amount of memory that needs to be allocated in the Wasm heap.
* @param {Uint8Array} data
*/
  update(data: Uint8Array): void;
/**
* Returns the digest of the input data so far, and then drops the context
* from memory on the Wasm side. This context must no longer be used, and any
* further method calls will result in null pointer errors being thrown.
* https://github.com/rustwasm/wasm-bindgen/blob/bf39cfd8/crates/backend/src/codegen.rs#L186
*
* `length` will usually be left `undefined` to use the default length for
* the algorithm. For algorithms with variable-length output, it can be used
* to specify a non-negative integer number of bytes.
*
* An error will be thrown if `length` is not a supported length for the algorithm.
* @param {number | undefined} [length]
* @returns {Uint8Array}
*/
  digestAndDrop(length?: number): Uint8Array;
}
