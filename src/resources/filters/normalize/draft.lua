-- draft.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- inject metadata
function normalize_draft()

  local draft_mode = "loose"
  local is_draft = false
  local kDraftStatus = "draft-remove"
  local kDraftMode = "draft-mode"
  local kDraft = "draft"

  return {
    Meta = function(meta)
      if _quarto.format.isHtmlOutput() and not _quarto.format.isHtmlSlideOutput() then
        if meta[kDraftMode] ~= nil then
          draft_mode = pandoc.utils.stringify(meta[kDraftMode])
        end
        is_draft = meta[kDraft] == true;
      end
    end,
    Pandoc = function(pandoc) 
      if _quarto.format.isHtmlOutput() and not _quarto.format.isHtmlSlideOutput() then
        if is_draft and draft_mode == "strict" then
          pandoc.blocks = {}
          quarto.doc.includeText("in-header", '<meta name="quarto:status" content="' .. kDraftStatus .. '">')
          return pandoc
        end
      end
    end
  }
end