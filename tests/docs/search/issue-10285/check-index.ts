const json = JSON.parse(Deno.readTextFileSync("_book/search.json"));

const obj = Object.fromEntries(json.map((x: any) => [x.objectID, x]));

for (const file of ["search-test.html", "search-test-2.html", "search-test-3.html"]) {
  if (obj[file].text.match("Please find me.") === null) {
    throw new Error("missing pre-section content in " + file);
  };
}
