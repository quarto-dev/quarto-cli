-- === Utils ===
-- from http://lua-users.org/wiki/StringInterpolation
local interpolate = function(str, vars)
  -- Allow replace_vars{str, vars} syntax as well as replace_vars(str, {vars})
  if not vars then
    vars = str
    str = vars[1]
  end
  return (string.gsub(str, "({([^}]+)})",
          function(whole, i)
            return vars[i] or whole
          end))
end

local function splitString (toSplit, delimiter)
  delimiter = delimiter or "%s"

  local t={}
  for str in string.gmatch(toSplit, "([^".. delimiter .."]+)") do
    table.insert(t, str)
  end
  return t
end

local function isEmpty(s)
  return s == nil or s == ''
end

local isResponsive = function(width, height)
  return isEmpty(height) and isEmpty(width)
end

VIDEO_SHORTCODE_NUM_VIDEOJS = 0

local VIDEO_TYPES = {
  YOUTUBE = "YOUTUBE",
  BRIGHTCOVE = "BRIGHTCOVE",
  VIMEO = "VIMEO",
  VIDEOJS = "VIDEOJS"
}

local ASPECT_RATIOS = {
  ["1x1"] = "ratio-1x1",
  ["4x3"] = "ratio-4x3",
  ["16x9"] = "ratio-16x9",
  ["21x9"] = "ratio-21x9"
}

local DEFAULT_ASPECT_RATIO = ASPECT_RATIOS["16x9"]

local wrapWithDiv = function(toWrap, aspectRatio, shouldAddResponsiveClasses)
  local ratioClass = aspectRatio and ASPECT_RATIOS[aspectRatio] or DEFAULT_ASPECT_RATIO
  local responsiveClasses = shouldAddResponsiveClasses and ' ratio ' .. ratioClass
  wrapper = [[<div class="quarto-video{responsiveClasses}">{toWrap}</div>]]

  return interpolate {
    wrapper,
    toWrap = toWrap,
    responsiveClasses = responsiveClasses or '' }
end

local replaceCommonAttributes = function(snippet, params)
  result = interpolate {
    snippet,
    src = params.src,
    height = params.height and ' height="' .. params.height .. '"' or '',
    width = params.width and ' width="' .. params.width .. '"' or '',
    title = params.title or '',
  }
  return result
end

local checkMatchStart = function(value, matcherFront)
  return string.match(value, '^' .. matcherFront .. '(.-)$')
end

