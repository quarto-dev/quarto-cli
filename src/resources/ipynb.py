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
import pprint
from pathlib import Path
from traitlets import Float, Bool, Set, Unicode
from traitlets.config import Config
from nbconvert.preprocessors import Preprocessor
from nbconvert.preprocessors import ExecutePreprocessor

# see discussion at: https://github.com/mwouts/jupytext/issues/337
#   'remove-input' for compatiblity with jupyterbook
#   'remove_*' for compatibility w/ runtools
#   'raises-exception' for compatibility w/ nbconvert ExecutePreprocessor

# execute options:
#   run-code
#   allow-errors   
#   include-code         
#   include-output
#   include-warnings
      
# cell tags:
#   include-code         
#   include-output  
#   include-warnings
#   remove-code          [remove-input, remove_input]
#   remove-output        [remove_output]
#   remove-warnings
#   remove-cell          [remove_cell]
#   allow-errors         [raises-exception]



def main():

   # read args from stdin
   input_json = json.load(sys.stdin)
   input = input_json["input"]
   output = input_json["output"]
   format = input_json["format"]
   run_path = input_json.get("cwd", "")
   quiet = input_json.get('quiet', False)

   # change working directory and strip dir off of paths
   os.chdir(Path(input).parent)
   input = Path(input).name
   output = Path(output).name

   # execute notebook
   notebook_execute(input, format, run_path, quiet)

   # export to markdown
   files_dir = notebook_to_markdown(input, output, format)

   # return result
   result = {
      "supporting": [files_dir],
      "pandoc": {},
      "postprocess": None
   }
   json.dump(result, sys.stdout)


def notebook_execute(input, format, run_path, quiet):

   # progress
   if not quiet:
      sys.stderr.write("\nExecuting '{0}'\n".format(input))

    # read variables out of format
   fig_width = format["execute"]["fig-width"]
   fig_height = format["execute"]["fig-height"]

    # set environment variables
   os.environ["JUPYTER_FIG_WIDTH"] = str(fig_width)
   os.environ["JUPYTER_FIG_HEIGHT"] = str(fig_height)

   # execution config
   execConfig = Config()
   execConfig.JupyterApp.answer_yes = True

   # execute notebook in place
   execConfig.NbConvertApp.use_output_suffix = False
   execConfig.NbConvertApp.export_format = "notebook"
   execConfig.FilesWriter.build_directory = ""
   execConfig.ClearOutputPreprocessor.enabled = True

   # NotebookClient config
   execConfig.QuartoExecutePreprocessor.record_timing = False
   execConfig.QuartoExecutePreprocessor.allow_errors = bool(format["execute"]["allow-errors"])
   # QuartoExecutePreprocessor confiug
   execConfig.QuartoExecutePreprocessor.fig_width = fig_width
   execConfig.QuartoExecutePreprocessor.fig_height = fig_height
   execConfig.QuartoExecutePreprocessor.include_warnings = bool(format["execute"]["include-warnings"])
   execConfig.QuartoExecutePreprocessor.quiet = quiet
   # Enable our custom ExecutePreprocessor
   execConfig.ExecutePreprocessor.enabled = False
   execConfig.NotebookExporter.preprocessors = [QuartoExecutePreprocessor]

   # provide resources
   resources = dict()
   if run_path:
      resources["metadata"] = { "path": run_path }

   # do the export
   nb_exporter = nbconvert.NotebookExporter(config = execConfig)
   notebook_node = nbformat.read(input, as_version=4)
   (outputstr, _) = nbconvert.exporters.export(
      nb_exporter, 
      notebook_node, 
      config = execConfig, 
      resources = resources
   )

   # re-write contents back to input file
   with open(input, "w") as file:
      file.write(outputstr)

   if not quiet:
      sys.stderr.write("\n")


def notebook_to_markdown(input, output, format):

   # ...now export to markdown
   mdConfig = Config()

   # setup removal preprocessor
   mdConfig.RemovePreprocessor.include_code = bool(format["execute"]["include-code"])
   mdConfig.RemovePreprocessor.include_output = bool(format["execute"]["include-output"])
   mdConfig.MarkdownExporter.preprocessors = [RemovePreprocessor]

   # setup output dir
   files_dir = Path(input).stem + "_files"
   output_dir = files_dir + "/figure-ipynb"
   Path(output_dir).mkdir(parents=True, exist_ok=True)

   # run conversion
   notebook_node = nbformat.read(input, as_version=4)
   md_exporter = nbconvert.MarkdownExporter(config = mdConfig)
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

   # return files_dir
   return files_dir

