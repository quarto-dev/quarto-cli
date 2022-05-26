/*
* filters-dependency.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export type DependencyType = "html" | "latex" | "file" | "text";

export type DependencyLocation = "in-header" | "before-body" | "after-body";

export interface FilterDependency {
  type: DependencyType;
  content:
    | FilterFileDependency
    | FilterTextDependency
    | FilterHTMLDependency
    | FilterLatexDependency;
}

export interface FilterLatexDependency {
  package: string;
  options: string[];
  rawtext: string[];
}

export interface FilterHTMLDependency {
  name: string;
  version: string;

  links: string[];
  scripts: string[];
  stylesheets: string[];
  resources: string[];
  //  meta:
}

export interface FilterTextDependency {
  text: string;
  location: DependencyLocation;
}

export interface FilterFileDependency {
  path: string;
  location: DependencyLocation;
}

const processFilterDependencies = (dependenciesFile: string) => {
  const fileContents = Deno.readTextFileSync(dependenciesFile);
  const dependenciesRaw = fileContents.split("\n");
  for (const dependencyRaw of dependenciesRaw) {
    const dependency = JSON.parse(dependencyRaw) as FilterDependency;
    switch (dependency.type) {
      case "html":
        break;
      case "latex":
        const latexDependency = dependency.content as FilterLatexDependency;
        if (latexDependency.package) {
          const options = latexDependency.options
            ? `[${latexDependency.options.join(",")}]`
            : "";
          const usePkg =
            `\\@ifpackageloaded{${latexDependency.package}}{}{\\usepackage${options}{${latexDependency.package}}}`;
        }

        break;
      case "file":
        break;
      case "text":
        break;
    }
  }
};
