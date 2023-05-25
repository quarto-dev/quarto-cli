import { AccountToken } from "../provider-types.ts";
import { ConfluenceClient } from "./api/index.ts";
import { getMessageFromAPIError } from "./confluence-helper.ts";
import { withSpinner } from "../../core/console.ts";
import { Confirm } from "cliffy/prompt/mod.ts";
import { ConfluenceParent, Space, User } from "./api/types.ts";
import { trace } from "./confluence-logger.ts";
import { CAN_SET_PERMISSIONS_DISABLED, CAN_SET_PERMISSIONS_ENABLED_CACHED } from "./constants.ts";

const verifyWithSpinner = async (
  verifyCommand: () => Promise<void>,
  message: string = "Verifying...",
) => {
  return await withSpinner({ message }, verifyCommand);
};

export const verifyAccountToken = async (accountToken: AccountToken) => {
  try {
    const client = new ConfluenceClient(accountToken);
    await client.getUser();
  } catch (error) {
    throw new Error(
      `Unable to sign into Confluence account: ${
        getMessageFromAPIError(error)
      }`,
    );
  }
};

export const verifyLocation = async (locationURL: string) => {
  return await verifyWithSpinner(() => verifyLocationExists(locationURL));
};

const verifyLocationExists = async (server: string) => {
  try {
    const result: Response = await fetch(server);
    if (!result.ok) {
      throw new Error("");
    }
  } catch (error) {
    trace("server doesnt exist", error);
    throw new Error(`${server} doesn't exist`);
  }
};

const verifyParentExists = async (
  parentId: string,
  accountToken: AccountToken,
) => {
  try {
    const client = new ConfluenceClient(accountToken);
    await client.getContent(parentId);
  } catch (error) {
    throw new Error(`Parent doesn't exist: ${getMessageFromAPIError(error)}`);
  }
};

export const verifyConfluenceParent = async (
  parentUrl: string,
  parent: ConfluenceParent,
) => {
  if (parent.space.length === 0) {
    throw new Error("Invalid Confluence parent URL: " + parentUrl);
  }
  await verifyLocation(parentUrl);
};

export const verifyOrWarnManagePermissions = async (
  client: ConfluenceClient,
  space: Space,
  parent: ConfluenceParent,
  user: User,
) => {
  const canManagePermissions = await client.canSetPermissions(
    parent,
    space,
    user,
  );

  if (canManagePermissions) {
    // bug/5622-too-many-confluence-permission-checks
    // Cache success result
    localStorage.setItem(CAN_SET_PERMISSIONS_ENABLED_CACHED, "true");
    trace("Caching permission check success");
  } else {
    const confirmed: boolean = await Confirm.prompt(
      "We've detected that your account is not able to manage the permissions for this destination.\n\nPublished pages will be directly editable within the Confluence web editor.\n\nThis means that if you republish the page from Quarto, you may be overwriting the web edits.\nWe recommend that you establish a clear policy about how this published page will be revised.\n\nAre you sure you want to continue?",
    );
    if (!confirmed) {
      throw new Error("");
    }
  }

};
