export function mode(): string {
  const env = Deno.env.get("MODE");
  return env ?? "production";
}
