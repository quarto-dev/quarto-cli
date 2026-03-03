/*
 * percent-format.test.ts
 *
 * Tests for the Jupyter percent format script parsing
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */
import { assertEquals, assert } from "testing/asserts";
import { unitTest } from "../test.ts";
import { docs } from "../utils.ts";
import {
  isJupyterPercentScript,
  markdownFromJupyterPercentScript,
  kJupyterPercentScriptExtensions,
  kLanguageExtensions,
} from "../../src/core/jupyter/percent.ts";

// Test that the language extensions mapping is correct
unitTest("percent-format - kLanguageExtensions mapping", async () => {
  assertEquals(kLanguageExtensions[".py"], "python");
  assertEquals(kLanguageExtensions[".jl"], "julia");
  assertEquals(kLanguageExtensions[".r"], "r");
  assertEquals(kLanguageExtensions[".q"], "q");
});

// Test that all extensions in kJupyterPercentScriptExtensions have a language mapping
unitTest("percent-format - all extensions have language mappings", async () => {
  for (const ext of kJupyterPercentScriptExtensions) {
    assert(
      kLanguageExtensions[ext] !== undefined,
      `Extension ${ext} has no language mapping`,
    );
  }
});

// Test isJupyterPercentScript for Python
unitTest("percent-format - isJupyterPercentScript detects Python percent script", async () => {
  const result = isJupyterPercentScript(docs("percent-format/test-python.py"));
  assertEquals(result, true, "Should detect Python percent script");
});

// Test isJupyterPercentScript for q/kdb
unitTest("percent-format - isJupyterPercentScript detects q percent script", async () => {
  const result = isJupyterPercentScript(docs("percent-format/test-q.q"));
  assertEquals(result, true, "Should detect q percent script");
});

// Test isJupyterPercentScript for Julia
unitTest("percent-format - isJupyterPercentScript detects Julia percent script", async () => {
  const result = isJupyterPercentScript(docs("percent-format/test-julia.jl"));
  assertEquals(result, true, "Should detect Julia percent script");
});

// Test isJupyterPercentScript for R
unitTest("percent-format - isJupyterPercentScript detects R percent script", async () => {
  const result = isJupyterPercentScript(docs("percent-format/test-r.r"));
  assertEquals(result, true, "Should detect R percent script");
});

// Test that non-percent scripts are not detected
unitTest("percent-format - isJupyterPercentScript rejects non-percent Python", async () => {
  const result = isJupyterPercentScript(docs("percent-format/not-percent.py"));
  assertEquals(result, false, "Should not detect non-percent Python file");
});

unitTest("percent-format - isJupyterPercentScript rejects non-percent q", async () => {
  const result = isJupyterPercentScript(docs("percent-format/not-percent.q"));
  assertEquals(result, false, "Should not detect non-percent q file");
});

// Test isJupyterPercentScript rejects unsupported extensions
unitTest("percent-format - isJupyterPercentScript rejects unsupported extensions", async () => {
  // Create a temp file with unsupported extension - use a non-existent path
  // The function checks extension first, so it won't try to read the file
  const result = isJupyterPercentScript("/fake/path/file.txt");
  assertEquals(result, false, "Should reject unsupported extension");
});

// Test markdownFromJupyterPercentScript for Python
unitTest("percent-format - markdownFromJupyterPercentScript converts Python", async () => {
  const markdown = markdownFromJupyterPercentScript(
    docs("percent-format/test-python.py"),
  );

  // Check that it contains python code blocks
  assert(markdown.includes("```{python}"), "Should contain python code block");
  assert(markdown.includes("```"), "Should contain closing code fence");

  // Check that markdown content is extracted
  assert(
    markdown.includes("This is a markdown cell"),
    "Should contain markdown content",
  );

  // Check that code content is present
  assert(
    markdown.includes('print("Hello from Python")'),
    "Should contain Python code",
  );
});

// Test markdownFromJupyterPercentScript for q/kdb
unitTest("percent-format - markdownFromJupyterPercentScript converts q", async () => {
  const markdown = markdownFromJupyterPercentScript(
    docs("percent-format/test-q.q"),
  );

  // Check that it contains q code blocks
  assert(markdown.includes("```{q}"), "Should contain q code block");
  assert(markdown.includes("```"), "Should contain closing code fence");

  // Check that markdown content is extracted (without the / prefix)
  assert(
    markdown.includes("This is a markdown cell"),
    "Should contain markdown content",
  );

  // Check that code content is present
  assert(markdown.includes("1+1"), "Should contain q code");
  assert(markdown.includes("x: 42"), "Should contain q code");
});

// Test markdownFromJupyterPercentScript for Julia
unitTest("percent-format - markdownFromJupyterPercentScript converts Julia", async () => {
  const markdown = markdownFromJupyterPercentScript(
    docs("percent-format/test-julia.jl"),
  );

  // Check that it contains julia code blocks
  assert(markdown.includes("```{julia}"), "Should contain julia code block");

  // Check that markdown content is extracted
  assert(
    markdown.includes("This is a markdown cell"),
    "Should contain markdown content",
  );

  // Check that code content is present
  assert(
    markdown.includes('println("Hello from Julia")'),
    "Should contain Julia code",
  );
});

// Test markdownFromJupyterPercentScript for R
unitTest("percent-format - markdownFromJupyterPercentScript converts R", async () => {
  const markdown = markdownFromJupyterPercentScript(
    docs("percent-format/test-r.r"),
  );

  // Check that it contains r code blocks
  assert(markdown.includes("```{r}"), "Should contain r code block");

  // Check that markdown content is extracted
  assert(
    markdown.includes("This is a markdown cell"),
    "Should contain markdown content",
  );

  // Check that code content is present
  assert(
    markdown.includes('print("Hello from R")'),
    "Should contain R code",
  );
});

// =============================================================================
// Regression tests for regex bug fix
// The original regex had incorrect alternation: \[markdown|raw\] which matches
// "[markdown" OR "raw]" instead of "[markdown]" OR "[raw]"
// =============================================================================

// Test that [raw] cells are detected (tests correct alternation grouping)
unitTest("percent-format - isJupyterPercentScript detects [raw] cells", async () => {
  const result = isJupyterPercentScript(docs("percent-format/test-raw-cell.py"));
  assertEquals(result, true, "Should detect percent script with [raw] cell");
});

// Test that markdown cells not at start of file are detected (tests multiline matching)
unitTest("percent-format - isJupyterPercentScript detects markdown cell not at file start", async () => {
  const result = isJupyterPercentScript(docs("percent-format/test-markdown-not-first.py"));
  assertEquals(result, true, "Should detect percent script with markdown cell not at start");
});

// Test that files containing "raw]" text are not falsely detected
// This was a bug where the regex would match "raw]" anywhere in the file
unitTest("percent-format - isJupyterPercentScript rejects file with raw] text", async () => {
  const result = isJupyterPercentScript(docs("percent-format/false-positive-raw.py"));
  assertEquals(result, false, "Should not detect file that merely contains 'raw]' text");
});
