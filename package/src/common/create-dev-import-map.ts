/*
* create-dev-import-map.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { mergeImportMaps } from "../../../src/core/deno/import-maps.ts";

const importMapSpecs = [
  {
    importMap: JSON.parse(Deno.readTextFileSync("./src/import_map.json")),
    prefix: "",
  },
  {
    importMap: JSON.parse(
      Deno.readTextFileSync("./src/vendor/import_map.json"),
    ),
    prefix: "vendor",
  },
];

Deno.writeTextFileSync(
  "./src/dev_import_map.json",
  JSON.stringify(mergeImportMaps(...importMapSpecs), null, 2),
);
