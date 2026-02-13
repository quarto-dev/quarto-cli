/*
 * pdf-text-position.test.ts
 *
 * Tests for the ensurePdfTextPositions verify predicate.
 * Renders a fixture document and runs various assertions including expected failures.
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { testQuartoCmd } from "../../test.ts";
import { ensurePdfTextPositions, PdfTextPositionAssertion } from "../../verify-pdf-text-position.ts";
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
    await runSemanticTagTests();
    await runPageRoleTests();
    await runEdgeOverrideTests();
    await runDistanceConstraintTests();
    await runDistanceConstraintErrorTests();
    await runPageRoleWithEdgeTests();
    await runCenterEdgeTests();

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
  // Note: Headers and footers are page decorations without MCIDs, use role: "Decoration"
  const verticalOrdering = ensurePdfTextPositions(fixturePdf, [
    {
      subject: { text: "FIXTURE_HEADER_TEXT", role: "Decoration" },
      relation: "above",
      object: "FIXTURE_TITLE_TEXT",
    },
    { subject: "FIXTURE_TITLE_TEXT", relation: "above", object: "FIXTURE_H1_TEXT" },
    { subject: "FIXTURE_H1_TEXT", relation: "above", object: "FIXTURE_BODY_P1_TEXT" },
    {
      subject: "FIXTURE_BODY_P1_TEXT",
      relation: "above",
      object: { text: "FIXTURE_FOOTER_TEXT", role: "Decoration" },
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

  // Error 1b: Ambiguous text (appears multiple times)
  await assertThrowsWithPattern(
    async () => {
      const predicate = ensurePdfTextPositions(fixturePdf, [
        // "paragraph" appears in multiple places in the fixture
        { subject: "paragraph", relation: "above", object: "FIXTURE_BODY_P1_TEXT" },
      ]);
      await predicate.verify([]);
    },
    /paragraph.*ambiguous.*matches/i,
    "Ambiguous text error",
  );

  // Error 2: Unknown relation (Zod validation error)
  await assertThrowsWithPattern(
    async () => {
      const predicate = ensurePdfTextPositions(fixturePdf, [
        // Use type assertion for intentionally invalid relation to test error handling
        { subject: "FIXTURE_H1_TEXT", relation: "invalidRelation", object: "FIXTURE_BODY_P1_TEXT" } as PdfTextPositionAssertion,
      ]);
      await predicate.verify([]);
    },
    /Assertion.*is invalid/,
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
    /Cannot compare positions.*page \d+.*page \d+/,
    "Different pages error",
  );

  // Error 4: Position assertion failed (wrong relation)
  await assertThrowsWithPattern(
    async () => {
      const predicate = ensurePdfTextPositions(fixturePdf, [
        // Footer is BELOW header, not above (both are Decorations)
        {
          subject: { text: "FIXTURE_FOOTER_TEXT", role: "Decoration" },
          relation: "above",
          object: { text: "FIXTURE_HEADER_TEXT", role: "Decoration" },
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

  // Error 6: Role mismatch (wrong semantic role)
  await assertThrowsWithPattern(
    async () => {
      const predicate = ensurePdfTextPositions(fixturePdf, [
        // H1 is not a Figure
        { subject: { text: "FIXTURE_H1_TEXT", role: "Figure" }, relation: "above", object: "FIXTURE_BODY_P1_TEXT" },
      ]);
      await predicate.verify([]);
    },
    /Role mismatch.*FIXTURE_H1_TEXT.*expected Figure.*got H1/,
    "Role mismatch error",
  );
}

/**
 * Test semantic role assertions
 */
async function runSemanticTagTests() {
  // Test: Correct semantic roles should pass
  const correctRoles = ensurePdfTextPositions(fixturePdf, [
    {
      subject: { text: "FIXTURE_H1_TEXT", role: "H1" },
      relation: "above",
      object: { text: "FIXTURE_BODY_P1_TEXT", role: "P" },
    },
    {
      subject: { text: "FIXTURE_H2_TEXT", role: "H2" },
      relation: "above",
      object: { text: "FIXTURE_H3_TEXT", role: "H3" },
    },
  ]);
  await correctRoles.verify([]);
}

/**
 * Test Page role - represents entire page bounds
 * Page intersects all content on that page, so directional relations should fail
 */
