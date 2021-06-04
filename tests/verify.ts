/*
* verify.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/exists.ts";
import { assert } from "testing/asserts.ts";

import { outputForInput } from "./utils.ts";
import { ExecuteOutput } from "./test.ts";

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
  verify: (input: string, to: string, output: ExecuteOutput[]) => void;
}

export const fileExists = (file: string): VerifyRender => {
  return {
    name: `File ${file} exists`,
    verify: (_input: string, _to: string, _output: ExecuteOutput[]) => {
      verifyPath(file);
    },
  };
};

export const noSupportingFiles = {
  name: "No Supporting Files Dir",
  verify: (input: string, to: string, _output: ExecuteOutput[]) => {
    const outputFile = outputForInput(input, to);
    verifyNoPath(outputFile.supportPath);
  },
};

export const hasSupportingFiles = {
  name: "Has Supporting Files Dir",
  verify: (input: string, to: string, _output: ExecuteOutput[]) => {
    const outputFile = outputForInput(input, to);
    verifyPath(outputFile.supportPath);
  },
};

export const outputCreated = {
  name: "Output Created",
  verify: (input: string, to: string, output: ExecuteOutput[]) => {
    // Check for output created message
    const outputCreatedMsg = output.find((outMsg) =>
      outMsg.msg.startsWith("Output created:")
    );
    assert(outputCreatedMsg !== undefined, "No output created message");

    // Check for existence of the output
    const outputFile = outputForInput(input, to);
    verifyPath(outputFile.outputPath);
  },
};

function verifyNoPath(path: string) {
  const pathExists = existsSync(path);
  assert(!pathExists, `Unexpected directory: ${path}`);
}
