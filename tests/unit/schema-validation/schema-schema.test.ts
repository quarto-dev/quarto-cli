/*
 * schema-schema.test.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 *
 */

import { assert } from "testing/asserts";
import { schemaPath } from "../../../src/core/schema/utils.ts";
import { getSchemaSchemas } from "../../../src/core/lib/yaml-schema/from-yaml.ts";
import { yamlValidationUnitTest } from "./utils.ts";
import {
  arraySchema,
  idSchema,
  refSchema,
} from "../../../src/core/lib/yaml-schema/common.ts";
import { readAndValidateYamlFromFile } from "../../../src/core/schema/validated-yaml.ts";
import { expandGlobSync } from "../../../src/core/deno/expand-glob.ts";
import { readAndValidateYamlFromMappedString } from "../../../src/core/lib/yaml-schema/validated-yaml.ts";
import { asMappedString } from "../../../src/core/lib/mapped-text.ts";

yamlValidationUnitTest("schema-schema-enum", async () => {
  const _d = getSchemaSchemas(); // this registers the schema schema
  const schemaSchema = refSchema("schema/object", "");

  const yamlStrs = [
    `
object:
  closed: true
  super:
    resolveRef: schema/base
  properties:
    enum:
      anyOf:
        - arrayOf:
            ref: schema/scalar
        - object:
            super:
              resolveRef: schema/base
            properties:
              values:
                arrayOf:
                  ref: schema/scalar
`,
    `
object:
  properties:
    properties:
      object:
        additionalProperties:
          ref: schema/schema
  additionalProperties:
    ref: schema/schema`,
    `
object:
  properties:
    apiUrl:
      string:
        description: The base URL of the service API.
    authority:
      string:
        description: The domain name which the annotation service is associated with.
    grantToken:
      string:
        description: An OAuth 2 grant token which the client can send to the service in order to get an access token for making authenticated requests to the service.
    allowLeavingGroups:
      boolean:
        default: true
        description: A flag indicating whether users should be able to leave groups of which they are a member.
    enableShareLinks:
      boolean:
        default: true
        description: A flag indicating whether annotation cards should show links that take the user to see an annotation in context.
    groups:
      anyOf:
        - enum: ["$rpc:requestGroups"]
        - arrayOf: string
      description: An array of Group IDs or the literal string \`$rpc:requestGroups\`
    icon:
      string:
        description: The URL to an image for the annotation service. This image will appear to the left of the name of the currently selected group.
  required: [apiUrl, authority, grantToken]`,
    `
object:
  properties:
    accentColor:
      string:
        description: Secondary color for elements of the commenting UI.
    appBackgroundColor:
      string:
        description: The main background color of the commenting UI.
    ctaBackgroundColor:
      string:
        description: The background color for call to action buttons.
    selectionFontFamily:
      string:
        description: The font family for selection text in the annotation card.
    annotationFontFamily:
      string:
        description: The font family for the actual annotation value that the user writes about the page or selection.
  description: Settings to adjust the commenting sidebar's look and feel.
  `,
  ];

  for (const yamlStr of yamlStrs) {
    const result = await readAndValidateYamlFromMappedString(
      asMappedString(yamlStr),
      schemaSchema,
    );
    assert(result.yamlValidationErrors.length === 0);
  }
});

yamlValidationUnitTest("schema-schema", async () => {
  const _d = getSchemaSchemas(); // this registers the schema schema
  const yamlSchemaArray = idSchema(
    arraySchema(refSchema("schema/schema", "")),
    "schema-array",
  );

  await readAndValidateYamlFromFile(
    schemaPath("schema.yml"),
    yamlSchemaArray,
    "schema schema validation",
  );

  await readAndValidateYamlFromFile(
    schemaPath("definitions.yml"),
    yamlSchemaArray,
    "schema definitions",
  );
});

yamlValidationUnitTest("quarto-schemas", async () => {
  const _d = getSchemaSchemas(); // this registers the schema schema
  const schema = idSchema(
    arraySchema(refSchema("schema/schema-field", "")),
    "schema-field-array",
  );
  for (
    const walk of expandGlobSync(schemaPath("{project,{cell,document}-*}.yml"))
  ) {
    await readAndValidateYamlFromFile(
      walk.path,
      schema,
      walk.path,
    );
  }
});
