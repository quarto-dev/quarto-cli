

# execute knitr::spin
spin <- function(input) {

  # read file
  text <- xfun::read_utf8(input)

  # spin and return
  knitr::spin(text = text, knit = FALSE)

}

# execute rmarkdown::render
execute <- function(input, format, output, cwd, params) {

  # calculate knit_root_dir (before we setwd below)
  knit_root_dir <- if (!is.null(cwd)) tools::file_path_as_absolute(cwd) else NULL

  # calcluate absolute path to output (before we setwd below)
  output_dir <- tools::file_path_as_absolute(dirname(output))
  output <- file.path(output_dir, basename(output))

  # change to input dir and make input relative (matches
  # behavior/expectations of rmarkdown::render code)
  oldwd <- setwd(dirname(rmarkdown:::abs_path(input)))
  on.exit(setwd(oldwd), add = TRUE)
  input <- basename(input)

  # synthesize rmarkdown output format
  output_format <- rmarkdown::output_format(
    knitr = knitr_options(format),
    pandoc = pandoc_options(format),
    keep_md = FALSE,
    clean_supporting = FALSE
  )

  # run knitr but not pandoc and capture the results
  render_output <- rmarkdown::render(
    input = input,
    output_format = output_format,
    knit_root_dir = knit_root_dir,
    params = params,
    run_pandoc = FALSE,
    envir = new.env()
  )
  knit_meta <-  attr(render_output, "knit_meta")
  files_dir <- attr(render_output, "files_dir")

  # preserve chunks as necessary
  output_file <- file.path(dirname(input), render_output)
  preserved <- extract_preserve_chunks(output_file, format)

  # rename the markdown file to the requested output file
  file.rename(output_file, output)

  # get dependencies from render
  dependencies <- dependencies_from_render(input, files_dir, knit_meta)

  # embed shiny_prerendered dependencies
  if (!is.null(dependencies$shiny)) {
    rmarkdown:::shiny_prerendered_append_dependencies(
      output,
      dependencies$shiny,
      files_dir,
      dirname(input))
  }

  # apply any required patches
  includes <- apply_patches(format, dependencies$includes)

  # include supportring files
  supporting <- if (file_test("-d", files_dir))
    rmarkdown:::abs_path(files_dir)
  else
    character()

  # results
  list(
    supporting = I(supporting),
    includes = includes,
    postprocess = split(unname(preserved),names(preserved))
  )
}

