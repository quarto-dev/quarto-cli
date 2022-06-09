import type { ITypeHandler, ITypeInfo } from "../types.ts";
import { InvalidTypeError } from "../_errors.ts";

/** Number type handler. Excepts any numeric value. */
export const number: ITypeHandler<number> = (type: ITypeInfo): number => {
  const value = Number(type.value);
  if (Number.isFinite(value)) {
    return value;
  }

  throw new InvalidTypeError(type);
};
