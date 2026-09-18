#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

import { join } from "https://deno.land/std/path/mod.ts";
import { renderPandocAstToBlockDiagram } from "./ast-diagram.ts";
import { PandocAST } from "./types.ts";

/**
 * Convert a markdown file to an HTML block diagram
 */
async function renderMarkdownToBlockDiagram(
  markdownFile: string,
  outputFile: string,
  mode = "block",
) {
  console.log(`Processing ${markdownFile}...`);

  try {
    // Read the markdown file content
    console.log("Reading markdown source file...");
    // Read the CSS file
    const scriptDir = new URL(".", import.meta.url).pathname;
    const cssPath = join(scriptDir, "style.css");
    const cssContent = await Deno.readTextFile(cssPath);

    // Run pandoc to convert markdown to JSON
    console.log("Running pandoc to convert to JSON...");
    const command = new Deno.Command("quarto", {
      args: ["pandoc", "-t", "json", markdownFile],
      stdout: "piped",
    });

    const { code, stdout } = await command.output();
    if (code !== 0) {
      throw new Error(`Pandoc command failed with exit code ${code}`);
    }

    const jsonOutput = new TextDecoder().decode(stdout);

    // Parse the JSON
    console.log("Parsing Pandoc JSON...");
    const pandocAst = JSON.parse(jsonOutput) as PandocAST;
    const fullHtml = renderPandocAstToBlockDiagram(pandocAst, cssContent, mode);

    // Write the result to the output file
    console.log(`Writing output to ${outputFile}...`);
    await Deno.writeTextFile(outputFile, fullHtml);

    console.log("Done!");
    return true;
  } catch (err) {
    // deno-lint-ignore no-explicit-any
    console.error("Error:", (err as unknown as any).message);
    return false;
  }
}

// Check if script is run directly
if (import.meta.main) {
  // Get markdown file from command line arguments
  const args = Deno.args;

  // Check for --mode flag and its value
  let mode = "block";
  const modeIndex = args.indexOf("--mode");
  if (modeIndex !== -1 && modeIndex + 1 < args.length) {
    const modeValue = args[modeIndex + 1];
    if (
      modeValue === "block" || modeValue === "inline" || modeValue === "full"
    ) {
      mode = modeValue;
    } else {
      console.error(
        "Invalid mode value. Must be 'block', 'inline', or 'full'.",
      );
      Deno.exit(1);
    }
  }

  // Backwards compatibility for --verbose flag
  const verboseIndex = args.indexOf("--verbose");
  if (verboseIndex !== -1) {
    mode = "inline";
  }

  // Remove the --mode flag and its value, or --verbose flag for the rest of argument processing
  const cleanedArgs = [...args];
  if (modeIndex !== -1) {
    cleanedArgs.splice(modeIndex, 2); // Remove both flag and value
  } else if (verboseIndex !== -1) {
    cleanedArgs.splice(verboseIndex, 1); // Remove just the flag
  }

  if (cleanedArgs.length < 1) {
    console.log(
      "Usage: main.ts [--mode <block|inline|full>] <markdown-file> [output-html-file]",
    );
    console.log("Options:");
    console.log(
      "  --mode block|inline|full   Rendering mode: 'block' (default), 'inline' (detailed AST), or 'full' (all nodes)",
    );
    console.log(
      "  --verbose                 (Legacy) Equivalent to --mode inline",
    );
    console.log(
      "\nIf output file is not specified, it will use the input filename with .html extension",
    );
    Deno.exit(1);
  }

  const markdownFile = cleanedArgs[0];
  let outputFile = cleanedArgs[1];

  if (!outputFile) {
    // Default output file is input file with .html extension
    outputFile = markdownFile.replace(/\.[^\.]+$/, "") + ".html";
  }

  renderMarkdownToBlockDiagram(markdownFile, outputFile, mode);
}
