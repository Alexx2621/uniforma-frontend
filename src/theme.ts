import { createTheme } from "@mui/material/styles";
import type { PaletteMode } from "@mui/material";
import type {} from "@mui/x-data-grid/themeAugmentation";
import { UniformaDataGridLoadingOverlay } from "./components/UniformaLoader";
import { APP_FONT_FAMILY } from "./utils/fontFamily";

export const createAppTheme = (mode: PaletteMode) =>
  createTheme({
    shape: {
      borderRadius: 12,
    },
    palette: {
      mode,
      primary: {
        main: mode === "dark" ? "#7aa7ff" : "#18366f",
        light: mode === "dark" ? "#9bbcff" : "#e8eef9",
        dark: mode === "dark" ? "#5686e7" : "#102852",
        contrastText: mode === "dark" ? "#07111f" : "#ffffff",
      },
      secondary: {
        main: mode === "dark" ? "#fb7185" : "#df1738",
        contrastText: mode === "dark" ? "#111827" : "#ffffff",
      },
      text: {
        primary: mode === "dark" ? "#f4f7fb" : "#17243a",
        secondary: mode === "dark" ? "#aebbd0" : "#64748b",
      },
      divider: mode === "dark" ? "rgba(148, 163, 184, 0.18)" : "#e6ebf2",
      background: {
        default: mode === "dark" ? "#0d1422" : "#f4f7fb",
        paper: mode === "dark" ? "#151f30" : "#ffffff",
      },
    },
    typography: {
      fontFamily: APP_FONT_FAMILY,
      h1: { fontWeight: 700, letterSpacing: "-0.025em" },
      h2: { fontWeight: 700, letterSpacing: "-0.02em" },
      h3: { fontWeight: 700, letterSpacing: "-0.018em" },
      h4: { fontWeight: 650, letterSpacing: "-0.012em" },
      h5: { fontWeight: 650, letterSpacing: "-0.008em" },
      h6: { fontWeight: 600 },
      button: { fontWeight: 700, textTransform: "none", letterSpacing: 0 },
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
            backgroundColor: mode === "dark" ? "#0d1422" : "#f4f7fb",
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            border: `1px solid ${mode === "dark" ? "rgba(148, 163, 184, 0.16)" : "#e6ebf2"}`,
            boxShadow: mode === "dark" ? "0 12px 32px rgba(0, 0, 0, 0.18)" : "0 10px 30px rgba(24, 54, 111, 0.06)",
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { minHeight: 40, borderRadius: 10, paddingInline: 16 },
          containedPrimary: { boxShadow: "0 8px 18px rgba(24, 54, 111, 0.18)" },
        },
      },
      MuiTextField: {
        defaultProps: { size: "small" },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 10, backgroundColor: mode === "dark" ? "rgba(255,255,255,0.025)" : "#ffffff" },
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 700, borderRadius: 8 } },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 18 } },
      },
      MuiTableHead: {
        styleOverrides: { root: { backgroundColor: mode === "dark" ? "#111a29" : "#f7f9fc" } },
      },
      MuiTableCell: {
        styleOverrides: {
          head: { color: mode === "dark" ? "#cbd5e1" : "#475569", fontWeight: 750 },
          root: { borderColor: mode === "dark" ? "rgba(148, 163, 184, 0.14)" : "#edf0f5" },
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
