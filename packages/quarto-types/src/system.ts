/**
 * System and process types for Quarto
 */

/**
 * Process execution result
 */
export interface ProcessResult {
  success: boolean;
  code: number;
  stdout?: string;
  stderr?: string;
}

/**
 * Process execution options
 */
export type ExecProcessOptions = {
  cmd: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  stdout?: "piped" | "inherit" | "null";
  stderr?: "piped" | "inherit" | "null";
  stdin?: "piped" | "inherit" | "null";
};

/**
 * Preview server interface
 */
export interface PreviewServer {
  /** Start the server and return the URL to browse to */
  start: () => Promise<string | undefined>;
  /** Run the server (blocking) */
  serve: () => Promise<void>;
  /** Stop the server */
  stop: () => Promise<void>;
}

/**
 * Temporary context for managing temporary files and directories
 */
export interface TempContext {
  /** Base directory for temporary files */
  baseDir: string;
  /** Create a temporary file from string content and return its path */
  createFileFromString: (
    content: string,
    options?: { suffix?: string; prefix?: string; dir?: string },
  ) => string;
  /** Create a temporary file and return its path */
  createFile: (options?: { suffix?: string; prefix?: string; dir?: string }) => string;
  /** Create a temporary directory and return its path */
  createDir: (options?: { suffix?: string; prefix?: string; dir?: string }) => string;
  /** Clean up all temporary resources */
  cleanup: () => void;
  /** Register a cleanup handler */
  onCleanup: (handler: VoidFunction) => void;
}
