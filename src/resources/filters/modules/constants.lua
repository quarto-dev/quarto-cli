-- constants.lua
-- Copyright (C) 2023 Posit Software, PBC

local kCitation = "citation"
local kContainerId = "container-id"
local kArticleId = "article-id"
local kPage = "page"
local kPageFirst = "page-first"
local kPageLast = "page-last"
local kFigExtended = "fig.extended"
local kLstCap = "lst-cap"
local kNotebook = "notebook"
local kNotebookTitle = "notebook-title"
local kNotebookCellId = "notebook-cellId"
local kLangSourcePrefix = "source-notebooks-prefix"
local kManuscriptUrl = "manuscript-url"
local kNotebookLinks = "notebook-links"
local kDisableProcessing = "quarto-disable-processing"
local kRefsIndentifier = "refs-target-identifier"
local kTags = "tags"
local kKeywords = "keywords"
local kQuartoInternal = "quarto-internal"
local kHasAuthorNotes = "has-author-notes"
local kHasPermissions = "has-permissions"
local kNoteBookCode = "notebook-code"
local kNoteBookContent = "notebook-content"
local kNoteBookOutput = "notebook-output"
local kDelinkClass = "delink"
local kCalloutAppearanceDefault = "default"
local kCalloutDefaultSimple = "simple"
local kCalloutDefaultMinimal = "minimal"
local kAsciidocNativeCites = 'use-asciidoc-native-cites'
local kShowNotes = 'showNotes'
local kProjectResolverIgnore = 'project-resolve-ignore'

local kCodeAnnotationsParam = 'code-annotations'
local kDataCodeCellTarget = 'data-code-cell'
local kDataCodeCellLines = 'data-code-lines'
local kDataCodeCellAnnotation = 'data-code-annotation'
local kDataCodeAnnonationClz = 'code-annotation-code'
local kCodeAnnotationStyleNone = "none"
local kCodeAnnotationStyleHover = "hover"
local kCodeAnnotationStyleSelect = "select"
local kCodeLine = "code-line"
local kCodeLines = "code-lines"
local kCellAnnotationClass = "cell-annotation"
local kCodeLineNumbers = "code-line-numbers"

local kContentVisible = "content-visible"
local kContentHidden = "content-hidden"
local kWhenFormat = "when-format"
local kUnlessFormat = "unless-format"
local kWhenProfile = "when-profile"
local kUnlessProfile = "unless-profile"
local kWhenMeta = "when-meta"
local kUnlessMeta = "unless-meta"
local kMermaidClz = 'mermaid'
local kPositionedRefs = 'positioned-refs'
local kTblColWidths = "tbl-colwidths"

local kHeaderIncludes = "header-includes"
local kIncludeBefore = "include-before"
local kIncludeAfter = "include-after"

local kIncludeBeforeBody = "include-before-body"
local kIncludeAfterBody = "include-after-body"
local kIncludeInHeader = "include-in-header"

local kCopyright = "copyright"
local kLicense = "license"
local kHtmlTableProcessing = "html-table-processing"
local kHtmlPreTagProcessing = "html-pre-tag-processing"
local kCssPropertyProcessing = "css-property-processing"

-- for a given language, the comment character(s)
local kLangCommentChars = {
  r = {"#"},
  python = {"#"},
  julia = {"#"},
  scala = {"//"},
  matlab = {"%"},
  csharp = {"//"},
  fsharp = {"//"},
  c = {"/*", "*/"},
  css = {"/*", "*/"},
  sas = {"*", ";"},
  powershell = {"#"},
  bash = {"#"},
  sql = {"--"},
  mysql = {"--"},
  psql = {"--"},
  lua = {"--"},
  cpp = {"//"},
  cc = {"//"},
  stan = {"#"},
  octave = {"#"},
  fortran = {"!"},
  fortran95 = {"!"},
  awk = {"#"},
  gawk = {"#"},
  stata = {"*"},
  java = {"//"},
  groovy = {"//"},
  sed = {"#"},
  perl = {"#"},
  ruby = {"#"},
  tikz = {"%"},
  js = {"//"},
  d3 = {"//"},
  node = {"//"},
  sass = {"//"},
  scss = {"//"},
  coffee = {"#"},
  go = {"//"},
  asy = {"//"},
  haskell = {"--"},
  dot = {"//"},
  mermaid = {"%%"},
  apl = {"⍝"},
  yaml = {"#"},
  json = {"//"},
  latex = {"%"},
  typescript = {"//"},
  swift = { "//" },
  javascript = { "//"},
  elm = { "#" },
  vhdl = { "--"},
  html = { "<!--", "-->"},
  markdown = {"<!--", "-->"},
  gap = { "#" },
  dockerfile = { "#" },
  ocaml = { "(*", "*)"},
  rust = { "// "}
}
local kDefaultCodeAnnotationComment =  {"#"}

-- These colors are used as background colors with an opacity of 0.75
local kColorUnknown = "909090"
local kColorNote = "0758E5"
local kColorImportant = "CC1914"
local kColorWarning = "EB9113"
local kColorTip = "00A047"
local kColorCaution = "FC5300"

