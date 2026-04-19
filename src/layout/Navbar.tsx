// src/layout/Navbar.tsx
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Stack,
  Tooltip,
  Box,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import { useAuthStore } from "../auth/useAuthStore";
import { useNavigate } from "react-router-dom";
import uniformaLogo from "../assets/uniforma-logo.png";

export default function Navbar() {
  const { usuario, bodegaNombre, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  const initials = (usuario || "U").slice(0, 2).toUpperCase();

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        zIndex: 2000,
        background: "linear-gradient(90deg, #0f172a 0%, #1f2937 60%, #111827 100%)",
        color: "#f8fafc",
        borderBottom: "1px solid #1f2937",
      }}
    >
      <Toolbar sx={{ minHeight: 64, px: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box
            component="img"
            src={uniformaLogo}
            alt="Uniforma"
            sx={{
              height: 64,
              width: "auto",
              display: "block",
              maxWidth: { xs: 250, md: 360 },
              objectFit: "contain",
            }}
          />
        </Stack>

        <Stack direction="row" spacing={2} alignItems="center">
          <Box textAlign="right">
            <Typography variant="body1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {usuario || "Usuario"}
            </Typography>
            <Typography variant="body2" color="#cbd5e1">
              {bodegaNombre || "Sin bodega"}
            </Typography>
          </Box>

          <Avatar
            sx={{
              bgcolor: "#4f46e5",
              color: "#fff",
              width: 40,
              height: 40,
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {initials}
          </Avatar>

          <Tooltip title="Configuración">
            <IconButton color="inherit" onClick={() => navigate("/admin")}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Cerrar sesión">
            <IconButton color="inherit" onClick={handleLogout}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
