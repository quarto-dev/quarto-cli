// deno-lint-ignore-file no-explicit-any
import {
  UnknownTypeError,
  ValidationError as FlagsValidationError,
} from "../flags/_errors.ts";
import { MissingRequiredEnvVarError } from "./_errors.ts";
import { parseFlags } from "../flags/flags.ts";
import type { ParseFlagsContext } from "../flags/types.ts";
import {
  getDescription,
  parseArgumentsDefinition,
  splitArguments,
} from "./_utils.ts";
import { blue, bold, red, yellow } from "./deps.ts";
import {
  CommandExecutableNotFoundError,
  CommandNotFoundError,
  DefaultCommandNotFoundError,
  DuplicateCommandAliasError,
  DuplicateCommandNameError,
  DuplicateCompletionError,
  DuplicateEnvVarError,
  DuplicateExampleError,
  DuplicateOptionNameError,
  DuplicateTypeError,
  MissingArgumentError,
  MissingArgumentsError,
  MissingCommandNameError,
  NoArgumentsAllowedError,
  TooManyArgumentsError,
  TooManyEnvVarValuesError,
  UnexpectedOptionalEnvVarValueError,
  UnexpectedVariadicEnvVarValueError,
  UnknownCommandError,
  ValidationError,
} from "./_errors.ts";
import { DefaultValue, OptionValueHandler } from "./types.ts";
import { BooleanType } from "./types/boolean.ts";
import { FileType } from "./types/file.ts";
import { NumberType } from "./types/number.ts";
import { StringType } from "./types/string.ts";
import { Type } from "./type.ts";
import { HelpGenerator } from "./help/_help_generator.ts";
import type { HelpOptions } from "./help/_help_generator.ts";
import type {
  ActionHandler,
  Argument,
  ArgumentValue,
  CommandResult,
  CompleteHandler,
  CompleteOptions,
  Completion,
  Description,
  EnvVar,
  EnvVarOptions,
  EnvVarValueHandler,
  Example,
  GlobalEnvVarOptions,
  GlobalOptionOptions,
  HelpHandler,
  MapTypes,
  Option,
  OptionOptions,
  TypeDef,
  TypeOptions,
  TypeOrTypeHandler,
  VersionHandler,
} from "./types.ts";
import { IntegerType } from "./types/integer.ts";
import { underscoreToCamelCase } from "../flags/_utils.ts";

export class Command<
  TParentCommandGlobals extends Record<string, unknown> | void = void,
  TParentCommandTypes extends Record<string, unknown> | void =
    TParentCommandGlobals extends number ? any : void,
  TCommandOptions extends Record<string, unknown> | void =
    TParentCommandGlobals extends number ? any : void,
  TCommandArguments extends Array<unknown> = TParentCommandGlobals extends
    number ? any : [],
  TCommandGlobals extends Record<string, unknown> | void =
    TParentCommandGlobals extends number ? any : void,
  TCommandTypes extends Record<string, unknown> | void =
    TParentCommandGlobals extends number ? any : {
      number: number;
      integer: number;
      string: string;
      boolean: boolean;
      file: string;
    },
  TCommandGlobalTypes extends Record<string, unknown> | void =
    TParentCommandGlobals extends number ? any : void,
  TParentCommand extends Command<any> | undefined =
    TParentCommandGlobals extends number ? any : undefined,
