
window.document.addEventListener("DOMContentLoaded", function (event) {

  // get search element (bail if we don't have one)
  var searchEl = window.document.getElementById('quarto-search');
  if (!searchEl)
    return;

  // read a meta tag value
  function getMeta(metaName) {
    var metas = window.document.getElementsByTagName('meta');
    for (let i = 0; i < metas.length; i++) {
      if (metas[i].getAttribute('name') === metaName) {
        return metas[i].getAttribute('content');
      }
    }
    return '';
  }
  
  // get the offset from this page for a given site root relative url
  function offsetURL(url) {
    var offset = getMeta('quarto:offset');
    return offset ? offset + '/' + url : url;
  }
  
  // create the index
  function createFuseIndex() {
    // create fuse index
    var options = {
      keys: [
        { name: 'title', weight: 20 },
        { name: 'section', weight: 20 },
        { name: 'text', weight: 10 },
      ],
      ignoreLocation: true,
      includeMatches: true,
      includeScore: true,
      threshold: 0.1
    };
    var fuse = new window.Fuse([], options);
  
    // fetch the main search.json
    return fetch(offsetURL('search.json'))
      .then(function(response) {
        if (response.status == 200) {
          return response.json().then(function(articles) {
            articles.forEach(function(article) {
              fuse.add(article);
            });
            return fuse;
          });
  
        } else {
          return Promise.reject(
            new Error('Unexpected status from search index request: ' +
                        response.status)
          );
        }
      });
  }
    
  // create index then initialize autocomplete
  createFuseIndex()
    .then(function(fuse) {

      // initialize autocomplete
      var options = {
        autoselect: true,
        autoWidth: false,
        hint: false,
        // debug: true,
        minLength: 2,
        cssClasses: {
         
        },
        appendTo: "#quarto-search-results"
      };
      window.autocomplete(searchEl, options, [{
        source: function(query, callback) {
          const searchOptions = {
            isCaseSensitive: false,
            shouldSort: true,
            minMatchCharLength: 2,
            limit: 10,
          };
          callback(fuse.search(query, searchOptions));          
        },
        templates: {
          suggestion: function(result) {
            const item = result.item;
            const highlightResult = window.autocomplete.escapeHighlightedString(
              item.text.slice(0,100)
            );
            var html = `
              <div class="card">${item.section}</div>
            `;
            return html;
          }
        }
      }])
      .on('autocomplete:redrawn', function(event) {
        var input = this;
        var inputRect = input.getBoundingClientRect();
        var results = window.document.querySelector("#quarto-search-results .algolia-autocomplete");
        var width = results.clientWidth;
        if ((inputRect.left + width) > window.innerWidth) {  
          results.style.right = inputRect.right + "px";
          results.style.left = (inputRect.right - width) + "px";
        }
      })
      .on('autocomplete:selected', function(_event, suggestion) {
        window.location.href = offsetURL(suggestion.item.href);
      });
      // remove inline display style on autocompleter (we want to manage responsive display via css)
      const algolia = window.document.querySelector('.algolia-autocomplete');
      if (algolia) {
        algolia.style.removeProperty("display");
      }
    })
    .catch(function(error) {
      console.log(error);
    });

});
