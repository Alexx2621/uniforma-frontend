// src/layout/Navbar.tsx
import { useCallback, useEffect, useRef, useState } from "react";
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
  Tabs,
  Tab,
  CircularProgress,
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
import { ActivityLog, getActivityLogActionLabel } from "../utils/activityLog";

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

type ServerState = "checking" | "online" | "degraded" | "offline" | "unknown";

interface ServerStatus {
  status: ServerState;
  checkedAt?: string;
  api?: {
    ok?: boolean;
    state?: ServerState;
    uptimeSeconds?: number;
    environment?: string;
  };
  database?: {
    ok?: boolean;
    state?: ServerState;
    latencyMs?: number;
    message?: string;
  };
  railway?: {
    ok?: boolean;
    reachable?: boolean;
    state?: ServerState;
    severity?: string;
    label?: string;
    latencyMs?: number;
    statusPageUrl?: string;
    message?: string;
  };
  message?: string;
}

interface ServerDetails {
  checkedAt?: string;
  api?: {
    uptimeSeconds?: number;
    environment?: string;
    memory?: { rss?: number; heapUsed?: number; heapTotal?: number };
  };
  mysql?: {
    status?: Record<string, string>;
    variables?: Record<string, string>;
    databaseBytes?: number;
    processlist?: Array<{
      id: number;
      user?: string;
      host?: string;
      database?: string;
      command?: string;
      timeSeconds?: number;
      state?: string;
      info?: string;
    }>;
    migrations?: Array<{ name?: string; finishedAt?: string }>;
  };
}

const initialServerStatus: ServerStatus = {
  status: "checking",
  message: "Revisando estado del servidor",
};

const getServerStatusLabel = (status: ServerStatus) => {
  if (status.status === "checking") return "Revisando";
  if (status.status === "online") return "Servidor activo";
  if (status.status === "degraded") return "Servidor inestable";
  if (status.status === "offline") return "Servidor caido";
  return "Estado desconocido";
};

const getServerStatusColor = (status: ServerStatus) => {
  if (status.status === "online") return "#16a34a";
  if (status.status === "degraded") return "#f59e0b";
  if (status.status === "offline") return "#dc2626";
  return "#9ca3af";
};

