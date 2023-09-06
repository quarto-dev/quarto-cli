import jsonpatch from "https://esm.sh/fast-json-patch";
import * as d3 from "https://esm.sh/d3@7";
// import YML from "https://esm.sh/json-to-pretty-yaml"; timing out, obnoxious
import YML from "https://cdn.skypack.dev/json-to-pretty-yaml";

import { convertDoc } from "./convert-pandoc-json.js";

const searchParams = new URLSearchParams(new URL(document.URL).search);

const data = await fetch(
  searchParams.get("file") ?? "quarto-filter-trace.json"
);
const json = await data.json();

const drawTree = (data, summary) => {
  const el = d3.select("#output").append("div");
  const deets = el.append("details");
  if (summary) {
    deets.append("summary").text(summary);
  }
  deets.append("pre").text(YML.stringify(data));
  return deets;
};

d3.select("#output").append("h2").text("Starting doc");

drawTree(convertDoc(json.data[0].doc), "Doc");
let isNoOp = true;

for (let i = 1; i < json.data.length; ++i) {
  const ops = jsonpatch.compare(
    convertDoc(json.data[i - 1].doc),
    convertDoc(json.data[i].doc)
  );
  if (ops.length === 0) {
    d3.select("#output")
      .append("h2")
      .text(`Filter: ${json.data[i].state} (no op)`);
    if (!isNoOp) {
      drawTree(convertDoc(json.data[i].doc), "Doc");
      isNoOp = true;
    }
    continue;
  }
  isNoOp = false;

  d3.select("#output").append("h2").text(`Filter: ${json.data[i].state}`);
  drawTree(convertDoc(json.data[i].doc), "Doc");
  drawTree(ops, "Ops")
    .style("margin-bottom", "0.1em")
    .style("margin-top", "0.1em");
}
