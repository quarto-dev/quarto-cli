import { unitTest } from "../../test.ts";
import { YAMLSchema, ensureAjv } from "../../../src/core/schema/yaml-schema.ts";
import { readAnnotatedYamlFromString } from "../../../src/core/schema/annotated-yaml.ts";
import { asMappedString } from "../../../src/core/mapped-text.ts";

unitTest("schema-validation-hello-world", async () => {

  const src = `
lets:
  - 1
  - 2
  - 3
  - 4
go:
  - there
  - and
  - elsewhere
what:
  about:
    nested: "things like this"
`;

  await ensureAjv();
  
  const yamlSchema = new YAMLSchema({
    "type": "object",
    "properties": {
      "lets": { "type": "number", "maximum": 2 },
      "annotate": { "type": "string" }
    }
  });

  // deno-lint-ignore no-explicit-any
  const fromPlainString = (schema: any, src: string) =>
    schema.validateParse(asMappedString(src), readAnnotatedYamlFromString(src));

  fromPlainString(yamlSchema, src);
});
