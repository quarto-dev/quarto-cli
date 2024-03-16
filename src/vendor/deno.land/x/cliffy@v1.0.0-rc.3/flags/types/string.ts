import type { ArgumentValue, TypeHandler } from "../types.ts";

/** String type handler. Excepts any value. */
export const string: TypeHandler<string> = (
  { value }: ArgumentValue,
): string => {
  return value;
};
