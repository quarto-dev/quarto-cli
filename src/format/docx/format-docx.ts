/*
 * format-docx.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { kFilterParams } from "../../config/constants.ts";
import { Format, FormatExtras, PandocFlags } from "../../config/types.ts";
import { mergeConfigs } from "../../core/config.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { createWordprocessorFormat } from "../formats-shared.ts";
import { unzip, zip } from "../../core/zip.ts";
import { join, resolve } from "../../deno_ral/path.ts";

const kIconCaution = "icon-caution";
const kIconImportant = "icon-important";
const kIconNote = "icon-note";
const kIconTip = "icon-tip";
const kIconWarning = "icon-warning";

const kLineNumbers = "line-numbers";

export function docxFormat(): Format {
  return mergeConfigs(
    createWordprocessorFormat("MS Word", "docx"),
    {
      formatExtras: (
        _input: string,
        _markdown: string,
        _flags: PandocFlags,
        format: Format,
      ): FormatExtras => {
        const extras: FormatExtras = {
          [kFilterParams]: {
            [kIconCaution]: iconPath("caution.png"),
            [kIconImportant]: iconPath("important.png"),
            [kIconNote]: iconPath("note.png"),
            [kIconTip]: iconPath("tip.png"),
            [kIconWarning]: iconPath("warning.png"),
          },
        };
        // `line-numbers: true` enables continuous Word line numbering. Word
        // stores it in each section's <w:sectPr>, which pandoc writes from the
        // reference doc after filters run, so it can only be applied by a
        // post-processor on the finished file (see addDocxLineNumbers).
        const lineNumbers = format.metadata[kLineNumbers];
        if (lineNumbers === true || lineNumbers === "true") {
          extras.postprocessors = [addDocxLineNumbers];
        }
        return extras;
      },
      extensions: {
        book: {
          selfContainedOutput: true,
        },
      },
    },
  );
}

function iconPath(icon: string) {
  return formatResourcePath("docx", icon);
}

// Turn on continuous line numbering by adding <w:lnNumType> to the section
// properties (<w:sectPr>) already present in the rendered document. Because we
// edit the existing sections — which carry the header references and page size
// — the running head and paper size (Letter, A4, etc.) are preserved.
async function addDocxLineNumbers(
  output: string,
): Promise<{ supporting?: string[]; resources?: string[] } | void> {
  const outputPath = resolve(output);
  const tempDir = await Deno.makeTempDir();
  try {
    await unzip(outputPath, tempDir);
    const documentXml = join(tempDir, "word", "document.xml");
    const xml = await Deno.readTextFile(documentXml);
    // Add line numbering to each section that lacks it (idempotent). The regex
    // assumes sections are not nested, which holds for pandoc/Quarto output.
    const updated = xml.replace(
      /<w:sectPr\b[\s\S]*?<\/w:sectPr>/g,
      (sectPr) =>
        sectPr.includes("<w:lnNumType") ? sectPr : sectPr.replace(
          "</w:sectPr>",
          '<w:lnNumType w:countBy="1" w:restart="continuous"/></w:sectPr>',
        ),
    );
    await Deno.writeTextFile(documentXml, updated);
    // Repackage the edited document parts back into the .docx.
    await Deno.remove(outputPath);
    await zip(["."], outputPath, { cwd: tempDir });
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
}
