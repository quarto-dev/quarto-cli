export function main() {
  if (Deno.args.length === 0) {
    console.log(Deno.cwd(), Deno.execPath(), Deno.pid);
    Deno.exit(1);
  }
}
