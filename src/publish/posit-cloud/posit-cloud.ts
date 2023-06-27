/*
 * posit-cloud.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */
import { info } from "log/mod.ts";
import * as colors from "fmt/colors.ts";

import { Input } from "cliffy/prompt/input.ts";
import { Secret } from "cliffy/prompt/secret.ts";

import {
  AccountToken,
  AccountTokenType,
  PublishFiles,
  PublishProvider,
} from "../provider-types.ts";
import { ApiError, PublishOptions, PublishRecord } from "../types.ts";
import { PositCloudClient, UploadClient } from "./api/index.ts";
import { Content } from "./api/types.ts";
import {
  readAccessTokens,
  writeAccessToken,
  writeAccessTokens,
} from "../common/account.ts";

import { createTempContext } from "../../core/temp.ts";
import { completeMessage, withSpinner } from "../../core/console.ts";
import { RenderFlags } from "../../command/render/types.ts";
import { createBundle } from "../common/bundle.ts";
import { md5HashBytes } from "../../core/hash.ts";

export const kPositCloud = "posit-cloud";
const kPositCloudDescription = "Posit Cloud";

export const kPositCloudServerVar = "POSIT_CLOUD_SERVER";
export const kPositCloudTokenVar = "POSIT_CLOUD_TOKEN";
export const kPositCloudAuthTokenSecretVar = "POSIT_CLOUD_SECRET";

export const positCloudProvider: PublishProvider = {
  name: kPositCloud,
  description: kPositCloudDescription,
  requiresServer: true,
  listOriginOnly: true,
  accountTokens,
  authorizeToken,
  removeToken,
  resolveTarget,
  publish,
  isUnauthorized,
  isNotFound,
};

type Account = {
  username: string;
  token: string;
  tokenSecret: string;
};

function getServer(): string {
  return Deno.env.get(kPositCloudServerVar) || "https://api.posit.cloud";
}

function createClientFromAccountToken(
  accountToken: AccountToken,
): PositCloudClient {
  const [token, tokenSecret] = accountToken.token.split("|");
  return new PositCloudClient(getServer(), token, tokenSecret);
}

function combineTokenAndSecret(token: string, tokenSecret: string): string {
  return `${token}|${tokenSecret}`;
}

function accountTokens() {
  const accounts: AccountToken[] = [];

  // check for environment variable
  const server = Deno.env.get(kPositCloudServerVar);
  const token = Deno.env.get(kPositCloudTokenVar);
  const tokenSecret = Deno.env.get(kPositCloudAuthTokenSecretVar);
  if (server && token && tokenSecret) {
    accounts.push({
      type: AccountTokenType.Environment,
      name: kPositCloudTokenVar,
      server,
      token: combineTokenAndSecret(token, tokenSecret),
    });
  }

  // check for recorded tokens
  const tokens = readAccessTokens<Account>(kPositCloud);
  if (tokens) {
    accounts.push(...tokens.map((token) => ({
      type: AccountTokenType.Authorized,
      name: token.username,
      server: null,
      token: combineTokenAndSecret(token.token, token.tokenSecret),
    })));
  }

  return Promise.resolve(accounts);
}

function removeToken(token: AccountToken) {
  writeAccessTokens(
    positCloudProvider.name,
    readAccessTokens<Account>(positCloudProvider.name)?.filter(
      (accessToken) => {
        return accessToken.username !== token.name;
      },
    ) || [],
  );
}

