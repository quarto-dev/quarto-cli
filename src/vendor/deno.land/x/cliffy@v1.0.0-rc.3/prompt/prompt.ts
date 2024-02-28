// deno-lint-ignore-file no-explicit-any ban-types

import { Tty, tty } from "../ansi/tty.ts";
import {
  GenericPrompt,
  GenericPromptOptions,
  InferPromptOptions,
  InferPromptValue,
  StaticGenericPrompt,
} from "./_generic_prompt.ts";
import type { Select, SelectOptions } from "./select.ts";
import type { Checkbox, CheckboxOptions } from "./checkbox.ts";

/**
 * Prompt options for the `prompt()` method.
 *
 * ```ts
 * import { PromptOptions } from "./prompt.ts";
 * import { Checkbox } from "./checkbox.ts";
 *
 * const options: PromptOptions<"color", typeof Checkbox> = {
 *   name: "color",
 *   message: "Select a color",
 *   type: Checkbox,
 *   options: ["red", "green", "blue"],
 * };
 * ```
 */
export type PromptOptions<
  TName extends string,
  TPrompt extends GenericPrompt<any, any> | StaticGenericPrompt<any, any>,
  TResult extends
    & PromptResult<TName, TPrompt>
    & Record<string, unknown> = PromptResult<
      TName,
      TPrompt
    >,
> = Id<TResult & PromptResult<TName, TPrompt>> extends infer Result ?
    & {
      name: TName;
      before?: PromptMiddleware<Result>;
      after?: PromptMiddleware<Result>;
    }
    & (TPrompt extends GenericPrompt<any, any> ? (
        & InferPromptOptions<TPrompt>
        & {
          type: StaticGenericPrompt<
            InferPromptValue<TPrompt>,
            InferPromptOptions<TPrompt>
          >;
        }
      )
      : TPrompt extends typeof Checkbox<infer Value> ? (
          & CheckboxOptions<unknown extends Value ? string : Value>
          & { type: TPrompt }
        )
      : TPrompt extends typeof Select<infer Value> ? (
          & SelectOptions<unknown extends Value ? string : Value>
          & { type: TPrompt }
        )
      : (
        & Parameters<TPrompt["prompt"]>[0]
        & { type: TPrompt }
      ))
  : never;

/**
 * Global prompt options used together with the `prompt()` method.
 *
 * ```ts
 * import { PromptOptions } from "./prompt.ts";
 * import { Checkbox } from "./checkbox.ts";
 *
 * const options: PromptOptions<"color", typeof Checkbox> = {
 *   name: "color",
 *   message: "Select a color",
 *   type: Checkbox,
 *   options: ["red", "green", "blue"],
 * };
 * ```
 */
export interface GlobalPromptOptions<TResult> {
  cbreak?: boolean;
  before?: GlobalPromptMiddleware<TResult>;
  after?: GlobalPromptMiddleware<TResult>;
  reader?: GenericPromptOptions<unknown, unknown>["reader"];
  writer?: GenericPromptOptions<unknown, unknown>["writer"];
  initial?: keyof TResult extends infer U ? Extract<U, string> : never;
}

/**
 * Prompt middleware function.
 *
 * ```ts
 * import { prompt } from "./prompt.ts";
 * import { Input } from "./input.ts";
 *
 * const result = await prompt([{
 *   name: "name",
 *   message: "Project name",
 *   type: Input,
 *   async after({ name }, next) {
 *     // name prompt executed.
 *     await next();
 *     // path prompt executed.
 *   }
 * }, {
 *   name: "path",
 *   message: "Project path",
 *   type: Input,
 *   async before({ name }, next) {
 *     // name prompt executed.
 *     await next();
 *     // path prompt executed.
 *   }
 * }]);
 * ```
 */
export type PromptMiddleware<TResult> = (
  result: TResult,
  next: Next<Exclude<keyof TResult, symbol>>,
) => void | Promise<void>;

/**
 * Prompt middleware function.
 *
 * ```ts
 * import { prompt } from "./prompt.ts";
 * import { Input } from "./input.ts";
 *
 * const result = await prompt([{
 *   name: "name",
 *   message: "Project name",
 *   type: Input,
 * }, {
 *   name: "path",
 *   message: "Project path",
 *   type: Input,
 * }], {
 *   async before(promptName, { name }, next) {
 *     // do something before {promptName} excution.
 *     await next();
 *     // all prompts executed.
 *   },
 *   async after(promptName, { name }, next) {
 *     // do something after {promptName} excution.
 *     await next();
 *     // all prompts executed.
 *   }
 * });
 * ```
 */
