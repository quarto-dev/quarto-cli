import * as ansiEscapes from "./ansi_escapes.ts";
import type { Chain } from "./chain.ts";
import { Cursor, getCursorPosition } from "./cursor_position.ts";

/** Create new `Ansi` instance. */
export interface TtyOptions {
  writer?: Deno.WriterSync;
  reader?: Deno.ReaderSync & {
    readonly rid: number;
    setRaw(mode: boolean, options?: Deno.SetRawOptions): void;
  };
}

type Executor = (this: TtyChain, ...args: Args) => string;
type Args = Array<unknown>;
type Property = string | Executor;
type PropertyNames = keyof Chain<TtyChain>;

/** Ansi instance returned by all ansi escape properties. */
export interface TtyChain extends Exclude<Chain<TtyChain>, "cursorPosition"> {
  /** Write ansi escape sequence. */
  (): void;
  /** Get current cursor position. */
  getCursorPosition(): Cursor;
}

/** Create new `Tty` instance. */
export type TtyFactory = (options?: TtyOptions) => Tty;

/**
 * Chainable ansi escape sequences.
 * If invoked as method, a new Tty instance will be returned.
 */
export type Tty = TtyFactory & TtyChain;

/**
 * Chainable ansi escape sequences.
 * If invoked as method, a new Tty instance will be returned.
 *
 * ```ts
 * import { tty } from "./mod.ts";
 *
 * tty.cursorTo(0, 0).eraseScreen();
 * ```
 */
export const tty: Tty = factory();

const encoder = new TextEncoder();

function factory(options?: TtyOptions): Tty {
  let result = "";
  let stack: Array<[Property, Args]> = [];
  const writer = options?.writer ?? Deno.stdout;
  const reader = options?.reader ?? Deno.stdin;

  const tty: Tty = function (
    this: TtyChain | undefined,
    ...args: Args | [TtyOptions]
  ): TtyChain {
    if (this) {
      update(args);
      writer.writeSync(encoder.encode(result));
      return this;
    }
    return factory(args[0] as TtyOptions ?? options);
  } as Tty;

  tty.text = function (text: string): TtyChain {
    stack.push([text, []]);
    update();
    writer.writeSync(encoder.encode(result));
    return this;
  };

  tty.getCursorPosition = (): Cursor => getCursorPosition({ writer, reader });

  const methodList: Array<[PropertyNames, Property]> = Object.entries(
    ansiEscapes,
  ) as Array<[PropertyNames, Property]>;

  for (const [name, method] of methodList) {
    if (name === "cursorPosition") {
      continue;
    }
    Object.defineProperty(tty, name, {
      get(this: TtyChain) {
        stack.push([method, []]);
        return this;
      },
    });
  }

  return tty;

  function update(args?: Args) {
    if (!stack.length) {
      return;
    }
    if (args) {
      stack[stack.length - 1][1] = args;
    }
    result = stack.reduce(
      (prev: string, [cur, args]: [Property, Args]) =>
        prev + (typeof cur === "string" ? cur : cur.call(tty, ...args)),
      "",
    );
    stack = [];
  }
}
