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
function TestCaptionedImage:testBasicWithAnchor()
  local expected = [[<p><ac:structured-macro ac:name="anchor" ac:schema-version="1" ac:local-id="a6aa6f25-0bee-4a7f-929b-71fcb7eba592" ac:macro-id="d2cb5be1217ae6e086bc60005e9d27b7"><ac:parameter ac:name="">fake-id</ac:parameter></ac:structured-macro></p><ac:image
    ac:align="center"
    ac:layout="center"
    ac:alt="fake-title">
        <ri:attachment ri:filename="fake-source" /><ac:caption>fake-caption</ac:caption>
    </ac:image>]]
  local source = 'fake-source'
  local title = 'fake-title'
  local caption = 'fake-caption'
  local attributes = nil
  local id = 'fake-id'
  local actual = confluence.CaptionedImageConfluence(source, title, caption, attributes, id)

  lu.assertEquals(actual, expected)
end
function TestCaptionedImage:testBasicWithAnchorEmptyId()
  local expected = [[<ac:image
    ac:align="center"
    ac:layout="center"
    ac:alt="fake-title">
        <ri:attachment ri:filename="fake-source" /><ac:caption>fake-caption</ac:caption>
    </ac:image>]]
  local source = 'fake-source'
  local title = 'fake-title'
  local caption = 'fake-caption'
  local attributes = nil
  local id = ''
  local actual = confluence.CaptionedImageConfluence(source, title, caption, attributes, id)

  lu.assertEquals(actual, expected)
end
function TestCaptionedImage:testEscapeCaption()
  local expected = [[<ac:image
    ac:align="center"
    ac:layout="center"
    ac:alt="fake-title">
        <ri:attachment ri:filename="fake-source" /><ac:caption>fake-caption&amp;</ac:caption>
    </ac:image>]]
  local source = 'fake-source'
  local title = 'fake-title'
  local caption = 'fake-caption&'
  local actual = confluence.CaptionedImageConfluence(source, title, caption)

  lu.assertEquals(actual, expected)
end
function TestCaptionedImage:testRemote()
  local expected = [[<img src='https://d33wubrfki0l68.cloudfront.net/18153fb9953057ee5cff086122bd26f9cee8fe93/3aba9/images/notebook-run-chunk.png' title=''/>]]
  local source = 'https://d33wubrfki0l68.cloudfront.net/18153fb9953057ee5cff086122bd26f9cee8fe93/3aba9/images/notebook-run-chunk.png'
  local title = ''
  local caption = ''
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
function TestLinkConfluence:testLineBreakRemove_double()
  local expected = "<a href='fake-target.qmd#Fake-Anchor' title='fake-title'>fake source</a>"
  local source = 'fake\n\nsource'
  local target = 'fake-target.qmd#Fake-Anchor'
  local title = 'fake-title'
  local attributes = {
    class = 'fake-class'
  }
  expected = confluence.interpolate{expected, doubleBracket = ']]'}
  local actual = confluence.LinkConfluence(source, target, title, attributes)

  lu.assertEquals(actual, expected)
end
function TestLinkConfluence:testLineBreakRemove_nbsp()
  local expected = "<a href='fake-target.qmd#Fake-Anchor' title='fake-title'>fake source</a>"
  local source = 'fake\n \nsource'
  local target = 'fake-target.qmd#Fake-Anchor'
  local title = 'fake-title'
  local attributes = {
    class = 'fake-class'
  }
  expected = confluence.interpolate{expected, doubleBracket = ']]'}
  local actual = confluence.LinkConfluence(source, target, title, attributes)

  lu.assertEquals(actual, expected)
end
function TestLinkConfluence:testLineBreakRemove_parens()
  local expected = "<a href='fake-target.qmd#Fake-Anchor' title='fake-title'>fake(1)source</a>"
  local source = 'fake(\n1\n)source'
  local target = 'fake-target.qmd#Fake-Anchor'
  local title = 'fake-title'
  local attributes = {
    class = 'fake-class'
  }
  expected = confluence.interpolate{expected, doubleBracket = ']]'}
  local actual = confluence.LinkConfluence(source, target, title, attributes)

  lu.assertEquals(actual, expected)
