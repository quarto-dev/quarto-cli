const extensionRe = /\.[^/]*$/;
const mains = ["unpkg", "jsdelivr", "browser", "main"];

(async () => {
  console.log(`import {dependency} from "./dependency.js";`);
  {
    const info = await resolve("d3");
    console.log(`export const d3 = dependency("${info.name}", "${info.version}", "${info.export}");`);
  }
  {
    const info = await resolve("@observablehq/inputs");
    console.log(`export const inputs = dependency("${info.name}", "${info.version}", "${info.export}");`);
  }
  {
    const info = await resolve("@observablehq/plot");
    console.log(`export const plot = dependency("${info.name}", "${info.version}", "${info.export}");`);
  }
  {
    const info = await resolve("@observablehq/graphviz");
    console.log(`export const graphviz = dependency("${info.name}", "${info.version}", "${info.export}");`);
  }
  {
    const info = await resolve("@observablehq/highlight.js");
    console.log(`export const highlight = dependency("${info.name}", "${info.version}", "${info.export}");`);
  }
  {
    const info = await resolve("@observablehq/katex");
    console.log(`export const katex = dependency("${info.name}", "${info.version}", "${info.export}");`);
  }
  {
    const info = await resolve("lodash");
    console.log(`export const lodash = dependency("${info.name}", "${info.version}", "${info.export.replace(/\.js$/, ".min.js")}");`);
  }
  {
    const info = await resolve("htl");
    console.log(`export const htl = dependency("${info.name}", "${info.version}", "${info.export}");`);
  }
  {
    const info = await resolve("jszip");
    console.log(`export const jszip = dependency("${info.name}", "${info.version}", "dist/jszip.min.js");`);
  }
  {
    const info = await resolve("marked@0.3.12");
    console.log(`export const marked = dependency("${info.name}", "${info.version}", "marked.min.js");`);
  }
  {
    const info = await resolve("sql.js");
    console.log(`export const sql = dependency("${info.name}", "${info.version}", "${info.export}");`);
  }
  {
    const info = await resolve("vega");
    console.log(`export const vega = dependency("${info.name}", "${info.version}", "${info.export}");`);
  }
  {
    const info = await resolve("vega-lite");
    console.log(`export const vegalite = dependency("${info.name}", "${info.version}", "${info.export}");`);
  }
  {
    const info = await resolve("vega-lite-api");
    console.log(`export const vegaliteApi = dependency("${info.name}", "${info.version}", "${info.export}");`);
  }
  {
    const info = await resolve("apache-arrow@4");
    console.log(`export const arrow4 = dependency("${info.name}", "${info.version}", "${info.export}");`);
  }
  {
    const info = await resolve("apache-arrow@9");
    console.log(`export const arrow9 = dependency("${info.name}", "${info.version}", "+esm");`);
  }
  {
    const info = await resolve("apache-arrow@11");
    console.log(`export const arrow11 = dependency("${info.name}", "${info.version}", "+esm");`);
  }
  {
    const info = await resolve("arquero");
    console.log(`export const arquero = dependency("${info.name}", "${info.version}", "${info.export}");`);
  }
  {
    const info = await resolve("topojson-client");
    console.log(`export const topojson = dependency("${info.name}", "${info.version}", "${info.export}");`);
  }
  {
    const info = await resolve("exceljs");
    console.log(`export const exceljs = dependency("${info.name}", "${info.version}", "${info.export}");`);
  }
  {
    const info = await resolve("mermaid");
    console.log(`export const mermaid = dependency("${info.name}", "${info.version}", "${info.export.replace(/\.core\.js$/, ".min.js")}");`);
  }
  {
    const info = await resolve("leaflet");
    console.log(`export const leaflet = dependency("${info.name}", "${info.version}", "${info.export.replace(/-src\.js$/, ".js")}");`);
  }
  {
    const info = await resolve("@duckdb/duckdb-wasm");
    console.log(`export const duckdb = dependency("${info.name}", "${info.version}", "+esm");`);
  }
})();

async function resolve(specifier) {
  const response = await fetch(`https://cdn.jsdelivr.net/npm/${specifier}/package.json`);
  const info = await response.json();
  return {
    name: info.name,
    version: info.version,
    export: main(info)
  };
}

// https://github.com/d3/d3-require/blob/4056a786912e9335a86b41c2b1cdfa392bd14289/src/index.js#L20-L27
function main(meta) {
  for (const key of mains) {
    const value = meta[key];
    if (typeof value === "string") {
      return (extensionRe.test(value) ? value : `${value}.js`).replace(/^\.\//, "");
    }
  }
  return "index.js";
}
