import { Provider, Versions } from "../provider.ts";
import { bold, brightBlue } from "../../deps.ts";

export interface GithubProviderOptions {
  repository: string;
  branches?: boolean;
  token?: string;
}

export interface GithubVersions extends Versions {
  tags: Array<string>;
  branches: Array<string>;
}

export class GithubProvider extends Provider {
  name = "github";
  private readonly repositoryUrl = "https://github.com/";
  private readonly registryUrl = "https://raw.githubusercontent.com/";
  private readonly apiUrl = "https://api.github.com/repos/";
  private readonly repositoryName: string;
  private readonly listBranches?: boolean;
  private readonly githubToken?: string;

  constructor({ repository, branches = true, token }: GithubProviderOptions) {
    super();
    this.repositoryName = repository;
    this.listBranches = branches;
    this.githubToken = token;
  }

  async getVersions(
    _name: string,
  ): Promise<GithubVersions> {
    const [tags, branches] = await Promise.all([
      this.gitFetch<Array<{ ref: string }>>("git/refs/tags"),
      this.gitFetch<Array<{ name: string; protected: boolean }>>("branches"),
    ]);

    const tagNames = tags
      .map((tag) => tag.ref.replace(/^refs\/tags\//, ""))
      .reverse();

    const branchNames = branches
      .sort((a, b) =>
        (a.protected === b.protected) ? 0 : (a.protected ? 1 : -1)
      )
      .map((tag) =>
        `${tag.name} ${tag.protected ? `(${bold("Protected")})` : ""}`
      )
      .reverse();

    return {
      versions: [
        ...tagNames,
        ...branchNames,
      ],
      latest: tagNames[0],
      tags: tagNames,
      branches: branchNames,
    };
  }

  getRepositoryUrl(_name: string): string {
    return new URL(`${this.repositoryName}/`, this.repositoryUrl).href;
  }

  getRegistryUrl(_name: string, version: string): string {
    return new URL(`${this.repositoryName}/${version}/`, this.registryUrl).href;
  }

  async listVersions(name: string, currentVersion?: string): Promise<void> {
    const { tags, branches } = await this.getVersions(name);
    const showBranches: boolean = !!this.listBranches && branches.length > 0;
    const indent = showBranches ? 2 : 0;
    if (showBranches) {
      console.log("\n" + " ".repeat(indent) + bold(brightBlue("Tags:\n")));
    }
    super.printVersions(tags, currentVersion, { indent });
    if (showBranches) {
      console.log("\n" + " ".repeat(indent) + bold(brightBlue("Branches:\n")));
      super.printVersions(branches, currentVersion, { maxCols: 5, indent });
      console.log();
    }
  }

  private getApiUrl(endpoint: string): string {
    return new URL(`${this.repositoryName}/${endpoint}`, this.apiUrl).href;
  }

  private async gitFetch<T>(endpoint: string): Promise<T> {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (this.githubToken) {
      headers.set(
        "Authorization",
        this.githubToken ? `token ${this.githubToken}` : "",
      );
    }
    const response = await fetch(
      this.getApiUrl(endpoint),
      {
        method: "GET",
        cache: "default",
        headers,
      },
    );

    if (!response.status) {
      throw new Error(
        "couldn't fetch versions - try again after sometime",
      );
    }

    const data: GithubResponse & T = await response.json();

    if (
      typeof data === "object" && "message" in data &&
      "documentation_url" in data
    ) {
      throw new Error(data.message + " " + data.documentation_url);
    }

    return data;
  }
}

interface GithubResponse {
  message: string;
  // deno-lint-ignore camelcase
  documentation_url: string;
}
