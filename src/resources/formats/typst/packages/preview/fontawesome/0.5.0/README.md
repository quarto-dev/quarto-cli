# typst-fontawesome

A Typst library for Font Awesome icons through the desktop fonts.

p.s. The library is based on the Font Awesome 6 desktop fonts (v6.6.0)

## Usage

### Install the fonts

You can download the fonts from the official website: https://fontawesome.com/download

After downloading the zip file, you can install the fonts depending on your OS.

#### Typst web app

You can simply upload the `otf` files to the web app and use them with this package.

#### Mac

You can double click the `otf` files to install them.

#### Windows

You can right-click the `otf` files and select `Install`.

#### Some notes

This library is tested with the otf files of the Font Awesome Free set. TrueType fonts may not work as expected. (Though I am not sure whether Font Awesome provides TrueType fonts, some issue is reported with TrueType fonts.)

### Import the library

#### Using the typst packages

You can install the library using the typst packages:

`#import "@preview/fontawesome:0.5.0": *`

#### Manually install

Copy all files start with `lib` to your project and import the library:

`#import "lib.typ": *`

There are three files:

- `lib.typ`: The main entrypoint of the library.
- `lib-impl.typ`: The implementation of `fa-icon`.
- `lib-gen.typ`: The generated icon map and functions.

I recommend renaming these files to avoid conflicts with other libraries.

### Use the icons

You can use the `fa-icon` function to create an icon with its name:

`#fa-icon("chess-queen")`

Or you can use the `fa-` prefix to create an icon with its name:

`#fa-chess-queen()` (This is equivalent to `#fa-icon().with("chess-queen")`)

You can also set `solid` to `true` to use the solid version of the icon:

`#fa-icon("chess-queen", solid: true)`

Some icons only have the solid version in the Free set, so you need to set `solid` to `true` to use them if you are using the Free set.
Otherwise, you may not get the expected glyph.

#### Full list of icons

You can find all icons on the [official website](https://fontawesome.com/search)

#### Different sets

By default, the library supports `Free`, `Brands`, `Pro`, `Duotone` and `Sharp` sets.
(See [Enable Pro sets](#enable-pro-sets) for enabling Pro sets.)

But only `Free` and `Brands` are tested by me.
That is, three font files are used to test:

- Font Awesome 6 Free (Also named as _Font Awesome 6 Free Regular_)
- Font Awesome 6 Free Solid
- Font Awesome 6 Brands

Due to some limitations of typst 0.12.0, the regular and solid versions are treated as different fonts.
In this library, `solid` is used to switch between the regular and solid versions.

To use other sets or specify one set, you can pass the `font` parameter to the inner `text` function: \
`fa-icon("github", font: "Font Awesome 6 Pro Solid")`

If you have Font Awesome Pro, please help me test the library with the Pro set.
Any feedback is appreciated.

##### Enable Pro sets

Typst 0.12.0 raise a warning when the font is not found.
To use the Pro set, `#fa-use-pro()` should be called before any `fa-*` functions.

```typst
#fa-use-pro()                 // Enable Pro sets

#fa-icon("chess-queen-piece") // Use icons from Pro sets
```

#### Customization

The `fa-icon` function passes args to `text`, so you can customize the icon by passing parameters to it:

`#fa-icon("chess-queen", fill: blue)`

#### Stacking icons

The `fa-stack` function can be used to create stacked icons:

`#fa-stack(fa-icon-args: (solid: true), "square", ("chess-queen", (fill: white, size: 5.5pt)))`

Declaration is `fa-stack(box-args: (:), grid-args: (:), fa-icon-args: (:), ..icons)`

- The order of the icons is from the bottom to the top.
- `fa-icon-args` is used to set the default args for all icons.
- You can also control the internal `box` and `grid` by passing the `box-args` and `grid-args` to the `fa-stack` function.
- Currently, four types of icons are supported. The first three types leverage the `fa-icon` function, and the last type is just a content you want to put in the stack.
  - `str`, e.g., `"square"`
  - `array`, e.g., `("chess-queen", (fill: white, size: 5.5pt))`
  - `arguments`, e.g. `arguments("chess-queen", solid: true, fill: white)`
  - `content`, e.g. `fa-chess-queen(solid: true, fill: white)`

#### Known Issues

- [typst#2578](https://github.com/typst/typst/issues/2578) [typst-fontawesome#2](https://github.com/duskmoon314/typst-fontawesome/issues/2)

  This is a known issue that the ligatures may not work in headings, list items, grid items, and other elements. You can use the Unicode from the [official website](https://fontawesome.com) to avoid this issue when using Pro sets.

  For most icons, Unicode is used implicitly. So I assume we usually don't need to worry about this.

  Any help on this issue is appreciated.

## Example

See the [`example.typ`](https://typst.app/project/rQwGUWt5p33vrsb_uNPR9F) file for a complete example.

## Contribution

Feel free to open an issue or a pull request if you find any problems or have any suggestions.

### Python helper

The `helper.py` script is used to get metadata via the GraphQL API and generate typst code. I aim only to use standard python libraries, so running it on any platform with python installed should be easy.

### Repo structure

- `helper.py`: The helper script to get metadata and generate typst code.
- `lib.typ`: The main entrypoint of the library.
- `lib-impl.typ`: The implementation of `fa-icon`.
- `lib-gen.typ`: The generated functions of icons.
- `example.typ`: An example file to show how to use the library.
- `gallery.typ`: The generated gallery of icons. It is used in the example file.

## License

This library is licensed under the MIT license. Feel free to use it in your project.
