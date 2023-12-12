# patch.R
# Copyright (C) 2020-2022 Posit Software, PBC

# check whether knitr has native yaml chunk option parsing
knitr_has_yaml_chunk_options <- function() {
  utils::packageVersion("knitr") >= "1.37.2"
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

if (!knitr_has_yaml_chunk_options()) {
  # override parse_block to assign chunk labels from yaml options
  knitr_parse_block <- knitr:::parse_block
  parse_block = function(code, header, params.src, markdown_mode = out_format('markdown')) {
    originalParamsSrc <- params.src
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
    for (opt in c("ref.label", "ref-label")) {
      if (!is.null(partitioned$yaml[[opt]])) {
        value <- partitioned$yaml[[opt]]
        opt <- sub("-", ".", opt)
        extra_opts[[opt]] <- paste(gsub("\n", " ", deparse(value, 
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
    block <- knitr_parse_block(code, header, params.src, markdown_mode)
    block[["params"]][["original.params.src"]] <- originalParamsSrc
    block[["params"]][["chunk.echo"]] <- isTRUE(params[["echo"]]) || 
      isTRUE(partitioned$yaml[["echo"]])
    block
  }
  assignInNamespace("parse_block", parse_block, ns = "knitr")
}

# override wrapping behavior for knitr_asis output (including htmlwidgets)
# to provide for enclosing output div and support for figure captions
wrap_asis_output <- function(options, x) {

  # if the options are empty then this is inline output, return unmodified
  if (length(options) == 0) {
    return(x)
  }

  # generate output div
  caption <- figure_cap(options)[[1]]
  if (nzchar(caption)) {
    x <- paste0(x, "\n\n", caption)
  }
  classes <- paste0("cell-output-display")
  attrs <- NULL
  if (isTRUE(options[["output.hidden"]]))
    classes <- paste0(classes, " .hidden")

  if (identical(options[["html-table-processing"]], "none")) {
    attrs <- paste(attrs, "html-table-processing=none")
  }
  
  # if this is an html table then wrap it further in ```{=html}
  # (necessary b/c we no longer do this by overriding kable_html,
  # which is in turn necessary to allow kableExtra to parse
  # the return value of kable_html as valid xml)
  if (grepl("^<\\w+[ >]", x) && grepl("<\\/\\w+>\\s*$", x) && 
      !grepl('^<div class="kable-table">', x)) {
    x <- paste0("`````{=html}\n", x, "\n`````")
  }
  
  # If asis output, don't include the output div
  if (identical(options[["results"]], "asis")) return(x)

  output_div(x, output_label_placeholder(options), classes, attrs)
}

add_html_caption <- function(options, x, ...) {
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

    # some sew s3 methods take the default chunk options
    if (missing(options) && 
        inherits(x, c("knit_image_paths", "html_screenshot", "knit_embed_url"))) {
      options <- knitr::opts_chunk$get()
    }

    if (inherits(x, "knit_image_paths")) {
      knitr:::sew.knit_image_paths(x, options, ...)
    } else if (inherits(x, "knit_asis")) {
      # delegate
      is_html_widget <- inherits(x, "knit_asis_htmlwidget")
      # knit_asis method checks on missing options which 
      # it gets in knitr because UseMethod() is called in generic
      # but here we pass our default empty list options
      x <- if (missing(options)) {
        knitr:::sew.knit_asis(x, ...)
      } else {
        knitr:::sew.knit_asis(x, options, ...)
      }

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
    } else if (inherits(x, "rglRecordedplot") && requireNamespace("rgl")) {
      rgl:::sew.rglRecordedplot(x, options, ...)
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


# add special language comment options support in knitr
# it was added in 1.46 but we need to support older version too
# https://github.com/quarto-dev/quarto-cli/pull/7799
# FIXME: can be cleaned when knitr 1.45 is considered too old
if (knitr_has_yaml_chunk_options() && utils::packageVersion("knitr") <= "1.45") {
  knitr_comment_chars <- knitr:::comment_chars
  knitr_comment_chars$ojs <- "//"
  knitr_comment_chars$mermaid <- "%%"
  knitr_comment_chars$dot <- "//"
  assignInNamespace("comment_chars", knitr_comment_chars, ns = "knitr")
}