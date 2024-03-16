import type { ArgumentValue, TypeHandler } from "../types.ts";
import { InvalidTypeError } from "../_errors.ts";

/** Boolean type handler. Excepts `true`, `false`, `1`, `0` */
export const boolean: TypeHandler<boolean> = (
  type: ArgumentValue,
): boolean => {
  if (~["1", "true"].indexOf(type.value)) {
    return true;
  }

  if (~["0", "false"].indexOf(type.value)) {
    return false;
  }

  throw new InvalidTypeError(type, ["true", "false", "1", "0"]);
};
