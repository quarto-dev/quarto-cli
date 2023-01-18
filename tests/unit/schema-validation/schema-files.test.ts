import { expandGlobSync } from "../../../src/core/deno/expand-glob.ts";
import { tidyverseFormatError } from "../../../src/core/lib/errors.ts";
import { LocalizedError } from "../../../src/core/lib/yaml-schema/types.ts";
import { withValidator } from "../../../src/core/lib/yaml-validation/validator-queue.ts";
import { WithValidatorFun } from "../../../src/core/lib/yaml-validation/validator-queue.ts";
import { unitTest } from "../../test.ts";
import { fullInit, readSelfValidatingSchemaTestFile } from "./utils.ts";

const globOutput = Deno.args.length
  ? expandGlobSync(Deno.args[0])
  : expandGlobSync(
    "docs/schema-files/**/*.yml",
  );

await fullInit();

type Res = {
  yaml: { [key: string]: unknown };
  yamlValidationErrors: LocalizedError[];
};

for (const { path: fileName } of globOutput) {
  const input = fileName;

  unitTest(
    `schema validation of ${input}`,
    async () => {
      const { schema, annotation, mappedYaml } =
        readSelfValidatingSchemaTestFile(input);

      const validate: WithValidatorFun<Res> = async (validator) => {
        const valResult = await validator.validateParse(
          mappedYaml,
          annotation,
        );
        return {
          yaml: annotation.result as { [key: string]: unknown },
          yamlValidationErrors: valResult.errors,
        };
      };

      const validationResult = await withValidator(
        schema,
        validate,
      );

      if (
        validationResult.yamlValidationErrors.length !== 0
      ) {
        for (const error of validationResult.yamlValidationErrors) {
          console.log(tidyverseFormatError(error.niceError));
        }
        throw new Error("validation failed");
      }
    },
  );
}
