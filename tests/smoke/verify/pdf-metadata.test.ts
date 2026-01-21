/*
 * pdf-metadata.test.ts
 *
 * Tests for the ensurePdfMetadata verify predicate.
 * Renders a fixture document and runs various assertions including expected failures.
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { testQuartoCmd } from "../../test.ts";
import { ensurePdfMetadata } from "../../verify-pdf-metadata.ts";
import { assert } from "testing/asserts";
import { join } from "../../../src/deno_ral/path.ts";
import { safeRemoveSync, safeExistsSync } from "../../../src/core/path.ts";

const fixtureDir = "docs/verify/pdf-metadata";
const fixtureQmd = join(fixtureDir, "fixture.qmd");
const fixturePdf = join(fixtureDir, "fixture.pdf");

/**
 * Helper to assert that a function throws with error message matching a pattern
 */
async function assertThrowsWithPattern(
  fn: () => Promise<void>,
  pattern: RegExp,
  description: string,
) {
  let threw = false;
  let errorMessage = "";
  try {
    await fn();
  } catch (e) {
    threw = true;
    errorMessage = e instanceof Error ? e.message : String(e);
  }

  assert(threw, `Expected to throw for: ${description}`);
  assert(
    pattern.test(errorMessage),
    `Error message "${errorMessage}" did not match pattern ${pattern} for: ${description}`,
  );
}

// Test: Render fixture and run assertions
testQuartoCmd("render", [fixtureQmd, "--to", "typst"], [], {
  teardown: async () => {
    // Run the test assertions after render completes
    await runPositiveTests();
    await runExpectedFailureTests();

    // Cleanup
    if (safeExistsSync(fixturePdf)) {
      safeRemoveSync(fixturePdf);
    }
  },
});

/**
 * Test positive assertions that should pass
 */
async function runPositiveTests() {
  // Test 1: Title contains expected text
  const titleTest = ensurePdfMetadata(fixturePdf, {
    title: "PDF Metadata Test Fixture",
  });
  await titleTest.verify([]);

  // Test 2: Author contains expected text
  const authorTest = ensurePdfMetadata(fixturePdf, {
    author: "Test Author Name",
  });
  await authorTest.verify([]);

  // Test 3: Keywords contain expected values (as array)
  const keywordsTest = ensurePdfMetadata(fixturePdf, {
    keywords: ["quarto", "typst"],
  });
  await keywordsTest.verify([]);

  // Test 4: Title matches regex
  const regexTest = ensurePdfMetadata(fixturePdf, {
    title: /PDF.*Fixture/,
  });
  await regexTest.verify([]);

  // Test 5: Multiple fields at once
  const multiTest = ensurePdfMetadata(fixturePdf, {
    title: "Metadata",
    author: "Author",
    keywords: ["testing"],
  });
  await multiTest.verify([]);

  // Test 6: Creator field (should contain "Typst" since we render with Typst)
  const creatorTest = ensurePdfMetadata(fixturePdf, {
    creator: /typst/i,
  });
  await creatorTest.verify([]);
}

/**
 * Test expected failures - each should throw with specific error messages
 */
async function runExpectedFailureTests() {
  // Error 1: Title mismatch
  await assertThrowsWithPattern(
    async () => {
      const predicate = ensurePdfMetadata(fixturePdf, {
        title: "NONEXISTENT_TITLE_12345",
      });
      await predicate.verify([]);
    },
    /title.*expected.*NONEXISTENT_TITLE_12345/i,
    "Title mismatch error",
  );

  // Error 2: Author mismatch
  await assertThrowsWithPattern(
    async () => {
      const predicate = ensurePdfMetadata(fixturePdf, {
        author: "NONEXISTENT_AUTHOR_12345",
      });
      await predicate.verify([]);
    },
    /author.*expected.*NONEXISTENT_AUTHOR_12345/i,
    "Author mismatch error",
  );

  // Error 3: Keywords mismatch
  await assertThrowsWithPattern(
    async () => {
      const predicate = ensurePdfMetadata(fixturePdf, {
        keywords: ["NONEXISTENT_KEYWORD_12345"],
      });
      await predicate.verify([]);
    },
    /keywords.*expected.*NONEXISTENT_KEYWORD_12345/i,
    "Keywords mismatch error",
  );

  // Error 4: Regex mismatch
  await assertThrowsWithPattern(
    async () => {
      const predicate = ensurePdfMetadata(fixturePdf, {
        title: /^EXACT_NONEXISTENT$/,
      });
      await predicate.verify([]);
    },
    /title.*expected.*match/i,
    "Regex mismatch error",
  );
}
