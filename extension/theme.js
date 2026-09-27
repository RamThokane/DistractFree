/**
 * DistractFree — extension theme.
 * Applies the theme chosen on the DistractFree website (synced into
 * chrome.storage.local by content.js). Until one is synced, the CSS
 * follows the OS light/dark preference.
 */
(function () {
  function apply(theme) {
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }
  try {
    chrome.storage.local.get('theme', function (data) { apply(data && data.theme); });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'local' && changes.theme) apply(changes.theme.newValue);
    });
  } catch (e) {
    /* not running inside the extension */
  }
})();
