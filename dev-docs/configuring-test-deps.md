# Installing and configuring the main tools

## Julia

- Install `juliaup`
- Install version to use e.g `juliaup add 1.10`
- Configure `tests` folder to use a specific version

  ```
  cd tests
  juliaup override unset
  juliaup override 1.10
  ```

  This way when calling `julia` in `tests` folder it will always be Julia 1.10 version

## Python

- Install `pyenv`
- Install a specic version e.g `pyenv install 3.12.1`
- Configure `tests` to use a specific version

  ```
  cd tests
  pyenv local 3.12.1
  ```

  This way when calling `python` in `tests` folder it will always be Python 3.12.1 version

## R

- Install `rig`
- Install R version e.g `rig add 4.3.2`
- For now, no way to just configure a folder to use a specific version, so you need to set the version globally

  ```
  rig default 4.3.2
  ```

## NPM

- Install `npm` needed for meca

# Installing the dependencies in each languages packages

- From `tests` folder, run `configure-test-env` scripts to restore dependencies for each tools
