/*
 * verify-pdf-metadata.ts
 *
 * PDF metadata verification using pdfjs-dist.
 * Extracts and verifies PDF document metadata (title, author, keywords, etc.).
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { assert } from "testing/asserts";
import { ExecuteOutput, Verify } from "./test.ts";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * PDF metadata fields that can be verified.
 * All fields are optional - only specified fields will be checked.
 */
export interface PdfMetadataAssertion {
  title?: string | RegExp;
  author?: string | RegExp;
  subject?: string | RegExp;
  keywords?: string | RegExp | string[];
  creator?: string | RegExp;
  producer?: string | RegExp;
  creationDate?: string | RegExp | Date;
  modDate?: string | RegExp | Date;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Match a value against a string, RegExp, or array of strings.
 */
function matchValue(
  actual: string | undefined | null,
  expected: string | RegExp | string[] | Date | undefined,
  fieldName: string,
): string | null {
  if (expected === undefined) return null;

  const actualStr = actual ?? "";

  if (expected instanceof RegExp) {
    if (!expected.test(actualStr)) {
      return `${fieldName}: expected to match ${expected}, got "${actualStr}"`;
    }
  } else if (expected instanceof Date) {
    // For dates, just check if the actual contains the expected date components
    const expectedStr = expected.toISOString().slice(0, 10); // YYYY-MM-DD
    if (!actualStr.includes(expectedStr)) {
      return `${fieldName}: expected to contain date ${expectedStr}, got "${actualStr}"`;
    }
  } else if (Array.isArray(expected)) {
    // For arrays (keywords), check if all expected values are present
    for (const keyword of expected) {
      if (!actualStr.toLowerCase().includes(keyword.toLowerCase())) {
        return `${fieldName}: expected to contain "${keyword}", got "${actualStr}"`;
      }
    }
  } else {
    // String comparison (case-insensitive contains)
    if (!actualStr.toLowerCase().includes(expected.toLowerCase())) {
      return `${fieldName}: expected to contain "${expected}", got "${actualStr}"`;
    }
  }

  return null;
}

// ============================================================================
// Main Predicate
// ============================================================================

/**
 * Verify PDF metadata fields match expected values.
 * Uses pdfjs-dist to extract metadata from PDF files.
 *
 * @param file - Path to the PDF file
 * @param assertions - Metadata fields to verify
 * @returns Verify object for test framework
 */
export const ensurePdfMetadata = (
  file: string,
  assertions: PdfMetadataAssertion,
): Verify => {
  return {
    name: `Inspecting ${file} for PDF metadata`,
    verify: async (_output: ExecuteOutput[]) => {
      const errors: string[] = [];

      // Load PDF with pdfjs-dist
      // deno-lint-ignore no-explicit-any
      const pdfjsLib = await import("pdfjs-dist") as any;
      const buffer = await Deno.readFile(file);
      const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

      // Get metadata
      const { info } = await doc.getMetadata();

      // Verify each specified field
      const checks = [
        matchValue(info?.Title, assertions.title, "title"),
        matchValue(info?.Author, assertions.author, "author"),
        matchValue(info?.Subject, assertions.subject, "subject"),
        matchValue(info?.Keywords, assertions.keywords, "keywords"),
        matchValue(info?.Creator, assertions.creator, "creator"),
        matchValue(info?.Producer, assertions.producer, "producer"),
        matchValue(info?.CreationDate, assertions.creationDate, "creationDate"),
        matchValue(info?.ModDate, assertions.modDate, "modDate"),
      ];

      for (const error of checks) {
        if (error) {
          errors.push(error);
        }
      }

      // Report errors
      if (errors.length > 0) {
        assert(
          false,
          `PDF metadata assertions failed in ${file}:\n${errors.map((e, i) => `  ${i + 1}. ${e}`).join("\n")}`,
        );
      }
    },
  };
};
