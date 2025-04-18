import { testQuartoCmd } from "../../test.ts";
import { directoryContainsOnlyAllowedPaths, fileExists, folderExists, noErrorsOrWarnings, printsMessage } from "../../verify.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { ensureDirSync } from "../../../src/deno_ral/fs.ts";

const tempDir = Deno.makeTempDirSync();

const templateFolder = "article";
const workingDir = join(tempDir, templateFolder);
const extensionsDir = join(workingDir, "_extensions");
ensureDirSync(workingDir);
testQuartoCmd(
  "use",
  ["template", "quarto-journals/jasa", "--no-prompt"],
  [noErrorsOrWarnings, fileExists(`${templateFolder}.qmd`), folderExists(extensionsDir)],
  {
    setup: () => {
      return Promise.resolve();
    },
    cwd: () => {
      return workingDir;
    },
    teardown: () => {
      try {
       Deno.removeSync(workingDir, {recursive: true});
      } catch {

      }
       return Promise.resolve();
    }
  }
)

const nonEmptyTemplateFolder = "notempty";
const nonEmptyFileName = `${nonEmptyTemplateFolder}.qmd`;
const nonEmptyWorkingDir = join(tempDir, nonEmptyTemplateFolder);
ensureDirSync(nonEmptyWorkingDir);

testQuartoCmd(
  "use",
  ["template", "quarto-journals/jasa", "--no-prompt"],
  [printsMessage({level: "ERROR", regex: /directory isn't empty/}), directoryContainsOnlyAllowedPaths(nonEmptyWorkingDir, [nonEmptyFileName])],
  {
    setup: () => {
      Deno.writeTextFileSync(join(nonEmptyWorkingDir, nonEmptyFileName), "Just making a non-empty file!");
      return Promise.resolve();
    },
    cwd: () => {
      return nonEmptyWorkingDir;
    },
    teardown: () => {
      try {
       Deno.removeSync(nonEmptyWorkingDir, {recursive: true});
      } catch {
        
      }
       return Promise.resolve();
    }
  }
)

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
       Deno.removeSync(starterWorkingDir, {recursive: true});
      } catch {
        
      }
       return Promise.resolve();
    }
  }
)
