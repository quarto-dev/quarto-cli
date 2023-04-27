//Imports
import type { Flux } from "./types.ts"
import { SeekMode } from "./types.ts"

/**
 * Text stream helper
 */
export class Stream {
  /** Constructor */
  constructor(content: Flux) {
    this.#content = content
  }

  /** Text decodeer */
  readonly #decoder = new TextDecoder()

  /** Text encoder */
  readonly #encoder = new TextEncoder()

  /** Content */
  readonly #content: Flux

  /** Cursor position */
  get cursor() {
    return this.#content.seekSync(0, SeekMode.Current)
  }

  /** Peek next bytes (cursor is replaced at current position after reading) */
  peek(bytes = 1, offset = 0) {
    const buffer = new Uint8Array(bytes)
    const cursor = this.cursor
    if (offset) {
      this.#content.seekSync(offset, SeekMode.Current)
    }
    if (this.#content.readSync(buffer)) {
      this.#content.seekSync(cursor, SeekMode.Start)
      return this.#decoder.decode(buffer)
    }
    throw new Deno.errors.UnexpectedEof()
  }

  /** Read next bytes (cursor is moved after reading) */
  read(bytes = 1) {
    const buffer = new Uint8Array(bytes)
    if (this.#content.readSync(buffer)) {
      return buffer
    }
    throw new Deno.errors.UnexpectedEof()
  }

  /** Capture next bytes until matching regex sequence (length can be used for regex with lookbehind) */
  capture(
    { until, bytes, trim = true, length = bytes }: { until: RegExp; bytes: number; trim?: boolean; length?: number },
  ) {
    if (trim) {
      this.trim()
    }
    const buffer = []
    while (!until.test(this.peek(bytes))) {
      buffer.push((this.read(1))[0])
    }
    if (bytes !== length) {
      buffer.push(...this.read(bytes - length))
    }
    if (trim) {
      this.trim()
    }
    return this.#decoder.decode(Uint8Array.from(buffer))
  }

  /** Consume next bytes ensuring that content is matching */
  consume({ content, trim = true }: { content: string; trim?: boolean }) {
    if (trim) {
      this.trim()
    }
    const bytes = this.#encoder.encode(content).length
    if (content === this.peek(bytes)) {
      this.read(bytes)
      if (trim) {
        this.trim()
      }
      return
    }
    throw Object.assign(
      new SyntaxError(`Expected next sequence to be "${content}", got "${this.peek(bytes)}" instead`),
      { stack: false },
    )
  }

  /** Trim content */
  trim() {
    try {
      while (/\s/.test(this.peek())) {
        this.read(1)
      }
    } catch (error) {
      if (error instanceof Deno.errors.UnexpectedEof) {
        return
      }
      throw error
    }
  }
}
