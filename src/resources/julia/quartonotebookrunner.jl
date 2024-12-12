using QuartoNotebookRunner
using Sockets


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

json = json_string(JSONDict([
  "port" => Int64(port),
  "pid" => Int64(Base.Libc.getpid()),
  "key" => string(server.key),
  "juliaVersion" => string(VERSION),
]))

open(transport_file, "w") do io
  println(io, json)
end

wait(server)
