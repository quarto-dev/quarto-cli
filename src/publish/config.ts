/*
* config.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { stringify } from "encoding/yaml.ts";
import { join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import { Metadata } from "../config/types.ts";
import { readYaml, readYamlFromString } from "../core/yaml.ts";
import { ProjectContext } from "../project/types.ts";
import { PublishDeployments, PublishRecord } from "./types.ts";

export function projectPublishDeployments(
  project: ProjectContext,
): PublishDeployments {
  const deplomentsFile = publishDeploymentsFile(project.dir);
  if (deplomentsFile) {
    return readYaml(deplomentsFile) as PublishDeployments;
  } else {
    return {} as PublishDeployments;
  }
}

export function recordProjectPublishDeployment(
  project: ProjectContext,
  provider: string,
  publish: PublishRecord,
) {
  // read base config
  let indent = 2;
  let deployments: PublishDeployments = {};
  const projectDir = project.dir;
  const deploymentsFile = publishDeploymentsFile(project.dir);
  if (deploymentsFile) {
    const deploymentsFileYaml = Deno.readTextFileSync(deploymentsFile);
    indent = detectIndentLevel(deploymentsFileYaml);
    deployments = readYamlFromString(deploymentsFileYaml) as PublishDeployments;
  }

  // update as required
  if (deployments[provider]) {
    const deploymentIdx = deployments[provider].findIndex(
      (published) => published.id === publish.id,
    );
    if (deploymentIdx !== -1) {
      deployments[provider][deploymentIdx] = publish;
    } else {
      deployments[provider].push(publish);
    }
  } else {
    deployments[provider] = [publish];
  }

  Deno.writeTextFileSync(
    deploymentsFile || join(projectDir, kDefaultPublishDeploymetsFile),
    stringifyPublishConfig(deployments, indent),
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

const kDefaultPublishDeploymetsFile = "_publish.yml";

export function publishDeploymentsFile(dir: string): string | undefined {
  return [kDefaultPublishDeploymetsFile, "_publish.yaml"]
    .map((file) => join(dir, file))
    .find(existsSync);
}
