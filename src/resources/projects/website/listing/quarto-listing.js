const kCategoryHashPrefix = "category:";

window["quarto-listing-loaded"] = () => {
  // Read the category out of the hash and filter to it
  const category = getCategoryHash();
  if (category) {
    filterListingCategory(category);
  }
};

window.document.addEventListener("DOMContentLoaded", function (_event) {
  const categoryEls = window.document.querySelectorAll(
    ".quarto-listing-category .category"
  );

  // Attach click handlers to categories
  for (const categoryEl of categoryEls) {
    const category = categoryEl.getAttribute("data-category");
    categoryEl.onclick = () => {
      activateCategory(category);
    };
  }
});

function getCategoryHash() {
  const currentUrl = new URL(window.location);
  const hash = currentUrl.hash ? currentUrl.hash.slice(1) : undefined;
  if (hash !== undefined && hash.startsWith(kCategoryHashPrefix)) {
    return hash.slice(kCategoryHashPrefix.length);
  } else {
    return undefined;
  }
}

function setCategoryHash(category) {
  const newUrl = new URL(window.location);
  newUrl.hash = `#${kCategoryHashPrefix}${category}`;
  window.history.replaceState({}, "", newUrl);
}

function filterListingCategory(category) {
  setCategoryHash(category);

  const listingIds = Object.keys(window["quarto-listings"]);
  for (const listingId of listingIds) {
    const list = window["quarto-listings"][listingId];
    if (list) {
      if (category === "") {
        // resets the filter
        list.filter();
      } else {
        // filter to this category
        list.filter(function (item) {
          const itemValues = item.values();
          const categories = itemValues.categories.split(",");

          // TODO: update url hash
          // TODO: NEED TO GET CATEGORIES INTO LIST!
          // TODO: CONDITIONAL FILTERING (EG YAML PARAM)
          // TODO: MOVING CATS CODE INTO BETTER ORGANIZATION OR LOCATION
          // TODO: LOCALIZE CATEGORY TITLE
          // TODO: SUPPORT WORD CLOUD STYLE CATEGORIES
          return categories.includes(category);
        });
      }
    }
  }
}

function activateCategory(category) {
  // Deactivate existing categories
  const activeEls = window.document.querySelectorAll(
    ".quarto-listing-category .category.active"
  );
  for (const activeEl of activeEls) {
    activeEl.classList.remove("active");
  }

  // Activate this category
  const categoryEl = window.document.querySelector(
    `.quarto-listing-category .category[data-category='${category}'`
  );
  console.log(categoryEl);
  if (categoryEl) {
    categoryEl.classList.add("active");
  }

  // Filter the listings to this category
  filterListingCategory(category);
}
