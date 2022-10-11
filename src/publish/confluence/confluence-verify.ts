import { AccountToken } from "../provider.ts";
import { ConfluenceClient } from "./api/index.ts";
import { getMessageFromAPIError } from "./confluence-helper.ts";

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

export const verifyServerExists = async (server: string) => {
  try {
    const result: Response = await fetch(server);
    if (!result.ok) {
      throw new Error("");
    }
  } catch (error) {
    throw new Error(`Confluence Server ${server} doesn't exist`);
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
