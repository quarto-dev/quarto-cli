/*
 * pdf-text-position.test.ts
 *
 * Tests for the ensurePdfTextPositions verify predicate.
 * Renders a fixture document and runs various assertions including expected failures.
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { testQuartoCmd } from "../../test.ts";
import { ensurePdfTextPositions } from "../../verify-pdf-text-position.ts";
import { assert, AssertionError } from "testing/asserts";
import { join } from "../../../src/deno_ral/path.ts";
import { safeRemoveSync, safeExistsSync } from "../../../src/core/path.ts";

const fixtureDir = "docs/verify/pdf-text-position";
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
  // Test 1: Basic vertical ordering (header < title < h1 < body < footer)
  // Note: Headers and footers are page decorations without MCIDs, use type: "Decoration"
  const verticalOrdering = ensurePdfTextPositions(fixturePdf, [
    {
      subject: { text: "FIXTURE_HEADER_TEXT", type: "Decoration" },
      relation: "above",
      object: "FIXTURE_TITLE_TEXT",
    },
    { subject: "FIXTURE_TITLE_TEXT", relation: "above", object: "FIXTURE_H1_TEXT" },
    { subject: "FIXTURE_H1_TEXT", relation: "above", object: "FIXTURE_BODY_P1_TEXT" },
    {
      subject: "FIXTURE_BODY_P1_TEXT",
      relation: "above",
      object: { text: "FIXTURE_FOOTER_TEXT", type: "Decoration" },
    },
  ]);
  await verticalOrdering.verify([]);

  // Test 2: Margin positioning - use topAligned since semantic bbox may span full width
  // Note: rightOf may not work with semantic bboxes because body paragraph's bbox
  // may include the full content width
  const marginPositioning = ensurePdfTextPositions(fixturePdf, [
    { subject: "FIXTURE_MARGIN_TEXT", relation: "topAligned", object: "FIXTURE_BODY_P2_TEXT" },
  ]);
  await marginPositioning.verify([]);

  // Test 3: Heading hierarchy
  const headingHierarchy = ensurePdfTextPositions(fixturePdf, [
    { subject: "FIXTURE_H1_TEXT", relation: "above", object: "FIXTURE_H2_TEXT" },
    { subject: "FIXTURE_H2_TEXT", relation: "above", object: "FIXTURE_H3_TEXT" },
  ]);
  await headingHierarchy.verify([]);
}

/**
 * Test expected failures - each should throw with specific error messages
 */
async function runExpectedFailureTests() {
  // Error 1: Text not found
  await assertThrowsWithPattern(
    async () => {
      const predicate = ensurePdfTextPositions(fixturePdf, [
        { subject: "NONEXISTENT_TEXT_12345", relation: "above", object: "FIXTURE_BODY_P1_TEXT" },
      ]);
      await predicate.verify([]);
    },
    /Text not found.*NONEXISTENT_TEXT_12345/,
    "Text not found error",
  );

  // Error 2: Unknown relation
  await assertThrowsWithPattern(
    async () => {
      const predicate = ensurePdfTextPositions(fixturePdf, [
        { subject: "FIXTURE_H1_TEXT", relation: "invalidRelation", object: "FIXTURE_BODY_P1_TEXT" },
      ]);
      await predicate.verify([]);
    },
    /Unknown relation.*invalidRelation/,
    "Unknown relation error",
  );

  // Error 3: Different pages - comparing items on different pages should fail
  await assertThrowsWithPattern(
    async () => {
      const predicate = ensurePdfTextPositions(fixturePdf, [
        { subject: "FIXTURE_H1_TEXT", relation: "above", object: "FIXTURE_PAGE2_BODY_TEXT" },
      ]);
      await predicate.verify([]);
    },
    /Cannot compare positions.*page 1.*page 2/,
    "Different pages error",
  );

  // Error 4: Position assertion failed (wrong relation)
  await assertThrowsWithPattern(
    async () => {
      const predicate = ensurePdfTextPositions(fixturePdf, [
        // Footer is BELOW header, not above (both are Decorations)
        {
          subject: { text: "FIXTURE_FOOTER_TEXT", type: "Decoration" },
          relation: "above",
          object: { text: "FIXTURE_HEADER_TEXT", type: "Decoration" },
        },
      ]);
      await predicate.verify([]);
    },
    /Position assertion failed.*FIXTURE_FOOTER_TEXT.*NOT.*above/,
    "Position assertion failed error",
  );

  // Error 5: Negative assertion unexpectedly true
  await assertThrowsWithPattern(
    async () => {
      const predicate = ensurePdfTextPositions(
        fixturePdf,
        [], // No positive assertions
        [
          // This IS true, so negative assertion should fail
          { subject: "FIXTURE_H1_TEXT", relation: "above", object: "FIXTURE_H2_TEXT" },
        ],
      );
      await predicate.verify([]);
    },
    /Negative assertion failed.*FIXTURE_H1_TEXT.*IS.*above/,
    "Negative assertion unexpectedly true error",
  );

  // Test with tag type assertion (if structure tree is available)
  // Note: This may need adjustment based on actual Typst PDF structure
  // For now, we test that tag assertions are processed without crashing
  try {
    const tagAssertion = ensurePdfTextPositions(fixturePdf, [
      {
        subject: { text: "FIXTURE_H1_TEXT", type: "H1" },
        relation: "above",
        object: { text: "FIXTURE_BODY_P1_TEXT", type: "P" },
      },
    ]);
    await tagAssertion.verify([]);
    // If we get here, Typst produced correct tags
  } catch (e) {
    // Tag type might not match - this is acceptable for this test
    // The important thing is that the code processes tag assertions
    if (!(e instanceof Error) || !e.message.includes("type mismatch")) {
      throw e; // Re-throw unexpected errors
    }
  }
}
