/*
* website-listing-categories.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { Document } from "deno_dom/deno-dom-wasm-noinit.ts";
import {
  kListingPageCategoryAll,
  kListingPageFieldCategories,
} from "../../../../config/constants.ts";
import { localizedString } from "../../../../config/localization.ts";
import { Format } from "../../../../config/types.ts";

import { ListingDescriptor } from "./website-listing-shared.ts";

export function categorySidebar(
  doc: Document,
  listingDescriptors: ListingDescriptor[],
  format: Format,
) {
  // The heading
  const headingEl = doc.createElement("h5");
  headingEl.innerText = localizedString(format, kListingPageFieldCategories);
  headingEl.classList.add("quarto-listing-category-title");

  // The categories
  const cats = accumCategories(listingDescriptors);
  const categoriesEl = categoryContainer(doc);

  // Add an 'All' category
  const allEl = categoryElement(
    doc,
    itemCount(listingDescriptors),
    localizedString(format, kListingPageCategoryAll),
    "",
  );
  categoriesEl.appendChild(allEl);

  for (const cat of Object.keys(cats).sort()) {
    const count = cats[cat];
    const catEl = categoryElement(doc, count, cat);
    categoriesEl.appendChild(catEl);
  }

  return { headingEl, categoriesEl };
}

function itemCount(listingDescriptors: ListingDescriptor[]) {
  return listingDescriptors.reduce((previous, listingDescriptor) => {
    return previous + listingDescriptor.items.length;
  }, 0);
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

function categoryElement(
  doc: Document,
  count: number,
  category: string,
  value?: string,
) {
  const categoryEl = doc.createElement("div");
  categoryEl.classList.add("category");
  categoryEl.setAttribute(
    "data-category",
    value !== undefined ? value : category,
  );
  categoryEl.innerHTML = category +
    ` <span class="quarto-category-count">(${count})</span>`;
  return categoryEl;
}
