/*
 * project-render.test.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { existsSync } from "fs/mod.ts";
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
      (yaml: unknown) => {
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
      },
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

const bookPdfDir = bookOutDir;
const verifyPdfBook: Verify[] = [
  fileExists(join(bookPdfDir, "book.pdf")),
  directoryEmptyButFor(bookPdfDir, ["book.pdf"]),
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

const bookDocxDir = bookOutDir;
const verifyDocxBook: Verify[] = [
  fileExists(join(bookDocxDir, "book.docx")),
  directoryEmptyButFor(bookDocxDir, ["book.docx"]),
];
testQuartoCmd(
  "render",
  [bookProjDir, "--to", "docx"],
  verifyDocxBook,
  {
    teardown: async () => {
      if (existsSync(bookOutDir)) {
        await Deno.remove(bookOutDir, { recursive: true });
      }
    },
  },
);

const bookEpubDir = bookOutDir;
const verifyEpubBook: Verify[] = [
  fileExists(join(bookEpubDir, "book.epub")),
  directoryEmptyButFor(bookEpubDir, ["book.epub"]),
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
