/*
* authors-name.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { ensureFileRegexMatches } from "../../verify.ts";
import { testRender } from "../render/render.ts";

// TODO: Add verification of the name parsing and breaking.
const authorNames = [
  "Mine",
  "Charles Teague",
  "Charles von Teague",
  "Alice Jane Malloc",
  "Memes, Cat Jane",
  "Memes, Cat J",
  "Memes, C J",
  "Ludwig von Beethoven",
  "\n  name: Prince",
  "\n  name:\n    literal: Pedro Martinez",
  "\n  name:\n    family: Teague\n    given: Charles",
];
const templateContents = `
<html>
<head></head>
<body>
$for(by-author)$
<p>LITERAL</p>
<p class="literal">$by-author.name.literal$</p>

<p>GIVEN</p>
<p class="given">$by-author.name.given$</p>

<p>FAMILY</p>
<p class="family">$by-author.name.family$</p>

<p>DROPPING PART</p>
<p class="dropping-particle">$by-author.name.dropping-particle$<p>

<p>NON-DROPPING PART</p>
<p class="non-dropping-particle">$by-author.name.non-dropping-particle$<p>
$endfor$
</body>
</html>
`;

const documentContents = `---
title: Hello World
author: !!author!!
template: !!template!!
---

## This is a test

This is the body
`;

for (const name of authorNames) {
  const template = Deno.makeTempFileSync();
  Deno.writeTextFileSync(template, templateContents);

  const document = Deno.makeTempFileSync({ suffix: ".qmd" });
  const documentReady = documentContents.replace("!!author!!", name).replace(
    "!!template!!",
    template,
  );
  Deno.writeTextFileSync(document, documentReady);
  testRender(document, "html", false, [
    ensureFileRegexMatches(document, []),
  ], {
    prereq: () => {
      console.log(`Testing author '${name}'`);
      return Promise.resolve(true);
    },
    setup: () => {
      return Promise.resolve();
    },
    teardown: () => {
      return Deno.remove(document);
    },
  });
}
