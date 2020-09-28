#!/usr/bin/env conda run -n quarto-cli python

import sys
import nbformat
import nbconvert

# read args
input = sys.argv[1]
output = sys.argv[2]

# convert to markdown
notebook_node = nbformat.read(input, as_version=4)
md_exporter = nbconvert.MarkdownExporter()
result = md_exporter.from_notebook_node(notebook_node)
markdown = result[0]

# write markdown 
with open(output, "w") as file:
   file.write(markdown)

