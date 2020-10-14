export function consoleWriteLine(line: string) {
  Deno.stderr.writeSync(new TextEncoder().encode(line + "\n"));
}
