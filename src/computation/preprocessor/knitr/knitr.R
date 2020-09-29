
# read args
args <- commandArgs(trailingOnly = TRUE)[-1]
input <- args[[1]]
output <- args[[2]]

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
  pandoc = pandoc_options
)

# run knitr but not pandoc
md_result <- rmarkdown::render(
  input = input,
  output_format = output_format,
  run_pandoc = FALSE
)

# rename the markdown file
invisible(file.rename(file.path(dirname(input), md_result), output))


