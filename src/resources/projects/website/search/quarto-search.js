// Fuse search options
const searchOptions = {
  isCaseSensitive: false,
  shouldSort: true,
  minMatchCharLength: 2,
  limit: 25,
};

window.document.addEventListener("DOMContentLoaded", function (_event) {
  // Ensure that search is available on this page. If it isn't,
  // should return early and not do anything
  var searchEl = window.document.getElementById("quarto-search");
  if (!searchEl) return;

  // create the index
  function createFuseIndex() {
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
    return fetch(offsetURL("search.json")).then(function (response) {
      if (response.status == 200) {
        return response.json().then(function (articles) {
          articles.forEach(function (article) {
            fuse.add(article);
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
    });
  }

  // create index then initialize autocomplete
  createFuseIndex().then(function (fuse) {
    // initialize autocomplete
    const { autocomplete } = window["@algolia/autocomplete-js"];

    // Used to determine highlighting behavior for this page
    // A `q` query param is expected when the user follows a search
    // to this page
    const query = new URL(window.location).searchParams.get("q");
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
    autocomplete({
      container: searchEl,
      detachedMediaQuery: "none",
      defaultActiveItemId: 0,
      panelContainer: "#quarto-search-results",
      panelPlacement: "start",
      debug: true,
      classNames: {
        form: "d-flex",
      },
      initialState: {
        query,
      },
      onStateChange({ state }) {
        // Perhaps reset highlighting
        resetHighlighting(state.query);

        // If the panel just opened, ensure the panel is positioned properly
        if (state.isOpen) {
          if (lastState && !lastState.isOpen) {
            console.log(state);
            setTimeout(positionPanel, 100);
          }
        }
        lastState = state;
      },
      getSources() {
        return [
          {
            sourceId: "documents",
            getItemUrl({ item }) {
              return offsetURL(item.href);
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
                  href: addParam(result.item.href, "q", query),
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
                if (items.length > 0) {
                  return createElement(
                    "div",
                    { class: "search-result-header" },
                    `${items.length} matching items.`
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
                const descEl = createElement("p", {
                  class: "search-result-text fw-light small",
                  dangerouslySetInnerHTML: {
                    __html: item.text,
                  },
                });

                const titleEl = createElement(
                  "p",
                  { class: "search-result-title" },
                  `${item.section} — ${item.title}`
                );

                const linkEl = createElement(
                  "a",
                  {
                    href: offsetURL(item.href),
                    class: "search-result-link",
                  },
                  [titleEl, descEl]
                );

                return createElement(
                  "div",
                  {
                    class: "card",
                  },
                  linkEl
                );
              },
            },
          },
        ];
      },
    });
  });
});

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

// highlighting functions
function highlightMatch(query, text) {
  const start = text.toLowerCase().indexOf(query.toLowerCase());
  if (start !== -1) {
    const end = start + query.length;
    text =
      text.slice(0, start) +
      "<em>" +
      text.slice(start, end) +
      "</em>" +
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
