// src/layout/Navbar.tsx
import { useEffect, useRef, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Stack,
  Tooltip,
  Box,
  Badge,
  Menu,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  Button,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import WbSunnyRoundedIcon from "@mui/icons-material/WbSunnyRounded";
import { io, Socket } from "socket.io-client";
import Swal from "sweetalert2";
import { useAuthStore } from "../auth/useAuthStore";
import { useNavigate } from "react-router-dom";
import uniformaLogo from "../assets/uniforma-logo.png";
import uniformaLogoBlanco from "../assets/uniforma-logo-blanco-new.png";
import { api } from "../api/axios";
import { useThemeMode } from "../themeMode";

interface AlertaInterna {
  id: number;
  titulo: string;
  mensaje: string;
  leida: boolean;
  creadaEn: string;
  payload?: {
    pedidoId?: number;
  } | null;
}

export default function Navbar() {
  const { isDarkMode, toggleMode } = useThemeMode();
  const {
    usuario,
    nombre,
    primerNombre,
    primerApellido,
    segundoApellido,
    fotoUrl,
    bodegaNombre,
    logout,
    syncSession,
  } = useAuthStore();
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
  const [alertAnchorEl, setAlertAnchorEl] = useState<null | HTMLElement>(null);
  const [alertas, setAlertas] = useState<AlertaInterna[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastUnreadCountRef = useRef<number | null>(null);
  const alertasSocketRef = useRef<Socket | null>(null);

  const reproducirTonoNotificacion = async () => {
    if (typeof window === "undefined") return;

    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      const context = audioContextRef.current ?? new AudioContextClass();
      audioContextRef.current = context;

      if (context.state === "suspended") {
        await context.resume();
      }

      const now = context.currentTime;
      const masterGain = context.createGain();
      masterGain.gain.setValueAtTime(0.14, now);
      masterGain.connect(context.destination);

      const reproducirNota = (
        startAt: number,
        frequency: number,
        duration: number,
        type: OscillatorType,
        peakGain: number,
      ) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, startAt);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.985, startAt + duration);

        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

        oscillator.connect(gain);
        gain.connect(masterGain);

        oscillator.start(startAt);
        oscillator.stop(startAt + duration);
      };

      reproducirNota(now, 784, 0.18, "sine", 0.9);
      reproducirNota(now + 0.11, 1046, 0.26, "sine", 0.85);
      reproducirNota(now + 0.11, 1568, 0.18, "triangle", 0.18);
    } catch {
      // Algunos navegadores bloquean audio sin interacción previa.
    }
  };

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
          syncSession(data);
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
              item.usuario.trim().toUpperCase() === usuario.trim().toUpperCase(),
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
  }, [usuario, syncSession]);

  const cargarAlertas = async () => {
    try {
      const { data } = await api.get("/alertas");
      setAlertas(Array.isArray(data) ? data : []);
    } catch {
      setAlertas([]);
    }
  };

  useEffect(() => {
    void cargarAlertas();

    const intervalId = window.setInterval(() => {
      void cargarAlertas();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const socket = io(api.defaults.baseURL || window.location.origin, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    alertasSocketRef.current = socket;

    const refrescarAlertas = () => {
      void cargarAlertas();
    };
    const manejarActualizacionSistema = (payload: { titulo?: string; mensaje?: string }) => {
      void Swal.fire({
        title: payload?.titulo || "Actualizacion del sistema",
        text: payload?.mensaje || "Se aplico una actualizacion. Inicia sesion nuevamente.",
        icon: "info",
        confirmButtonText: "Entendido",
        allowOutsideClick: false,
        allowEscapeKey: false,
      }).then(() => {
        logout();
        window.location.href = "/login";
      });
    };

    socket.on("connect", refrescarAlertas);
    socket.on("alertas:actualizadas", refrescarAlertas);
    socket.on("sistema:actualizacion", manejarActualizacionSistema);

    return () => {
      socket.off("connect", refrescarAlertas);
      socket.off("alertas:actualizadas", refrescarAlertas);
      socket.off("sistema:actualizacion", manejarActualizacionSistema);
      socket.disconnect();
      alertasSocketRef.current = null;
    };
  }, [logout]);

  useEffect(() => {
    const unreadCount = alertas.filter((alerta) => !alerta.leida).length;

    if (lastUnreadCountRef.current === null) {
      lastUnreadCountRef.current = unreadCount;
      return;
    }

    if (unreadCount > lastUnreadCountRef.current) {
      void reproducirTonoNotificacion();
    }

    lastUnreadCountRef.current = unreadCount;
  }, [alertas]);

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
    ? sourceFotoUrl.startsWith("http://") || sourceFotoUrl.startsWith("https://") || sourceFotoUrl.startsWith("data:")
      ? sourceFotoUrl
      : `${api.defaults.baseURL || ""}${sourceFotoUrl}`
    : "";
  const alertasNoLeidas = alertas.filter((alerta) => !alerta.leida).length;

  const abrirAlertas = (event: React.MouseEvent<HTMLElement>) => {
    setAlertAnchorEl(event.currentTarget);
  };

  const cerrarAlertas = () => {
    setAlertAnchorEl(null);
  };

  const marcarLeida = async (alertaId: number) => {
    try {
      await api.post(`/alertas/${alertaId}/leida`);
      setAlertas((prev) =>
        prev.map((alerta) =>
          alerta.id === alertaId
            ? {
                ...alerta,
                leida: true,
              }
            : alerta,
        ),
      );
    } catch {
      // No bloquear la UI por un error de marcado.
    }
  };

  const marcarTodasLeidas = async () => {
    try {
      await api.post("/alertas/marcar-todas-leidas");
      setAlertas((prev) => prev.map((alerta) => ({ ...alerta, leida: true })));
    } catch {
      // No bloquear la UI por un error de marcado.
    }
  };

  const abrirDetalleAlerta = async (alerta: AlertaInterna) => {
    await marcarLeida(alerta.id);
    cerrarAlertas();

    const pedidoId = Number(alerta.payload?.pedidoId);
    if (Number.isFinite(pedidoId) && pedidoId > 0) {
      navigate(`/produccion/${pedidoId}`);
    }
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        zIndex: 2000,
        background: isDarkMode ? "#111827" : "#ffffff",
        color: isDarkMode ? "#f9fafb" : "#1f2937",
        borderBottom: "1px solid",
        borderColor: isDarkMode ? "#374151" : "#e5e7eb",
      }}
    >
      <Toolbar sx={{ minHeight: 64, px: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box
            component="img"
            src={isDarkMode ? uniformaLogoBlanco : uniformaLogo}
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

        <Stack direction="row" spacing={{ xs: 1, sm: 2 }} alignItems="center">
          <Tooltip title={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
            <Box
              component="button"
              type="button"
              aria-label={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              aria-pressed={isDarkMode}
              onClick={toggleMode}
              sx={{
                width: 76,
                height: 38,
                border: "1px solid",
                borderColor: isDarkMode ? "#ffffff" : "#d6d6d6",
                borderRadius: 999,
                p: "4px",
                cursor: "pointer",
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "flex-start",
                backgroundColor: isDarkMode ? "#ffffff" : "#d9d9d9",
                boxShadow: isDarkMode ? "0 1px 2px rgba(0, 0, 0, 0.18)" : "inset 0 0 0 1px #d6d6d6",
                transition: "background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
                flexShrink: 0,
                "&:focus-visible": {
                  outline: "3px solid",
                  outlineColor: "primary.main",
                  outlineOffset: 2,
                },
              }}
            >
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  backgroundColor: isDarkMode ? "#2d2d30" : "#ffffff",
                  color: isDarkMode ? "#ffffff" : "#f7d64a",
                  transform: isDarkMode ? "translateX(36px)" : "translateX(0)",
                  transition: "transform 180ms ease, background-color 180ms ease, color 180ms ease",
                  position: "relative",
                  zIndex: 1,
                  boxShadow: isDarkMode ? "none" : "0 1px 4px rgba(15, 23, 42, 0.14)",
                }}
              >
                {isDarkMode ? <DarkModeRoundedIcon fontSize="small" /> : <WbSunnyRoundedIcon fontSize="small" />}
              </Box>
            </Box>
          </Tooltip>

          <Box textAlign="right">
            <Typography variant="body1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {displayName}
            </Typography>
            <Typography variant="body2" sx={{ color: isDarkMode ? "#d1d5db" : "#6b7280" }}>
              {sourceBodegaNombre || "Sin bodega"}
            </Typography>
          </Box>

          <Avatar
            src={profileImageUrl}
            sx={{
              bgcolor: isDarkMode ? "#334155" : "#1B2852",
              color: "#fff",
              width: 40,
              height: 40,
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {!profileImageUrl ? initials : null}
          </Avatar>

          <Tooltip title="Alertas">
            <IconButton color="inherit" onClick={abrirAlertas}>
              <Badge badgeContent={alertasNoLeidas} color="error">
                <NotificationsOutlinedIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={alertAnchorEl}
            open={Boolean(alertAnchorEl)}
            onClose={cerrarAlertas}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            PaperProps={{ sx: { width: 360, maxWidth: "calc(100vw - 32px)" } }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Alertas
                </Typography>
                <Button size="small" onClick={() => void marcarTodasLeidas()} disabled={!alertasNoLeidas}>
                  Marcar todas
                </Button>
              </Stack>
            </Box>
            <Divider />
            <List sx={{ py: 0, maxHeight: 420, overflowY: "auto" }}>
              {alertas.length ? (
                alertas.map((alerta) => (
                  <ListItemButton
                    key={alerta.id}
                    onClick={() => void abrirDetalleAlerta(alerta)}
                    sx={{
                      alignItems: "flex-start",
                      backgroundColor: alerta.leida ? "background.paper" : "action.selected",
                    }}
                  >
                    <ListItemText
                      primary={alerta.titulo}
                      secondary={
                        <>
                          <Typography
                            component="span"
                            variant="body2"
                            color="text.primary"
                            sx={{ display: "block", mb: 0.5 }}
                          >
                            {alerta.mensaje}
                          </Typography>
                          <Typography component="span" variant="caption" color="text.secondary">
                            {new Date(alerta.creadaEn).toLocaleString("es-GT")}
                          </Typography>
                        </>
                      }
                      primaryTypographyProps={{ fontWeight: alerta.leida ? 500 : 700 }}
                    />
                  </ListItemButton>
                ))
              ) : (
                <Box sx={{ px: 2, py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    No hay alertas pendientes.
                  </Typography>
                </Box>
              )}
            </List>
          </Menu>

          <Tooltip title="Configuracion">
            <IconButton color="inherit" onClick={() => navigate("/admin")}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Cerrar sesion">
            <IconButton color="inherit" onClick={handleLogout}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