> {
  private types: Map<string, TypeDef> = new Map();
  private rawArgs: Array<string> = [];
  private literalArgs: Array<string> = [];
  // @TODO: get script name: https://github.com/denoland/deno/pull/5034
  // private name: string = location.pathname.split( '/' ).pop() as string;
  private _name = "COMMAND";
  private _parent?: TParentCommand;
  private _globalParent?: Command<any>;
  private ver?: VersionHandler;
  private desc: Description = "";
  private _usage?: string;
  private fn?: ActionHandler;
  private options: Array<Option> = [];
  private commands: Map<string, Command<any>> = new Map();
  private examples: Array<Example> = [];
  private envVars: Array<EnvVar> = [];
  private aliases: Array<string> = [];
  private completions: Map<string, Completion> = new Map();
  private cmd: Command<any> = this;
  private argsDefinition?: string;
  private isExecutable = false;
  private throwOnError = false;
  private _allowEmpty = false;
  private _stopEarly = false;
  private defaultCommand?: string;
  private _useRawArgs = false;
  private args: Array<Argument> = [];
  private isHidden = false;
  private isGlobal = false;
  private hasDefaults = false;
  private _versionOptions?: DefaultOption | false;
  private _helpOptions?: DefaultOption | false;
  private _versionOption?: Option;
  private _helpOption?: Option;
  private _help?: HelpHandler;
  private _shouldExit?: boolean;
  private _meta: Record<string, string> = {};
  private _groupName?: string;
  private _noGlobals = false;

  /** Disable version option. */
  public versionOption(enable: false): this;

  /**
   * Set global version option.
   * @param flags The flags of the version option.
   * @param desc  The description of the version option.
   * @param opts  Version option options.
   */
  public versionOption(
    flags: string,
    desc?: string,
    opts?:
      & OptionOptions<
        Partial<TCommandOptions>,
        TCommandArguments,
        TCommandGlobals,
        TParentCommandGlobals,
        TCommandTypes,
        TCommandGlobalTypes,
        TParentCommandTypes,
        TParentCommand
      >
      & {
        global: true;
      },
  ): this;

  /**
   * Set version option.
   * @param flags The flags of the version option.
   * @param desc  The description of the version option.
   * @param opts  Version option options.
   */
  public versionOption(
    flags: string,
    desc?: string,
    opts?: OptionOptions<
      TCommandOptions,
      TCommandArguments,
      TCommandGlobals,
      TParentCommandGlobals,
      TCommandTypes,
      TCommandGlobalTypes,
      TParentCommandTypes,
      TParentCommand
    >,
  ): this;

  /**
   * Set version option.
   * @param flags The flags of the version option.
   * @param desc  The description of the version option.
   * @param opts  The action of the version option.
   */
  public versionOption(
    flags: string,
    desc?: string,
    opts?: ActionHandler<
      TCommandOptions,
      TCommandArguments,
      TCommandGlobals,
      TParentCommandGlobals,
      TCommandTypes,
      TCommandGlobalTypes,
      TParentCommandTypes,
      TParentCommand
    >,
  ): this;

  public versionOption(
    flags: string | false,
    desc?: string,
    opts?:
      | ActionHandler<
        TCommandOptions,
        TCommandArguments,
        TCommandGlobals,
        TParentCommandGlobals,
        TCommandTypes,
        TCommandGlobalTypes,
        TParentCommandTypes,
        TParentCommand
      >
      | OptionOptions<
        TCommandOptions,
        TCommandArguments,
        TCommandGlobals,
        TParentCommandGlobals,
        TCommandTypes,
        TCommandGlobalTypes,
        TParentCommandTypes,
        TParentCommand
      >
      | OptionOptions<
        Partial<TCommandOptions>,
        TCommandArguments,
        TCommandGlobals,
        TParentCommandGlobals,
        TCommandTypes,
        TCommandGlobalTypes,
        TParentCommandTypes,
        TParentCommand
      >
        & {
          global: true;
        },
  ): this {
    this._versionOptions = flags === false ? flags : {
      flags,
      desc,
      opts: typeof opts === "function" ? { action: opts } : opts,
    };
    return this;
  }

  /** Disable help option. */
  public helpOption(enable: false): this;

  /**
   * Set global help option.
   * @param flags The flags of the help option.
   * @param desc  The description of the help option.
   * @param opts  Help option options.
   */
  public helpOption(
    flags: string,
    desc?: string,
    opts?:
      & OptionOptions<
        Partial<TCommandOptions>,
        TCommandArguments,
        TCommandGlobals,
        TParentCommandGlobals,
        TCommandTypes,
        TCommandGlobalTypes,
        TParentCommandTypes,
        TParentCommand
      >
      & {
        global: true;
      },
  ): this;

  /**
   * Set help option.
   * @param flags The flags of the help option.
   * @param desc  The description of the help option.
   * @param opts  Help option options.
   */
  public helpOption(
    flags: string,
    desc?: string,
    opts?: OptionOptions<
      TCommandOptions,
      TCommandArguments,
      TCommandGlobals,
      TParentCommandGlobals,
      TCommandTypes,
      TCommandGlobalTypes,
      TParentCommandTypes,
      TParentCommand
    >,
  ): this;

  /**
   * Set help option.
   * @param flags The flags of the help option.
   * @param desc  The description of the help option.
   * @param opts  The action of the help option.
   */
  public helpOption(
    flags: string,
    desc?: string,
    opts?: ActionHandler<
      TCommandOptions,
      TCommandArguments,
      TCommandGlobals,
      TParentCommandGlobals,
      TCommandTypes,
      TCommandGlobalTypes,
      TParentCommandTypes,
      TParentCommand
    >,
  ): this;

  public helpOption(
    flags: string | false,
    desc?: string,
    opts?:
      | ActionHandler<
        TCommandOptions,
        TCommandArguments,
        TCommandGlobals,
        TParentCommandGlobals,
        TCommandTypes,
        TCommandGlobalTypes,
        TParentCommandTypes,
        TParentCommand
      >
      | OptionOptions<
        TCommandOptions,
        TCommandArguments,
        TCommandGlobals,
        TParentCommandGlobals,
        TCommandTypes,
        TCommandGlobalTypes,
        TParentCommandTypes,
        TParentCommand
      >
      | OptionOptions<
        Partial<TCommandOptions>,
        TCommandArguments,
        TCommandGlobals,
        TParentCommandGlobals,
        TCommandTypes,
        TCommandGlobalTypes,
        TParentCommandTypes,
        TParentCommand
      >
        & {
          global: true;
        },
  ): this {
    this._helpOptions = flags === false ? flags : {
      flags,
      desc,
      opts: typeof opts === "function" ? { action: opts } : opts,
    };
    return this;
  }

  /**
   * Add new sub-command.
   * @param name      Command definition. E.g: `my-command <input-file:string> <output-file:string>`
   * @param cmd       The new child command to register.
   * @param override  Override existing child command.
   */
  public command<
    TCommand extends Command<
      (TGlobalOptions & Record<string, unknown>) | void | undefined,
      TGlobalTypes | void | undefined,
      Record<string, unknown> | void,
      Array<unknown>,
      Record<string, unknown> | void,
      Record<string, unknown> | void,
      Record<string, unknown> | void,
      Command<
        TGlobalOptions | void | undefined,
        TGlobalTypes | void | undefined,
        Record<string, unknown> | void,
        Array<unknown>,
        Record<string, unknown> | void,
        Record<string, unknown> | void,
        Record<string, unknown> | void,
        undefined
      >
    >,
    TGlobalOptions
      extends (TParentCommand extends Command<any> ? TParentCommandGlobals
        : Merge<TParentCommandGlobals, TCommandGlobals>),
    TGlobalTypes
      extends (TParentCommand extends Command<any> ? TParentCommandTypes
        : Merge<TParentCommandTypes, TCommandTypes>),
  >(
    name: string,
    cmd: TCommand,
    override?: boolean,
  ): ReturnType<TCommand["reset"]> extends Command<
    Record<string, unknown> | void,
    Record<string, unknown> | void,
    infer Options,
    infer Arguments,
    infer GlobalOptions,
    infer Types,
    infer GlobalTypes,
    undefined
  > ? Command<
      TGlobalOptions,
      TGlobalTypes,
      Options,
      Arguments,
      GlobalOptions,
      Types,
      GlobalTypes,
      OneOf<TParentCommand, this>
    >
    : never;

  /**
   * Add new sub-command.
   * @param name      Command definition. E.g: `my-command <input-file:string> <output-file:string>`
   * @param cmd       The new child command to register.
   * @param override  Override existing child command.
   */
  public command<
    TCommand extends Command<
      TGlobalOptions | void | undefined,
      TGlobalTypes | void | undefined,
      Record<string, unknown> | void,
      Array<unknown>,
      Record<string, unknown> | void,
      Record<string, unknown> | void,
      Record<string, unknown> | void,
      OneOf<TParentCommand, this> | undefined
    >,
    TGlobalOptions
      extends (TParentCommand extends Command<any> ? TParentCommandGlobals
        : Merge<TParentCommandGlobals, TCommandGlobals>),
    TGlobalTypes
      extends (TParentCommand extends Command<any> ? TParentCommandTypes
        : Merge<TParentCommandTypes, TCommandTypes>),
  >(
    name: string,
    cmd: TCommand,
    override?: boolean,
  ): TCommand extends Command<
    Record<string, unknown> | void,
    Record<string, unknown> | void,
    infer Options,
    infer Arguments,
    infer GlobalOptions,
    infer Types,
    infer GlobalTypes,
    OneOf<TParentCommand, this> | undefined
  > ? Command<
      TGlobalOptions,
      TGlobalTypes,
      Options,
      Arguments,
      GlobalOptions,
      Types,
      GlobalTypes,
      OneOf<TParentCommand, this>
    >
    : never;

  /**
   * Add new sub-command.
   * @param nameAndArguments  Command definition. E.g: `my-command <input-file:string> <output-file:string>`
   * @param desc              The description of the new child command.
   * @param override          Override existing child command.
   */
  public command<
    TNameAndArguments extends string,
    TArguments extends TypedCommandArguments<
      TNameAndArguments,
      TParentCommand extends Command<any> ? TParentCommandTypes
        : Merge<TParentCommandTypes, TCommandGlobalTypes>
    >,
  >(
    nameAndArguments: TNameAndArguments,
    desc?: string,
    override?: boolean,
  ): TParentCommandGlobals extends number ? Command<any> : Command<
    TParentCommand extends Command<any> ? TParentCommandGlobals
      : Merge<TParentCommandGlobals, TCommandGlobals>,
    TParentCommand extends Command<any> ? TParentCommandTypes
      : Merge<TParentCommandTypes, TCommandGlobalTypes>,
    void,
    TArguments,
    void,
    void,
    void,
    OneOf<TParentCommand, this>
  >;

  /**
   * Add new sub-command.
   * @param nameAndArguments  Command definition. E.g: `my-command <input-file:string> <output-file:string>`
   * @param cmdOrDescription  The description of the new child command.
   * @param override          Override existing child command.
   */
  command(
    nameAndArguments: string,
    cmdOrDescription?: Command<any> | string,
    override?: boolean,
  ): Command<any> {
    this.reset();

    const result = splitArguments(nameAndArguments);

    const name: string | undefined = result.flags.shift();
    const aliases: string[] = result.flags;

    if (!name) {
      throw new MissingCommandNameError();
    }

    if (this.getBaseCommand(name, true)) {
      if (!override) {
        throw new DuplicateCommandNameError(name);
      }
      this.removeCommand(name);
    }

    let description: string | undefined;
    let cmd: Command<any>;

    if (typeof cmdOrDescription === "string") {
      description = cmdOrDescription;
    }

    if (cmdOrDescription instanceof Command) {
      cmd = cmdOrDescription.reset();
    } else {
      cmd = new Command();
    }

    cmd._name = name;
    cmd._parent = this;

    if (description) {
      cmd.description(description);
    }

    if (result.typeDefinition) {
      cmd.arguments(result.typeDefinition);
    }

    aliases.forEach((alias: string) => cmd.alias(alias));

    this.commands.set(name, cmd);

    this.select(name);

    return this;
  }

  /**
   * Add new command alias.
   * @param alias Tha name of the alias.
   */
  public alias(alias: string): this {
    if (this.cmd._name === alias || this.cmd.aliases.includes(alias)) {
      throw new DuplicateCommandAliasError(alias);
    }

    this.cmd.aliases.push(alias);

    return this;
  }

  /** Reset internal command reference to main command. */
  public reset(): OneOf<TParentCommand, this> {
    this._groupName = undefined;
    this.cmd = this;
    return this as OneOf<TParentCommand, this>;
  }

  /**
   * Set internal command pointer to child command with given name.
   * @param name The name of the command to select.
   */
  public select<
    TOptions extends Record<string, unknown> | void = any,
    TArguments extends Array<unknown> = any,
    TGlobalOptions extends Record<string, unknown> | void = any,
  >(
    name: string,
  ): Command<
    TParentCommandGlobals,
    TParentCommandTypes,
    TOptions,
    TArguments,
    TGlobalOptions,
    TCommandTypes,
    TCommandGlobalTypes,
    TParentCommand
  > {
    const cmd = this.getBaseCommand(name, true);

    if (!cmd) {
      throw new CommandNotFoundError(name, this.getBaseCommands(true));
    }

    this.cmd = cmd;

    return this as Command<any>;
  }

  /*****************************************************************************
   **** SUB HANDLER ************************************************************
   *****************************************************************************/

  /** Set command name. */
  public name(name: string): this {
    this.cmd._name = name;
    return this;
  }

  /**
   * Set command version.
   * @param version Semantic version string string or method that returns the version string.
   */
  public version(
    version:
      | string
      | VersionHandler<
        Partial<TCommandOptions>,
        Partial<TCommandArguments>,
        TCommandGlobals,
        TParentCommandGlobals,
        TCommandTypes,
        TCommandGlobalTypes,
        TParentCommandTypes,
        TParentCommand
      >,
  ): this {
    if (typeof version === "string") {
      this.cmd.ver = () => version;
    } else if (typeof version === "function") {
      this.cmd.ver = version;
    }
    return this;
  }

  public meta(name: string, value: string): this {
    this.cmd._meta[name] = value;
    return this;
  }

  public getMeta(): Record<string, string>;
  public getMeta(name: string): string;
  public getMeta(name?: string): Record<string, string> | string {
    return typeof name === "undefined" ? this._meta : this._meta[name];
  }

  /**
   * Set command help.
   * @param help Help string, method, or config for generator that returns the help string.
   */
  public help(
    help:
      | string
      | HelpHandler<
        Partial<TCommandOptions>,
        Partial<TCommandArguments>,
        TCommandGlobals,
        TParentCommandGlobals
      >
      | HelpOptions,
  ): this {
    if (typeof help === "string") {
      this.cmd._help = () => help;
    } else if (typeof help === "function") {
      this.cmd._help = help;
    } else {
      this.cmd._help = (cmd: Command, options: HelpOptions): string =>
        HelpGenerator.generate(cmd, { ...help, ...options });
    }
    return this;
  }

  /**
   * Set the long command description.
   * @param description The command description.
   */
  public description(
    description: Description<
      TCommandOptions,
      TCommandArguments,
      TCommandGlobals,
      TParentCommandGlobals,
      TCommandTypes,
      TCommandGlobalTypes,
      TParentCommandTypes,
      TParentCommand
    >,
  ): this {
    this.cmd.desc = description;
    return this;
  }

  /**
   * Set the command usage. Defaults to arguments.
   * @param usage The command usage.
   */
  public usage(usage: string): this {
    this.cmd._usage = usage;
    return this;
  }

  /**
   * Hide command from help, completions, etc.
   */
  public hidden(): this {
    this.cmd.isHidden = true;
    return this;
  }

  /** Make command globally available. */
  public global(): this {
    this.cmd.isGlobal = true;
    return this;
  }

  /** Make command executable. */
  public executable(): this {
    this.cmd.isExecutable = true;
    return this;
  }

  /**
   * Set command arguments:
   *
   *   <requiredArg:string> [optionalArg: number] [...restArgs:string]
   */
  public arguments<
    TArguments extends TypedArguments<
      TArgs,
      Merge<TParentCommandTypes, Merge<TCommandGlobalTypes, TCommandTypes>>
    >,
    TArgs extends string = string,
  >(
    args: TArgs,
  ): Command<
    TParentCommandGlobals,
    TParentCommandTypes,
    TCommandOptions,
    TArguments,
    TCommandGlobals,
    TCommandTypes,
    TCommandGlobalTypes,
    TParentCommand
  > {
    this.cmd.argsDefinition = args;
    return this as Command<any>;
  }

  /**
   * Set command callback method.
   * @param fn Command action handler.
   */
  public action(
    fn: ActionHandler<
      TCommandOptions,
      TCommandArguments,
      TCommandGlobals,
      TParentCommandGlobals,
      TCommandTypes,
      TCommandGlobalTypes,
      TParentCommandTypes,
      TParentCommand
    >,
  ): this {
    this.cmd.fn = fn;
    return this;
  }

  /**
   * Don't throw an error if the command was called without arguments.
   * @param allowEmpty Enable/disable allow empty.
   */
  // public allowEmpty<TAllowEmpty extends boolean | undefined = undefined>(
  //   allowEmpty?: TAllowEmpty,
  // ): false extends TAllowEmpty ? this
  //   : Command<
  //     Partial<TParentCommandGlobals>,
  //     TParentCommandTypes,
  //     Partial<TCommandOptions>,
  //     TCommandArguments,
  //     TCommandGlobals,
  //     TCommandTypes,
  //     TCommandGlobalTypes,
  //     TParentCommand
  //   > {
  //   this.cmd._allowEmpty = allowEmpty !== false;
  //   return this;
  // }

  public allowEmpty<TAllowEmpty extends boolean | undefined = undefined>(
    allowEmpty?: TAllowEmpty,
  ): false extends TAllowEmpty ? this
    : Command<
      Partial<TParentCommandGlobals>,
      TParentCommandTypes,
      Partial<TCommandOptions>,
      TCommandArguments,
      TCommandGlobals,
      TCommandTypes,
      TCommandGlobalTypes,
      TParentCommand
    > {
    this.cmd._allowEmpty = allowEmpty !== false;
    return this as false extends TAllowEmpty ? this
      : Command<
        Partial<TParentCommandGlobals>,
        TParentCommandTypes,
        Partial<TCommandOptions>,
        TCommandArguments,
        TCommandGlobals,
        TCommandTypes,
        TCommandGlobalTypes,
        TParentCommand
      >;
  }

  /**
   * Enable stop early. If enabled, all arguments starting from the first non
   * option argument will be passed as arguments with type string to the command
   * action handler.
   *
   * For example:
   *     `command --debug-level warning server --port 80`
   *
   * Will result in:
   *     - options: `{debugLevel: 'warning'}`
   *     - args: `['server', '--port', '80']`
   *
   * @param stopEarly Enable/disable stop early.
   */
  public stopEarly(stopEarly = true): this {
    this.cmd._stopEarly = stopEarly;
    return this;
  }

  /**
   * Disable parsing arguments. If enabled the raw arguments will be passed to
   * the action handler. This has no effect for parent or child commands. Only
   * for the command on which this method was called.
   * @param useRawArgs Enable/disable raw arguments.
   */
  public useRawArgs(
    useRawArgs = true,
  ): Command<
    void,
    void,
    void,
    Array<string>,
    void,
    void,
    void,
    TParentCommand
  > {
    this.cmd._useRawArgs = useRawArgs;
    return this as Command<any>;
  }

  /**
   * Set default command. The default command is executed when the program
   * was called without any argument and if no action handler is registered.
   * @param name Name of the default command.
   */
  public default(name: string): this {
    this.cmd.defaultCommand = name;
    return this;
  }

  public globalType<
    THandler extends TypeOrTypeHandler<unknown>,
    TName extends string = string,
  >(
    name: TName,
    handler: THandler,
    options?: Omit<TypeOptions, "global">,
  ): Command<
    TParentCommandGlobals,
    TParentCommandTypes,
    TCommandOptions,
    TCommandArguments,
    TCommandGlobals,
    TCommandTypes,
    Merge<TCommandGlobalTypes, TypedType<TName, THandler>>,
    TParentCommand
  > {
    return this.type(name, handler, { ...options, global: true });
  }

  /**
   * Register custom type.
   * @param name    The name of the type.
   * @param handler The callback method to parse the type.
   * @param options Type options.
   */
  public type<
    THandler extends TypeOrTypeHandler<unknown>,
    TName extends string = string,
  >(
    name: TName,
    handler: THandler,
    options?: TypeOptions,
  ): Command<
    TParentCommandGlobals,
    TParentCommandTypes,
    TCommandOptions,
    TCommandArguments,
    TCommandGlobals,
    Merge<TCommandTypes, TypedType<TName, THandler>>,
    TCommandGlobalTypes,
    TParentCommand
  > {
    if (this.cmd.types.get(name) && !options?.override) {
      throw new DuplicateTypeError(name);
    }

    this.cmd.types.set(name, {
      ...options,
      name,
      handler: handler as TypeOrTypeHandler<unknown>,
    });

    if (
      handler instanceof Type &&
      (typeof handler.complete !== "undefined" ||
        typeof handler.values !== "undefined")
    ) {
      const completeHandler: CompleteHandler = (
        cmd: Command,
        parent?: Command,
      ) => handler.complete?.(cmd, parent) || [];
      this.complete(name, completeHandler, options);
    }

    return this as Command<any>;
  }

  public globalComplete(
    name: string,
    complete: CompleteHandler,
    options?: Omit<CompleteOptions, "global">,
  ): this {
    return this.complete(name, complete, { ...options, global: true });
  }

  /**
   * Register command specific custom type.
   * @param name      The name of the completion.
   * @param complete  The callback method to complete the type.
   * @param options   Complete options.
   */
  public complete(
    name: string,
    complete: CompleteHandler<
      Partial<TCommandOptions>,
      Partial<TCommandArguments>,
      TCommandGlobals,
      TParentCommandGlobals,
      TCommandTypes,
      TCommandGlobalTypes,
      TParentCommandTypes,
      any
    >,
    options: CompleteOptions & { global: boolean },
  ): this;
  public complete(
    name: string,
    complete: CompleteHandler<
      TCommandOptions,
      TCommandArguments,
      TCommandGlobals,
      TParentCommandGlobals,
      TCommandTypes,
      TCommandGlobalTypes,
      TParentCommandTypes,
      TParentCommand
    >,
    options?: CompleteOptions,
  ): this;

  public complete(
    name: string,
    complete:
      | CompleteHandler<
        TCommandOptions,
        TCommandArguments,
        TCommandGlobals,
        TParentCommandGlobals,
        TCommandTypes,
        TCommandGlobalTypes,
        TParentCommandTypes,
        TParentCommand
      >
      | CompleteHandler<
        Partial<TCommandOptions>,
        Partial<TCommandArguments>,
        TCommandGlobals,
        TParentCommandGlobals,
        TCommandTypes,
        TCommandGlobalTypes,
        TParentCommandTypes,
        any
      >,
    options?: CompleteOptions,
  ): this {
    if (this.cmd.completions.has(name) && !options?.override) {
      throw new DuplicateCompletionError(name);
    }

    this.cmd.completions.set(name, {
      name,
      complete,
      ...options,
    });

    return this;
  }

  /**
   * Throw validation errors instead of calling `Deno.exit()` to handle
   * validation errors manually.
   *
   * A validation error is thrown when the command is wrongly used by the user.
   * For example: If the user passes some invalid options or arguments to the
   * command.
   *
   * This has no effect for parent commands. Only for the command on which this
   * method was called and all child commands.
   *
   * **Example:**
   *
   * ```
   * try {
   *   cmd.parse();
   * } catch(error) {
   *   if (error instanceof ValidationError) {
   *     cmd.showHelp();
   *     Deno.exit(1);
   *   }
   *   throw error;
   * }
   * ```
   *
   * @see ValidationError
   */
  public throwErrors(): this {
    this.cmd.throwOnError = true;
    return this;
  }

  /**
   * Same as `.throwErrors()` but also prevents calling `Deno.exit` after
   * printing help or version with the --help and --version option.
   */
  public noExit(): this {
    this.cmd._shouldExit = false;
    this.throwErrors();
    return this;
  }

  /**
   * Disable inheriting global commands, options and environment variables from
   * parent commands.
   */
  public noGlobals(): this {
    this.cmd._noGlobals = true;
    return this;
  }

  /** Check whether the command should throw errors or exit. */
  protected shouldThrowErrors(): boolean {
    return this.throwOnError || !!this._parent?.shouldThrowErrors();
  }

  /** Check whether the command should exit after printing help or version. */
  protected shouldExit(): boolean {
    return this._shouldExit ?? this._parent?.shouldExit() ?? true;
  }

  public globalOption<
    TFlags extends string,
    TGlobalOptions extends TypedOption<
      TFlags,
      TCommandOptions,
      Merge<TParentCommandTypes, Merge<TCommandGlobalTypes, TCommandTypes>>,
      undefined extends TConflicts ? TRequired : false,
      TDefaultValue
    >,
    TMappedGlobalOptions extends MapValue<
      TGlobalOptions,
      TMappedValue,
      TCollect
    >,
    TRequired extends OptionOptions["required"] = undefined,
    TCollect extends OptionOptions["collect"] = undefined,
    TConflicts extends OptionOptions["conflicts"] = undefined,
    TDefaultValue = undefined,
    TMappedValue = undefined,
  >(
    flags: TFlags,
    desc: string,
    opts?:
      | Omit<
        GlobalOptionOptions<
          Partial<TCommandOptions>,
          TCommandArguments,
          MergeOptions<TFlags, TCommandGlobals, TGlobalOptions>,
          TParentCommandGlobals,
          TCommandTypes,
          TCommandGlobalTypes,
          TParentCommandTypes,
          TParentCommand
        >,
        "value"
      >
        & {
          default?: DefaultValue<TDefaultValue>;
          required?: TRequired;
          collect?: TCollect;
          value?: OptionValueHandler<
            MapTypes<ValueOf<TGlobalOptions>>,
            TMappedValue
          >;
        }
      | OptionValueHandler<MapTypes<ValueOf<TGlobalOptions>>, TMappedValue>,
  ): Command<
    TParentCommandGlobals,
    TParentCommandTypes,
    TCommandOptions,
    TCommandArguments,
    MergeOptions<TFlags, TCommandGlobals, TMappedGlobalOptions>,
    TCommandTypes,
    TCommandGlobalTypes,
    TParentCommand
  > {
    if (typeof opts === "function") {
      return this.option(
        flags,
        desc,
        { value: opts, global: true } as OptionOptions,
      ) as Command<any>;
    }
    return this.option(
      flags,
      desc,
      { ...opts, global: true } as OptionOptions,
    ) as Command<any>;
  }

  /**
   * Enable grouping of options and set the name of the group.
   * All option which are added after calling the `.group()` method will be
   * grouped in the help output. If the `.group()` method can be use multiple
   * times to create more groups.
   *
   * @param name The name of the option group.
   */
  public group(name: string): this {
    this.cmd._groupName = name;
    return this;
  }

  /**
   * Add a new option.
   * @param flags Flags string e.g: -h, --help, --manual <requiredArg:string> [optionalArg:number] [...restArgs:string]
   * @param desc Flag description.
   * @param opts Flag options or custom handler for processing flag value.
   */
  public option<
    TFlags extends string,
    TGlobalOptions extends TypedOption<
      TFlags,
      TCommandOptions,
      Merge<TParentCommandTypes, Merge<TCommandGlobalTypes, TCommandTypes>>,
      undefined extends TConflicts ? TRequired : false,
      TDefault
    >,
    TMappedGlobalOptions extends MapValue<
      TGlobalOptions,
      TMappedValue,
      TCollect
    >,
    TRequired extends OptionOptions["required"] = undefined,
    TCollect extends OptionOptions["collect"] = undefined,
    TConflicts extends OptionOptions["conflicts"] = undefined,
    TDefault = undefined,
    TMappedValue = undefined,
  >(
    flags: TFlags,
    desc: string,
    opts:
      | Omit<
        OptionOptions<
          Partial<TCommandOptions>,
          TCommandArguments,
          MergeOptions<TFlags, TCommandGlobals, TGlobalOptions>,
          TParentCommandGlobals,
          TCommandTypes,
          TCommandGlobalTypes,
          TParentCommandTypes,
          TParentCommand
        >,
        "value"
      >
        & {
          global: true;
          default?: DefaultValue<TDefault>;
          required?: TRequired;
          collect?: TCollect;
          value?: OptionValueHandler<
            MapTypes<ValueOf<TGlobalOptions>>,
            TMappedValue
          >;
        }
      | OptionValueHandler<MapTypes<ValueOf<TGlobalOptions>>, TMappedValue>,
  ): Command<
    TParentCommandGlobals,
    TParentCommandTypes,
    TCommandOptions,
    TCommandArguments,
    MergeOptions<TFlags, TCommandGlobals, TMappedGlobalOptions>,
    TCommandTypes,
    TCommandGlobalTypes,
    TParentCommand
  >;

  public option<
    TFlags extends string,
    TOptions extends TypedOption<
      TFlags,
      TCommandOptions,
      Merge<TParentCommandTypes, Merge<TCommandGlobalTypes, TCommandTypes>>,
      undefined extends TConflicts ? TRequired : false,
      TDefaultValue
    >,
    TMappedOptions extends MapValue<TOptions, TMappedValue, TCollect>,
    TRequired extends OptionOptions["required"] = undefined,
    TCollect extends OptionOptions["collect"] = undefined,
    TConflicts extends OptionOptions["conflicts"] = undefined,
    TDefaultValue = undefined,
    TMappedValue = undefined,
  >(
    flags: TFlags,
    desc: string,
    opts?:
      | Omit<
        OptionOptions<
          MergeOptions<TFlags, TCommandOptions, TMappedOptions>,
          TCommandArguments,
          TCommandGlobals,
          TParentCommandGlobals,
          TCommandTypes,
          TCommandGlobalTypes,
          TParentCommandTypes,
          TParentCommand
        >,
        "value"
      >
        & {
          default?: DefaultValue<TDefaultValue>;
          required?: TRequired;
          collect?: TCollect;
          conflicts?: TConflicts;
          value?: OptionValueHandler<MapTypes<ValueOf<TOptions>>, TMappedValue>;
        }
      | OptionValueHandler<MapTypes<ValueOf<TOptions>>, TMappedValue>,
  ): Command<
    TParentCommandGlobals,
    TParentCommandTypes,
    MergeOptions<TFlags, TCommandOptions, TMappedOptions>,
    TCommandArguments,
    TCommandGlobals,
    TCommandTypes,
    TCommandGlobalTypes,
    TParentCommand
  >;

  public option(
    flags: string,
    desc: string,
    opts?: OptionOptions | OptionValueHandler,
  ): Command<any> {
    if (typeof opts === "function") {
      return this.option(flags, desc, { value: opts });
    }

    const result = splitArguments(flags);

    const args: Argument[] = result.typeDefinition
      ? parseArgumentsDefinition(result.typeDefinition)
      : [];

    const option: Option = {
      ...opts,
      name: "",
      description: desc,
      args,
      flags: result.flags,
      equalsSign: result.equalsSign,
      typeDefinition: result.typeDefinition,
      groupName: this._groupName,
    };

    if (option.separator) {
      for (const arg of args) {
        if (arg.list) {
          arg.separator = option.separator;
        }
      }
    }

    for (const part of option.flags) {
      const arg = part.trim();
      const isLong = /^--/.test(arg);
      const name = isLong ? arg.slice(2) : arg.slice(1);

      if (this.cmd.getBaseOption(name, true)) {
        if (opts?.override) {
          this.removeOption(name);
        } else {
          throw new DuplicateOptionNameError(name);
        }
      }

      if (!option.name && isLong) {
        option.name = name;
      } else if (!option.aliases) {
        option.aliases = [name];
      } else {
        option.aliases.push(name);
      }
    }

    if (option.prepend) {
      this.cmd.options.unshift(option);
    } else {
      this.cmd.options.push(option);
    }

    return this;
  }

  /**
   * Add new command example.
   * @param name          Name of the example.
   * @param description   The content of the example.
   */
  public example(name: string, description: string): this {
    if (this.cmd.hasExample(name)) {
      throw new DuplicateExampleError(name);
    }

    this.cmd.examples.push({ name, description });

    return this;
  }

  public globalEnv<
    TNameAndValue extends string,
    TGlobalEnvVars extends TypedEnv<
      TNameAndValue,
      TPrefix,
      TCommandOptions,
      Merge<TParentCommandTypes, Merge<TCommandGlobalTypes, TCommandTypes>>,
      TRequired
    >,
    TMappedGlobalEnvVars extends MapValue<TGlobalEnvVars, TMappedValue>,
    TRequired extends EnvVarOptions["required"] = undefined,
    TPrefix extends EnvVarOptions["prefix"] = undefined,
    TMappedValue = undefined,
  >(
    name: TNameAndValue,
    description: string,
    options?: Omit<GlobalEnvVarOptions, "value"> & {
      required?: TRequired;
      prefix?: TPrefix;
      value?: EnvVarValueHandler<
        MapTypes<ValueOf<TGlobalEnvVars>>,
        TMappedValue
      >;
    },
  ): Command<
    TParentCommandGlobals,
    TParentCommandTypes,
    TCommandOptions,
    TCommandArguments,
    Merge<TCommandGlobals, TMappedGlobalEnvVars>,
    TCommandTypes,
    TCommandGlobalTypes,
    TParentCommand
  > {
    return this.env(
      name,
      description,
      { ...options, global: true } as EnvVarOptions,
    ) as Command<any>;
  }

  /**
   * Add new environment variable.
   * @param name          Name of the environment variable.
   * @param description   The description of the environment variable.
   * @param options       Environment variable options.
   */
  public env<
    N extends string,
    G extends TypedEnv<
      N,
      P,
      TCommandOptions,
      Merge<TParentCommandTypes, Merge<TCommandGlobalTypes, TCommandTypes>>,
      R
    >,
    MG extends MapValue<G, V>,
    R extends EnvVarOptions["required"] = undefined,
    P extends EnvVarOptions["prefix"] = undefined,
    V = undefined,
  >(
    name: N,
    description: string,
    options: Omit<EnvVarOptions, "value"> & {
      global: true;
      required?: R;
      prefix?: P;
      value?: EnvVarValueHandler<MapTypes<ValueOf<G>>, V>;
    },
  ): Command<
    TParentCommandGlobals,
    TParentCommandTypes,
    TCommandOptions,
    TCommandArguments,
    Merge<TCommandGlobals, MG>,
    TCommandTypes,
    TCommandGlobalTypes,
    TParentCommand
  >;

  public env<
    TNameAndValue extends string,
    TEnvVar extends TypedEnv<
      TNameAndValue,
      TPrefix,
      TCommandOptions,
      Merge<TParentCommandTypes, Merge<TCommandGlobalTypes, TCommandTypes>>,
      TRequired
    >,
    TMappedEnvVar extends MapValue<TEnvVar, TMappedValue>,
    TRequired extends EnvVarOptions["required"] = undefined,
    TPrefix extends EnvVarOptions["prefix"] = undefined,
    TMappedValue = undefined,
  >(
    name: TNameAndValue,
    description: string,
    options?: Omit<EnvVarOptions, "value"> & {
      required?: TRequired;
      prefix?: TPrefix;
      value?: EnvVarValueHandler<MapTypes<ValueOf<TEnvVar>>, TMappedValue>;
    },
  ): Command<
    TParentCommandGlobals,
    TParentCommandTypes,
    Merge<TCommandOptions, TMappedEnvVar>,
    TCommandArguments,
    TCommandGlobals,
    TCommandTypes,
    TCommandGlobalTypes,
    TParentCommand
  >;

  public env(
    name: string,
    description: string,
    options?: EnvVarOptions,
  ): Command<any> {
    const result = splitArguments(name);

    if (!result.typeDefinition) {
      result.typeDefinition = "<value:boolean>";
    }

    if (result.flags.some((envName) => this.cmd.getBaseEnvVar(envName, true))) {
      throw new DuplicateEnvVarError(name);
    }

    const details: Argument[] = parseArgumentsDefinition(
      result.typeDefinition,
    );

    if (details.length > 1) {
      throw new TooManyEnvVarValuesError(name);
    } else if (details.length && details[0].optionalValue) {
      throw new UnexpectedOptionalEnvVarValueError(name);
    } else if (details.length && details[0].variadic) {
      throw new UnexpectedVariadicEnvVarValueError(name);
    }

    this.cmd.envVars.push({
      name: result.flags[0],
      names: result.flags,
      description,
      type: details[0].type,
      details: details.shift() as Argument,
      ...options,
    });

    return this;
  }

  /*****************************************************************************
   **** MAIN HANDLER ***********************************************************
   *****************************************************************************/

  /**
   * Parse command line arguments and execute matched command.
   * @param args Command line args to parse. Ex: `cmd.parse( Deno.args )`
   */
  public parse(
    args: string[] = Deno.args,
  ): Promise<
    TParentCommand extends Command<any> ? CommandResult<
        Record<string, unknown>,
        Array<unknown>,
        Record<string, unknown>,
        Record<string, unknown>,
        Record<string, unknown>,
        Record<string, unknown>,
        Record<string, unknown>,
        undefined
      >
      : CommandResult<
        MapTypes<TCommandOptions>,
        MapTypes<TCommandArguments>,
        MapTypes<TCommandGlobals>,
        MapTypes<TParentCommandGlobals>,
        TCommandTypes,
        TCommandGlobalTypes,
        TParentCommandTypes,
        TParentCommand
      >
  > {
    const ctx: ParseContext = {
      unknown: args.slice(),
      flags: {},
      env: {},
      literal: [],
      stopEarly: false,
      stopOnUnknown: false,
    };
    return this.parseCommand(ctx) as any;
  }

  private async parseCommand(ctx: ParseContext): Promise<CommandResult> {
    try {
      this.reset();
      this.registerDefaults();
      this.rawArgs = ctx.unknown.slice();

      if (this.isExecutable) {
        await this.executeExecutable(ctx.unknown);
        return { options: {}, args: [], cmd: this, literal: [] } as any;
      } else if (this._useRawArgs) {
        await this.parseEnvVars(ctx, this.envVars);
        return this.execute(ctx.env, ...ctx.unknown) as any;
      }

      let preParseGlobals = false;
      let subCommand: Command<any> | undefined;

      // Pre parse globals to support: cmd --global-option sub-command --option
      if (ctx.unknown.length > 0) {
        // Detect sub command.
        subCommand = this.getSubCommand(ctx);

        if (!subCommand) {
          // Only pre parse globals if first arg ist a global option.
          const optionName = ctx.unknown[0].replace(/^-+/, "");
          const option = this.getOption(optionName, true);

          if (option?.global) {
            preParseGlobals = true;
            await this.parseGlobalOptionsAndEnvVars(ctx);
          }
        }
      }

      if (subCommand || ctx.unknown.length > 0) {
        subCommand ??= this.getSubCommand(ctx);

        if (subCommand) {
          subCommand._globalParent = this;
          return subCommand.parseCommand(ctx);
        }
      }

      // Parse rest options & env vars.
      await this.parseOptionsAndEnvVars(ctx, preParseGlobals);
      const options = { ...ctx.env, ...ctx.flags };
      const args = this.parseArguments(ctx, options);
      this.literalArgs = ctx.literal;

      // Execute option action.
      if (ctx.action) {
        await ctx.action.action.call(this, options, ...args);

        if (ctx.action.standalone) {
          return {
            options,
            args,
            cmd: this,
            literal: this.literalArgs,
          } as any;
        }
      }

      return this.execute(options, ...args) as any;
    } catch (error: unknown) {
      this.throw(
        error instanceof FlagsValidationError
          ? new ValidationError(error.message)
          : error instanceof Error
          ? error
          : new Error(`[non-error-thrown] ${error}`),
      );
    }
  }

  private getSubCommand(ctx: ParseContext) {
    const subCommand = this.getCommand(ctx.unknown[0], true);

    if (subCommand) {
      ctx.unknown.shift();
    }

    return subCommand;
  }

  private async parseGlobalOptionsAndEnvVars(
    ctx: ParseContext,
  ): Promise<void> {
    const isHelpOption = this.getHelpOption()?.flags.includes(ctx.unknown[0]);

    // Parse global env vars.
    const envVars = [
      ...this.envVars.filter((envVar) => envVar.global),
      ...this.getGlobalEnvVars(true),
    ];

    await this.parseEnvVars(ctx, envVars, !isHelpOption);

    // Parse global options.
    const options = [
      ...this.options.filter((option) => option.global),
      ...this.getGlobalOptions(true),
    ];

    this.parseOptions(ctx, options, {
      stopEarly: true,
      stopOnUnknown: true,
      dotted: false,
    });
  }

  private async parseOptionsAndEnvVars(
    ctx: ParseContext,
    preParseGlobals: boolean,
  ): Promise<void> {
    const helpOption = this.getHelpOption();
    const isVersionOption = this._versionOption?.flags.includes(ctx.unknown[0]);
    const isHelpOption = helpOption && ctx.flags?.[helpOption.name] === true;

    // Parse env vars.
    const envVars = preParseGlobals
      ? this.envVars.filter((envVar) => !envVar.global)
      : this.getEnvVars(true);

    await this.parseEnvVars(
      ctx,
      envVars,
      !isHelpOption && !isVersionOption,
    );

    // Parse options.
    const options = this.getOptions(true);

    this.parseOptions(ctx, options);
  }

  /** Register default options like `--version` and `--help`. */
  private registerDefaults(): this {
    if (this.hasDefaults || this.getParent()) {
      return this;
    }
    this.hasDefaults = true;

    this.reset();

    !this.types.has("string") &&
      this.type("string", new StringType(), { global: true });
    !this.types.has("number") &&
      this.type("number", new NumberType(), { global: true });
    !this.types.has("integer") &&
      this.type("integer", new IntegerType(), { global: true });
    !this.types.has("boolean") &&
      this.type("boolean", new BooleanType(), { global: true });
    !this.types.has("file") &&
      this.type("file", new FileType(), { global: true });

    if (!this._help) {
      this.help({
        hints: true,
        types: false,
      });
    }

    if (this._versionOptions !== false && (this._versionOptions || this.ver)) {
      this.option(
        this._versionOptions?.flags || "-V, --version",
        this._versionOptions?.desc ||
          "Show the version number for this program.",
        {
          standalone: true,
          prepend: true,
          action: async function () {
            const long = this.getRawArgs().includes(
              `--${this._versionOption?.name}`,
            );
            if (long) {
              await this.checkVersion();
              this.showLongVersion();
            } else {
              this.showVersion();
            }
            this.exit();
          },
          ...(this._versionOptions?.opts ?? {}),
        },
      );
      this._versionOption = this.options[0];
    }

    if (this._helpOptions !== false) {
      this.option(
        this._helpOptions?.flags || "-h, --help",
        this._helpOptions?.desc || "Show this help.",
        {
          standalone: true,
          global: true,
          prepend: true,
          action: async function () {
            const long = this.getRawArgs().includes(
              `--${this.getHelpOption()?.name}`,
            );
            await this.checkVersion();
            this.showHelp({ long });
            this.exit();
          },
          ...(this._helpOptions?.opts ?? {}),
        },
      );
      this._helpOption = this.options[0];
    }

    return this;
  }

  /**
   * Execute command.
   * @param options A map of options.
   * @param args Command arguments.
   */
  protected async execute(
    options: Record<string, unknown>,
    ...args: Array<unknown>
  ): Promise<CommandResult> {
    if (this.fn) {
      await this.fn(options, ...args);
    } else if (this.defaultCommand) {
      const cmd = this.getCommand(this.defaultCommand, true);

      if (!cmd) {
        throw new DefaultCommandNotFoundError(
          this.defaultCommand,
          this.getCommands(),
        );
      }
      cmd._globalParent = this;

      return cmd.execute(options, ...args);
    }

    return {
      options,
      args,
      cmd: this,
      literal: this.literalArgs,
    };
  }

  /**
   * Execute external sub-command.
   * @param args Raw command line arguments.
   */
  protected async executeExecutable(args: string[]) {
    const command = this.getPath().replace(/\s+/g, "-");

    await Deno.permissions.request({ name: "run", command });

    try {
      const process: Deno.Process = Deno.run({
        cmd: [command, ...args],
      });
      const status: Deno.ProcessStatus = await process.status();

      if (!status.success) {
        Deno.exit(status.code);
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new CommandExecutableNotFoundError(command);
      }
      throw error;
    }
  }

  /** Parse raw command line arguments. */
  protected parseOptions(
    ctx: ParseContext,
    options: Option[],
    {
      stopEarly = this._stopEarly,
      stopOnUnknown = false,
      dotted = true,
    }: ParseOptionsOptions = {},
  ): void {
    parseFlags(ctx, {
      stopEarly,
      stopOnUnknown,
      dotted,
      allowEmpty: this._allowEmpty,
      flags: options,
      ignoreDefaults: ctx.env,
      parse: (type: ArgumentValue) => this.parseType(type),
      option: (option: Option) => {
        if (!ctx.action && option.action) {
          ctx.action = option as ActionOption;
        }
      },
    });
  }

  /** Parse argument type. */
  protected parseType(type: ArgumentValue): unknown {
    const typeSettings: TypeDef | undefined = this.getType(type.type);

    if (!typeSettings) {
      throw new UnknownTypeError(
        type.type,
        this.getTypes().map((type) => type.name),
      );
    }

    return typeSettings.handler instanceof Type
      ? typeSettings.handler.parse(type)
      : typeSettings.handler(type);
  }

  /**
   * Read and validate environment variables.
   * @param ctx Parse context.
   * @param envVars env vars defined by the command.
   * @param validate when true, throws an error if a required env var is missing.
   */
  protected async parseEnvVars(
    ctx: ParseContext,
    envVars: Array<EnvVar>,
    validate = true,
  ): Promise<void> {
    for (const envVar of envVars) {
      const env = await this.findEnvVar(envVar.names);

      if (env) {
        const parseType = (value: string) => {
          return this.parseType({
            label: "Environment variable",
            type: envVar.type,
            name: env.name,
            value,
          });
        };

        const propertyName = underscoreToCamelCase(
          envVar.prefix
            ? envVar.names[0].replace(new RegExp(`^${envVar.prefix}`), "")
            : envVar.names[0],
        );

        if (envVar.details.list) {
          ctx.env[propertyName] = env.value
            .split(envVar.details.separator ?? ",")
            .map(parseType);
        } else {
          ctx.env[propertyName] = parseType(env.value);
        }

        if (envVar.value && typeof ctx.env[propertyName] !== "undefined") {
          ctx.env[propertyName] = envVar.value(ctx.env[propertyName]);
        }
      } else if (envVar.required && validate) {
        throw new MissingRequiredEnvVarError(envVar);
      }
    }
  }

  protected async findEnvVar(
    names: readonly string[],
  ): Promise<{ name: string; value: string } | undefined> {
    for (const name of names) {
      const status = await Deno.permissions.query({
        name: "env",
        variable: name,
      });

      if (status.state === "granted") {
        const value = Deno.env.get(name);

        if (value) {
          return { name, value };
        }
      }
    }

    return undefined;
  }

  /**
   * Parse command-line arguments.
   * @param ctx     Parse context.
   * @param options Parsed command line options.
   */
  protected parseArguments(
    ctx: ParseContext,
    options: Record<string, unknown>,
  ): TCommandArguments {
    const params: Array<unknown> = [];
    const args = ctx.unknown.slice();

    if (!this.hasArguments()) {
      if (args.length) {
        if (this.hasCommands(true)) {
          if (this.hasCommand(args[0], true)) {
            // e.g: command --global-foo --foo sub-command
            throw new TooManyArgumentsError(args);
          } else {
            throw new UnknownCommandError(args[0], this.getCommands());
          }
        } else {
          throw new NoArgumentsAllowedError(this.getPath());
        }
      }
    } else {
      if (!args.length) {
        const required = this.getArguments()
          .filter((expectedArg) => !expectedArg.optionalValue)
          .map((expectedArg) => expectedArg.name);

        if (required.length) {
          const optionNames: string[] = Object.keys(options);
          const hasStandaloneOption = !!optionNames.find((name) =>
            this.getOption(name, true)?.standalone
          );

          if (!hasStandaloneOption) {
            throw new MissingArgumentsError(required);
          }
        }
      } else {
        for (const expectedArg of this.getArguments()) {
          if (!args.length) {
            if (expectedArg.optionalValue) {
              break;
            }
            throw new MissingArgumentError(expectedArg.name);
          }

          let arg: unknown;

          const parseArgValue = (value: string) => {
            return expectedArg.list
              ? value.split(",").map((value) => parseArgType(value))
              : parseArgType(value);
          };

          const parseArgType = (value: string) => {
            return this.parseType({
              label: "Argument",
              type: expectedArg.type,
              name: expectedArg.name,
              value,
            });
          };

          if (expectedArg.variadic) {
            arg = args.splice(0, args.length).map((value) =>
              parseArgValue(value)
            );
          } else {
            arg = parseArgValue(args.shift() as string);
          }

          if (expectedArg.variadic && Array.isArray(arg)) {
            params.push(...arg);
          } else if (typeof arg !== "undefined") {
            params.push(arg);
          }
        }

        if (args.length) {
          throw new TooManyArgumentsError(args);
        }
      }
    }

    return params as TCommandArguments;
  }

  /**
   * Handle error. If `throwErrors` is enabled the error will be returned,
   * otherwise a formatted error message will be printed and `Deno.exit(1)`
   * will be called.
   * @param error Error to handle.
   */
  protected throw(error: Error): never {
    if (this.shouldThrowErrors() || !(error instanceof ValidationError)) {
      throw error;
    }
    this.showHelp();

    console.error(red(`  ${bold("error")}: ${error.message}\n`));

    Deno.exit(error instanceof ValidationError ? error.exitCode : 1);
  }

  /*****************************************************************************
   **** GETTER *****************************************************************
   *****************************************************************************/

  /** Get command name. */
  public getName(): string {
    return this._name;
  }

  /** Get parent command. */
  public getParent(): TParentCommand {
    return this._parent as TParentCommand;
  }

  /**
   * Get parent command from global executed command.
   * Be sure, to call this method only inside an action handler. Unless this or any child command was executed,
   * this method returns always undefined.
   */
  public getGlobalParent(): Command<any> | undefined {
    return this._globalParent;
  }

  /** Get main command. */
  public getMainCommand(): Command<any> {
    return this._parent?.getMainCommand() ?? this;
  }

  /** Get command name aliases. */
  public getAliases(): string[] {
    return this.aliases;
  }

  /** Get full command path. */
  public getPath(): string {
    return this._parent
      ? this._parent.getPath() + " " + this._name
      : this._name;
  }

  /** Get arguments definition. E.g: <input-file:string> <output-file:string> */
  public getArgsDefinition(): string | undefined {
    return this.argsDefinition;
  }

  /**
   * Get argument by name.
   * @param name Name of the argument.
   */
  public getArgument(name: string): Argument | undefined {
    return this.getArguments().find((arg) => arg.name === name);
  }

  /** Get arguments. */
  public getArguments(): Argument[] {
    if (!this.args.length && this.argsDefinition) {
      this.args = parseArgumentsDefinition(this.argsDefinition);
    }

    return this.args;
  }

  /** Check if command has arguments. */
  public hasArguments() {
    return !!this.argsDefinition;
  }

  /** Get command version. */
  public getVersion(): string | undefined {
    return this.getVersionHandler()?.call(this, this);
  }

  /** Get help handler method. */
  private getVersionHandler(): VersionHandler | undefined {
    return this.ver ?? this._parent?.getVersionHandler();
  }

  /** Get command description. */
  public getDescription(): string {
    // call description method only once
    return typeof this.desc === "function"
      ? this.desc = this.desc()
      : this.desc;
  }

  public getUsage() {
    return this._usage ?? this.getArgsDefinition();
  }

  /** Get short command description. This is the first line of the description. */
  public getShortDescription(): string {
    return getDescription(this.getDescription(), true);
  }

  /** Get original command-line arguments. */
  public getRawArgs(): string[] {
    return this.rawArgs;
  }

  /** Get all arguments defined after the double dash. */
  public getLiteralArgs(): string[] {
    return this.literalArgs;
  }

  /** Output generated help without exiting. */
  public showVersion(): void {
    console.log(this.getVersion());
  }

  /** Returns command name, version and meta data. */
  public getLongVersion(): string {
    return `${bold(this.getMainCommand().getName())} ${
      blue(this.getVersion() ?? "")
    }` +
      Object.entries(this.getMeta()).map(
        ([k, v]) => `\n${bold(k)} ${blue(v)}`,
      ).join("");
  }

  /** Outputs command name, version and meta data. */
  public showLongVersion(): void {
    console.log(this.getLongVersion());
  }

  /** Output generated help without exiting. */
  public showHelp(options?: HelpOptions): void {
    console.log(this.getHelp(options));
  }

  /** Get generated help. */
  public getHelp(options?: HelpOptions): string {
    this.registerDefaults();
    return this.getHelpHandler().call(this, this, options ?? {});
  }

  /** Get help handler method. */
  private getHelpHandler(): HelpHandler {
    return this._help ?? this._parent?.getHelpHandler() as HelpHandler;
  }

  private exit(code = 0) {
    if (this.shouldExit()) {
      Deno.exit(code);
    }
  }

  /** Check if new version is available and add hint to version. */
  public async checkVersion(): Promise<void> {
    const mainCommand = this.getMainCommand();
    const upgradeCommand = mainCommand.getCommand("upgrade");

    if (!isUpgradeCommand(upgradeCommand)) {
      return;
    }
    const latestVersion = await upgradeCommand.getLatestVersion();
    const currentVersion = mainCommand.getVersion();

    if (currentVersion === latestVersion) {
      return;
    }
    const versionHelpText =
      `(New version available: ${latestVersion}. Run '${mainCommand.getName()} upgrade' to upgrade to the latest version!)`;

    mainCommand.version(`${currentVersion}  ${bold(yellow(versionHelpText))}`);
  }

  /*****************************************************************************
   **** Options GETTER *********************************************************
   *****************************************************************************/

  /**
   * Checks whether the command has options or not.
   * @param hidden Include hidden options.
   */
  public hasOptions(hidden?: boolean): boolean {
    return this.getOptions(hidden).length > 0;
  }

  /**
   * Get options.
   * @param hidden Include hidden options.
   */
  public getOptions(hidden?: boolean): Option[] {
    return this.getGlobalOptions(hidden).concat(this.getBaseOptions(hidden));
  }

  /**
   * Get base options.
   * @param hidden Include hidden options.
   */
  public getBaseOptions(hidden?: boolean): Option[] {
    if (!this.options.length) {
      return [];
    }

    return hidden
      ? this.options.slice(0)
      : this.options.filter((opt) => !opt.hidden);
  }

  /**
   * Get global options.
   * @param hidden Include hidden options.
   */
  public getGlobalOptions(hidden?: boolean): Option[] {
    const helpOption = this.getHelpOption();
    const getGlobals = (
      cmd: Command<any>,
      noGlobals: boolean,
      options: Option[] = [],
      names: string[] = [],
    ): Option[] => {
      if (cmd.options.length) {
        for (const option of cmd.options) {
          if (
            option.global &&
            !this.options.find((opt) => opt.name === option.name) &&
            names.indexOf(option.name) === -1 &&
            (hidden || !option.hidden)
          ) {
            if (noGlobals && option !== helpOption) {
              continue;
            }

            names.push(option.name);
            options.push(option);
          }
        }
      }

      return cmd._parent
        ? getGlobals(
          cmd._parent,
          noGlobals || cmd._noGlobals,
          options,
          names,
        )
        : options;
    };

    return this._parent ? getGlobals(this._parent, this._noGlobals) : [];
  }

  /**
   * Checks whether the command has an option with given name or not.
   * @param name Name of the option. Must be in param-case.
   * @param hidden Include hidden options.
   */
  public hasOption(name: string, hidden?: boolean): boolean {
    return !!this.getOption(name, hidden);
  }

  /**
   * Get option by name.
   * @param name Name of the option. Must be in param-case.
   * @param hidden Include hidden options.
   */
  public getOption(name: string, hidden?: boolean): Option | undefined {
    return this.getBaseOption(name, hidden) ??
      this.getGlobalOption(name, hidden);
  }

  /**
   * Get base option by name.
   * @param name Name of the option. Must be in param-case.
   * @param hidden Include hidden options.
   */
  public getBaseOption(name: string, hidden?: boolean): Option | undefined {
    const option = this.options.find((option) =>
      option.name === name || option.aliases?.includes(name)
    );

    return option && (hidden || !option.hidden) ? option : undefined;
  }

  /**
   * Get global option from parent commands by name.
   * @param name Name of the option. Must be in param-case.
   * @param hidden Include hidden options.
   */
  public getGlobalOption(name: string, hidden?: boolean): Option | undefined {
    const helpOption = this.getHelpOption();
    const getGlobalOption = (
      parent: Command,
      noGlobals: boolean,
    ): Option | undefined => {
      const option: Option | undefined = parent.getBaseOption(
        name,
        hidden,
      );

      if (!option?.global) {
        return parent._parent && getGlobalOption(
          parent._parent,
          noGlobals || parent._noGlobals,
        );
      }
      if (noGlobals && option !== helpOption) {
        return;
      }

      return option;
    };

    return this._parent && getGlobalOption(
      this._parent,
      this._noGlobals,
    );
  }

  /**
   * Remove option by name.
   * @param name Name of the option. Must be in param-case.
   */
  public removeOption(name: string): Option | undefined {
    const index = this.options.findIndex((option) => option.name === name);

    if (index === -1) {
      return;
    }

    return this.options.splice(index, 1)[0];
  }

  /**
   * Checks whether the command has sub-commands or not.
   * @param hidden Include hidden commands.
   */
  public hasCommands(hidden?: boolean): boolean {
    return this.getCommands(hidden).length > 0;
  }

  /**
   * Get commands.
   * @param hidden Include hidden commands.
   */
  public getCommands(hidden?: boolean): Array<Command<any>> {
    return this.getGlobalCommands(hidden).concat(this.getBaseCommands(hidden));
  }

  /**
   * Get base commands.
   * @param hidden Include hidden commands.
   */
  public getBaseCommands(hidden?: boolean): Array<Command<any>> {
    const commands = Array.from(this.commands.values());
    return hidden ? commands : commands.filter((cmd) => !cmd.isHidden);
  }

  /**
   * Get global commands.
   * @param hidden Include hidden commands.
   */
  public getGlobalCommands(hidden?: boolean): Array<Command<any>> {
    const getCommands = (
      command: Command<any>,
      noGlobals: boolean,
      commands: Array<Command<any>> = [],
      names: string[] = [],
    ): Array<Command<any>> => {
      if (command.commands.size) {
        for (const [_, cmd] of command.commands) {
          if (
            cmd.isGlobal &&
            this !== cmd &&
            !this.commands.has(cmd._name) &&
            names.indexOf(cmd._name) === -1 &&
            (hidden || !cmd.isHidden)
          ) {
            if (noGlobals && cmd?.getName() !== "help") {
              continue;
            }

            names.push(cmd._name);
            commands.push(cmd);
          }
        }
      }

      return command._parent
        ? getCommands(
          command._parent,
          noGlobals || command._noGlobals,
          commands,
          names,
        )
        : commands;
    };

    return this._parent ? getCommands(this._parent, this._noGlobals) : [];
  }

  /**
   * Checks whether a child command exists by given name or alias.
   * @param name Name or alias of the command.
   * @param hidden Include hidden commands.
   */
  public hasCommand(name: string, hidden?: boolean): boolean {
    return !!this.getCommand(name, hidden);
  }

  /**
   * Get command by name or alias.
   * @param name Name or alias of the command.
   * @param hidden Include hidden commands.
   */
  public getCommand<TCommand extends Command<any>>(
    name: string,
    hidden?: boolean,
  ): TCommand | undefined {
    return this.getBaseCommand(name, hidden) ??
      this.getGlobalCommand(name, hidden);
  }

  /**
   * Get base command by name or alias.
   * @param name Name or alias of the command.
   * @param hidden Include hidden commands.
   */
  public getBaseCommand<TCommand extends Command<any>>(
    name: string,
    hidden?: boolean,
  ): TCommand | undefined {
    for (const cmd of this.commands.values()) {
      if (cmd._name === name || cmd.aliases.includes(name)) {
        return (cmd && (hidden || !cmd.isHidden) ? cmd : undefined) as
          | TCommand
          | undefined;
      }
    }
  }

  /**
   * Get global command by name or alias.
   * @param name Name or alias of the command.
   * @param hidden Include hidden commands.
   */
  public getGlobalCommand<TCommand extends Command<any>>(
    name: string,
    hidden?: boolean,
  ): TCommand | undefined {
    const getGlobalCommand = (
      parent: Command,
      noGlobals: boolean,
    ): Command | undefined => {
      const cmd: Command | undefined = parent.getBaseCommand(name, hidden);

      if (!cmd?.isGlobal) {
        return parent._parent &&
          getGlobalCommand(parent._parent, noGlobals || parent._noGlobals);
      }
      if (noGlobals && cmd.getName() !== "help") {
        return;
      }

      return cmd;
    };

    return this._parent &&
      getGlobalCommand(this._parent, this._noGlobals) as TCommand;
  }

  /**
   * Remove sub-command by name or alias.
   * @param name Name or alias of the command.
   */
  public removeCommand(name: string): Command<any> | undefined {
    const command = this.getBaseCommand(name, true);

    if (command) {
      this.commands.delete(command._name);
    }

    return command;
  }

  /** Get types. */
  public getTypes(): Array<TypeDef> {
    return this.getGlobalTypes().concat(this.getBaseTypes());
  }

  /** Get base types. */
  public getBaseTypes(): Array<TypeDef> {
    return Array.from(this.types.values());
  }

  /** Get global types. */
  public getGlobalTypes(): Array<TypeDef> {
    const getTypes = (
      cmd: Command<any> | undefined,
      types: Array<TypeDef> = [],
      names: Array<string> = [],
    ): Array<TypeDef> => {
      if (cmd) {
        if (cmd.types.size) {
          cmd.types.forEach((type: TypeDef) => {
            if (
              type.global &&
              !this.types.has(type.name) &&
              names.indexOf(type.name) === -1
            ) {
              names.push(type.name);
              types.push(type);
            }
          });
        }

        return getTypes(cmd._parent, types, names);
      }

      return types;
    };

    return getTypes(this._parent);
  }

  /**
   * Get type by name.
   * @param name Name of the type.
   */
  public getType(name: string): TypeDef | undefined {
    return this.getBaseType(name) ?? this.getGlobalType(name);
  }

  /**
   * Get base type by name.
   * @param name Name of the type.
   */
  public getBaseType(name: string): TypeDef | undefined {
    return this.types.get(name);
  }

  /**
   * Get global type by name.
   * @param name Name of the type.
   */
  public getGlobalType(name: string): TypeDef | undefined {
    if (!this._parent) {
      return;
    }

    const cmd: TypeDef | undefined = this._parent.getBaseType(name);

    if (!cmd?.global) {
      return this._parent.getGlobalType(name);
    }

    return cmd;
  }

  /** Get completions. */
  public getCompletions() {
    return this.getGlobalCompletions().concat(this.getBaseCompletions());
  }

  /** Get base completions. */
  public getBaseCompletions(): Completion[] {
    return Array.from(this.completions.values());
  }

  /** Get global completions. */
  public getGlobalCompletions(): Completion[] {
    const getCompletions = (
      cmd: Command<any> | undefined,
      completions: Completion[] = [],
      names: string[] = [],
    ): Completion[] => {
      if (cmd) {
        if (cmd.completions.size) {
          cmd.completions.forEach((completion: Completion) => {
            if (
              completion.global &&
              !this.completions.has(completion.name) &&
              names.indexOf(completion.name) === -1
            ) {
              names.push(completion.name);
              completions.push(completion);
            }
          });
        }

        return getCompletions(cmd._parent, completions, names);
      }

      return completions;
    };

    return getCompletions(this._parent);
  }

  /**
   * Get completion by name.
   * @param name Name of the completion.
   */
  public getCompletion(name: string): Completion | undefined {
    return this.getBaseCompletion(name) ?? this.getGlobalCompletion(name);
  }

  /**
   * Get base completion by name.
   * @param name Name of the completion.
   */
  public getBaseCompletion(name: string): Completion | undefined {
    return this.completions.get(name);
  }

  /**
   * Get global completions by name.
   * @param name Name of the completion.
   */
  public getGlobalCompletion(name: string): Completion | undefined {
    if (!this._parent) {
      return;
    }

    const completion: Completion | undefined = this._parent.getBaseCompletion(
      name,
    );

    if (!completion?.global) {
      return this._parent.getGlobalCompletion(name);
    }

    return completion;
  }

  /**
   * Checks whether the command has environment variables or not.
   * @param hidden Include hidden environment variable.
   */
  public hasEnvVars(hidden?: boolean): boolean {
    return this.getEnvVars(hidden).length > 0;
  }

  /**
   * Get environment variables.
   * @param hidden Include hidden environment variable.
   */
  public getEnvVars(hidden?: boolean): EnvVar[] {
    return this.getGlobalEnvVars(hidden).concat(this.getBaseEnvVars(hidden));
  }

  /**
   * Get base environment variables.
   * @param hidden Include hidden environment variable.
   */
  public getBaseEnvVars(hidden?: boolean): EnvVar[] {
    if (!this.envVars.length) {
      return [];
    }

    return hidden
      ? this.envVars.slice(0)
      : this.envVars.filter((env) => !env.hidden);
  }

  /**
   * Get global environment variables.
   * @param hidden Include hidden environment variable.
   */
  public getGlobalEnvVars(hidden?: boolean): EnvVar[] {
    if (this._noGlobals) {
      return [];
    }

    const getEnvVars = (
      cmd: Command<any> | undefined,
      envVars: EnvVar[] = [],
      names: string[] = [],
    ): EnvVar[] => {
      if (cmd) {
        if (cmd.envVars.length) {
          cmd.envVars.forEach((envVar: EnvVar) => {
            if (
              envVar.global &&
              !this.envVars.find((env) => env.names[0] === envVar.names[0]) &&
              names.indexOf(envVar.names[0]) === -1 &&
              (hidden || !envVar.hidden)
            ) {
              names.push(envVar.names[0]);
              envVars.push(envVar);
            }
          });
        }

        return getEnvVars(cmd._parent, envVars, names);
      }

      return envVars;
    };

    return getEnvVars(this._parent);
  }

  /**
   * Checks whether the command has an environment variable with given name or not.
   * @param name Name of the environment variable.
   * @param hidden Include hidden environment variable.
   */
  public hasEnvVar(name: string, hidden?: boolean): boolean {
    return !!this.getEnvVar(name, hidden);
  }

  /**
   * Get environment variable by name.
   * @param name Name of the environment variable.
   * @param hidden Include hidden environment variable.
   */
  public getEnvVar(name: string, hidden?: boolean): EnvVar | undefined {
    return this.getBaseEnvVar(name, hidden) ??
      this.getGlobalEnvVar(name, hidden);
  }

  /**
   * Get base environment variable by name.
   * @param name Name of the environment variable.
   * @param hidden Include hidden environment variable.
   */
  public getBaseEnvVar(name: string, hidden?: boolean): EnvVar | undefined {
    const envVar: EnvVar | undefined = this.envVars.find((env) =>
      env.names.indexOf(name) !== -1
    );

    return envVar && (hidden || !envVar.hidden) ? envVar : undefined;
  }

  /**
   * Get global environment variable by name.
   * @param name Name of the environment variable.
   * @param hidden Include hidden environment variable.
   */
  public getGlobalEnvVar(name: string, hidden?: boolean): EnvVar | undefined {
    if (!this._parent || this._noGlobals) {
      return;
    }

    const envVar: EnvVar | undefined = this._parent.getBaseEnvVar(
      name,
      hidden,
    );

    if (!envVar?.global) {
      return this._parent.getGlobalEnvVar(name, hidden);
    }

    return envVar;
  }

  /** Checks whether the command has examples or not. */
  public hasExamples(): boolean {
    return this.examples.length > 0;
  }

  /** Get all examples. */
  public getExamples(): Example[] {
    return this.examples;
  }

  /** Checks whether the command has an example with given name or not. */
  public hasExample(name: string): boolean {
    return !!this.getExample(name);
  }

  /** Get example with given name. */
  public getExample(name: string): Example | undefined {
    return this.examples.find((example) => example.name === name);
  }

  private getHelpOption(): Option | undefined {
    return this._helpOption ?? this._parent?.getHelpOption();
  }
}

