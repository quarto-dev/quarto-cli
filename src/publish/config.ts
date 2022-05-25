/*
* config.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { stringify } from "encoding/yaml.ts";

import * as ld from "../core/lodash.ts";

import { Metadata } from "../config/types.ts";
import { mergeConfigs } from "../core/config.ts";
import { readYaml } from "../core/yaml.ts";
import {
  projectConfigFile,
  projectPublishFile,
} from "../project/project-shared.ts";
import { ProjectContext, ProjectPublish } from "../project/types.ts";
import { lines } from "../core/text.ts";

export function projectPublishConfig(
  project: ProjectContext,
): ProjectPublish {
  if (project?.config?.publish) {
    return normalizePublishConfig(project.config.publish);
  } else {
    return {} as ProjectPublish;
  }
}

export async function updateProjectPublishConfig(
  target: ProjectContext,
  config: ProjectPublish,
) {
  const projectDir = target.dir;
  const publishFile = projectPublishFile(projectDir);
  if (publishFile) {
    const baseConfig = normalizePublishConfig(
      (publishFile ? readYaml(publishFile) : {}) as ProjectPublish,
    );
    const updatedConfig = mergeConfigs(baseConfig, config);
    Deno.writeTextFileSync(
      publishFile,
      stringifyPublishConfig(updatedConfig, 2),
    );
  } else {
    // read existing config and merge
    const baseConfig = await projectPublishConfig(target) || {};
    const updatedConfig = mergeConfigs(baseConfig, config) as ProjectPublish;

    // read proj config and detect indent level
    const projConfig = projectConfigFile(projectDir)!;
    const projConfigYaml = Deno.readTextFileSync(projConfig);
    const indent = detectIndentLevel(projConfigYaml);

    // yaml to write
    const configYaml = stringifyPublishConfig(
      { publish: updatedConfig },
      indent,
    );

    // do line based scan for update
    const yamlLines = lines(projConfigYaml.trimEnd());
    const publishLine = yamlLines.findIndex((line) =>
      line.match(/^publish:\s*$/)
    );
    let updatedYamlLines = yamlLines;
    if (publishLine !== -1) {
      updatedYamlLines = yamlLines.slice(0, publishLine).concat(configYaml);
      // find the next top level key
      const nextKeyLine = yamlLines.slice(publishLine + 1).findIndex((line) =>
        line.match(/^[^ \t]/)
      );
      if (nextKeyLine !== -1) {
        updatedYamlLines.push(
          ...yamlLines.slice(publishLine + 1 + nextKeyLine),
        );
      }
    } else {
      updatedYamlLines.push("");
      updatedYamlLines = yamlLines.concat(configYaml);
    }
    Deno.writeTextFileSync(projConfig, updatedYamlLines.join("\n"));
  }
}

function normalizePublishConfig(config: ProjectPublish) {
  const publish = ld.cloneDeep(config) as ProjectPublish;
  Object.keys(publish).forEach((provider) => {
    if (typeof (publish[provider]) === "string") {
      publish[provider] = [publish[provider] as unknown as string];
    }
  });
  return publish;
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
