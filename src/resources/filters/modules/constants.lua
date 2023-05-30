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
local kCodeLine = "code-line"
local kCodeLines = "code-lines"
local kCellAnnotationClass = "cell-annotation"

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
  kCodeLine = kCodeLine,
  kCodeLines = kCodeLines,
  kCellAnnotationClass = kCellAnnotationClass,
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
}