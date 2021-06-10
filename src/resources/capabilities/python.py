import sys
import importlib

sys.stdout.write('versionMajor: ' + str(sys.version_info[0]))
sys.stdout.write('\nversionMinor: ' + str(sys.version_info[1]))
sys.stdout.write('\nversionStr: "' + str(sys.version).replace('\n', ' ') + '"')
sys.stdout.write('\nexecPrefix: "' + sys.exec_prefix + '"')
sys.stdout.write('\nexecutable: "' + sys.executable + '"')

def discover_package(pkg):
  sys.stdout.write('\n' + pkg + ': ')
  try:
    imp = importlib.import_module(pkg)
    sys.stdout.write(str(imp.__version__))
  except Exception:
    sys.stdout.write('null')
 
discover_package('jupyter_core')  
discover_package('nbformat')
discover_package('nbclient')
discover_package('ipykernel')
discover_package('yaml')

  
