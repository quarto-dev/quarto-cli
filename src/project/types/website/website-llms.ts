/*
 * website-llms.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { basename, join, relative } from "../../../deno_ral/path.ts";
import { existsSync } from "../../../deno_ral/fs.ts";
import { pathWithForwardSlashes } from "../../../core/path.ts";

import { Document, Element, Node } from "../../../core/deno-dom.ts";
import { execProcess } from "../../../core/process.ts";
import { pandocBinaryPath, resourcePath } from "../../../core/resources.ts";

import { kProject404File, ProjectContext } from "../../types.ts";
import { projectOutputDir } from "../../project-shared.ts";
import { ProjectOutputFile } from "../types.ts";

import { kLlmsTxt } from "./website-constants.ts";
import {
  websiteBaseurl,
  websiteConfigBoolean,
  websiteDescription,
  websiteTitle,
} from "./website-config.ts";
import { inputFileHref } from "./website-shared.ts";
import { isDraftVisible, isProjectDraft, projectDraftMode } from "./website-utils.ts";
import { resolveInputTargetForOutputFile } from "../../project-index.ts";
import { Format } from "../../../config/types.ts";

/**
 * Compute the output HTML file path from the source file.
 * Uses inputFileHref to convert the relative source path to an HTML href,
 * then joins with the output directory.
 */
function computeOutputFilePath(source: string, project: ProjectContext): string {
  const outputDir = projectOutputDir(project);
  const sourceRelative = relative(project.dir, source);
  // inputFileHref returns "/path/to/file.html" - strip leading / and join with output dir
  const htmlHref = inputFileHref(sourceRelative);
  return join(outputDir, htmlHref.slice(1));
}

/**
 * HTML finalizer that generates .llms.md files from rendered HTML.
 * This runs after all HTML postprocessors have completed.
 */
export function llmsHtmlFinalizer(
  source: string,
  project: ProjectContext,
  _format: Format,
) {
  return async (doc: Document): Promise<void> => {
    // Check if llms-txt is enabled
    if (!websiteConfigBoolean(kLlmsTxt, false, project.config)) {
      return;
    }

    // Check draft status via multiple mechanisms
    const draftMode = projectDraftMode(project);

    // Check 1: quarto:status meta tag (set by draft processing)
    const statusEl = doc.querySelector("meta[name='quarto:status']");
    const status = statusEl?.getAttribute("content");
    const isDraftByStatus = status === "draft" || status === "draft-remove";

    // Check 2: drafts array in project config
    const sourceRelative = relative(project.dir, source);
    const isDraftByConfig = isProjectDraft(sourceRelative, project);

    const isDraft = isDraftByStatus || isDraftByConfig;

    if (isDraft && !isDraftVisible(draftMode)) {
      return; // Skip draft pages
    }

    // Extract main content from HTML
    const htmlContent = extractMainContent(doc);

    // Compute the output file path and derive the .llms.md path
    const outputFile = computeOutputFilePath(source, project);
    const llmsOutputPath = outputFile.replace(/\.html$/, ".llms.md");

    // Convert HTML to markdown using Pandoc with the llms.lua filter
    await convertHtmlToLlmsMarkdown(htmlContent, llmsOutputPath);

    // Clean up conditional content markers from the original HTML doc
    cleanupConditionalContent(doc);
  };
}

/**
 * Clean up conditional content markers from the HTML document.
 * - Remove llms-only content (should not appear in HTML output)
 * - Unwrap llms-hidden markers (keep content, remove wrapper div)
 */
function cleanupConditionalContent(doc: Document): void {
  // Remove llms-only content from HTML output
  for (const el of doc.querySelectorAll(".llms-conditional-content")) {
    (el as Element).remove();
  }

  // Unwrap llms-hidden markers (keep content, remove wrapper div)
  for (const el of doc.querySelectorAll(".llms-hidden-content")) {
    const parent = (el as Element).parentElement;
    if (parent) {
      const element = el as Element;
      while (element.firstChild) {
        parent.insertBefore(element.firstChild as Node, element as Node);
      }
      element.remove();
    }
  }
}

