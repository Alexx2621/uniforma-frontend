import { Box, keyframes } from "@mui/material";
import UBase from "../assets/u-loader-base.png";
import UBlue from "../assets/u-loader-blue.png";
import URed from "../assets/u-loader-red.png";

const revealRed = keyframes`
  0% {
    clip-path: inset(0 0 100% 0);
  }

  30%, 86% {
    clip-path: inset(0 0 0 0);
  }

  100% {
    clip-path: inset(0 0 100% 0);
  }
`;

const revealBlue = keyframes`
  0%, 18% {
    clip-path: inset(0 0 100% 0);
  }

  42%, 86% {
    clip-path: inset(0 0 0 0);
  }

  100% {
    clip-path: inset(0 0 100% 0);
  }
`;

export function UniformaLoader({ size = 82 }: { size?: number }) {
  return (
    <Box
      aria-label="Cargando"
      role="status"
      sx={{
        width: size,
        aspectRatio: "597 / 737",
        position: "relative",
        display: "inline-block",
        lineHeight: 0,
      }}
    >
      <Box
        component="img"
        src={UBase}
        alt=""
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          opacity: 0.35,
          userSelect: "none",
          pointerEvents: "none",
        }}
      />
      <Box
        component="img"
        src={URed}
        alt=""
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          opacity: 1,
          userSelect: "none",
          pointerEvents: "none",
          animation: `${revealRed} 2.1s ease-in-out infinite`,
        }}
      />
      <Box
        component="img"
        src={UBlue}
        alt=""
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          opacity: 1,
          userSelect: "none",
          pointerEvents: "none",
          animation: `${revealBlue} 2.1s ease-in-out infinite`,
        }}
      />
    </Box>
  );
}

export function UniformaDataGridLoadingOverlay() {
  return (
    <Box
      sx={{
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "rgba(255,255,255,0.72)",
      }}
    >
      <UniformaLoader />
    </Box>
  );
}
