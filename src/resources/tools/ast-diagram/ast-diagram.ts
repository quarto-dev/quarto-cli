/*
 * ast-diagram.ts
 *
 * (C) Posit, PBC 2025
 */

import { Inline, MetaValue, PandocAST } from "./types.ts";

/**
 * Converts a Pandoc AST JSON to an HTML block diagram
 * @param json The Pandoc AST JSON object
 * @param renderMode The rendering mode: "block" (default), "inline" (detailed inline AST), or "full" (all nodes including Str/Space)
 * @returns HTML string representing the block diagram
 */
export function convertToBlockDiagram(json: PandocAST, mode = "block"): string {
  // Start with a container
  let html = '<div class="pandoc-block-diagram">\n';

  // Process metadata if it exists
  if (Object.keys(json.meta).length > 0) {
    html += processMetadata(json.meta, mode);
  }

  // Process the blocks
  html += processBlocks(json.blocks, mode);

  // Close container
  html += "</div>\n";

  return html;
}

export function renderPandocAstToBlockDiagram(
  pandocAst: PandocAST,
  cssContent: string,
  mode = "block",
): string {
  // Convert to HTML block diagram
  console.log("Converting to HTML block diagram...");
  const html = convertToBlockDiagram(pandocAst, mode);

  // Add HTML wrapper and CSS
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inconsolata:wght@200..900&family=Nunito:ital,wght@0,200..1000;1,200..1000&display=swap" rel="stylesheet">
  <title>Pandoc AST Block Diagram</title>
  <style>
  ${cssContent}
  </style>
  <script>
  // Add event handler for toggling blocks and inlines
  document.addEventListener('DOMContentLoaded', () => {
    // Add click handlers to all block headers
    document.querySelectorAll('.block-type').forEach(header => {
      header.addEventListener('click', () => {
        // Toggle the 'folded' class on the parent block
        header.closest('.block').classList.toggle('folded');
      });
    });
    
    // Add click handlers to all inline headers
    document.querySelectorAll('.inline-type').forEach(header => {
      header.addEventListener('click', () => {
        // Toggle the 'folded' class on the parent inline
        header.closest('.inline').classList.toggle('folded');
      });
    });
    
    // Markdown source is no longer foldable
    
    // Initialize all toggle buttons to have the correct event handling
    document.querySelectorAll('.toggle-button').forEach(button => {
      // Prevent event propagation when clicking the button itself
      button.addEventListener('click', (event) => {
        // This ensures the parent handler above still runs
        // but prevents double-toggling due to bubbling
        event.stopPropagation();
        
        // Toggle the 'folded' class on the parent element (block or inline)
        const parent = button.closest('.block') || button.closest('.inline');
        if (parent) {
          parent.classList.toggle('folded');
        }
      });
    });
    
    // Add global fold/unfold controls
    const controls = document.createElement('span');
    controls.className = 'fold-controls';
    controls.innerHTML = '<span class="control-group"><span>Blocks:</span><button id="fold-all-blocks">Fold</button><button id="unfold-all-blocks">Unfold</button></span><span class="control-group"><span>Inlines:</span><button id="fold-all-inlines">Fold</button><button id="unfold-all-inlines">Unfold</button></span>';
    
    document.getElementById('ast-diagram-heading').appendChild(controls);
    
    // Block controls
    document.getElementById('fold-all-blocks').addEventListener('click', () => {
      document.querySelectorAll('.block').forEach(block => {
        block.classList.add('folded');
      });
    });
    
    document.getElementById('unfold-all-blocks').addEventListener('click', () => {
      document.querySelectorAll('.block').forEach(block => {
        block.classList.remove('folded');
      });
    });
    
    // Inline controls
    document.getElementById('fold-all-inlines').addEventListener('click', () => {
      document.querySelectorAll('.inline').forEach(inline => {
        inline.classList.add('folded');
      });
    });
    
    document.getElementById('unfold-all-inlines').addEventListener('click', () => {
      document.querySelectorAll('.inline').forEach(inline => {
        inline.classList.remove('folded');
      });
    });
  });
  </script>
</head>
<body>
  <h2 id="ast-diagram-heading">Diagram</h2>
  ${html}
</body>
</html>`;
  return fullHtml;
}

/**
 * Process document metadata
 */
function processMetadata(
  meta: Record<string, MetaValue>,
  mode: string,
): string {
  let html = `<div class="block block-metadata">
  <div class="block-type">
    Meta
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="block-content">`;

  // Process each metadata key
  for (const [key, value] of Object.entries(meta)) {
    html += `<div class="metadata-entry">
      <div class="metadata-key">${escapeHtml(key)}</div>
      <div class="metadata-value">${processMetaValue(value, mode)}</div>
    </div>`;
  }

  html += `</div>
</div>\n`;

  return html;
}

/**
 * Process a metadata value of any type
 */
function processMetaValue(value: MetaValue, mode: string): string {
  switch (value.t) {
    case "MetaMap":
      return processMetaMap(value, mode);
    case "MetaList":
      return processMetaList(value, mode);
    case "MetaBlocks":
      return processMetaBlocks(value, mode);
    case "MetaInlines":
      return processMetaInlines(value, mode);
    case "MetaBool":
      return processMetaBool(value, mode);
    case "MetaString":
      return processMetaString(value, mode);
    default:
      return `<div class="meta-unknown">Unknown metadata type: ${
        // deno-lint-ignore no-explicit-any
        (value as any).t}</div>`;
  }
}

/**
 * Process a MetaMap metadata value
 */
function processMetaMap(
  value: Extract<MetaValue, { t: "MetaMap" }>,
  mode: string,
): string {
  const map = value.c;

  let html = `<div class="meta-map">
    <div class="meta-type">MetaMap</div>
    <div class="meta-content">`;

  for (const [key, mapValue] of Object.entries(map)) {
    html += `<div class="meta-map-entry">
      <div class="meta-map-key">${escapeHtml(key)}</div>
      <div class="meta-map-value">${processMetaValue(mapValue, mode)}</div>
    </div>`;
  }

  html += `</div>
  </div>`;

  return html;
}

/**
 * Process a MetaList metadata value
 */
function processMetaList(
  value: Extract<MetaValue, { t: "MetaList" }>,
  mode: string,
): string {
  const list = value.c;

  let html = `<div class="meta-list">
    <div class="meta-type">MetaList</div>
    <div class="meta-content">
      <ul class="meta-list-items">`;

  for (const item of list) {
    html += `<li class="meta-list-item">${processMetaValue(item, mode)}</li>`;
  }

  html += `</ul>
    </div>
  </div>`;

  return html;
}

/**
 * Process a MetaBlocks metadata value
 */
function processMetaBlocks(
  value: Extract<MetaValue, { t: "MetaBlocks" }>,
  mode: string,
): string {
  const blocks = value.c;

  const html = `<div class="meta-blocks">
    <div class="meta-type">MetaBlocks</div>
    <div class="meta-content">${processBlocks(blocks, mode)}</div>
  </div>`;

  return html;
}

/**
 * Process a MetaInlines metadata value
 */
function processMetaInlines(
  value: Extract<MetaValue, { t: "MetaInlines" }>,
  mode: string,
): string {
  const inlines = value.c;

  const html = `<div class="meta-inlines">
    <div class="meta-content">${processInlines(inlines, mode)}</div>
  </div>`;

  return html;
}

/**
 * Process a MetaBool metadata value
 */
function processMetaBool(
  value: Extract<MetaValue, { t: "MetaBool" }>,
  _mode: string,
): string {
  const bool = value.c;

  return `<div class="meta-bool">
    <div class="meta-content">${bool ? "true" : "false"}</div>
  </div>`;
}

/**
 * Process a MetaString metadata value
 */
function processMetaString(
  value: Extract<MetaValue, { t: "MetaString" }>,
  _mode: string,
): string {
  const str = value.c;

  return `<div class="meta-string">
    <div class="meta-content">${escapeHtml(str)}</div>
  </div>`;
}

/**
 * Process an array of block elements
 */
function processBlocks(blocks: PandocAST["blocks"], mode: string): string {
  let html = "";

  for (const block of blocks) {
    html += processBlock(block, mode);
  }

  return html;
}

/**
 * Process a block element with no content
 */
function processNoContentBlock(
  block: Extract<PandocAST["blocks"][0], { t: "HorizontalRule" }>,
  _mode: string,
): string {
  return `<div class="block block-${block.t.toLowerCase()}">
  <div class="block-type block-type-no-content">
    ${block.t}
  </div>
</div>\n`;
}

/**
 * Process a single block element
 */
function processBlock(block: PandocAST["blocks"][0], mode: string): string {
  switch (block.t) {
    case "Header":
      return processHeader(block, mode);
    case "Para":
      return processPara(block, mode);
    case "Plain":
      return processPlain(block, mode);
    case "BulletList":
      return processBulletList(block, mode);
    case "Div":
      return processDiv(block, mode);
    case "CodeBlock":
      return processCodeBlock(block, mode);
    case "HorizontalRule":
      return processNoContentBlock(block, mode);
    case "DefinitionList":
      return processDefinitionList(block, mode);
    case "Figure":
      return processFigure(block, mode);
    case "OrderedList":
      return processOrderedList(block, mode);
    case "LineBlock":
      return processLineBlock(block, mode);
    case "RawBlock":
      return processRawBlock(block, mode);
    case "BlockQuote":
      return processBlockQuote(block, mode);
    // Add other block types as needed
    default:
      return `<div class="block block-type-unknown block-type-${block.t}">
  <div class="block-type">
    ${block.t}
  </div>
  <div class="block-content">Unknown block type</div>
</div>\n`;
  }
}

/**
 * Process a header block
 */
function processHeader(
  block: Extract<PandocAST["blocks"][0], { t: "Header" }>,
  mode: string,
): string {
  const [level, [id, classes, attrs], content] = block.c;

  const classAttr = classes.length > 0 ? ` class="${classes.join(" ")}"` : "";
  const idAttr = id ? ` id="${id}"` : "";

  const nodeAttrs = formatNodeAttributes(id, classes, attrs);

  return `<div class="block block-header level-${level}"${idAttr}${classAttr}>
  <div class="block-type">
    Header (${level})${nodeAttrs}
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="block-content">${processInlines(content, mode)}</div>
</div>\n`;
}

/**
 * Process a paragraph block
 */
function processPara(
  block: Extract<PandocAST["blocks"][0], { t: "Para" }>,
  mode: string,
): string {
  return `<div class="block block-para">
  <div class="block-type">
    Para
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="block-content">${processInlines(block.c, mode)}</div>
</div>\n`;
}

/**
 * Process a plain block
 */
function processPlain(
  block: Extract<PandocAST["blocks"][0], { t: "Plain" }>,
  mode: string,
): string {
  return `<div class="block block-plain">
  <div class="block-type">
    Plain
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="block-content">${processInlines(block.c, mode)}</div>
</div>\n`;
}

/**
 * Process a bullet list block
 */
function processBulletList(
  block: Extract<PandocAST["blocks"][0], { t: "BulletList" }>,
  mode: string,
): string {
  const items = block.c;

  let html = `<div class="block block-bullet-list">
  <div class="block-type">
    BulletList
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="block-content">`;

  for (const item of items) {
    html += `<div class="list-item">${processBlocks(item, mode)}</div>`;
  }

  html += `</div>
</div>\n`;

  return html;
}

/**
 * Process a div block
 */
function processDiv(
  block: Extract<PandocAST["blocks"][0], { t: "Div" }>,
  mode: string,
): string {
  const [[id, classes, attrs], content] = block.c;

  const classAttr = classes.length > 0 ? ` class="${classes.join(" ")}"` : "";
  const idAttr = id ? ` id="${id}"` : "";

  let attrsText = "";
  if (attrs.length > 0) {
    attrsText = ` data-attrs="${
      attrs.map(([k, v]) => `${k}=${v}`).join(", ")
    }"`;
  }

  const nodeAttrs = formatNodeAttributes(id, classes, attrs);

  return `<div class="block block-div"${idAttr}${classAttr}${attrsText}>
  <div class="block-type">
    Div${nodeAttrs}
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="block-content">${processBlocks(content, mode)}</div>
</div>\n`;
}

