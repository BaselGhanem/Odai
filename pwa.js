(() => {
  if (!(`serviceWorker` in navigator)) return;

  const updateConnectionState = () => {
    document.documentElement.dataset.connection = navigator.onLine
      ? `online`
      : `local`;
  };

  updateConnectionState();
  window.addEventListener(`online`, updateConnectionState);
  window.addEventListener(`offline`, updateConnectionState);
  window.addEventListener(`load`, () => {
    navigator.storage?.persist?.().catch(() => {});
    navigator.serviceWorker
      .register(`./sw.js`, { scope: `./`, updateViaCache: `none` })
      .catch(() => {});
  });
})();
