import type { ITypeHandler, ITypeInfo } from "../types.ts";
import { InvalidTypeError } from "../_errors.ts";

/** Boolean type handler. Excepts `true`, `false`, `1`, `0` */
export const boolean: ITypeHandler<boolean> = (
  type: ITypeInfo,
): boolean => {
  if (~["1", "true"].indexOf(type.value)) {
    return true;
  }

  if (~["0", "false"].indexOf(type.value)) {
    return false;
  }

  throw new InvalidTypeError(type);
};
