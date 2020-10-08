
library(rmarkdown)

# utility functions
`%||%` <- function(x, y) {
  if (is.null(x)) y else x
}

# read input from stdin
stdin <- file("stdin", "r")
input <- readLines(stdin, warn = FALSE)
close(stdin)

# parse json
params <- jsonlite::parse_json(input)
format <- params$format

#  post_processor for saving metadata and yaml preservation
runtime <- NULL
post_processor <- function(metadata, input_file, output_file, clean, verbose) {
  runtime <<- metadata$runtime %||% "static"
  input_lines <- rmarkdown:::read_utf8(input_file)
  partitioned <- rmarkdown:::partition_yaml_front_matter(input_lines)
  if (!is.null(partitioned$front_matter)) {
    output_lines <- c(partitioned$front_matter, "", read_utf8(output_file))
    rmarkdown:::write_utf8(output_lines, output_file)
  }
  output_file
}

# create output format

# may need some knit hooks
knit_hooks <- list()

# opt_knit for compatibility w/ rmarkdown::render
opts_knit <- list(
  quarto.version = 1,
  rmarkdown.pandoc.from = format$pandoc$reader,
  rmarkdown.pandoc.to = format$pandoc$writer,
  rmarkdown.version = 3,
  rmarkdown.runtime = "static"
)

# opts_chunk
opts_chunk <- list(
  # options derived from format
  dev = format$figure$format,
  fig_width = format$figure$width,
  fig_height = format$figure$height,
  dpi = format$figure$dpi,
  echo = format$show$code,
  warning = format$show$warning,
  message = format$show$warning,
  error = format$show$error,
  # hard coded (overiddeable in setup chunk but not format)
  fig_retina = 2,
  comment = NA
)

# set the dingbats option for the pdf device if required
if (opts_chunk$dev == 'pdf')
  opts_chunk$dev.args <- list(pdf = list(useDingbats = FALSE))

# apply cropping if requested and we have pdfcrop and ghostscript
if (identical(format$output$ext, "pdf")) {
  crop <- rmarkdown:::find_program("pdfcrop") != '' && tools::find_gs_cmd() != ''
  if (crop) {
    knit_hooks$crop = knitr::hook_pdfcrop
    opts_chunk$crop = TRUE
  }
}


# knitr_options
knitr <- knitr_options(
  opts_knit = opts_knit,
  opts_chunk = opts_chunk,
  knit_hooks = knit_hooks
)

# note: pandoc_options args is used for various r-specific scenarios:
#   - https://github.com/rstudio/rmarkdown/pull/1468
#   - force an id-prefix for runtime: shiny
# we don't provide them here b/c we manage interaction w/ pandoc not
# rmarkdown::render. note though that we do pass a --to argument to
# work around an issue w/ rmarkdown where at least 1 argument
# must be passed or there is a runtime error

# pandoc_options
pandoc <- pandoc_options(
  to = format$pandoc$writer,
  from = format$pandoc$reader,
  args = c("--to", format$pandoc$writer),
  keep_tex = FALSE
)

# create format
output_format <- output_format(
  knitr = knitr,
  pandoc = pandoc,
  post_processor = post_processor,
  keep_md = FALSE,
  clean_supporting = FALSE
)

# run knitr but not pandoc
md_result <- rmarkdown::render(
  input = params$input,
  output_format = output_format,
  run_pandoc = FALSE
)

# rename the markdown file
invisible(file.rename(
  file.path(dirname(params$input), md_result),
  params$output
))

# get knit_meta and the files_dir
knit_meta <-  attr(md_result, "knit_meta")
files_dir <- attr(md_result, "files_dir")

# get args for extras (e.g. html dependencies)
extras <- rmarkdown:::html_extras_for_document(
  knit_meta,
  runtime,
  rmarkdown:::html_dependency_resolver,
  list() # format deps
)
# convert dependencies to in_header
dependencies <- extras$dependencies
if (length(dependencies) > 0) {
  deps <- rmarkdown:::html_dependencies_as_string(dependencies, files_dir, dirname(params$input))
  extras$dependencies <- NULL
  extras$in_header <- paste0(extras$in_header, "\n", deps)
}

# write the results the results file
resultJson <- jsonlite::toJSON(list(
  # (No method asJSON S3 class: html_dependency)
  files_dir = attr(md_result, "files_dir"),
  includes = extras
))
xfun:::write_utf8(paste(resultJson, collapse = "\n"), params$result)







