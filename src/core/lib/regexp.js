/*
 * regexp.js (NB this is javascript and not typescript)
 *
 * Routines to manipulate regular expressions.
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 *
 */

import * as regexpp from "./external/regexpp.mjs";

function prefixesFromParse(parse) {
  if (parse.type === "Pattern" || parse.type === "CapturingGroup") {
    const alternatives = parse.alternatives.map(prefixesFromParse);
    return `(${alternatives.join("|")})`;
  } else if (parse.type === "Alternative") {
    const result = [];
    for (let i = 0; i < parse.elements.length; ++i) {
      const thisRe = [];
      for (let j = 0; j < i; ++j) {
        thisRe.push(parse.elements[j].raw);
      }
      thisRe.push(prefixesFromParse(parse.elements[i]));
      result.push(thisRe.join(""));
    }
    return `(${result.join("|")})`;
  } else if (parse.type === "RegExpLiteral") {
    return prefixesFromParse(parse.pattern);
  } else if (parse.type === "Character") {
    return `${parse.raw}?`;
  } else if (parse.type === "Quantifier") {
    if (parse.min === 0 && parse.max === 1) {
      // this is a ? quantifier
      return prefixesFromParse(parse.element);
    }
    if (parse.min === 1 && parse.max === Infinity) {
      // this is the + quantifier
      return `(${parse.element.raw}*)` + prefixesFromParse(parse.element);
    }
    if (parse.min === 0 && parse.max === Infinity) {
      // this is the kleene star
      // prefixes(p+) = prefixes(p*)
      return `(${parse.element.raw}*)` + prefixesFromParse(parse.element);
    } else {
      throw new Error(
        `Internal Error, can't handle quantifiers min=${parse.min} max=${parse.max}`
      );
    }
  } else if (parse.type === "CharacterSet") {
    return `${parse.raw}?`;
  } else if (parse.type === "CharacterClass") {
    return `${parse.raw}?`;
  }
  throw new Error(`Internal Error, don't know how to handle ${parse.type}`);
}

export function prefixes(regexp) {
  regexp = regexp.source;
  regexp = regexp.slice(1, -1);

  return new RegExp(
    "^" +
      prefixesFromParse(regexpp.parseRegExpLiteral(new RegExp(regexp))) +
      "$"
  );
}
