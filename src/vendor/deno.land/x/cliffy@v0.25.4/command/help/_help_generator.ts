import { getFlag } from "../../flags/_utils.ts";
import { Table } from "../../table/table.ts";
import { dedent, getDescription, parseArgumentsDefinition } from "../_utils.ts";
import type { Command } from "../command.ts";
import {
  blue,
  bold,
  dim,
  getColorEnabled,
  green,
  italic,
  magenta,
  red,
  setColorEnabled,
  yellow,
} from "../deps.ts";
import { Type } from "../type.ts";
import type { Argument, EnvVar, Example, Option } from "../types.ts";

export interface HelpOptions {
  types?: boolean;
  hints?: boolean;
  colors?: boolean;
  long?: boolean;
}

interface OptionGroup {
  name?: string;
  options: Array<Option>;
}

/** Help text generator. */
export class HelpGenerator {
  private indent = 2;
  private options: Required<HelpOptions>;

  /** Generate help text for given command. */
  public static generate(cmd: Command, options?: HelpOptions): string {
    return new HelpGenerator(cmd, options).generate();
  }

  private constructor(
    private cmd: Command,
    options: HelpOptions = {},
  ) {
    this.options = {
      types: false,
      hints: true,
      colors: true,
      long: false,
      ...options,
    };
  }

  private generate(): string {
    const areColorsEnabled = getColorEnabled();
    setColorEnabled(this.options.colors);

    const result = this.generateHeader() +
      this.generateMeta() +
      this.generateDescription() +
      this.generateOptions() +
      this.generateCommands() +
      this.generateEnvironmentVariables() +
      this.generateExamples();

    setColorEnabled(areColorsEnabled);

    return result;
  }

  private generateHeader(): string {
    const usage = this.cmd.getUsage();
    const rows = [
      [
        bold("Usage:"),
        magenta(
          this.cmd.getPath() +
            (usage ? " " + highlightArguments(usage, this.options.types) : ""),
        ),
      ],
    ];
    const version: string | undefined = this.cmd.getVersion();
    if (version) {
      rows.push([bold("Version:"), yellow(`${this.cmd.getVersion()}`)]);
    }
    return "\n" +
      Table.from(rows)
        .indent(this.indent)
        .padding(1)
        .toString() +
      "\n";
  }

  private generateMeta(): string {
    const meta = Object.entries(this.cmd.getMeta());
    if (!meta.length) {
      return "";
    }

    const rows = [];
    for (const [name, value] of meta) {
      rows.push([bold(`${name}: `) + value]);
    }

    return "\n" +
      Table.from(rows)
        .indent(this.indent)
        .padding(1)
        .toString() +
      "\n";
  }

  private generateDescription(): string {
    if (!this.cmd.getDescription()) {
      return "";
    }
    return this.label("Description") +
      Table.from([
        [dedent(this.cmd.getDescription())],
      ])
        .indent(this.indent * 2)
        .maxColWidth(140)
        .padding(1)
        .toString() +
      "\n";
  }

  private generateOptions(): string {
    const options = this.cmd.getOptions(false);
    if (!options.length) {
      return "";
    }

    let groups: Array<OptionGroup> = [];
    const hasGroups = options.some((option) => option.groupName);
    if (hasGroups) {
      for (const option of options) {
        let group = groups.find((group) => group.name === option.groupName);
        if (!group) {
          group = {
            name: option.groupName,
            options: [],
          };
          groups.push(group);
        }
        group.options.push(option);
      }
    } else {
      groups = [{
        name: "Options",
        options,
      }];
    }

    let result = "";
    for (const group of groups) {
      result += this.generateOptionGroup(group);
    }

    return result;
  }

  private generateOptionGroup(group: OptionGroup): string {
    if (!group.options.length) {
      return "";
    }
    const hasTypeDefinitions = !!group.options.find((option) =>
      !!option.typeDefinition
    );

    if (hasTypeDefinitions) {
      return this.label(group.name ?? "Options") +
        Table.from([
          ...group.options.map((option: Option) => [
            option.flags.map((flag) => blue(flag)).join(", "),
            highlightArguments(
              option.typeDefinition || "",
              this.options.types,
            ),
            red(bold("-")),
            getDescription(option.description, !this.options.long),
            this.generateHints(option),
          ]),
        ])
          .padding([2, 2, 1, 2])
          .indent(this.indent * 2)
          .maxColWidth([60, 60, 1, 80, 60])
          .toString() +
        "\n";
    }

    return this.label(group.name ?? "Options") +
      Table.from([
        ...group.options.map((option: Option) => [
          option.flags.map((flag) => blue(flag)).join(", "),
          red(bold("-")),
          getDescription(option.description, !this.options.long),
          this.generateHints(option),
        ]),
      ])
        .indent(this.indent * 2)
        .maxColWidth([60, 1, 80, 60])
        .padding([2, 1, 2])
        .toString() +
      "\n";
  }

