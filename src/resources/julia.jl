using JSON
using Weave

#
# - Integrate quarto cache directives with Jweave cache. Note that we currently
#   return [] for supporting in case the user activates the cache unknown to
#   us (as supporting files need to hang around if there is a cache)
#
# - Implement 'keep-hidden' (need the lower level approach for this)
#
# - correct handling of rich (e.g. plotly) outputs  
#

function execute(input, output, format)
 
  # execution 
  execution = get(format, "execution", Dict([]))
  execute = get(execution, "execute", true)
  # cache
  cache = get(execution, "cache", "user")
  if cache == "none"
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

  # set the cache default correctly if it's not 'user'
  if cache == "all" || cache == "refresh"
    set_chunk_defaults!(:cache => true)
  elseif cache == "off"
    set_chunk_defaults!(:cache => false)
  end

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
    rendered = render_chunk(value)
    append!(markdown, rendered)
    append!(markdown, "\n")
  end
  
  # write out the results
  open(output, "w") do io
    write(io, join(markdown, ""))
  end;

  # check if cache was used (affects supporting)
  defaults = get_chunk_defaults()
  cache_active = get(defaults, "cache", false)

  # return result
  return Dict([
    ("supporting", ifelse(cache_active, [], [fig_dir])), 
    ("pandoc", Dict())
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

function render_chunk(chunk::Weave.DocChunk)
  return join((Weave.render_inline(c) for c in chunk.content))
end 

function render_chunk(chunk::Weave.CodeChunk)

  # code cell div
  result = string("::: {.cell .code}", "\n")
  
  # check echo option
  echo = chunk.options[:echo]

  # return just code if there is no eval
  if !chunk.options[:eval]
    if echo
      result *= render_code(chunk.content)
      result *= ":::\n"
      return result
    else
      return ""
    end
  end

  if chunk.options[:term]
    if Weave.should_render(chunk)
      result *= render_code(chunk.output)
    end
  else
    if echo
      result *= render_code(chunk.content)
    end
    
    # handle terminal and rich outputs
    if chunk_has_output(chunk)
      # raw output (e.g. tex or html)
      if chunk_has_raw_output(chunk)
        type = chunk.options[:results]
        if strip(chunk.output) ≠ ""
          result *= render_raw_output(chunk.output, type)
        end
        if strip(chunk.rich_output) ≠ ""
          result *= render_raw_output(chunk.rich_output, type)
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
          result *= render_output(chunk.output, ".stream .stdout")
        end
        # rich output
        if strip(chunk.rich_output) ≠ ""
          result *= render_output(chunk.rich_output, ".display_data")
        end
      end
    end
  end

  # handle figure output
  if chunk_has_figures(chunk)
    result *= render_figures(chunk)
  end

  # terminate div
  result *= ":::\n"

  # return result
  return result
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

function render_code(code)
  output = code
  if !endswith(output, "\n")
    output *= "\n"
  end
  return string("```julia", output, "```\n")
end

function render_output(output, classes)
  result = string("\n::: {.output ", classes, "}", "\n")
  result *= output
  if !endswith(result, "\n")
    result *= "\n"
  end
  result *= ":::\n"
  return result
end

function render_raw_output(output, type)
  raw = string("```{=", type, "}\n")
  raw *= output
  if !endswith(raw, "\n")
    raw *= "\n"
  end
  raw *= "```"
  return render_output(raw, ".display_data")
end

function render_figures(chunk)
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
    push!(attribs, "#fig:$label")
  end

  # enclose attribs in {} if we have them
  attribs = isempty(attribs) ? "" : "{" * join(attribs, " ") * "}"

  # build result
  result = ""
  caption = chunk.options[:fig_cap]
  if !isnothing(caption)
    result *= render_figure(caption, fignames[1], attribs)
    for fig in fignames[2:end]
      result *= render_figure("", fig, attribs)
    end
  else
    for fig in fignames
      result *= render_figure("", fig, attribs)
    end
  end

  # return result
  return result
end

function render_figure(caption, path, attribs)
  return render_output("![$caption]($(path))$attribs", ".display_data")
end


# read options from stdin
options = JSON.parse(readline(stdin))
target = get(options, "target", Dict([]))
input = get(target, "input", "")
output = get(options, "output", "")
format = get(options, "format", Dict([]))
quiet = get(options, "quiet", false)

# execute
result = execute(input, output, format)

# write result to stdout
JSON.print(stdout, result)


