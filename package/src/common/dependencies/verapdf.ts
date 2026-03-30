/*
 * verapdf.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Dependency } from "./dependencies.ts";

export function verapdf(version: string): Dependency {
  // VeraPDF is a Java application distributed as an installer ZIP.
  // The same artifact works on all platforms.
  const filename = `verapdf-greenfield-${version}-installer.zip`;
  // Version format is X.Y.Z, but releases are organized under X.Y directories
  const majorMinor = version.substring(0, version.lastIndexOf("."));
  const url =
    `https://software.verapdf.org/releases/${majorMinor}/${filename}`;

  // VeraPDF is an archive-only dependency - it's uploaded to S3 for
  // `quarto install verapdf` but not automatically installed during configure.
  // This is because it requires Java and is only needed for PDF/A validation.
  const release = {
    filename,
    url,
    configure: async () => {
      // No-op: verapdf is installed via `quarto install verapdf`, not configure.sh
    },
  };

  return {
    name: "VeraPDF",
    bucket: "verapdf",
    version,
    archiveOnly: true,
    // Same artifact for all platforms since it's Java
    architectureDependencies: {
      "x86_64": {
        "darwin": release,
        "linux": release,
        "windows": release,
      },
      "aarch64": {
        "darwin": release,
        "linux": release,
      },
    },
  };
}
