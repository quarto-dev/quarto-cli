# execute.R
# Copyright (C) 2020-2022 Posit Software, PBC

# quarto_process_inline_uuid: uuid_5b6f6da5_61c6_4cec_a0e0_0cdeaa1cb2b8
# we replace - with _ so that it's a valid R identifier without
# requiring backticks (because we'll use it in inline code that is itself wrapped in backticks)

# execute rmarkdown::render
execute <- function(input, format, tempDir, libDir, dependencies, cwd, params, resourceDir, handledLanguages, markdown) {

  # calculate knit_root_dir (before we setwd below)
  knit_root_dir <- if (!is.null(cwd)) tools::file_path_as_absolute(cwd) else NULL

  # change to input dir and make input relative (matches
  # behavior/expectations of rmarkdown::render code)
  oldwd <- setwd(dirname(rmarkdown:::abs_path(input)))
  on.exit(setwd(oldwd), add = TRUE)
  input <- basename(input)

  # rmd input filename
  rmd_input <- paste0(xfun::sans_ext(input), ".rmarkdown")
      
  # swap out the input by reading then writing content.
  # This handles `\r\n` EOL on windows in `markdown` string
  # by spliting in lines
  xfun::write_utf8(
    xfun::read_utf8(textConnection(markdown, encoding = "UTF-8")),
    rmd_input
  )
  input <- rmd_input
      
  # remove the rmd input on exit
  rmd_input_path <- rmarkdown:::abs_path(rmd_input)
  on.exit(unlink(rmd_input_path), add = TRUE)

  # give the input an .Rmd extension if it doesn't already have one
  # (this is a temporary copy which we'll remove before exiting). note
  # that we only need to do this for older versions of rmarkdown
  #if (utils::packageVersion("rmarkdown") < "2.9.4") {
  #  if (!tolower(xfun::file_ext(input)) %in% c("r", "rmd", "rmarkdown")) {
  #    # rmd input filename
  #    rmd_input <- paste0(xfun::sans_ext(input), ".Rmd")
  #    
  #    # swap out the input
  #    write(markdown, rmd_input)
  #    input <- rmd_input
  #    
  #    # remove the rmd input on exit
  #    rmd_input_path <- rmarkdown:::abs_path(rmd_input)
  #    on.exit(unlink(rmd_input_path))
  #  }
  #}
  
  # pass through ojs chunks
  knitr::knit_engines$set(ojs = function(options) {
    knitr:::one_string(c(
      "```{ojs}",
      options$code,
      "```"
    ))
  })

  # pass through all languages handled by cell handlers in quarto
  langs = lapply(
    setNames(handledLanguages, handledLanguages),
    function(lang) {
      function(options) {
        knitr:::one_string(c(
          paste0("```{", lang, "}"),
          options$yaml.code,
          options$code,
          "```"
        ))
      }
    }
  )
  knitr::knit_engines$set(langs)

  # apply r-options (if any)
  r_options <- format$metadata$`r-options`
  if (!is.null(r_options)) {
    do.call(options, r_options)
  }

  # get kntir options
  knitr <- knitr_options(format, resourceDir, handledLanguages)

  # fixup options for cache
  knitr <- knitr_options_with_cache(input, format, knitr)

  # Apply patches to current R environments (like modifying function in packages' namespace)
  apply_responsive_patch(format)

  post_knit <- function(...) {
    # provide ojs integration for shiny prerendered
    if (is_shiny_prerendered(knitr::opts_knit$get("rmarkdown.runtime"))) {
      code <- readLines(file.path(resourceDir, "rmd", "ojs.R"))
      rmarkdown::shiny_prerendered_chunk("server-extras", code, TRUE)
    }
    
    # This truly awful hack ensures that rmarkdown doesn't tell us we're
    # producing HTML widgets when targeting a non-html format (doing this
    # is triggered by the "prefer-html" options)
    if (format$render$`prefer-html`) {
      render_env <- parent.env(parent.frame())
      render_env$front_matter$always_allow_html <- TRUE
    }
    
    # return no new pandoc args
    NULL
  }

  # determine df_print
  df_print <- format$execute$`df-print`
  if (df_print == "paged" && !is_pandoc_html_format(format) && !format$render$`prefer-html`) {
    df_print <- "kable"
  }

  # synthesize rmarkdown output format
  output_format <- rmarkdown::output_format(
    knitr = knitr,
    pandoc = pandoc_options(format),
    post_knit = post_knit,
    keep_md = FALSE,
    clean_supporting = TRUE,
    df_print = df_print
  )

  # we need ojs only if markdown has ojs code cells
  # inspect code cells for spaces after line breaks

  needs_ojs <- grepl("(\n|^)[[:space:]]*```+\\{ojs[^}]*\\}", markdown)
  # FIXME this test isn't failing in shiny mode, but it doesn't look to be
  # breaking quarto-shiny-ojs. We should make sure this is right.
  if (
    !is_shiny_prerendered(knitr::opts_knit$get("rmarkdown.runtime")) &&
      needs_ojs
  ) {
    local({
      # create a hidden environment to store specific objects
      .quarto_tools_env <- attach(NULL, name = "tools:quarto")
      # source ojs_define() function and save it in the tools environment
      source(file.path(resourceDir, "rmd", "ojs_static.R"), local = TRUE)
      assign("ojs_define", ojs_define, envir = .quarto_tools_env)
    })
  }

  env <- globalenv()
  env$.QuartoInlineRender <- function(v) {
    if (is.null(v)) {
      "NULL"
    } else if (inherits(v, "AsIs")) {
      v
    } else if (is.character(v)) {
      gsub(pattern="(\\[|\\]|[`*_{}()>#+-.!])", x=v, replacement="\\\\\\1")
    } else {
      v
    }
  }

  render_output <- rmarkdown::render(
    input = input,
    output_format = output_format,
    knit_root_dir = knit_root_dir,
    params = params,
    run_pandoc = FALSE,
    envir = env
  )
  knit_meta <-  attr(render_output, "knit_meta")
  files_dir <- attr(render_output, "files_dir")
  intermediates_dir <- attr(render_output, "intermediates_dir")

  # preserve chunks as necessary
  output_file <- file.path(dirname(input), render_output)
  preserved <- extract_preserve_chunks(output_file, format)

  # include supporting files
  supporting <- if (!is.null(intermediates_dir) && file_test("-d", intermediates_dir))
    rmarkdown:::abs_path(intermediates_dir)
  else
    character()

  # ammend knit_meta with paged table if df_print == "paged"
  if (df_print == "paged") {
    knit_meta <- append(knit_meta, list(rmarkdown::html_dependency_pagedtable()))
  }

  # see if we are going to resolve knit_meta now or later 
  if (dependencies) {
    engineDependencies <- NULL
    includes <- pandoc_includes(
      input, 
      format,
      output_file, 
      ifelse(!is.null(libDir), libDir, files_dir), 
      knit_meta, 
      tempDir
    )
  } else {
    includes <- NULL
    engineDependencies = list(knitr = I(list(jsonlite::serializeJSON(knit_meta))))
  }

  # include postprocessing if required
  if (!is.null(preserved)) {
    preserve <- split(unname(preserved),names(preserved))
  } else {
    preserve <- NA
  }
  postProcess <- !identical(preserve, NA) || isTRUE(format$render$`code-link`)

  # read and then delete the rendered output file
  markdown <- xfun::read_utf8(output_file)
  unlink(output_file)

  # results
  list(
    markdown = paste(markdown, collapse="\n"),
    supporting = I(supporting),
    filters = I("rmarkdown/pagebreak.lua"),
    includes = includes,
    engineDependencies = engineDependencies,
    preserve = preserve,
    postProcess = postProcess
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
knitr_options <- function(format, resourceDir, handledLanguages) {

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
    fig.width = format$execute$`fig-width`,
    fig.height = format$execute$`fig-height`,
    fig.asp = format$execute$`fig-asp`,
    dev = format$execute$`fig-format`,
    dpi = format$execute$`fig-dpi`,
    eval = format$execute[["eval"]],
    error = format$execute[["error"]],
    echo = !isFALSE(format$execute[["echo"]]),
    fenced.echo = identical(format$execute[["echo"]], "fenced"),
    warning = isTRUE(format$execute[["warning"]]),
    message = isTRUE(format$execute[["warning"]]),
    include = isTRUE(format$execute[["include"]]),
    comment = NA
  )

  # forward output: false option to results, fig.show, warning, and message
  if (isFALSE(format$execute[["output"]])) {
    opts_chunk$results <- "hide"
    opts_chunk$fig.show <- "hide"
    opts_chunk$warning <- FALSE
    opts_chunk$message <- FALSE
  } else if (identical(format$execute[["output"]], "asis")) {
    opts_chunk$results <- "asis"
  }


  # add screenshot force if prefer-html specified
  if (isTRUE(format$render$`prefer-html`)) {
    opts_chunk$screenshot.force <- FALSE
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

  # instruct flextable to not use shadow dom until Deno Dom supports the
  # <template> tag (see https://github.com/davidgohel/flextable/issues/385)
  opts_chunk$ft.shadow <- FALSE

  # return options
  knitr <- list()
  if (is.list(format$metadata$knitr)) {
    knitr <- format$metadata$knitr
  }
  hooks <- knitr_hooks(format, resourceDir, handledLanguages)
  rmarkdown::knitr_options(
    opts_knit = rmarkdown:::merge_lists(opts_knit, knitr$opts_knit),
    opts_chunk = rmarkdown:::merge_lists(opts_chunk, knitr$opts_chunk),
    opts_hooks = hooks$opts,
    knit_hooks = rmarkdown:::merge_lists(knit_hooks, hooks$knit)
  )
}


knitr_options_with_cache <- function(input, format, opts) {
  # handle cache behavior
  cache <- format$execute$`cache`
  if (!is.null(cache)) {
    # remove the cache dir for refresh or false
    if (identical(cache, "refresh")) {
      cache_dir <- knitr_cache_dir(input, format)
      if (rmarkdown:::dir_exists(cache_dir)) {
        unlink(cache_dir, recursive = TRUE)
      }
      cache <- TRUE
    }
 
    # set the glocal cache option
    opts$opts_chunk$cache <- isTRUE(cache)

    # if cache is FALSE then force all the chunks to FALSE
    if (identical(cache, FALSE)) {
      opts$opts_hooks$cache <- function(options) {
        options$cache <- FALSE
        options
      }
    }
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

# produce pandoc format (e.g. includes from knit_meta)
pandoc_includes <- function(input, format, output, files_dir, knit_meta, tempDir) {

  # get dependencies from render 
  dependencies <- dependencies_from_render(input, files_dir, knit_meta, format)

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

  # write the includes to temp files
  create_pandoc_includes(includes, tempDir)
}

# get dependencies implied by the result of render (e.g. html dependencies)
dependencies_from_render <- function(input, files_dir, knit_meta, format) {

  # check for runtime
  front_matter <- rmarkdown::yaml_front_matter(input)
  runtime <- front_matter$runtime
  server <- front_matter[["server"]]
  if (is.null(runtime)) {
    if (is_shiny_prerendered(runtime, server)) {
      runtime <- "shinyrmd"
    } else {
      runtime <- "static"
    }
  }

  # dependencies to return
  dependencies <- list()

  # determine dependency resolver (special resolver for shiny_prerendered)
  resolver <- rmarkdown:::html_dependency_resolver
  if (is_shiny_prerendered(runtime, server)) {
    resolver <- function(deps) {
      dependencies$shiny <<- list(
        deps = deps,
        packages =  rmarkdown:::get_loaded_packages()
      )
      list()
    }
  }

  # convert dependencies to in_header includes
  dependencies$includes <- list()

  if (is_pandoc_html_format(format) || format$render$`prefer-html`) {
    # get extras (e.g. html dependencies)
    # only include these html extras if we're targeting a format that
    # supports html (widgets) like this or that prefers html (e.g. Hugo)
    extras <- rmarkdown:::html_extras_for_document(
      knit_meta,
      runtime,
      resolver,
      list() # format deps
    )

    # filter out bootstrap
    extras$dependencies <- Filter(
      function(dependency) dependency$name != "bootstrap",
      extras$dependencies
    )


    if (length(extras$dependencies) > 0) {
      deps <- html_dependencies_as_string(extras$dependencies, files_dir)
      dependencies$includes$in_header <- deps
    }

    # extract static ojs definitions for HTML only (not prefer-html)
    if (is_pandoc_html_format(format)) {
      ojs_defines <- rmarkdown:::flatten_dependencies(
        knit_meta, function(dep) inherits(dep, "ojs-define")
      )
      ojs_define_str <- knitr:::one_string(unlist(ojs_defines))
      if (ojs_define_str != "") {
        dependencies$includes$in_header <- knitr:::one_string(c(dependencies$includes$in_header, ojs_define_str))
      }
    }
  } else if (
    is_latex_output(format$pandoc$to) &&
    rmarkdown:::has_latex_dependencies(knit_meta)
  ) {
    latex_dependencies <- rmarkdown:::flatten_latex_dependencies(knit_meta)
    dependencies$includes$in_header <- rmarkdown:::latex_dependencies_as_string(latex_dependencies)
  }

  # return dependencies
  dependencies

}

# return the html dependencies as an HTML string suitable for inclusion
# in the head of a document
html_dependencies_as_string <- function(dependencies, files_dir) {
  if (!rmarkdown:::dir_exists(files_dir)) {
    dir.create(files_dir, showWarnings = FALSE, recursive = TRUE)
  }
  dependencies <- lapply(dependencies, htmltools::copyDependencyToDir, files_dir)
  dependencies <- lapply(dependencies, function(dependency) {
    dir <- dependency$src$file
    if (!is.null(dir)) {
      dependency$src$file <- gsub("\\\\", "/", paste(files_dir, basename(dir), sep = "/"))
    }
    dependency
  })
  return(htmltools::renderDependencies(dependencies, "file", encodeFunc = identity))
}

is_shiny_prerendered <- function(runtime, server = NULL) {
  if (identical(runtime, "shinyrmd") || identical(runtime, "shiny_prerendered")) {
    TRUE
  } else if (identical(server, "shiny")) {
    TRUE
  } else if (is.list(server) && identical(server[["type"]], "shiny")) {
    TRUE
  } else {
    FALSE
  }
}

create_pandoc_includes <- function(includes, tempDir) {
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
  if (is_pandoc_html_format(format)) {
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

is_pandoc_html_format <- function(format) {
  knitr::is_html_output(format$pandoc$to, c("markdown", "epub", "gfm", "commonmark", "commonmark_x", "markua"))
}

is_latex_output <- function(to) {
  knitr:::is_latex_output() || identical(to, "pdf")
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
    // dispatch for htmlwidgets
    function fireSlideEnter() {
      const event = window.document.createEvent("Event");
      event.initEvent("slideenter", true, true);
      window.document.dispatchEvent(event);
    }

    function fireSlideChanged(previousSlide, currentSlide) {
      fireSlideEnter();

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


apply_responsive_patch <- function(format) {
  if (isTRUE(format$metadata[["fig-responsive"]])) {

    # tweak sizing for htmlwidget figures (use 100% to be responsive)
    if (requireNamespace("htmlwidgets", quietly = TRUE)) {
      htmlwidgets_resolveSizing <- htmlwidgets:::resolveSizing 
      resolveSizing <- function(x, sp, standalone, knitrOptions = NULL) {
          # default sizing resolution
          sizing <- htmlwidgets_resolveSizing(x, sp, standalone, knitrOptions)
            
          # if this is a knitr figure then set width to 100% and height
          # to an appropriately proportioned value based on the assumption
          # that the display width will be ~650px
          if (isTRUE(sp$knitr$figure) && is.numeric(sizing$height) && is.numeric(sizing$width)) {
            sizing$height <- paste0(as.integer(sizing$height / sizing$width * 650), "px")
            sizing$width <- "100%"
          }
          
          # return sizing
          sizing
        }

      assignInNamespace("resolveSizing", resolveSizing, ns = "htmlwidgets")
    }
  }
}

# utility functions
`%||%` <- function(x, y) {
  if (is.null(x)) y else x
}