const formatUptime = (seconds?: number) => {
  if (!seconds || seconds < 0) return "N/D";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const formatBytes = (bytes?: number) => {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "N/D";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toLocaleString("es-GT", { maximumFractionDigits: unitIndex === 0 ? 0 : 2 })} ${units[unitIndex]}`;
};

const metricValue = (value?: string) => (value == null || value === "" ? "N/D" : value);

const readMetric = (values: Record<string, string> | undefined, key: string) =>
  values?.[key] ?? values?.[key.toLowerCase()] ?? values?.[key.toUpperCase()];

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
    rol,
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
  const [alertPanelTab, setAlertPanelTab] = useState<"alertas" | "log">("alertas");
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus>(initialServerStatus);
  const [serverDetails, setServerDetails] = useState<ServerDetails | null>(null);
  const [serverDetailsLoading, setServerDetailsLoading] = useState(false);
  const [serverStatusAnchorEl, setServerStatusAnchorEl] = useState<null | HTMLElement>(null);
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

  const cargarServerStatus = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 7000);

    try {
      const { data } = await api.get("/status", { signal: controller.signal });
      setServerStatus({
        ...data,
        status: data?.status || "online",
      });
    } catch (error) {
      setServerStatus({
        status: "offline",
        checkedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : "No se pudo contactar el backend",
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, []);

  const cargarServerDetails = useCallback(async () => {
    setServerDetailsLoading(true);
    try {
      const { data } = await api.get("/status/details");
      setServerDetails(data || null);
    } catch {
      setServerDetails(null);
    } finally {
      setServerDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargarServerStatus();
    const intervalId = window.setInterval(() => {
      void cargarServerStatus();
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [cargarServerStatus]);

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

  const cargarLogs = async () => {
    try {
      setLogsLoading(true);
      const { data } = await api.get("/logs/me");
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
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
  const isAdmin = `${rol || ""}`.toUpperCase() === "ADMIN";
  const serverStatusLabel = getServerStatusLabel(serverStatus);
  const serverStatusColor = getServerStatusColor(serverStatus);
  const serverStatusTooltip = isAdmin
    ? `${serverStatusLabel}. Click para ver detalles`
    : serverStatusLabel;

  const abrirAlertas = (event: React.MouseEvent<HTMLElement>) => {
    setAlertAnchorEl(event.currentTarget);
    void cargarLogs();
  };

  const cerrarAlertas = () => {
    setAlertAnchorEl(null);
  };

  const abrirServerStatus = (event: React.MouseEvent<HTMLElement>) => {
    if (!isAdmin) return;
    setServerStatusAnchorEl(event.currentTarget);
    void cargarServerDetails();
  };

  const cerrarServerStatus = () => {
    setServerStatusAnchorEl(null);
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
        zIndex: (theme) => theme.zIndex.drawer + 1,
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
          <Tooltip title={serverStatusTooltip}>
            <Box
              component="button"
              type="button"
              aria-label={serverStatusTooltip}
              onClick={abrirServerStatus}
              sx={{
                height: 36,
                px: { xs: 1, sm: 1.25 },
                border: "1px solid",
                borderColor: isDarkMode ? "rgba(255,255,255,0.18)" : "#e5e7eb",
                borderRadius: 999,
                backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "#f8fafc",
                color: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                cursor: isAdmin ? "pointer" : "default",
                flexShrink: 0,
                transition: "border-color 160ms ease, background-color 160ms ease",
                "&:hover": {
                  borderColor: isAdmin ? serverStatusColor : isDarkMode ? "rgba(255,255,255,0.18)" : "#e5e7eb",
                  backgroundColor: isAdmin
                    ? isDarkMode
                      ? "rgba(255,255,255,0.1)"
                      : "#eef2ff"
                    : isDarkMode
                      ? "rgba(255,255,255,0.06)"
                      : "#f8fafc",
                },
                "&:focus-visible": {
                  outline: "3px solid",
                  outlineColor: serverStatusColor,
                  outlineOffset: 2,
                },
              }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: serverStatusColor,
                  boxShadow:
                    serverStatus.status === "checking"
                      ? "none"
                      : `0 0 0 4px ${serverStatusColor}22`,
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  display: { xs: "none", md: "block" },
                  fontWeight: 700,
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                }}
              >
                {serverStatus.status === "checking" ? "Servidor" : serverStatus.status === "online" ? "Online" : "Alerta"}
              </Typography>
            </Box>
          </Tooltip>

          <Menu
            anchorEl={serverStatusAnchorEl}
            open={Boolean(serverStatusAnchorEl)}
            onClose={cerrarServerStatus}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            PaperProps={{ sx: { width: 430, maxWidth: "calc(100vw - 32px)" } }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      backgroundColor: serverStatusColor,
                      boxShadow: `0 0 0 4px ${serverStatusColor}22`,
                    }}
                  />
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {serverStatusLabel}
                  </Typography>
                </Stack>
                <Button
                  size="small"
                  onClick={() => {
                    void cargarServerStatus();
                    void cargarServerDetails();
                  }}
                >
                  Revisar
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {serverStatus.checkedAt
                  ? `Ultima revision: ${new Date(serverStatus.checkedAt).toLocaleString("es-GT")}`
                  : "Sin revision registrada"}
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ px: 2, py: 1.5 }}>
              <Stack spacing={1.25}>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    API
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {serverStatus.api?.state || (serverStatus.status === "offline" ? "offline" : "N/D")}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    Base de datos
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {serverStatus.database?.state || "N/D"}
                    {serverStatus.database?.latencyMs != null ? ` (${serverStatus.database.latencyMs} ms)` : ""}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    Railway
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, textAlign: "right" }}>
                    {serverStatus.railway?.label || "N/D"}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    Uptime backend
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {formatUptime(serverStatus.api?.uptimeSeconds)}
                  </Typography>
                </Stack>
              </Stack>
              {(serverStatus.message || serverStatus.database?.message || serverStatus.railway?.message) && (
                <Box
                  sx={{
                    mt: 1.5,
                    p: 1.25,
                    borderRadius: 1,
                    backgroundColor: "action.hover",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {serverStatus.message || serverStatus.database?.message || serverStatus.railway?.message}
                  </Typography>
                </Box>
              )}
            </Box>
            <Divider />
            <Box sx={{ px: 2, py: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Detalle MySQL
                </Typography>
                {serverDetailsLoading && <CircularProgress size={16} />}
              </Stack>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    Conexiones
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {metricValue(readMetric(serverDetails?.mysql?.status, "Threads_connected"))}
                    {" / "}
                    {metricValue(readMetric(serverDetails?.mysql?.variables, "max_connections"))}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    Max. usado
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {metricValue(readMetric(serverDetails?.mysql?.status, "Max_used_connections"))}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    Buffer pool
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {formatBytes(Number(readMetric(serverDetails?.mysql?.variables, "innodb_buffer_pool_size") || 0))}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    Base de datos
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {formatBytes(serverDetails?.mysql?.databaseBytes)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    Temporales en disco
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {metricValue(readMetric(serverDetails?.mysql?.status, "Created_tmp_disk_tables"))}
                  </Typography>
                </Stack>
              </Stack>
              {!!serverDetails?.mysql?.processlist?.length && (
                <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 1, backgroundColor: "action.hover" }}>
                  <Typography variant="caption" sx={{ display: "block", fontWeight: 800, mb: 0.75 }}>
                    Procesos recientes
                  </Typography>
                  <Stack spacing={0.5}>
                    {serverDetails.mysql.processlist.slice(0, 4).map((process) => (
                      <Typography key={process.id} variant="caption" color="text.secondary" noWrap>
                        #{process.id} {process.command || "N/D"} · {process.timeSeconds || 0}s · {process.user || "N/D"}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              )}
            </Box>
            <Divider />
            <Box sx={{ px: 2, py: 1.25, display: "flex", justifyContent: "flex-end", gap: 1 }}>
              <Button
                size="small"
                onClick={() => window.open(serverStatus.railway?.statusPageUrl || "https://status.railway.com", "_blank")}
              >
                Abrir Railway
              </Button>
            </Box>
          </Menu>

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
                  {alertPanelTab === "alertas" ? "Alertas" : "Log de actividad"}
                </Typography>
                {alertPanelTab === "alertas" ? (
                  <Button size="small" onClick={() => void marcarTodasLeidas()} disabled={!alertasNoLeidas}>
                    Marcar todas
                  </Button>
                ) : (
                  <Button size="small" onClick={() => void cargarLogs()} disabled={logsLoading}>
                    Recargar
                  </Button>
                )}
              </Stack>
            </Box>
            <Tabs
              value={alertPanelTab}
              onChange={(_, value) => {
                setAlertPanelTab(value);
                if (value === "log") void cargarLogs();
              }}
              variant="fullWidth"
              sx={{ minHeight: 38, borderTop: 1, borderColor: "divider" }}
            >
              <Tab label="Alertas" value="alertas" sx={{ minHeight: 38 }} />
              <Tab label="LOG" value="log" sx={{ minHeight: 38 }} />
            </Tabs>
            <Divider />
            {alertPanelTab === "alertas" ? (
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
            ) : (
              <List sx={{ py: 0, maxHeight: 420, overflowY: "auto" }}>
                {logsLoading ? (
                  <Box sx={{ px: 2, py: 3, display: "flex", justifyContent: "center" }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : logs.length ? (
                  logs.map((log) => (
                    <ListItemButton key={log.id} sx={{ alignItems: "flex-start" }}>
                      <ListItemText
                        primary={`${getActivityLogActionLabel(log)}: ${log.endpoint}`}
                        secondary={
                          <>
                            <Typography component="span" variant="body2" color="text.primary" sx={{ display: "block", mb: 0.5 }}>
                              Usuario: {log.usuario || displayName} | Resultado: {log.resultado || "N/D"}
                            </Typography>
                            <Typography component="span" variant="caption" color="text.secondary">
                              {new Date(log.fecha).toLocaleString("es-GT")}
                              {log.ip ? ` | IP: ${log.ip}` : ""}
                            </Typography>
                          </>
                        }
                      />
                    </ListItemButton>
                  ))
                ) : (
                  <Box sx={{ px: 2, py: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      No hay actividad registrada para este usuario.
                    </Typography>
                  </Box>
                )}
              </List>
            )}
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
