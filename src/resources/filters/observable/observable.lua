-- blocks

function DisplayMath(el)
end

function RawBlock(el)
end

function Inlines(inlines)

end

-- inlines
function Math(el)

end

function RawInline(el)
  
end

-- https://pandoc.org/lua-filters.html#macro-substitution
function Str(el)

end

-- here we add the interpret calls to actually process the inline cells
function Pandoc(doc)

end
