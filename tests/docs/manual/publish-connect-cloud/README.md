# Manual Testing: quarto publish posit-connect-cloud

Testing protocol for the Posit Connect Cloud publish provider.

## Prerequisites

- Dev quarto built (`./configure.cmd` completed)
- Browser available for OAuth flow

## Setup

To test against staging instead of production, set the environment:

```bash
export POSIT_CONNECT_CLOUD_ENVIRONMENT=staging
```

Dev quarto path (from repo root):

```bash
# Windows
./package/dist/bin/quarto.cmd

# Linux/macOS
./package/dist/bin/quarto
```

Token storage location:
- Windows: `%LOCALAPPDATA%\quarto\publish\accounts\posit-connect-cloud\accounts.json`
- macOS/Linux: `~/.local/share/quarto/publish/accounts/posit-connect-cloud/accounts.json`

---

## Test 1: First-Time Authorization

Verify the OAuth device code flow works end-to-end.

**Pre-condition:** No existing posit-connect-cloud accounts. Check with:

```bash
./package/dist/bin/quarto.cmd publish accounts
```

**Run:**

```bash
./package/dist/bin/quarto.cmd publish posit-connect-cloud tests/docs/manual/publish-connect-cloud/single-doc/document.qmd
```

**Expected behavior:**

1. Prompt: "Authorize" confirmation
2. Authorization code displayed (green, bold)
3. Browser opens to login page (the code is pre-filled in URL)
4. After approving in browser, terminal resumes automatically
5. If no publishable accounts: browser opens account creation, spinner shows "Waiting for account setup"
6. If one account: auto-selected with debug message
7. If multiple accounts: interactive selection prompt
8. Confirmation: "Authorized to publish as **account-name**"
9. Rendering happens
10. Spinner: "Uploading files"
11. Spinner: "Publishing document"
12. Final message: `Published: https://...connect.posit.cloud/<account>/content/<id>`
13. Browser opens to published content

**Check:**

- [ ] Auth code shown in terminal
- [ ] Browser opens automatically
- [ ] No manual code entry required (pre-filled URL)
- [ ] Account selected/created
- [ ] Document published and accessible at URL
- [ ] Content renders correctly in browser (title, formatting, link)
- [ ] Account shows server URL in prompt (e.g. `cderv (https://connect.posit.cloud)`)

**Record:** Account name: ___ | Content ID: ___ | URL: ___

---

## Test 2: Token Persistence

Verify re-publish works without re-authorization.

**Pre-condition:** Test 1 completed. Close the terminal entirely.

**Run (in fresh terminal):**

```bash
./package/dist/bin/quarto.cmd publish posit-connect-cloud tests/docs/manual/publish-connect-cloud/single-doc/document.qmd
```

**Check:**

- [ ] No authorization flow triggered
- [ ] Existing target detected from `_publish.yml`
- [ ] Publish succeeds
- [ ] URL unchanged from Test 1

---

## Test 3: Publish a Website

Verify multi-page site publishing.

**Run:**

```bash
./package/dist/bin/quarto.cmd publish posit-connect-cloud tests/docs/manual/publish-connect-cloud/simple-website
```

**Check in browser:**

- [ ] Home page loads with correct title
- [ ] Navbar present with "Home" and "About" links
- [ ] Click "About" -> about page loads
- [ ] Click "Home" -> home page loads
- [ ] Both pages render correctly
- [ ] Published as new content (different URL from Test 1)

**Record:** Content ID: ___ | URL: ___

---

## Test 4: Update Existing Content

Verify re-publishing updates content in-place.

**Setup:** Edit `simple-website/index.qmd` — add a line:

```markdown
This content was updated for Test 4.
```

**Run:**

```bash
./package/dist/bin/quarto.cmd publish posit-connect-cloud tests/docs/manual/publish-connect-cloud/simple-website
```

**Check:**

- [ ] URL is same as Test 3
- [ ] Hard-refresh (Ctrl+F5) shows updated text
- [ ] About page still works
- [ ] No duplicate content created on dashboard

**Cleanup:** Revert the edit:

```bash
git checkout tests/docs/manual/publish-connect-cloud/simple-website/index.qmd
```

---

## Test 5: Account Management

Verify accounts listing and removal.

**Run:**

```bash
./package/dist/bin/quarto.cmd publish accounts
```

**Check:**

- [ ] Posit Connect Cloud account(s) listed
- [ ] Account name from Test 1 shown
- [ ] Server URL displayed next to account name

**Remove the account** (select it from the interactive menu, confirm removal).

**Verify removed**, then **re-authorize** (needed for remaining tests):

```bash
./package/dist/bin/quarto.cmd publish posit-connect-cloud tests/docs/manual/publish-connect-cloud/single-doc/document.qmd
```

---

## Test 6: CI/CD Mode (Environment Token)

Verify non-interactive publishing with environment variables.

**Setup:** Extract the stored token:

```bash
cat "$LOCALAPPDATA/quarto/publish/accounts/posit-connect-cloud/accounts.json"
```

Note the `accessToken` and `accountId` values.

**Set env vars and remove stored account:**

