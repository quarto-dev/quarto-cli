# patch.R
# Copyright (C) 2020 by RStudio, PBC

# only works w/ htmltools >= 0.5.0.9003 so overwrite in the meantime
options(htmltools.preserve.raw = TRUE)

htmlPreserve <- function(x) {
  x <- paste(x, collapse = "\n")
  if (nzchar(x)) {
    # use fenced code block if there are embedded newlines
    if (grepl("\n", x, fixed = TRUE))
      sprintf("\n```{=html}\n%s\n```\n", x)
    # otherwise use inline span
    else
      sprintf("`%s`{=html}", x)
  } else {
    x
  }
}
assignInNamespace("htmlPreserve", htmlPreserve, ns = "htmltools")

# tweak sizing for htmlwidget figures (use 100% to be responsive)
if (requireNamespace("htmlwidgets", quietly = TRUE)) {
  htmlwidgets_resolveSizing = htmlwidgets:::resolveSizing
  resolveSizing <- function(x, sp, standalone, knitrOptions = NULL) {
    # default sizing resolution
    sizing <- htmlwidgets_resolveSizing(x, sp, standalone, knitrOptions)
    
    # if this is a knitr figure then set width to 100% and height
    # to an appropriately proportioned value based on the assumption
    # that the display width will be ~650px
    if (isTRUE(sp$knitr$figure) && is.numeric(sizing$height) && is.numeric(sizing$width)) {
      sizing$height <- paste0(as.integer(sizing$height/sizing$width*650), "px")
      sizing$width <- "100%"
    }
   
    # return sizing
    sizing
  }
  assignInNamespace("resolveSizing", resolveSizing, ns = "htmlwidgets")
}


# override parse_block to assign chunk labels from yaml options
knitr_parse_block <- knitr:::parse_block
parse_block = function(code, header, params.src, markdown_mode = out_format('markdown')) {
  engine = sub('^([a-zA-Z0-9_]+).*$', '\\1', params.src)
  partitioned <- partition_yaml_options(engine, code)
  params = sub('^([a-zA-Z0-9_]+)', '', params.src)
  params <- knitr:::parse_params(params)
  unnamed_label <- knitr::opts_knit$get('unnamed.chunk.label')
  if (startsWith(params$label, unnamed_label)) {
    label <- partitioned$yaml[["label"]] %||% partitioned$yaml[["id"]]
    if (!is.null(label)) {
      params.src <- sub("^[a-zA-Z0-9_]+ *[ ,]?", 
                        paste0(engine, " ", label, ", "), 
                        params.src)
    }
  } 
  
  # strip trailing comma and whitespace
  params.src <- sub("\\s*,?\\s*$", "", params.src)
  
  # look for other options to forward. note that ideally we could extract *all*
  # parameters and then pass partitioned$code below, however we can construct
  # cases where deparsed versions of the options include a newline, which causes
  # an error. we'll wait and see if this capability is incorporated natively
  # into knitr parse_block -- if it's not then we can pursue more robust versions
  # of textual option forwarding that don't run into newlines 
  extra_opts <- list()
  for (opt in c("ref.label")) {
    if (!is.null(partitioned$yaml[[opt]])) {
      extra_opts[[opt]] <- paste(gsub("\n", " ", deparse(partitioned$yaml[[opt]], 
                                                   width.cutoff = 500, 
                                                   nlines = 1), fixed = TRUE), 
                                 collapse = " ") 
    }
  }
  if (length(extra_opts) > 0) {
    extra_opts <- paste(paste0(names(extra_opts), "=", as.character(extra_opts), ", "), 
                        collapse = "")
    params.src <- paste0(params.src, ", ", sub(",\\s*$", "", extra_opts))
  }
  
  # proceed
  knitr_parse_block(code, header, params.src, markdown_mode)
}
assignInNamespace("parse_block", parse_block, ns = "knitr")



# override wrapping behavior for knitr_asis output (including htmlwidgets)
# to provide for enclosing output div and support for figure captions
knitr_wrap <- knitr:::wrap
wrap <- function(x, options = list(), ...) {
  
  if (inherits(x, "knit_image_paths")) {
    knitr:::wrap.knit_image_paths(x, options, ...)
  } else if (inherits(x, "knit_asis")) {
    # delegate
    is_html_widget <- inherits(x, "knit_asis_htmlwidget")
    x <- knitr:::wrap.knit_asis(x, options, ...)

    # if it's an html widget then it was already wrapped
    # by add_html_caption
    if (is_html_widget) {
      x
    } else {
      wrap_asis_output(options, x)
    }
   
  # this used to be completely generic, however R 3.4 wasn't able to
  # dispatch correctly via UseMethod so we do manual binding
  } else if (inherits(x, "character")) {
    knitr:::wrap.character(x, options, ...)
  } else if (inherits(x, "html_screenshot")) {
    knitr:::wrap.html_screenshot(x, options, ...)
  } else if (inherits(x, "knit_embed_url")) {
    knitr:::wrap.knit_embed_url(x, options, ...)
  } else if (inherits(x, "source")) {
    knitr:::wrap.source(x, options, ...)
  } else if (inherits(x, "warning")) {
    knitr:::wrap.warning(x, options, ...)
  } else if (inherits(x, "message")) {
    knitr:::wrap.message(x, options, ...)
  } else if (inherits(x, "error")) {
    knitr:::wrap.error(x, options, ...)
  } else if (inherits(x, "list")) {
    knitr:::wrap.list(x, options, ...)
  } else if (inherits(x, "recordedplot")) {
    knitr:::wrap.recordedplot(x, options, ...)
  } else {
    # this works generically for recent versions of R however
    # not for R < 3.6
    knitr_wrap(x, options, ...)
  }
}
add_html_caption <- function(options, x) {
  if (inherits(x, 'knit_asis_htmlwidget')) {
    wrap_asis_output(options, x)
  } else {
    x
  }
}
wrap_asis_output <- function(options, x) {

  # generate output div
  caption <- figure_cap(options)
  if (nzchar(caption)) {
    x <- paste0(x, "\n\n", caption)
  }
  classes <- paste0("cell-output-display")
  if (isTRUE(options[["output.hidden"]]))
    classes <- paste0(classes, " .hidden")
  output_div(x, output_label_placeholder(options), classes)
}
assignInNamespace("wrap", wrap, ns = "knitr")
assignInNamespace("add_html_caption", add_html_caption, ns = "knitr")


# patch knitr_print.knitr_kable to enclose html output in pandoc RawBlock
knitr_raw_block <- function(x, format) {
  knitr::asis_output(paste0("\n\n```{=", format, "}\n", x, "\n```\n\n"))
}
knitr_kable_html <- knitr:::kable_html
kable_html <- function(...) {
  x <- knitr_kable_html(...)
  knitr_raw_block(x, "html")
}
assignInNamespace("kable_html", kable_html, ns = "knitr")



# patch knitr:::valid_path to remove # prefix and colons from file names
knitr_valid_path <- knitr:::valid_path
valid_path = function(prefix, label) {
  label <- sub("^#", "", label)
  path <- knitr_valid_path(prefix, label)
  gsub(":", "-", path, fixed = TRUE)
}
assignInNamespace("valid_path", valid_path, ns = "knitr")

