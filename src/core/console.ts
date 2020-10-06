export function writeLine(line: string, writer = Deno.stderr) {
  writer.writeSync(new TextEncoder().encode(line + "\n"));
}
