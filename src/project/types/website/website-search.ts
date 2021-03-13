/*
* website-search.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { relative } from "path/mod.ts";

// @deno-types="fuse/dist/fuse.d.ts"
import Fuse from "fuse/dist/fuse.esm.min.js";

import { DOMParser } from "deno_dom/deno-dom-wasm.ts";

export function updateSearchIndex(
  outputDir: string,
  outputFiles: string[],
  incremental: boolean,
) {
  const options = {
    // isCaseSensitive: false,
    // includeScore: false,
    // shouldSort: true,
    // includeMatches: false,
    // findAllMatches: false,
    // minMatchCharLength: 1,
    // location: 0,
    // threshold: 0.6,
    // distance: 100,
    // useExtendedSearch: false,
    // ignoreLocation: false,
    // ignoreFieldNorm: false,
    keys: [
      "title",
      "author.firstName",
    ],
  };

  // create index data
  const indexData = outputFiles.map((file) => {
    // parse doc
    const fileRelative = relative(outputDir, file);
    const contents = Deno.readTextFileSync(file);
    const doc = new DOMParser().parseFromString(contents, "text/html")!;

    // determine title
    const titleEl = doc.querySelector("h1.title");
    const title = titleEl
      ? titleEl.textContent
      : fileRelative === "index.html"
      ? "Home"
      : "";

    // if there are level 2 sections then create sub-docs for them
    const sections = doc.querySelectorAll("section.level2");

    const main = doc.querySelector("main");
  });

  const fuse = new Fuse(list, options);

  const results = fuse.search("war");
}

const list = [
  {
    "title": "Old Man's War",
    "author": {
      "firstName": "John",
      "lastName": "Scalzi",
    },
  },
  {
    "title": "The Lock Artist",
    "author": {
      "firstName": "Steve",
      "lastName": "Hamilton",
    },
  },
  {
    "title": "HTML5",
    "author": {
      "firstName": "Remy",
      "lastName": "Sharp",
    },
  },
  {
    "title": "Right Ho Jeeves",
    "author": {
      "firstName": "P.D",
      "lastName": "Woodhouse",
    },
  },
  {
    "title": "The Code of the Wooster",
    "author": {
      "firstName": "P.D",
      "lastName": "Woodhouse",
    },
  },
  {
    "title": "Thank You Jeeves",
    "author": {
      "firstName": "P.D",
      "lastName": "Woodhouse",
    },
  },
  {
    "title": "The DaVinci Code",
    "author": {
      "firstName": "Dan",
      "lastName": "Brown",
    },
  },
  {
    "title": "Angels & Demons",
    "author": {
      "firstName": "Dan",
      "lastName": "Brown",
    },
  },
  {
    "title": "The Silmarillion",
    "author": {
      "firstName": "J.R.R",
      "lastName": "Tolkien",
    },
  },
  {
    "title": "Syrup",
    "author": {
      "firstName": "Max",
      "lastName": "Barry",
    },
  },
  {
    "title": "The Lost Symbol",
    "author": {
      "firstName": "Dan",
      "lastName": "Brown",
    },
  },
  {
    "title": "The Book of Lies",
    "author": {
      "firstName": "Brad",
      "lastName": "Meltzer",
    },
  },
  {
    "title": "Lamb",
    "author": {
      "firstName": "Christopher",
      "lastName": "Moore",
    },
  },
  {
    "title": "Fool",
    "author": {
      "firstName": "Christopher",
      "lastName": "Moore",
    },
  },
  {
    "title": "Incompetence",
    "author": {
      "firstName": "Rob",
      "lastName": "Grant",
    },
  },
  {
    "title": "Fat",
    "author": {
      "firstName": "Rob",
      "lastName": "Grant",
    },
  },
  {
    "title": "Colony",
    "author": {
      "firstName": "Rob",
      "lastName": "Grant",
    },
  },
  {
    "title": "Backwards, Red Dwarf",
    "author": {
      "firstName": "Rob",
      "lastName": "Grant",
    },
  },
  {
    "title": "The Grand Design",
    "author": {
      "firstName": "Stephen",
      "lastName": "Hawking",
    },
  },
  {
    "title": "The Book of Samson",
    "author": {
      "firstName": "David",
      "lastName": "Maine",
    },
  },
  {
    "title": "The Preservationist",
    "author": {
      "firstName": "David",
      "lastName": "Maine",
    },
  },
  {
    "title": "Fallen",
    "author": {
      "firstName": "David",
      "lastName": "Maine",
    },
  },
  {
    "title": "Monster 1959",
    "author": {
      "firstName": "David",
      "lastName": "Maine",
    },
  },
];
