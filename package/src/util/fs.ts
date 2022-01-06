/**
 * @param dir directory to remove
 * deletes a directory if it exists
 * Requires the `--allow-read` flag
 */
export async function removeDirIfExists(dir: string) {
  try {
    const ds = await Deno.stat(dir);
    if (ds.isDirectory) {
      await Deno.remove(dir, { recursive: true });
    }
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) {
      throw err;
    }
  }
}
