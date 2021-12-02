import { unitTest } from "../../test.ts";
import { YAMLSchema, ensureAjv } from "../../../src/core/schema/yaml-schema.ts";
import { getFrontMatterSchema } from "../../../src/core/schema/front-matter.ts";
import { readAnnotatedYamlFromString } from "../../../src/core/schema/annotated-yaml.ts";
import { asMappedString } from "../../../src/core/mapped-text.ts";
import { assert } from "testing/asserts.ts";

unitTest("execute-validation", async () => {
  const good = `
title: A quarto document
execute:
  echo: false
`;

  const bad = `
title: A bad quarto document
execute: [1, 2, "foo"] 
`;
  await ensureAjv();

  const fm = await getFrontMatterSchema(true);
  const fmSchema = new YAMLSchema(fm);

  // deno-lint-ignore no-explicit-any
  const fromPlainString = (schema: any, src: string) =>
    schema.validateParse(asMappedString(src), readAnnotatedYamlFromString(src));
  
  const goodResult = fromPlainString(fmSchema, good);
  const badResult = fromPlainString(fmSchema, bad);

  assert(goodResult.errors.length === 0, "good document should pass");
  assert(badResult.errors.length !== 0, "bad document should fail");
});
