
# prefer raw_attribute for html_preserve
options(htmltools.preserve.raw = TRUE)

# NOTE: this option will work after this PR is merged:
# https://github.com/rstudio/htmltools/pull/191
# In the meantime overwrite the method.....
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

knitr_hooks <- function(format) {

  knit_hooks <- list()
  opts_hooks <- list()

  # opts hooks for implementing keep-hidden
  register_hidden_hook <- function(option, hidden = option) {
    opts_hooks[[option]] <<- function(options) {
      if (identical(options[[option]], FALSE)) {
        options[[option]] <- TRUE
        for (hide in hidden)
          options[[paste0(hide,".hidden")]] <- TRUE
      }
      options
    }
  }
  if (isTRUE(format$execution[["keep-hidden"]])) {
    register_hidden_hook("echo", c("source"))
    register_hidden_hook("include", c("output", "plot"))
    register_hidden_hook("warning")
    register_hidden_hook("message")
  }

  # hooks for marking up output
  default_hooks <- knitr::hooks_markdown()
  delegating_hook <- function(name, hook) {
    function(x, options) {
      x <- default_hooks[[name]](x, options)
      hook(x, options)
    }
  }
  delegating_output_hook = function(type, classes) {
    delegating_hook(type, function(x, options) {
      # add .hidden class if keep-hidden hook injected an option
      if (isTRUE(options[[paste0(type,".hidden")]]))
        classes <- c(classes, "hidden")
      output_div(x, NULL, classes)
    })
  }

  # entire chunk
  knit_hooks$chunk <- delegating_hook("chunk", function(x, options) {

    # fixup duplicate figure labels
    placeholder <- output_label_placeholder(options)
    if (!is.null(placeholder)) {
      figs <- length(regmatches(x, gregexpr(placeholder, x, fixed = TRUE))[[1]])
      label <- output_label(options)
      for (i in 1:figs) {
        suffix <- ifelse(figs > 1, paste0("-", i), "")
        x <- sub(placeholder, paste0(label, suffix), fixed = TRUE, x)
      }
    }


    # apply parent caption if we have subcaptions
    label <- output_label(options)
    fig.cap = options[["fig.cap"]]
    fig.subcap = options[["fig.subcap"]]
    if (is_figure_label(label) && !is.null(fig.cap) && !is.null(fig.subcap)) {
      label <- paste0("#", label, " ")
      fig.cap <- paste0("\n", fig.cap, "\n")
    } else {
      label = NULL
      fig.cap = NULL
    }

    # return cell
    paste0("::: {", label ,".cell .cell-code}\n", x, "\n", fig.cap ,":::")
  })
  knit_hooks$source <- delegating_hook("source", function(x, options) {
    if (isTRUE(options[["source.hidden"]])) {
      engine <- tolower(options$engine)
      pattern <- paste0("```( ?\\{\\.r|r)([^\\}\n]*)\\}?")
      x <- gsub(pattern, paste0("``` {.", engine, " .hidden\\2}"), x)
    }
    x
  })
  knit_hooks$output <- delegating_output_hook("output", c("stream", "stdout"))
  knit_hooks$warning <- delegating_output_hook("warning", c("stream", "stderr"))
  knit_hooks$message <- delegating_output_hook("message", c("stream", "stderr"))
  knit_hooks$plot <- knitr_plot_hook(default_hooks[["plot"]])
  knit_hooks$error <- delegating_output_hook("error", c("error"))

  list(
    knit = knit_hooks,
    opts = opts_hooks
  )
}

knitr_plot_hook <- function(default_plot_hook) {
  function(x, options) {

    # classes
    classes <- c("display_data")
    if (isTRUE(options[["plot.hidden"]]))
      classes <- c(classes, "hidden")

    # id
    placeholder <- output_label_placeholder(options)
    id <- ifelse(
      is_figure_label(placeholder),
      paste0("#", placeholder),
      ""
    )

    # add attributes
    attr = paste(id, paste(
      c(
        sprintf('width=%s', options[['out.width']]),
        sprintf('height=%s', options[['out.height']]),
        options[['out.extra']]
      ),
      collapse = ' '
    ))


    if (nzchar(attr)) {
      attr <- paste0("{", attr, "}")
    }

    # generate markdown for image
    md <- sprintf("![%s](%s)%s", figure_cap(options), x, attr)

    # enclose in output div
    output_div(md, NULL, classes)
  }
}

# helper to create an output div
output_div <- function(x, label, classes) {
  div <- "::: {"
  if (!is.null(label)) {
    div <- paste0(div, "#", label, " ")
  }
  paste0(
    div, ".output ",
    paste(paste0(".", classes), collapse = " ") ,
    "}\n",
    trimws(x),
    "\n:::\n\n"
  )
}


figure_cap <- function(options) {
  output_label <- output_label(options)
  if (is.null(output_label) || is_figure_label(output_label)) {
    fig.cap <- options[["fig.cap"]]
    fig.subcap <- options[["fig.subcap"]]
    if (!is.null(fig.subcap))
      fig.subcap
    else if (!is.null(fig.cap))
      fig.cap
    else if (!is.null(output_label))
      "(Untitled)"
    else
      ""
  } else {
    ""
  }
}


output_label <- function(options) {
  label <- options[["label"]]
  if (!is.null(label) && (startsWith(label, "fig:") || startsWith(label, "tbl:"))) {
    label
  } else {
    NULL
  }
}

output_label_placeholder <- function(options) {
  kPlaceholder <- "D08295A6-16DC-499D-85A8-8BA656E013A2"
  label <- output_label(options)
  if (!is.null(label))
    paste0(label, kPlaceholder)
  else
    NULL
}

is_figure_label <- function(label) {
  !is.null(label) && startsWith(label, "fig:")
}


