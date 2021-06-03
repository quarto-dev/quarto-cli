/*
* verify.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/exists.ts";
import { assert } from "testing/asserts.ts";

import { outputForInput } from "./utils.ts";

export function verifyPath(path: string) {
  const pathExists = existsSync(path);
  assert(pathExists, `Path ${path} doesn't exist`);
}

interface Output {
  outputPath: string;
  supportPath: string;
}

export interface VerifyRender {
  name: string;
  verify: (input: string, to: string) => void;
}

export const fileExists = (file: string): VerifyRender => {
  return {
    name: `File ${file} exists`,
    verify: (_input: string, _to: string) => {
      verifyPath(file);
    },
  };
};

export const noSupportingFiles = {
  name: "No Supporting Files Dir",
  verify: (input: string, to: string) => {
    const output = outputForInput(input, to);
    verifyNoPath(output.supportPath);
  },
};

export const hasSupportingFiles = {
  name: "Has Supporting Files Dir",
  verify: (input: string, to: string) => {
    const output = outputForInput(input, to);
    verifyPath(output.supportPath);
  },
};

export const outputCreated = {
  name: "Output Created",
  verify: (input: string, to: string) => {
    const output = outputForInput(input, to);
    verifyPath(output.outputPath);
  },
};

function verifyNoPath(path: string) {
  const pathExists = existsSync(path);
  assert(!pathExists, `Unexpected directory: ${path}`);
}
