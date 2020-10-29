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
from traitlets import Bool, Set, Unicode
from traitlets.config import Config
from nbconvert.preprocessors import Preprocessor


class RemovePreprocessor(Preprocessor):
   
   # default show behavior
   include_input = Bool(True).tag(config=True)
   include_output = Bool(True).tag(config=True)

   include_input_tags = Set({'include-input'})
   include_output_tags = Set({'include-output'})
   remove_cell_tags = Set({'remove-cell'})
   remove_output_tags = Set({'remove-output'})
   remove_input_tags = Set({'remove-input'})
   remove_metadata_fields = Set({'collapsed', 'scrolled'})

   def check_cell_conditions(self, cell, resources, index):
      # Return true if any of the tags in the cell are removable.
      return not self.remove_cell_tags.intersection(cell.get('metadata', {}).get('tags', []))

   def preprocess(self, nb, resources):
      # Skip preprocessing if the list of patterns is empty
      if not any([self.remove_cell_tags,
                  self.remove_output_tags,
                  self.remove_input_tags
                  ]):
         return nb, resources

      # Filter out cells that meet the conditions
      nb.cells = [self.preprocess_cell(cell, resources, index)[0]
                  for index, cell in enumerate(nb.cells)
                  if self.check_cell_conditions(cell, resources, index)]

      return nb, resources

   def preprocess_cell(self, cell, resources, cell_index): 

      if (cell.cell_type == 'code'):

         tags = cell.get('metadata', {}).get('tags', [])

         if ((not self.include_output and not bool(self.include_output_tags.intersection(tags)))
               or bool(self.remove_output_tags.intersection(tags))):

            cell.outputs = []
            cell.execution_count = None
            # Remove metadata associated with output
            if 'metadata' in cell:
               for field in self.remove_metadata_fields:
                  cell.metadata.pop(field, None)
            
         if ((not self.include_input and not bool(self.include_input_tags.intersection(tags)))
              or bool(self.remove_input_tags.intersection(tags))):

            cell.transient = { 'remove_source': True }
       
      return cell, resources


# read args from stdin
input_json = json.load(sys.stdin)
input = input_json["input"]
output = input_json["output"]
format = input_json["format"]

# change working directory and strip dir off of paths
os.chdir(Path(input).parent)
input = Path(input).name
output = Path(output).name

# output dir
files_dir = Path(input).stem + "_files"
output_dir = files_dir + "/figure-ipynb"
Path(output_dir).mkdir(parents=True, exist_ok=True)

# setup removal preprocessor
config = Config()
config.RemovePreprocessor.include_input = bool(format["execute"]["include-input"])
config.RemovePreprocessor.include_output = bool(format["execute"]["include-output"])
config.MarkdownExporter.preprocessors = [RemovePreprocessor]

# convert to markdown
notebook_node = nbformat.read(input, as_version=4)
md_exporter = nbconvert.MarkdownExporter(config = config)
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
   "pandoc": {},
   "postprocess": None
}
json.dump(result, sys.stdout)

