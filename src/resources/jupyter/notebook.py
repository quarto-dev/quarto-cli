# pyright: reportMissingImports=false

import os
import re
import atexit
import glob
import sys
import json
import pprint
import copy

from pathlib import Path

from poyo import parse_string

from log import trace
import nbformat
from nbclient import NotebookClient
from jupyter_client import KernelManager
from jupyter_core_utils_vendor import run_sync
import asyncio

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

# exception to indicate the kernel needs restarting
class RestartKernel(Exception):
   pass

# execute a notebook
def notebook_execute(options, status):

   trace('inside notebook_execute')
   # if this is a re-execution of a previously loaded kernel,
   # make sure the underlying python version hasn't changed
   python_cmd = options.get("python_cmd", None)
   if python_cmd:
      if hasattr(notebook_execute, "python_cmd"):
         if notebook_execute.python_cmd != python_cmd:
            raise RestartKernel  
      else:
         notebook_execute.python_cmd = python_cmd

   # if there is a supervisor_id then abort if it has changed
   supervisor_pid = options.get("supervisor_pid", None)
   if supervisor_pid:
      if hasattr(notebook_execute, "supervisor_pid"):
         if notebook_execute.supervisor_pid != supervisor_pid:
            raise RestartKernel  
      else:
         notebook_execute.supervisor_pid = supervisor_pid
   

   # unpack options
   input = options["target"]["input"]
   format = options["format"]
   resource_dir = options["resourceDir"]
   params = options.get("params", None)
   run_path = options.get("cwd", "")
   quiet = options.get('quiet', False)

   # change working directory and strip dir off of paths
   original_input = input
   os.chdir(Path(input).parent)
   input = Path(input).name

   # read variables out of format
   execute = format["execute"]

   eval = execute["eval"]
   allow_errors = bool(execute["error"])
   fig_width = execute["fig-width"]
   fig_height = execute["fig-height"]
   fig_format = execute["fig-format"]
   fig_dpi = execute["fig-dpi"]
   if "cache" in execute:
      cache = execute["cache"]
   else:
      cache = "user"

   # set environment variables
   os.environ["QUARTO_FIG_WIDTH"] = str(fig_width)
   os.environ["QUARTO_FIG_HEIGHT"] = str(fig_height)
   if fig_format == "retina":
      os.environ["QUARTO_FIG_DPI"] = str(fig_dpi * 2)
      os.environ["QUARTO_FIG_FORMAT"] = "png"
   else:
      os.environ["QUARTO_FIG_DPI"] = str(fig_dpi)
      os.environ["QUARTO_FIG_FORMAT"] = fig_format

   # read the notebook
   nb = nbformat.read(input, as_version = NB_FORMAT_VERSION)

   trace('read notebook')
   # inject parameters if provided
   if params:
      nb_parameterize(nb, params)

   # insert setup cell
   setup_cell = nb_setup_cell(nb.metadata.kernelspec, resource_dir, fig_width, fig_height, fig_format, fig_dpi, run_path)
   nb.cells.insert(0, setup_cell)

   # are we using the cache, if so connect to the cache, and then if we aren't in 'refresh'
   # (forced re-execution) mode then try to satisfy the execution request from the cache
   if cache == True or cache == "refresh":
      trace('using cache')
      if not get_cache:
          raise ImportError('The jupyter-cache package is required for cached execution')
      trace('getting cache')
      nb_cache = get_cache(".jupyter_cache")
      if not cache == "refresh":
         cached_nb = nb_from_cache(nb, nb_cache)
         if cached_nb:
            cached_nb.cells.pop(0)
            nb_write(cached_nb, input)
            status("(Notebook read from cache)\n\n")
            trace('(Notebook read from cache)')
            return True # can persist kernel
   else:
      trace('not using cache')
      nb_cache = None
      
   # create resources for execution
   resources = dict({
      "metadata": {
         "input": original_input,
      }
   })
   if run_path:
      resources["metadata"]["path"] = run_path

   trace("Will attempt to create notebook")
   # create NotebookClient
   trace("type of notebook: {0}".format(type(nb)))
   client, created = notebook_init(nb, resources, allow_errors)
   trace("NotebookClient created")

   # complete progress if necessary
   if (not quiet) and created:
      status("Done\n")
      
   # compute total code cells (for progress)
   current_code_cell = 1
   total_code_cells = sum(cell.cell_type == 'code' for cell in client.nb.cells)
   
   # find max id length (for progress)
   max_id_len = max(len(getattr(cell, "id", "")) for cell in nb.cells)

   # execute the cells
   for index, cell in enumerate(client.nb.cells):
      # find cell id
      cell_id = cell.id if hasattr(cell, "id") else ""
      padding = "." * (max_id_len - len(cell_id))
      
      # progress
      progress = (not quiet) and cell.cell_type == 'code' and index > 0
      if progress:
         status("  Cell {0}/{1}: '{2}'{3}...".format(
            current_code_cell - 1,
            total_code_cells - 1,
            cell_id,
            padding
         ))

      # clear cell output
      cell = cell_clear_output(cell)

      # execute cell
      if cell.cell_type == 'code':
         trace("Executing cell {0}".format(index))
         cell = cell_execute(
            client, 
            cell, 
            index, 
            current_code_cell,
            eval,
            index > 0 # add_to_history
         )
         cell.execution_count = current_code_cell
         trace("Executed cell {0}".format(index))

      # if this was the setup cell, see if we need to exit b/c dependencies are out of date
      if index == 0:
         kernel_deps = nb_kernel_depenencies(cell)
         if kernel_deps:
            if hasattr(notebook_execute, "kernel_deps"):
               for path in kernel_deps.keys():
                  if path in notebook_execute.kernel_deps.keys():
                     if notebook_execute.kernel_deps[path] != kernel_deps[path]:
                        raise RestartKernel
                  else:
                     notebook_execute.kernel_deps[path] = kernel_deps[path]
            else:
               notebook_execute.kernel_deps = kernel_deps
         else:
            notebook_execute.kernel_deps = {}

         # we are done w/ setup (with no restarts) so it's safe to print 'Executing...'
         if not quiet:
            status("\nExecuting '{0}'\n".format(input))

      # assign cell
      client.nb.cells[index] = cell

      # increment current code cell
      if cell.cell_type == 'code':
         current_code_cell += 1

      # end progress
      if progress:
         status("Done\n")
         trace("Done")

   trace("Notebook execution complete")

   # set widgets metadata   
   client.set_widgets_metadata()

   # write to the cache
   if nb_cache:
      nb_write(client.nb, input)
      nb_cache.cache_notebook_file(path = Path(input), overwrite = True)

   # remove setup cell (then renumber execution_Count)
   client.nb.cells.pop(0)
   for index, cell in enumerate(client.nb.cells):
      if cell.cell_type == 'code':
         cell.execution_count = cell.execution_count - 1

   # re-write without setup cell
   nb_write(client.nb, input)

   # execute cleanup cell
   cleanup_cell = nb_cleanup_cell(nb.metadata.kernelspec, resource_dir)
   nb.cells.append(cleanup_cell)
   client.execute_cell(
      cell = cleanup_cell, 
      cell_index = len(client.nb.cells) - 1, 
      store_history = False
   )
   nb.cells.pop()

   # progress
   if not quiet:
      status("\n")

   # return flag indicating whether we should persist 
   persist = notebook_execute.kernel_deps != None
   return persist

