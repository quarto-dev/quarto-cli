#!/usr/bin/env bash

# Determine the path to this script (we'll use this to figure out relative positions of other files)
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
  SCRIPT_PATH="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
done
export SCRIPT_PATH="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"

source $SCRIPT_PATH/../package/scripts/common/utils.sh

export QUARTO_ROOT="`cd "$SCRIPT_PATH/.." > /dev/null 2>&1 && pwd`"
QUARTO_SRC_DIR="$QUARTO_ROOT/src"
DENO_ARCH_DIR=$DENO_DIR
DENO_DIR="$QUARTO_ROOT/package/dist/bin/"

# Local import map
QUARTO_IMPORT_MAP_ARG=--importmap=$QUARTO_SRC_DIR/import_map.json

export QUARTO_BIN_PATH=$DENO_DIR
export QUARTO_SHARE_PATH="`cd "$QUARTO_ROOT/src/resources/";pwd`"
export QUARTO_DEBUG=true

QUARTO_DENO_OPTIONS="--config test-conf.json --v8-flags=--enable-experimental-regexp-engine,--max-old-space-size=8192,--max-heap-size=8192 --unstable-kv --unstable-ffi --no-lock --allow-all"


if [[ -z $GITHUB_ACTION ]] && [[ -z $QUARTO_TESTS_NO_CONFIG ]]
then
  echo "> Checking and configuring environment for tests"
  source configure-test-env.sh
fi

# Activating python virtualenv
# set QUARTO_TESTS_FORCE_NO_VENV env var to not activate the virtualenv located in the project
# QUARTO_TESTS_FORCE_NO_PIPENV is there for backward compatibility
if [[ -z $QUARTO_TESTS_FORCE_NO_VENV && -n $QUARTO_TESTS_FORCE_NO_PIPENV ]]; then
  export QUARTO_TESTS_FORCE_NO_VENV=$QUARTO_TESTS_FORCE_NO_PIPENV
fi
if [[ -z $QUARTO_TESTS_FORCE_NO_VENV ]]
then
  # Save possible activated virtualenv for later restauration
  OLD_VIRTUAL_ENV=$VIRTUAL_ENV
  echo "> Activating virtualenv from .venv for Python tests in Quarto"
  source "${QUARTO_ROOT}/tests/.venv/bin/activate"
  echo "> Using Python from $(which python)"
  echo "> VIRTUAL_ENV: ${VIRTUAL_ENV}"
  quarto_venv_activated="true"
fi

SMOKE_ALL_TEST_FILE="./smoke/smoke-all.test.ts"

# RUN FOR TIMING TESTS ONLY 
if [ "$QUARTO_TEST_TIMING" != "" ] && [ "$QUARTO_TEST_TIMING" != "false" ]; then
  if [ "$QUARTO_TEST_TIMING" == "true" ]; then
    QUARTO_TEST_TIMING="timing.txt"
  fi
  echo "> Running tests with timing and writing to ${QUARTO_TEST_TIMING}"
  rm -f $QUARTO_TEST_TIMING
  FILES=$@
  if [ "$FILES" == "" ]; then
    FILES=`find . | grep \.test\.ts$ | sort`
  fi
  for i in $FILES; do
    if [ "$i" == "./test.ts" ]; then
     # ignoring this file as this is not a test file to time
     continue
    fi
    # For smoke-all.test.ts, each smoke-all document test needs to be timed.
    if [ "$i" == "$SMOKE_ALL_TEST_FILE" ]; then
      echo "> Timing smoke-all tests"
      SMOKE_ALL_FILES=`find docs/smoke-all/ -type f -regextype "posix-extended" -regex ".*/[^_][^/]*[.]qmd" -o -regex ".*/[^_][^/]*[.]md" -o -regex ".*/[^_][^/]*[.]ipynb"`
      for j in $SMOKE_ALL_FILES; do
        echo "${SMOKE_ALL_TEST_FILE} -- ${j}" >> "$QUARTO_TEST_TIMING"
        /usr/bin/time -f "        %e real %U user %S sys" -a -o ${QUARTO_TEST_TIMING} "${DENO_DIR}/tools/${DENO_ARCH_DIR}/deno" test ${QUARTO_DENO_OPTIONS} --no-check ${QUARTO_DENO_EXTRA_OPTIONS} "${QUARTO_IMPORT_MAP_ARG}" ${SMOKE_ALL_TEST_FILE} -- ${j}
      done
      continue
    fi
    # Otherwise we time the individual test.ts test
    echo $i >> "$QUARTO_TEST_TIMING"
    /usr/bin/time -f "        %e real %U user %S sys" -a -o "$QUARTO_TEST_TIMING" "${DENO_DIR}/tools/${DENO_ARCH_DIR}/deno" test ${QUARTO_DENO_OPTIONS} --no-check ${QUARTO_DENO_EXTRA_OPTIONS} "${QUARTO_IMPORT_MAP_ARG}" $i
  done
  # exit the script with an error code if the timing file shows error
  grep -q 'Command exited with non-zero status' $QUARTO_TEST_TIMING && SUCCESS=1 || SUCCESS=0
