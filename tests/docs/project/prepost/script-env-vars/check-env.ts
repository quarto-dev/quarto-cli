const env = {
  progress: Deno.env.get("QUARTO_PROJECT_SCRIPT_PROGRESS") ?? null,
  quiet: Deno.env.get("QUARTO_PROJECT_SCRIPT_QUIET") ?? null,
};

Deno.writeTextFileSync("env-dump.json", JSON.stringify(env));
