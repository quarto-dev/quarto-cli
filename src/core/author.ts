/*
* author.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export interface Author {
  name: string;
  affilliation?: Affiliation;
}

export interface Affiliation {
  name: string;
}

const kName = "name";
const kAffiliation = "affiliation";

export function parseAuthor(authorRaw: unknown) {
  if (authorRaw) {
    const authors = Array.isArray(authorRaw) ? authorRaw : [authorRaw];
    return authors.map((author) => {
      if (typeof (author) === "string") {
        return {
          name: author,
        };
      } else if (typeof (author) === "object") {
        const name = author[kName];
        if (name) {
          const parsed: Author = {
            name,
          };
          const affilation = author[kAffiliation];
          if (affilation) {
            parsed.affilliation = { name: affilation };
          }
          return parsed;
        } else {
          // Not an author
          return undefined;
        }
      } else {
        throw new Error("Unexpected type for author " + typeof (author));
      }
    });
  } else {
    return undefined;
  }
}
