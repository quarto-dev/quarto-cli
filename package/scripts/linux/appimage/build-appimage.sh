#!/bin/sh

OUTPUT_DIR="./AppDir"

# Remove any previous build.
rm -rf $OUTPUT_DIR | true

# Make appdir and copy quarto files.
mkdir $OUTPUT_DIR
cp -T -r ./package/pkg-working/ $OUTPUT_DIR/usr/

# Add icon and desktop file.
cp ./package/scripts/linux/appimage/quarto.svg $OUTPUT_DIR/
cp ./package/scripts/linux/appimage/quarto.desktop $OUTPUT_DIR/

# Add AppRun file
cp ./package/scripts/linux/appimage/AppRun $OUTPUT_DIR/AppRun
chmod a+x $OUTPUT_DIR/AppRun

# Get and run appimagetool
wget https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage
chmod a+x ./appimagetool-x86_64.AppImage
ARCH=$TARGET_ARCH ./appimagetool-x86_64.AppImage $OUTPUT_DIR Quarto-${VERSION}-${TARGET_ARCH}.AppImage
