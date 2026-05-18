import { keyframes } from "@emotion/react";
import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import HomeOutlined from "@mui/icons-material/HomeOutlined";
import ManageSearchOutlined from "@mui/icons-material/ManageSearchOutlined";
import RouteOutlined from "@mui/icons-material/RouteOutlined";
import ShieldOutlined from "@mui/icons-material/ShieldOutlined";
import { useLocation, useNavigate } from "react-router-dom";

const floatPanel = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
`;

const scanLine = keyframes`
  0% { transform: translateY(-120%); opacity: 0; }
  18% { opacity: 1; }
  85% { opacity: 1; }
  100% { transform: translateY(360%); opacity: 0; }
`;

const pulseRing = keyframes`
  0% { transform: scale(0.92); opacity: 0.35; }
  70% { transform: scale(1.18); opacity: 0; }
  100% { transform: scale(1.18); opacity: 0; }
`;

export default function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = `${location.pathname}${location.search}`;

  return (
    <Box
      sx={{
        minHeight: { xs: "calc(100vh - 112px)", md: "calc(100vh - 136px)" },
        display: "grid",
        placeItems: "center",
        px: { xs: 1, md: 3 },
        py: { xs: 4, md: 7 },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "min(100%, 980px)",
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.paper",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "0.92fr 1.08fr" },
            minHeight: 440,
          }}
        >
          <Box
            sx={{
              position: "relative",
              overflow: "hidden",
              p: { xs: 4, md: 5 },
              bgcolor: "#101828",
              color: "common.white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: "34px 34px",
                maskImage: "linear-gradient(180deg, transparent, #000 18%, #000 82%, transparent)",
              }}
            />
            <Box
              sx={{
                position: "relative",
                width: { xs: 240, sm: 300 },
                aspectRatio: "1 / 1",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  width: "88%",
                  height: "88%",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "50%",
                  animation: `${pulseRing} 2.8s ease-out infinite`,
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  width: "68%",
                  height: "68%",
                  border: "1px dashed rgba(255,255,255,0.28)",
                  borderRadius: "50%",
                }}
              />
              <Box
                sx={{
                  position: "relative",
                  animation: `${floatPanel} 4s ease-in-out infinite`,
                  width: "78%",
                  minHeight: 174,
                  borderRadius: 2,
                  border: "1px solid rgba(255,255,255,0.24)",
                  bgcolor: "rgba(255,255,255,0.08)",
                  backdropFilter: "blur(10px)",
                  px: 3,
                  py: 2.5,
                  boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "26%",
                    height: 3,
                    bgcolor: "#38bdf8",
                    boxShadow: "0 0 24px #38bdf8",
                    animation: `${scanLine} 2.5s ease-in-out infinite`,
                  }}
                />
                <Stack spacing={1.5} alignItems="center">
                  <ManageSearchOutlined sx={{ fontSize: 52, color: "#7dd3fc" }} />
                  <Typography
                    variant="h2"
                    sx={{
                      fontWeight: 900,
                      letterSpacing: 0,
                      lineHeight: 0.95,
                      fontSize: { xs: 64, sm: 82 },
                    }}
                  >
                    404
                  </Typography>
                  <Chip
                    size="small"
                    label="Ruta no encontrada"
                    sx={{
                      color: "common.white",
                      bgcolor: "rgba(125,211,252,0.18)",
                      border: "1px solid rgba(125,211,252,0.35)",
                    }}
                  />
                </Stack>
              </Box>
            </Box>
          </Box>

          <Stack spacing={3} sx={{ p: { xs: 3, sm: 4, md: 5 }, justifyContent: "center" }}>
            <Stack spacing={1.25}>
              <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: 0.8 }}>
                Pagina no encontrada
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: 0, fontSize: { xs: 34, sm: 44 } }}>
                Esta ruta no existe o fue movida.
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560 }}>
                Revisa si la direccion esta escrita correctamente. Tambien puede pasar si el modulo cambio de ubicacion o tu rol ya no tiene acceso a esa opcion.
              </Typography>
            </Stack>

            <Paper
              variant="outlined"
              sx={{
                borderRadius: 1,
                p: 2,
                bgcolor: "action.hover",
              }}
            >
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <RouteOutlined color="primary" fontSize="small" />
                  <Typography variant="subtitle2">Ruta solicitada</Typography>
                </Stack>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: "monospace",
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    px: 1.5,
                    py: 1,
                    overflowWrap: "anywhere",
                  }}
                >
                  {path || "/"}
                </Typography>
              </Stack>
            </Paper>

            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <ShieldOutlined color="action" fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  Si llegaste desde el menu, actualiza los permisos del rol o entra de nuevo para refrescar el acceso.
                </Typography>
              </Stack>
              <Divider />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                <Button
                  variant="contained"
                  startIcon={<HomeOutlined />}
                  onClick={() => navigate("/")}
                >
                  Ir al inicio
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ArrowBackOutlined />}
                  onClick={() => navigate(-1)}
                >
                  Volver atras
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
