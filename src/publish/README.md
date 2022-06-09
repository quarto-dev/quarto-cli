# Quarto Publish

## Overview

The `quarto publish` command enables you to easily publish websites and documents to a variety of services, including [Netlify](https://www.netlify.com/) and [RStudio Connect](https://www.rstudio.com/products/connect/) (more services will be added over time).

To publish a website or book, just execute `quarto publish` from within the project directory:

``` bash
quarto publish
```

As with `quarto render`, you can also publish a project or document by name:

``` bash
quarto publish myblog
quarto publish document.qmd
```

If you haven't previously published the target, you'll be prompted for a publishing destination (including which service you want to publish to, account credentials, etc.). If you have published before you'll get a confirmation prompt for re-publishing (along with the choice to publish elsewhere).

## Publish Records

A record of your previous publishes will be stored in a `_publish.yml` file within the project or document directory. This file stores the service, id, and URL of the published content. For example:

``` yaml
- source: project
  netlify:
    - id: '5f3abafe-68f9-4c1d-835b-9d668b892001'
      url: 'https://tubular-unicorn-97bb3c.netlify.app'
  connect:
    - id: '3bb5f59f-524a-45a5-9508-77e29a1e8bf0'
      url: 'https://rsc.radixu.com/content/3bb5f59f-524a-45a5-9508-77e29a1e8bf0/'
```

Note that account information is not stored in this file, so it is suitable for checking in to version control and being shared by multiple publishers.

## Publish Options

By default `quarto publish` will prompt you to confirm actions, automatically re-render prior to publishing, and open a browser to the admin page for the published content after it completes. You can override this behavior using the following options:

| Option         | Behavior                                                                                                                                                    |
|----------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `--no-prompt`  | Do not prompt to confirm publish actions. Note that this is automatically enabled when not running in a terminal or other interactive context (e.g. on CI). |
| `--no-browser` | Do not open a browser after publish (also disabled automatically on CI).                                                                                    |
| `--no-render`  | Do not re-render prior to publish (use existing rendered content even if its stale visa-vi the source code).                                                |

## Headless / CI Usage

As an alternative to providing account credentials interactively, you case use the following environment variables:

| Service         | Variables                              |
|-----------------|----------------------------------------|
| Netlify         | `NETLIFY_AUTH_TOKEN`                   |
| RStudio Connect | `CONNECT_SERVER` and `CONNECT_API_KEY` |

Using an environment variable combined with a `_publish.yml` file that points to the requisite publishing destination is enough to enable the following command to perform a headless publish on CI:

``` bash
quarto publish
```

If you have multiple targets defined in `_publish.yml` then you can disambiguate with the `--site-id` parameter:

``` bash
quarto publish --site-id 5f3abafe-68f9-4c1d-835b-9d668b892001
```

## Account Management

When you provide credentials for a publishing service they are remembered for future interactions with that same service (credentials are stored in the user app data directory with restrictive file permissions). If you want to review and/or remove registered accounts, execute the `quarto publish accounts` command:

``` bash
$ quarto publish accounts
```

You'll be presented with a list of accounts and you can interactively select one more accounts to remove.
