// deno-lint-ignore-file no-explicit-any
import {
  UnknownType,
  ValidationError as FlagsValidationError,
} from "../flags/_errors.ts";
import { MissingRequiredEnvVar } from "./_errors.ts";
import { parseFlags } from "../flags/flags.ts";
import type { IDefaultValue, IFlagsResult } from "../flags/types.ts";
import {
  getDescription,
  parseArgumentsDefinition,
  splitArguments,
} from "./_utils.ts";
import { blue, bold, red, yellow } from "./deps.ts";
import {
  CommandExecutableNotFound,
  CommandNotFound,
  DefaultCommandNotFound,
  DuplicateCommandAlias,
  DuplicateCommandName,
  DuplicateCompletion,
  DuplicateEnvironmentVariable,
  DuplicateExample,
  DuplicateOptionName,
  DuplicateType,
  EnvironmentVariableOptionalValue,
  EnvironmentVariableSingleValue,
  EnvironmentVariableVariadicValue,
  MissingArgument,
  MissingArguments,
  MissingCommandName,
  NoArgumentsAllowed,
  TooManyArguments,
  UnknownCommand,
  ValidationError,
} from "./_errors.ts";
import { BooleanType } from "./types/boolean.ts";
import { FileType } from "./types/file.ts";
import { NumberType } from "./types/number.ts";
import { StringType } from "./types/string.ts";
import { Type } from "./type.ts";
import { HelpGenerator } from "./help/_help_generator.ts";
import type { HelpOptions } from "./help/_help_generator.ts";
import type {
  IAction,
  IArgument,
  ICommandGlobalOption,
  ICommandOption,
  ICompleteHandler,
  ICompleteOptions,
  ICompletion,
  IDescription,
  IEnvVar,
  IEnvVarOptions,
  IEnvVarValueHandler,
  IExample,
  IFlagValueHandler,
  IGlobalEnvVarOptions,
  IHelpHandler,
  IOption,
  IParseResult,
  IType,
  ITypeInfo,
  ITypeOptions,
  IVersionHandler,
  MapTypes,
  TypeOrTypeHandler,
} from "./types.ts";
import { IntegerType } from "./types/integer.ts";
import { underscoreToCamelCase } from "../flags/_utils.ts";

export class Command<
  CPG extends Record<string, any> | void = void,
  CPT extends Record<string, any> | void = CPG extends number ? any : void,
  CO extends Record<string, any> | void = CPG extends number ? any : void,
  CA extends Array<unknown> = CPG extends number ? any : [],
  CG extends Record<string, any> | void = CPG extends number ? any : void,
  CT extends Record<string, any> | void = CPG extends number ? any : {
    number: number;
    integer: number;
    string: string;
    boolean: boolean;
    file: string;
  },
  CGT extends Record<string, any> | void = CPG extends number ? any : void,
  CP extends Command<any> | undefined = CPG extends number ? any : undefined,
