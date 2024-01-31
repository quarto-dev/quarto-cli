-- draft.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- inject metadata
function normalize_draft()

  local draft_mode = param('draft-mode') or "loose"
  local drafts = param('drafts') or {}
  local is_draft = false
  local kDraftStatus = "draft-remove"
  local kDraftMode = "draft-mode"
  local kDraft = "draft"

  local kDraftModeGone = "gone"

  return {
    Meta = function(meta)
      if meta[kDraftMode] ~= nil then
        draft_mode = pandoc.utils.stringify(meta[kDraftMode])
      end
      is_draft = meta[kDraft] == true or tcontains(drafts, quarto.doc.input_file);     
    end,
    Pandoc = function(pandoc) 
      if _quarto.format.isHtmlOutput() and not _quarto.format.isHtmlSlideOutput() then
        if is_draft and draft_mode == kDraftModeGone then
          pandoc.blocks = {}
          quarto.doc.includeText("in-header", '<meta name="quarto:status" content="' .. kDraftStatus .. '">')
          return pandoc
        end
      end
    end
  }
end