/**
 * Process a code block
 */
function processCodeBlock(
  block: Extract<PandocAST["blocks"][0], { t: "CodeBlock" }>,
  _mode: string,
): string {
  const [[id, classes, attrs], code] = block.c;

  const language = classes.length > 0 ? classes[0] : "";
  const classAttr = classes.length > 0 ? ` class="${classes.join(" ")}"` : "";
  const idAttr = id ? ` id="${id}"` : "";

  const nodeAttrs = formatNodeAttributes(id, classes, attrs);

  return `<div class="block block-code"${idAttr}${classAttr}>
  <div class="block-type">
    Cod Block${language ? ` (${language})` : ""}${nodeAttrs}
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="block-content"><pre>${escapeHtml(code)}</pre></div>
</div>\n`;
}

/**
 * Process a definition list block
 */
function processDefinitionList(
  block: Extract<PandocAST["blocks"][0], { t: "DefinitionList" }>,
  mode: string,
): string {
  const items = block.c;

  let html = `<div class="block block-definition-list">
  <div class="block-type">
    DefinitionList
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="block-content">`;

  for (const [term, definitions] of items) {
    html += `<div class="definition-item">
      <div class="definition-term">${processInlines(term, mode)}</div>`;

    for (const definition of definitions) {
      html += `<div class="definition-description">${
        processBlocks(definition, mode)
      }</div>`;
    }

    html += `</div>`;
  }

  html += `</div>
</div>\n`;

  return html;
}

