import { Type } from "../type.ts";
import type { ArgumentValue } from "../types.ts";
import { integer } from "../../flags/types/integer.ts";

/** Integer type. */
export class IntegerType extends Type<number> {
  /** Parse integer type. */
  public parse(type: ArgumentValue): number {
    return integer(type);
  }
}
