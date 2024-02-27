using QuartoNotebookRunner
using Sockets


transport_file = ARGS[1]
transport_dir = dirname(transport_file)

atexit() do
  rm(transport_file; force=true)
end

server, port = let
  server = nothing
  port = nothing

  for i in 1:20
    # find an open port by creating a server there and immediately closing it
    port, _server = Sockets.listenany(8000)
    close(_server)
    try
      server = QuartoNotebookRunner.serve(; port)
      break
    catch e
      error("Opening server on port $port failed.")
    end
  end
  server, port
end

if server === nothing
  error("Giving up.")
end

open(transport_file, "w") do io
  println(io, """{"port": $port, "pid": $(Base.Libc.getpid())}""")
end

wait(server)
