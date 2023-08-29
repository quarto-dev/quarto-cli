# hooks.R
# Copyright (C) 2020-2022 Posit Software, PBC

# inline knitr:::merge_list()
merge_list <- function(x, y) {
    x[names(y)] <- y
    x
}

knitr_hooks <- function(format, resourceDir, handledLanguages) {

  knit_hooks <- list()
  opts_hooks <- list()
  
  # options in yaml (save last yaml.code for source hook)
  lastYamlCode <- NULL
  opts_hooks[["code"]] <- function(options) {
    lastYamlCode <<- options[["yaml.code"]]
    options <- knitr_options_hook(options)
    if (is.null(lastYamlCode)) {
      lastYamlCode <<- options[["yaml.code"]]
    }
    options
  } 


   # force eval to 'FALSE' for all chunks if execute: enabled: false
  executeEnabled <- format$execute[["enabled"]]
  if (!is.null(executeEnabled) && executeEnabled == FALSE) {
    opts_hooks[["eval"]] <- function(options) {
      options$eval <- FALSE
      options
    }
  }

  # propagate echo: fenced to echo: true / fenced.echo
  opts_hooks[["echo"]] <- function(options) {
    if (identical(options[["echo"]], "fenced")) {
      options[["echo"]] <- TRUE
      options[["fenced.echo"]] <- TRUE
    } else if (isTRUE(options[["chunk.echo"]])) {
      options[["fenced.echo"]] <- FALSE
    }
    # fenced.echo implies hold (if another explicit override isn't there)
    if (isTRUE(options[["fenced.echo"]])) {
      if (identical(options[["fig.show"]], "asis")) {
        options[["fig.show"]] <- "hold"
      }
      if (identical(options[["results"]], "markup")) {
        options[["results"]] <- "hold"
      }
    }
    # for source-only engine, always set `echo: TRUE`
    if (options[["engine"]] %in% c("embed", "verbatim")) {
      options[["echo"]] <- TRUE
    }

    options
  }

  # forward 'output' to various options. For mainline output, TRUE means flip them
  # from hide, FALSE means hide. For message/warning TRUE means use the
  # global default, FALSE means shut them off entirely)
  opts_hooks[["output"]] <- function(options) {
    output <- options[["output"]]
    if (isFALSE(output)) {
      options[["results"]] <- "hide"
      options[["fig.show"]] <- "hide"
    } else if (identical(output, "asis")) {
      options[["results"]] <- "asis"
    } else {
      if (identical(options[["results"]], "hide")) {
         options[["results"]] <- "markup"
      }
      if (identical(options[["fig.show"]], "hide")) {
         options[["fig.show"]] <- "asis"
      }
    }
    options[["message"]] <- ifelse(!isFALSE(output), knitr::opts_chunk$get("message"), FALSE)
    options[["warning"]] <- ifelse(!isFALSE(output), knitr::opts_chunk$get("warning"), FALSE)
    options
  }

  # automatically set gifski hook for fig.animate
  opts_hooks[["fig.show"]] <- function(options) {
    
    # get current value of fig.show
    fig.show <- options[["fig.show"]]
    
    # use gifski as default animation hook for non-latex output
    if (identical(fig.show, "animate")) {
      if (!is_latex_output(format$pandoc$to) && is.null(options[["animation.hook"]])) {
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

  opts_hooks[["collapse"]] <- function(options) {
    if (isTRUE(options[["collapse"]])) {
      comment <- options[["comment"]]
      if (is.null(comment) || is.na(comment)) {
        options[["comment"]] <- "##"
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
      if (identical(options[["results"]], "asis") ||
          isTRUE(options[["collapse"]])) {
        x
      } else {
        # prefix for classes
        classes <- c("cell-output", paste0("cell-output-", classes))
        # add .hidden class if keep-hidden hook injected an option
        if (isTRUE(options[[paste0(type,".hidden")]]))
          classes <- c(classes, "hidden")
        output_div(x, NULL, classes)
      }
    })
  }

  # entire chunk
  knit_hooks$chunk <- delegating_hook("chunk", function(x, options) {
    if (any(as.logical(lapply(handledLanguages, function(lang) {
      prefix <- paste0("```{", lang, "}")
      startsWith(x, prefix)
    }))) && endsWith(x, "```")) {
      return(x)
    }

    # ojs engine should return output unadorned
    if (startsWith(x, "```{ojs}") && endsWith(x, "```")) {
      return(x)
    }

    # verbatim-like and comment knitr's engine should do nothing
    if (options[["engine"]] %in% c("verbatim", "embed", "comment")) {
      return(x)
    }

    # read some options
    
    label <- output_label(options)
    fig.cap <- options[["fig.cap"]]
    cell.cap <- NULL
    fig.subcap = options[["fig.subcap"]]

    # If we're preserving cells, we need provide a cell id
    cellId <- NULL
    if (isTRUE(format$render$`notebook-preserve-cells`) && !is.null(label)) {
      cellId <- paste0("cell-", label)
    }
    
    # fixup duplicate figure labels
    placeholder <- output_label_placeholder(options)
    if (!is.null(placeholder)) {
      figs <- length(regmatches(x, gregexpr(placeholder, x, fixed = TRUE))[[1]])
      for (i in 1:figs) {
        suffix <- ifelse(figs > 1, paste0("-", i), "")
        x <- sub(placeholder, paste0(label, suffix), fixed = TRUE, x)
      }
    }

    # caption output
    if (!is.null(fig.cap) && !is.null(fig.subcap)) {
      cell.cap <- paste0("\n", fig.cap, "\n")
    }  else {
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
      
    # populate layout-ncol from fig.ncol
    } else if (!is.null(fig.ncol)) {
      options[["layout-ncol"]] = fig.ncol
    }
    
    # alias fig.align to layout-align
    fig.align = options[["fig.align"]]
    if (!is.null(fig.align) && !identical(fig.align, "default")) {
      options["layout-align"] = fig.align
    }

    # alias fig.valign to layout-valign
    fig.valign = options[["fig.valign"]]
    if (!is.null(fig.valign) && !identical(fig.valign, "default")) {
      options["layout-valign"] = fig.valign
    }

    # forward selected attributes
    forward <- c("layout", "layout-nrow", "layout-ncol", "layout-align")
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
    knitr_default_opts <- unique(c(names(knitr:::opts_chunk_attr), names(knitr::opts_chunk$get())))
    quarto_opts <- c("label","fig.cap","fig.subcap","fig.scap","fig.link", "fig.alt",
                     "fig.align","fig.env","fig.pos","fig.num", "lst-cap", 
                     "lst-label", "classes", "panel", "column", "fig.column", "tbl.column", "fig.cap-location", 
                     "tbl-cap-location", "cap-location", "code-fold", "code-summary", "code-overflow",
                     "code-line-numbers",
                     "layout", "layout-nrow", "layout-ncol", "layout-align", "layout-valign", 
                     "output", "include.hidden", "source.hidden", "plot.hidden", "output.hidden")
    other_opts <- c("eval", "out.width", "yaml.code", "code", "params.src", "original.params.src", 
                    "fenced.echo", "chunk.echo", "lang",
                    "out.width.px", "out.height.px", "indent", "class.source", 
                    "class.output", "class.message", "class.warning", "class.error", "attr.source", 
                    "attr.output", "attr.message", "attr.warning", "attr.error", "connection")
    known_opts <- c(knitr_default_opts, quarto_opts, other_opts)
    unknown_opts <- setdiff(names(options), known_opts)
    unknown_opts <- Filter(Negate(is.null), unknown_opts)
    unknown_opts <- Filter(function(opt) !startsWith(opt, "."), unknown_opts)
    # json encode if necessary
    unknown_values <- lapply(options[unknown_opts], 
                             function(value) {
                               if (!is.character(value) || length(value) > 1) {
                                 value <- jsonlite::toJSON(value, auto_unbox = TRUE)
                               } 
                               # will be enclosed in single quotes so escape
                               gsub("'", "\\\'", value, fixed = TRUE)
                            })
    # append to forward list
    forwardAttr <- c(forwardAttr, 
                     sprintf("%s='%s'", unknown_opts, unknown_values))
    if (length(forwardAttr) > 0)
      forwardAttr <- paste0(" ", paste(forwardAttr, collapse = " "))
    else
      forwardAttr <- ""
   
    # handle classes
    classes <- c("cell",options[["classes"]] )
    if (is.character(options[["panel"]]))
      classes <- c(classes, paste0("panel-", options[["panel"]]))
     if (is.character(options[["column"]]))
      classes <- c(classes, paste0("column-", options[["column"]]))
     if (is.character(options[["fig.column"]]))
      classes <- c(classes, paste0("fig-column-", options[["fig.column"]]))
     if (is.character(options[["tbl-column"]]))
      classes <- c(classes, paste0("tbl-column-", options[["tbl-column"]]))
     if (is.character(options[["cap-location"]])) 
      classes <- c(classes, paste0("caption-", options[["cap-location"]]))      
     if (is.character(options[["fig.cap-location"]])) 
      classes <- c(classes, paste0("fig-cap-location-", options[["fig.cap-location"]]))      
     if (is.character(options[["tbl-cap-location"]])) 
      classes <- c(classes, paste0("tbl-cap-location-", options[["tbl-cap-location"]]))      


    if (isTRUE(options[["include.hidden"]])) {
      classes <- c(classes, "hidden")
    }
    classes <- sapply(classes, function(clz) ifelse(startsWith(clz, "."), clz, paste0(".", clz)))

    # allow table lable through
    if (is_table_label(options[["label"]])) {
      label <- options[["label"]]
    } 

    if (is.null(label) && !is.null(cellId)) {
      label <- cellId
    }

    if (!is.null(label)) {
      label <- paste0(label, " ")
    }

    # if there is a label, additional classes, a forwardAttr, or a cell.cap 
    # then the user is deemed to have implicitly overridden results = "asis"
    # (as those features don't work w/o an enclosing div)
    needCell <- isTRUE(nzchar(label)) || 
                length(classes) > 1 ||
                isTRUE(nzchar(forwardAttr)) ||
                isTRUE(nzchar(cell.cap))
    if (identical(options[["results"]], "asis") && !needCell) {
      x
    } else {
      paste0(
        options[["indent"]], "::: {", 
        labelId(label), paste(classes, collapse = " ") ,forwardAttr, "}\n", x, "\n", cell.cap ,
        options[["indent"]], ":::"
      )
    }
  })
  knit_hooks$source <- function(x, options) {

    # How knitr handles the prompt option for R chunks
    x <- knitr:::hilight_source(x, "markdown", options)
    x <- knitr:::one_string(c('', x))

    # leave verbatim alone
    if (options[["engine"]] %in% c("verbatim", "embed")) {
      return(paste0('\n\n````', options[["lang"]] %||% 'default', x, '\n````', '\n\n'))
    }
    
    class <- options$class.source
    attr <- options$attr.source
    class <- paste(class, "cell-code")
    if (isTRUE(options[["source.hidden"]])) {
      class <- paste(class, "hidden")
    }
    if (!identical(format$metadata[["crossref"]], FALSE)) {
      id <- options[["lst-label"]]
      if (!is.null(options[["lst-cap"]])) {
        attr <- paste(attr, paste0('caption="', options[["lst-cap"]], '"'))
      }
    } else {
      id = NULL
    }
    if (identical(options[["code-overflow"]], "wrap"))
      class <- paste(class, "code-overflow-wrap")
    else if (identical(options[["code-overflow"]], "scroll"))
      class <- paste(class, "code-overflow-scroll")
    fold <- options[["code-fold"]]
    if (!is.null(fold)) {
      attr <- paste(attr, paste0('code-fold="', tolower(as.character(fold)), '"'))
    }
    fold <- options[["code-summary"]]
    if (!is.null(fold)) {
      attr <- paste(attr, paste0('code-summary="', as.character(fold), '"'))
    }
    lineNumbers <- options[["code-line-numbers"]]
    if (!is.null(lineNumbers)) {
      attr <- paste(attr, paste0('code-line-numbers="', tolower(as.character(lineNumbers)), '"'))
    }

    lang <- tolower(options$engine)
    if (isTRUE(options[["fenced.echo"]])) {
      attrs <- block_attr(
        id = id,
        lang = NULL,
        class = trimws(class),
        attr = attr
      )
      ticks <- "````"
      yamlCode <- lastYamlCode
      if (!is.null(yamlCode)) {
        yamlCode <- Filter(function(line) !grepl("echo:\\s+fenced", line), yamlCode)
        yamlCode <- paste(yamlCode, collapse = "\n")
        if (!nzchar(yamlCode)) {
          x <- trimws(x, "left")
        }
      } else {
        x <- trimws(x, "left")
      }
      x <- paste0("\n```{{", options[["original.params.src"]], "}}\n", yamlCode, x, '\n```')
    } else {
       attrs <- block_attr(
        id = id,
        lang = lang,
        class = trimws(class),
        attr = attr
      )

      # If requested, preserve the code yaml and emit it into the code blocks
      if (isTRUE(format$render$`produce-source-notebook`)) {
        yamlCode <- lastYamlCode
        if (!is.null(yamlCode)) {
          yamlCode <- paste(yamlCode, collapse = "\n")
          if (!nzchar(yamlCode)) {
            x <- trimws(x, "left")
          }
          x <- paste0("\n", yamlCode, x)
        }
      }
      ticks <- "```"
    }
    
    paste0('\n\n', ticks, attrs, x, '\n', ticks, '\n\n')   
  }
  knit_hooks$output <- delegating_output_hook("output", c("stdout"))
  knit_hooks$warning <- delegating_output_hook("warning", c("stderr"))
  knit_hooks$message <- delegating_output_hook("message", c("stderr"))
  knit_hooks$plot <- knitr_plot_hook(format)
  knit_hooks$error <- delegating_output_hook("error", c("error"))
  
  list(
    knit = knit_hooks,
    opts = opts_hooks
  )
}

knitr_plot_hook <- function(format) {

  htmlOutput <- knitr:::is_html_output(format$pandoc$to)
  latexOutput <- is_latex_output(format$pandoc$to)
  defaultFigPos <- format$render[["fig-pos"]]

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
      keyvalue <- c(keyvalue, sprintf("fig-align='%s'", fig.align))
    }
    fig.env <- options[['fig.env']]
    if (!identical(fig.env, "figure")) {
      keyvalue <- c(keyvalue, sprintf("fig-env='%s'", fig.env))
    }
    fig.pos <- options[['fig.pos']] 
    if (nzchar(fig.pos)) {
      keyvalue <- c(keyvalue, sprintf("fig-pos='%s'", fig.pos))
    # if we are echoing code, there is no default fig-pos, and
    # we are not using a layout then automatically set fig-pos to 'H'
    } else if (latexOutput &&
               isTRUE(options[["echo"]]) &&
               length(names(options)[startsWith(names(options), "layout")]) == 0 &&
               is.null(defaultFigPos)) {
      keyvalue <- c(keyvalue, "fig-pos='H'")
    }
    fig.alt <- options[["fig.alt"]]
    escapeAttr <- function(x) gsub("'", "\\'", x, fixed = TRUE)
    if (!is.null(fig.alt) && nzchar(fig.alt)) {
       keyvalue <- c(keyvalue, sprintf("fig-alt='%s'", escapeAttr(fig.alt)))
    }
    fig.scap <- options[['fig.scap']]
    if (!is.null(fig.scap)) {
      keyvalue <- c(keyvalue, sprintf("fig-scap='%s'", escapeAttr(fig.scap)))
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
      if (is_latex_output(format$pandoc$to)) {
        
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
      
      # result = "asis" specific
      if (identical(options[["results"]], "asis")) return(md)
      # enclose in output div 
      output_div(md, NULL, classes)
    }

  }
}

knitr_options_hook <- function(options) {

  if (!knitr_has_yaml_chunk_options()) {
    # partition yaml options
    results <- partition_yaml_options(options$engine, options$code)
    if (!is.null(results$yaml)) {
      # convert any option with fig- into fig. and out- to out.
      # we need to do this to the yaml options prior to merging
      # so that the correctly interact with standard fig. and
      # out. options provided within knitr
      results$yaml <- normalize_options(results$yaml)
      # alias 'warning' explicitly set here to 'message'
      if (!is.null(results$yaml[["warning"]])) {
        options[["message"]] = results$yaml[["warning"]]
      }
      # merge with other options
      options <- merge_list(options, results$yaml)
      # set code
      options$code <- results$code
    } 
    options[["yaml.code"]] <- results$yamlSource
    
  } else {
    # convert any option with fig- into fig. and out- to out.
    options <- normalize_options(options)
  }

  # some aliases not normalized
  if (!is.null(options[["fig-format"]])) {
    options[["dev"]] <- options[["fig-format"]]
  }
  if (!is.null(options[["fig-dpi"]])) {
    options[["dpi"]] <- options[["fig-dpi"]]
  }
  
  # if there are line annotations in the code then we need to 
  # force disable messages/warnings
  comment_chars <- engine_comment_chars(options$engine)
  pattern <- paste0(".*\\Q", comment_chars[[1]], "\\E\\s*",
                    "<[0-9]+>\\s*")
  if (length(comment_chars) > 1) {
    pattern <- paste0(pattern, ".*\\Q", comment_chars[[2]], "\\E\\s*")
  }
  pattern <- paste0(pattern, "$")
  if (any(grepl(pattern, options$code))) {
    options$warning <- FALSE
    options$results <- "hold" 
  }


  # fig.subcap: TRUE means fig.subcap: "" (more natural way 
  # to specify that empty subcaps are okay)
  if (isTRUE(options[["fig.subcap"]])) {
    options[["fig.subcap"]] <- ""
  }
  
  # return options  
  options
}

# convert any option with e.g. fig- into fig. 
# we do this so that all downstream code can consume a single
# variation of these functions. We support both syntaxes because
# quarto/pandoc generally uses - as a delimeter everywhere,
# however we want to support all existing knitr code as well
# as support all documented knitr chunk options without the user
# needing to replace . with -
normalize_options <- function(options) {
  knitr_options_dashed <- c(
    # Text output 
    "strip-white",
    "class-output",
    "class-message",
    "class-warning",
    "class-error",
    "attr-output",
    "attr-message",
    "attr-warning",
    "attr-error",
    # Paged tables
    "max-print",
    "sql-max-print",
    "paged-print",
    "rows-print",
    "cols-print",
    "cols-min-print",
    "pages-print",
    "paged-print",
    "rownames-print",
    # Code decoration
    "tidy-opts",
    "class-source",
    "attr-source",
    # Cache
    "cache-path",
    "cache-vars",
    "cache-globals",
    "cache-lazy",
    "cache-comments",
    "cache-rebuild",
    # Plots
    "fig-path",
    "fig-keep",
    "fig-show",
    "dev-args",
    "fig-ext",
    "fig-width",
    "fig-height",
    "fig-asp",
    "fig-dim",
    "out-width",
    "out-height",
    "out-extra",
    "fig-retina",
    "resize-width",
    "resize-height",
    "fig-align",
    "fig-link",
    "fig-env",
    "fig-cap",
    "fig-alt",
    "fig-scap",
    "fig-lp",
    "fig-pos",
    "fig-subcap",
    "fig-ncol",
    "fig-sep",
    "fig-process",
    "fig-showtext",
    # Animation
    "animation-hook",
    "ffmpeg-bitrate",
    "ffmpeg-format",
    # Code chunk
    "ref-label",
    # Language engines
    "engine-path",
    "engine-opts",
    "opts-label",
    # Other chunk options
    "R-options"
  )
  # Un-normalized knitr options, and replace any existing options
  for (name in knitr_options_dashed) {
    if (name %in% names(options)) {
      options[[gsub("-", ".", name)]] <- options[[name]]
      options[[name]] <- NULL
    }
  }
  options
}


partition_yaml_options <- function(engine, code) {
  # mask out empty blocks
  if (length(code) == 0) {
    return(list(
      yaml = NULL,
      yamlSource = NULL,
      code = code
    ))
  }
  comment_chars <- engine_comment_chars(engine)
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
      yamlSource <- code
      code <- c()
    } else {
      last_match <- which.min(matched_lines) - 1
      yamlSource <- code[1:last_match]
      code <- code[(last_match+1):length(code)]
    }
    
    # trim right
    if (any(match_end)) {
      yamlSource <- trimws(yamlSource, "right")
    }
  
    # extract yaml from comments, then parse it
    yaml <- substr(yamlSource, 
                   nchar(comment_start) + 1, 
                   nchar(yamlSource) - nchar(comment_end))
    yaml_options <- yaml::yaml.load(yaml, eval.expr = TRUE)
    if (!is.list(yaml_options) || length(names(yaml_options)) == 0) {
      warning("Invalid YAML option format in chunk: \n", paste(yaml, collapse = "\n"), "\n")
      yaml_options <- list()
    }
    
    # extract code
    if (length(code) > 0 && knitr:::is_blank(code[[1]])) {
      code <- code[-1]
      yamlSource <- c(yamlSource, "")
    }
    
    list(
      yaml = yaml_options,
      yamlSource = yamlSource,
      code = code
    )
  } else {
    list(
      yaml = NULL,
      yamlSource = NULL,
      code = code
    )
  }
}

engine_comment_chars <- function(engine) {
  comment_chars <- list(
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
    dot = "//",
    apl = "\u235D"
  )
  comment_chars[[engine]] %||% "#"
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
    x,
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
    if (length(fig.subcap) != 0)
      fig.subcap
    else if (length(fig.cap) != 0)
      fig.cap
    else
      ""
  } else {
    ""
  }
}


output_label <- function(options) {
  label <- options[["label"]]
  if (!is.null(label) && grepl("^#?(fig)-", label)) {
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

is_latex_output <- function(to) {
  knitr:::is_latex_output() || identical(to, "pdf")
}

is_ipynb_output <- function(to) {
  identical(to, "ipynb")
}
