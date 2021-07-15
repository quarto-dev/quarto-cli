ojs_define <- function(..., .session = shiny::getDefaultReactiveDomain()) {
  quos <- rlang::enquos(...)
  vars <- rlang::list2(...)
  nm <- names(vars)
  if (is.null(nm)) {
    nm <- rep_len("", length(vars))
  }
  mapply(function(q, nm, val) {
    # Infer name, if possible
    if (nm == "") {
      tryCatch({
        nm <- rlang::as_name(q)
      }, error = function(e) {
        code <- paste(collapse = "\n", deparse(rlang::f_rhs(q)))
        stop("ojs_define() could not create a name for the argument: ", code)
      })
    }
    .session$output[[nm]] <- val
    outputOptions(.session$output, nm, suspendWhenHidden = FALSE)
    .session$sendCustomMessage("ojs-export", list(name = nm))
    NULL
  }, quos, nm, vars, SIMPLIFY = FALSE, USE.NAMES = FALSE)
  invisible()
}
