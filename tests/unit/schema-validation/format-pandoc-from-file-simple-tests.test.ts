import { ensureAjv } from "../../../src/core/schema/yaml-schema.ts";
import { getFormatSchema } from "../../../src/core/schema/format-schemas.ts";
import { yamlValidationUnitTest } from "./utils.ts";

yamlValidationUnitTest("execute-validation", async () => {
  ensureAjv();

  await getFormatSchema("html");
});
