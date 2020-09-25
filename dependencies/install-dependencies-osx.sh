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

# generate quarto symlink
QUARTO_TS=`realpath ../src/quarto.ts`
QUARTO_IMPORT_MAP=`realpath ../src/import_map.json`
cat > quarto.sh <<EOL
#!/bin/zsh
deno run --unstable --allow-run --importmap=${QUARTO_IMPORT_MAP} ${QUARTO_TS} \$@
EOL
chmod +x quarto.sh
QUARTO_SH=`realpath quarto.sh`
ln -fs ${QUARTO_SH} /usr/local/bin/quarto

popd
