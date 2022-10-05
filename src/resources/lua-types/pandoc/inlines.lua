---@meta

---@alias inlines_content string|pandoc.Inline|pandoc.List

--[[
Inline element
]]
---@class pandoc.Inline : table

--[[
Make a clone
]]
---@return pandoc.Inline
function pandoc.Inline:clone() end



--[[
List of `Inline` elements, with the same methods as a generic
`List`, but also supporting a `walk` method.
]]
---@class pandoc.Inlines : pandoc.List
pandoc.Inlines = {}


--[[
Create an inlines list 
]]
---@param inlines any Inline elements
---@return pandoc.List
function pandoc.Inlines(inlines) end



--======================== Cite ========================

--[[
Citation
]]
---@class pandoc.Cite : pandoc.Inline
---@field content pandoc.List Inline content (list of inlines)
---@field citations pandoc.List Citation entries (list of `Citation`)
---@field t "Cite"
---@field tag "Cite"
pandoc.Cite = {}

--[[
Creates a Cite inline element
]]
---@param content inlines_content List of inlines
---@param citations pandoc.List List of `Citation`
---@return pandoc.Cite
function pandoc.Cite(content, citations) end

--[[
Make a clone
]]
---@return pandoc.Cite
function pandoc.Cite:clone() end


--======================== Code ========================

--[[
Inline code
]]
---@class pandoc.Code : pandoc.Inline
---@field text string Code string
---@field attr pandoc.Attr Code attributes
---@field identifier string Alias for `attr.identifier`
---@field classes pandoc.List Alias for `attr.classes`
---@field attributes table<string,string> Alias for `attr.attributes`
---@field t "Code"
---@field tag "Code"
pandoc.Code = {}

--[[
Creates an inline code element
]]
---@param text string Code string
---@param attr? pandoc.Attr Code attributes
---@return pandoc.Code
function pandoc.Code(text, attr) end

--[[
Make a clone
]]
---@return pandoc.Code
function pandoc.Code:clone() end

--======================== Emph ========================

--[[
Emphasized text
]]
---@class pandoc.Emph : pandoc.Inline
---@field content pandoc.List Inline content (list of inlines)
---@field t "Emph"
---@field tag "Emph"
pandoc.Emph = {}

--[[
Creates an inline element representing emphasized text.
]]
---@param content inlines_content List of inlines
---@return pandoc.Emph
function pandoc.Emph(content) end

--[[
Make a clone
]]
---@return pandoc.Emph
function pandoc.Emph:clone() end

--======================== Image ========================

--[[
Image: alt text (list of inlines), target
]]
---@class pandoc.Image : pandoc.Inline
---@field caption pandoc.List List of inlines
---@field src string Path to the image
---@field title string Brief image description
---@field attr pandoc.Attr Attributes
---@field identifier string Alias for `attr.identifier`
---@field classes pandoc.List Alias for `attr.classes`
---@field attributes table<string,string> Alias for `attr.attributes`
---@field t "Image"
---@field tag "Image"
pandoc.Image = {}

--[[
Creates an Image inline element
]]
---@param caption inlines_content List of inlines
---@param src string Path to the image
---@param title? string Brief image description
---@param attr? pandoc.Attr Attributes
---@return pandoc.Image
function pandoc.Image(caption, src, title,attr) end

--[[
Make a clone
]]
---@return pandoc.Image
function pandoc.Image:clone() end


--======================== LineBreak ========================

--[[
Hard line break
]]
---@class pandoc.LineBreak : pandoc.Inline
---@field t "LineBreak"
---@field tag "LineBreak"
pandoc.LineBreak = {}

--[[
Create a hard line break
]]
---@return pandoc.LineBreak
function pandoc.LineBreak() end

--[[
Make a clone
]]
---@return pandoc.LineBreak
function pandoc.LineBreak:clone() end

--======================== Link ========================

--[[
Hyperlink: alt text (list of inlines), target
]]
---@class pandoc.Link : pandoc.Inline
---@field attr pandoc.Attr Attributes
---@field identifier string Alias for `attr.identifier`
---@field classes pandoc.List Alias for `attr.classes`
---@field attributes table<string,string> Alias for `attr.attributes`
---@field content pandoc.List Text for this link (list of inlines)
---@field target string The link target
---@field title string Brief link description
---@field t "Link"
---@field tag "Link"
pandoc.Link = {}