/**
 * Process a figure block
 */
function processFigure(
  block: Extract<PandocAST["blocks"][0], { t: "Figure" }>,
  mode: string,
): string {
  const [attr, [_, caption], content] = block.c;
  const [id, classes, attrs] = attr;

  const classAttr = classes.length > 0 ? ` class="${classes.join(" ")}"` : "";
  const idAttr = id ? ` id="${id}"` : "";

  const nodeAttrs = formatNodeAttributes(id, classes, attrs);

  let html = `<div class="block block-figure"${idAttr}${classAttr}>
  <div class="block-type">
    Figure${nodeAttrs}
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="block-content">`;

  // Add caption if present
  if (caption && caption.length > 0) {
    html += `<div class="figure-caption">${processBlocks(caption, mode)}</div>`;
  }

  // Add figure content
  html += `<div class="figure-content">${processBlocks(content, mode)}</div>`;

  html += `</div>
</div>\n`;

  return html;
}

/**
 * Process an ordered list block
 */
function processOrderedList(
  block: Extract<PandocAST["blocks"][0], { t: "OrderedList" }>,
  mode: string,
): string {
  const [[startNumber, style, delimiter], items] = block.c;

  // Extract style and delimiter values from their objects
  const styleStr = style.t;
  const delimiterStr = delimiter.t;

  let html = `<div class="block block-ordered-list">
  <div class="block-type">
    OrderedList (start: ${startNumber}, style: ${styleStr}, delimiter: ${delimiterStr})
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="block-content">`;

  for (const item of items) {
    html += `<div class="list-item">${processBlocks(item, mode)}</div>`;
  }

  html += `</div>
</div>\n`;

  return html;
}