export type GlobalPromptMiddleware<TResult> = (
  name: keyof TResult,
  result: TResult,
  next: Next<Exclude<keyof TResult, symbol>>,
) => void | Promise<void>;

/** Runs the next prompt. */
export type Next<TName extends keyof any> = (
  next?: TName | number | true | null,
) => Promise<void>;

/** Single prompt result. */
type PromptResult<
  TName extends string,
  TPrompt extends
    | GenericPrompt<any, any>
    | StaticGenericPrompt<any, any>
    | void,
> = string extends TName ? {}
  : TPrompt extends typeof Checkbox<infer U> ? {
      [Key in TName]?: Array<unknown extends U ? string : U>;
    }
  : TPrompt extends typeof Select<infer U> ? {
      [Key in TName]?: unknown extends U ? string : U;
    }
  : TPrompt extends GenericPrompt<any, any> | StaticGenericPrompt<any, any> ? {
      [Key in TName]?: Awaited<ReturnType<TPrompt["prompt"]>>;
    }
  : {};

type Id<T> = T extends Record<string, unknown>
  ? T extends infer U ? { [K in keyof U]: Id<U[K]> } : never
  : T;

let injected: Record<string, any> = {};

/**
 * Inject prompt values. Can be used for unit tests.
 *
 * In the following example, the `prompt()` method only asks for the color.
 * The values for `name' and `age' are selected from the values injected by the
 * `inject()' method and the prompts are skipped.
 *
 * ```ts
 * import { inject, prompt } from "./prompt.ts";
 * import { Input } from "./input.ts";
 * import { Number } from "./number.ts";
 * import { Confirm } from "./confirm.ts";
 * import { Checkbox } from "./checkbox.ts";
 *
 * inject({
 *   name: "Joe",
 *   age: 34,
 * });
 *
 * const result = await prompt([{
 *   name: "name",
 *   message: "What's your name?",
 *   type: Input,
 * }, {
 *   name: "age",
 *   message: "How old are you?",
 *   type: Confirm,
 * }, {
 *   name: "color",
 *   message: "Whats your favorit color?",
 *   type: Checkbox,
 *   options: ["red", "green", "blue"],
 * }]);
 * ```
 * @param values Input values object.
 */
export function inject(values: Record<string, any>): void {
  injected = values;
}

/**
 * Runs an array of prompts.
 *
 * ```ts
 * import { prompt } from "./prompt.ts";
 * import { Input } from "./input.ts";
 * import { Confirm } from "./confirm.ts";
 * import { Checkbox } from "./checkbox.ts";
 *
 * const result = await prompt([{
 *   name: "name",
 *   message: "What's your name?",
 *   type: Input,
 * }, {
 *   name: "age",
 *   message: "How old are you?",
 *   type: Confirm,
 * }, {
 *   name: "color",
 *   message: "Whats your favorit color?",
 *   type: Checkbox,
 *   options: ["red", "green", "blue"],
 * }]);
 *
 * console.log(result);
 * ```
 *
 * @param prompts Array of prompt options.
 * @param options Global prompt options.
 *
 * @returns Returns an object with the result of all prompts.
 */
