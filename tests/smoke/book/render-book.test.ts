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
    // Custom crossref type (Dinosaur) - labels and references
    'kind: "quarto-float-dino"',                        // custom crossref kind
    "<dino-steg>",                                      // dinosaur 1 in chapter 1
    "<dino-trex>",                                      // dinosaur 2 in chapter 1
    "<dino-raptor>",                                    // dinosaur in chapter 2
    "<dino-ptero>",                                     // dinosaur in chapter 3
    "<dino-appendix>",                                  // dinosaur in appendix A
    "<dino-appendix-b>",                                // dinosaur in appendix B
    "#ref\\(<dino-steg>, supplement: \\[Dinosaur\\]\\)",   // dinosaur reference
    "#ref\\(<dino-raptor>, supplement: \\[Dinosaur\\]\\)", // cross-chapter dinosaur reference
    "#ref\\(<dino-appendix>, supplement: \\[Dinosaur\\]\\)", // appendix A dinosaur reference
    "#ref\\(<dino-appendix-b>, supplement: \\[Dinosaur\\]\\)", // appendix B dinosaur reference
    // Appendix B - labels and references
    "<fig-appendix-b-panel>",                           // appendix B figure label
    "<fig-appendix-b-panel-a>",                         // appendix B sub-figure label
    "<wrn-appendix-b>",                                 // appendix B warning label
    "<tip-appendix-b>",                                 // appendix B tip label
    "#ref\\(<fig-appendix-b-panel>, supplement: \\[Figure\\]\\)", // appendix B figure reference
    "#ref\\(<wrn-appendix-b>, supplement: \\[Warning\\]\\)",      // appendix B warning reference
    // Dynamic counter reset show rule should include custom crossref type
    'counter\\(figure\\.where\\(kind: "quarto-float-dino"\\)\\)\\.update\\(0\\)',
    // Equation labels and references
    "<eq-einstein>",                           // equation label in chapter 1
    "<eq-newton>",                             // equation label in chapter 1
    "<eq-quadratic>",                          // equation label in chapter 2
    "<eq-pythagorean>",                        // equation label in appendix A
    "#ref\\(<eq-einstein>, supplement: \\[Equation\\]\\)",   // equation reference
    "#ref\\(<eq-newton>, supplement: \\[Equation\\]\\)",     // equation reference
    "#ref\\(<eq-quadratic>, supplement: \\[Equation\\]\\)",  // equation reference
    "#ref\\(<eq-pythagorean>, supplement: \\[Equation\\]\\)", // appendix equation reference
    // Equation numbering uses template variable (defined in book-template.typ)
    'math\\.equation\\(block: true, numbering: quarto-equation-numbering',
    // Math equation counter reset at chapter boundaries
    'counter\\(math\\.equation\\)\\.update\\(0\\)',
    // Theorem labels and references (ctheorems package)
    "#import \"@preview/ctheorems:1\\.1\\.3\"",
    "#show: thmrules",
    'thmbox\\("theorem".*\\.\\.quarto-thmbox-args',                 // chapter-based theorem numbering via template variable
    "<thm-pythagorean>",                          // theorem label in chapter 1
    "<lem-triangle>",                             // lemma label in chapter 1
    "<thm-calculus>",                             // theorem label in chapter 2
    "<def-continuous>",                           // definition label in chapter 2
    "<thm-appendix>",                             // theorem label in appendix
    "#ref\\(<thm-pythagorean>",                   // theorem reference
    "#ref\\(<lem-triangle>",                      // lemma reference
    "#ref\\(<thm-calculus>",                      // theorem reference
    "#ref\\(<thm-appendix>",                      // appendix theorem reference
    // Listing labels and references
    "<lst-hello>",                                // listing label in chapter 1
    "<lst-fibonacci>",                            // listing label in chapter 1
    "<lst-quicksort>",                            // listing label in chapter 2
    "<lst-appendix-example>",                     // listing label in appendix
    "#ref\\(<lst-hello>",                         // listing reference
    "#ref\\(<lst-fibonacci>",                     // listing reference
    "#ref\\(<lst-quicksort>",                     // listing reference
    "#ref\\(<lst-appendix-example>",              // appendix listing reference
    'kind: "quarto-float-lst"',                   // listing figure kind
  ]),
  // Verify rendered PDF content has correct chapter-based numbering
  ensurePdfRegexMatches(typstPdfPath, [
    // Chapter-based figure numbering in captions
    "Figure 1\\.1: A plot of the cars dataset",
    "Figure 1\\.2: A display of a line",
    "Table 2\\.1: Sample data table",
    "Figure 2\\.1: A panel with two sub-figures",
    // Chapter-based figure references in text
    "See Figure 1\\.1 for an example figure",
    "See Figure 1\\.2 for an embedded notebook figure",
    "See Table 2\\.1 for sample data",
    "Refer back to Figure 1\\.1 and Table 2\\.1",
    // Chapter cross-references
    "See Chapter 1\\. for the main introduction",
    "As discussed in Chapter 1\\., we now present",
    // Sub-figure references in chapter 2 - should have chapter prefix
    "See Figure 2\\.1 for a panel.*Figure 2\\.1a and Figure 2\\.1b",
    // Cross-chapter sub-figure references from chapter 3 to chapter 2 figures
    "Recall the panel figure from Chapter 2\\.: see Figure 2\\.1 for the complete panel",
    "Figure 2\\.1a shows the first panel and Figure 2\\.1b shows the\\s+second panel",
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
    // Appendix numbering - letter-based chapter prefix with correct counter (A.1)
    "Figure A\\.1: A panel of sub-figures in the appendix",     // appendix figure caption
    "See Figure A\\.1 for a panel of appendix sub-figures",     // self-reference in appendix
    "Figure A\\.1a and Figure A\\.1b individually",             // appendix sub-figure references
    "Warning A\\.1: Appendix Warning",                          // appendix warning caption
    "Tip A\\.1: Appendix Tip",                                  // appendix tip caption
    "See Warning A\\.1 to reference this\\s+appendix warning",  // appendix warning self-reference
    "See Tip A\\.1 to reference this\\s+appendix tip",          // appendix tip self-reference
    // Cross-references from main chapter to appendix content (forward references)
    "See Figure A\\.1 for appendix sub-figures",                // from chapter 3 to appendix figure
    "See Warning A\\.1 for the appendix warning",               // from chapter 3 to appendix warning
    "See Tip A\\.1 for the appendix tip",                       // from chapter 3 to appendix tip
    // Cross-references from appendix back to main chapters (should still be numeric)
    "see Warning 1\\.1 for the tea warning from Chapter 1",     // from appendix to chapter 1 callout
    // Custom crossref type (Dinosaur) - chapter-based numbering with counter reset
    "Dinosaur 1\\.1: This is the first dinosaur",               // first dinosaur in chapter 1
    "Dinosaur 1\\.2: This is the second dinosaur",              // second dinosaur in chapter 1
    "Dinosaur 2\\.1: This dinosaur demonstrates clever",        // first dinosaur in chapter 2 (counter reset!)
    "Dinosaur 3\\.1: This flying reptile",                      // first dinosaur in chapter 3
    "Dinosaur A\\.1: This dinosaur in the appendix",            // first dinosaur in appendix (letter prefix)
    // Custom crossref self-references (hyphenation may break "self-reference" as "selfreference")
    "See Dinosaur 1\\.1\\s+to self",                            // self-ref in chapter 1
    "See Dinosaur 2\\.1 to self",                               // self-ref in chapter 2
    // Cross-chapter custom crossref references (line breaks may occur)
    "see Dinosaur 1\\.1 and Dinosaur 1\\.2 from\\s+Chapter",    // from chapter 2 to chapter 1
    "see Dinosaur 1\\.1 from Chapter 1 and Dinosaur 2\\.1",     // from chapter 3
    // Forward reference from chapter 3 to appendix
    "See Dinosaur A\\.1 for the appendix dinosaur",             // from chapter 3 to appendix
    // Cross-reference from appendix back to main chapter
    "see Dinosaur 1\\.1 from Chapter 1",                        // from appendix to chapter 1
    // Appendix B numbering - should use "B" prefix with counter reset (B.1, not A.2)
    "Figure B\\.1: A panel of sub-figures in Appendix B",       // appendix B figure caption
    "Figure B\\.1a and Figure B\\.1b individually",             // appendix B sub-figure references
    "Warning B\\.1: Appendix B Warning",                        // appendix B warning caption
    "Tip B\\.1: Appendix B Tip",                                // appendix B tip caption
    "Dinosaur B\\.1: This dinosaur in Appendix B",              // appendix B dinosaur caption
    // Self-references within Appendix B
    "See Dinosaur B\\.1 to self",                               // appendix B dinosaur self-ref
    // Forward references from chapter 3 to Appendix B
    "See Figure B\\.1 for Appendix B sub-figures",              // from chapter 3 to appendix B figure
    "See Warning B\\.1 for the Appendix B warning",             // from chapter 3 to appendix B warning
    "See Tip B\\.1 for the Appendix B tip",                     // from chapter 3 to appendix B tip
    "See Dinosaur B\\.1 for the Appendix B dinosaur",           // from chapter 3 to appendix B dinosaur
    // Cross-references from Appendix B to Appendix A
    "see Figure A\\.1 for Appendix A",                          // from appendix B to appendix A
    // Equation numbering - chapter-based with parentheses
    "\\(1\\.1\\)",                                              // first equation in chapter 1
    "\\(1\\.2\\)",                                              // second equation in chapter 1
    "\\(2\\.1\\)",                                              // equation in chapter 2 (counter reset!)
    "\\(A\\.1\\)",                                              // equation in appendix A (letter prefix)
    // Equation references in text
    "As shown in Equation \\(1\\.1\\), energy and mass",        // self-reference in chapter 1
    "Newton.s second law \\(Equation \\(1\\.2\\)\\)",           // self-reference in chapter 1 (. matches Unicode apostrophe)
    "Use Equation \\(2\\.1\\) to solve quadratic equations",    // self-reference in chapter 2
    "See Equation \\(A\\.1\\) for right triangles",             // self-reference in appendix
    // Cross-chapter equation references
    "Recall Equation \\(1\\.1\\) from Chapter 1 and Equation \\(1\\.2\\)", // from chapter 2 to chapter 1
    "Recall Equation \\(1\\.1\\) from Chapter 1 and Equation \\(2\\.1\\)", // from appendix to chapters 1 and 2
    // Theorem numbering - chapter-based (using ctheorems with base:"heading")
    "Theorem 1\\.1.*Pythagorean",                                  // first theorem in chapter 1
    "Lemma 1\\.1.*Triangle Inequality",                            // first lemma in chapter 1 (separate counter)
    "Theorem 2\\.1.*Fundamental Theorem",                          // first theorem in chapter 2 (counter reset!)
    "Definition 2\\.1.*Continuous",                                // first definition in chapter 2
    // Theorem references in text
    "See Theorem 1\\.1 for the classic result",                    // self-reference in chapter 1
    "See Lemma 1\\.1 for the inequality",                          // lemma self-reference in chapter 1
    "See Theorem 2\\.1",                                           // self-reference in chapter 2
    "See Definition 2\\.1 for the definition",                     // definition self-reference
    // Cross-chapter theorem references
    "Recall Theorem 1\\.1 and Lemma 1\\.1 from Chapter 1",         // from chapter 2 to chapter 1
    // TODO: Appendix theorem numbering - ctheorems shows "Theorem 1.1" instead of "Theorem A.1"
    // because it reads the raw heading counter (reset by orange-book) without the letter prefix
    // transformation. This creates confusion since Chapter 1 also has "Theorem 1.1".
    // To fix: implement custom theorem environments without ctheorems, using appendix-state
    // check like equations/callouts do. Uncomment these when fixed:
    // "Theorem\\s+A\\.1.*Example Appendix Theorem",               // appendix theorem should be A.1
    // "See Theorem\\s+A\\.1 for the appendix theorem",            // appendix theorem self-reference
    // Listing numbering - chapter-based (provided by orange-book's global figure numbering)
    "Listing 1\\.1.*Hello World",                                  // first listing in chapter 1
    "Listing 1\\.2.*Fibonacci",                                    // second listing in chapter 1
    "Listing 2\\.1.*Quicksort",                                    // first listing in chapter 2 (counter reset!)
    "Listing A\\.1.*Appendix Code Example",                        // first listing in appendix (letter prefix!)
    // Listing references in text
    "See Listing 1\\.1 for a simple Python example",               // self-reference in chapter 1
    "Listing 1\\.2.*uses recursion",                               // self-reference in chapter 1
    "See Listing 2\\.1 for an efficient sorting algorithm",        // self-reference in chapter 2
    "See Listing A\\.1 for an appendix code example",              // appendix listing self-reference
    // Cross-chapter listing references
    "See Listing 1\\.1 and Listing 1\\.2 from Chapter 1",          // from chapter 2 to chapter 1
    "See Listing 1\\.1 from Chapter 1 and Listing 2\\.1 from Chapter 2", // from appendix to chapters
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