```bash
export POSIT_CONNECT_CLOUD_ACCESS_TOKEN="<accessToken>"
export POSIT_CONNECT_CLOUD_ACCOUNT_ID="<accountId>"
```

Remove stored accounts via `quarto publish accounts` so only env var token is used.

**Run:**

```bash
./package/dist/bin/quarto.cmd publish posit-connect-cloud tests/docs/manual/publish-connect-cloud/single-doc/document.qmd --no-prompt
```

**Check:**

- [ ] No browser opens
- [ ] No interactive prompts
- [ ] Token from environment variable used
- [ ] Account resolved from ACCOUNT_ID
- [ ] Publish succeeds

**Cleanup:**

```bash
unset POSIT_CONNECT_CLOUD_ACCESS_TOKEN
unset POSIT_CONNECT_CLOUD_ACCOUNT_ID
```

Re-authorize interactively for remaining tests.

---

## Test 7: Provider Selection (Interactive)

Verify posit-connect-cloud appears in the interactive provider menu.

**Run:**

```bash
./package/dist/bin/quarto.cmd publish tests/docs/manual/publish-connect-cloud/single-doc/document.qmd
```

(No provider argument — triggers interactive selection.)

**Check:**

- [ ] "Provider:" prompt shown
- [ ] "Posit Connect Cloud" listed as an option
- [ ] Selecting it proceeds to publish flow
- [ ] Ctrl+C to cancel (or complete the publish)

---

## Test 8: posit-cloud Deprecation Warning

Verify the old provider name shows a helpful warning.

**Run:**

```bash
./package/dist/bin/quarto.cmd publish posit-cloud tests/docs/manual/publish-connect-cloud/single-doc/document.qmd
```

**Check:**

- [ ] Warning message displayed
- [ ] Message mentions "no longer supported"
- [ ] Message suggests `posit-connect-cloud`
- [ ] Message includes link to docs.posit.co
- [ ] Command fails (provider not found after warning)

---

## Test 9: Error Cases

### 9a: Invalid Token

```bash
export POSIT_CONNECT_CLOUD_ACCESS_TOKEN="invalid_garbage_token"
./package/dist/bin/quarto.cmd publish posit-connect-cloud tests/docs/manual/publish-connect-cloud/single-doc/document.qmd
```

- [ ] Clear authentication error
- [ ] No crash/stacktrace

```bash
unset POSIT_CONNECT_CLOUD_ACCESS_TOKEN
```

### 9b: Deleted Content

1. Publish the single doc (or use existing from Test 1)
2. Delete the content from the Connect Cloud dashboard
3. Re-publish:

```bash
./package/dist/bin/quarto.cmd publish posit-connect-cloud tests/docs/manual/publish-connect-cloud/single-doc/document.qmd
```

- [ ] Detects content is gone (deleted or 404)
- [ ] Prompts as new publish (or creates new content)
- [ ] Publishes successfully with new content ID

### 9c: --no-render Flag

```bash
./package/dist/bin/quarto.cmd publish posit-connect-cloud tests/docs/manual/publish-connect-cloud/single-doc/document.qmd --no-render
```

- [ ] Skips rendering
- [ ] Still uploads and publishes (uses last rendered output)

**Known issue:** `--no-render` may produce incomplete bundles for single documents (missing supporting resources). This affects all bundle-based providers, not just Connect Cloud.

---

## Test 10: Token Refresh

Access tokens expire after some time. To test proactive refresh:

1. Open the stored token file (see token storage path in Setup)
2. Change `expiresAt` to a past timestamp (e.g., `1000`)
3. Publish:
   ```bash
   ./package/dist/bin/quarto.cmd publish posit-connect-cloud tests/docs/manual/publish-connect-cloud/single-doc/document.qmd
   ```

- [ ] Publish succeeds (token refreshed automatically)
- [ ] Check stored token file: `expiresAt` updated to future value
- [ ] No re-authorization prompt

---

## Results Template

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | First-time authorization | | |
| 2 | Token persistence | | |
| 3 | Publish website | | |
| 4 | Update existing content | | |
| 5 | Account management | | |
| 6 | CI/CD mode | | |
| 7 | Provider selection | | |
| 8 | posit-cloud deprecation | | |
| 9a | Invalid token error | | |
| 9b | Deleted content | | |
| 9c | --no-render flag | | |
| 10 | Token refresh | | |

## Post-Testing Cleanup

1. Delete test content from the Connect Cloud dashboard
2. Remove stored tokens:
   ```bash
   ./package/dist/bin/quarto.cmd publish accounts
   ```
3. Unset env vars:
   ```bash
   unset POSIT_CONNECT_CLOUD_ENVIRONMENT
   unset POSIT_CONNECT_CLOUD_ACCESS_TOKEN
   unset POSIT_CONNECT_CLOUD_REFRESH_TOKEN
   unset POSIT_CONNECT_CLOUD_ACCOUNT_ID
   ```
4. Revert any test fixture edits:
   ```bash
   git checkout tests/docs/manual/publish-connect-cloud/
   ```
5. Test artifacts (`_publish.yml`, `_site/`, rendered HTML) are covered by `.gitignore` in each fixture directory.
