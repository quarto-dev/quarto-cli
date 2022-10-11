// deno-lint-ignore-file no-explicit-any ban-types

import { tty } from "../ansi/tty.ts";
import {
  GenericPrompt,
  GenericPromptOptions,
  StaticGenericPrompt,
} from "./_generic_prompt.ts";

type Next<N extends keyof any> = (
  next?: N | number | true | null,
) => Promise<void>;

type PromptOptions<
  N0 extends string,
  G0 extends StaticGenericPrompt<any, any, any, any, any> | void,
  R,
  U = G0 extends StaticGenericPrompt<any, any, any, any, any>
    ? Parameters<G0["prompt"]>[0]
    : never,
> = G0 extends StaticGenericPrompt<any, any, any, any, any> ? 
    & {
      name: N0;
      type: G0;
      before?: (
        opts: R,
        next: Next<Exclude<keyof R, symbol>>,
      ) => void | Promise<void>;
      after?: (
        opts: R,
        next: Next<Exclude<keyof R, symbol>>,
      ) => void | Promise<void>;
    }
    // exclude none options parameter
    & (U extends GenericPromptOptions<any, any> ? U : {})
  : never;

type PromptResult<
  N extends string,
  G extends StaticGenericPrompt<any, any, any, any, any> | void,
> = G extends StaticGenericPrompt<any, any, any, any, any> ? {
    [K in N]?: Awaited<ReturnType<G["prompt"]>>;
  }
  : {};

interface PromptListOptions<R, N extends keyof R = keyof R> {
  cbreak?: boolean;
  before?: (
    name: N,
    opts: R,
    next: Next<Exclude<N, symbol>>,
  ) => void | Promise<void>;
  after?: (
    name: N,
    opts: R,
    next: Next<Exclude<N, symbol>>,
  ) => void | Promise<void>;
}

/** Global prompt options. */
export interface GlobalPromptOptions<R, N extends keyof R = keyof R>
  extends PromptListOptions<R, N> {
  initial?: N extends symbol ? never : N;
}

type Id<T> = T extends Record<string, unknown>
  ? T extends infer U ? { [K in keyof U]: Id<U[K]> } : never
  : T;

