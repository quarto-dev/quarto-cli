import { testQuartoCmd } from "../../test.ts";
import { fileExists, noErrorsOrWarnings } from "../../verify.ts";

import { existsSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { docs } from "../../utils.ts";

// Test a simple site
const input = docs("search/issue-11189");
const withFilterProfile = "--profile with-filter"

testQuartoCmd(
  "render",
  [input],
  [noErrorsOrWarnings],
  {
    name: "Test search exclusions without filter",
    teardown: async () => {
      const siteDir = join(input, "_site_without_filter");
      if (existsSync(siteDir)) {
        await Deno.remove(siteDir, { recursive: true });
      }
    },
  },
);

testQuartoCmd(
  "render",
  [withFilterProfile, input],
  [noErrorsOrWarnings],
  {
    name: "Test search exclusions with filter",
    teardown: async () => {
      const siteDir = join(input, "_site_with_filter");
      if (existsSync(siteDir)) {
        await Deno.remove(siteDir, { recursive: true });
      }
    },
  },
);
