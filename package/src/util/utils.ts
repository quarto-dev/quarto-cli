import { existsSync } from "fs/exists.ts";

// Read an environment variable
export function getEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error("Missing environment variable: " + name);
  }
  return value;
}

// Ensure a directory exists (creating it if necessary)
export function ensureDirExists(directory: string): boolean {
  if (!existsSync(directory)) {
    Deno.mkdirSync(directory, { recursive: true });
    return true;
  }
  return false;
}
