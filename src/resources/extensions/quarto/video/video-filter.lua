local videoHelpers = dofile(quarto.utils.resolvePath('video.lua'))
local getSnippetFromBuilders = videoHelpers['video-helpers'].getSnippetFromBuilders

function Header(el)
   local videoSnippetPrefixes = {'www.youtube.com', 'player.vimeo.com', 'players.brightcove'}
   local isVideoSnippet = function(source)
      for i = 1, #videoSnippetPrefixes do
         if string.match(source, videoSnippetPrefixes[i]) then return true end
      end

      return false
   end

   if el.attributes['background-video'] then
      local snippet = getSnippetFromBuilders(el.attributes['background-video'])

      if isVideoSnippet(snippet.src) then
         el.attributes['background-iframe'] = snippet.src
         el.attributes['background-video'] = nil
         return el
      end
   end

end