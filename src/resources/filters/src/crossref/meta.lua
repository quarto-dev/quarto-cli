-- inject metadata
function metaInject()
  return {
    Pandoc = function(doc)
      if isLatexOutput() then
        metaInjectLatex(doc)
      end
      return doc
    end
  }
end

-- inject required latex
function metaInjectLatex(doc)

  ensureHeaderIncludes(doc)

  addHeaderInclude(doc, "tex", "\\makeatletter")

  -- TODO: move this to figures filter?
  local subFig =
    usePackage("subfig") .. "\n" ..
    usePackage("caption") .. "\n" ..
    "\\captionsetup[subfloat]{margin=0.5em}"
  addHeaderInclude(doc, "tex", subFig)

  local floatNames =
    "\\AtBeginDocument{%\n" ..
    "\\renewcommand*\\figurename{" .. titleString("fig", "Figure") .. "}\n" ..
    "\\renewcommand*\\tablename{" .. titleString("tbl", "Table") .. "}\n" ..
    "}\n"
  addHeaderInclude(doc, "tex", floatNames)

  local listNames =
    "\\AtBeginDocument{%\n" ..
    "\\renewcommand*\\listfigurename{" .. listOfTitle("lof", "List of Figures") .. "}\n" ..
    "\\renewcommand*\\listtablename{" .. listOfTitle("lot", "List of Tables") .. "}\n" ..
    "}\n"
  addHeaderInclude(doc, "tex", listNames)

  if latexListings() then
    local lolCommand =
      "\\newcommand*\\listoflistings\\lstlistoflistings\n" ..
      "\\AtBeginDocument{%\n" ..
      "\\renewcommand*\\lstlistlistingname{" .. listOfTitle("lol", "List of Listigs") .. "}\n" ..
      "}\n"
    addHeaderInclude(doc, "tex", lolCommand)
  else
    local codeListing =
      usePackage("float") .. "\n" ..
      "\\floatstyle{ruled}\n" ..
      "\\@ifundefined{c@chapter}{\\newfloat{codelisting}{h}{lop}}{\\newfloat{codelisting}{h}{lop}[chapter]}\n" ..
      "\\floatname{codelisting}{" .. titleString("lst", "Listing") .. "}\n"
    addHeaderInclude(doc, "tex", codeListing)

    local lolCommand =
      "\\newcommand*\\listoflistings{\\listof{codelisting}{" .. listOfTitle("lol", "List of Listings") .. "}}\n"
    addHeaderInclude(doc, "tex", lolCommand)
  end

  addHeaderInclude(doc, "tex", "\\makeatother")

end


-- ensure that header-includes is a MetaList
function ensureHeaderIncludes(doc)
  local kHeaderIncludes = "header-includes"
  if not doc.meta[kHeaderIncludes] then
    doc.meta[kHeaderIncludes] = pandoc.MetaList({})
  elseif doc.meta[kHeaderIncludes].t == "MetaInlines" then
    doc.meta[kHeaderIncludes] = pandoc.MetaList({doc.meta[kHeaderIncludes]})
  end
end

-- add a header include as a raw block
function addHeaderInclude(doc, format, include)
  doc.meta["header-includes"]:insert(pandoc.MetaBlocks(pandoc.RawBlock(format, include)))
end

-- conditionally include a package
function usePackage(pkg)
  return "\\@ifpackageloaded{" .. pkg .. "}{}{\\usepackage{" .. pkg .. "}}"
end

-- latex 'listof' title for type
function listOfTitle(type, default)
  local title = option(type .. "-title")
  if title then
    return pandoc.utils.stringify(title)
  else
    return default
  end
end
