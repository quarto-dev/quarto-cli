/*
* project-render.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { exists, existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";

import { Metadata } from "../../../src/config/types.ts";

import { testQuartoCmd, Verify } from "../../test.ts";
import { docs } from "../../utils.ts";
import {
  directoryEmptyButFor,
  fileExists,
  verifyYamlFile,
} from "../../verify.ts";

import {
  cleanWorking,
  kProjectWorkingDir,
  kQuartoProjectFile,
} from "./common.ts";

// A book project
testQuartoCmd(
  "create-project",
  [kProjectWorkingDir, "--type", "book"],
  [
    fileExists(kQuartoProjectFile),
    fileExists(join(kProjectWorkingDir, "index.qmd")),
    fileExists(join(kProjectWorkingDir, "references.bib")),
    verifyYamlFile(
      kQuartoProjectFile,
      ((yaml: unknown) => {
        // Make sure there is a project yaml section
        const metadata = yaml as Metadata;
        if (
          metadata["project"] !== undefined && metadata["book"] !== undefined
        ) {
          const type = (metadata["project"] as Metadata)["type"];
          return type === "book";
        } else {
          return false;
        }
      }),
    ),
  ],
  {
    setup: cleanWorking,
    teardown: cleanWorking,
  },
);

// Book render
const outDir = "_book";
const bookProjDir = docs("project/book");
const bookOutDir = join(bookProjDir, outDir);

const verifyPdfBook: Verify[] = [
  fileExists(join(bookOutDir, "book.pdf")),
  directoryEmptyButFor(bookOutDir, ["book.pdf"]),
];
testQuartoCmd(
  "render",
  [bookProjDir, "--to", "pdf"],
  verifyPdfBook,
  {
    teardown: async () => {
      if (existsSync(bookOutDir)) {
        await Deno.remove(bookOutDir, { recursive: true });
      }
    },
  },
);

const verifyDocxBook: Verify[] = [
  fileExists(join(bookOutDir, "book.docx")),
  directoryEmptyButFor(bookOutDir, ["book.docx"]),
];
testQuartoCmd(
  "render",
  [bookProjDir, "--to", "docx"],
  verifyDocxBook,
  {
    teardown: async () => {
      if (await exists(bookOutDir)) {
        await Deno.remove(bookOutDir, { recursive: true });
      }
    },
  },
);

const verifyEpubBook: Verify[] = [
  fileExists(join(bookOutDir, "book.epub")),
  directoryEmptyButFor(bookOutDir, ["book.epub"]),
];
testQuartoCmd(
  "render",
  [bookProjDir, "--to", "epub"],
  verifyEpubBook,
  {
    teardown: async () => {
      if (existsSync(bookOutDir)) {
        await Deno.remove(bookOutDir, { recursive: true });
      }
    },
  },
);

const verifyHtmlBook: Verify[] = [
  "index.html",
  "intro.html",
  "references.html",
  "search.json",
  "site_libs",
  "summary.html",
].map((path) => {
  return fileExists(join(bookOutDir, path));
});
testQuartoCmd(
  "render",
  [bookProjDir, "--to", "html"],
  verifyHtmlBook,
  {
    teardown: async () => {
      if (existsSync(bookOutDir)) {
        await Deno.remove(bookOutDir, { recursive: true });
      }
    },
  },
);
