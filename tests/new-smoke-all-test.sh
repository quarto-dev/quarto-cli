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
    latex:
      ensureFileRegexMatches:
        - []
        - []
    pdf:
      noErrors: default
      fileExists: 
        supportPath: mediabag/lter_penguins.png
    docx:
      ensureDocxRegexMatches:
        - []
        - []
    pptx:
      ensurePptxRegexMatches:
        - []
        - []
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