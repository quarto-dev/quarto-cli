/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Logger } from "./logger.ts";

export async function runCmd(runCmd: string, args: string[], log: Logger) {

    const cmd: string[] = [];
    cmd.push(runCmd);
    cmd.push(...args);

    log.info(cmd);

    const p = Deno.run({
        cmd,
        stdout: "piped",
        stderr: "piped",
    });
    const status = await p.status();
    const output = new TextDecoder().decode(await p.output());
    const stderr = new TextDecoder().decode(await p.stderrOutput());
    if (status.code !== 0) {
        log.error(stderr);
        throw Error(`Command ${cmd} failed.`);
    } else {
        log.info(output);
    }
}