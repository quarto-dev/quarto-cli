using QuartoNotebookRunner
using Sockets


transport_file = ARGS[1]
transport_dir = dirname(transport_file)

atexit() do
  rm(transport_file; force=true)
end

server = QuartoNotebookRunner.serve()
port = server.port

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
