# Check R environment ---

echo ">>>> Configuring R environment"
r_exists=$(command -v Rscript)

if [ -z $r_exists ] 
then 
  echo "No Rscript found in PATH - Check your PATH or install R and add to PATH."
else
  Rscript -e 'renv::restore()'
fi


# Check python test environment ---
echo ">>>> Configuring Python environment"
python_exists=$(command -v python)
if [ -z $python_exists ] 
then 
  python_exists=$(command -v python3)
  if [ -z python_exists ]
  then
    echo "No python found in PATH - Check your PATH or install python add to PATH."
  fi
fi
if [ -n $python_exists ]
then
  pipenv_exist=$(command -v pipenv)
  if [ -z $pipenv_exist ] 
  then
    echo "No pipenv found - Installing pipenv running ``pip install pipenv``..."
    $python_exists -m pip install pipenv
    echo "...pipenv installed"
  fi
  # specific for pyenv shim
  [[ -n $(command -v pyenv) ]] && pyenv rehash
  echo "Setting up python environnement with pipenv"
  # our default is pipenv to use its own virtualenv and be in project directory
  export PIPENV_IGNORE_VIRTUALENVS=1
  export PIPENV_VENV_IN_PROJECT=1
  pipenv install
fi

# Check Julia environment ---
echo ">>>> Configuring Julia environment"
julia_exists=$(command -v julia)
if [ -z $julia_exists ] 
then 
  echo "No julia found in PATH - Check your PATH or install julia and add to PATH."
else
  echo "Setting up Julia environment"
  julia --color=yes --project=. -e 'import Pkg; Pkg.instantiate(); Pkg.build("IJulia"); Pkg.precompile()'
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

# Get npm in place
echo ">>>> Configuring npm for MECA testing environment"
npm_exists=$(command -v npm)
if [-z $npm_exists]
then
  echo "No npm found - will skip any tests that require npm (e.g. JATS / MECA validation)"
else
  echo "Setting up npm testing environment"
  npm install -g meca
fi