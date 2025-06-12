/*
* log-level-direct.test.ts
*
* Copyright (C) 2020-2025 Posit Software, PBC
*
*/

import { basename, extname } from "../../../src/deno_ral/path.ts";
import { execProcess } from "../../../src/core/process.ts";
import { md5HashSync } from "../../../src/core/hash.ts";
import { safeRemoveIfExists } from "../../../src/core/path.ts";
import { quartoDevCmd, outputForInput } from "../../utils.ts";
import { assert } from "testing/asserts";
import { LogFormat } from "../../../src/core/log.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { readExecuteOutput } from "../../test.ts";

// Simple minimal document for testing
const testDoc = "docs/minimal.qmd";
const testDocWithError = "docs/logging/lua-error.qmd";

// NOTE: We intentionally do NOT test environment variables (QUARTO_LOG, QUARTO_LOG_LEVEL, QUARTO_LOG_FORMAT)
// because they can interfere with other tests running concurrently in the Deno environment.
// Instead, we focus on testing the CLI arguments which are isolated to each test.

// Those tests are not using testQuartoCmd because they are testing the log level directly
// and custom helpers in tests() are modifying the logging configuration.
// This is why we use Deno.test directly here.

function testLogDirectly(options: {
  testName: string,
  level: string,
  format?: LogFormat,
  logFile?: string,
  fileToRender?: string,
  quiet?: boolean,
  expectedOutputs?: {
    // To test log output for document with errors
    shouldSucceed?: boolean
    // For plain format, we can check for specific text in the output
    shouldContain?: string[],
    shouldNotContain?: string[],
    // For JSON format, we can also check for specific log levels
    shouldContainLevel?: string[],
    shouldNotContainLevel?: string[],
  }
}) {
  Deno.test({
    name: options.testName,
    fn: async () => {
      // Generate a unique log file path if one was provided
      // This is to avoid conflicts when running multiple tests in parallel
      let logFile = options.logFile;
      if (logFile) {
        const testNameHash = md5HashSync(options.testName);
        const extension = extname(logFile);
        const baseName = basename(logFile, extension);
        logFile = `${baseName}-${testNameHash}${extension}`;
      }
      
      try {
        // Build command args
        const args = ["render"];
        
        // Add file path (default to testDoc if not specified)
        if (!options.fileToRender) {
          options.fileToRender = testDoc;
        }
        args.push(options.fileToRender);
        
        // Add log level
        args.push("--log-level", options.level);
        
        // Add format if specified
        if (options.format) {
          args.push("--log-format", options.format);
        }

        if (logFile) {
          args.push("--log", logFile);
        }
        
        // Add quiet if specified
        if (options.quiet) {
          args.push("--quiet");
        }
        
        // Execute quarto directly
        const process = await execProcess({
          cmd: quartoDevCmd(),
          args: args,
          stdout: "piped",
          stderr: "piped"
        });
        
        // Get stdout/stderr with fallback to empty string
        const stdout = process.stdout || "";
        const stderr = process.stderr || "";
        const allOutput = stdout + stderr;
        
        // Check success/failure expectation
        if (options.expectedOutputs?.shouldSucceed !== undefined) {
          assert(
            process.success === options.expectedOutputs.shouldSucceed,
            options.expectedOutputs.shouldSucceed
              ? `Process unexpectedly failed: ${stderr}`
              : `Process unexpectedly succeeded (expected failure)`
          );
        }
        
        // Check for expected content
        if (options.expectedOutputs?.shouldContain) {
          for (const text of options.expectedOutputs.shouldContain) {
            assert(
              allOutput.includes(text),
              `Output should contain '${text}' but didn't.\nOutput: ${allOutput}`
            );
          }
        }
        
        // Check for unwanted content
        if (options.expectedOutputs?.shouldNotContain) {
          for (const text of options.expectedOutputs.shouldNotContain) {
            assert(
              !allOutput.includes(text),
              `Output shouldn't contain '${text}' but did.\nOutput: ${allOutput}`
            );
          }
        }
        
        // For quiet mode, verify no output
        if (options.quiet) {
          assert(
            stdout.trim() === "", 
            `Expected no stdout with --quiet option, but found: ${stdout}`
          );
        }

        
        // If JSON format is specified, verify the output is valid JSON
        if (logFile && options.format === "json-stream") {
          assert(existsSync(logFile), "Log file should exist");
          let foundValidJson = false;
          try {
            const outputs = readExecuteOutput(logFile);
            foundValidJson = true;
            outputs.filter((out) => out.msg !== "" && options.expectedOutputs?.shouldNotContainLevel?.includes(out.levelName)).forEach(
              (out) => {
                assert(false, `JSON output should not contain level ${out.levelName}, but found: ${out.msg}`);
              }
            );
            outputs.filter((out) => out.msg !== "" && options.expectedOutputs?.shouldContainLevel?.includes(out.levelName)).forEach(
              (out) => {
                let json = undefined;
                try {
                  json = JSON.parse(out.msg);
                } catch {
                  assert(false, "Error parsing JSON returned by quarto meta");
                }
                assert(
                  Object.keys(json).length > 0,
                  "JSON returned by quarto meta seems invalid",
                );
              }
            );

          } catch (e) {}
          assert(foundValidJson, "JSON format should produce valid JSON output");
        }
      } finally {
        // Clean up log file if it exists
        if (logFile) {
          safeRemoveIfExists(logFile);
        }
        // Clean up any rendered output files
        if (options.fileToRender) {
          const output = outputForInput(options.fileToRender, 'html');
          safeRemoveIfExists(output.outputPath);
          safeRemoveIfExists(output.supportPath);
        }
      }
    }
  });
};

