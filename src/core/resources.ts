import { join } from "path/mod.ts";

export function resourcePath(resource: string): string {
  const resourcePath = Deno.env.get("QUARTO_RESOURCES");
  if (!resourcePath) {
    throw new Error("QUARTO_RESOURCES not defined");
  }
  return join(resourcePath, resource);
}
