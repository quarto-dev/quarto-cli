import { unitTest } from "../../test.ts";
import { YAMLSchema } from "../../../src/core/schema/yaml-schema.ts";

unitTest("schema-validation-hello-world", () => {

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

  const yamlSchema = new YAMLSchema({
    "type": "object",
    "properties": {
      "lets": { "type": "number", "maximum": 2 },
      "annotate": { "type": "string" }
    }
  });

  yamlSchema.parseAndValidate(src);
});
