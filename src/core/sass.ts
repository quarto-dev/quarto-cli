/*
* sass.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export interface SassVariable {
  name: string;
  value: unknown;
}

export function sassVariable(
  name: string,
  value: unknown,
  formatter?: (val: unknown) => unknown,
) {
  return {
    name: name,
    value: formatter ? formatter(value) : value,
  };
}

// prints a Sass variable
export function print(variable: SassVariable, isDefault = true): string {
  return `$${variable.name}: ${variable.value}${isDefault ? " !default" : ""};`;
}
