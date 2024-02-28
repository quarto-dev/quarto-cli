import * as ansiEscapes from "./ansi_escapes.ts";
import type { Chain } from "./chain.ts";

type Args = Array<unknown>;
type Executor = (this: AnsiChain, ...args: Args) => string;
type Property = string | Executor;
type PropertyNames = keyof Chain<AnsiChain>;

/** Ansi instance returned by all ansi escape properties. */
export interface AnsiChain extends Chain<AnsiChain> {
  /** Get ansi escape sequence. */
  (): string;

  /** Get ansi escape sequences as string. */
  toString(): string;

  /** Get ansi escape sequences as bytes. */
  bytes(): Uint8Array;
}

/** Create new `Ansi` instance. */
export type AnsiFactory = () => Ansi;

/**
 * Chainable ansi escape sequences.
 * If invoked as method, a new Ansi instance will be returned.
 */
export type Ansi = AnsiFactory & AnsiChain;

/**
 * Chainable ansi escape sequences.
 * If invoked as method, a new Ansi instance will be returned.
 *
 * ```ts
 * import { ansi } from "./mod.ts";
 *
 * await Deno.stdout.write(
 *   new TextEncoder().encode(
 *     ansi.cursorTo(0, 0).eraseScreen(),
 *   ),
 * );
 * ```
 *
 * Or shorter:
 *
 * ```ts
 * import { ansi } from "./mod.ts";
 *
 * await Deno.stdout.write(
 *   ansi.cursorTo(0, 0).eraseScreen.bytes(),
 * );
 * ```
 */
export const ansi: Ansi = factory();

const encoder = new TextEncoder();

function factory(): Ansi {
  let result: Array<string> = [];
  let stack: Array<[Property, Args]> = [];

  const ansi: Ansi = function (
    this: AnsiChain | undefined,
    ...args: Args
  ): string | AnsiChain {
    if (this) {
      if (args.length) {
        update(args);
        return this;
      }
      return this.toString();
    }
    return factory();
  } as Ansi;

  ansi.text = function (text: string): AnsiChain {
    stack.push([text, []]);
    return this;
  };

  ansi.toArray = function (): Array<string> {
    update();
    const ret: Array<string> = result;
    result = [];
    return ret;
  };

  ansi.toString = function (): string {
    return this.toArray().join("");
  };

  ansi.bytes = function (): Uint8Array {
    return encoder.encode(this.toString());
  };

  const methodList: Array<[PropertyNames, Property]> = Object.entries(
    ansiEscapes,
  ) as Array<[PropertyNames, Property]>;

  for (const [name, method] of methodList) {
    Object.defineProperty(ansi, name, {
      get(this: AnsiChain) {
        stack.push([method, []]);
        return this;
      },
    });
  }

  return ansi;

  function update(args?: Args) {
    if (!stack.length) {
      return;
    }
    if (args) {
      stack[stack.length - 1][1] = args;
    }
    result.push(
      ...stack.map(([prop, args]: [Property, Args]) =>
        typeof prop === "string" ? prop : prop.call(ansi, ...args)
      ),
    );
    stack = [];
  }
}