  private generateCommands(): string {
    const commands = this.cmd.getCommands(false);
    if (!commands.length) {
      return "";
    }

    const hasTypeDefinitions = !!commands.find((command) =>
      !!command.getArgsDefinition()
    );

    if (hasTypeDefinitions) {
      return this.label("Commands") +
        Table.from([
          ...commands.map((command: Command) => [
            [command.getName(), ...command.getAliases()].map((name) =>
              blue(name)
            ).join(", "),
            highlightArguments(
              command.getArgsDefinition() || "",
              this.options.types,
            ),
            red(bold("-")),
            command.getShortDescription(),
          ]),
        ])
          .indent(this.indent * 2)
          .maxColWidth([60, 60, 1, 80])
          .padding([2, 2, 1, 2])
          .toString() +
        "\n";
    }

    return this.label("Commands") +
      Table.from([
        ...commands.map((command: Command) => [
          [command.getName(), ...command.getAliases()].map((name) => blue(name))
            .join(", "),
          red(bold("-")),
          command.getShortDescription(),
        ]),
      ])
        .maxColWidth([60, 1, 80])
        .padding([2, 1, 2])
        .indent(this.indent * 2)
        .toString() +
      "\n";
  }

  private generateEnvironmentVariables(): string {
    const envVars = this.cmd.getEnvVars(false);
    if (!envVars.length) {
      return "";
    }
    return this.label("Environment variables") +
      Table.from([
        ...envVars.map((envVar: EnvVar) => [
          envVar.names.map((name: string) => blue(name)).join(", "),
          highlightArgumentDetails(
            envVar.details,
            this.options.types,
          ),
          red(bold("-")),
          this.options.long
            ? dedent(envVar.description)
            : envVar.description.trim().split("\n", 1)[0],
          envVar.required ? `(${yellow(`required`)})` : "",
        ]),
      ])
        .padding([2, 2, 1, 2])
        .indent(this.indent * 2)
        .maxColWidth([60, 60, 1, 80, 10])
        .toString() +
      "\n";
  }

  private generateExamples(): string {
    const examples = this.cmd.getExamples();
    if (!examples.length) {
      return "";
    }
    return this.label("Examples") +
      Table.from(examples.map((example: Example) => [
        dim(bold(`${capitalize(example.name)}:`)),
        dedent(example.description),
      ]))
        .padding(1)
        .indent(this.indent * 2)
        .maxColWidth(150)
        .toString() +
      "\n";
  }

  private generateHints(option: Option): string {
    if (!this.options.hints) {
      return "";
    }
    const hints = [];

    option.required && hints.push(yellow(`required`));
    typeof option.default !== "undefined" && hints.push(
      bold(`Default: `) + inspect(option.default, this.options.colors),
    );
    option.depends?.length && hints.push(
      yellow(bold(`Depends: `)) +
        italic(option.depends.map(getFlag).join(", ")),
    );
    option.conflicts?.length && hints.push(
      red(bold(`Conflicts: `)) +
        italic(option.conflicts.map(getFlag).join(", ")),
    );

    const type = this.cmd.getType(option.args[0]?.type)?.handler;
    if (type instanceof Type) {
      const possibleValues = type.values?.(this.cmd, this.cmd.getParent());
      if (possibleValues?.length) {
        hints.push(
          bold(`Values: `) +
            possibleValues.map((value: unknown) =>
              inspect(value, this.options.colors)
            ).join(", "),
        );
      }
    }

    if (hints.length) {
      return `(${hints.join(", ")})`;
    }

    return "";
  }

  private label(label: string) {
    return "\n" +
      " ".repeat(this.indent) + bold(`${label}:`) +
      "\n\n";
  }
}

function capitalize(string: string): string {
  return string?.charAt(0).toUpperCase() + string.slice(1) ?? "";
}

function inspect(value: unknown, colors: boolean): string {
  return Deno.inspect(
    value,
    // deno < 1.4.3 doesn't support the colors property.
    { depth: 1, colors, trailingComma: false } as Deno.InspectOptions,
  );
}

/**
 * Colorize arguments string.
 * @param argsDefinition Arguments definition: `<color1:string> <color2:string>`
 * @param types Show types.
 */
function highlightArguments(argsDefinition: string, types = true) {
  if (!argsDefinition) {
    return "";
  }

  return parseArgumentsDefinition(argsDefinition, false, true)
    .map((arg: Argument | string) =>
      typeof arg === "string" ? arg : highlightArgumentDetails(arg, types)
    )
    .join(" ");
}

/**
 * Colorize argument string.
 * @param arg Argument details.
 * @param types Show types.
 */
function highlightArgumentDetails(
  arg: Argument,
  types = true,
): string {
  let str = "";

  str += yellow(arg.optionalValue ? "[" : "<");

  let name = "";
  name += arg.name;
  if (arg.variadic) {
    name += "...";
  }
  name = magenta(name);

  str += name;

  if (types) {
    str += yellow(":");
    str += red(arg.type);
    if (arg.list) {
      str += green("[]");
    }
  }

  str += yellow(arg.optionalValue ? "]" : ">");

  return str;
}
