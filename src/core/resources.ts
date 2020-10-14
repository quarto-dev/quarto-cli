import { join } from "path/mod.ts";
import { getenv } from "./env.ts";

export function resourcePath(resource: string): string {
  const resourcePath = getenv("QUARTO_RESOURCES");
  return join(resourcePath, resource);
}
