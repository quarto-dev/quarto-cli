# DENOFILES is only required at configure.sh, but DENO_DIR is used in many places

if [[ $OSTYPE == 'darwin'* ]]; then
  DENOURL=https://github.com/denoland/deno/releases/download
  FULLARCH=$(uname -sm)
  
  
  if [[ $FULLARCH == "Darwin x86_64" ]]; then
    DENO_DIR=x86_64
    DENOFILES="deno-x86_64-apple-darwin.zip"
  elif [[ $FULLARCH == "Darwin arm64" ]]; then
    DENO_DIR=aarch64
    DENOFILES="deno-aarch64-apple-darwin.zip"
  else
    echo "configure script failed: unrecognized architecture " ${FULLARCH}
    exit 1
  fi
else
  
  NIXARCH=$(uname -m)
  if [[ $NIXARCH == "x86_64" ]]; then
    DENOURL=https://github.com/denoland/deno/releases/download
    DENOFILES=deno-x86_64-unknown-linux-gnu.zip
    DENO_DIR=x86_64
  elif [[ $NIXARCH == "aarch64" ]]; then
    DENOURL=https://github.com/denoland/deno/releases/download
    DENOFILES=deno-aarch64-unknown-linux-gnu.zip
    DENO_DIR=aarch64
  else
    echo "configure script failed: unrecognized architecture " ${NIXARCH}
    exit 1
  fi
fi
