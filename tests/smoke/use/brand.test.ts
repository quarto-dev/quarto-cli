import { testQuartoCmd, ExecuteOutput, Verify } from "../../test.ts";
import { fileExists, folderExists, noErrorsOrWarnings, printsMessage } from "../../verify.ts";
import { join, fromFileUrl, dirname } from "../../../src/deno_ral/path.ts";
import { ensureDirSync, existsSync } from "../../../src/deno_ral/fs.ts";
import { pathWithForwardSlashes } from "../../../src/core/path.ts";

// Helper to verify files appear in the correct output sections
function filesInSections(
  expected: { overwrite?: string[]; create?: string[]; remove?: string[] },
  dryRun: boolean
): Verify {
  return {
    name: "files in correct sections",
    verify: (outputs: ExecuteOutput[]) => {
      const overwriteHeader = dryRun ? "Would overwrite:" : "Overwritten:";
      const createHeader = dryRun ? "Would create:" : "Created:";
      const removeHeader = dryRun ? "Would remove:" : "Removed:";

      const found: { overwrite: string[]; create: string[]; remove: string[] } = {
        overwrite: [],
        create: [],
        remove: [],
      };
      let currentSection: "overwrite" | "create" | "remove" | null = null;

      for (const output of outputs) {
        const line = output.msg;
        if (line.includes(overwriteHeader)) {
          currentSection = "overwrite";
        } else if (line.includes(createHeader)) {
          currentSection = "create";
        } else if (line.includes(removeHeader)) {
          currentSection = "remove";
        } else if (currentSection && line.trim().startsWith("- ")) {
          const filename = line.trim().slice(2); // remove "- "
          // Normalize path separators for cross-platform compatibility
          found[currentSection].push(pathWithForwardSlashes(filename));
        }
      }

      // Verify expected files are in correct sections
      for (const file of expected.overwrite ?? []) {
        if (!found.overwrite.includes(pathWithForwardSlashes(file))) {
          throw new Error(`Expected ${file} in overwrite section, found: [${found.overwrite.join(", ")}]`);
        }
      }
      for (const file of expected.create ?? []) {
        if (!found.create.includes(pathWithForwardSlashes(file))) {
          throw new Error(`Expected ${file} in create section, found: [${found.create.join(", ")}]`);
        }
      }
      for (const file of expected.remove ?? []) {
        if (!found.remove.includes(pathWithForwardSlashes(file))) {
          throw new Error(`Expected ${file} in remove section, found: [${found.remove.join(", ")}]`);
        }
      }
      return Promise.resolve();
    }
  };
}

const tempDir = Deno.makeTempDirSync();
const testDir = dirname(fromFileUrl(import.meta.url));
const fixtureDir = join(testDir, "..", "use-brand");

// Scenario 1: Basic brand installation
const basicDir = join(tempDir, "basic");
ensureDirSync(basicDir);
testQuartoCmd(
  "use",
  ["brand", join(fixtureDir, "basic-brand"), "--force"],
  [
    noErrorsOrWarnings,
    folderExists(join(basicDir, "_brand")),
    fileExists(join(basicDir, "_brand", "_brand.yml")),
    fileExists(join(basicDir, "_brand", "logo.png")),
    // Font file referenced in typography.fonts should be copied
    folderExists(join(basicDir, "_brand", "fonts")),
    fileExists(join(basicDir, "_brand", "fonts", "custom-font.woff2")),
    // README.md is NOT referenced in _brand.yml - should NOT be copied
    {
      name: "README.md should not be copied (unreferenced)",
      verify: () => {
        if (existsSync(join(basicDir, "_brand", "README.md"))) {
          throw new Error("README.md should not be copied - it is not referenced in _brand.yml");
        }
        return Promise.resolve();
      }
    },
  ],
  {
    setup: () => {
      Deno.writeTextFileSync(join(basicDir, "_quarto.yml"), "project:\n  type: default\n");
      return Promise.resolve();
    },
    cwd: () => basicDir,
    teardown: () => {
      try { Deno.removeSync(basicDir, { recursive: true }); } catch { /* ignore */ }
      return Promise.resolve();
    }
  },
  "quarto use brand - basic installation"
);

