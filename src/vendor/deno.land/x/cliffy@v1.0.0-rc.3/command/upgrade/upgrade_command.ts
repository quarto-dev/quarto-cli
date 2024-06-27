import { Command } from "../command.ts";
import { ValidationError } from "../../flags/_errors.ts";
import type { Provider, Versions } from "./provider.ts";
import { EnumType } from "../types/enum.ts";

export interface UpgradeCommandOptions<
  TProvider extends Provider = Provider,
  TProviders extends TProvider | Array<TProvider> =
    | TProvider
    | Array<TProvider>,
> {
  provider: TProviders;
  main?: string;
  importMap?: string;
  args?: Array<string>;
}

export class UpgradeCommand extends Command {
  private readonly providers: ReadonlyArray<Provider>;

  constructor(
    { provider, main, args, importMap }: UpgradeCommandOptions,
  ) {
    super();
    this.providers = Array.isArray(provider) ? provider : [provider];
    if (!this.providers.length) {
      throw new Error(`No upgrade provider defined!`);
    }
    this
      .description(() =>
        `Upgrade ${this.getMainCommand().getName()} executable to latest or given version.`
      )
      .noGlobals()
      .type("provider", new EnumType(this.getProviderNames()))
      .option(
        "-r, --registry <name:provider>",
        `The registry name from which to upgrade.`,
        {
          default: this.getProvider().name,
          hidden: this.providers.length < 2,
          value: (registry) => this.getProvider(registry),
        },
      )
      .option(
        "-l, --list-versions",
        "Show available versions.",
        {
          action: async ({ registry }) => {
            await registry.listVersions(
              this.getMainCommand().getName(),
              this.getVersion(),
            );
            Deno.exit(0);
          },
        },
      )
      .option(
        "--version <version:string:version>",
        "The version to upgrade to.",
        { default: "latest" },
      )
      .option(
        "-f, --force",
        "Replace current installation even if not out-of-date.",
      )
      .complete("version", () => this.getAllVersions())
      .action(async ({ registry, version: targetVersion, force }) => {
        const name: string = this.getMainCommand().getName();
        const currentVersion: string | undefined = this.getVersion();

        if (
          force || !currentVersion ||
          await registry.isOutdated(name, currentVersion, targetVersion)
        ) {
          await registry.upgrade({
            name,
            main,
            importMap,
            from: currentVersion,
            to: targetVersion,
            args,
          });
        }
      });
  }

  public async getAllVersions(): Promise<Array<string>> {
    const { versions } = await this.getVersions();
    return versions;
  }

  public async getLatestVersion(): Promise<string> {
    const { latest } = await this.getVersions();
    return latest;
  }

  public getVersions(): Promise<Versions> {
    return this.getProvider().getVersions(
      this.getMainCommand().getName(),
    );
  }

  private getProvider(name?: string): Provider {
    const provider = name
      ? this.providers.find((provider) => provider.name === name)
      : this.providers[0];
    if (!provider) {
      throw new ValidationError(`Unknown provider "${name}"`);
    }
    return provider;
  }

  private getProviderNames(): Array<string> {
    return this.providers.map((provider) => provider.name);
  }
}
