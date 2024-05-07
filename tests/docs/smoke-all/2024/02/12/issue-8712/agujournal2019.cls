\def\currversion{April 16, 2019}

  %****************************************************************%
  %*                                                              *%
  %*  AGU Class File for all AGU Journals                         *%
  %*                                                              *%
  %*  Written by Amy Hendrickson                                  *%
  %*  TeXnology Inc.: 617 738-8029                                *%
  %*  amyh@texnology.com                                          *%
  %*  http://www.texnology.com                                    *%
  %*                                                              *%
  %****************************************************************%

%%% Updates by Dangerous Curve  typesetting@dangerouscurve.org
%%%
%%%  2017-07-14
%%%      (Changes marked DC)
%%%
%%%      Use BibLaTeX for change to APA style.
%%%      Removed tracking-changes code.
%%%
%%%
%%%  2017-12-16
%%%
%%%    Remove biblatex.
%%%    Use apacite instead of agufull08,

%%%  2018-07-17 / NRV
%%%  thanks to John Haiducek for help with citep error

%%% 2019-01-14 / NRV
%%% Removed natbib, changed instructions for cite commands, added Appendix heading

%%% 2019-4-16 / NRV
%%% Removed ulem to facilitate trackchanges
%%% Gave user more control over trackchanges options
%%% fixed typo in example citations

\ProvidesClass{agujournal2019}
              [01/14/2019]

%% SEARCH BELOW FOR THE NUMBER TO FIND PARTICULAR MACRO GROUP

    %% Macro Contents:
    %% 0) Usepackage graphicx, colorx, other .sty files which we'll need to have available.

    %% 1) Setting Default Dimensions

    %% 2) Global Parameters

    %% 3) Setting and Using Options

    %% 4) Font Family declarations

    %% 5) Running heads, Footnotes

    %% 6) Title Page: Journal Name,
    %%    Title, Authors, Affils, Corresponding Authors, Author Notes, Key Points; abstract

    %% 7) Section Commands

    %% 8) Figure and Table Captions

    %% 9) Listing

    %% 10) Etc.: Hyphenation Library, Quote, Extract

    %% 11) End Article: Appendix, Glossary, Acronyms, Notation, Acknowledgments

    %% 12) Bibliography, References

    %% 13) Track Changes

    %% 14) Supporting Information

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% 0) Bringing in packages that we will need:

%% Nicer font choice than Computer Modern:
%\RequirePackage{newtxtext,newtxmath}

%% always will want this available
\RequirePackage{graphicx}

%% to get illustrations to print, in spite of being in Draft mode:
\setkeys{Gin}{draft=false}

%% xcolor.sty
\RequirePackage{xcolor}
\RequirePackage{url}

%% for better track changes
%\RequirePackage{trackchanges}

%% used for running head which is in light gray

\definecolor{ltgray}{cmyk}{.12,0,0,.3}

%% Line numbering
\RequirePackage{lineno}
%% add more space between text and number:
\advance\linenumbersep 12pt

%% this package makes paragraphs indent after section heads
\RequirePackage{indentfirst}


%% \RaggedRight makes the right margin go in and out; if this is commented out
%% the default will be a right justified margin.
\RequirePackage{ragged2e}
\RaggedRightParindent=24pt
\advance\RaggedRightRightskip 24pt
\RaggedRight

%% Defines \sidewaystable and \sidewaysfigure, preferred by AGU
\RequirePackage{rotating}
\newif\ifturnofflinenums
\let\savesidewaystable\sidewaystable
\let\savesidewaysfigure\sidewaysfigure
%% turns off line numbers in rotated tables and figures, aesthetic consideration,
%% not necessary.
\def\sidewaystable{\turnofflinenumstrue\savesidewaystable\centering}
\def\sidewaysfigure{\turnofflinenumstrue\savesidewaysfigure\centering}

%%xx Use apacite.  DC
%% Formats bibliography, this .sty file needs to be entered later
% \RequirePackage{natbib}

%\PassOptionsToPackage{normalem}{ulem}
%\RequirePackage{ulem}

