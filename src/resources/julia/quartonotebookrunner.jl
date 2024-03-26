using QuartoNotebookRunner
using Sockets


transport_file = ARGS[1]
transport_dir = dirname(transport_file)

atexit() do
  rm(transport_file; force=true)
end

server = QuartoNotebookRunner.serve(; timeout = 300)
port = server.port

open(transport_file, "w") do io
  println(io, """{"port": $port, "pid": $(Base.Libc.getpid()), "key": "$(server.key)"}""")
end

wait(server)
