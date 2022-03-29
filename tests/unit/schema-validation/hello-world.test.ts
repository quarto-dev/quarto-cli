import { readAnnotatedYamlFromString } from "../../../src/core/lib/yaml-intelligence/annotated-yaml.ts";
import { asMappedString } from "../../../src/core/mapped-text.ts";

import { setSchemaDefinition } from "../../../src/core/lib/yaml-validation/schema.ts";
import { yamlValidationUnitTest } from "./utils.ts";

import { YAMLSchema } from "../../../src/core/lib/yaml-validation/yaml-schema.ts";

import { ObjectSchema } from "../../../src/core/lib/yaml-schema/types.ts";

yamlValidationUnitTest("schema-validation-hello-world", async () => {
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
  const schema: ObjectSchema = {
    "type": "object",
    "properties": {
      "lets": { "type": "number", "maximum": 2 },
      "annotate": { "type": "string" },
    },
    "$id": "test-schema",
  };
  setSchemaDefinition(schema);
  const yamlSchema = new YAMLSchema(schema);
  // deno-lint-ignore no-explicit-any
  const fromPlainString = (schema: any, src: string) =>
    schema.validateParse(asMappedString(src), readAnnotatedYamlFromString(src));
  await fromPlainString(yamlSchema, src);
});
