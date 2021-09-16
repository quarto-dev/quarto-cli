import { unitTest } from "../../test.ts";
import { YAMLSchema } from "../../../src/core/schema/yaml-schema.ts";
import { frontMatterSchema as fm } from "../../../src/core/schema/front-matter.ts";

unitTest("execute-validation", () => {
  const good = `
title: A quarto document
execute:
  echo: false
`;

  const bad = `
title: A bad quarto document
execute: [1, 2, "foo"] 
`;
  
  const fmSchema = new YAMLSchema(fm);

  fmSchema.parseAndValidate(good);
  fmSchema.parseAndValidate(bad);
});
