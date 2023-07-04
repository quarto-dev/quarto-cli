# Notebooks Now! Submission Template

[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/Notebooks-Now/submission-myst-full/HEAD?labpath=notebooks/data-screening.ipynb)

This submission template is for a markdown-based publication with additional supporting notebook and markdown files, as well as supporting data, bibliography, and MyST build configuration.

## Source files

The primary source file for this template is a MyST markdown article. This file may reference notebook cells from other sub-articles to use the output of these cells as figures. It may also reference content from other markdown sub-articles. All of these supplementary source notebooks/articles should be saved in the `notebooks/` folder. It also contains MyST blocks tagged in their metadata as `"part": "abstract"`, or `"part": "availability"` - these cells will be extracted from the document and included as the specified part in the built output.

## Supporting material

### Supplementary data

By convention, all data should be saved in `data/` directory. There is nothing magic about this directory; references to your data from your notebook must still specify the correct relative path.

### Supplementary images

Similar to the `data/` directory, images for figures should be specified in `images/` directory.

### Bibliography

Bibliography entries may be specified two ways, both described in the [MyST docs](https://myst-tools.org/docs/mystjs/citations). They may be listed explicitly in BibTeX format, by convention in the file `references.bib`, and referenced by key using a `cite` MyST role. They may also be specified as inline DOI links. These do not require full bibliographic information; the data is fetched implicitly on build from the DOI.

## MyST configuration

A `myst.yml` file must be provided to configure notebook metadata and exports. This includes authors, affiliations, licenses, keywords, and [much more](https://myst-tools.org/docs/mystjs/frontmatter).

## Building output artifacts

To build PDF/JATS output from your source data, you must have the MyST CLI installed

```bash
npm install myst-cli
```

Then build all exports defined in the `myst.yml` file:

```bash
myst build --all
```
