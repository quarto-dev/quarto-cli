import { dirname, join } from "https://deno.land/std/path/mod.ts";
import { existsSync } from "https://deno.land/std/fs/exists.ts";

async function prepareDist(targetDir: string) {
  const sharedir = getEnv("QUARTO_SHARE_DIR");
  const binDir = getEnv("QUARTO_BIN_DIR");

  const filesToCopy = [
    {
      from: join("..", "..", "..", "COPYING.md"),
      to: join(targetDir, "COPYING.md"),
    },
    {
      from: join("..", "..", "..", "COPYRIGHT"),
      to: join(targetDir, "COPYRIGHT"),
    },
    {
      from: join("..", "..", "filters", "crossref", "crossref.lua"),
      to: join(targetDir, sharedir, "filters", "crossref", "crossref.lua"),
    },
  ];

  // Gather supporting files
  filesToCopy.forEach((fileToCopy) => {
    const directory = dirname(fileToCopy.to);
    if (!existsSync(directory)) {
      Deno.mkdirSync(directory);
    }
    Deno.copyFileSync(fileToCopy.from, fileToCopy.to);
  });

  // Bundle source code
  const denoBundleCmd: string[] = [];
  denoBundleCmd.push(join(targetDir, binDir, "deno"));
  denoBundleCmd.push("bundle");
  denoBundleCmd.push("--unstable");
  denoBundleCmd.push(
    "--importmap=" + join("..", "..", "..", "src", "import_map.json"),
  );
  denoBundleCmd.push(join("..", "..", "..", "src", "quarto.ts"));
  denoBundleCmd.push(join(targetDir, binDir, "quarto.js"));
  const p = Deno.run({
    cmd: denoBundleCmd,
  });
  const status = await p.status();
  if (status.code !== 0) {
    throw Error("Failure to bundle quarto.ts");
  }
}

function getEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error("Missing environment variable: " + name);
  }
  return value;
}

const packageDir = getEnv("QUARTO_PACKAGE_DIR");
const distDir = getEnv("QUARTO_DIST_DIR");

await prepareDist(distDir);
