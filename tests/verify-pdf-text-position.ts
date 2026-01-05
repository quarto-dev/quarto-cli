/*
 * verify-pdf-text-position.ts
 *
 * PDF text position verification using semantic structure tree.
 * Uses pdfjs-dist directly to access MCIDs and structure tree.
 *
 * REQUIREMENTS:
 * This module requires tagged PDFs with PDF 1.4+ structure tree support.
 * Tagged PDFs contain Marked Content Identifiers (MCIDs) that link text
 * content to semantic structure elements (P, H1, Figure, Table, etc.).
 *
 * Currently confirmed working:
 * - Typst: Produces tagged PDFs by default
 *
 * Not yet working:
 * - LaTeX: Requires \DocumentMetadata{} before \documentclass for tagging,
 *   which Quarto doesn't currently support. When LaTeX tagged PDF support
 *   is available, this module should work with minimal changes since we
 *   use only basic PDF 1.4 tagged structure features.
 * - ConTeXt: Pandoc supports +tagging extension, but Quarto's context
 *   format doesn't compile to PDF.
 *
 * SPECIAL TYPES:
 * - type: "Decoration" - Use for untagged page elements like headers, footers,
 *   page numbers, and other decorations. These use text item bounds directly
 *   instead of requiring MCID/structure tree support.
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { assert } from "testing/asserts";
import { ExecuteOutput, Verify } from "./test.ts";

// ============================================================================
// Type Definitions
// ============================================================================

// Extended subject/object selector
interface TextSelector {
  text: string;
  type?: string;  // PDF 1.4 tag: P, H1, H2, Figure, Table, Span, etc.
  id?: string;    // Element identifier/label
}

// Assertion format
export interface PdfTextPositionAssertion {
  subject: string | TextSelector;
  relation?: string;           // Optional for tag-only assertions
  object?: string | TextSelector;  // Optional for tag-only assertions
  tolerance?: number;          // Default: 2pt
}

// Computed bounding box
interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

// Internal: text item with MCID tracking
interface MarkedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  mcid: string | null;  // e.g., "p2R_mc0"
  page: number;
}

// Structure tree node (from pdfjs-dist)
interface StructTreeNode {
  role: string;
  children?: (StructTreeNode | StructTreeContent)[];
  alt?: string;
  lang?: string;
}

interface StructTreeContent {
  type: "content" | "object" | "annotation";
  id: string;
}

// Text content item types from pdfjs-dist
interface TextItem {
  str: string;
  dir: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  hasEOL: boolean;
}

interface TextMarkedContent {
  type: "beginMarkedContent" | "beginMarkedContentProps" | "endMarkedContent";
  id?: string;
  tag?: string;
}

// Internal: resolved selector with computed bounds
interface ResolvedSelector {
  selector: TextSelector;
  textItem: MarkedTextItem;
  structNode: StructTreeNode | null;
  bbox: BBox;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_ALIGNMENT_TOLERANCE = 2;

// ============================================================================
// Relation Predicates
// ============================================================================

// Coordinate system: origin at top-left, y increases downward
type RelationFn = (a: BBox, b: BBox, tolerance: number) => boolean;

const pdfPositionRelations: Record<string, RelationFn> = {
  // Directional predicates (tolerance not used)
  leftOf: (a, b) => a.x + a.width < b.x,
  rightOf: (a, b) => a.x > b.x + b.width,
  above: (a, b) => a.y + a.height < b.y,
  below: (a, b) => a.y > b.y + b.height,

  // Alignment predicates (use tolerance)
  leftAligned: (a, b, tol) => Math.abs(a.x - b.x) <= tol,
  rightAligned: (a, b, tol) => Math.abs((a.x + a.width) - (b.x + b.width)) <= tol,
  topAligned: (a, b, tol) => Math.abs(a.y - b.y) <= tol,
  bottomAligned: (a, b, tol) => Math.abs((a.y + a.height) - (b.y + b.height)) <= tol,
};

// ============================================================================
// Helper Functions
// ============================================================================

function normalizeSelector(s: string | TextSelector): TextSelector {
  if (typeof s === "string") {
    return { text: s };
  }
  return s;
}

function isStructTreeContent(node: StructTreeNode | StructTreeContent): node is StructTreeContent {
  return "type" in node && (node.type === "content" || node.type === "object" || node.type === "annotation");
}

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return "str" in item && typeof item.str === "string";
}

function isTextMarkedContent(item: TextItem | TextMarkedContent): item is TextMarkedContent {
  return "type" in item && typeof item.type === "string";
}

/**
 * Extract MarkedTextItem[] from pdfjs getTextContent result.
 * Tracks current MCID as we iterate through interleaved items.
 */
