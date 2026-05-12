import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import type { PaletteMode } from "@mui/material";
import { createAppTheme } from "./theme";

const STORAGE_KEY = "uniforma-theme-mode";

interface ThemeModeContextValue {
  mode: PaletteMode;
  isDarkMode: boolean;
  toggleMode: () => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);

const getInitialMode = (): PaletteMode => {
  if (typeof window === "undefined") return "light";
  const storedMode = window.localStorage.getItem(STORAGE_KEY);
  return storedMode === "dark" || storedMode === "light" ? storedMode : "light";
};

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PaletteMode>(getInitialMode);
  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const value = useMemo<ThemeModeContextValue>(
    () => ({
      mode,
      isDarkMode: mode === "dark",
      toggleMode: () => setMode((current) => (current === "dark" ? "light" : "dark")),
    }),
    [mode],
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode);
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error("useThemeMode debe usarse dentro de AppThemeProvider");
  }
  return context;
}
