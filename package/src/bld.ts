/*
 * package.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */
import { Builtins, Cli } from "npm:clipanion";
import { ConfigureCommand } from "./common/configure.ts";
import { mainRunner } from "../../src/core/main.ts";
import { PackageCommand } from "./cmd/pkg-cmd.ts";

import { PrepareDistCommand } from "./common/prepare-dist.ts";
import { UpdateHTMLDependenciesCommand } from "./common/update-html-dependencies.ts";
import { MakeInstallerDebCommand } from "./linux/installer.ts";
import { MakeInstallerMacCommand } from "./macos/installer.ts";
import {
  CompileQuartoLatexmkCommand,
} from "./common/compile-quarto-latexmk.ts";
import { MakeInstallerWindowsCommand } from "./windows/installer.ts";

import { addLoggingOptions } from "../../src/core/log.ts";
import {
  CycleDependenciesCommand,
  ParseSwcLogCommand,
} from "./common/cyclic-dependencies.ts";
import {
  ArchiveBinaryDependenciesCommand,
  CheckBinaryDependenciesCommand,
} from "./common/archive-binary-dependencies.ts";
import { UpdatePandocCommand } from "./common/update-pandoc.ts";
import { ValidateBundleCommand } from "./common/validate-bundle.ts";
import { MakeInstallerExternalCommand } from "./ext/installer.ts";

const commands: (typeof PackageCommand)[] = [
  ArchiveBinaryDependenciesCommand,
  CheckBinaryDependenciesCommand,
  CompileQuartoLatexmkCommand,
  ConfigureCommand,
  CycleDependenciesCommand,
  MakeInstallerDebCommand,
  MakeInstallerExternalCommand,
  MakeInstallerMacCommand,
  MakeInstallerWindowsCommand,
  ParseSwcLogCommand,
  PrepareDistCommand,
  UpdateHTMLDependenciesCommand,
  UpdatePandocCommand,
  ValidateBundleCommand,
]


class QuartoBld extends Cli {
  constructor() {
    super({
      binaryLabel: "Utility that implements packaging and distribution of quarto cli",
      binaryName: 'quarto-bld',
      binaryVersion: "0.1",
    });

    [
      ...commands,
      Builtins.HelpCommand
    ].forEach((command) => {
      addLoggingOptions(command);
      this.register(command);
    });
  }
}

if (import.meta.main) {
  await mainRunner(async () => {
    const quartoBld = new QuartoBld();
    await quartoBld.runExit(Deno.args);
  });
}
