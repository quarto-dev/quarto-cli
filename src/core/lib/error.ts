// deno-lint-ignore-file no-explicit-any
/*
 * error.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

export class InternalError extends Error {
  constructor(
    message: string,
    printName = true,
    printStack = true,
  ) {
    super(message);
    this.name = "Internal Error";
    this.printName = printName;
    this.printStack = printStack;
  }

  public readonly printName: boolean;
  public readonly printStack: boolean;
}

export class UnreachableError extends InternalError {
  constructor() {
    super("Unreachable code was reached.", true, true);
  }
}

export class ErrorEx extends Error {
  constructor(
    name: string,
    message: string,
    printName = true,
    printStack = true,
  ) {
    super(message);
    this.name = name;
    this.printName = printName;
    this.printStack = printStack;
  }

  public readonly printName: boolean;
  public readonly printStack: boolean;
}

export function asErrorEx(e: unknown) {
  if (e instanceof ErrorEx) {
    return e;
  } else if (e instanceof Error) {
    // ammend this error rather than creating a new ErrorEx
    // so that the stack trace survives

    (e as any).printName = e.name !== "Error";
    (e as any).printStack = !!e.message;
    return e as ErrorEx;
  } else {
    return new ErrorEx("Error", String(e), false, true);
  }
}
