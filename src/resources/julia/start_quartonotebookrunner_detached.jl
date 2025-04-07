# it appears that deno cannot launch detached processes https://github.com/denoland/deno/issues/5501
# so we use an indirection where we start the detached julia process using julia itself
julia_bin = ARGS[1]
project = ARGS[2]
julia_file = ARGS[3]
transport_file = ARGS[4]
logfile = ARGS[5]

if length(ARGS) > 5
  error("Too many arguments")
end

env = copy(ENV)
env["JULIA_LOAD_PATH"] = "@:@stdlib" # ignore the main env
cmd = `$julia_bin --startup-file=no --project=$project $julia_file $transport_file $logfile`
cmd = setenv(cmd, env)
run(detach(cmd), wait = false)