function isUpgradeCommand(command: unknown): command is UpgradeCommandImpl {
  return command instanceof Command && "getLatestVersion" in command;
}

interface UpgradeCommandImpl {
  getLatestVersion(): Promise<string>;
}

interface DefaultOption {
  flags: string;
  desc?: string;
  opts?: OptionOptions;
}

type ActionOption = Option & { action: ActionHandler };

interface ParseContext extends ParseFlagsContext<Record<string, unknown>> {
  action?: ActionOption;
  env: Record<string, unknown>;
}

interface ParseOptionsOptions {
  stopEarly?: boolean;
  stopOnUnknown?: boolean;
  dotted?: boolean;
}

type TrimLeft<TValue extends string, TTrimValue extends string | undefined> =
  TValue extends `${TTrimValue}${infer TRest}` ? TRest
    : TValue;

type TrimRight<TValue extends string, TTrimValue extends string> =
  TValue extends `${infer TRest}${TTrimValue}` ? TRest
    : TValue;

type Lower<TValue extends string> = TValue extends Uppercase<TValue>
  ? Lowercase<TValue>
  : Uncapitalize<TValue>;

type CamelCase<TValue extends string> = TValue extends
  `${infer TPart}_${infer TRest}`
  ? `${Lower<TPart>}${Capitalize<CamelCase<TRest>>}`
  : TValue extends `${infer TPart}-${infer TRest}`
    ? `${Lower<TPart>}${Capitalize<CamelCase<TRest>>}`
  : Lower<TValue>;

