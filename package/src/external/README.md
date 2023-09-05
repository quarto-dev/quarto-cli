Scripts in this folder are intended for use by external package managers, such as Conda.
The intention is that the packaging process consists of only the minimal quarto files, and
not any of the vendored dependencies. No packages are created by this process. Instead,
files are put in a user-specified location such that an external packaging tool will bundle them.
