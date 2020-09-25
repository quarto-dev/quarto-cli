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

# install R dependencies
(cd sandbox && R --quiet -e "renv::restore()")
