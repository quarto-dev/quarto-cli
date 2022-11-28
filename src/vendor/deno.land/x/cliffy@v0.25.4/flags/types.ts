/** Parser options. */
export interface ParseFlagsOptions<
  TFlagOptions extends FlagOptions = FlagOptions,
> {
  flags?: Array<TFlagOptions>;
  parse?: TypeHandler<unknown>;
  option?: (option: TFlagOptions, value?: unknown) => void;
  stopEarly?: boolean;
  stopOnUnknown?: boolean;
  allowEmpty?: boolean;
  ignoreDefaults?: Record<string, unknown>;
  dotted?: boolean;
}

/** Flag options. */
export interface FlagOptions extends ArgumentOptions {
  name: string;
  args?: ArgumentOptions[];
  aliases?: string[];
  standalone?: boolean;
  default?: DefaultValue;
  required?: boolean;
  depends?: string[];
  conflicts?: string[];
  value?: ValueHandler;
  collect?: boolean;
  equalsSign?: boolean;
}

/** Flag argument definition. */
export interface ArgumentOptions {
  type?: ArgumentType | string;
  optionalValue?: boolean;
  requiredValue?: boolean;
  variadic?: boolean;
  list?: boolean;
  separator?: string;
}

/** Available build-in argument types. */
export type ArgumentType = "string" | "boolean" | "number" | "integer";

/** Default flag value */
export type DefaultValue<TValue = unknown> =
  | TValue
  | DefaultValueHandler<TValue>;

export type DefaultValueHandler<TValue = unknown> = () => TValue;

/** Value handler for custom value processing. */
// deno-lint-ignore no-explicit-any
export type ValueHandler<TValue = any, TReturn = TValue> = (
  val: TValue,
  previous?: TReturn,
) => TReturn;

/** Result of the parseFlags method. */
export interface ParseFlagsContext<
  // deno-lint-ignore no-explicit-any
  TFlags extends Record<string, any> = Record<string, any>,
  TStandaloneOption extends FlagOptions = FlagOptions,
> {
  flags: TFlags;
  unknown: Array<string>;
  literal: Array<string>;
  standalone?: TStandaloneOption;
  stopEarly: boolean;
  stopOnUnknown: boolean;
}

/** Type details. */
export interface ArgumentValue {
  label: string;
  type: string;
  name: string;
  value: string;
}

/** Custom type handler/parser. */
export type TypeHandler<TReturn = unknown> = (arg: ArgumentValue) => TReturn;
