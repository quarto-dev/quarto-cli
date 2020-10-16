export function consoleWriteLine(line: string) {
  Deno.stderr.writeSync(new TextEncoder().encode(line + "\n"));
}
export function writeFileToStdout(file: string) {
  const df = Deno.openSync(file, { read: true });
  const contents = Deno.readAllSync(df);
  Deno.writeAllSync(Deno.stdout, contents);
  Deno.close(df.rid);
}
