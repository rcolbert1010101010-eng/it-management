export type Theme = "light" | "dark";

const THEME_KEY = "theme";

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function getSystemTheme(): Theme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getInitialTheme(): Theme {
  return getStoredTheme() ?? getSystemTheme();
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;

  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function setTheme(theme: Theme): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore storage failures and still apply theme.
    }
  }

  applyTheme(theme);
}