type OneOf<TValue, TDefault> = TValue extends void ? TDefault : TValue;

type Merge<TLeft, TRight> = TLeft extends void ? TRight
  : TRight extends void ? TLeft
  : TLeft & TRight;

// type Merge<L, R> = L extends void ? R
//   : R extends void ? L
//   : Omit<L, keyof R> & R;

type MergeRecursive<TLeft, TRight> = TLeft extends void ? TRight
  : TRight extends void ? TLeft
  : TLeft & TRight;

type OptionalOrRequiredValue<TType extends string> =
  | `[${TType}]`
  | `<${TType}>`;
type RestValue = `...${string}` | `${string}...`;

/**
 * Rest args with list type and completions.
 *
 * - `[...name:type[]:completion]`
 * - `<...name:type[]:completion>`
 * - `[name...:type[]:completion]`
 * - `<name...:type[]:completion>`
 */
type RestArgsListTypeCompletion<TType extends string> = OptionalOrRequiredValue<
  `${RestValue}:${TType}[]:${string}`
>;

/**
 * Rest args with list type.
 *
 * - `[...name:type[]]`
 * - `<...name:type[]>`
 * - `[name...:type[]]`
 * - `<name...:type[]>`
 */
type RestArgsListType<TType extends string> = OptionalOrRequiredValue<
  `${RestValue}:${TType}[]`
