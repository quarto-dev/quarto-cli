import { join } from "path/mod.ts";
import { Input, Secret } from "cliffy/prompt/mod.ts";
import { RenderFlags } from "../../command/render/types.ts";
import { dirAndStem, ensureTrailingSlash } from "../../core/path.ts";
import { resourcePath } from "../../core/resources.ts";
import { isHttpUrl } from "../../core/url.ts";

import {
  readAccessTokens,
  writeAccessToken,
  writeAccessTokens,
} from "../common/account.ts";
import {
  AccountToken,
  AccountTokenType,
  PublishFiles,
  PublishProvider,
} from "../provider.ts";
import { ApiError, PublishOptions, PublishRecord } from "../types.ts";
import { ConfluenceClient } from "./api/index.ts";
import { kOutputDivs, kOutputExt } from "../../config/constants.ts";

export const kConfluence = "confluence";

const kConfluenceDescription = "Confluence";

const kConfluenceDomain = "CONFLUENCE_DOMAIN";
const kConfluenceUserEmail = "CONFLUENCE_USER_EMAIL";
const kConfluenceAuthToken = "CONFLUENCE_AUTH_TOKEN";

export const confluenceProvider: PublishProvider = {
  name: kConfluence,
  description: kConfluenceDescription,
  requiresServer: true,
  listOriginOnly: false,
  requiresRender: true,
  accountTokens,
  authorizeToken,
  removeToken,
  resolveTarget,
  publish,
  isUnauthorized,
  isNotFound,
};

function accountTokens() {
  const accounts: AccountToken[] = [];

  // account based on environment variables
  const envAccount = confluenceEnvironmentVarAccount();
  if (envAccount) {
    accounts.push(envAccount);
  }

  // read any other tokens that are stored
  accounts.push(...(readAccessTokens<AccountToken>(kConfluence) || []));

  // return the accounts
  return Promise.resolve(accounts);
}

function confluenceEnvironmentVarAccount() {
  const server = Deno.env.get(kConfluenceDomain);
  const name = Deno.env.get(kConfluenceUserEmail);
  const token = Deno.env.get(kConfluenceAuthToken);
  if (server && name && token) {
    return {
      type: AccountTokenType.Environment,
      name,
      server: transformAtlassianDomain(server),
      token,
    };
  }
}

async function authorizeToken(_options: PublishOptions) {
  // TODO: validate that:
  //   - the server exists
  //   - the username exists
  //   - the token works
  // This can be done in while(true) loops that call the prompt functions
  // and validate as appropriate. It could also be done in a single
  // call to getUser at the end

  const server = await Input.prompt({
    indent: "",
    message: "Confluence Domain:",
    hint: "e.g. https://mydomain.atlassian.net/",
    validate: (value) => {
      // 'Enter' with no value ends publish
      if (value.length === 0) {
        throw new Error();
      }
      try {
        new URL(transformAtlassianDomain(value));
        return true;
      } catch {
        return `${value} is not a valid URL`;
      }
    },
    transform: transformAtlassianDomain,
  });

  const name = await Input.prompt({
    indent: "",
    message: `Confluence Account Email:`,
  });
  if (name.length === 0) {
    throw new Error();
  }

  const token = await Secret.prompt({
    indent: "",
    message: "Confluence API Token:",
    hint: "Create an API token at https://id.atlassian.com/manage/api-tokens",
  });
  // 'Enter' with no value ends publish
  if (token.length === 0) {
    throw new Error();
  }

  // create the token
  const accountToken: AccountToken = {
    type: AccountTokenType.Authorized,
    name,
    server,
    token,
  };

  // verify that the token works
  try {
    const client = new ConfluenceClient(accountToken);
    await client.getUser();
  } catch (err) {
    const msg = err instanceof ApiError
      ? `${err.status} - ${err.statusText}`
      : err.message || "Unknown error";
    throw new Error(`Unable to sign into Confluence account: ${msg}`);
  }

  // save it
  writeAccessToken<AccountToken>(
    kConfluence,
    accountToken,
    (a, b) => a.server === a.server && a.name === b.name,
  );

  return Promise.resolve(accountToken);
}

function transformAtlassianDomain(domain: string) {
  return ensureTrailingSlash(
    isHttpUrl(domain) ? domain : `https://${domain}.atlassian.net`,
  );
}

function removeToken(token: AccountToken) {
  writeAccessTokens(
    confluenceProvider.name,
    readAccessTokens<AccountToken>(confluenceProvider.name)?.filter(
      (accessToken) => {
        return accessToken.server !== token.server &&
          accessToken.name !== token.name;
      },
    ) || [],
  );
}

function resolveTarget(
  _account: AccountToken,
  target: PublishRecord,
): Promise<PublishRecord | undefined> {
  // TODO: confirm that the specified target exists and return a modified
  // version w/ any update to the URL which has occurred (this may not be
  //  a thing in confluence so just validating may be enough)
  return Promise.resolve(target);
}

async function publish(
  account: AccountToken,
  type: "document" | "site",
  _input: string,
  _title: string,
  _slug: string,
  render: (flags?: RenderFlags) => Promise<PublishFiles>,
  _options: PublishOptions,
  target?: PublishRecord,
): Promise<[PublishRecord, URL | undefined]> {
  // REST api
  const client = new ConfluenceClient(account);

  if (target) {
    // update
  } else {
    // new content
  }

  if (type === "document") {
    const flags: RenderFlags = {
      to: resourcePath("extensions/confluence/publish.lua"),
      metadata: {
        [kOutputExt]: "xml",
      },
    };
    const result = await render(flags);
    console.log(result);

    throw new Error("Confluence document publishing not implemented");
  } else {
    throw new Error("Confluence site publishing not implemented");
  }
}

function isUnauthorized(err: Error) {
  console.error(err);
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

function isNotFound(err: Error) {
  return err instanceof ApiError && (err.status === 404);
}
