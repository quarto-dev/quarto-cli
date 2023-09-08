ojs_define <- function(...) {
  # validate that we aren't in a cached chunk
  cache <- knitr:::opts_current$get("cache")
  if (is.numeric(cache) && cache > 0) {
    stop("ojs_define() cannot be cached\n",
      "Add cache: false to this cell's options to disable caching",
      call. = FALSE
    )
  }
  quos <- rlang::enquos(...)
  vars <- rlang::list2(...)
  nm <- names(vars)
  if (is.null(nm)) {
    nm <- rep_len("", length(vars))
  }
  contents <- jsonlite::toJSON(
    list(contents = I(mapply(
      function(q, nm, val) {
        # Infer name, if possible
        if (nm == "") {
          tryCatch(
            {
              nm <- rlang::as_name(q)
            },
            error = function(e) {
              code <- paste(collapse = "\n", deparse(rlang::f_rhs(q)))
              stop("ojs_define() could not create a name for the argument: ", code)
            }
          )
        }
        list(name = nm, value = val)
      }, quos, nm, vars,
      SIMPLIFY = FALSE, USE.NAMES = FALSE
    ))),
    dataframe = "columns", null = "null", na = "null", auto_unbox = TRUE
  )
  script_string <- c(
    "<script type=\"ojs-define\">",
    contents,
    "</script>"
  )

  # don't emit HTML output in PDF formats. (#2334)
  if (knitr:::is_html_output(quarto_format$pandoc$to)) {
    invisible(knitr:::knit_meta_add(list(structure(class = "ojs-define", script_string))))
  }
}
