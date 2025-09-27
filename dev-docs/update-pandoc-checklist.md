## Updating the bundled version of Pandoc

Carlos needs to run this:

- [x] Ensure archives are upgraded
- [x] Run `AWS_PROFILE=... ./package/src/quarto-bld update-pandoc PANDOC_VERSION`
- [ ] look at `git diff`, specifically for changes in Pandoc templates, and adjust as needed.

As a reminder, our templates are kept in the same directories as Pandoc's templates, but with different names. `git diff` will show the diff in Pandoc's template; we have to manually patch
ours. (We can't just use `patch` because the templates have diverged too much)

### Pandoc templates

The general rule for the naming is that "format.template" indicates Pandoc naming, and "template.format" indicates ours. Examples below:

#### beamer

- Pandoc's: src/resources/formats/beamer/pandoc/beamer.template
- Ours: src/resources/formats/beamer/pandoc/template.tex

Partials:

- Pandoc's:
  - src/resources/formats/beamer/pandoc/latex.common
- Ours:
  - src/resources/formats/beamer/pandoc/common.latex


## Manual steps

- [ ] Update schemas by inspecting [their changelog](https://github.com/jgm/pandoc/blob/main/changelog.md) for new commands, deprecation removals, etc
- [ ] Update lua-types if needed by inspecting the diff of [lua-filters.md](https://github.com/jgm/pandoc/commits/main/doc/lua-filters.md)
