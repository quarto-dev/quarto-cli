# it appears that deno cannot launch detached processes https://github.com/denoland/deno/issues/5501
# so we use an indirection where we start the detached julia process using julia itself
julia_bin = ARGS[1]
project = ARGS[2]
julia_file = ARGS[3]
transport_file = ARGS[4]

if length(ARGS) > 4
  error("Too many arguments")
end

cmd = `$julia_bin --project=$project $julia_file $transport_file`
@info cmd

run(detach(cmd), wait = false)
@info "ran that"
