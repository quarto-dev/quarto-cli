/*
 * options.ts
 *
 * Copyright (C) 2024 Posit Software, PBC
 */
import type { BaseContext, Command, CommandClass, Option } from "npm:clipanion";

export const addCommandOptions = <Context extends BaseContext, Options extends Record<string, any>>(
    options: Options,
    callback: (commandWithOptions: Command<Context> & Options) => Promise<void>
) =>
    (commandClass: CommandClass<Context>) => {
        Object.assign(commandClass.prototype, options);

        const wrappedExecute = commandClass.prototype.execute;
        commandClass.prototype.execute = async function () {
            const commandWithOptions = this as unknown as (Command<Context> & Options);
            await callback(commandWithOptions);
            return await wrappedExecute.call(this);
        }
    }
