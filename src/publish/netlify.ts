/*
* netlify.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { info } from "log/mod.ts";

import { openUrl } from "../core/shell.ts";
import { sleep } from "../core/wait.ts";
import { accessToken, NetlifyClient, ticket } from "./netlify/index.ts";

const kQuartoClientId = "QuartoClientId";

export interface NetlifyOptions {
  site: string;
}

export async function netlifyPublish(_options?: NetlifyOptions) {
  const client = new NetlifyClient({});

  const ticket = await client.ticket.createTicket({
    clientId: kQuartoClientId,
  }) as unknown as ticket;

  await openUrl(
    `https://app.netlify.com/authorize?response_type=ticket&ticket=${ticket.id}`,
  );

  info("Waiting for access token....", { newline: false });
  const accessToken = await getAccessToken(client, ticket.id!);
  if (accessToken) {
    info("DONE");
    const authenticatedClient = new NetlifyClient({
      TOKEN: accessToken,
    });

    const sites = await authenticatedClient.site.listSites({});

    console.log(JSON.stringify(sites, undefined, 2));
  }
}

async function getAccessToken(client: NetlifyClient, ticketId: string) {
  let authorizedTicket: ticket;
  const checkTicket = async () => {
    const t = await client.ticket.showTicket({ ticketId });
    if (t.authorized) {
      authorizedTicket = t;
    }
    return Boolean(t.authorized);
  };

  // TODO: polling interval and timeout
  while (true) {
    if (await checkTicket()) {
      break;
    }
    await sleep(200);
  }

  const accessTokenResponse = await client.accessToken
    .exchangeTicket({
      ticketId: authorizedTicket!.id!,
    }) as unknown as accessToken;

  return accessTokenResponse.access_token;
}
