## Quarto Email

The Quarto email extension, which contributes to the HTML format, can be used for Quarto HTML documents published in Posit Connect. Since we are authoring an HTML document the resulting email will also be rendered as HTML email message.

### How to author an HTML document with a Connect email

Using this feature is fairly straightforward, the first thing to know is that the email message must belong to a single region of content using a div (`:::`) with the class `.email`. The second major thing to be aware of is that a subject line is required, and that belongs in its own div with the class `.subject`. The `.subject` div should be inside of the `.email` div and it needs to consist of text only. A typical HTML document with an associated Connect email should look something like this:

```
---
format:
  html: default
  email: default
---

The report content.

::: {.email}

::: {.subject}
The subject line.
:::

The email content.

:::

Any additional report content.

```

The email div can appear anywhere in the HTML document so long as it only appears once. Any images generated in the email portion of the document (for example, static plots) will be embedded in the email message as Base64 images. This essentially means that all content, even images, will be self-contained and doesn't need to be stored elsewhere and retrieved. With email messages, we have to keep things simple by necessity and this means that interactive or otherwise complex outputs cannot be used (since they cannot be understood by email clients).

Your reporting may sometimes create data files (like CSVs or Excel files), and, these can attached to the email message. We can make this happen by declaring the file names in the YAML header. Say, for instance, the files `"raw_data.csv"` and `"summary.csv"` were written to the working directory through a render of the document. We could make these available as email attachments by using the `attachments` options in the YAML, like this:

```
---
format:
  html: default
  email: default
attachments:
  - raw_data.csv
  - summary.csv
---
```

It doesn't matter where in the document those files were generated (could be inside or outside of the `.email` div), the key thing is that those files _were_ generated through a document render.

### Deploying to Connect

Posit Connect has a few ways to render documents. They can be static assets that are fully rendered and sent to the Connect server. Another methodology involves sending the source document (and any needed resources) to Connect where the render occurs there. With respect to the Quarto Email feature, emails can only be rendered and sent when using the latter scheme. To do this in an R-based workflow can publish the .qmd document using the `quarto_publish_doc()` function from the `quarto` package. Here's an example of how this works:

```
library(quarto)

quarto_publish_doc(
  "r_report.qmd",
  name = "quarto-r-report-with-email",
  server = "<Connect server address>",
  account = "<username>",
  render = "server"
)
```

Once the render succeeds, you'll be given the option to navigate to the report in your Connect instance. In the rendered view of the report, the email portion is not visible. Given you are the author of the report you can send yourself the email by clicking on the email icon on the top navigation bar and selecting the option to send the email to yourself. Given the email looks satisfactory, you can use various Connect options for the given report to regularly send the email upon render (at a frequency of your choosing) to authorized individuals added to this document.

If using a Python-based workflow, all principles for formatting the document still apply. The method of deploying is a bit different: one should use the `rsconnect-python` library for deployment. It offers a CLI for deployment and many examples are available in the [project README](https://github.com/rstudio/rsconnect-python).
