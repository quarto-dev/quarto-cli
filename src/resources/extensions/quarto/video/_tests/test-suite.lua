package.path = package.path .. ';../?.lua'
lu = require('luaunit')

video = require('video')
helpers = video['video-helpers']
VIDEO_TYPES = helpers.VIDEO_TYPES

TestModules = {}
function TestModules:testVideoExists()
  lu.assertNotIsNil(video.video)
end

function TestModules:testHelpersExist()
  lu.assertNotIsNil(helpers)
end

TestYouTubeBuilder = {}
local checkYouTubeBuilder = function(params, expected)
  result = helpers.youTubeBuilder(params)
  lu.assertEquals(result, expected)
end

function TestYouTubeBuilder:testemptySource()
  local params = nil
  local expected = nil
  checkYouTubeBuilder(params, expected)
end

function TestYouTubeBuilder:testnoSrcTable()
  local params = {  }
  local expected = nil
  checkYouTubeBuilder(params, expected)
end

function TestYouTubeBuilder:testbadSrc()
  local params = { src='faifail' }
  local expected = nil
  checkYouTubeBuilder(params, expected)
end

function TestYouTubeBuilder:testvimeoSrc()
  local params = { src='https://vimeo.com/548291210' }
  local expected = nil
  checkYouTubeBuilder(params, expected)
end

local SIMPLE_YOUTUBE_EXPECTED = {
  snippet = '<iframe data-external="1" src="https://www.youtube.com/embed/wo9vZccmqwc" title="" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>',
  type = VIDEO_TYPES.YOUTUBE,
  src = 'https://www.youtube.com/embed/wo9vZccmqwc',
  videoId="wo9vZccmqwc"}

function TestYouTubeBuilder:testEmbedURL()
  local params = {
    src = 'https://www.youtube.com/embed/wo9vZccmqwc'
  }
  local expected = SIMPLE_YOUTUBE_EXPECTED
  checkYouTubeBuilder(params, expected)
end

function TestYouTubeBuilder:testShareURL()
  local params = {
    src = 'https://youtu.be/wo9vZccmqwc'
  }
  local expected = SIMPLE_YOUTUBE_EXPECTED
  checkYouTubeBuilder(params, expected)
end

function TestYouTubeBuilder:testShareURL()
  local params = {
    src = 'https://youtu.be/wo9vZccmqwc'
  }
  local expected = SIMPLE_YOUTUBE_EXPECTED
  checkYouTubeBuilder(params, expected)
end

function TestYouTubeBuilder:testWebURL()
  local params = {
    src = 'https://www.youtube.com/watch?v=wo9vZccmqwc&ab_channel=CERN'
  }
  local expected = SIMPLE_YOUTUBE_EXPECTED
  checkYouTubeBuilder(params, expected)
end

function TestYouTubeBuilder:testTitle()
  local params = {
    src = 'https://www.youtube.com/embed/wo9vZccmqwc',
    title = 'fake-title',
  }
  local expected = {snippet = '<iframe data-external="1" src="https://www.youtube.com/embed/wo9vZccmqwc" title="fake-title" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>',
    type = VIDEO_TYPES.YOUTUBE, src='https://www.youtube.com/embed/wo9vZccmqwc', videoId = 'wo9vZccmqwc'
  }
  checkYouTubeBuilder(params, expected)
end

function TestYouTubeBuilder:testStartTime()
  local params = {
    src = 'https://www.youtube.com/embed/wo9vZccmqwc',
    start = 10,
  }
  local expected = {snippet = '<iframe data-external="1" src="https://www.youtube.com/embed/wo9vZccmqwc?start=10" title="" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>', type = VIDEO_TYPES.YOUTUBE, src='https://www.youtube.com/embed/wo9vZccmqwc', videoId = 'wo9vZccmqwc'}
  checkYouTubeBuilder(params, expected)
end

function TestYouTubeBuilder:testHeightWidth()
  local params = {
    src = 'https://www.youtube.com/embed/wo9vZccmqwc',
    height = 100,
    width = 200,
  }
  local expected = {snippet = '<iframe data-external="1" src="https://www.youtube.com/embed/wo9vZccmqwc" width="200" height="100" title="" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>', type = VIDEO_TYPES.YOUTUBE,
   src = 'https://www.youtube.com/embed/wo9vZccmqwc', videoId = 'wo9vZccmqwc'}
  checkYouTubeBuilder(params, expected)
end

TestBrightcoveBuilder = {}
local checkBrightcoveBuilder = function(params, expected)
  result = helpers.brightcoveBuilder(params)
  lu.assertEquals(result, expected)
end

function TestBrightcoveBuilder:testemptySource()
  local params = nil
  local expected = nil
  checkBrightcoveBuilder(params, expected)
end

function TestBrightcoveBuilder:testnoSrcTable()
  local params = {  }
  local expected = nil
  checkBrightcoveBuilder(params, expected)
end

function TestBrightcoveBuilder:testbadSrc()
  local params = { src='faifail' }
  local expected = nil
  checkBrightcoveBuilder(params, expected)
