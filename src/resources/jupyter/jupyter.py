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
import copy
import sys
import json
import pprint
from pathlib import Path

import nbformat
from nbclient import NotebookClient

# optional import of papermill for params support
try:
   from papermill import translators as papermill_translate
except ImportError:
   papermill_translate = None

# optional import of jupyter-cache
try:
   from jupyter_cache import get_cache
except ImportError:
   get_cache = None

NB_FORMAT_VERSION = 4

def notebook_execute(input, format, params, run_path, resource_dir, quiet):

    # progress
   if not quiet:
      sys.stderr.write("\nExecuting '{0}'\n".format(input))

   # read variables out of format
   execute = format["execution"]
   allow_errors = bool(execute["allow-errors"])
   fig_width = execute["fig-width"]
   fig_height = execute["fig-height"]
   fig_format = execute["fig-format"]
   fig_dpi = execute["fig-dpi"]
   cache = execute["execute-cache"]

   # set environment variables
   os.environ["JUPYTER_FIG_WIDTH"] = str(fig_width)
   os.environ["JUPYTER_FIG_HEIGHT"] = str(fig_height)

   # read the notebook
   nb = nbformat.read(input, as_version = NB_FORMAT_VERSION)

   # inject parameters if provided
   if params:
      nb_parameterize(nb, params)

   # insert setup cell
   setup_cell = nb_setup_cell(nb.metadata.kernelspec, resource_dir, fig_width, fig_height, fig_format, fig_dpi)
   nb.cells.insert(0, setup_cell)

   # are we using the cache, if so connect to the cache, and then if we aren't in 'refresh'
   # (forced re-execution) mode then try to satisfy the execution request from the cache
   if cache == "all" or cache == "refresh":
      if not get_cache:
          raise ImportError('The jupyter-cache package is required for cached execution')
      nb_cache = get_cache(".jupyter_cache")
      if not cache == "refresh":
         cached_nb = nb_from_cache(nb, nb_cache)
         if cached_nb:
            cached_nb.cells.pop(0)
            nb_write(cached_nb, input)
            if not quiet:
                sys.stderr.write("(Notebook read from cache)\n\n")
            return
   else:
      nb_cache = None
      
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

      # execute the cells
      for index, cell in enumerate(client.nb.cells):
         # progress
         progress = not quiet and cell.cell_type == 'code' and index > 0
         if progress:
            sys.stderr.write("  Cell {0}/{1}...".format(
               current_code_cell- 1, total_code_cells - 1)
            )

         # clear cell output
         cell = cell_clear_output(cell)

         # execute cell
         client.nb.cells[index] = cell_execute(
            client, 
            cell, 
            index, 
            current_code_cell,
            index > 0 # add_to_history
         )

         # increment current code cell
         if cell.cell_type == 'code':
            current_code_cell += 1

         # end progress
         if progress:
            sys.stderr.write("Done\n")  

   # set widgets metadata   
   client.set_widgets_metadata()

   # write to the cache
   if nb_cache:
      nb_write(client.nb, input)
      nb_cache.cache_notebook_file(path = Path(input), overwrite = True)

   # remove setup cell
   client.nb.cells.pop(0)

   # re-write without setup cell
   nb_write(client.nb, input)

   # progress
   if not quiet:
      sys.stderr.write("\n")


def nb_write(nb, input):
   outputstr = nbformat.writes(nb, version = NB_FORMAT_VERSION)
   if not outputstr.endswith("\n"):
      outputstr = outputstr + "\n"

   # re-write contents back to input file
   with open(input, "w") as file:
      file.write(outputstr)


def nb_setup_cell(kernelspec, resource_dir, fig_width, fig_height, fig_format, fig_dpi):

   # determine setup code based on current kernel language
   setup_code = ''
   kSetupScript = { 
      'python' : 'setup.py'
   }
   kernelLanguage = kernelspec.language
   if kernelLanguage in kSetupScript:
      setup = os.path.join(resource_dir, 'jupyter', 'setup', kSetupScript[kernelLanguage])
      with open(setup, 'r') as file:
         setup_code = file.read().format(fig_width, fig_height, fig_format, fig_dpi)  

   # create cell
   return nbformat.versions[NB_FORMAT_VERSION].new_code_cell(
      source = setup_code
   )

