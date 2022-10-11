import { Type } from "../type.ts";
import type { ITypeInfo } from "../types.ts";
import { integer } from "../../flags/types/integer.ts";

/** Integer type. */
export class IntegerType extends Type<number> {
  /** Parse integer type. */
  public parse(type: ITypeInfo): number {
    return integer(type);
  }
}
