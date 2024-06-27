import { boolean } from "../../flags/types/boolean.ts";
import type { ArgumentValue } from "../types.ts";
import { Type } from "../type.ts";

/** Boolean type with auto completion. Allows `true`, `false`, `0` and `1`. */
export class BooleanType extends Type<boolean> {
  /** Parse boolean type. */
  public parse(type: ArgumentValue): boolean {
    return boolean(type);
  }

  /** Complete boolean type. */
  public complete(): string[] {
    return ["true", "false"];
  }
}
