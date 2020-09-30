
# read args
args <- commandArgs(trailingOnly = TRUE)[-1]
input <- args[[1]]
output <- args[[2]]

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
knitr_options <- knitr_options_html(
  fig_width = 7,
  fig_height = 5,
  fig_retina = 2,
  FALSE,
  dev = "png"
)
pandoc_options <- pandoc_options(
  to = "html"
)
output_format <- output_format(
  knitr = knitr_options,
  pandoc = pandoc_options,
  post_processor = post_processor
)

# run knitr but not pandoc
md_result <- rmarkdown::render(
  input = input,
  output_format = output_format,
  run_pandoc = FALSE
)

# rename the markdown file
invisible(file.rename(file.path(dirname(input), md_result), output))


