--[[
  If you extension format needs some special processing, include a Lua filter to be used in addition of Quarto built-in ones.
  Quarto exports utils function that can be used in all filters. See 
  https://github.com/quarto-dev/quarto-cli/blob/main/src/resources/pandoc/datadir/init.lua#L1522-L1576
]]--

-- Example: allow to color words by using a span attribute.
-- This filter will use the correct syntax depending on the format
color_span = function(el)
  color = el.attributes['color']
  -- if no color attribute, return unchange
  if color == nil then return el end
  
  -- transform to <span class="color-*"></span>
  if quarto.doc.isFormat("html") then
    -- remove color attributes
    el.attributes['color'] = nil
    -- use style attribute instead
      el.classes:insert('color-' .. color )
    -- return full span element
    return el
  elseif quarto.doc.isFormat("pdf") then
    -- remove color attributes
    el.attributes['color'] = nil
    -- encapsulate in latex code
    table.insert(
      el.content, 1,
      pandoc.RawInline('latex', '\\textcolor{'..color..'}{')
    )
    table.insert(
      el.content,
      pandoc.RawInline('latex', '}')
    )
    -- returns only span content
    return el.content
  else
    -- for other format return unchanged
    return el
  end
end

return {
  {
    Span = color_span
  }
}