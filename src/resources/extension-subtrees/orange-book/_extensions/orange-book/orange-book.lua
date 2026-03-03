-- orange-book.lua
-- Orange-book specific part and appendix handling for Typst books

local function is_typst_book()
  local file_state = quarto.doc.file_metadata()
  return quarto.doc.is_format("typst") and
         file_state ~= nil and
         file_state.file ~= nil
end

local header_filter = {
  Header = function(el)
    local file_state = quarto.doc.file_metadata()

    if not is_typst_book() then
      return nil
    end

    if file_state == nil or file_state.file == nil then
      return nil
    end

    local file = file_state.file
    local bookItemType = file.bookItemType

    if el.level ~= 1 or bookItemType == nil then
      return nil
    end

    -- Handle parts
    if bookItemType == "part" then
      return pandoc.RawBlock('typst', '#part[' .. pandoc.utils.stringify(el.content) .. ']')
    end

    -- Handle appendices
    if bookItemType == "appendix" then
      -- First appendix triggers the show rule with localized "Appendices" title
      if file.bookItemNumber == 1 or file.bookItemNumber == nil then
        -- Get localized title from language settings
        local language = quarto.doc.language
        local appendicesTitle = (language and language["section-title-appendices"]) or "Appendices"

        -- Use hide-parent: true to work around orange-book bug where unnumbered headings
        -- (like Bibliography) trigger duplicate "Appendices" TOC entries.
        local appendixStart = pandoc.RawBlock('typst',
          '#show: appendices.with("' .. appendicesTitle .. '", hide-parent: true)')

        -- If this is the synthetic "Appendices" divider heading (has .unnumbered class),
        -- emit our own Appendices heading for TOC display
        if el.classes:includes("unnumbered") then
          local appendicesHeading = pandoc.RawBlock('typst',
            '#heading(level: 1, numbering: none)[' .. appendicesTitle .. ']')
          return {appendixStart, appendicesHeading}
        end

        return {appendixStart, el}
      end
    end

    return nil
  end
}

-- Combine with file_metadata_filter so book metadata markers are parsed
-- during this filter's document traversal (needed for bookItemType, etc.)
return quarto.utils.combineFilters({
  quarto.utils.file_metadata_filter(),
  header_filter
})
