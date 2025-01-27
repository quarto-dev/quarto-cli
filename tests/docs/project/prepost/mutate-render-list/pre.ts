import { existsSync, ensureDirSync } from "stdlib/fs";
import { join } from "stdlib/path";

const kNewFiles = [{file: "test1.qmd", title: "First Doc"}, {file: "test2.qmd", title: "Second Doc"}];

const fileContents = (title: string, filename: string) => {
    return `
---
title: ${title}
author: Charles Teague
date: today
---

## Hello There!

{{< lipsum 2 >}}

## File Info

Filename: ${filename}
`;
}

ensureDirSync("sidebar");
for (const newFile of kNewFiles) {
    
    const path = join("sidebar", newFile.file);
    if (existsSync(path)) {
        Deno.removeSync(path);
    }    
    Deno.writeTextFileSync(path, fileContents(newFile.title, newFile.file));
}

