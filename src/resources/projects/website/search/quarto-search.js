// Fuse search options
const searchOptions = {
  isCaseSensitive: false,
  shouldSort: true,
  minMatchCharLength: 2,
  limit: 25,
};

const kQueryArg = "q";
const kResultsArg = "showResults";

window.document.addEventListener("DOMContentLoaded", function (_event) {
  // Ensure that search is available on this page. If it isn't,
  // should return early and not do anything
  var searchEl = window.document.getElementById("quarto-search");
  if (!searchEl) return;

  // create index then initialize autocomplete
  createFuseIndex().then(function (fuse) {
    // initialize autocomplete
    const { autocomplete } = window["@algolia/autocomplete-js"];

    // Used to determine highlighting behavior for this page
    // A `q` query param is expected when the user follows a search
    // to this page
    const currentUrl = new URL(window.location);
    const query = currentUrl.searchParams.get(kQueryArg);
    const showSearchResults = currentUrl.searchParams.get(kResultsArg);
    const mainEl = window.document.querySelector("main");

    // highlight matches on the page
    if (query !== null && mainEl) {
      highlight(query, mainEl);
    }

    // function to clear highlighting on the page when the search query changes
    // (e.g. if the user edits the query or clears it)
    let highlighting = true;
    const resetHighlighting = (searchTerm) => {
      if (mainEl && highlighting && query !== null && searchTerm !== query) {
        clearHighlight(query, mainEl);
        highlighting = false;
      }
    };

    let lastState = null;
    const { setIsOpen } = autocomplete({
      container: searchEl,
      detachedMediaQuery: "(max-width: 680px)",
      defaultActiveItemId: 0,
      panelContainer: "#quarto-search-results",
      panelPlacement: "start",
      debug: false,
      classNames: {
        form: "d-flex",
      },
      initialState: {
        query,
      },
      getItemUrl({ item }) {
        return item.href;
      },
      onStateChange({ state }) {
        // Perhaps reset highlighting
        resetHighlighting(state.query);

        // If the panel just opened, ensure the panel is positioned properly
        if (state.isOpen) {
          if (lastState && !lastState.isOpen) {
            setTimeout(positionPanel, 100);
          }
        }

        // If there is a query, show the link icon
        const copyButtonEl = window.document.body.querySelector(
          ".aa-Form .aa-InputWrapperSuffix .aa-CopyButton"
        );
        if (copyButtonEl) {
          if (state.query) {
            copyButtonEl.style.display = "flex";
          } else {
            copyButtonEl.style.display = "none";
          }
        }
        lastState = state;
      },
      reshape({ sources, state }) {
        return sources.map((source) => {
          const items = source.getItems();

          // group the items by document
          const groupedItems = new Map();
          items.forEach((item) => {
            const hrefParts = item.href.split("#");
            const baseHref = hrefParts[0];

            const items = groupedItems.get(baseHref);
            if (!items) {
              groupedItems.set(baseHref, [item]);
            } else {
              items.push(item);
              groupedItems.set(baseHref, items);
            }
          });

          const reshapedItems = [];
          let count = 1;
          for (const [_key, value] of groupedItems) {
            const firstItem = value[0];
            reshapedItems.push({
              type: kItemTypeDoc,
              title: firstItem.title,
              href: firstItem.href,
              text: firstItem.text,
              section: firstItem.section,
            });

            if (value.length > 1) {
              const target = `search-more-${count}`;
              const isExpanded =
                state.context.expanded &&
                state.context.expanded.includes(target);

              const remainingCount = value.length - 1;

              reshapedItems.push({
                target,
                title: isExpanded
                  ? `Hide additional matches`
                  : remainingCount === 1
                  ? `${remainingCount} more match on this page`
                  : `${remainingCount} more matches on this page`,
                type: kItemTypeMore,
              });

              if (isExpanded) {
                for (let i = 1; i < value.length; i++) {
                  reshapedItems.push({
                    ...value[i],
                    type: kItemTypeItem,
                    target,
                  });
                }
              }
            }
            count += 1;
          }

          return {
            ...source,
            getItems() {
              return reshapedItems;
            },
          };
        });
      },
      getSources() {
        return [
          {
            sourceId: "documents",
            onSelect({
              item,
              state,
              setIsOpen,
              setContext,
              setActiveItemId,
              refresh,
            }) {
              if (item.type !== kItemTypeMore) {
                setIsOpen(false);
              } else {
                setIsOpen(true);
                const expanded = state.context.expanded || [];
                if (expanded.includes(item.target)) {
                  setContext({
                    expanded: expanded.filter(
                      (target) => target !== item.target
                    ),
                  });
                } else {
                  setContext({ expanded: [...expanded, item.target] });
                }
                refresh();

                // TODO: Need to potentially use
                // a variable or something to hang onto this state
                setActiveItemId(item.__autocomplete_id);
              }
            },
            getItemUrl({ item }) {
              if (item.href) {
                return offsetURL(item.href);
              } else {
                return undefined;
              }
            },
            getItems({ query }) {
              return fuse.search(query, searchOptions).map((result) => {
                const addParam = (url, name, value) => {
                  const anchorParts = url.split("#");
                  const baseUrl = anchorParts[0];
                  const sep = baseUrl.search("\\?") > 0 ? "&" : "?";
                  anchorParts[0] = baseUrl + sep + name + "=" + value;
                  return anchorParts.join("#");
                };

                return {
                  title: result.item.title,
                  section: result.item.section,
                  href: addParam(result.item.href, kQueryArg, query),
                  text: highlightMatch(query, result.item.text),
                };
              });
            },
            templates: {
              noResults({ createElement }) {
                return createElement(
                  "div",
                  { class: "quarto-search-no-results" },
                  "No results."
                );
              },
              header({ items, createElement }) {
                // count the documents
                const count = items.filter((item) => {
                  return item.type === kItemTypeDoc;
                }).length;

                if (count > 0) {
                  return createElement(
                    "div",
                    { class: "search-result-header" },
                    `${count} matching documents.`
                  );
                } else {
                  return createElement(
                    "div",
                    { class: "search-result-header-no-results" },
                    ``
                  );
                }
              },
              item({ item, createElement }) {
                return renderItem(item, createElement);
              },
            },
          },
        ];
      },
    });

    // If the main document scrolls dismiss the search results
    // (otherwise, since they're floating in the document they can scroll with the document)
    window.document.body.onscroll = () => {
      setIsOpen(false);
    };

    const inputEl = window.document.body.querySelector(".aa-Form .aa-Input");
    if (showSearchResults) {
      if (inputEl) {
        inputEl.focus();
      }
    }

    // Insert share icon
    const inputSuffixEl = window.document.body.querySelector(
      ".aa-Form .aa-InputWrapperSuffix"
    );
    if (inputSuffixEl) {
      const copyButtonEl = window.document.createElement("button");
      copyButtonEl.setAttribute("class", "aa-CopyButton");
      copyButtonEl.setAttribute("type", "button");
      copyButtonEl.setAttribute("title", "Share");
      copyButtonEl.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };

      const linkIcon = "bi-clipboard";
      const checkIcon = "bi-check2";

      const shareIconEl = window.document.createElement("i");
      shareIconEl.setAttribute("class", `bi ${linkIcon}`);
      copyButtonEl.appendChild(shareIconEl);
      inputSuffixEl.prepend(copyButtonEl);

      const clipboard = new window.ClipboardJS(".aa-CopyButton", {
        text: function (_trigger) {
          const copyUrl = new URL(window.location);
          copyUrl.searchParams.set(kQueryArg, lastState.query);
          copyUrl.searchParams.set(kResultsArg, "1");
          return copyUrl.toString();
        },
      });
      clipboard.on("success", function (e) {
        // Focus the input

        // button target
        const button = e.trigger;
        const icon = button.querySelector("i.bi");

        // flash "checked"
        icon.classList.add(checkIcon);
        icon.classList.remove(linkIcon);
        setTimeout(function () {
          icon.classList.remove(checkIcon);
          icon.classList.add(linkIcon);
        }, 1000);
      });
    }
  });
});

