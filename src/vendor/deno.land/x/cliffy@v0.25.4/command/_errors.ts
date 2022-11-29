import { didYouMeanCommand } from "./_utils.ts";
import type { Command } from "./command.ts";
import { getFlag } from "../flags/_utils.ts";
import { EnvVar } from "./types.ts";

export class CommandError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, CommandError.prototype);
  }
}

export interface ValidationErrorOptions {
  exitCode?: number;
}

export class ValidationError extends CommandError {
  public readonly exitCode: number;

  constructor(message: string, { exitCode }: ValidationErrorOptions = {}) {
    super(message);
    Object.setPrototypeOf(this, ValidationError.prototype);
    this.exitCode = exitCode ?? 1;
  }
}

export class DuplicateOptionNameError extends CommandError {
  constructor(name: string) {
    super(`Option with name "${getFlag(name)}" already exists.`);
    Object.setPrototypeOf(this, DuplicateOptionNameError.prototype);
  }
}

export class MissingCommandNameError extends CommandError {
  constructor() {
    super("Missing command name.");
    Object.setPrototypeOf(this, MissingCommandNameError.prototype);
  }
}

export class DuplicateCommandNameError extends CommandError {
  constructor(name: string) {
    super(`Duplicate command name "${name}".`);
    Object.setPrototypeOf(this, DuplicateCommandNameError.prototype);
  }
}

export class DuplicateCommandAliasError extends CommandError {
  constructor(alias: string) {
    super(`Duplicate command alias "${alias}".`);
    Object.setPrototypeOf(this, DuplicateCommandAliasError.prototype);
  }
}

export class CommandNotFoundError extends CommandError {
  constructor(
    name: string,
    commands: Array<Command>,
    excluded?: Array<string>,
  ) {
    super(
      `Unknown command "${name}".${
        didYouMeanCommand(name, commands, excluded)
      }`,
    );
    Object.setPrototypeOf(this, CommandNotFoundError.prototype);
  }
}

export class DuplicateTypeError extends CommandError {
  constructor(name: string) {
    super(`Type with name "${name}" already exists.`);
    Object.setPrototypeOf(this, DuplicateTypeError.prototype);
  }
}

export class DuplicateCompletionError extends CommandError {
  constructor(name: string) {
    super(`Completion with name "${name}" already exists.`);
    Object.setPrototypeOf(this, DuplicateCompletionError.prototype);
  }
}

export class DuplicateExampleError extends CommandError {
  constructor(name: string) {
    super(`Example with name "${name}" already exists.`);
    Object.setPrototypeOf(this, DuplicateExampleError.prototype);
  }
}

export class DuplicateEnvVarError extends CommandError {
  constructor(name: string) {
    super(`Environment variable with name "${name}" already exists.`);
    Object.setPrototypeOf(this, DuplicateEnvVarError.prototype);
  }
}

export class MissingRequiredEnvVarError extends ValidationError {
  constructor(envVar: EnvVar) {
    super(`Missing required environment variable "${envVar.names[0]}".`);
    Object.setPrototypeOf(this, MissingRequiredEnvVarError.prototype);
  }
}

export class TooManyEnvVarValuesError extends CommandError {
  constructor(name: string) {
    super(
      `An environment variable can only have one value, but "${name}" has more than one.`,
    );
    Object.setPrototypeOf(this, TooManyEnvVarValuesError.prototype);
  }
}

export class UnexpectedOptionalEnvVarValueError extends CommandError {
  constructor(name: string) {
    super(
      `An environment variable cannot have an optional value, but "${name}" is defined as optional.`,
    );
    Object.setPrototypeOf(this, UnexpectedOptionalEnvVarValueError.prototype);
  }
}

export class UnexpectedVariadicEnvVarValueError extends CommandError {
  constructor(name: string) {
    super(
      `An environment variable cannot have an variadic value, but "${name}" is defined as variadic.`,
    );
    Object.setPrototypeOf(this, UnexpectedVariadicEnvVarValueError.prototype);
  }
}

export class DefaultCommandNotFoundError extends CommandError {
  constructor(name: string, commands: Array<Command>) {
    super(
      `Default command "${name}" not found.${
        didYouMeanCommand(name, commands)
      }`,
    );
    Object.setPrototypeOf(this, DefaultCommandNotFoundError.prototype);
  }
}

export class CommandExecutableNotFoundError extends CommandError {
  constructor(name: string) {
    super(
      `Command executable not found: ${name}`,
    );
    Object.setPrototypeOf(this, CommandExecutableNotFoundError.prototype);
  }
}

export class UnknownCompletionCommandError extends CommandError {
  constructor(name: string, commands: Array<Command>) {
    super(
      `Auto-completion failed. Unknown command "${name}".${
        didYouMeanCommand(name, commands)
      }`,
    );
    Object.setPrototypeOf(this, UnknownCompletionCommandError.prototype);
  }
}

/* Validation errors. */

export class UnknownCommandError extends ValidationError {
  constructor(
    name: string,
    commands: Array<Command>,
    excluded?: Array<string>,
  ) {
    super(
      `Unknown command "${name}".${
        didYouMeanCommand(name, commands, excluded)
      }`,
    );
    Object.setPrototypeOf(this, UnknownCommandError.prototype);
  }
}

export class NoArgumentsAllowedError extends ValidationError {
  constructor(name: string) {
    super(`No arguments allowed for command "${name}".`);
    Object.setPrototypeOf(this, NoArgumentsAllowedError.prototype);
  }
}

export class MissingArgumentsError extends ValidationError {
  constructor(names: Array<string>) {
    super(`Missing argument(s): ${names.join(", ")}`);
    Object.setPrototypeOf(this, MissingArgumentsError.prototype);
  }
}

export class MissingArgumentError extends ValidationError {
  constructor(name: string) {
    super(`Missing argument: ${name}`);
    Object.setPrototypeOf(this, MissingArgumentError.prototype);
  }
}

export class TooManyArgumentsError extends ValidationError {
  constructor(args: Array<string>) {
    super(`Too many arguments: ${args.join(" ")}`);
    Object.setPrototypeOf(this, TooManyArgumentsError.prototype);
  }
}
