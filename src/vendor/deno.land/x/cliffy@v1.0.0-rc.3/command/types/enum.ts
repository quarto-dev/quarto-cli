import { Type } from "../type.ts";
import type { ArgumentValue } from "../types.ts";
import { InvalidTypeError } from "../../flags/_errors.ts";

/** Enum type. Allows only provided values. */
export class EnumType<const TValue extends string | number | boolean>
  extends Type<TValue> {
  private readonly allowedValues: ReadonlyArray<TValue>;

  constructor(values: ReadonlyArray<TValue> | Record<string, TValue>) {
    super();
    this.allowedValues = Array.isArray(values) ? values : Object.values(values);
  }

  public parse(type: ArgumentValue): TValue {
    for (const value of this.allowedValues) {
      if (value.toString() === type.value) {
        return value;
      }
    }

    throw new InvalidTypeError(type, this.allowedValues.slice());
  }

  public override values(): Array<TValue> {
    return this.allowedValues.slice();
  }

  public override complete(): Array<TValue> {
    return this.values();
  }
}
