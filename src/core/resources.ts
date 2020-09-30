import { join } from "path/mod.ts";

export function resourcePath(resource: string): string {
  const resourcePath = Deno.env.get("QUARTO_RESOURCES")!;
  return join(resourcePath, resource);
}
