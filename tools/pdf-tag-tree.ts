#!/usr/bin/env -S deno run --allow-read --allow-env
/**
 * pdf-tag-tree.ts
 *
 * Extracts and displays the PDF structure tree (tag hierarchy) with MCIDs.
 * Useful for debugging ensurePdfTextPositions issues.
 *
 * Usage: quarto run tools/pdf-tag-tree.ts <pdf-file> <search-text>
 *
 * The search-text is required and determines which page's structure tree to display.
 */

import * as pdfjsLib from "npm:pdfjs-dist@4.4.168/legacy/build/pdf.mjs";

interface StructTreeContent {
  type: "content";
  id: string;
}

interface StructTreeNode {
  role: string;
  children?: (StructTreeNode | StructTreeContent)[];
  alt?: string;
  lang?: string;
}

interface TextMarkedContent {
  type: string;
  id?: string;
  tag?: string;
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

function isStructTreeContent(child: any): child is StructTreeContent {
  return child && typeof child === "object" && child.type === "content";
}

function isTextMarkedContent(item: any): item is TextMarkedContent {
  return "type" in item && typeof item.type === "string";
}

// Build a map from MCID to the path of tags leading to it
function buildMcidPaths(
  node: StructTreeNode,
  path: string[] = [],
  result: Map<string, { path: string[]; role: string; attrs: Record<string, any> }> = new Map()
): Map<string, { path: string[]; role: string; attrs: Record<string, any> }> {
  const currentPath = [...path, node.role];

  for (const child of node.children ?? []) {
    if (isStructTreeContent(child)) {
      // This is an MCID reference
      const attrs: Record<string, any> = {};
      if (node.alt) attrs.alt = node.alt;
      if (node.lang) attrs.lang = node.lang;

      result.set(child.id, {
        path: currentPath,
        role: node.role,
        attrs
      });
    } else {
      // Recurse into child structure nodes
      buildMcidPaths(child, currentPath, result);
    }
  }

  return result;
}

// Pretty print the structure tree
function printStructTree(
  node: StructTreeNode,
  indent: number = 0,
  maxDepth: number = 10,
  highlightMcids: Set<string> = new Set()
): void {
  if (indent > maxDepth) {
    console.log(" ".repeat(indent * 2) + "...(truncated)");
    return;
  }

  const attrs: string[] = [];
  if (node.alt) attrs.push(`alt="${node.alt}"`);
  if (node.lang) attrs.push(`lang="${node.lang}"`);

  const attrStr = attrs.length > 0 ? ` [${attrs.join(", ")}]` : "";

  let mcids: string[] = [];
  let childNodes: StructTreeNode[] = [];

  for (const child of node.children ?? []) {
    if (isStructTreeContent(child)) {
      mcids.push(child.id);
    } else {
      childNodes.push(child);
    }
  }

  const mcidStr = mcids.length > 0 ? ` (MCIDs: ${mcids.join(", ")})` : "";
  const hasMatch = mcids.some(id => highlightMcids.has(id));
  const matchMarker = hasMatch ? "  # <-- found" : "";
  console.log(" ".repeat(indent * 2) + `<${node.role}>${attrStr}${mcidStr}${matchMarker}`);

  for (const child of childNodes) {
    printStructTree(child, indent + 1, maxDepth, highlightMcids);
  }
}

async function main() {
  const file = Deno.args[0];
  const searchText = Deno.args[1];

  if (!file || !searchText) {
    console.error("Usage: quarto run tools/pdf-tag-tree.ts <pdf-file> <search-text>");
    Deno.exit(1);
  }

  const data = await Deno.readFile(file);
  const pdf = await pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  // First pass: find which page contains the search text
  let foundPage: number | null = null;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent({ includeMarkedContent: true });

    for (const item of textContent.items) {
      if (!isTextMarkedContent(item)) {
        const textItem = item as TextItem;
        if (textItem.str.includes(searchText)) {
          foundPage = pageNum;
          break;
        }
      }
    }
    if (foundPage) break;
  }

  if (!foundPage) {
    console.error(`Error: "${searchText}" not found in PDF`);
    Deno.exit(1);
  }

  console.log(`Found "${searchText}" on page ${foundPage}\n`);

  // Get the page with the search text
  const page = await pdf.getPage(foundPage);
  const structTree = await page.getStructTree();

  // Build MCID paths for this page
  const mcidPaths = structTree ? buildMcidPaths(structTree as StructTreeNode) : new Map();

  // Get text content and find MCIDs containing the search text
  const textContent = await page.getTextContent({ includeMarkedContent: true });

  // First pass: collect MCIDs that contain the search text
  const matchingMcids = new Set<string>();
  let currentMcid: string | null = null;

  for (const item of textContent.items) {
    if (isTextMarkedContent(item)) {
      const mcidValue = (item as any).id;
      if (item.type === "beginMarkedContentProps" && mcidValue !== undefined) {
        currentMcid = mcidValue;
      } else if (item.type === "endMarkedContent") {
        currentMcid = null;
      }
    } else {
      const textItem = item as TextItem;
      if (textItem.str.includes(searchText) && currentMcid !== null) {
        matchingMcids.add(currentMcid);
      }
    }
  }

  console.log(`=== STRUCTURE TREE (Page ${foundPage}) ===\n`);
  if (structTree) {
    printStructTree(structTree as StructTreeNode, 0, 15, matchingMcids);
  } else {
    console.log("No structure tree found (PDF may not be tagged)");
  }
  console.log("\n");

  console.log(`=== TEXT ITEMS CONTAINING "${searchText}" ===\n`);

  currentMcid = null;

  for (const item of textContent.items) {
    if (isTextMarkedContent(item)) {
      const mcidValue = (item as any).id;
      if (item.type === "beginMarkedContentProps" && mcidValue !== undefined) {
        currentMcid = mcidValue;
      } else if (item.type === "endMarkedContent") {
        currentMcid = null;
      }
    } else {
      const textItem = item as TextItem;
      if (textItem.str.includes(searchText)) {
        const x = textItem.transform[4];
        const y = textItem.transform[5];
        const pathInfo = currentMcid ? mcidPaths.get(currentMcid) : null;

        console.log(`Text: "${textItem.str}"`);
        console.log(`  MCID: ${currentMcid}`);
        console.log(`  Position: x=${x.toFixed(1)}, y=${y.toFixed(1)}`);
        if (pathInfo) {
          console.log(`  Tag path: ${pathInfo.path.join(" > ")}`);
          if (Object.keys(pathInfo.attrs).length > 0) {
            console.log(`  Attrs: ${JSON.stringify(pathInfo.attrs)}`);
          }
        }
        console.log();
      }
    }
  }
}

main().catch(console.error);
