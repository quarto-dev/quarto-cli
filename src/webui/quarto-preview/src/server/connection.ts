/*
 * connection.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */


export function connectToServer(handlers: Array<(stopServer: VoidFunction) => (ev: MessageEvent<string>) => boolean>) {

  // determine protocol/path/etc.
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  let path = window.location.pathname;
  if (!/\/$/.test(path)) {
    path += "/";
  }

  let reconnect = true;
  addEventListener("beforeunload", () => {
    // don't reconnect in case of navigation events
    reconnect = false;
  });


  // connect to server (auto-reconnect if required)
  const devServerSocket = new WebSocket(protocol + "//" + window.location.host + path);
  devServerSocket.onopen = () => {
    console.log('Socket connection open. Listening for events.');
    autoReconnect(devServerSocket, () => reconnect);
  };

  // create stopServer function (sends "stop" message and prevents reconnect)
  const stopServer = () => {
    reconnect = false;
    devServerSocket.send("stop");
  }
  // create handlers
  const handlerFuncs = handlers.map(handler => handler(stopServer));

  // handle messages
  devServerSocket.onmessage = (ev: MessageEvent<string>) => {
    for (const handler of handlerFuncs) {
      if (handler(ev)) {
        break;
      }
    }
  };
  
  // return close method
  return () => {
    try {
      devServerSocket.close();
    } catch(error) {
      console.error(error);
    }
  }
}



// if the socket closes for any reason (e.g. this occurs in electron apps
// when the computer suspends) then reload to reestablish the connection 
function autoReconnect(socket: WebSocket, reconnect: () => boolean) {
  socket.onclose = () => {
    if (reconnect()) {
      console.log('Socket connection closed. Reloading.');
      window.location.reload();
    }
  }
}

