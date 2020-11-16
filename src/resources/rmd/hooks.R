
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
      classes <- c("output", classes)
      # add .hidden class if keep-hidden hook injected an option
      if (isTRUE(options[[paste0(type,".hidden")]]))
        classes <- c(classes, "hidden")
      output_div(x, classes)
    })
  }

  # entire chunk
  knit_hooks$chunk <- delegating_hook("chunk", function(x, options) {
    # enclose raw html in display_data (use hidden if necessary)
    classes <- ".output .display_data"
    if (isTRUE(options[["output.hidden"]]))
      classes <- paste0(classes, " .hidden")
    x <- gsub("<!--html_preserve-->", paste0("::: {.output ", classes, "}\n<!--html_preserve-->"), x)
    x <- gsub("<!--/html_preserve-->", "<!--/html_preserve-->\n:::", x)

    # return cell
    paste0("::: {.cell .code}\n", x, "\n:::")
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

# helper to create an output div
output_div <- function(x, classes) {
  paste0(
    "::: {",
    paste(paste0(".", classes), collapse = " ") ,
    "}\n",
    trimws(x),
    "\n:::"
  )
}

knitr_plot_hook <- function(default_plot_hook) {
  function(x, options) {
    # classes
    classes <- c("output", "display_data")
    if (isTRUE(options[["plot.hidden"]]))
      classes <- c(classes, "hidden")

    # attributes
    attr <- ""

    # generate markdown for image
    md <- sprintf("![%s](%s)%s", options[["fig.cap"]], x, attr)

    # enclose in output div
    output_div(md, classes)
  }
}
