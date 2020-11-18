using JSON
using Weave
using Plots

# TODO: Do something to amortize the jit cost. e.g. have a persistent process that
# serves render requests, use a pre-compiled sysimage, etc. 

# A few approaches described here: https://discourse.julialang.org/t/how-to-attach-to-an-existing-remote-repl/27608/22
# Persistent process might require something like this:
#  https://timholy.github.io/Revise.jl/stable/
# Web server:
#  https://github.com/JuliaWeb/HTTP.jl
#  w/ revise: https://github.com/JuliaWeb/HTTP.jl/issues/587

# This seemed to make a small difference in performance:
# using PackageCompiler
# using Weave
# using JSON
# using Plots
# using Plotly
# using PlotlyBase
# using PlotlyJS
# create_sysimage(
#   [:Weave,:JSON,:Plots,:Plotly,:PlotlyBase,:PlotlyJS],
#   sysimage_path="quarto.so"
# )
# julia --sysimage "quarto.so" juila.jl


# TODO: Was not able to get plotly actually working (but in any case do capture the 
# doc.header_script and forward it to pandoc). Seeing same errors as reported here:
# https://github.com/JunoLab/Weave.jl/issues/235


function execute(input, output, format, temp_dir)
 
  # execution 
  execution = get(format, "execution", Dict([]))
  execute = get(execution, "execute", true)
  keep_hidden = get(execution, "keep-hidden", false)
  # cache
  cache = get(execution, "cache", "user")
  if cache == true
    cache = "all"
  elseif cache == false
    cache = "off"
  end
  # fig_format
  fig_format = get(execution, "fig-format", "png")
  if fig_format == "retina"
    fig_format = "png"
  end
 
  # metadata
  metadata = get(format, "metadata", Dict([]))
  weave_options = get(format, "weave_options", nothing)

  # pandoc
  pandoc = get(format, "pandoc", Dict([]))
  to = get(pandoc, "to", "html")

  # compute the fig_path
  stem = splitext(basename(input))[1]
  files_dir = string(stem, "_files")
  to = replace(to, r"[\+\-].*$" => s"");
  fig_dir = joinpath(files_dir, string("figure-", to));
  mkpath(fig_dir)

  # set chunk defaults
  show_output = get(execution, "show-output", true)
  set_chunk_defaults!(
    :error => get(execution, "allow-errors", false),
    :echo => get(execution, "show-code", true),
    :results => ifelse(show_output, "markup", "hidden"),
    :fig => show_output,
    :fig_width => get(execution, "fig-width", 7),
    :fig_height => get(execution, "fig-height", 5),
    :dpi => get(execution, "fig-dpi", 96)
  )

  # weave the doc
  yaml, doc = weave_doc(input, metadata, execute)

  # run the doc
  doc = Weave.run_doc(
    doc;
    doctype="pandoc",
    out_path=:doc,
    fig_path=fig_dir,
    fig_ext=string(".", fig_format),
    cache_path=".julia-cache",
    cache=Symbol(cache),
  )
  
  # render markdown
  markdown = []

  # include yaml if we have it
  if !isnothing(yaml)
    append!(markdown, "---$(yaml)---")
  end

  # render chunks to markdown
  for (index, value) in enumerate(copy(doc.chunks))
    rendered = render_chunk(value, keep_hidden)
    append!(markdown, rendered)
    append!(markdown, "\n")
  end
  
  # write out the results
  open(output, "w") do io
    write(io, join(markdown, ""))
  end;

  # supporting files (none if the cache is active)
  suppporting = ifelse(cache_active(cache, doc), [], [fig_dir])

  # write the header_script to a temp file
  pandoc = Dict()
  if doc.header_script ≠ ""
    in_header = tempname(temp_dir; cleanup=false)
    open(in_header, "w") do io
      write(io, doc.header_script)
    end;
    pandoc.set("include-in-header", [in_header])
  end
 
  # return result
  return Dict([
    ("supporting", suppporting), 
    ("pandoc", pandoc)
  ])
