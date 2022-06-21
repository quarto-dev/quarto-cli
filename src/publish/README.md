# Quarto Publish

## Overview

The `quarto publish` command enables you to easily publish websites and documents to a variety of services, including [Netlify](https://www.netlify.com/), [GitHub Pages](https://pages.github.com/) and [RStudio Connect](https://www.rstudio.com/products/connect/) (more services will be added over time).

To publish a website or book, just execute `quarto publish` from within the project directory:

```bash
quarto publish
```

As with `quarto render`, you can also publish a project or document by name:

```bash
quarto publish myblog
quarto publish document.qmd
```

If you haven't previously published the target, you'll be prompted for a publishing destination (including which service you want to publish to, account credentials, etc.). If you have published before you'll get a confirmation prompt for re-publishing (along with the choice to publish to publish to another destination).

## Publish Records

A record of your previous publishes will be stored in a `_publish.yml` file within the project or document directory. This file stores the service, id, and URL of the published content. For example:

```yaml
- source: project
  netlify:
    - id: "5f3abafe-68f9-4c1d-835b-9d668b892001"
      url: "https://tubular-unicorn-97bb3c.netlify.app"
  connect:
    - id: "3bb5f59f-524a-45a5-9508-77e29a1e8bf0"
      url: "https://rsc.radixu.com/content/3bb5f59f-524a-45a5-9508-77e29a1e8bf0/"
```

Account information is not stored in this file, so it is suitable for checking in to version control and being shared by multiple publishers.

If you provide the `--id` option (described below) then a publish record is not saved (as in that case you already have another means for tracking published content).

## GitHub Pages

Publising to GitHub Pages works a little differently than to other providers. Rather than interacting with a remote API and writing publish records to `_publish.yml`, a special `gh-pages` branch is created and the contents of your `_site` or `_book` directory is pushed to this branch (GitHub will automatically publish a website when it sees a `gh-pages` branch created).

It's possible to publish websites to services outside of github.com (e.g. GitHub Enterprise or GitLab) however two conditions need to be met in order for this to work properly:

1. Automatic publisihng of `gh-pages` branches must be a feature of the server you are publishing to (alternatively you may need to manually configure this for your repository).

2. Ideally, `quarto publish` should be aware of the URL that will be used to access the published site (so that it can correctly write social metadata, a sitemap, and RSS feeds, all of which require absolute URLs). This URL can be deduced automatically for github.com but for other servers you should include a `site-url` in your website or book configuration. Alternatively, if you are providing a custom domain name using a `CNAME` file in the root of your repository that will also be consulted to determine the site's URL.

## Headless / CI Usage

As an alternative to providing account credentials interactively, you case use the following environment variables:

| Service         | Variables                              |
| --------------- | -------------------------------------- |
| Netlify         | `NETLIFY_AUTH_TOKEN`                   |
| RStudio Connect | `CONNECT_SERVER` and `CONNECT_API_KEY` |

Using an environment variable combined with a `_publish.yml` file that points to the requisite publishing destination is enough to enable the following command to perform a headless publish on CI:

```bash
quarto publish
```

GitHub Pages publishing requires no special environment variables (as it use the version of git available on your system or on the CI server).

### Command Line

As an alternative to using a `_publish.yml` file, you can also specify your publish destination explicilty on the command line using a provider name (e.g. `netlify` or `connect`) along with the `--id` option. For example:

```bash
quarto publish netlify --id DDA36416-F950-4647-815C-01A24233E294
```

If your credentials are not stored in an environment variable as described above, you can optionally provide them the command line. For example:

```bash
quarto publish netlify --id DDA36416-F950-4647-815C-01A24233E294 --token 7C0947A852D8
```

When publishing to RStudio Connect you should make sure that the server, token, and id are all available either via environment variables or the command line. For example:

```bash
# via environment variablee
export CONNECT_SERVER=https://connect.example.com/
export CONNECT_API_KEY=7C0947A852D8
quarto publish connect --id DDA36416-F950-4647-815C-01A24233E294

# via command line
quarto publish connect \
   --server https://connect.example.com/ \
   --token 7C0947A852D8 \
   --id DDA36416-F950-4647-815C-01A24233E294
```

## Publish Options

By default `quarto publish` will prompt you to confirm actions, automatically re-render prior to publishing, and open a browser to the admin page for the published content after it completes. You can override this behavior using the following options:

| Option       | Behavior                                  |
| ------------ | ----------------------------------------- |
| --no-prompt  | Do not prompt to confirm publish actions. |
| --no-browser | Do not open a browser after publish.      |
| --no-render  | Do not re-render prior to publish         |

Note that when running in a non-interactive context (e.g. on a CI server) `quarto publish` will automatically disable prompting and opening a browser.

## Account Management

When you provide credentials for a publishing service they are remembered for future interactions with that same service (credentials are stored in the user app data directory with restrictive file permissions). If you want to review and/or remove registered accounts, execute the `quarto publish accounts` command:

```bash
$ quarto publish accounts
```

You'll be presented with a list of accounts and you can interactively select one more accounts to remove.
