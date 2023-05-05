/*
* giscus.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

export interface GithubDiscussionMetadata {
  repositoryId: string;
  categories: Array<{
    emoji: string;
    id: string;
    name: string;
  }>;
}

export function getDiscussionCategoryId(
  categoryName: string,
  metadata: GithubDiscussionMetadata,
) {
  // Fetch category info
  if (metadata.categories) {
    for (const category of metadata.categories) {
      if (category.name === categoryName) {
        return category.id;
      }
    }
  }
  return undefined;
}

export async function getGithubDiscussionsMetadata(repo: string) {
  const url = encodeURI(
    `https://giscus.app/api/discussions/categories?repo=${repo}`,
  );

  // Fetch repo info
  const response = await fetch(url);
  const jsonObj = await response.json();
  return jsonObj as GithubDiscussionMetadata;
}

export type GiscusThemeToggleRecord = {
  baseTheme: string;
  altTheme: string;
}

export type GiscusTheme = {
  light?: string;
  dark?: string;
} | string;

enum GiscusThemeDefault {
  light = "light",
  dark = "dark",
}

export const buildGiscusThemeKeys = (
  darkModeDefault: boolean,
  theme: GiscusTheme
): GiscusThemeToggleRecord => {
  if (typeof theme === "string") {
    if (theme.length > 0) {
      return { baseTheme: theme, altTheme: theme };
    } else {
      theme = { light: GiscusThemeDefault.light, dark: GiscusThemeDefault.dark };
    }
  }

  const themeRecord: { light: string; dark: string } = theme as {
    light: string;
    dark: string;
  };
  const result = {
    baseTheme: themeRecord.light ?? GiscusThemeDefault.light,
    altTheme: themeRecord.dark ?? GiscusThemeDefault.dark,
  };

  if (darkModeDefault) {
    [result.baseTheme, result.altTheme] = [result.altTheme, result.baseTheme];
  }

  return result;
};