package.path = package.path .. ';../?.lua'
lu = require('luaunit')

local confluence = require('overrides')

TestModules = {}
function TestModules:testCaptionedImageExists()
  lu.assertNotIsNil(confluence.CaptionedImageConfluence)
end

TestCaptionedImage = {}
function TestCaptionedImage:testBasic()
  local expected = [[<ac:image
    ac:align="center"
    ac:layout="center"
    ac:alt="fake-title">
        <ri:attachment ri:filename="fake-source" /><ac:caption>fake-caption</ac:caption>
    </ac:image>]]
  local source = 'fake-source'
  local title = 'fake-title'
  local caption = 'fake-caption'
  local actual = confluence.CaptionedImageConfluence(source, title, caption)

  lu.assertEquals(actual, expected)
end
function TestCaptionedImage:testFigAltText()
  local expected = [[<ac:image
    ac:align="center"
    ac:layout="center"
    ac:alt="fake-alt">
        <ri:attachment ri:filename="fake-source" /><ac:caption>fake-caption</ac:caption>
    </ac:image>]]
  local source = 'fake-source'
  local title = 'fake-title'
  local caption = 'fake-caption'
  local attr = {id = '', class = '', ['fig-alt'] = 'fake-alt'}
  local actual = confluence.CaptionedImageConfluence(source, title, caption, attr)

  lu.assertEquals(actual, expected)
end
function TestCaptionedImage:testAlignLeft()
  local expected = [[<ac:image
    ac:align="left"
    ac:layout="align-start"
    ac:alt="fake-title">
        <ri:attachment ri:filename="fake-source" /><ac:caption>fake-caption</ac:caption>
    </ac:image>]]
  local source = 'fake-source'
  local title = 'fake-title'
  local caption = 'fake-caption'
  local attr = {id = '', class = '', ['fig-align'] = 'left'}
  local actual = confluence.CaptionedImageConfluence(source, title, caption, attr)

  lu.assertEquals(actual, expected)
end
function TestCaptionedImage:testAlignRight()
  local expected = [[<ac:image
    ac:align="right"
    ac:layout="align-end"
    ac:alt="fake-title">
        <ri:attachment ri:filename="fake-source" /><ac:caption>fake-caption</ac:caption>
    </ac:image>]]
  local source = 'fake-source'
  local title = 'fake-title'
  local caption = 'fake-caption'
  local attr = {id = '', class = '', ['fig-align'] = 'right'}
  local actual = confluence.CaptionedImageConfluence(source, title, caption, attr)

  lu.assertEquals(actual, expected)
end

TestCodeBlockConfluence = {}
function TestCodeBlockConfluence:testWithAllAttributes()
  local expected = [[<ac:structured-macro
      ac:name="code"
      ac:schema-version="1"
      ac:macro-id="1d1a2d13-0179-4d8f-b448-b28dfaceea4a">
        <ac:parameter ac:name="language">python</ac:parameter>
        <ac:plain-text-body>
          <![CDATA[fake-codeValue{doubleBracket}>
        </ac:plain-text-body>
    </ac:structured-macro>]]
  local codeValue = 'fake-codeValue'
  local languageValue = 'python'
  expected = confluence.interpolate{expected, doubleBracket = ']]'}
  local actual = confluence.CodeBlockConfluence(codeValue, languageValue)

  lu.assertEquals(actual, expected)
end

TestLinkConfluence = {}
function TestLinkConfluence:testExternal()
  local expected = "<a href='http://fake-target' title='fake-title'>fake-source</a>"
  local source = 'fake-source'
  local target = 'http://fake-target'
  local title = 'fake-title'
  local attributes = {
    class = 'fake-class'
  }
  expected = confluence.interpolate{expected, doubleBracket = ']]'}
  local actual = confluence.LinkConfluence(source, target, title, attributes)

  lu.assertEquals(actual, expected)
end
function TestLinkConfluence:testQMD()
  local expected = [[<a href='fake-target.qmd' title='fake-title'>fake-source</a>]]
  local source = 'fake-source'
  local target = 'fake-target.qmd'
  local title = 'fake-title'
  local attributes = {
    class = 'fake-class'
  }
  expected = confluence.interpolate{expected, doubleBracket = ']]'}
  local actual = confluence.LinkConfluence(source, target, title, attributes)

  lu.assertEquals(actual, expected)
end
function TestLinkConfluence:testQMDAnchor()
  local expected = "<a href='fake-target.qmd#Fake-Anchor' title='fake-title'>fake-source</a>"
  local source = 'fake-source'
  local target = 'fake-target.qmd#Fake-Anchor'
  local title = 'fake-title'
  local attributes = {
    class = 'fake-class'
  }
  expected = confluence.interpolate{expected, doubleBracket = ']]'}
  local actual = confluence.LinkConfluence(source, target, title, attributes)

  lu.assertEquals(actual, expected)
end
function TestLinkConfluence:testEscape()
  local expected = "<a href='fake-target.qmd' title='fake-title'>A &amp; B</a>"
  local source = 'A & B'
  local target = 'fake-target.qmd'
  local title = 'fake-title'
  local attributes = {
    class = 'fake-class'
  }
  expected = confluence.interpolate{expected, doubleBracket = ']]'}
  local actual = confluence.LinkConfluence(source, target, title, attributes)

  lu.assertEquals(actual, expected)
end
function TestLinkConfluence:testAttachment()
  local expected = [[<ac:link><ri:attachment ri:filename="fake-source"/><ac:plain-text-link-body><![CDATA[fake-target{doubleBracket}></ac:plain-text-link-body></ac:link>]]
  expected = confluence.interpolate{expected, doubleBracket = ']]'}
  local source = 'fake-source'
  local target = 'fake-target'
  local title = 'fake-title'
  local attributes = {
    class = 'fake-class'
  }
  expected = confluence.interpolate{expected, doubleBracket = ']]'}
  local actual = confluence.LinkConfluence(source, target, title, attributes)

  lu.assertEquals(actual, expected)
end

os.exit(lu.LuaUnit.run())