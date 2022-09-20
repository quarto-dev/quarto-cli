-- detect whether the engine is 'pdflatex' and add a classoption

-- detect the journal and include the appropriate bst in format resources
local kClassOpt = "classoption"
local kDefaultStyle = "sn-basic"
local kStyleNames = pandoc.List({
    "sn-apacite",
    "sn-aps",
    "sn-basic",
    "sn-chicago",
    "sn-mathphys",
    "sn-standardnature",
    "sn-vancouver"
})

local kJournal = "journal"
local kBibStyle = "bib-style"

local kPdfLatex = "pdflatex"


local function hasClassOption(meta, option)
  if meta[kClassOpt] then
    for i,v in ipairs(meta[kClassOpt]) do
      if pandoc.utils.stringify(v) == option then
        return true
      end
    end
  end
  return false
end

return {
  {
    Meta = function(meta) 
      if quarto.doc.isFormat("pdf") then

        -- When producing a pdf using pdflatex, we need to be sure
        -- this is included in the classoption for the document
        if quarto.render.pdfEngine() == kPdfLatex then
          local hasOption = false
          if meta[kClassOpt] ~= nil then
            hasOption = hasClassOption(meta, kPdfLatex)
          else
            meta[kClassOpt] = pandoc.MetaList({})
          end
          if not hasOption then
            meta[kClassOpt]:insert(kPdfLatex)
          end
        end

        -- When producing PDFs and using natbib, we need to move the proper style file into
        -- place for generating the bibliography and processing cites
        if quarto.render.citeMethod() == 'natbib' then
            local stylename = nil

            -- See if a class option is already set for this
            -- if so, just respect that
            if meta[kClassOpt] then
              for i,v in ipairs(meta[kClassOpt]) do
                if kStyleNames:includes(v) then
                  stylename = v
                  break
                end
              end
            end
            
            -- If no class option is already set, check to see if one
            -- has been specified in the 'journal/bib-style' key
            if stylename == nil then
            stylename = pandoc.Str(kDefaultStyle)
            local journal = meta[kJournal]

            if journal ~= nil then
              local bibstyle = journal[kBibStyle]
              if bibstyle ~= nil then
                stylename = bibstyle
              end
            end

            -- add the style to the classoption
            if not meta[kClassOpt] then
              meta[kClassOpt] = pandoc.MetaList({})
            end

            meta[kClassOpt]:insert(stylename)
            end

            -- Add the bst file to the list of resources to be copied
            local filepath = pandoc.path.join({'bib-styles', pandoc.utils.stringify(stylename) .. '.bst'})
            quarto.doc.addFormatResource(filepath)  
        end
      end

      return meta
    end
  }
}

