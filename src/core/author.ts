/*
* author.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export interface Author {
  name: string;
  affilliation?: Affiliation;
  orcid?: string;
}

export interface Affiliation {
  name: string;
}

const kName = "name";
const kAffiliation = "affiliation";
const kOrcid = "orcid";

export function parseAuthor(authorRaw: unknown) {
  if (authorRaw) {
    const parsed: Author[] = [];
    const authors = Array.isArray(authorRaw) ? authorRaw : [authorRaw];
    authors.forEach((author) => {
      if (typeof (author) === "string") {
        parsed.push({
          name: author,
        });
      } else if (typeof (author) === "object") {
        const name = author[kName];
        if (name) {
          const auth: Author = {
            name,
          };
          const affilation = author[kAffiliation];
          if (affilation) {
            auth.affilliation = { name: affilation };
          }

          const orcid = author[kOrcid];
          if (orcid) {
            auth.orcid = orcid;
          }

          parsed.push(auth);
        }
      }
    });
    return parsed;
  } else {
    return undefined;
  }
}
