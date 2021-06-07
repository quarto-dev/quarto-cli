/*
* render-freeze.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { stringify } from "encoding/yaml.ts";
import { dirname, join } from "path/mod.ts";
import { assert } from "testing/asserts.ts";

import { Metadata } from "../../../src/config/metadata.ts";
import { removeIfEmptyDir } from "../../../src/core/path.ts";
import { execProcess } from "../../../src/core/process.ts";
import { ExecuteOutput } from "../../test.ts";
import { docs } from "../../utils.ts";
import { testRender } from "./render.ts";

const regex = /^output file: .*\.knit\.md$/m;

const testFileName = "freeze-test";
const path = docs(`${testFileName}.qmd`);
const baseMeta: Metadata = {
  title: "Freeze Test",
  format: "html",
  freeze: true,
};
const baseMarkdown: string[] = [
  "## Freeze Testing Document",
  "",
  "```{r}",
  "plot(cars)",
  "```",
  "",
];

const useFrozen = {
  name: "Ensure using frozen execution",
  verify: (output: ExecuteOutput[]) => {
    output.forEach((msg) => {
      if (msg.levelName === "INFO") {
        assert(
          !msg.msg.match(regex),
          "Document was executed when it should've used the frozen result",
        );
      }
    });
  },
};

const ignoreFrozen = {
  name: "Ensure ignoring frozen execution",
  verify: (output: ExecuteOutput[]) => {
    const matches = output.some((msg) => {
      if (msg.levelName === "INFO") {
        return msg.msg.match(regex);
      }
    });
    assert(
      matches,
      "Document was not executed when it should have been",
    );
  },
};

// Write test file
// freeze: auto
// Render to populate freezer
// Confirm freezer is used

// Write test file
// freeze: auto
// Render to populate freezer
// Touch file
// Confirm freezer is not used

// Write test file
// freeze: true
// Render to populate freezer
// Touch file
// Confirm freezer is used

async function writeFile(
  path: string,
  frontMatter: Metadata,
  markdown: string[],
) {
  const yamlStr = stringify(frontMatter);
  await Deno.writeTextFile(
    path,
    ["---", yamlStr, "---", "", ...markdown].join("\n"),
  );
}

function testFileContext(
  path: string,
  frontMatter: Metadata,
  markdown: string[],
) {
  return {
    setup: async () => {
      // Write the test file
      await writeFile(
        path,
        frontMatter,
        markdown,
      );

      // Render to fill the freezer
      await execProcess({
        cmd: ["quarto", "render", path],
        stdout: "piped",
        stderr: "piped",
      });
    },
    teardown: async () => {
      // Clean up the test file
      await Deno.remove(path);

      // Get rid of the freezer
      const freezerDir = join(dirname(path), "_freeze");
      Deno.removeSync(join(freezerDir, testFileName), { recursive: true });

      // Maybe clean up empty freeze dir
      removeIfEmptyDir(freezerDir);
    },
  };
}

const testContext = testFileContext(path, baseMeta, baseMarkdown);
// Reader and use the freezer (freeze, auto)
testRender(
  path,
  "html",
  false,
  [useFrozen],
  testContext,
);

// Render and mutate to be sure we ignore freezer
testRender(
  path,
  "html",
  false,
  [ignoreFrozen],
  {
    setup: async () => {
      await testContext.setup();

      // mutate the file
      writeFile(path, { ...baseMeta, freeze: "auto" }, [
        ...baseMarkdown,
        "",
        "```{r}",
        "head(cars)",
        "```",
        "",
      ]);
    },
    teardown: testContext.teardown,
  },
);

// Render and mutate to be sure we ignore freezer
testRender(
  path,
  "html",
  false,
  [useFrozen],
  {
    setup: async () => {
      await testContext.setup();

      // mutate the file
      writeFile(path, baseMeta, [
        ...baseMarkdown,
        "",
        "```{r}",
        "head(cars)",
        "```",
        "",
      ]);
    },
    teardown: testContext.teardown,
  },
);
