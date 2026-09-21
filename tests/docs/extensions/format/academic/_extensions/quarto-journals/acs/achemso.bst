%%
%% This is file `achemso.bst',
%% generated with the docstrip utility.
%%
%% The original source files were:
%%
%% achemso.dtx  (with options: `bst')
%% 
%% IMPORTANT NOTICE:
%% 
%% For the copyright see the source file.
%% 
%% Any modified versions of this file must be renamed
%% with new filenames distinct from achemso.bst.
%% 
%% For distribution of the original source see the terms
%% for copying and modification in the file achemso.dtx.
%% 
%% This generated file may be distributed as long as the
%% original source files, as listed above, are part of the
%% same distribution. (The sources need not necessarily be
%% in the same archive or directory.)

ENTRY
  {
    address
    author
    booktitle
    chapter
    ctrl-article-title
    ctrl-chapter-title
    ctrl-doi
    ctrl-etal-firstonly
    ctrl-etal-number
    ctrl-use-title
    doi
    edition
    editor
    howpublished
    institution
    journal
    key
    maintitle
    note
    number
    organization
    pages
    publisher
    school
    series
    title
    type
    url
    version
    volume
    year
  }
  { }
  {
    label
    short.names
  }


FUNCTION { and } {
    { }
    {
      pop$
      #0
    }
  if$
}