export function prompt<
  N0 extends string,
  N1 extends string,
  N2 extends string,
  N3 extends string,
  N4 extends string,
  N5 extends string,
  N6 extends string,
  N7 extends string,
  N8 extends string,
  N9 extends string,
  N10 extends string,
  N11 extends string,
  N12 extends string,
  N13 extends string,
  N14 extends string,
  N15 extends string,
  N16 extends string,
  N17 extends string,
  N18 extends string,
  N19 extends string,
  N20 extends string,
  N21 extends string,
  N22 extends string,
  N23 extends string,
  O0 extends GenericPromptOptions<any, any>,
  O1 extends GenericPromptOptions<any, any>,
  O2 extends GenericPromptOptions<any, any>,
  O3 extends GenericPromptOptions<any, any>,
  O4 extends GenericPromptOptions<any, any>,
  O5 extends GenericPromptOptions<any, any>,
  O6 extends GenericPromptOptions<any, any>,
  O7 extends GenericPromptOptions<any, any>,
  O8 extends GenericPromptOptions<any, any>,
  O9 extends GenericPromptOptions<any, any>,
  O10 extends GenericPromptOptions<any, any>,
  O11 extends GenericPromptOptions<any, any>,
  O12 extends GenericPromptOptions<any, any>,
  O13 extends GenericPromptOptions<any, any>,
  O14 extends GenericPromptOptions<any, any>,
  O15 extends GenericPromptOptions<any, any>,
  O16 extends GenericPromptOptions<any, any>,
  O17 extends GenericPromptOptions<any, any>,
  O18 extends GenericPromptOptions<any, any>,
  O19 extends GenericPromptOptions<any, any>,
  O20 extends GenericPromptOptions<any, any>,
  O21 extends GenericPromptOptions<any, any>,
  O22 extends GenericPromptOptions<any, any>,
  O23 extends GenericPromptOptions<any, any>,
  G0 extends StaticGenericPrompt<any, any, O0, any, any>,
  G1 extends StaticGenericPrompt<any, any, O1, any, any> | void = void,
  G2 extends StaticGenericPrompt<any, any, O2, any, any> | void = void,
  G3 extends StaticGenericPrompt<any, any, O3, any, any> | void = void,
  G4 extends StaticGenericPrompt<any, any, O4, any, any> | void = void,
  G5 extends StaticGenericPrompt<any, any, O5, any, any> | void = void,
  G6 extends StaticGenericPrompt<any, any, O6, any, any> | void = void,
  G7 extends StaticGenericPrompt<any, any, O7, any, any> | void = void,
  G8 extends StaticGenericPrompt<any, any, O8, any, any> | void = void,
  G9 extends StaticGenericPrompt<any, any, O9, any, any> | void = void,
  G10 extends StaticGenericPrompt<any, any, O10, any, any> | void = void,
  G11 extends StaticGenericPrompt<any, any, O11, any, any> | void = void,
  G12 extends StaticGenericPrompt<any, any, O12, any, any> | void = void,
  G13 extends StaticGenericPrompt<any, any, O13, any, any> | void = void,
  G14 extends StaticGenericPrompt<any, any, O14, any, any> | void = void,
  G15 extends StaticGenericPrompt<any, any, O15, any, any> | void = void,
  G16 extends StaticGenericPrompt<any, any, O16, any, any> | void = void,
  G17 extends StaticGenericPrompt<any, any, O17, any, any> | void = void,
  G18 extends StaticGenericPrompt<any, any, O18, any, any> | void = void,
  G19 extends StaticGenericPrompt<any, any, O19, any, any> | void = void,
  G20 extends StaticGenericPrompt<any, any, O20, any, any> | void = void,
  G21 extends StaticGenericPrompt<any, any, O21, any, any> | void = void,
  G22 extends StaticGenericPrompt<any, any, O22, any, any> | void = void,
  G23 extends StaticGenericPrompt<any, any, O23, any, any> | void = void,
  R = Id<
    & PromptResult<N0, G0>
    & PromptResult<N1, G1>
    & PromptResult<N2, G2>
    & PromptResult<N3, G3>
    & PromptResult<N4, G4>
    & PromptResult<N5, G5>
    & PromptResult<N6, G6>
    & PromptResult<N7, G7>
    & PromptResult<N8, G8>
    & PromptResult<N9, G9>
    & PromptResult<N10, G10>
    & PromptResult<N11, G11>
    & PromptResult<N12, G12>
    & PromptResult<N13, G13>
    & PromptResult<N14, G14>
    & PromptResult<N15, G15>
    & PromptResult<N16, G16>
    & PromptResult<N17, G17>
    & PromptResult<N18, G18>
    & PromptResult<N19, G19>
    & PromptResult<N20, G20>
    & PromptResult<N21, G21>
    & PromptResult<N22, G22>
    & PromptResult<N23, G23>
  >,
>(prompts: [
  PromptOptions<N0, G0, R>,
  PromptOptions<N1, G1, R>?,
  PromptOptions<N2, G2, R>?,
  PromptOptions<N3, G3, R>?,
  PromptOptions<N4, G4, R>?,
  PromptOptions<N5, G5, R>?,
  PromptOptions<N6, G6, R>?,
  PromptOptions<N7, G7, R>?,
  PromptOptions<N8, G8, R>?,
  PromptOptions<N9, G9, R>?,
  PromptOptions<N10, G10, R>?,
  PromptOptions<N11, G11, R>?,
  PromptOptions<N12, G12, R>?,
  PromptOptions<N13, G13, R>?,
  PromptOptions<N14, G14, R>?,
  PromptOptions<N15, G15, R>?,
  PromptOptions<N16, G16, R>?,
  PromptOptions<N17, G17, R>?,
  PromptOptions<N18, G18, R>?,
  PromptOptions<N19, G19, R>?,
  PromptOptions<N20, G20, R>?,
  PromptOptions<N21, G21, R>?,
  PromptOptions<N22, G22, R>?,
  PromptOptions<N23, G23, R>?,
], options?: GlobalPromptOptions<R>): Promise<R> {
  return new PromptList(
    prompts as PromptOptions<any, any, any, any>,
    options as PromptListOptions<any>,
  ).run(options?.initial) as Promise<R>;
}