end

function TestBrightcoveBuilder:testvimeoSrc()
  local params = { src='https://vimeo.com/548291210' }
  local expected = nil
  checkBrightcoveBuilder(params, expected)
end

function TestBrightcoveBuilder:testBasic()
  local params = {
    src = 'https://players.brightcove.net/1460825906/default_default/index.html?videoId=5988531335001'
  }
  local expected = {
    snippet = '<iframe data-external="1" src="https://players.brightcove.net/1460825906/default_default/index.html?videoId=5988531335001" allowfullscreen="" title="" allow="encrypted-media"></iframe>',
    type = VIDEO_TYPES.BRIGHTCOVE, src='https://players.brightcove.net/1460825906/default_default/index.html?videoId=5988531335001' }
  checkBrightcoveBuilder(params, expected)
end

function TestBrightcoveBuilder:testYouTubeShareURL()
  local params = {
    src = 'https://youtu.be/wo9vZccmqwc'
  }
  local expected = nil
  checkBrightcoveBuilder(params, expected)
end

function TestBrightcoveBuilder:testTitle()
  local params = {
    src = 'https://players.brightcove.net/1460825906/default_default/index.html?videoId=5988531335001',
    title = 'fake-title',
  }
  local expected = {snippet = '<iframe data-external="1" src="https://players.brightcove.net/1460825906/default_default/index.html?videoId=5988531335001" allowfullscreen="" title="fake-title" allow="encrypted-media"></iframe>', type = VIDEO_TYPES.BRIGHTCOVE, src='https://players.brightcove.net/1460825906/default_default/index.html?videoId=5988531335001' }
  checkBrightcoveBuilder(params, expected)
end

function TestBrightcoveBuilder:testHeightWidth()
  local params = {
    src = 'https://players.brightcove.net/1460825906/default_default/index.html?videoId=5988531335001',
    height = 100,
    width = 200,
  }
  local expected = {snippet = '<iframe data-external="1" src="https://players.brightcove.net/1460825906/default_default/index.html?videoId=5988531335001" width="200" height="100" allowfullscreen="" title="" allow="encrypted-media"></iframe>', type = VIDEO_TYPES.BRIGHTCOVE, src='https://players.brightcove.net/1460825906/default_default/index.html?videoId=5988531335001' }
  checkBrightcoveBuilder(params, expected)
end

TestVimeoBuilder = {}
local checkVimeoBuilder = function(params, expected)
  result = helpers.vimeoBuilder(params)
  lu.assertEquals(result, expected)
end

function TestVimeoBuilder:testemptySource()
  local params = nil
  local expected = nil
  checkVimeoBuilder(params, expected)
end

function TestVimeoBuilder:testnoSrcTable()
  local params = {  }
  local expected = nil
  checkVimeoBuilder(params, expected)
end

function TestVimeoBuilder:testbadSrc()
  local params = { src='faifail' }
  local expected = nil
  checkVimeoBuilder(params, expected)
end

function TestVimeoBuilder:testYouTubeSrc()
  local params = { src='https://www.youtube.com/embed/wo9vZccmqwc' }
  local expected = nil
  checkVimeoBuilder(params, expected)
end

function TestVimeoBuilder:testBasic()
  local params = {
    src = 'https://vimeo.com/548291210'
  }
  local expected = {
    snippet = '<iframe data-external="1" src="https://player.vimeo.com/video/548291210" frameborder="0" allow="autoplay; title="" fullscreen; picture-in-picture" allowfullscreen></iframe>',
    type = VIDEO_TYPES.VIMEO, src='https://player.vimeo.com/video/548291210', videoId = '548291210' }

  checkVimeoBuilder(params, expected)
end

function TestVimeoBuilder:testTitle()
  local params = {
    src = 'https://vimeo.com/548291210',
    title = 'fake-title'
  }
  local expected = {snippet = '<iframe data-external="1" src="https://player.vimeo.com/video/548291210" frameborder="0" allow="autoplay; title="fake-title" fullscreen; picture-in-picture" allowfullscreen></iframe>', type = VIDEO_TYPES.VIMEO, src='https://player.vimeo.com/video/548291210', videoId = '548291210' }
  checkVimeoBuilder(params, expected)
end

function TestVimeoBuilder:testHeightWidth()
  local params = {
    src = 'https://vimeo.com/548291210',
    height = 100,
    width = 200,
  }
  local expected = {snippet = '<iframe data-external="1" src="https://player.vimeo.com/video/548291210" width="200" height="100" frameborder="0" allow="autoplay; title="" fullscreen; picture-in-picture" allowfullscreen></iframe>', type = VIDEO_TYPES.VIMEO, src='https://player.vimeo.com/video/548291210', videoId = '548291210' }
  checkVimeoBuilder(params, expected)
end

TestVideoJSBuilder = {}
local checkVideoJSBuilder = function(params, expected)
  VIDEO_SHORTCODE_NUM_VIDEOJS = 0 -- Reset Counter
  result = helpers.videoJSBuilder(params)
  lu.assertEquals(result, expected)
end

