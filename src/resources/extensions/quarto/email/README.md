## Quarto Email

The Quarto email extension, which contributes to the HTML format, can be used for Quarto HTML documents published in Posit Connect. Since we are authoring an HTML document the resulting email will also be rendered as HTML email message.

### How to author an HTML document with a Connect email

Using this feature is fairly straightforward, the first thing to know is that the email message must belong to a single region of content using a div (`:::`) with the class `.email`. The second major thing to be aware of is that a subject line is required, and that belongs in its own div with the class `.subject`. The `.subject` div should be inside of the `.email` div and it needs to consist of text only. Optionally, you could include a `.email-text` div with a text-only version of the email. If this is included, it will serve as a fallback should an email client not be able to display HTML email.

A typical HTML document with an associated Connect email might look something like this:

```
---
format:
  html: default
  email: default
---

The report content. Anything that is here is not part of the email message.

::: {.email}

::: {.subject}
The subject line.
:::

::: {.email-text}
An optional text-only version of the email message..
:::

The HTML email content. Here you can add code cells and write accompanying text.
This content is not seen when viewing the rendered document on Connect (it's only
seen when sending an email from the Connect document page). Emails from Connect
can be sent manually, and, they can also be scheduled.

:::

Any additional report content.

```

The email div can appear anywhere in the HTML document so long as it only appears once. Any images generated in the email portion of the document (for example, static plots) will be embedded in the email message as Base64 images. This essentially means that all content, even images, will be self-contained and doesn't need to be stored elsewhere and retrieved. With email messages, we have to keep things simple by necessity and this means that interactive or otherwise complex outputs cannot be used (since they cannot be understood by email clients).

Your reporting may sometimes create data files (like CSVs or Excel files), and, these can attached to the email message. We can make this happen by declaring the file names in the YAML header. Say, for instance, the files `"raw_data.csv"` and `"summary.csv"` were written to the working directory through a render of the document. We could make these available as email attachments by using the `email-attachments` options in the YAML, like this:

```
---
format:
  html: default
  email: default
email-attachments:
  - raw_data.csv
  - summary.csv
---
```

It doesn't matter where in the document those files were generated (could be inside or outside of the `.email` div), the key thing is that those files _were_ generated through a document render.

### Suppressing scheduled Connect email message using

Emails on Connect can be set up to be regularly sent upon render. We could suppress that behavior though and ask that an email _not_ be sent upon rendering at the scheduled time. Put another way we could _allow_ the regular sending of email should a .qmd have email components and there is a schedule in place. We can have control over this with by using a div with the `.email-scheduled` class. Running code inside of that should result in a `TRUE`, `True`, or `"yes"` (something _truthy_) if we want emails to be sent unimpeded. If we want to suppress the sending of email during the next render, the code within that div should be `FALSE`, `False`, or `"no"` (which is _falsy_). Here is an example where an email is _only_ sent when a certain condition is true. It's set up using R but could also be equivalently done with Python or other types of computation engines available in Quarto.

````
---
format:
  html: default
  email: default
---

```{r}
#| echo: false

library(profitcalcs)

profit <- determine_profit()

if (profit < 0) {

  # Send email since we have a reason for it

  subject <- "We have a problem here"
  send_email <- TRUE

} else {

  # Don't send email; everything is fine

  subject <- "No email. This won't be sent"
  send_email <- FALSE
}
```

The email body follows.

::: {.email}

Our profit was `{r} profit` this quarter and we felt you should know.

::: {.subject}
`{r} subject`
:::

::: {.email-scheduled}
`{r} send_email`
:::

:::

````

As can be seen, the condition for sending or not was handled in the first code cell. The main email div is set up with child divs to handle the email subject (`.subject`) and whether the email should be sent (`.email-scheduled`). Inline R code injects those divs with values stored in variables; since `send_email` will either be `TRUE` or `FALSE` the email will be sent (or not) depending on the value of `profit`.

### Previewing the HTML email locally

For faster email development and iteration, it's possible to get a local .html file that previews the content of the email. With this option, one could use `quarto render <qmd-file>` and view the `email-preview.html` file that will always be located in the `email-preview` directory. To enable the writing of that file, you must use `email-preview: true` in the document's YAML header. When viewing the HTML file, note that the footer of the email will be an abbreviated version of what is normally generated through a Connect render. Also, there won't be any indication that attachments are included as part of the email (though email clients do tend to present email attachments differently: either as an extended footer and alternately as indicated in the client's top UI for a message).

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
