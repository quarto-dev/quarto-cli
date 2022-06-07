import { getDefaultValue, getOption, paramCaseToCamelCase } from "./_utils.ts";
import {
  ConflictingOption,
  DependingOption,
  MissingOptionValue,
  MissingRequiredOption,
  OptionNotCombinable,
  UnknownOption,
} from "./_errors.ts";
import { IParseOptions } from "./types.ts";
import type { IFlagArgument, IFlagOptions } from "./types.ts";

/** Flag option map. */
interface IFlagOptionsMap {
  name: string;
  option?: IFlagOptions;
}

/**
 * Flags post validation. Validations that are not already done by the parser.
 *
 * @param opts            Parse options.
 * @param values          Flag values.
 * @param optionNameMap   Option name mappings: propertyName -> option.name
 */
export function validateFlags<T extends IFlagOptions = IFlagOptions>(
  opts: IParseOptions<T>,
  values: Record<string, unknown>,
  optionNameMap: Record<string, string> = {},
): void {
  if (!opts.flags?.length) {
    return;
  }
  const defaultValues = setDefaultValues(opts, values, optionNameMap);

  const optionNames = Object.keys(values);
  if (!optionNames.length && opts.allowEmpty) {
    return;
  }

  const options: Array<IFlagOptionsMap> = optionNames.map((name) => ({
    name,
    option: getOption(opts.flags!, optionNameMap[name]),
  }));

  for (const { name, option } of options) {
    if (!option) {
      throw new UnknownOption(name, opts.flags);
    }
    if (validateStandaloneOption(option, options, optionNames, defaultValues)) {
      return;
    }
    validateConflictingOptions(option, values);
    validateDependingOptions(option, values, defaultValues);
    validateRequiredValues(option, values, name);
  }
  validateRequiredOptions(options, values, opts);
}

/**
 * Adds all default values on the values object and returns a new object with
 * only the default values.
 *
 * @param opts
 * @param values
 * @param optionNameMap
 */
function setDefaultValues<T extends IFlagOptions = IFlagOptions>(
  opts: IParseOptions<T>,
  values: Record<string, unknown>,
  optionNameMap: Record<string, string> = {},
) {
  const defaultValues: Record<string, boolean> = {};
  if (!opts.flags?.length) {
    return defaultValues;
  }

  // Set default values
  for (const option of opts.flags) {
    let name: string | undefined;
    let defaultValue: unknown = undefined;

    // if --no-[flag] is present set --[flag] default value to true
    if (option.name.startsWith("no-")) {
      const propName = option.name.replace(/^no-/, "");
      if (propName in values) {
        continue;
      }
      const positiveOption = getOption(opts.flags, propName);
      if (positiveOption) {
        continue;
      }
      name = paramCaseToCamelCase(propName);
      defaultValue = true;
    }

    if (!name) {
      name = paramCaseToCamelCase(option.name);
    }

    if (!(name in optionNameMap)) {
      optionNameMap[name] = option.name;
    }

    const hasDefaultValue: boolean = (!opts.ignoreDefaults ||
      typeof opts.ignoreDefaults[name] === "undefined") &&
      typeof values[name] === "undefined" && (
        typeof option.default !== "undefined" ||
        typeof defaultValue !== "undefined"
      );

    if (hasDefaultValue) {
      values[name] = getDefaultValue(option) ?? defaultValue;
      defaultValues[option.name] = true;
      if (typeof option.value === "function") {
        values[name] = option.value(values[name]);
      }
    }
  }

  return defaultValues;
}

function validateStandaloneOption(
  option: IFlagOptions,
  options: Array<IFlagOptionsMap>,
  optionNames: Array<string>,
  defaultValues: Record<string, boolean>,
): boolean {
  if (!option.standalone) {
    return false;
  }
  if (optionNames.length === 1) {
    return true;
  }

  // don't throw an error if all values are coming from the default option.
  if (
    options.every((opt) =>
      opt.option &&
      (option === opt.option || defaultValues[opt.option.name])
    )
  ) {
    return true;
  }

  throw new OptionNotCombinable(option.name);
}

function validateConflictingOptions(
  option: IFlagOptions,
  values: Record<string, unknown>,
): void {
  option.conflicts?.forEach((flag: string) => {
    if (isset(flag, values)) {
      throw new ConflictingOption(option.name, flag);
    }
  });
}

function validateDependingOptions(
  option: IFlagOptions,
  values: Record<string, unknown>,
  defaultValues: Record<string, boolean>,
): void {
  option.depends?.forEach((flag: string) => {
    // don't throw an error if the value is coming from the default option.
    if (!isset(flag, values) && !defaultValues[option.name]) {
      throw new DependingOption(option.name, flag);
    }
  });
}

function validateRequiredValues(
  option: IFlagOptions,
  values: Record<string, unknown>,
  name: string,
): void {
  const isArray = (option.args?.length || 0) > 1;
  option.args?.forEach((arg: IFlagArgument, i: number) => {
    if (
      arg.requiredValue &&
      (
        typeof values[name] === "undefined" ||
        (isArray &&
          typeof (values[name] as Array<unknown>)[i] === "undefined")
      )
    ) {
      throw new MissingOptionValue(option.name);
    }
  });
}

function validateRequiredOptions<T extends IFlagOptions = IFlagOptions>(
  options: Array<IFlagOptionsMap>,
  values: Record<string, unknown>,
  opts: IParseOptions<T>,
): void {
  if (!opts.flags?.length) {
    return;
  }
  for (const option of opts.flags) {
    if (option.required && !(paramCaseToCamelCase(option.name) in values)) {
      if (
        (
          !option.conflicts ||
          !option.conflicts.find((flag: string) => !!values[flag])
        ) &&
        !options.find((opt) =>
          opt.option?.conflicts?.find((flag: string) => flag === option.name)
        )
      ) {
        throw new MissingRequiredOption(option.name);
      }
    }
  }
}

/**
 * Check if value exists for flag.
 * @param flag    Flag name.
 * @param values  Parsed values.
 */
function isset(flag: string, values: Record<string, unknown>): boolean {
  const name = paramCaseToCamelCase(flag);
  // return typeof values[ name ] !== 'undefined' && values[ name ] !== false;
  return typeof values[name] !== "undefined";
}
