

# use pandoc raw attribute rather than <!-- html_preserve -->
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


# override wrapping behavior for knitr_asis output (including htmlwidgets)
# to provide for enclosing output div and support for figure captions
knitr_wrap <- knitr:::wrap
wrap <- function(x, options = list(), ...) {
  if (inherits(x, "knit_asis")) {

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
  } else {
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
  classes <- "display_data"
  if (isTRUE(options[["output.hidden"]]))
    classes <- paste0(classes, " .hidden")
  output_div(x, output_label_placeholder(options), classes)
}
assignInNamespace("wrap", wrap, ns = "knitr")
assignInNamespace("add_html_caption", add_html_caption, ns = "knitr")


# patch knitr_print.knitr_kable to enclose raw output in pandoc RawBlock
knitr_knit_print <- knitr:::knit_print
knitr_raw_block <- function(x, format) {
  knitr::asis_output(paste0("\n\n```{=", format, "}\n", x, "\n```\n\n"))
}
knit_print <- function(x, ...) {
  # determine if this is a kable (and record the format)
  kable <- inherits(x, "knitr_kable")
  if (kable) {
    format <- attr(x, "format")
  }

  # delegate
  x <- knitr_knit_print(x, ...)

  # if it's a kable then wrap it in {=html}
  if (kable) {
    if (identical(format, "html")) {
      x <- knitr_raw_block(x, format)
    } else if (identical(format, "latex")) {
      x <- knitr_raw_block(x, "tex")
    }
  }

  # return
  x
}
assignInNamespace("knit_print", knit_print, ns = "knitr")



# patch knitr:::valid_path to remove colons from file names
knitr_valid_path <- knitr:::valid_path
valid_path = function(prefix, label) {
  path <- knitr_valid_path(prefix, label)
  gsub(":", "-", path, fixed = TRUE)
}
assignInNamespace("valid_path", valid_path, ns = "knitr")

