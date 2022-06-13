import { noErrorsOrWarnings } from "../../verify.ts";
import { docs } from "../../utils.ts";
import { join } from "path/mod.ts";
import { ExecuteOutput, testQuartoCmd, Verify } from "../../test.ts";
import { assert } from "testing/asserts.ts";

const testDir = docs("extensions");
const testExtDestdir = join(testDir, "install");
const testDirAbs = join(Deno.cwd(), testDir);

const verifySubDirCount = (dir: string, count: number): Verify => {
  return {
    name: "Verify number of directories",
    verify: (_outputs: ExecuteOutput[]) => {
      const contents = Deno.readDirSync(dir);

      let subDirCount = 0;
      for (const content of contents) {
        if (content.isDirectory) {
          subDirCount = subDirCount + 1;
        }
      }

      assert(count === subDirCount, "Incorrect number of subdirectories");
      return Promise.resolve();
    },
  };
};

const inInstallDir = (fn: () => void) => {
  const cwd = Deno.cwd();
  Deno.chdir(testExtDestdir);
  try {
    fn();
  } finally {
    Deno.chdir(cwd);
  }
};

inInstallDir(() => {
  // Verify installation using a remote github repo
  testQuartoCmd(
    "install",
    ["extension", "dragonstyle/test-ext", "--no-prompt"],
    [noErrorsOrWarnings, verifySubDirCount("_extensions", 1)],
    {
      teardown: () => {
        Deno.removeSync("_extensions", { recursive: true });
        return Promise.resolve();
      },
    },
  );

  // Verify installation using a local zip file
  const zipFiles = [
    { path: "multiple-root-ext.zip", count: 3 },
    { path: "owned-multiple.zip", count: 3 },
    { path: "single-root-ext.zip", count: 1 },
    { path: "unowned-multiple.zip", count: 3 },
  ];

  for (const zipFile of zipFiles) {
    const zipPath = join(testDirAbs, "ext-repo", zipFile.path);
    testQuartoCmd(
      "install",
      ["extension", zipPath, "--no-prompt"],
      [noErrorsOrWarnings, verifySubDirCount("_extensions", zipFile.count)],
      {
        teardown: () => {
          Deno.removeSync("_extensions", { recursive: true });
          return Promise.resolve();
        },
      },
    );
  }
});
