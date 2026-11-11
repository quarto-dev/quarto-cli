const kProgressiveAttr = "data-src";
let categoriesLoaded = false;

window.quartoListingCategory = (category) => {
  // category is URI encoded in EJS template for UTF-8 support
  category = decodeURIComponent(atob(category));
  if (categoriesLoaded && isMultipleSelection()) {
    selectCategories([category]);
  } else if (categoriesLoaded) {
    activateCategory(category);
    setCategoryHash(category);
    announceCategoryResults();
  }
};

const wiredListings = new Set();

// Apply the category and per-listing page stored in the URL hash.
// `announce` is true when the hash changed after a user action.
function applyListingHash(announce = false) {
  const hash = getHash();
  if (!hash || !window["quarto-listings"]) {
    return;
  }

  // If there is a category, switch to that. In multiple mode, a hash with no
  // key=value pair (a skip link, a heading anchor) leaves the selection alone.
  if (isMultipleSelection()) {
    if (Object.keys(hash).length > 0) {
      const previous = currentSelection().join(",");
      applySelection(readSelection());
      if (announce && currentSelection().join(",") !== previous) {
        announceCategoryResults();
      }
    }
  } else if (hash.category) {
    // category hash are URI encoded so we need to decode it before processing
    // so that we can match it with the category element processed in JS
    activateCategory(decodeURIComponent(hash.category));
    if (announce) {
      announceCategoryResults();
    }
  }
  // Paginate a specific listing
  for (const listingId of Object.keys(window["quarto-listings"])) {
    const page = hash[getListingPageKey(listingId)];
    if (page) {
      showPage(listingId, page);
    }
  }
}

window["quarto-listing-loaded"] = () => {
  // Process any existing hash
  applyListingHash();

  // Each listing calls this once its List is created, so wire each one once
  for (const listingId of Object.keys(window["quarto-listings"])) {
    if (wiredListings.has(listingId)) {
      continue;
    }
    wiredListings.add(listingId);

    // The actual list
    const list = window["quarto-listings"][listingId];

    // Record the page hash on pagination clicks
    attachPaginationHandler(listingId);

    // Render any visible items that need it
    renderVisibleProgressiveImages(list);

    // Whenever the list is updated, refresh any newly visible items.
    list.on("updated", function () {
      renderVisibleProgressiveImages(list);
      window.quartoDecorateExternalLinks?.(list.list);

      // Show or hide the no matching message
      toggleNoMatchingMessage(list);
    });
  }
};

window.addEventListener("hashchange", () => {
  if (isMultipleSelection() && !getHash()) {
    if (window["quarto-listings"] && currentSelection().length > 0) {
      applySelection([]);
      announceCategoryResults();
    }
    return;
  }
  applyListingHash(true);
});

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
    categoryEl.onclick = () => {
      if (isMultipleSelection()) {
        selectCategories(toggledSelection(category));
        return;
      }
      activateCategory(category);
      setCategoryHash(category);
      announceCategoryResults();
    };
  }

  for (const clearEl of window.document.querySelectorAll(
    ".quarto-listing-category-clear"
  )) {
    clearEl.onclick = () => selectCategories([]);
  }

  // Attach a click handler to the button in the category title
  // (there should be only one, but since it is a class name, handle N)
  const categoryResetEls = window.document.querySelectorAll(
    ".quarto-listing-category-reset"
  );
  for (const categoryResetEl of categoryResetEls) {
    categoryResetEl.onclick = () => {
      if (isMultipleSelection()) {
        selectCategories([]);
        return;
      }
      activateCategory("");
      setCategoryHash("");
      announceCategoryResults();
    };
  }

  // Item category tags are links to the category hash, so they work before
  // this script runs. Handle the click here as well: quarto-nav.js rewrites
  // `index.html` links to the directory URL, which would reload the page, and
  // filtering re-renders the items, which would drop the focus.
  window.document.addEventListener("click", (event) => {
    const tagEl = event.target.closest?.(".listing-categories a.listing-category");
    if (!tagEl || event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const category = tagCategory(tagEl);
    if (!category) {
      return;
    }
    event.preventDefault();
    if (isMultipleSelection()) {
      selectCategories([category]);
    } else {
      activateCategory(category);
      setCategoryHash(category);
      announceCategoryResults();
    }
    // With pagination, the clicked item can move off the shown page
    const focusEl = tagEl.isConnected
      ? tagEl
      : [...window.document.querySelectorAll(
        ".listing-categories a.listing-category"
      )].find((el) => tagCategory(el) === category);
    focusEl?.focus();
  });

  // Without a category in the hash, the unfiltered entry is the current one
  if (isMultipleSelection()) {
    markPressedCategories(readSelection());
  } else if (!getHash()?.category) {
    markCurrentCategory("");
  }

  categoriesLoaded = true;
});

