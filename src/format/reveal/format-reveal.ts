/*
 * format-reveal.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { join } from "path/mod.ts";

import { Document, Element, NodeType } from "../../core/deno-dom.ts";
import {
  kCodeLineNumbers,
  kFrom,
  kHtmlMathMethod,
  kIncludeInHeader,
  kLinkCitations,
  kReferenceLocation,
  kRevealJsScripts,
  kSlideLevel,
} from "../../config/constants.ts";

import {
  Format,
  kHtmlPostprocessors,
  kMarkdownAfterBody,
  kTextHighlightingMode,
  Metadata,
  PandocFlags,
} from "../../config/types.ts";
import { mergeConfigs } from "../../core/config.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { renderEjs } from "../../core/ejs.ts";
import { findParent } from "../../core/html.ts";
import { createHtmlPresentationFormat } from "../formats-shared.ts";
import { pandocFormatWith } from "../../core/pandoc/pandoc-formats.ts";
import { htmlFormatExtras } from "../html/format-html.ts";
import { revealPluginExtras } from "./format-reveal-plugin.ts";
import { RevealPluginScript } from "./format-reveal-plugin-types.ts";
import { revealTheme } from "./format-reveal-theme.ts";
import {
  revealMuliplexPreviewFile,
  revealMultiplexExtras,
} from "./format-reveal-multiplex.ts";
import {
  insertFootnotesTitle,
  removeFootnoteBacklinks,
} from "../html/format-html-shared.ts";
import {
  HtmlPostProcessResult,
  RenderServices,
} from "../../command/render/types.ts";
import {
  kAutoAnimateDuration,
  kAutoAnimateEasing,
  kAutoAnimateUnmatched,
  kAutoStretch,
  kCenter,
  kCenterTitleSlide,
  kControlsAuto,
  kHashType,
  kPdfMaxPagesPerSlide,
  kPdfSeparateFragments,
  kPreviewLinksAuto,
  kRevealJsConfig,
  kScrollable,
  kSlideFooter,
  kSlideLogo,
} from "./constants.ts";
import { revealMetadataFilter } from "./metadata.ts";
import { ProjectContext } from "../../project/types.ts";
import { titleSlidePartial } from "./format-reveal-title.ts";
import { registerWriterFormatHandler } from "../format-handlers.ts";

export function revealResolveFormat(format: Format) {
  format.metadata = revealMetadataFilter(format.metadata);

  // map "vertical" navigation mode to "default"
  if (format.metadata["navigationMode"] === "vertical") {
    format.metadata["navigationMode"] = "default";
  }
}

export function revealjsFormat() {
  return mergeConfigs(
    createHtmlPresentationFormat("RevealJS", 10, 5),
    {
      pandoc: {
        [kHtmlMathMethod]: {
          method: "mathjax",
          url:
            "https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.0/MathJax.js?config=TeX-AMS_HTML-full",
        },
        [kSlideLevel]: 2,
      },
      render: {
        [kCodeLineNumbers]: true,
      },
      metadata: {
        [kAutoStretch]: true,
      },
      resolveFormat: revealResolveFormat,
      formatPreviewFile: revealMuliplexPreviewFile,
      formatExtras: async (
        input: string,
        _markdown: string,
        flags: PandocFlags,
        format: Format,
        libDir: string,
        services: RenderServices,
        offset: string,
        project: ProjectContext,
      ) => {
        // render styles template based on options
        const stylesFile = services.temp.createFile({ suffix: ".html" });
        const styles = renderEjs(
          formatResourcePath("revealjs", "styles.html"),
          { [kScrollable]: format.metadata[kScrollable] },
        );
        Deno.writeTextFileSync(stylesFile, styles);

        // specify controlsAuto if there is no boolean 'controls'
        const metadataOverride: Metadata = {};
        const controlsAuto = typeof (format.metadata["controls"]) !== "boolean";
        if (controlsAuto) {
          metadataOverride.controls = false;
        }

        // specify previewLinksAuto if there is no boolean 'previewLinks'
        const previewLinksAuto = format.metadata["previewLinks"] === "auto";
        if (previewLinksAuto) {
          metadataOverride.previewLinks = false;
        }

        // additional options not supported by pandoc
        const extraConfig: Record<string, unknown> = {
          [kControlsAuto]: controlsAuto,
          [kPreviewLinksAuto]: previewLinksAuto,
          [kPdfSeparateFragments]: !!format.metadata[kPdfSeparateFragments],
          [kAutoAnimateEasing]: format.metadata[kAutoAnimateEasing] || "ease",
          [kAutoAnimateDuration]: format.metadata[kAutoAnimateDuration] ||
            1.0,
          [kAutoAnimateUnmatched]:
            format.metadata[kAutoAnimateUnmatched] !== undefined
              ? format.metadata[kAutoAnimateUnmatched]
              : true,
        };

        if (format.metadata[kPdfMaxPagesPerSlide]) {
          extraConfig[kPdfMaxPagesPerSlide] =
            format.metadata[kPdfMaxPagesPerSlide];
        }

        // get theme info (including text highlighing mode)
        const theme = await revealTheme(format, input, libDir, services.temp);

        const revealPluginData = await revealPluginExtras(
          input,
          format,
          flags,
          services.temp,
          theme.revealUrl,
          theme.revealDestDir,
          services.extension,
          project,
        ); // Add plugin scripts to metadata for template to use

        // Provide a template context
        const templateDir = formatResourcePath("revealjs", "pandoc");
        const partials = [
          "toc-slide.html",
          titleSlidePartial(format),
        ];
        const templateContext = {
          template: join(templateDir, "template.html"),
          partials: partials.map((partial) => join(templateDir, partial)),
        };

        // start with html format extras and our standard  & plugin extras
        let extras = mergeConfigs(
          // extras for all html formats
          await htmlFormatExtras(
            input,
            flags,
            offset,
            format,
            services.temp,
            project,
            {
              tabby: true,
              anchors: false,
              copyCode: true,
              hoverCitations: true,
              hoverFootnotes: true,
              hoverXrefs: false,
              figResponsive: false,
            }, // tippy options
            {
              parent: "section.slide",
              config: {
                offset: [0, 0],
                maxWidth: 700,
              },
            },
            {
              quartoBase: false,
            },
          ),
          // default extras for reveal
          {
            args: [],
            pandoc: {},
            metadata: {
              [kLinkCitations]: true,
              [kRevealJsScripts]: revealPluginData.pluginInit.scripts.map(
                (script) => {
                  return script.path;
                },
              ),
            } as Metadata,
            metadataOverride,
            templateContext,
            [kIncludeInHeader]: [
              formatResourcePath("html", "styles-callout.html"),
              stylesFile,
            ],
            html: {
              [kHtmlPostprocessors]: [
                revealHtmlPostprocessor(
                  format,
                  extraConfig,
                  revealPluginData.pluginInit,
                  theme["text-highlighting-mode"],
                ),
              ],
              [kMarkdownAfterBody]: [revealMarkdownAfterBody(format)],
            },
          },
        );

        extras.metadataOverride = {
          ...extras.metadataOverride,
          ...theme.metadata,
        };
        extras.html![kTextHighlightingMode] = theme[kTextHighlightingMode];

        // add plugins
        extras = mergeConfigs(
          revealPluginData.extras,
          extras,
        );

        // add multiplex if we have it
        const multiplexExtras = revealMultiplexExtras(format, flags);
        if (multiplexExtras) {
          extras = mergeConfigs(extras, multiplexExtras);
        }

        // provide alternate defaults unless the user requests revealjs defaults
        if (format.metadata[kRevealJsConfig] !== "default") {
          // detect whether we are using vertical slides
          const navigationMode = format.metadata["navigationMode"];
          const verticalSlides = navigationMode === "default" ||
            navigationMode === "grid";

          // if the user set slideNumber to true then provide
          // linear slides (if they haven't specified vertical slides)
          if (format.metadata["slideNumber"] === true) {
            extras.metadataOverride!["slideNumber"] = verticalSlides
              ? "h.v"
              : "c/t";
          }

          // opinionated version of reveal config defaults
          extras.metadata = {
            ...extras.metadata,
            ...revealMetadataFilter({
              width: 1050,
              height: 700,
              margin: 0.1,
              center: false,
              navigationMode: "linear",
              controlsLayout: "edges",
              controlsTutorial: false,
              hash: true,
              history: true,
              hashOneBasedIndex: false,
              fragmentInURL: false,
              transition: "none",
              backgroundTransition: "none",
              pdfSeparateFragments: false,
            }),
          };
        }

        // hash-type: number (as shorthand for -auto_identifiers)
        if (format.metadata[kHashType] === "number") {
          extras.pandoc = {
            ...extras.pandoc,
            from: pandocFormatWith(
              format.pandoc[kFrom] || "markdown",
              "",
              "-auto_identifiers",
            ),
          };
        }

        // return extras
        return extras;
      },
    },
  );
}

function revealMarkdownAfterBody(format: Format) {
  const lines: string[] = [];
  if (format.metadata[kSlideLogo]) {
    lines.push(
      `<img src="${format.metadata[kSlideLogo]}" class="slide-logo" />`,
    );
    lines.push("\n");
  }
  lines.push("::: {.footer .footer-default}");
  if (format.metadata[kSlideFooter]) {
    lines.push(String(format.metadata[kSlideFooter]));
  } else {
    lines.push("");
  }
  lines.push(":::");
  lines.push("\n");

  return lines.join("\n");
}

const kOutputLocationSlide = "output-location-slide";

function revealHtmlPostprocessor(
  format: Format,
  extraConfig: Record<string, unknown>,
  pluginInit: {
    scripts: RevealPluginScript[];
    register: string[];
    revealConfig: Record<string, unknown>;
  },
  highlightingMode: "light" | "dark",
) {
  return (doc: Document): Promise<HtmlPostProcessResult> => {
    // apply highlighting mode to body
    doc.body.classList.add("quarto-" + highlightingMode);

    // determine if we are embedding footnotes on slides
    const slideFootnotes = format.pandoc[kReferenceLocation] !== "document";

    // compute slide level and slide headings
    const slideLevel = format.pandoc[kSlideLevel] || 2;
    const slideHeadingTags = Array.from(Array(slideLevel)).map((_e, i) =>
      "H" + (i + 1)
    );

    // find output-location-slide and inject slides as required
    const slideOutputs = doc.querySelectorAll(`.${kOutputLocationSlide}`);
    for (const slideOutput of slideOutputs) {
      // find parent slide
      const slideOutputEl = slideOutput as Element;
      const parentSlide = findParentSlide(slideOutputEl);
      if (parentSlide && parentSlide.parentElement) {
        const newSlide = doc.createElement("section");
        newSlide.setAttribute(
          "id",
          parentSlide?.id ? parentSlide.id + "-output" : "",
        );
        for (const clz of parentSlide.classList) {
          newSlide.classList.add(clz);
        }
        newSlide.classList.add(kOutputLocationSlide);
        // repeat header if there is one
        if (
          slideHeadingTags.includes(
            parentSlide.firstElementChild?.tagName || "",
          )
        ) {
          const headingEl = doc.createElement(
            parentSlide.firstElementChild?.tagName!,
          );
          headingEl.innerHTML = parentSlide.firstElementChild?.innerHTML || "";
          newSlide.appendChild(headingEl);
        }
        newSlide.appendChild(slideOutputEl);
        // Place the new slide after the current one
        const nextSlide = parentSlide.nextElementSibling;
        parentSlide.parentElement.insertBefore(newSlide, nextSlide);
      }
    }

    // if we are using 'number' as our hash type then remove the
    // title slide id
    if (format.metadata[kHashType] === "number") {
      const titleSlide = doc.getElementById("title-slide");
      if (titleSlide) {
        titleSlide.removeAttribute("id");
        // required for title-slide-style: pandoc
        titleSlide.classList.add("quarto-title-block");
      }
    }

    // find reveal initialization and perform fixups
    const scripts = doc.querySelectorAll("script");
    for (const script of scripts) {
      const scriptEl = script as Element;
      if (
        scriptEl.innerText &&
        scriptEl.innerText.indexOf("Reveal.initialize({") !== -1
      ) {
        // quote slideNumber
        scriptEl.innerText = scriptEl.innerText.replace(
          /slideNumber: (h[\.\/]v|c(?:\/t)?)/,
          "slideNumber: '$1'",
        );

        // quote width and heigh if in %
        scriptEl.innerText = scriptEl.innerText.replace(
          /width: (\d+(\.\d+)?%)/,
          "width: '$1'",
        );
        scriptEl.innerText = scriptEl.innerText.replace(
          /height: (\d+(\.\d+)?%)/,
          "height: '$1'",
        );

        // plugin registration
        if (pluginInit.register.length > 0) {
          const kRevealPluginArray = "plugins: [";
          scriptEl.innerText = scriptEl.innerText.replace(
            kRevealPluginArray,
            kRevealPluginArray + pluginInit.register.join(", ") + ",\n",
          );
        }

        // Write any additional configuration of reveal
        const configJs: string[] = [];
        Object.keys(extraConfig).forEach((key) => {
          configJs.push(
            `'${key}': ${JSON.stringify(extraConfig[key])}`,
          );
        });

        // Plugin initialization
        Object.keys(pluginInit.revealConfig).forEach((key) => {
          configJs.push(
            `'${key}': ${JSON.stringify(pluginInit.revealConfig[key])}`,
          );
        });

        const configStr = configJs.join(",\n");

        scriptEl.innerText = scriptEl.innerText.replace(
          "Reveal.initialize({",
          `Reveal.initialize({\n${configStr},\n`,
        );
      }
    }

    // remove slides with data-visibility=hidden
    const invisibleSlides = doc.querySelectorAll(
      'section.slide[data-visibility="hidden"]',
    );
    for (let i = invisibleSlides.length - 1; i >= 0; i--) {
      const slide = invisibleSlides.item(i);
      // remove from toc
      const id = (slide as Element).id;
      if (id) {
        const tocEntry = doc.querySelector(
          'nav[role="doc-toc"] a[href="#/' + id + '"]',
        );
        if (tocEntry) {
          tocEntry.parentElement?.remove();
        }
      }

      // remove slide
      slide.parentNode?.removeChild(slide);
    }

    // remove from toc all slides that have no title
    const tocEntries = Array.from(doc.querySelectorAll(
      'nav[role="doc-toc"] a[href^="#/"]',
    ));
    for (const tocEntry of tocEntries) {
      const tocEntryEl = tocEntry as Element;
      if (tocEntryEl.textContent.trim() === "") {
        tocEntryEl.parentElement?.remove();
      }
    }

    // remove all attributes from slide headings (pandoc has already moved
    // them to the enclosing section)
    const slideHeadings = doc.querySelectorAll("section.slide > :first-child");
    slideHeadings.forEach((slideHeading) => {
      const slideHeadingEl = slideHeading as Element;
      if (slideHeadingTags.includes(slideHeadingEl.tagName)) {
        // remove attributes
        for (const attrib of slideHeadingEl.getAttributeNames()) {
          slideHeadingEl.removeAttribute(attrib);
          // if it's auto-animate then do some special handling
          if (attrib === "data-auto-animate") {
            // link slide titles for animation
            slideHeadingEl.setAttribute("data-id", "quarto-animate-title");
            // add animation id to code blocks
            const codeBlocks = slideHeadingEl.parentElement?.querySelectorAll(
              "div.sourceCode > pre > code",
            );
            if (codeBlocks?.length === 1) {
              const codeEl = codeBlocks.item(0) as Element;
              const preEl = codeEl.parentElement!;
              preEl.setAttribute(
                "data-id",
                "quarto-animate-code",
              );
              // markup with highlightjs classes so that are sucessfully targeted by
              // autoanimate.js
              codeEl.classList.add("hljs");
              codeEl.childNodes.forEach((spanNode) => {
                if (spanNode.nodeType === NodeType.ELEMENT_NODE) {
                  const spanEl = spanNode as Element;
                  spanEl.classList.add("hljs-ln-code");
                }
              });
            }
          }
        }
      }
    });

    // center title slide if requested
    // note that disabling title slide centering when the rest of the
    // slides are centered doesn't currently work b/c reveal consults
    // the global 'center' config as well as the class. to overcome
    // this we'd need to always set 'center: false` and then
    // put the .center classes onto each slide manually. we're not
    // doing this now the odds a user would want all of their
    // slides cnetered but NOT the title slide are close to zero
    if (format.metadata[kCenterTitleSlide] !== false) {
      const titleSlide = doc.getElementById("title-slide") as Element ??
        // when hash-type: number, id are removed
        doc.querySelector(".reveal .slides section.quarto-title-block");
      if (titleSlide) {
        titleSlide.classList.add("center");
      }
      const titleSlides = doc.querySelectorAll(".title-slide");
      for (const slide of titleSlides) {
        (slide as Element).classList.add("center");
      }
    }

    // center other slides if requested
    if (format.metadata[kCenter] === true) {
      for (const slide of doc.querySelectorAll("section.slide")) {
        const slideEl = slide as Element;
        slideEl.classList.add("center");
      }
    }

    // inject css to hide assistive mml in speaker notes (have to do it for each aside b/c the asides are
    // slurped into speaker mode one at a time using innerHTML) note that we can remvoe this hack when we begin
    // defaulting to MathJax 3 (after Pandoc updates their template to support Reveal 4.2 / MathJax 3)
    // see discussion of underlying issue here: https://github.com/hakimel/reveal.js/issues/1726
    // hack here: https://stackoverflow.com/questions/35534385/mathjax-config-for-web-mobile-and-assistive
    const notes = doc.querySelectorAll("aside.notes");
    for (const note of notes) {
      const style = doc.createElement("style");
      style.setAttribute("type", "text/css");
      style.innerHTML = `
        span.MJX_Assistive_MathML {
          position:absolute!important;
          clip: rect(1px, 1px, 1px, 1px);
          padding: 1px 0 0 0!important;
          border: 0!important;
          height: 1px!important;
          width: 1px!important;
          overflow: hidden!important;
          display:block!important;
      }`;
      note.appendChild(style);
    }

    // collect up asides into a single aside
    const slides = doc.querySelectorAll("section.slide");
    for (const slide of slides) {
      const slideEl = slide as Element;
      const asides = slideEl.querySelectorAll("aside:not(.notes)");
      const asideDivs = slideEl.querySelectorAll("div.aside");
      const footnotes = slideEl.querySelectorAll('a[role="doc-noteref"]');
      if (asides.length > 0 || asideDivs.length > 0 || footnotes.length > 0) {
        const aside = doc.createElement("aside");
        // deno-lint-ignore no-explicit-any
        const collectAsides = (asideList: any) => {
          asideList.forEach((asideEl: Element) => {
            const asideDiv = doc.createElement("div");
            asideDiv.innerHTML = (asideEl as Element).innerHTML;
            aside.appendChild(asideDiv);
          });
          asideList.forEach((asideEl: Element) => {
            asideEl.remove();
          });
        };
        // start with asides and div.aside
        collectAsides(asides);
        collectAsides(asideDivs);

        // append footnotes
        if (slideFootnotes && footnotes.length > 0) {
          const ol = doc.createElement("ol");
          ol.classList.add("aside-footnotes");
          footnotes.forEach((note, index) => {
            const noteEl = note as Element;
            const href = noteEl.getAttribute("href");
            if (href) {
              const noteLi = doc.getElementById(href.replace(/^#\//, ""));
              if (noteLi) {
                // remove backlink
                const footnoteBack = noteLi.querySelector(".footnote-back");
                if (footnoteBack) {
                  footnoteBack.remove();
                }
                ol.appendChild(noteLi);
              }
            }
            const sup = doc.createElement("sup");
            sup.innerText = (index + 1) + "";
            noteEl.replaceWith(sup);
          });
          aside.appendChild(ol);
        }

        slide.appendChild(aside);
      }
    }

    const footnotes = doc.querySelectorAll('section[role="doc-endnotes"]');
    if (slideFootnotes) {
      // we are using slide based footnotes so remove footnotes slide from end
      for (const footnoteSection of footnotes) {
        (footnoteSection as Element).remove();
      }
    } else {
      let footnotesId: string | undefined;
      const footnotes = doc.querySelectorAll('section[role="doc-endnotes"]');
      if (footnotes.length === 1) {
        const footnotesEl = footnotes[0] as Element;
        footnotesId = footnotesEl?.getAttribute("id") || "footnotes";
        footnotesEl.setAttribute("id", footnotesId);
        insertFootnotesTitle(doc, footnotesEl, format.language, slideLevel);
        footnotesEl.classList.add("smaller");
        footnotesEl.classList.add("scrollable");
        footnotesEl.classList.remove("center");
        removeFootnoteBacklinks(footnotesEl);
      }

      // we are keeping footnotes at the end so disable the links (we use popups)
      // and tweak the footnotes slide (add a title add smaller/scrollable)
      const notes = doc.querySelectorAll('a[role="doc-noteref"]');
      for (const note of notes) {
        const noteEl = note as Element;
        noteEl.setAttribute("data-footnote-href", noteEl.getAttribute("href"));
        noteEl.setAttribute("href", footnotesId ? `#/${footnotesId}` : "");
        noteEl.setAttribute("onclick", footnotesId ? "" : "return false;");
      }
    }

    // add scrollable to refs slide
    let refsId: string | undefined;
    const refs = doc.querySelector("#refs");
    if (refs) {
      const refsSlide = findParentSlide(refs);
      if (refsSlide) {
        refsId = refsSlide?.getAttribute("id") || "references";
        refsSlide.setAttribute("id", refsId);
      }
      applyClassesToParentSlide(refs, ["smaller", "scrollable"]);
      removeClassesFromParentSlide(refs, ["center"]);
    }

    // #6866: add .scrollable to all sections with ordered lists if format.scrollable is true
    if (format.metadata[kScrollable] === true) {
      const ol = doc.querySelectorAll("ol");
      for (const olEl of ol) {
        const olParent = findParent(olEl as Element, (el: Element) => {
          return el.nodeName === "SECTION";
        });
        if (olParent) {
          olParent.classList.add("scrollable");
        }
      }
    }

    // handle citation links
    const cites = doc.querySelectorAll('a[role="doc-biblioref"]');
    for (const cite of cites) {
      const citeEl = cite as Element;
      citeEl.setAttribute("href", refsId ? `#/${refsId}` : "");
      citeEl.setAttribute("onclick", refsId ? "" : "return false;");
    }

    // apply stretch to images as required
    applyStretch(doc, format.metadata[kAutoStretch] as boolean);

    // include chalkboard src json if specified
    const result: HtmlPostProcessResult = {
      resources: [],
      supporting: [],
    };
    const chalkboard = format.metadata["chalkboard"];
    if (typeof chalkboard === "object") {
      const chalkboardSrc = (chalkboard as Record<string, unknown>)["src"];
      if (typeof chalkboardSrc === "string") {
        result.resources.push(chalkboardSrc);
      }
    }

    // Remove anchors on numbered code chunks as they can't work
    // because ids are used for sections in revealjs
    const codeLinesAnchors = doc.querySelectorAll(
      "span[id^='cb'] > a[href^='#c']",
    );
    codeLinesAnchors.forEach((codeLineAnchor) => {
      const codeLineAnchorEl = codeLineAnchor as Element;
      codeLineAnchorEl.removeAttribute("href");
    });

    // https://github.com/quarto-dev/quarto-cli/issues/3533
    // redirect anchors to the slide they refer to
    const anchors = doc.querySelectorAll("a[href^='#/']");
    for (const anchor of anchors) {
      const anchorEl = anchor as Element;
      const href = anchorEl.getAttribute("href");
      if (href) {
        const target = doc.getElementById(href.replace(/^#\//, ""));
        if (target) {
          const slide = findParentSlide(target);
          if (slide && slide.getAttribute("id")) {
            anchorEl.setAttribute("href", `#/${slide.getAttribute("id")}`);
          }
        }
      }
    }

    // return result
    return Promise.resolve(result);
  };
}

function applyStretch(doc: Document, autoStretch: boolean) {
  // Add stretch class to images in slides with only one image
  const allSlides = doc.querySelectorAll("section.slide");
  for (const slide of allSlides) {
    const slideEl = slide as Element;

    // opt-out mechanism per slide
    if (slideEl.classList.contains("nostretch")) continue;

    const images = slideEl.querySelectorAll("img");
    // only target slides with one image
    if (images.length === 1) {
      const image = images[0];
      const imageEl = image as Element;

      if (
        // screen out early specials divs (layout panels, columns, fragments, ...)
        findParent(imageEl, (el: Element) => {
          return el.classList.contains("column") ||
            el.classList.contains("quarto-layout-panel") ||
            el.classList.contains("fragment") ||
            el.classList.contains(kOutputLocationSlide) ||
            !!el.className.match(/panel-/);
        }) ||
        // Do not autostrech if an aside is used
        slideEl.querySelectorAll("aside:not(.notes)").length !== 0
      ) {
        continue;
      }

      // find the first level node that contains the img
      let selNode: Element | undefined;
      for (const node of slide.childNodes) {
        if (node.contains(image)) {
          selNode = node as Element;
          break;
        }
      }
      const nodeEl = selNode;

      // Do not apply stretch if this is an inline image among text
      if (
        !nodeEl || (nodeEl.nodeName === "P" && nodeEl.childNodes.length > 1)
      ) {
        continue;
      }

      const hasStretchClass = function (el: Element): boolean {
        return el.classList.contains("stretch") ||
          el.classList.contains("r-stretch");
      };

      // Only apply auto stretch on specific known structures
      // and avoid applying automatically on custom divs
      if (
        // on <p><img> (created by Pandoc)
        nodeEl.nodeName === "P" ||
        // on quarto figure divs
        nodeEl.nodeName === "DIV" &&
          nodeEl.classList.contains("quarto-figure") ||
        // on computation output created image
        nodeEl.nodeName === "DIV" && nodeEl.classList.contains("cell") ||
        // on other divs (custom divs) when explicitly opt-in
        nodeEl.nodeName === "DIV" && hasStretchClass(nodeEl)
      ) {
        // for custom divs, remove stretch class as it should only be present on img
        if (nodeEl.nodeName === "DIV" && hasStretchClass(nodeEl)) {
          nodeEl.classList.remove("r-stretch");
          nodeEl.classList.remove("stretch");
        }

        // add stretch class if not already when auto-stretch is set
        if (
          autoStretch === true &&
          !hasStretchClass(imageEl) &&
          // if height is already set, we do nothing
          !imageEl.getAttribute("style")?.match("height:") &&
          !imageEl.hasAttribute("height") &&
          // do not add when .absolute is used
          !imageEl.classList.contains("absolute") &&
          // do not add when image is inside a link
          imageEl.parentElement?.nodeName !== "A"
        ) {
          imageEl.classList.add("r-stretch");
        }

        // If <img class="stretch"> is not a direct child of <section>, move it
        if (
          hasStretchClass(imageEl) &&
          imageEl.parentNode?.nodeName !== "SECTION"
        ) {
          // Remove element then maybe remove its parents if empty
          const removeEmpty = function (el: Element) {
            const parentEl = el.parentElement;
            parentEl?.removeChild(el);
            if (
              parentEl?.innerText.trim() === "" &&
              // Stop at section leveal and do not remove empty slides
              parentEl?.nodeName !== "SECTION"
            ) {
              removeEmpty(parentEl);
            }
          };

          // Figure environment ? Get caption and alignment
          const quartoFig = slideEl.querySelector("div.quarto-figure");
          const caption = doc.createElement("p");
          if (quartoFig) {
            // Get alignment
            const align = quartoFig.className.match(
              "quarto-figure-(center|left|right)",
            );
            if (align) imageEl.classList.add(align[0]);
            // Get Caption
            const figCaption = nodeEl.querySelector("figcaption");
            if (figCaption) {
              caption.classList.add("caption");
              caption.innerHTML = figCaption.innerHTML;
            }
          }

          // Target position of image
          // first level after the element
          const nextEl = nodeEl.nextElementSibling;
          // Remove image from its parent
          removeEmpty(imageEl);
          // insert at target position
          slideEl.insertBefore(image, nextEl);

          // If there was a caption processed add it after
          if (caption.classList.contains("caption")) {
            slideEl.insertBefore(
              caption,
              imageEl.nextElementSibling,
            );
          }
          // Remove container if still there
          if (quartoFig) removeEmpty(quartoFig);
        }
      }
    }
  }
}

function applyClassesToParentSlide(
  el: Element,
  classes: string[],
  slideClass = "slide",
) {
  const slideEl = findParentSlide(el, slideClass);
  if (slideEl) {
    classes.forEach((clz) => slideEl.classList.add(clz));
  }
}

function removeClassesFromParentSlide(
  el: Element,
  classes: string[],
  slideClass = "slide",
) {
  const slideEl = findParentSlide(el, slideClass);
  if (slideEl) {
    classes.forEach((clz) => slideEl.classList.remove(clz));
  }
}

function findParentSlide(el: Element, slideClass = "slide") {
  return findParent(el, (el: Element) => {
    return el.classList.contains(slideClass);
  });
}

registerWriterFormatHandler((format) => {
  switch (format) {
    case "revealjs":
      return {
        format: revealjsFormat(),
      };
  }
});
