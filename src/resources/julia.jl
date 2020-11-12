using JSON
using Weave

# - Forwarding of 'show-warnings' (doesn't seem to be supported right now)
#
# - Plots doesn't seem to respect fig_width and fig_height
#
# - Implement support for fig-format 'retina'
#
# - Allow 'weave_options' to be specified per-format. For this to work the 
#   weave_options need to be hoisted out of the options.metadata passed
#   to exeute and either merged w/ the source or merged using our own 
#   implementation of weave
#
# - Integrate quarto cache directives with Jweave cache. Note that we currently
#   return [] for supporting in case the user activates the cache unknown to
#   us (as supporting files need to hang around if there is a cache)
#
# - Markup up output w/ pandoc-compatible div structure (e.g. ::: {.cell .code})
#   Note that to do this it's likely we need to call WeaveDoc/run_doc directly
#   and then just operate directly on the chunks
# 
# - Implement 'keep-hidden' (need the lower level approach for this)
#
# - Implement 'execute: false' (again, likely need lower level approach for this)
#
# - correct handling of rich (e.g. plotly) outputs 
#

function execute(target, output, format, quiet)
    # input/output
    input = get(target, "input", "")

    # execution
    execution = get(format, "execution", Dict([]))
    fig_format = get(execution, "fig-format", "png")
    cache = get(execution, "cache", "user")
    if cache == "none"
        cache = "off"
    end

    # metadata
    metadata = get(format, "metadata", Dict([]))
    weave_options = get(format, "weave_options", nothing)

    # pandoc
    pandoc = get(format, "pandoc", Dict([]))
    to = get(pandoc, "to", "html")

    # progress
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

    # set chunk defaults
    # https://github.com/JunoLab/Weave.jl/blob/8206ca2d14b56293e55964f1cf53ef53c4238cc7/src/config.jl#L2
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
    doc = weave_doc(input, get(format, "metadata", Dict([])))

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
    

    # render chunks
    Weave.restore_header!(doc)
    body = []
    chunks = copy(doc.chunks)
    for (index, value) in enumerate(chunks)
        rendered = render_chunk(value)
        append!(body, rendered)
        append!(body, "\n")
    end
    body = join(body, "")

    # write out the results
    open(output, "w") do io
        write(io, body)
    end;

    # check if cache was used (affects supporting)
    defaults = get_chunk_defaults()
    cache_active = get(defaults, "cache", false)

    # return result
    result = Dict([
      ("supporting", ifelse(cache_active, [], [fig_dir])), 
      ("pandoc", Dict())
    ])
    return result
end

function weave_doc(input, metadata)

    # weave the doc
    header, chunks = Weave.parse_doc(read(input, String), "markdown")
    
    # update default chunk options from header
    chunk_defaults = deepcopy(get_chunk_defaults())
    if (weave_options = get(metadata, Weave.WEAVE_OPTION_NAME, nothing)) !== nothing
        for key in keys(chunk_defaults)
            if (val = get(weave_options, string(key), nothing)) !== nothing
                chunk_defaults[key] = val
            end
        end
    end

    # some paths
    path = abspath(input)
    _, fname = splitdir(path)
    basename = splitext(fname)[1]

    # do the weave
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
    if !get(get(format, "execution", Dict([])), "execute", true)
        for (index, value) in enumerate(doc.chunks)
            if typeof(value) == Weave.CodeChunk
                value.options[:eval] = false
            end
        end
    end

    # return 
    return doc

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
        result *= if echo
            render_code(chunk.content)
        else
            ""
        end

        if (strip(chunk.output) ≠ "" || strip(chunk.rich_output) ≠ "") && (chunk.options[:results] ≠ "hidden")
            if chunk.options[:results] ≠ "markup" && chunk.options[:results] ≠ "hold"
                type = chunk.options[:results]
                if strip(chunk.output) ≠ ""
                    result *= render_raw_output(chunk.output, type)
                end
                if strip(chunk.rich_output) ≠ ""
                    result *= render_raw_output(chunk.rich_output, type)
                end
            else
                if chunk.options[:wrap]
                    chunk.output =
                      '\n' * Weave.wraplines(chunk.output, chunk.options[:line_width])
                else
                    chunk.output = '\n' * rstrip(chunk.output)
                end

                if strip(chunk.output) ≠ ""
                    result *= render_output(chunk.output, ".stream .stdout")
                end
                if strip(chunk.rich_output) ≠ ""
                    result *= render_output(chunk.rich_output, ".display_data")
                end
            end
        end
    end

    # Handle figures
    if chunk.options[:fig] && length(chunk.figures) > 0
        result *= render_figures(chunk)
    end

    result *= ":::\n"

    return result
end

function render_code(code)
    return string("```julia", code, "```\n")
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

    fignames = chunk.figures
    length(fignames) > 0 || (return "")

    caption = chunk.options[:fig_cap]
    label = get(chunk.options, :label, nothing)
    result = ""
    figstring = ""
    attribs = ""
    width = chunk.options[:out_width]
    height = chunk.options[:out_height]

    # Build figure attibutes
    attribs = String[]
    isnothing(width) || push!(attribs, "width=$width")
    isnothing(height) || push!(attribs, "height=$height")
    isnothing(label) || push!(attribs, "#fig:$label")
    attribs = isempty(attribs) ? "" : "{" * join(attribs, " ") * "}"

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
    return result
end

function render_figure(caption, path, attribs)
    return render_output("![$caption]($(path))$attribs", ".display_data")
end


# read options
options = JSON.parse(readline(stdin))
target = get(options, "target", Dict([]))
output = get(options, "output", "")
format = get(options, "format", Dict([]))
quiet = get(options, "quiet", false)

# execute
result = execute(target, output, format, quiet)

# return result
JSON.print(stdout, result)


