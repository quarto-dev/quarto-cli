import { Type } from "../type.ts";
import type { ITypeInfo } from "../types.ts";
import { InvalidTypeError } from "../../flags/_errors.ts";

/** Enum type. Allows only provided values. */
export class EnumType<T extends string | number | boolean> extends Type<T> {
  private readonly allowedValues: ReadonlyArray<T>;

  constructor(values: ReadonlyArray<T> | Record<string, T>) {
    super();
    this.allowedValues = Array.isArray(values) ? values : Object.values(values);
  }

  public parse(type: ITypeInfo): T {
    for (const value of this.allowedValues) {
      if (value.toString() === type.value) {
        return value;
      }
    }

    throw new InvalidTypeError(type, this.allowedValues.slice());
  }

  public override values(): Array<T> {
    return this.allowedValues.slice();
  }

  public override complete(): Array<T> {
    return this.values();
  }
}
