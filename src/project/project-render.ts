/*
* project-render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

// Execution/Paths:

// - Pandoc filter to convert all '/' links and image refs to project relative
//   (may need to process raw HTML for resource references).

//  Output:
//  - Copy everything (doc, doc_files) to output_dir (if specified, could be .)
//  - Auto-detect references to static resources (links, img[src], raw HTML refs including CSS)
//  - Project type can include resource-files patterns (e.g. *.css)
//  - Explicit resource files
//  resource-files: (also at project level)
//    *.css
//    - !secret.css
//    - resume.pdf
//    include:
//    exclude:

//  Websites:
//    - Navigation
//    - sitemap.xml
//    - search

export function projectRender(dir: string) {
}
