/*
* utils.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { fileLoader } from "../../utils.ts";
import { unitTest } from "../../test.ts";
import { initTreeSitter } from "../../../src/core/lib/yaml-validation/deno-init-tree-sitter.ts";
import { initPrecompiledModules } from "../../../src/core/lib/yaml-validation/deno-init-precompiled-modules.ts";
import {
  initState,
  setInitializer,
} from "../../../src/core/lib/yaml-validation/state.ts";
import { ensureAjv } from "../../../src/core/schema/yaml-schema.ts";
import { convertFromYAMLString } from "../../../src/core/schema/from-yaml.ts";
import { setSchemaDefinition } from "../../../src/core/lib/yaml-validation/schema.ts";
import { ValidationError } from "../../../src/core/schema/validated-yaml.ts";
import { isEqual } from "../../../src/core/lodash.ts";
import { assertRejects } from "https://deno.land/std@0.122.0/testing/asserts.ts";

export const schemaTestFile = fileLoader("schema-validation");

export async function fullInit() {
  await initPrecompiledModules();
  await initTreeSitter();
  await ensureAjv();
}

export function schemaFromString(schemaStr: string) {
  const schema = convertFromYAMLString(schemaStr);
  setSchemaDefinition(schema);
  return schema;
}

// deno-lint-ignore no-explicit-any
export function expectValidationError(e: any) {
  let willThrow = e instanceof ValidationError;
  const goodE = e as ValidationError;
  const result = {
    toHaveLength(l: number) {
      if (!willThrow) return result;
      if (goodE.validationErrors.length !== l) {
        willThrow = false;
      }
      return result;
    },
    forSchemaPathToEndWith(spec: string | string[], which?: number) {
      if (!willThrow) return result;
      if (typeof spec === "string") {
        spec = [spec];
      }
      if (which === undefined) {
        which = 0;
      }
      if (goodE.validationErrors[which] === undefined) {
        willThrow = false;
        return result;
      }
      if (
        !isEqual(
          spec,
          goodE.validationErrors[which].schemaPath.slice(-spec.length),
        )
      ) {
        willThrow = false;
        return result;
      }
      return result;
    },
    go() {
      if (willThrow) {
        throw e;
      }
    },
  };
  return result;
}

export type ValidationChecker = ReturnType<typeof expectValidationError>;

export async function assertYamlValidationFails(
  fun: () => Promise<unknown>,
  checker: (e: ValidationError) => ValidationChecker,
) {
  await assertRejects(async () => {
    try {
      await fun();
    } catch (e) {
      if (e instanceof ValidationError) {
        checker(e).go();
      }
    }
  });
}

// deno-lint-ignore require-await
export async function yamlValidationUnitTest(
  name: string,
  fun: () => Promise<unknown>,
) {
  unitTest(name, async () => {
    setInitializer(fullInit);
    await initState();
    await fun();
  });
}
