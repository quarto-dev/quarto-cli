/*
* config.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { stringify } from "encoding/yaml.ts";
import { join } from "path/mod.ts";

import { Metadata } from "../config/types.ts";
import { mergeConfigs } from "../core/config.ts";
import { readYaml, readYamlFromString } from "../core/yaml.ts";
import {
  kDefaultProjectPublishFile,
  projectPublishFile,
} from "../project/project-shared.ts";
import { ProjectContext } from "../project/types.ts";
import { ProjectPublish } from "./types.ts";

export function projectPublishConfig(
  project: ProjectContext,
): ProjectPublish {
  const projectDir = project.dir;
  const publishFile = projectPublishFile(projectDir);
  if (publishFile) {
    return readYaml(publishFile) as ProjectPublish;
  } else {
    return {} as ProjectPublish;
  }
}

export function updateProjectPublishConfig(
  target: ProjectContext,
  updateConfig: ProjectPublish,
) {
  let indent = 2;
  let baseConfig: Metadata = {};
  const projectDir = target.dir;
  const publishFile = projectPublishFile(projectDir);
  if (publishFile) {
    const publishFileYaml = Deno.readTextFileSync(publishFile);
    indent = detectIndentLevel(publishFileYaml);
    baseConfig = readYamlFromString(publishFileYaml) as Metadata;
  }
  const updatedConfig = mergeConfigs(baseConfig, updateConfig);
  Deno.writeTextFileSync(
    publishFile || join(projectDir, kDefaultProjectPublishFile),
    stringifyPublishConfig(updatedConfig, indent),
  );
}

function stringifyPublishConfig(config: Metadata, indent: number) {
  return stringify(
    config,
    {
      indent,
      sortKeys: false,
      skipInvalid: true,
    },
  );
}

function detectIndentLevel(yaml: string) {
  const spaceMatch = yaml.match(/\n(\s+)/);
  return spaceMatch ? spaceMatch[1].length : 2;
}
