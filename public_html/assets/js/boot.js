/* Runs synchronously in <head>: enables motion styles before first paint.
   If main.js fails to load, the safety timer restores fully visible content. */
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  setTimeout(function () {
    if (!window.__dngReady) root.classList.remove('js');
  }, 2500);
})();
