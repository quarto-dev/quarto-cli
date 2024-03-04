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

@info "trying to establish test connection to port $port"
let
  connected = false
  for i in 1:20
    try
      sock = Sockets.connect(port)
      println(sock, """{"type": "isready", "content": {}}""")
      @assert readline(sock) == "true"
      close(sock)
      connected = true
      break
    catch
      sleep(0.1)
    end
  end
  connected || error("Test connection could not be established.")
end
@info "successful test connection"

open(transport_file, "w") do io
  println(io, """{"port": $port, "pid": $(Base.Libc.getpid())}""")
end

wait(server)
