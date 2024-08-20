-- contentsshortcode.lua
-- Copyright (C) 2020-2024 Posit Software, PBC

function contents_shortcode_filter()
  local ids_used = {}
  local divs = {}
  local spans = {}

  return {
    Pandoc = function(doc)
      _quarto.ast.walk(doc.blocks, {
        RawInline = function(el)
          if el.format ~= "quarto-internal" then
            return
          end
          if not pcall(function() 
            local data = quarto.json.decode(el.text)
            if data.type == "contents-shortcode" then
              ids_used[data.payload.id] = true
            end
          end) then
            warn("[Malformed document] Failed to decode quarto-internal JSON: " .. el.text)
          end
        end
      })
      doc.blocks = _quarto.ast.walk(doc.blocks, {
        Div = function(el)
          if ids_used[el.attr.identifier] then
            divs[el.attr.identifier] = el
            return {}
          end
          -- remove 'cell-' from identifier, try again
          local truncated_id = el.attr.identifier:match("^cell%-(.+)$")
          if ids_used[truncated_id] then
            divs[truncated_id] = el
            -- FIXME: this is a workaround for the fact that we don't have a way to
            --        distinguish between divs that appear as the output of code cells
            --        (which have a different id creation mechanism)
            --        and "regular" divs.
            --        We need to fix https://github.com/quarto-dev/quarto-cli/issues/7062 first.
            return {}
          else
            return nil
          end
        end,
        Span = function(el)
          if not ids_used[el.attr.identifier] then
            return nil
          end
          spans[el.attr.identifier] = el
          return {}
        end
      })

      local handle_block = function(el)
        if #el.content ~= 1 then
          return nil
        end
        local raw = quarto.utils.match("[1]/RawInline")(el)
        if not raw then
          return nil
        end
        local result, data = pcall(function() 
          local data = quarto.json.decode(raw.text)
          if data.type == "contents-shortcode" then
            return data.payload.id
          end
          return false
        end)
        if data == false then
          return nil
        end
        if not result or data == nil then
          warn("[Malformed document] Failed to decode quarto-internal JSON: \n" .. data .. "\n. Removing from document.")
          return {}
        end
        local div = divs[data]
        if div == nil then
          warn(
            "[Malformed document] Found `contents` shortcode without a corresponding div with id: " .. tostring(data) .. ".\n" ..
            "This might happen because the shortcode is used in div context, while the id corresponds to a span.\n" ..
            "Removing from document.")
          return {}
        end
        return div
      end
      -- replace div-context entries
      doc.blocks = _quarto.ast.walk(doc.blocks, {
        Para = handle_block,
        Plain = handle_block
      })
      -- replace span-context entries
      doc.blocks = _quarto.ast.walk(doc.blocks, {
        RawInline = function(el)
          if el.format ~= "quarto-internal" then
            return
          end
          local result, data = pcall(function() 
            local data = quarto.json.decode(el.text)
            if data.type == "contents-shortcode" then
              return spans[data.payload.id]
            end
          end)
          if not result then
            warn("[Malformed document] Failed to decode quarto-internal JSON: \n" .. el.text .. "\n. Removing from document.")
            return {}
          end
          if data == nil then
            warn(
              "[Malformed document] Found `contents` shortcode without a corresponding span with id: " .. el.text .. ".\n" ..
              "This might happen because this shortcode is used in span context, while the id corresponds to a div.\n" ..
              "Removing from document.")
            return {}
          end
          return data
        end        
      })

      -- TODO: text-context?
      return doc
    end
  }
end