/**
 * Process a line block
 */
function processLineBlock(
  block: Extract<PandocAST["blocks"][0], { t: "LineBlock" }>,
  mode: string,
): string {
  const lines = block.c;

  let html = `<div class="block block-line-block">
  <div class="block-type">
    LineBlock
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="block-content">`;

  for (const line of lines) {
    html += `<div class="line-block-line">${processInlines(line, mode)}</div>`;
  }

  html += `</div>
</div>\n`;

  return html;
}

/**
 * Process a RawBlock element
 */
function processRawBlock(
  block: Extract<PandocAST["blocks"][0], { t: "RawBlock" }>,
  _mode: string,
): string {
  const [format, content] = block.c;

  return `<div class="block block-rawblock">
  <div class="block-type">
    RawBlock (${format})
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="block-content">
    <pre>${escapeHtml(content)}</pre>
  </div>
</div>\n`;
}

/**
 * Process a BlockQuote element
 */
function processBlockQuote(
  block: Extract<PandocAST["blocks"][0], { t: "BlockQuote" }>,
  mode: string,
): string {
  const content = block.c;

  return `<div class="block block-blockquote">
  <div class="block-type">
    BlockQuote
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="block-content">${processBlocks(content, mode)}</div>
</div>\n`;
}

/**
 * Process a Code inline element in verbose mode
 */
