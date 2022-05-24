import json
import os.path

def fix_path(v):
  (dirname, basename) = os.path.split(v)
  dirname = dirname[1:].replace(".", "-")
  return f'.{dirname}/{basename}'

def fix_import_map(v):
  if type(v) == str:
    return fix_path(v)
  elif type(v) == dict:
    return dict((k if not k.startswith(".") else fix_path(k), fix_import_map(vv)) for (k,vv) in v.items())

if __name__ == '__main__':
  d = json.load(open("import_map_deno_vendor.json"))
  print(json.dumps(fix_import_map(d), indent=2))
