using Pkg

# If the manifest was resolved with the exact Project.toml that we have copied
# over from quarto's resource folder, then we just ensure that it is instantiated,
# all packages are downloaded correctly, etc.
# Otherwise, we update to get the newest packages fulfilling the compat bounds set in
# the Project.toml.

if Pkg.is_manifest_current() === true # this returns nothing if there's no manifest
  Pkg.instantiate()
else
  Pkg.update()
end