def notebook_init(nb, resources, allow_errors):

   created = False
   if not hasattr(notebook_init, "client"):
      
      trace("Creating NotebookClient")
      # create notebook client
      client = NotebookClient(nb, resources = resources)
      client.allow_errors = allow_errors
      client.record_timing = False
      client.create_kernel_manager()
      client.start_new_kernel()
      client.start_new_kernel_client()

      async def get_info():
         i = client.kc.kernel_info()
         if asyncio.isfuture(i):
            return await i
         else:
            return i
      info = run_sync(get_info)()

      info_msg = client.wait_for_reply(info)
      client.nb.metadata['language_info'] = info_msg['content']['language_info']
      notebook_init.client = client
      created = True

      # cleanup kernel at process exit
      atexit.register(client._cleanup_kernel)
      
   else:
      # if the kernel has changed we need to force a restart
      if nb.metadata.kernelspec.name != notebook_init.client.nb.metadata.kernelspec.name:
         raise RestartKernel

      # if the input file has changed we need to force a restart
      if resources["metadata"]["input"] != notebook_init.client.resources["metadata"]["input"]:
         raise RestartKernel

      # set the new notebook, resources, etc.
      notebook_init.client.nb = nb
      notebook_init.client.allow_errors = allow_errors

   return (notebook_init.client, created)


