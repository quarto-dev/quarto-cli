# rmarkdown.R
# Copyright (C) 2020 by RStudio, PBC

# main
.main <- function() {

  # execute knitr::spin
  spin <- function(input) {

    # read file
    text <- xfun::read_utf8(input)

    # spin and return
    knitr::spin(text = text, knit = FALSE)

  }

  # dependencies (convert knit_meta to includes)
  dependencies <- function(input, format, output, tempDir, libDir, data, quiet) {
    
    # unserialize knit_meta
    knit_meta <- lapply(data, jsonlite::unserializeJSON)

    # determine files_dir
    files_dir <- if (!is.null(libDir)) libDir else rmarkdown:::knitr_files_dir(output)

    # yield pandoc format
    list(
      includes = pandoc_includes(input, format, output, files_dir, knit_meta, tempDir)
    )
  }

  # postprocess (restore preserved)
  postprocess <- function(input, format, output, preserved_chunks) {

    # check for html output
    isHTML <- knitr::is_html_output(format$pandoc$to)

    # bail if we don't have any perserved chunks and aren't doing code linking
    code_link <- isHTML && isTRUE(format$render$`code-link`)
    if (length(preserved_chunks) == 0 && code_link == FALSE)
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


    # perform code linking if requested
    if (isTRUE(code_link)) {
       if (requireNamespace("downlit", quietly = TRUE) && requireNamespace("xml2", quietly = TRUE)) {
         downlit::downlit_html_path(output, output)
       } else {
         warning("The downlit and xml2 packages are required for code linking")
       }
    }
   
    # restore preserved chunks if requested
    if (length(preserved_chunks) > 0) {
      # convert preserved chunks to named character vector
      names <- names(preserved_chunks)
      preserved_chunks <- as.character(preserved_chunks)
      names(preserved_chunks) <- names

      # read the output file
      output_str <- xfun::read_utf8(output)

      if (isHTML) {
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
  }

  run <- function(input, port, host) {
    shiny_args <- list()
    if (!is.null(port))
      shiny_args$port <- port
    if (!is.null(host))
      shiny_args$host <- host

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
    source(file.path(res_dir, "patch.R"), local = TRUE)
    source(file.path(res_dir, "execute.R"), local = TRUE)
    source(file.path(res_dir, "hooks.R"), local = TRUE)
  }

  # dispatch request
  if (request$action == "spin") {
    result <- spin(params$input)
    result <- paste(result, collapse = '\n')
  } else if (request$action == "execute") {
    result <- execute(params$input, params$format, params$tempDir,  params$libDir, params$dependencies, params$cwd, params$params, params$resourceDir)
  } else if (request$action == "dependencies") {
    result <- dependencies(params$input, params$format, params$output, params$tempDir, params$libDir, params$dependencies, params$quiet)
  } else if (request$action == "postprocess") {
    result <- postprocess(params$input, params$format, params$output, params$preserve)
  } else if (request$action == "run") {
    result <- run(params$input, params$port, params$host)
  }

  # write results
  resultJson <- jsonlite::toJSON(auto_unbox = TRUE, result)
  xfun:::write_utf8(paste(resultJson, collapse = "\n"), request$result)
}

# run main
.main()