// Scenario 2: Dry-run mode
const dryRunDir = join(tempDir, "dry-run");
ensureDirSync(dryRunDir);
testQuartoCmd(
  "use",
  ["brand", join(fixtureDir, "basic-brand"), "--dry-run"],
  [
    noErrorsOrWarnings,
    printsMessage({ level: "INFO", regex: /Would create directory/ }),
    filesInSections({ create: ["_brand.yml", "logo.png", "fonts/custom-font.woff2"] }, true),
    {
      name: "_brand directory should not exist in dry-run mode",
      verify: () => {
        const brandDir = join(dryRunDir, "_brand");
        if (existsSync(brandDir)) {
          throw new Error("_brand directory should not exist in dry-run mode");
        }
        return Promise.resolve();
      }
    },
    // README.md should NOT appear in dry-run output (unreferenced)
    {
      name: "README.md should not be listed in dry-run output (unreferenced)",
      verify: (outputs: ExecuteOutput[]) => {
        for (const output of outputs) {
          if (output.msg.includes("README.md")) {
            throw new Error("README.md should not appear in dry-run output - it is not referenced in _brand.yml");
          }
        }
        return Promise.resolve();
      }
    },
  ],
  {
    setup: () => {
      Deno.writeTextFileSync(join(dryRunDir, "_quarto.yml"), "project:\n  type: default\n");
      return Promise.resolve();
    },
    cwd: () => dryRunDir,
    teardown: () => {
      try { Deno.removeSync(dryRunDir, { recursive: true }); } catch { /* ignore */ }
      return Promise.resolve();
    }
  },
  "quarto use brand - dry-run mode"
);

// Scenario 3: Force mode - overwrites existing, creates new, removes extra
const forceOverwriteDir = join(tempDir, "force-overwrite");
ensureDirSync(forceOverwriteDir);
testQuartoCmd(
  "use",
  ["brand", join(fixtureDir, "basic-brand"), "--force"],
  [
    noErrorsOrWarnings,
    // _brand.yml should be overwritten (exists in both)
    {
      name: "_brand.yml should be overwritten with new content",
      verify: () => {
        const content = Deno.readTextFileSync(join(forceOverwriteDir, "_brand", "_brand.yml"));
        if (content.includes("Old Brand")) {
          throw new Error("_brand.yml should have been overwritten");
        }
        if (!content.includes("Basic Test Brand")) {
          throw new Error("_brand.yml should contain new brand content");
        }
        return Promise.resolve();
      }
    },
    // logo.png should be created (not in target originally)
    fileExists(join(forceOverwriteDir, "_brand", "logo.png")),
    // unrelated.txt should be removed (not in source)
    {
      name: "unrelated.txt should be removed",
      verify: () => {
        if (existsSync(join(forceOverwriteDir, "_brand", "unrelated.txt"))) {
          throw new Error("unrelated.txt should have been removed");
        }
        return Promise.resolve();
      }
    },
    // Verify output sections
    filesInSections({ overwrite: ["_brand.yml"], create: ["logo.png"], remove: ["unrelated.txt"] }, false),
  ],
  {
    setup: () => {
      Deno.writeTextFileSync(join(forceOverwriteDir, "_quarto.yml"), "project:\n  type: default\n");
      // Create existing _brand directory with files
      const brandDir = join(forceOverwriteDir, "_brand");
      ensureDirSync(brandDir);
      // This file exists in source - should be overwritten
      Deno.writeTextFileSync(join(brandDir, "_brand.yml"), "meta:\n  name: Old Brand\n");
      // This file does NOT exist in source - should be preserved
      Deno.writeTextFileSync(join(brandDir, "unrelated.txt"), "keep me");
      return Promise.resolve();
    },
    cwd: () => forceOverwriteDir,
    teardown: () => {
      try { Deno.removeSync(forceOverwriteDir, { recursive: true }); } catch { /* ignore */ }
      return Promise.resolve();
    }
  },
  "quarto use brand - force overwrites existing, creates new, removes extra"
);

