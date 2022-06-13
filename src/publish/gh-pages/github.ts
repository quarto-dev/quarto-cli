/*
* git.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export type GitContext = {
  repo: boolean;
  origin: boolean;
  ghPages: boolean;
  siteUrl: string;
};

export function gitContext(dir: string) {
}

export function haveGitRepo(dir: string) {
}

export function haveGitOrigin(dir: string) {
}

export function haveGhPages(dir: string) {
}
