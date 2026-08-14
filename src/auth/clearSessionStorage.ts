const PERSISTENT_UI_KEYS = new Set([
  "uniforma-theme-mode",
]);

const PERSISTENT_UI_PREFIXES = [
  "uniforma:dashboard-widgets:",
];

const shouldKeepUiPreference = (key: string) =>
  PERSISTENT_UI_KEYS.has(key)
  || PERSISTENT_UI_PREFIXES.some((prefix) => key.startsWith(prefix));

/**
 * Elimina cualquier dato de autenticacion o trabajo temporal, pero conserva
 * preferencias visuales que no contienen informacion sensible.
 */
export const clearSessionStorage = () => {
  const preferences = new Map<string, string>();

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !shouldKeepUiPreference(key)) continue;

    const value = window.localStorage.getItem(key);
    if (value !== null) preferences.set(key, value);
  }

  window.localStorage.clear();
  preferences.forEach((value, key) => window.localStorage.setItem(key, value));
  window.sessionStorage.clear();
};
