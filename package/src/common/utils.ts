import { existsSync } from "https://deno.land/std/fs/exists.ts";

export function getEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error("Missing environment variable: " + name);
  }
  return value;
}

export function ensureDirExists(directory: string): boolean {
  if (!existsSync(directory)) {
    Deno.mkdirSync(directory, { recursive: true });
    return true;
  }
  return false;
}
