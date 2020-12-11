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

// Gets a logger for the current configuration
export function logger(
  config: Configuration,
): Logger {
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
    if (loglevel <= config.logLevel) {
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
