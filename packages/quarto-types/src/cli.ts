/**
 * Minimal type definitions for CLI commands
 */

export interface Command {
  command(name: string, description?: string): Command;
  description(description: string): Command;
  action(fn: (...args: any[]) => void | Promise<void>): Command;
  arguments(args: string): Command;
  option(flags: string, description: string, options?: any): Command;
}