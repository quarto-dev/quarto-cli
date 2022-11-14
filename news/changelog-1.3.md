

## Article Layout

- Improve the performance of extremely large documents with margin elements by improving the efficiency of positioning the elements.

## HTML Format

- Improved handling of margin references that appear within a callout. (#3003)

## Dates

- Properly fall back to language only locale when a supported language-region locale isn't available. (#3059)

## About Pages

- Add support for `image-alt` which provides alternate text for the about page image. (#3010)

## Listings

- Listings now support `template-params`, which will be passed to custom EJS templates when a listing is rendered.

## Miscellaneous

- ensure `video` shortcode works with `embed-resources` and `self-contained` ([#3310](https://github.com/quarto-dev/quarto-cli/issues/3310))
