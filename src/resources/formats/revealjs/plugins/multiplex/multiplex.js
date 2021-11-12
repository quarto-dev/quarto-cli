(function() {

  // emulate async script load
  window.addEventListener( 'load', function() {
    var multiplex = Reveal.getConfig().multiplex;
    var socketId = multiplex.id;
    var socket = io.connect(multiplex.url);

    function post( evt ) {
      var messageData = {
        state: Reveal.getState(),
        secret: multiplex.secret,
        socketId: multiplex.id,
        content: (evt || {}).content
      };
      socket.emit( 'multiplex-statechanged', messageData );
    };

    // master
    if (multiplex.secret !== null) {

        // Don't emit events from inside of notes windows
        if ( window.location.search.match( /receiver/gi ) ) { return; }

        // post once the page is loaded, so the client follows also on "open URL".
        post();
      
        // Monitor events that trigger a change in state
        Reveal.on( 'slidechanged', post );
        Reveal.on( 'fragmentshown', post );
        Reveal.on( 'fragmenthidden', post );
        Reveal.on( 'overviewhidden', post );
        Reveal.on( 'overviewshown', post );
        Reveal.on( 'paused', post );
        Reveal.on( 'resumed', post );
        document.addEventListener( 'send', post ); // broadcast custom events sent by other plugins

    // client
    } else {
      socket.on(multiplex.id, function(message) {
        // ignore data from sockets that aren't ours
        if (message.socketId !== socketId) { return; }
        if( window.location.host === 'localhost:1947' ) return;
    
        if ( message.state ) {
          Reveal.setState(message.state);
        }
        if ( message.content ) {
          // forward custom events to other plugins
          var event = new CustomEvent('received');
          event.content = message.content;
          document.dispatchEvent( event );
        }
      });
    }
  });
}());