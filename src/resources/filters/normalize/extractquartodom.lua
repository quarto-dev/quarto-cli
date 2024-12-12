-- extractquartodom.lua
-- Copyright (C) 2023 Posit Software, PBC

function parse_md_in_html_rawblocks()
  local function process_quarto_markdown_input_element(el)
    if el.attributes.qmd == nil and el.attributes["qmd-base64"] == nil then
      error("process_quarto_markdown_input_element called with element that does not have qmd or qmd-base64 attribute")
      return el
    end
    local text = el.attributes.qmd or quarto.base64.decode(el.attributes["qmd-base64"])
    return string_to_quarto_ast_blocks(text)
  end

  return {
    Div = function(div)
      if div.attributes.qmd ~= nil or div.attributes["qmd-base64"] ~= nil then
        return _quarto.ast.scaffold_element(process_quarto_markdown_input_element(div))
      end
    end,
    Span = function(span)
      if span.attributes.qmd ~= nil or span.attributes["qmd-base64"] ~= nil then
        local inlines = quarto.utils.as_inlines(process_quarto_markdown_input_element(span))
        if #inlines < 1 then
          return _quarto.ast.scaffold_element(pandoc.Inlines({}))
        end
        return _quarto.ast.scaffold_element(inlines)
      end
    end,
    RawBlock = function(raw)
      local result
      if raw.format == "pandoc-native" then
        result = pandoc.read(raw.text, "native").blocks
      elseif raw.format == "pandoc-json" then
        result = pandoc.read(raw.text, "json").blocks
      else
        return raw
      end
      return result
    end,
    RawInline = function(raw)
      local result
      if raw.format == "pandoc-native" then
        result = quarto.utils.as_inlines(pandoc.read(raw.text, "native").blocks)
      elseif raw.format == "pandoc-json" then
        -- let's try to be minimally smart here, and handle lists differently from a single top-level element
        result = quarto.utils.as_inlines(pandoc.read(raw.text, "json").blocks)
      else
        return raw
      end
      return result
    end,
  }
end

extracted_qmd_uuid = "3ab579b5-63b4-445d-bc1d-85bf6c4c04de"
local count = 0

function extract_latex_quartomarkdown_commands()
  if not _quarto.format.isLatexOutput() then 
    return {}
  end

  if doc == nil then
    return {
      RawBlock = function(el)
        if not _quarto.format.isRawLatex(el) then
          return nil
        end
        local text = el.text
        -- provide an early exit if the text does not contain the pattern
        -- because Lua's pattern matching apparently takes a long time
        -- to fail: https://github.com/quarto-dev/quarto-cli/issues/9729
        if text:match("\\QuartoMarkdownBase64{") == nil then
          return nil
        end
        local pattern = "(.*)(\\QuartoMarkdownBase64{)([^}]*)(})(.*)"
        local pre, _, content, _, post = text:match(pattern)
        if pre == nil then
          return nil
        end
        while pre do
          count = count + 1
          local uuid = extracted_qmd_uuid .. "-" .. tostring(count)
          _quarto.ast.vault.add(uuid, string_to_quarto_ast_blocks(quarto.base64.decode(content)))
          text = pre .. uuid .. post
          pre, _, content, _, post = text:match(pattern)
        end
        return pandoc.RawBlock(el.format, text)
      end
    }
  end
end

function inject_vault_content_into_rawlatex()
  return {
    RawBlock = function(el)
      if not _quarto.format.isRawLatex(el) then
        return nil
      end
      local vault = _quarto.ast.vault.locate()
      if vault == nil then
        -- luacov: disable
        internal_error()
        return nil
        -- luacov: enable
      end
      local text = el.text
      -- provide an early exit if the text does not contain the pattern
      -- because Lua's pattern matching apparently takes a long time
      -- to fail: https://github.com/quarto-dev/quarto-cli/issues/9729
      if el.text:match("3ab579b5%-63b4%-445d%-bc1d%-85bf6c4c04de") == nil then
        return nil
      end
  
      local pattern = "(.*)(3ab579b5%-63b4%-445d%-bc1d%-85bf6c4c04de%-[0-9]+)(.*)"
      local pre, content_id, post = text:match(pattern)

      while pre do
        local found = false
        vault.content = _quarto.ast.walk(vault.content, {
          Div = function(div)
            if div.identifier ~= content_id then
              return
            end
            _quarto.ast.vault.remove(content_id)
            local rendered = pandoc.write(pandoc.Pandoc(div.content), "latex")
            text = pre .. rendered .. post
            pre, content_id, post = text:match(pattern)
            found = true
            return {}
          end
        })
        if not found then
          -- luacov: disable
          internal_error()
          return nil
          -- luacov: enable
        end
      end
      return pandoc.RawBlock(el.format, text)
    end,
  }
end
