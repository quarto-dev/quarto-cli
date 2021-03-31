/*
* website-serve.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ProjectServe } from "../project-types.ts";

export const websiteServe: ProjectServe = {};


// for the serve command we render the whole site with freeze: true (or auto?)

// for the serve command we use a custom output dir (.quarto/serve/docs)

// monitor the config files and reload the config if they change

// force a refresh of the current page for config file or config resource file changes

// when we see a request for an output file (.html), do a re-render (with freeze: true) then return the file

// a normal re-render in a separate process should be detected by monitoring the file system