function tagCategory(tagEl) {
  return parseHash(new URL(tagEl.href).hash.slice(1))?.category;
}

let announceTimer;

function announceCategoryResults() {
  const statusEl = window.document.querySelector(
    ".quarto-listing-category-status"
  );
  if (!statusEl || !window["quarto-listings"]) {
    return;
  }
  let count = 0;
  for (const list of Object.values(window["quarto-listings"])) {
    count += list.matchingItems.length;
  }
  const message =
    count === 1
      ? statusEl.dataset.resultsOne
      : statusEl.dataset.results.replace("{0}", count);
  // Screen readers skip a live region whose text does not change, so empty
  // it first and write the message once the empty state has been seen
  statusEl.textContent = "";
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    statusEl.textContent = message;
  }, 100);
}

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

function setCategoryHash(category) {
  setHash({ category });
}

function setPageHash(listingId, page) {
  const currentHash = getHash() || {};
  if (isMultipleSelection()) {
    // Write the shown selection, which outlives an in-page anchor, with each
    // name encoded again so that `&`, `=` or `%` in a name survive
    delete currentHash.category;
    const selection = currentSelection();
    if (selection.length > 0) {
      currentHash.category = encodeSelection(selection);
    }
  }
  currentHash[getListingPageKey(listingId)] = page;
  setHash(currentHash);
}

function getListingPageKey(listingId) {
  return `${listingId}-page`;
}

function attachPaginationHandler(listingId) {
  // list.js rebuilds the page links on every update but keeps their
  // container, so a single listener there covers every link.
  const listingEl = window.document.getElementById(listingId);
  const paginationEl = listingEl.querySelector(".pagination");
  if (!paginationEl) {
    return;
  }
  paginationEl.addEventListener("click", (event) => {
    const pageLink = event.target.closest(
      "li.page-item:not(.disabled) .page.page-link"
    );
    if (!pageLink) {
      return;
    }
    // list.js's pagination plugin shows the page from its own click
    // listener on the pagination list; this handler only records the hash.
    event.preventDefault();
    setPageHash(listingId, pageLink.getAttribute("data-i"));
  });
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

function activateCategory(category) {
  markCurrentCategory(category);

  // Filter the listings to this category
  filterListingCategory(category);
}

function markCurrentCategory(category) {
  const activeEls = window.document.querySelectorAll(
    ".quarto-listing-category .category.active, .quarto-listing-category .category[aria-current]"
  );
  for (const activeEl of activeEls) {
    activeEl.classList.remove("active");
    activeEl.removeAttribute("aria-current");
  }

  const categoryEl = window.document.querySelector(
    `.quarto-listing-category .category[data-category='${btoa(
      encodeURIComponent(category)
    )}']`
  );
  if (categoryEl) {
    categoryEl.classList.add("active");
    categoryEl.setAttribute("aria-current", "true");
  }
}

function itemHasAnyCategory(item, names) {
  const itemValues = item.values();
  if (itemValues.categories === null) {
    return false;
  }
  const categories = decodeURIComponent(atob(itemValues.categories)).split(
    ","
  );
  return categories.some((category) => names.includes(category));
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
        list.filter((item) => itemHasAnyCategory(item, [category]));
      }
    }
  }
}

