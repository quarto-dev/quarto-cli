// find-bad-imports
//
// uses `deno info --json` to find all imports that are not in our
// standard format.

const entryPoints = [
  "package/src/bld.ts",
  "src/quarto.ts",
];

let foundBadImport = false;

for (const entry of entryPoints) {
  // this only works if you have deno installed!
  const cmd = new Deno.Command("deno", {
    args: ["info", "--json", entry],
    stdout: "piped",
    stderr: "piped",
  });

  const output = cmd.outputSync();

  if (!output.success) {
    console.log(new TextDecoder().decode(output.stderr));
    Deno.exit(1);
  }

  const info = JSON.parse(new TextDecoder().decode(output.stdout));
  const modules = info.modules || [];
  for (const module of modules) {
    if ((module.local || "").match("src/vendor")) {
      // don't analyze vendor code
      continue;
    }
    for (const dep of module.dependencies || []) {
      const code = dep.code || {};
      if (((code.specifier || "") as string).match("src/vendor")) {
        foundBadImport = true;
        console.log(
          `Bad import in ${module.local}:${code.span.start.line + 1}(${
            code.span.start.character + 1
          }--${code.span.end.character + 1})`,
        );
      }
    }
  }
}

if (foundBadImport) {
  Deno.exit(1);
}
