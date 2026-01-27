/*
 * render-typst-package-staging.test.ts
 *
 * Tests that typst packages are staged to .quarto/typst/packages/ during render:
 * - Built-in packages (marginalia) from quarto resources
 * - Extension @preview packages from typst/packages/preview/ directories
 * - Extension @local packages from typst/packages/local/ directories
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { join } from "../../../src/deno_ral/path.ts";
import { docs } from "../../utils.ts";
import { testRender } from "./render.ts";
import { fileExists } from "../../verify.ts";
import { safeRemoveSync } from "../../../src/core/path.ts";

const input = docs("render/typst-package-staging/test.qmd");
const projectDir = docs("render/typst-package-staging");
const stagedPackages = join(projectDir, ".quarto/typst/packages");

// Verify extension @preview package was staged
const helloPackage = join(stagedPackages, "preview/hello/0.1.0");
const helloManifest = join(helloPackage, "typst.toml");

// Verify extension @local package was staged
const confettiPackage = join(stagedPackages, "local/confetti/0.1.0");
const confettiManifest = join(confettiPackage, "typst.toml");

// Verify built-in marginalia package was staged (triggered by margin note)
const marginaliaPackage = join(stagedPackages, "preview/marginalia/0.3.1");
const marginaliaManifest = join(marginaliaPackage, "typst.toml");

testRender(
  input,
  "test-ext-typst",
  true, // no supporting files
  [
    // Extension @preview package
    fileExists(helloPackage),
    fileExists(helloManifest),
    // Extension @local package
    fileExists(confettiPackage),
    fileExists(confettiManifest),
    // Built-in marginalia package
    fileExists(marginaliaPackage),
    fileExists(marginaliaManifest),
  ],
  {
    teardown: async () => {
      // Clean up the .quarto directory
      safeRemoveSync(join(projectDir, ".quarto"), { recursive: true });
    },
  },
);
