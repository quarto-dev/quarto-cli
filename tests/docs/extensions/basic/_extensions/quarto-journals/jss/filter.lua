

-- these classes, when placed on a span will be replaced
 -- with an identical LaTeX command for PDF output
 local texMappings = {
  "proglang",
  "pkg",
  "fct",
  "class"
}

return {
  {
    Span = function(el) 
      -- read the span contents and emit correct output
      local contentStr = pandoc.utils.stringify(el.content)

      for i, mapping in ipairs(texMappings) do
        if #el.attr.classes == 1 and el.attr.classes:includes(mapping) then
          if quarto.doc.isFormat("pdf") then
            return pandoc.RawInline("tex", "\\" .. mapping .. "{" .. contentStr .. "}" )
          else 
            return pandoc.Code(contentStr);
          end
        end
      end
    end,
    Meta = function(meta) 
      -- Authors output in the template uses a special separator
      -- to join authors (including wrapping to a new line)
      -- this computes the proper prefix and places it in the author metadata
      -- for use by the template
      local byAuthor = meta['by-author']
      if byAuthor ~= nil then
        for i, author in ipairs(byAuthor) do
          local prefix = {pandoc.RawInline("tex ","")};
          if i > 1 and i % 2 == 1 then
            prefix = {pandoc.RawInline("tex", "\\AND")}
          elseif i > 1 then
            prefix = {pandoc.RawInline("tex", "\\And")}
          end
          author['metadata']['latex-prefix'] = prefix
        end
        return meta
      end
    end
  }
}