# postprocess (restore preserved)
postprocess <- function(input, format, output, preserved_chunks) {

  # change to input dir and make input relative
  oldwd <- setwd(dirname(rmarkdown:::abs_path(input)))
  on.exit(setwd(oldwd), add = TRUE)
  input <- basename(input)

  # if there are no preserved chunks to restore then no post-processing is necessary
  if (length(preserved_chunks) == 0)
    return(output)

  # convert preserved chunks to named character vector
  names <- names(preserved_chunks)
  preserved_chunks <- as.character(preserved_chunks)
  names(preserved_chunks) <- names

  # read the output file
  output_str <- xfun::read_utf8(output)

  if (knitr::is_html_output(format$pandoc$writer)) {
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

  if (!identical(output_str, output_res))
    xfun::write_utf8(output_res, output)
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


pandoc_options <- function(format) {
  # note: pandoc_options args is used for various r-specific scenarios:
  #   - https://github.com/rstudio/rmarkdown/pull/1468
  #   - force an id-prefix for runtime: shiny
  # we don't provide them here b/c we manage interaction w/ pandoc not
  # rmarkdown::render. note though that we do pass a --to argument to
  # work around an issue w/ rmarkdown where at least 1 argument
  # must be passed or there is a runtime error
  rmarkdown::pandoc_options(
    to = format$pandoc$writer,
    from = format$pandoc$reader,
    args = c("--to", format$pandoc$writer),
    keep_tex = FALSE
  )
}

# knitr options for format
knitr_options <- function(format) {

  # may need some knit hooks
  knit_hooks <- list()

  # opt_knit for compatibility w/ rmarkdown::render
  to <- format$pandoc$writer
  if (identical(to, "pdf"))
    to <- "latex"
  opts_knit <- list(
    quarto.version = 1,
    rmarkdown.pandoc.from = format$pandoc$reader,
    rmarkdown.pandoc.to = to,
    rmarkdown.version = 3,
    rmarkdown.runtime = "static"
  )

  # opts_chunk
  opts_chunk <- list(
    # options derived from format
    dev = format$figure$format,
    fig.width = format$figure$width,
    fig.height = format$figure$height,
    dpi = format$figure$dpi,
    echo = format$show$code,
    warning = format$show$warning,
    message = format$show$warning,
    error = format$show$error,
    # hard coded (overideable in setup chunk but not format)
    comment = NA
  )

  # add fig.retina if it's an html based format (if we add this for PDF
  # it forces the use of \includegraphics)
  if (knitr:::is_html_output(format$pandoc$writer)) {
    opts_chunk$fig.retina = 2
  }

  # set the dingbats option for the pdf device if required
  if (opts_chunk$dev == 'pdf')
    opts_chunk$dev.args <- list(pdf = list(useDingbats = FALSE))

  # apply cropping if requested and we have pdfcrop and ghostscript
  if (identical(format$output$ext, "pdf")) {
    crop <- rmarkdown:::find_program("pdfcrop") != '' && tools::find_gs_cmd() != ''
    if (crop) {
      knit_hooks$crop = knitr::hook_pdfcrop
      opts_chunk$crop = TRUE
    }
  }

  # return options
  rmarkdown::knitr_options(
    opts_knit = opts_knit,
    opts_chunk = opts_chunk,
    knit_hooks = knit_hooks
  )
}

# get dependencies implied by the result of render (e.g. html dependencies)
dependencies_from_render <-function(input, files_dir, knit_meta) {

  # check for runtime
  front_matter <- rmarkdown::yaml_front_matter(input)
  runtime <- front_matter$runtime
  if (is.null(runtime))
    runtime <- "static"

  # dependencies to return
  dependencies <- list()

  # determine dependency resolver (special resolver for shiny_prerendered)
  resolver <- rmarkdown:::html_dependency_resolver
  if (rmarkdown:::is_shiny_prerendered(runtime)) {
    resolver <- function(deps) {
      dependencies$shiny <<- list(
        deps = deps,
        packages =  rmarkdown:::get_loaded_packages()
      )
      list()
    }
  }

  # get extras (e.g. html dependencies)
  extras <- rmarkdown:::html_extras_for_document(
    knit_meta,
    runtime,
    resolver,
    list() # format deps
  )
  # convert dependencies to in_header includes
  dependencies$includes <- list()
  if (length(extras$dependencies) > 0) {
    deps <- rmarkdown:::html_dependencies_as_string(extras$dependencies, files_dir, dirname(input))
    dependencies$includes$in_header <- deps
  }

  # return dependencies
  dependencies

}

# apply patches to output as required
apply_patches <- function(format, includes) {
  if (format$pandoc$writer %in% c("slidy", "revealjs"))
    includes <- apply_slides_patch(includes)
  includes
}

# patch to ensure that htmlwidgets size correctly when slide changes
apply_slides_patch <- function(includes) {

  slides_js <- '
<script>
  // htmlwidgets need to know to resize themselves when slides are shown/hidden.
  // Fire the "slideenter" event (handled by htmlwidgets.js) when the current
  // slide changes (different for each slide format).
  (function () {
    function fireSlideChanged(previousSlide, currentSlide) {

      // dispatch for htmlwidgets
      const event = window.document.createEvent("Event");
      event.initEvent("slideenter", true, true);
      window.document.dispatchEvent(event);

      // dispatch for shiny
      if (window.jQuery) {
        if (previousSlide) {
          window.jQuery(previousSlide).trigger("hidden");
        }
        if (currentSlide) {
          window.jQuery(currentSlide).trigger("shown");
        }
      }
    }

    // hookup for reveal
    if (window.Reveal) {
      window.Reveal.addEventListener("slidechanged", function(event) {
        fireSlideChanged(event.previousSlide, event.currentSlide);
      });
    }

    // hookup for slidy
    if (window.w3c_slidy) {
      window.w3c_slidy.add_observer(function (slide_num) {
        // slide_num starts at position 1
        fireSlideChanged(null, w3c_slidy.slides[slide_num - 1]);
      });
    }

  })();
</script>
'
  includes$after_body <- paste0(includes$after_body, slides_js)
  includes
}

# preserve chunks marked w/ e.g. html_preserve
extract_preserve_chunks <- function(output_file, format) {
  if (knitr::is_html_output(format$pandoc$writer)) {
    extract <- htmltools::extractPreserveChunks
  } else {
    extract <- knitr::extract_raw_output
  }
  rmarkdown:::extract_preserve_chunks(output_file, extract)
}


# main
main <- function() {
  # read request from stdin
  stdin <- file("stdin", "r")
  input <- readLines(stdin, warn = FALSE)
  close(stdin)

  # parse request and params
  request <- jsonlite::parse_json(input)
  params <- request$params

  # dispatch request
  if (request$action == "spin") {
    result <- spin(params$input)
  } else if (request$action == "execute") {
    result <- execute(params$input, params$format, params$output, params$cwd, params$params)
  } else if (request$action == "postprocess") {
    result <- postprocess(params$input, params$format, params$output, params$data)
  } else if (request$action == "run") {
    result <- run(params$input, params$port)
  }

  # write results
  resultJson <- jsonlite::toJSON(auto_unbox = TRUE, result)
  xfun:::write_utf8(paste(resultJson, collapse = "\n"), request$result)
}

# run main
main()








