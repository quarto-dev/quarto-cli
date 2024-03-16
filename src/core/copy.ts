/*
 * copy.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  basename,
  dirname,
  join,
  relative,
  resolve,
} from "../deno_ral/path.ts";

import { CopyOptions, ensureDirSync, existsSync, walkSync } from "fs/mod.ts";
import { getFileInfoType } from "fs/_get_file_info_type.ts";
import { isSubdir } from "fs/_is_subdir.ts";

import { isWindows } from "./platform.ts";

// emulate the Deno copySync funnction but read and write files manually
// rather than calling Deno.copyFileSync (to avoid deno's attempt to
// modify the file permissions, see:
// https://github.com/denoland/deno/blob/1c05e41f37da022971f0090b2a92e6340d230055/runtime/ops/fs.rs#L914-L916
// which messes with the expectations of multi-user editing scenarios in RSW / RStudio Cloud)

export function copyTo(
  src: string,
  dest: string,
  options: CopyOptions = {
    overwrite: true,
  },
) {
  src = resolve(src);
  dest = resolve(dest);

  if (src === dest) {
    throw new Error("Source and destination cannot be the same.");
  }

  const srcStat = Deno.lstatSync(src);

  if (srcStat.isDirectory && isSubdir(src, dest)) {
    throw new Error(
      `Cannot copy '${src}' to a subdirectory of itself, '${dest}'.`,
    );
  }

  if (srcStat.isSymlink) {
    copySymlinkSync(src, dest, options);
  } else if (srcStat.isDirectory) {
    copyDirSync(src, dest, options);
  } else if (srcStat.isFile) {
    copyFileSync(src, dest, options);
  }
}

export function copyMinimal(
  srcDir: string,
  destDir: string,
  skip?: RegExp[],
  filter?: (path: string) => boolean,
) {
  // 2022-02-16: 0.125.0 walkSync appears to throw in the presence of .DS_Store
  skip = [...(skip || []), /\.DS_Store/];

  // build list of src files
  const srcFiles: string[] = [];
  for (
    const walk of walkSync(
      srcDir,
      {
        includeDirs: false,
        followSymlinks: false,
        skip,
      },
    )
  ) {
    // alias source file
    const srcFile = walk.path;

    // apply filter
    if (filter && !filter(srcFile)) {
      continue;
    }

    // add to src files
    srcFiles.push(srcFile);
  }

  // copy src files
  for (const srcFile of srcFiles) {
    if (!existsSync(srcFile)) {
      continue;
    }
    const destFile = join(destDir, relative(srcDir, srcFile));
    copyFileIfNewer(srcFile, destFile);
  }
}

export function copyFileIfNewer(srcFile: string, destFile: string) {
  // helper to perform the copy
  const doCopy = () => {
    copyTo(srcFile, destFile, {
      overwrite: true,
      preserveTimestamps: true,
    });
  };

  // ensure target dir
  ensureDirSync(dirname(destFile));

  // avoid copy if the file exists and we can validate that the src and dest
  // files have the same timestamp (there can be statSync errors in the case of
  // e.g. symlinks across volumsn so we also do the copy on errors accessing
  // file info)
  try {
    if (existsSync(destFile)) {
      const srcInfo = Deno.statSync(srcFile);
      const destInfo = Deno.statSync(destFile);
      if (!srcInfo.mtime || !destInfo.mtime || destInfo.mtime < srcInfo.mtime) {
        doCopy();
      }
    } else {
      doCopy();
    }
  } catch {
    doCopy();
  }
}

function copyFileSync(
  src: string,
  dest: string,
  options: InternalCopyOptions,
): void {
  ensureValidCopySync(src, dest, options);

  // remove the file first so that Deno.writeFileSync doesn't end up trying to
  // re-write the file permissions (which isn't allowed by the OS if there are
  // multiple users/owners in play). see this code for where this occurs:
  // https://github.com/denoland/deno/blob/1c05e41f37da022971f0090b2a92e6340d230055/runtime/ops/fs.rs#L914-L916
  if (existsSync(dest)) {
    Deno.removeSync(dest);
  }
  Deno.copyFileSync(src, dest);

  if (options.preserveTimestamps) {
    const statInfo = Deno.statSync(src);
    if (statInfo.atime && statInfo.mtime) {
      Deno.utimeSync(dest, statInfo.atime, statInfo.mtime);
    }
  }
}

function copyDirSync(src: string, dest: string, options: CopyOptions): void {
  const destStat = ensureValidCopySync(src, dest, {
    ...options,
    isFolder: true,
  });

  if (!destStat) {
    ensureDirSync(dest);
  }

  if (options.preserveTimestamps) {
    const srcStatInfo = Deno.statSync(src);
    if (srcStatInfo.atime && srcStatInfo.mtime) {
      Deno.utimeSync(dest, srcStatInfo.atime, srcStatInfo.mtime);
    }
  }

  for (const entry of Deno.readDirSync(src)) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, basename(srcPath as string));
    if (entry.isSymlink) {
      copySymlinkSync(srcPath, destPath, options);
    } else if (entry.isDirectory) {
      copyDirSync(srcPath, destPath, options);
    } else if (entry.isFile) {
      copyFileSync(srcPath, destPath, options);
    }
  }
}

function copySymlinkSync(
  src: string,
  dest: string,
  options: InternalCopyOptions,
): void {
  ensureValidCopySync(src, dest, options);
  // remove dest if it exists
  if (existsSync(dest)) {
    Deno.removeSync(dest);
  }
  const originSrcFilePath = Deno.readLinkSync(src);
  const type = getFileInfoType(Deno.lstatSync(src));
  if (isWindows()) {
    Deno.symlinkSync(originSrcFilePath, dest, {
      type: type === "dir" ? "dir" : "file",
    });
  } else {
    Deno.symlinkSync(originSrcFilePath, dest);
  }

  if (options.preserveTimestamps) {
    const statInfo = Deno.lstatSync(src);
    if (statInfo.atime && statInfo.mtime) {
      Deno.utimeSync(dest, statInfo.atime, statInfo.mtime);
    }
  }
}

interface InternalCopyOptions extends CopyOptions {
  /**
   * default is `false`
   */
  isFolder?: boolean;
}

function ensureValidCopySync(
  src: string,
  dest: string,
  options: InternalCopyOptions,
): Deno.FileInfo | undefined {
  let destStat: Deno.FileInfo;
  try {
    destStat = Deno.lstatSync(dest);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return;
    }
    throw err;
  }

  if (options.isFolder && !destStat.isDirectory) {
    throw new Error(
      `Cannot overwrite non-directory '${dest}' with directory '${src}'.`,
    );
  }
  if (!options.overwrite) {
    throw new Error(`'${dest}' already exists.`);
  }

  return destStat;
}
