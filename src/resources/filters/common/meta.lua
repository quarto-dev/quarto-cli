-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- constants
local kHeaderIncludes = "header-includes"

-- ensure that header-includes is a MetaList
function ensureHeaderIncludes(doc)
  if not doc.meta[kHeaderIncludes] then
    doc.meta[kHeaderIncludes] = pandoc.MetaList({})
  elseif doc.meta[kHeaderIncludes].t == "MetaInlines" then
    doc.meta[kHeaderIncludes] = pandoc.MetaList({doc.meta[kHeaderIncludes]})
  end
end

-- add a header include as a raw block
function addHeaderInclude(doc, format, include)
  doc.meta[kHeaderIncludes]:insert(pandoc.MetaBlocks(pandoc.RawBlock(format, include)))
end

-- conditionally include a package
function usePackage(pkg)
  return "\\@ifpackageloaded{" .. pkg .. "}{}{\\usepackage{" .. pkg .. "}}"
end


function metaInjectLatex(doc, func)
  if isLatexOutput() then
    ensureHeaderIncludes(doc)
    function inject(tex)
      addHeaderInclude(doc, "tex", tex)
    end
    inject("\\makeatletter")
    func(inject)
    inject("\\makeatother")
  end
end

function metaInjectHtml(doc, func)
  if isHtmlOutput() then
    ensureHeaderIncludes(doc)
    function inject(html)
      addHeaderInclude(doc, "html", html)
    end
    func(inject)
  end
end
