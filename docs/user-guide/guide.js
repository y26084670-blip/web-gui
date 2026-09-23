/* Optional display controls; the text and anchor navigation do not depend on JS. */
(() => {
  const key = 'clark:user-guide:theme';
  const root = document.documentElement;
  const button = document.getElementById('theme-toggle');
  try {
    const saved = localStorage.getItem(key);
    if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  } catch { /* Storage can be unavailable on file:// or in private mode. */ }
  const isDark = () => root.dataset.theme
    ? root.dataset.theme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  const updateButton = () => {
    button.textContent = isDark() ? 'Светлая тема' : 'Тёмная тема';
    button.setAttribute('aria-label', isDark()
      ? 'Включить светлую тему руководства' : 'Включить тёмную тему руководства');
  };
  if (button) {
    button.hidden = false;
    updateButton();
    button.addEventListener('click', () => {
      root.dataset.theme = isDark() ? 'light' : 'dark';
      try { localStorage.setItem(key, root.dataset.theme); } catch { /* Nonessential. */ }
      updateButton();
    });
  }
})();
