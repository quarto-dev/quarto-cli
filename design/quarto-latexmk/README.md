# Quarto Latexmk

### Running / Developing Locally

1)  Clone the quarto repo:

``` {.bash}
$ git clone https://github.com/quarto-dev/quarto-cli
$ cd quarto-cli
```

2)  Configure your machine using the platform appropriate version of the configure command `configure-macos.sh`, `configure-linux.sh`, or `configure-windows.cmd`

``` {.bash}
$ ./configure-macos.sh 
```

3)  'Install' the development version of `quarto-latexmk` using (this will create a script that points back to the Typescript entry point and place that executable script in an appropriate bin directory).

``` {.bash}
$ cd package/src
$ ./quarto-bld compile-quarto-latexmk -d
```

Be sure to follow any instructions that are displayed in the console with regards to PATH.

4)  Once installed, usage is relatively straightforward:

``` {.bash}
$ quarto-latexmk my-test.tex
```

Which will produce `my-test.pdf` upon completion.

5)  Use the `--help` option to view options

``` {.bash}
$ quarto-latexmk --help
```

Note that the arguments `pdf-engine-opts` , `index-engine-opts`, and `tlmgr-opts` should pass not pass the raw options, but instead should pass the path to a file which contains the arguments. The file will be read and each line of the file will be passed as an argument as appropriate.

### Building

1)  Follow steps 1 and 2 above (the building machine must have the repo and be configured).

2)  Compile `quarto-latexmk` for your target platform(s)

``` {.bash}
$ cd package/src
$ ./quarto-bld compile-quarto-latexmk --target x86_64-apple-darwin --target x86_64-pc-windows-msvc
```

You can compile for multiple target architectures with a single call by passing the \`-target\` flag multiple times. Supported target architectures include:

-   x86_64-unknown-linux-gnu,
-   x86_64-pc-windows-msvc
-   x86_64-apple-darwin
-   aarch64-apple-darwin

### Key Source Code Files

`src/command/render/latexmk/quarto-latexmk.ts` ([source](https://github.com/quarto-dev/quarto-cli/blob/main/src/command/render/latexmk/quarto-latexmk.ts))\
Contains the entry point for the `quarto-latexmk` command. It primarily handles bootstrapping the process and mapping command line arguments into a `LatexmkOptions`interface which controls PDF generation.

`src/command/render/latexmk/pdf.ts` ([source](https://github.com/quarto-dev/quarto-cli/blob/main/src/command/render/latexmk/pdf.ts))\
Contains the core implementation of pdf generation including the pdf generation loop, package installation, and so on.

`src/command/render/latexmk/parse-error.ts` ([source](https://github.com/quarto-dev/quarto-cli/blob/main/src/command/render/latexmk/parse-error.ts))\
Contains the error detection and parsing used to identify errors, missing packages, fonts, or other files.

`src/command/render/latexmk/texlive.ts` ([source](https://github.com/quarto-dev/quarto-cli/blob/main/src/command/render/latexmk/texlive.ts))\
Implements a wrapper around texlive / tlmgr for installing and updating packages and binaries.

### Open Issues:

-   I haven't yet reviewed any changes to tinytex since I first ported this- I need to review and make any of those updates.

-   The binary that is produce is not currently properly versioned

-   Should a Quarto release emit a versioned build of the binary that could be used by third parties in order to keep version numbers in sync with underlying quarto source code or shall we handle versioning in some other way?
