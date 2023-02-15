# Check python test environment ---
python_exists=$(which python)
if [ -z $python_exists ] 
then 
  echo "No python found in PATH - Install python."
else
  pipenv_exist=$(which pipenv)
  if [ -z $pipenv_exist ] 
  then
    echo "No pipenv found in PATH - Install pipenv running \`pip install pipenv\`."
  else
    echo "Setting up python environnement with pipenv"
    pipenv install
  fi
fi

# Check Julia environment
julia_exists=$(which julia)
if [ -z $julia_exists ] 
then 
  echo "No julia found in PATH - Install Julia."
else
  echo "Setting up Julia environment"
  julia --color=yes --project=. -e 'import Pkg; Pkg.instantiate(); Pkg.build("IJulia"); Pkg.precompile()'
fi

# Update tinytex
if [ -z $GH_TOKEN ] && [ -n $(which gh) ]
then 
  echo "Setting GH_TOKEN env var for Github Download."
  export GH_TOKEN=$(gh auth token)
fi

if [ -n $(which quarto) ] 
then
  quarto install tinytex
fi
