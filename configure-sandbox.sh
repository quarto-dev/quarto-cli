#!/bin/zsh


# prerequisites:
#   - Installation of R
#   - Installation of Conda

# install tinytext
# curl -sL "https://yihui.org/tinytex/install-bin-unix.sh" | sh

# init sandbox
pushd sandbox

# install R dependencies
# update w: renv::snapshot()
R --quiet -e "renv::restore()"

# install Python dependencies
# update w/: conda env export > environment.yml
conda env update -f environment.yml

popd
