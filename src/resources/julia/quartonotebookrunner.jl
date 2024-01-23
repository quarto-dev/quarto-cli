using QuartoNotebookRunner

function execute_qmd(sourcefile::String, output_ipynb::String)
  server = QuartoNotebookRunner.Server()
  run!(server, sourcefile, output=output_ipynb)
end

execute_qmd(ARGS[1], ARGS[2])