// Scenario 4: Dry-run reports "Would overwrite" vs "Would create" vs "Would remove" correctly
const dryRunOverwriteDir = join(tempDir, "dry-run-overwrite");
ensureDirSync(dryRunOverwriteDir);
testQuartoCmd(
  "use",
  ["brand", join(fixtureDir, "basic-brand"), "--dry-run"],
  [
    noErrorsOrWarnings,
    // _brand.yml exists - should be in overwrite section
    // logo.png doesn't exist - should be in create section
    // extra.txt exists only in target - should be in remove section
    filesInSections({
      overwrite: ["_brand.yml"],
      create: ["logo.png"],
      remove: ["extra.txt"]
    }, true),
    // Verify _brand.yml was NOT modified
    {
      name: "_brand.yml should not be modified in dry-run",
      verify: () => {
        const content = Deno.readTextFileSync(join(dryRunOverwriteDir, "_brand", "_brand.yml"));
        if (!content.includes("Old Brand")) {
          throw new Error("_brand.yml should not be modified in dry-run mode");
        }
        return Promise.resolve();
      }
    },
    // Verify logo.png was NOT created
    {
      name: "logo.png should not be created in dry-run",
      verify: () => {
        if (existsSync(join(dryRunOverwriteDir, "_brand", "logo.png"))) {
          throw new Error("logo.png should not be created in dry-run mode");
        }
        return Promise.resolve();
      }
    },
    // Verify extra.txt was NOT removed
    {
      name: "extra.txt should not be removed in dry-run",
      verify: () => {
        if (!existsSync(join(dryRunOverwriteDir, "_brand", "extra.txt"))) {
          throw new Error("extra.txt should not be removed in dry-run mode");
        }
        return Promise.resolve();
      }
    },
  ],
  {
    setup: () => {
      Deno.writeTextFileSync(join(dryRunOverwriteDir, "_quarto.yml"), "project:\n  type: default\n");
      // Create existing _brand directory with _brand.yml and extra.txt (not logo.png)
      const brandDir = join(dryRunOverwriteDir, "_brand");
      ensureDirSync(brandDir);
      Deno.writeTextFileSync(join(brandDir, "_brand.yml"), "meta:\n  name: Old Brand\n");
      Deno.writeTextFileSync(join(brandDir, "extra.txt"), "extra file not in source");
      return Promise.resolve();
    },
    cwd: () => dryRunOverwriteDir,
    teardown: () => {
      try { Deno.removeSync(dryRunOverwriteDir, { recursive: true }); } catch { /* ignore */ }
      return Promise.resolve();
    }
  },
  "quarto use brand - dry-run reports overwrite vs create vs remove correctly"
);

// Scenario 5: Error - force and dry-run together
const errorFlagDir = join(tempDir, "error-flags");
ensureDirSync(errorFlagDir);
testQuartoCmd(
  "use",
  ["brand", join(fixtureDir, "basic-brand"), "--force", "--dry-run"],
  [
    printsMessage({ level: "ERROR", regex: /Cannot use --force and --dry-run together/ }),
  ],
  {
    setup: () => {
      Deno.writeTextFileSync(join(errorFlagDir, "_quarto.yml"), "project:\n  type: default\n");
      return Promise.resolve();
    },
    cwd: () => errorFlagDir,
    teardown: () => {
      try { Deno.removeSync(errorFlagDir, { recursive: true }); } catch { /* ignore */ }
      return Promise.resolve();
    }
  },
  "quarto use brand - error on --force --dry-run"
);

// Scenario 6: Multi-file brand installation
const multiFileDir = join(tempDir, "multi-file");
ensureDirSync(multiFileDir);
testQuartoCmd(
  "use",
  ["brand", join(fixtureDir, "multi-file-brand"), "--force"],
  [
    noErrorsOrWarnings,
    folderExists(join(multiFileDir, "_brand")),
    fileExists(join(multiFileDir, "_brand", "_brand.yml")),
    fileExists(join(multiFileDir, "_brand", "logo.png")),
    fileExists(join(multiFileDir, "_brand", "favicon.png")),
    // Font files referenced in typography.fonts should be copied
    folderExists(join(multiFileDir, "_brand", "fonts")),
    fileExists(join(multiFileDir, "_brand", "fonts", "brand-regular.woff2")),
    fileExists(join(multiFileDir, "_brand", "fonts", "brand-bold.woff2")),
    // unused-styles.css is NOT referenced in _brand.yml - should NOT be copied
    {
      name: "unused-styles.css should not be copied (unreferenced)",
      verify: () => {
        if (existsSync(join(multiFileDir, "_brand", "unused-styles.css"))) {
          throw new Error("unused-styles.css should not be copied - it is not referenced in _brand.yml");
        }
        return Promise.resolve();
      }
    },
    // fonts/unused-italic.woff2 is NOT referenced in _brand.yml - should NOT be copied
    {
      name: "fonts/unused-italic.woff2 should not be copied (unreferenced)",
      verify: () => {
        if (existsSync(join(multiFileDir, "_brand", "fonts", "unused-italic.woff2"))) {
          throw new Error("fonts/unused-italic.woff2 should not be copied - it is not referenced in _brand.yml");
        }
        return Promise.resolve();
      }
    },
  ],
  {
    setup: () => {
      Deno.writeTextFileSync(join(multiFileDir, "_quarto.yml"), "project:\n  type: default\n");
      return Promise.resolve();
    },
    cwd: () => multiFileDir,
    teardown: () => {
      try { Deno.removeSync(multiFileDir, { recursive: true }); } catch { /* ignore */ }
      return Promise.resolve();
    }
  },
  "quarto use brand - multi-file installation"
);