/* Search Index Handling */
// create the index
async function createFuseIndex() {
  // create fuse index
  var options = {
    keys: [
      { name: "title", weight: 20 },
      { name: "section", weight: 20 },
      { name: "text", weight: 10 },
    ],
    ignoreLocation: true,
    threshold: 0.1,
  };
  var fuse = new window.Fuse([], options);

  // fetch the main search.json
  const response = await fetch(offsetURL("search.json"));
  if (response.status == 200) {
    return response.json().then(function (searchData) {
      const searchDocs = searchData.docs;
      console.log(searchData);
      searchDocs.forEach(function (searchDoc) {
        fuse.add(searchDoc);
      });
      return fuse;
    });
  } else {
    return Promise.reject(
      new Error(
        "Unexpected status from search index request: " + response.status
      )
    );
  }
}

/* Panels */
const kItemTypeDoc = "document";
const kItemTypeMore = "document-more";
const kItemTypeItem = "document-item";

function renderItem(item, createElement) {
  switch (item.type) {
    case kItemTypeDoc:
      return createDocumentCard(
        createElement,
        "file-richtext",
        item.title,
        item.section,
        item.text,
        item.href
      );
    case kItemTypeMore:
      return createMoreCard(createElement, item.title);
    case kItemTypeItem:
      return createSectionCard(
        createElement,
        item.section,
        item.text,
        item.href
      );
    default:
      return undefined;
  }
}

