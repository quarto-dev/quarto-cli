// Spike bundler: bundles src/quarto.ts for Node with esbuild, resolving the Deno
// import map (jsr:, npm:, https://deno.land, https://cdn.skypack.dev) to npm /
// JSR-on-npm packages and local GitHub clones.
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const spike = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(spike, "..");
const src = path.join(root, "src");
const vendor = path.join(spike, "vendor");
const stubs = path.join(spike, "stubs");
const entry = process.argv[2] ? path.resolve(process.argv[2]) : path.join(src, "quarto.ts");
const outfile = process.argv[3] ? path.resolve(process.argv[3]) : path.join(spike, "dist", "quarto.js");

const importMap = JSON.parse(fs.readFileSync(path.join(src, "import_map.json"), "utf8")).imports;
const keys = Object.keys(importMap).sort((a, b) => b.length - a.length);
const resolved = new Map();

function applyImportMap(spec) {
  for (const k of keys) {
    if (k.endsWith("/")) { if (spec.startsWith(k)) return importMap[k] + spec.slice(k.length); }
    else if (spec === k) return importMap[k];
  }
  return spec;
}
function jsrToNpm(spec) {
  const m = spec.match(/^jsr:\/?@([^/]+)\/([^@/]+)@[^/]+(\/.*)?$/);
  if (!m) throw new Error("bad jsr spec " + spec);
  return `@jsr/${m[1]}__${m[2]}${m[3] ?? ""}`;
}
function npmSpec(spec) {
  const m = spec.match(/^npm:\/?((?:@[^/]+\/)?[^@/]+)@[^/]+(\/.*)?$/);
  if (!m) throw new Error("bad npm spec " + spec);
  return m[1] + (m[2] ?? "");
}
function skypack(spec) {
  const m = spec.match(/^https:\/\/cdn\.skypack\.dev\/((?:@[^/]+\/)?[^@/]+)@v?[^/]+(\/.*)?$/);
  if (!m) throw new Error("bad skypack spec " + spec);
  return m[1] + (m[2] ?? "");
}
const denoX = { cliffy: "cliffy", deno_dom: "deno_dom", xmlp: "xmlp", another_cookiejar: "another_cookiejar", semver: "semver", media_types: "media_types" };
const stubbed = new Set(["puppeteer", "xml", "cache", "events", "conditional_type_checks", "plug"]);
// Pre-1.0 std URLs (Cliffy rc.3 internals) keep the old export names (stripColor,
// encode/decode), so they map to pinned 0.224 packages installed under alias names.
const legacyStd = new Set(["fmt", "encoding", "path"]);
function stdToNpm(version, mod, file) {
  const base = file.replace(/\.ts$/, "").replace(/_/g, "-");
  const pkg = version.startsWith("0.") && legacyStd.has(mod) ? `std-legacy-${mod}` : `@jsr/std__${mod}`;
  if (base === "mod") return pkg;
  return `${pkg}/${base}`;
}
function denoLand(spec) {
  let m = spec.match(/^https:\/\/deno\.land\/x\/([^@/]+)@[^/]+\/(.*)$/);
  if (m) {
    if (denoX[m[1]]) return path.join(vendor, denoX[m[1]], m[2]);
    if (stubbed.has(m[1])) return path.join(stubs, m[1] + ".ts");
    throw new Error("unmapped deno.land/x package: " + spec);
  }
  m = spec.match(/^https:\/\/deno\.land\/std@([^/]+)\/([^/]+)\/(.*)$/);
  if (m) return stdToNpm(m[1], m[2], m[3]);
  throw new Error("unmapped deno.land spec: " + spec);
}

const plugin = {
  name: "deno-import-map",
  setup(build) {
    build.onResolve({ filter: /.*/ }, async (args) => {
      if (args.kind === "entry-point" || args.pluginData === "remapped") return;
      const spec = args.path;
      if (spec.startsWith("./") || spec.startsWith("../") || path.isAbsolute(spec)) return;
      if (spec.startsWith("node:")) return { path: spec, external: true };
      const mapped = applyImportMap(spec);
      let target;
      if (mapped.startsWith("jsr:")) target = jsrToNpm(mapped);
      else if (mapped.startsWith("npm:")) target = npmSpec(mapped);
      else if (mapped.startsWith("https://cdn.skypack.dev/")) target = skypack(mapped);
      else if (mapped.startsWith("https://deno.land/")) target = denoLand(mapped);
      else if (/^https?:\/\//.test(mapped)) throw new Error(`unmapped remote import ${spec} -> ${mapped} (from ${args.importer})`);
      else target = mapped;
      resolved.set(spec, target);
      if (path.isAbsolute(target)) return { path: target };
      const r = await build.resolve(target, { kind: args.kind, resolveDir: spike, pluginData: "remapped" });
      if (r.errors.length) return { errors: r.errors.map((e) => ({ ...e, text: `${e.text} (mapping ${spec} -> ${target} from ${args.importer})` })) };
      return { path: r.path, external: r.external };
    });
  },
};

const t0 = Date.now();
const result = await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile,
  sourcemap: true,
  logLevel: "warning",
  plugins: [plugin],
  define: { "import.meta.main": "true" },
  banner: { js: `import "${path.relative(path.dirname(outfile), path.join(spike, "deno-shim.js"))}";\nimport { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);` },
  metafile: true,
  tsconfigRaw: { compilerOptions: { useDefineForClassFields: true, verbatimModuleSyntax: false } },
});
fs.writeFileSync(path.join(spike, "dist", "meta.json"), JSON.stringify(result.metafile));
const summary = {};
for (const [spec, target] of resolved) summary[spec] = target;
fs.writeFileSync(path.join(spike, "dist", "resolved.json"), JSON.stringify(summary, null, 2));
const size = fs.statSync(outfile).size;
console.log(`bundled ${path.relative(root, entry)} -> ${path.relative(root, outfile)} (${(size / 1e6).toFixed(1)} MB, ${Object.keys(result.metafile.inputs).length} modules, ${Date.now() - t0} ms, ${result.warnings.length} warnings)`);
