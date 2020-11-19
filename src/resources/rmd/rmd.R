# rmarkdown.R
#
# Copyright (C) 2020 by RStudio, PBC
#
# Unless you have received this program directly from RStudio pursuant
# to the terms of a commercial license agreement with RStudio, then
# this program is licensed to you under the terms of version 3 of the
# GNU General Public License. This program is distributed WITHOUT
# ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
# MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
# GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.


# main
.main <- function() {

  # execute knitr::spin
  spin <- function(input) {

    # read file
    text <- xfun::read_utf8(input)

    # spin and return
    knitr::spin(text = text, knit = FALSE)

  }

  # postprocess (restore preserved)
  postprocess <- function(input, format, output, preserved_chunks) {

    # bail if we don't have any perserved chunks
    if (length(preserved_chunks) == 0)
      return()

    # change to input dir and make input relative
    oldwd <- setwd(dirname(rmarkdown:::abs_path(input)))
    on.exit(setwd(oldwd), add = TRUE)
    input <- basename(input)

    # apply r-options (if any)
    r_options <- format$metadata$`r-options`
    if (!is.null(r_options)) {
      do.call(options, r_options)
    }

    # convert preserved chunks to named character vector
    names <- names(preserved_chunks)
    preserved_chunks <- as.character(preserved_chunks)
    names(preserved_chunks) <- names

    # read the output file
    output_str <- xfun::read_utf8(output)

    if (knitr::is_html_output(format$pandoc$to)) {
      # Pandoc adds an empty <p></p> around the IDs of preserved chunks, and we
      # need to remove these empty tags, otherwise we may have invalid HTML like
      # <p><div>...</div></p>. For the reason of the second gsub(), see
      # https://github.com/rstudio/rmarkdown/issues/133.
      output_res <- output_str
      for (i in names(preserved_chunks)) {
        output_res <- gsub(paste0("<p>", i, "</p>"), i, output_res,
                           fixed = TRUE, useBytes = TRUE)
        output_res <- gsub(paste0(' id="[^"]*?', i, '[^"]*?" '), ' ', output_res,
                           useBytes = TRUE)
      }
      output_res <- htmltools::restorePreserveChunks(output_res, preserved_chunks)

    } else {

      output_res <- knitr::restore_raw_output(output_str, preserved_chunks)
    }

    # re-write output if necessary
    if (!identical(output_str, output_res))
      xfun::write_utf8(output_res, output)
  }

  latexmk <- function(input, engine, clean, quiet) {

    # use verbose mode (will show package installation messages)
    if (!isTRUE(quiet))
      options(tinytex.verbose = TRUE)

    # change to input dir and make input relative
    oldwd <- setwd(dirname(rmarkdown:::abs_path(input)))
    on.exit(setwd(oldwd), add = TRUE)
    input <- basename(input)

    # build args
    pdf_engine <- engine$pdfEngine
    bib_engine <- ifelse(identical(engine$bibEngine,"biblatex"), "biber", "bibtex")
    engine_args <- if (!is.null(engine$pdfEngineOpts)) engine$pdfEngineOpts

    # call tinytex
    tinytex::latexmk(input, pdf_engine, bib_engine, engine_args, clean = clean)

    # cleanup some files that might be left over by tinytex
    if (clean) {
      for (aux in c("aux", "out", "toc")) {
        file <- rmarkdown:::file_with_ext(input, aux)
        if (file.exists(file))
          unlink(file)
      }

    }
  }

  run <- function(input, port) {
    shiny_args <- list()
    if (!is.null(port))
      shiny_args$port <- port

    # we already ran quarto render before the call to run
    Sys.setenv(RMARKDOWN_RUN_PRERENDER = "0")

    # run the doc
    rmarkdown::run(input, shiny_args = shiny_args)
  }

  # read request from stdin
  stdin <- file("stdin", "r")
  input <- readLines(stdin, warn = FALSE)
  close(stdin)

  # parse request and params
  request <- jsonlite::parse_json(input)
  params <- request$params

  # source in helper functions if we have a resourceDir
  if (!is.null(params$resourceDir)) {
    res_dir <- file.path(params$resourceDir, "rmd")
    source(file.path(res_dir, "execute.R"), local = TRUE)
    source(file.path(res_dir, "hooks.R"), local = TRUE)
  }

  # dispatch request
  if (request$action == "spin") {
    result <- spin(params$input)
  } else if (request$action == "execute") {
    result <- execute(params$target$input, params$format, params$output, params$tempDir, params$cwd, params$params)
  } else if (request$action == "postprocess") {
    result <- postprocess(params$target$input, params$format, params$output, params$preserve)
  } else if (request$action == "latexmk") {
    result <- latexmk(params$input, params$engine, params$clean, params$quiet)
  } else if (request$action == "run") {
    result <- run(params$input, params$port)
  }

  # write results
  resultJson <- jsonlite::toJSON(auto_unbox = TRUE, result)
  xfun:::write_utf8(paste(resultJson, collapse = "\n"), request$result)
}

# run main
.main()








