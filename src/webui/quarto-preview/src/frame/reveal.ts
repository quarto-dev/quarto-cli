/*
 * reveal.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */


export function handleRevealMessages(disconnectServer: VoidFunction) {

  function onMessage<T = unknown>(message: string, fn: ((data: T) => void)) {
    window.addEventListener("message", function (event) {
      if (event.data.message === message) {
        fn(event.data.data);
      }
    });
  }

  function postMessage(message: string, data: unknown) {
    if (window.parent.postMessage) {
      window.parent.postMessage({
        type: message, 
        message: message, 
        data: data
      }, "*");
    }
  }


  interface SlideInfo extends SlideIndex {
    id: string;
    title: string;
  }

  function slideInfo(slide: Element) : SlideInfo {
    const titles = slide.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const indices = Reveal.getIndices(slide);
    return {
      id: slide.id || "",
      title: titles.item(0) ? titles.item(0).textContent || "" : "",
      h: indices.h,
      v: indices.v,
      f: indices.f
    };
  }

  function postInit(slides: SlideInfo[]) {
    postMessage("reveal-init", {
      slides: slides
    })
  }

  function postSlideChanged() {
    postMessage("reveal-slidechange", {
      first: Reveal.isFirstSlide(),
      last: Reveal.isLastSlide(),
      slide: slideInfo(Reveal.getCurrentSlide())
    })
  }

  function postHashChange() {
    postMessage("reveal-hashchange", {
      href: window.location.href
    });
  }

  // initialization
  const revealInit = () => {
   
    // set some defaults to facilitate tooling
    Reveal.configure({
      history: true
    });

    // collect up slides ids and titles and call init with them
    const slides = Reveal.getSlides().map(slideInfo);
    postInit(slides);

    // once we are signaled back that the caller is ready,
    // send the initial slideChanged and hashChange events
    onMessage("reveal-ready", function(){
      // fire slidechanged for initial load
      postSlideChanged();

      // fire hashchnge for initial load (and listen for subsequent changes)
      postHashChange();
      window.addEventListener('hashchange', postHashChange);
    });
    
    // trigger automatic print (using same test/logic as reveal)
    if ((/print-pdf/gi).test(window.location.search)) {

      // close the dev server reload socket
      disconnectServer();

      // print after a delay (allow layout to occur)
      setTimeout(function () {
        window.print();
      }, 1000);
    }
  };
  if (Reveal.isReady()) {
    revealInit();
  } else {
    Reveal.on('ready', revealInit);
  }

  // forward slidechanged
  Reveal.on('slidechanged', postSlideChanged);

  // handle next/previous/navigate/reload
  onMessage("reveal-next", function () { Reveal.next(); });
  onMessage("reveal-prev", function () { Reveal.prev(); });
  onMessage<SlideIndex>("reveal-slide", (data: SlideIndex) => { Reveal.slide(data.h, data.v, data.f); });
  onMessage("reveal-refresh", function () { window.location.reload(); });
  onMessage("reveal-home", function () { Reveal.slide(0, 0, 0); });
  onMessage("reveal-fullscreen", function () { Reveal.triggerKey(70); });
}

// types for Reveal

declare const Reveal: RevealStatic;

interface RevealStatic {
  isReady(): boolean;
  configure(options: { history: boolean }): void;
  slide(indexh: number, indexv?: number, f?: number, o?: number): void;
  prev(): void;
  next(): void;
  getCurrentSlide(): Element;
  getIndices(slide?: Element): SlideIndex;
  isFirstSlide(): boolean;
  isLastSlide(): boolean;
  getSlides(): Element[];
  on(message: string, fn: VoidFunction): void;
  triggerKey(key: number): void;
}

interface SlideIndex {
  h: number;
  v: number,
  f?: number, 
}
