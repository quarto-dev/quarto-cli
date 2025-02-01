$smokeAllFolder = "./docs/smoke-all"

$cwd = (Get-Location).Path

cd $smokeAllFolder

[string]$year = (Get-Date).ToString("yyyy")
[string]$month = (Get-Date).ToString("MM")
[string]$day = (Get-Date).ToString("dd")

function CheckCreateAndEnter([string]$folder) {
  If (-Not (Test-Path -Path $folder)) {
    $null = mkdir $folder
  }
  cd $folder
}

CheckCreateAndEnter($year)
CheckCreateAndEnter($month)
CheckCreateAndEnter($day)

$file = $args[0]

$YAML = @"
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
"@

If (-Not (Test-Path -Path $file)) {
  $null = New-Item -Path $file
  $YAML | Out-File -FilePath $file
} 

try { $null = gcm code -ea stop; $vscode=$true } catch { }

If ($vscode) {
  code $file
} 

cd $cwd

Exit $LASTEXITCODE