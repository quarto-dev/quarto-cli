function initialize() {

   const LOCAL_STORAGE_KEY = "luacov_report_visible_ids";

   let visibleIDs;

   if (localStorage) {
      visibleIDs = localStorage.getItem(LOCAL_STORAGE_KEY);
   }
   if (!visibleIDs) {
      visibleIDs = []
   } else {
      visibleIDs = JSON.parse(visibleIDs);
   }

   function save() {
      if (localStorage) {
         localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(visibleIDs));
      }
   }

   function show(id) {
      let classList = document.getElementById(id).classList;
      if (classList.contains('hidden')) {
         classList.remove("hidden");
         if (visibleIDs.indexOf(id) < 0) {
            visibleIDs.push(id);
            save();
         }
      }
   }

   function hide(id) {
      let classList = document.getElementById(id).classList;
      if (!classList.contains('hidden')) {
         classList.add("hidden");
         if (visibleIDs.indexOf(id) >= 0) {
            visibleIDs.splice(visibleIDs.indexOf(id), 1);
            save();
         }
      }
   }

   const fileHeaders = Array.prototype.slice.call(document.getElementsByTagName("h2"));
   fileHeaders.forEach(function (h2) {
      let div = h2.parentElement;
      let id = div.getAttribute("id");
      h2.onclick = function () {
         if (div.classList.contains('hidden')) {
            show(id)
         } else {
            hide(id)
         }
      }
   });

   let changed;
   visibleIDs.forEach((id) => {
      if (!document.getElementById(id)) {
         changed = true;
         visibleIDs.splice(visibleIDs.indexOf(id), 1);
      } else {
         show(id);
      }
   });
   if (changed) {
      save();
   }

   prettyPrint()
}
