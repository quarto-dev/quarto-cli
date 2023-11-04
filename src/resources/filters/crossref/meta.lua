-- meta.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- inject metadata
function crossrefMetaInject()
  return {
    Meta = function(meta)
      local function as_latex(inlines)
        return trim(pandoc.write(pandoc.Pandoc(inlines), "latex"))
      end
      metaInjectLatex(meta, function(inject)
        
        inject(usePackage("caption"))

        inject(
          "\\AtBeginDocument{%\n" ..
          maybeRenewCommand("contentsname", param("toc-title-document", "Table of contents")) ..
          maybeRenewCommand("listfigurename", listOfTitle("lof", "List of Figures")) ..
          maybeRenewCommand("listtablename", listOfTitle("lot", "List of Tables")) ..
          maybeRenewCommand("figurename", as_latex(title("fig", "Figure"))) ..
          maybeRenewCommand("tablename", as_latex(title("tbl", "Table"))) ..
          "}\n"
        )
      
        if param("listings", false) then
          inject(
            "\\newcommand*\\listoflistings\\lstlistoflistings\n" ..
            "\\AtBeginDocument{%\n" ..
            "\\renewcommand*\\lstlistlistingname{" .. listOfTitle("lol", "List of Listings") .. "}\n" ..
            "}\n"
          )
        else
          inject(
            usePackage("float") .. "\n" ..
            "\\floatstyle{ruled}\n" ..
            "\\@ifundefined{c@chapter}{\\newfloat{codelisting}{h}{lop}}{\\newfloat{codelisting}{h}{lop}[chapter]}\n" ..
            "\\floatname{codelisting}{" .. as_latex(title("lst", "Listing")) .. "}\n"
          )

          inject(
            "\\newcommand*\\listoflistings{\\listof{codelisting}{" .. listOfTitle("lol", "List of Listings") .. "}}\n"
          )
        end

        -- title-delim
        if crossrefOption("title-delim") ~= nil then
          local titleDelim = pandoc.utils.stringify(crossrefOption("title-delim"))
          if titleDelim == ":" or titleDelim == "colon" then
            inject("\\captionsetup{labelsep=colon}\n")
          elseif titleDelim == "." or titleDelim == "period" then
            inject("\\captionsetup{labelsep=period}\n")
          elseif titleDelim == " " or titleDelim == "space" then
            inject("\\captionsetup{labelsep=space}\n")
          elseif titleDelim == "quad" then
            inject("\\captionsetup{labelsep=quad}\n")
          elseif titleDelim == "none" or titleDelim == "" then
            inject("\\captionsetup{labelsep=none}\n")
          else
            fail("Invalid value for 'title-delim' option in PDF: " .. titleDelim .. ". The valid values are '', 'none', ':', 'colon', '.', 'period', ' ', 'space', and 'quad'")
          end
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
