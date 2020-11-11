
using JSON
using Weave

# read options
options = JSON.parse(readline(stdin))
target = get(options, "target", Dict([]))
input = get(target, "input", "")
output = get(options, "output", "")
quiet = get(options, "quiet", false)

if !quiet 
    write(stderr, string("Weaving ", input, "\n\n"))
end

# weave to pandoc markdown
out_path = weave(input, doctype="pandoc")
mv(out_path, output)

# return result
result = Dict([("supporting", []), ("pandoc", Dict())])
JSON.print(stdout, result)



