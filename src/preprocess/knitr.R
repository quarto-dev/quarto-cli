
library(knitr)

args <- commandArgs(trailingOnly = TRUE)[-1]

input_file <- args[[1]]
output_file <- args[[2]]

knitr::opts_chunk$set(comment = NA)

knit(input_file, output_file)




