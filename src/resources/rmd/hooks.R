# hooks.R
# Copyright (C) 2020 by RStudio, PBC

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

    # determine label and caption output
    label <- output_label(options)
    fig.cap = options[["fig.cap"]]
    fig.subcap = options[["fig.subcap"]]
    if (is_figure_label(label) && !is.null(fig.cap) && !is.null(fig.subcap)) {
      label <- paste0(labelId(label), " ")
      fig.cap <- paste0("\n", fig.cap, "\n")
    } else {
      label = NULL
      fig.cap = NULL
    }

    # synthesize fig.layout if we have fig.sep
    fig.sep <- options[["fig.sep"]]
    if (!is.null(fig.sep)) {
      
      # recycle fig.sep
      fig.num <- options[["fig.num"]]
      fig.sep <- rep_len(fig.sep, fig.num)
      
      # recyle out.width
      out.width <- options[["out.width"]] 
      if (is.null(out.width)) {
        out.width <- 1
      } 
      out.width <- rep_len(out.width, fig.num)
      
      # build fig.layout
      fig.layout <- list()
      fig.row <- c()
      for (i in 1:fig.num) {
        fig.row <- c(fig.row, out.width[[i]])
        if (nzchar(fig.sep[[i]])) {
          fig.layout[[length(fig.layout) + 1]] <- fig.row
          fig.row <- c()
        }
      }
      if (length(fig.row) > 0) {
        fig.layout[[length(fig.layout) + 1]] <- fig.row
      }
      options[["fig.layout"]] <- fig.layout
    }
   
    # forward selected attributes
    forward <- c("fig.ncol", "fig.nrow", "fig.align", "fig.layout")
    forwardAttr <- character()
    for (attr in forward) {
      value = options[[attr]]
      if (!is.null(value)) {
        if (identical(attr, "fig.align")) {
          if (identical(value, "default")) {
            value <- NULL
          }
        }
        if (identical(attr, "fig.layout")) {
          value = jsonlite::toJSON(value)
        }
        if (!is.null(value)) {
          forwardAttr <- c(forwardAttr, sprintf("%s='%s'", attr, value))
        }
      }
    }
    forwardAttr <- paste(forwardAttr, collapse = " ")
    if (nzchar(forwardAttr)) {
      forwardAttr <- paste0(" ", forwardAttr)
    }
    
    # return cell
    paste0("::: {", labelId(label) ,".cell .cell-code", forwardAttr, "}\n", x, "\n", fig.cap ,":::")
  })
  knit_hooks$source <- function(x, options) {
    x <- knitr:::one_string(c('', x))
    class <- options$class.source
    attr <- options$attr.source
    if (isTRUE(options["source.hidden"])) {
      class <- paste(class, "hidden")
    }
    if (!identical(format$metadata[["crossref"]], FALSE)) {
      id <- options[["lst.label"]]
      if (!is.null(options[["lst.cap"]])) {
        attr <- paste(attr, paste0('caption="', options[["lst.cap"]], '"'))
      }
    } else {
      id = NULL
    }
    attrs <- block_attr(
      id = id,
      lang = tolower(options$engine),
      class = class,
      attr = attr
    )
    paste0('\n\n```', attrs, x, '\n```\n\n')
  }
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
    attr <- ifelse(
      is_figure_label(placeholder),
      labelId(placeholder),
      ""
    )
    
    # knitr::fix_options will convert out.width and out.height to their
    # latex equivalents, reverse this transformation so our figure layout
    # code can deal directly with percentages
    options <- latex_sizes_to_percent(options)

    # check for optional figure attributes
    keyvalue <- c()
    fig.align <- options[['fig.align']]
    if (!identical(fig.align, "default")) {
      keyvalue <- c(keyvalue, sprintf("fig.align='%s'", fig.align))
    }
    fig.env <- options[['fig.env']]
    if (!identical(fig.env, "figure")) {
      keyvalue <- c(keyvalue, sprintf("fig.env='%s'", fig.env))
    }
    fig.pos <- options[['fig.pos']]
    if (nzchar(fig.pos)) {
      keyvalue <- c(keyvalue, sprintf("fig.pos='%s'", fig.pos))
    }
    fig.scap <- options[['fig.scap']]
    if (nzchar(fig.scap)) {
      keyvalue <- c(keyvalue, sprintf("fig.scap='%s'", fig.scap))
    }
    
    # add keyvalue
    keyvalue <- paste(
      c(
        keyvalue,
        sprintf('width=%s', options[['out.width']]),
        sprintf('height=%s', options[['out.height']]),
        options[['out.extra']]
      ),
      collapse = ' '
    )
    if (nzchar(keyvalue)) {
      attr <- paste(attr, keyvalue)
    }

    # create attributes if we have them
    if (nzchar(attr)) {
      attr <- paste0("{", trimws(attr), "}")
    }

    # generate markdown for image
    md <- sprintf("![%s](%s)%s", figure_cap(options), x, attr)
    
    # enclose in link if requested
    link <- options[["fig.link"]]
    if (!is.null(link)) {
      md <- sprintf("[%s](%s)", md, link)
    }

    # enclose in output div
    output_div(md, NULL, classes)
  }
}

# helper to create an output div
output_div <- function(x, label, classes) {
  div <- "::: {"
  if (!is.null(label)) {
    div <- paste0(div, labelId(label), " ")
  }
  paste0(
    div, ".output ",
    paste(paste0(".", classes), collapse = " ") ,
    "}\n",
    trimws(x),
    "\n:::\n\n"
  )
}

labelId <- function(label) {
  if (!is.null(label) && !startsWith(label, "#"))
    paste0("#", label)
  else
    label
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
    else
      ""
  } else {
    ""
  }
}


output_label <- function(options) {
  label <- options[["label"]]
  if (!is.null(label) && grepl("^#?(fig|tbl):", label)) {
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
  !is.null(label) && grepl("^#?fig:", label)
}

block_attr <- function(id = NULL, lang = NULL, class = NULL, attr = NULL) {
  id <- labelId(id)
  if (!is.null(lang)) {
    lang <- paste0(".", lang)
  }
  if (!is.null(class)) {
    class <- paste(block_class(class))
  }
  attributes <- c(id, lang, class, attr)
  attributes <- paste(attributes[!is.null(attributes)], collapse = " ")
  if (nzchar(attributes))
    paste0("{", attributes, "}")
  else
    ""
}

block_class <- function(x) {
  if (length(x) > 0) gsub('^[.]*', '.', unlist(strsplit(x, '\\s+')))
}

latex_sizes_to_percent <- function(options) {
  #  \linewidth
  width <- options[["out.width"]]
  if (!is.null(width)) {
    latex_width <- regmatches(width, regexec("^([0-9\\.]+)\\\\linewidth$", width))
    if (length(latex_width[[1]]) > 1) {
      width <- paste0(as.numeric(latex_width[[1]][[2]]) * 100, "%")
      options[["out.width"]] <- width
    }
  }
  # \textheight
  height <- options[["out.height"]]
  if (!is.null(height)) {
    latex_height <- regmatches(height, regexec("^([0-9\\.]+)\\\\textheight$", height))
    if (length(latex_height[[1]]) > 1) {
      height <- paste0(as.numeric(latex_height[[1]][[2]]) * 100, "%")
      options[["out.height"]] <- height
    }
  }
  options
}



