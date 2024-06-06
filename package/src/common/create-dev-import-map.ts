/*
* create-dev-import-map.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { mergeImportMaps } from "../../../src/core/deno/import-maps.ts";
import { join } from "../../../src/deno_ral/path.ts";

const QUARTO_SRC_PATH = Deno.env.get("QUARTO_SRC_PATH") || ".";

const importMapSpecs = [
  {
    importMap: JSON.parse(Deno.readTextFileSync(join(QUARTO_SRC_PATH, "import_map.json"))),
    prefix: "",
  },
  {
    importMap: JSON.parse(
      Deno.readTextFileSync(join(QUARTO_SRC_PATH, "vendor/import_map.json")),
    ),
    prefix: "vendor",
  },
];

Deno.writeTextFileSync(
  join(QUARTO_SRC_PATH, "dev_import_map.json"),
  JSON.stringify(mergeImportMaps(...importMapSpecs), null, 2),
);
