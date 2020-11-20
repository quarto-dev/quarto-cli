


function titlePrefix(type, default, num)
  local prefix = option(type .. "-title", stringToInlines(default))
  table.insert(prefix, pandoc.Space())
  table.insert(prefix, pandoc.Str(tostring(num)))
  tappend(prefix, titleDelim())
  table.insert(prefix, pandoc.Space())
  return prefix
end

function titleDelim()
  return option("title-delim", stringToInlines(":"))
end

function ccsDelim()
  return option("ccs-delim", stringToInlines(",\u{a0}"))
end

function ccsLabelSep()
  return option("ccs-label-sep", stringToInlines("\u{a0}—\u{a0}"))
end

function subfigCaptions()
  return option("subfig-captions", true)
end


function stringToInlines(str)
  return {pandoc.Str(str)}
end

function nbspString()
  return pandoc.Str '\u{a0}'
end









-- https://gist.github.com/efrederickson/4080372
