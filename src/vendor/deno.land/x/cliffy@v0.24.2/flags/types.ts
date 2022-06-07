/** Parser options. */
export interface IParseOptions<T extends IFlagOptions = IFlagOptions> {
  flags?: Array<T>;
  parse?: ITypeHandler<unknown>;
  option?: (option: T, value?: unknown) => void;
  knownFlaks?: Record<string, unknown>;
  stopEarly?: boolean;
  allowEmpty?: boolean;
  ignoreDefaults?: Record<string, unknown>;
}

/** Flag options. */
export interface IFlagOptions extends IFlagArgument {
  name: string;
  args?: IFlagArgument[];
  aliases?: string[];
  standalone?: boolean;
  default?: IDefaultValue;
  required?: boolean;
  depends?: string[];
  conflicts?: string[];
  value?: IFlagValueHandler;
  collect?: boolean;
  equalsSign?: boolean;
}

/** Flag argument definition. */
export interface IFlagArgument {
  type?: OptionType | string;
  optionalValue?: boolean;
  requiredValue?: boolean;
  variadic?: boolean;
  list?: boolean;
  separator?: string;
}

/** Available build-in argument types. */
export enum OptionType {
  STRING = "string",
  NUMBER = "number",
  INTEGER = "integer",
  BOOLEAN = "boolean",
}

/** Default flag value */
export type IDefaultValue<T = unknown> = T | (() => T);

/** Value handler for custom value processing. */
// deno-lint-ignore no-explicit-any
export type IFlagValueHandler<T = any, U = T> = (val: T, previous?: U) => U;

/** Result of the parseFlags method. */
export interface IFlagsResult<
  // deno-lint-ignore no-explicit-any
  O extends Record<string, any> = Record<string, any>,
> {
  flags: O;
  unknown: string[];
  literal: string[];
}

/** Type details. */
export interface ITypeInfo {
  label: string;
  type: string;
  name: string;
  value: string;
}

/** Custom type handler/parser. */
export type ITypeHandler<T = unknown> = (type: ITypeInfo) => T;