--[[
Creates a Link inline element
]]
---@param content inlines_content Text for this link (list of inlines)
---@param target string The link target
---@param title? string Brief link description
---@param attr? pandoc.Attr Attributes
---@return pandoc.Link
function pandoc.Link(content, target, title, attr) end

--[[
Make a clone
]]
---@return pandoc.Link
function pandoc.Link:clone() end


--======================== Math ========================

--[[
TeX math (literal)
]]
---@class pandoc.Math : pandoc.Inline
---@field mathtype math_type Specifier determining whether the math content should be shown inline (InlineMath) or on a separate line (DisplayMath) 
---@field text string Math content
---@field t "Math"
---@field tag "Math"
pandoc.Math = {}

--[[
Creates an inline code element
]]
---@param mathtype string|math_type Specifier determining whether the math content should be shown inline (InlineMath) or on a separate line (DisplayMath) 
---@param text string Math content
---@return pandoc.Math
function pandoc.Math(mathtype, text) end

--[[
Make a clone
]]
---@return pandoc.Math
function pandoc.Math:clone() end

---@alias math_type 'InlineMath'|'DisplayMath'

--======================== Note ========================

--[[
Footnote or endnote
]]
---@class pandoc.Note : pandoc.Inline
---@field content pandoc.List Note content (list of blocks)
---@field t "Note"
---@field tag "Note"
pandoc.Note = {}

--[[
Creates a note element
]]
---@param content string|pandoc.Inline|pandoc.Block|pandoc.List Div content (list of blocks)
---@return pandoc.Note
function pandoc.Note(content) end

--[[
Make a clone
]]
---@return pandoc.Note
function pandoc.Note:clone() end

--======================== Quoted ========================

--[[
Quoted text
]]
---@class pandoc.Quoted : pandoc.Inline
---@field quotetype quote_type Type of quotes to be used; one of SingleQuote or DoubleQuote
---@field content pandoc.List Quoted text (list of inlines)
---@field t "Quoted"
---@field tag "Quoted"
pandoc.Quoted = {}

--[[
Creates quoted text
]]
---@param quotetype string|quote_type Type of quotes to be used; one of SingleQuote or DoubleQuote
---@param content inlines_content Quoted text (list of inlines)
---@return pandoc.Quoted
function pandoc.Quoted(quotetype, content) end

--[[
Make a clone
]]
---@return pandoc.Quoted
function pandoc.Quoted:clone() end

---@alias quote_type 'SingleQuote'|'DoubleQuote'

--======================== RawInline ========================

--[[
Raw inline content of a specified format
]]
---@class pandoc.RawInline : pandoc.Inline
---@field format string Format of content
---@field text string Raw content
---@field t "RawInline"
---@field tag "RawInline"
pandoc.RawInline = {}

--[[
Creates a raw inline element
]]
---@param format string Format of content
---@param text string Raw content
---@return pandoc.RawInline
function pandoc.RawInline(format, text) end

--[[
Make a clone
]]
---@return pandoc.RawInline
function pandoc.RawInline:clone() end


--======================== SmallCaps ========================

--[[
Small caps text
]]
---@class pandoc.SmallCaps : pandoc.Inline
---@field content pandoc.List Inline content (list of inlines)
---@field t "SmallCaps"
---@field tag "SmallCaps"
pandoc.SmallCaps = {}

--[[
Creates text rendered in small caps
]]
---@param content inlines_content List of inlines
---@return pandoc.SmallCaps
function pandoc.SmallCaps(content) end

--[[
Make a clone
]]
---@return pandoc.SmallCaps
function pandoc.SmallCaps:clone() end


--======================== SoftBreak ========================

--[[
Soft line break
]]
---@class pandoc.SoftBreak : pandoc.Inline
---@field t "SoftBreak"
---@field tag "SoftBreak"
pandoc.SoftBreak = {}

--[[
Create a soft line break
]]
---@return pandoc.SoftBreak
function pandoc.SoftBreak() end

--[[
Make a clone
]]
---@return pandoc.SoftBreak
function pandoc.SoftBreak:clone() end

