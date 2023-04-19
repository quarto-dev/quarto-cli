/*
 * config.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { warning } from "log/mod.ts";
import { stringify } from "yaml/mod.ts";
import { basename, dirname, join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import * as ld from "../core/lodash.ts";

import { Metadata } from "../config/types.ts";
import { readYaml, readYamlFromString } from "../core/yaml.ts";
import { ProjectContext } from "../project/types.ts";
import { PublishDeployments, PublishRecord } from "./types.ts";
import { AccountToken } from "./provider-types.ts";
import { writePublishRecord } from "./common/data.ts";
import { existsSync1 } from "../core/file.ts";

export function readPublishDeployments(
  source: string,
): PublishDeployments {
  const [deployDir, deploySource] = resolveDeploymentSource(source);
  const deplomentsFile = publishDeploymentsFile(deployDir);
  if (deplomentsFile) {
    const deployments = readYaml(deplomentsFile);
    if (deployments) {
      if (isDeploymentsArray(deployments)) {
        const sourceDeployments = deployments.find((deployment) =>
          deployment.source === basename(deploySource)
        );
        if (sourceDeployments) {
          delete (sourceDeployments as { source?: string }).source;
          // provide 'code' field
          Object.values(sourceDeployments).forEach((deployment) => {
            if (Array.isArray(deployment)) {
              deployment = deployment.map((d) => {
                d.code = !!d.code;
                return d;
              });
            }
          });
          return {
            dir: deployDir,
            source: deploySource,
            records: sourceDeployments as Record<string, Array<PublishRecord>>,
          };
        }
      } else {
        warning(
          "Unexpcted format for _publish.yml file (not reading publish history)",
        );
      }
    }
  }

  return {
    dir: deployDir,
    source: deploySource,
    records: {},
  } as PublishDeployments;
}

export function writePublishDeployment(
  source: string,
  provider: string,
  account: AccountToken,
  publish: PublishRecord,
) {
  // don't write 'code' field if false
  publish = ld.cloneDeep(publish) as PublishRecord;
  if (publish.code === false) {
    delete (publish as Record<string, unknown>).code;
  }

  // read base config
  let indent = 2;
  const [deployDir, deploySource] = resolveDeploymentSource(source);
  const deploymentsFile = publishDeploymentsFile(deployDir);
  if (deploymentsFile) {
    const deploymentsFileYaml = Deno.readTextFileSync(deploymentsFile);
    indent = detectIndentLevel(deploymentsFileYaml);
    const deployments = readYamlFromString(deploymentsFileYaml);
    if (isDeploymentsArray(deployments)) {
      const docDeploymentsIdx = deployments.findIndex((deployment) =>
        deployment.source === basename(deploySource)
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
          source: deploySource,
          [provider]: [publish],
        };
        deployments.push(deployment);
      }

      Deno.writeTextFileSync(
        deploymentsFile,
        stringifyPublishConfig(deployments, indent),
      );
    } else {
      warning(
        "Unexpcted format for _publish.yml file (not writing to publish history)",
      );
    }
  } else {
    Deno.writeTextFileSync(
      join(deployDir, kDefaultPublishDeploymentsFile),
      stringifyPublishConfig([{
        source: deploySource,
        [provider]: [publish],
      }], indent),
    );
  }

  // write a record of which account was was used to publish
  // in a sidecar list so that we can pair it for republish
  writePublishRecord(source, provider, account, publish);
}

function resolveDeploymentSource(source: string) {
  const deployDir = Deno.statSync(source).isDirectory
    ? source
    : dirname(source);
  const deploySource = Deno.statSync(source).isDirectory
    ? "project"
    : basename(source);
  return [deployDir, deploySource];
}

export function readProjectPublishDeployments(
  project: ProjectContext,
): PublishDeployments {
  return readPublishDeployments(project.dir);
}

export function writeProjectPublishDeployment(
  project: ProjectContext,
  provider: string,
  account: AccountToken,
  publish: PublishRecord,
) {
  writePublishDeployment(project.dir, provider, account, publish);
}

function isDeploymentsArray(
  obj: unknown,
): obj is Array<Record<string, string | PublishRecord[]>> {
  return Array.isArray(obj) && typeof (obj[0].source) === "string";
}

function stringifyPublishConfig(config: unknown, indent: number) {
  return stringify(
    config as Metadata,
    {
      indent,
      lineWidth: -1,
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
    .find(existsSync1);
}