async function authorizeToken(
  _options: PublishOptions,
  _target?: PublishRecord,
): Promise<AccountToken | undefined> {
  // get credentials
  while (true) {
    const token = await Input.prompt({
      message: "Token:",
    });
    if (token.length === 0) {
      throw new Error();
    }

    const tokenSecret = await Secret.prompt({
      message: "Token secret:",
    });
    if (tokenSecret.length === 0) {
      throw new Error();
    }

    const tokenAndSecret = combineTokenAndSecret(token, tokenSecret);

    try {
      const client = new PositCloudClient(
        getServer(),
        token,
        tokenSecret,
      );

      const user = await client.getUser();

      // record account
      const account = {
        username: user.email,
        token,
        tokenSecret,
      };
      writeAccessToken(
        kPositCloud,
        account,
        (a, b) => a.username === b.username,
      );
      // return access token
      return {
        type: AccountTokenType.Authorized,
        name: user.email,
        server: null,
        token: tokenAndSecret,
      };
    } catch (err) {
      if (isUnauthorized(err)) {
        promptError(
          "Credential is unauthorized.",
        );
      } else {
        throw err;
      }
    }
  }
}

async function resolveTarget(
  account: AccountToken,
  target: PublishRecord,
): Promise<PublishRecord | undefined> {
  const client = createClientFromAccountToken(account);
  const content = await client.getContent(target.id);
  return contentAsTarget(content);
}

async function publish(
  account: AccountToken,
  type: "document" | "site",
  _input: string,
  title: string,
  _slug: string,
  render: (flags?: RenderFlags) => Promise<PublishFiles>,
  _options: PublishOptions,
  target?: PublishRecord,
): Promise<[PublishRecord, URL]> {
  // create client
  const client = createClientFromAccountToken(account);

  const { content, applicationId } = await withSpinner({
    message: `Preparing to publish ${type}`,
  }, async () => {
    if (target) {
      const content = await client.getContent(target.id);
      const revision = await client.createRevision(content.id);
      return { content, applicationId: revision.application_id };
    } else {
      const content = await createContent(client, title);
      target = { id: content.id.toString(), url: content.url, code: false };
      return { content, applicationId: content.source_id };
    }
  });
  info("");

  // render
  const publishFiles = await render();

  // publish
  const tempContext = createTempContext();
  try {
    // create and upload bundle
    const bundle = await withSpinner({
      message: () => `Uploading files`,
    }, async () => {
      const bundleTargz = await createBundle(type, publishFiles, tempContext);

      const bundleBytes = Deno.readFileSync(bundleTargz);
      const bundleSize = bundleBytes.length;
      const bundleHash = md5HashBytes(bundleBytes);

      const bundle = await client.createBundle(
        applicationId,
        bundleSize,
        bundleHash,
      );

      const bundleBlob = new Blob([bundleBytes.buffer]);
      const uploadClient = new UploadClient(bundle.presigned_url);
      await uploadClient.upload(
        bundleBlob,
        bundleSize,
        bundle.presigned_checksum,
      );
      return bundle;
    });

    await withSpinner({
      message: `Publishing ${type}`,
    }, async () => {
      await client.setBundleReady(bundle.id);
      const initialTask = await client.deployApplication(
        applicationId,
        bundle.id,
      );

      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const task = await client.getTask(initialTask.task_id);
        if (task.finished) {
          break;
        }
      }
    });
    completeMessage(`Published: ${content!.url}\n`);
    return [target!, new URL(content!.url)];
  } finally {
    tempContext.cleanup();
  }
}

function isUnauthorized(err: Error) {
  return err instanceof ApiError && err.status === 401;
}

function isNotFound(err: Error) {
  return err instanceof ApiError && err.status === 404;
}

function contentAsTarget(content: Content): PublishRecord {
  return { id: content.id.toString(), url: content.url, code: false };
}

async function createContent(
  client: PositCloudClient,
  title: string,
): Promise<Content> {
  let spaceId = null;
  let projectId = null;
  const projectApplicationId = Deno.env.get("LUCID_APPLICATION_ID");
  if (projectApplicationId) {
    const projectApplication = await client.getApplication(
      projectApplicationId,
    );
    const project = await client.getContent(projectApplication.id);
    projectId = project.id;
    spaceId = project.space_id;
  }
  return await client.createOutput(title, spaceId, projectId);
}

function promptError(msg: string) {
  info(colors.red(`  ${msg}`));
}
