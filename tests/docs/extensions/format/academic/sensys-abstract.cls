\NeedsTeXFormat{LaTeX2e}[1995/12/01]
\ProvidesClass{sensys-abstract}
              [2002/06/21 v1.4
               Document Class]

%\ProvidesClass{sigplan-proc-varsize}

% This file has a long and troubled history:

% The original (LaTeX 2.09) document style for this purpose was by
% Olin Shivers (1991).
% Ken Traub and Kevin Theobald added some new features in 1993.
% Back then, it was called acmconf.sty.
% Mike Sperber converted it to an LaTeX2e document class called
% acmconf.cls in 1994.
% From 1999 on, G.K.M. Tobin and Gerry Murray took Traub's style,
% and modified it extensively.  
% This version was called acm_proc_article-sp.cls, V2.01SP
% In 2002, Mike Sperber <sperber@informatik.uni-tuebingen.de>
% wrote this file, intended to be compatible with
% acm_proc_article-sp.cls V2.01SP, but with layout parameters
% matching ACM's guidelines at
% http://www.acm.org/sig_volunteer_info/conference_manual/6-5PROC.HTM
% It contains code from all previous versions, but is much shortened
% to avoid redundancies with the standard LaTeX2e styles.

% Here are the main changes to acm_proc_article-sp.cls, as far as the
% interface is concerned:

% It doesn't load any of the utility packages, specifically, it
% doesn't load epsfig, amssymb, amsmath, and amsfont.

% It depends on David Carlisle's pslatex package, found on any CTAN
% host, say at
% ftp://ftp.dante.de/tex-archive/macros/latex/contrib/supported/pslatex/

% There's once again a preprint document-class option.  (Just like in
% Olin's original style file.)  Unlike Olin's style, it has no
% influence whether the \toappear information is printed.  It only
% switches off explicitly doing \pagestyle{empty}, allowing you to
% have page numbers, for example.

% There's also a nocopyrightspace document-class option which prevents
% the reservation of space at the bottom left of the title page for
% the copyright notice.

% It conforms to LaTeX2e's NFSS2, so there aren't any silly
% font-changing commands specific to section headers, like \secit{}
% etc.

%
% hacked 31-Mar-05 by johnh@isi.edu to 10pt-ness.
%   (renamed sigplan-proc-varsize.cls)
% original from http://www.cs.indiana.edu/icfp04/sigplan-proc.cls
% options:
%   9pt  or  10pt
%   indentedparagraphs  or  noindentedparagraphs
%

% hacked 18-Aug-07 by adam@sics.se to reduce space for copyright
% notice and to remove the word ``copyright'' on the front page for
% ACM SenSys poster and demo abstracts for which copyright
% is retained by the author. Renamed to sensys-abstract.cls