>;

/**
 * Rest args with type and completions.
 *
 * - `[...name:type:completion]`
 * - `<...name:type:completion>`
 * - `[name...:type:completion]`
 * - `<name...:type:completion>`
 */
type RestArgsTypeCompletion<TType extends string> = OptionalOrRequiredValue<
  `${RestValue}:${TType}:${string}`
>;

/**
 * Rest args with type.
 *
 * - `[...name:type]`
 * - `<...name:type>`
 * - `[name...:type]`
 * - `<name...:type>`
 */
type RestArgsType<TType extends string> = OptionalOrRequiredValue<
  `${RestValue}:${TType}`
>;

/**
 * Rest args.
 * - `[...name]`
 * - `<...name>`
 * - `[name...]`
 * - `<name...>`
 */
type RestArgs = OptionalOrRequiredValue<
  `${RestValue}`
>;

/**
 * Single arg with list type and completions.
 *
 * - `[name:type[]:completion]`
 * - `<name:type[]:completion>`
 */
type SingleArgListTypeCompletion<TType extends string> =
  OptionalOrRequiredValue<
    `${string}:${TType}[]:${string}`
  >;

/**
 * Single arg with list type.
 *
 * - `[name:type[]]`
 * - `<name:type[]>`
 */
type SingleArgListType<TType extends string> = OptionalOrRequiredValue<
  `${string}:${TType}[]`
