-- landscape.lua
-- Copyright (C) 2024-2024 Posit Software, PBC
--
-- Author: [Edvin Syk](https://github.com/edvinsyk/)

function landscape_div()
  local ooxml = function(s)
    return pandoc.RawBlock('openxml', s)
  end

  local function to_twips(x)
    local num_unit = { x:match("([%d%.]+)%s*(%a+)") }
    local num = tonumber(num_unit[1])
    local unit = num_unit[2]
    if unit == "cm" then
      return num * 1440 / 2.54
    elseif unit == "in" then
      return num * 1440
    else
      error("Unsupported unit: " .. tostring(unit))
    end
  end

  local docx_section_open = '<w:p><w:pPr><w:sectPr>'
  local docx_section_close = '</w:sectPr></w:pPr></w:p>'
  -- Define the end of a portrait section for DOCX
  local end_portrait_section = ooxml(docx_section_open .. docx_section_close)

  -- LateX commands for starting and ending a landscape section
  local landscape_start_pdf = pandoc.RawBlock('latex', '\\begin{landscape}')
  local landscape_end_pdf = pandoc.RawBlock('latex', '\\end{landscape}')

  local landscape_start_typst = pandoc.RawBlock('typst', '#set page(flipped: true)')
  local landscape_end_typst = pandoc.RawBlock('typst', '#set page(flipped: false)')

  local function Meta(meta)
    metaInjectLatex(meta, function(inject)
      inject("\\usepackage{pdflscape}")
    end)
    return meta
  end

  local function Div(div)
    if div.classes:includes('landscape') then
      if FORMAT:match 'docx' then
        -- DOCX-specific landscape orientation
        local height = div.attributes.height or "8.5in"
        local width = div.attributes.width or "11in"

        -- Define the end of a landscape section for DOCX
        local end_landscape_section = ooxml(
          docx_section_open ..
          '<w:pgSz w:h="' .. to_twips(height) .. '" w:w="' .. to_twips(width) .. '" w:orient="landscape" />' ..
          docx_section_close
        )
        div.content:insert(1, end_portrait_section)
        div.content:insert(end_landscape_section)
      elseif FORMAT:match 'latex' then
        -- PDF-specific landscape orientation using KOMA-Script

        div.content:insert(1, landscape_start_pdf)
        div.content:insert(landscape_end_pdf)
      elseif FORMAT:match 'typst' then
        -- Insert the landscape start command before the Div content
        table.insert(div.content, 1, landscape_start_typst)
        table.insert(div.content, landscape_end_typst)
        return div.content
      end
      return div
    end
  end

  return {
    Meta = Meta,
    Div = Div
  }
end