/**
 * Extract the main content from an HTML document, removing navigation,
 * sidebars, footers, scripts, and styles.
 */
function extractMainContent(doc: Document): string {
  // Clone the document to avoid mutating the original
  const clone = doc.cloneNode(true) as Document;

  // Remove elements that shouldn't be in llms output
  const selectorsToRemove = [
    "#quarto-header",
    ".nav-footer",
    "#quarto-sidebar",
    "#quarto-margin-sidebar",
    "#quarto-search-results",
    ".sidebar",
    ".quarto-search",
    "nav.navbar",
    "script",
    "style",
    "link[rel='stylesheet']",
    "meta",
    "noscript",
  ];

  for (const selector of selectorsToRemove) {
    const elements = clone.querySelectorAll(selector);
    for (const el of elements) {
      (el as Element).remove();
    }
  }

  // Get the main content area
  const main = clone.querySelector("main") ||
    clone.querySelector("#quarto-document-content") ||
    clone.querySelector("article") ||
    clone.body;

  if (!main) {
    return "";
  }

  // Preprocess annotated code blocks before converting to markdown
  preprocessAnnotatedCodeBlocks(clone, main as Element);

  // Return a minimal HTML document with just the content
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
${main.innerHTML}
</body>
</html>`;
}

/**
 * Preprocess annotated code blocks for llms output.
 * Restores original code text (with annotation markers) and converts
 * the annotation definition list to an ordered list.
 */
function preprocessAnnotatedCodeBlocks(doc: Document, container: Element): void {
  // Restore original code text in annotated code blocks.
  // The llms-code-annotations.lua filter saves the original text
  // (before code-annotation.lua strips markers) as a data attribute.
  const annotated = container.querySelectorAll("[data-llms-code-original]");
  for (const node of annotated) {
    const el = node as Element;
    const originalText = el.getAttribute("data-llms-code-original");
    if (!originalText) continue;

    // The attribute is on the wrapper div; find the <code> element inside
    const codeEl = el.tagName === "CODE"
      ? el
      : el.querySelector("code") as Element | null;
    if (codeEl) {
      // Replace content with original (removes syntax highlighting spans + annotation buttons)
      codeEl.textContent = originalText;
    }

    el.removeAttribute("data-llms-code-original");
  }

  // Remove annotation gutter elements
  const gutters = container.querySelectorAll(
    ".code-annotation-gutter, .code-annotation-gutter-bg",
  );
  for (const gutter of gutters) {
    (gutter as Element).remove();
  }

  // Convert annotation definition lists to ordered lists.
  // The annotation text is in <dd> elements; <dt> elements have just the number.
  const dls = container.querySelectorAll("dl.code-annotation-container-grid");
  for (const dlNode of dls) {
    const dl = dlNode as Element;
    const ol = doc.createElement("ol");
    const dds = dl.querySelectorAll("dd");
    for (const ddNode of dds) {
      const dd = ddNode as Element;
      const li = doc.createElement("li");
      li.innerHTML = dd.innerHTML;
      ol.appendChild(li);
    }

    // Replace the DL (and its cell-annotation wrapper div if present)
    const parent = dl.parentElement;
    if (parent && parent.classList.contains("cell-annotation")) {
      parent.parentElement?.replaceChild(ol, parent);
    } else {
      dl.parentElement?.replaceChild(ol, dl);
    }
  }
}

/**
 * Convert HTML content to markdown using Pandoc with the llms.lua filter.
 */
async function convertHtmlToLlmsMarkdown(
  htmlContent: string,
  outputPath: string,
): Promise<void> {
  const filterPath = resourcePath("filters/llms/llms.lua");

  // Create a temporary file for the HTML content
  const tempDir = Deno.makeTempDirSync();
  const tempHtml = join(tempDir, "input.html");
  Deno.writeTextFileSync(tempHtml, htmlContent);

  try {
    // Run Pandoc to convert HTML to markdown
    // Use gfm-raw_html for clean markdown output:
    // - gfm gives us proper table and code block handling
    // - -raw_html strips remaining HTML tags, converting figures to markdown images
    // Note: We use plain "html" input format (not html-native_divs-native_spans)
    // because native_divs interferes with the Lua filter's callout processing
    const cmd = [pandocBinaryPath()];
    cmd.push(tempHtml);
    cmd.push("-f", "html");
    cmd.push("-t", "gfm-raw_html");
    cmd.push("--lua-filter", filterPath);
    cmd.push("-o", outputPath);
    cmd.push("--wrap=none");

    const result = await execProcess({
      cmd: cmd[0],
      args: cmd.slice(1),
      stdout: "piped",
      stderr: "piped",
    });

    if (!result.success) {
      console.error(`Error converting HTML to markdown: ${result.stderr}`);
    }
  } finally {
    // Cleanup temp files
    try {
      Deno.removeSync(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Generate the llms.txt index file after all HTML files have been rendered.
 * This is called during the post-render phase.
 */
export async function updateLlmsTxt(
  context: ProjectContext,
  outputFiles: ProjectOutputFile[],
  incremental: boolean,
): Promise<void> {
  // Check if llms-txt is enabled
  if (!websiteConfigBoolean(kLlmsTxt, false, context.config)) {
    return;
  }

  const outputDir = projectOutputDir(context);
  const llmsTxtPath = join(outputDir, "llms.txt");

  // Match sitemap behavior: only regenerate on full render
  if (incremental && existsSync(llmsTxtPath)) {
    return;
  }

  const siteTitle = websiteTitle(context.config) || "Untitled";
  const siteDesc = websiteDescription(context.config) || "";
  const baseUrl = websiteBaseurl(context.config);
  const draftMode = projectDraftMode(context);

  // Helper to check if output file is a draft
  const isDraft = async (outputFile: ProjectOutputFile): Promise<boolean> => {
    const index = await resolveInputTargetForOutputFile(
      context,
      relative(outputDir, outputFile.file),
    );
    return index?.draft ?? false;
  };

  // Filter out 404 page
  const doc404 = join(outputDir, kProject404File);

  // Collect all .llms.md files, excluding drafts and 404
  const llmsFiles: Array<{ path: string; title: string }> = [];

  for (const file of outputFiles) {
    // Skip 404 page
    if (file.file === doc404) {
      continue;
    }

    // Skip drafts unless in visible draft mode
    const draft = await isDraft(file);
    if (draft && !isDraftVisible(draftMode)) {
      continue;
    }

    const llmsPath = file.file.replace(/\.html$/, ".llms.md");
    if (existsSync(llmsPath)) {
      // Extract title from the format metadata or use filename
      const title = (file.format.metadata?.title as string) ||
        basename(file.file, ".html");
      const relativePath = pathWithForwardSlashes(relative(outputDir, llmsPath));
      const filePath = baseUrl
        ? (baseUrl.endsWith("/") ? baseUrl : baseUrl + "/") + relativePath
        : relativePath;
      llmsFiles.push({
        path: filePath,
        title,
      });
    }
  }

  // Generate llms.txt content
  const lines: string[] = [];
  lines.push(`# ${siteTitle}`);
  lines.push("");
  if (siteDesc) {
    lines.push(`> ${siteDesc}`);
    lines.push("");
  }
  lines.push("## Pages");
  lines.push("");
  for (const f of llmsFiles) {
    lines.push(`- [${f.title}](${f.path})`);
  }
  lines.push("");

  Deno.writeTextFileSync(llmsTxtPath, lines.join("\n"));
}