local youTubeBuilder = function(params)
  if not (params and params.src) then return nil end
  local src = params.src
  match = checkMatchStart(src, 'https://www.youtube.com/embed/')
  match = match or checkMatchStart(src, 'https://www.youtube%-nocookie.com/embed/')
  match = match or checkMatchStart(src, 'https://youtu.be/')
  match = match or string.match(src, '%?v=(.-)&')
  match = match or string.match(src, '%?v=(.-)$')

  if not match then return nil end

  local YOUTUBE_EMBED = 'https://www.youtube.com/embed/'
  params.src = YOUTUBE_EMBED .. match

  local SNIPPET = [[<iframe data-external="1" src="{src}{start}"{width}{height} title="{title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>]]
  snippet = replaceCommonAttributes(SNIPPET, params)

  local result = {}

  result.snippet = interpolate {
    snippet,
    start = params.start and '?start=' .. params.start or ''
  }
  result.type = VIDEO_TYPES.YOUTUBE
  result.src = params.src
  result.videoId = match

  return result
end

local brightcoveBuilder = function(params)
  if not (params and params.src) then return nil end
  local src = params.src
  local isBrightcove = function()
    return string.find(src, 'https://players.brightcove.net')
  end

  if not isBrightcove() then return nil end

  local result = {}

  local SNIPPET = [[<iframe data-external="1" src="{src}"{width}{height} allowfullscreen="" title="{title}" allow="encrypted-media"></iframe>]]
  result.snippet = replaceCommonAttributes(SNIPPET, params)
  result.type = VIDEO_TYPES.BRIGHTCOVE
  result.src = params.src
  return result
end

local vimeoBuilder = function(params)
  if not (params and params.src) then return nil end

  local VIMEO_STANDARD = 'https://vimeo.com/'
  local match = checkMatchStart(params.src, VIMEO_STANDARD)
  if not match then return nil end

  -- Internal Links
  -- bug/5390-vimeo-newlink
  if string.find(match, '/') then
    local internalMatch = string.gsub(match, "?(.*)", "" )
    videoId = splitString(internalMatch, '/')[1]
    privacyHash = splitString(internalMatch, '/')[2]
    params.src = 'https://player.vimeo.com/video/' .. videoId .. '?h=' .. privacyHash
  else
    videoId = match
    params.src = 'https://player.vimeo.com/video/' .. videoId
  end


  local SNIPPET = [[<iframe data-external="1" src="{src}"{width}{height} frameborder="0" allow="autoplay; title="{title}" fullscreen; picture-in-picture" allowfullscreen></iframe>]]

  local result = {}

  result.snippet = replaceCommonAttributes(SNIPPET, params)
  result.type = VIDEO_TYPES.VIMEO
  result.src = params.src
  result.videoId = videoId

  return result
end

local videoJSBuilder = function(params)
  if not (params and params.src) then return nil end
  VIDEO_SHORTCODE_NUM_VIDEOJS = VIDEO_SHORTCODE_NUM_VIDEOJS + 1
  local id = "video_shortcode_videojs_video" .. VIDEO_SHORTCODE_NUM_VIDEOJS

  local SNIPPET = [[<video id="{id}"{width}{height} class="video-js vjs-default-skin {fluid}" controls preload="auto" data-setup='{}' title="{title}"><source src="{src}"></video>]]
  local snippet = params.snippet or SNIPPET
  snippet = replaceCommonAttributes(snippet, params)
  snippet = interpolate {
    snippet,
    id = id,
    fluid = isResponsive(params.width, params.height) and 'vjs-fluid' or ''
  }

  local result = {}
  result.snippet = snippet
  result.type = VIDEO_TYPES.VIDEOJS
  result.src = params.src
  result.id = id
  return result
end
local getSnippetFromBuilders = function(src, height, width, title, start)
  local builderList = {
    youTubeBuilder,
    brightcoveBuilder,
    vimeoBuilder,
    videoJSBuilder}

  local params = { src = src, height = height, width = width, title = title, start = start }

  for i = 1, #builderList do
    local builtSnippet = builderList[i](params)
    if (builtSnippet) then
      return builtSnippet
    end
  end
end

local helpers = {
  ["checkMatchStart"] = checkMatchStart,
  ["youTubeBuilder"] = youTubeBuilder,
  ["brightcoveBuilder"] = brightcoveBuilder,
  ["vimeoBuilder"] = vimeoBuilder,
  ["videoJSBuilder"] = videoJSBuilder,
  ["wrapWithDiv"] = wrapWithDiv,
  ["VIDEO_TYPES"] = VIDEO_TYPES,
  ["VIDEO_SHORTCODE_NUM_VIDEOJS"] = VIDEO_SHORTCODE_NUM_VIDEOJS,
  ["getSnippetFromBuilders"] = getSnippetFromBuilders
}

-- makes an asciidoc video raw block
-- see https://docs.asciidoctor.org/asciidoc/latest/macros/audio-and-video/
function formatAsciiDocVideo(src, type)
  return  'video::' .. src .. '[' .. type .. ']'
end

local function asciidocVideo(src, height, width, title, start, _aspectRatio)
  local asciiDocVideoRawBlock = function(src, type)
    return pandoc.RawBlock("asciidoc", formatAsciiDocVideo(src, type) .. '\n\n')
  end

  local videoSnippetAndType = getSnippetFromBuilders(src, height, width, title, start)
  if videoSnippetAndType.type == VIDEO_TYPES.YOUTUBE then
    -- Use the video id to form an asciidoc video
    if videoSnippetAndType.videoId ~= nil then
      return asciiDocVideoRawBlock(videoSnippetAndType.videoId, 'youtube');
    end
  elseif videoSnippetAndType.type == VIDEO_TYPES.VIMEO then
    return asciiDocVideoRawBlock(videoSnippetAndType.videoId, 'vimeo');
  elseif videoSnippetAndType.type ==  VIDEO_TYPES.VIDEOJS then
    return asciiDocVideoRawBlock(videoSnippetAndType.src, '');
  else
    -- this is not a local or supported video type for asciidoc
    -- we should just emit a hyper link
  end

end

function htmlVideo(src, height, width, title, start, aspectRatio)

  -- https://github.com/quarto-dev/quarto-cli/issues/6833
  -- handle partially-specified width, height, and aspectRatio
  if aspectRatio then
    local strs = splitString(aspectRatio, 'x')
    wr = tonumber(strs[1])
    hr = tonumber(strs[2])
    aspectRatio = wr / hr
    if height and not width then
      width = math.floor(height * aspectRatio + 0.5)
    elseif width and not height then
      height = math.floor(width / aspectRatio + 0.5)
    end
  end

  local videoSnippetAndType = getSnippetFromBuilders(src, height, width, title, start)
  local videoSnippet

  videoSnippet = videoSnippetAndType.snippet

  if (videoSnippetAndType.type == VIDEO_TYPES.VIDEOJS) then
    -- Can this be bundled with the VideoJS dependency
    -- Avoid disjointed combination?
    quarto.doc.add_html_dependency({
      name = 'videojs',
      scripts = { 'resources/videojs/video.min.js' },
      stylesheets = { 'resources/videojs/video-js.css' }
    })
    local id = videoSnippetAndType.id or ''
    local scriptTag = "<script>videojs(" .. id .. ");</script>"
    quarto.doc.include_text("after-body", scriptTag)
  end

  local isVideoJS = function()
    return videoSnippetAndType.type == VIDEO_TYPES.VIDEOJS
  end

  local isRevealJS = function()
    return quarto.doc.is_format('revealjs')
  end

  local shouldAddResponsiveClasses = false
  if isResponsive(width, height)
          and not isRevealJS()
          and not isVideoJS() then
    if (not quarto.doc.has_bootstrap()) then
      quarto.doc.add_html_dependency({
        name = 'bootstrap-responsive',
        stylesheets = { 'resources/bootstrap/bootstrap-responsive-ratio.css' }
      })
    end
    shouldAddResponsiveClasses = true
  end

  if not isRevealJS() then
    videoSnippet = wrapWithDiv(
            videoSnippet,
            aspectRatio,
            shouldAddResponsiveClasses
    )
  end

  -- inject the rendering code
  return pandoc.RawBlock('html', videoSnippet)
end
-- return a table containing shortcode definitions
-- defining shortcodes this way allows us to create helper
-- functions that are not themselves considered shortcodes
return {
  ["video"] = function(args, kwargs, _meta, raw_args)
    checkArg = function(toCheck, key)
      value = pandoc.utils.stringify(toCheck[key])
      if not isEmpty(value) then
        return value
      else
        return nil
      end
    end

    local srcValue = checkArg(kwargs, 'src')
    local titleValue = checkArg(kwargs, 'title')
    local startValue = checkArg(kwargs, 'start')
    local heightValue = checkArg(kwargs, 'height')
    local widthValue = checkArg(kwargs, 'width')
    local aspectRatio = checkArg(kwargs, 'aspectRatio')

    if isEmpty(aspectRatio) then
      aspectRatio = checkArg(kwargs, 'aspect-ratio')
    end

    if isEmpty(srcValue) then

      if #raw_args > 0 then
        srcValue = pandoc.utils.stringify(raw_args[1])
      else
        fail("No video source specified for video shortcode")        
      end
    end

    if quarto.doc.is_format("html:js") then
      return htmlVideo(srcValue, heightValue, widthValue, titleValue, startValue, aspectRatio)
    elseif quarto.doc.is_format("asciidoc") then
      return asciidocVideo(srcValue, heightValue, widthValue, titleValue, startValue, aspectRatio)
    else
      -- Fall-back to a link of the source
      return pandoc.Link(srcValue, srcValue)
    end

  end,
  ["video-helpers"] = helpers,
}
