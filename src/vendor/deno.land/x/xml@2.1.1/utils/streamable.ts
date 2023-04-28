//Imports
import { Flux, SeekMode } from "./types.ts"

/**
 * Streamable string
 */
export class Streamable implements Flux {
  /** Constructor */
  constructor(string: string) {
    this.#buffer = new TextEncoder().encode(string)
  }

  /** Buffer */
  readonly #buffer: Uint8Array

  /** Cursor */
  #cursor = 0

  /** Read bytes */
  readSync(buffer: Uint8Array) {
    const bytes = this.#buffer.slice(this.#cursor, this.#cursor + buffer.length)
    buffer.set(bytes)
    this.#cursor = Math.min(this.#cursor + bytes.length, this.#buffer.length)
    return bytes.length || null
  }

  /** Set cursor position */
  seekSync(offset: number, whence: typeof SeekMode[keyof typeof SeekMode]) {
    switch (whence) {
      case SeekMode.Start:
        this.#cursor = offset
        break
      case SeekMode.Current:
        this.#cursor += offset
        break
      case SeekMode.End:
        this.#cursor = this.#buffer.length + offset
        break
    }
    return this.#cursor
  }
}
