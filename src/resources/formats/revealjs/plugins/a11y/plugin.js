window.QuartoA11y = function () {
  const getKeyboardFocusableElements = function (element) {
    return [
      ...element.querySelectorAll(
        'a[href], button, input, textarea, select, details,[tabindex]:not([tabindex="-1"])'
      ),
    ].filter(
      (el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden")
    );
  };

  return {
    id: "quarto-a11y",
    init: function (deck) {
      // detect use of keyboard/mouse and use that to drive visibility of focus rectangles
      window.document.body.addEventListener("keydown", function (event) {
        const kTabKeyCode = 9;
        if (event.keyCode === kTabKeyCode) {
          // if the accessiblityWrapper or body is focused then cancel event and focus first focusable element
          if (
            document.activeElement.classList.contains("accessibilityWrapper")
          ) {
            const focusable = getKeyboardFocusableElements(
              document.activeElement
            );
            if (focusable.length > 0) {
              focusable[0].focus();
              event.preventDefault();
              event.stopPropagation();
            }
          }
          window.document.body.classList.add("using-keyboard");
        }
      });
      window.document.body.addEventListener("mousedown", function () {
        window.document.body.classList.remove("using-keyboard");
      });

      // slide change focuses first focusable element
      deck.on("slidechanged", function (event) {
        setTimeout(function () {
          const wrapper = event.currentSlide.querySelector(
            ".accessibilityWrapper"
          );
          if (wrapper) {
            wrapper.focus();
          }
        }, 100);
      });

      // wrap slide content in an .accessibilityWrapper so that it has display: none
      // when not visable. additionally, add an aria-label indicating the slide number
      const SLIDE_SELECTOR = ".slides > section";
      const PLUGIN_SLIDES = [];

      // helper to decorate a slide
      function decorateSlide(slideArray, index, outerIndex) {
        // populate new array of actual slides
        PLUGIN_SLIDES.push(slideArray[index]);

        // provide nested URL fragments and section labels
        function decorateIndices(incrementor, divider) {
          if (outerIndex !== undefined) {
            return outerIndex + incrementor + divider + (index + incrementor);
          }
          return index + incrementor;
        }
        slideArray[index].setAttribute("data-id", decorateIndices(0, "/"));
        // label each section with its human-readable slide number
        slideArray[index].setAttribute(
          "aria-label",
          "Slide " + decorateIndices(1, ", child ")
        );

        var contents = slideArray[index].innerHTML;
        slideArray[index].innerHTML =
          '<div class="accessibilityWrapper" tabindex="-1">' +
          contents +
          "</div>";
      }

      // get slides, wrap contents in 'accessibilityWrapper'
      // only wrap sections containing content
      const slides = document.querySelectorAll(SLIDE_SELECTOR);
      for (let i = 0; i < slides.length; i++) {
        // if slide has child sections, loop through those instead
        const nestedSlides = slides[i].querySelectorAll("section");
        if (nestedSlides.length > 0) {
          for (let k = 0; k < nestedSlides.length; k++) {
            decorateSlide(nestedSlides, k, i);
          }
        } else {
          // filter out nested slides
          if (!slides[i].classList.contains("stack")) {
            decorateSlide(slides, i);
          }
        }
      }
    },
  };
};
