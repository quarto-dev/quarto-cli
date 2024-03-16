import { bold, brightBlue, cyan, green, red, yellow } from "../deps.ts";
import { ValidationError } from "../_errors.ts";
import { Table } from "../../table/table.ts";

export interface Versions {
  latest: string;
  versions: Array<string>;
}

export interface UpgradeOptions {
  name: string;
  from?: string;
  to: string;
  args?: Array<string>;
  main?: string;
  importMap?: string;
}

export abstract class Provider {
  abstract readonly name: string;
  protected readonly maxListSize: number = 25;
  private maxCols = 8;

  abstract getVersions(name: string): Promise<Versions>;

  abstract getRepositoryUrl(name: string): string;

  abstract getRegistryUrl(name: string, version: string): string;

  async isOutdated(
    name: string,
    currentVersion: string,
    targetVersion: string,
  ): Promise<boolean> {
    const { latest, versions } = await this.getVersions(name);

    if (targetVersion === "latest") {
      targetVersion = latest;
    }

    // Check if requested version exists.
    if (targetVersion && !versions.includes(targetVersion)) {
      throw new ValidationError(
        `The provided version ${
          bold(red(targetVersion))
        } is not found.\n\n    ${
          cyan(
            `Visit ${
              brightBlue(this.getRepositoryUrl(name))
            } for available releases or run again with the ${(yellow(
              "-l",
            ))} or ${(yellow("--list-versions"))} command.`,
          )
        }`,
      );
    }

    // Check if requested version is already the latest available version.
    if (latest && latest === currentVersion && latest === targetVersion) {
      console.warn(
        yellow(
          `You're already using the latest available version ${currentVersion} of ${name}.`,
        ),
      );
      return false;
    }

    // Check if requested version is already installed.
    if (targetVersion && currentVersion === targetVersion) {
      console.warn(
        yellow(`You're already using version ${currentVersion} of ${name}.`),
      );
      return false;
    }

    return true;
  }

  async upgrade(
    { name, from, to, importMap, main = `${name}.ts`, args = [] }:
      UpgradeOptions,
  ): Promise<void> {
    if (to === "latest") {
      const { latest } = await this.getVersions(name);
      to = latest;
    }
    const registry: string = new URL(main, this.getRegistryUrl(name, to)).href;

    const cmdArgs = ["install"];

    if (importMap) {
      const importJson: string =
        new URL(importMap, this.getRegistryUrl(name, to)).href;

      cmdArgs.push("--import-map", importJson);
    }

    if (args.length) {
      cmdArgs.push(...args, "--force", "--name", name, registry);
    } else {
      cmdArgs.push(
        "--no-check",
        "--quiet",
        "--force",
        "--name",
        name,
        registry,
      );
    }

    const cmd = new Deno.Command(Deno.execPath(), {
      args: cmdArgs,
      stdout: "piped",
      stderr: "piped",
    });
    const { success, stderr } = await cmd.output();

    if (!success) {
      await Deno.stderr.write(stderr);
      throw new Error(
        `Failed to upgrade ${name} from ${from} to version ${to}!`,
      );
    }

    console.info(
      `Successfully upgraded ${name} from ${from} to version ${to}! (${
        this.getRegistryUrl(name, to)
      })`,
    );
  }

  public async listVersions(
    name: string,
    currentVersion?: string,
  ): Promise<void> {
    const { versions } = await this.getVersions(name);
    this.printVersions(versions, currentVersion);
  }

  protected printVersions(
    versions: Array<string>,
    currentVersion?: string,
    { maxCols = this.maxCols, indent = 0 }: {
      maxCols?: number;
      indent?: number;
    } = {},
  ): void {
    versions = versions.slice();
    if (versions?.length) {
      versions = versions.map((version: string) =>
        currentVersion && currentVersion === version
          ? green(`* ${version}`)
          : `  ${version}`
      );

      if (versions.length > this.maxListSize) {
        const table = new Table().indent(indent);
        const rowSize = Math.ceil(versions.length / maxCols);
        const colSize = Math.min(versions.length, maxCols);
        let versionIndex = 0;
        for (let colIndex = 0; colIndex < colSize; colIndex++) {
          for (let rowIndex = 0; rowIndex < rowSize; rowIndex++) {
            if (!table[rowIndex]) {
              table[rowIndex] = [];
            }
            table[rowIndex][colIndex] = versions[versionIndex++];
          }
        }
        console.log(table.toString());
      } else {
        console.log(
          versions.map((version) => " ".repeat(indent) + version).join("\n"),
        );
      }
    }
  }
}
