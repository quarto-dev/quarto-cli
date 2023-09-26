
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

local function isRaw(el)
  return el.t == "RawBlock" or el.t == "RawInline"
end

local function isRawHtml(rawEl)
  return isRaw(rawEl) and string.find(rawEl.format, "^html") 
end

local function isRawLatex(rawEl)
  return isRaw(rawEl) and (rawEl.format == "tex" or rawEl.format == "latex")
end

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

local function isDocusaurusOutput()
  return string.match(param("custom-writer", ""), "docusaurus_writer.lua$")
end

local function isConfluenceOutput()
  return param("quarto-custom-format", "") == "confluence"
end


local function isDashboardOutput()
  return param("format-identifier", {})["base-format"] == "dashboard"
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

local function isGithubMarkdownOutput()
  return param("format-identifier", {})["base-format"] == "gfm"
end

local function isHugoMarkdownOutput()
  return param("format-identifier", {})["target-format"] == "hugo-md"
end

-- check for markdown with raw_html enabled
local function isMarkdownWithHtmlOutput()
  return (isMarkdownOutput() and tcontains(PANDOC_WRITER_OPTIONS.extensions, "raw_html")) or isDocusaurusOutput()
end

-- check for ipynb output
local function isIpynbOutput()
  return FORMAT == "ipynb"
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
    else
      return false
    end 
  end
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

return {
  isAsciiDocOutput = isAsciiDocOutput,
  isRawHtml = isRawHtml,
  isRawLatex = isRawLatex,
  isFormat = isFormat,
  isLatexOutput = isLatexOutput,
  isBeamerOutput = isBeamerOutput,
  isDocxOutput = isDocxOutput,
  isRtfOutput = isRtfOutput,
  isOdtOutput = isOdtOutput,
  isWordProcessorOutput = isWordProcessorOutput,
  isPowerPointOutput = isPowerPointOutput,
  isRevealJsOutput = isRevealJsOutput,
  isSlideOutput = isSlideOutput,
  isEpubOutput = isEpubOutput,
  isGithubMarkdownOutput = isGithubMarkdownOutput,
  isHugoMarkdownOutput = isHugoMarkdownOutput,
  isMarkdownOutput = isMarkdownOutput,
  isMarkdownWithHtmlOutput = isMarkdownWithHtmlOutput,
  isIpynbOutput = isIpynbOutput, 
  isHtmlOutput = isHtmlOutput, 
  isHtmlSlideOutput = isHtmlSlideOutput,
  isBibliographyOutput = isBibliographyOutput,
  isNativeOutput = isNativeOutput,
  isJsonOutput = isJsonOutput,
  isAstOutput = isAstOutput,
  isJatsOutput = isJatsOutput,
  isTypstOutput = isTypstOutput,
  isConfluenceOutput = isConfluenceOutput,
  isDocusaurusOutput = isDocusaurusOutput,
  isDashboardOutput = isDashboardOutput,
  parse_format = parse_format
}