import { noErrorsOrWarnings } from "../../verify.ts";
import { docs } from "../../utils.ts";
import { join } from "path/mod.ts";
import { ExecuteOutput, testQuartoCmd, Verify } from "../../test.ts";
import { assert } from "testing/asserts.ts";
import { existsSync } from "fs/mod.ts";

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

const verifySubDirName = (dir: string, name: string): Verify => {
  return {
    name: "Verify name of the directory",
    verify: (_outputs: ExecuteOutput[]) => {
      assert(
        existsSync(join(dir, name)),
        "Expected subdirectory doesn't exist",
      );
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
    ["extension", "quarto-ext/lightbox", "--no-prompt"],
    [
      noErrorsOrWarnings,
      verifySubDirCount("_extensions", 1),
      verifySubDirName("_extensions", "quarto-ext"),
    ],
    {
      teardown: () => {
        Deno.removeSync("_extensions", { recursive: true });
        return Promise.resolve();
      },
    },
  );

  // Verify installation using a local zip file
  const zipFiles = [
    { path: "owned-multiple.zip", count: 3, names: ["acm", "acs", "coolster"] },
    {
      path: "unowned-multiple.zip",
      count: 3,
      names: ["acm", "acs", "coolster"],
    },
  ];

  for (const zipFile of zipFiles) {
    const verification = [
      noErrorsOrWarnings,
      verifySubDirCount("_extensions", zipFile.count),
    ];
    for (const name of zipFile.names) {
      verification.push(verifySubDirName("_extensions", name));
    }

    const zipPath = join(testDirAbs, "ext-repo", zipFile.path);
    testQuartoCmd(
      "install",
      ["extension", zipPath, "--no-prompt"],
      verification,
      {
        teardown: () => {
          try {
            Deno.removeSync("_extensions", { recursive: true });
          } catch {
            // Weird flex but ok
          }
          return Promise.resolve();
        },
      },
    );
  }
});
