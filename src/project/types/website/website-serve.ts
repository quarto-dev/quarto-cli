/*
* website-serve.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ProjectServe } from "../project-types.ts";

export const websiteServe: ProjectServe = {};

// TODO

// libDir is likely broken today with freeze (rename to site-libs)
// md files in projects are currently deleted even if keep-md

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
