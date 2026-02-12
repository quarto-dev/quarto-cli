---
main_commit: 54c7493e9
analyzed_date: 2026-02-10
key_files:
  - src/publish/provider-types.ts
  - src/publish/provider.ts
  - src/publish/publish.ts
  - src/publish/config.ts
  - src/publish/common/publish.ts
  - src/publish/common/bundle.ts
  - src/publish/common/account.ts
  - src/publish/types.ts
  - src/command/publish/cmd.ts
---

# Quarto Publishing Architecture

How `quarto publish` works internally. Covers the provider interface, publish patterns, account management, and the end-to-end publish flow.

## Provider Interface

File: `src/publish/provider-types.ts`

Every publish target implements `PublishProvider`:

```typescript
export interface PublishProvider {
  name: string;              // e.g. "netlify", "rsconnect", "quarto-pub"
  description: string;       // Human-readable name
  requiresServer: boolean;   // true if user provides server URL (e.g. rsconnect)
  hidden?: boolean;          // Hide from provider selection
  listOriginOnly?: boolean;  // Only list in origin project

  accountTokens(): Promise<AccountToken[]>;
  removeToken(token: AccountToken): void;
  authorizeToken(options: PublishOptions, target?: PublishRecord): Promise<AccountToken | undefined>;
  resolveTarget(account: AccountToken, target: PublishRecord): Promise<PublishRecord | undefined>;
  publish(
    account: AccountToken, type: "document" | "site", input: string,
    title: string, slug: string,
    render: (flags?: RenderFlags) => Promise<PublishFiles>,
    options: PublishOptions, target?: PublishRecord
  ): Promise<[PublishRecord | undefined, URL | undefined]>;
  isUnauthorized(error: Error): boolean;
  isNotFound(error: Error): boolean;
}
```

Key types:

- `AccountToken` — stored credential with `name`, `server?`, `token` (generic string or structured object)
- `AccountTokenType` — `"authorized"` (user-stored) or `"environment"` (env var)
- `PublishRecord` — entry in `_publish.yml` with `id`, `url`, `code?`
- `PublishFiles` — `{ baseDir: string, rootFile: string, files: string[], metafiles?: string[] }`

## Provider Registration

File: `src/publish/provider.ts`

Providers are imported and added to `kPublishProviders`:

```typescript
const kPublishProviders = [
  quartoPubProvider,
  ghpagesProvider,
  rsconnectProvider,
  netlifyProvider,
  confluenceProvider,
  huggingfaceProvider,
];
```

Discovery functions: `publishProviders()`, `findProvider(name)`.

There is also a deprecation warning for the old `posit-cloud` provider (removed in `142a8791f`) that suggests using `quarto-pub` instead. This should be updated when `posit-connect-cloud` is added.

## Two Publish Patterns

### Pattern A: File-by-file upload

Used by: `quarto-pub`, `netlify`

File: `src/publish/common/publish.ts`

