// src/layout/Navbar.tsx
import { useEffect, useState } from "react";
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
import { api } from "../api/axios";

export default function Navbar() {
  const { usuario, nombre, primerNombre, primerApellido, segundoApellido, fotoUrl, bodegaNombre, logout } = useAuthStore();
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<{
    usuario?: string | null;
    nombre?: string | null;
    primerNombre?: string | null;
    primerApellido?: string | null;
    segundoApellido?: string | null;
    fotoUrl?: string | null;
    bodegaNombre?: string | null;
  } | null>(null);

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  useEffect(() => {
    let active = true;

    const cargarPerfil = async () => {
      try {
        const { data } = await api.get("/auth/me");
        if (active) {
          setPerfil(data);
        }
      } catch {
        try {
          const { data } = await api.get("/usuarios");
          const usuarios = Array.isArray(data) ? data : [];
          const encontrado = usuarios.find(
            (item: any) =>
              typeof item?.usuario === "string" &&
              typeof usuario === "string" &&
              item.usuario.trim().toUpperCase() === usuario.trim().toUpperCase()
          );
          if (active) {
            setPerfil(encontrado || null);
          }
        } catch {
          if (active) {
            setPerfil(null);
          }
        }
      }
    };

    void cargarPerfil();

    return () => {
      active = false;
    };
  }, [usuario]);

  const sourceNombre = perfil?.nombre ?? nombre;
  const sourcePrimerNombre = perfil?.primerNombre ?? primerNombre;
  const sourcePrimerApellido = perfil?.primerApellido ?? primerApellido;
  const sourceSegundoApellido = perfil?.segundoApellido ?? segundoApellido;
  const sourceFotoUrl = perfil?.fotoUrl ?? fotoUrl;
  const sourceBodegaNombre = perfil?.bodegaNombre ?? bodegaNombre;

  const normalizedPrimerNombre = (sourcePrimerNombre || "").trim();
  const normalizedPrimerApellido = (sourcePrimerApellido || "").trim();
  const normalizedSegundoApellido = (sourceSegundoApellido || "").trim();
  const nombreParts = (sourceNombre || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const fallbackPrimerNombre = nombreParts[0] || "";
  const fallbackPrimerApellido = nombreParts[2] || nombreParts[1] || "";

  const displayName =
    [normalizedPrimerNombre || fallbackPrimerNombre, normalizedPrimerApellido || fallbackPrimerApellido]
      .filter(Boolean)
      .join(" ") || "Usuario";

  const initials = `${
    (normalizedPrimerNombre || fallbackPrimerNombre || "U").charAt(0)
  }${
    (normalizedPrimerApellido || fallbackPrimerApellido || normalizedSegundoApellido).charAt(0)
  }`
    .trim()
    .toUpperCase() || "U";
  const profileImageUrl = sourceFotoUrl
    ? sourceFotoUrl.startsWith("http://") || sourceFotoUrl.startsWith("https://")
      ? sourceFotoUrl
      : `${api.defaults.baseURL || ""}${sourceFotoUrl}`
    : "";

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        zIndex: 2000,
        background: "#ffffff",
        color: "#1f2937",
        borderBottom: "1px solid #e5e7eb",
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
              {displayName}
            </Typography>
            <Typography variant="body2" color="#6b7280">
              {sourceBodegaNombre || "Sin bodega"}
            </Typography>
          </Box>

          <Avatar
            src={profileImageUrl}
            sx={{
              bgcolor: "#1B2852",
              color: "#fff",
              width: 40,
              height: 40,
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {!profileImageUrl ? initials : null}
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