> {
  private types: Map<string, IType> = new Map();
  private rawArgs: Array<string> = [];
  private literalArgs: Array<string> = [];
  // @TODO: get script name: https://github.com/denoland/deno/pull/5034
  // private name: string = location.pathname.split( '/' ).pop() as string;
  private _name = "COMMAND";
  private _parent?: CP;
  private _globalParent?: Command<any>;
  private ver?: IVersionHandler;
  private desc: IDescription = "";
  private _usage?: string;
  private fn?: IAction;
  private options: Array<IOption> = [];
  private commands: Map<string, Command<any>> = new Map();
  private examples: Array<IExample> = [];
  private envVars: Array<IEnvVar> = [];
  private aliases: Array<string> = [];
  private completions: Map<string, ICompletion> = new Map();
  private cmd: Command<any> = this;
  private argsDefinition?: string;
  private isExecutable = false;
  private throwOnError = false;
  private _allowEmpty = false;
  private _stopEarly = false;
  private defaultCommand?: string;
  private _useRawArgs = false;
  private args: Array<IArgument> = [];
  private isHidden = false;
  private isGlobal = false;
  private hasDefaults = false;
  private _versionOption?: IDefaultOption | false;
  private _helpOption?: IDefaultOption | false;
  private _help?: IHelpHandler;
  private _shouldExit?: boolean;
  private _meta: Record<string, string> = {};
  private _groupName?: string;

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
    opts?: ICommandOption<Partial<CO>, CA, CG, CPG, CT, CGT, CPT, CP> & {
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
    opts?: ICommandOption<CO, CA, CG, CPG, CT, CGT, CPT, CP>,
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
    opts?: IAction<CO, CA, CG, CPG, CT, CGT, CPT, CP>,
  ): this;
  public versionOption(
    flags: string | false,
    desc?: string,
    opts?:
      | IAction<CO, CA, CG, CPG, CT, CGT, CPT, CP>
      | ICommandOption<CO, CA, CG, CPG, CT, CGT, CPT, CP>
      | ICommandOption<Partial<CO>, CA, CG, CPG, CT, CGT, CPT, CP> & {
        global: true;
      },
  ): this {
    this._versionOption = flags === false ? flags : {
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
    opts?: ICommandOption<Partial<CO>, CA, CG, CPG, CT, CGT, CPT, CP> & {
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
    opts?: ICommandOption<CO, CA, CG, CPG, CT, CGT, CPT, CP>,
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
    opts?: IAction<CO, CA, CG, CPG, CT, CGT, CPT, CP>,
  ): this;
  public helpOption(
    flags: string | false,
    desc?: string,
    opts?:
      | IAction<CO, CA, CG, CPG, CT, CGT, CPT, CP>
      | ICommandOption<CO, CA, CG, CPG, CT, CGT, CPT, CP>
      | ICommandOption<Partial<CO>, CA, CG, CPG, CT, CGT, CPT, CP> & {
        global: true;
      },
  ): this {
    this._helpOption = flags === false ? flags : {
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
    C extends Command<
      G | void | undefined,
      T | void | undefined,
      Record<string, any> | void,
      Array<unknown>,
      Record<string, any> | void,
      Record<string, any> | void,
      Record<string, any> | void,
      OneOf<CP, this> | undefined
    >,
    G extends (CP extends Command<any> ? CPG : Merge<CPG, CG>),
    T extends (CP extends Command<any> ? CPT : Merge<CPT, CT>),
  >(
    name: string,
    cmd: C,
    override?: boolean,
  ): C extends Command<
    any,
    any,
    infer Options,
    infer Arguments,
    infer GlobalOptions,
    infer Types,
    infer GlobalTypes,
    any
  > ? Command<
    G,
    T,
    Options,
    Arguments,
    GlobalOptions,
    Types,
    GlobalTypes,
    OneOf<CP, this>
  >
    : never;

  /**
   * Add new sub-command.
   * @param name      Command definition. E.g: `my-command <input-file:string> <output-file:string>`
   * @param desc      The description of the new child command.
   * @param override  Override existing child command.
   */
  public command<
    N extends string,
    A extends TypedCommandArguments<
      N,
      CP extends Command<any> ? CPT : Merge<CPT, CGT>
    >,
  >(
    name: N,
    desc?: string,
    override?: boolean,
  ): CPG extends number ? Command<any> : Command<
    CP extends Command<any> ? CPG : Merge<CPG, CG>,
    CP extends Command<any> ? CPT : Merge<CPT, CGT>,
    void,
    A,
    void,
    void,
    void,
    OneOf<CP, this>
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
      throw new MissingCommandName();
    }

    if (this.getBaseCommand(name, true)) {
      if (!override) {
        throw new DuplicateCommandName(name);
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
      throw new DuplicateCommandAlias(alias);
    }

    this.cmd.aliases.push(alias);

    return this;
  }

  /** Reset internal command reference to main command. */
  public reset(): OneOf<CP, this> {
    this._groupName = undefined;
    this.cmd = this;
    return this as OneOf<CP, this>;
  }

  /**
   * Set internal command pointer to child command with given name.
   * @param name The name of the command to select.
   */
  public select<
    O extends Record<string, unknown> | void = any,
    A extends Array<unknown> = any,
    G extends Record<string, unknown> | void = any,
  >(name: string): Command<CPG, CPT, O, A, G, CT, CGT, CP> {
    const cmd = this.getBaseCommand(name, true);

    if (!cmd) {
      throw new CommandNotFound(name, this.getBaseCommands(true));
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
      | IVersionHandler<Partial<CO>, Partial<CA>, CG, CPG, CT, CGT, CPT, CP>,
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
      | IHelpHandler<Partial<CO>, Partial<CA>, CG, CPG>
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
    description: IDescription<CO, CA, CG, CPG, CT, CGT, CPT, CP>,
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
    A extends TypedArguments<N, Merge<CPT, Merge<CGT, CT>>>,
    N extends string = string,
  >(
    args: N,
  ): Command<CPG, CPT, CO, A, CG, CT, CGT, CP> {
    this.cmd.argsDefinition = args;
    return this as Command<any>;
  }

  /**
   * Set command callback method.
   * @param fn Command action handler.
   */
  public action(fn: IAction<CO, CA, CG, CPG, CT, CGT, CPT, CP>): this {
    this.cmd.fn = fn;
    return this;
  }

  /**
   * Don't throw an error if the command was called without arguments.
   * @param allowEmpty Enable/disable allow empty.
   */
  public allowEmpty(allowEmpty = true): this {
    this.cmd._allowEmpty = allowEmpty;
    return this;
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
  ): Command<void, void, void, Array<string>, void, void, void, CP> {
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
    H extends TypeOrTypeHandler<unknown>,
    N extends string = string,
  >(
    name: N,
    handler: H,
    options?: Omit<ITypeOptions, "global">,
  ): Command<
    CPG,
    CPT,
    CO,
    CA,
    CG,
    CT,
    Merge<CGT, TypedType<N, H>>,
    CP
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
    H extends TypeOrTypeHandler<unknown>,
    N extends string = string,
  >(
    name: N,
    handler: H,
    options?: ITypeOptions,
  ): Command<
    CPG,
    CPT,
    CO,
    CA,
    CG,
    Merge<CT, TypedType<N, H>>,
    CGT,
    CP
  > {
    if (this.cmd.types.get(name) && !options?.override) {
      throw new DuplicateType(name);
    }

    this.cmd.types.set(name, { ...options, name, handler });

    if (
      handler instanceof Type &&
      (typeof handler.complete !== "undefined" ||
        typeof handler.values !== "undefined")
    ) {
      const completeHandler: ICompleteHandler = (
        cmd: Command,
        parent?: Command,
      ) => handler.complete?.(cmd, parent) || [];
      this.complete(name, completeHandler, options);
    }

    return this as Command<any>;
  }

  public globalComplete(
    name: string,
    complete: ICompleteHandler,
    options?: Omit<ICompleteOptions, "global">,
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
    complete: ICompleteHandler<
      Partial<CO>,
      Partial<CA>,
      CG,
      CPG,
      CT,
      CGT,
      CPT,
      any
    >,
    options: ICompleteOptions & { global: boolean },
  ): this;
  public complete(
    name: string,
    complete: ICompleteHandler<CO, CA, CG, CPG, CT, CGT, CPT, CP>,
    options?: ICompleteOptions,
  ): this;
  complete(
    name: string,
    complete:
      | ICompleteHandler<CO, CA, CG, CPG, CT, CGT, CPT, CP>
      | ICompleteHandler<
        Partial<CO>,
        Partial<CA>,
        CG,
        CPG,
        CT,
        CGT,
        CPT,
        any
      >,
    options?: ICompleteOptions,
  ): this {
    if (this.cmd.completions.has(name) && !options?.override) {
      throw new DuplicateCompletion(name);
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

  /** Check whether the command should throw errors or exit. */
  protected shouldThrowErrors(): boolean {
    return this.cmd.throwOnError || !!this.cmd._parent?.shouldThrowErrors();
  }

  /** Check whether the command should exit after printing help or version. */
  protected shouldExit(): boolean {
    return this.cmd._shouldExit ?? this.cmd._parent?.shouldExit() ?? true;
  }

  public globalOption<
    F extends string,
    G extends TypedOption<F, CO, Merge<CPT, Merge<CGT, CT>>, R, D>,
    MG extends MapValue<G, V, C>,
    R extends ICommandOption["required"] = undefined,
    C extends ICommandOption["collect"] = undefined,
    D = undefined,
    V = undefined,
  >(
    flags: F,
    desc: string,
    opts?:
      | Omit<
        ICommandGlobalOption<
          Partial<CO>,
          CA,
          MergeOptions<F, CG, G>,
          CPG,
          CT,
          CGT,
          CPT,
          CP
        >,
        "value"
      >
        & {
          default?: IDefaultValue<D>;
          required?: R;
          collect?: C;
          value?: IFlagValueHandler<MapTypes<ValueOf<G>>, V>;
        }
      | IFlagValueHandler<MapTypes<ValueOf<G>>, V>,
  ): Command<
    CPG,
    CPT,
    CO,
    CA,
    MergeOptions<F, CG, MG>,
    CT,
    CGT,
    CP
  > {
    if (typeof opts === "function") {
      return this.option(
        flags,
        desc,
        { value: opts, global: true } as ICommandOption,
      ) as Command<any>;
    }
    return this.option(
      flags,
      desc,
      { ...opts, global: true } as ICommandOption,
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
    F extends string,
    G extends TypedOption<F, CO, Merge<CPT, Merge<CGT, CT>>, R, D>,
    MG extends MapValue<G, V, C>,
    R extends ICommandOption["required"] = undefined,
    C extends ICommandOption["collect"] = undefined,
    D = undefined,
    V = undefined,
  >(
    flags: F,
    desc: string,
    opts:
      | Omit<
        ICommandOption<
          Partial<CO>,
          CA,
          MergeOptions<F, CG, G>,
          CPG,
          CT,
          CGT,
          CPT,
          CP
        >,
        "value"
      >
        & {
          global: true;
          default?: IDefaultValue<D>;
          required?: R;
          collect?: C;
          value?: IFlagValueHandler<MapTypes<ValueOf<G>>, V>;
        }
      | IFlagValueHandler<MapTypes<ValueOf<G>>, V>,
  ): Command<
    CPG,
    CPT,
    CO,
    CA,
    MergeOptions<F, CG, MG>,
    CT,
    CGT,
    CP
  >;

  public option<
    F extends string,
    O extends TypedOption<F, CO, Merge<CPT, Merge<CGT, CT>>, R, D>,
    MO extends MapValue<O, V, C>,
    R extends ICommandOption["required"] = undefined,
    C extends ICommandOption["collect"] = undefined,
    D = undefined,
    V = undefined,
  >(
    flags: F,
    desc: string,
    opts?:
      | Omit<
        ICommandOption<MergeOptions<F, CO, MO>, CA, CG, CPG, CT, CGT, CPT, CP>,
        "value"
      >
        & {
          default?: IDefaultValue<D>;
          required?: R;
          collect?: C;
          value?: IFlagValueHandler<MapTypes<ValueOf<O>>, V>;
        }
      | IFlagValueHandler<MapTypes<ValueOf<O>>, V>,
  ): Command<
    CPG,
    CPT,
    MergeOptions<F, CO, MO>,
    CA,
    CG,
    CT,
    CGT,
    CP
  >;

  public option(
    flags: string,
    desc: string,
    opts?: ICommandOption | IFlagValueHandler,
  ): Command<any> {
    if (typeof opts === "function") {
      return this.option(flags, desc, { value: opts });
    }

    const result = splitArguments(flags);

    const args: IArgument[] = result.typeDefinition
      ? parseArgumentsDefinition(result.typeDefinition)
      : [];

    const option: IOption = {
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
          throw new DuplicateOptionName(name);
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
      throw new DuplicateExample(name);
    }

    this.cmd.examples.push({ name, description });

    return this;
  }

  public globalEnv<
    N extends string,
    G extends TypedEnv<N, P, CO, Merge<CPT, Merge<CGT, CT>>, R>,
    MG extends MapValue<G, V>,
    R extends IEnvVarOptions["required"] = undefined,
    P extends IEnvVarOptions["prefix"] = undefined,
    V = undefined,
  >(
    name: N,
    description: string,
    options?: Omit<IGlobalEnvVarOptions, "value"> & {
      required?: R;
      prefix?: P;
      value?: IEnvVarValueHandler<MapTypes<ValueOf<G>>, V>;
    },
  ): Command<CPG, CPT, CO, CA, Merge<CG, MG>, CT, CGT, CP> {
    return this.env(
      name,
      description,
      { ...options, global: true } as IEnvVarOptions,
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
    G extends TypedEnv<N, P, CO, Merge<CPT, Merge<CGT, CT>>, R>,
    MG extends MapValue<G, V>,
    R extends IEnvVarOptions["required"] = undefined,
    P extends IEnvVarOptions["prefix"] = undefined,
    V = undefined,
  >(
    name: N,
    description: string,
    options: Omit<IEnvVarOptions, "value"> & {
      global: true;
      required?: R;
      prefix?: P;
      value?: IEnvVarValueHandler<MapTypes<ValueOf<G>>, V>;
    },
  ): Command<CPG, CPT, CO, CA, Merge<CG, MG>, CT, CGT, CP>;

  public env<
    N extends string,
    O extends TypedEnv<N, P, CO, Merge<CPT, Merge<CGT, CT>>, R>,
    MO extends MapValue<O, V>,
    R extends IEnvVarOptions["required"] = undefined,
    P extends IEnvVarOptions["prefix"] = undefined,
    V = undefined,
  >(
    name: N,
    description: string,
    options?: Omit<IEnvVarOptions, "value"> & {
      required?: R;
      prefix?: P;
      value?: IEnvVarValueHandler<MapTypes<ValueOf<O>>, V>;
    },
  ): Command<CPG, CPT, Merge<CO, MO>, CA, CG, CT, CGT, CP>;

  public env(
    name: string,
    description: string,
    options?: IEnvVarOptions,
  ): Command<any> {
    const result = splitArguments(name);

    if (!result.typeDefinition) {
      result.typeDefinition = "<value:boolean>";
    }

    if (result.flags.some((envName) => this.cmd.getBaseEnvVar(envName, true))) {
      throw new DuplicateEnvironmentVariable(name);
    }

    const details: IArgument[] = parseArgumentsDefinition(
      result.typeDefinition,
    );

    if (details.length > 1) {
      throw new EnvironmentVariableSingleValue(name);
    } else if (details.length && details[0].optionalValue) {
      throw new EnvironmentVariableOptionalValue(name);
    } else if (details.length && details[0].variadic) {
      throw new EnvironmentVariableVariadicValue(name);
    }

    this.cmd.envVars.push({
      name: result.flags[0],
      names: result.flags,
      description,
      type: details[0].type,
      details: details.shift() as IArgument,
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
  public async parse(
    args: string[] = Deno.args,
  ): Promise<
    CP extends Command<any> ? IParseResult<
      Record<string, unknown>,
      Array<unknown>,
      Record<string, unknown>,
      Record<string, unknown>,
      Record<string, unknown>,
      Record<string, unknown>,
      Record<string, unknown>,
      undefined
    >
      : IParseResult<
        MapTypes<CO>,
        MapTypes<CA>,
        MapTypes<CG>,
        MapTypes<CPG>,
        CT,
        CGT,
        CPT,
        CP
      >
  > {
    try {
      this.reset();
      this.registerDefaults();
      this.rawArgs = args;

      if (args.length > 0) {
        const subCommand = this.getCommand(args[0], true);
        if (subCommand) {
          subCommand._globalParent = this;
          return subCommand.parse(
            this.rawArgs.slice(1),
          ) as any;
        }
      }

      if (this.isExecutable) {
        await this.executeExecutable(this.rawArgs);
        return {
          options: {},
          args: [],
          cmd: this,
          literal: [],
        } as any;
      } else if (this._useRawArgs) {
        const env: Record<string, unknown> = await this.parseEnvVars();
        return this.execute(env, ...this.rawArgs) as any;
      } else {
        const env: Record<string, unknown> = await this.parseEnvVars();
        const { actionOption, flags, unknown, literal } = this
          .parseFlags(
            this.rawArgs,
            env,
          );

        this.literalArgs = literal;

        const options: Record<string, unknown> = { ...env, ...flags };
        const params = this.parseArguments(unknown, options);

        if (actionOption) {
          await actionOption.action.call(this, options, ...params);
          if (actionOption.standalone) {
            return {
              options,
              args: params,
              cmd: this,
              literal: this.literalArgs,
            } as any;
          }
        }

        return this.execute(options, ...params) as any;
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw this.error(error);
      } else {
        throw this.error(new Error(`[non-error-thrown] ${error}`));
      }
    }
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

    if (this._versionOption !== false && (this._versionOption || this.ver)) {
      this.option(
        this._versionOption?.flags || "-V, --version",
        this._versionOption?.desc ||
          "Show the version number for this program.",
        {
          standalone: true,
          prepend: true,
          action: async function () {
            const long = this.getRawArgs().includes(`--${versionOption.name}`);
            if (long) {
              await this.checkVersion();
              this.showLongVersion();
            } else {
              this.showVersion();
            }
            this.exit();
          },
          ...(this._versionOption?.opts ?? {}),
        },
      );
      const versionOption = this.options[0];
    }

    if (this._helpOption !== false) {
      this.option(
        this._helpOption?.flags || "-h, --help",
        this._helpOption?.desc || "Show this help.",
        {
          standalone: true,
          global: true,
          prepend: true,
          action: async function () {
            const long = this.getRawArgs().includes(`--${helpOption.name}`);
            await this.checkVersion();
            this.showHelp({ long });
            this.exit();
          },
          ...(this._helpOption?.opts ?? {}),
        },
      );
      const helpOption = this.options[0];
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
  ): Promise<IParseResult> {
    if (this.fn) {
      await this.fn(options, ...args);
    } else if (this.defaultCommand) {
      const cmd = this.getCommand(this.defaultCommand, true);

      if (!cmd) {
        throw new DefaultCommandNotFound(
          this.defaultCommand,
          this.getCommands(),
        );
      }

      cmd._globalParent = this;
      await cmd.execute(options, ...args);
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
        throw new CommandExecutableNotFound(command);
      }
      throw error;
    }
  }

  /**
   * Parse raw command line arguments.
   * @param args Raw command line arguments.
   */
  protected parseFlags(
    args: string[],
    env: Record<string, unknown>,
  ): IFlagsResult & { actionOption?: IOption & { action: IAction } } {
    try {
      let actionOption: IOption & { action: IAction } | undefined;
      const result = parseFlags(args, {
        stopEarly: this._stopEarly,
        allowEmpty: this._allowEmpty,
        flags: this.getOptions(true),
        ignoreDefaults: env,
        parse: (type: ITypeInfo) => this.parseType(type),
        option: (option: IOption) => {
          if (!actionOption && option.action) {
            actionOption = option as IOption & { action: IAction };
          }
        },
      });
      return { ...result, actionOption };
    } catch (error) {
      if (error instanceof FlagsValidationError) {
        throw new ValidationError(error.message);
      }
      throw error;
    }
  }

  /** Parse argument type. */
  protected parseType(type: ITypeInfo): unknown {
    const typeSettings: IType | undefined = this.getType(type.type);

    if (!typeSettings) {
      throw new UnknownType(
        type.type,
        this.getTypes().map((type) => type.name),
      );
    }

    return typeSettings.handler instanceof Type
      ? typeSettings.handler.parse(type)
      : typeSettings.handler(type);
  }

  /** Validate environment variables. */
  protected async parseEnvVars(): Promise<Record<string, unknown>> {
    const envVars = this.getEnvVars(true);
    const result: Record<string, unknown> = {};

    if (!envVars.length) {
      return result;
    }

    const hasEnvPermissions = (await Deno.permissions.query({
      name: "env",
    })).state === "granted";

    for (const env of envVars) {
      const name = hasEnvPermissions && env.names.find(
        (name: string) => !!Deno.env.get(name),
      );

      if (name) {
        const propertyName = underscoreToCamelCase(
          env.prefix
            ? env.names[0].replace(new RegExp(`^${env.prefix}`), "")
            : env.names[0],
        );

        if (env.details.list) {
          const values = Deno.env.get(name)
            ?.split(env.details.separator ?? ",") ?? [""];

          result[propertyName] = values.map((value) =>
            this.parseType({
              label: "Environment variable",
              type: env.type,
              name,
              value,
            })
          );
        } else {
          result[propertyName] = this.parseType({
            label: "Environment variable",
            type: env.type,
            name,
            value: Deno.env.get(name) ?? "",
          });
        }

        if (env.value && typeof result[propertyName] !== "undefined") {
          result[propertyName] = env.value(result[propertyName]);
        }
      } else if (env.required) {
        throw new MissingRequiredEnvVar(env);
      }
    }

    return result;
  }

  /**
   * Parse command-line arguments.
   * @param args  Raw command line arguments.
   * @param flags Parsed command line options.
   */
  protected parseArguments(args: string[], flags: Record<string, unknown>): CA {
    const params: Array<unknown> = [];

    // remove array reference
    args = args.slice(0);

    if (!this.hasArguments()) {
      if (args.length) {
        if (this.hasCommands(true)) {
          throw new UnknownCommand(args[0], this.getCommands());
        } else {
          throw new NoArgumentsAllowed(this.getPath());
        }
      }
    } else {
      if (!args.length) {
        const required = this.getArguments()
          .filter((expectedArg) => !expectedArg.optionalValue)
          .map((expectedArg) => expectedArg.name);

        if (required.length) {
          const flagNames: string[] = Object.keys(flags);
          const hasStandaloneOption = !!flagNames.find((name) =>
            this.getOption(name, true)?.standalone
          );

          if (!hasStandaloneOption) {
            throw new MissingArguments(required);
          }
        }
      } else {
        for (const expectedArg of this.getArguments()) {
          if (!args.length) {
            if (expectedArg.optionalValue) {
              break;
            }
            throw new MissingArgument(`Missing argument: ${expectedArg.name}`);
          }

          let arg: unknown;

          if (expectedArg.variadic) {
            arg = args.splice(0, args.length)
              .map((value) =>
                this.parseType({
                  label: "Argument",
                  type: expectedArg.type,
                  name: expectedArg.name,
                  value,
                })
              );
          } else {
            arg = this.parseType({
              label: "Argument",
              type: expectedArg.type,
              name: expectedArg.name,
              value: args.shift() as string,
            });
          }

          if (typeof arg !== "undefined") {
            params.push(arg);
          }
        }

        if (args.length) {
          throw new TooManyArguments(args);
        }
      }
    }

    return params as CA;
  }

  /**
   * Handle error. If `throwErrors` is enabled the error will be returned,
   * otherwise a formatted error message will be printed and `Deno.exit(1)`
   * will be called.
   * @param error Error to handle.
   */
  protected error(error: Error): Error {
    if (this.shouldThrowErrors() || !(error instanceof ValidationError)) {
      return error;
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
  public getParent(): CP {
    return this._parent as CP;
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
  public getArgument(name: string): IArgument | undefined {
    return this.getArguments().find((arg) => arg.name === name);
  }

  /** Get arguments. */
  public getArguments(): IArgument[] {
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
  private getVersionHandler(): IVersionHandler | undefined {
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
  private getHelpHandler(): IHelpHandler {
    return this._help ?? this._parent?.getHelpHandler() as IHelpHandler;
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
    if (isUpgradeCommand(upgradeCommand)) {
      const latestVersion = await upgradeCommand.getLatestVersion();
      const currentVersion = mainCommand.getVersion();
      if (currentVersion !== latestVersion) {
        mainCommand.version(
          `${currentVersion}  ${
            bold(
              yellow(
                `(New version available: ${latestVersion}. Run '${mainCommand.getName()} upgrade' to upgrade to the latest version!)`,
              ),
            )
          }`,
        );
      }
    }
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
  public getOptions(hidden?: boolean): IOption[] {
    return this.getGlobalOptions(hidden).concat(this.getBaseOptions(hidden));
  }

  /**
   * Get base options.
   * @param hidden Include hidden options.
   */
  public getBaseOptions(hidden?: boolean): IOption[] {
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
  public getGlobalOptions(hidden?: boolean): IOption[] {
    const getOptions = (
      cmd: Command<any> | undefined,
      options: IOption[] = [],
      names: string[] = [],
    ): IOption[] => {
      if (cmd) {
        if (cmd.options.length) {
          cmd.options.forEach((option: IOption) => {
            if (
              option.global &&
              !this.options.find((opt) => opt.name === option.name) &&
              names.indexOf(option.name) === -1 &&
              (hidden || !option.hidden)
            ) {
              names.push(option.name);
              options.push(option);
            }
          });
        }

        return getOptions(cmd._parent, options, names);
      }

      return options;
    };

    return getOptions(this._parent);
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
  public getOption(name: string, hidden?: boolean): IOption | undefined {
    return this.getBaseOption(name, hidden) ??
      this.getGlobalOption(name, hidden);
  }

  /**
   * Get base option by name.
   * @param name Name of the option. Must be in param-case.
   * @param hidden Include hidden options.
   */
  public getBaseOption(name: string, hidden?: boolean): IOption | undefined {
    const option = this.options.find((option) => option.name === name);

    return option && (hidden || !option.hidden) ? option : undefined;
  }

  /**
   * Get global option from parent commands by name.
   * @param name Name of the option. Must be in param-case.
   * @param hidden Include hidden options.
   */
  public getGlobalOption(name: string, hidden?: boolean): IOption | undefined {
    if (!this._parent) {
      return;
    }

    const option: IOption | undefined = this._parent.getBaseOption(
      name,
      hidden,
    );

    if (!option || !option.global) {
      return this._parent.getGlobalOption(name, hidden);
    }

    return option;
  }

  /**
   * Remove option by name.
   * @param name Name of the option. Must be in param-case.
   */
  public removeOption(name: string): IOption | undefined {
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
      cmd: Command<any> | undefined,
      commands: Array<Command<any>> = [],
      names: string[] = [],
    ): Array<Command<any>> => {
      if (cmd) {
        if (cmd.commands.size) {
          cmd.commands.forEach((cmd: Command<any>) => {
            if (
              cmd.isGlobal &&
              this !== cmd &&
              !this.commands.has(cmd._name) &&
              names.indexOf(cmd._name) === -1 &&
              (hidden || !cmd.isHidden)
            ) {
              names.push(cmd._name);
              commands.push(cmd);
            }
          });
        }

        return getCommands(cmd._parent, commands, names);
      }

      return commands;
    };

    return getCommands(this._parent);
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
  public getCommand<C extends Command<any>>(
    name: string,
    hidden?: boolean,
  ): C | undefined {
    return this.getBaseCommand(name, hidden) ??
      this.getGlobalCommand(name, hidden);
  }

  /**
   * Get base command by name or alias.
   * @param name Name or alias of the command.
   * @param hidden Include hidden commands.
   */
  public getBaseCommand<C extends Command<any>>(
    name: string,
    hidden?: boolean,
  ): C | undefined {
    for (const cmd of this.commands.values()) {
      if (cmd._name === name || cmd.aliases.includes(name)) {
        return (cmd && (hidden || !cmd.isHidden) ? cmd : undefined) as
          | C
          | undefined;
      }
    }
  }

  /**
   * Get global command by name or alias.
   * @param name Name or alias of the command.
   * @param hidden Include hidden commands.
   */
  public getGlobalCommand<C extends Command<any>>(
    name: string,
    hidden?: boolean,
  ): C | undefined {
    if (!this._parent) {
      return;
    }

    const cmd = this._parent.getBaseCommand(name, hidden);

    if (!cmd?.isGlobal) {
      return this._parent.getGlobalCommand(name, hidden);
    }

    return cmd as C;
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
  public getTypes(): IType[] {
    return this.getGlobalTypes().concat(this.getBaseTypes());
  }

  /** Get base types. */
  public getBaseTypes(): IType[] {
    return Array.from(this.types.values());
  }

  /** Get global types. */
  public getGlobalTypes(): IType[] {
    const getTypes = (
      cmd: Command<any> | undefined,
      types: IType[] = [],
      names: string[] = [],
    ): IType[] => {
      if (cmd) {
        if (cmd.types.size) {
          cmd.types.forEach((type: IType) => {
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
  public getType(name: string): IType | undefined {
    return this.getBaseType(name) ?? this.getGlobalType(name);
  }

  /**
   * Get base type by name.
   * @param name Name of the type.
   */
  public getBaseType(name: string): IType | undefined {
    return this.types.get(name);
  }

  /**
   * Get global type by name.
   * @param name Name of the type.
   */
  public getGlobalType(name: string): IType | undefined {
    if (!this._parent) {
      return;
    }

    const cmd: IType | undefined = this._parent.getBaseType(name);

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
  public getBaseCompletions(): ICompletion[] {
    return Array.from(this.completions.values());
  }

  /** Get global completions. */
  public getGlobalCompletions(): ICompletion[] {
    const getCompletions = (
      cmd: Command<any> | undefined,
      completions: ICompletion[] = [],
      names: string[] = [],
    ): ICompletion[] => {
      if (cmd) {
        if (cmd.completions.size) {
          cmd.completions.forEach((completion: ICompletion) => {
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
  public getCompletion(name: string): ICompletion | undefined {
    return this.getBaseCompletion(name) ?? this.getGlobalCompletion(name);
  }

  /**
   * Get base completion by name.
   * @param name Name of the completion.
   */
  public getBaseCompletion(name: string): ICompletion | undefined {
    return this.completions.get(name);
  }

  /**
   * Get global completions by name.
   * @param name Name of the completion.
   */
  public getGlobalCompletion(name: string): ICompletion | undefined {
    if (!this._parent) {
      return;
    }

    const completion: ICompletion | undefined = this._parent.getBaseCompletion(
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
  public getEnvVars(hidden?: boolean): IEnvVar[] {
    return this.getGlobalEnvVars(hidden).concat(this.getBaseEnvVars(hidden));
  }

  /**
   * Get base environment variables.
   * @param hidden Include hidden environment variable.
   */
  public getBaseEnvVars(hidden?: boolean): IEnvVar[] {
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
  public getGlobalEnvVars(hidden?: boolean): IEnvVar[] {
    const getEnvVars = (
      cmd: Command<any> | undefined,
      envVars: IEnvVar[] = [],
      names: string[] = [],
    ): IEnvVar[] => {
      if (cmd) {
        if (cmd.envVars.length) {
          cmd.envVars.forEach((envVar: IEnvVar) => {
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
  public getEnvVar(name: string, hidden?: boolean): IEnvVar | undefined {
    return this.getBaseEnvVar(name, hidden) ??
      this.getGlobalEnvVar(name, hidden);
  }

  /**
   * Get base environment variable by name.
   * @param name Name of the environment variable.
   * @param hidden Include hidden environment variable.
   */
  public getBaseEnvVar(name: string, hidden?: boolean): IEnvVar | undefined {
    const envVar: IEnvVar | undefined = this.envVars.find((env) =>
      env.names.indexOf(name) !== -1
    );

    return envVar && (hidden || !envVar.hidden) ? envVar : undefined;
  }

  /**
   * Get global environment variable by name.
   * @param name Name of the environment variable.
   * @param hidden Include hidden environment variable.
   */
  public getGlobalEnvVar(name: string, hidden?: boolean): IEnvVar | undefined {
    if (!this._parent) {
      return;
    }

    const envVar: IEnvVar | undefined = this._parent.getBaseEnvVar(
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
  public getExamples(): IExample[] {
    return this.examples;
  }

  /** Checks whether the command has an example with given name or not. */
  public hasExample(name: string): boolean {
    return !!this.getExample(name);
  }

  /** Get example with given name. */
  public getExample(name: string): IExample | undefined {
    return this.examples.find((example) => example.name === name);
  }
}

function isUpgradeCommand(command: unknown): command is UpgradeCommandImpl {
  return command instanceof Command && "getLatestVersion" in command;
}

interface UpgradeCommandImpl {
  getLatestVersion(): Promise<string>;
}

interface IDefaultOption {
  flags: string;
  desc?: string;
  opts?: ICommandOption;
}

type TrimLeft<T extends string, V extends string | undefined> = T extends
  `${V}${infer U}` ? U
  : T;

type TrimRight<T extends string, V extends string> = T extends `${infer U}${V}`
  ? U
  : T;

type Lower<V extends string> = V extends Uppercase<V> ? Lowercase<V>
  : Uncapitalize<V>;

type CamelCase<T extends string> = T extends `${infer V}_${infer Rest}`
  ? `${Lower<V>}${Capitalize<CamelCase<Rest>>}`
  : T extends `${infer V}-${infer Rest}`
    ? `${Lower<V>}${Capitalize<CamelCase<Rest>>}`
  : Lower<T>;

type OneOf<T, V> = T extends void ? V : T;

type Merge<L, R> = L extends void ? R
  : R extends void ? L
  : L & R;

// type Merge<L, R> = L extends void ? R
//   : R extends void ? L
//   : Omit<L, keyof R> & R;

type MergeRecursive<L, R> = L extends void ? R
  : R extends void ? L
  : L & R;

type OptionalOrRequiredValue<T extends string> = `[${T}]` | `<${T}>`;
type RestValue = `...${string}` | `${string}...`;

/**
 * Rest args with list type and completions.
 *
 * - `[...name:type[]:completion]`
 * - `<...name:type[]:completion>`
 * - `[name...:type[]:completion]`
 * - `<name...:type[]:completion>`
 */
type RestArgsListTypeCompletion<T extends string> = OptionalOrRequiredValue<
  `${RestValue}:${T}[]:${string}`
>;

/**
 * Rest args with list type.
 *
 * - `[...name:type[]]`
 * - `<...name:type[]>`
 * - `[name...:type[]]`
 * - `<name...:type[]>`
 */
type RestArgsListType<T extends string> = OptionalOrRequiredValue<
  `${RestValue}:${T}[]`
>;

/**
 * Rest args with type and completions.
 *
 * - `[...name:type:completion]`
 * - `<...name:type:completion>`
 * - `[name...:type:completion]`
 * - `<name...:type:completion>`
 */
type RestArgsTypeCompletion<T extends string> = OptionalOrRequiredValue<
  `${RestValue}:${T}:${string}`
>;

/**
 * Rest args with type.
 *
 * - `[...name:type]`
 * - `<...name:type>`
 * - `[name...:type]`
 * - `<name...:type>`
 */
type RestArgsType<T extends string> = OptionalOrRequiredValue<
  `${RestValue}:${T}`
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
type SingleArgListTypeCompletion<T extends string> = OptionalOrRequiredValue<
  `${string}:${T}[]:${string}`
>;

/**
 * Single arg with list type.
 *
 * - `[name:type[]]`
 * - `<name:type[]>`
 */
type SingleArgListType<T extends string> = OptionalOrRequiredValue<
  `${string}:${T}[]`
>;

/**
 * Single arg  with type and completion.
 *
 * - `[name:type:completion]`
 * - `<name:type:completion>`
 */
type SingleArgTypeCompletion<T extends string> = OptionalOrRequiredValue<
  `${string}:${T}:${string}`
>;

/**
 * Single arg with type.
 *
 * - `[name:type]`
 * - `<name:type>`
 */
type SingleArgType<T extends string> = OptionalOrRequiredValue<
  `${string}:${T}`
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

type ArgumentType<A extends string, U, T = Merge<DefaultTypes, U>> = A extends
  RestArgsListTypeCompletion<infer Type>
  ? T extends Record<Type, infer R> ? Array<Array<R>> : unknown
  : A extends RestArgsListType<infer Type>
    ? T extends Record<Type, infer R> ? Array<Array<R>> : unknown
  : A extends RestArgsTypeCompletion<infer Type>
    ? T extends Record<Type, infer R> ? Array<R> : unknown
  : A extends RestArgsType<infer Type>
    ? T extends Record<Type, infer R> ? Array<R> : unknown
  : A extends RestArgs ? Array<string>
  : A extends SingleArgListTypeCompletion<infer Type>
    ? T extends Record<Type, infer R> ? Array<R> : unknown
  : A extends SingleArgListType<infer Type>
    ? T extends Record<Type, infer R> ? Array<R> : unknown
  : A extends SingleArgTypeCompletion<infer Type>
    ? T extends Record<Type, infer R> ? R : unknown
  : A extends SingleArgType<infer Type>
    ? T extends Record<Type, infer R> ? R : unknown
  : A extends SingleArg ? string
  : unknown;

type ArgumentTypes<A extends string, T> = A extends `${string} ${string}`
  ? TypedArguments<A, T>
  : ArgumentType<A, T>;

type GetArguments<A extends string> = A extends `-${string}=${infer Rest}`
  ? GetArguments<Rest>
  : A extends `-${string} ${infer Rest}` ? GetArguments<Rest>
  : A;

type OptionName<Name extends string> = Name extends "*" ? string
  : CamelCase<TrimRight<Name, ",">>;

type IsRequired<R extends boolean | undefined, D> = R extends true ? true
  : D extends undefined ? false
  : true;

type NegatableOption<
  F extends string,
  CO,
  D,
  N extends string = OptionName<F>,
> = D extends undefined
  ? N extends keyof CO ? { [K in N]?: false } : { [K in N]: boolean }
  : { [K in N]: NonNullable<D> | false };

type BooleanOption<
  N extends string,
  CO,
  R extends boolean | undefined = undefined,
  D = undefined,
> = N extends `no-${infer Name}` ? NegatableOption<Name, CO, D>
  : N extends `${infer Name}.${infer Rest}`
    ? (R extends true
      ? { [K in OptionName<Name>]: BooleanOption<Rest, CO, R, D> }
      : { [K in OptionName<Name>]?: BooleanOption<Rest, CO, R, D> })
  : (R extends true ? { [K in OptionName<N>]: true | D }
    : { [K in OptionName<N>]?: true | D });

type ValueOption<
  N extends string,
  F extends string,
  V,
  R extends boolean | undefined = undefined,
  D = undefined,
> = N extends `${infer Name}.${infer RestName}` ? (R extends true ? {
  [K in OptionName<Name>]: ValueOption<RestName, F, V, R, D>;
}
  : {
    [K in OptionName<Name>]?: ValueOption<RestName, F, V, R, D>;
  })
  : (R extends true ? {
    [K in OptionName<N>]: GetArguments<F> extends `[${string}]`
      ? NonNullable<D> | true | ArgumentType<GetArguments<F>, V>
      : NonNullable<D> | ArgumentType<GetArguments<F>, V>;
  }
    : {
      [K in OptionName<N>]?: GetArguments<F> extends `[${string}]`
        ? NonNullable<D> | true | ArgumentType<GetArguments<F>, V>
        : NonNullable<D> | ArgumentType<GetArguments<F>, V>;
    });

type ValuesOption<
  T extends string,
  Rest extends string,
  V,
  R extends boolean | undefined = undefined,
  D = undefined,
> = T extends `${infer Name}.${infer RestName}` ? (R extends true ? {
  [N in OptionName<Name>]: ValuesOption<RestName, Rest, V, R, D>;
}
  : {
    [N in OptionName<Name>]?: ValuesOption<RestName, Rest, V, R, D>;
  })
  : (R extends true ? {
    [N in OptionName<T>]: GetArguments<Rest> extends `[${string}]`
      ? NonNullable<D> | true | ArgumentTypes<GetArguments<Rest>, V>
      : NonNullable<D> | ArgumentTypes<GetArguments<Rest>, V>;
  }
    : {
      [N in OptionName<T>]?: GetArguments<Rest> extends `[${string}]`
        ? NonNullable<D> | true | ArgumentTypes<GetArguments<Rest>, V>
        : NonNullable<D> | ArgumentTypes<GetArguments<Rest>, V>;
    });

type MapValue<O, V, C = undefined> = V extends undefined ? C extends true ? {
  [K in keyof O]: O[K] extends (Record<string, unknown> | undefined)
    ? MapValue<O[K], V>
    : Array<NonNullable<O[K]>>;
}
: O
  : {
    [K in keyof O]: O[K] extends (Record<string, unknown> | undefined)
      ? MapValue<O[K], V>
      : V;
  };

type GetOptionName<T> = T extends `${string}--${infer Name}=${string}`
  ? TrimRight<Name, ",">
  : T extends `${string}--${infer Name} ${string}` ? TrimRight<Name, ",">
  : T extends `${string}--${infer Name}` ? Name
  : T extends `-${infer Name}=${string}` ? TrimRight<Name, ",">
  : T extends `-${infer Name} ${string}` ? TrimRight<Name, ",">
  : T extends `-${infer Name}` ? Name
  : unknown;

type MergeOptions<T, CO, O, N = GetOptionName<T>> = N extends `no-${string}`
  ? Spread<CO, O>
  : N extends `${string}.${string}` ? MergeRecursive<CO, O>
  : Merge<CO, O>;

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
  F extends string,
  CO,
  T,
  R extends boolean | undefined = undefined,
  D = undefined,
> = number extends T ? any
  : F extends `${string}--${infer Name}=${infer Rest}`
    ? ValuesOption<Name, Rest, T, IsRequired<R, D>, D>
  : F extends `${string}--${infer Name} ${infer Rest}`
    ? ValuesOption<Name, Rest, T, IsRequired<R, D>, D>
  : F extends `${string}--${infer Name}`
    ? BooleanOption<Name, CO, IsRequired<R, D>, D>
  : F extends `-${infer Name}=${infer Rest}`
    ? ValuesOption<Name, Rest, T, IsRequired<R, D>, D>
  : F extends `-${infer Name} ${infer Rest}`
    ? ValuesOption<Name, Rest, T, IsRequired<R, D>, D>
  : F extends `-${infer Name}` ? BooleanOption<Name, CO, IsRequired<R, D>, D>
  : Record<string, unknown>;

type TypedArguments<A extends string, T extends Record<string, any> | void> =
  number extends T ? any
    : A extends `${infer Arg} ${infer Rest}`
      ? Arg extends `[${string}]`
        ? [ArgumentType<Arg, T>?, ...TypedArguments<Rest, T>]
      : [ArgumentType<Arg, T>, ...TypedArguments<Rest, T>]
    : A extends `[${string}]` ? [ArgumentType<A, T>?]
    : [ArgumentType<A, T>];

type TypedCommandArguments<N extends string, T> = number extends T ? any
  : N extends `${string} ${infer Args}` ? TypedArguments<Args, T>
  : [];

type TypedEnv<
  N extends string,
  P extends string | undefined,
  CO,
  T,
  R extends boolean | undefined = undefined,
  D = undefined,
> = number extends T ? any
  : N extends `${infer Name}=${infer Rest}`
    ? ValueOption<TrimLeft<Name, P>, Rest, T, R, D>
  : N extends `${infer Name} ${infer Rest}`
    ? ValueOption<TrimLeft<Name, P>, Rest, T, R, D>
  : N extends `${infer Name}` ? BooleanOption<TrimLeft<Name, P>, CO, R, D>
  : Record<string, unknown>;

type TypedType<
  Name extends string,
  Handler extends TypeOrTypeHandler<unknown>,
> = { [N in Name]: Handler };

type RequiredKeys<T> = {
  // deno-lint-ignore ban-types
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

type OptionalKeys<T> = {
  // deno-lint-ignore ban-types
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

type SpreadRequiredProperties<
  L,
  R,
  K extends keyof L & keyof R,
> = {
  [P in K]: Exclude<L[P], undefined> | Exclude<R[P], undefined>;
};

type SpreadOptionalProperties<
  L,
  R,
  K extends keyof L & keyof R,
> = {
  [P in K]?: L[P] | R[P];
};

/** Merge types of two objects. */
type Spread<L, R> = L extends void ? R : R extends void ? L
: // Properties in L that don't exist in R.
& Omit<L, keyof R>
// Properties in R that don't exist in L.
& Omit<R, keyof L>
// Required properties in R that exist in L.
& SpreadRequiredProperties<L, R, RequiredKeys<R> & keyof L>
// Required properties in L that exist in R.
& SpreadRequiredProperties<L, R, RequiredKeys<L> & keyof R>
// Optional properties in L and R.
& SpreadOptionalProperties<
  L,
  R,
  OptionalKeys<L> & OptionalKeys<R>
>;

type ValueOf<T> = T extends Record<string, infer V> ? ValueOf<V> : T;
