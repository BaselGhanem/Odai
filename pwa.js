(() => {
  const DISMISS_KEY = `odai-install-prompt-dismissed-v2`;
  const INSTALLED_KEY = `odai-app-installed-v1`;
  const DISMISS_DAYS = 7;
  let deferredInstallPrompt = null;
  let promptMode = `native`;
  let fallbackTimer = null;

  const installPanel = document.querySelector(`#pwa-install-prompt`);
  const installButton = document.querySelector(`#pwa-install-confirm`);
  const installDescription = document.querySelector(`#pwa-install-description`);
  const installSteps = document.querySelector(`#pwa-install-steps`);

  const isStandalone = () =>
    window.matchMedia(`(display-mode: standalone)`).matches ||
    window.navigator.standalone === true;
  const isMobile = () =>
    window.matchMedia(`(max-width: 780px)`).matches ||
    navigator.userAgentData?.mobile === true ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const isIOS = () =>
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === `MacIntel` && navigator.maxTouchPoints > 1);
  const likelySupportsNativePrompt = () =>
    /Android/i.test(navigator.userAgent) &&
    /(Chrome|Chromium|EdgA|SamsungBrowser|OPR)/i.test(navigator.userAgent);

  function recentlyDismissed() {
    try {
      if (localStorage.getItem(INSTALLED_KEY)) return true;
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      return Date.now() - dismissedAt < DISMISS_DAYS * 86400000;
    } catch {
      return false;
    }
  }

  function rememberDismissal() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  }

  function rememberInstallation() {
    try {
      localStorage.setItem(INSTALLED_KEY, `1`);
      localStorage.removeItem(DISMISS_KEY);
    } catch {}
  }

  function setSteps(items) {
    if (!installSteps) return;
    installSteps.innerHTML = items
      .map(
        (item, index) =>
          `<li><span>${index + 1}</span><strong>${item}</strong></li>`,
      )
      .join(``);
    installSteps.classList.toggle(`hidden`, items.length === 0);
  }

  function configurePrompt(mode) {
    promptMode = mode;
    if (!installButton || !installDescription) return;
    if (mode === `native`) {
      installDescription.textContent = `افتح النظام مباشرة من شاشة هاتفك كأي تطبيق، مع جاهزية أسرع في كل مرة.`;
      installButton.textContent = `نعم، تثبيت التطبيق`;
      setSteps([]);
      return;
    }
    if (mode === `ios`) {
      installDescription.textContent = `على iPhone تتم الإضافة من قائمة المشاركة في Safari:`;
      installButton.textContent = `حسنًا، سأضيفه الآن`;
      setSteps([
        `اضغط زر المشاركة في Safari`,
        `اختر «إضافة إلى الشاشة الرئيسية»`,
        `اضغط «إضافة» للتأكيد`,
      ]);
      return;
    }
    installDescription.textContent = `يمكنك تثبيت النظام من قائمة المتصفح بخطوتين:`;
    installButton.textContent = `حسنًا، افتح قائمة المتصفح`;
    setSteps([
      `افتح قائمة المتصفح ⋮`,
      `اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»`,
    ]);
  }

  function showInstallPrompt(mode) {
    if (!installPanel || !isMobile() || isStandalone() || recentlyDismissed())
      return;
    configurePrompt(mode);
    installPanel.classList.remove(`hidden`);
    document.documentElement.classList.add(`install-prompt-open`);
    document.body.classList.add(`install-prompt-open`);
    requestAnimationFrame(() => installButton?.focus());
  }

  function hideInstallPrompt({ remember = true } = {}) {
    if (!installPanel) return;
    installPanel.classList.add(`hidden`);
    document.documentElement.classList.remove(`install-prompt-open`);
    document.body.classList.remove(`install-prompt-open`);
    if (remember) rememberDismissal();
  }

  window.addEventListener(`beforeinstallprompt`, (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (fallbackTimer) clearTimeout(fallbackTimer);
    window.setTimeout(() => showInstallPrompt(`native`), 550);
  });

  window.addEventListener(`appinstalled`, () => {
    rememberInstallation();
    deferredInstallPrompt = null;
    hideInstallPrompt({ remember: false });
  });

  installButton?.addEventListener(`click`, async () => {
    if (promptMode !== `native` || !deferredInstallPrompt) {
      hideInstallPrompt();
      return;
    }
    installButton.disabled = true;
    installButton.textContent = `جاري فتح التثبيت…`;
    try {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === `accepted`) rememberInstallation();
      else rememberDismissal();
    } finally {
      deferredInstallPrompt = null;
      installButton.disabled = false;
      hideInstallPrompt({ remember: false });
    }
  });

  document
    .querySelectorAll(`[data-install-dismiss]`)
    .forEach((button) =>
      button.addEventListener(`click`, () => hideInstallPrompt()),
    );
  document.addEventListener(`keydown`, (event) => {
    if (event.key === `Escape` && !installPanel?.classList.contains(`hidden`))
      hideInstallPrompt();
  });

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
    if (`serviceWorker` in navigator)
      navigator.serviceWorker
        .register(`./sw.js`, { scope: `./`, updateViaCache: `none` })
        .catch(() => {});

    if (!installPanel || !isMobile() || isStandalone() || recentlyDismissed())
      return;
    if (isIOS()) {
      fallbackTimer = window.setTimeout(() => showInstallPrompt(`ios`), 1000);
    } else {
      fallbackTimer = window.setTimeout(
        () => showInstallPrompt(deferredInstallPrompt ? `native` : `browser`),
        likelySupportsNativePrompt() ? 7500 : 3200,
      );
    }
  });
})();
