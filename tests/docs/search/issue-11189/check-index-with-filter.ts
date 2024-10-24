const json = JSON.parse(Deno.readTextFileSync("_site_with_filter/search.json"));

const obj = Object.fromEntries(json.map((x: any) => [x.objectID, x]));

const file = "index.html";

if (obj[file].text.match("Please find me.") === null) {
  throw new Error("could not find text that should be shown in " + file);
};