end

function weave_doc(input, metadata, execute)

  # read document source and extract yaml header
  source = read(input, String)
  yaml = yaml_header_from_source(source)

  # parse the doc into chunks
  header, chunks = Weave.parse_doc(source, "markdown")

  # merge in metadata 'weave_options'
  chunk_defaults = resolve_chunk_defaults(metadata)
  
  # calculate paths for weave
  path = abspath(input)
  _, fname = splitdir(path)
  basename = splitext(fname)[1]

  # weave 
  doc = Weave.WeaveDoc(
    input,
    basename,
    path,
    chunks,
    "",
    nothing,
    "",
    "",
    header,
    chunk_defaults,
  ) 

  # if execution is turned off then turn off eval for all the cells
  if !execute
    for (_, chunk) in enumerate(doc.chunks)
      if typeof(chunk) == Weave.CodeChunk
        chunk.options[:eval] = false
      end
    end
  end

  # return 
  return yaml, doc
end


# extract yaml header from source
const YAML_REGEX = r"^---$(?<header>((?!---).)+)^---$"ms
function yaml_header_from_source(source)
  m = match(YAML_REGEX, source)
  if !isnothing(m)
    return m[:header]
  else
    return nothing
  end
end

# merge 'weave_options' from document metadata
function resolve_chunk_defaults(metadata)
  chunk_defaults = deepcopy(get_chunk_defaults())
  if (weave_options = get(metadata, Weave.WEAVE_OPTION_NAME, nothing)) !== nothing
    for key in keys(chunk_defaults)
      if (val = get(weave_options, string(key), nothing)) !== nothing
          chunk_defaults[key] = val
      end
    end
  end
  return chunk_defaults
end

# determine if the cache was used for this render
function cache_active(cache_setting, doc)
  if cache_setting == "user"
    for (_, chunk) in enumerate(doc.chunks)
      if (typeof(chunk) == Weave.CodeChunk) && chunk.options[:cache]
        return true
      end
    end
    return false
  else
    return cache_setting == "all" || cache_setting == "refresh"
  end
end

function render_chunk(chunk::Weave.DocChunk, keep_hidden)
  return join((Weave.render_inline(c) for c in chunk.content))
end 

function render_chunk(chunk::Weave.CodeChunk, keep_hidden)

  # code cell div
  result = string("::: {.cell .code}", "\n")
  
  # check echo option
  echo = chunk.options[:echo]

  # check for hidden code/output
  hide_code = !echo && keep_hidden
  hide_output = chunk.options[:results] == "hidden" && keep_hidden
  hide_figures = !chunk.options[:fig] && keep_hidden

  # return just code if there is no eval
  if !chunk.options[:eval]
    if echo || hide_code
      result *= render_code(chunk.content, hide_code)
      result *= ":::\n"
      return result
    else
      return ""
    end
  end

  if chunk.options[:term]
    if chunk_has_term_output(chunk) || hide_code
      result *= render_code(chunk.output, hide_code)
    end
  else
    if echo || hide_code
      result *= render_code(chunk.content, hide_code)
    end
    
    # handle terminal and rich outputs
    if chunk_has_output(chunk) || hide_output
      # raw output (e.g. tex or html)
      if chunk_has_raw_output(chunk) && !hide_output
        type = chunk.options[:results]
        if strip(chunk.output) ≠ ""
          result *= render_raw_output(chunk.output, type, hide_output)
        end
        if strip(chunk.rich_output) ≠ ""
          result *= render_raw_output(chunk.rich_output, type, hide_output)
        end
      # normal markup output
      else
        # optional line wrapping
        if chunk.options[:wrap]
          chunk.output = '\n' * Weave.wraplines(chunk.output, chunk.options[:line_width])
        else
          chunk.output = '\n' * rstrip(chunk.output)
        end
        #  normal output
        if strip(chunk.output) ≠ ""
          result *= render_stream_output(chunk.output, hide_output)
        end
        # rich output
        if strip(chunk.rich_output) ≠ ""
          result *= render_output(chunk.rich_output, ".display_data", hide_output)
        end
      end
    end
  end

  # handle figure output
  if chunk_has_figures(chunk) || hide_figures
    result *= render_figures(chunk, hide_figures)
  end

  # terminate div
  result *= ":::\n"

  # return result
  return result
