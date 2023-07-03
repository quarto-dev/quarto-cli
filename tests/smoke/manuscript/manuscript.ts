/*
 * site.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { existsSync } from "fs/mod.ts";
import { basename, dirname, extname, join } from "path/mod.ts";
import { testQuartoCmd, Verify } from "../../test.ts";
import { siteOutputForInput } from "../../utils.ts";
import { ensureHtmlElements, noErrorsOrWarnings } from "../../verify.ts";

export type targetFormat = "html" | "jats" | "docx" | "pdf";

export const testManuscriptRender = (
  article: string,
  to: "all" | targetFormat,
  formats: targetFormat[],
  _expectedOutputs: string[],
  _articleVerify?: Verify[],
) => {
  const articleDir = dirname(article);

  const articleOuts = formats.map((fmt) => {
    return manuscriptOutputForInput(article, fmt);
  });

  // Render the manuscript
  testQuartoCmd(
    "render",
    [articleDir, "--to", to],
    [noErrorsOrWarnings],
    {
      teardown: () => {
        articleOuts.forEach((out) => {
          if (existsSync(out.outputPath)) {
            Deno.removeSync(out.outputPath);
          }

          if (out.supportPath && existsSync(out.supportPath)) {
            Deno.removeSync(out.supportPath, { recursive: true });
          }
        });
        return Promise.resolve();
      },
    },
  );
};

export const testManuscript = (
  article: string,
  renderTarget: string,
  includeSelectors: string[],
  excludeSelectors: string[],
  ...verify: Verify[]
) => {
  const output = siteOutputForInput(article);

  const verifySel = ensureHtmlElements(
    output.outputPath,
    includeSelectors,
    excludeSelectors,
  );

  // Run the command
  testQuartoCmd(
    "render",
    [renderTarget],
    [noErrorsOrWarnings, verifySel, ...verify],
    {
      teardown: async () => {
        const siteDir = dirname(output.outputPath);
        if (existsSync(siteDir)) {
          await Deno.remove(siteDir, { recursive: true });
        }
      },
    },
  );
};

function manuscriptOutputForInput(
  input: string,
  format: targetFormat,
) {
  let ext = "html";
  let supporting = true;
  if (format === "jats") {
    ext = "xml";
  } else if (format === "pdf") {
    ext = "pdf";
    supporting = false;
  } else if (format === "docx") {
    ext = "docx";
    supporting = false;
  }

  const dir = join(dirname(input), "_manuscript");
  const stem = basename(input, extname(input));

  const outputPath = join(dir, `${stem}.${ext}`);
  const supportPath = join(dir, `${stem}_files`);

  return {
    outputPath,
    supportPath: supporting ? supportPath : undefined,
  };
}
