

function metaInject(doc)
  if isLatexOutput() then
    metaInjectLatex(doc)
  elseif isHtmlOutput() then
    metaInjectHtml(doc)
  end
end

function metaInjectLatex(doc)
  ensureHeaderIncludes(doc)

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
end

function metaInjectHtml(doc)
  ensureHeaderIncludes(doc)

  local tblCaptionStyle =
    '<style type="text/css">\n' ..
    'div.table-caption {\n' ..
    '  text-align: center;\n' ..
    '}\n' ..
    '</style>'
  addHeaderInclude(doc, "html", tblCaptionStyle)

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

function listOfTitle(type, default)
  local title = option(type .. "-title")
  if title then
    return pandoc.utils.stringify(title)
  else
    return default
  end
end



