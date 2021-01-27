/*
* install.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { message } from "../../core/console.ts";
import { tinyTexInstallable } from "./tools/tinytex.ts";

export interface InstallMsgHandler {
  info: (msg: string) => void;
  error: (msg: string) => void;
}

export interface InstallPreReq {
  check: () => Promise<boolean>;
  os: string[];
  notMetMessage: string;
}

export interface InstallableTool {
  installed: () => Promise<boolean>;
  prereqs: InstallPreReq[];
  install: (msg: InstallMsgHandler) => Promise<void>;
  postinstall: (msg: InstallMsgHandler) => Promise<void>;
}

const kInstallableTools: { [key: string]: InstallableTool } = {
  tinytex: tinyTexInstallable,
};

const installMsgHandler = {
  info: (msg: string) => {
    message(msg);
  },
  error: (msg: string) => {
    message(msg);
  },
};

export async function installTool(name: string) {
  const installableTool = kInstallableTools[name];
  if (installableTool) {
    // See if it is already installed
    const alreadyInstalled = await installableTool.installed();
    if (alreadyInstalled) {
      // Already installed, do nothing
      installMsgHandler.info(`${name} is already installed.`);
      return Promise.reject();
    } else {
      // Prereqs for this platform
      const platformPrereqs = installableTool.prereqs.filter((prereq) =>
        prereq.os.includes(Deno.build.os)
      );

      // Check to see whether any prerequisites are satisfied
      for (const prereq of platformPrereqs) {
        const met = await prereq.check();
        if (!met) {
          installMsgHandler.error(prereq.notMetMessage);
          return Promise.reject();
        }
      }

      // Do the install
      await installableTool.install(installMsgHandler);

      // post install
      await installableTool.postinstall(installMsgHandler);
    }
  }
}
