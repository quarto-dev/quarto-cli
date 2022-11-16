/*
* error-narrowing.test.ts
*
* Unit tests regarding the YAML validation error narrowing heuristics
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import {
  assertYamlValidationFails,
  expectValidationError,
  schemaFromString,
  yamlValidationUnitTest,
} from "./utils.ts";
import {
  readAndValidateYamlFromMappedString,
  ValidationError,
} from "../../../src/core/lib/yaml-schema/validated-yaml.ts";
import { asMappedString } from "../../../src/core/lib/mapped-text.ts";
import { Schema } from "../../../src/core/lib/yaml-schema/types.ts";

const readAndThrow = async (str: string, schema: Schema): Promise<unknown> => {
  const { yaml, yamlValidationErrors } =
    await readAndValidateYamlFromMappedString(
      asMappedString(str),
      schema,
    );
  if (yamlValidationErrors.length) {
    throw new ValidationError("this should throw", yamlValidationErrors);
  }
  return yaml;
};

// deno-lint-ignore require-await
yamlValidationUnitTest("schema-narrowing", async () => {
  const schema = schemaFromString(`
id: schema-test-1
record:
  baz: number
  bar: string
`);
  const ymlStr = `
baz: 3
`;
  assertYamlValidationFails(async () => {
    await readAndThrow(ymlStr, schema);
  }, (e: ValidationError) =>
    expectValidationError(e)
      .toHaveLength(1)
      .forSchemaPathToEndWith("required"));
});

yamlValidationUnitTest("schema-narrowing", async () => {
  const _s1 = schemaFromString(`
id: navigation-item-test-1
anyOf:
  - path
  - object:
      properties:
        href:
          string:
            description: |
              Link to file contained with the project or external URL
        url:
          hidden: true
          string:
            description: |
              Alias for href
        file:
          hidden: true
          string:
            description: |
              Alias for href
        text:
          string:
            description: |
              Text to display for navigation item (defaults to the
              document title if not provided)
        icon:
          string:
            description:
              short: Name of bootstrap icon (e.g. \`github\`, \`twitter\`, \`share\`)
              long: |
                Name of bootstrap icon (e.g. \`github\`, \`twitter\`, \`share\`)
                See <https://icons.getbootstrap.com/> for a list of available icons
        aria-label:
          string:
            description: "Accessible label for the navigation item."
        menu:
          arrayOf:
            schema:
              ref: navigation-item-test-1
      closed: true
`);

  const _s2 = schemaFromString(`
id: chapter-item-test-1
anyOf:
  - ref: navigation-item-test-1
  - record:
      part:
        path:
          description: "Part title or path to input file"
      chapters:
        arrayOf:
          ref: navigation-item-test-1
        description: "Path to chapter input file"
`);

  const s3 = schemaFromString(`
id: chapter-list-test-1
arrayOf:
  ref: chapter-item-test-1
`);

  const ymlStr = `
- part: "Hardening"
  chapters:
    - hardening/hardening.qmd
    - text: "Set Up SSL"
      file: hardening/set_up_ssl.qmd
    - hardening/browser_security.qmd
    - hardening/r_session_security.qmd
    - hardening/database.qmd
    - hardening/other.qmd
    - hardening/example_secure_configuration.qmd
- part: "-----"
`;

  await assertYamlValidationFails(async () => {
    await readAndThrow(ymlStr, s3);
  }, (e: ValidationError) => {
    return expectValidationError(e)
      .toHaveLength(1)
      .forSchemaPathToEndWith("required");
  });
});

yamlValidationUnitTest("error-narrowing", async () => {
  const schema = schemaFromString(`
id: error-narrowing-schema-test
anyOf:
  - string
  - record:
      foo: string
      bar: string`);

  await assertYamlValidationFails(async () => {
    await readAndThrow("foo: bar", schema);
  }, (e: ValidationError) => {
    return expectValidationError(e)
      .toHaveLength(1)
      .forSchemaPathToEndWith("required");
  });
});
