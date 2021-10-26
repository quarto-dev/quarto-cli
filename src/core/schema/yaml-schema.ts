/*
* yaml-schema.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import Ajv from 'ajv';
import { setupAjv } from "../lib/yaml-schema.ts";
import { YAMLSchema } from "../lib/yaml-schema.ts";
export { YAMLSchema } from "../lib/yaml-schema.ts";

setupAjv(new Ajv({ allErrors: true }));
