window.QuartoTone = function () {
  return {
    id: "quarto-tone",
    init: function (deck) {
      function slideToneScale(i) {
        // https://www.intmath.com/trigonometric-graphs/music.php
        const note = 15 - (deck.getTotalSlides() - i);
        return 440 * 2 ** (note / 12);
      }

      /*
       * Sliding tones between C3 and C5 with equal steps between tones
       * but not aligned to musical scale
       */
      function slideToneBounded(i, lower = 261.63, upper = 1046.5) {
        const step = (upper - lower) / deck.getTotalSlides();
        return lower + step * i;
      }

      /*
       * Choose slide tone scale automatically based on number of slides.
       * If there are <= 32 slides, use musical scale.
       */
      function slideToneAuto(toneIdx) {
        return deck.getTotalSlides() > 32
          ? slideToneBounded(toneIdx)
          : slideToneScale(toneIdx);
      }

      const synth = new Tone.Synth({
        oscillator: {
          type: "sine",
        },
        envelope: {
          attack: 0.001,
          decay: 0.2,
          sustain: 0.2,
          release: 1,
        },
      }).toMaster();

      const playTone = () => {
        synth.triggerAttackRelease(
          slideToneAuto(deck.getSlidePastCount()),
          "8n"
        );
      };
      deck.on("slidechanged", playTone);
      deck.on("fragmentshown", playTone);
      deck.on("fragmenthidden", playTone);
    },
  };
};
