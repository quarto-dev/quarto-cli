# DENOFILES is only required at configure.sh, but DENO_DIR is used in many places

if [[ $OSTYPE == 'darwin'* ]]; then
  FULLARCH=$(uname -sm)
  DENOFILES="deno-x86_64-apple-darwin.zip deno-aarch64-apple-darwin.zip"
  
  if [[ $FULLARCH == "Darwin x86_64" ]]; then
    DENO_DIR=deno-x86_64-apple-darwin
  elif [[ $FULLARCH == "Darwin arm64" ]]; then
    DENO_DIR=deno-aarch64-apple-darwin
  else
    echo "configure script failed: unrecognized architecture " ${FULLARCH}
    exit 1
  fi
else
  DENOFILES=deno-x86_64-unknown-linux-gnu.zip
  DENO_DIR=deno-x86_64-unknown-linux-gnu
fi
