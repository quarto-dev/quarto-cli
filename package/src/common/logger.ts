import { Configuration } from "./config.ts";

// Log levels and prefixes
export const kError = 0;
export const kWarning = 1;
export const kInfo = 2;

const kErrorPrefix = "❌: ";
const kWarningPrefix = "⚠️: ";
const kInfoPrefix = "";

// Logger allows logging of error messages
export interface Logger {
  error: (message: unknown) => void;
  warning: (message: unknown) => void;
  info: (message: unknown) => void;
}

export function parseLogLevel(logLevelStr: string): number {
  logLevelStr = logLevelStr || "error";
  switch (logLevelStr.toLowerCase()) {
    case "info":
      return kInfo;
    case "warning":
      return kWarning;
    case "error":
      return kError;
    default:
      return kError;
  }
}

export function defaultLogger() {
  return logger(kError);
}

export function logger(configLogLevel: number) {
  const log = (message: unknown, loglevel?: number) => {
    let prefix = "";
    switch (loglevel) {
      case kInfo:
        prefix = kInfoPrefix;
        break;
      case kWarning:
        prefix = kWarningPrefix;
        break;
      case kError:
        prefix = kErrorPrefix;
        break;
    }

    loglevel = loglevel || 0;
    if (loglevel <= configLogLevel) {
      if (prefix.length > 0) {
        console.log(prefix, message);
      } else {
        console.log(message);
      }
    }
  };

  return {
    error: (message: unknown): void => {
      log(message, kError);
    },
    warning: (message: unknown): void => {
      log(message, kWarning);
    },
    info: (message: unknown): void => {
      log(message, kInfo);
    },
  };
}
