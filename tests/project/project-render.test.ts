/*
* project-render.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";

import { testQuartoCmd, Verify } from "../test.ts";
import {
  directoryEmptyButFor,
  fileExists,
  hasSupportingFiles,
} from "../verify.ts";

// Simple project render
const expectedFiles = ["plain.qmd", "plain2.qmd"];
const verify = expectedFiles.flatMap((filename) => {
  const input = join("docs/project/plain", filename);
  return [
    fileExists(input),
    hasSupportingFiles(input, "html"),
  ];
});
testQuartoCmd(
  "render",
  ["docs/project/plain", "--to", "html"],
  verify,
  {
    teardown: () => {
      ["plain.html", "plain2.html", "plain_files", "plain2_files"].forEach(
        (file) => {
          const path = join("docs/project/plain", file);
          if (existsSync(path)) {
            Deno.removeSync(path, { recursive: true });
          }
        },
      );
      return Promise.resolve();
    },
  },
);

// Book render
const outDir = "_book";
const bookProjDir = "docs/project/book";
const bookOutDir = join(bookProjDir, outDir);

const verifyPdfBook: Verify[] = [
  fileExists(join(bookOutDir, "book.pdf")),
  directoryEmptyButFor(bookOutDir, "book.pdf"),
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
  directoryEmptyButFor(bookOutDir, "book.docx"),
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

const verifyEpubBook: Verify[] = [
  fileExists(join(bookOutDir, "book.epub")),
  directoryEmptyButFor(bookOutDir, "book.epub"),
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
        console.log("clean " + bookOutDir);
        await Deno.remove(bookOutDir, { recursive: true });
      }
    },
  },
);
