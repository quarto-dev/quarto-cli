// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { parse } from "./parse.ts";

export function canParse(version: string): boolean {
  try {
    parse(version);
    return true;
  } catch (err) {
    if (!(err instanceof TypeError)) {
      throw err;
    }
    return false;
  }
}
