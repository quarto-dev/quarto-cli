# ipynb.py
#
# Copyright (C) 2020 by RStudio, PBC
#
# Unless you have received this program directly from RStudio pursuant
# to the terms of a commercial license agreement with RStudio, then
# this program is licensed to you under the terms of version 3 of the
# GNU General Public License. This program is distributed WITHOUT
# ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
# MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
# GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.

import os
import sys
import nbformat
import nbconvert
import json
from pathlib import Path

# read args
input = sys.argv[1]
output = sys.argv[2]

# change working directory and strip dir off of paths
os.chdir(Path(input).parent)
input = Path(input).name
output = Path(output).name

# output dir
files_dir = Path(output).stem + "_files"
output_dir = files_dir + "/figure-ipynb"

# convert to markdown
notebook_node = nbformat.read(input, as_version=4)
md_exporter = nbconvert.MarkdownExporter()
result = md_exporter.from_notebook_node(
  notebook_node, 
  resources = { "output_files_dir": output_dir}
)
markdown = result[0]

# write the figures
resources = result[1]
outputs = resources["outputs"]
for path, data in outputs.items():
   with open(path, "wb") as file:
      file.write(data)

# write markdown 
with open(output, "w") as file:
   file.write(markdown)

# return result
result = {
   "supporting": [files_dir],
   "includes": {},
   "postprocess": None
}
json.dump(result, sys.stdout)


