/*
 * site.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { existsSync } from "fs/mod.ts";
import { basename, dirname, extname, join } from "path/mod.ts";
import { testQuartoCmd, Verify } from "../../test.ts";
import { docs } from "../../utils.ts";
import {
  ensureMECAValidates,
  ensureXmlValidatesWithXsd,
  fileExists,
  noErrorsOrWarnings,
} from "../../verify.ts";
import { dirAndStem } from "../../../src/core/path.ts";

export type targetFormat = "html" | "jats" | "docx" | "pdf";
const enableJatsValidation = true;

export const testManuscriptRender = (
  article: string,
  to: "all" | targetFormat,
  formats: targetFormat[],
  expectedOutputs: string[],
  articleVerify: Verify[] = [],
) => {
  const articleDir = dirname(article);

  const verifications: Verify[] = [];
  const articleOuts = formats.map((fmt) => {
    const output = manuscriptOutputForInput(article, fmt);
    if (enableJatsValidation && fmt === "jats") {
      const xsdPath = docs(
        join("jats", "xsd", "JATS-Archiving-1-2-MathML2-DTD"),
      );

      // Test a basic JATS document that tests a variety of elements
      verifications.push(ensureXmlValidatesWithXsd(output.outputPath, xsdPath));

      // Validate the MECA file as well
      const [dir, stem] = dirAndStem(output.outputPath);
      const mecaFile = join(dir, `${stem}-meca.zip`);
     
      verifications.push(ensureMECAValidates(mecaFile));
    }
    return output;
  });

  articleOuts.forEach((out) => {
    verifications.push(fileExists(out.outputPath));
  });

  expectedOutputs.forEach((out) => {
    verifications.push(fileExists(join(articleDir, "_manuscript", out)));
  });


  // Render the manuscript
  testQuartoCmd(
    "render",
    [articleDir, "--to", to],
    [noErrorsOrWarnings, ...verifications, ...articleVerify],
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