// Scenario 7: Nested directory structure preserved
const nestedDir = join(tempDir, "nested");
ensureDirSync(nestedDir);
testQuartoCmd(
  "use",
  ["brand", join(fixtureDir, "nested-brand"), "--force"],
  [
    noErrorsOrWarnings,
    folderExists(join(nestedDir, "_brand")),
    fileExists(join(nestedDir, "_brand", "_brand.yml")),
    folderExists(join(nestedDir, "_brand", "images")),
    fileExists(join(nestedDir, "_brand", "images", "logo.png")),
    fileExists(join(nestedDir, "_brand", "images", "header.png")),
    // notes.txt is NOT referenced in _brand.yml - should NOT be copied
    {
      name: "notes.txt should not be copied (unreferenced)",
      verify: () => {
        if (existsSync(join(nestedDir, "_brand", "notes.txt"))) {
          throw new Error("notes.txt should not be copied - it is not referenced in _brand.yml");
        }
        return Promise.resolve();
      }
    },
    // images/extra-icon.png is NOT referenced in _brand.yml - should NOT be copied
    {
      name: "images/extra-icon.png should not be copied (unreferenced)",
      verify: () => {
        if (existsSync(join(nestedDir, "_brand", "images", "extra-icon.png"))) {
          throw new Error("images/extra-icon.png should not be copied - it is not referenced in _brand.yml");
        }
        return Promise.resolve();
      }
    },
  ],
  {
    setup: () => {
      Deno.writeTextFileSync(join(nestedDir, "_quarto.yml"), "project:\n  type: default\n");
      return Promise.resolve();
    },
    cwd: () => nestedDir,
    teardown: () => {
      try { Deno.removeSync(nestedDir, { recursive: true }); } catch { /* ignore */ }
      return Promise.resolve();
    }
  },
  "quarto use brand - nested directory structure"
);

// Scenario 8: Single-file mode (no _quarto.yml) - should work, using current directory
const noProjectDir = join(tempDir, "no-project");
ensureDirSync(noProjectDir);
testQuartoCmd(
  "use",
  ["brand", join(fixtureDir, "basic-brand"), "--force"],
  [
    noErrorsOrWarnings,
    // Should create _brand/ in the current directory even without _quarto.yml
    folderExists(join(noProjectDir, "_brand")),
    fileExists(join(noProjectDir, "_brand", "_brand.yml")),
    fileExists(join(noProjectDir, "_brand", "logo.png")),
  ],
  {
    setup: () => {
      // No _quarto.yml created - single-file mode should work
      return Promise.resolve();
    },
    cwd: () => noProjectDir,
    teardown: () => {
      try { Deno.removeSync(noProjectDir, { recursive: true }); } catch { /* ignore */ }
      return Promise.resolve();
    }
  },
  "quarto use brand - single-file mode (no _quarto.yml)"
);