def nb_write(nb, input):
   nbformat.write(nb, input, version = NB_FORMAT_VERSION)

def nb_setup_cell(kernelspec, resource_dir, fig_width, fig_height, fig_format, fig_dpi, run_path):
   return nb_language_cell('setup', kernelspec, resource_dir, fig_width, fig_height, fig_format, fig_dpi, run_path)

def nb_cleanup_cell(kernelspec, resource_dir):
   return nb_language_cell('cleanup', kernelspec, resource_dir)

def nb_language_cell(name, kernelspec, resource_dir, *args):
   source = ''
   lang_dir = os.path.join(resource_dir, 'jupyter', 'lang',  kernelspec.language)
   if os.path.isdir(lang_dir):
      cell_file = glob.glob(os.path.join(lang_dir, name + '.*'))
      if len(cell_file) > 0:
         with open(cell_file[0], 'r') as file:
            source = file.read().format(*args)  

   # create cell
   return nbformat.versions[NB_FORMAT_VERSION].new_code_cell(
      source = source
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

def nb_kernel_depenencies(cell):
   for index, output in enumerate(cell.outputs):
      if output.name == 'stdout' and output.output_type == 'stream':
         return json.loads(output.text)
   return None

def cell_execute(client, cell, index, execution_count, eval_default, store_history):

   # read cell options
   cell_options = nb_cell_yaml_options(client.nb.metadata.kernelspec.language, cell)

   # check options for eval and error
   eval = cell_options.get('eval', eval_default)
   allow_errors = cell_options.get('error', False)
     
   # execute if eval is active
   if eval == True:
      
      # add 'raises-exception' tag for allow_errors
      if allow_errors:
         if not "metadata" in cell:
            cell["metadata"] = {}
         tags = cell.get('metadata', {}).get('tags', [])
         cell["metadata"]["tags"] = tags + ['raises-exception'] 

      # execute (w/o yaml options so that cell magics work)
      source = cell.source
      cell.source = nb_strip_yaml_options(client, cell.source)
      cell = client.execute_cell(
         cell = cell, 
         cell_index = index, 
         execution_count = execution_count,
         store_history = store_history
      )
      cell.source = source
      
      # if lines_to_next_cell is 0 then fix it to be 1
      lines_to_next_cell = cell.get('metadata', {}).get('lines_to_next_cell', -1)
      if lines_to_next_cell == 0:
         cell["metadata"]["lines_to_next_cell"] = 1

      # remove injected raises-exception
      if allow_errors:
         cell["metadata"]["tags"].remove('raises-exception')
         if len(cell["metadata"]["tags"]) == 0:
            del cell["metadata"]["tags"]

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
      raise ImportError('The papermill package is required for processing --execute-params')

   # alias kernel name and language
   kernel_name = nb.metadata.kernelspec.name
   language = nb.metadata.kernelspec.language

   # find params index and note any tags/yaml on it (exit if no params)
   params_index = find_first_tagged_cell_index(nb, "parameters")
   if params_index != -1:
      params_cell_tags = nb.cells[params_index].get('metadata', {}).get('tags', []).copy()
      params_cell_yaml = nb_cell_yaml_lines(language, nb.cells[params_index].source)
      params_cell_tags.remove("parameters")
   else:
      return

   # Generate parameter content based on the kernel_name
   params_content = papermill_translate.translate_parameters(
      kernel_name, 
      language, 
      params, 
      'Injected Parameters'
   )

   # prepend options
   if len(params_cell_yaml):
      comment_chars = nb_language_comment_chars(language)
      option_prefix = comment_chars[0] + "| "
      option_suffix = comment_chars[1] if len(comment_chars) > 1 else None
      def enclose(yaml):
         yaml = option_prefix + yaml
         if option_suffix:
            yaml = yaml + option_suffix
         return yaml
      params_content = "\n".join(map(enclose, params_cell_yaml)) + "\n" + params_content

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
   else:
      # Add an injected cell after the parameter cell
      before = nb.cells[: params_index + 1]
      after = nb.cells[params_index + 1 :]
  
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

def nb_strip_yaml_options(client, source):
   yaml_lines = nb_cell_yaml_lines(client.nb.metadata.kernelspec.language, source)  
   num_yaml_lines = len(yaml_lines)
   if num_yaml_lines > 0:
      return "\n".join(source.splitlines()[num_yaml_lines:])
   else:
      return source

def nb_cell_yaml_options(lang, cell):

   # go through the lines until we've found all of the yaml
   yaml_lines = nb_cell_yaml_lines(lang, cell.source)
   
   # if we have yaml then parse it
   if len(yaml_lines) > 0:
      # work around poyo bug: https://github.com/quarto-dev/quarto-cli/issues/4573
      yaml_code = "\n".join(l.rstrip() for l in yaml_lines)
      yaml_options = parse_string(yaml_code)
      if (type(yaml_options) is dict):
         return yaml_options
      else:
         sys.stderr.write("\nWARNING: Invalid YAML option format in cell:\n" + yaml_code + "\n")
         sys.stderr.flush()
         return dict()

   else:
      return dict()
   
def nb_cell_yaml_lines(lang, source):
   # determine language comment chars
   comment_chars = nb_language_comment_chars(lang)
   option_pattern = "^" + re.escape(comment_chars[0]) + "\\s*\\| ?"
   option_suffix = comment_chars[1] if len(comment_chars) > 1 else None

   # go through the lines until we've found all of the yaml
   yaml_lines = []
   for line in source.splitlines():
      option_match = re.match(option_pattern, line) 
      if option_match:
         if (not option_suffix) or line.rstrip().endswith(option_suffix):
            yaml_option = line[len(option_match.group()):]
            if (option_suffix):
               yaml_option = yaml_option.rstrip()[:-len(option_suffix)]
            # strip trailing spaces after : to avoid poyo error
            # (https://github.com/hackebrot/poyo/issues/30)
            yaml_option = re.sub(":\\s+$", ":", yaml_option)
            yaml_lines.append(yaml_option)
            continue
      break

   # return the lines
   return yaml_lines

def nb_language_comment_chars(lang):
   langs = dict(
      r = "#",
      python = "#",
      julia = "#",
      scala = "//",
      matlab = "%",
      csharp = "//",
      fsharp = "//",
      c = ["/*",  "*/"],
      css = ["/*",  "*/"],
      sas = ["*", ";"],
      powershell = "#",
      bash = "#",
      sql = "--",
      mysql = "--",
      psql = "--",
      lua = "--",
      cpp = "//",
      cc = "//",
      stan = "#",
      octave = "#",
      fortran = "!",
      fortran95 = "!",
      awk = "#",
      gawk = "#",
      stata = "*",
      java = "//",
      groovy = "//",
      sed = "#",
      perl = "#",
      ruby = "#",
      tikz = "%",
      js = "//",
      d3 = "//",
      node = "//",
      sass = "//",
      coffee = "#",
      go = "//",
      asy = "//",
      haskell = "--",
      dot = "//",
      apl = "⍝"
   )
   if lang in langs:
      chars = langs[lang]
      if not isinstance(chars, type([])):
         chars = [chars]
      return chars
   else:
      return ["#"]
