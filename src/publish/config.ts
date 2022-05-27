/*
* config.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { warning } from "log/mod.ts";
import { stringify } from "encoding/yaml.ts";
import { basename, dirname, join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import { Metadata } from "../config/types.ts";
import { readYaml, readYamlFromString } from "../core/yaml.ts";
import { ProjectContext } from "../project/types.ts";
import { PublishDeployments, PublishRecord } from "./types.ts";

export function documentPublishDeployments(
  document: string,
): PublishDeployments {
  const deplomentsFile = publishDeploymentsFile(dirname(document));
  if (deplomentsFile) {
    const deployments = readYaml(deplomentsFile);
    if (deployments) {
      if (isDeploymentsArray(deployments)) {
        const docDeployment = deployments.find((deployment) =>
          deployment.document === basename(document)
        );
        if (docDeployment) {
          delete (docDeployment as { document?: string }).document;
          return docDeployment as PublishDeployments;
        }
      } else {
        warning(
          "Unexpcted format for _publish.yml file (not reading publish history)",
        );
      }
    }
  }

  return {} as PublishDeployments;
}

export function recordDocumentPublishDeployment(
  document: string,
  provider: string,
  publish: PublishRecord,
) {
  // read base config
  let indent = 2;
  const deploymentsFile = publishDeploymentsFile(dirname(document));
  if (deploymentsFile) {
    const deploymentsFileYaml = Deno.readTextFileSync(deploymentsFile);
    indent = detectIndentLevel(deploymentsFileYaml);
    const deployments = readYamlFromString(deploymentsFileYaml);
    if (isDeploymentsArray(deployments)) {
      const docDeploymentsIdx = deployments.findIndex((deployment) =>
        deployment.document === basename(document)
      );
      if (docDeploymentsIdx !== -1) {
        const docDeployments = deployments[docDeploymentsIdx];
        if (docDeployments[provider]) {
          const deploymentIdx = (docDeployments[provider] as PublishRecord[])
            .findIndex(
              (published) => published.id === publish.id,
            );
          if (deploymentIdx !== -1) {
            (docDeployments[provider] as PublishRecord[])[deploymentIdx] =
              publish;
          } else {
            (docDeployments[provider] as PublishRecord[]).push(publish);
          }
        } else {
          docDeployments[provider] = [publish];
        }
      } else {
        const deployment = {
          document: basename(document),
          [provider]: [publish],
        };
        deployments.push(deployment);
      }

      Deno.writeTextFileSync(
        deploymentsFile,
        // deno-lint-ignore no-explicit-any
        stringify(deployments as any, {
          indent,
          sortKeys: false,
          skipInvalid: true,
        }),
      );
    } else {
      warning(
        "Unexpcted format for _publish.yml file (not writing to publish history)",
      );
    }
  } else {
    Deno.writeTextFileSync(
      join(dirname(document), kDefaultPublishDeploymentsFile),
      stringify([{
        document: basename(document),
        [provider]: [publish],
        // deno-lint-ignore no-explicit-any
      }] as any, {
        indent,
        sortKeys: false,
        skipInvalid: true,
      }),
    );
  }
}

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
    deploymentsFile || join(projectDir, kDefaultPublishDeploymentsFile),
    stringifyPublishConfig(deployments, indent),
  );
}

function isDeploymentsArray(
  obj: unknown,
): obj is Array<Record<string, string | PublishRecord[]>> {
  return Array.isArray(obj) && typeof (obj[0].document) === "string";
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

const kDefaultPublishDeploymentsFile = "_publish.yml";

export function publishDeploymentsFile(dir: string): string | undefined {
  return [kDefaultPublishDeploymentsFile, "_publish.yaml"]
    .map((file) => join(dir, file))
    .find(existsSync);
}
