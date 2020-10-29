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
from traitlets import Set, Unicode
from traitlets.config import Config
from nbconvert.preprocessors import Preprocessor


class RemovePreprocessor(Preprocessor):
    """
    Removes inputs, outputs, or cells from a notebook that
    have tags that designate they are to be removed prior to exporting
    the notebook.

    remove_cell_tags
        removes cells tagged with these values

    remove_all_outputs_tags
        removes entire output areas on cells
        tagged with these values

    remove_single_output_tags
        removes individual output objects on
        outputs tagged with these values

    remove_input_tags
        removes inputs tagged with these values
    """

    remove_cell_tags = Set(Unicode(), default_value=[],
            help=("Tags indicating which cells are to be removed,"
                  "matches tags in ``cell.metadata.tags``.")).tag(config=True)
    remove_all_outputs_tags = Set(Unicode(), default_value=[],
            help=("Tags indicating cells for which the outputs are to be removed,"
                  "matches tags in ``cell.metadata.tags``.")).tag(config=True)
    remove_single_output_tags = Set(Unicode(), default_value=[],
            help=("Tags indicating which individual outputs are to be removed,"
                  "matches output *i* tags in ``cell.outputs[i].metadata.tags``.")
            ).tag(config=True)
    remove_input_tags = Set(Unicode(), default_value=[],
            help=("Tags indicating cells for which input is to be removed,"
                  "matches tags in ``cell.metadata.tags``.")).tag(config=True)
    remove_metadata_fields = Set(
        {'collapsed', 'scrolled'}
    ).tag(config=True)

    def check_cell_conditions(self, cell, resources, index):
        """
        Checks that a cell has a tag that is to be removed

        Returns: Boolean.
        True means cell should *not* be removed.
        """

        # Return true if any of the tags in the cell are removable.
        return not self.remove_cell_tags.intersection(
                cell.get('metadata', {}).get('tags', []))

    def preprocess(self, nb, resources):
        """
        Preprocessing to apply to each notebook. See base.py for details.
        """
        # Skip preprocessing if the list of patterns is empty
        if not any([self.remove_cell_tags,
                    self.remove_all_outputs_tags,
                    self.remove_single_output_tags,
                    self.remove_input_tags
                    ]):
            return nb, resources

        # Filter out cells that meet the conditions
        nb.cells = [self.preprocess_cell(cell, resources, index)[0]
                    for index, cell in enumerate(nb.cells)
                    if self.check_cell_conditions(cell, resources, index)]

        return nb, resources

    def preprocess_cell(self, cell, resources, cell_index):
        """
        Apply a transformation on each cell. See base.py for details.
        """
        
        if (self.remove_all_outputs_tags.intersection(
            cell.get('metadata', {}).get('tags', []))
            and cell.cell_type == 'code'):

            cell.outputs = []
            cell.execution_count = None
            # Remove metadata associated with output
            if 'metadata' in cell:
                for field in self.remove_metadata_fields:
                    cell.metadata.pop(field, None)
        
        if (self.remove_input_tags.intersection(
                cell.get('metadata', {}).get('tags', []))):
            cell.transient = {
                'remove_source': True
                }

        if cell.get('outputs', []):
            cell.outputs = [output
                            for output_index, output in enumerate(cell.outputs)
                            if self.check_output_conditions(output,
                                                            resources,
                                                            cell_index,
                                                            output_index)
                            ]
        return cell, resources

    def check_output_conditions(self, output, resources,
                                cell_index, output_index):
        """
        Checks that an output has a tag that indicates removal.

        Returns: Boolean.
        True means output should *not* be removed.
        """
        return not self.remove_single_output_tags.intersection(
                output.get('metadata', {}).get('tags', []))
   

# read args
input = sys.argv[1]
output = sys.argv[2]

# change working directory and strip dir off of paths
os.chdir(Path(input).parent)
input = Path(input).name
output = Path(output).name

# output dir
files_dir = Path(input).stem + "_files"
output_dir = files_dir + "/figure-ipynb"
Path(output_dir).mkdir(parents=True, exist_ok=True)

# setup for cell/output/input tags
config = Config()
config.MarkdownExporter.preprocessors = [RemovePreprocessor]
config.RemovePreprocessor.enabled = True
config.RemovePreprocessor.remove_cell_tags = ("remove-cell",)
config.RemovePreprocessor.remove_all_outputs_tags = ('remove-output',)
config.RemovePreprocessor.remove_input_tags = ('remove-input',)

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
   "includes": {},
   "postprocess": None
}
json.dump(result, sys.stdout)

