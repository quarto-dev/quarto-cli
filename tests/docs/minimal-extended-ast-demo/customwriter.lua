return {
  -- FancyCallout = {
  --   pre = function(callout)
  --     return "<fancy-callout>"
  --   end,
  --   value = function(callout, walk)
  --     walk("<title>")
  --     walk(callout.title)
  --     walk("</title>")
  --     walk("<content>")
  --     walk(callout.content)
  --     walk("</content>")
  --   end,
  --   post = function(callout)
  --     return "</fancy-callout>"
  --   end
  -- },

  -- equivalently
  FancyCallout = function(callout)
    return quarto.ast.template([[<fancy-callout>
<title>
$title$
</title>
<content>
$content$
</content>
</fancy-callout>]], callout)
  end,

  -- equivalently
--   FancyCallout = function(callout)
--     quarto.ast.emit("<fancy-callout>")
-- <title>
-- %s
-- </title>
-- <content>
-- %s
-- </content>
-- </fancy-callout>]], callout.title, callout.content)
--   end,  
}

