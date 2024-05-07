import { number } from "../../flags/types/number.ts";
import { Type } from "../type.ts";
import type { ArgumentValue } from "../types.ts";

/** Number type. */
export class NumberType extends Type<number> {
  /** Parse number type. */
  public parse(type: ArgumentValue): number {
    return number(type);
  }
}
