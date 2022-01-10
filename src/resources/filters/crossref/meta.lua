-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
function crossrefMetaInject()
  return {
    Meta = function(meta)
      metaInjectLatex(meta, function(inject)
        
        inject(usePackage("caption"))
     
        inject(
          "\\AtBeginDocument{%\n" ..
          "\\renewcommand*\\contentsname{" .. param("toc-title-document", "Table of contents") .. "}\n" ..
          "\\renewcommand*\\listfigurename{" .. listOfTitle("lof", "List of Figures") .. "}\n" ..
          "\\renewcommand*\\listtablename{" .. listOfTitle("lot", "List of Tables") .. "}\n" ..
          "\\renewcommand*\\figurename{" .. titleString("fig", "Figure") .. "}\n" ..
          "\\renewcommand*\\tablename{" .. titleString("tbl", "Table") .. "}\n" ..
          "}\n"
        )
      
        if latexListings() then
          inject(
            "\\newcommand*\\listoflistings\\lstlistoflistings\n" ..
            "\\AtBeginDocument{%\n" ..
            "\\renewcommand*\\lstlistlistingname{" .. listOfTitle("lol", "List of Listigs") .. "}\n" ..
            "}\n"
          )
        else
          inject(
            usePackage("float") .. "\n" ..
            "\\floatstyle{ruled}\n" ..
            "\\@ifundefined{c@chapter}{\\newfloat{codelisting}{h}{lop}}{\\newfloat{codelisting}{h}{lop}[chapter]}\n" ..
            "\\floatname{codelisting}{" .. titleString("lst", "Listing") .. "}\n"
          )

          inject(
            "\\newcommand*\\listoflistings{\\listof{codelisting}{" .. listOfTitle("lol", "List of Listings") .. "}}\n"
          )
        end
        
        local theoremIncludes = theoremLatexIncludes()
        if theoremIncludes then
          inject(theoremIncludes)
        end
      end)
      
      return meta
    end
  }
end


-- latex 'listof' title for type
function listOfTitle(type, default)
  local title = crossrefOption(type .. "-title")
  if title then
    return pandoc.utils.stringify(title)
  else
    return param("crossref-" .. type .. "-title", default)
  end
end
