/*
* archive-binary-dependencies.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";
import { info } from "log/mod.ts";

import { execProcess } from "../../../src/core/process.ts";
import { Configuration } from "./config.ts";
import {
  Dependency,
  kDependencies,
  PlatformDependency,
} from "./dependencies/dependencies.ts";

const kBucket = "s3://rstudio-buildtools/quarto";
const kBucketBaseUrl = "https://s3.amazonaws.com/rstudio-buildtools/quarto";

export function archiveUrl(
  dependency: Dependency,
  platformDependency: PlatformDependency,
) {
  return `${kBucketBaseUrl}/${dependency.bucket}/${dependency.version}/${platformDependency.filename}`;
}

export async function archiveBinaryDependencies(_config: Configuration) {
  const workingDir = Deno.makeTempDirSync();

  info(`Updating binary dependencies...\n`);

  for (const dependency of kDependencies) {
    info(`** ${dependency.name} ${dependency.version} **`);

    const dependencyBucketPath = pathForDependency(dependency);
    info("Checking archive status...\n");
    const deps = [dependency.darwin, dependency.linux, dependency.windows];
    for (const dep of deps) {
      if (dep) {
        info(`${dep?.filename}`);
        const dependencyAwsPath =
          `${kBucket}/${dependencyBucketPath}/${dep.filename}`;
        const response = await s3cmd("ls", [dependencyAwsPath]);
        if (!response) {
          // This dependency doesn't exist, archive it
          info(`Archiving ${dependencyBucketPath} - ${dep.filename}`);

          // Download the file
          const localPath = await download(workingDir, dep);

          // Sync to S3
          info(`Copying to ${dependencyAwsPath}\n`);
          s3cmd("cp", [localPath, dependencyAwsPath]);
        } else {
          info(`File ${dep.filename} skipped\n`);
        }
      }
    }
    info("");
  }

  Deno.removeSync(workingDir, { recursive: true });
}

function pathForDependency(dependency: Dependency) {
  return `${dependency.bucket}/${dependency.version}`;
}

async function s3cmd(cmd: string, args: string[]) {
  const s3Command = ["aws", "s3", cmd, ...args];
  const p = await execProcess({
    cmd: s3Command,
    stdout: "piped",
  });

  return p.stdout || p.stderr;
}

async function download(workingDir: string, dependency: PlatformDependency) {
  info("Downloading " + dependency.url);
  const response = await fetch(dependency.url);
  const blob = await response.blob();

  const bytes = await blob.arrayBuffer();
  const data = new Uint8Array(bytes);

  const targetPath = join(workingDir, dependency.filename);
  Deno.writeFileSync(
    targetPath,
    data,
  );
  return targetPath;
}
