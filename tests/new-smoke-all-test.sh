smokeAllFolder=./docs/smoke-all

cwd=$(dirname $0)

cd $smokeAllFolder

year=$(date +"%Y")
month=$(date +"%m")
day=$(date +"%d")

CheckCreateAndEnter() {
  [[ ! -d "$1" ]] && mkdir -p $1
  cd $1
}

CheckCreateAndEnter $year
CheckCreateAndEnter $month
CheckCreateAndEnter $day

file=$1

YAML=$(cat << EOF
---
format: html
_quarto:
  tests:
    html:
      ensureHtmlElements:
        - []
        - []
      ensureFileRegexMatches:
        - [] 
        - []
    revealjs:
      ensureHtmlElements:
        - []
        - []
      ensureFileRegexMatches:
        - [] 
        - []
    latex:
      ensureFileRegexMatches:
        - []
        - []
    pdf:
      noErrors: default
      fileExists: 
        supportPath: mediabag/lter_penguins.png
      ensureLatexFileRegexMatches:
        - []
        - []
    typst:
      ensureFileRegexMatches:
        - []
        - []
      ensureTypstFileRegexMatches:
        - []
        - []
    docx:
      ensureDocxRegexMatches:
        - []
        - []
      ensureDocxXPath:
        - []
        - []
    pptx:
      ensurePptxRegexMatches:
        - []
        - []
      ensurePptxXPath:
      - 
        - 2
        - []
        - []
      ensurePptxLayout:
        - 
          - 2
          - "Title and Content"
    asciidoc: default
---
EOF
)

if [ ! -f "$file" ]; then
  echo "$YAML" > $file
fi

if [[ -z $(command -v code) ]]; then
  vscode=true
fi

$vscode && code $file

cd $cwd