function processCodeInline(
  inline: Extract<Inline, { t: "Code" }>,
  _mode: string,
): string {
  const [[id, classes, attrs], codeText] = inline.c;

  const classAttr = classes.length > 0 ? ` class="${classes.join(" ")}"` : "";
  const idAttr = id ? ` id="${id}"` : "";

  const nodeAttrs = formatNodeAttributes(id, classes, attrs);

  return `<div class="inline inline-code"${idAttr}${classAttr}>
  <div class="inline-type">
    Code${nodeAttrs}
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="inline-content">${escapeHtml(codeText)}</div>
</div>`;
}

/**
 * Process a Link inline element in verbose mode
 */
function processLinkInline(
  inline: Extract<Inline, { t: "Link" }>,
  mode: string,
): string {
  const [[id, classes, attrs], linkText, [url, title]] = inline.c;

  const classAttr = classes.length > 0 ? ` class="${classes.join(" ")}"` : "";
  const idAttr = id ? ` id="${id}"` : "";

  const nodeAttrs = formatNodeAttributes(id, classes, attrs);

  return `<div class="inline inline-link"${idAttr}${classAttr}>
  <div class="inline-type">
    Link${nodeAttrs}
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="inline-url language-markdown">${escapeHtml(url)}</div>
  ${title ? `<div class="inline-title">${escapeHtml(title)}</div>` : ""}
  <div class="inline-content">
    <div class="inline-text-content">${processInlines(linkText, mode)}</div>
  </div>
</div>`;
}

/**
 * Process an Image inline element in verbose mode
 */
function processImageInline(
  inline: Extract<Inline, { t: "Image" }>,
  mode: string,
): string {
  const [[id, classes, attrs], altText, [url, title]] = inline.c;

  const classAttr = classes.length > 0 ? ` class="${classes.join(" ")}"` : "";
  const idAttr = id ? ` id="${id}"` : "";

  const nodeAttrs = formatNodeAttributes(id, classes, attrs);

  return `<div class="inline inline-image"${idAttr}${classAttr}>
  <div class="inline-type">
    Image${nodeAttrs}
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="inline-url language-markdown">${escapeHtml(url)}</div>
  ${title ? `<div class="inline-title">${escapeHtml(title)}</div>` : ""}
  <div class="inline-content">
    <div class="inline-alt-text">${processInlines(altText, mode)}</div>
  </div>
</div>`;
}

/**
 * Process a Math inline element in verbose mode
 */
function processMathInline(
  inline: Extract<Inline, { t: "Math" }>,
  _mode: string,
): string {
  const [mathType, content] = inline.c;

  // The mathType object has a property 't' that is either 'InlineMath' or 'DisplayMath'
  const type = mathType.t;
  const isDisplay = type === "DisplayMath";

  return `<div class="inline inline-math inline-math-${
    isDisplay ? "display" : "inline"
  }">
  <div class="inline-type">
    Math (${isDisplay ? "Display" : "Inline"})
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="inline-content">
    <div class="math-content"><code>${escapeHtml(content)}</code></div>
  </div>
</div>`;
}

