-- does the table contain a value
local function tcontains(t,value)
  if t and type(t)=="table" and value then
    for _, v in ipairs (t) do
      if v == value then
        return true
      end
    end
    return false
  end
  return false
end

local function _main()
  -- Element format checks

  local function isRaw(el)
    return el.t == "RawBlock" or el.t == "RawInline"
  end

  local function isRawHtml(rawEl)
    return isRaw(rawEl) and string.find(rawEl.format, "^html") 
  end

  local function isRawLatex(rawEl)
    return isRaw(rawEl) and (rawEl.format == "tex" or rawEl.format == "latex")
  end

  -- Format checks

  -- Format checks based on FORMAT

  -- check for latex output
  local function isLatexOutput()
    return FORMAT == "latex" or FORMAT == "beamer" or FORMAT == "pdf"
  end

  local function isAsciiDocOutput()
    return FORMAT == "asciidoc" or FORMAT == "asciidoctor"
  end 

  local function isBeamerOutput()
    return FORMAT == "beamer"
  end

  -- check for docx output
  local function isDocxOutput()
    return FORMAT == "docx"
  end

  -- check for rtf output
  local function isRtfOutput()
    return FORMAT == "rtf"
  end

  -- check for odt output
  local function isOdtOutput()
    return FORMAT == "odt" or FORMAT == "opendocument"
  end

  -- check for word processor output
  local function isWordProcessorOutput()
    return FORMAT == "docx" or FORMAT == "rtf" or isOdtOutput()
  end

  -- check for powerpoint output
  local function isPowerPointOutput()
    return FORMAT == "pptx"
  end

  -- check for revealjs output
  local function isRevealJsOutput()
    return FORMAT == "revealjs"
  end

  local function isHtmlSlideOutput()
    local formats = {
      "s5",
      "dzslides",
      "slidy",
      "slideous",
      "revealjs",
    }
    return tcontains(formats, FORMAT)
  end

  -- check for slide output
  local function isSlideOutput()
    return isHtmlSlideOutput() or isBeamerOutput() or isPowerPointOutput()
  end

  -- check for epub output
  local function isEpubOutput()
    local formats = {
      "epub",
      "epub2",
      "epub3"
    }
    return tcontains(formats, FORMAT)
  end

  -- check for bibliography formats
  local function isBibliographyOutput()
    local formats = {
      "bibtex",
      "biblatex",
      "csljson"
    }
    return tcontains(formats, FORMAT)
  end

  -- check for ipynb output
  local function isIpynbOutput()
    return FORMAT == "ipynb"
  end


  -- format checks based on quarto-custom-format

  local function isDocusaurusOutput()
    return param("quarto-custom-format", "") == "docusaurus"
  end

  local function isConfluenceOutput()
    return param("quarto-custom-format", "") == "confluence"
  end

  -- check for markdown output
  local function isMarkdownOutput()
    local formats = {
      "markdown",
      "markdown_github",
      "markdown_mmd", 
      "markdown_phpextra",
      "markdown_strict",
      "gfm",
      "commonmark",
      "commonmark_x",
      "markua"
    }
    return tcontains(formats, FORMAT) or isDocusaurusOutput()
  end

  -- check for markdown with raw_html enabled
  local function isMarkdownWithHtmlOutput()
    return (isMarkdownOutput() and tcontains(PANDOC_WRITER_OPTIONS.extensions, "raw_html")) or isDocusaurusOutput()
  end

  -- check for html output
  local function isHtmlOutput()
    local formats = {
      "html",
      "html4",
      "html5",
      "epub",
      "epub2",
      "epub3"
    }
    return tcontains(formats, FORMAT) or isHtmlSlideOutput()
  end

  local function parse_format(raw_format)
    local pattern = "^([%a_]+)([-+_%a]*)"
    local i, j, format, extensions = raw_format:find(pattern)
    if format == nil then
      error("Warning: Invalid format " .. raw_format .. ". Assuming 'markdown'.")
      return {
        format = "markdown",
        extensions = {}
      }
    end

    local result = {
      format = format,
      extensions = {}
    }

    local sign_table = {
      ["-"] = false,
      ["+"] = true
    }

    if extensions ~= nil then
      while #extensions > 0 do
        local i, j, sign, variant = extensions:find("^([-+])([%a_]+)")
        result.extensions[variant] = sign_table[sign]
        extensions = extensions:sub(j+1)      
      end
    end

    return result
  end

  local function isNativeOutput()
    return FORMAT == "native"
  end

  local function isJsonOutput()
    return FORMAT == "json"
  end

  local function isAstOutput()
    return isNativeOutput() or isJsonOutput()
  end

  local function isJatsOutput() 
    local formats = {
      "jats",
      "jats_archiving",
      "jats_articleauthoring",
      "jats_publishing",
    }
    return tcontains(formats, FORMAT)
  end

  local function isTypstOutput()
    return FORMAT == "typst"
  end

  -- format checks based on format-identifier.base-format

  local function isEmailOutput()
    return param("format-identifier", {})["base-format"] == "email"
  end

  local function isDashboardOutput()
    return param("format-identifier", {})["base-format"] == "dashboard"
  end

  local function isGithubMarkdownOutput()
    return param("format-identifier", {})["base-format"] == "gfm"
  end


  -- format checks based on format-identifier.target-format

  local function isHugoMarkdownOutput()
    return param("format-identifier", {})["target-format"] == "hugo-md"
  end

  -- Functions used by other exports

  -- we have some special rules to allow formats to behave more intuitively
  local function isFormat(to)
    if FORMAT == to then
      return true
    else
      -- latex and pdf are synonyms
      if to == "latex" or to == "pdf" then
        return isLatexOutput()
      -- odt and opendocument are synonyms
      elseif to == "odt" or to == "opendocument" then
        return isOdtOutput()
      -- epub: epub, epub2, or epub3
      elseif to:match 'epub' then 
        return isEpubOutput()
      -- html: html, html4, html4, epub*, or slides (e.g. revealjs)
      elseif to == "html" then
        return isHtmlOutput()
      elseif to == "html:js" then
        -- html formats that support javascript (excluding epub)
        return isHtmlOutput() and not isEpubOutput()
      -- markdown: markdown*, commonmark*, gfm, markua
      elseif to == "markdown" then
        return isMarkdownOutput()
      elseif to == "asciidoc" or to == "asciidoctor" then
        return isAsciiDocOutput()
      elseif to == "confluence" then
        return isConfluenceOutput()
      elseif to == "docusaurus" or to == "docusaurus-md" then
        return isDocusaurusOutput()  
      elseif to == "email" then
        return isEmailOutput()
      elseif to == "dashboard" then
        return isDashboardOutput()
      elseif to == "gfm" then
        return isGithubMarkdownOutput()
      elseif to == "hugo-md" or to == 'hugo' then
        return isHugoMarkdownOutput()
      --[[ Not working yet
      elseif to == "ipynb" then
        return isIpynbOutput()
      ]]--
      else
        return false
      end 
    end
  end

  return {
    isAsciiDocOutput = isAsciiDocOutput,
    is_asciidoc_output = isAsciiDocOutput,
    isRawHtml = isRawHtml,
    is_raw_html = isRawHtml,
    isRawLatex = isRawLatex,
    is_raw_latex = isRawLatex,
    isFormat = isFormat,
    is_format = isFormat,
    isLatexOutput = isLatexOutput,
    is_latex_output = isLatexOutput,
    isBeamerOutput = isBeamerOutput,
    is_beamer_output = isBeamerOutput,
    isDocxOutput = isDocxOutput,
    is_docx_output = isDocxOutput,
    isRtfOutput = isRtfOutput,
    is_rtf_output = isRtfOutput,
    isOdtOutput = isOdtOutput,
    is_odt_output = isOdtOutput,
    isWordProcessorOutput = isWordProcessorOutput,
    is_word_processor_output = isWordProcessorOutput,
    isPowerPointOutput = isPowerPointOutput,
    is_powerpoint_output = isPowerPointOutput,
    isRevealJsOutput = isRevealJsOutput,
    is_revealjs_output = isRevealJsOutput,
    isSlideOutput = isSlideOutput,
    is_slide_output = isSlideOutput,
    isEpubOutput = isEpubOutput,
    is_epub_output = isEpubOutput,
    isGithubMarkdownOutput = isGithubMarkdownOutput,
    is_github_markdown_output = isGithubMarkdownOutput,
    isHugoMarkdownOutput = isHugoMarkdownOutput,
    is_hugo_markdown_output = isHugoMarkdownOutput,
    isMarkdownOutput = isMarkdownOutput,
    is_markdown_output = isMarkdownOutput,
    isMarkdownWithHtmlOutput = isMarkdownWithHtmlOutput,
    is_markdown_with_html_output = isMarkdownOutput,
    isIpynbOutput = isIpynbOutput, 
    is_ipynb_output = isIpynbOutput,
    isHtmlOutput = isHtmlOutput, 
    is_html_output = isHtmlOutput,
    isHtmlSlideOutput = isHtmlSlideOutput,
    is_html_slide_output = isHtmlOutput,
    isBibliographyOutput = isBibliographyOutput,
    is_bibliography_output = isBibliographyOutput,
    isNativeOutput = isNativeOutput,
    is_native_output = isNativeOutput,
    isJsonOutput = isJsonOutput,
    is_json_output = isJsonOutput,
    isAstOutput = isAstOutput,
    is_ast_output = isAstOutput,
    isJatsOutput = isJatsOutput,
    is_jats_output = isJatsOutput,
    isTypstOutput = isTypstOutput,
    is_typst_output = isTypstOutput,
    isConfluenceOutput = isConfluenceOutput,
    is_confluence_output = isConfluenceOutput,
    isDocusaurusOutput = isDocusaurusOutput,
    is_docusaurus_output = isDocusaurusOutput,
    isDashboardOutput = isDashboardOutput,
    is_dashboard_output = isDashboardOutput,
    isEmailOutput = isEmailOutput,
    is_email_output = isEmailOutput,
    parse_format = parse_format
  }
end

return _main()
