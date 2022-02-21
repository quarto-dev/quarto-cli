/*
* giscus.ts
*
* Copyright (C) 2020 by RStudio, PBC
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
