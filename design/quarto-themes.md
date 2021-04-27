## Sass Themes Notes

As a part of Quarto, we've developed a simple single file format that describes functions, variables, mixins, and rules that should be layered into Scss files when compiling them into css. The basic structure of a theme file is:

-   A single text file that contains valid Scss

-   Special comments are used to denote regions of functions, variables, mixins, and rules (region decorators).

-   At least one of these region decorators must be present in order for the theme file to be valid.

-   More than one of each type of region decorator are permitted. If more than one of any type is present, all regions of a given type will be merged into a single block of that type in the order in which they are encountered in the file.

-   When compiling, the sections will be layered according to type, functions first, then variables, then mixins, and then rules.

Here is an example file:

``` {.css}
/*-- scss:functions --*/
@function colorToRGB ($color) {
  @return "rgb(" + red($color) + ", " + green($color) + ", " + blue($color)+ ")";
}

/*-- scss:defaults --*/
$h2-font-size:          1.6rem !default;
$headings-font-weight:  500 !default;
$body-color:            $gray-700 !default;


/*-- scss:mixins --*/
@mixin grid($flex) {
    @if $flex {
        @include flex;
    } @else {
        display: block;
    }
}
/*-- scss:rules --*/
h1, h2, h3, h4, h5, h6 {
  text-shadow: -1px -1px 0 rgba(0, 0, 0, .3);
}

@include grid(true);
```

## Bootswatch Sass Theme Files

We've merged Bootswatch themes for Bootstrap 5 into this single file theme format in our repo here:

<https://github.com/quarto-dev/quarto-cli/tree/main/src/resources/formats/html/bootstrap/themes>

From time to time, as the Bootswatch themes are updated, we will updated these merged theme files.

## Bootstrap / Bootswatch Layering

When using the Quarto HTML format, we allow the user to specify theme information in the document front matter (or project YAML). The theme information consists of a list of one more of

-   A valid built in Bootswatch theme name

-   A theme file (valid as described above).

For example the following would use the cosmo Bootswatch theme and provide customization using the custom.scss file:

``` {.yaml}
theme:
  - cosmo
  - custom.scss
```

When compiling the CSS for a Quarto website or HTML page, we merge any user provided theme file(s) or Bootswatch themes with the Bootstrap Scss in the following layers:

    Functions
    	Bootstrap
    	Theme(s)           /*-- scss:functions --*/

    Defaults
    	Themes(s)          /*-- scss:defaults --*/
    	Bootstrap

    Mixins
    	Themes(s)          /*-- scss:mixins --*/
    	Bootstrap

    Rules
    	Bootstrap
    	Theme(s)           /*-- scss:rules --*/

We order the themes according to the order that they are specified in the YAML, maintaining the order for functions, mixins, and rules and reversing the order for variables (allowing the files specified later in the list to provide defaults variable values to the files specified earlier in the list). Layering of the example themes above would be as follows:

    Functions
    	Bootstrap
      cosmo          /*-- scss:functions --*/
      custom.scss    /*-- scss:functions --*/

    Defaults
      custom.scss    /*-- scss:defaults --*/
      cosmo          /*-- scss:defaults --*/
    	Bootstrap

    Mixins
      custom.scss    /*-- scss:mixins --*/
    	cosmo          /*-- scss:mixins --*/
    	Bootstrap

    Rules
    	Bootstrap
    	cosmo          /*-- scss:rules --*/
      custom.scss    /*-- scss:rules --*/