/**
 * Process a Quoted inline element in verbose mode
 */
function processQuotedInline(
  inline: Extract<Inline, { t: "Quoted" }>,
  mode: string,
): string {
  const [quoteType, content] = inline.c;

  // The quoteType object has a property 't' that is either 'SingleQuote' or 'DoubleQuote'
  const type = quoteType.t;
  const isSingle = type === "SingleQuote";

  return `<div class="inline inline-quoted inline-quoted-${
    isSingle ? "single" : "double"
  }">
  <div class="inline-type">
    Quoted (${isSingle ? "Single" : "Double"})
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="inline-content">
    <div class="quoted-content">${processInlines(content, mode)}</div>
  </div>
</div>`;
}

/**
 * Process a Note inline element in verbose mode
 */
function processNoteInline(
  inline: Extract<Inline, { t: "Note" }>,
  mode: string,
): string {
  const content = inline.c;

  return `<div class="inline inline-note">
  <div class="inline-type">
    Note
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="inline-content">
    <div class="note-content">${processBlocks(content, mode)}</div>
  </div>
</div>`;
}

/**
 * Process a Cite inline element in verbose mode
 */
function processCiteInline(
  inline: Extract<Inline, { t: "Cite" }>,
  mode: string,
): string {
  const [citations, text] = inline.c;

  let html = `<div class="inline inline-cite">
  <div class="inline-type">
    Cite
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="inline-content">`;

  // Display text representation
  html += `<div class="cite-text">${processInlines(text, mode)}</div>`;

  // Display each citation
  html += `<div class="cite-citations">`;
  for (const citation of citations) {
    const citationMode = citation.citationMode.t;
    html += `<div class="cite-citation">
      <div class="cite-id">${escapeHtml(citation.citationId)}</div>
      <div class="cite-mode">${escapeHtml(citationMode)}</div>`;

    // Display prefix if present
    if (citation.citationPrefix.length > 0) {
      html += `<div class="cite-prefix">${
        processInlines(citation.citationPrefix, mode)
      }</div>`;
    }

    // Display suffix if present
    if (citation.citationSuffix.length > 0) {
      html += `<div class="cite-suffix">${
        processInlines(citation.citationSuffix, mode)
      }</div>`;
    }

    html += `</div>`;
  }
  html += `</div>`;

  html += `</div>
</div>`;

  return html;
}

/**
 * Process a RawInline element in verbose mode
 */
function processRawInlineInline(
  inline: Extract<Inline, { t: "RawInline" }>,
  _mode: string,
): string {
  const [format, content] = inline.c;

  return `<div class="inline inline-rawinline">
  <div class="inline-type">
    RawInline (${format})
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="inline-content">
    <code class="raw-content">${escapeHtml(content)}</code>
  </div>
</div>`;
}

/**
 * Process a Span inline element in verbose mode
 */
function processSpanInline(
  inline: Extract<Inline, { t: "Span" }>,
  mode: string,
): string {
  const [[id, classes, attrs], spanContent] = inline.c;

  const classAttr = classes.length > 0 ? ` class="${classes.join(" ")}"` : "";
  const idAttr = id ? ` id="${id}"` : "";

  const nodeAttrs = formatNodeAttributes(id, classes, attrs);

  return `<div class="inline inline-span"${idAttr}${classAttr}>
  <div class="inline-type">
    Span${nodeAttrs}
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="inline-content">${processInlines(spanContent, mode)}</div>
</div>`;
}

/**
 * Process simple inline elements (Emph, Strong, SmallCaps, etc.) in verbose mode
 */
function processSimpleInline(
  inline: Extract<Inline, { t: string; c: Inline[] }>,
  mode: string,
): string {
  const nodeType = inline.t; // Get the type name (Emph, Strong, etc.)
  const content = inline.c; // Get the content (array of Inline elements)

  return `<div class="inline inline-${nodeType.toLowerCase()}">
  <div class="inline-type">
    ${nodeType}
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="inline-content">${processInlines(content, mode)}</div>
</div>`;
}

