-- draft.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- inject metadata
function normalize_draft()

  local draft_mode = param('draft-mode') or "loose"
  local drafts = param('drafts') or {}
  local is_draft = false

  local kDraftStatusRemove = "draft-remove"
  local kDraftStatusDraft = "draft"

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
    Pandoc = function(doc)
      if _quarto.format.isHtmlOutput() and not _quarto.format.isHtmlSlideOutput() then
        if is_draft and draft_mode == kDraftModeGone then
          doc.blocks = pandoc.Blocks{}
          quarto.doc.includeText("in-header", '<meta name="quarto:status" content="' .. kDraftStatusRemove .. '">')
          return doc
        elseif is_draft and draft_mode ~= kDraftModeGone then
          quarto.doc.includeText("in-header", '<meta name="quarto:status" content="' .. kDraftStatusDraft .. '">')
          return doc
        end
      end
    end
  }
end
