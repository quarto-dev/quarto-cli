import sys
import os
from importlib.metadata import version

sys.stdout.write('versionMajor: ' + str(sys.version_info.major))
sys.stdout.write('\nversionMinor: ' + str(sys.version_info.minor))
sys.stdout.write('\nversionPatch: ' + str(sys.version_info.micro))
sys.stdout.write('\nversionStr: "' + str(sys.version).replace('\n', ' ') + '"')
if os.path.exists(os.path.join(sys.prefix, 'conda-meta', 'history')):
  sys.stdout.write('\nconda: true')
else:
  sys.stdout.write('\nconda: false')
sys.stdout.write('\nexecPrefix: "' + sys.exec_prefix.replace("\\", "/") + '"')
sys.stdout.write('\nexecutable: "' + sys.executable.replace("\\", "/") + '"')

def discover_package(pkg):
  sys.stdout.write('\n' + pkg + ': ')
  try:
    sys.stdout.write(version(pkg))
  except Exception:
    sys.stdout.write('null')
 
discover_package('jupyter_core')  
discover_package('nbformat')
discover_package('nbclient')
discover_package('ipykernel')
discover_package('shiny')


