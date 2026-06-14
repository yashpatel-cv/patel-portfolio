/**
 * Theme toggle — light is the default; dark is opt-in and persisted.
 * The no-flash inline script in Base.astro sets the initial attribute
 * before paint; this module wires the toggle buttons and keeps the
 * theme-color meta in sync.
 */
const STORAGE_KEY = 'theme';
const root = document.documentElement;

const META_COLOR: Record<'light' | 'dark', string> = {
  light: '#f7f9fc',
  dark: '#0a0e14',
};

function currentTheme(): 'light' | 'dark' {
  return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function apply(theme: 'light' | 'dark'): void {
  if (theme === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', META_COLOR[theme]);

  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(theme === 'dark'));
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  });
}

apply(currentTheme());

document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable — toggle still works for the session */
    }
    apply(next);
  });
});
