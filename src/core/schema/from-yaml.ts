/*
* from-yaml.ts
*
* Functions to convert YAML to JSON Schema
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { readAnnotatedYamlFromString } from "./annotated-yaml.ts";
import { idSchema } from "./common.ts";

function convertFromYaml(annotation: AnnotatedParse)
{
  if (annotation.ob
}

export function convertFromYAMLString(src: string)
{
  const yaml = readAnnotatedYamlFromString(src);
  return convertFromYaml(yaml);
}