FUNCTION { not } {
    { #0 }
    { #1 }
  if$
}

FUNCTION { or } {
    {
      pop$
      #1
    }
    { }
  if$
}

FUNCTION { xor } {
    { not }
    { }
  if$
}


FUNCTION { chr.to.value.error } {
  #48 +
  int.to.chr$
  "'" swap$ *
  "'" *
  " is not a number: treated as zero." *
  warning$
  #0
}

FUNCTION { chr.to.value } {
  chr.to.int$ #48 -
  duplicate$
  #0 <
    { chr.to.value.error }
    {
      duplicate$
      #9 >
        { chr.to.value.error }
        { }
      if$
    }
  if$
}

STRINGS {
  extract.input.str
  extract.output.str
}

FUNCTION { is.a.digit } {
  duplicate$
  "" =
    {
      pop$
      #0
    }
    {
      chr.to.int$
      #48 -
      duplicate$
     #0 < swap$ #9 > or not
   }
  if$
}

FUNCTION{ is.a.number } {
  {
    duplicate$
    #1 #1 substring$
    is.a.digit
  }
    { #2 global.max$ substring$ }
  while$
  "" =
}

FUNCTION { extract.number } {
  duplicate$
  'extract.input.str :=
  "" 'extract.output.str :=
  { extract.input.str empty$ not }
    {
      extract.input.str #1 #1 substring$
      extract.input.str #2 global.max$ substring$ 'extract.input.str :=
      duplicate$
      is.a.number
        { extract.output.str swap$ * 'extract.output.str := }
        {
          pop$
          "" 'extract.input.str :=
        }
      if$
    }
  while$
  extract.output.str empty$
    { }
    {
      pop$
      extract.output.str
    }
  if$
}

FUNCTION { field.or.null } {
  duplicate$
  empty$
    {
      pop$
      ""
    }
    { }
  if$
}

INTEGERS {
  multiply.a.int
  multiply.b.int
}

FUNCTION { multiply } {
  'multiply.a.int :=
  'multiply.b.int :=
  multiply.b.int #0 <
    {
      #-1
      #0 multiply.b.int - 'multiply.b.int :=
    }
    { #1 }
  if$
  #0
  { multiply.b.int #0 > }
    {
      multiply.a.int +
      multiply.b.int #1 - 'multiply.b.int :=
    }
  while$
  swap$
    { }
    { #0 swap$ - }
  if$
}

INTEGERS { str.conversion.int }

FUNCTION { str.to.int.aux.ii } {
  {
    duplicate$
    empty$ not
  }
    {
      swap$
      #10 multiply 'str.conversion.int :=
      duplicate$
      #1 #1 substring$
      chr.to.value
      str.conversion.int +
      swap$
      #2 global.max$ substring$
    }
  while$
  pop$
}

FUNCTION { str.to.int.aux.i } {
  duplicate$
  #1 #1 substring$
  "-" =
   {
      #1 swap$
      #2 global.max$ substring$
    }
    {
      #0 swap$
    }
  if$
  #0
  swap$
  str.to.int.aux.ii
  swap$
    { #0 swap$ - }
    { }
  if$
}

FUNCTION { str.to.int } {
  duplicate$
  empty$
    {
      pop$
      #0
    }
    { str.to.int.aux.i }
  if$
}

FUNCTION { tie.or.space.connect } {
 duplicate$
 text.length$ #3 <
    { "~" }
    { " " }
  if$
  swap$ * *
}

FUNCTION { yes.no.to.bool } {
  duplicate$
  empty$
    {
      pop$
      #0
    }
    {
      "l" change.case$
      "yes" =
        { #1 }
        { #0 }
      if$
    }
  if$
}


FUNCTION { bold } {
  duplicate$
  empty$
    {
      pop$
      ""
    }
    { "\textbf{" swap$ * "}" * }
  if$
}

FUNCTION { emph } {
  duplicate$
  empty$
    {
      pop$
      ""
    }
    { "\emph{" swap$ * "}" * }
  if$
}

FUNCTION { paren } {
  duplicate$
  empty$
    {
      pop$
      ""
    }
    { "(" swap$ * ")" * }
  if$
}


FUNCTION { add.comma } { ", " * }

FUNCTION { add.colon } {  ": " * }

FUNCTION { add.period } { add.period$ " " * }

FUNCTION { add.semicolon } { "; " * }

FUNCTION { add.space } { " " * }


FUNCTION { bbl.and }     { "and" }

FUNCTION { bbl.chapter } { "Chapter" }

FUNCTION { bbl.doi }     { "DOI:" }

FUNCTION { bbl.editor }  { "Ed." }

FUNCTION { bbl.editors } { "Eds." }

FUNCTION { bbl.edition } { "ed." }

FUNCTION { bbl.etal }    { "\latin{et~al.}" }

FUNCTION { bbl.in }      { "In" }

FUNCTION { bbl.inpress } { "in press" }

FUNCTION { bbl.msc }     { "M.Sc.\ thesis" }

FUNCTION { bbl.page }    { "p" }

FUNCTION { bbl.pages }   { "pp" }

FUNCTION { bbl.phd }     { "Ph.D.\ thesis" }

FUNCTION { bbl.version } { "version" }

FUNCTION { bbl.volume }  { "Vol." }


STRINGS { pages.str }

FUNCTION { hyphen.to.dash } {
  'pages.str :=
  ""
  { pages.str empty$ not }
    {
      pages.str #1 #1 substring$
      "-" =
        {
          "--" *
          {
            pages.str #1 #1 substring$
            "-" =
          }
            { pages.str #2 global.max$ substring$ 'pages.str := }
          while$
        }
        {
          pages.str #1 #1 substring$
          *
          pages.str #2 global.max$ substring$ 'pages.str :=
        }
      if$
    }
  while$
}

INTEGERS { multiresult.bool }

FUNCTION { multi.page.check } {
  'pages.str :=
  #0 'multiresult.bool :=
  {
    multiresult.bool not
    pages.str empty$ not
    and
  }
    {
      pages.str #1 #1 substring$
      duplicate$
      "-" = swap$ duplicate$
      "," = swap$
      "+" =
      or or
        { #1 'multiresult.bool := }
        { pages.str #2 global.max$ substring$ 'pages.str := }
      if$
    }
  while$
  multiresult.bool
}


INTEGERS {
  current.name.int
  names.separate.comma
  names.separate.semicolon
  names.separate.comma.bool
  remaining.names.int
  total.names.int
}

STRINGS {
  current.name.str
  names.str
}

FUNCTION { full.format.names } {
  'names.str :=
  #1 'current.name.int :=
  names.str num.names$ 'remaining.names.int :=
  { remaining.names.int #0 > }
    {
      names.str current.name.int "{vv~}{ll}" format.name$
      current.name.int #1 >
        {
          swap$ add.comma swap$
          remaining.names.int #1 >
            { }
            {
              duplicate$
              "others" =
                { bbl.etal }
                { bbl.and }
              if$
              add.space swap$ *
            }
          if$
          *
        }
        { }
      if$
      remaining.names.int #1 - 'remaining.names.int :=
      current.name.int #1 + 'current.name.int :=
    }
  while$
}

FUNCTION { full.author } {
  author empty$
    { "" }
    { author full.format.names }
  if$
}

FUNCTION { full.author.editor } {
  author empty$
    {
      editor empty$
        { "" }
        { editor full.format.names }
      if$
    }
    { author full.format.names }
  if$
}

FUNCTION { full.editor } {
  editor empty$
    { "" }
    { editor full.format.names }
  if$
}

FUNCTION { short.format.names } {
  'names.str :=
  names.str #1 "{vv~}{ll}" format.name$
  names.str num.names$
  duplicate$
  #2 >
    {
      pop$
      add.space bbl.etal *
    }
    {
      #2 <
        { }
        {
          names.str #2 "{ff }{vv }{ll}{ jj}" format.name$
          "others" =
            { add.space bbl.etal * }
            {
              add.space
              bbl.and add.space
              *
              names.str #2 "{vv~}{ll}" format.name$
              *
            }
          if$
        }
      if$
    }
  if$
}

FUNCTION { short.author.key } {
  author empty$
    {
      key empty$
        { cite$ #1 #3 substring$ }
        { key }
      if$
    }
    { author short.format.names }
  if$
}

FUNCTION { short.author.editor.key } {
  author empty$
    {
      editor empty$
        {
          key empty$
            { cite$ #1 #3 substring$ }
            { key }
          if$
        }
        { editor short.format.names }
      if$
    }
    { author short.format.names }
  if$
}

FUNCTION { short.author.key.organization } {
  author empty$
    {
      key empty$
        {
          organization empty$
            { cite$ #1 #3 substring$ }
            {
              organization #1 #4 substring$
              "The " =
                { organization }
                { organization #5 global.max$ substring$ }
              if$
              #3 text.prefix$
            }
          if$
        }
        { key }
      if$
    }
    { author short.format.names }
  if$
}

FUNCTION { short.editor.key.organization } {
  editor empty$
    {
      key empty$
        {
          organization empty$
            { cite$ #1 #3 substring$ }
            {
              organization #1 #4 substring$
              "The " =
                { organization }
                { organization #5 global.max$ substring$ }
              if$
              #3 text.prefix$
            }
          if$
        }
        { key }
      if$
    }
    { editor short.format.names }
  if$
}

FUNCTION { calculate.full.names } {
  type$ "book" =
  type$ "inbook" =
  or
    { full.author.editor }
    {
      type$ "proceedings" =
        { full.editor }
        { full.author }
      if$
    }
  if$
}

FUNCTION { calculate.short.names } {
  type$ "book" =
  type$ "inbook" =
  or
    { short.author.editor.key }
    {
      type$ "proceedings" =
        { short.editor.key.organization }
        {
          type$ "manual" =
            { short.author.key.organization }
            { short.author.key }
          if$
        }
      if$
    }
  if$
  'short.names :=
}

FUNCTION { calculate.names } {
  calculate.short.names
  short.names
  year empty$
    { "()" }
    { "(" year * ")" * }
  if$
  *
  'label :=
}


INTEGERS { entries.int }

FUNCTION { initialize.count.entries } {
  #0 'entries.int  :=
}

FUNCTION { count.entries } {
  entries.int #1 + 'entries.int  :=
}


FUNCTION { begin.bib } {
  "achemso 2022-11-25 v3.13f" top$
  preamble$ empty$
    { }
    {
      preamble$ write$
      newline$
    }
  if$
  "\providecommand{\latin}[1]{#1}" write$
  newline$
  "\makeatletter" write$
  newline$
  "\providecommand{\doi}" write$
  newline$
  "  {\begingroup\let\do\@makeother\dospecials" write$
  newline$
  "  \catcode`\{=1 \catcode`\}=2 \doi@aux}" write$
  newline$
  "\providecommand{\doi@aux}[1]{\endgroup\texttt{#1}}" write$
   newline$
  "\makeatother" write$
  newline$
  "\providecommand*\mcitethebibliography{\thebibliography}" write$
  newline$
  "\csname @ifundefined\endcsname{endmcitethebibliography}" write$
  "  {\let\endmcitethebibliography\endthebibliography}{}" write$
  newline$
  "\begin{mcitethebibliography}{"
    entries.int int.to.str$  * "}" * write$
  newline$
  "\providecommand*\natexlab[1]{#1}" write$
  newline$
  "\providecommand*\mciteSetBstSublistMode[1]{}" write$
  newline$
  "\providecommand*\mciteSetBstMaxWidthForm[2]{}" write$
  newline$
  "\providecommand*\mciteBstWouldAddEndPuncttrue" write$
  newline$
  "  {\def\EndOfBibitem{\unskip.}}" write$
  newline$
  "\providecommand*\mciteBstWouldAddEndPunctfalse" write$
  newline$
  "  {\let\EndOfBibitem\relax}" write$
  newline$
  "\providecommand*\mciteSetBstMidEndSepPunct[3]{}" write$
  newline$
  "\providecommand*\mciteSetBstSublistLabelBeginEnd[3]{}" write$
  newline$
  "\providecommand*\EndOfBibitem{}" write$
  newline$
  "\mciteSetBstSublistMode{f}" write$
  newline$
  "\mciteSetBstMaxWidthForm{subitem}{(\alph{mcitesubitemcount})}" write$
  newline$
  "\mciteSetBstSublistLabelBeginEnd" write$
  newline$
  "  {\mcitemaxwidthsubitemform\space}" write$
  newline$
  "  {\relax}" write$
  newline$
  "  {\relax}" write$
  newline$
}

FUNCTION { end.bib } {
  newline$
  "\end{mcitethebibliography}" write$
  newline$
}


INTEGERS {
  ctrl.article.title.bool
  ctrl.chapter.title.bool
  ctrl.doi.bool
  ctrl.etal.firstonly.bool
  ctrl.etal.number.int
}

FUNCTION { initialize.control.values } {
  #1 'ctrl.article.title.bool :=
  #0 'ctrl.chapter.title.bool :=
  #0 'ctrl.doi.bool :=
  #1 'ctrl.etal.firstonly.bool :=
  #15 'ctrl.etal.number.int :=
}

FUNCTION { control } {
  ctrl-article-title  yes.no.to.bool 'ctrl.article.title.bool  :=
  ctrl-chapter-title  yes.no.to.bool 'ctrl.chapter.title.bool  :=
  ctrl-doi            yes.no.to.bool 'ctrl.doi.bool            :=
  ctrl-etal-firstonly yes.no.to.bool 'ctrl.etal.firstonly.bool :=
  ctrl-etal-number    str.to.int     'ctrl.etal.number.int     :=
  ctrl-use-title empty$
    'skip$
    { ctrl-use-title yes.no.to.bool 'ctrl.article.title.bool  := }
  if$
}


INTEGERS {
  next.punct.comma
  next.punct.period
  next.punct.semicolon
  next.punct.space
}

FUNCTION { initialize.tracker } {
  #0 'next.punct.comma     :=
  #1 'next.punct.period    :=
  #2 'next.punct.semicolon :=
  #3 'next.punct.space     :=
}

INTEGERS { next.punct.int }

FUNCTION { output } {
  swap$
  duplicate$ empty$
    { pop$ }
    {
      next.punct.int next.punct.space =
        { add.space }
        {
          next.punct.int next.punct.comma =
            { add.comma }
            {
              next.punct.int next.punct.semicolon =
                { add.semicolon }
                { add.period }
              if$
            }
          if$
        }
      if$
      write$
    }
  if$
  next.punct.comma 'next.punct.int :=
}


FUNCTION { begin.bibitem } {
  newline$
  "\bibitem" write$
  label
  calculate.full.names
  duplicate$
  short.names =
    { pop$ }
    { * }
  if$
  "[" swap$ * "]" * write$
  "{" cite$ * "}" * write$
  newline$
  ""
  next.punct.comma 'next.punct.int :=
}

INTEGERS { add.period.length.int }

FUNCTION { would.add.period } {
  duplicate$
  add.period$
  text.length$ 'add.period.length.int :=
  duplicate$
  text.length$
  add.period.length.int =
    { #0 }
    { #1 }
  if$
}

FUNCTION { end.bibitem } {
  would.add.period
    {
      "\relax" * write$
      newline$
      "\mciteBstWouldAddEndPuncttrue" write$
      newline$
      "\mciteSetBstMidEndSepPunct{\mcitedefaultmidpunct}" write$
      newline$
      "{\mcitedefaultendpunct}{\mcitedefaultseppunct}\relax"
    }
    {
      "\relax" * write$
      newline$
      "\mciteBstWouldAddEndPunctfalse" write$
       newline$
      "\mciteSetBstMidEndSepPunct{\mcitedefaultmidpunct}" write$
      newline$
      "{}{\mcitedefaultseppunct}\relax"
    }
  if$
  write$
  newline$
  "\EndOfBibitem" write$
}


FUNCTION { initialize.name.separator } {
  #1 'names.separate.comma     :=
  #0 'names.separate.semicolon :=
}

FUNCTION { format.names.loop } {
  { remaining.names.int #0 > }
    {
      names.str current.name.int "{vv~}{ll}{,~f.}{,~jj}" format.name$
      duplicate$
      'current.name.str :=
      current.name.int #1 >
        {
          duplicate$
          "others," =
            {
              pop$
              *
              bbl.etal
              add.space
              remaining.names.int #1 - 'remaining.names.int :=
            }
            {
              swap$
              names.separate.comma.bool
                { add.comma }
                { add.semicolon }
              if$
              swap$
              *
            }
          if$
        }
        { }
      if$
      remaining.names.int #1 - 'remaining.names.int :=
      current.name.int #1 + 'current.name.int :=
    }
  while$
}

FUNCTION { format.names.all } {
  total.names.int 'remaining.names.int :=
  format.names.loop
}

FUNCTION { format.names.etal } {
  ctrl.etal.firstonly.bool
    { #1 'remaining.names.int := }
    { ctrl.etal.number.int 'remaining.names.int := }
  if$
  format.names.loop
  current.name.str "others," =
    { }
    {
      add.space
      bbl.etal
      add.space
      *
    }
  if$
}

FUNCTION { format.names } {
  'names.separate.comma.bool :=
  'names.str :=
  #1 'current.name.int :=
  names.str num.names$ 'total.names.int :=
  total.names.int ctrl.etal.number.int >
    {
      ctrl.etal.number.int #0 =
        { format.names.all }
        { format.names.etal }
      if$
    }
    { format.names.all }
  if$
}


FUNCTION { bbl.first }  { "1st" }

FUNCTION { bbl.second } { "2nd" }

FUNCTION { bbl.third }  { "3rd" }

FUNCTION { bbl.fourth } { "4th" }

FUNCTION { bbl.fifth }  { "5th" }

FUNCTION { bbl.st }     { "st" }

FUNCTION { bbl.nd }     { "nd" }

FUNCTION { bbl.rd }     { "rd" }

FUNCTION { bbl.th }     { "th" }

STRINGS {
  ord.input.str
  ord.output.str
}

FUNCTION { make.ordinal } {
  duplicate$
  "1" swap$
  *
  #-2 #1 substring$
  "1" =
    {
      bbl.th *
    }
    {
      duplicate$
      #-1 #1 substring$
      duplicate$
      "1" =
        {
          pop$
          bbl.st *
        }
        {
          duplicate$
          "2" =
            {
              pop$
              bbl.nd *
            }
            {
              "3" =
                { bbl.rd * }
                { bbl.th * }
              if$
            }
          if$
        }
      if$
    }
  if$
}

FUNCTION { convert.to.ordinal } {
  extract.number
  "l" change.case$ 'ord.input.str :=
  ord.input.str "first" = ord.input.str "1" = or
    { bbl.first 'ord.output.str := }
    {
      ord.input.str "second" = ord.input.str "2" = or
        { bbl.second 'ord.output.str := }
        {
          ord.input.str "third" = ord.input.str "3" = or
            { bbl.third 'ord.output.str := }
            {
              ord.input.str "fourth" = ord.input.str "4" = or
                { bbl.fourth 'ord.output.str := }
                {
                  ord.input.str "fifth" = ord.input.str "5" = or
                    { bbl.fifth 'ord.output.str := }
                    {
                      ord.input.str #1 #1 substring$
                      is.a.number
                        { ord.input.str make.ordinal }
                        { ord.input.str }
                      if$
                      'ord.output.str :=
                    }
                   if$
                }
              if$
            }
          if$
        }
      if$
    }
  if$
  ord.output.str
}


FUNCTION { format.address } {
  address empty$
    { }
    {
      address
      output
    }
  if$
}

FUNCTION { format.authors } {
  author empty$
    { }
    {
      author names.separate.semicolon format.names
      output
      next.punct.space 'next.punct.int :=
    }
  if$
}

FUNCTION { format.editors } {
  editor empty$
    { }
    {
      editor names.separate.comma format.names
      add.comma
      editor num.names$ #1 >
        { bbl.editors }
        { bbl.editor }
      if$
      *
      output
      next.punct.semicolon 'next.punct.int :=
    }
  if$
}

FUNCTION { format.authors.or.editors } {
  author empty$
    { format.editors }
    { format.authors }
  if$
  next.punct.space 'next.punct.int :=
}

FUNCTION { format.chapter } {
  chapter empty$
    { }
    {
      bbl.chapter add.space
      chapter
      *
      output
    }
  if$
}

FUNCTION { format.doi } {
  doi empty$
    'skip$
    {
      bbl.doi add.space
      "\doi{" * doi * "}" *
      output
    }
  if$
}

FUNCTION { format.edition } {
  edition empty$
    { }
    {
      edition convert.to.ordinal
      add.space bbl.edition *
      output
    }
  if$
  next.punct.semicolon 'next.punct.int :=
}

FUNCTION { format.group.address } {
  duplicate$
  empty$
    { pop$ }
    {
      address empty$
        { }
        {
          add.colon
          address
          *
        }
      if$
      output
    }
  if$
}

FUNCTION { format.howpublished } {
  howpublished empty$
    { }
    {
      howpublished
      output
    }
  if$
}

FUNCTION { format.journal } {
  journal emph
  output
  next.punct.space 'next.punct.int :=
}

FUNCTION { format.journal.unpub } {
  journal emph
  output
}

FUNCTION { format.note } {
  note empty$
    { }
    {
      note
      output
    }
  if$
}

FUNCTION { format.number.series } {
  series empty$
    { }
    {
      series
      number empty$
        { }
        {
          add.space
          number *
        }
      if$
      output
      next.punct.semicolon 'next.punct.int :=
    }
  if$
}

FUNCTION { format.organization } {
  organization empty$
    { }
    {
      organization paren
      output
      next.punct.period 'next.punct.int :=
    }
  if$
}

FUNCTION { format.organization.address } {
  organization format.group.address
}

FUNCTION { format.pages } {
  pages empty$
    { }
    {
      pages multi.page.check
        {
          bbl.pages
          pages hyphen.to.dash
        }
        { bbl.page pages }
      if$
      tie.or.space.connect
      output
    }
  if$
  ctrl.doi.bool
    { format.doi }
    'skip$
  if$
}

FUNCTION { format.pages.article } {
  pages empty$
    { }
    {
      pages hyphen.to.dash
      output
    }
  if$
  ctrl.doi.bool
    { format.doi }
    'skip$
  if$
}

FUNCTION { format.publisher.address } {
  publisher format.group.address
}

FUNCTION { format.school.address } {
  school
  duplicate$
  empty$
    { pop$ }
    {
      address empty$
        { }
        {
          add.comma
          address
          *
        }
      if$
      output
    }
  if$
}

FUNCTION { format.title } {
  title empty$
    { }
    {
      title
      output
      next.punct.period 'next.punct.int :=
    }
  if$
}

FUNCTION { format.title.article } {
  ctrl.article.title.bool
    {
      title empty$
        { }
        {
          title
          output
          next.punct.period 'next.punct.int :=
        }
      if$
    }
    { }
  if$
}

FUNCTION { format.title.techreport } {
  title empty$
    { }
    {
      title emph
      output
      next.punct.semicolon 'next.punct.int :=
    }
  if$
}

FUNCTION { format.title.booktitle } {
  title empty$
    { }
    {
      title
      output
      next.punct.period 'next.punct.int :=
    }
  if$
  booktitle empty$
    { }
    {
      booktitle
      output
      next.punct.period 'next.punct.int :=
    }
  if$
}

STRINGS {
  book.title
  chapter.title
}

FUNCTION { format.title.booktitle.book } {
  "" 'chapter.title :=
  booktitle empty$
    {
      "" 'chapter.title :=
      title 'book.title :=
    }
    {
      ctrl.chapter.title.bool
        {
          title empty$
            'skip$
            { title 'chapter.title := }
          if$
        }
        'skip$
      if$
      maintitle empty$
        { booktitle 'book.title := }
        { maintitle add.period booktitle * 'book.title := }
      if$
    }
  if$
  chapter.title empty$
    { }
    {
      chapter.title
      output
      next.punct.period 'next.punct.int :=
    }
  if$
  book.title emph
  chapter.title empty$
    {
      author empty$
        { }
        {
          editor empty$
            { }
            { bbl.in add.space swap$ * }
          if$
        }
      if$
    }
    { bbl.in add.space swap$ * }
  if$
  output
}

FUNCTION { format.type } {
  type empty$
    { }
    {
      pop$
      type
    }
  if$
  output
}

FUNCTION { format.type.number } {
  type empty$
    { }
    {
      type
      number empty$
        { }
        { number tie.or.space.connect }
      if$
      output
    }
  if$
}

FUNCTION { format.url } {
  url empty$
    { }
    {
      "\url{" url * "}" *
      output
    }
  if$
}

FUNCTION { format.year } {
  year empty$
    { }
    {
      year
      output
      next.punct.semicolon 'next.punct.int :=
    }
  if$
}

FUNCTION { format.year.article } {
  year empty$
    { }
    {
      year bold
      output
    }
  if$
}

FUNCTION { format.version } {
  version empty$
    { }
    {
      bbl.version add.space
      version
      *
      output
    }
  if$
}

FUNCTION { format.volume.article } {
  volume emph
  output
}

FUNCTION { format.volume } {
  volume empty$
    { }
    {
      bbl.volume
      volume
      tie.or.space.connect
      output
      next.punct.semicolon 'next.punct.int :=
    }
  if$
}


FUNCTION { article } {
  begin.bibitem
  format.authors
  format.title.article
  format.journal
  format.year.article
  format.volume.article
  format.pages.article
  format.note
  end.bibitem
}

FUNCTION { book } {
  begin.bibitem
  format.authors.or.editors
  format.title.booktitle.book
  format.edition
  author empty$
    { }
    { format.editors }
  if$
  format.number.series
  format.publisher.address
  format.year
  format.volume
  format.chapter
  format.pages
  format.note
  end.bibitem
}

FUNCTION { inbook } { book }

FUNCTION { booklet } {
  begin.bibitem
  format.authors
  format.title
  format.howpublished
  format.address
  format.year
  format.note
  end.bibitem
}

FUNCTION { collection } { book }

FUNCTION { incollection } { book }

FUNCTION { inpress } {
  begin.bibitem
  format.authors
  format.journal.unpub
  doi empty$
    {
      bbl.inpress
      output
    }
    {
      format.year.article
      next.punct.comma 'next.punct.int :=
      format.doi
    }
  if$
  format.note
  end.bibitem
}

FUNCTION { inproceedings } {
  begin.bibitem
  format.authors
  format.title.booktitle
  format.address
  format.year
  format.pages
  format.note
  end.bibitem
}

FUNCTION { manual } {
  begin.bibitem
  format.authors
  format.title
  format.version
  format.organization.address
  format.year
  format.note
  end.bibitem
}

FUNCTION { mastersthesis } {
  begin.bibitem
  format.authors
  format.title
  bbl.msc format.type
  format.school.address
  format.year
  format.note
  end.bibitem
}

FUNCTION { misc } {
  begin.bibitem
  format.authors
  format.title
  format.howpublished
  format.year
  format.url
  format.note
  end.bibitem
}

FUNCTION { patent } {
  begin.bibitem
  format.authors
  format.organization
  format.title
  format.type.number
  format.year
  format.note
  end.bibitem
}

FUNCTION { phdthesis } {
  begin.bibitem
  format.authors
  format.title
  bbl.phd format.type
  format.school.address
  format.year
  format.note
  end.bibitem
}

FUNCTION { proceeding } {
  begin.bibitem
  format.title
  format.address
  format.year
  format.pages
  format.note
  end.bibitem
}

FUNCTION { techreport } {
  begin.bibitem
  format.authors.or.editors
  format.title.techreport
  format.type.number
  format.organization.address
  format.year
  format.volume
  format.pages
  format.note
  end.bibitem
}

FUNCTION { unpublished } {
  begin.bibitem
  format.authors
  format.journal.unpub
  doi empty$
    { format.howpublished }
    {
      format.year
      next.punct.comma 'next.punct.int :=
      format.doi
    }
  if$
  format.note
  end.bibitem
}

FUNCTION { default.type } { misc }


MACRO { jan } { "Jan." }
MACRO { feb } { "Feb." }
MACRO { mar } { "Mar." }
MACRO { apr } { "Apr." }
MACRO { may } { "May" }
MACRO { jun } { "June" }
MACRO { jul } { "July" }
MACRO { aug } { "Aug." }
MACRO { sep } { "Sept." }
MACRO { oct } { "Oct." }
MACRO { nov } { "Nov." }
MACRO { dec } { "Dec." }

MACRO { acbcct } { "ACS Chem.\ Biol." }
MACRO { achre4 } { "Acc.\ Chem.\ Res." }
MACRO { acncdm } { "ACS Chem.\ Neurosci." }
MACRO { ancac3 } { "ACS Nano" }
MACRO { ancham } { "Anal.\ Chem." }
MACRO { bichaw } { "Biochemistry" }
MACRO { bcches } { "Bioconjugate Chem." }
MACRO { bomaf6 } { "Biomacromolecules" }
MACRO { bipret } { "Biotechnol.\ Prog." }
MACRO { crtoec } { "Chem.\ Res.\ Toxicol." }
MACRO { chreay } { "Chem.\ Rev." }
MACRO { cmatex } { "Chem.\ Mater." }
MACRO { cgdefu } { "Cryst.\ Growth Des." }
MACRO { enfuem } { "Energy Fuels" }
MACRO { esthag } { "Environ.\ Sci.\ Technol." }
MACRO { iechad } { "Ind.\ Eng.\ Chem.\ Res." }
MACRO { inoraj } { "Inorg.\ Chem." }
MACRO { jafcau } { "J.~Agric.\ Food Chem." }
MACRO { jceaax } { "J.~Chem.\ Eng.\ Data" }
MACRO { jceda8 } { "J.~Chem.\ Ed." }
MACRO { jcisd8 } { "J.~Chem.\ Inf.\ Model." }
MACRO { jctcce } { "J.~Chem.\ Theory Comput." }
MACRO { jcchff } { "J. Comb. Chem." }
MACRO { jmcmar } { "J. Med. Chem." }
MACRO { jnprdf } { "J. Nat. Prod." }
MACRO { joceah } { "J.~Org.\ Chem." }
MACRO { jpcafh } { "J.~Phys.\ Chem.~A" }
MACRO { jpcbfk } { "J.~Phys.\ Chem.~B" }
MACRO { jpccck } { "J.~Phys.\ Chem.~C" }
MACRO { jpclcd } { "J.~Phys.\ Chem.\ Lett." }
MACRO { jprobs } { "J.~Proteome Res." }
MACRO { jacsat } { "J.~Am.\ Chem.\ Soc." }
MACRO { langd5 } { "Langmuir" }
MACRO { mamobx } { "Macromolecules" }
MACRO { mpohbp } { "Mol.\ Pharm." }
MACRO { nalefd } { "Nano Lett." }
MACRO { orlef7 } { "Org.\ Lett." }
MACRO { oprdfk } { "Org.\ Proc.\ Res.\ Dev." }
MACRO { orgnd7 } { "Organometallics" }


READ

EXECUTE { initialize.control.values }

EXECUTE { initialize.count.entries }

EXECUTE { initialize.name.separator }

EXECUTE { initialize.tracker }

ITERATE { calculate.names }

ITERATE { count.entries }

EXECUTE { begin.bib }

ITERATE { call.type$ }

EXECUTE { end.bib }
%% 
%% Originally developed by Mats Dahlgren
%% Copyright (C) 1996-1998 by Mats Dahlgren
%% Copyright (C) 2008-2022 by
%%   Joseph Wright <joseph.wright@morningstar2.co.uk>
%% 
%% Part of this bundle is derived from cite.sty, to which the
%% following license applies:
%%   Copyright (C) 1989-2009 by Donald Arseneau
%%   These macros may be freely transmitted, reproduced, or
%%   modified provided that this notice is left intact.
%% 
%% It may be distributed and/or modified under the conditions of
%% the LaTeX Project Public License (LPPL), either version 1.3c of
%% this license or (at your option) any later version.  The latest
%% version of this license is in the file:
%% 
%%    http://www.latex-project.org/lppl.txt
%% 
%% This work is "maintained" (as per LPPL maintenance status) by
%%   Joseph Wright.
%% 
%% This work consists of the files achemso.dtx,
%%                                 achemso-demo.bib and
%%                                 achemso-demo.tex,
%%           and the derived files achemso.cls,
%%                                 achemso.ins,
%%                                 achemso.pdf,
%%                                 achemso.sty,
%%                                 natmove.sty and
%%                                 a number of configuration files.
%% 
%%
%% End of file `achemso.bst'.
