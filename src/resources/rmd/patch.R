# patch.R
# Copyright (C) 2020 by RStudio, PBC

# check whether knitr has native yaml chunk option parsing
knitr_has_yaml_chunk_options <- function() {
  packageVersion("knitr") >= "1.34.2"
}

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

# override wrapping behavior for knitr_asis output (including htmlwidgets)
# to provide for enclosing output div and support for figure captions
wrap_asis_output <- function(options, x) {
  # generate output div
  caption <- figure_cap(options)
  if (nzchar(caption)) {
    x <- paste0(x, "\n\n", caption)
  }
  classes <- paste0("cell-output-display")
  if (isTRUE(options[["output.hidden"]]))
    classes <- paste0(classes, " .hidden")
  
  # if this is an html table then wrap it further in ```{=html}
  # (necessary b/c we no longer do this by overriding kable_html,
  # which is in turn necessary to allow kableExtra to parse
  # the return value of kable_html as valid xml)
  if (grepl("^<\\w+[ >]", x) && grepl("<\\/\\w+>\\s*$", x)) {
    x <- paste0("`````{=html}\n", x, "\n`````")
  }
  
  output_div(x, output_label_placeholder(options), classes)
}
add_html_caption <- function(options, x) {
  if (inherits(x, 'knit_asis_htmlwidget')) {
    wrap_asis_output(options, x)
  } else {
    x
  }
}
assignInNamespace("add_html_caption", add_html_caption, ns = "knitr")

# wrap was renamed to sew in 1.32.8. 
if (utils::packageVersion("knitr") >= "1.32.8") {
  knitr_sew <- knitr:::sew
  sew <- function(x, options = list(), ...) {
    
    if (inherits(x, "knit_image_paths")) {
      knitr:::sew.knit_image_paths(x, options, ...)
    } else if (inherits(x, "knit_asis")) {
      # delegate
      is_html_widget <- inherits(x, "knit_asis_htmlwidget")
      x <- knitr:::sew.knit_asis(x, options, ...)

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
      knitr:::sew.character(x, options, ...)
    } else if (inherits(x, "html_screenshot")) {
      knitr:::sew.html_screenshot(x, options, ...)
    } else if (inherits(x, "knit_embed_url")) {
      knitr:::sew.knit_embed_url(x, options, ...)
    } else if (inherits(x, "source")) {
      knitr:::sew.source(x, options, ...)
    } else if (inherits(x, "warning")) {
      knitr:::sew.warning(x, options, ...)
    } else if (inherits(x, "message")) {
      knitr:::sew.message(x, options, ...)
    } else if (inherits(x, "error")) {
      knitr:::sew.error(x, options, ...)
    } else if (inherits(x, "list")) {
      knitr:::sew.list(x, options, ...)
    } else if (inherits(x, "recordedplot")) {
      knitr:::sew.recordedplot(x, options, ...)
    } else {
      # this works generically for recent versions of R however
      # not for R < 3.5
      knitr_sew(x, options, ...)
    }
  }
  assignInNamespace("sew", sew, ns = "knitr")  
} else {
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
      # not for R < 3.5
      knitr_wrap(x, options, ...)
    }
  }
  assignInNamespace("wrap", wrap, ns = "knitr")  
}


# patch knitr_print.knitr_kable to enclose html output in pandoc RawBlock
knitr_raw_block <- function(x, format) {
  knitr::asis_output(paste0("\n\n```{=", format, "}\n", x, "\n```\n\n"))
}
knitr_kable_html <- knitr:::kable_html
kable_html <- function(...) {
  x <- knitr_kable_html(...)
  knitr_raw_block(x, "html")
}

# kableExtra::kable_styling parses/post-processes the output of kable_html
# as xml. e.g. see https://github.com/haozhu233/kableExtra/blob/a6af5c067c2b4ca8317736f4a3e6c0f7db508fef/R/kable_styling.R#L216
# this means that we can't simply inject pandoc RawBlock delimiters into 
# the return value of kable_html, as it will cause the xml parser to fail,
# e.g. see https://github.com/quarto-dev/quarto-cli/issues/75. As a result
# we no longer do this processing (see commented out assignInNamespace below)
# note that we did this mostly for consistency of markdown output (raw HTML
# always marked up correctly). as a practical matter pandoc I believe that
# pandoc will successfully parse the RawBlock into it's AST so we won't lose
# any functionality (e.g. crossref table caption handling)

# assignInNamespace("kable_html", kable_html, ns = "knitr")



# patch knitr:::valid_path to remove # prefix and colons from file names
knitr_valid_path <- knitr:::valid_path
valid_path = function(prefix, label) {
  label <- sub("^#", "", label)
  path <- knitr_valid_path(prefix, label)
  gsub(":", "-", path, fixed = TRUE)
}
assignInNamespace("valid_path", valid_path, ns = "knitr")