// Scenario 9: Nested directory - overwrite files in subdirectories, remove extra
const nestedOverwriteDir = join(tempDir, "nested-overwrite");
ensureDirSync(nestedOverwriteDir);
testQuartoCmd(
  "use",
  ["brand", join(fixtureDir, "nested-brand"), "--force"],
  [
    noErrorsOrWarnings,
    // images/logo.png should be overwritten (exists in both)
    {
      name: "images/logo.png should be overwritten",
      verify: () => {
        const stats = Deno.statSync(join(nestedOverwriteDir, "_brand", "images", "logo.png"));
        // Original was 10 bytes ("old logo\n"), new one is 1862 bytes
        if (stats.size < 100) {
          throw new Error("images/logo.png should have been overwritten with larger file");
        }
        return Promise.resolve();
      }
    },
    // images/header.png should be created (not in target originally)
    fileExists(join(nestedOverwriteDir, "_brand", "images", "header.png")),
    // images/unrelated.png should be removed (not in source)
    {
      name: "images/unrelated.png should be removed",
      verify: () => {
        if (existsSync(join(nestedOverwriteDir, "_brand", "images", "unrelated.png"))) {
          throw new Error("images/unrelated.png should have been removed");
        }
        return Promise.resolve();
      }
    },
    // Verify output sections (_brand.yml is created since not in target setup)
    filesInSections({
      overwrite: ["images/logo.png"],
      create: ["_brand.yml", "images/header.png"],
      remove: ["images/unrelated.png"]
    }, false),
  ],
  {
    setup: () => {
      Deno.writeTextFileSync(join(nestedOverwriteDir, "_quarto.yml"), "project:\n  type: default\n");
      // Create existing _brand/images directory with files
      const imagesDir = join(nestedOverwriteDir, "_brand", "images");
      ensureDirSync(imagesDir);
      // This file exists in source - should be overwritten
      Deno.writeTextFileSync(join(imagesDir, "logo.png"), "old logo\n");
      // This file does NOT exist in source - should be preserved
      Deno.writeTextFileSync(join(imagesDir, "unrelated.png"), "keep me nested");
      return Promise.resolve();
    },
    cwd: () => nestedOverwriteDir,
    teardown: () => {
      try { Deno.removeSync(nestedOverwriteDir, { recursive: true }); } catch { /* ignore */ }
      return Promise.resolve();
    }
  },
  "quarto use brand - nested overwrite, create, remove in subdirectories"
);

// Scenario 10: Dry-run with nested directories - reports correctly
const dryRunNestedDir = join(tempDir, "dry-run-nested");
ensureDirSync(dryRunNestedDir);
testQuartoCmd(
  "use",
  ["brand", join(fixtureDir, "nested-brand"), "--dry-run"],
  [
    noErrorsOrWarnings,
    // images/logo.png and _brand.yml exist - should be in overwrite section
    // images/header.png doesn't exist - should be in create section
    filesInSections({
      overwrite: ["_brand.yml", "images/logo.png"],
      create: ["images/header.png"]
    }, true),
    // Verify images/logo.png was NOT modified
    {
      name: "images/logo.png should not be modified in dry-run",
      verify: () => {
        const content = Deno.readTextFileSync(join(dryRunNestedDir, "_brand", "images", "logo.png"));
        if (content !== "old logo\n") {
          throw new Error("images/logo.png should not be modified in dry-run mode");
        }
        return Promise.resolve();
      }
    },
    // Verify images/header.png was NOT created
    {
      name: "images/header.png should not be created in dry-run",
      verify: () => {
        if (existsSync(join(dryRunNestedDir, "_brand", "images", "header.png"))) {
          throw new Error("images/header.png should not be created in dry-run mode");
        }
        return Promise.resolve();
      }
    },
  ],
  {
    setup: () => {
      Deno.writeTextFileSync(join(dryRunNestedDir, "_quarto.yml"), "project:\n  type: default\n");
      // Create existing _brand/images directory with only logo.png (not header.png)
      const imagesDir = join(dryRunNestedDir, "_brand", "images");
      ensureDirSync(imagesDir);
      Deno.writeTextFileSync(join(imagesDir, "logo.png"), "old logo\n");
      // Also create _brand.yml so we're only testing nested behavior
      Deno.writeTextFileSync(join(dryRunNestedDir, "_brand", "_brand.yml"), "meta:\n  name: Old\n");
      return Promise.resolve();
    },
    cwd: () => dryRunNestedDir,
    teardown: () => {
      try { Deno.removeSync(dryRunNestedDir, { recursive: true }); } catch { /* ignore */ }
      return Promise.resolve();
    }
  },
  "quarto use brand - dry-run reports nested overwrite vs create correctly"
);

