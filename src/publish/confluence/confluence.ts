import { join } from "path/mod.ts";
import { Input, Secret } from "cliffy/prompt/mod.ts";
import { RenderFlags } from "../../command/render/types.ts";
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
import { Content, ContentBody, kPageType } from "./api/types.ts";
import { ensureTrailingSlash } from "../../core/path.ts";
import { withSpinner } from "../../core/console.ts";

export const kConfluenceId = "confluence";
const kConfluenceDescription = "Confluence";

export const transformAtlassianDomain = (domain: string) => {
  return ensureTrailingSlash(
      isHttpUrl(domain) ? domain : `https://${domain}.atlassian.net`
  );
}

const confluenceEnvironmentVarAccount = () => {
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
  const result = readAccessTokens<AccountToken>(kConfluenceId) ?? [];
  return result;
};

const accountTokens = ():Promise<AccountToken[]> => {
  let accounts: AccountToken[] = [];

  const envAccount = confluenceEnvironmentVarAccount();
  if (envAccount) {
    accounts = [...accounts, envAccount];
  }

  const tempStoredAccessTokens = readConfluenceAccessTokens();
  accounts = [...accounts, ...tempStoredAccessTokens];
  return Promise.resolve(accounts);
};

export const validateServer = (value:string):boolean => {
  // 'Enter' with no value ends publish
  if (value.length === 0) {
    throw new Error('');
  }
  try {
    new URL(transformAtlassianDomain(value));
    return true;
  } catch {
    throw new Error(`${value} is not a valid URL`);
  }
};

export const validateEmail = (value:string):boolean => {
  // 'Enter' with no value exits publish
  if (value.length === 0) {
    throw new Error('');
  }

  // TODO use deno validation
  // https://deno.land/x/validation@v0.4.0
  const expression: RegExp = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  return expression.test(value);
};

/**
 * When Authorizing a new Account
 */
const authorizeToken = async () => {

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
    validate: validateServer,
    transform: transformAtlassianDomain,
  });

  const name = await Input.prompt({
    indent: "",
    message: `Confluence Account Email:`,
    validate: validateEmail
  });

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
    const msg =
      err instanceof ApiError
        ? `${err.status} - ${err.statusText}`
        : err.message || "Unknown error";
    throw new Error(`Unable to sign into Confluence account: ${msg}`);
  }

  // save it
  writeAccessToken<AccountToken>(
    kConfluenceId,
    accountToken,
    (a, b) => a.server === a.server && a.name === b.name
  );

  return Promise.resolve(accountToken);
}

function removeToken(token: AccountToken) {
  writeAccessTokens(
    confluenceProvider.name,
    readAccessTokens<AccountToken>(confluenceProvider.name)?.filter(
      (accessToken) => {
        return (
          accessToken.server !== token.server && accessToken.name !== token.name
        );
      }
    ) || []
  );
}

function resolveTarget(
  _account: AccountToken,
  target: PublishRecord
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
  title: string,
  _slug: string,
  render: (flags?: RenderFlags) => Promise<PublishFiles>,
  _options: PublishOptions,
  target?: PublishRecord
): Promise<[PublishRecord, URL | undefined]> {
  console.log("publish");

  // REST api
  const client = new ConfluenceClient(account);

  // determine the parent to publish into
  let parentUrl = target?.url;
  if (!target) {
    // user needs to tell us where to publish!
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
          content = await client.updateContent(target.id, {
            version: { number: (prevContent?.version?.number || 0) + 1 },
            title,
            type: kPageType,
            status: "current",
            ancestors: null,
            body,
          });
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
          console.log('space', space)
          // create the content
          content = await client.createContent({
            id: null,
            title,
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

function isUnauthorized(err: Error) {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

function isNotFound(err: Error) {
  return err instanceof ApiError && err.status === 404;
}

type ConfluenceParent = {
  space: string;
  parent?: string;
};

//TODO Write a Unit Test for this
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
  name: kConfluenceId,
  description: kConfluenceDescription,
  requiresServer: true,
  requiresRender: true,
  accountTokens,
  authorizeToken,
  removeToken,
  resolveTarget,
  publish,
  isUnauthorized,
  isNotFound,
};