def nb_from_cache(nb, nb_cache, nb_meta = ("kernelspec", "language_info", "widgets")):
   try:
      cache_record = nb_cache.match_cache_notebook(nb)
      cache_bundle = nb_cache.get_cache_bundle(cache_record.pk)
      cache_nb = cache_bundle.nb
      nb = copy.deepcopy(nb)
      # selected (execution-oriented) metadata
      if nb_meta is None:
         nb.metadata = cache_nb.metadata
      else:
         for key in nb_meta:
            if key in cache_nb.metadata:
               nb.metadata[key] = cache_nb.metadata[key]
      # code cells
      for idx in range(len(nb.cells)):
         if nb.cells[idx].cell_type == "code":
            cache_cell = cache_nb.cells.pop(0)    
            nb.cells[idx] = cache_cell
      return nb
   except KeyError:
      return None

def cell_execute(client, cell, index, execution_count, store_history):

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
      cell = client.execute_cell(
         cell = cell, 
         cell_index = index, 
         execution_count = execution_count,
         store_history = store_history
      )
      
      # if lines_to_next_cell is 0 then fix it to be 1
      lines_to_next_cell = cell.get('metadata', {}).get('lines_to_next_cell', -1)
      if lines_to_next_cell == 0:
         cell["metadata"]["lines_to_next_cell"] = 1

      # remove injected raises-exception
      if allow_errors_tag in tags:
        cell["metadata"]["tags"].remove('raises-exception')

   else:
      cell.execution_count = execution_count

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

def nb_parameterize(nb, params):

   # verify papermill import
   if not papermill_translate:
      raise ImportError('The papermill package is required for --execute-params')

   # Generate parameter content based on the kernel_name
   kernel_name = nb.metadata.kernelspec.name
   language = nb.metadata.kernelspec.language
   params_content = papermill_translate.translate_parameters(
      kernel_name, 
      language, 
      params, 
      'Injected Parameters'
   )

    # find params index and note any tags on it
   params_index = find_first_tagged_cell_index(nb, "parameters")
   if params_index != -1:
      params_cell_tags = nb.cells[params_index].get('metadata', {}).get('tags', []).copy()
      params_cell_tags.remove("parameters")
   else:
      params_cell_tags = []
      
   # create params cell
   params_cell = nbformat.v4.new_code_cell(source=params_content)
   params_cell.metadata['tags'] = ['injected-parameters'] + params_cell_tags

    # find existing injected params index
   injected_params_index = find_first_tagged_cell_index(nb, 'injected-parameters')

   # find the right insertion/replace point for the injected params
   if injected_params_index >= 0:
      # Replace the injected cell with a new version
      before = nb.cells[:injected_params_index]
      after = nb.cells[injected_params_index + 1 :]
   elif params_index >= 0:
      # Add an injected cell after the parameter cell
      before = nb.cells[: params_index + 1]
      after = nb.cells[params_index + 1 :]
   else:
      # Inject to the top of the notebook
      before = []
      after = nb.cells

   nb.cells = before + [params_cell] + after
   if not nb.metadata.get('papermill'):
      nb.metadata.papermill = {}
   nb.metadata.papermill['parameters'] = params
      

def find_first_tagged_cell_index(nb, tag):
   parameters_indices = []
   for idx, cell in enumerate(nb.cells):
      if tag in cell.get('metadata', {}).get('tags', {}):
         parameters_indices.append(idx)
   if not parameters_indices:
      return -1
   return parameters_indices[0]

# main
if __name__ == "__main__":
  
   # read args from stdin
   input_json = json.load(sys.stdin)
   input = input_json["target"]["input"]
   format = input_json["format"]
   resource_dir = input_json["resourceDir"]
   params = input_json.get("params", None)
   run_path = input_json.get("cwd", "")
   quiet = input_json.get('quiet', False)

   # change working directory and strip dir off of paths
   oldwd = os.getcwd()
   os.chdir(Path(input).parent)
   input = Path(input).name

   # execute in place
   notebook_execute(input, format, params, run_path, resource_dir, quiet)

