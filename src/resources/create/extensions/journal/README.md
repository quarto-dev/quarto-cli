
# <%= title %>

## Creating a New Article

You can use this as a template to create an article for the %<= titl %>. To do this, use the following command:

*TODO*: Replace the `<github-organization>` with your GitHub organization.

```bash
quarto use template <github-organization>/<%= filesafename %>
```

This will install the extension and create an example qmd file that you can use as a starting place for your article.

## Usage

To use the format, you can use the format names <%= filesafefilename %>-pdf and <%= filesafefilename %>-html. For example:

`quarto render article.qmd --to <%= filesafefilename %>-pdf`

or in your document yaml

```yaml
format:
  pdf: default
  <%= filesafefilename %>-pdf:
    keep-tex: true    
```    

*TODO*: Describe how to use your extension.

## Options

*TODO*: If your format has options that can be set via document metadata, describe them.

## Example

Here is the source code for a minimal sample document: [template.qmd](template.qmd).

