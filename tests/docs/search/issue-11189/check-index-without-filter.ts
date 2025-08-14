const json = JSON.parse(Deno.readTextFileSync("_site_without_filter/search.json"));

const obj = Object.fromEntries(json.map((x: any) => [x.objectID, x]));

const file = "about.html";

if (obj[file].text.match("Please don't find me.") !== null) {
  throw new Error("found text that should be hidden in " + file);
};