// Scenario 11: Nested directory created when doesn't exist
const nestedNewSubdirDir = join(tempDir, "nested-new-subdir");
ensureDirSync(nestedNewSubdirDir);
testQuartoCmd(
  "use",
  ["brand", join(fixtureDir, "nested-brand"), "--force"],
  [
    noErrorsOrWarnings,
    // _brand/ exists but images/ doesn't - should be created
    folderExists(join(nestedNewSubdirDir, "_brand", "images")),
    fileExists(join(nestedNewSubdirDir, "_brand", "images", "logo.png")),
    fileExists(join(nestedNewSubdirDir, "_brand", "images", "header.png")),
    // existing file at root should be overwritten
    {
      name: "_brand.yml should be overwritten",
      verify: () => {
        const content = Deno.readTextFileSync(join(nestedNewSubdirDir, "_brand", "_brand.yml"));
        if (content.includes("Old Brand")) {
          throw new Error("_brand.yml should have been overwritten");
        }
        return Promise.resolve();
      }
    },
  ],
  {
    setup: () => {
      Deno.writeTextFileSync(join(nestedNewSubdirDir, "_quarto.yml"), "project:\n  type: default\n");
      // Create _brand/ but NOT images/ subdirectory
      const brandDir = join(nestedNewSubdirDir, "_brand");
      ensureDirSync(brandDir);
      Deno.writeTextFileSync(join(brandDir, "_brand.yml"), "meta:\n  name: Old Brand\n");
      return Promise.resolve();
    },
    cwd: () => nestedNewSubdirDir,
    teardown: () => {
      try { Deno.removeSync(nestedNewSubdirDir, { recursive: true }); } catch { /* ignore */ }
      return Promise.resolve();
    }
  },
  "quarto use brand - creates nested subdirectory when _brand exists but subdir doesn't"
);

// Scenario 12: Dry-run reports new subdirectory creation
const dryRunNewSubdirDir = join(tempDir, "dry-run-new-subdir");
ensureDirSync(dryRunNewSubdirDir);
testQuartoCmd(
  "use",
  ["brand", join(fixtureDir, "nested-brand"), "--dry-run"],
  [
    noErrorsOrWarnings,
    // Should NOT report "Would create directory" for _brand/ (already exists)
    printsMessage({ level: "INFO", regex: /Would create directory/, negate: true }),
    // _brand.yml exists - should be in overwrite section
    // images/* files don't exist - should be in create section
    filesInSections({
      overwrite: ["_brand.yml"],
      create: ["images/logo.png", "images/header.png"]
    }, true),
    // Verify images/ directory was NOT created
    {
      name: "images/ directory should not be created in dry-run",
      verify: () => {
        if (existsSync(join(dryRunNewSubdirDir, "_brand", "images"))) {
          throw new Error("images/ directory should not be created in dry-run mode");
        }
        return Promise.resolve();
      }
    },
  ],
  {
    setup: () => {
      Deno.writeTextFileSync(join(dryRunNewSubdirDir, "_quarto.yml"), "project:\n  type: default\n");
      // Create _brand/ but NOT images/ subdirectory
      const brandDir = join(dryRunNewSubdirDir, "_brand");
      ensureDirSync(brandDir);
      Deno.writeTextFileSync(join(brandDir, "_brand.yml"), "meta:\n  name: Old\n");
      return Promise.resolve();
    },
    cwd: () => dryRunNewSubdirDir,
    teardown: () => {
      try { Deno.removeSync(dryRunNewSubdirDir, { recursive: true }); } catch { /* ignore */ }
      return Promise.resolve();
    }
  },
  "quarto use brand - dry-run when _brand exists but nested subdir doesn't"
);

