#/bin/bash

# We should do this for windows too

export QUARTO_LUACOV=`pwd`/luacov.stats.out
rm -f luacov.stats.out # to get a fresh report; otherwise it appends
./run-tests.sh
quarto run docs/luacov/fixup_coverage.ts ${QUARTO_LUACOV} > ${QUARTO_LUACOV}-fixed # required to resolve paths
mv ${QUARTO_LUACOV}-fixed ${QUARTO_LUACOV}
unset QUARTO_LUACOV # so that rendering the report doesn't add coverage
quarto render docs/luacov/report.qmd # generates the actual report file docs/luacov/luacov.report.html
