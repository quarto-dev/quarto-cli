import { ensureSchemaResources } from "../../../src/core/schema/yaml-schema.ts";
import { getFormatSchema } from "../../../src/core/lib/yaml-schema/format-schemas.ts";
import { yamlValidationUnitTest } from "./utils.ts";

yamlValidationUnitTest("execute-validation", async () => {
  ensureSchemaResources();

  await getFormatSchema("html");
});
