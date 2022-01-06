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
  ArchitectureDependency,
  Dependency,
  kDependencies,
  PlatformDependency,
} from "./dependencies/dependencies.ts";

const kBucket = "s3://rstudio-buildtools/quarto";
const kBucketBaseUrl = "https://s3.amazonaws.com/rstudio-buildtools/quarto";

// Provides a URL in the archive for a dependency
export function archiveUrl(
  dependency: Dependency,
  platformDependency: PlatformDependency,
) {
  return `${kBucketBaseUrl}/${dependency.bucket}/${dependency.version}/${platformDependency.filename}`;
}

// Archives dependencies (if they are not present in the archive already)
export async function archiveBinaryDependencies(_config: Configuration) {
  await withWorkingDir(async (workingDir) => {
    info(`Updating binary dependencies...\n`);

    for (const dependency of kDependencies) {
      info(`** ${dependency.name} ${dependency.version} **`);

      const dependencyBucketPath = `${dependency.bucket}/${dependency.version}`;
      info("Checking archive status...\n");

      const archive = async (
        architectureDependency: ArchitectureDependency,
      ) => {
        const platformDeps = [
          architectureDependency.darwin,
          architectureDependency.linux,
          architectureDependency.windows,
        ];
        for (const platformDep of platformDeps) {
          const dependencyAwsPath =
            `${kBucket}/${dependencyBucketPath}/${platformDep.filename}`;
          const response = await s3cmd("ls", [dependencyAwsPath]);
          if (!response) {
            // This dependency doesn't exist, archive it
            info(
              `Archiving ${dependencyBucketPath} - ${platformDep.filename}`,
            );

            // Download the file
            const localPath = await download(
              workingDir,
              platformDep,
            );

            // Sync to S3
            info(`Copying to ${dependencyAwsPath}\n`);
            await s3cmd("cp", [
              localPath,
              dependencyAwsPath,
              "--acl",
              "public-read",
            ]);
          } else {
            info(`${dependencyAwsPath} already archived.`);
          }
        }
      };

      for (const arch of Object.keys(dependency.architectureDependencies)) {
        info(`Archiving ${dependency.name}`);
        const archDep = dependency.architectureDependencies[arch];
        await archive(archDep);
      }

      info("");
    }
  });
}

// Utility that provides a working directory and cleans it up
async function withWorkingDir(fn: (wkDir: string) => Promise<void>) {
  const workingDir = Deno.makeTempDirSync();
  try {
    await fn(workingDir);
  } finally {
    Deno.removeSync(workingDir, { recursive: true });
  }
}

async function s3cmd(cmd: string, args: string[]) {
  const s3Command = ["aws", "s3", cmd, ...args];
  const p = await execProcess({
    cmd: s3Command,
    stdout: "piped",
  });

  return p.stdout || p.stderr;
}

async function download(
  workingDir: string,
  dependency: PlatformDependency,
) {
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
