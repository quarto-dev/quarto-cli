

# execute knitr::spin
spin <- function(input) {

  # read file
  text <- xfun::read_utf8(input)

  # spin and return
  knitr::spin(text = text, knit = FALSE)

}

# execute rmarkdown::render
execute <- function(input, format, output) {

  #  post_processor for saving metadata and yaml preservation
  runtime <- NULL
  post_processor <- function(metadata, input_file, output_file, clean, verbose) {
    runtime <<- metadata$runtime %||% "static"
    input_lines <- rmarkdown:::read_utf8(input_file)
    partitioned <- rmarkdown:::partition_yaml_front_matter(input_lines)
    if (!is.null(partitioned$front_matter)) {
      output_lines <- c(partitioned$front_matter, "", read_utf8(output_file))
      rmarkdown:::write_utf8(output_lines, output_file)
    }
    output_file
  }

  # create output format

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
  if (knitr:::is_html_output(to)) {
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


  # knitr_options
  knitr <- rmarkdown::knitr_options(
    opts_knit = opts_knit,
    opts_chunk = opts_chunk,
    knit_hooks = knit_hooks
  )

  # note: pandoc_options args is used for various r-specific scenarios:
  #   - https://github.com/rstudio/rmarkdown/pull/1468
  #   - force an id-prefix for runtime: shiny
  # we don't provide them here b/c we manage interaction w/ pandoc not
  # rmarkdown::render. note though that we do pass a --to argument to
  # work around an issue w/ rmarkdown where at least 1 argument
  # must be passed or there is a runtime error

  # pandoc_options
  pandoc <- rmarkdown::pandoc_options(
    to = format$pandoc$writer,
    from = format$pandoc$reader,
    args = c("--to", to),
    keep_tex = FALSE
  )

  # create format
  output_format <- rmarkdown::output_format(
    knitr = knitr,
    pandoc = pandoc,
    post_processor = post_processor,
    keep_md = FALSE,
    clean_supporting = FALSE
  )

  # run knitr but not pandoc
  md_result <- rmarkdown::render(
    input = input,
    output_format = output_format,
    run_pandoc = FALSE
  )

  # rename the markdown file
  file.rename(file.path(dirname(input), md_result), output)

  # get knit_meta and the files_dir
  knit_meta <-  attr(md_result, "knit_meta")
  files_dir <- attr(md_result, "files_dir")

  # get args for extras (e.g. html dependencies)
  extras <- rmarkdown:::html_extras_for_document(
    knit_meta,
    runtime,
    rmarkdown:::html_dependency_resolver,
    list() # format deps
  )
  # convert dependencies to in_header
  dependencies <- extras$dependencies
  if (length(dependencies) > 0) {
    deps <- rmarkdown:::html_dependencies_as_string(dependencies, files_dir, dirname(input))
    extras$dependencies <- NULL
    extras$in_header <- paste0(extras$in_header, "\n", deps)
  }

  # add slides js for html slides
  if (format$pandoc$writer %in% c("s5", "dzslides", "slidy", "slideous", "revealjs")) {
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
    extras$after_body <- paste0(extras$after_body, slides_js)
  }

  # results
  list(
    supporting = I(attr(md_result, "files_dir")),
    includes = extras
  )
}

# utility functions
`%||%` <- function(x, y) {
  if (is.null(x)) y else x
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
    result <- execute(params$input, params$format, params$output)
  }

  # write results
  resultJson <- jsonlite::toJSON(auto_unbox = TRUE, result)
  xfun:::write_utf8(paste(resultJson, collapse = "\n"), request$result)
}

# run main
main()








