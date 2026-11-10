/*
 * tabset-fragments.js
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

window.QuartoTabsetFragments = function () {
  const kTrigger = "panel-tabset-fragment-trigger";
  const kClassOn = "tabset-fragments";
  const kClassOff = "no-tabset-fragments";

  let deckOn = false;
  const warned = new WeakSet();

  function tabLinks(tabset) {
    return Array.from(
      tabset.querySelectorAll(":scope > ul.panel-tabset-tabby > li > a")
    );
  }

  function panes(tabset) {
    return Array.from(tabset.querySelectorAll(":scope > .tab-content > div"));
  }

  function parentTabset(tabset) {
    return tabset.parentElement
      ? tabset.parentElement.closest(".panel-tabset")
      : null;
  }

  function isFragmented(tabset) {
    const wantsOn = tabset.classList.contains(kClassOn) ||
      (deckOn && !tabset.classList.contains(kClassOff));
    if (!wantsOn) {
      return false;
    }
    if (tabLinks(tabset).length < 2 || panes(tabset).length < 2) {
      return false;
    }
    const outer = parentTabset(tabset);
    if (outer && !isFragmented(outer)) {
      if (tabset.classList.contains(kClassOn) && !warned.has(tabset)) {
        warned.add(tabset);
        console.warn(
          "tabset-fragments: the class '.tabset-fragments' on the tabset \"" +
            tabLinks(tabset)[0].textContent.trim() +
            "\" inside a tabset that is not fragmented is ignored."
        );
      }
      return false;
    }
    return true;
  }

  // Items of a container, in document order: fragments and fragmented
  // tabsets that do not belong to another fragmented tabset inside the container.
  function itemsOf(container) {
    return Array.from(
      container.querySelectorAll(".fragment, .panel-tabset")
    ).filter(function (el) {
      if (el.classList.contains(kTrigger)) {
        return false;
      }
      if (el.classList.contains("panel-tabset") && !isFragmented(el)) {
        return false;
      }
      for (let up = el.parentElement; up && up !== container; up = up.parentElement) {
        if (up.classList.contains("panel-tabset") && isFragmented(up)) {
          return false;
        }
      }
      return true;
    });
  }

  // Reveal.js rule: explicit indices first, ascending, equal values together;
  // then the elements without an index, one group each, in document order.
  function orderGroups(items) {
    const indexed = new Map();
    const unindexed = [];
    items.forEach(function (el) {
      const raw = el.getAttribute("data-fragment-index");
      const index = raw === null ? NaN : parseInt(raw, 10);
      if (Number.isNaN(index)) {
        unindexed.push([el]);
      } else {
        if (!indexed.has(index)) {
          indexed.set(index, []);
        }
        indexed.get(index).push(el);
      }
    });
    const groups = Array.from(indexed.keys())
      .sort(function (a, b) {
        return a - b;
      })
      .map(function (key) {
        return indexed.get(key);
      });
    return groups.concat(unindexed);
  }

  function makeTrigger(tabset, step) {
    const trigger = document.createElement("div");
    trigger.className = "fragment " + kTrigger;
    trigger.setAttribute("data-tabset-step", String(step));
    trigger.setAttribute("aria-hidden", "true");
    trigger.style.display = "none";
    tabset.appendChild(trigger);
    return trigger;
  }

  function expandTabset(tabset) {
    const groups = [];
    if (tabset.classList.contains("fragment")) {
      groups.push([tabset]);
      tabset
        .querySelectorAll(":scope > .tab-content")
        .forEach(function (content) {
          content.classList.remove("fragment");
          content.removeAttribute("data-fragment-index");
        });
    }
    panes(tabset).forEach(function (pane, k) {
      if (k > 0) {
        groups.push([makeTrigger(tabset, k)]);
      }
      groups.push(...expandGroups(orderGroups(itemsOf(pane))));
    });
    return groups;
  }

  function expandGroups(groups) {
    const expanded = [];
    groups.forEach(function (group) {
      if (
        group.length === 1 && group[0].classList.contains("panel-tabset")
      ) {
        expanded.push(...expandTabset(group[0]));
      } else {
        expanded.push(group);
      }
    });
    return expanded;
  }

  function fragmentSlide(slide) {
    const groups = expandGroups(orderGroups(itemsOf(slide)));
    groups.forEach(function (group, index) {
      group.forEach(function (el) {
        el.setAttribute("data-fragment-index", String(index));
      });
    });
  }

  function hasFragmentedTabset(slide) {
    return Array.from(slide.querySelectorAll(".panel-tabset")).some(
      isFragmented
    );
  }

  function syncTabs(slide) {
    if (!slide) {
      return;
    }
    slide.querySelectorAll(".panel-tabset").forEach(function (tabset) {
      if (!tabset.querySelector(":scope > ." + kTrigger)) {
        return;
      }
      const link = tabLinks(tabset)[visibleStep(tabset)];
      if (link && link.getAttribute("aria-selected") !== "true") {
        const focused = document.activeElement;
        const focusOnTabs = tabLinks(tabset).includes(focused);
        link.focus = function () {
          HTMLElement.prototype.focus.call(link, { preventScroll: true });
        };
        try {
          link.click();
        } finally {
          delete link.focus;
        }
        if (!focusOnTabs) {
          if (focused && focused !== document.body) {
            focused.focus({ preventScroll: true });
          } else {
            link.blur();
          }
        }
      }
    });
  }

  function applyTabState(tabset, k) {
    Array.from(
      tabset.querySelectorAll(":scope > ul.panel-tabset-tabby > li")
    ).forEach(function (li, i) {
      li.classList.toggle("active", i === k);
      const link = li.querySelector(":scope > a");
      if (link) {
        link.setAttribute("aria-selected", i === k ? "true" : "false");
      }
    });
    panes(tabset).forEach(function (pane, i) {
      pane.classList.toggle("active", i === k);
      pane.hidden = i !== k;
      pane.style.display = i === k ? "block" : "none";
    });
  }

  function visibleStep(tabset) {
    let k = 0;
    tabset
      .querySelectorAll(":scope > ." + kTrigger + ".visible")
      .forEach(function (trigger) {
        k = Math.max(k, parseInt(trigger.getAttribute("data-tabset-step"), 10));
      });
    return k;
  }

  function triggeredTabsets(page) {
    return Array.from(page.querySelectorAll(".panel-tabset")).filter(
      function (tabset) {
        return tabset.querySelector(":scope > ." + kTrigger) !== null;
      }
    );
  }

  function setPageNumber(page, base, k) {
    const number = page.querySelector(".slide-number-pdf");
    if (number && base !== null) {
      number.textContent = base + "." + k;
    }
  }

  function suffixIds(root, suffix) {
    const outsideSvg = function (el) {
      return el.closest("svg") === null;
    };
    const ids = new Set(
      Array.from(root.querySelectorAll("[id]"))
        .filter(outsideSvg)
        .map(function (el) {
          return el.id;
        })
    );
    const renamed = function (token) {
      return ids.has(token) ? token + suffix : token;
    };
    Array.from(root.querySelectorAll("[href^='#']"))
      .filter(outsideSvg)
      .forEach(function (el) {
        el.setAttribute("href", "#" + renamed(el.getAttribute("href").slice(1)));
      });
    ["aria-controls", "aria-labelledby", "aria-describedby", "for", "headers"].forEach(function (name) {
      Array.from(root.querySelectorAll("[" + name + "]")).filter(outsideSvg).forEach(function (el) {
        el.setAttribute(
          name,
          el.getAttribute(name).split(/\s+/).map(renamed).join(" ")
        );
      });
    });
    Array.from(root.querySelectorAll("[id]"))
      .filter(outsideSvg)
      .forEach(function (el) {
        el.id = el.id + suffix;
      });
  }

  function copyScrollPositions(source, copy) {
    const copied = copy.querySelectorAll("*");
    source.querySelectorAll("*").forEach(function (el, i) {
      if (el.scrollTop !== 0) {
        copied[i].scrollTop = el.scrollTop;
      }
      if (el.scrollLeft !== 0) {
        copied[i].scrollLeft = el.scrollLeft;
      }
    });
  }

  function printStates(page) {
    const tabsets = Array.from(page.querySelectorAll(".panel-tabset"));
    const triggers = Array.from(page.querySelectorAll("." + kTrigger))
      .map(function (el, position) {
        return {
          el: el,
          position: position,
          index: parseInt(el.getAttribute("data-fragment-index"), 10),
        };
      })
      .sort(function (a, b) {
        return a.index - b.index || a.position - b.position;
      });
    const current = new Map();
    const states = [new Map(current)];
    triggers.forEach(function (trigger) {
      const tabset = trigger.el.parentElement;
      tabset.querySelectorAll(".panel-tabset").forEach(function (inner) {
        current.delete(tabsets.indexOf(inner));
      });
      current.set(
        tabsets.indexOf(tabset),
        parseInt(trigger.el.getAttribute("data-tabset-step"), 10)
      );
      states.push(new Map(current));
    });
    return states;
  }

  function printPages(deck) {
    const config = deck.getConfig();
    const pages = Array.from(deck.getRevealElement().querySelectorAll(".pdf-page"));
    pages.forEach(function (page) {
      const tabsets = triggeredTabsets(page);
      if (tabsets.length === 0) {
        return;
      }
      if (config.pdfSeparateFragments !== false) {
        tabsets.forEach(function (tabset) {
          applyTabState(tabset, visibleStep(tabset));
        });
        return;
      }
      const states = printStates(page);
      const baseNumber = page.querySelector(".slide-number-pdf");
      const base = baseNumber ? baseNumber.textContent : null;
      let previous = page;
      for (let k = 0; k < states.length; k++) {
        let current = page;
        if (k > 0) {
          current = page.cloneNode(true);
          suffixIds(current, "-print-" + k);
          previous.after(current);
          copyScrollPositions(page, current);
          previous = current;
        }
        const currentTabsets = Array.from(current.querySelectorAll(".panel-tabset"));
        triggeredTabsets(current).forEach(function (tabset) {
          applyTabState(tabset, states[k].get(currentTabsets.indexOf(tabset)) || 0);
        });
        setPageNumber(current, base, k + 1);
      }
    });
  }

  return {
    id: "QuartoTabsetFragments",
    init: function (deck) {
      const config = deck.getConfig();
      if (config.fragments === false) {
        return;
      }
      deckOn = config.tabsetFragments === true;

      deck
        .getRevealElement()
        .querySelectorAll(".slides section")
        .forEach(function (slide) {
          if (
            slide.querySelector("section") ||
            slide.getAttribute("data-visibility") === "hidden"
          ) {
            return;
          }
          if (hasFragmentedTabset(slide)) {
            fragmentSlide(slide);
          }
        });

      const sync = function () {
        if (deck.isPrintView()) {
          return;
        }
        deck
          .getSlides()
          .filter(function (slide) {
            return (
              !slide.querySelector("section") &&
              slide.querySelector("." + kTrigger) !== null
            );
          })
          .forEach(function (slide) {
            syncTabs(slide);
          });
      };
      deck.on("pdf-ready", function () {
        printPages(deck);
      });
      const syncOnceTabbyIsReady = function () {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", function () {
            setTimeout(sync, 0);
          });
        } else {
          sync();
        }
      };
      deck.on("ready", syncOnceTabbyIsReady);
      ["slidechanged", "fragmentshown", "fragmenthidden"].forEach(
        function (name) {
          deck.on(name, sync);
        }
      );
    },
  };
};
