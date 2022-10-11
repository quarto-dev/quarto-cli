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
} from "./confluence-helper.ts";

import { verifyAccountToken, verifyServerExists } from "./confluence-verify.ts";

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
  await withSpinner({ message: "Verifying server..." }, () =>
    verifyServerExists(server)
  );

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
  target?: PublishRecord
): Promise<[PublishRecord, URL | undefined]> {
  // REST api
  const client = new ConfluenceClient(account);

  // determine the parent to publish into
  let parentUrl = target?.url;

  if (!target) {
    parentUrl = await Input.prompt({
      indent: "",
      message: `Space or Parent Page URL:`,
      hint: "Browse in Confluence to the space or parent, then copy the URL",
    });
    if (parentUrl.length === 0) {
      throw new Error();
    }
  }
  // TODO: the only way this could happen is if there is no `url` in the _publish.yml
  // file. We will _always_ write one, but the user could remove it by hand. We could
  // recover from this by finding the parentUrl via the REST API just given an ID,
  // but perhaps not worth it? Users should just not remove the URL.
  if (parentUrl === undefined) {
    throw new Error("No Confuence parent URL to publish to");
  }

  // parse the parent
  const parent = confluenceParent(parentUrl);

  if (!parent) {
    throw new Error("Invalid Confluence parent URL: " + parentUrl);
  }

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
    if (target) {
      await withSpinner(
        {
          message: `Updating content at ${target.url}...`,
        },
        async () => {
          // for updates we need to get the existing version and increment by 1
          const prevContent = await client.getContent(target.id);

          // update the content
          const toCreate: ContentUpdate = {
            version: { number: (prevContent?.version?.number || 0) + 1 },
            title: `${title} ${generateUuid()}`,
            type: kPageType,
            status: "current",
            ancestors: null,
            body,
          };
          content = await client.updateContent(target.id, toCreate);
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
    const publishRecord: PublishRecord = {
      id: content.id!,
      url: `${ensureTrailingSlash(account.server!)}wiki/spaces/${
        content.space!.key
      }/pages/${content.id}`,
    };
    // return record and browse url
    return [publishRecord, new URL(publishRecord.url!)];
  } else {
    throw new Error("Confluence site publishing not implemented");
  }
}

type ConfluenceParent = {
  space: string;
  parent?: string;
};

//TODO extract to helper and test
function confluenceParent(url: string): ConfluenceParent | undefined {
  // https://rstudiopbc.atlassian.net/wiki/spaces/OPESOUGRO/overview
  // https://rstudiopbc.atlassian.net/wiki/spaces/OPESOUGRO/pages/100565233/Quarto
  const match = url.match(
    /^https.*?wiki\/spaces\/(?:(\w+)|(\w+)\/overview|(\w+)\/pages\/(\d+).*)$/
  );
  if (match) {
    return {
      space: match[1] || match[2] || match[3],
      parent: match[4],
    };
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
