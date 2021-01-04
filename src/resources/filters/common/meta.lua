-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- constants
kHeaderIncludes = "header-includes"
kIncludeBefore = "include-before"
kIncludeAfter = "include-after"

function ensureIncludes(doc, includes)
  if not doc.meta[includes] then
    doc.meta[includes] = pandoc.MetaList({})
  elseif doc.meta[includes].t == "MetaInlines" or 
         doc.meta[includes].t == "MetaBlocks" then
    doc.meta[includes] = pandoc.MetaList({doc.meta[includes]})
  end
end

-- add a header include as a raw block
function addInclude(doc, format, includes, include)
  doc.meta[includes]:insert(pandoc.MetaBlocks(pandoc.RawBlock(format, include)))
end

-- conditionally include a package
function usePackage(pkg)
  return "\\@ifpackageloaded{" .. pkg .. "}{}{\\usepackage{" .. pkg .. "}}"
end


function metaInjectLatex(doc, func)
  if isLatexOutput() then
    function inject(tex)
      addInclude(doc, "tex", kHeaderIncludes, tex)
    end
    inject("\\makeatletter")
    func(inject)
    inject("\\makeatother")
  end
end

function metaInjectHtml(doc, func)
  if isHtmlOutput() then
    function inject(html)
      addInclude(doc, "html", kHeaderIncludes, html)
    end
    func(inject)
  end
end
