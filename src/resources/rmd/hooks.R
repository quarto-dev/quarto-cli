# hooks.R
# Copyright (C) 2020 by RStudio, PBC

knitr_hooks <- function(format, resourceDir) {

  knit_hooks <- list()
  opts_hooks <- list()
  
  # options in yaml
  opts_hooks[["code"]] <- knitr_options_hook


   # force eval to 'FALSE' for all chunks if execute: enabled: false
  executeEnabled <- format$execute[["enabled"]]
  if (!is.null(executeEnabled) && executeEnabled == FALSE) {
    opts_hooks[["eval"]] <- function(options) {
      options$eval <- FALSE
      options
    }
  }

  # forward 'output' to 'results'
  opts_hooks[["results"]] <- function(options) {
    if (identical(options[["output"]], TRUE)) {
      options[["results"]] <- "markup"
    } else if (identical(options[["output"]], FALSE)) {
      options[["results"]] <- "hide"
    }
    options
  }

  # automatically set gifski hook for fig.animate
  opts_hooks[["fig.show"]] <- function(options) {
    
    # get current value of fig.show
    fig.show <- options[["fig.show"]]
    
    # use gifski as default animation hook for non-latex output
    if (identical(fig.show, "animate")) {
      if (!knitr:::is_latex_output() && is.null(options[["animation.hook"]])) {
        options[["animation.hook"]] <- "gifski"
      }
      
    # fig.show "asis" -> "hold" for fig: labeled chunks
    } else if (identical(fig.show, "asis")) {
      if (is_figure_label(output_label(options))) {
        options[["fig.show"]] <- "hold"
      }
    }
    
    # return options
    options
  }

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
  if (isTRUE(format$render[["keep-hidden"]])) {
    register_hidden_hook("echo", c("source"))
    register_hidden_hook("output", c("output", "plot"))
    register_hidden_hook("include")
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
      # prefix for classes
      classes <- paste0("cell-output-", classes)
      # add .hidden class if keep-hidden hook injected an option
      if (isTRUE(options[[paste0(type,".hidden")]]))
        classes <- c(classes, "hidden")
      output_div(x, NULL, classes)
    })
  }

  # entire chunk
  knit_hooks$chunk <- delegating_hook("chunk", function(x, options) {
    
    # ojs engine should return output unadorned
    if (startsWith(x, "```{ojs}") && endsWith(x, "```")) {
      return(x)
    }

    # read some options
    label <- output_label(options)
    fig.cap <- options[["fig.cap"]]
    tbl.cap <- options[["tbl.cap"]]
    cell.cap <- NULL
    fig.subcap = options[["fig.subcap"]]
    
    # fixup duplicate figure labels
    placeholder <- output_label_placeholder(options)
    if (!is.null(placeholder)) {
      figs <- length(regmatches(x, gregexpr(placeholder, x, fixed = TRUE))[[1]])
      for (i in 1:figs) {
        suffix <- ifelse(!is.null(fig.subcap), paste0("-", i), "")
        x <- sub(placeholder, paste0(label, suffix), fixed = TRUE, x)
      }
    }

    # determine label and caption output
    label <- paste0(labelId(label), " ")
    if (is_figure_label(label)) {
      if (!is.null(fig.cap) && !is.null(fig.subcap)) {
        cell.cap <- paste0("\n", fig.cap, "\n")
      } else {
        label = NULL
      }
    } else if (is_table_label(label)) {
      if (!is.null(tbl.cap)) {
        cell.cap <- paste0("\n", tbl.cap, "\n")
      }
    } else {
      label <- NULL
    }

    # synthesize layout if we have fig.sep
    fig.sep <- options[["fig.sep"]]
    fig.ncol <- options[["fig.ncol"]]
    if (!is.null(fig.sep)) {
      
      # recycle fig.sep
      fig.num <- options[["fig.num"]] %||% 1L
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
      options[["layout"]] <- fig.layout
      
    # populate layout.ncol from fig.ncol
    } else if (!is.null(fig.ncol)) {
      options[["layout.ncol"]] = fig.ncol
    }
    
    # alias fig.align to layout.align
    fig.align = options[["fig.align"]]
    if (!is.null(fig.align) && !identical(fig.align, "default")) {
      options["layout.align"] = fig.align
    }

    # alias fig.valign to layout.valign
    fig.valign = options[["fig.valign"]]
    if (!is.null(fig.valign) && !identical(fig.valign, "default")) {
      options["layout.valign"] = fig.valign
    }

    # forward selected attributes
    forward <- c("layout", "layout.nrow", "layout.ncol", "layout.align")
    forwardAttr <- character()
    for (attr in forward) {
      value = options[[attr]]
      if (!is.null(value)) {
        if (identical(attr, "layout")) {
          if (!is.character(value)) {
            value = jsonlite::toJSON(value)
          }
        }
        if (!is.null(value)) {
          forwardAttr <- c(forwardAttr, sprintf("%s=\"%s\"", attr, value))
        }
      }
    }

    # forward any other unknown attributes
    knitr_default_opts <- names(knitr::opts_chunk$get())
    quarto_opts <- c("label","fig.cap","fig.subcap","fig.scap","fig.link", "fig.alt",
                     "fig.align","fig.env","fig.pos","fig.num", "lst.cap", 
                     "lst.label", "layout.align", "layout.valign", "classes", "fold", "summary",
                     "layout", "layout.nrow", "layout.ncol", "layout.align",
                     "output", "include.hidden", "source.hidden", "plot.hidden", "output.hidden")
    other_opts <- c("eval", "out.width", "code", "params.src", 
                    "out.width.px", "out.height.px")
    known_opts <- c(knitr_default_opts, quarto_opts, other_opts)
    unknown_opts <- setdiff(names(options), known_opts)
    unknown_opts <- Filter(Negate(is.null), unknown_opts)
    # json encode if necessary
    unknown_values <- lapply(options[unknown_opts], 
                             function(value) {
                               if (!is.character(value) || length(value) > 1)
                                 jsonlite::toJSON(value, auto_unbox = TRUE)
                               else
                                 value
                            })
    # append to forward list
    forwardAttr <- c(forwardAttr, 
                     sprintf("%s=\"%s\"", unknown_opts, unknown_values))
    if (length(forwardAttr) > 0)
      forwardAttr <- paste0(" ", paste(forwardAttr, collapse = " "))
    else
      forwardAttr <- ""
   
    # handle classes
    classes <- c("cell",options[["classes"]] )
    if (isTRUE(options[["include.hidden"]])) {
      classes <- c(classes, "hidden")
    }
    classes <- sapply(classes, function(clz) ifelse(startsWith(clz, "."), clz, paste0(".", clz)))

    # return cell
    paste0("::: {", labelId(label), paste(classes, collapse = " ") ,forwardAttr, "}\n", x, "\n", cell.cap ,":::")
  })
  knit_hooks$source <- function(x, options) {
    x <- knitr:::one_string(c('', x))
    class <- options$class.source
    attr <- options$attr.source
    class <- paste(class, "cell-code")
    if (isTRUE(options[["source.hidden"]])) {
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
    fold <- options[["fold"]]
    if (!is.null(fold)) {
      attr <- paste(attr, paste0('fold="', tolower(as.character(fold)), '"'))
    }
    fold <- options[["summary"]]
    if (!is.null(fold)) {
      attr <- paste(attr, paste0('summary="', as.character(fold), '"'))
    }
    attrs <- block_attr(
      id = id,
      lang = tolower(options$engine),
      class = trimws(class),
      attr = attr
    )
    paste0('\n\n```', attrs, x, '\n```\n\n')
  }
  knit_hooks$output <- delegating_output_hook("output", c("stdout"))
  knit_hooks$warning <- delegating_output_hook("warning", c("stderr"))
  knit_hooks$message <- delegating_output_hook("message", c("stderr"))
  knit_hooks$plot <- knitr_plot_hook(knitr:::is_html_output(format$pandoc$to))
  knit_hooks$error <- delegating_output_hook("error", c("error"))

  list(
    knit = knit_hooks,
    opts = opts_hooks
  )
}

