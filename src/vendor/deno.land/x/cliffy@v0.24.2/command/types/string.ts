import { string } from "../../flags/types/string.ts";
import { Type } from "../type.ts";
import type { ITypeInfo } from "../types.ts";

/** String type. Allows any value. */
export class StringType extends Type<string> {
  /** Complete string type. */
  public parse(type: ITypeInfo): string {
    return string(type);
  }
}
