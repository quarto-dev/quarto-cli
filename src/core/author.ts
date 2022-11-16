/*
* author.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

export interface Author {
  name: string;
  affilliation?: Affiliation;
  url?: string;
  orcid?: string;
}

export interface Affiliation {
  name: string;
  url?: string;
}

const kName = "name";
const kAffiliation = "affiliation";
const kAfilliationUrl = "affiliation-url";
const kOrcid = "orcid";
const kUrl = "url";

export function parseAuthor(authorRaw: unknown, strict?: boolean) {
  if (authorRaw) {
    const parsed: Author[] = [];
    const authors = Array.isArray(authorRaw) ? authorRaw : [authorRaw];
    let unrecognized = 0;
    authors.forEach((author) => {
      if (typeof (author) === "string") {
        // Its a string, so make it a name
        parsed.push({
          name: author,
        });
      } else if (typeof (author) === "object") {
        // Parse the author object
        // Currently this only supports simple 'Distill Style'
        // authors and affiliations
        const name = author[kName];
        if (name) {
          const auth: Author = {
            name,
          };
          const affilation = author[kAffiliation];
          if (affilation) {
            auth.affilliation = { name: affilation };
            if (author[kAfilliationUrl]) {
              auth.affilliation.url = author[kAfilliationUrl];
            }
          }

          const orcid = author[kOrcid];
          if (orcid) {
            auth.orcid = orcid;
          }

          const url = author[kUrl];
          if (url) {
            auth.url = url;
          }

          parsed.push(auth);
        } else {
          unrecognized = unrecognized + 1;
        }
      }
    });

    // If we didn't know how to parse this author
    // just stand down - we just don't recognize this.
    if (strict && unrecognized > 0) {
      return undefined;
    } else {
      return parsed;
    }
  } else {
    return undefined;
  }
}
