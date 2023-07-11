version <- getRversion()
cat("--- JSON_START ---\n")
cat("versionMajor:", version$major, "\n")
cat("versionMinor:", version$minor, "\n")
cat("versionPatch:", version$patch, "\n")
cat("home:", R.home(), "\n")
cat("libPaths:\n")
for (lib in .libPaths()) {
  cat(paste0('  - ', shQuote(lib)), "\n")
}
cat("packages:\n")
cat("  knitr: ")
if (requireNamespace("knitr", quietly = TRUE)) {
  cat(paste0('\"', as.character(utils::packageVersion("knitr")), '\"'))
} else {
  cat("null")
}
cat("\n")
cat("  rmarkdown: ")
if (requireNamespace("rmarkdown", quietly = TRUE)) {
  cat(paste0('\"', as.character(utils::packageVersion("rmarkdown")), '\"'))
} else {
  cat("null")
}
cat("\n")
cat("--- JSON_END ---\n")