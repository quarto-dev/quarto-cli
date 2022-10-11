// deno-lint-ignore-file no-explicit-any

import type {
  IDefaultValue,
  IFlagArgument,
  IFlagOptions,
  IFlagValueHandler,
  ITypeHandler,
  ITypeInfo,
} from "../flags/types.ts";
import type { Type } from "./type.ts";
import type { Command } from "./command.ts";
import type { HelpOptions } from "./help/_help_generator.ts";

export type { IDefaultValue, IFlagValueHandler, ITypeHandler, ITypeInfo };

type Merge<T, V> = T extends void ? V : V extends void ? T : T & V;

export type TypeOrTypeHandler<T> = Type<T> | ITypeHandler<T>;

export type TypeValue<T, U = T> = T extends TypeOrTypeHandler<infer V> ? V : U;

type Id<T> = T extends Record<string, unknown>
  ? T extends infer U ? { [K in keyof U]: Id<U[K]> } : never
  : T;

export type MapTypes<T> = T extends Record<string, unknown> | Array<unknown>
  ? { [K in keyof T]: MapTypes<T[K]> }
  : TypeValue<T>;

/* COMMAND TYPES */

/** Description handler. */
export type IDescription<
  O extends Record<string, any> | void = any,
  A extends Array<unknown> = O extends number ? any : [],
  G extends Record<string, any> | void = O extends number ? any : void,
  PG extends Record<string, any> | void = O extends number ? any : void,
  CT extends Record<string, any> | void = O extends number ? any : void,
  GT extends Record<string, any> | void = O extends number ? any : void,
  PT extends Record<string, any> | void = O extends number ? any : void,
  P extends Command<any> | undefined = O extends number ? any : undefined,
> = string | ((this: Command<PG, PT, O, A, G, CT, GT, P>) => string);

/** Action handler for commands and options. */
export type IAction<
  O extends Record<string, any> | void = any,
  A extends Array<unknown> = O extends number ? any : [],
  G extends Record<string, any> | void = O extends number ? any : void,
  PG extends Record<string, any> | void = O extends number ? any : void,
  CT extends Record<string, any> | void = O extends number ? any : void,
  GT extends Record<string, any> | void = O extends number ? any : void,
  PT extends Record<string, any> | void = O extends number ? any : void,
  P extends Command<any> | undefined = O extends number ? any : undefined,
> = (
  this: Command<PG, PT, O, A, G, CT, GT, P>,
  options: MapTypes<Merge<PG, Merge<G, O>>>,
  ...args: MapTypes<A>
) => unknown | Promise<unknown>;

/** Argument details. */
export interface IArgument extends IFlagArgument {
  /** Argument name. */
  name: string;
  /** Shell completion action. */
  action: string;
  /** Arguments type. */
  type: string;
}

/** Result of `cmd.parse()` method. */
export interface IParseResult<
  O extends Record<string, any> | void = any,
  A extends Array<unknown> = O extends number ? any : [],
  G extends Record<string, any> | void = O extends number ? any : void,
  PG extends Record<string, any> | void = O extends number ? any : void,
  CT extends Record<string, any> | void = O extends number ? any : void,
  GT extends Record<string, any> | void = O extends number ? any : void,
  PT extends Record<string, any> | void = O extends number ? any : void,
  P extends Command<any> | undefined = O extends number ? any : undefined,
> {
  options: Id<Merge<Merge<PG, G>, O>>;
  args: A;
  literal: string[];
  cmd: Command<PG, PT, O, A, G, CT, GT, P>;
}

/* OPTION TYPES */

type ExcludedCommandOptions =
  | "name"
  | "args"
  | "type"
  | "optionalValue"
  | "requiredValue"
  | "aliases"
  | "variadic"
  | "list";

/** Command option options. */
export interface ICommandGlobalOption<
  O extends Record<string, any> | void = any,
  A extends Array<unknown> = O extends number ? any : [],
  G extends Record<string, any> | void = O extends number ? any : void,
  PG extends Record<string, any> | void = O extends number ? any : void,
  CT extends Record<string, any> | void = O extends number ? any : void,
  GT extends Record<string, any> | void = O extends number ? any : void,
  PT extends Record<string, any> | void = O extends number ? any : void,
  P extends Command<any> | undefined = O extends number ? any : undefined,
> extends Omit<IFlagOptions, ExcludedCommandOptions> {
  override?: boolean;
  hidden?: boolean;
  action?: IAction<O, A, G, PG, CT, GT, PT, P>;
  prepend?: boolean;
}

export interface ICommandOption<
  O extends Record<string, any> | void = any,
  A extends Array<unknown> = O extends number ? any : [],
  G extends Record<string, any> | void = O extends number ? any : void,
  PG extends Record<string, any> | void = O extends number ? any : void,
  CT extends Record<string, any> | void = O extends number ? any : void,
  GT extends Record<string, any> | void = O extends number ? any : void,
  PT extends Record<string, any> | void = O extends number ? any : void,
  P extends Command<any> | undefined = O extends number ? any : undefined,
> extends ICommandGlobalOption<O, A, G, PG, CT, GT, PT, P> {
  global?: boolean;
}