--======================== Space ========================

--[[
Inter-word space
]]
---@class pandoc.Space : pandoc.Inline
---@field t "Space"
---@field tag "Space"
pandoc.Space = {}

--[[
Create an inter-word space
]]
---@return pandoc.Space
function pandoc.Space() end

--[[
Make a clone
]]
---@return pandoc.Space
function pandoc.Space:clone() end

--======================== Span ========================

--[[
Generic inline container with attributes
]]
---@class pandoc.Span : pandoc.Inline
---@field content pandoc.List Inline content (list of inlines)
---@field attr pandoc.Attr Inline attributes
---@field identifier string Alias for `attr.identifier`
---@field classes pandoc.List Alias for `attr.classes`
---@field attributes table<string,string> Alias for `attr.attributes`
---@field t "Span"
---@field tag "Span"
pandoc.Span = {}

--[[
Creates a Span inline element
]]
---@param content inlines_content Span content (list of inlines)
---@param attr? pandoc.Attr Span attributes
---@return pandoc.Span
function pandoc.Span(content, attr) end

--[[
Make a clone
]]
---@return pandoc.Span
function pandoc.Span:clone() end


--======================== Str ========================

--[[
Text
]]
---@class pandoc.Str : pandoc.Inline
---@field text string Content
---@field t "Str"
---@field tag "Str"
pandoc.Str = {}

--[[
Creates string
]]
---@param text string = Content
---@return pandoc.Str
function pandoc.Str(text) end

--[[
Make a clone
]]
---@return pandoc.Str
function pandoc.Str:clone() end


--======================== Strikeout ========================

--[[
Strikeout text
]]
---@class pandoc.Strikeout : pandoc.Inline
---@field content pandoc.List Inline content (list of inlines)
---@field t "Strikeout"
---@field tag "Strikeout"
pandoc.Strikeout = {}

--[[
Creates text which is struck out.
]]
---@param content inlines_content List of inlines
---@return pandoc.Strikeout
function pandoc.Strikeout(content) end

--[[
Make a clone
]]
---@return pandoc.Strikeout
function pandoc.Strikeout:clone() end

--======================== Strong ========================

--[[
Strongly emphasized text
]]
---@class pandoc.Strong : pandoc.Inline
---@field content pandoc.List Inline content (list of inlines)
---@field t "Strong"
---@field tag "Strong"
pandoc.Strong = {}

--[[
Creates a Strong element, whose text is usually displayed in a bold font.
]]
---@param content inlines_content List of inlines
---@return pandoc.Strong
function pandoc.Strong(content) end

--[[
Make a clone
]]
---@return pandoc.Strong
function pandoc.Strong:clone() end

--======================== Subscript ========================

--[[
Subscripted text
]]
---@class pandoc.Subscript : pandoc.Inline
---@field content pandoc.List Inline content (list of inlines)
---@field t "Subscript"
---@field tag "Subscript"
pandoc.Subscript = {}

--[[
Creates a Subscript inline element
]]
---@param content inlines_content List of inlines
---@return pandoc.Subscript
function pandoc.Subscript(content) end

--[[
Make a clone
]]
---@return pandoc.Subscript
function pandoc.Subscript:clone() end

--======================== Superscript ========================

--[[
Superscripted text
]]
---@class pandoc.Superscript : pandoc.Inline
---@field content pandoc.List Inline content (list of inlines)
---@field t "Superscript"
---@field tag "Superscript"
pandoc.Superscript = {}

--[[
Creates a Superscript inline element
]]
---@param content inlines_content List of inlines
---@return pandoc.Superscript
function pandoc.Superscript(content) end

--[[
Make a clone
]]
---@return pandoc.Superscript
function pandoc.Superscript:clone() end


--======================== Underline ========================

--[[
Underlined text
]]
---@class pandoc.Underline : pandoc.Inline
---@field content pandoc.List Inline content (list of inlines)
---@field t "Underline"
---@field tag "Underline"
pandoc.Underline = {}

--[[
Creates an Underline inline element
]]
---@param content inlines_content List of inlines
---@return pandoc.Underline
function pandoc.Underline(content) end

--[[
Make a clone
]]
---@return pandoc.Underline
function pandoc.Underline:clone() end



