import sys
import nbformat


# read notebook from stdin
nb = nbformat.reads(sys.stdin.read(), as_version = 4)
print(nb)

# prepend a comment to the source of each cell
for index, cell in enumerate(nb.cells):
  if cell.cell_type == 'code':
     cell.source = "# comment\n" + cell.source
  
# write notebook to stdout 
nbformat.write(nb, sys.stdout)