/** Command option settings. */
export interface IOption<
  O extends Record<string, any> | void = any,
  A extends Array<unknown> = O extends number ? any : [],
  G extends Record<string, any> | void = O extends number ? any : void,
  PG extends Record<string, any> | void = O extends number ? any : void,
  CT extends Record<string, any> | void = O extends number ? any : void,
  GT extends Record<string, any> | void = O extends number ? any : void,
  PT extends Record<string, any> | void = O extends number ? any : void,
  P extends Command<any> | undefined = O extends number ? any : undefined,
> extends ICommandOption<O, A, G, PG, CT, GT, PT, P>, IFlagOptions {
  description: string;
  flags: Array<string>;
  typeDefinition?: string;
  args: IArgument[];
  groupName?: string;
}

/* ENV VARS TYPES */

export type IEnvVarValueHandler<T = any, V = unknown> = (val: T) => V;

/** Environment variable options */
export interface IGlobalEnvVarOptions {
  hidden?: boolean;
  required?: boolean;
  prefix?: string | undefined;
  value?: IEnvVarValueHandler;
}

/** Environment variable options */
export interface IEnvVarOptions extends IGlobalEnvVarOptions {
  global?: boolean;
}

/** Environment variable settings. */
export interface IEnvVar extends IEnvVarOptions {
  name: string;
  names: string[];
  description: string;
  type: string;
  details: IArgument;
}

/* TYPE TYPES */

/** Type options. */
export interface ITypeOptions {
  override?: boolean;
  global?: boolean;
}

/** Type settings. */
export interface IType extends ITypeOptions {
  name: string;
  handler: Type<unknown> | ITypeHandler<unknown>;
}

/* EXAMPLE TYPES */

/** Example settings. */
export interface IExample {
  name: string;
  description: string;
}

/* COMPLETION TYPES */

/** Completion options. */
export interface ICompleteOptions {
  override?: boolean;
  global?: boolean;
}

/** Completion settings. */
export interface ICompletion<
  O extends Record<string, any> | void = any,
  A extends Array<unknown> = O extends number ? any : [],
  G extends Record<string, any> | void = O extends number ? any : void,
  PG extends Record<string, any> | void = O extends number ? any : void,
  CT extends Record<string, any> | void = O extends number ? any : void,
  GT extends Record<string, any> | void = O extends number ? any : void,
  PT extends Record<string, any> | void = O extends number ? any : void,
  P extends Command<any> | undefined = O extends number ? any : undefined,
> extends ICompleteOptions {
  name: string;
  complete: ICompleteHandler<O, A, G, PG, CT, GT, PT, P>;
}

export type CompleteHandlerResult =
  | Array<string | number | boolean>
  | Promise<Array<string | number | boolean>>;

export type ValuesHandlerResult = Array<string | number | boolean>;

/** Type parser method. */
export type ICompleteHandler<
  O extends Record<string, any> | void = any,
  A extends Array<unknown> = O extends number ? any : [],
  G extends Record<string, any> | void = O extends number ? any : void,
  PG extends Record<string, any> | void = O extends number ? any : void,
  CT extends Record<string, any> | void = O extends number ? any : void,
  GT extends Record<string, any> | void = O extends number ? any : void,
  PT extends Record<string, any> | void = O extends number ? any : void,
  P extends Command<any> | undefined = O extends number ? any : undefined,
> = (
  cmd: Command<PG, PT, O, A, G, CT, GT, P>,
  parent?: Command<any>,
) => CompleteHandlerResult;

/**
 * Help callback method to print the help.
 * Invoked by the `--help` option and `help` command and the `.getHelp()` and `.showHelp()` methods.
 */
export type IHelpHandler<
  O extends Record<string, any> | void = any,
  A extends Array<unknown> = O extends number ? any : [],
  G extends Record<string, any> | void = O extends number ? any : void,
  PG extends Record<string, any> | void = O extends number ? any : void,
  CT extends Record<string, any> | void = O extends number ? any : void,
  GT extends Record<string, any> | void = O extends number ? any : void,
  PT extends Record<string, any> | void = O extends number ? any : void,
  P extends Command<any> | undefined = O extends number ? any : undefined,
  C extends Command<PG, PT, O, A, G, CT, GT, P> = Command<
    PG,
    PT,
    O,
    A,
    G,
    CT,
    GT,
    P
  >,
> = (this: C, cmd: C, options: HelpOptions) => string;

/**
 * Version callback method to print the version.
 * Invoked by the `--help` option command and the `.getVersion()` and `.showHelp()` methods.
 */
export type IVersionHandler<
  O extends Record<string, any> | void = any,
  A extends Array<unknown> = O extends number ? any : [],
  G extends Record<string, any> | void = O extends number ? any : void,
  PG extends Record<string, any> | void = O extends number ? any : void,
  CT extends Record<string, any> | void = O extends number ? any : void,
  GT extends Record<string, any> | void = O extends number ? any : void,
  PT extends Record<string, any> | void = O extends number ? any : void,
  P extends Command<any> | undefined = O extends number ? any : undefined,
  C extends Command<PG, PT, O, A, G, CT, GT, P> = Command<
    PG,
    PT,
    O,
    A,
    G,
    CT,
    GT,
    P
  >,
> = (this: C, cmd: C) => string;
