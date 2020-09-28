

export function logError(msg: string) {
   Deno.stderr.write(new TextEncoder().encode(msg + '\n'));
}
