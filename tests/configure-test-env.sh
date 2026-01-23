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

# Check Node.js and npm ---
echo ">>>> Configuring npm for MECA testing environment"
node_exists=$(command -v node)
npm_exists=$(command -v npm)
if [ -z $node_exists ]
then
  echo "No node found - will skip any tests that require npm (e.g. JATS / MECA validation)"
elif [ -z $npm_exists ]
then
  echo "No npm found - npm is required but node is present"
else
  # Check Node.js version
  node_version=$(node -v | sed 's/v//' | cut -d. -f1)
  echo "Node.js version: $(node -v)"
  if [ "$node_version" -lt 18 ]; then
    echo "Warning: Node.js version $node_version is older than recommended (18+)"
    echo "Some tests may fail. Consider upgrading Node.js."
  fi
  echo "Setting up npm testing environment"
  npm install -g meca
fi

# Setup Playwright for browser testing ---
echo ">>>> Configuring Playwright for integration tests"
if [ -n "$npm_exists" ]
then
  echo "Installing Playwright dependencies..."
  pushd integration/playwright > /dev/null
  npm install
  # Install multiplex server dependencies
  echo "Installing multiplex server dependencies..."
  pushd multiplex-server > /dev/null
  npm install
  popd > /dev/null
  # Try to install browsers with --with-deps (may require sudo on Linux/macOS)
  echo "Installing Playwright browsers..."
  npx playwright install --with-deps || echo "Note: Browser installation may require sudo. Run manually: npx playwright install --with-deps"
  popd > /dev/null
else
  echo "Skipping Playwright setup (npm not found)"
fi

# Check pdftotext ---
echo ">>>> Do you have pdftotext installed (from poppler) ?"
pdftotext_exists=$(command -v pdftotext)
if [ -z $pdftotext_exists ]
then
  echo "No pdftotext found - Some tests will require it, so you may want to install it."
fi

# Check rsvg-convert for SVG conversion ---
echo ">>>> Do you have rsvg-convert installed (from librsvg) ?"
rsvg_exists=$(command -v rsvg-convert)
if [ -z $rsvg_exists ]
then
  echo "No rsvg-convert found - Some PDF tests with SVG images will be skipped."
  echo "Install librsvg to enable SVG to PDF conversion tests:"
  echo "  - Ubuntu/Debian: sudo apt-get install librsvg2-bin"
  echo "  - macOS: brew install librsvg"
  echo "  - Windows: scoop install librsvg"
fi