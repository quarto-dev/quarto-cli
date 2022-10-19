<%= `window.Reveal${classname} = function () {
  return {
    id: "Reveal${classname}",
    init: function (deck) {
      // TODO: Implement your plugin functionality
      // Learn more at https://revealjs.com/creating-plugins/
      
      // This example shuffles the deck when the 'T' key is pressed
      deck.addKeyBinding({ keyCode: 84, key: "T" }, () => {
        deck.shuffle();
      });

    },
  };
};` %>
