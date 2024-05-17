# Step to update revealjs

- [ ] Update version of REVEALJS and plugins in [`configuration`](../configuration)
- [ ] Run the update once (`package\src\quarto-bld.cmd update-html-dependencies`) and fix potential issue in theme patching
- [ ] Manually check that [`settings.scss`](../src/resources/formats/revealjs/reveal/css/theme/template\settings.scss) does not have new item to add to [`quarto.scss`](../src/resources/formats/revealjs/quarto.scss). Look for `// -- START setting.scss --` and `// -- END setting.scss --`
- [ ] Check that defaults value did not change in SASS variable mapping (e.g. `$backgroundColor` default in Revealjs is set to `$body-color` in Quarto) in the same files

## Patching Themes

It happens in [`update-html-dependencies.ts`](../package/src/common/update-html-dependencies.ts)

- `sassVarsMap` contains the mapping between SASS variables in revealjs and quarto
- `revealjsThemePatches` has the variables used to patch the specific theme

### Quarto specifics

- `default` theme is a custom quarto theme (`default.scss`)
- `dark` theme is a cusom quarto theme (`dark.scss`)
  - Default value are the one in the `quarto.scss` layer
- `white` is aliased to `default`, so use `default.scss` - `white.scss` from reveal is ignored
- `black` is aliased to `dark.scss`, so use `dark.scss` - `black.scss` from reveal is ignored

#### About settings.scss

- `settings.scss` is a file that contains the default value for the themes
- However, `quarto.scss` contains some defaults for Quarto.
- So part of settings.scss is inside the Quarto default, and others are in the revealjs theme ported to quarto theme

#### About adaptation of theme files

- Variables name are changed to match the quarto theme - this is done automatically through a mapping
- Files are patched using git for more manual modification.

  - Imports are removed
    - `template/mixins.scss` will be added as part of framework layer
    - `template/settings.scss` is manually inlined
    - `template/theme.scss` will be added as part of framework layer
  - `@include dark-bg-text-color` is removed as it is inlined in quarto.scss and `$dark-bg-text-color` allows to set it
  - `@include light-bg-text-color` is removed as it is inlined in quarto.scss and `$light-bg-text-color` allows to set it

  - some defaults from `settings.scss` are hand picked, and other are inline changed in `quarto.scss`

  - For dark themes

    - Check that the dark theme is correctly patched with
      ```scss
      $input-panel-bg: rgba(233, 236, 239, 0.2) !default;
      ```
    - Some themes have
      ```scss
      // code blocks
      $code-block-bg: transparent !default;
      ```
      to avoid quarto default value which is body-bg

  - Ignored default from settings.scss are
    - `$presentation-h2-font-size:`
    - `$presentation-h3-font-size:`
    - `$presentation-h4-font-size:`
    - `$font-family-monospace:`
    - `$presentation-block-margin:`
  - Values from `quarto.scss` are used even for ported themes

  - `$presentation-heading-font`
    - We remove Impact font if present as fallback
