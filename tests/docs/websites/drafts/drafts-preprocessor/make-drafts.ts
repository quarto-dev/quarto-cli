import { existsSync } from "https://deno.land/std/fs/mod.ts";

const kDraftsFile = "_drafts.yml";

if (existsSync(kDraftsFile)) {
    Deno.removeSync(kDraftsFile);
}
Deno.writeTextFileSync(kDraftsFile, "website:\n  drafts:\n    - posts/draft-post/index.qmd")