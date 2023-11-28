/*
 * located-error.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { mappedIndexToLineCol, MappedString } from "./mapped-text.ts";

// TODO this is LocatedError, not LocalizedError
export class LocalizedError extends Error {
  constructor(
    name: string,
    message: string,
    source: MappedString,
    position = 0,
    printName = true,
    printStack = true,
  ) {
    const fileName = source.map(position)?.originalString?.fileName;
    if (fileName) {
      const { line, column } = mappedIndexToLineCol(source)(position);
      message = `In file ${fileName} (${line + 1}:${column + 1}):
${message}`;
    }

    super(message);
    this.name = name;
    this.printName = printName;
    this.printStack = printStack;
  }

  public readonly printName: boolean;
  public readonly printStack: boolean;
}