\DeclareOption{a5paper}
    {\ClassError{proc}{Option `a5paper' not supported}{}}
\DeclareOption{b5paper}
    {\ClassError{proc}{Option `b5paper' not supported}{}}
% johnh
%\DeclareOption{9pt}
%    {\ClassError{proc}{Option `9pt' not supported}{}}
%\DeclareOption{10pt}
%    {\ClassError{proc}{Option `10pt' not supported}{}}
\newif\ifissizeixpt \issizeixpttrue % default
\newif\ifissizexpt \issizexptfalse 
\DeclareOption{9pt}{\issizeixpttrue \issizexptfalse }
\DeclareOption{10pt}{\issizexpttrue \issizeixptfalse }
\newif\ifindentedparagraphs \indentedparagraphstrue
\DeclareOption{indentedparagraphs}{\indentedparagraphstrue }
\DeclareOption{noindentedparagraphs}{\indentedparagraphsfalse }
\DeclareOption{12pt}
    {\ClassError{proc}{Option `12pt' not supported}{}}
\DeclareOption{onecolumn}%
    {\ClassError{proc}{Option `onecolumn' not supported}{}}
\DeclareOption{titlepage}%
    {\ClassError{proc}{Option `titlepage' not supported}{}}
\newif\ifpreprint
\preprintfalse
\DeclareOption{preprint}{\preprinttrue}
\newif\ifnocopyrightspace
\nocopyrightspacefalse
\DeclareOption{nocopyrightspace}{\nocopyrightspacetrue}
\PassOptionsToClass{twocolumn}{article}
\DeclareOption*{\PassOptionsToClass{\CurrentOption}{article}}
\ProcessOptions
\LoadClass{article}

\def\tableofcontents{\@latexerr{\tableofcontents: Tables of contents are not
  allowed in the `sigplan-proc-varsize' document style.}\@eha}

\RequirePackage{pslatex}

% Page parameters
% ===============

\setlength{\marginparwidth}{0pt}
\setlength{\marginparsep}{11pt}
\setlength{\marginparpush}{5pt}
\setlength{\topmargin}{0pt}
\addtolength{\topmargin}{-\headsep}
\addtolength{\topmargin}{-\headheight}

\setlength{\textheight}{9in}

\setlength{\textwidth}{7in}
\setlength{\columnsep}{.33in}
\setlength{\hoffset}{0pt}
% 1 inch gets added by LaTeX
\setlength{\evensidemargin}{-0.25in}
\setlength{\oddsidemargin}{-0.25in}

% Utility macro from original Sheridan class

\newcommand{\balancecolumns}{%
  \vfill\eject
  \global\@colht=\textheight
  \global\ht\@cclv=\textheight}

% johnh hack for use indented paragraphs rather than blank lines
\ifindentedparagraphs
  % xxx: bug: this doesn't correctly do \noindent at the beginning
  % of \section (etc.).  It's not obvious how article.cls does that! -johnh
  \setlength{\parskip}{0pt plus 1pt}
  \setlength{\parindent}{12pt}
\else
  \setlength{\parskip}{10pt}
  \setlength{\parindent}{0pt}
\fi
\setlength{\topsep}{-0.5ex}
\setlength{\parsep}{1ex}
\setlength{\itemsep}{0pt}

\setlength{\footnotesep}{5.6pt}
\setlength{\skip\footins}{8.1pt plus 4pt minus 2pt}

% Page Style
% ==========

\ifpreprint
  \if@twoside
      \def\ps@headings{
          \def\@oddfoot{}
          \def\@evenfoot{}
          \def\@evenhead{\textnormal{\thepage}\hfil \textnormal{\textsl{\leftmark}}}
          \def\@oddhead{\hbox{}\textnormal{\textsl{\rightmark}}
                        \hfil
                        \textnormal\textrm{\thepage}}
          \def\sectionmark##1{\markboth {\uppercase{\ifnum\c@secnumdepth>\z@
                              \thesection \hskip 1em\relax \fi ##1}}{}}
          \def\subsectionmark##1
              {\markright {\ifnum \c@secnumdepth >\@ne \thesubsection
                    \hskip 1em\relax \fi ##1}}}

  \else
      \def\ps@headings{
          \def\@oddfoot{}
          \def\@evenfoot{}
          \def\@oddhead{\hbox{}\textnormal{\textsl{\rightmark}}
                        \hfil
                        \textnormal{\textrm{\thepage}}}
          \def\sectionmark##1{\markright{\uppercase{\ifnum \c@secnumdepth >\z@
                                         \thesection\hskip 1em\relax \fi ##1}}}}
  \fi

  \def\ps@myheadings{\def\@oddhead{\hbox{}\textnormal{\textsl{\rightmark}}
                                   \hfil
                                   \textnormal{\textrm{\thepage}}}%
                     \def \@evenhead{\textnormal{\textrm{\thepage}}
                                     \hfil
                                     \textnormal{\textsl{\leftmark}}\hbox{}}%
                     \def\@oddfoot{}%
                     \def\@evenfoot{}%
                     \def\sectionmark##1{}%
                     \def\subsectionmark##1{}}

\else % preprint off -- all \pagestyle commands ==> \pagestyle{empty}.
  \let\ps@plain\ps@empty
  \let\ps@headings\ps@empty
  \let\ps@myheadings\ps@empty
  \ps@empty
\fi

% Text Body
% =========

% We need to redefine those because the LaTeX versions
% set the various \*sep's to fixed values.

\def\@listi{\leftmargin\leftmargini}
\let\@listI=\@listi
\def\@listii {\leftmargin\leftmarginii
              \labelwidth\leftmarginii
              \advance\labelwidth-\labelsep}
\def\@listiii{\leftmargin\leftmarginiii
              \labelwidth\leftmarginiii
              \advance\labelwidth-\labelsep}
\def\@listiv {\leftmargin\leftmarginiv
              \labelwidth\leftmarginiv
              \advance\labelwidth-\labelsep}
\def\@listv  {\leftmargin\leftmarginv
              \labelwidth\leftmarginv
              \advance\labelwidth-\labelsep}
\def\@listvi {\leftmargin\leftmarginvi
              \labelwidth\leftmarginvi
              \advance\labelwidth-\labelsep}

% Fonts and Sizes
% ===============

\renewcommand{\normalsize}{%
% johnh hack to 10pt
  \ifissizeixpt
    \@setfontsize\normalsize\@ixpt{10\p@}
  \else
    \ifissizexpt
      \@setfontsize\normalsize\@xpt{11\p@}
    \else
      \typeout{error, no point size specified}
    \fi
  \fi
  \abovedisplayskip 6\p@ \@plus2\p@ \@minus\p@
  \belowdisplayskip \abovedisplayskip
  \abovedisplayshortskip 6\p@ \@minus 3\p@
  \belowdisplayshortskip 6\p@ \@minus 3\p@
}

\renewcommand{\scriptsize}{\@setfontsize\scriptsize\@viipt{8\p@}}
\renewcommand{\tiny}{\@setfontsize\tiny\@vpt{6\p@}}
\renewcommand{\large}{\@setfontsize\large\@xiipt{14\p@}}
\renewcommand{\Large}{\@setfontsize\Large\@xivpt{18\p@}}
\renewcommand{\LARGE}{\@setfontsize\LARGE\@xviipt{20\p@}}
\renewcommand{\huge}{\@setfontsize\huge\@xxpt{25\p@}}
\renewcommand{\Huge}{\@setfontsize\Huge\@xxvpt{30\p@}}
\def\small{\@setsize\small{9pt}\viiipt\@viiipt
\abovedisplayskip 7.6pt plus 3pt minus 4pt%
\belowdisplayskip \abovedisplayskip
\abovedisplayshortskip \z@ plus2pt%
\belowdisplayshortskip 3.6pt plus2pt minus 2pt}

\def\footnotesize{\@setsize\footnotesize{10pt}\ixpt\@ixpt
\abovedisplayskip 6.4pt plus 2pt minus 4pt%
\belowdisplayskip \abovedisplayskip
\abovedisplayshortskip \z@ plus 1pt%
\belowdisplayshortskip 2.7pt plus 1pt minus 2pt}

% Section Headers
% ===============

\setcounter{secnumdepth}{4}

\renewcommand{\section}{\@startsection%
  {section}%
  {1}%
  {\z@}%
  {2\p@ \@plus 4\p@}%
  {1pt}%
  {\normalfont\fontsize{12\p@}{12\p@}\bfseries\selectfont}%
}

\renewcommand{\subsection}{\@startsection%
  {subsection}%
  {2}%
  {\z@}%
  {1\p@ \@plus 4\p@}%
  {0.1pt}%
  {\normalfont\fontsize{12\p@}{12\p@}\bfseries\selectfont}%
}

\renewcommand{\subsubsection}{\@startsection%
  {subsubsection}%
  {3}%
  {\z@}%
  {1\p@ \@plus 4\p@}%
  {0.1pt}%
  {\normalfont\fontsize{11\p@}{11\p@}\itshape\selectfont}%
}

\renewcommand{\paragraph}{\@startsection%
  {paragraph}%
  {4}%
  {\z@}%
  {1\p@ \@plus 4\p@}%
  {0.1pt}%
  {\normalfont\fontsize{11\p@}{11\p@}\itshape\selectfont}%
}

% Captions
% ========

\long\def\@makecaption#1#2{
   \setbox\@tempboxa\hbox{\textbf{#1. #2}}
   \ifdim \wd\@tempboxa >\hsize % IF longer than one line:
       \textbf{#1. #2}\par               %   THEN set as ordinary paragraph.
     \else                      %   ELSE  center.
       \hbox to\hsize{\hfil\box\@tempboxa\hfil}\par
   \fi}


% Title Page
% ==========

\newcount\aucount
\newcount\originalaucount
\newdimen\auwidth
\auwidth=\textwidth
\newdimen\auskip
\newcount\auskipcount
\newdimen\auskip
\global\auskip=1pc
\newdimen\allauboxes
\allauboxes=\auwidth
\newtoks\addauthors
\newcount\addauflag
\global\addauflag=0 %Haven't shown additional authors yet

\newtoks\subtitletext
\gdef\subtitle#1{\subtitletext={#1}}

\gdef\additionalauthors#1{\addauthors={#1}}

\gdef\numberofauthors#1{\global\aucount=#1
  \ifnum\aucount>3\global\originalaucount=\aucount \global\aucount=3\fi
  \global\auskipcount=\aucount\global\advance\auskipcount by 1
  \global\multiply\auskipcount by 2
  \global\multiply\auskip by \auskipcount
  \global\advance\auwidth by -\auskip
  \global\divide\auwidth by \aucount}

% \and was modified to count the number of authors.  GKMT 12 Aug 1999
\def\alignauthor{%                  % \begin{tabular}
\end{tabular}%
  \begin{tabular}[t]{p{\auwidth}}\centering}%

\newcommand{\email}[1]{{\vspace{4pt}\sffamily\fontsize{12\p@}{12\p@}\selectfont #1}}

\newcommand{\affaddr}{\normalfont\sffamily\fontsize{10\p@}{10\p@}\selectfont}

\def\addauthorsection{\ifnum\originalaucount>3
    \section{Additional Authors}\the\addauthors
  \fi}

\newtoks\titleboxnotes
\newcount\titleboxnoteflag

\def\maketitle{\par
 \begingroup
   \def\thefootnote{\fnsymbol{footnote}}
   \def\@makefnmark{\hbox
       to 0pt{$^{\@thefnmark}$\hss}}
     \twocolumn[\@maketitle]
\@thanks
 \endgroup
 \setcounter{footnote}{0}
 \let\maketitle\relax
 \let\@maketitle\relax
 \gdef\@thanks{}\gdef\@author{}\gdef\@title{}\gdef\@subtitle{}\let\thanks\relax
 \ifnocopyrightspace\else\@copyrightspace\fi
 }

% make aubox hsize/number of authors up to 3, less gutter
% then showbox gutter showbox gutter showbox -- GKMT Aug 99
\newbox\@acmtitlebox
\def\@maketitle{\newpage
 \null
 \setbox\@acmtitlebox\vbox{%
\baselineskip 20pt
\vskip 2em                   % Vertical space above title.
   \begin{center}
    {\normalfont\sffamily\bfseries\fontsize{18\p@}{18\p@}\selectfont
     \@title\par}       % Title set in 18pt Helvetica (Arial) bold size.
    \vskip 1.5em                % Vertical space after title.
    {\normalfont\sffamily\fontsize{14\p@}{14\p@}\selectfont
      \the\subtitletext\par}\vskip 1.25em%\fi
    { \normalfont\sffamily\fontsize{12\p@}{12\p@}\selectfont
      \lineskip .5em             % tabular environment
      \begin{tabular}[t]{c}
        \@author
      \end{tabular}
      \par}
    \vskip 1.5em               % Vertical space after author.
   \end{center}}
 \dimen0=\ht\@acmtitlebox
 \advance\dimen0 by -12.75pc\relax % Increased space for title box -- KBT
 \unvbox\@acmtitlebox
 \ifdim\dimen0<0.0pt\relax\vskip-\dimen0\fi}

\long\def\@maketntext#1{\noindent #1}

\long\def\@maketitlenotetext#1#2{\noindent
            \hbox to 1.8em{\hss$^{#1}$}#2}

\newcount\titlenotecount
\global\titlenotecount=0
\newtoks\tntoks
\newtoks\tntokstwo
\newtoks\tntoksthree
\newtoks\tntoksfour
\newtoks\tntoksfive

\def\titlenote{\@ifnextchar[\@xtitlenote{\stepcounter\@mpfn
\global\advance\titlenotecount by 1
\ifnum\titlenotecount=1
    \raisebox{9pt}{$\ast$}
\fi
\ifnum\titlenotecount=2
    \raisebox{9pt}{$\dagger$}
\fi
\ifnum\titlenotecount=3
    \raisebox{9pt}{$\ddagger$}
\fi
\ifnum\titlenotecount=4
\raisebox{9pt}{$\S$}
\fi
\ifnum\titlenotecount=5
\raisebox{9pt}{$\P$}
\fi
         \@titlenotetext
}}

\long\def\@titlenotetext#1{\insert\footins{%
\ifnum\titlenotecount=1\global\tntoks={#1}\fi
\ifnum\titlenotecount=2\global\tntokstwo={#1}\fi
\ifnum\titlenotecount=3\global\tntoksthree={#1}\fi
\ifnum\titlenotecount=4\global\tntoksfour={#1}\fi
\ifnum\titlenotecount=5\global\tntoksfive={#1}\fi
    \reset@font\footnotesize
    \interlinepenalty\interfootnotelinepenalty
    \splittopskip\footnotesep
    \splitmaxdepth \dp\strutbox \floatingpenalty \@MM
    \hsize\columnwidth \@parboxrestore
    \protected@edef\@currentlabel{%
    }%
    \color@begingroup
   \color@endgroup}}

\renewenvironment{abstract}{
\ifnum\titlenotecount>0 % was =1
    \insert\footins{%
    \reset@font\footnotesize
        \interlinepenalty\interfootnotelinepenalty
        \splittopskip\footnotesep
        \splitmaxdepth \dp\strutbox \floatingpenalty \@MM
        \hsize\columnwidth \@parboxrestore
        \protected@edef\@currentlabel{%
        }%
        \color@begingroup
\ifnum\titlenotecount=1
      \@maketntext{%
         \raisebox{4pt}{$\ast$}\rule\z@\footnotesep\ignorespaces\the\tntoks\@finalstrut\strutbox}%
\fi
\ifnum\titlenotecount=2
      \@maketntext{%
      \raisebox{4pt}{$\ast$}\rule\z@\footnotesep\ignorespaces\the\tntoks\par\@finalstrut\strutbox}%
\@maketntext{%
         \raisebox{4pt}{$\dagger$}\rule\z@\footnotesep\ignorespaces\the\tntokstwo\@finalstrut\strutbox}%
\fi
\ifnum\titlenotecount=3
      \@maketntext{%
         \raisebox{4pt}{$\ast$}\rule\z@\footnotesep\ignorespaces\the\tntoks\par\@finalstrut\strutbox}%
\@maketntext{%
         \raisebox{4pt}{$\dagger$}\rule\z@\footnotesep\ignorespaces\the\tntokstwo\par\@finalstrut\strutbox}%
\@maketntext{%
         \raisebox{4pt}{$\ddagger$}\rule\z@\footnotesep\ignorespaces\the\tntoksthree\@finalstrut\strutbox}%
\fi
\ifnum\titlenotecount=4
      \@maketntext{%
         \raisebox{4pt}{$\ast$}\rule\z@\footnotesep\ignorespaces\the\tntoks\par\@finalstrut\strutbox}%
\@maketntext{%
         \raisebox{4pt}{$\dagger$}\rule\z@\footnotesep\ignorespaces\the\tntokstwo\par\@finalstrut\strutbox}%
\@maketntext{%
         \raisebox{4pt}{$\ddagger$}\rule\z@\footnotesep\ignorespaces\the\tntoksthree\par\@finalstrut\strutbox}%
\@maketntext{%
         \raisebox{4pt}{$\S$}\rule\z@\footnotesep\ignorespaces\the\tntoksfour\@finalstrut\strutbox}%
\fi
\ifnum\titlenotecount=5
      \@maketntext{%
         \raisebox{4pt}{$\ast$}\rule\z@\footnotesep\ignorespaces\the\tntoks\par\@finalstrut\strutbox}%
\@maketntext{%
         \raisebox{4pt}{$\dagger$}\rule\z@\footnotesep\ignorespaces\the\tntokstwo\par\@finalstrut\strutbox}%
\@maketntext{%
         \raisebox{4pt}{$\ddagger$}\rule\z@\footnotesep\ignorespaces\the\tntoksthree\par\@finalstrut\strutbox}%
\@maketntext{%
         \raisebox{4pt}{$\S$}\rule\z@\footnotesep\ignorespaces\the\tntoksfour\par\@finalstrut\strutbox}%
\@maketntext{%
         \raisebox{4pt}{$\P$}\rule\z@\footnotesep\ignorespaces\the\tntoksfive\@finalstrut\strutbox}%
\fi
   \color@endgroup}
\fi
\setcounter{footnote}{0}
\section*{Abstract}\normalsize
}{}

\newcommand{\keywords}{\section*{Keywords}}

\newcommand{\terms}{\section*{General Terms}}

\newcount\catcount
\global\catcount=1

\newcommand{\category}[3]{%
  \ifnum\catcount=1
  \section*{Categories and Subject Descriptors}
  \advance\catcount by 1\else{\unskip; }\fi
  \@ifnextchar [{\@category{#1}{#2}{#3}}{\@category{#1}{#2}{#3}[]}%
}

\def\@category#1#2#3[#4]{%
    \begingroup
        \let\and\relax
            #1 [\textbf{#2}]%
            \if!#4!%
                \if!#3!\else : #3\fi
            \else
                :\space
                \if!#3!\else #3\kern\z@---\hskip\z@\fi
                \textit{#4}%
            \fi
    \endgroup
}

% Copyright space on title page
% =============================

%%% This section (written by KBT) handles the 1'' box in the lower left
%%% corner of the left column of the first page by creating a picture,
%%% and inserting the predefined string at the bottom (with a negative
%%% displacement to offset the space allocated for a non-existent
%%% caption).
%%%

\newtoks\copyrightnotice
\def\ftype@copyrightbox{8}
\def\@copyrightspace{
  \@float{copyrightbox}[b]
  \begin{center}
    \setlength{\unitlength}{1in}
    \begin{picture}(3.33,0.25) % Space for copyright notice
      \put(0,0){\normalfont\fontsize{8\p@}{8\p@}\selectfont%
                {\@toappear}}
    \end{picture}
  \end{center}
  \end@float}
\def\@toappear{} % Default setting blank - commands below change this.
\long\def\toappear#1{\def\@toappear{\parbox[b]{20pc}{\baselineskip 9pt#1}}}
\def\toappearbox#1{\def\@toappear{\raisebox{5pt}{\framebox[20pc]{\parbox[b]{19pc}{#1}}}}}

\def\conferenceinfo#1#2{\gdef\@conferencename{#1}\gdef\@conferenceinfo{#2}}
\def\@conferencename{}
\def\@conferenceinfo{}

\def\CopyrightYear#1{\gdef\@CopyrightYear{#1}}
\def\@CopyrightYear{}
\def\@yourmail{}
\def\crdata#1{\gdef\@crdata{#1}}
\def\@crdata{}
\def\permission#1{\gdef\@permission{#1}}
\def\@permission{Permission to make digital or hard copies of all or
  part of this work for personal or classroom use is granted without
  fee provided that copies are not made or distributed for profit or
  commercial advantage and that copies bear this notice and the full
  citation on the first page.  To copy otherwise, to republish, to
  post on servers or to redistribute to lists, requires prior specific
  permission and/or a fee.}
\def\crdata#1{\gdef\@crdata{#1}}
\def\@crdata{}

\def\@copyrightinfo{%
  \ifx\@CopyrightYear\@empty
  \else
  ACM \@crdata\ 
  \fi}

\toappear{\scriptsize\@permission\par
\textsl{\@conferencename} \@conferenceinfo\par\@copyrightinfo}


% Theorems
% ========

\def\@begintheorem#1#2{%
    \trivlist
    \item[\hskip\labelsep\textsc{#1\hskip 5\p@\relax#2.}]
    \itshape\selectfont
}
\def\@opargbegintheorem#1#2#3{%
    \trivlist
    \item[%
        \hskip\labelsep
        \textsc{#1\ #2\             % This mod by Gerry to enumerate corollaries
   \setbox\@tempboxa\hbox{(#3)}  % and bracket the 'corollary title'
        \ifdim \wd\@tempboxa>\z@ % and retain the correct numbering of e.g. theorems
            \hskip 5\p@\relax    % if they occur 'around' said corollaries.
            \box\@tempboxa       % Gerry - Nov. 1999.
        \fi.}%
    ]
    \itshape\selectfont
}
\newif\if@qeded
\global\@qededfalse
\def\proof{%
    \global\@qededfalse
    \@ifnextchar[{\@xproof}{\@proof}%
}

\def\endproof{%
    \if@qeded\else\qed\fi
    \endtrivlist
}
\def\@proof{%
    \trivlist
    \item[\hskip\labelsep\textsc{Proof.}]
    \ignorespaces
}
\def\@xproof[#1]{%
    \trivlist
    \item[\hskip\labelsep\textsc{Proof #1.}]%
    \ignorespaces
}
\def\qed{%
    \unskip
    \kern 10\p@
    \begingroup
        \unitlength\p@
        \linethickness{.4\p@}%
        \framebox(6,6){}%
    \endgroup
    \global\@qededtrue
}

\def\newdef#1#2{%
    \expandafter\@ifdefinable\csname #1\endcsname
        {\@definecounter{#1}%
         \expandafter\xdef\csname the#1\endcsname{\@thmcounter{#1}}%
         \global\@namedef{#1}{\@defthm{#1}{#2}}%
         \global\@namedef{end#1}{\@endtheorem}%
    }%
}
\def\@defthm#1#2{%
    \refstepcounter{#1}%
    \@ifnextchar[{\@ydefthm{#1}{#2}}{\@xdefthm{#1}{#2}}%
}
\def\@xdefthm#1#2{%
    \@begindef{#2}{\csname the#1\endcsname}%
    \ignorespaces
}
\def\@ydefthm#1#2[#3]{%
    \trivlist
    \item[%
        \hskip\labelsep
        \itshape{#2%
         \savebox\@tempboxa{#3}%
         \ifdim \wd\@tempboxa>\z@
            \ \box\@tempboxa
         \fi.%
        }]%
    \ignorespaces
}
\def\@begindef#1#2{%
    \trivlist
    \item[\hskip\labelsep\textit{#1\ #2.}]%
}
\def\theequation{\arabic{equation}}

% Bibliography
% ============

% This is identical to the code in article.cls except for the first
% line and \section instead of \section*.

\renewenvironment{thebibliography}[1]
     {\ifnum\addauflag=0\addauthorsection\global\addauflag=1\fi
      \section{\refname
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

\endinput
%%
%% End of file `sigplan-proc-varsize.cls'.