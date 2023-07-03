/*
 * site.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { existsSync } from "fs/mod.ts";
import { basename, dirname, extname, join } from "path/mod.ts";
import { testQuartoCmd, Verify } from "../../test.ts";
import { fileExists, noErrorsOrWarnings } from "../../verify.ts";

export type targetFormat = "html" | "jats" | "docx" | "pdf";

export const testManuscriptRender = (
  article: string,
  to: "all" | targetFormat,
  formats: targetFormat[],
  expectedOutputs: string[],
  articleVerify: Verify[] = [],
) => {
  const articleDir = dirname(article);

  const articleOuts = formats.map((fmt) => {
    return manuscriptOutputForInput(article, fmt);
  });

  const verifyFileExists = articleOuts.map((out) => {
    return fileExists(out.outputPath);
  });

  expectedOutputs.forEach((out) => {
    verifyFileExists.push(fileExists(join(articleDir, "_manuscript", out)));
  });

  // Render the manuscript
  testQuartoCmd(
    "render",
    [articleDir, "--to", to],
    [noErrorsOrWarnings, ...verifyFileExists, ...articleVerify],
    {
      teardown: () => {
        articleOuts.forEach((out) => {
          if (existsSync(out.manuscriptDir)) {
            Deno.removeSync(out.manuscriptDir, { recursive: true });
          }
        });
        return Promise.resolve();
      },
    },
  );
};

function manuscriptOutputForInput(
  input: string,
  format: targetFormat,
) {
  const inputStem = basename(input, extname(input));
  let ext = "html";
  let stem = inputStem;

  let supporting = true;
  if (format === "jats") {
    ext = "xml";
  } else if (format === "pdf") {
    ext = "pdf";
    supporting = false;
  } else if (format === "docx") {
    ext = "docx";
    supporting = false;
  } else if (format === "html") {
    stem = "index";
  }

  const dir = join(dirname(input), "_manuscript");

  const outputPath = join(dir, `${stem}.${ext}`);
  const supportPath = join(dir, `${stem}_files`);

  return {
    outputPath,
    supportPath: supporting ? supportPath : undefined,
    manuscriptDir: dir,
  };
}