>;

/**
 * Single arg  with type and completion.
 *
 * - `[name:type:completion]`
 * - `<name:type:completion>`
 */
type SingleArgTypeCompletion<TType extends string> = OptionalOrRequiredValue<
  `${string}:${TType}:${string}`
>;

/**
 * Single arg with type.
 *
 * - `[name:type]`
 * - `<name:type>`
 */
type SingleArgType<TType extends string> = OptionalOrRequiredValue<
  `${string}:${TType}`
>;

/**
 * Single arg.
 *
 * - `[name]`
 * - `<name>`
 */
type SingleArg = OptionalOrRequiredValue<
  `${string}`
>;

type DefaultTypes = {
  number: NumberType;
  integer: IntegerType;
  string: StringType;
  boolean: BooleanType;
  file: FileType;
};

type ArgumentType<
  TArg extends string,
  TCustomTypes,
  TTypes = Merge<DefaultTypes, TCustomTypes>,
> = TArg extends RestArgsListTypeCompletion<infer Type>
  ? TTypes extends Record<Type, infer R> ? Array<Array<R>> : unknown
  : TArg extends RestArgsListType<infer Type>
    ? TTypes extends Record<Type, infer R> ? Array<Array<R>> : unknown
  : TArg extends RestArgsTypeCompletion<infer Type>
    ? TTypes extends Record<Type, infer R> ? Array<R> : unknown
  : TArg extends RestArgsType<infer Type>
    ? TTypes extends Record<Type, infer R> ? Array<R> : unknown
  : TArg extends RestArgs ? Array<string>
  : TArg extends SingleArgListTypeCompletion<infer Type>
    ? TTypes extends Record<Type, infer R> ? Array<R> : unknown
  : TArg extends SingleArgListType<infer Type>
    ? TTypes extends Record<Type, infer R> ? Array<R> : unknown
  : TArg extends SingleArgTypeCompletion<infer Type>
    ? TTypes extends Record<Type, infer R> ? R : unknown
  : TArg extends SingleArgType<infer Type>
    ? TTypes extends Record<Type, infer R> ? R : unknown
  : TArg extends SingleArg ? string
  : unknown;