else
  # RUN WHEN NO TIMING (GENERIC CASE)

  ## Short version syntax to run smoke-all.test.ts
  ## Only use if different than ./run-test.sh ./smoke/smoke-all.test.ts
  if [[ "$1" =~ smoke-all\.test\.ts ]]; then
    TESTS_TO_RUN=$@
  else
    # Check file argument
    SMOKE_ALL_FILES=""
    TESTS_TO_RUN=""
    if [[ ! -z "$*" ]]; then
      for file in "$*"; do
        echo $file
        filename=$(basename "$file")
        # smoke-all.test.ts works with .qmd, .md and .ipynb but  will ignored file starting with _
        if [[ $filename =~ ^[^_].*[.]qmd$ ]] || [[ $filename =~ ^[^_].*[.]ipynb$ ]] || [[ $filename =~ ^[^_].*[.]md$ ]]; then
          SMOKE_ALL_FILES="${SMOKE_ALL_FILES} ${file}"
        elif [[ $file =~ .*[.]ts$ ]]; then
          TESTS_TO_RUN="${TESTS_TO_RUN} ${file}"
          echo $TESTS_TO_RUN
        else
          echo "#### WARNING"
          echo "Only .ts, or .qmd, .md and .ipynb passed to smoke-all.test.ts are accepted (file starting with _ are ignored)."
          echo "####"
          exit 1
        fi
      done
    fi
    if [ "$SMOKE_ALL_FILES" != "" ]; then
      if [ "$TESTS_TO_RUN" != "" ]; then
        echo "#### WARNING"
        echo "When passing .qmd, .md and/or .ipynb, only ./smoke/smoke-all.test.ts will be run. Other tests files are ignored."
        echo "Ignoring ${TESTS_TO_RUN}."
        echo "####"
      fi
      TESTS_TO_RUN="${SMOKE_ALL_TEST_FILE} -- ${SMOKE_ALL_FILES}"
    fi
  fi
  "${DENO_DIR}/tools/${DENO_ARCH_DIR}/deno" test ${QUARTO_DENO_OPTIONS} --check ${QUARTO_DENO_EXTRA_OPTIONS} "${QUARTO_IMPORT_MAP_ARG}" $TESTS_TO_RUN
  SUCCESS=$?
fi

if [[ $quarto_venv_activated == "true" ]] 
then
  echo "> Exiting virtualenv activated for tests"
  deactivate
  echo "> Using Python from $(which python)"
  echo "> VIRTUAL_ENV: ${VIRTUAL_ENV}"
  unset quarto_venv_activated
fi
if [[ -n $OLD_VIRTUAL_ENV ]]
then
  echo "> Reactivating original virtualenv"
  source $OLD_VIRTUAL_ENV/bin/activate
  echo "> Using Python from $(which python)"
  echo "> VIRTUAL_ENV: ${VIRTUAL_ENV}"
  unset OLD_VIRTUAL_ENV
fi

# Generates the coverage report
if [[ $@ == *"--coverage"* ]]; then

  # read the coverage value from the command 
  [[ $@ =~ .*--coverage=(.+) ]] && export COV="${BASH_REMATCH[1]}"

  echo Generating coverage report...
  ${DENO_DIR}/deno coverage --unstable-kv --unstable-ffi ${COV} --lcov > ${COV}.lcov
  genhtml -o ${COV}/html ${COV}.lcov
  open ${COV}/html/index.html
fi

exit ${SUCCESS}
