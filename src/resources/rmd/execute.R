

# execute rmarkdown::render
execute <- function(input, format, output, tempDir, cwd, params) {

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

  # apply r-options (if any)
  r_options <- format$metadata$`r-options`
  if (!is.null(r_options)) {
    do.call(options, r_options)
  }

  # get kntir options
  knitr <- knitr_options(format)

  # fixup options for cache
  knitr <- knitr_options_with_cache(input, format, knitr)

  # This truly awful hack ensures that rmarkdown doesn't tell us we're
  # producing HTML widgets when targeting a non-html format (doing this
  # is triggered by the "prefer-html" options)
  post_knit <- NULL
  if (format$render$`prefer-html`) {
    post_knit <- function(...) {
      render_env <- parent.env(parent.frame())
      render_env$front_matter$always_allow_html <- TRUE
      NULL
    }
  }

  # synthesize rmarkdown output format
  output_format <- rmarkdown::output_format(
    knitr = knitr,
    pandoc = pandoc_options(format),
    post_knit = post_knit,
    keep_md = FALSE,
    clean_supporting = TRUE
  )

  # run knitr but not pandoc and capture the results
  render_params <- list(
    input = input,
    output_format = output_format,
    knit_root_dir = knit_root_dir,
    run_pandoc = FALSE,
    envir = new.env()
  )
  render_output <- rmarkdown::render(
    input = input,
    output_format = output_format,
    knit_root_dir = knit_root_dir,
    params = params,
    run_pandoc = FALSE,
    envir = new.env(parent = globalenv())
  )
  knit_meta <-  attr(render_output, "knit_meta")
  files_dir <- attr(render_output, "files_dir")
  intermediates_dir <- attr(render_output, "intermediates_dir")

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

  # include supporting files
  supporting <- if (!is.null(intermediates_dir) && file_test("-d", intermediates_dir))
    rmarkdown:::abs_path(intermediates_dir)
  else
    character()

  # include postprocessing if required
  if (!is.null(preserved)) {
    preserve <- split(unname(preserved),names(preserved))
    postprocess <- TRUE
  } else {
    preserve <- list()
    postprocess <- FALSE
  }

  # write the includes to temp files
  pandoc <- format_pandoc(includes, tempDir)

  # results
  list(
    supporting = I(supporting),
    pandoc = pandoc,
    preserve = preserve,
    postprocess = postprocess
  )
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
    to = format$pandoc$to,
    from = format$pandoc$from,
    args = c("--to", format$pandoc$to),
    keep_tex = isTRUE(format$render$`keep-tex`)
  )
}

# knitr options for format
knitr_options <- function(format) {

  # may need some knit hooks
  knit_hooks <- list()

  # opt_knit for compatibility w/ rmarkdown::render
  to <- format$pandoc$to
  if (identical(to, "pdf"))
    to <- "latex"
  opts_knit <- list(
    quarto.version = 1,
    rmarkdown.pandoc.from = format$pandoc$from,
    rmarkdown.pandoc.to = to,
    rmarkdown.version = 3,
    rmarkdown.runtime = "static"
  )

  # opts_chunk
  opts_chunk <- list(
    # options derived from format
    fig.width = format$execution$`fig-width`,
    fig.height = format$execution$`fig-height`,
    dev = format$execution$`fig-format`,
    dpi = format$execution$`fig-dpi`,
    eval = format$execution[["execute"]],
    error = format$execution$`allow-errors`,
    echo = isTRUE(format$execution$`show-code`),
    warning = isTRUE(format$execution$`show-warnings`),
    message = isTRUE(format$execution$`show-warnings`),
    include = isTRUE(format$execution$`show-output`),
    # hard coded (overideable in setup chunk but not format)
    comment = NA
  )

  # add screenshot force if prefer-html specified
  if (isTRUE(format$render$`prefer-html`)) {
    opts_chunk$screenshot.force = TRUE
  }


  # add fig.retina if requested
  if (opts_chunk$dev == "retina"){
    opts_chunk$dev <- "png"
    opts_chunk$fig.retina = 2
  }

  # set the dingbats option for the pdf device if required
  if (opts_chunk$dev == 'pdf') {
    opts_chunk$dev.args <- list(pdf = list(useDingbats = FALSE))
    crop <- rmarkdown:::find_program("pdfcrop") != '' && tools::find_gs_cmd() != ''
    if (crop) {
      knit_hooks$crop = knitr::hook_pdfcrop
      opts_chunk$crop = TRUE
    }
  }

  # return options
  knitr <- format$metadata$knitr %||% list()
  hooks <- knitr_hooks(format)
  rmarkdown::knitr_options(
    opts_knit = rmarkdown:::merge_lists(opts_knit, knitr$opts_knit),
    opts_chunk = rmarkdown:::merge_lists(opts_chunk, knitr$opts_chunk),
    opts_hooks = rmarkdown:::merge_lists(knit_hooks, hooks$opts),
    knit_hooks = hooks$knit
  )
}


knitr_options_with_cache <- function(input, format, opts) {
  # handle cache behavior
  cache <- format$execution$`cache`
  if (!is.null(cache)) {
    # remove the cache dir for refresh or false
    if (identical(cache, "refresh")) {
      cache_dir <- knitr_cache_dir(input, format)
      if (rmarkdown:::dir_exists(cache_dir)) {
        unlink(cache_dir, recursive = TRUE)
      }
      cache <- TRUE
    }

    # force the cache on or off as appropriate
    force_cache <- isTRUE(cache)
    opts$opts_chunk$cache <- force_cache
    opts$opts_hooks$cache <- function(options) {
      options$cache <- force_cache
      options
    }
    opts
  }
  opts
}

knitr_cache_dir <- function(input, format) {
  pandoc_to <- format$pandoc$to
  base_pandoc_to <- gsub('[-+].*', '', pandoc_to)
  if (base_pandoc_to == 'html4') base_pandoc_to <- 'html'
  cache_dir <- rmarkdown:::knitr_cache_dir(input, base_pandoc_to)
  cache_dir <- gsub("/$", "", cache_dir)
  cache_dir
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

format_pandoc <- function(includes, tempDir) {
  pandoc <- list()
  write_includes <- function(from, to) {
    content <- includes[[from]]
    if (!is.null(content)) {
      path <- tempfile(tmpdir = tempDir)
      xfun::write_utf8(content, path)
      pandoc[[to]] <<- I(path)
    }
  }
  write_includes("in_header", "include-in-header")
  write_includes("before_body", "include-before-body")
  write_includes("after_body", "include-after-body")
  pandoc
}

# preserve chunks marked w/ e.g. html_preserve
extract_preserve_chunks <- function(output_file, format) {
  if (knitr::is_html_output(format$pandoc$to)) {
    extract <- htmltools::extractPreserveChunks
  } else if (format$pandoc$to == "rtf") {
    extract <- knitr::extract_raw_output
  } else {
    extract <- NULL
  }
  if (!is.null(extract)) {
    rmarkdown:::extract_preserve_chunks(output_file, extract)
  } else {
    NULL
  }
}


# apply patches to output as required
apply_patches <- function(format, includes) {
  if (format$pandoc$to %in% c("slidy", "revealjs"))
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

# utility functions
`%||%` <- function(x, y) {
  if (is.null(x)) y else x
}


