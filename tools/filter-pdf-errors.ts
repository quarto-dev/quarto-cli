#!/usr/bin/env -S quarto run
/**
 * filter-pdf-errors.ts
 *
 * Parse a quarto render log and extract PDF validation errors,
 * showing which files failed and why. Aggregates errors by type at the end.
 *
 * Handles two error formats:
 *   - Typst compiler errors: "error: PDF/UA-1 error: missing alt text"
 *   - verapdf validation failures: "WARN: PDF validation failed for ua-2:\n<rule text>"
 *
 * Usage:
 *   quarto run tools/filter-pdf-errors.ts <logfile>
 *
 * Reads from stdin if no file is given.
 */

// Strip ANSI escape codes
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

// Unescape HTML entities from verapdf output
function unescapeHtml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

interface RenderBlock {
  inputFile: string;
  outputFile: string;
  lines: string[];
}

interface ErrorEntry {
  file: string;
  errorType: string;
  context: string[];
}

function extractErrors(block: RenderBlock): {
  seenErrors: Set<string>;
  context: string[];
} {
  const context: string[] = [];
  let inStack = false;
  const seenErrors = new Set<string>();

  for (let i = 0; i < block.lines.length; i++) {
    const line = block.lines[i];

    // Skip download lines
    if (/^Download /.test(line.trim())) continue;
    // Skip blank-ish lines at start
    if (context.length === 0 && line.trim() === "") continue;

    // Detect start of stack trace
    if (/^Stack trace:/.test(line.trim())) {
      inStack = true;
      continue;
    }
    if (inStack) {
      if (/^\s+at /.test(line)) continue;
      inStack = false;
    }

    // Skip duplicate ERROR: lines from typst
    if (/^ERROR: error: PDF\//.test(line.trim())) continue;
    if (/^ERROR: Typst compilation failed/.test(line.trim())) continue;

    // Typst compiler errors: "error: PDF/UA-1 error: missing alt text"
    const typstMatch = line.match(/error: (PDF\/\S+ error: .+)/);
    if (typstMatch) {
      const errType = typstMatch[1].trim();
      seenErrors.add(errType);
    }

    // verapdf failures: "WARN: PDF validation failed for <standard>:"
    // followed by one or more rule description lines until a blank line or "Output created"
    const verapdfMatch = line.match(
      /^WARN: PDF validation failed for ([\w-]+):$/,
    );
    if (verapdfMatch) {
      const standard = verapdfMatch[1];
      // Collect the rule lines that follow
      for (let j = i + 1; j < block.lines.length; j++) {
        const ruleLine = block.lines[j].trim();
        if (ruleLine === "" || /^Output created/.test(ruleLine)) break;
        const errType = `${standard}: ${ruleLine}`;
        seenErrors.add(errType);
      }
    }

    context.push(line);
  }

  // Trim trailing blank lines
  while (context.length > 0 && context[context.length - 1].trim() === "") {
    context.pop();
  }

  return { seenErrors, context };
}

async function main() {
  const path = Deno.args[0];
  let text: string;
  if (path) {
    text = await Deno.readTextFile(path);
  } else {
    const buf = await new Response(Deno.stdin.readable).text();
    text = buf;
  }

  const rawLines = text.split("\n");
  const lines = rawLines.map((l) => unescapeHtml(stripAnsi(l)));

  // Parse into render blocks. Each block starts with either a
  // "Rendering <path>.qmd" line or a "pandoc" header.
  const blocks: RenderBlock[] = [];
  let current: RenderBlock | null = null;
  let pendingInputFile = "";

  for (const line of lines) {
    // "Rendering docs/smoke-all/.../foo.qmd" precedes the pandoc block
    const renderMatch = line.match(/^Rendering\s+(\S+\.qmd)\s*$/);
    if (renderMatch) {
      pendingInputFile = renderMatch[1];
      continue;
    }

    if (/^pandoc\s*$/.test(line.trim())) {
      if (current) blocks.push(current);
      current = { inputFile: pendingInputFile, outputFile: "", lines: [] };
      pendingInputFile = "";
      current.lines.push(line);
      continue;
    }
    if (current) {
      current.lines.push(line);
      const m = line.match(/^\s*output-file:\s*(.+)/);
      if (m) {
        current.outputFile = m[1].trim();
      }
    }
  }
  if (current) blocks.push(current);

  // Extract errors from each block
  const errors: ErrorEntry[] = [];
  const errorCounts = new Map<string, number>();
  const errorFiles = new Map<string, string[]>();

  for (const block of blocks) {
    // Check for either error format
    const hasError = block.lines.some(
      (l) =>
        l.includes("error: PDF/") ||
        l.includes("ERROR: error: PDF/") ||
        l.includes("PDF validation failed"),
    );
    if (!hasError) continue;

    const { seenErrors, context } = extractErrors(block);
    const displayFile = block.inputFile || block.outputFile;

    for (const errType of seenErrors) {
      errorCounts.set(errType, (errorCounts.get(errType) || 0) + 1);
      const files = errorFiles.get(errType) || [];
      if (!files.includes(displayFile)) {
        files.push(displayFile);
      }
      errorFiles.set(errType, files);

      errors.push({
        file: displayFile,
        errorType: errType,
        context,
      });
    }
  }

  // Print per-file errors
  const printedFiles = new Set<string>();
  for (const err of errors) {
    if (printedFiles.has(err.file)) continue;
    printedFiles.add(err.file);

    const fileErrors = errors.filter((e) => e.file === err.file);
    const types = [...new Set(fileErrors.map((e) => e.errorType))];

    console.log("─".repeat(72));
    console.log(`FILE: ${err.file}`);
    console.log(`ERRORS: ${types.join(", ")}`);
    console.log("");
    for (const line of err.context) {
      console.log("  " + line);
    }
    console.log("");
  }

  // Print summary
  console.log("═".repeat(72));
  console.log("SUMMARY");
  console.log("═".repeat(72));
  console.log("");
  console.log(`Total files with errors: ${printedFiles.size}`);
  console.log(`Total files rendered:    ${blocks.length}`);
  console.log("");

  // Sort by count descending
  const sorted = [...errorCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [errType, count] of sorted) {
    console.log(`  ${count.toString().padStart(4)}  ${errType}`);
  }
  console.log("");

  // List files per error type
  for (const [errType] of sorted) {
    const files = errorFiles.get(errType) || [];
    console.log(`${errType} (${files.length} files):`);
    for (const f of files) {
      console.log(`  - ${f}`);
    }
    console.log("");
  }
}

main();