// Multiple selection (category-selection: multiple). The URL hash holds the
// selection as `category=<a>,<b>`: each name is URI encoded on its own, so a
// literal comma separates names. Navigation reads the selection from the
// hash; a change starts from the pressed entries, which keep the selection
// when an in-page anchor replaces the hash.

function isMultipleSelection() {
  return !!window.document.querySelector(
    ".quarto-listing-category[data-category-selection='multiple']"
  );
}

function categoryEntryName(categoryEl) {
  return decodeURIComponent(atob(categoryEl.getAttribute("data-category")));
}

function categoryNames() {
  const names = [];
  for (const categoryEl of window.document.querySelectorAll(
    ".quarto-listing-category .category"
  )) {
    const name = categoryEntryName(categoryEl);
    if (name !== "") {
      names.push(name);
    }
  }
  return names;
}

function rawHashValue(key) {
  const hash = window.location.hash.slice(1);
  for (const part of hash.split(kAnd)) {
    const vals = part.split(kEquals);
    if (vals.length === 2 && vals[0] === key) {
      return vals[1];
    }
  }
  return undefined;
}

function readSelection() {
  const raw = rawHashValue("category");
  if (!raw) {
    return [];
  }
  const wanted = new Set();
  for (const part of raw.split(",")) {
    try {
      wanted.add(decodeURIComponent(part));
    } catch (_error) {
      // A malformed part names no category
    }
  }
  return categoryNames().filter((name) => wanted.has(name));
}

function writeSelection(names) {
  const selected = new Set(names);
  const ordered = categoryNames().filter((name) => selected.has(name));
  const url = window.location.pathname + window.location.search;
  const target = ordered.length === 0
    ? url
    : `${url}#category${kEquals}${encodeSelection(ordered)}`;
  if (target !== url + window.location.hash) {
    window.history.pushState(null, null, target);
  }
}

function encodeSelection(names) {
  return names.map((name) => encodeURIComponent(name)).join(",");
}

function currentSelection() {
  const names = [];
  for (const categoryEl of window.document.querySelectorAll(
    ".quarto-listing-category .category[aria-pressed='true']"
  )) {
    const name = categoryEntryName(categoryEl);
    if (name !== "") {
      names.push(name);
    }
  }
  return names;
}

function toggledSelection(category) {
  if (category === "") {
    return [];
  }
  const selection = currentSelection();
  return selection.includes(category)
    ? selection.filter((name) => name !== category)
    : [...selection, category];
}

function markPressedCategories(names) {
  for (const categoryEl of window.document.querySelectorAll(
    ".quarto-listing-category .category"
  )) {
    const name = categoryEntryName(categoryEl);
    if (name === "") {
      // "All" is not a toggle: it is the current entry when nothing is pressed
      const current = names.length === 0;
      categoryEl.classList.toggle("active", current);
      if (current) {
        categoryEl.setAttribute("aria-current", "true");
      } else {
        categoryEl.removeAttribute("aria-current");
      }
      continue;
    }
    const pressed = names.includes(name);
    categoryEl.setAttribute("aria-pressed", pressed ? "true" : "false");
    categoryEl.classList.toggle("active", pressed);
  }
}

function applySelection(names) {
  markPressedCategories(names);
  if (!window["quarto-listings"]) {
    return;
  }
  for (const list of Object.values(window["quarto-listings"])) {
    if (names.length === 0) {
      list.filter();
    } else {
      list.filter((item) => itemHasAnyCategory(item, names));
    }
  }
}

function selectCategories(names) {
  if (!categoriesLoaded || !window["quarto-listings"]) {
    return;
  }
  writeSelection(names);
  applySelection(readSelection());
  announceCategoryResults();
}
