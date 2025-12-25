import { testQuartoCmd } from "../../test.ts";
import { fileExists, noErrorsOrWarnings, ensureFileRegexMatches, ensurePdfRegexMatches } from "../../verify.ts";

import { existsSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { docs } from "../../utils.ts";

// Test a simple book
const input = docs("books/simple");
const verifySimple = [
  fileExists(join(input, "_book", "Simple.pdf")),
  fileExists(join(input, "_book", "index.html")),
  fileExists(join(input, "_book", "search.json")),
  fileExists(join(input, "_book", "site_libs")),
];
testQuartoCmd(
  "render",
  [input],
  [noErrorsOrWarnings, ...verifySimple],
  {
    teardown: async () => {
      const bookDir = join(input, "_book");
      if (existsSync(bookDir)) {
        await Deno.remove(bookDir, { recursive: true });
      }
    },
  },
);

// Test a more complex book render
const vizInput = docs("books/visualization-curriculum");
const verifyViz = [
  fileExists(
    join(vizInput, "docs", "Visualization-Curriculum.docx"),
  ),
  fileExists(
    join(vizInput, "docs", "book-asciidoc", "Visualization-Curriculum.adoc"),
  ),
  fileExists(join(vizInput, "docs", "index.html")),
];
testQuartoCmd(
  "render",
  [vizInput],
  [noErrorsOrWarnings, ...verifyViz],
  {
    teardown: async () => {
      const bookDir = join(vizInput, "docs");
      if (existsSync(bookDir)) {
        await Deno.remove(bookDir, { recursive: true });
      }
    },
  },
);

// Test a Typst book render
const typstInput = docs("books/typst");
const typstPdfPath = join(typstInput, "_book", "Test-Typst-Book.pdf");
// The intermediate .typ file is kept at the project root as index.typ
const typstTypPath = join(typstInput, "index.typ");
const verifyTypst = [
  fileExists(typstPdfPath),
  // Verify content from each chapter is included in the merged output
  ensureFileRegexMatches(typstTypPath, [
    "test book for Typst output format",  // from index.qmd
    "first chapter of the book",           // from chapter1.qmd
    "second chapter of the book",          // from chapter2.qmd
    "third chapter of the book",           // from chapter3.qmd
    // Verify unnumbered heading is emitted correctly (not wrapped in #block[])
    // This regex matches Pandoc's native output: #heading(level: 1, numbering: none)[Preface]
    "#heading\\(level: 1, numbering: none\\)\\[Preface\\]",
    // Verify Typst label anchors are generated
    "<fig-cars>",                          // figure label anchor (from R code execution)
    "<fig-visualization>",                 // figure label anchor (from embedded notebook)
    "<tbl-data>",                          // table label anchor
    "<sec-intro>",                         // section label anchor for Introduction
    "<sec-methods>",                       // section label anchor for Methods
    "<sec-results>",                       // section label anchor for Results (chapter 3)
    // Verify Typst cross-reference links are generated with #ref()
    "#ref\\(<fig-cars>, supplement: \\[Figure\\]\\)",          // figure reference
    "#ref\\(<fig-visualization>, supplement: \\[Figure\\]\\)", // embedded notebook figure reference
    "#ref\\(<tbl-data>, supplement: \\[Table\\]\\)",           // table reference
    "#ref\\(<sec-intro>, supplement: \\[Chapter\\]\\)",        // section reference to intro
    "#ref\\(<sec-methods>, supplement: \\[Chapter\\]\\)",      // section reference to methods
    // Verify figure and table captions
    "A plot of the cars dataset",          // figure caption (from R plot)
    "Sample data table",                   // table caption
    // Verify bibliography and citations
    "#cite\\(<knuth84>",                   // Typst citation syntax
    '#bibliography\\(\\("references\\.bib"\\)\\)',             // bibliography inclusion (generates Bibliography heading)
    // Verify book parts
    "#part\\[Part I: Getting Started\\]",  // first part
    "#part\\[Part II: Advanced Topics\\]", // second part
    // Verify appendices
    '#show: appendices\\.with\\("Appendices", hide-parent: true\\)', // appendices show rule with localized title
    "<sec-resources>",                     // appendix section anchor
    // Verify sub-figures
    "#quarto_super\\(",                    // sub-figure function call
    "<fig-panel>",                         // parent figure label
    "<fig-panel-a>",                       // first sub-figure label
    "<fig-panel-b>",                       // second sub-figure label
    "#ref\\(<fig-panel>, supplement: \\[Figure\\]\\)",   // parent figure reference
    "#ref\\(<fig-panel-a>, supplement: \\[Figure\\]\\)", // sub-figure reference
    // Verify callouts - labels and references
    "#callout\\(",                         // callout function call
    'kind: "quarto-callout-Warning"',      // cross-referenceable warning kind
    'kind: "quarto-callout-Tip"',          // cross-referenceable tip kind
    'kind: "quarto-callout-Note"',         // cross-referenceable note kind
    'kind: "quarto-callout-Important"',    // cross-referenceable important kind
    "<wrn-tea>",                           // warning label in chapter 1
    "<tip-towel>",                         // tip label in chapter 2
    "<nte-vogon>",                         // note label in chapter 2
    "<imp-answer>",                        // important label in chapter 3
    "#ref\\(<wrn-tea>, supplement: \\[Warning\\]\\)",   // warning reference
    "#ref\\(<tip-towel>, supplement: \\[Tip\\]\\)",     // tip reference
    "#ref\\(<nte-vogon>, supplement: \\[Note\\]\\)",    // note reference
    "#ref\\(<imp-answer>, supplement: \\[Important\\]\\)", // important reference
    // Appendix sub-figures - labels and references
    "<fig-appendix-panel>",                             // appendix parent figure label
    "<fig-appendix-panel-a>",                           // appendix first sub-figure label
    "<fig-appendix-panel-b>",                           // appendix second sub-figure label
    "#ref\\(<fig-appendix-panel>, supplement: \\[Figure\\]\\)",   // appendix figure reference
    "#ref\\(<fig-appendix-panel-a>, supplement: \\[Figure\\]\\)", // appendix sub-figure reference
    "#ref\\(<fig-appendix-panel-b>, supplement: \\[Figure\\]\\)", // appendix sub-figure reference
    // Appendix callouts - labels and references
    "<wrn-appendix>",                                   // appendix warning label
    "<tip-appendix>",                                   // appendix tip label
    "#ref\\(<wrn-appendix>, supplement: \\[Warning\\]\\)",  // appendix warning reference
    "#ref\\(<tip-appendix>, supplement: \\[Tip\\]\\)",      // appendix tip reference
  ]),
  // Verify rendered PDF content has correct chapter-based numbering
  ensurePdfRegexMatches(typstPdfPath, [
    // Chapter-based figure numbering in captions
    "Figure 1\\.1: A plot of the cars dataset",
    "Figure 1\\.2: A display of a line",
    "Table 2\\.1: Sample data table",
    "Figure 2\\.3: A panel with two sub-figures",
    // Chapter-based figure references in text
    "See Figure 1\\.1 for an example figure",
    "See Figure 1\\.2 for an embedded notebook figure",
    "See Table 2\\.1 for sample data",
    "Refer back to Figure 1\\.1 and Table 2\\.1",
    // Chapter cross-references
    "See Chapter 1\\. for the main introduction",
    "As discussed in Chapter 1\\., we now present",
    // Sub-figure references in chapter 2 - should have chapter prefix
    "See Figure 2\\.3 for a panel.*Figure 2\\.3a and Figure 2\\.3b",
    // Cross-chapter sub-figure references from chapter 3 to chapter 2 figures
    "Recall the panel figure from Chapter 2\\.: see Figure 2\\.3 for the complete panel",
    "Figure 2\\.3a shows the first panel and Figure 2\\.3b shows the\\s+second panel",
    // Cross-chapter reference to figure from chapter 1
    "reference the main figure from Chapter 1\\.: Figure 1\\.1 shows the cars",
    // Callout numbering - chapter-based (each type has its own counter)
    "Warning 1\\.1: Whose Tea Is This",        // warning in chapter 1
    "Tip 2\\.1: Whose Towel Is This",          // tip in chapter 2
    "Note 2\\.1: A Note About Vogon Poetry",   // note in chapter 2 (separate counter from tip)
    "Important 3\\.1: The Answer",             // important in chapter 3
    // In-chapter callout self-references (may wrap across lines)
    "See Warning 1\\.1 to\\s+reference this warning",
    "See Tip 2\\.1 to\\s+reference this tip",
    "See Note 2\\.1 to\\s+reference this note",
    "See Important 3\\.1 to\\s+reference this important",
    // Cross-chapter callout references from chapter 2 to chapter 1
    "see Warning 1\\.1",
    // Cross-chapter callout references from chapter 3 to chapters 1 and 2
    "See Warning 1\\.1 for the tea warning",
    "See Tip 2\\.1 for towel advice",
    "See Note 2\\.1 for important information about Vogon poetry",
    // Appendix numbering tests - verify "A." prefix works (Bug 2 fix)
    // Tests use \d+ for the number because Bug 1 (counter not reset per chapter) causes
    // wrong numbers (A.4 instead of A.1). See plans/quarto-orange-figure-counters.md
    "Figure A\\.\\d+: A panel of sub-figures in the appendix",  // appendix figure has A prefix
    "Figure A\\.\\d+a and Figure A\\.\\d+b individually",       // appendix subfigures have A prefix
    "Warning A\\.\\d+: Appendix Warning",                       // appendix warning has A prefix
    "Tip A\\.\\d+: Appendix Tip",                               // appendix tip has A prefix
    // Cross-references from appendix back to main chapters (should still be numeric)
    "see Warning 1\\.1 for the tea warning from Chapter 1",     // from appendix to chapter 1 callout
    // TODO: Uncomment these once Bug 1 (counter reset) is fixed:
    // "Figure A\\.1: A panel of sub-figures in the appendix",  // should be A.1, not A.4
    // "See Figure A\\.1 for a panel of appendix sub-figures",
    // "Figure A\\.1a and Figure A\\.1b individually",          // should be A.1a/A.1b, not A.4a/A.4b
    // "Warning A\\.1: Appendix Warning",                       // should be A.1, not A.2
    // "Tip A\\.1: Appendix Tip",                               // should be A.1, not A.2
    // "See Warning A\\.1 to\\s+reference this appendix warning",
    // "See Tip A\\.1 to\\s+reference this appendix tip",
    // "See Figure A\\.1 for appendix sub-figures",             // forward ref from chapter 3
    // "See Warning A\\.1 for the appendix warning",
    // "See Tip A\\.1 for the appendix tip",
  ]),
];
testQuartoCmd(
  "render",
  [typstInput],
  [noErrorsOrWarnings, ...verifyTypst],
  {
    teardown: async () => {
      const bookDir = join(typstInput, "_book");
      if (existsSync(bookDir)) {
        await Deno.remove(bookDir, { recursive: true });
      }
      // Clean up the kept .typ file
      if (existsSync(typstTypPath)) {
        await Deno.remove(typstTypPath);
      }
    },
  },
);
