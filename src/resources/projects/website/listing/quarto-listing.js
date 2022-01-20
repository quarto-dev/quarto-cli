const kProgressiveAttr = "data-src";

window["quarto-listing-loaded"] = () => {
  // Process any existing hash
  const hash = getHash();
  if (hash) {
    if (hash.category) {
      activateCategory(hash.category);
    }

    // Paginate a specific listing
    const listingIds = Object.keys(window["quarto-listings"]);
    for (const listingId of listingIds) {
      const page = hash[getListingPageKey(listingId)];
      if (page) {
        showPage(listingId, page);
      }
    }
  }
  refreshPaginationHandlers();
  const listingIds = Object.keys(window["quarto-listings"]);
  for (const listingId of listingIds) {
    const list = window["quarto-listings"][listingId];
    renderVisibleProgressiveImages(list);
    list.on("updated", function () {
      renderVisibleProgressiveImages(list);
    });
  }
};

window.document.addEventListener("DOMContentLoaded", function (_event) {
  // Attach click handlers to categories
  const categoryEls = window.document.querySelectorAll(
    ".quarto-listing-category .category"
  );

  for (const categoryEl of categoryEls) {
    const category = categoryEl.getAttribute("data-category");
    categoryEl.onclick = () => {
      activateCategory(category);
      setCategoryHash(category);
    };
  }
});

function setCategoryHash(category) {
  setHash({ category });
}

function setPageHash(listingId, page) {
  const currentHash = getHash() || {};
  currentHash[getListingPageKey(listingId)] = page;
  setHash(currentHash);
}

function getListingPageKey(listingId) {
  return `${listingId}-page`;
}

function refreshPaginationHandlers() {
  // Attach click handlers to pagination

  const listingIds = Object.keys(window["quarto-listings"]);
  for (const listingId of listingIds) {
    const listingEl = window.document.getElementById(listingId);
    const paginationEls = listingEl.querySelectorAll(
      ".pagination li.page-item:not(.disabled) .page.page-link"
    );

    for (const paginationEl of paginationEls) {
      paginationEl.onclick = (sender) => {
        setPageHash(listingId, sender.target.getAttribute("data-i"));
        showPage(listingId, sender.target.getAttribute("data-i"));
        setTimeout(refreshPaginationHandlers);
        return false;
      };
    }
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
    hashObj[hashValue.name] = hashValue.value;
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
  if (categoryEl) {
    categoryEl.classList.add("active");
  }

  // Filter the listings to this category
  filterListingCategory(category);
}

function filterListingCategory(category) {
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
          if (itemValues.categories !== null) {
            const categories = itemValues.categories.split(",");
            return categories.includes(category);
          } else {
            return false;
          }
        });
      }
    }
  }
}
