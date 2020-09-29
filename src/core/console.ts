export function writeLine(writer: Deno.WriterSync, line: string) {
  writer.writeSync(new TextEncoder().encode(line + "\n"));
}
