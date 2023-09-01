-- meta.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- inject metadata
function crossrefMetaInject()
  return {
    Meta = function(meta)
      metaInjectLatex(meta, function(inject)
        
        inject(usePackage("caption"))

        inject(
          "\\AtBeginDocument{%\n" ..
          maybeRenewCommand("contentsname", param("toc-title-document", "Table of contents")) ..
          maybeRenewCommand("listfigurename", listOfTitle("lof", "List of Figures")) ..
          maybeRenewCommand("listtablename", listOfTitle("lot", "List of Tables")) ..
          maybeRenewCommand("figurename", titleString("fig", "Figure")) ..
          maybeRenewCommand("tablename", titleString("tbl", "Table")) ..
          "}\n"
        )
      
        if param("listings", false) then
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

function maybeRenewCommand(command, arg) 
  local commandWithArg = command .. "{" .. arg .. "}"
  return "\\ifdefined\\" .. command .. "\n  " .. "\\renewcommand*\\" .. commandWithArg .. "\n\\else\n  " .. "\\newcommand\\" .. commandWithArg .. "\n\\fi\n"
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
