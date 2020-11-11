using JSON
using Weave


# - Forwarding of 'show-warnings' (doesn't seem to be supported right now)
#
# - Plots doesn't seem to respect fig_width and fig_height

# - Implement support for fig-format 'retina'
#
# - Allow 'weave_options' to be specified per-format. For this to work the 
#   weave_options need to be hoisted out of the options.metadata passed
#   to exeute and either merged w/ the source or merged using our own 
#   implementation of weave
#
# - Experiment w/ caching and make sure semantics are correctly supported
#   cache = :user results in a cache dir even if there are no cache directives 
#
# - Markup up output w/ pandoc-compatible div structure (e.g. ::: {.cell .code})
#   Note that to do this it's likely we need to call WeaveDoc/run_doc directly
#   and then just operate directly on the chunks
# 
# - Implement 'keep-hidden' (need the lower level approach for this)
#
# - Implement 'execute: false' (again, likely need lower level approach for this)
##
# - correct handling of rich (e.g. plotly) outputs 
#



# read options
options = JSON.parse(readline(stdin))
target = get(options, "target", Dict([]))
input = get(target, "input", "")
output = get(options, "output", "")
quiet = get(options, "quiet", false)
format = get(options, "format", Dict([]))
execution = get(format, "execution", Dict([]))
cache = get(execution, "cache", "user")
fig_format = get(execution, "fig-format", "png")
pandoc = get(format, "pandoc", Dict([]))
to = get(pandoc, "to", "html")

if !quiet 
    write(stderr, string("Weaving ", input, "\n\n"))
end

# if fig_format is 'retina' then convert it to 'png'
if fig_format == "retina"
    fig_format = "png"
end

# compute the fig_path
stem = splitext(basename(input))[1]
files_dir = string(stem, "_files")
to = replace(to, r"[\+\-].*$" => s"");
fig_dir = joinpath(files_dir, string("figure-", to));
mkpath(fig_dir)

# cache: use 'off' for 'none'
if cache == "none"
    cache = "off"
end

# set chunk defaults
# https://github.com/JunoLab/Weave.jl/blob/8206ca2d14b56293e55964f1cf53ef53c4238cc7/src/config.jl#L2
set_chunk_defaults!(
  :error => get(execution, "allow-errors", false),
  :echo => get(execution, "show-code", true),
  :results => ifelse(get(execution, "show-output", true), "markup", "hidden"),
  :fig_width => get(execution, "fig-width", 7),
  :fig_height => get(execution, "fig-height", 5),
  :dpi => get(execution, "fig-dpi", 96)
)

# set the cache default correctly if it's not 'user'
if cache == "all" || cache == "refresh"
    set_chunk_defaults!(:cache => true)
elseif cache == "off"
    set_chunk_defaults!(:cache => false)
end

# weave to pandoc markdown
out_path = weave(
  input, 
  doctype="pandoc",
  fig_path=fig_dir,
  fig_ext=string(".", fig_format),
  cache_path=".julia-cache",
  cache=Symbol(cache),
)
mv(out_path, output, force=true)

# check if caching was used at a global level
defaults = get_chunk_defaults()
cache_active = get(defaults, "cache", false)

# return result
result = Dict([
  ("supporting", ifelse(cache_active, [], [fig_dir])), 
  ("pandoc", Dict())
])
JSON.print(stdout, result)



