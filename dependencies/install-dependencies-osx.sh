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
# update w: renv::snapshot()
R --quiet -e "renv::restore()"

# install Python dependencies
# update w/: conda env export > environment.yml
conda env update -f environment.yml

# generate quarto symlink
QUARTO_TS=`realpath ../src/quarto.ts`
QUARTO_IMPORT_MAP=`realpath ../src/import_map.json`
QUARTO_PYTHON=`realpath ~/opt/miniconda3/envs/quarto-cli/bin/python`
cat > quarto.sh <<EOL
#!/bin/zsh
export QUARTO_PYTHON=${QUARTO_PYTHON}
deno run --unstable --allow-run --allow-env --importmap=${QUARTO_IMPORT_MAP} ${QUARTO_TS} \$@
EOL
chmod +x quarto.sh
QUARTO_SH=`realpath quarto.sh`
ln -fs ${QUARTO_SH} /usr/local/bin/quarto

popd