async function runPageRoleTests() {
  // Test: Page role should NOT be above/below/leftOf/rightOf any content on same page
  // because Page covers the entire page and thus intersects everything
  const pageNotDirectional = ensurePdfTextPositions(
    fixturePdf,
    [], // No positive assertions
    [
      // Page 1 is NOT above body text (it contains it)
      {
        subject: { role: "Page", page: 1 },
        relation: "above",
        object: "FIXTURE_BODY_P1_TEXT",
      },
      // Page 1 is NOT below anything on page 1
      {
        subject: { role: "Page", page: 1 },
        relation: "below",
        object: "FIXTURE_TITLE_TEXT",
      },
      // Page 1 is NOT leftOf anything on page 1
      {
        subject: { role: "Page", page: 1 },
        relation: "leftOf",
        object: "FIXTURE_BODY_P1_TEXT",
      },
      // Page 1 is NOT rightOf anything on page 1
      {
        subject: { role: "Page", page: 1 },
        relation: "rightOf",
        object: "FIXTURE_BODY_P1_TEXT",
      },
    ],
  );
  await pageNotDirectional.verify([]);

  // Test: Two Page selectors for same page should be aligned (both at origin 0,0)
  const pageAlignment = ensurePdfTextPositions(fixturePdf, [
    {
      subject: { role: "Page", page: 1 },
      relation: "topAligned",
      object: { role: "Page", page: 1 },
    },
    {
      subject: { role: "Page", page: 1 },
      relation: "leftAligned",
      object: { role: "Page", page: 1 },
    },
  ]);
  await pageAlignment.verify([]);
}

/**
 * Test edge override functionality for directional and alignment relations
 */
async function runEdgeOverrideTests() {
  // Test: Edge override for directional relation - compare same edges
  // H1's top edge should be above H2's top edge (both top edges)
  const edgeOverrideDirectional = ensurePdfTextPositions(fixturePdf, [
    {
      subject: { text: "FIXTURE_H1_TEXT", edge: "top" },
      relation: "above",
      object: { text: "FIXTURE_H2_TEXT", edge: "top" },
    },
  ]);
  await edgeOverrideDirectional.verify([]);

  // Test: Edge override for alignment relation - align different edges
  // This tests that we can align one element's edge with another's different edge
  // Header's bottom should NOT align with body's top (they're spaced apart)
  // But we can verify header.bottom < body.top by checking header.bottom is above body.top
  const edgeOverrideAlignment = ensurePdfTextPositions(fixturePdf, [
    {
      subject: { text: "FIXTURE_H1_TEXT", edge: "bottom" },
      relation: "above",
      object: { text: "FIXTURE_BODY_P1_TEXT", edge: "top" },
    },
  ]);
  await edgeOverrideAlignment.verify([]);

  // Test: rightOf with edge overrides
  // We know margin text is to the right of body text
  // Margin's left edge should be rightOf body's right edge
  const rightOfEdgeOverride = ensurePdfTextPositions(fixturePdf, [
    {
      subject: { text: "FIXTURE_MARGIN_TEXT", edge: "left" },
      relation: "rightOf",
      object: { text: "FIXTURE_BODY_P2_TEXT", edge: "right" },
    },
  ]);
  await rightOfEdgeOverride.verify([]);

  // Test: below with edge overrides
  // Body P1's top should be below H1's bottom
  const belowEdgeOverride = ensurePdfTextPositions(fixturePdf, [
    {
      subject: { text: "FIXTURE_BODY_P1_TEXT", edge: "top" },
      relation: "below",
      object: { text: "FIXTURE_H1_TEXT", edge: "bottom" },
    },
  ]);
  await belowEdgeOverride.verify([]);

  // Test: leftAligned with object edge override
  // We can check if header's left aligns with page's left using edge override
  const leftAlignedEdgeOverride = ensurePdfTextPositions(fixturePdf, [
    {
      subject: { text: "FIXTURE_H1_TEXT" },
      relation: "leftAligned",
      object: { text: "FIXTURE_H2_TEXT" },
      tolerance: 5, // Allow some tolerance for heading indentation
    },
  ]);
  await leftAlignedEdgeOverride.verify([]);
}

/**
 * Test byMin/byMax distance constraint functionality
 */
