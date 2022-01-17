/*
* website-listing-categories.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { Document } from "deno_dom/deno-dom-wasm-noinit.ts";

import { ListingDescriptor } from "./website-listing-shared.ts";

export function categorySidebar(
  doc: Document,
  listingDescriptors: ListingDescriptor[],
) {
  // TODO LOCALIZE
  // The heading
  const headingEl = doc.createElement("h5");
  headingEl.innerText = "Categories";
  headingEl.classList.add("quarto-listing-category-title");

  // The categories
  const cats = accumCategories(listingDescriptors);
  const categoriesEl = categoryContainer(doc);
  for (const cat of Object.keys(cats).sort()) {
    const catEl = categoryElement(doc, cat, cats[cat]);
    categoriesEl.appendChild(catEl);
  }

  return { headingEl, categoriesEl };
}

function accumCategories(listingDescriptors: ListingDescriptor[]) {
  const items = listingDescriptors.flatMap((listingDescriptor) => {
    return listingDescriptor.items;
  });
  const categories: Record<string, number> = {};
  items.forEach((item) => {
    if (item.categories) {
      (item.categories as string[]).forEach((category) => {
        const currentCount = categories[category] || 0;
        categories[category] = currentCount + 1;
      });
    }
  });
  return categories;
}
function categoryContainer(doc: Document) {
  const container = doc.createElement("div");
  container.classList.add("quarto-listing-category");
  return container;
}

function categoryElement(doc: Document, category: string, count: number) {
  const categoryEl = doc.createElement("div");
  categoryEl.classList.add("category");
  categoryEl.setAttribute("data-category", category);
  categoryEl.innerHTML = category +
    ` <span class="quarto-category-count">(${count})</span>`;
  return categoryEl;
}
