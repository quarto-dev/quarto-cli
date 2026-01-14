// import YML from "https://esm.sh/json-to-pretty-yaml"; timing out, obnoxious
import YML from "https://cdn.skypack.dev/json-to-pretty-yaml";

export const drawTree = (sel, data, summary) => {
  const el = sel.append("div");
  const deets = el.append("details");
  if (summary) {
    deets.append("summary").text(summary);
  }
  deets.append("pre").text(YML.stringify(data));
  return deets;
};
