# Configuration Target Directories
export SCRIPT_PATH=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
export QUARTO_ROOT=$(cd -- "${SCRIPT_PATH}/../.." &> /dev/null && pwd )
export QUARTO_SRC_PATH=${QUARTO_ROOT}/src

# Full paths are what the Quarto code uses internally. You should never see a _DIR entry in there.
#    Note that the conda recipe defines some of these itself, so these are mainly just for the
#    zip file archives that we build.

# These are the paths within the Quarto source tree - the "package" subfolder.
export QUARTO_PACKAGE_PATH=${QUARTO_PACKAGE_PATH=${QUARTO_ROOT}/${QUARTO_PACKAGE_DIR}}

# These paths end up in the output package or conda build prefix.
export QUARTO_DIST_PATH=${QUARTO_DIST_PATH=${QUARTO_PACKAGE_PATH}/${QUARTO_DIST_DIR}}
export QUARTO_SHARE_PATH=${QUARTO_SHARE_PATH=${QUARTO_DIST_PATH}/${QUARTO_SHARE_DIR}}
export QUARTO_BIN_PATH=${QUARTO_BIN_PATH=${QUARTO_DIST_PATH}/${QUARTO_BIN_DIR}}