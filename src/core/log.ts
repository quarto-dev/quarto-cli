

export function logError(msg: string) {
   Deno.stderr.writeSync(new TextEncoder().encode(msg + '\n'));
}
