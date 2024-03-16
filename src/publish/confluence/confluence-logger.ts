import { debug, error, info, warning } from "../../deno_ral/log.ts";
import { LogLevel, LogPrefix } from "./api/types.ts";

export const trace = (
  message: string,
  value: any = "",
  prefix: LogPrefix = LogPrefix.GENERAL,
  level: LogLevel = LogLevel.DEBUG,
) => {
  const logger = {
    [LogLevel.DEBUG]: debug,
    [LogLevel.INFO]: info,
    [LogLevel.WARN]: warning,
    [LogLevel.ERROR]: error,
  };
  const prefixedMessage = `\n[Confluence] ${prefix} ${message}`;
  logger[level](`${prefixedMessage} ${Deno.inspect(value)}`);
};

export const logError = (
  message: string,
  value: any,
  prefix: LogPrefix = LogPrefix.GENERAL,
) => trace(message, value, prefix, LogLevel.ERROR);

export const logWarning = (
  message: string,
  value: any,
  prefix: LogPrefix = LogPrefix.GENERAL,
) => trace(message, value, prefix, LogLevel.WARN);
