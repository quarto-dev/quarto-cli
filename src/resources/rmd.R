
# read input from stdin
stdin <- file("stdin", "r")
input <- readLines(stdin, warn = FALSE)
close(stdin)

# parse json
params <- jsonlite::parse_json(input)
format <- params$format

 # add post_processor for yaml preservation
post_processor <- function(metadata, input_file, output_file, clean, verbose) {
  input_lines <- rmarkdown:::read_utf8(input_file)
  partitioned <- rmarkdown:::partition_yaml_front_matter(input_lines)
  if (!is.null(partitioned$front_matter)) {
    output_lines <- c(partitioned$front_matter, "", read_utf8(output_file))
    rmarkdown:::write_utf8(output_lines, output_file)
  }
  output_file
}

# synthesize output format
library(rmarkdown)

knit_hooks <- list()

opts_knit <- list(
  quarto.version = 1,
  rmarkdown.pandoc.from = format$pandoc$from,
  rmarkdown.pandoc.to = format$pandoc$to,
  rmarkdown.pandoc.args = format$pandoc$args,
  rmarkdown.keep_md = format$keep_md,
  rmarkdown.version = 2,
  rmarkdown.runtime = "static"
)

opts_chunk <- list(
  dev = format$preprocessor$fig_format,
  fig_width = format$preprocessor$fig_width,
  fig_height = format$preprocessor$fig_height,
  dpi = format$preprocessor$fig_dpi,
  echo = !format$preprocessor$hide_code,
  warning = format$preprocessor$show_warnings,
  message = format$preprocessor$show_messages,
  # TODO: should these be configurable?
  fig_retina = 2,
  comment = NA
)

if (opts_chunk$dev == 'pdf') {
  # set the dingbats option for the pdf device if required
  opts_chunk$dev.args <- list(pdf = list(useDingbats = FALSE))

  # apply cropping if requested and we have pdfcrop and ghostscript
  crop <- find_program("pdfcrop") != '' && tools::find_gs_cmd() != ''
  if (crop) {
    knit_hooks$crop = knitr::hook_pdfcrop
    opts_chunk$crop = TRUE
  }
}

knitr <- knitr_options(
  opts_knit = opts_knit,
  opts_chunk = opts_chunk,
  knit_hooks = knit_hooks
)

str(format$pandoc)

pandoc <- pandoc_options(
  to = format$pandoc$to,
  from = format$pandoc$from,
  args = format$pandoc$args,
  keep_tex = format$keep_tex,
  ext = format$pandoc$ext
)

output_format <- output_format(
  knitr = knitr,
  pandoc = pandoc,
  post_processor = post_processor,
  keep_md = format$keep_md,
  clean_supporting = format$clean_supporting
)

# run knitr but not pandoc
md_result <- rmarkdown::render(
  input = params$input,
  output_format = output_format,
  run_pandoc = FALSE
)

# rename the markdown file
invisible(file.rename(file.path(dirname(input), md_result), params$output))

# write the result to stdout
resultJson <- jsonlite::toJSON(list(
  knit_meta = attr(md_result, "knit_meta"),
  intermediates = attr(md_result, "intermediates")
))
cat(resultJson)






