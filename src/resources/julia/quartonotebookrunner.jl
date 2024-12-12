using QuartoNotebookRunner
using Sockets
using Pkg
using TOML


transport_file = ARGS[1]
transport_dir = dirname(transport_file)

atexit() do
  rm(transport_file; force=true)
end

server = QuartoNotebookRunner.serve(; timeout = 300)
port = server.port

const JSONDict = Dict{String,Union{Int,String,Float64}}

function json_string(d::JSONDict)
  iob = IOBuffer()
  print(iob, "{")
  for (i, (key, value)) in enumerate(d)
    i > 1 && print(iob, ",")
    show(iob, key)
    print(iob, ":")
    show(iob, value)
  end
  print(iob, "}")
  return String(take!(iob))
end

active_project_file = Base.active_project()
active_project_dir = dirname(active_project_file)
if active_project_dir == transport_dir
  active_project_dir = "quarto internal"
end

qnr_uuid = "4c0109c6-14e9-4c88-93f0-2b974d3468f4"
active_project_file_parsed = TOML.parsefile(active_project_file)
# the Pkg.dependencies way doesn't work if the env is QuartoNotebookRunner itself
qnr_version = if get(active_project_file_parsed, "uuid", "") == qnr_uuid
  active_project_file_parsed["version"]::String
else
  string(Pkg.dependencies()[Base.UUID(qnr_uuid)].version)
end

json = json_string(JSONDict([
  "port" => Int64(port),
  "pid" => Int64(Base.Libc.getpid()),
  "key" => string(server.key),
  "juliaVersion" => string(VERSION),
  "environment" => active_project_dir,
  "runnerVersion" => qnr_version,
]))

open(transport_file, "w") do io
  println(io, json)
end

wait(server)
