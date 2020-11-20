source ../configure

SCRIPTS_DIR=scripts/macos/pkg


rm -rf $OUT_DIR
mkdir $OUT_DIR

pkgbuild --root "${WORKING_DIR}" \
         --identifier "${IDENTIFIER}" \
         --version "${VERSION}" \
         --install-location "/Library/Quarto" \
         --scripts ${SCRIPTS_DIR} \
         ${OUT_DIR}/${PKGNAME}


# ^^^ PACKAGING

# notarize the package
	# generate an hcl to notarize (gon ./gon.hcl)
		# productbuild
			# pkgbuild
				# sign files at all? probably not useful
					# Build direcquartotory and paths



# /\/\/\/\/\/\/\/ INSTALLATION ON USER SYSTEM