type ArgumentTypes<TFlags extends string, T> = TFlags extends
  `${string} ${string}` ? TypedArguments<TFlags, T>
  : ArgumentType<TFlags, T>;

type GetArguments<TFlags extends string> = TFlags extends
  `-${string}=${infer RestFlags}` ? GetArguments<RestFlags>
  : TFlags extends `-${string} ${infer RestFlags}` ? GetArguments<RestFlags>
  : TFlags;

type OptionName<Name extends string> = Name extends "*" ? string
  : CamelCase<TrimRight<Name, ",">>;

type IsRequired<TRequired extends boolean | undefined, TDefault> =
  TRequired extends true ? true
    : TDefault extends undefined ? false
    : true;

type NegatableOption<
  TName extends string,
  TOptions,
  TDefault,
> = TDefault extends undefined
  ? OptionName<TName> extends keyof TOptions
    ? { [Key in OptionName<TName>]?: false }
  : { [Key in OptionName<TName>]: boolean }
  : { [Key in OptionName<TName>]: NonNullable<TDefault> | false };

type BooleanOption<
  TName extends string,
  TOptions,
  TRequired extends boolean | undefined = undefined,
  TDefault = undefined,
> = TName extends `no-${infer Name}` ? NegatableOption<Name, TOptions, TDefault>
  : TName extends `${infer Name}.${infer Rest}` ? (TRequired extends true ? {
        [Key in OptionName<Name>]: BooleanOption<
          Rest,
          TOptions,
          TRequired,
          TDefault
        >;
      }
      : {
        [Key in OptionName<Name>]?: BooleanOption<
          Rest,
          TOptions,
          TRequired,
          TDefault
        >;
      })
  : (TRequired extends true ? { [Key in OptionName<TName>]: true | TDefault }
    : { [Key in OptionName<TName>]?: true | TDefault });