function extractMarkedTextItems(
  items: (TextItem | TextMarkedContent)[],
  pageNum: number,
  pageHeight: number,
): MarkedTextItem[] {
  const result: MarkedTextItem[] = [];
  let currentMcid: string | null = null;

  for (const item of items) {
    if (isTextMarkedContent(item)) {
      if (item.type === "beginMarkedContentProps" && item.id) {
        currentMcid = item.id;
      } else if (item.type === "endMarkedContent") {
        currentMcid = null;
      }
    } else if (isTextItem(item)) {
      // Transform: [scaleX, skewX, skewY, scaleY, translateX, translateY]
      const tm = item.transform;
      const x = tm[4];
      // Convert from PDF coordinates (bottom-left origin) to top-left origin
      const y = pageHeight - tm[5];
      const height = Math.sqrt(tm[2] * tm[2] + tm[3] * tm[3]);

      result.push({
        str: item.str,
        x,
        y,
        width: item.width,
        height,
        mcid: currentMcid,
        page: pageNum,
      });
    }
  }

  return result;
}

/**
 * Recursively build MCID -> StructNode map from structure tree.
 * Returns the struct node that directly contains the MCID content.
 */
function buildMcidStructMap(
  tree: StructTreeNode | null,
  map: Map<string, StructTreeNode> = new Map(),
  parentNode: StructTreeNode | null = null,
): Map<string, StructTreeNode> {
  if (!tree) return map;

  for (const child of tree.children ?? []) {
    if (isStructTreeContent(child)) {
      if (child.type === "content" && child.id) {
        // Map MCID to the parent struct node (the semantic element)
        map.set(child.id, parentNode ?? tree);
      }
    } else {
      // Recurse into child struct nodes
      buildMcidStructMap(child, map, child);
    }
  }

  return map;
}

/**
 * Collect only direct MCIDs under a structure node (non-recursive).
 * Does not descend into child structure nodes.
 */
function collectDirectMcids(node: StructTreeNode): string[] {
  const mcids: string[] = [];

  for (const child of node.children ?? []) {
    if (isStructTreeContent(child)) {
      if (child.type === "content" && child.id) {
        mcids.push(child.id);
      }
    }
    // Do NOT recurse into child struct nodes
  }

  return mcids;
}

/**
 * Check if a string is whitespace-only (including empty).
 * Used to filter out horizontal skip spaces in PDF content.
 */
function isWhitespaceOnly(str: string): boolean {
  return str.trim().length === 0;
}

/**
 * Compute union bounding box from multiple items.
 * Filters out whitespace-only text items to avoid including horizontal skips.
 */
