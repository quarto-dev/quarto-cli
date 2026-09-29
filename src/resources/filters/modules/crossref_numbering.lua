-- crossref_numbering.lua
-- Copyright (C) 2026 Posit Software, PBC
--
-- Predicates that separate two questions the crossref filters previously
-- conflated under the single `enableCrossRef` flag:
--   - crossref_present(): should captions/refs still be decorated with
--     numbers (possibly numbers supplied by an external caller)?
--   - assign_crossref_numbers(): should quarto itself compute and assign
--     those numbers (index building, @ref resolution)?
--
-- A caller that sets `crossref-numbering: external` wants quarto's
-- render-decoration filters to keep presenting numbers, but wants quarto's
-- own numbering/index/@ref-resolve group to stay out of the way because it
-- is supplying the numbers itself.

local function crossref_present()
  return param("enable-crossref", true) or
    param("crossref-numbering", "quarto") == "external"
end

local function assign_crossref_numbers()
  return param("enable-crossref", true) and
    param("crossref-numbering", "quarto") ~= "external"
end

return {
  crossref_present = crossref_present,
  assign_crossref_numbers = assign_crossref_numbers,
}
