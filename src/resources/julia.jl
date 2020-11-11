using JSON
using Weave


# - Forwarding of 'allow-errors', 'show-code', 'show-output', 'show-warnings' 
#   to requisite default chunk options
#
# - Implement default figure sizes from fig-width, fig-height
#
# - Implement support for fig-dpi and fig-format 'retina'
#
# - Markup up output w/ pandoc-compatible div structure (e.g. ::: {.cell .code})
#   Note that to do this it's likely we need to call WeaveDoc/run_doc directly
#   and then just operate directly on the chunks
# 
# - Implement 'keep-hidden' (need the lower level approach for this)
#
# - Implement 'execute: false' (again, likely need lower level approach for this)
#
# - cache = :user results in a cache dir even if there are no cache directives 
#
# - correct handling of rich (e.g. plotly) outputs 
#
# - If there is a quarto or 'user' specified cache, then don't return fig_dir in supporting
#   (also, return files_dir rather than fig_dir if there is only one figure type)


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

# return result
result = Dict([
  ("supporting", [fig_dir]), 
  ("pandoc", Dict())
])
JSON.print(stdout, result)