function TestVideoJSBuilder:testemptySource()
  local params = nil
  local expected = nil
  checkVideoJSBuilder(params, expected)
end

function TestVideoJSBuilder:testnoSrcTable()
  local params = {  }
  local expected = nil
  checkVideoJSBuilder(params, expected)
end

function TestVideoJSBuilder:testBasic()
  local params = {
    id = 1,
    src = './intro-cern.mp4'
  }
  local expected = {
    id="video_shortcode_videojs_video1",
    snippet="<video id=\"video_shortcode_videojs_video1\" class=\"video-js vjs-default-skin vjs-fluid\" controls preload=\"auto\" data-setup='{}' title=\"\"><source src=\"./intro-cern.mp4\"></video>",
    type="VIDEOJS",
    src='./intro-cern.mp4'
  }

  checkVideoJSBuilder(params, expected)
end

function TestVideoJSBuilder:testDropBox()
  local params = {
    id = 1,
    src = 'https://www.dropbox.com/s/h3ezvnpyn8xe5ch/Section1_4_c.mp4?raw=1'
  }
  local expected = {
    id="video_shortcode_videojs_video1",
    snippet="<video id=\"video_shortcode_videojs_video1\" class=\"video-js vjs-default-skin vjs-fluid\" controls preload=\"auto\" data-setup='{}' title=\"\"><source src=\"https://www.dropbox.com/s/h3ezvnpyn8xe5ch/Section1_4_c.mp4?raw=1\"></video>",
    type="VIDEOJS",
    src='https://www.dropbox.com/s/h3ezvnpyn8xe5ch/Section1_4_c.mp4?raw=1'
  }

  checkVideoJSBuilder(params, expected)
end

function TestVideoJSBuilder:testTitle()
  local params = {
    title = 'test-title',
    src = './intro-cern.mp4'
  }
  local expected = {
    snippet="<video id=\"video_shortcode_videojs_video1\" class=\"video-js vjs-default-skin vjs-fluid\" controls preload=\"auto\" data-setup='{}' title=\"test-title\"><source src=\"./intro-cern.mp4\"></video>",
    type="VIDEOJS",
    src='./intro-cern.mp4',
    id="video_shortcode_videojs_video1"
  }
  checkVideoJSBuilder(params, expected)
end

function TestVideoJSBuilder:testHeightWidth()
  local params = {
    id = 1,
    height = 100,
    width = 200,
    src = './intro-cern.mp4'
  }
  local expected = {
    id="video_shortcode_videojs_video1",
    snippet="<video id=\"video_shortcode_videojs_video1\" width=\"200\" height=\"100\" class=\"video-js vjs-default-skin \" controls preload=\"auto\" data-setup='{}' title=\"\"><source src=\"./intro-cern.mp4\"></video>",
    type="VIDEOJS",
    src="./intro-cern.mp4"
  }

  checkVideoJSBuilder(params, expected)
end

TestVideoResponsive = {}
function TestVideoResponsive:testNoResponsive()
  result = helpers.wrapWithDiv('fake-to-wrap')
  expected = '<div class="quarto-video">fake-to-wrap</div>'
  lu.assertEquals(result, expected)
end

function TestVideoResponsive:testValid()
  result = helpers.wrapWithDiv('fake-to-wrap', nil, true)
  expected = '<div class="quarto-video ratio ratio-16x9">fake-to-wrap</div>'
  lu.assertEquals(result, expected)
end

function TestVideoResponsive:testValid_43()
  result = helpers.wrapWithDiv('fake-to-wrap', '4x3', true)
  expected = '<div class="quarto-video ratio ratio-4x3">fake-to-wrap</div>'
  lu.assertEquals(result, expected)
end

function TestVideoResponsive:testValid_11()
  result = helpers.wrapWithDiv('fake-to-wrap', '1x1', true)
  expected = '<div class="quarto-video ratio ratio-1x1">fake-to-wrap</div>'
  lu.assertEquals(result, expected)
end

function TestVideoResponsive:testValid_219()
  result = helpers.wrapWithDiv('fake-to-wrap', '21x9', true)
  expected = '<div class="quarto-video ratio ratio-21x9">fake-to-wrap</div>'
  lu.assertEquals(result, expected)
end

TestHelperConvertURL = {}
function TestHelperConvertURL:testCanLoadModule()
  --helper.helloWorld()
end

TestAsciidocVideo = {}
function TestAsciidocVideo:testYoutube()
  result = formatAsciiDocVideo('qItugh-fFgg', 'youtube')
  expected = 'video::qItugh-fFgg[youtube]'
  lu.assertEquals(result, expected)
end

function TestAsciidocVideo:testVimeo()
  result = formatAsciiDocVideo('783455773', 'vimeo')
  expected = 'video::783455773[vimeo]'
  lu.assertEquals(result, expected)
end

function TestAsciidocVideo:textLocal()
  result = formatAsciiDocVideo('foo/bar.mp4', '')
  expected = 'video::foo/bar.mp4[]'
  lu.assertEquals(result, expected)
end


os.exit(lu.LuaUnit.run())