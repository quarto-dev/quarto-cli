# Quarto Publish

## Overview

The `quarto publish` command enables you to easily publish websites and documents to a variety of services, including [Netlify](https://www.netlify.com/), [GitHub Pages](https://pages.github.com/) and [Posit Connect](https://posit.co/products/enterprise/connect/) (more services will be added over time).

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

Note that GitHub Pages publishes are not stored in the `_publish.yml` file (they are tracked by virtue of the creation of a `gh-pages` branch).

If you provide the `--id` option (described below) then a publish record is not saved (as in that case you already have another means for tracking published content).

## Headless / CI Usage

As an alternative to providing account credentials interactively, you case use the following environment variables:

| Service        | Variables                              |
| -------------- | -------------------------------------- |
| Netlify        | `NETLIFY_AUTH_TOKEN`                   |
| Postit Connect | `CONNECT_SERVER` and `CONNECT_API_KEY` |

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

When publishing to Posit Connect you should make sure that the server, token, and id are all available either via environment variables or the command line. For example:

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
