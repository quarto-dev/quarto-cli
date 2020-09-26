
# read args
args <- commandArgs(trailingOnly = TRUE)[-1]
input <- args[[1]]
output <- args[[2]]

# convert to markdown
knitr::opts_chunk$set(comment = NA)
knitr::knit(input, output)




