#!/bin/bash

# Determine the path to this script (we'll use this to figure out relative positions of other files)
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
  SCRIPT_PATH="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
done
export SCRIPT_PATH="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"


export QUARTO_ROOT="`cd "$SCRIPT_PATH/.." > /dev/null 2>&1 && pwd`"
QUARTO_SRC_DIR="$QUARTO_ROOT/src"
DENO_DIR="$QUARTO_ROOT/package/dist/bin/"


# Local import map
QUARTO_IMPORT_ARGMAP=--importmap=$QUARTO_SRC_DIR/dev_import_map.json

export QUARTO_BIN_PATH=$DENO_DIR
export QUARTO_SHARE_PATH="`cd "$QUARTO_ROOT/src/resources/";pwd`"
export QUARTO_DEBUG=true

QUARTO_DENO_OPTIONS="--unstable --allow-read --allow-write --allow-run --allow-env --allow-net"


# Ensure that we've restored the renv
Rscript -e "if (!requireNamespace('renv', quietly = TRUE)) install.packages('renv')"
Rscript -e "renv::restore()"

# Ensure that we've actived the python env
source bin/activate
python3 -m pip install -r requirements.txt -q

# Ensure that tinytex is installed
quarto install tool tinytex --no-prompt

"${DENO_DIR}/tools/deno" test ${QUARTO_DENO_OPTIONS} ${QUARTO_DENO_EXTRA_OPTIONS} "${QUARTO_IMPORT_ARGMAP}" $@

SUCCESS=$?

# Generates the coverage report
if [[ $@ == *"--coverage"* ]]; then

  # read the coverage value from the command 
  [[ $@ =~ .*--coverage=(.+) ]] && export COV="${BASH_REMATCH[1]}"

  echo Generating coverage report...
  ${DENO_DIR}/deno coverage --unstable ${COV} --lcov > ${COV}.lcov
  genhtml -o ${COV}/html ${COV}.lcov
  open ${COV}/html/index.html
fi

exit ${SUCCESS}