-- these colors are used with no-opacity
local kColorUnknownFrame = "acacac"
local kColorNoteFrame = "4582ec"
local kColorImportantFrame = "d9534f"
local kColorWarningFrame = "f0ad4e"
local kColorTipFrame = "02b875"
local kColorCautionFrame = "fd7e14"

local kBackgroundColorUnknown = "e6e6e6"
local kBackgroundColorNote = "dae6fb"
local kBackgroundColorImportant = "f7dddc"
local kBackgroundColorWarning = "fcefdc"
local kBackgroundColorTip = "ccf1e3"
local kBackgroundColorCaution = "ffe5d0"

-- Pandoc classes for incremental flag
local kIncremental = "incremental"
local kNonIncremental = "nonincremental"

return {
  kCitation = kCitation,
  kContainerId = kContainerId,
  kArticleId = kArticleId,
  kPage = kPage,
  kPageFirst = kPageFirst,
  kPageLast = kPageLast,
  kFigExtended = kFigExtended,
  kLstCap = kLstCap,
  kNotebook = kNotebook,
  kNotebookTitle = kNotebookTitle,
  kNotebookCellId = kNotebookCellId,
  kLangSourcePrefix = kLangSourcePrefix,
  kManuscriptUrl = kManuscriptUrl,
  kNotebookLinks = kNotebookLinks,
  kDisableProcessing = kDisableProcessing,
  kRefsIndentifier = kRefsIndentifier,
  kTags = kTags,
  kKeywords = kKeywords,
  kQuartoInternal = kQuartoInternal,
  kHasAuthorNotes = kHasAuthorNotes,
  kHasPermissions = kHasPermissions,
  kNoteBookCode = kNoteBookCode,
  kNoteBookContent = kNoteBookContent,
  kNoteBookOutput = kNoteBookOutput,
  kDelinkClass = kDelinkClass,
  kCalloutAppearanceDefault = kCalloutAppearanceDefault,
  kCalloutDefaultSimple = kCalloutDefaultSimple,
  kCalloutDefaultMinimal = kCalloutDefaultMinimal,
  kAsciidocNativeCites = kAsciidocNativeCites,
  kShowNotes = kShowNotes,
  kProjectResolverIgnore = kProjectResolverIgnore,
  kCodeAnnotationsParam = kCodeAnnotationsParam,
  kDataCodeCellTarget = kDataCodeCellTarget,
  kDataCodeCellLines = kDataCodeCellLines,
  kDataCodeCellAnnotation = kDataCodeCellAnnotation,
  kDataCodeAnnonationClz = kDataCodeAnnonationClz,
  kCodeAnnotationStyleNone = kCodeAnnotationStyleNone,
  kCodeAnnotationStyleHover = kCodeAnnotationStyleHover,
  kCodeAnnotationStyleSelect = kCodeAnnotationStyleSelect,
  kCodeLine = kCodeLine,
  kCodeLines = kCodeLines,
  kCellAnnotationClass = kCellAnnotationClass,
  kCodeLineNumbers = kCodeLineNumbers,
  kContentVisible = kContentVisible,
  kContentHidden = kContentHidden,
  kWhenFormat = kWhenFormat,
  kUnlessFormat = kUnlessFormat,
  kWhenMeta = kWhenMeta,
  kUnlessMeta = kUnlessMeta,
  kWhenProfile = kWhenProfile,
  kUnlessProfile = kUnlessProfile,
  kMermaidClz = kMermaidClz,
  kPositionedRefs = kPositionedRefs,
  kTblColWidths = kTblColWidths,

  kHeaderIncludes = kHeaderIncludes,
  kIncludeBefore = kIncludeBefore,
  kIncludeAfter = kIncludeAfter,

  kIncludeBeforeBody = kIncludeBeforeBody,
  kIncludeAfterBody = kIncludeAfterBody,
  kIncludeInHeader = kIncludeInHeader,

  kCopyright = kCopyright,
  kLicense = kLicense,

  kLangCommentChars = kLangCommentChars,
  kDefaultCodeAnnotationComment = kDefaultCodeAnnotationComment,
  kHtmlTableProcessing = kHtmlTableProcessing,
  kHtmlPreTagProcessing = kHtmlPreTagProcessing,
  kCssPropertyProcessing = kCssPropertyProcessing,

  kColorUnknown = kColorUnknown,
  kColorNote = kColorNote,
  kColorImportant = kColorImportant,
  kColorWarning = kColorWarning,
  kColorTip = kColorTip,
  kColorCaution = kColorCaution,
  kColorUnknownFrame = kColorUnknownFrame,
  kColorNoteFrame = kColorNoteFrame,
  kColorImportantFrame = kColorImportantFrame,
  kColorWarningFrame = kColorWarningFrame,
  kColorTipFrame = kColorTipFrame,
  kColorCautionFrame = kColorCautionFrame,
  kBackgroundColorUnknown = kBackgroundColorUnknown,
  kBackgroundColorNote = kBackgroundColorNote,
  kBackgroundColorImportant = kBackgroundColorImportant,
  kBackgroundColorWarning = kBackgroundColorWarning,
  kBackgroundColorTip = kBackgroundColorTip,
  kBackgroundColorCaution = kBackgroundColorCaution,

  kIncremental = kIncremental,
  kNonIncremental = kNonIncremental
}