function createDocumentCard(createElement, icon, title, section, text, href) {
  const iconEl = createElement("i", {
    class: `bi bi-${icon} search-result-icon`,
  });
  const titleEl = createElement("p", { class: "search-result-title" }, title);
  const titleContainerEl = createElement(
    "div",
    { class: "search-result-title-container" },
    [iconEl, titleEl]
  );

  const textEls = [];
  if (section) {
    const sectionEl = createElement(
      "p",
      { class: "search-result-section" },
      section
    );
    textEls.push(sectionEl);
  }
  const descEl = createElement("p", {
    class: "search-result-text",
    dangerouslySetInnerHTML: {
      __html: text,
    },
  });
  textEls.push(descEl);

  const textContainerEl = createElement(
    "div",
    { class: "search-result-text-container" },
    textEls
  );

  const containerEl = createElement(
    "div",
    {
      class: "search-result-container",
    },
    [titleContainerEl, textContainerEl]
  );

  const linkEl = createElement(
    "a",
    {
      href: offsetURL(href),
      class: "search-result-link",
    },
    containerEl
  );

  return createElement(
    "div",
    {
      class: "search-result-doc search-item",
    },
    linkEl
  );
}

function createMoreCard(createElement, title) {
  return createElement(
    "div",
    {
      class: "search-result-more search-item",
    },
    title
  );
}

function createSectionCard(createElement, section, text, href) {
  const sectionEl = createSection(createElement, section, text, href);
  return createElement(
    "div",
    {
      class: "search-result-doc-section search-item",
    },
    sectionEl
  );
}

function createSection(createElement, title, text, href) {
  const descEl = createElement("p", {
    class: "search-result-text",
    dangerouslySetInnerHTML: {
      __html: text,
    },
  });

  const titleEl = createElement("p", { class: "search-result-section" }, title);
  const linkEl = createElement(
    "a",
    {
      href: offsetURL(href),
      class: "search-result-link",
    },
    [titleEl, descEl]
  );
  return linkEl;
}

function positionPanel() {
  const panelEl = window.document.querySelector(
    "#quarto-search-results .aa-Panel"
  );
  const inputEl = window.document.querySelector(
    "#quarto-search .aa-Autocomplete"
  );
  if (panelEl && inputEl) {
    panelEl.style.left = `${inputEl.offsetLeft}px`;
  }
}

/* Highlighting */
// highlighting functions
function highlightMatch(query, text) {
  const start = text.toLowerCase().indexOf(query.toLowerCase());
  if (start !== -1) {
    const end = start + query.length;
    text =
      text.slice(0, start) +
      "<mark class='search-match'>" +
      text.slice(start, end) +
      "</mark>" +
      text.slice(end);
    const clipStart = Math.max(start - 50, 0);
    const clipEnd = clipStart + 200;
    text = text.slice(clipStart, clipEnd);
    return text.slice(text.indexOf(" ") + 1);
  } else {
    return text;
  }
}

// removes highlighting as implemented by the mark tag
function clearHighlight(searchterm, el) {
  const childNodes = el.childNodes;
  for (let i = childNodes.length - 1; i >= 0; i--) {
    const node = childNodes[i];
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (
        node.tagName === "MARK" &&
        node.innerText.toLowerCase() === searchterm.toLowerCase()
      ) {
        el.replaceChild(document.createTextNode(node.innerText), node);
      } else {
        clearHighlight(searchterm, node);
      }
    }
  }
}

// highlight matches
function highlight(term, el) {
  const termRegex = new RegExp(term, "ig");
  const childNodes = el.childNodes;

  // walk back to front avoid mutating elements in front of us
  for (let i = childNodes.length - 1; i >= 0; i--) {
    const node = childNodes[i];

    if (node.nodeType === Node.TEXT_NODE) {
      // Search text nodes for text to highlight
      const text = node.nodeValue;

      let startIndex = 0;
      let matchIndex = text.search(termRegex);
      if (matchIndex > -1) {
        const markFragment = document.createDocumentFragment();
        while (matchIndex > -1) {
          const prefix = text.slice(startIndex, matchIndex);
          markFragment.appendChild(document.createTextNode(prefix));

          const mark = document.createElement("mark");
          mark.appendChild(
            document.createTextNode(
              text.slice(matchIndex, matchIndex + term.length)
            )
          );
          markFragment.appendChild(mark);

          startIndex = matchIndex + term.length;
          matchIndex = text.slice(startIndex).search(new RegExp(term, "ig"));
          if (matchIndex > -1) {
            matchIndex = startIndex + matchIndex;
          }
        }
        if (startIndex < text.length) {
          markFragment.appendChild(
            document.createTextNode(text.slice(startIndex, text.length))
          );
        }

        el.replaceChild(markFragment, node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // recurse through elements
      highlight(term, node);
    }
  }
}

/* Link Handling */
// get the offset from this page for a given site root relative url
function offsetURL(url) {
  var offset = getMeta("quarto:offset");
  return offset ? offset + url : url;
}

// read a meta tag value
function getMeta(metaName) {
  var metas = window.document.getElementsByTagName("meta");
  for (let i = 0; i < metas.length; i++) {
    if (metas[i].getAttribute("name") === metaName) {
      return metas[i].getAttribute("content");
    }
  }
  return "";
}
