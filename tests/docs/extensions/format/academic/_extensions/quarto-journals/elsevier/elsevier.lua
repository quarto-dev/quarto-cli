local kClassOpt = "classoption"

-- cite style constants
local kBibStyleDefault = 'number'
local kBibStyles = { 'number', 'numbername', 'authoryear' }
local kBibStyleAuthYr = 'elsarticle-harv'
local kBibStyleNumber = 'elsarticle-num'
local kBibStyleNumberName = 'elsarticle-num-names'
local kBibStyleUnknown = kBibStyleNumberName

-- layout and style
local kFormatting = pandoc.List({ 'preprint', 'review', 'doubleblind' })
local kModels = pandoc.List({ '1p', '3p', '5p' })
local kLayouts = pandoc.List({ 'onecolumn', 'twocolumn' })


local function setBibStyle(meta, style)
  -- .bst files are only supported with natbib
  if quarto.doc.cite_method() ~= "natbib" then
    return
  end
  if meta['biblio-style'] == nil then
    meta['biblio-style'] = style
    quarto.doc.add_format_resource('bib/' .. style .. '.bst')
  end
end

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

local function addClassOption(meta, option)
  if meta[kClassOpt] == nil then
    meta[kClassOpt] = pandoc.List({})
  elseif pandoc.utils.type(meta[kClassOpt]) == "Inlines" then
    -- handle classoption: <value> as a string
    meta[kClassOpt] = pandoc.List({meta[kClassOpt]})
  end
  if not hasClassOption(meta, option) then
    meta[kClassOpt]:insert({ pandoc.Str(option) })
  end
end

local function printList(list)
  local result = ''
  local sep = ''
  for i, v in ipairs(list) do
    result = result .. sep .. v
    sep = ', '
  end
  return result
end

local bibstyle

return {
  {
    Meta = function(meta)
      -- If citeproc is being used, switch to the proper
      -- CSL file
      if quarto.doc.cite_method() == 'citeproc' and meta['csl'] == nil then
        meta['csl'] = quarto.utils.resolve_path('bib/elsevier-harvard.csl')
      end

      if quarto.doc.is_format("pdf") then

        -- read the journal settings
        local journal = meta['journal']
        local citestyle = nil
        local formatting = nil
        local model = nil
        local layout = nil
        local name = nil

        if journal ~= nil then
          citestyle = journal['cite-style']
          formatting = journal['formatting']
          model = journal['model']
          layout = journal['layout']
          name = journal['name']
        end

        -- process the site style
        if citestyle ~= nil then
          citestyle = pandoc.utils.stringify(citestyle)
        else
          citestyle = kBibStyleDefault
        end
        -- capture the bibstyle
        bibstyle = citestyle
        if citestyle == 'numbername' then
          setBibStyle(meta, kBibStyleNumberName)
          addClassOption(meta, 'number')
        elseif citestyle == 'authoryear' then
          setBibStyle(meta, kBibStyleAuthYr)
          addClassOption(meta, 'authoryear')
        elseif citestyle == 'number' then
          setBibStyle(meta, kBibStyleNumber)
          addClassOption(meta, 'number')
        elseif citestyle == 'super' then
          addClassOption(meta, 'super')          
          setBibStyle(meta, kBibStyleNumber)
        else
          error("Unknown journal cite-style " .. citestyle .. "\nPlease use one of " .. printList(kBibStyles))
          setBibStyle(meta, kBibStyleUnknown)
        end

        -- process the layout
        if formatting ~= nil then
          formatting = pandoc.utils.stringify(formatting)
          if kFormatting:includes(formatting) then
            addClassOption(meta, formatting)
          else
            error("Unknown journal formatting " .. formatting .. "\nPlease use one of " .. printList(kFormatting))
          end
        end

        -- process the type
        if model ~= nil then
          model = pandoc.utils.stringify(model)
          if kModels:includes(model) then
            addClassOption(meta, model)
          else
            error("Unknown journal model " .. model .. "\nPlease use one of " .. printList(kModels))
          end
        end

        -- 5p models should be two column always
        if model == '5p' and layout == nil then
          layout = 'twocolumn'
        end

        -- process the type
        if layout ~= nil then
          layout = pandoc.utils.stringify(layout)
          if kLayouts:includes(layout) then
            addClassOption(meta, layout)
            if layout == 'twocolumn' then
              quarto.doc.include_file('in-header', 'partials/_two-column-longtable.tex')
            end
          else
            error("Unknown journal layout " .. layout .. "\nPlease use one of " .. printList(kLayouts))
          end
        end

        -- process the name
        if name ~= nil then
          name = pandoc.utils.stringify(name)
          quarto.doc.include_text('in-header', '\\journal{' .. name .. '}')
        end
      end

      return meta
    end
  },
  {
    Cite = function(cite)
      if bibstyle == 'number' or bibstyle == 'super' then
        -- If we are numbered, force citations into normal mode
        -- as the author styles don't make sense
        for i, v in ipairs(cite.citations) do
          v.mode = 'NormalCitation'
        end
        return cite
      end
    end,

  }
}
