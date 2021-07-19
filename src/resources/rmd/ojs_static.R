ojs_define <- function(...) {
  quos <- rlang::enquos(...)
  vars <- rlang::list2(...)
  nm <- names(vars)
  if (is.null(nm)) {
    nm <- rep_len("", length(vars))
  }
  knitr:::knit_print(knitr:::asis_output(
    c("<script type=\"ojs-define\">",
      jsonlite::toJSON(list(contents = I(mapply(
        function(q, nm, val) {
          # Infer name, if possible
          if (nm == "") {
            tryCatch({
              nm <- rlang::as_name(q)
            }, error = function(e) {
              code <- paste(collapse = "\n", deparse(rlang::f_rhs(q)))
              stop("ojs_define() could not create a name for the argument: ", code)
            })
          }
          list(name=nm, value=val)
        }, quos, nm, vars, SIMPLIFY = FALSE, USE.NAMES=FALSE))),
        dataframe = "columns", null = "null", na = "null", auto_unbox = TRUE),
      "</script>")));
}