let injected: Record<string, any> = {};

/**
 * Inject prompt values. Can be used for unit tests or pre selections.
 * @param values Input values object.
 */
export function inject(values: Record<string, any>): void {
  injected = values;
}

class PromptList {
  private result: Record<string, any> = {};
  private index = -1;
  private names: Array<string>;
  private isInBeforeHook = false;

  private get prompt(): PromptOptions<string, any, any> {
    return this.prompts[this.index];
  }

  public constructor(
    private prompts: Array<PromptOptions<string, any, any>>,
    private options?: PromptListOptions<any>,
  ) {
    this.names = this.prompts.map((prompt) => prompt.name);
  }

  public async run(
    name?: string | number | true,
  ): Promise<Record<string, any>> {
    this.index = -1;
    this.result = {};
    this.isInBeforeHook = false;
    await this.next(name);
    return this.result;
  }

  private async next(name?: string | number | true | null): Promise<void> {
    if (this.updateIndex(name)) {
      await this.runBeforeHook(async () => {
        this.isInBeforeHook = false;
        await this.runPrompt();
        await this.runAfterHook();
      });
    }
  }

  private updateIndex(name?: string | number | true | null): boolean {
    if (name && typeof name === "string") {
      this.index = this.names.indexOf(name);
      if (this.index === -1) {
        throw new Error(
          `Invalid prompt name: ${name}, allowed prompt names: ${
            this.names.join(", ")
          }`,
        );
      }
    } else if (typeof name === "number") {
      if (name < 0 || name > this.names.length) {
        throw new Error(
          `Invalid prompt index: ${name}, prompt length: ${this.names.length}`,
        );
      }
      this.index = name;
    } else if (name === true && !this.isInBeforeHook) {
      this.index++;
      if (this.index < this.names.length - 1) {
        this.index++;
      }
    } else {
      this.index++;
    }

    this.isInBeforeHook = false;

    if (this.index < this.names.length) {
      return true;
    } else if (this.index === this.names.length) {
      return false;
    } else {
      throw new Error("next() called multiple times");
    }
  }

  private async runBeforeHook(run: () => Promise<void>): Promise<void> {
    this.isInBeforeHook = true;

    const next = async (name?: string | number | true | null) => {
      if (name || typeof name === "number") {
        return this.next(name as (string | number | true));
      }
      await run();
    };

    if (this.options?.before) {
      await this.options.before(
        this.prompt.name,
        this.result,
        async (name?: string | number | true | null) => {
          if (name || typeof name === "number") {
            return this.next(name as (string | number | true));
          } else if (this.prompt.before) {
            await this.prompt.before(this.result, next);
          } else {
            await run();
          }
        },
      );

      return;
    } else if (this.prompt.before) {
      await this.prompt.before(this.result, next);

      return;
    }

    await run();
  }

  private async runPrompt(): Promise<void> {
    const prompt: StaticGenericPrompt<any, any, any, any, any> =
      this.prompt.type;

    if (typeof injected[this.prompt.name] !== "undefined") {
      if (prompt.inject) {
        prompt.inject(injected[this.prompt.name]);
      } else {
        GenericPrompt.inject(injected[this.prompt.name]);
      }
    }

    try {
      this.result[this.prompt.name] = await prompt.prompt({
        cbreak: this.options?.cbreak,
        ...this.prompt,
      });
    } finally {
      tty.cursorShow();
    }
  }

  private async runAfterHook(): Promise<void> {
    if (this.options?.after) {
      await this.options.after(this.prompt.name, this.result, async (name) => {
        if (name) {
          return this.next(name as string);
        } else if (this.prompt.after) {
          await this.prompt.after(this.result, (name) => this.next(name));
        } else {
          await this.next();
        }
      });
    } else if (this.prompt.after) {
      await this.prompt.after(this.result, (name) => this.next(name));
    } else {
      await this.next();
    }
  }
}