%% <== End Bringing in Packages

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% 1) Setting Default Dimensions

  %% Comment
  %% parindent= indentation for every new paragraph
  %% parskip= distance between paragraphs. Giving `plus .1pt' allows
  %% a little stretch between paragraphs. If you don't like this stretch
  %% you can set \parskip=0pt

\parindent=24pt
\parskip=8pt % plus .1pt

  %% Comment
  %% \textheight is distance from bottom of text, exclusive of running
  %% foot, to top of text, exclusive of running head.

\textheight = 9.25in
  %% Comment
  %% \textwidth= Width of text in normal page. Can change this width locally
  %% with either \leftskip/\rightskip or change in \hsize, but will
  %% still be able to return to the normal width by setting \hsize=\textwidth
  %% Running head normally uses \textwidth as its width so that a change
  %% in \hsize in text will not change width of running head or feet.

\textwidth 5.5in

  %% Comment
  %% \voffset moves the printed page up or down on the physical page.
\advance\voffset-.25in

  %% Comment
  %% \hoffset moves the printed page left or right on the physical page.
\advance\hoffset.35in

  %% Comment
  %% Setting page dimensions
  %% See p. 84-- 85 in LaTeX Companion, Goosins, Mittlebach and Samarin
  %% or p. 555--556 in A Guide to LaTeX, Kopka and Daly, both Addison Wesley
  %% books.

  %% \topmargin space between top of page and running head

  %% \headheight height of running head

  %% \headsep  space between running head and text

  %% \topskip  space between top of text and baseline of first line
  %%            of text

  %% \footskip space between text and baseline of page number

  %% \columnsep space between two column text

  %% \columnseprule width of optional rule between columns, usually set to 0pt

  %%  \footnotesep Distance between two footnotes

  %%  \skip\footins Distance between text and footnote

  %%  \floatsep Distance between float and another
  %%       float for single col floats.

  %%  \textfloatsep Distance between float and text at top
  %%                     or bottom of page.

  %%  \intextsep  Distance between float and text if float is mid page
  %%                 or mid column

  %%  \dblfloatsep  For float spanning both columns in two column text,
  %%  above or below both columns, space between float and and float.


\topmargin0pt
\headheight 8pt
\headsep 6pt
\topskip  10pt
\footskip 36pt

\columnsep 10pt
\columnseprule 0pt

\footnotesep 6.65pt
\skip\footins 24pt plus .1pt minus .1pt

\floatsep 12pt plus 2pt minus 2pt
\textfloatsep 36pt plus 2pt minus 4pt
\intextsep 24pt plus 2pt minus 2pt

\dblfloatsep 12pt plus 2pt minus 2pt
\dbltextfloatsep 20pt plus 2pt minus 4pt

%% float placement, used by output routine
\@fptop 0pt plus 1fil
\@fpsep 8pt plus 2fil
\@fpbot 0pt plus 1fil
\@dblfptop 0pt plus 1fil
\@dblfpsep 8pt plus 2fil
\@dblfpbot 0pt plus 1fil

  %% When using \marginpar, how wide can marginal note be?

\marginparwidth .75in

  %% When using \marginpar, how much horizontal space between marginal
  %% note and text

  \setlength\marginparsep{40\p@}

  %% When to push marginal note on to next page, minimum vertical space between
  %% two marginal notes

\setlength\marginparpush{5\p@}

  %% space added before trivlist, which is used in many other
  %% macros, (for instance, verbatim environment)
  %% if macro is called in vertical mode, otherwise only parskip
  %% is added. Can set this without stretch if you don't like
  %% the stretchy space added.

\setlength\partopsep{2\p@ \@plus 1\p@ \@minus 1\p@}

  %% Comment
  %% Setting parameters that control float placement
  %%
  %% \topnumber counter holds the maximum number of
  %% floats that can appear on the top of a text page.
  %%
  %% \topfraction indicates the maximum part of a text page that can be
  %%     occupied by floats at the top.
  %%
  %% \bottomnumber counter holds the maximum number of
  %%     floats that can appear on the bottom of a text page.
  %%
  %% \bottomfraction indicates the maximum part of a text page that can be
  %%     occupied by floats at the bottom.
  %%
  %% \totalnumber indicates the maximum number of floats that can appear on
  %%     any text page.
  %%
  %% \textfraction indicates the minimum part of a text page that has to be
  %%     occupied by text.
  %%
  %% \floatpagefraction indicates the minimum part of a page that has to be
  %%     occupied by floating objects before a `float page' is produced.
  %%
  %% \dbltopnumber counter holds the maximum number of
  %%     two column floats that can appear on the top of a two column text
  %%     page.
  %%
  %% \dbltopfraction indicates the maximum part of a two column text page that
  %%     can be occupied by two column floats at the top.
  %%
  %% \dblfloatpagefraction indicates the minimum part of a page that has to be
  %%     occupied by two column wide floating objects before a `float
  %%     page' is produced.
  %%%

\setcounter{topnumber}{10}
\def\topfraction{.9}
\setcounter{bottomnumber}{10}
\def\bottomfraction{.1}
\setcounter{totalnumber}{10}
\def\textfraction{.2}
\def\floatpagefraction{.5}
\setcounter{dbltopnumber}{2}
\def\dbltopfraction{.7}
\def\dblfloatpagefraction{.5}

  %% Setting Array and Table Spacing
  %% distance between columns in array
\setlength\arraycolsep{5\p@}

  %% distance between columns in tabular
\tabcolsep 6pt

  %% width of lines in array
\setlength\arrayrulewidth{.4\p@}

  %% horizontal space between two lines in array
\setlength\doublerulesep{2\p@}

  %% space between two lines in tabular
\setlength\tabbingsep{\labelsep}

  %% Minipage
  %% minipage space
\skip\@mpfootins = \skip\footins

  %% Framebox \fbox{} or \framebox{}
  %% space between line in framebox and text within it
\setlength\fboxsep{3\p@}

  %% width of ruled line in framebox
\setlength\fboxrule{.4\p@}


%%%%%%%%%%%%%%% <<== end dimensions

% 2) %%% Global parameters ==>>

  %% Makes sure that there will not be any widow or club lines,
  %% smaller numbers allow them occassionally, but you probably need
  %% these set to 10000 so that there are never any

\widowpenalty10000
\clubpenalty10000

  %% How many levels deep do you want sections to be numbered-- higher number
  %% means more levels will be numbered. Here was are asking only for
  %% sections to be numbered, not subsections, or subsubsection etc.
\setcounter{secnumdepth}{4}


  %% To make left and right page position differently, and have
  %% running heads be different on even and odd pages
\@twosidetrue

  %% Marginal notes should be on the left on even numbered pages; on
  %% right on odd numbered pages.
\@mparswitchtrue

  %% Starting with one column text
\@twocolumnfalse

  %% openbib will allow separate lines for parts of bibliography
  %% entries, default is to run different parts of bib entry into a
  %% paragraph form.

\newif\if@openbib
\@openbibfalse

  %% Conditionals that we can set and use later
\newif\if@openright
\newif\if@mainmatter
\newif\if@restonecol
\newif\if@titlepage
\newif\ifdraft
\newif\ifnumlines

  %% Comment
  %% Set Names, to be used later, usually in more than one
  %% macro.
\newcommand{\bibname}{Bibliography}
\newcommand{\figurename}{Figure}
\newcommand{\tablename}{Table}
\newcommand{\appendixname}{Appendix}

%%% <== end global parameters

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% 3) Declare Options and Use Default Options
\DeclareOption{draft}{\global\drafttrue}
\DeclareOption{linenumbers}{\global\numlinestrue}
\DeclareOption{final}{\setlength\overfullrule{0pt}\global\draftfalse}

\ExecuteOptions{letterpaper,10pt,onecolumn,final,openright}
\ProcessOptions

\ifnumlines
\linenumbers*[1]
\fi

%% <==== End Setting Options

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% 4) Font Family Info

%% Comment
%% When \ifdraft is true it will make the baselineskip = \draftskip

\newcount\draftskip
\draftskip=20

\newcommand{\@ptsize}{}

  %% Comment
  %% Set font sizes, normal baselineskip, for the range of sizes,
  %% changing baselineskip to be larger if draft option is true
  %% \setfontsize takes the first arg as the size of the font and
  %% the second as the size of the baselineskip
  %% \abovedisplayskip and \belowdisplayskip is the space before and
  %% after an equation, adjusted in some sizes.

  %% \Huge 25pt
  %% \huge 20pt
  %% \LARGE 17pt
  %% \Large 14pt
  %% \large 12pt
  %% \normalsize 10 pt font
  %% \small 9pt
  %% \footnotesize 8pt
  %% \scriptsize 7pt font
  %% \tiny 5pt font


\renewcommand\normalsize{%
\ifdraft
   \@setfontsize\normalsize\@xpt{\draftskip}
\else
   \@setfontsize\normalsize\@xpt{12}
\fi
   \abovedisplayskip 10\p@ \@plus2\p@ \@minus5\p@
   \abovedisplayshortskip \z@ \@plus3\p@
   \belowdisplayshortskip 6\p@ \@plus3\p@ \@minus3\p@
   \belowdisplayskip \abovedisplayskip
   \let\@listi\@listI}
\normalsize

\newcommand\bignormalsize{\@setfontsize\bignormalsize{10.5pt}{12}}

\newcommand\small{%
\ifdraft
   \@setfontsize\small\@ixpt{\draftskip}%
\else
   \@setfontsize\small\@ixpt{14}%
\fi
   \abovedisplayskip 8.5\p@ \@plus3\p@ \@minus4\p@
   \abovedisplayshortskip \z@ \@plus2\p@
   \belowdisplayshortskip 4\p@ \@plus2\p@ \@minus2\p@
   \def\@listi{\leftmargin\leftmargini
               \topsep 4\p@ \@plus2\p@ \@minus2\p@
               \parsep 2\p@ \@plus\p@ \@minus\p@
               \itemsep \parsep}%
   \belowdisplayskip \abovedisplayskip
}

\newcommand\footnotesize{%
\ifdraft
   \@setfontsize\footnotesize\@viiipt{\draftskip}%
\else
   \@setfontsize\footnotesize\@viiipt{12}%
\fi
   \abovedisplayskip 6\p@ \@plus2\p@ \@minus4\p@
   \abovedisplayshortskip \z@ \@plus\p@
   \belowdisplayshortskip 3\p@ \@plus\p@ \@minus2\p@
   \def\@listi{\leftmargin\leftmargini
               \topsep 3\p@ \@plus\p@ \@minus\p@
               \parsep 2\p@ \@plus\p@ \@minus\p@
               \itemsep \parsep}%
   \belowdisplayskip \abovedisplayskip
}

\newcommand\scriptsize{\@setfontsize\scriptsize\@viipt\@viiipt}
\newcommand\tiny{\@setfontsize\tiny\@vpt\@vipt}
\newcommand\large{\ifdraft
\@setfontsize\large\@xiipt{\draftskip}
\else
\@setfontsize\large\@xiipt{14}
\fi
}

\newcommand\Large{\ifdraft
\@setfontsize\Large\@xivpt{\draftskip}
\else
\@setfontsize\Large\@xivpt{18}
\fi}

\newcommand\LARGE{\@setfontsize\LARGE\@xviipt{22}}
\newcommand\huge{\@setfontsize\huge\@xxpt{25}}
\newcommand\Huge{\@setfontsize\Huge\@xxvpt{30}}

%%%%%%%%%%%%%%%%%%%%%%%%%%

%% These definitions accomodate older font typeface commands,
%% that are still in use.

\DeclareOldFontCommand{\rm}{\normalfont\rmfamily}{\mathrm}
\DeclareOldFontCommand{\sf}{\normalfont\sffamily}{\mathsf}
\DeclareOldFontCommand{\tt}{\normalfont\ttfamily}{\mathtt}
\DeclareOldFontCommand{\bf}{\normalfont\bfseries}{\mathbf}
\DeclareOldFontCommand{\it}{\normalfont\itshape}{\mathit}
\DeclareOldFontCommand{\sl}{\normalfont\slshape}{\@nomath\sl}
\DeclareOldFontCommand{\sc}{\normalfont\scshape}{\@nomath\sc}
\DeclareRobustCommand{\cal}{\@fontswitch{\relax}{\mathcal}}
\DeclareRobustCommand{\mit}{\@fontswitch{\relax}{\mathnormal}}

%% end font family declarations
%%%%%%%%%%%%%%%%%%%%%%%%

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% 5) Running heads and footnotes

%% Running heads ===>>>

  %% unless we need these, leave these uncommented
    \let\@mkboth\@gobbletwo
    \let\chaptermark\@gobble
    \let\sectionmark\@gobble
  %%

\def\ps@headings{\def\@oddfoot{\centerline{\small --\the\c@page--}}
\let\@evenfoot\@oddfoot
%% \thejournalname set with \journalname{} command; if not you will get a request to set
%% the journal name with \journalname{}
\def\@oddhead{\vbox to 0pt{\vss\centerline{\color{ltgray}\small manuscript
submitted to {\it \thejournalname}}\vskip24pt}}
\let\@evenhead\@oddhead
}



%% After ps@headings is defined, now we use it to activate the definitions
\ps@headings

%%% Footnotes

  %% save these definitions so that we can use them if
  %% we don't like the redefinition
\let\savefootnote\footnote
\let\savefootnotetext\footnotetext

  %%% ruled line above footnote

  \renewcommand{\footnoterule}{%
  \kern-3\p@
  \hrule width .4\columnwidth
  \kern 2.6\p@}

 \let\savefootnoterule\footnoterule

% turn off footnote rule, line at bottom of page above footnotes
  \let\footnoterule\relax

% can turn it back on by uncommenting
\let\footnoterule\savefootnoterule

% Making footnote indent 1em
\long\def\@makefntext#1{%
\noindent\hspace*{1em}\@makefnmark\,#1}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% 6) Title Page:
   %% Journal Name, running heads;
   %% Title, Authors, Affils, Corresponding Authors, Author Notes, Key Points;
   %% Starting article with abstract.

%% Set journal name:
\def\journalname#1{\def\thejournalname{#1}}
\journalname{Please set Journal Name by using {\tt\string\journalname}}


%% Article Title
\def\title#1{\global\c@footnote=0\relax%
{\centering \Large\bf #1 \vskip14pt}
\def\thetitle{#1}}

\def\authors#1{{\centering \normalsize\bf #1\vskip12pt}}
\def\affil#1{$^{#1}$\ignorespaces}
\def\affiliation#1#2{\vskip-.5\parskip\relax{\centering{\footnotesize
$^{#1}$#2\relax}\vskip-\parskip}}

\def\correspondingauthor#1#2{{\let\@thefnmark\relax\@footnotetext{\noindent\vrule
height 18pt width0pt\relax\hbox to-8pt{}{\small
Corresponding author: #1,
{\tt #2}}}}}

%% Used to send footnote to bottom of page when entered in \authors{} field.
\def\thanks#1{{\renewcommand\thefootnote{\@fnsymbol\c@footnote}%
    \def\@makefnmark{\rlap{\@textsuperscript{\normalfont\@thefnmark}}}%
    \long\def\@makefntext##1{\noindent\hskip-9pt\hb@xt@1.8em{%
                \hss\@textsuperscript{\normalfont\@thefnmark}}##1}\footnote{#1}\
		}}

\def\keypoints{\vskip24pt\vskip1sp\subsection*{Key Points:}
\begin{itemize}}
\def\endkeypoints{\end{itemize}}

\def\abstract{\newpage\noindent{\bf Abstract}\vskip-\parskip
\global\c@footnote=0\relax%
\noindent\ignorespaces}
\def\endabstract{\vskip18pt}

%% <== End Title page and Abstract

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% 7) Section Commands

%  SectionCounters, Header Level Counters ===>>

  %% the argument in square brackets is for the command that will reset
  %% counter to zero
\newcounter {section}
\newcounter {subsection}[section]
\newcounter {subsubsection}[subsection]
\newcounter {paragraph}[subsubsection]
\newcounter {subparagraph}[paragraph]


  %% Header Level Counters ==>>
  %% Change to any level will change the levels below


\renewcommand{\thesection}      {\arabic{section}}
\renewcommand{\thesubsection}   {\thesection.\arabic{subsection}}
\renewcommand{\thesubsubsection}{\thesubsection.\arabic{subsubsection}}
\renewcommand{\theparagraph}    {\thesubsubsection.\arabic{paragraph}}
\renewcommand{\thesubparagraph} {\theparagraph.\arabic{subparagraph}}

\newcommand{\@chapapp}{\chaptername}

  %%% <<== End Header Level Counters

  %% Definition printed here so that you can see what the various arguments are
  %% when used for \section, \subsection, etc, below
  %% \newcommand{\section}{\@startsection {section}{1}{\z@}...}


% \@startsection {NAME}{LEVEL}{INDENT}{BEFORESKIP}{AFTERSKIP}{STYLE}
%            optional * [ALTHEADING]{HEADING}
%    Generic command to start a section.
%    NAME       : e.g., 'subsection'
%    LEVEL      : a number, denoting depth of section -- e.g., chapter=1,
%                 section = 2, etc.
%    INDENT     : Indentation of heading from left margin
%    BEFORESKIP : Absolute value = skip to leave above the heading.
%                 If negative, then paragraph indent of text following
%                 heading is suppressed.
%    AFTERSKIP  : if positive, then skip to leave below heading, else
%                 negative of skip to leave to right of run-in heading.
%    STYLE      : commands to set style
%  If '*' missing, then increments the counter.  If it is present, then
%  there should be no [ALTHEADING] argument.
%  Uses the counter 'secnumdepth' whose value is the highest section
%  level that is to be numbered.

  %% Startsection calls \@sect, the engine that formats each section

  %% the minus dimensions are used to tell LaTeX not to indent
  %% the text following the section head
  %% (silly, isn't it? but built into LaTeX)
  %% You can add things like underline or uppercase to the last arg
  %% to get those effects in a section head

%% adds a little space after the section number, before following text.
\def\@seccntformat#1{\csname the#1\endcsname\ \ }

\newcommand\section{\@startsection {section}{1}{\z@}%
                                   {\ifdraft18pt plus 1pt minus
				   1pt\else 12pt plus 1pt minus 1pt\fi}%
                                   {1sp}%
                                   {\bignormalsize\bfseries\boldmath}}

\newcommand\subsection{\@startsection{subsection}{2}{\parindent}%
                                   {\ifdraft 12pt\else 8pt\fi}%
                                   {1sp}%
                                   {\normalfont\bf\boldmath}}

\newcommand\subsubsection{\@startsection{subsubsection}{3}{\parindent}%
                                   {\ifdraft 12pt\else 8pt\fi}%
                                   {1sp}%
                                   {\normalfont\itshape\bfseries}}

\newcommand\paragraph{\@startsection{paragraph}{4}{\parindent}%
                                    {3pt plus 1pt minus 1pt}%
                                    {-1em}%
                                    {\normalfont\normalsize\itshape}}

\newcommand\subparagraph{\@startsection{subparagraph}{5}{\parindent}%
                                    {3pt plus 1pt minus 1pt}%
                                    {-1em}%
                                      {\normalfont\normalsize\itshape}}

  %%% <<=== end section commands


%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% 8) Figure and Table Captions ==>>>

\long\def\@caption#1[#2]#3{%
  \par
  \begingroup
    \@parboxrestore
    \normalsize
\linenumbers
    \@makecaption{\csname fnum@#1\endcsname}{\ignorespaces #3}\par
  \endgroup}
\def\@float#1{%
  \@ifnextchar[%
    {\@xfloat{#1}}%
    {\edef\reserved@a{\noexpand\@xfloat{#1}[\csname fps@#1\endcsname]}%
     \reserved@a}}
\def\@dblfloat{%
  \if@twocolumn\let\reserved@a\@dbflt\else\let\reserved@a\@float\fi
  \reserved@a}

  %%  Name of Figure or Table is set with \figurename or \tablename above
  %% \@float is what puts the text at the top or bottom of the page
  %% \@dblfloat is for floats in two column text

\newcounter{figure}
\renewcommand{\thefigure}{\arabic{figure}}

\def\fps@figure{tbp} % position figure at top, bottom, or on its own page
\def\ftype@figure{1} % used for placing float in page
\def\ext@figure{lof} % send info to .lof file
\def\fnum@figure{\figurename~~\thefigure} % \figurename, defined above,
                              %% and the current state of figure counter

  %% \begin{figure} calls up float and gives it the {figure} argument,
  %% which is then used to call up the definitions above, by using
  %% \csname fps@\captype\endcsname, for instance, to get \fps@figure;
  %% adjusting the macro to do different things depending on whether
  %% figure, table, environment, or other term is used.

\newenvironment{figure}
               {\@float{figure}}
               {\end@float}

  %% figure in two column text
\newenvironment{figure*}
               {\@dblfloat{figure}}
               {\end@dblfloat}

  %% Similar as the sequence of definitions above used for figure
\newcounter{table}
\renewcommand{\thetable}{\@arabic\c@table}
\def\fps@table{tbp}
\def\ftype@table{2}
\def\ext@table{lot}
\def\fnum@table{\tablename~\thetable}
\newenvironment{table}
               {\@float{table}}
               {\end@float}
\newenvironment{table*}
               {\@dblfloat{table}}
               {\end@dblfloat}

  %%%%%%%%%%%%%%%%
  %% Setting space between caption in table or figure and the
  %% table or figure
\newlength\abovecaptionskip
\newlength\belowcaptionskip
\setlength\abovecaptionskip{10\p@}
\setlength\belowcaptionskip{10\p@}

  %% to test in caption to see whether it is a figure or table
\def\xfigure{figure}

  %% Variation on LaTeX code
  %% Skips below caption
  %% an extra 3pt if it is a table to give extra space between caption
  %% and table, since caption for table goes above table.

  %% \sbox\@tempboxa sets a temporary box so that we can measure
  %% the width of the caption; if width is greater than .9\hsize
  %% then make it format in a paragraph, otherwise center it.

  %% Test to see if it a figure or table: \ifx\@captype\xfigure
  %% If figure, \vskip\belowcaptionskip

\long\def\@makecaption#1#2{%
{\small
\ifx\@captype\xfigure
\vskip\abovecaptionskip\fi
{\ifturnofflinenums\else\ifnumlines\internallinenumbers\fi\fi
 \sbox\@tempboxa{\bf#1.\quad \rm #2}%
  \ifdim \wd\@tempboxa >.9\hsize
\bf #1.\quad\rm\relax #2\par
  \else
{\centering
 \bf #1.\rm\quad #2
\vskip1sp}
  \fi}
%%
\ifx\@captype\xfigure\else
  \vskip\belowcaptionskip\fi
}}


  %% Code to get text in tables to extend all the way to left and right
  %% of table. The LaTeX table macros are made to allow space to the
  %% left and the right of tables to accomodate vertical ruled lines. But
  %% most publishers don't want vertical ruled lines.  If the authors
  %% don't use the ruled lines there would be extra white space without
  %% the changes below. This code is very complicated, but you can see
  %% the changed part.

\def\xtable{table}
\def\@array[#1]#2{\setbox\@arstrutbox=\hbox{\vrule
     height\arraystretch \ht\strutbox
     depth\arraystretch \dp\strutbox
     width\z@}\@mkpream{#2}\edef\@preamble{\halign \noexpand\@halignto
\bgroup%
\tabskip\z@\@arstrut\@preamble
\ifx\@captype\xtable\hskip-\tabcolsep\fi  %% <==== Changed
\tabskip\z@ \cr}%
\let\@startpbox\@@startpbox \let\@endpbox\@@endpbox%
  \if #1t\vtop \else \if#1b\vbox \else \vcenter \fi\fi%
  \bgroup\let\par\relax%
  \let\@sharp##\let\protect\relax \lineskip\z@\baselineskip\z@\@preamble}


  %% Variation on code found in Latex.tex
\def\new@tabacol{\edef\@preamble{\@preamble\hskip0pt}}

\def\@tabclassz{\ifcase \@lastchclass\@acolampacol%
\or \@ampacol \or
   \or \or \@addamp \or \@acolampacol\or \@firstampfalse
\ifx\@captype\xtable \new@tabacol\else\@tabacol \fi%
\fi%
\edef\@preamble{\@preamble%
  \ifcase \@chnum%
     \hfil\ignorespaces\@sharp\unskip\hfil%
     \or \ignorespaces\@sharp\unskip\hfil%
     \or \hfil\hskip\z@ \ignorespaces\@sharp\unskip\fi}}

  %% This puts extra space between horizontal lines in tables.
  %% If you want to use vertical lines in tables, you should use
  %% \savehline rather than \hline, otherwise the vertical and
  %% horizontal lines will not abutt.

  %% \noalign is a command that allows the uses to put something
  %% between lines in a table.
\let\savehline\hline
\def\hline{\noalign{\vskip3pt}\savehline\noalign{\vskip3pt}}

  %% Simple macro for table notes, that makes sure that there is
  %% a little space between the table and the notes, and that they
  %% print in footnotesize.
\def\tablenotes{\vskip2pt\footnotesize}
\let\endtablenotes\relax

  %%% <<=== end Figure and Table Captions


%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

% 9) Listing, ==>>
\def\@listI{\leftmargin\leftmargini
            \parsep 0\p@ %\@plus2\p@ \@minus0\p@
            \topsep 4\p@ %\@plus2\p@ \@minus0\p@
            \itemsep1\p@ %\@plus2\p@ \@minus0\p@
}
\let\@listi\@listI
\@listi

\def\@listii {\leftmargin\leftmarginii
              \labelwidth\leftmarginii
              \advance\labelwidth-\labelsep
              \topsep    4\p@ \@plus2\p@ \@minus\p@
              \parsep    2\p@ \@plus\p@  \@minus\p@
              \itemsep   \parsep}
\def\@listiii{\leftmargin\leftmarginiii
              \labelwidth\leftmarginiii
              \advance\labelwidth-\labelsep
              \topsep    2\p@ \@plus\p@\@minus\p@
              \parsep    \z@
              \partopsep \p@ \@plus\z@ \@minus\p@
              \itemsep   \topsep}
\def\@listiv {\leftmargin\leftmarginiv
              \labelwidth\leftmarginiv
              \advance\labelwidth-\labelsep}
\def\@listv  {\leftmargin\leftmarginv
              \labelwidth\leftmarginv
              \advance\labelwidth-\labelsep}
\def\@listvi {\leftmargin\leftmarginvi
              \labelwidth\leftmarginvi
              \advance\labelwidth-\labelsep}

  %% amount left edge of text is indented relative to normal text
  %% i is for first level in, ii is for second level in, etc.
\setlength\leftmargini  {28pt}
\setlength\leftmarginii  {11pt}
\setlength\leftmarginiii {1.87em}
\setlength\leftmarginiv  {1.7em}
\setlength\leftmarginv  {1em}
\setlength\leftmarginvi {1em}


  %% default indentation for first level itemized lists
\setlength\leftmargin    {\leftmargini}

  %% horizontal distance between item and following text
\setlength  \labelsep  {6pt}

  %% how wide should item be?
\setlength  \labelwidth{\leftmargini}

  %% subtract width of label separation
\addtolength\labelwidth{-\labelsep}

  %% more listing defaults
\leftmargin\leftmargini
\labelwidth\leftmargini\advance\labelwidth-\labelsep


\@beginparpenalty -\@lowpenalty
\@endparpenalty   -\@lowpenalty
\@itempenalty     -\@lowpenalty

  %% defining listing markers for enumerate
\renewcommand{\theenumi}{\arabic{enumi}}
\renewcommand{\theenumii}{\alph{enumii}}
\renewcommand{\theenumiii}{\roman{enumiii}}
\renewcommand{\theenumiv}{\Alph{enumiv}}

  %% using listing markers for enumerate
\newcommand{\labelenumi}{\theenumi.\hskip-2pt}
\newcommand{\labelenumii}{(\theenumii)}
\newcommand{\labelenumiii}{\theenumiii.}
\newcommand{\labelenumiv}{\theenumiv.}

  %% crossreferencing for listing markers
\renewcommand{\p@enumii}{\theenumi}
\renewcommand{\p@enumiii}{\theenumi(\theenumii)}
\renewcommand{\p@enumiv}{\p@enumiii\theenumiii}

  %% listing markers for itemize (no crossreferencing needed)
\newcommand{\labelitemi}{\raise.4ex\hbox{\tiny$\bullet$}}
\newcommand{\labelitemii}{\normalfont\bfseries --}
\newcommand{\labelitemiii}{$\m@th\ast$}
\newcommand{\labelitemiv}{$\m@th\cdot$}

  %% Setting up description listing environment
\newenvironment{description}
               {\list{}{\labelwidth\z@ \itemindent-\leftmargin
                        \let\makelabel\descriptionlabel}}
               {\endlist}

\newcommand*{\descriptionlabel}[1]{\hspace\labelsep
                                \normalfont\bfseries #1}

%%% <<=== end of listing commands

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%% 10) ETC.: Month/year, Hyphenation Library, Quote, Quotation, Extract

%% Month and Year

% Nice example of \ifcase which takes a counter and activates
% the slot following the counter that matches the same number;
% \month expands to a number, so ifcase will activate the slot
% matching that number. Can use it for setting date in draft
% footnote if desired. Not activated at this time.

\newcommand{\today}{\ifcase\month\or
  January\or February\or March\or April\or May\or June\or
  July\or August\or September\or October\or November\or December\fi
  \space\number\day, \number\year}

%  Hyphenation Library
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Hyphenation Library, add to this
%% list if desired

\hyphenation{
dem-o-graph-ics
mi-cro-ec-o-nom-ic
or-gan-i-za-tion
or-gan-i-za-tions
ra-tion-ale
sys-tem-at-i-cal-ly
}


%%%% Quote, Quotation, Extract
  %% \newenvironment produces a \begin{}..\end{} macro set.
  %% \newenvironment{<name of macro>}{<definition for begin macro>}
  %% {<definition for end macro>}

  %% For long quotation which runs more than one paragraph,
  %% uses list environment to indent text, supplies dummy
  %% item, \item[], since one item is required for every listing
  %% environment or you will get an error message.

  %% quotation indents new paragraphs, while quote does not.

\newenvironment{quotation}
               {\small
\list{}{\listparindent 1.5em%
                        \itemindent    \listparindent
                        \rightmargin   \leftmargin
                        \parsep        \z@ \@plus\p@}%
                \item[]}
               {\endlist}
\newenvironment{quote}
               {\small
\list{}{\rightmargin\leftmargin}%
                \item[]}
               {\endlist}

  %% If \begin{extract}...\end{extract} is used you will get the same
  %% results as \begin{quotation}...\end{quotation}

\let\extract\quotation
\let\endextract\endquotation

  %% <<== end ETC.: Month/year, Hyphenation Library, Quote, Quotation, Extract

%%%%%%%%%
% 11) End Article: Appendix, Glossary, Acronyms, Notation, Acknowledgments

% Appendix:
\newcounter{appendnum}

\newif\ifappendon
\newif\ifupperappend

\def\appendix{%
\def\@currentlabel{\Alph{section}:} %xx Doesn't do much.  Missing trailing space.  DC
\@addtoreset{equation}{section}
\@addtoreset{table}{section}
\@addtoreset{figure}{section}
%%
\renewcommand{\thesection}{Appendix \Alph{section}} %xx Redefined below (by orginal author, not DC).    DC
\renewcommand{\theequation}{\Alph{section}\arabic{equation}}
\renewcommand{\thefigure}{\Alph{section}\arabic{figure}}
\renewcommand{\thetable}{\Alph{section}\arabic{table}}
\global\appendontrue\goodbreak
\global\c@section=0
\global\c@equation=0
\def\thesection{Appendix \Alph{section}} %xx What puts the : in \ref.   Taken out now.  DC
\def\thesubsection{\Alph{section}\@arabic{\c@subsection}}
\def\thesubsubsection{\thesubsection\@arabic{\c@subsubsection}}
\def\thesubsubsubsection{\thesubsubsection\@arabic{\c@subsubsection}}
}
%%%%% end appendix

%%  Glossary
\def\glossary{\bgroup
\section*{Glossary}
\description
\def\term##1{\item[##1]}}
\def\endglossary{\enddescription\vskip12pt\egroup}
%%

%% Acronyms
\def\acronyms{\bgroup
\section*{Acronyms}
\description
\def\acro##1{\item[##1]}}
\def\endacronyms{\enddescription\vskip12pt\egroup}

%% Notation
\def\notation{\bgroup
\section*{Notation}
\description
\def\notation##1{\item[\boldmath ##1]}}
\def\endnotation{\enddescription\vskip12pt\egroup}

%% Acknowledgments
\def\acknowledgments{\vskip12pt\noindent{\bf
Acknowledgments\vrule depth 6pt
width0pt\relax}\\*\noindent\ignorespaces}

%%% <<=== end  Appendix, Glossary, Acronyms, Notation, Acknowledgments


%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% 12) %% Bibliography, References ===>>

%% Set bibliography style: This brings in agufull08.bst to format
%% bibliography when using BibTeX.
%\bibliographystyle{agufull08}
%
\bibliographystyle{apacite}

%% In case you want to enter bib entries without using bibtex
\def\references{\thebibliography{}\item[]}
\let\endreferences\endthebibliography

\def\@cite#1#2{{#1\if@tempswa , #2\fi}}

\def\@citex[#1]#2{%
  \let\@citea\@empty
  \@cite{\@for\@citeb:=#2\do
    {\@citea\def\@citea{,\penalty\@m\ }%
     \edef\@citeb{\expandafter\@firstofone\@citeb}%
     \if@filesw\immediate\write\@auxout{\string\citation{\@citeb}}\fi
     \@ifundefined{b@\@citeb}{\mbox{\reset@font\bfseries ?}%
       \G@refundefinedtrue
       \@latex@warning
         {Citation `\@citeb' on page \thepage \space undefined}}%
  %%
  %% This is changed from the default so that lengthy citations can
  %% be broken across lines
       {%\hbox{
\csname b@\@citeb\endcsname%}
}}}{#1}}

\newdimen\bibindent
\setlength\bibindent{1.5em}

\def\refname{References}
\newenvironment{thebibliography}[1]
     {\section*{\refname
        \@mkboth{\MakeUppercase\refname}{\MakeUppercase\refname}}%
      \list{\@biblabel{\@arabic\c@enumiv}}%
           {\settowidth\labelwidth{\@biblabel{#1}}%
            \leftmargin\labelwidth
            \advance\leftmargin\labelsep
            \@openbib@code
            \usecounter{enumiv}%
            \let\p@enumiv\@empty
            \renewcommand\theenumiv{\@arabic\c@enumiv}}%
      \sloppy
      \clubpenalty4000
      \@clubpenalty \clubpenalty
      \widowpenalty4000%
      \sfcode`\.\@m}
     {\def\@noitemerr
       {\@latex@warning{Empty `thebibliography' environment}}%
      \endlist}

\def\newblock{\hskip .11em\@plus.33em\@minus.07em}




% Formats bibliography, this .sty file needs to be entered here

 %
% When using NatBib, this sets brackets for citations:
%\renewcommand\NAT@open{(} \renewcommand\NAT@close{)}   %xx Parens by default, but not using anyways.  DC

\RequirePackage{apacite}
%\RequirePackage{natbib}
\let\cite\shortcite %xx So get et al. with three authors the first time.
%\let\citep\shortcite %xx A natbib command.
%\let\citet\shortcite %xx Ditto.
\let\citeA\shortciteA %xx Ditto.



%% end Bibliography, and References

%%%%%%%%%%%%%%%%%%%%%%%%%%xx Removed.  DC

%%% Track Changes
%%% Amy Hendrickson, Feb 2016
%
%\providecolor{trackcolor}{rgb}{1,0,0}
%\providecolor{explain}{rgb}{.5,0,.5}
%
%\newcount\refchangenumber
%
%\def\added{\@ifnextchar[{\xadded}{\yadded}}
%
%\long\def\xadded[#1]#2{%
%\ifdraft{\global\advance\refchangenumber by 1\relax%
%\ifnumlines
%\xdef\doit{\noexpand\linelabel{\the\refchangenumber}}\doit\else%
%\xdef\doit{\noexpand\label{\the\refchangenumber}{}{}{}}\doit\fi%
%\color{trackcolor}(Added: #2)}%%
%\expandafter\gdef\csname
%changenum\the\refchangenumber\endcsname{Added: [#1]
%\textcolor{trackcolor}{#2}, }\else#2\fi}
%
%\long\def\yadded#1{%
%\ifdraft{\global\advance\refchangenumber by 1\relax%
%\ifnumlines
%\xdef\doit{\noexpand\linelabel{\the\refchangenumber}}\doit\else%
%\xdef\doit{\noexpand\label{\the\refchangenumber}{}{}{}}\doit\fi%
%\color{trackcolor}(Added: #1)}%%
%\expandafter\gdef\csname changenum\the\refchangenumber\endcsname{Added:
%\textcolor{trackcolor}{#1}, }\else#1\fi}
%
%\def\deleted{\@ifnextchar[{\xdeleted}{\ydeleted}}
%
%\long\def\xdeleted[#1]#2{%
%\ifdraft{\global\advance\refchangenumber by 1\relax%
%\ifnumlines
%\xdef\doit{\noexpand\linelabel{\the\refchangenumber}}\doit\else%
%\xdef\doit{\noexpand\label{\the\refchangenumber}{}{}{}}\doit\fi%
%\color{trackcolor}(Deleted: \sout{#2})}%%
%\expandafter\gdef\csname
%changenum\the\refchangenumber\endcsname{Deleted: [#1]
%\textcolor{trackcolor}{#2}, }\else#2\fi}
%
%\long\def\ydeleted#1{
%\ifdraft
%\global\advance\refchangenumber by 1
%\ifnumlines\xdef\doit{\noexpand\linelabel{\the\refchangenumber}}\doit\else%
%\xdef\doit{\noexpand\label{\the\refchangenumber}}\doit\fi%
%{\color{trackcolor}(Deleted: \sout{#1})}%
%\expandafter\def\csname changenum\the\refchangenumber\endcsname{Deleted:
%{\color{trackcolor}\sout{#1}}, }\fi}
%
%\def\replaced{\@ifnextchar[{\xreplaced}{\yreplaced}}
%
%\long\def\xreplaced[#1]#2#3{%
%\ifdraft
%\global\advance\refchangenumber by 1
%\ifnumlines\xdef\doit{\noexpand\linelabel{\the\refchangenumber}}\doit\else%
%\xdef\doit{\noexpand\label{\the\refchangenumber}}\doit\fi%
%{\color{trackcolor}(Replaced: \sout{#2}}
%{\color{black}replaced with:} {\color{trackcolor} #3)}%
%\expandafter\gdef\csname
%changenum\the\refchangenumber\endcsname{Replaced: [#1]
%{\color{trackcolor}\sout{#2}} {\color{black} replaced with:}
%{\color{trackcolor}#3}, }\else#3\fi}
%
%\long\def\yreplaced#1#2{%
%\ifdraft
%\global\advance\refchangenumber by 1
%\ifnumlines\xdef\doit{\noexpand\linelabel{\the\refchangenumber}}\doit\else%
%\xdef\doit{\noexpand\label{\the\refchangenumber}}\doit\fi%
%{\color{trackcolor}(Replaced: \sout{#1}}
%{\color{black}replaced with:} {\color{trackcolor} #2)}%
%\expandafter\gdef\csname changenum\the\refchangenumber\endcsname{Replaced:
%{\color{trackcolor}\sout{#1}} {\color{black} replaced with:}
%{\color{trackcolor}#2}, }\else#2\fi}
%
%\global\@mparswitchfalse
%\def\explain{\@ifnextchar[{\xexplain}{\yexplain}}
%
%%%
%\def\xexplain[#1]#2{\ifdraft\marginpar{\noindent{\color{red}\llap{\boldmath$\leftarrow$}\draftfalse\normalsize
%\baselineskip=11pt\relax[#1] #2\vskip1sp}}\fi}
%
%\def\yexplain#1{\ifdraft\marginpar{\noindent{\color{red}\llap{\boldmath$\leftarrow$}\draftfalse\normalsize
%\baselineskip=11pt\relax#1\vskip1sp}}\fi}
%
%
%\newcount\listchangenum
%
%\def\listofchanges{
%\clearpage
%\ifdraft
%\ifnum\refchangenumber>0
%\ifnumlines\nolinenumbers\fi
%\vskip36pt
%\vtop{\hrule
%\noindent{\vrule height 9pt width0pt depth 6pt\large\bf List of Changes}
%\hrule
%\vskip18pt}
%\nobreak
%{\parskip=4pt \parindent-18pt \leftskip=18pt
%\loop
%\vskip-1pt\relax
%\global\advance\listchangenum by 1\relax
%\expandafter\ifx\csname changenum\the\listchangenum\endcsname\relax
%\else
%\csname changenum\the\listchangenum\endcsname\ on page
%\pageref{\the\listchangenum}%
%\ifnumlines
%\setbox0=\hbox{\lineref{\the\listchangenum}}%
%\ifdim\wd0>20pt%
%\else%
%, line\
%\lineref{\the\listchangenum}%
%\fi\fi.
%\repeat}
%\fi\fi
%\thispagestyle{empty}
%}
%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% 14) Supporting Information
\def\supportinginfo#1{\newpage
{\large\bf\noindent Supporting  Information for\vskip-6pt\noindent``#1''}
\vskip12pt}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%% Start page numbering, formatting

\pagenumbering{arabic}
\widowpenalty=10000
\clubpenalty=10000
\ifdraft
\RaggedRight
\fi
\endinput














