source ../configure

SCRIPTS_DIR=scripts/macos/pkg


rm -rf $OUT_DIR
mkdir $OUT_DIR

echo pkgbuild --root "${WORKING_DIR}" --identifier "${IDENTIFIER}" --version "${VERSION}" --install-location "/Library/Quarto" --scripts ${SCRIPTS_DIR} ${OUT_DIR}/${PKGNAME}.pkg
pkgbuild --root "${WORKING_DIR}" --identifier "${IDENTIFIER}" --version "${VERSION}" --install-location "/Library/Quarto" --scripts ${SCRIPTS_DIR} ${OUT_DIR}/${PKGNAME}.pkg


#mkdir scripts
# make file postinstall

# What are we getting out of bundling, if anything
	# maybe should just bundle ts files to get good stack traces
	# if better than 200ms startup time, that would be worth it
	# test with wrapper doing simple render and timing it

#!/bin/sh
# echo "Running postinstall" > /tmp/my_postinstall.log
# TODO: symlink quarto
# exit 0 # all good

# ^^^ PACKAGING

# notarize the package
	# generate an hcl to notarize (gon ./gon.hcl)
		# productbuild
			# pkgbuild
				# sign files at all? probably not useful
					# Build direcquartotory and paths



# /\/\/\/\/\/\/\/ INSTALLATION ON USER SYSTEM