async function runDistanceConstraintTests() {
  // Test: byMin constraint - H1 should be at least 1pt above H2
  const byMinTest = ensurePdfTextPositions(fixturePdf, [
    {
      subject: "FIXTURE_H1_TEXT",
      relation: "above",
      object: "FIXTURE_H2_TEXT",
      byMin: 1,
    },
  ]);
  await byMinTest.verify([]);

  // Test: byMax constraint - header decorations shouldn't be too far from title
  // Using a generous max to ensure it passes
  const byMaxTest = ensurePdfTextPositions(fixturePdf, [
    {
      subject: { text: "FIXTURE_HEADER_TEXT", role: "Decoration" },
      relation: "above",
      object: "FIXTURE_TITLE_TEXT",
      byMax: 500, // Generous max distance
    },
  ]);
  await byMaxTest.verify([]);

  // Test: byMin and byMax together - range constraint
  const byRangeTest = ensurePdfTextPositions(fixturePdf, [
    {
      subject: "FIXTURE_H1_TEXT",
      relation: "above",
      object: "FIXTURE_H2_TEXT",
      byMin: 1,
      byMax: 500, // Generous range
    },
  ]);
  await byRangeTest.verify([]);

  // Test: Negative byMin (allows overlap) should work
  // This tests that negative values are accepted
  const negativeByMinTest = ensurePdfTextPositions(fixturePdf, [
    {
      subject: "FIXTURE_H1_TEXT",
      relation: "above",
      object: "FIXTURE_H2_TEXT",
      byMin: -100, // Negative allows overlap
    },
  ]);
  await negativeByMinTest.verify([]);

  // Test: rightOf with byMin - margin should be at least some distance right of body
  const rightOfByMinTest = ensurePdfTextPositions(fixturePdf, [
    {
      subject: { text: "FIXTURE_MARGIN_TEXT", edge: "left" },
      relation: "rightOf",
      object: { text: "FIXTURE_BODY_P2_TEXT", edge: "right" },
      byMin: 1, // At least 1pt gap
    },
  ]);
  await rightOfByMinTest.verify([]);

  // Test: below with distance constraints
  const belowByMinTest = ensurePdfTextPositions(fixturePdf, [
    {
      subject: "FIXTURE_H2_TEXT",
      relation: "below",
      object: "FIXTURE_H1_TEXT",
      byMin: 1,
    },
  ]);
  await belowByMinTest.verify([]);
}

/**
 * Test error cases for distance constraints
 */
async function runDistanceConstraintErrorTests() {
  // Error: byMin/byMax with alignment relation should error (Zod .strict() catches extra keys)
  // Use type assertion to test runtime error handling for invalid YAML input
  await assertThrowsWithPattern(
    async () => {
      const predicate = ensurePdfTextPositions(fixturePdf, [
        {
          subject: "FIXTURE_H1_TEXT",
          relation: "topAligned",
          object: "FIXTURE_H2_TEXT",
          byMin: 10,
        } as PdfTextPositionAssertion,
      ]);
      await predicate.verify([]);
    },
    /Assertion.*is invalid/,
    "byMin with alignment relation error",
  );

  // Error: byMax with alignment relation should error (Zod .strict() catches extra keys)
  // Use type assertion to test runtime error handling for invalid YAML input
  await assertThrowsWithPattern(
    async () => {
      const predicate = ensurePdfTextPositions(fixturePdf, [
        {
          subject: "FIXTURE_H1_TEXT",
          relation: "leftAligned",
          object: "FIXTURE_H2_TEXT",
          byMax: 10,
        } as PdfTextPositionAssertion,
      ]);
      await predicate.verify([]);
    },
    /Assertion.*is invalid/,
    "byMax with alignment relation error",
  );

  // Error: byMin > byMax should error (caught by Zod .refine())
  await assertThrowsWithPattern(
    async () => {
      const predicate = ensurePdfTextPositions(fixturePdf, [
        {
          subject: "FIXTURE_H1_TEXT",
          relation: "above",
          object: "FIXTURE_H2_TEXT",
          byMin: 100,
          byMax: 10, // Invalid: byMin > byMax
        },
      ]);
      await predicate.verify([]);
    },
    /byMin must be <= byMax/i,
    "byMin > byMax error",
  );

  // Error: byMin constraint not satisfied (too close)
  await assertThrowsWithPattern(
    async () => {
      const predicate = ensurePdfTextPositions(fixturePdf, [
        {
          subject: "FIXTURE_H1_TEXT",
          relation: "above",
          object: "FIXTURE_H2_TEXT",
          byMin: 10000, // Unreasonably large min distance
        },
      ]);
      await predicate.verify([]);
    },
    /Position assertion failed.*distance.*byMin/i,
    "byMin constraint not satisfied error",
  );

  // Error: byMax constraint not satisfied (too far)
  await assertThrowsWithPattern(
    async () => {
      const predicate = ensurePdfTextPositions(fixturePdf, [
        {
          subject: { text: "FIXTURE_HEADER_TEXT", role: "Decoration" },
          relation: "above",
          object: { text: "FIXTURE_FOOTER_TEXT", role: "Decoration" },
          byMax: 1, // Unreasonably small max distance
        },
      ]);
      await predicate.verify([]);
    },
    /Position assertion failed.*distance.*byMax/i,
    "byMax constraint not satisfied error",
  );
}

