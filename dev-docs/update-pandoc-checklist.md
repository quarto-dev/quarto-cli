## Updating the bundled version of Pandoc

- [ ] If needed, ask JJ to upgrade our archives
- [ ] Run `./package/src/quarto-bld update-pandoc PANDOC_VERSION`
- [ ] look at `git diff`, specifically for changes in Pandoc templates, and adjust as needed.

## Manual steps

- [ ] Update schemas by inspecting [their changelog](https://github.com/jgm/pandoc/blob/main/changelog.md) for new commands, deprecation removals, etc
- [ ] Update lua-types if needed by inspecting the diff of [lua-filters.md](https://github.com/jgm/pandoc/commits/main/doc/lua-filters.md)