// This will always be shown in debug output as we'll show pandoc call 
const debugHintText = "pandoc --verbose --trace";
// This will be shown in info output
const infoHintText = function(testDoc: string) {
  return `Output created: ${basename(testDoc, extname(testDoc))}.html`;
};

testLogDirectly({
  testName: "Plain format - DEBUG level should show all log messages",
  level: "debug",
  format: "plain",
  fileToRender: testDoc,
  expectedOutputs: {
    shouldContain: [debugHintText, infoHintText(testDoc)],
    shouldSucceed: true
  }
});

testLogDirectly({
  testName: "Plain format - INFO level should not show DEBUG messages",
  level: "info",
  format: "plain",
  fileToRender: testDoc,
  expectedOutputs: {
    shouldContain: [infoHintText(testDoc)],
    shouldNotContain: [debugHintText],
    shouldSucceed: true
  }
});

testLogDirectly({
  testName: "Plain format - WARN level should not show INFO or DEBUG messages",
  level: "warn",
  format: "plain",
  fileToRender: testDocWithError,
  expectedOutputs: {
    shouldContain: ["WARN:", "ERROR:"],
    shouldNotContain: [debugHintText, infoHintText(testDocWithError)],
    shouldSucceed: false
  }
});

testLogDirectly({
  testName: "Plain format - ERROR level should only show ERROR messages",
  level: "error",
  format: "plain",
  fileToRender: testDocWithError,
  expectedOutputs: {
    shouldContain: ["ERROR:"],
    shouldNotContain: [debugHintText, infoHintText(testDocWithError), "WARN:"],
    shouldSucceed: false
  }
});

testLogDirectly({
  testName: "Json-Stream format - should produce parseable JSON in a log file with INFO level",
  level: "info",
  format: "json-stream",
  logFile: "test-log.json",
  expectedOutputs: {
    shouldSucceed: true,
    shouldContainLevel: ["INFO"],
    shouldNotContainLevel: ["DEBUG"]
  }
});

testLogDirectly({
  testName: "Json-Stream format - should produce parseable JSON in a log file with DEBUG level",
  level: "debug",
  format: "json-stream",
  logFile: "test-log.json",
  expectedOutputs: {
    shouldSucceed: true,
    shouldContainLevel: ["DEBUG", "INFO"],
  }
});

testLogDirectly({
  testName: "Json-Stream format - should produce parseable JSON in a log file with WARN level",
  level: "warn",
  format: "json-stream",
  logFile: "test-log.json",
  fileToRender: testDocWithError,
  expectedOutputs: {
    shouldSucceed: false,
    shouldContainLevel: ["WARN", "ERROR"],
    shouldNotContainLevel: ["INFO", "DEBUG"],
  }
});

testLogDirectly({
  testName: "Json-Stream format - should produce parseable JSON in a log file with ERROR level",
  level: "error",
  format: "json-stream",
  logFile: "test-log.json",
  fileToRender: testDocWithError,
  expectedOutputs: {
    shouldSucceed: false,
    shouldContainLevel: ["ERROR"],
    shouldNotContainLevel: ["DEBUG", "INFO", "WARN"]
  }
});


// 6. Testing quiet mode
testLogDirectly({
  testName: "Quiet mode should suppress all console output",
  level: "debug",
  format: "plain",
  quiet: true,
  expectedOutputs: {
    shouldSucceed: true
  }
});

testLogDirectly({
  testName: "Quiet mode should not suppress all output in JSON log file",
  level: "debug",
  format: "json-stream",
  logFile: "test-log.json",
  quiet: true,
  expectedOutputs: {
    shouldSucceed: true,
    shouldContainLevel: ["DEBUG", "INFO"],
  }
});

// 7. Testing quiet mode with errors
testLogDirectly({
  testName: "Plain format - Quiet mode should suppress output even with errors",
  level: "debug",
  format: "plain",
  quiet: true,
  fileToRender: testDocWithError,
  expectedOutputs: {
    shouldSucceed: false
  }
});

testLogDirectly({
  testName: "Json-Stream - Quiet mode should not suppress output even with errors",
  level: "debug",
  format: "json-stream",
  logFile: "test-log.json",
  quiet: true,
  fileToRender: testDocWithError,
  expectedOutputs: {
    shouldSucceed: false,
    shouldContainLevel: ["DEBUG", "INFO", "WARN", "ERROR"]
  }
});


testLogDirectly({
  testName: "Log level should be case-insensitive (INFO vs info)",
  level: "INFO",
  format: "plain",
  fileToRender: testDoc,
  expectedOutputs: {
    shouldContain: [infoHintText(testDoc)],
    shouldNotContain: [debugHintText],
    shouldSucceed: true
  }
});

testLogDirectly({
  testName: "WARNING should be equivalent to WARN level",
  level: "WARNING",
  format: "plain",
  fileToRender: testDocWithError,
  expectedOutputs: {
    shouldContain: ["WARN:", "ERROR:"],
    shouldNotContain: [debugHintText, infoHintText(testDocWithError)],
    shouldSucceed: false
  }
});



