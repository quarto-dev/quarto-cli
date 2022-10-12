import { AccountToken } from "../provider.ts";
import { ConfluenceClient } from "./api/index.ts";
import { getMessageFromAPIError } from "./confluence-helper.ts";
import { withSpinner } from "../../core/console.ts";

const verifyWithSpinner = async (
  verifyCommand: () => Promise<void>,
  message: string = "Verifying..."
) => {
  return await withSpinner({ message }, verifyCommand);
};

export const verifyAccountToken = async (accountToken: AccountToken) => {
  try {
    const client = new ConfluenceClient(accountToken);
    await client.getUser();
  } catch (error) {
    throw new Error(
      `Unable to sign into Confluence account: ${getMessageFromAPIError(error)}`
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
    throw new Error(`${server} doesn't exist`);
  }
};

const verifyParentExists = async (
  parentId: string,
  accountToken: AccountToken
) => {
  try {
    const client = new ConfluenceClient(accountToken);
    await client.getContent(parentId);
  } catch (error) {
    throw new Error(`Parent doesn't exist: ${getMessageFromAPIError(error)}`);
  }
};
