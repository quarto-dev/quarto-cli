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
from nbclient import NotebookClient
import json
import pprint
from pathlib import Path
from traitlets import Float, Bool, Set, Unicode
from traitlets.config import Config
from nbconvert.preprocessors import Preprocessor

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


def notebook_convert(input, output, format, run_path, quiet):

   # execute notebook
   notebook_execute(input, format, run_path, quiet)

   # export to markdown
   files_dir = notebook_to_markdown(input, output, format)

   # return result
   return {
      "supporting": [files_dir],
      "pandoc": {},
      "postprocess": None
   }

def notebook_execute(input, format, run_path, quiet):

    # progress
   if not quiet:
      sys.stderr.write("\nExecuting '{0}'\n".format(input))

   # read variables out of format
   execute = format["execute"]
   allow_errors = bool(execute["allow-errors"])
   include_warnings = bool(execute["include-warnings"])
   fig_width = execute["fig-width"]
   fig_height = execute["fig-height"]

   # set environment variables
   os.environ["JUPYTER_FIG_WIDTH"] = str(fig_width)
   os.environ["JUPYTER_FIG_HEIGHT"] = str(fig_height)

   # read the notebook
   nb = nbformat.read(input, as_version = nbformat.current_nbformat)

   # create resources for execution
   resources = dict()
   if run_path:
      resources["metadata"] = { "path": run_path }

   # create NotebookClient
   client = NotebookClient(nb, resources = resources)
   client.allow_errors = allow_errors
   client.record_timing = False

   # run 
   with client.setup_kernel():
      # set language_info
      info_msg = client.wait_for_reply(client.kc.kernel_info())
      client.nb.metadata['language_info'] = info_msg['content']['language_info']

      # compute total code cells (for progress)
      current_code_cell = 1
      total_code_cells = sum(cell.cell_type == 'code' for cell in client.nb.cells)

      # insert setup cell
      setup_cell = nb_setup_cell(client, fig_width, fig_height)
      client.nb.cells.insert(0, setup_cell)

      # execute the cells
      for index, cell in enumerate(client.nb.cells):
         # progress
         progress = not quiet and cell.cell_type == 'code' and index > 0
         if progress:
            sys.stderr.write("  Cell {0}/{1}...".format(
               current_code_cell, total_code_cells)
            )

         # execute cell
         client.nb.cells[index] = cell_execute(
            client, 
            cell, 
            index, 
            include_warnings, 
            index > 0 # add_to_history
         )

         # end progress
         if progress:
            current_code_cell += 1
            sys.stderr.write("Done\n")  

      # remove setup cell
      client.nb.cells.pop(0)

   # set widgets metadata   
   client.set_widgets_metadata()

   # get notebook as string
   outputstr = nbformat.writes(client.nb, version = nbformat.current_nbformat)
   if not outputstr.endswith("\n"):
      outputstr = outputstr + "\n"

   # re-write contents back to input file
   with open(input, "w") as file:
      file.write(outputstr)

   # progress
   if not quiet:
      sys.stderr.write("\n")

def nb_setup_cell(client, fig_width, fig_height):

   # lookup kernel language and any injectableCode
   kernelLanguage = client.nb.metadata.kernelspec.language
   cell_code = ''
   if kernelLanguage in kInjectableCode:
      cell_code = kInjectableCode[kernelLanguage].format(fig_width, fig_height)  

   # create cell
   return nbformat.versions[nbformat.current_nbformat].new_code_cell(
      source=cell_code, 
      metadata={'lines_to_next_cell': cell_code.count("\n") + 1, 'tags': ['raises-exception']}
   )

def cell_execute(client, cell, index, include_warnings, store_history):

   no_execute_tag = 'no-execute'
   allow_errors_tag = 'allow-errors'
   include_warnings_tag = 'include-warnings'
   remove_warnings_tag = 'remove-warnings'

   # get active tags
   tags = cell.get('metadata', {}).get('tags', [])
     
   # execute unless the 'no-execute' tag is active
   if not no_execute_tag in tags:
      
      # if we see 'allow-errors' then add 'raises-exception'
      if allow_errors_tag in tags:
         cell.metatata = cell.get('metadata', {})
         cell.metadata.tags = tags + ['raises-exception'] 

      # execute
      cell = client.execute_cell(cell, index, store_history = store_history)
      
      # filter warnings if requested
      if "outputs" in cell:
         if ((not include_warnings and not include_warnings_tag in tags)
               or remove_warnings_tag in tags):
            cell["outputs"] = list(filter(warningFilter, cell["outputs"]))

      # remove injected raises-exception
      if allow_errors_tag in tags:
         cell.metatata.tags.remove('raises-exception')

   # return cell
   return cell
   

def cell_clear_output(cell):
   remove_metadata = ['collapsed', 'scrolled']
   if cell.cell_type == 'code':
      cell.outputs = []
      cell.execution_count = None
      if 'metadata' in cell:
         for field in remove_metadata:
            cell.metadata.pop(field, None)
   return cell


def notebook_to_markdown(input, output, format):

   # ...now export to markdown
   mdConfig = Config()

   # setup removal preprocessor
   execute = format["execute"]
   mdConfig.RemovePreprocessor.include_code = bool(execute["include-code"])
   mdConfig.RemovePreprocessor.include_output = bool(execute["include-output"])
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

kInjectableCode = { 
   'python' : "import matplotlib.pyplot as plt\nplt.rc('figure',figsize = ({0},{1}), dpi=96)"
}


# main
if __name__ == "__main__":
  
   # read args from stdin
   input_json = json.load(sys.stdin)
   input = input_json["input"]
   output = input_json["output"]
   format = input_json["format"]
   run_path = input_json.get("cwd", "")
   quiet = input_json.get('quiet', False)

   # change working directory and strip dir off of paths
   oldwd = os.getcwd()
   os.chdir(Path(input).parent)
   input = Path(input).name
   output = Path(output).name

   # convert
   result = notebook_convert(input, output, format, run_path, quiet)

   # write results to stdout
   json.dump(result, sys.stdout)

