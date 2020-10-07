
library(rmarkdown)

# read args
args <- commandArgs(trailingOnly = TRUE)[-1]
input <- args[[1]]

# read file
text <- xfun::read_utf8(input)

# spin and write to stdout
xfun:::write_utf8(
  knitr::spin(text = text, knit = FALSE),
  con = stdout()
)
