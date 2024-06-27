import { noErrorsOrWarnings } from "../../verify.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { ExecuteOutput, testQuartoCmd, Verify } from "../../test.ts";
import { assert } from "testing/asserts.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";
import { docs } from "../../utils.ts";

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

const workingDir = Deno.makeTempDirSync();

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
    cwd: () => {
      return workingDir;
    },
    teardown: () => {
      Deno.removeSync("_extensions", { recursive: true });
      return Promise.resolve();
    },
  },
);

// Verify install using urls
const extUrls = [
  "quarto-ext/lightbox",
  "quarto-ext/lightbox@cool",
  "quarto-ext/lightbox@v0.1.4",
  "quarto-ext/lightbox@test/use-in-quarto-cli",
  "https://github.com/quarto-ext/lightbox/archive/refs/tags/v0.1.4.tar.gz",
  "https://github.com/quarto-ext/lightbox/archive/refs/heads/main.tar.gz",
  "https://github.com/quarto-ext/lightbox/archive/refs/heads/cool.tar.gz",
];

if (Deno.build.os !== "linux") {
  extUrls.push(
    ...[
      "https://github.com/quarto-ext/lightbox/archive/refs/tags/v0.1.4.zip",
      "https://github.com/quarto-ext/lightbox/archive/refs/heads/main.zip",
      "https://github.com/quarto-ext/lightbox/archive/refs/heads/cool.zip",
    ],
  );
}

for (const extUrl of extUrls) {
  // Verify installation using a remote github repo
  testQuartoCmd(
    "add",
    [extUrl, "--no-prompt"],
    [
      noErrorsOrWarnings,
      verifySubDirCount("_extensions", 1),
      verifySubDirName("_extensions", "quarto-ext"),
    ],
    {
      cwd: () => {
        return workingDir;
      },
      teardown: () => {
        Deno.removeSync("_extensions", { recursive: true });
        return Promise.resolve();
      },
      santize: {
        resources: false,
      },
    },
  );
}

// Verify use template using a remote github repo
const templateDir = join(workingDir, "template");
ensureDirSync(templateDir);
testQuartoCmd(
  "use",
  ["template", "quarto-journals/jss", "--no-prompt"],
  [
    noErrorsOrWarnings,
    verifySubDirCount("_extensions", 1),
    verifySubDirName("_extensions", "quarto-journals"),
  ],
  {
    cwd: () => {
      return templateDir;
    },
    teardown: () => {
      Deno.chdir("..");
      Deno.removeSync(templateDir, { recursive: true });
      return Promise.resolve();
    },
  },
);

// Verify installation using a local zip file
const testDir = docs("extensions");
const testDirAbs = join(Deno.cwd(), testDir);

const zipFiles = [
  {
    path: "owned-multiple.tar.gz",
    count: 3,
    names: ["acm", "acs", "coolster"],
  },
  {
    path: "unowned-multiple.tar.gz",
    count: 3,
    names: ["acm", "acs", "coolster"],
  },
  {
    path: "rootdir.tar.gz",
    count: 1,
    names: ["latex-environments"],
  },
  {
    path: "subdir.tar.gz",
    count: 1,
    names: ["latex-environments"],
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
      cwd: () => {
        return workingDir;
      },
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
