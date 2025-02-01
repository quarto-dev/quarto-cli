// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

type Delimiter = string | [begin: string, end: string];

function getBeginToken(delimiter: Delimiter): string {
  return Array.isArray(delimiter) ? delimiter[0] : delimiter;
}

function getEndToken(delimiter: Delimiter): string {
  return Array.isArray(delimiter) ? delimiter[1] : delimiter;
}

function createRegExps(delimiters: Delimiter[]): [RegExp, RegExp] {
  const beginPattern = "(" + delimiters.map(getBeginToken).join("|") + ")";
  const pattern = "^(" +
    "\\ufeff?" + // Maybe byte order mark
    beginPattern +
    "$([\\s\\S]+?)" +
    "^(?:" + delimiters.map(getEndToken).join("|") + ")\\s*" +
    "$" +
    (globalThis?.Deno?.build?.os === "windows" ? "\\r?" : "") +
    "(?:\\n)?)";

  return [
    new RegExp("^" + beginPattern + "$", "im"),
    new RegExp(pattern, "im"),
  ];
}

const [RECOGNIZE_YAML_REGEXP, EXTRACT_YAML_REGEXP] = createRegExps(
  [
    ["---yaml", "---"],
    "= yaml =",
    "---",
  ],
);
const [RECOGNIZE_TOML_REGEXP, EXTRACT_TOML_REGEXP] = createRegExps(
  [
    ["---toml", "---"],
    "\\+\\+\\+",
    "= toml =",
  ],
);
const [RECOGNIZE_JSON_REGEXP, EXTRACT_JSON_REGEXP] = createRegExps(
  [
    ["---json", "---"],
    "= json =",
  ],
);

export const RECOGNIZE_REGEXP_MAP = {
  yaml: RECOGNIZE_YAML_REGEXP,
  toml: RECOGNIZE_TOML_REGEXP,
  json: RECOGNIZE_JSON_REGEXP,
} as const;

export const EXTRACT_REGEXP_MAP = {
  yaml: EXTRACT_YAML_REGEXP,
  toml: EXTRACT_TOML_REGEXP,
  json: EXTRACT_JSON_REGEXP,
} as const;
