/*
 * binder.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { initYamlIntelligenceResourcesFromFilesystem } from "../../../../core/schema/utils.ts";
import { createTempContext } from "../../../../core/temp.ts";

import { rBinaryPath, resourcePath } from "../../../../core/resources.ts";

import SemVer from "semver/mod.ts";
import { join } from "path/mod.ts";
import { info, warning } from "log/mod.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";
import {
  EnvironmentConfiguration,
  PythonConfiguration,
  QuartoConfiguration,
  RConfiguration,
  VSCodeConfiguration,
} from "./binder-types.ts";
import { execProcess } from "../../../../core/process.ts";
import { safeFileWriter } from "./binder-utils.ts";
import { projectContext } from "../../../../project/project-context.ts";
import {
  computeProjectEnvironment,
  ProjectEnvironment,
} from "../../../../project/project-environment.ts";
import { withSpinner } from "../../../../core/console.ts";
import { logProgress } from "../../../../core/log.ts";
import { ProjectContext } from "../../../../project/types.ts";

import { Command } from "cliffy/command/mod.ts";
import { Table } from "cliffy/table/mod.ts";

export const useBinderCommand = new Command()
  .name("binder")
  .description(
    "Configure the current project to be deployable using Binder.",
  )
  .option(
    "--no-prompt",
    "Do not prompt to confirm actions",
  )
  .example(
    "Configure project to use Binder",
    "quarto use binder",
  )
  .action(async (options: { prompt?: boolean }) => {
    await initYamlIntelligenceResourcesFromFilesystem();
    const temp = createTempContext();
    try {
      // compute the project context
      logProgress("Determining configuration");
      const context = await projectContext(Deno.cwd());
      if (!context) {
        throw new Error(
          "You must be in a Quarto project in order to configure Binder support.",
        );
      }

      // Read the project environment
      const projEnv = await withSpinner(
        {
          message: "Inspecting project configuration:",
          doneMessage: "Binder configuration:",
        },
        () => {
          return computeProjectEnvironment(context);
        },
      );

      const jupyterLab4 = jupyterLabVersion(context, projEnv);

      const rConfig: RConfiguration = {};
      if (projEnv.engines.includes("knitr")) {
        const result = await execProcess(
          {
            cmd: [
              await rBinaryPath("R"),
              "--version",
            ],
            stdout: "piped",
            stderr: "piped",
          },
        );
        if (result.success) {
          const output = result.stdout;
          const verMatch = output?.match(
            /R version (\d+\.\d+\.\d+) \((\d\d\d\d-\d\d-\d\d)\)/m,
          );
          if (verMatch) {
            const version = verMatch[1];
            rConfig.version = new SemVer(version);
            rConfig.date = verMatch[2];
          }
        } else {
          warning("Unable to detect R version, ommitting R configuration");
        }
      }

      // Note whether there are depedencies restored
      if (projEnv.environments.length === 0) {
        // TODO: Provide a hyperlink to more information
        info(
          "\nNOTE: No files which declare dependencies were discovered. No dependencies will be restored when running this project on Binder.\n",
        );
      }

      const quartoVersion = typeof (projEnv.quarto) === "string"
        ? projEnv.quarto === "prerelease"
          ? "most recent prerelease"
          : "most recent release"
        : projEnv.quarto.toString();

      const table = new Table();
      table.push(["Quarto", quartoVersion]);
      table.push([
        "JupyterLab",
        jupyterLab4 ? "4.x" : "default",
      ]);
      if (projEnv.engines.length > 0) {
        table.push([
          projEnv.engines.length === 1 ? "Engine" : "Engines",
          projEnv.engines.join("\n"),
        ]);
      }
      if (rConfig.version || rConfig.date) {
        const verStr = [];
        if (rConfig.version) {
          verStr.push(`${rConfig.version?.toString()}`);
        }
        if (rConfig.date) {
          verStr.push(`(${rConfig.date})`);
        }

        table.push([
          "R",
          verStr.join(" "),
        ]);
      }
      table.push(["Tools", projEnv.tools.join("\n")]);
      table.push(["Editor", projEnv.codeEnvironment]);
      table.push(["Environments", projEnv.environments.join("\n")]);

      table.border(true);
      table.indent(4);
      table.render();

      writeBinderFiles(projEnv, jupyterLab4, context, options, rConfig);
    } finally {
      temp.cleanup();
    }
  });

const createPostBuild = (
  quartoConfig: QuartoConfiguration,
  vscodeConfig: VSCodeConfiguration,
  pythonConfig: PythonConfiguration,
) => {
  const postBuildScript: string[] = [];
  postBuildScript.push("#!/bin/bash -v");
  postBuildScript.push("");
  postBuildScript.push(`# determine which version of Quarto to install`);
  postBuildScript.push(`QUARTO_VERSION=${quartoConfig.version}`);
  postBuildScript.push(kLookupQuartoVersion);
  postBuildScript.push(msg("Installing Quarto $QUARTO_VERSION"));
  postBuildScript.push(kInstallQuarto);
  postBuildScript.push(msg("Installed Quarto"));

  // Maybe install TinyTeX
  if (quartoConfig.tinytex) {
    postBuildScript.push(msg("Installing TinyTex"));
    postBuildScript.push("# install tinytex");
    postBuildScript.push("quarto install tinytex --no-prompt");
    postBuildScript.push(msg("Installed TinyTex"));
  }

  // Maybe install Chromium
  if (quartoConfig.chromium) {
    postBuildScript.push(msg("Installing Chromium"));
    postBuildScript.push("# install chromium");
    postBuildScript.push("quarto install chromium --no-prompt");
    postBuildScript.push(msg("Installed Chromium"));
  }

  if (vscodeConfig.version) {
    const version = typeof (vscodeConfig.version) === "boolean"
      ? new SemVer("4.16.1")
      : vscodeConfig.version;
    postBuildScript.push(msg("Configuring VSCode"));
    postBuildScript.push("# download and install VS Code server");
    postBuildScript.push(`CODE_VERSION=${version}`);
    postBuildScript.push(kInstallVSCode);

    if (vscodeConfig.extensions) {
      postBuildScript.push("# install vscode extensions");
      for (const extension of vscodeConfig.extensions) {
        postBuildScript.push(
          `code-server --install-extension ${extension}`,
        );
      }
    }

    postBuildScript.push(msg("Configured VSCode"));
  }

  if (pythonConfig.pip) {
    postBuildScript.push("# install required python packages");
    for (const lib of pythonConfig.pip) {
      postBuildScript.push(`python3 -m pip install ${lib}`);
    }
  }

  postBuildScript.push(msg("Completed"));
  return postBuildScript.join("\n");
};

const jupyterLabVersion = (
  context: ProjectContext,
  env: ProjectEnvironment,
) => {
  const envs = env.environments;

  // Look in requirements, environment.yml, pipfile for hints
  // that JL4 will be used (hacky to use regex but using for hint)
  const envMatchers: Record<string, RegExp> = {};
  envMatchers["requirements.txt"] = /jupyterlab>*=*4.*./g;
  envMatchers["environment.yml"] = /jupyterlab *>*=*4.*./g;
  envMatchers["pipfile"] = /jupyterlab = "*>*=*4.*."/g;

  const hasJL4 = envs.some((env) => {
    const matcher = envMatchers[env];
    if (!matcher) {
      return false;
    }

    const contents = Deno.readTextFileSync(join(context.dir, env));
    return contents.match(matcher);
  });
  return hasJL4;
};

const msg = (text: string): string => {
  return `
echo
echo ${text}
echo`;
};

const kInstallQuarto = `
# download and install the deb file
curl -LO https://github.com/quarto-dev/quarto-cli/releases/download/v$QUARTO_VERSION/quarto-$QUARTO_VERSION-linux-amd64.deb
dpkg -x quarto-$QUARTO_VERSION-linux-amd64.deb .quarto
rm -rf quarto-$QUARTO_VERSION-linux-amd64.deb

# get quarto in the path
mkdir -p ~/.local/bin
ln -s ~/.quarto/opt/quarto/bin/quarto ~/.local/bin/quarto

# create the proper pandoc symlink to enable visual editor in Quarto extension
ln -s ~/.quarto/opt/quarto/bin/tools/x86_64/pandoc ~/.quarto/opt/quarto/bin/tools/pandoc
`;

const kInstallVSCode = `
# download and extract
wget -q -O code-server.tar.gz https://github.com/coder/code-server/releases/download/v$CODE_VERSION/code-server-$CODE_VERSION-linux-amd64.tar.gz
tar xzf code-server.tar.gz
rm -rf code-server.tar.gz

# place in hidden folder
mv "code-server-$CODE_VERSION-linux-amd64" .code-server

# get code-server in path
mkdir -p ./.local/bin
ln -s ~/.code-server/bin/code-server ~/.local/bin/code-server
`;

const kLookupQuartoVersion = `
# See whether we need to lookup a Quarto version
if [ $QUARTO_VERSION = "prerelease" ]; then
	QUARTO_JSON="_prerelease.json"
elif [ $QUARTO_VERSION = "release" ]; then
	QUARTO_JSON="_download.json"
fi

if [ $QUARTO_JSON != "" ]; then

# create a python script and run it
PYTHON_SCRIPT=_quarto_version.py
if [ -e $PYTHON_SCRIPT ]; then
	rm -rf $PYTHON_SCRIPT
fi

cat > $PYTHON_SCRIPT <<EOF
import urllib, json

import urllib.request, json
with urllib.request.urlopen("https://quarto.org/docs/download/\${QUARTO_JSON}") as url:
	data = json.load(url)
	print(data['version'])

EOF

QUARTO_VERSION=$(python $PYTHON_SCRIPT)
rm -rf $PYTHON_SCRIPT

fi
`;

async function writeBinderFiles(
  projEnv: ProjectEnvironment,
  jupyterLab4: boolean,
  context: ProjectContext,
  options: { prompt?: boolean | undefined },
  rConfig: RConfiguration,
) {
  logProgress("\nWriting files");

  // Write the post build to install Quarto
  const quartoConfig: QuartoConfiguration = {
    version: projEnv.quarto,
    tinytex: projEnv.tools.includes("tinytex"),
    chromium: projEnv.tools.includes("chromium"),
  };

  const vsCodeConfig: VSCodeConfiguration = {
    version: projEnv.codeEnvironment === "vscode"
      ? new SemVer("4.16.1")
      : undefined,
    extensions: [
      "ms-python.python",
      "sumneko.lua",
      "quarto.quarto",
    ],
  };

  // See if we should configure for JL3 or 4
  const pythonConfig: PythonConfiguration = {
    pip: [],
  };
  if (jupyterLab4) {
    pythonConfig.pip?.push(
      "git+https://github.com/trungleduc/jupyter-server-proxy@lab4",
    );
    pythonConfig.pip?.push("jupyterlab-quarto");
  } else {
    pythonConfig.pip?.push("jupyter-server-proxy");
    pythonConfig.pip?.push("jupyterlab-quarto==0.1.45");
  }

  const environmentConfig: EnvironmentConfiguration = {
    apt: ["zip"],
  };

  // Get a file write
  const writeFile = safeFileWriter(context.dir, options.prompt);

  // Look for an renv.lock file
  const renvPath = join(context.dir, "renv.lock");
  if (existsSync(renvPath)) {
    // Create an install.R file
    const installRText = "install.packages('renv')\nrenv::activate()";
    await writeFile(
      "install.R",
      installRText,
    );
  }

  // Generate the postBuild text
  const postBuildScriptText = createPostBuild(
    quartoConfig,
    vsCodeConfig,
    pythonConfig,
  );

  // Write the postBuild text
  await writeFile(
    "postBuild",
    postBuildScriptText,
  );

  // Configure JupyterLab to support VSCode
  if (vsCodeConfig.version) {
    const traitletsDir = ".jupyter";
    ensureDirSync(join(context.dir, traitletsDir));

    // Move traitlets configuration into place
    // Traitlets are used to configure the vscode tile in jupyterlab
    // as well as to start the port proxying that permits vscode to work
    const resDir = resourcePath("use/binder/");
    for (const file of ["vscode.svg", "jupyter_notebook_config.py"]) {
      const textContents = Deno.readTextFileSync(join(resDir, file));
      await writeFile(join(traitletsDir, file), textContents);
    }
  }

  // Generate an apt.txt file
  if (environmentConfig.apt && environmentConfig.apt.length) {
    const aptText = environmentConfig.apt.join("\n");

    await writeFile(
      "apt.txt",
      aptText,
    );
  }

  // Generate a file to configure R
  if (rConfig.version || rConfig.date) {
    const runtime = ["r"];
    if (rConfig.version) {
      runtime.push(`-${rConfig.version}`);
    }

    if (rConfig.date) {
      runtime.push(`-${rConfig.date}`);
    }
    await writeFile(
      "runtime.txt",
      runtime.join(""),
    );
  }
}
