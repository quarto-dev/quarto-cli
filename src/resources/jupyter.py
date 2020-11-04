# jupyter.py
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
import json
import pprint
from pathlib import Path

import nbformat
from nbclient import NotebookClient

NB_FORMAT_VERSION = 4

# execute options in format:
#   allow-errors   
#   include-code         
#   include-output
#   include-warnings

def notebook_execute(input, format, run_path, quiet):

    # progress
   if not quiet:
      sys.stderr.write("\nExecuting '{0}'\n".format(input))

   # read variables out of format
   execute = format["execute"]
   allow_errors = bool(execute["allow-errors"])
   fig_width = execute["fig-width"]
   fig_height = execute["fig-height"]
   fig_format = execute["fig-format"]
   fig_dpi = execute["fig-dpi"]

   # set environment variables
   os.environ["JUPYTER_FIG_WIDTH"] = str(fig_width)
   os.environ["JUPYTER_FIG_HEIGHT"] = str(fig_height)

   # read the notebook
   nb = nbformat.read(input, as_version = NB_FORMAT_VERSION)

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
      setup_cell = nb_setup_cell(client, fig_width, fig_height, fig_format, fig_dpi)
      client.nb.cells.insert(0, setup_cell)

      # execute the cells
      for index, cell in enumerate(client.nb.cells):
         # progress
         progress = not quiet and cell.cell_type == 'code' and index > 0
         if progress:
            sys.stderr.write("  Cell {0}/{1}...".format(
               current_code_cell, total_code_cells)
            )

         # clear cell output
         cell = cell_clear_output(cell)

         # execute cell
         client.nb.cells[index] = cell_execute(
            client, 
            cell, 
            index, 
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
   outputstr = nbformat.writes(client.nb, version = NB_FORMAT_VERSION)
   if not outputstr.endswith("\n"):
      outputstr = outputstr + "\n"

   # re-write contents back to input file
   with open(input, "w") as file:
      file.write(outputstr)

   # progress
   if not quiet:
      sys.stderr.write("\n")


def nb_setup_cell(client, fig_width, fig_height, fig_format, fig_dpi):

   # lookup kernel language and any injectableCode
   kernelLanguage = client.nb.metadata.kernelspec.language
   cell_code = ''
   if kernelLanguage in kInjectableCode:
      cell_code = kInjectableCode[kernelLanguage].format(fig_width, fig_height, fig_format, fig_dpi)  

   # create cell
   return nbformat.versions[NB_FORMAT_VERSION].new_code_cell(
      source=cell_code, 
      metadata={ 'lines_to_next_cell': cell_code.count("\n") + 1 } 
   )

def cell_execute(client, cell, index, store_history):

   no_execute_tag = 'no-execute'
   allow_errors_tag = 'allow-errors'

   # ensure we have tags
   tags = cell.get('metadata', {}).get('tags', [])
     
   # execute unless the 'no-execute' tag is active
   if not no_execute_tag in tags:
      
      # if we see 'allow-errors' then add 'raises-exception'
      if allow_errors_tag in tags:
         if not "metadata" in cell:
            cell["metadata"] = {}
         cell["metadata"]["tags"] = tags + ['raises-exception'] 

      # execute
      cell = client.execute_cell(cell, index, store_history = store_history)
      
      # remove injected raises-exception
      if allow_errors_tag in tags:
        cell["metadata"]["tags"].remove('raises-exception')


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

# TODO: figure size for pdf format
# TODO: retina width/height for output


kInjectableCode = { 
   'python' : "try:\n" +
              "  import matplotlib.pyplot as plt\n" + 
              "  from IPython.display import set_matplotlib_formats\n" +
              "  plt.rcParams['figure.dpi'] = {3}\n" +
              "  plt.rcParams['savefig.dpi'] = {3}\n" +
              "  plt.rcParams['figure.figsize'] = {0}, {1}\n"
              "  set_matplotlib_formats('{2}')\n" +
              "except Exception:\n" +
              "  pass\n"
}

# main
if __name__ == "__main__":
  
   # read args from stdin
   input_json = json.load(sys.stdin)
   input = input_json["input"]
   format = input_json["format"]
   run_path = input_json.get("cwd", "")
   quiet = input_json.get('quiet', False)

   # change working directory and strip dir off of paths
   oldwd = os.getcwd()
   os.chdir(Path(input).parent)
   input = Path(input).name

   # execute in place
   notebook_execute(input, format, run_path, quiet)

