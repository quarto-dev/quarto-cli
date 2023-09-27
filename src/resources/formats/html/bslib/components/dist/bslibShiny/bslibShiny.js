/*! bslib 0.5.1 | (c) 2012-2023 RStudio, PBC. | License: MIT + file LICENSE */
"use strict";
(() => {
  // srcts/src/components/_utils.ts
  var InputBinding = window.Shiny ? Shiny.InputBinding : class {
  };

  // srcts/src/components/bslibShiny.ts
  Shiny.addCustomMessageHandler("bslib.toggle-input-binary", function(msg) {
    const el = document.getElementById(msg.id);
    if (!el) {
      console.warn("[bslib.toggle-input-binary] No element found", msg);
    }
    const binding = $(el).data("shiny-input-binding");
    if (!(binding instanceof InputBinding)) {
      console.warn("[bslib.toggle-input-binary] No input binding found", msg);
      return;
    }
    let value = msg.value;
    if (typeof value === "undefined") {
      value = !binding.getValue(el);
    }
    binding.receiveMessage(el, { value });
  });
})();
//# sourceMappingURL=bslibShiny.js.map
