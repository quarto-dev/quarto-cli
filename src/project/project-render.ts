/*
* project-render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

// (1) which files to render:
// explicit list
// files: [
//   foo.Rmd
// ]
// automatically determined list:
//  engine targetable files *minus* keep-md output *minus* _ prefaced
// executes targets in subdirectories

// (3) how to handle output
//  project implements the following automatically
//   output-dir:
//   output-include:
//   output-exclude:
//   output.html / output_files
//
// for websites, output-include would need to be relative to render dir

// project directory:

// foo/
//   bar.md

// render-dir: document | project | cwd

// - Issue is that for web content relative references are understood to work
//     Even if we run the code in the project root there are now two sets of rules for code assets vs. web assets
//     If we solve this by making everything root relative, you get a lot of fragility around paths
//     Also, you have standalone render vs. project render w/ potentially differnet rules
//     We really want to be relative by default, but provide ways to reference the root

//     QUARTO_PROJECT_DIR (for code that wants to not care about how deep, i.e. not use "../R/utils.R")
//     / (for links, where @ expands to .., etc.)

//     for books, still render chapter by chapter (but just do however many passes for crossrefs)
//     for books, it's a single pandoc render of the book (so xrefs can be resolved book-wide),
//     so in that case we need to prepend the directory offset

// (2) Working directory for execution/pandoc
// Could have a 'render-dir' which sets both? document, project, cwd

//  for project,

// "../R/helpers.R";

// section1
//   chapter4
//     foo.Rmd
//     data.csv

// QUARTO_PROJECT_DIR

// @/
//   images, links, raw html w/ images/links/scripts

// for books, we need to prepend the directory to all of the relative paths

/*
R /
data /
reports /
  forward.Rmd;
  images/foo.pn

*/

// ../../data/records.csv

// [foobar]({{ site.root }}forward.html)

// (note that books would not support render-dir)

export function projectRender(dir: string) {
}
