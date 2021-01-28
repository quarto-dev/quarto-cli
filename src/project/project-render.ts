/*
* project-render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

// what directory to execute computations in
// what directory to run pandoc in

// whichi files to render:
// explicit list
// render: [
//   foo.Rmd
// ]
// automatically determined list:
//  engine targetable files *minus* keep-md output *minus* _ prefaced

// which files to copy to the output_dir
//   auto-exclude: _* .* .Rmd, .R, .py, .csv, .ipynb
//   auto-include: *
//   exclude:
//   include:

// OR

//  separately, there is a website project that implements
//  common features/idioms:  images/css/header/footer/sitemap,etc.

//  if threre is an output-dir, then the project defines:
//   output.html / output_files
//   include:
//     - images
//     - css
//   exclude:
//

export function projectRender(dir: string) {
}
