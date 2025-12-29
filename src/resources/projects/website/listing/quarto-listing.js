const kProgressiveAttr = "data-src";
let selectedCategories = new Set();
const kDefaultCategory = ""; // Default category "" means all posts selected

window.quartoListingCategory = (category) => {
  // category is URI encoded in EJS template for UTF-8 support
  category = decodeURIComponent(atob(category));
  selectedCategories.clear();
  selectedCategories.add(category);

  updateCategory();
  setCategoryHash();
};

window["quarto-listing-loaded"] = () => {
  // Process any existing hash
  const hash = getHash();

  if (hash) {
    // If there are categories, switch to those
    if (hash.category) {
      const cats = hash.category.split(",");
      for (const cat of cats) {
        if (cat) selectedCategories.add(decodeURIComponent(cat));
      }
      updateCategory();
    } else {
      // No categories in hash, use default
      selectedCategories.add(kDefaultCategory);
      updateCategory();
    }
    // Paginate a specific listing
    const listingIds = Object.keys(window["quarto-listings"]);
    for (const listingId of listingIds) {
      const page = hash[getListingPageKey(listingId)];
      if (page) {
        showPage(listingId, page);
      }
    }
  } else {
    // No hash at all, use default category
    selectedCategories.add(kDefaultCategory);
    updateCategory();
  }

  const listingIds = Object.keys(window["quarto-listings"]);
  for (const listingId of listingIds) {
    // The actual list
    const list = window["quarto-listings"][listingId];

    // Update the handlers for pagination events
    refreshPaginationHandlers(listingId);

    // Render any visible items that need it
    renderVisibleProgressiveImages(list);

    // Whenever the list is updated, we also need to
    // attach handlers to the new pagination elements
    // and refresh any newly visible items.
    list.on("updated", function () {
      renderVisibleProgressiveImages(list);
      setTimeout(() => refreshPaginationHandlers(listingId));

      // Show or hide the no matching message
      toggleNoMatchingMessage(list);
    });
  }
};

window.document.addEventListener("DOMContentLoaded", function (_event) {
  // Attach click handlers to categories
  const categoryEls = window.document.querySelectorAll(
    ".quarto-listing-category .category"
  );

  for (const categoryEl of categoryEls) {
    // category needs to support non ASCII characters
    const category = decodeURIComponent(
      atob(categoryEl.getAttribute("data-category"))
    );
    categoryEl.onclick = (e) => {
      // Allow holding Ctrl/Cmd key for multiple selection
      // Clear other selections if not using Ctrl/Cmd
      if (!e.ctrlKey && !e.metaKey) {
        selectedCategories.clear();
      }

      // If this would deselect the last category, ensure default category remains selected
      if (selectedCategories.has(category)) {
        selectedCategories.delete(category);
        if (selectedCategories.size === 1) {
          selectedCategories.add(kDefaultCategory);
        }
      } else {
        selectedCategories.add(category);
      }

      updateCategory();
      setCategoryHash();
    };
  }

  // Attach a click handler to the category title
  // (there should be only one, but since it is a class name, handle N)
  const categoryTitleEls = window.document.querySelectorAll(
    ".quarto-listing-category-title"
  );
  for (const categoryTitleEl of categoryTitleEls) {
    categoryTitleEl.onclick = () => {
      selectedCategories.clear();
      updateCategory();
      setCategoryHash();
    };
  }

  // Process any existing hash for multiple categories
  const hash = getHash();
  if (hash && hash.category) {
    const cats = hash.category.split(",");
    for (const cat of cats) {
      if (cat) selectedCategories.add(decodeURIComponent(cat));
    }
    updateCategory();
  } else {
    // No hash at all, use default category
    selectedCategories.add(kDefaultCategory);
    updateCategory();
  }
});

function toggleNoMatchingMessage(list) {
  const selector = `#${list.listContainer.id} .listing-no-matching`;
  const noMatchingEl = window.document.querySelector(selector);
  if (noMatchingEl) {
    if (list.visibleItems.length === 0) {
      noMatchingEl.classList.remove("d-none");
    } else {
      if (!noMatchingEl.classList.contains("d-none")) {
        noMatchingEl.classList.add("d-none");
      }
    }
  }
}

function setCategoryHash() {
  if (selectedCategories.size === 0) {
    setHash({});
  } else {
    const categoriesStr = Array.from(selectedCategories)
      .map((cat) => encodeURIComponent(cat))
      .join(",");
    setHash({ category: categoriesStr });
  }
}

