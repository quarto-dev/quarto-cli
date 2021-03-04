window.document.addEventListener("DOMContentLoaded", function() {
  var navLinks = window.document.querySelectorAll("a.nav-link");
  for (let i=0; i<navLinks.length; i++) {
    const navLink = navLinks[i];
    if (navLink.href === window.location.href ||
        navLink.href === (window.location.href + "index.html")) {
      navLink.classList.add("active");
      navLink.setAttribute("aria-current", "page");
    }
  }
});