export function prompt<
  TName0 extends string,
  TName1 extends string,
  TName2 extends string,
  TName3 extends string,
  TName4 extends string,
  TName5 extends string,
  TName6 extends string,
  TName7 extends string,
  TName8 extends string,
  TName9 extends string,
  TName10 extends string,
  TName11 extends string,
  TName12 extends string,
  TName13 extends string,
  TName14 extends string,
  TName15 extends string,
  TName16 extends string,
  TName17 extends string,
  TName18 extends string,
  TName19 extends string,
  TName20 extends string,
  TName21 extends string,
  TName22 extends string,
  TName23 extends string,
  TOptions0 extends GenericPromptOptions<any, any>,
  TOptions1 extends GenericPromptOptions<any, any>,
  TOptions2 extends GenericPromptOptions<any, any>,
  TOptions3 extends GenericPromptOptions<any, any>,
  TOptions4 extends GenericPromptOptions<any, any>,
  TOptions5 extends GenericPromptOptions<any, any>,
  TOptions6 extends GenericPromptOptions<any, any>,
  TOptions7 extends GenericPromptOptions<any, any>,
  TOptions8 extends GenericPromptOptions<any, any>,
  TOptions9 extends GenericPromptOptions<any, any>,
  TOptions10 extends GenericPromptOptions<any, any>,
  TOptions11 extends GenericPromptOptions<any, any>,
  TOptions12 extends GenericPromptOptions<any, any>,
  TOptions13 extends GenericPromptOptions<any, any>,
  TOptions14 extends GenericPromptOptions<any, any>,
  TOptions15 extends GenericPromptOptions<any, any>,
  TOptions16 extends GenericPromptOptions<any, any>,
  TOptions17 extends GenericPromptOptions<any, any>,
  TOptions18 extends GenericPromptOptions<any, any>,
  TOptions19 extends GenericPromptOptions<any, any>,
  TOptions20 extends GenericPromptOptions<any, any>,
  TOptions21 extends GenericPromptOptions<any, any>,
  TOptions22 extends GenericPromptOptions<any, any>,
  TOptions23 extends GenericPromptOptions<any, any>,
  TStaticPrompt0 extends StaticGenericPrompt<any, TOptions0>,
  TStaticPrompt1 extends StaticGenericPrompt<any, TOptions1>,
  TStaticPrompt2 extends StaticGenericPrompt<any, TOptions2>,
  TStaticPrompt3 extends StaticGenericPrompt<any, TOptions3>,
  TStaticPrompt4 extends StaticGenericPrompt<any, TOptions4>,
  TStaticPrompt5 extends StaticGenericPrompt<any, TOptions5>,
  TStaticPrompt6 extends StaticGenericPrompt<any, TOptions6>,
  TStaticPrompt7 extends StaticGenericPrompt<any, TOptions7>,
  TStaticPrompt8 extends StaticGenericPrompt<any, TOptions8>,
  TStaticPrompt9 extends StaticGenericPrompt<any, TOptions9>,
  TStaticPrompt10 extends StaticGenericPrompt<any, TOptions10>,
  TStaticPrompt11 extends StaticGenericPrompt<any, TOptions11>,
  TStaticPrompt12 extends StaticGenericPrompt<any, TOptions12>,
  TStaticPrompt13 extends StaticGenericPrompt<any, TOptions13>,
  TStaticPrompt14 extends StaticGenericPrompt<any, TOptions14>,
  TStaticPrompt15 extends StaticGenericPrompt<any, TOptions15>,
  TStaticPrompt16 extends StaticGenericPrompt<any, TOptions16>,
  TStaticPrompt17 extends StaticGenericPrompt<any, TOptions17>,
  TStaticPrompt18 extends StaticGenericPrompt<any, TOptions18>,
  TStaticPrompt19 extends StaticGenericPrompt<any, TOptions19>,
  TStaticPrompt20 extends StaticGenericPrompt<any, TOptions20>,
  TStaticPrompt21 extends StaticGenericPrompt<any, TOptions21>,
  TStaticPrompt22 extends StaticGenericPrompt<any, TOptions22>,
  TStaticPrompt23 extends StaticGenericPrompt<any, TOptions23>,
  TResult = Id<
    & PromptResult<TName0, TStaticPrompt0>
    & PromptResult<TName1, TStaticPrompt1>
    & PromptResult<TName2, TStaticPrompt2>
    & PromptResult<TName3, TStaticPrompt3>
    & PromptResult<TName4, TStaticPrompt4>
    & PromptResult<TName5, TStaticPrompt5>
    & PromptResult<TName6, TStaticPrompt6>
    & PromptResult<TName7, TStaticPrompt7>
    & PromptResult<TName8, TStaticPrompt8>
    & PromptResult<TName9, TStaticPrompt9>
    & PromptResult<TName10, TStaticPrompt10>
    & PromptResult<TName11, TStaticPrompt11>
    & PromptResult<TName12, TStaticPrompt12>
    & PromptResult<TName13, TStaticPrompt13>
    & PromptResult<TName14, TStaticPrompt14>
    & PromptResult<TName15, TStaticPrompt15>
    & PromptResult<TName16, TStaticPrompt16>
    & PromptResult<TName17, TStaticPrompt17>
    & PromptResult<TName18, TStaticPrompt18>
    & PromptResult<TName19, TStaticPrompt19>
    & PromptResult<TName20, TStaticPrompt20>
    & PromptResult<TName21, TStaticPrompt21>
    & PromptResult<TName22, TStaticPrompt22>
    & PromptResult<TName23, TStaticPrompt23>
  >,
