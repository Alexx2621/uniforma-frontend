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
import { useAuthStore } from "../auth/useAuthStore";
import { useNavigate } from "react-router-dom";
import uniformaLogo from "../assets/uniforma-logo.png";
import { api } from "../api/axios";

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
  const [alertAnchorEl, setAlertAnchorEl] = useState<null | HTMLElement>(null);
  const [alertas, setAlertas] = useState<AlertaInterna[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastUnreadCountRef = useRef<number | null>(null);

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
  }, [usuario]);

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
                      backgroundColor: alerta.leida ? "#ffffff" : "#eff6ff",
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