/**
 * Test Page role with edge override functionality
 */
async function runPageRoleWithEdgeTests() {
  // Test: Page's left edge should be at x=0, content should be rightOf that
  // This verifies edge overrides work with Page role
  const pageLeftEdgeTest = ensurePdfTextPositions(fixturePdf, [
    {
      subject: "FIXTURE_BODY_P1_TEXT",
      relation: "rightOf",
      object: { role: "Page", page: 1, edge: "left" },
    },
  ]);
  await pageLeftEdgeTest.verify([]);

  // Test: Content should be below Page's top edge
  const pageTopEdgeTest = ensurePdfTextPositions(fixturePdf, [
    {
      subject: "FIXTURE_BODY_P1_TEXT",
      relation: "below",
      object: { role: "Page", page: 1, edge: "top" },
    },
  ]);
  await pageTopEdgeTest.verify([]);

  // Test: Content should be above Page's bottom edge
  const pageBottomEdgeTest = ensurePdfTextPositions(fixturePdf, [
    {
      subject: "FIXTURE_BODY_P1_TEXT",
      relation: "above",
      object: { role: "Page", page: 1, edge: "bottom" },
    },
  ]);
  await pageBottomEdgeTest.verify([]);

  // Test: Content should be leftOf Page's right edge
  const pageRightEdgeTest = ensurePdfTextPositions(fixturePdf, [
    {
      subject: "FIXTURE_BODY_P1_TEXT",
      relation: "leftOf",
      object: { role: "Page", page: 1, edge: "right" },
    },
  ]);
  await pageRightEdgeTest.verify([]);

  // Test: Page edge with byMin - content should be at least some distance from page edges
  const pageEdgeWithByMin = ensurePdfTextPositions(fixturePdf, [
    {
      subject: "FIXTURE_BODY_P1_TEXT",
      relation: "rightOf",
      object: { role: "Page", page: 1, edge: "left" },
      byMin: 1, // At least 1pt from left edge
    },
  ]);
  await pageEdgeWithByMin.verify([]);

  // Test: topAligned with Page using edge override
  // Header decoration's top should be close to page top
  const headerNearPageTop = ensurePdfTextPositions(fixturePdf, [
    {
      subject: { text: "FIXTURE_HEADER_TEXT", role: "Decoration" },
      relation: "below",
      object: { role: "Page", page: 1, edge: "top" },
      byMax: 100, // Within 100pt of page top
    },
  ]);
  await headerNearPageTop.verify([]);
}

/**
 * Test centerX and centerY edge functionality
 */
async function runCenterEdgeTests() {
  // Test: centerX - title's horizontal centre should align with page's horizontal centre
  const centerXPageTest = ensurePdfTextPositions(fixturePdf, [
    {
      subject: { text: "FIXTURE_TITLE_TEXT", edge: "centerX" },
      relation: "leftAligned",
      object: { role: "Page", page: 1, edge: "centerX" },
      tolerance: 20,
    },
  ]);
  await centerXPageTest.verify([]);

  // Test: centerY directional - header decoration's centerY should be above title's centerY
  const centerYDirectionalTest = ensurePdfTextPositions(fixturePdf, [
    {
      subject: { text: "FIXTURE_HEADER_TEXT", role: "Decoration", edge: "centerY" },
      relation: "above",
      object: { text: "FIXTURE_TITLE_TEXT", edge: "centerY" },
    },
  ]);
  await centerYDirectionalTest.verify([]);

  // Test: centerX directional - a left-aligned heading's centerX should be leftOf page centerX
  const centerXDirectionalTest = ensurePdfTextPositions(fixturePdf, [
    {
      subject: { text: "FIXTURE_H1_TEXT", edge: "centerX" },
      relation: "leftOf",
      object: { role: "Page", page: 1, edge: "centerX" },
    },
  ]);
  await centerXDirectionalTest.verify([]);
}