function unionBBox(items: MarkedTextItem[]): BBox | null {
  // Filter out whitespace-only items (these are often horizontal skips)
  const contentItems = items.filter((item) => !isWhitespaceOnly(item.str));
  if (contentItems.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const page = contentItems[0].page;

  for (const item of contentItems) {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    page,
  };
}

/**
 * Compute semantic bounding box for a structure node.
 * Uses only direct MCIDs (non-recursive) to avoid including nested elements
 * like margin content that may be children of body paragraphs.
 */
function computeStructBBox(
  node: StructTreeNode,
  mcidToTextItems: Map<string, MarkedTextItem[]>,
): BBox | null {
  const mcids = collectDirectMcids(node);
  const items = mcids.flatMap((id) => mcidToTextItems.get(id) ?? []);
  return unionBBox(items);
}

// ============================================================================
// Main Predicate
// ============================================================================

/**
 * Verify spatial positions of text in a rendered PDF using semantic structure.
 * Uses pdfjs-dist to access MCIDs and structure tree.
 */
export const ensurePdfTextPositions = (
  file: string,
  assertions: PdfTextPositionAssertion[],
  noMatchAssertions?: PdfTextPositionAssertion[],
): Verify => {
  return {
    name: `Inspecting ${file} for text position assertions`,
    verify: async (_output: ExecuteOutput[]) => {
      const errors: string[] = [];

      // Stage 1: Parse assertions and gather search texts
      const normalizedAssertions = assertions.map((a) => ({
        subject: normalizeSelector(a.subject),
        relation: a.relation,
        object: a.object ? normalizeSelector(a.object) : undefined,
        tolerance: a.tolerance ?? DEFAULT_ALIGNMENT_TOLERANCE,
      }));

      const normalizedNoMatch = noMatchAssertions?.map((a) => ({
        subject: normalizeSelector(a.subject),
        relation: a.relation,
        object: a.object ? normalizeSelector(a.object) : undefined,
        tolerance: a.tolerance ?? DEFAULT_ALIGNMENT_TOLERANCE,
      }));

      // Track search texts and their selectors (to know if Decoration type is requested)
      const searchTexts = new Set<string>();
      const textToSelectors = new Map<string, TextSelector[]>();

      const addSelector = (sel: TextSelector) => {
        searchTexts.add(sel.text);
        const existing = textToSelectors.get(sel.text) ?? [];
        existing.push(sel);
        textToSelectors.set(sel.text, existing);
      };

      for (const a of normalizedAssertions) {
        addSelector(a.subject);
        if (a.object) addSelector(a.object);
      }
      for (const a of normalizedNoMatch ?? []) {
        addSelector(a.subject);
        if (a.object) addSelector(a.object);
      }

      // Helper: check if any selector for this text is a Decoration (untagged content)
      const isDecoration = (text: string): boolean => {
        const selectors = textToSelectors.get(text) ?? [];
        return selectors.some((s) => s.type === "Decoration");
      };

      // Stage 2: Load PDF with pdfjs-dist
      // deno-lint-ignore no-explicit-any
      const pdfjsLib = await import("pdfjs-dist") as any;
      const buffer = await Deno.readFile(file);
      const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

      // Stage 3 & 4: Extract content and structure tree per page
      const allTextItems: MarkedTextItem[] = [];
      const mcidToTextItems = new Map<string, MarkedTextItem[]>();
      const mcidToStructNode = new Map<string, StructTreeNode>();

      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.0 });

        // Get text content with marked content
        const textContent = await page.getTextContent({
          includeMarkedContent: true,
        });

        const pageItems = extractMarkedTextItems(
          textContent.items,
          pageNum,
          viewport.height,
        );
        allTextItems.push(...pageItems);

        // Build MCID -> text items map
        for (const item of pageItems) {
          if (item.mcid) {
            const existing = mcidToTextItems.get(item.mcid) ?? [];
            existing.push(item);
            mcidToTextItems.set(item.mcid, existing);
          }
        }

        // Get structure tree and build MCID -> struct node map
        const structTree = await page.getStructTree();
        if (structTree) {
          buildMcidStructMap(structTree, mcidToStructNode);
        }
      }

      // Stage 5: Find text items for each search text (must be unique, unless Decoration)
      const foundTexts = new Map<string, MarkedTextItem>();
      for (const searchText of searchTexts) {
        const matches = allTextItems.filter((t) => t.str.includes(searchText));
        if (matches.length === 1) {
          foundTexts.set(searchText, matches[0]);
        } else if (matches.length > 1) {
          // Decoration types (headers, footers) naturally repeat on each page - allow first match
          if (isDecoration(searchText)) {
            foundTexts.set(searchText, matches[0]);
          } else {
            errors.push(
              `Text "${searchText}" is ambiguous - found ${matches.length} matches. Use a more specific search string.`,
            );
          }
        }
        // If matches.length === 0, we'll report "not found" later
      }

      // Stage 6 & 7: Resolve selectors to structure nodes and compute bboxes
      const resolvedSelectors = new Map<string, ResolvedSelector>();

      for (const searchText of searchTexts) {
        const textItem = foundTexts.get(searchText);
        if (!textItem) {
          errors.push(`Text not found in PDF: "${searchText}"`);
          continue;
        }

        let structNode: StructTreeNode | null = null;
        let bbox: BBox;

        // Decoration type: use text item bounds directly (for headers, footers, page decorations)
        if (isDecoration(searchText)) {
          bbox = {
            x: textItem.x,
            y: textItem.y,
            width: textItem.width,
            height: textItem.height,
            page: textItem.page,
          };
        } else if (!textItem.mcid) {
          errors.push(
            `Text "${searchText}" has no MCID - PDF may not be tagged. Use type: "Decoration" for untagged page elements like headers/footers.`,
          );
          continue;
        } else {
          structNode = mcidToStructNode.get(textItem.mcid) ?? null;

          // Same-MCID approach: compute bbox from all text items sharing this MCID
          const mcidItems = mcidToTextItems.get(textItem.mcid);
          if (mcidItems && mcidItems.length > 0) {
            const mcidBBox = unionBBox(mcidItems);
            if (mcidBBox) {
              bbox = mcidBBox;
            } else {
              errors.push(
                `Could not compute bbox for "${searchText}" - all text items in MCID are whitespace-only`,
              );
              continue;
            }
          } else {
            errors.push(
              `No text items found for MCID ${textItem.mcid} containing "${searchText}"`,
            );
            continue;
          }
        }

        resolvedSelectors.set(searchText, {
          selector: { text: searchText },
          textItem,
          structNode,
          bbox,
        });
      }

      // Validate type and id assertions
      for (const a of normalizedAssertions) {
        const resolved = resolvedSelectors.get(a.subject.text);
        if (!resolved) continue;

        if (a.subject.type && resolved.structNode) {
          if (resolved.structNode.role !== a.subject.type) {
            errors.push(
              `Tag type mismatch for "${a.subject.text}": expected ${a.subject.type}, got ${resolved.structNode.role}`,
            );
          }
        }

        if (a.subject.id && resolved.structNode) {
          // Check for id in structure node (if present)
          // Note: PDF structure tree nodes don't always have human-readable IDs
          // This would need to be extracted from the /ID attribute if present
          errors.push(
            `Tag id assertion not yet implemented for "${a.subject.text}"`,
          );
        }

        if (a.object) {
          const resolvedObj = resolvedSelectors.get(a.object.text);
          if (!resolvedObj) continue;

          if (a.object.type && resolvedObj.structNode) {
            if (resolvedObj.structNode.role !== a.object.type) {
              errors.push(
                `Tag type mismatch for "${a.object.text}": expected ${a.object.type}, got ${resolvedObj.structNode.role}`,
              );
            }
          }
        }
      }

      // Stage 8: Evaluate position assertions
      for (const a of normalizedAssertions) {
        // Tag-only assertions (no relation/object)
        if (!a.relation || !a.object) {
          continue; // Already validated in stage 6
        }

        const subjectResolved = resolvedSelectors.get(a.subject.text);
        const objectResolved = resolvedSelectors.get(a.object.text);

        if (!subjectResolved || !objectResolved) {
          continue; // Error already recorded
        }

        const relationFn = pdfPositionRelations[a.relation];
        if (!relationFn) {
          errors.push(
            `Unknown relation "${a.relation}". Valid relations: ${Object.keys(pdfPositionRelations).join(", ")}`,
          );
          continue;
        }

        // Check same page
        if (subjectResolved.bbox.page !== objectResolved.bbox.page) {
          errors.push(
            `Cannot compare positions: "${a.subject.text}" is on page ${subjectResolved.bbox.page}, ` +
            `"${a.object.text}" is on page ${objectResolved.bbox.page}`,
          );
          continue;
        }

        // Evaluate relation
        if (!relationFn(subjectResolved.bbox, objectResolved.bbox, a.tolerance)) {
          errors.push(
            `Position assertion failed: "${a.subject.text}" is NOT ${a.relation} "${a.object.text}". ` +
            `Subject bbox: (${subjectResolved.bbox.x.toFixed(1)}, ${subjectResolved.bbox.y.toFixed(1)}, ` +
            `w=${subjectResolved.bbox.width.toFixed(1)}, h=${subjectResolved.bbox.height.toFixed(1)}) page ${subjectResolved.bbox.page}, ` +
            `Object bbox: (${objectResolved.bbox.x.toFixed(1)}, ${objectResolved.bbox.y.toFixed(1)}, ` +
            `w=${objectResolved.bbox.width.toFixed(1)}, h=${objectResolved.bbox.height.toFixed(1)}) page ${objectResolved.bbox.page}`,
          );
        }
      }

      // Evaluate negative assertions
      for (const a of normalizedNoMatch ?? []) {
        if (!a.relation || !a.object) continue;

        const subjectResolved = resolvedSelectors.get(a.subject.text);
        const objectResolved = resolvedSelectors.get(a.object.text);

        if (!subjectResolved || !objectResolved) {
          continue; // Assertion trivially doesn't hold
        }

        if (subjectResolved.bbox.page !== objectResolved.bbox.page) {
          continue; // Assertion trivially doesn't hold
        }

        const relationFn = pdfPositionRelations[a.relation];
        if (!relationFn) {
          errors.push(
            `Unknown relation "${a.relation}" in negative assertion`,
          );
          continue;
        }

        if (relationFn(subjectResolved.bbox, objectResolved.bbox, a.tolerance)) {
          errors.push(
            `Negative assertion failed: "${a.subject.text}" IS ${a.relation} "${a.object.text}" (expected NOT to be). ` +
            `Subject bbox: (${subjectResolved.bbox.x.toFixed(1)}, ${subjectResolved.bbox.y.toFixed(1)}) page ${subjectResolved.bbox.page}, ` +
            `Object bbox: (${objectResolved.bbox.x.toFixed(1)}, ${objectResolved.bbox.y.toFixed(1)}) page ${objectResolved.bbox.page}`,
          );
        }
      }

      // Stage 9: Aggregate errors
      if (errors.length > 0) {
        assert(
          false,
          `PDF position assertions failed in ${file}:\n${errors.map((e, i) => `  ${i + 1}. ${e}`).join("\n")}`,
        );
      }
    },
  };
};
