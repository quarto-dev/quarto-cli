/*
* project-render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

// (1) which files to render:
// explicit list
// render: [
//   foo.Rmd
// ]
// automatically determined list:
//  engine targetable files *minus* keep-md output *minus* _ prefaced
// executes targets in subdirectories

// (2) Working directory for execution/pandoc
// Could have a 'render-dir' which sets both? file, cwd, project
// (note that books would not support render-dir)

// (3) how to handle output
//  project implements the following automatically
//   output-dir:
//   output-include:
//   output-exclude:
//   output.html / output_files
//

//  separately, there is a website project that implements
//  common features/idioms:  images/css/header/footer/sitemap,etc.
//  perhaps yaml nav that yields html nav?

export function projectRender(dir: string) {
}
