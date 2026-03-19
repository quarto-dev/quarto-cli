logfile = ARGS[2]
filehandle = open(logfile, "w")

# We cannot start Julia in a way such that it uses line buffering or no buffering (see https://github.com/JuliaLang/julia/issues/13050)
# which means that if we just redirect all its output into a logfile (for example with `pipeline(julia_cmd, stdout = logfile)`)
# it will not actually write to the logfile until the buffer is filled or it's explicitly flushed, which can take a while.
# So when we check the logfile, we don't actually see anything if the buffer is not filled first, which
# may never be if there's little output. So instead we redirect stdout and stderr to a pipe which we manually check
# for available data in shorter intervals. We then write the data to the logfile and flush.

pipe = Pipe()
pipe_with_color = IOContext(pipe, :color => Base.get_have_color())
redirect_stdout(pipe_with_color)
redirect_stderr(pipe_with_color)

function update_logfile()
  data = readavailable(pipe)
  if !isempty(data)
    write(filehandle, data)
    flush(filehandle)
  end
  return
end

@async while true
  update_logfile()
  sleep(1)
end

# we might lose printout from crashes if we don't do another update at the end
atexit() do
  update_logfile()
end

using Dates: now
@info "Log started at $(now())"

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

@info "Starting server at $(now())"
wait(server)
@info "Server stopped at $(now())"