end
function TestLinkConfluence:testAttachment()
  --5815-bug-confluence-links-to-file-attachments-not-supported
  local expected = [[<ac:link><ri:attachment ri:filename="fake-target"/><ac:plain-text-link-body><![CDATA[fake-source{doubleBracket}></ac:plain-text-link-body></ac:link>]]
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
TestCalloutConfluence = {}
function TestCalloutConfluence:testBasicNote()
  local expected = [[<ac:structured-macro ac:name="info" ac:schema-version="1" ac:macro-id="1c8062cd-87de-4701-a698-fd435e057468"><ac:rich-text-body>fake-content</ac:rich-text-body></ac:structured-macro>]]
  local type = 'note'
  local content = "fake-content"
  local actual = confluence.CalloutConfluence(type, content)
  lu.assertEquals(actual, expected)
end
function TestCalloutConfluence:testBasicWarning()
  local expected = [[<ac:structured-macro ac:name="note" ac:schema-version="1" ac:macro-id="1049a0d8-470f-4f83-a0d7-b6ad35ea8eda"><ac:rich-text-body>fake-content</ac:rich-text-body></ac:structured-macro>]]
  local type = 'warning'
  local content = "fake-content"
  local actual = confluence.CalloutConfluence(type, content)
  lu.assertEquals(actual, expected)
end
function TestCalloutConfluence:testBasicImportant()
  local expected = [[<ac:structured-macro ac:name="warning" ac:schema-version="1" ac:macro-id="0185f821-7aa4-404a-8748-ec59a46357e1"><ac:rich-text-body>fake-content</ac:rich-text-body></ac:structured-macro>]]
  local type = 'important'
  local content = "fake-content"
  local actual = confluence.CalloutConfluence(type, content)
  lu.assertEquals(actual, expected)
end
function TestCalloutConfluence:testBasicTip()
  local expected = [[<ac:structured-macro ac:name="tip" ac:schema-version="1" ac:macro-id="97c39328-9651-4c56-8a8c-ab5537001d86"><ac:rich-text-body>fake-content</ac:rich-text-body></ac:structured-macro>]]
  local type = 'tip'
  local content = "fake-content"
  local actual = confluence.CalloutConfluence(type, content)
  lu.assertEquals(actual, expected)
end
function TestCalloutConfluence:testBasicCaution()
  local expected = [[<ac:structured-macro ac:name="note" ac:schema-version="1" ac:macro-id="1049a0d8-470f-4f83-a0d7-b6ad35ea8eda"><ac:rich-text-body>fake-content</ac:rich-text-body></ac:structured-macro>]]
  local type = 'caution'
  local content = "fake-content"
  local actual = confluence.CalloutConfluence(type, content)
  lu.assertEquals(actual, expected)
end
function TestCalloutConfluence:testInvalidType()
  local expected = [[<ac:structured-macro ac:name="info" ac:schema-version="1" ac:macro-id="1c8062cd-87de-4701-a698-fd435e057468"><ac:rich-text-body>fake-content</ac:rich-text-body></ac:structured-macro>]]
  local type = 'invalid-type'
  local content = "fake-content"
  local actual = confluence.CalloutConfluence(type, content)
  lu.assertEquals(actual, expected)
end

local function checkRawInlineConfluence (value, expected)
  local actual = confluence.RawInlineConfluence(value)
  lu.assertEquals(actual, expected)
end
TestRawInlineConfluence_BR = {}
function TestRawInlineConfluence_BR:testBasicString()
  checkRawInlineConfluence("Hello World", "Hello World")
end
function TestRawInlineConfluence_BR:testBRClosed()
  checkRawInlineConfluence("<br/>", "<br/>")
end
function TestRawInlineConfluence_BR:testBROpen()
  checkRawInlineConfluence("<br>", "<br/>")
end
function TestRawInlineConfluence_BR:testBROpenMixedCase()
  checkRawInlineConfluence("<bR>", "<br/>")
  checkRawInlineConfluence("<BR>", "<br/>")
  checkRawInlineConfluence("<Br>", "<br/>")
end
function TestRawInlineConfluence_BR:testEmpty()
  checkRawInlineConfluence("", "")
end
function TestRawInlineConfluence_BR:testNil()
  checkRawInlineConfluence(nil, nil)
end
function TestRawInlineConfluence_BR:testNil()
  checkRawInlineConfluence(nil, nil)
end
function TestRawInlineConfluence_BR:testPartial()
  checkRawInlineConfluence("<br", "<br")
end
function TestRawInlineConfluence_BR:testDouble()
  checkRawInlineConfluence("<br//>", "<br//>")
end

TestRawInlineConfluence_IMG = {}
function TestRawInlineConfluence_IMG:testClosed()
  checkRawInlineConfluence([[<img src="fake-source"/>]], [[<img src="fake-source"/>]])
end
function TestRawInlineConfluence_IMG:testOpen()
  checkRawInlineConfluence([[<img src="fake-source">]], [[<img src="fake-source"/>]])
end
function TestRawInlineConfluence_IMG:testNotImageNoClose()
  checkRawInlineConfluence([[<imgz src="fake-source">]], [[<imgz src="fake-source">]])
end
function TestRawInlineConfluence_IMG:testNoSourceClose()
  checkRawInlineConfluence([[<img >]], [[<img />]])
end

TestBuildAnchorConfluence = {}
function TestBuildAnchorConfluence:testBasicAnchor()
  local expected = [[<ac:structured-macro ac:name="anchor" ac:schema-version="1" ac:local-id="a6aa6f25-0bee-4a7f-929b-71fcb7eba592" ac:macro-id="d2cb5be1217ae6e086bc60005e9d27b7"><ac:parameter ac:name="">fake-id</ac:parameter></ac:structured-macro>]]
  local id = 'fake-id'
  local actual = confluence.HTMLAnchorConfluence(id)
  lu.assertEquals(actual, expected)
end
function TestBuildAnchorConfluence:testNoWhitespaceRemoval()
  local expected = [[<ac:structured-macro ac:name="anchor" ac:schema-version="1" ac:local-id="a6aa6f25-0bee-4a7f-929b-71fcb7eba592" ac:macro-id="d2cb5be1217ae6e086bc60005e9d27b7"><ac:parameter ac:name="">fake-id with spaces</ac:parameter></ac:structured-macro>]]
  local id = 'fake-id with spaces'
  local actual = confluence.HTMLAnchorConfluence(id)
  lu.assertEquals(actual, expected)
end
function TestBuildAnchorConfluence:testCanNotBeEmpty()
  local expected = ""
  local id = ''
  local actual = confluence.HTMLAnchorConfluence(id)
  lu.assertEquals(actual, expected)
end

os.exit(lu.LuaUnit.run())
