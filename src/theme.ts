import { createTheme } from "@mui/material/styles";
import { APP_FONT_FAMILY } from "./utils/fontFamily";

export const appTheme = createTheme({
  typography: {
    fontFamily: APP_FONT_FAMILY,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "html, body, #root": {
          fontFamily: APP_FONT_FAMILY,
        },
        body: {
          fontFamily: APP_FONT_FAMILY,
        },
      },
    },
  },
});
