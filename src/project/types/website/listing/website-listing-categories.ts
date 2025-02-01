/*
 * website-listing-categories.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { Document } from "deno_dom/deno-dom-wasm-noinit.ts";
import {
  kListingPageCategoryAll,
  kListingPageFieldCategories,
} from "../../../../config/constants.ts";
import { localizedString } from "../../../../config/localization.ts";
import { Format } from "../../../../config/types.ts";

import {
  CategoryStyle,
  kCategoryStyle,
  ListingDescriptor,
  ListingSharedOptions,
} from "./website-listing-shared.ts";
import { b64EncodeUnicode } from "../../../../core/base64.ts";

export function categorySidebar(
  doc: Document,
  listingDescriptors: ListingDescriptor[],
  format: Format,
  options: ListingSharedOptions,
) {
  const categoryStyle: CategoryStyle = options[kCategoryStyle];

  // The heading
  const headingEl = doc.createElement("h5");
  headingEl.innerText = localizedString(format, kListingPageFieldCategories);
  headingEl.classList.add("quarto-listing-category-title");

  // The categories
  const cats = accumCategories(listingDescriptors);
  const categoriesEl = categoryContainer(doc);
  const totalCategories = itemCount(listingDescriptors);

  // Mark the form
  categoriesEl.classList.add(categoryStyle);

  const defaultFormat = (category: string, count: number) => {
    return category +
      ` <span class="quarto-category-count">(${count})</span>`;
  };

  const cloudFormat = (category: string, count: number) => {
    const size = Math.ceil((count / totalCategories) * 10);
    return `<span class="quarto-category-count category-cloud-${size}">${category}</span>`;
  };

  const unnumberedFormat = (category: string, _count: number) => {
    return `${category}`;
  };

  const formatFn = categoryStyle === "category-default"
    ? defaultFormat
    : categoryStyle === "category-cloud"
    ? cloudFormat
    : unnumberedFormat;

  // Add an 'All' category
  if (categoryStyle === "category-default") {
    const allCategory = localizedString(format, kListingPageCategoryAll);
    const allEl = categoryElement(
      doc,
      allCategory,
      formatFn(allCategory, totalCategories),
      "",
    );
    categoriesEl.appendChild(allEl);
  }

  for (const cat of Object.keys(cats).sort()) {
    const count = cats[cat];
    const catEl = categoryElement(doc, cat, formatFn(cat, count), cat);
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
  category: string,
  contents: string,
  value?: string,
) {
  const categoryEl = doc.createElement("div");
  categoryEl.classList.add("category");
  categoryEl.setAttribute(
    "data-category",
    value !== undefined ? b64EncodeUnicode(value) : b64EncodeUnicode(category),
  );
  categoryEl.innerHTML = contents;
  return categoryEl;
}
