import { createTheme } from "@mui/material/styles";
import type { PaletteMode } from "@mui/material";
import type {} from "@mui/x-data-grid/themeAugmentation";
import { UniformaDataGridLoadingOverlay } from "./components/UniformaLoader";
import { APP_FONT_FAMILY } from "./utils/fontFamily";

export const createAppTheme = (mode: PaletteMode) =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: mode === "dark" ? "#60a5fa" : "#1B2852",
        contrastText: mode === "dark" ? "#07111f" : "#ffffff",
      },
      secondary: {
        main: mode === "dark" ? "#f87171" : "#d90000",
        contrastText: mode === "dark" ? "#111827" : "#ffffff",
      },
      background: {
        default: mode === "dark" ? "#111827" : "#f7f9fc",
        paper: mode === "dark" ? "#1f2937" : "#ffffff",
      },
    },
    typography: {
      fontFamily: APP_FONT_FAMILY,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          "html, body, #root": {
            fontFamily: APP_FONT_FAMILY,
            minHeight: "100%",
          },
          body: {
            fontFamily: APP_FONT_FAMILY,
            backgroundColor: mode === "dark" ? "#111827" : "#f7f9fc",
          },
        },
      },
      MuiDataGrid: {
        defaultProps: {
          slots: {
            loadingOverlay: UniformaDataGridLoadingOverlay,
          },
        },
        styleOverrides: {
          root: {
            borderColor: mode === "dark" ? "#4b5563" : "#e5e7eb",
            color: mode === "dark" ? "#f9fafb" : "#111827",
          },
          columnHeaders: {
            backgroundColor: mode === "dark" ? "#0f172a" : undefined,
            color: mode === "dark" ? "#f9fafb" : undefined,
            borderColor: mode === "dark" ? "#4b5563" : undefined,
          },
          columnHeader: {
            backgroundColor: mode === "dark" ? "#0f172a" : undefined,
          },
          cell: {
            borderColor: mode === "dark" ? "#374151" : undefined,
          },
          footerContainer: {
            borderColor: mode === "dark" ? "#4b5563" : undefined,
            color: mode === "dark" ? "#f9fafb" : undefined,
          },
        },
      },
    },
  });

export const appTheme = createAppTheme("light");