knitr_plot_hook <- function(htmlOutput) {
  function(x, options) {
    
    # are we using animation (if we are then ignore all but the last fig)
    fig.num <- options[["fig.num"]] %||% 1L
    fig.cur = options$fig.cur %||% 1L
    tikz <- knitr:::is_tikz_dev(options)
    animate = fig.num > 1 && options$fig.show == 'animate' && !tikz
    if (animate) {
      if (fig.cur < fig.num) {
        return ('')
      } else  {
        # if it's the gifski hook then call it directly (it will call 
        # this function back with the composed animated gif)
        hook <- knitr:::hook_animation(options)
        if (identical(hook, knitr:::hook_gifski)) {
          return (hook(x, options))
        }
      }
    }
  
    # classes
    classes <- paste0("cell-output-display")
    if (isTRUE(options[["plot.hidden"]]))
      classes <- c(classes, "hidden")

    # label
    placeholder <- output_label_placeholder(options)
    label <- ifelse(
      is_figure_label(placeholder),
      labelId(placeholder),
      ""
    )
    attr <- label
    
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
    fig.alt <- options[["fig.alt"]]
    if (!is.null(fig.alt) && nzchar(fig.alt)) {
       keyvalue <- c(keyvalue, sprintf("fig.alt='%s'", fig.alt))
    }
    fig.scap <- options[['fig.scap']]
    if (!is.null(fig.scap)) {
      keyvalue <- c(keyvalue, sprintf("fig.scap='%s'", fig.scap))
    }
    resize.width <- options[['resize.width']]
    if (!is.null(resize.width)) {
      keyvalue <- c(keyvalue, sprintf("resize.width='%s'", resize.width))
    }
    resize.height <- options[['resize.height']]
    if (!is.null(resize.height)) {
      keyvalue <- c(keyvalue, sprintf("resize.height='%s'", resize.height))
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

    # special handling for animations
    if (animate) {
      
      # get the caption (then remove it so the hook doesn't include it)
      caption <- figure_cap(options)
      options[["fig.cap"]] <- NULL
      options[["fig.subcap"]] <- NULL
      
      # check for latex
      if (knitr:::is_latex_output()) {
        
        # include dependency on animate package
        knitr::knit_meta_add(list(
          rmarkdown::latex_dependency("animate")
        ))
        
        latexOutput <- paste(
          "```{=latex}",
          latex_animation(x, options),
          "```",
          sep = "\n"
        )
        
        # add the caption if we have one
        if (nzchar(caption)) {
          latexOutput <- paste0(latexOutput, "\n\n", caption, "\n")
        }
        
        # enclose in output div
        output_div(latexOutput, label, classes)
        
      # otherwise assume html
      } else {
        # render the animation
        hook <- knitr:::hook_animation(options)
        htmlOutput <- hook(x, options)
        htmlOutput <- htmlPreserve(htmlOutput)
        
        # add the caption if we have one
        if (nzchar(caption)) {
          htmlOutput <- paste0(htmlOutput, "\n\n", caption, "\n")
        }
        
        # enclose in output div
        output_div(htmlOutput, label, classes)
      }
     
    } else {
      
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
}

knitr_options_hook <- function(options) {

  # partition yaml options
  results <- partition_yaml_options(options$engine, options$code)
  if (!is.null(results$yaml)) {
    options <- knitr:::merge_list(options, results$yaml)
    options$code <- results$code
  } 
  
  # some aliases
  if (!is.null(options[["fig.format"]])) {
    options[["dev"]] <- options[["fig.format"]]
  }
  if (!is.null(options[["fig.dpi"]])) {
    options[["dpi"]] <- options[["fig.dpi"]]
  }
  
  # return options  
  options
}


partition_yaml_options <- function(engine, code) {

  # mask out empty blocks
  if (length(code) == 0) {
    return(list(
      yaml = NULL,
      code = code
    ))
  }
  
  # determine comment matching patterns
  knitr_engine_comment_chars <- list(
    r = "#",
    python = "#",
    julia = "#",
    scala = "//",
    matlab = "%",
    csharp = "//",
    fsharp = "//",
    c = c("/*",  "*/"),
    css = c("/*",  "*/"),
    sas = c("*", ";"),
    powershell = "#",
    bash = "#",
    sql = "--",
    mysql = "--",
    psql = "--",
    lua = "--",
    Rcpp = "//",
    cc = "//",
    stan = "#",
    octave = "#",
    fortran = "!",
    fortran95 = "!",
    awk = "#",
    gawk = "#",
    stata = "*",
    java = "//",
    groovy = "//",
    sed = "#",
    perl = "#",
    ruby = "#",
    tikz = "%",
    js = "//",
    d3 = "//",
    node = "//",
    sass = "//",
    coffee = "#",
    go = "//",
    asy = "//",
    haskell = "--",
    dot = "//"
  )
  comment_chars <- knitr_engine_comment_chars[[engine]] %||% "#"
  comment_start <- paste0(comment_chars[[1]], "| ")
  comment_end <- ifelse(length(comment_chars) > 1, comment_chars[[2]], "")
  
  # check for option comments
  match_start <- startsWith(code, comment_start)
  match_end <- endsWith(trimws(code, "right"), comment_end)
  matched_lines <- match_start & match_end
  
  # has to have at least one matched line at the beginning
  if (isTRUE(matched_lines[[1]])) {
    
    # divide into yaml and code
    if (all(matched_lines)) {
      yaml <- code
      code <- c()
    } else {
      last_match <- which.min(matched_lines) - 1
      yaml <- code[1:last_match]
      code <- code[(last_match+1):length(code)]
    }
    
    # trim right
    if (any(match_end)) {
      yaml <- trimws(yaml, "right")
    }
  
    # extract yaml from comments, then parse it
    yaml <- substr(yaml, nchar(comment_start) + 1, nchar(yaml))
    yaml <- strtrim(yaml, nchar(yaml) - nchar(comment_end))
    yaml_options <- yaml::yaml.load(yaml, eval.expr = TRUE)
    if (!is.list(yaml_options) || length(names(yaml_options)) == 0) {
      warning("Invalid YAML option format in chunk: \n", paste(yaml, collapse = "\n"), "\n")
      yaml_options <- list()
    }
    
    # extract code
    if (length(code) > 0 && knitr:::is_blank(code[[1]])) {
      code <- code[-1]
    }
    
    list(
      yaml = yaml_options,
      code = code
    )
  } else {
    list(
      yaml = NULL,
      code = code
    )
  }
}


# helper to create an output div
output_div <- function(x, label, classes, attr = NULL) {
  div <- "::: {"
  if (!is.null(label) && nzchar(label)) {
    div <- paste0(div, labelId(label), " ")
  }
  paste0(
    div,
    paste(paste0(".", classes), collapse = " ") ,
    ifelse(!is.null(attr), paste0(" ", attr), ""),
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
  if (!is.null(label) && grepl("^#?(fig|tbl)-", label)) {
    label
  } else {
    NULL
  }
}

output_label_placeholder <- function(options) {
  kPlaceholder <- "D08295A6-16DC-499D-85A8-8BA656E013A2"
  label <- output_label(options)
  if (is_figure_label(label))
    paste0(label, kPlaceholder)
  else
    NULL
}

is_figure_label <- function(label) {
  is_label_type("fig", label)
}

is_table_label <- function(label) {
  is_label_type("tbl", label)
}

is_label_type <- function(type, label) {
  !is.null(label) && grepl(paste0("^#?", type, "-"), label)
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

# ported from:
# https://github.com/yihui/knitr/blob/f8f90baad99d873202b8dc8042eab7a88fac232f/R/hooks-latex.R#L151-L171
latex_animation <- function(x, options) {
  
  fig.num = options$fig.num %||% 1L
  
  ow = options$out.width
  # maxwidth does not work with animations
  if (identical(ow, '\\maxwidth')) ow = NULL
  if (is.numeric(ow)) ow = paste0(ow, 'px')
  size = paste(c(sprintf('width=%s', ow),
                 sprintf('height=%s', options$out.height),
                 options$out.extra), collapse = ',')
  
  aniopts = options$aniopts
  aniopts = if (is.na(aniopts)) NULL else gsub(';', ',', aniopts)
  size = paste(c(size, sprintf('%s', aniopts)), collapse = ',')
  if (nzchar(size)) size = sprintf('[%s]', size)
  sprintf('\\animategraphics%s{%s}{%s}{%s}{%s}', size, 1 / options$interval,
          sub(sprintf('%d$', fig.num), '', xfun::sans_ext(x)), 1L, fig.num)
}



