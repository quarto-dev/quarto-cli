/*
* render-freeze.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { stringify } from "yaml/mod.ts";
import { dirname, join } from "path/mod.ts";
import { assert } from "testing/asserts.ts";

import { Metadata } from "../../../src/config/types.ts";
import { removeIfEmptyDir } from "../../../src/core/path.ts";
import { quarto } from "../../../src/quarto.ts";
import { ExecuteOutput, Verify } from "../../test.ts";
import { outputCreated } from "../../verify.ts";
import { testRender } from "./render.ts";

const regex = /output file: .*\.knit\.md/m;

const testFileName = "freeze-test";
const tempDir = Deno.makeTempDirSync();
const path = join(tempDir, `${testFileName}.qmd`);
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
    return Promise.resolve();
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
    return Promise.resolve();
  },
};

const projectOutputExists: Verify = {
  name: "Make sure project output exists",
  verify: (_output: ExecuteOutput[]) => {
    outputCreated(path, "html");
    return Promise.resolve();
  },
};

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
  const dir = dirname(path);
  const quartoProj = join(dir, "_quarto.yml");
  return {
    setup: async () => {
      // Write a quarto project
      await Deno.writeTextFile(
        quartoProj,
        "title: 'Hello Project'\nproject:\n  type: default\n",
      );

      // Write the test file
      await writeFile(
        path,
        frontMatter,
        markdown,
      );

      await quarto(["render", path]);
    },
    teardown: async () => {
      // Clean up the test file
      await Deno.remove(path);
      await Deno.remove(quartoProj);

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
  dirname(path) + "/",
  "html",
  false,
  [projectOutputExists, useFrozen],
  {
    name: "clean fzr - auto",
    ...testContext,
  },
);

// Render and mutate to be sure we ignore freezer
testRender(
  dirname(path) + "/",
  "html",
  false,
  [projectOutputExists, ignoreFrozen],
  {
    name: "dirty fzr - auto",
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
  dirname(path) + "/",
  "html",
  false,
  [projectOutputExists, useFrozen],
  {
    name: "dirty fzr - freeze",
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