>(
  prompts: [
    PromptOptions<
      TName0,
      TStaticPrompt0,
      TResult & PromptResult<TName0, TStaticPrompt0>
    >,
    PromptOptions<
      TName1,
      TStaticPrompt1,
      TResult & PromptResult<TName1, TStaticPrompt1>
    >?,
    PromptOptions<
      TName2,
      TStaticPrompt2,
      TResult & PromptResult<TName2, TStaticPrompt2>
    >?,
    PromptOptions<
      TName3,
      TStaticPrompt3,
      TResult & PromptResult<TName3, TStaticPrompt3>
    >?,
    PromptOptions<
      TName4,
      TStaticPrompt4,
      TResult & PromptResult<TName4, TStaticPrompt4>
    >?,
    PromptOptions<
      TName5,
      TStaticPrompt5,
      TResult & PromptResult<TName5, TStaticPrompt5>
    >?,
    PromptOptions<
      TName6,
      TStaticPrompt6,
      TResult & PromptResult<TName6, TStaticPrompt6>
    >?,
    PromptOptions<
      TName7,
      TStaticPrompt7,
      TResult & PromptResult<TName7, TStaticPrompt7>
    >?,
    PromptOptions<
      TName8,
      TStaticPrompt8,
      TResult & PromptResult<TName8, TStaticPrompt8>
    >?,
    PromptOptions<
      TName9,
      TStaticPrompt9,
      TResult & PromptResult<TName9, TStaticPrompt9>
    >?,
    PromptOptions<
      TName10,
      TStaticPrompt10,
      TResult & PromptResult<TName10, TStaticPrompt10>
    >?,
    PromptOptions<
      TName11,
      TStaticPrompt11,
      TResult & PromptResult<TName11, TStaticPrompt11>
    >?,
    PromptOptions<
      TName12,
      TStaticPrompt12,
      TResult & PromptResult<TName12, TStaticPrompt12>
    >?,
    PromptOptions<
      TName13,
      TStaticPrompt13,
      TResult & PromptResult<TName13, TStaticPrompt13>
    >?,
    PromptOptions<
      TName14,
      TStaticPrompt14,
      TResult & PromptResult<TName14, TStaticPrompt14>
    >?,
    PromptOptions<
      TName15,
      TStaticPrompt15,
      TResult & PromptResult<TName15, TStaticPrompt15>
    >?,
    PromptOptions<
      TName16,
      TStaticPrompt16,
      TResult & PromptResult<TName16, TStaticPrompt16>
    >?,
    PromptOptions<
      TName17,
      TStaticPrompt17,
      TResult & PromptResult<TName17, TStaticPrompt17>
    >?,
    PromptOptions<
      TName18,
      TStaticPrompt18,
      TResult & PromptResult<TName18, TStaticPrompt18>
    >?,
    PromptOptions<
      TName19,
      TStaticPrompt19,
      TResult & PromptResult<TName19, TStaticPrompt19>
    >?,
    PromptOptions<
      TName20,
      TStaticPrompt20,
      TResult & PromptResult<TName20, TStaticPrompt20>
    >?,
    PromptOptions<
      TName21,
      TStaticPrompt21,
      TResult & PromptResult<TName21, TStaticPrompt21>
    >?,
    PromptOptions<
      TName22,
      TStaticPrompt22,
      TResult & PromptResult<TName22, TStaticPrompt22>
    >?,
    PromptOptions<
      TName23,
      TStaticPrompt23,
      TResult & PromptResult<TName23, TStaticPrompt23>
    >?,
  ],
  options?: GlobalPromptOptions<TResult>,
): Promise<TResult> {
  return new PromptList(
    prompts as Array<
      PromptOptions<string, GenericPrompt<unknown, unknown>>
    >,
    options,
  ).run(options?.initial) as Promise<TResult>;
}

class PromptList {
  private result: Record<string, any> = {};
  private index = -1;
  private names: Array<string>;
  private isInBeforeHook = false;
  private tty: Tty;

  private get prompt(): PromptOptions<
    string,
    GenericPrompt<unknown, unknown>
  > {
    return this.prompts[this.index];
  }

  public constructor(
    private prompts: Array<
      PromptOptions<string, GenericPrompt<unknown, unknown>>
    >,
    private options?: GlobalPromptOptions<any>,
  ) {
    this.names = this.prompts.map((prompt) => prompt.name);
    this.tty = tty({
      writer: options?.writer ?? Deno.stdout,
    });
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
    const prompt: StaticGenericPrompt<unknown, unknown> = this.prompt.type;

    if (typeof injected[this.prompt.name] !== "undefined") {
      if (prompt.inject) {
        prompt.inject(injected[this.prompt.name]);
      } else {
        GenericPrompt.inject(injected[this.prompt.name]);
      }
    }

    try {
      this.result[this.prompt.name] = await prompt.prompt({
        reader: this.options?.reader,
        writer: this.options?.writer,
        cbreak: this.options?.cbreak,
        ...this.prompt,
      });
    } finally {
      this.tty.cursorShow();
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