class QuartoExecutePreprocessor(ExecutePreprocessor):

   fig_width = Float(7).tag(config=True)
   fig_height = Float(5).tag(config=True)
   include_warnings = Bool(True).tag(config=True)
   quiet = Bool(False).tag(config=True)
   
   no_execute_tags = Set({'no-execute'})
   allow_errors_tags = Set({'allow-errors'})
   include_warnings_tags = Set({'include-warnings'})
   remove_warnings_tags = Set({'remove-warnings'})

   total_code_cells = 0
   current_code_cell = 0

   def preprocess(self, nb, resources=None, km=None):

      # lookup kernel language and any injectableCode
      kernelLanguage = nb.metadata.kernelspec.language
      cell_code = ''
      if kernelLanguage in kInjectableCode:
         cell_code = kInjectableCode[kernelLanguage].format(self.fig_width, self.fig_height)  

      # figure cell
      cell = nbformat.v4.new_code_cell(
         source=cell_code, 
         metadata={'lines_to_next_cell': cell_code.count("\n") + 1, 'tags': ['raises-exception']})
      nb.cells.insert(0, cell)

      # compute total code cells (for progress)
      self.total_code_cells = sum(cell.cell_type == 'code' for cell in nb.cells) - 1

      # delegate to super
      result = super().preprocess(nb, resources, km)

      # remove injected cell
      nb.cells.pop(0)

      return result

   def preprocess_cell(self, cell, resources, index):

      # get active tags
      tags = cell.get('metadata', {}).get('tags', [])
     
      # execute unless the 'no-execute' tag is active
      if (not bool(self.no_execute_tags.intersection(tags))):
         
         # if we see 'allow-errors' then add 'raises-exception'
         if (bool(self.allow_errors_tags.intersection(tags))):
            cell.metatata = cell.get('metadata', {})
            cell.metadata.tags = tags + ['raises-exception'] 

         # progress 
         progress = not self.quiet and cell.cell_type == 'code' and self.current_code_cell > 0
         if progress:
            sys.stderr.write("  Cell {0}/{1}...".format(
               self.current_code_cell, self.total_code_cells)
            )

         # execute
         cell, resources = super().preprocess_cell(cell, resources, index)

         # filter warnings if requested
         if "outputs" in cell:
            if ((not self.include_warnings and not bool(self.include_warnings_tags.intersection(tags)))
                or bool(self.remove_warnings_tags.intersection(tags))):
               cell["outputs"] = list(filter(warningFilter, cell["outputs"]))

         # remove injected raises-exception
         if (bool(self.allow_errors_tags.intersection(tags))):
            cell.metatata.tags.remove('raises-exception')

         # end progress
         if progress:
            sys.stderr.write("Done\n")  

         # bump code cell
         if cell.cell_type == 'code':  
            self.current_code_cell += 1
      
      # return 
      return cell, resources
     

class RemovePreprocessor(Preprocessor):
   
   # default show behavior
   include_code = Bool(True).tag(config=True)
   include_output = Bool(True).tag(config=True)

   # available tags 
   include_code_tags = Set({'include-code'})
   include_output_tags = Set({'include-output'})
   remove_cell_tags = Set({'remove-cell', 'remove_cell'})
   remove_output_tags = Set({'remove-output', 'remove_output'})
   remove_code_tags = Set({'remove-code', 'remove-input', 'remove_input'})
   remove_metadata_fields = Set({'collapsed', 'scrolled'})
  
   def check_cell_conditions(self, cell, resources, index):
      # Return true if any of the tags in the cell are removable.
      return not self.remove_cell_tags.intersection(cell.get('metadata', {}).get('tags', []))

   def preprocess(self, nb, resources):
      # Skip preprocessing if the list of patterns is empty
      if not any([self.remove_cell_tags,
                  self.remove_output_tags,
                  self.remove_code_tags
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
            
         if ((not self.include_code and not bool(self.include_code_tags.intersection(tags)))
              or bool(self.remove_code_tags.intersection(tags))):

            cell.transient = { 'remove_source': True }

         
       
      return cell, resources


def warningFilter(output):
   return output["output_type"] != "stream" or output["name"] != "stderr"

kInjectableCode = { 'python' : "import matplotlib.pyplot as plt\nplt.rc('figure',figsize = ({0},{1}), dpi=96)"}



# run
main()
