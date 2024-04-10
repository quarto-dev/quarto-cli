# Step to update revealjs

- [ ] Update version of REVEALJS and plugins in [`configuration`](../configuration)
- [ ] Run the update once and fix potential issue in theme patching
- [ ] Manually check that [`settings.scss`](../src/resources/formats/revealjs/reveal/css/theme/template\settings.scss) does not have new item to add to [`quarto.scss`](../src/resources/formats/revealjs/quarto.scss). Look for `// -- START setting.scss --` and `// -- END setting.scss --`
- [ ] Check that defaults value did not change in SASS variable mapping (e.g. `$backgroundColor` default in Revealjs is set to `$body-color` in Quarto) in the same files

## Patching Themes

It happens in [`update-html-dependencies.ts`](../package/src/common/update-html-dependencies.ts)

- `sassVarsMap` contains the mapping between SASS variables in revealjs and quarto
- `revealjsThemePatches` has the variables used to patch the specific theme