Uses `handlePublish()` which:
1. SHA-1 hashes each file in the rendered output
2. Creates a deploy with a file manifest (listing all files + checksums)
3. Server responds with which files it needs (doesn't already have)
4. Uploads only changed files individually
5. Activates the deploy

Providers using this pattern implement `PublishHandler`:

```typescript
export interface PublishHandler {
  name: string;
  createSite(type, title, slug, account): Promise<[string, string]>;
  createDeploy(siteId, account, files): Promise<PublishDeploy>;
  getDeploy(deployId, account): Promise<PublishDeploy>;
  uploadDeployFile(deployId, path, fileBody, account): Promise<void>;
}
```

### Pattern B: Bundle upload

Used by: `rsconnect` (Posit Connect)

File: `src/publish/common/bundle.ts`

Uses `createBundle()` which:
1. Creates a `manifest.json` with file checksums, `appmode`, `content_category`, etc.
2. Packages all files + manifest into a `.tar.gz` archive
3. Returns `{ bundlePath: string, manifest: object }`

The provider then uploads the entire bundle as a single blob and triggers deployment. Each provider using this pattern has its own publish logic (not via `handlePublish()`).

`createBundle()` signature:
```typescript
function createBundle(
  type: "document" | "site",
  files: PublishFiles,
  tempContext: TempContext
): Promise<{ bundlePath: string; manifest: Record<string, unknown> }>
```

## End-to-End Publish Flow

### 1. CLI Entry

File: `src/command/publish/cmd.ts`

`quarto publish [provider] [path]` invokes `publishAction()`.

### 2. Resolve Deployment Target

File: `src/publish/config.ts`

Reads `_publish.yml` to find existing publish targets. Format:

```yaml
- source: document.qmd
  provider-name:
    - id: site-or-content-id
      url: https://published-url.example.com
```

### 3. Select Provider

If not specified on CLI, user is prompted to choose from available providers.

### 4. Resolve Account

File: `src/publish/common/account.ts`

Account resolution order:
1. Environment variable tokens (via provider's `accountTokens()`)
2. Stored tokens in `~/.quarto/publish/accounts/{provider}/accounts.json`
3. Interactive authorization (via provider's `authorizeToken()`)

Token storage functions:
- `readAccessTokens<T>(provider)` — reads stored tokens
- `writeAccessToken<T>(provider, token, compareFn)` — writes/updates token
- `readAccessTokenFile(provider)` — raw file path

### 5. Publish

File: `src/publish/publish.ts`

`publishSite()` or `publishDocument()` coordinates:
1. Calls `render()` to produce output files
2. Calls provider's `publish()` with the rendered files
3. Provider uploads and deploys
4. Returns `[PublishRecord, URL]`

### 6. Update `_publish.yml`

File: `src/publish/config.ts`

The returned `PublishRecord` is written back to `_publish.yml` for future republishing.

## Account / Token Management

File: `src/publish/common/account.ts`

### Storage

Tokens stored at: `~/.quarto/publish/accounts/{provider}/accounts.json`

Format: JSON array of `AccountToken` objects. The `token` field is provider-specific (can be a string or structured object).

### Authorization Patterns

**Ticket-based auth** (quarto-pub): `authorizeAccessToken()` in `src/publish/common/account.ts`
- Opens browser to auth URL
- Polls a ticket endpoint until user completes auth
- Exchanges ticket for access token

**API key auth** (rsconnect): User provides API key directly or via env var.

**OAuth Device Code** (posit-connect-cloud): Uses RFC 8628 Device Code flow. See `src/publish/posit-connect-cloud/api/index.ts` for implementation.

### Environment Variables

Each provider can check for env vars in `accountTokens()`. Convention:
- `QUARTO_PUB_AUTH_TOKEN`
- `CONNECT_SERVER` + `CONNECT_API_KEY` (rsconnect)
- `NETLIFY_AUTH_TOKEN`

## Existing Providers Summary

| Provider | Pattern | Auth | `requiresServer` |
|----------|---------|------|-------------------|
| `quarto-pub` | A (file-by-file) | Ticket-based OAuth | false |
| `netlify` | A (file-by-file) | API key / env var | false |
| `rsconnect` | B (bundle) | API key (`Key <key>`) | true |
| `ghpages` | Custom (git push) | Git credentials | false |
| `confluence` | Custom | API token | true |
| `huggingface` | Custom | HF token | false |

## Reusable Utilities

| Utility | File | Purpose |
|---------|------|---------|
| `createBundle()` | `src/publish/common/bundle.ts` | tar.gz bundle with manifest.json |
| `readAccessTokens<T>()` | `src/publish/common/account.ts` | Read stored tokens |
| `writeAccessToken<T>()` | `src/publish/common/account.ts` | Write/update token |
| `authorizeAccessToken()` | `src/publish/common/account.ts` | Ticket-based auth flow |
| `handlePublish()` | `src/publish/common/publish.ts` | File-by-file upload orchestration |
| `withSpinner()` | `src/core/console.ts` | Progress spinner display |
| `completeMessage()` | `src/core/console.ts` | Success/failure messages |
| `createTempContext()` | `src/core/temp.ts` | Temp file management |
| `openUrl()` | `src/core/shell.ts` | Open URL in browser |
| `isServerSession()` | `src/core/platform.ts` | Detect headless/CI environment |
| `ApiError` | `src/publish/types.ts` | HTTP error type with status code |
