#!/bin/zsh

# prerequisites:
#   - Installation of R
#   - Installation of Conda

# pandoc
brew install pandoc
brew install pandoc-citeproc

# deno
brew install deno

# tinytex
curl -sL "https://yihui.org/tinytex/install-bin-unix.sh" | sh

# init sandbox
pushd ../sandbox

# install R dependencies
R --quiet -e "renv::restore()"

# install Python dependencies
if [ -d "pyenv" ] 
then
  conda activate ./pyenv
  conda env update -f environment.yml
  conda deactivate
else
  conda env create -f environment.yml --prefix pyenv
fi

popd