// Scenario 13: Empty directories are cleaned up after file removal
const emptyDirCleanupDir = join(tempDir, "empty-dir-cleanup");
ensureDirSync(emptyDirCleanupDir);
testQuartoCmd(
  "use",
  ["brand", join(fixtureDir, "basic-brand"), "--force"],
  [
    noErrorsOrWarnings,
    // extras/orphan.txt should be removed
    {
      name: "extras/orphan.txt should be removed",
      verify: () => {
        if (existsSync(join(emptyDirCleanupDir, "_brand", "extras", "orphan.txt"))) {
          throw new Error("extras/orphan.txt should have been removed");
        }
        return Promise.resolve();
      }
    },
    // extras/ directory should be cleaned up (was empty after removal)
    {
      name: "extras/ directory should be cleaned up",
      verify: () => {
        if (existsSync(join(emptyDirCleanupDir, "_brand", "extras"))) {
          throw new Error("extras/ directory should have been cleaned up");
        }
        return Promise.resolve();
      }
    },
    // Verify output shows removal
    filesInSections({ remove: ["extras/orphan.txt"] }, false),
  ],
  {
    setup: () => {
      Deno.writeTextFileSync(join(emptyDirCleanupDir, "_quarto.yml"), "project:\n  type: default\n");
      // Create _brand/extras/ with a file not in source
      const extrasDir = join(emptyDirCleanupDir, "_brand", "extras");
      ensureDirSync(extrasDir);
      Deno.writeTextFileSync(join(extrasDir, "orphan.txt"), "this file will be removed");
      return Promise.resolve();
    },
    cwd: () => emptyDirCleanupDir,
    teardown: () => {
      try { Deno.removeSync(emptyDirCleanupDir, { recursive: true }); } catch { /* ignore */ }
      return Promise.resolve();
    }
  },
  "quarto use brand - empty directories cleaned up after file removal"
);

// Scenario 14: Deeply nested directories are recursively cleaned up
const deepNestedCleanupDir = join(tempDir, "deep-nested-cleanup");
ensureDirSync(deepNestedCleanupDir);
testQuartoCmd(
  "use",
  ["brand", join(fixtureDir, "basic-brand"), "--force"],
  [
    noErrorsOrWarnings,
    // deep/nested/path/orphan.txt should be removed
    {
      name: "deep/nested/path/orphan.txt should be removed",
      verify: () => {
        if (existsSync(join(deepNestedCleanupDir, "_brand", "deep", "nested", "path", "orphan.txt"))) {
          throw new Error("deep/nested/path/orphan.txt should have been removed");
        }
        return Promise.resolve();
      }
    },
    // All empty parent directories should be cleaned up recursively
    {
      name: "deep/ directory tree should be fully cleaned up",
      verify: () => {
        if (existsSync(join(deepNestedCleanupDir, "_brand", "deep"))) {
          throw new Error("deep/ directory should have been cleaned up recursively");
        }
        return Promise.resolve();
      }
    },
    // Verify output shows removal with full path
    filesInSections({ remove: ["deep/nested/path/orphan.txt"] }, false),
  ],
  {
    setup: () => {
      Deno.writeTextFileSync(join(deepNestedCleanupDir, "_quarto.yml"), "project:\n  type: default\n");
      // Create _brand/deep/nested/path/ with a file not in source
      const deepDir = join(deepNestedCleanupDir, "_brand", "deep", "nested", "path");
      ensureDirSync(deepDir);
      Deno.writeTextFileSync(join(deepDir, "orphan.txt"), "deeply nested orphan");
      return Promise.resolve();
    },
    cwd: () => deepNestedCleanupDir,
    teardown: () => {
      try { Deno.removeSync(deepNestedCleanupDir, { recursive: true }); } catch { /* ignore */ }
      return Promise.resolve();
    }
  },
  "quarto use brand - deeply nested directories recursively cleaned up"
);

// Scenario 15: Brand extension - basic installation
// Tests that brand extensions are detected and the brand file is renamed to _brand.yml
const brandExtDir = join(tempDir, "brand-ext");
ensureDirSync(brandExtDir);
testQuartoCmd(
  "use",
  ["brand", join(fixtureDir, "brand-extension"), "--force"],
  [
    noErrorsOrWarnings,
    folderExists(join(brandExtDir, "_brand")),
    // brand.yml should be renamed to _brand.yml
    fileExists(join(brandExtDir, "_brand", "_brand.yml")),
    // logo.png should be copied
    fileExists(join(brandExtDir, "_brand", "logo.png")),
    // _extension.yml should NOT be copied
    {
      name: "_extension.yml should not be copied",
      verify: () => {
        if (existsSync(join(brandExtDir, "_brand", "_extension.yml"))) {
          throw new Error("_extension.yml should not be copied from brand extension");
        }
        return Promise.resolve();
      }
    },
    // Verify the content is correct (from brand.yml, not some other file)
    {
      name: "_brand.yml should contain brand extension content",
      verify: () => {
        const content = Deno.readTextFileSync(join(brandExtDir, "_brand", "_brand.yml"));
        if (!content.includes("Test Brand Extension")) {
          throw new Error("_brand.yml should contain content from brand.yml");
        }
        return Promise.resolve();
      }
    },
    // template.html is NOT referenced in brand.yml - should NOT be copied
    {
      name: "template.html should not be copied (unreferenced)",
      verify: () => {
        if (existsSync(join(brandExtDir, "_brand", "template.html"))) {
          throw new Error("template.html should not be copied - it is not referenced in brand.yml");
        }
        return Promise.resolve();
      }
    },
  ],
  {
    setup: () => {
      Deno.writeTextFileSync(join(brandExtDir, "_quarto.yml"), "project:\n  type: default\n");
      return Promise.resolve();
    },
    cwd: () => brandExtDir,
    teardown: () => {
      try { Deno.removeSync(brandExtDir, { recursive: true }); } catch { /* ignore */ }
      return Promise.resolve();
    }
  },
  "quarto use brand - brand extension installation"
);

