#!/bin/zsh


# prerequisites:
#   - Installation of R
#   - Installation of Conda

# pandoc
brew install pandoc
brew install pandoc-citeproc

# deno
brew upgrade deno

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

# generate scripts, first some common vars
QUARTO_TS=`realpath ../src/main.ts`
QUARTO_IMPORT_MAP=`realpath ../src/import_map.json`
QUARTO_RESOURCES=`realpath ../src/resources/`
DENO_OPTIONS="--unstable --allow-read --allow-write --allow-run --allow-env --importmap=${QUARTO_IMPORT_MAP}"

# generate quarto symlink
QUARTO_TS=`realpath ../src/main.ts`
QUARTO_IMPORT_MAP=`realpath ../src/import_map.json`
QUARTO_RESOURCES=`realpath ../src/resources/`
cat > quarto.sh <<EOL
#!/bin/zsh
export QUARTO_RESOURCES=${QUARTO_RESOURCES}
deno run ${DENO_OPTIONS} ${QUARTO_TS} \$@
EOL
chmod +x quarto.sh
QUARTO_SH=`realpath quarto.sh`
ln -fs ${QUARTO_SH} /usr/local/bin/quarto

# generate test script
cat > ../tests/run-tests.sh <<EOL
#!/bin/zsh
export QUARTO_RESOURCES=${QUARTO_RESOURCES}
deno test ${DENO_OPTIONS} \$@
EOL
chmod +x ../tests/run-tests.sh

popd