type ValueOption<
  TName extends string,
  TRestFlags extends string,
  TTypes,
  TRequired extends boolean | undefined = undefined,
  TDefault = undefined,
> = TName extends `${infer Name}.${infer RestName}`
  ? (TRequired extends true ? {
      [Key in OptionName<Name>]: ValueOption<
        RestName,
        TRestFlags,
        TTypes,
        TRequired,
        TDefault
      >;
    }
    : {
      [Key in OptionName<Name>]?: ValueOption<
        RestName,
        TRestFlags,
        TTypes,
        TRequired,
        TDefault
      >;
    })
  : (TRequired extends true ? {
      [Key in OptionName<TName>]: GetArguments<TRestFlags> extends `[${string}]`
        ? 
          | NonNullable<TDefault>
          | true
          | ArgumentType<GetArguments<TRestFlags>, TTypes>
        : 
          | NonNullable<TDefault>
          | ArgumentType<GetArguments<TRestFlags>, TTypes>;
    }
    : {
      [Key in OptionName<TName>]?: GetArguments<TRestFlags> extends
        `[${string}]` ? 
          | NonNullable<TDefault>
          | true
          | ArgumentType<GetArguments<TRestFlags>, TTypes>
        : 
          | NonNullable<TDefault>
          | ArgumentType<GetArguments<TRestFlags>, TTypes>;
    });

type ValuesOption<
  TName extends string,
  TRestFlags extends string,
  TTypes,
  TRequired extends boolean | undefined = undefined,
  TDefault = undefined,
> = TName extends `${infer Name}.${infer RestName}`
  ? (TRequired extends true ? {
      [Key in OptionName<Name>]: ValuesOption<
        RestName,
        TRestFlags,
        TTypes,
        TRequired,
        TDefault
      >;
    }
    : {
      [Key in OptionName<Name>]?: ValuesOption<
        RestName,
        TRestFlags,
        TTypes,
        TRequired,
        TDefault
      >;
    })
  : (TRequired extends true ? {
      [Key in OptionName<TName>]: GetArguments<TRestFlags> extends `[${string}]`
        ? 
          | NonNullable<TDefault>
          | true
          | ArgumentTypes<GetArguments<TRestFlags>, TTypes>
        : 
          | NonNullable<TDefault>
          | ArgumentTypes<GetArguments<TRestFlags>, TTypes>;
    }
    : {
      [Key in OptionName<TName>]?: GetArguments<TRestFlags> extends
        `[${string}]` ? 
          | NonNullable<TDefault>
          | true
          | ArgumentTypes<GetArguments<TRestFlags>, TTypes>
        : 
          | NonNullable<TDefault>
          | ArgumentTypes<GetArguments<TRestFlags>, TTypes>;
    });

type MapValue<TOptions, TMappedOptions, TCollect = undefined> =
  TMappedOptions extends undefined ? TCollect extends true ? {
        [Key in keyof TOptions]: TOptions[Key] extends
          (Record<string, unknown> | undefined)
          ? MapValue<TOptions[Key], TMappedOptions>
          : Array<NonNullable<TOptions[Key]>>;
      }
    : TOptions
    : {
      [Key in keyof TOptions]: TOptions[Key] extends
        (Record<string, unknown> | undefined)
        ? MapValue<TOptions[Key], TMappedOptions>
        : TMappedOptions;
    };

type GetOptionName<TFlags> = TFlags extends `${string}--${infer Name}=${string}`
  ? TrimRight<Name, ",">
  : TFlags extends `${string}--${infer Name} ${string}` ? TrimRight<Name, ",">
  : TFlags extends `${string}--${infer Name}` ? Name
  : TFlags extends `-${infer Name}=${string}` ? TrimRight<Name, ",">
  : TFlags extends `-${infer Name} ${string}` ? TrimRight<Name, ",">
  : TFlags extends `-${infer Name}` ? Name
  : unknown;

type MergeOptions<
  TFlags,
  TOptions,
  TMappedOptions,
  TName = GetOptionName<TFlags>,
> = TName extends `no-${string}` ? Spread<TOptions, TMappedOptions>
  : TName extends `${string}.${string}`
    ? MergeRecursive<TOptions, TMappedOptions>
  : Merge<TOptions, TMappedOptions>;

// type MergeOptions<T, CO, O, N = GetOptionName<T>> = N extends `no-${string}`
//   ? Spread<CO, O>
//   : N extends `${infer Name}.${infer Child}`
//     ? (OptionName<Name> extends keyof Merge<CO, O>
//       ? OptionName<Child> extends
//         keyof NonNullable<Merge<CO, O>[OptionName<Name>]> ? SpreadTwo<CO, O>
//       : MergeRecursive<CO, O>
//       : MergeRecursive<CO, O>)
//   : Merge<CO, O>;

type TypedOption<
  TFlags extends string,
  TOptions,
  TTypes,
  TRequired extends boolean | undefined = undefined,
  TDefault = undefined,
> = number extends TTypes ? any
  : TFlags extends `${string}--${infer Name}=${infer TRestFlags}`
    ? ValuesOption<
      Name,
      TRestFlags,
      TTypes,
      IsRequired<TRequired, TDefault>,
      TDefault
    >
  : TFlags extends `${string}--${infer Name} ${infer TRestFlags}`
    ? ValuesOption<
      Name,
      TRestFlags,
      TTypes,
      IsRequired<TRequired, TDefault>,
      TDefault
    >
  : TFlags extends `${string}--${infer Name}`
    ? BooleanOption<Name, TOptions, IsRequired<TRequired, TDefault>, TDefault>
  : TFlags extends `-${infer Name}=${infer TRestFlags}` ? ValuesOption<
      Name,
      TRestFlags,
      TTypes,
      IsRequired<TRequired, TDefault>,
      TDefault
    >
  : TFlags extends `-${infer Name} ${infer TRestFlags}` ? ValuesOption<
      Name,
      TRestFlags,
      TTypes,
      IsRequired<TRequired, TDefault>,
      TDefault
    >
  : TFlags extends `-${infer Name}`
    ? BooleanOption<Name, TOptions, IsRequired<TRequired, TDefault>, TDefault>
  : Record<string, unknown>;

type TypedArguments<TArgs extends string, TTypes> = number extends TTypes ? any
  : TArgs extends `${infer TArg} ${infer TRestArgs}`
    ? TArg extends `[${string}]`
      ? [ArgumentType<TArg, TTypes>?, ...TypedArguments<TRestArgs, TTypes>]
    : [ArgumentType<TArg, TTypes>, ...TypedArguments<TRestArgs, TTypes>]
  : TArgs extends `${string}...${string}` ? [
      ...ArgumentType<TArgs, TTypes> extends Array<infer TValue>
        ? TArgs extends `[${string}]` ? Array<TValue>
        : [TValue, ...Array<TValue>]
        : never,
    ]
  : TArgs extends `[${string}]` ? [ArgumentType<TArgs, TTypes>?]
  : [ArgumentType<TArgs, TTypes>];

type TypedCommandArguments<TNameAndArguments extends string, TTypes> =
  number extends TTypes ? any
    : TNameAndArguments extends `${string} ${infer TFlags}`
      ? TypedArguments<TFlags, TTypes>
    : [];

type TypedEnv<
  TNameAndValue extends string,
  TPrefix extends string | undefined,
  TOptions,
  TTypes,
  TRequired extends boolean | undefined = undefined,
  TDefault = undefined,
> = number extends TTypes ? any
  : TNameAndValue extends `${infer Name}=${infer Rest}`
    ? ValueOption<TrimLeft<Name, TPrefix>, Rest, TTypes, TRequired, TDefault>
  : TNameAndValue extends `${infer Name} ${infer Rest}`
    ? ValueOption<TrimLeft<Name, TPrefix>, Rest, TTypes, TRequired, TDefault>
  : TNameAndValue extends `${infer Name}`
    ? BooleanOption<TrimLeft<Name, TPrefix>, TOptions, TRequired, TDefault>
  : Record<string, unknown>;

type TypedType<
  TName extends string,
  THandler extends TypeOrTypeHandler<unknown>,
> = { [Name in TName]: THandler };

type RequiredKeys<TRecord> = {
  // deno-lint-ignore ban-types
  [Key in keyof TRecord]-?: {} extends Pick<TRecord, Key> ? never : Key;
}[keyof TRecord];

type OptionalKeys<TRecord> = {
  // deno-lint-ignore ban-types
  [Key in keyof TRecord]-?: {} extends Pick<TRecord, Key> ? Key : never;
}[keyof TRecord];

type SpreadRequiredProperties<
  TTarget,
  TSource,
  TKeys extends keyof TTarget & keyof TSource,
> = {
  [Key in TKeys]:
    | Exclude<TTarget[Key], undefined>
    | Exclude<TSource[Key], undefined>;
};

type SpreadOptionalProperties<
  TTarget,
  TSource,
  TKeys extends keyof TTarget & keyof TSource,
> = {
  [Key in TKeys]?: TTarget[Key] | TSource[Key];
};

/** Merge types of two objects. */
type Spread<TTarget, TSource> = TTarget extends void ? TSource
  : TSource extends void ? TTarget
  // Properties in L that don't exist in R.
  : 
    & Omit<TTarget, keyof TSource>
    // Properties in R that don't exist in L.
    & Omit<TSource, keyof TTarget>
    // Required properties in R that exist in L.
    & SpreadRequiredProperties<
      TTarget,
      TSource,
      RequiredKeys<TSource> & keyof TTarget
    >
    // Required properties in L that exist in R.
    & SpreadRequiredProperties<
      TTarget,
      TSource,
      RequiredKeys<TTarget> & keyof TSource
    >
    // Optional properties in L and R.
    & SpreadOptionalProperties<
      TTarget,
      TSource,
      OptionalKeys<TTarget> & OptionalKeys<TSource>
    >;

type ValueOf<TValue> = TValue extends Record<string, infer V> ? ValueOf<V>
  : TValue;
