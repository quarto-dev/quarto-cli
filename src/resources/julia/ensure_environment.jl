using Pkg
using TOML

# If the manifest was resolved with the exact Project.toml that we have copied
# over from quarto's resource folder, then we just ensure that it is instantiated,
# all packages are downloaded correctly, etc.
# Otherwise, we update to get the newest packages fulfilling the compat bounds set in
# the Project.toml.

function manifest_has_correct_julia_version()
  project_file = Base.active_project()
  manifest_file = joinpath(dirname(project_file), "Manifest.toml")
  version = VersionNumber(TOML.parsefile(manifest_file)["julia_version"])
  return version.major == VERSION.major && version.minor == VERSION.minor
end

manifest_matches_project_toml = Pkg.is_manifest_current() === true # this returns nothing if there's no manifest

if manifest_matches_project_toml && manifest_has_correct_julia_version()
  Pkg.instantiate()
else
  Pkg.update()
end
