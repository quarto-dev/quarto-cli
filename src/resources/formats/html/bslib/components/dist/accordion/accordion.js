/*! bslib 0.5.1 | (c) 2012-2023 RStudio, PBC. | License: MIT + file LICENSE */
"use strict";
(() => {
  // srcts/src/components/_utils.ts
  var InputBinding = window.Shiny ? Shiny.InputBinding : class {
  };
  function registerBinding(inputBindingClass, name) {
    if (window.Shiny) {
      Shiny.inputBindings.register(new inputBindingClass(), "bslib." + name);
    }
  }
  function hasDefinedProperty(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop) && obj[prop] !== void 0;
  }

  // srcts/src/components/accordion.ts
  var AccordionInputBinding = class extends InputBinding {
    find(scope) {
      return $(scope).find(".accordion.bslib-accordion-input");
    }
    getValue(el) {
      const items = this._getItemInfo(el);
      const selected = items.filter((x) => x.isOpen()).map((x) => x.value);
      return selected.length === 0 ? null : selected;
    }
    subscribe(el, callback) {
      $(el).on(
        "shown.bs.collapse.accordionInputBinding hidden.bs.collapse.accordionInputBinding",
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        function(event) {
          callback(true);
        }
      );
    }
    unsubscribe(el) {
      $(el).off(".accordionInputBinding");
    }
    receiveMessage(el, data) {
      const method = data.method;
      if (method === "set") {
        this._setItems(el, data);
      } else if (method === "open") {
        this._openItems(el, data);
      } else if (method === "close") {
        this._closeItems(el, data);
      } else if (method === "remove") {
        this._removeItem(el, data);
      } else if (method === "insert") {
        this._insertItem(el, data);
      } else if (method === "update") {
        this._updateItem(el, data);
      } else {
        throw new Error(`Method not yet implemented: ${method}`);
      }
    }
    _setItems(el, data) {
      const items = this._getItemInfo(el);
      const vals = this._getValues(el, items, data.values);
      items.forEach((x) => {
        vals.indexOf(x.value) > -1 ? x.show() : x.hide();
      });
    }
    _openItems(el, data) {
      const items = this._getItemInfo(el);
      const vals = this._getValues(el, items, data.values);
      items.forEach((x) => {
        if (vals.indexOf(x.value) > -1)
          x.show();
      });
    }
    _closeItems(el, data) {
      const items = this._getItemInfo(el);
      const vals = this._getValues(el, items, data.values);
      items.forEach((x) => {
        if (vals.indexOf(x.value) > -1)
          x.hide();
      });
    }
    _insertItem(el, data) {
      let targetItem = this._findItem(el, data.target);
      if (!targetItem) {
        targetItem = data.position === "before" ? el.firstElementChild : el.lastElementChild;
      }
      const panel = data.panel;
      if (targetItem) {
        Shiny.renderContent(
          targetItem,
          panel,
          data.position === "before" ? "beforeBegin" : "afterEnd"
        );
      } else {
        Shiny.renderContent(el, panel);
      }
      if (this._isAutoClosing(el)) {
        const val = $(panel.html).attr("data-value");
        $(el).find(`[data-value="${val}"] .accordion-collapse`).attr("data-bs-parent", "#" + el.id);
      }
    }
    _removeItem(el, data) {
      const targetItems = this._getItemInfo(el).filter(
        (x) => data.target.indexOf(x.value) > -1
      );
      const unbindAll = Shiny == null ? void 0 : Shiny.unbindAll;
      targetItems.forEach((x) => {
        if (unbindAll)
          unbindAll(x.item);
        x.item.remove();
      });
    }
    _updateItem(el, data) {
      const target = this._findItem(el, data.target);
      if (!target) {
        throw new Error(
          `Unable to find an accordion_panel() with a value of ${data.target}`
        );
      }
      if (hasDefinedProperty(data, "value")) {
        target.dataset.value = data.value;
      }
      if (hasDefinedProperty(data, "body")) {
        const body = target.querySelector(".accordion-body");
        Shiny.renderContent(body, data.body);
      }
      const header = target.querySelector(".accordion-header");
      if (hasDefinedProperty(data, "title")) {
        const title = header.querySelector(".accordion-title");
        Shiny.renderContent(title, data.title);
      }
      if (hasDefinedProperty(data, "icon")) {
        const icon = header.querySelector(
          ".accordion-button > .accordion-icon"
        );
        Shiny.renderContent(icon, data.icon);
      }
    }
    _getItemInfo(el) {
      const items = Array.from(
        el.querySelectorAll(":scope > .accordion-item")
      );
      return items.map((x) => this._getSingleItemInfo(x));
    }
    _getSingleItemInfo(x) {
      const collapse = x.querySelector(".accordion-collapse");
      const isOpen = () => $(collapse).hasClass("show");
      return {
        item: x,
        value: x.dataset.value,
        isOpen,
        show: () => {
          if (!isOpen())
            $(collapse).collapse("show");
        },
        hide: () => {
          if (isOpen())
            $(collapse).collapse("hide");
        }
      };
    }
    _getValues(el, items, values) {
      let vals = values !== true ? values : items.map((x) => x.value);
      const autoclose = this._isAutoClosing(el);
      if (autoclose) {
        vals = vals.slice(vals.length - 1, vals.length);
      }
      return vals;
    }
    _findItem(el, value) {
      return el.querySelector(`[data-value="${value}"]`);
    }
    _isAutoClosing(el) {
      return el.classList.contains("autoclose");
    }
  };
  registerBinding(AccordionInputBinding, "accordion");
})();
//# sourceMappingURL=accordion.js.map
