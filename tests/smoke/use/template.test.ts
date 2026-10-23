import { testQuartoCmd } from "../../test.ts";
import {
  directoryContainsOnlyAllowedPaths,
  fileExists,
  folderExists,
  noErrorsOrWarnings,
  printsMessage,
} from "../../verify.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { ensureDirSync } from "../../../src/deno_ral/fs.ts";
import { docs } from "../../utils.ts";

const tempDir = Deno.makeTempDirSync();

for (const ext of ["jasa", "acm"]) {
  const templateFolder = `${ext}-article`;
  const workingDir = join(tempDir, templateFolder);
  const extensionDir = join(workingDir, "_extensions", "quarto-journals", ext);
  ensureDirSync(workingDir);
  testQuartoCmd(
    "use",
    ["template", `quarto-journals/${ext}`, "--no-prompt"],
    [
      noErrorsOrWarnings,
      fileExists(`${templateFolder}.qmd`),
      folderExists(extensionDir),
      printsMessage({ level: "INFO", regex: /installed as/, negate: true }),
    ],
    {
      setup: () => {
        return Promise.resolve();
      },
      cwd: () => {
        return workingDir;
      },
      teardown: () => {
        try {
          Deno.removeSync(workingDir, { recursive: true });
        } catch {
        }
        return Promise.resolve();
      },
    },
  );
}

// Extensions keep no owner folder from the template source; the namespace
// comes from where the template is installed from, and a note says so (#15111)
const ownerNoteCases = [
  {
    folder: "owned-local",
    template: join(Deno.cwd(), docs(join("extensions", "owned-local"))),
    installed: ["coolster"],
    note: /'quarto-test\/coolster' installed as 'coolster'/,
  },
  {
    folder: "manuscript",
    template: "quarto-ext/manuscript-template-vscode",
    installed: ["quarto-ext", "agu"],
    note: /'quarto-journals\/agu' installed as 'quarto-ext\/agu'/,
  },
];
for (const ownerNoteCase of ownerNoteCases) {
  const caseWorkingDir = join(tempDir, ownerNoteCase.folder);
  ensureDirSync(caseWorkingDir);
  testQuartoCmd(
    "use",
    ["template", ownerNoteCase.template, "--no-prompt"],
    [
      noErrorsOrWarnings,
      folderExists(
        join(caseWorkingDir, "_extensions", ...ownerNoteCase.installed),
      ),
      printsMessage({ level: "INFO", regex: ownerNoteCase.note }),
    ],
    {
      cwd: () => {
        return caseWorkingDir;
      },
      teardown: () => {
        try {
          Deno.removeSync(caseWorkingDir, { recursive: true });
        } catch {
        }
        return Promise.resolve();
      },
    },
  );
}

const nonEmptyTemplateFolder = "notempty";
const nonEmptyFileName = `${nonEmptyTemplateFolder}.qmd`;
const nonEmptyWorkingDir = join(tempDir, nonEmptyTemplateFolder);
ensureDirSync(nonEmptyWorkingDir);

testQuartoCmd(
  "use",
  ["template", "quarto-journals/jasa", "--no-prompt"],
  [
    printsMessage({ level: "ERROR", regex: /directory isn't empty/ }),
    directoryContainsOnlyAllowedPaths(nonEmptyWorkingDir, [nonEmptyFileName]),
  ],
  {
    setup: () => {
      Deno.writeTextFileSync(
        join(nonEmptyWorkingDir, nonEmptyFileName),
        "Just making a non-empty file!",
      );
      return Promise.resolve();
    },
    cwd: () => {
      return nonEmptyWorkingDir;
    },
    teardown: () => {
      try {
        Deno.removeSync(nonEmptyWorkingDir, { recursive: true });
      } catch {
      }
      return Promise.resolve();
    },
  },
);

const starterFolder = "starterFolder";
const starterWorkingDir = join(tempDir, starterFolder);
ensureDirSync(starterWorkingDir);
testQuartoCmd(
  "use",
  ["template", "quarto-examples/website-template", "--no-prompt"],
  [noErrorsOrWarnings, fileExists("_quarto.yml"), fileExists("index.qmd")],
  {
    setup: () => {
      return Promise.resolve();
    },
    cwd: () => {
      return starterWorkingDir;
    },
    teardown: () => {
      try {
        Deno.removeSync(starterWorkingDir, { recursive: true });
      } catch {
      }
      return Promise.resolve();
    },
  },
);
