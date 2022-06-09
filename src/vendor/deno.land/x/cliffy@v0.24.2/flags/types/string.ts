import type { ITypeHandler, ITypeInfo } from "../types.ts";

/** String type handler. Excepts any value. */
export const string: ITypeHandler<string> = ({ value }: ITypeInfo): string => {
  return value;
};
