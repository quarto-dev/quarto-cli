import { unitTest } from "../../test.ts";
import { ensureAjv } from "../../../src/core/schema/yaml-schema.ts";
import { assert } from "testing/asserts.ts";
import { getFormatSchema } from "../../../src/core/schema/format-schemas.ts";

unitTest("execute-validation", async () => {

  ensureAjv();

  const result = await getFormatSchema("html");
});
