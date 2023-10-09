/*
 * archive-binary-dependencies.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { join } from "path/mod.ts";
import { info } from "log/mod.ts";

import { execProcess } from "../../../src/core/process.ts";
import { Configuration, withWorkingDir } from "./config.ts";
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
  // TODO: Deal w/archive bin deps for this
  if (dependency.bucket === "deno") {
    return platformDependency.url + platformDependency.filename;
  } else {
    return `${kBucketBaseUrl}/${dependency.bucket}/${dependency.version}/${platformDependency.filename}`;
  }
}

// Archives dependencies (if they are not present in the archive already)
export async function archiveBinaryDependencies(_config: Configuration) {
  await withWorkingDir(async (workingDir) => {
    info(`Updating binary dependencies...\n`);

    for (const dependency of kDependencies) {
      await archiveBinaryDependency(dependency, workingDir);
    }
  });
}

// Archives dependencies (if they are not present in the archive already)
export async function checkBinaryDependencies(_config: Configuration) {
  await withWorkingDir(async (workingDir) => {
    info(`Updating binary dependencies...\n`);

    for (const dependency of kDependencies) {
      await checkBinaryDependency(dependency, workingDir);
    }
  });
}

export async function checkBinaryDependency(
  dependency: Dependency,
  workingDir: string,
) {
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
      if (platformDep) {
        // This dependency doesn't exist, archive it
        info(
          `Checking ${dependencyBucketPath} - ${platformDep.filename}`,
        );

        // Download the file
        await download(
          workingDir,
          platformDep,
        );
      }
    }
  };

  for (const arch of Object.keys(dependency.architectureDependencies)) {
    info(`Checking ${dependency.name}`);
    const archDep = dependency.architectureDependencies[arch];
    await archive(archDep);
  }

  info("");
}

export async function archiveBinaryDependency(
  dependency: Dependency,
  workingDir: string,
) {
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
      if (platformDep) {
        
        const dependencyAwsPath =
          `${kBucket}/${dependencyBucketPath}/${platformDep.filename}`;
        info(`Checking ${dependencyAwsPath}`);
        const response = await s3cmd("ls", [dependencyAwsPath]);
        if (response?.includes('Unable to locate credentials')) {
          throw new Error("Unable to locate S3 credentials, please try again.");
        }
        

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
    }
  };

  for (const arch of Object.keys(dependency.architectureDependencies)) {
    info(`Archiving ${dependency.name}`);
    const archDep = dependency.architectureDependencies[arch];
    await archive(archDep);
  }

  info("");
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
  if (response.status === 200) {
    const blob = await response.blob();

    const bytes = await blob.arrayBuffer();
    const data = new Uint8Array(bytes);

    const targetPath = join(workingDir, dependency.filename);
    Deno.writeFileSync(
      targetPath,
      data,
    );
    return targetPath;
  } else {
    throw new Error(
      `Failed to fetch dependency ${dependency.filename}.\nThe url ${dependency.url} returned a non 200 status code:\n${response.status} - ${response.statusText}`,
    );
  }
}
