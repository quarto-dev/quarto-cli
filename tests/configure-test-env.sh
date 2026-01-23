# Check R environment ---

echo ">>>> Configuring R environment"
r_exists=$(command -v Rscript)

if [ -z $r_exists ] 
then 
  echo "No Rscript found in PATH - Check your PATH or install R and add to PATH."
else
  echo "   > Restoring renv project"
  Rscript -e 'renv::restore()'
  echo "   > Installing dev knitr and rmarkdown"
  Rscript -e "install.packages('rmarkdown', repos = c('https://rstudio.r-universe.dev', getOption('repos')))"
  Rscript -e "install.packages('knitr', repos = c('https://yihui.r-universe.dev', getOption('repos')))"
fi


# Check python test environment ---
echo ">>>> Configuring Python environment"
# Prefer uv is available
uv_exist=$(command -v uv)
if [ -z $uv_exist ]
then
  echo "No uv found - Install uv please: https://docs.astral.sh/uv/getting-started/installation/."
  echo "Using 'uv' is the prefered way. You can still use python and create a .venv in the project."
else
  echo "Setting up python environnement with uv"
  # create or sync the virtual env in the project
  uv sync --frozen
fi

# Check Julia environment ---
echo ">>>> Configuring Julia environment"
julia_exists=$(command -v julia)
if [ -z $julia_exists ] 
then 
  echo "No julia found in PATH - Check your PATH or install julia and add to PATH."
else
  echo "Setting up Julia environment"
  if [ -z $uv_exist ]
  then
    uv run --frozen julia --color=yes --project=. -e 'import Pkg; Pkg.instantiate(); Pkg.build("IJulia"); Pkg.precompile()'
  else
    julia --color=yes --project=. -e 'import Pkg; Pkg.instantiate(); Pkg.build("IJulia"); Pkg.precompile()'
  fi
fi

# Update tinytex
echo ">>>> Configuring TinyTeX environment"
if [[ -z $GH_TOKEN && -n $(command -v gh) ]]
then 
  echo "Setting GH_TOKEN env var for Github Download."
  export GH_TOKEN=$(gh auth token)
fi

if [ -n $(command -v quarto) ]
then
  quarto install tinytex
fi

# Check for veraPDF (and Java) as the tool is required for PDF standard validation tests
echo ">>>> Checking Java for veraPDF"
java_exists=$(command -v java)
if [ -z $java_exists ]
then
  echo "No java found in PATH - veraPDF requires Java to be installed."
  echo "Install Java and add to PATH if you need PDF standard validation tests."
  echo "See: https://www.java.com/en/download/"
else
  echo "Java found: $(java -version 2>&1 | head -n 1)"
fi

# Install veraPDF for PDF standard validation ---
echo ">>>> Installing veraPDF for PDF standard validation"
if [ -n $(command -v quarto) ]
then
  if [ -n "$java_exists" ]
  then
    quarto install verapdf
  else
    echo "Skipping veraPDF installation (Java not found)"
  fi
else
  echo "Skipping veraPDF installation (quarto not found)"
fi

# Get npm in place
echo ">>>> Configuring npm for MECA testing environment"
npm_exists=$(command -v npm)
if [ -z $npm_exists ]
then
  echo "No npm found - will skip any tests that require npm (e.g. JATS / MECA validation)"
else
  echo "Setting up npm testing environment"
  npm install -g meca
fi

# Get npm in place
echo ">>>> Do you have pdftotext installed (from poppler) ?"
pdftotext_exists=$(command -v pdftotext)
if [ -z $pdftotext_exists ]
then
  echo "No pdftotext found - Some tests will require it, so you may want to install it."
fi