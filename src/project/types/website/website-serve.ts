/*
* website-serve.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ProjectServe } from "../project-types.ts";

export const websiteServe: ProjectServe = {};

// TODO

// freeze as currently implemented actually loses dependencies AND potentially doesn't do preserveHTML
// we actually need to save the executeResult (per-format) to implement freeze (filesDir is implicitly part of result,
// in fact, we should packge the executeResult as JSON within the files dir)
// (at that point we won't need the libs dir preserved)

/*
Freezer
   put(foo.md, executeResult)
   get(foo.md, mtime of Rmd) -- re-render and put if get returns null
   cleanup(foo.md)

Normal implementation writes everything side-by-side and doesn't clean up

Preview implementation:
   - writes into the output dir
   - retreives from the output dir
   - removes on cleanup
*/

// kPreview

// execution:
//    kFreeze
//    kPreview - for each file, if the user isn't either keepMd or freeze, then:
//                 - if there is a preview artifact then if it's current then move it into place and
//                   rewire to it unless we are executing a forced render (user interactive render)
//                 - if there is a preview artifact then update it (including copying
//                   supporting files) at the of render
//                 - site-libs is part of this

// separate the concept of keepMd and freeze
// Freezer
//   - add(file)
//   - get(file, mtime)
//   - cleanup(file)

// projects have a 'keepMd' implementation for reading and writing the md file,
// this can be swapped out by e.g. the serve command

// for the serve command we render the whole site with freeze: auto

// for the serve command we use a custom output dir (.quarto/serve/docs)

// monitor the config files and reload the config if they change

// force a refresh of the current page for config file or config resource file chnages

// when we see a request for an output file (.html), do a re-render (with freeze: true) then return the file
