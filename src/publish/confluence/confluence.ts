//TODO Resource bundles

import { join } from "path/mod.ts";
import { generate as generateUuid } from "uuid/v4.ts";
import { Input, Secret } from "cliffy/prompt/mod.ts";
import { RenderFlags } from "../../command/render/types.ts";

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
import { Content, ContentBody, ContentUpdate, kPageType } from "./api/types.ts";
import { ensureTrailingSlash } from "../../core/path.ts";
import { withSpinner } from "../../core/console.ts";
import {
  isNotFound,
  isUnauthorized,
  transformAtlassianDomain,
  getMessageFromAPIError,
  tokenFilterOut,
  validateEmail,
  validateServer,
  validateToken,
  validateParentURL,
  confluenceParentFromString,
} from "./confluence-helper.ts";

import { verifyAccountToken, verifyLocation } from "./confluence-verify.ts";

export const CONFLUENCE_ID = "confluence";

const getAccountTokens = (): Promise<AccountToken[]> => {
  const getConfluenceEnvironmentAccount = () => {
    const server = Deno.env.get("CONFLUENCE_DOMAIN");
    const name = Deno.env.get("CONFLUENCE_USER_EMAIL");
    const token = Deno.env.get("CONFLUENCE_AUTH_TOKEN");
    if (server && name && token) {
      return {
        type: AccountTokenType.Environment,
        name,
        server: transformAtlassianDomain(server),
        token,
      };
    }
  };

  const readConfluenceAccessTokens = (): AccountToken[] => {
    const result = readAccessTokens<AccountToken>(CONFLUENCE_ID) ?? [];
    return result;
  };

  let accounts: AccountToken[] = [];

  const envAccount = getConfluenceEnvironmentAccount();
  if (envAccount) {
    accounts = [...accounts, envAccount];
  }

  const tempStoredAccessTokens = readConfluenceAccessTokens();
  accounts = [...accounts, ...tempStoredAccessTokens];
  return Promise.resolve(accounts);
};

const removeToken = (token: AccountToken) => {
  const existingTokens = readAccessTokens<AccountToken>(CONFLUENCE_ID) ?? [];

  const toWrite: Array<AccountToken> = existingTokens.filter((accessToken) =>
    tokenFilterOut(accessToken, token)
  );

  writeAccessTokens(CONFLUENCE_ID, toWrite);
};

const promptAndAuthorizeToken = async () => {
  const server: string = await Input.prompt({
    indent: "",
    message: "Confluence Domain:",
    hint: "e.g. https://mydomain.atlassian.net/",
    validate: validateServer,
    transform: transformAtlassianDomain,
  });

  await verifyLocation(server);

  const name = await Input.prompt({
    indent: "",
    message: `Confluence Account Email:`,
    validate: validateEmail,
  });

  const token = await Secret.prompt({
    indent: "",
    message: "Confluence API Token:",
    hint: "Create an API token at https://id.atlassian.com/manage/api-tokens",
    validate: validateToken,
  });

  const accountToken: AccountToken = {
    type: AccountTokenType.Authorized,
    name,
    server,
    token,
  };
  await withSpinner({ message: "Verifying account..." }, () =>
    verifyAccountToken(accountToken)
  );
  writeAccessToken<AccountToken>(
    CONFLUENCE_ID,
    accountToken,
    (a, b) => a.server === a.server && a.name === b.name
  );

  return Promise.resolve(accountToken);
};

const promptForParentURL = async () => {
  return await Input.prompt({
    indent: "",
    message: `Space or Parent Page URL:`,
    hint: "Browse in Confluence to the space or parent, then copy the URL",
    validate: validateParentURL,
  });
};

const resolveTarget = async (
  accountToken: AccountToken,
  target: PublishRecord
): Promise<PublishRecord> => {
  return Promise.resolve(target);
};

async function publish(
  account: AccountToken,
  type: "document" | "site",
  _input: string,
  title: string,
  _slug: string,
  render: (flags?: RenderFlags) => Promise<PublishFiles>,
  _options: PublishOptions,
  publishRecord?: PublishRecord
): Promise<[PublishRecord, URL | undefined]> {
  console.log("publishing...");
  console.log("type", type);
  console.log("title", title);
  console.log("publishRecord", publishRecord);

  const client = new ConfluenceClient(account);

  // determine the parent to publish into
  let parentUrl: string = publishRecord?.url ?? "";

  if (!parentUrl) {
    parentUrl = await promptForParentURL();
  }

  const parent = confluenceParentFromString(parentUrl);

  if (!parent) {
    throw new Error("Invalid Confluence parent URL: " + parentUrl);
  }

  verifyLocation(parentUrl);

  if (type === "document") {
    // render the document
    const flags: RenderFlags = {
      to: "confluence-publish",
    };
    const result = await render(flags);

    // body to publish
    const body: ContentBody = {
      storage: {
        value: Deno.readTextFileSync(join(result.baseDir, result.rootFile)),
        representation: "storage",
      },
    };

    let content: Content | undefined;
    if (publishRecord) {
      await withSpinner(
        {
          message: `Updating content at ${publishRecord.url}...`,
        },
        async () => {
          // for updates we need to get the existing version and increment by 1
          const prevContent = await client.getContent(publishRecord.id);

          // update the content
          const toCreate: ContentUpdate = {
            version: { number: (prevContent?.version?.number || 0) + 1 },
            title: `${title} ${generateUuid()}`,
            type: kPageType,
            status: "current",
            ancestors: null,
            body,
          };
          content = await client.updateContent(publishRecord.id, toCreate);
        }
      );
    } else {
      await withSpinner(
        {
          message: `Creating content in space ${parent.space}...`,
        },
        async () => {
          // for creates we need to get the space info
          const space = await client.getSpace(parent.space);

          // create the content
          content = await client.createContent({
            id: null,
            title: `${title} ${generateUuid()}`,
            type: kPageType,
            space,
            status: "current",
            ancestors: parent.parent ? [{ id: parent.parent }] : null,
            body,
          });
        }
      );
    }

    // if we got this far we have the content
    content = content!;

    // create publish record
    const newPublishRecord: PublishRecord = {
      id: content.id!,
      url: `${ensureTrailingSlash(account.server!)}wiki/spaces/${
        content.space!.key
      }/pages/${content.id}`,
    };
    // return record and browse url
    return [newPublishRecord, new URL(newPublishRecord.url!)];
  } else {
    throw new Error("Confluence site publishing not implemented");
  }
}

export const confluenceProvider: PublishProvider = {
  name: CONFLUENCE_ID,
  description: "Confluence",
  requiresServer: true,
  requiresRender: true,
  accountTokens: getAccountTokens,
  authorizeToken: promptAndAuthorizeToken,
  removeToken,
  resolveTarget,
  publish,
  isUnauthorized,
  isNotFound,
};