/**
 * Process a Str inline element in full mode
 */
function processStrInline(
  inline: Extract<Inline, { t: "Str" }>,
  _mode: string,
): string {
  const content = inline.c; // Get the string content

  return `<div class="inline inline-str">
  <div class="inline-type">
    Str
    <button class="toggle-button" aria-label="Toggle content">▼</button>
  </div>
  <div class="inline-content language-markdown">${escapeHtml(content)}</div>
</div>`;
}

const foldedOnlyString = (type: string) => {
  switch (type) {
    case "Space":
      return "⏘";
    default:
      return type;
  }
};

/**
 * Process inline elements with no content
 */
function processNoContentInline(
  inline: Extract<Inline, { t: "Space" | "SoftBreak" | "LineBreak" }>,
  _mode: string,
): string {
  return `<div class="inline inline-${inline.t.toLowerCase()}">
  <div class="inline-type inline-type-no-content">${inline.t}</div>
  <div class="inline-type inline-type-no-content-folded-only">${
    foldedOnlyString(inline.t)
  }</div>
</div>`;
}

/**
 * Process inline elements
 */
// deno-lint-ignore no-explicit-any
function processInlines(inlines: any[], mode: string): string {
  let html = "";

  for (const inline of inlines) {
    switch (inline.t) {
      case "Str":
        if (mode === "full") {
          html += processStrInline(inline, mode);
        } else {
          html += escapeHtml(inline.c);
        }
        break;
      case "Space":
        if (mode === "full") {
          html += processNoContentInline(inline, mode);
        } else {
          html += " ";
        }
        break;
      case "SoftBreak":
        if (mode === "full") {
          html += processNoContentInline(inline, mode);
        } else {
          html += " ";
        }
        break;
      case "LineBreak":
        if (mode === "full") {
          html += processNoContentInline(inline, mode);
        } else {
          html += "<br>";
        }
        break;
      case "Code":
        if (mode === "inline" || mode === "full") {
          html += processCodeInline(inline, mode);
        } else {
          const [[, codeClasses], codeText] = inline.c;
          html += `<code class="${codeClasses.join(" ")}">${
            escapeHtml(codeText)
          }</code>`;
        }
        break;
      case "RawInline":
        if (mode === "inline" || mode === "full") {
          html += processRawInlineInline(inline, mode);
        } else {
          const [format, content] = inline.c;
          html += `<code class="raw-${format}">${escapeHtml(content)}</code>`;
        }
        break;
      case "Link":
        if (mode === "inline" || mode === "full") {
          html += processLinkInline(inline, mode);
        } else {
          const [[, linkClasses], linkText, [url, title]] = inline.c;
          html += `<a href="${url}" title="${title}" class="${
            linkClasses.join(" ")
          }">${processInlines(linkText, mode)}</a>`;
        }
        break;
      case "Image":
        if (mode === "inline" || mode === "full") {
          html += processImageInline(inline, mode);
        } else {
          const [[imgId, imgClasses, imgAttrs], altText, [url, title]] =
            inline.c;
          // In block mode, represent the image as markdown-like syntax in a code tag
          let imgMarkdown = `![${processInlines(altText, mode)}](${url}`;
          if (title) {
            imgMarkdown += ` "${title}"`;
          }
          imgMarkdown += ")";

          // Add attributes if present
          if (imgId || imgClasses.length > 0 || imgAttrs.length > 0) {
            imgMarkdown += "{";
            if (imgId) {
              imgMarkdown += `#${imgId}`;
            }
            for (const cls of imgClasses) {
              imgMarkdown += ` .${cls}`;
            }
            for (const [k, v] of imgAttrs) {
              imgMarkdown += ` ${k}=${v}`;
            }
            imgMarkdown += "}";
          }

          html += `<code class="image-markdown">${
            escapeHtml(imgMarkdown)
          }</code>`;
        }
        break;
      case "Math":
        if (mode === "inline" || mode === "full") {
          html += processMathInline(inline, mode);
        } else {
          const [mathType, content] = inline.c;
          const type = mathType.t;
          const isDisplay = type === "DisplayMath";

          // In block mode, represent the math as TeX/LaTeX in a code tag
          const delimiter = isDisplay ? "$$" : "$";
          html += `<code class="math-${
            isDisplay ? "display" : "inline"
          }">${delimiter}${escapeHtml(content)}${delimiter}</code>`;
        }
        break;
      case "Quoted":
        if (mode === "inline" || mode === "full") {
          html += processQuotedInline(inline, mode);
        } else {
          const [quoteType, content] = inline.c;
          const type = quoteType.t;
          const isSingle = type === "SingleQuote";

          // In block mode, represent the quoted text with actual quote marks
          const quote = isSingle ? "'" : '"';
          html += `${quote}${processInlines(content, mode)}${quote}`;
        }
        break;
      case "Note":
        // Note is a special inline element that contains block elements
        // We always use processNoteInline regardless of mode to properly visualize its structure
        html += processNoteInline(inline, mode);
        break;
      case "Cite":
        if (mode === "inline" || mode === "full") {
          html += processCiteInline(inline, mode);
        } else {
          // In block mode, just use the text representation
          const [_, text] = inline.c;
          html += processInlines(text, mode);
        }
        break;
      case "Span":
        if (mode === "inline" || mode === "full") {
          html += processSpanInline(inline, mode);
        } else {
          const [[spanId, spanClasses], spanContent] = inline.c;
          const spanClassAttr = spanClasses.length > 0
            ? ` class="${spanClasses.join(" ")}"`
            : "";
          const spanIdAttr = spanId ? ` id="${spanId}"` : "";
          html += `<span${spanIdAttr}${spanClassAttr}>${
            processInlines(spanContent, mode)
          }</span>`;
        }
        break;
      // Simple inline types processed with the generic function
      case "Emph":
      case "Strong":
      case "SmallCaps":
      case "Strikeout":
      case "Subscript":
      case "Superscript":
      case "Underline":
        if (mode === "inline" || mode === "full") {
          html += processSimpleInline(inline, mode);
        } else {
          const tag = inline.t === "Emph"
            ? "em"
            : inline.t === "Strong"
            ? "strong"
            : inline.t === "SmallCaps"
            ? 'span class="small-caps"'
            : inline.t === "Strikeout"
            ? "s"
            : inline.t === "Subscript"
            ? "sub"
            : inline.t === "Superscript"
            ? "sup"
            : inline.t === "Underline"
            ? "u"
            : "span";
          html += `<${tag}>${processInlines(inline.c, mode)}</${
            tag.split(" ")[0]
          }>`;
        }
        break;
      // Add other inline types as needed
      default:
        html += `<div class="inline inline-unknown inline-${inline.t}">
        <div class="inline-type">
          <button class="toggle-button" aria-label="Toggle content">▼</button>
          ${inline.t}
        </div>
        <div class="inline-content">Unknown inline type</div>
      </div>`;
    }
  }

  return html;
}

/**
 * Format node ID, classes, and attributes for display
 */
function formatNodeAttributes(
  id: string,
  classes: string[],
  attrs: [string, string][],
): string {
  let result = "";

  // Add ID if present
  if (id) {
    result += ` <code class="node-id">#${id}</code>`;
  }

  // Add classes if present
  if (classes.length > 0) {
    result += ` <code class="node-classes">${
      classes.map((c) => `.${c}`).join(" ")
    }</code>`;
  }

  // Add attributes if present
  if (attrs.length > 0) {
    result += ` <code class="node-attrs">${
      attrs.map(([k, v]) => `${k}="${v}"`).join(" ")
    }</code>`;
  }

  return result;
}

/**
 * Simple HTML escape function
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