end

function chunk_has_term_output(chunk)
  return chunk.options[:echo] && chunk.options[:results] ≠ "hidden"
end

function chunk_has_output(chunk)
  return (strip(chunk.output) ≠ "" || strip(chunk.rich_output) ≠ "") && 
         (chunk.options[:results] ≠ "hidden")
end

function chunk_has_raw_output(chunk)
  return chunk.options[:results] ≠ "markup" && chunk.options[:results] ≠ "hold"
end

function chunk_has_figures(chunk)
  return chunk.options[:fig] && length(chunk.figures) > 0
end

function render_code(code, hidden)
  output = code
  if (!startswith(output, "\n"))
    output = string("\n", output)
  end
  if !endswith(output, "\n")
    output *= "\n"
  end
  blockattrs = ifelse(hidden, "{.julia .hidden}", "julia")
  return string("```", blockattrs, output, "```\n")
end

function render_output(output, classes, hidden)
  if hidden
    classes *= " .hidden"
  end
  result = string("\n::: {.output ", classes, "}", "\n")
  result *= output
  if !endswith(result, "\n")
    result *= "\n"
  end
  result *= ":::\n"
  return result
end

function render_stream_output(output, hidden)
  render_output(string("```\n", strip(output), "\n```"),  ".stream .stdout", hidden)
end

function render_raw_output(output, type, hidden)
  raw = string("```{=", type, "}\n")
  raw *= output
  if !endswith(raw, "\n")
    raw *= "\n"
  end
  raw *= "```"
  return render_output(raw, ".display_data", hidden)
end

function render_figures(chunk, hidden)
  # return nothing for no figures
  fignames = chunk.figures
  if length(fignames) == 0
    return ""
  end

  # build figure attibutes
  attribs = String[]

  # width
  width = chunk.options[:out_width]
  if !isnothing(width) 
    push!(attribs, "width=$width") 
  end

  # height
  height = chunk.options[:out_height]
  if !isnothing(height)
    push!(attribs, "height=$height")
  end

  # label
  label = get(chunk.options, :label, nothing)
  if !isnothing(label)
    push!(attribs, "#$label")
  end

  # enclose attribs in {} if we have them
  attribs = isempty(attribs) ? "" : "{" * join(attribs, " ") * "}"

  # build result
  result = ""
  caption = chunk.options[:fig_cap]
  if !isnothing(caption)
    result *= render_figure(caption, fignames[1], attribs, hidden)
    for fig in fignames[2:end]
      result *= render_figure("", fig, attribs, hidden)
    end
  else
    for fig in fignames
      result *= render_figure("", fig, attribs, hidden)
    end
  end

  # return result
  return result
end

function render_figure(caption, path, attribs, hidden)
  return render_output("![$caption]($(path))$attribs", ".display_data", hidden)
end

function figure_size_hook!(chunk)
  w = chunk.options[:fig_width] * chunk.options[:dpi]
  h = chunk.options[:fig_height] * chunk.options[:dpi]
  Plots.default(size=(w, h))
end

# read options from stdin
options = JSON.parse(readline(stdin))
target = get(options, "target", Dict([]))
input = get(target, "input", "")
output = get(options, "output", "")
format = get(options, "format", Dict([]))
temp_dir = get(options, "tempDir", "")
quiet = get(options, "quiet", false)

# regsiter hooks
Weave.push_preexecution_hook!(figure_size_hook!)

# execute
result = execute(input, output, format, temp_dir)

# write result to stdout
JSON.print(stdout, result)