// Scenario 16: Brand extension - dry-run shows correct file names
const brandExtDryRunDir = join(tempDir, "brand-ext-dry-run");
ensureDirSync(brandExtDryRunDir);
testQuartoCmd(
  "use",
  ["brand", join(fixtureDir, "brand-extension"), "--dry-run"],
  [
    noErrorsOrWarnings,
    // Should show _brand.yml (renamed from brand.yml), not brand.yml
    filesInSections({ create: ["_brand.yml", "logo.png"] }, true),
    // _brand directory should not exist in dry-run mode
    {
      name: "_brand directory should not exist in dry-run mode",
      verify: () => {
        if (existsSync(join(brandExtDryRunDir, "_brand"))) {
          throw new Error("_brand directory should not exist in dry-run mode");
        }
        return Promise.resolve();
      }
    }
  ],
  {
    setup: () => {
      Deno.writeTextFileSync(join(brandExtDryRunDir, "_quarto.yml"), "project:\n  type: default\n");
      return Promise.resolve();
    },
    cwd: () => brandExtDryRunDir,
    teardown: () => {
      try { Deno.removeSync(brandExtDryRunDir, { recursive: true }); } catch { /* ignore */ }
      return Promise.resolve();
    }
  },
  "quarto use brand - brand extension dry-run shows renamed file"
);

// Scenario 17: Brand extension with brand file in subdirectory
// Tests that brand path in _extension.yml can be a relative path (e.g., subdir/brand.yml)
// and that referenced files are resolved relative to the brand file's directory
const brandExtSubdirDir = join(tempDir, "brand-ext-subdir");
ensureDirSync(brandExtSubdirDir);
testQuartoCmd(
  "use",
  ["brand", join(fixtureDir, "brand-extension-subdir"), "--force"],
  [
    noErrorsOrWarnings,
    folderExists(join(brandExtSubdirDir, "_brand")),
    // subdir/brand.yml should be renamed to _brand.yml
    fileExists(join(brandExtSubdirDir, "_brand", "_brand.yml")),
    // logo.png (referenced as logo.png in subdir/brand.yml) should be copied
    // The logo is at subdir/logo.png relative to extension dir
    fileExists(join(brandExtSubdirDir, "_brand", "logo.png")),
    // images/nested-logo.png (referenced as images/nested-logo.png in subdir/brand.yml)
    // should be copied to _brand/images/nested-logo.png
    folderExists(join(brandExtSubdirDir, "_brand", "images")),
    fileExists(join(brandExtSubdirDir, "_brand", "images", "nested-logo.png")),
    // Verify the content is correct
    {
      name: "_brand.yml should contain subdir brand content",
      verify: () => {
        const content = Deno.readTextFileSync(join(brandExtSubdirDir, "_brand", "_brand.yml"));
        if (!content.includes("Test Brand Extension Subdir")) {
          throw new Error("_brand.yml should contain content from subdir/brand.yml");
        }
        return Promise.resolve();
      }
    },
  ],
  {
    setup: () => {
      Deno.writeTextFileSync(join(brandExtSubdirDir, "_quarto.yml"), "project:\n  type: default\n");
      return Promise.resolve();
    },
    cwd: () => brandExtSubdirDir,
    teardown: () => {
      try { Deno.removeSync(brandExtSubdirDir, { recursive: true }); } catch { /* ignore */ }
      return Promise.resolve();
    }
  },
  "quarto use brand - brand extension with subdir brand file"
);