function setPageHash(listingId, page) {
  const currentHash = getHash() || {};
  currentHash[getListingPageKey(listingId)] = page;
  setHash(currentHash);
}

function getListingPageKey(listingId) {
  return `${listingId}-page`;
}

function refreshPaginationHandlers(listingId) {
  const listingEl = window.document.getElementById(listingId);
  const paginationEls = listingEl.querySelectorAll(
    ".pagination li.page-item:not(.disabled) .page.page-link"
  );
  for (const paginationEl of paginationEls) {
    paginationEl.onclick = (sender) => {
      setPageHash(listingId, sender.target.getAttribute("data-i"));
      showPage(listingId, sender.target.getAttribute("data-i"));
      return false;
    };
  }
}

function renderVisibleProgressiveImages(list) {
  // Run through the visible items and render any progressive images
  for (const item of list.visibleItems) {
    const itemEl = item.elm;
    if (itemEl) {
      const progressiveImgs = itemEl.querySelectorAll(
        `img[${kProgressiveAttr}]`
      );
      for (const progressiveImg of progressiveImgs) {
        const srcValue = progressiveImg.getAttribute(kProgressiveAttr);
        if (srcValue) {
          progressiveImg.setAttribute("src", srcValue);
        }
        progressiveImg.removeAttribute(kProgressiveAttr);
      }
    }
  }
}

function getHash() {
  // Hashes are of the form
  // #name:value|name1:value1|name2:value2
  const currentUrl = new URL(window.location);
  const hashRaw = currentUrl.hash ? currentUrl.hash.slice(1) : undefined;
  return parseHash(hashRaw);
}

const kAnd = "&";
const kEquals = "=";

function parseHash(hash) {
  if (!hash) {
    return undefined;
  }
  const hasValuesStrs = hash.split(kAnd);
  const hashValues = hasValuesStrs
    .map((hashValueStr) => {
      const vals = hashValueStr.split(kEquals);
      if (vals.length === 2) {
        return { name: vals[0], value: vals[1] };
      } else {
        return undefined;
      }
    })
    .filter((value) => {
      return value !== undefined;
    });

  const hashObj = {};
  hashValues.forEach((hashValue) => {
    hashObj[hashValue.name] = decodeURIComponent(hashValue.value);
  });
  return hashObj;
}

function makeHash(obj) {
  return Object.keys(obj)
    .map((key) => {
      return `${key}${kEquals}${obj[key]}`;
    })
    .join(kAnd);
}

function setHash(obj) {
  const hash = makeHash(obj);
  window.history.pushState(null, null, `#${hash}`);
}

function showPage(listingId, page) {
  const list = window["quarto-listings"][listingId];
  if (list) {
    list.show((page - 1) * list.page + 1, list.page);
  }
}

function updateCategory() {
  updateCategoryUI();
  filterListingCategory();
}

function updateCategoryUI() {
  // Deactivate all categories first
  const categoryEls = window.document.querySelectorAll(
    ".quarto-listing-category .category"
  );
  for (const categoryEl of categoryEls) {
    categoryEl.classList.remove("active");
  }

  // Activate selected categories
  for (const category of selectedCategories) {
    const categoryEl = window.document.querySelector(
      `.quarto-listing-category .category[data-category='${btoa(
        encodeURIComponent(category)
      )}']`
    );
    if (categoryEl) {
      categoryEl.classList.add("active");
    }
  }
}

function filterListingCategory() {
  const listingIds = Object.keys(window["quarto-listings"]);
  for (const listingId of listingIds) {
    const list = window["quarto-listings"][listingId];
    if (list) {
      if (selectedCategories.size === 0 ||
        (selectedCategories.size === 1 && selectedCategories.has(kDefaultCategory))) {
        // Reset the filter when no categories selected or only default category
        list.filter();
      } else {
        // Filter to selected categories, but ignore kDefaultCategory if other categories selected
        const effectiveCategories = new Set(selectedCategories);
        if (effectiveCategories.size > 1 && effectiveCategories.has(kDefaultCategory)) {
          effectiveCategories.delete(kDefaultCategory);
        }

        list.filter(function (item) {
          const itemValues = item.values();
          if (itemValues.categories !== null) {
            const categories = decodeURIComponent(
              atob(itemValues.categories)
            ).split(",");
            return categories.some(category => effectiveCategories.has(category));
          } else {
            return false;
          }
        });
      }
    }
  }
}
