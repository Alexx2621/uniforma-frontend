// src/layout/Navbar.tsx
import { useCallback, useEffect, useEffectEvent, useReducer, useRef } from "react";
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
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import WbSunnyRoundedIcon from "@mui/icons-material/WbSunnyRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import { io, Socket } from "socket.io-client";
import Swal from "sweetalert2";
import { useAuthStore } from "../auth/useAuthStore";
import { useNavigate } from "react-router-dom";
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
    autorizacionPedidoId?: number;
    autorizacionTipo?: string | null;
    // Autorizacion para vender a un cliente de la cartera de otro vendedor.
    autorizacionClienteId?: number;
    autorizacionClienteResueltaId?: number;
    modulo?: string;
    solicitante?: string | null;
    solicitanteId?: number;
    aprobado?: boolean;
    // Solicitud de traslado: una tienda pide un producto que tiene otra.
    solicitudTrasladoId?: number;
    solicitudTrasladoResueltaId?: number;
    desdeBodega?: string;
    haciaBodega?: string;
    mensaje?: string;
    items?: Array<{ codigo?: string | null; nombre?: string | null; cantidad?: number }>;
    ordenMixtaId?: number;
    estado?: string;
    prioridad?: "baja" | "normal" | "alta" | "urgente";
    programadaPara?: string | null;
    enviadoPor?: string | null;
    cliente?: string | null;
    total?: number;
    detalleResumen?: string | null;
    comentario?: string | null;
    detalleItems?: Array<{
      linea?: number;
      codigo?: string | null;
      nombre?: string | null;
      tipo?: string | null;
      genero?: string | null;
      tela?: string | null;
      talla?: string | null;
      color?: string | null;
      cantidad?: number;
      precioUnit?: number;
      bordado?: number;
      descuento?: number;
      subtotal?: number;
      observaciones?: string | null;
    }>;
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
    // CloudLinux cuenta hilos contra el limite de procesos de la cuenta.
    hilos?: number | null;
    memoriaMB?: number;
  };
  database?: {
    ok?: boolean;
    state?: ServerState;
    latencyMs?: number;
    // Uso de conexiones frente al tope del plan: superarlo tumba la aplicacion.
    conexiones?: { enUso: number; limite: number; porcentaje: number } | null;
    conexionesAlLimite?: boolean;
    message?: string;
  };
  pdfRenderer?: {
    ok?: boolean;
    configurado?: boolean;
    state?: ServerState;
    label?: string;
    latencyMs?: number;
    url?: string;
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

interface PerfilNavbar {
  usuario?: string | null;
  nombre?: string | null;
  primerNombre?: string | null;
  primerApellido?: string | null;
  segundoApellido?: string | null;
  fotoUrl?: string | null;
  bodegaNombre?: string | null;
}

type AlertPanelTab = "alertas" | "log";

interface NavbarState {
  perfil: PerfilNavbar | null;
  alertAnchorEl: HTMLElement | null;
  alertas: AlertaInterna[];
  alertPanelTab: AlertPanelTab;
  logs: ActivityLog[];
  logsLoading: boolean;
  serverStatus: ServerStatus;
  serverDetails: ServerDetails | null;
  serverDetailsLoading: boolean;
  serverStatusAnchorEl: HTMLElement | null;
  draftCount: number;
}

type NavbarAction =
  | { type: "perfilChanged"; value: PerfilNavbar | null }
  | { type: "alertAnchorChanged"; value: HTMLElement | null }
  | { type: "alertasChanged"; value: AlertaInterna[] }
  | { type: "alertRead"; id: number }
  | { type: "allAlertsRead" }
  | { type: "alertPanelTabChanged"; value: AlertPanelTab }
  | { type: "logsLoadingChanged"; value: boolean }
  | { type: "logsChanged"; value: ActivityLog[] }
  | { type: "serverStatusChanged"; value: ServerStatus }
  | { type: "serverDetailsChanged"; value: ServerDetails | null }
  | { type: "serverDetailsLoadingChanged"; value: boolean }
  | { type: "serverStatusAnchorChanged"; value: HTMLElement | null }
  | { type: "draftCountChanged"; value: number };

const initialServerStatus: ServerStatus = {
  status: "checking",
  message: "Revisando estado del servidor",
};

const initialNavbarState: NavbarState = {
  perfil: null,
  alertAnchorEl: null,
  alertas: [],
  alertPanelTab: "alertas",
  logs: [],
  logsLoading: false,
  serverStatus: initialServerStatus,
  serverDetails: null,
  serverDetailsLoading: false,
  serverStatusAnchorEl: null,
  draftCount: 0,
};

const navbarReducer = (state: NavbarState, action: NavbarAction): NavbarState => {
  switch (action.type) {
    case "perfilChanged":
      return { ...state, perfil: action.value };
    case "alertAnchorChanged":
      return { ...state, alertAnchorEl: action.value };
    case "alertasChanged":
      return { ...state, alertas: action.value };
    case "alertRead":
      return {
        ...state,
        alertas: state.alertas.map((alerta) => (alerta.id === action.id ? { ...alerta, leida: true } : alerta)),
      };
    case "allAlertsRead":
      return { ...state, alertas: state.alertas.map((alerta) => ({ ...alerta, leida: true })) };
    case "alertPanelTabChanged":
      return { ...state, alertPanelTab: action.value };
    case "logsLoadingChanged":
      return { ...state, logsLoading: action.value };
    case "logsChanged":
      return { ...state, logs: action.value };
    case "serverStatusChanged":
      return { ...state, serverStatus: action.value };
    case "serverDetailsChanged":
      return { ...state, serverDetails: action.value };
    case "serverDetailsLoadingChanged":
      return { ...state, serverDetailsLoading: action.value };
    case "serverStatusAnchorChanged":
      return { ...state, serverStatusAnchorEl: action.value };
    case "draftCountChanged":
      return { ...state, draftCount: action.value };
    default:
      return state;
  }
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

const escapeHtml = (value?: string | number | null) =>
  `${value ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatMoney = (value?: number | null) =>
  `Q ${Number(value || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getAlertPriorityStyles = (prioridad?: string, leida?: boolean) => {
  if (leida) return {};
  if (prioridad === "urgente") return { backgroundColor: "#fee2e2", borderLeft: "5px solid #dc2626" };
  if (prioridad === "alta") return { backgroundColor: "#fff7ed", borderLeft: "5px solid #f97316" };
  if (prioridad === "baja") return { backgroundColor: "#eff6ff", borderLeft: "5px solid #2563eb" };
  return { backgroundColor: "action.selected", borderLeft: "5px solid transparent" };
};

interface ServerStatusWidgetProps {
  isDarkMode: boolean;
  isAdmin: boolean;
  serverStatus: ServerStatus;
  serverStatusLabel: string;
  serverStatusColor: string;
  serverStatusTooltip: string;
  serverStatusAnchorEl: HTMLElement | null;
  serverDetails: ServerDetails | null;
  serverDetailsLoading: boolean;
  onOpen: (event: React.MouseEvent<HTMLElement>) => void;
  onClose: () => void;
  onRefresh: () => void;
}

function ServerStatusWidget({
  isDarkMode,
  isAdmin,
  serverStatus,
  serverStatusLabel,
  serverStatusColor,
  serverStatusTooltip,
  serverStatusAnchorEl,
  serverDetails,
  serverDetailsLoading,
  onOpen,
  onClose,
  onRefresh,
}: ServerStatusWidgetProps) {
  return (
    <>
      <Tooltip title={serverStatusTooltip}>
        <Box
          component="button"
          type="button"
          aria-label={serverStatusTooltip}
          onClick={onOpen}
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
              boxShadow: serverStatus.status === "checking" ? "none" : `0 0 0 4px ${serverStatusColor}22`,
            }}
          />
          <Typography
            variant="caption"
            sx={{ display: { xs: "none", md: "block" }, fontWeight: 700, lineHeight: 1, whiteSpace: "nowrap" }}
          >
            {serverStatus.status === "checking" ? "Servidor" : serverStatus.status === "online" ? "Online" : "Alerta"}
          </Typography>
        </Box>
      </Tooltip>

      <Menu
        anchorEl={serverStatusAnchorEl}
        open={Boolean(serverStatusAnchorEl)}
        onClose={onClose}
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
            <Button size="small" onClick={onRefresh}>
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
                Conexiones MySQL
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  textAlign: "right",
                  color: serverStatus.database?.conexionesAlLimite ? "warning.main" : undefined,
                }}
              >
                {serverStatus.database?.conexiones
                  ? `${serverStatus.database.conexiones.enUso} / ${serverStatus.database.conexiones.limite}`
                  : "N/D"}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between" spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Hilos del proceso
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  textAlign: "right",
                  color: (serverStatus.api?.hilos ?? 0) > 25 ? "warning.main" : undefined,
                }}
              >
                {serverStatus.api?.hilos != null
                  ? `${serverStatus.api.hilos}${serverStatus.api.memoriaMB != null ? ` · ${serverStatus.api.memoriaMB} MB` : ""}`
                  : "N/D"}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between" spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Renderizador PDF
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  textAlign: "right",
                  color: serverStatus.pdfRenderer?.ok === false ? "error.main" : undefined,
                }}
              >
                {serverStatus.pdfRenderer?.label || "N/D"}
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
          {(serverStatus.message || serverStatus.database?.message || serverStatus.pdfRenderer?.message) && (
            <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 1, backgroundColor: "action.hover" }}>
              <Typography variant="caption" color="text.secondary">
                {serverStatus.message || serverStatus.database?.message || serverStatus.pdfRenderer?.message}
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
                    #{process.id} {process.command || "N/D"} - {process.timeSeconds || 0}s - {process.user || "N/D"}
                  </Typography>
                ))}
              </Stack>
            </Box>
          )}
        </Box>
        <Divider />
        <Box sx={{ px: 2, py: 1.25, display: "flex", justifyContent: "flex-end", gap: 1 }}>
          {serverStatus.pdfRenderer?.url && (
            <Button size="small" onClick={() => window.open(serverStatus.pdfRenderer?.url, "_blank")}>
              Probar renderizador
            </Button>
          )}
        </Box>
      </Menu>
    </>
  );
}

interface ThemeModeToggleProps {
  isDarkMode: boolean;
  onToggle: () => void;
}

function ThemeModeToggle({ isDarkMode, onToggle }: ThemeModeToggleProps) {
  return (
    <Tooltip title={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
      <Box
        component="button"
        type="button"
        aria-label={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        aria-pressed={isDarkMode}
        onClick={onToggle}
        sx={{
          width: { xs: 48, sm: 76 },
          height: { xs: 32, sm: 38 },
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
          "&:focus-visible": { outline: "3px solid", outlineColor: "primary.main", outlineOffset: 2 },
        }}
      >
        <Box
          sx={{
            width: { xs: 24, sm: 30 },
            height: { xs: 24, sm: 30 },
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            backgroundColor: isDarkMode ? "#2d2d30" : "#ffffff",
            color: isDarkMode ? "#ffffff" : "#f7d64a",
            transform: isDarkMode ? { xs: "translateX(16px)", sm: "translateX(36px)" } : "translateX(0)",
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
  );
}

interface UserIdentityProps {
  isDarkMode: boolean;
  displayName: string;
  bodegaNombre?: string | null;
  profileImageUrl: string;
  initials: string;
}

function UserIdentity({ isDarkMode, displayName, bodegaNombre, profileImageUrl, initials }: UserIdentityProps) {
  return (
    <>
      <Box textAlign="right" sx={{ display: { xs: "none", sm: "block" }, minWidth: 0, maxWidth: { sm: 180, md: 260 } }}>
        <Typography variant="body1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {displayName}
        </Typography>
        <Typography variant="body2" noWrap sx={{ color: isDarkMode ? "#d1d5db" : "#6b7280" }}>
          {bodegaNombre || "Sin bodega"}
        </Typography>
      </Box>
      <Avatar
        src={profileImageUrl}
        sx={{
          bgcolor: isDarkMode ? "#334155" : "#1B2852",
          color: "#fff",
          width: { xs: 34, sm: 40 },
          height: { xs: 34, sm: 40 },
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        {!profileImageUrl ? initials : null}
      </Avatar>
    </>
  );
}

interface AlertsMenuProps {
  alertAnchorEl: HTMLElement | null;
  alertas: AlertaInterna[];
  alertasNoLeidas: number;
  alertPanelTab: AlertPanelTab;
  logs: ActivityLog[];
  logsLoading: boolean;
  displayName: string;
  onOpen: (event: React.MouseEvent<HTMLElement>) => void;
  onClose: () => void;
  onMarkAllRead: () => void;
  onReloadLogs: () => void;
  onTabChange: (value: AlertPanelTab) => void;
  onOpenAlert: (alerta: AlertaInterna) => void;
}

function AlertsMenu({
  alertAnchorEl,
  alertas,
  alertasNoLeidas,
  alertPanelTab,
  logs,
  logsLoading,
  displayName,
  onOpen,
  onClose,
  onMarkAllRead,
  onReloadLogs,
  onTabChange,
  onOpenAlert,
}: AlertsMenuProps) {
  return (
    <>
      <Tooltip title="Alertas">
        <IconButton color="inherit" onClick={onOpen}>
          <Badge badgeContent={alertasNoLeidas} color="error">
            <NotificationsOutlinedIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={alertAnchorEl}
        open={Boolean(alertAnchorEl)}
        onClose={onClose}
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
              <Button size="small" onClick={onMarkAllRead} disabled={!alertasNoLeidas}>
                Marcar todas
              </Button>
            ) : (
              <Button size="small" onClick={onReloadLogs} disabled={logsLoading}>
                Recargar
              </Button>
            )}
          </Stack>
        </Box>
        <Tabs
          value={alertPanelTab}
          onChange={(_, value: AlertPanelTab) => onTabChange(value)}
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
                  onClick={() => onOpenAlert(alerta)}
                  sx={{
                    alignItems: "flex-start",
                    backgroundColor: alerta.leida ? "background.paper" : "action.selected",
                    ...getAlertPriorityStyles(alerta.payload?.prioridad, alerta.leida),
                  }}
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography component="span" variant="body2" sx={{ fontWeight: alerta.leida ? 500 : 800 }}>
                          {alerta.titulo}
                        </Typography>
                        {alerta.payload?.prioridad && alerta.payload.prioridad !== "normal" && (
                          <Typography component="span" variant="caption" sx={{ textTransform: "uppercase", fontWeight: 800 }}>
                            {alerta.payload.prioridad}
                          </Typography>
                        )}
                      </Stack>
                    }
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="text.primary" sx={{ display: "block", mb: 0.5 }}>
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
    </>
  );
}

interface NavbarProps {
  sidebarWidth?: number;
  showMenuButton?: boolean;
  onMenuClick?: () => void;
}

function useNavbarController() {
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
    permisos,
    logout,
    syncSession,
  } = useAuthStore();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(navbarReducer, initialNavbarState);
  const {
    perfil,
    alertAnchorEl,
    alertas,
    alertPanelTab,
    logs,
    logsLoading,
    serverStatus,
    serverDetails,
    serverDetailsLoading,
    serverStatusAnchorEl,
    draftCount,
  } = state;
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastUnreadCountRef = useRef<number | null>(null);
  const alertasSocketRef = useRef<Socket | null>(null);
  const seenAlertIdsRef = useRef<Set<number> | null>(null);
  if (seenAlertIdsRef.current === null) {
    seenAlertIdsRef.current = new Set<number>();
  }
  const canAuthorizePedidos =
    `${rol || ""}`.toUpperCase() === "ADMIN" || (Array.isArray(permisos) && permisos.includes("produccion.autorizar-pedidos"));
  const canViewDrafts =
    `${rol || ""}`.toUpperCase() === "ADMIN" || (Array.isArray(permisos) && permisos.includes("documentos-borradores.view"));

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
      dispatch({
        type: "serverStatusChanged",
        value: {
        ...data,
        status: data?.status || "online",
        },
      });
    } catch (error) {
      dispatch({
        type: "serverStatusChanged",
        value: {
          status: "offline",
          checkedAt: new Date().toISOString(),
          message: error instanceof Error ? error.message : "No se pudo contactar el backend",
        },
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, []);

  const cargarServerDetails = useCallback(async () => {
    dispatch({ type: "serverDetailsLoadingChanged", value: true });
    try {
      const { data } = await api.get("/status/details");
      dispatch({ type: "serverDetailsChanged", value: data || null });
    } catch {
      dispatch({ type: "serverDetailsChanged", value: null });
    } finally {
      dispatch({ type: "serverDetailsLoadingChanged", value: false });
    }
  }, []);

  const cargarDraftCount = useCallback(async () => {
    if (!canViewDrafts) {
      dispatch({ type: "draftCountChanged", value: 0 });
      return;
    }
    try {
      const { data } = await api.get("/documentos-borradores/contador");
      dispatch({ type: "draftCountChanged", value: Number(data?.count || 0) });
    } catch {
      dispatch({ type: "draftCountChanged", value: 0 });
    }
  }, [canViewDrafts]);

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
    void cargarDraftCount();
    const intervalId = window.setInterval(() => {
      void cargarDraftCount();
    }, 45000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [cargarDraftCount]);

  useEffect(() => {
    let active = true;

    const cargarPerfil = async () => {
      try {
        const { data } = await api.get("/auth/me");
        if (active) {
          syncSession(data);
          dispatch({ type: "perfilChanged", value: data });
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
            dispatch({ type: "perfilChanged", value: encontrado || null });
          }
        } catch {
          if (active) {
            dispatch({ type: "perfilChanged", value: null });
          }
        }
      }
    };

    void cargarPerfil();

    return () => {
      active = false;
    };
  }, [usuario, syncSession]);

  const gestionarAutorizacionCliente = useCallback(
    async (alerta: AlertaInterna) => {
      const autorizacionId = Number(alerta.payload?.autorizacionClienteId || 0);
      if (!Number.isFinite(autorizacionId) || autorizacionId <= 0) return;

      const payload = alerta.payload || {};
      const modulo = `${payload.modulo || "venta"}`;
      const etiqueta = modulo === "pedido" ? "un pedido" : modulo === "orden_mixta" ? "una orden mixta" : "una venta";

      const result = await Swal.fire({
        title: alerta.titulo || "Autorizacion de cliente",
        html: `
          <div style="text-align:left;font-size:13px;line-height:1.45;">
            <p style="margin:0 0 10px 0;">${escapeHtml(alerta.mensaje)}</p>
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0 0 12px 0;">
              <div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px;">
                <div style="font-size:11px;color:#6b7280;">Cliente</div>
                <div style="font-weight:700;">${escapeHtml(payload.cliente || "N/D")}</div>
              </div>
              <div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px;">
                <div style="font-size:11px;color:#6b7280;">Solicita</div>
                <div style="font-weight:700;">${escapeHtml(payload.solicitante || "N/D")}</div>
              </div>
            </div>
            <p style="margin:0 0 8px 0;color:#6b7280;">Autorizar permite generar ${escapeHtml(etiqueta)} a este cliente de tu cartera, una sola vez.</p>
          </div>
        `,
        input: "textarea",
        inputLabel: "Comentario (opcional)",
        inputAttributes: { "aria-label": "Comentario" },
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: "Autorizar",
        denyButtonText: "Rechazar",
        cancelButtonText: "Cerrar",
        confirmButtonColor: "#16a34a",
        denyButtonColor: "#dc2626",
        width: 620,
      });

      if (result.isDismissed) return;

      const comentario = `${result.value || ""}`.trim();
      const accion = result.isConfirmed ? "aprobar" : "rechazar";
      try {
        await api.post(`/autorizaciones-clientes/${autorizacionId}/${accion}`, { comentario });
        await marcarLeida(alerta.id);
        await Swal.fire(
          result.isConfirmed ? "Autorizacion concedida" : "Solicitud rechazada",
          result.isConfirmed
            ? "El vendedor ya puede continuar con la operacion."
            : "Se notifico al solicitante.",
          result.isConfirmed ? "success" : "info",
        );
      } catch (error: any) {
        await Swal.fire("Error", error?.response?.data?.message || "No se pudo resolver la solicitud", "error");
      }
    },
    [],
  );

  const gestionarSolicitudTraslado = useCallback(
    async (alerta: AlertaInterna) => {
      const solicitudId = Number(alerta.payload?.solicitudTrasladoId || 0);
      if (!Number.isFinite(solicitudId) || solicitudId <= 0) return;

      const payload = alerta.payload || {};
      const items = Array.isArray(payload.items) ? payload.items : [];
      const itemsHtml = items.length
        ? `<ul style="margin:0;padding-left:18px;">${items
            .map((item) => `<li>${escapeHtml(item.cantidad || 0)}x ${escapeHtml(item.nombre || "Producto")} (${escapeHtml(item.codigo || "")})</li>`)
            .join("")}</ul>`
        : "";

      const result = await Swal.fire({
        title: alerta.titulo || "Solicitud de traslado",
        html: `
          <div style="text-align:left;font-size:13px;line-height:1.45;">
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0 0 12px 0;">
              <div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px;">
                <div style="font-size:11px;color:#6b7280;">Solicita</div>
                <div style="font-weight:700;">${escapeHtml(payload.solicitante || "N/D")} (${escapeHtml(payload.haciaBodega || "N/D")})</div>
              </div>
              <div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px;">
                <div style="font-size:11px;color:#6b7280;">A tu tienda</div>
                <div style="font-weight:700;">${escapeHtml(payload.desdeBodega || "N/D")}</div>
              </div>
            </div>
            ${itemsHtml ? `<div style="margin:0 0 10px 0;">${itemsHtml}</div>` : ""}
            ${payload.mensaje ? `<div style="border-left:4px solid #1f3f87;background:#f8fafc;padding:8px 10px;margin-bottom:12px;"><strong>Mensaje:</strong> ${escapeHtml(payload.mensaje)}</div>` : ""}
          </div>
        `,
        input: "textarea",
        inputLabel: "Comentario (opcional)",
        inputAttributes: { "aria-label": "Comentario" },
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: "Autorizar",
        denyButtonText: "Rechazar",
        cancelButtonText: "Cerrar",
        confirmButtonColor: "#16a34a",
        denyButtonColor: "#dc2626",
        width: 620,
      });

      if (result.isDismissed) return;

      const comentario = `${result.value || ""}`.trim();
      const estado = result.isConfirmed ? "PENDIENTE" : "CANCELADO";
      try {
        await api.patch(`/traslados/solicitudes/${solicitudId}/estado`, {
          estado,
          observaciones: comentario || undefined,
          resolverAutorizacion: true,
        });
        await marcarLeida(alerta.id);
        await Swal.fire(
          result.isConfirmed ? "Solicitud autorizada" : "Solicitud rechazada",
          result.isConfirmed
            ? "La otra tienda ya puede preparar y trasladar el producto."
            : "Se notifico a quien la solicito.",
          result.isConfirmed ? "success" : "info",
        );
      } catch (error: any) {
        const message = error?.response?.data?.message || "No se pudo resolver la solicitud";
        // Si otra persona respondio mientras el modal estaba abierto, esta
        // alerta deja de ser accionable en esta sesion inmediatamente.
        if (error?.response?.status === 409) {
          await marcarLeida(alerta.id);
        }
        await Swal.fire(
          error?.response?.status === 409 ? "Solicitud ya resuelta" : "Error",
          message,
          error?.response?.status === 409 ? "info" : "error",
        );
      }
    },
    [],
  );

  const gestionarAutorizacionPedido = useCallback(
    async (alerta: AlertaInterna) => {
      const autorizacionId = Number(alerta.payload?.autorizacionPedidoId || 0);
      if (!Number.isFinite(autorizacionId) || autorizacionId <= 0) return;

      if (!canAuthorizePedidos) {
        await Swal.fire("Solicitud de autorizacion", alerta.mensaje, "info");
        return;
      }

      const payload = alerta.payload || {};
      const autorizacionTipo = `${payload.autorizacionTipo || ""}`.trim();
      const esOrdenMixta = autorizacionTipo === "orden_mixta";
      const detalleItems = Array.isArray(payload.detalleItems) ? payload.detalleItems : [];
      const detalleRows = detalleItems.length
        ? detalleItems
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.linea || "")}</td>
                  <td>${escapeHtml(item.codigo || "N/D")}</td>
                  <td>${escapeHtml(item.nombre || "Producto")}</td>
                  <td>${escapeHtml([item.tipo, item.tela, item.color, item.talla, item.genero].filter(Boolean).join(" / "))}</td>
                  <td style="text-align:right;">${escapeHtml(item.cantidad || 0)}</td>
                  <td style="text-align:right;">${escapeHtml(formatMoney(item.precioUnit || 0))}</td>
                  <td style="text-align:right;">${escapeHtml(formatMoney(item.bordado || 0))}</td>
                  <td style="text-align:right;">${escapeHtml(`${Number(item.descuento || 0).toFixed(2)}%`)}</td>
                  <td style="text-align:right;">${escapeHtml(formatMoney(item.subtotal || 0))}</td>
                </tr>
              `,
            )
            .join("")
        : `<tr><td colspan="9" style="text-align:center;color:#6b7280;">No hay detalle disponible</td></tr>`;
      const comentario = `${payload.comentario || ""}`.trim();

      const result = await Swal.fire({
        title: alerta.titulo || (esOrdenMixta ? "Autorizar orden mixta" : "Autorizar pedido"),
        html: `
          <div style="text-align:left;font-size:13px;line-height:1.45;">
            <p style="margin:0 0 10px 0;">${escapeHtml(alerta.mensaje)}</p>
            <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 12px 0;">
              <div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px;">
                <div style="font-size:11px;color:#6b7280;">Cliente</div>
                <div style="font-weight:700;">${escapeHtml(payload.cliente || "N/D")}</div>
              </div>
              <div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px;">
                <div style="font-size:11px;color:#6b7280;">Total estimado</div>
                <div style="font-weight:700;">${escapeHtml(formatMoney(payload.total || 0))}</div>
              </div>
              <div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px;">
                <div style="font-size:11px;color:#6b7280;">Detalle</div>
                <div style="font-weight:700;">${escapeHtml(payload.detalleResumen || "N/D")}</div>
              </div>
            </div>
            ${
              comentario
                ? `<div style="border-left:4px solid #1f3f87;background:#f8fafc;padding:8px 10px;margin-bottom:12px;"><strong>Comentario:</strong> ${escapeHtml(comentario)}</div>`
                : ""
            }
            <div style="max-height:260px;overflow:auto;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:12px;">
              <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead>
                  <tr style="background:#1f3f87;color:#fff;">
                    <th style="padding:7px;text-align:left;">#</th>
                    <th style="padding:7px;text-align:left;">Codigo</th>
                    <th style="padding:7px;text-align:left;">Producto</th>
                    <th style="padding:7px;text-align:left;">Detalle</th>
                    <th style="padding:7px;text-align:right;">Cant.</th>
                    <th style="padding:7px;text-align:right;">Precio</th>
                    <th style="padding:7px;text-align:right;">Bordado</th>
                    <th style="padding:7px;text-align:right;">Desc.</th>
                    <th style="padding:7px;text-align:right;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${detalleRows}
                </tbody>
              </table>
            </div>
            <label for="pedido-autorizacion-comentario" style="display:block;margin-bottom:6px;font-weight:600;">Comentario opcional</label>
            <textarea id="pedido-autorizacion-comentario" class="swal2-textarea" placeholder="Motivo, observacion o instruccion..." style="height:90px;margin:0;width:100%;"></textarea>
          </div>
        `,
        icon: "question",
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: "Autorizar",
        denyButtonText: "Rechazar",
        cancelButtonText: "Cerrar",
        confirmButtonColor: "#1f3f87",
        denyButtonColor: "#dc2626",
        width: 920,
        preConfirm: () =>
          (document.getElementById("pedido-autorizacion-comentario") as HTMLTextAreaElement | null)?.value || "",
        preDeny: () =>
          (document.getElementById("pedido-autorizacion-comentario") as HTMLTextAreaElement | null)?.value || "",
      });

      if (!result.isConfirmed && !result.isDenied) return;

      try {
        const endpoint = result.isConfirmed ? "aprobar" : "rechazar";
        const baseEndpoint = esOrdenMixta ? "/orden-mixta/autorizaciones" : "/produccion/autorizaciones";
        const { data } = await api.post(`${baseEndpoint}/${autorizacionId}/${endpoint}`, {
          comentario: result.value || "",
        });
        await marcarLeida(alerta.id);

        if (result.isConfirmed) {
          if (esOrdenMixta) {
            const ordenMixtaId = Number(data?.ordenMixta?.id || data?.ordenMixtaId || 0);
            await Swal.fire("Autorizado", "La orden mixta fue generada correctamente.", "success");
            if (ordenMixtaId > 0) navigate(`/orden-mixta/${ordenMixtaId}`);
          } else {
            const pedidoId = Number(data?.pedido?.id || data?.pedidoId || 0);
            await Swal.fire("Autorizado", "El pedido fue generado correctamente.", "success");
            if (pedidoId > 0) navigate(`/produccion/${pedidoId}`);
          }
        } else {
          await Swal.fire("Rechazado", "La solicitud fue rechazada.", "success");
        }
      } catch (error: any) {
        const message = error?.response?.data?.message || "No se pudo resolver la solicitud";
        Swal.fire("Error", Array.isArray(message) ? message.join(", ") : message, "error");
      }
    },
    [canAuthorizePedidos, navigate],
  );

  const mostrarAlertaEmergente = useCallback(async (alerta: AlertaInterna) => {
    if (alerta.payload?.autorizacionPedidoId && alerta.payload?.estado !== "aprobado" && alerta.payload?.estado !== "rechazado") {
      await gestionarAutorizacionPedido(alerta);
      return;
    }

    if (alerta.payload?.solicitudTrasladoId) {
      await gestionarSolicitudTraslado(alerta);
      return;
    }

    if (alerta.payload?.autorizacionClienteId) {
      await gestionarAutorizacionCliente(alerta);
      return;
    }

    const prioridad = alerta.payload?.prioridad || "normal";
    const icon = prioridad === "urgente" || prioridad === "alta" ? "warning" : "info";
    const confirmButtonColor =
      prioridad === "urgente" ? "#dc2626" : prioridad === "alta" ? "#f97316" : prioridad === "baja" ? "#2563eb" : "#1f3f87";

    const result = await Swal.fire({
      title: alerta.titulo,
      text: alerta.mensaje,
      icon,
      confirmButtonText: "Marcar leida",
      cancelButtonText: "Cerrar",
      showCancelButton: true,
      confirmButtonColor,
      background: prioridad === "urgente" ? "#fff1f2" : prioridad === "alta" ? "#fff7ed" : prioridad === "baja" ? "#eff6ff" : undefined,
    });

    if (result.isConfirmed) {
      try {
        await api.post(`/alertas/${alerta.id}/leida`);
        dispatch({ type: "alertRead", id: alerta.id });
      } catch {
        // La alerta queda disponible en la campana si no se pudo marcar.
      }
    }
  }, [gestionarAutorizacionPedido, gestionarSolicitudTraslado, gestionarAutorizacionCliente]);

  const cargarAlertas = useCallback(async (options?: { emergente?: boolean }) => {
    try {
      const { data } = await api.get("/alertas");
      const nextAlertas = Array.isArray(data) ? data : [];
      const nuevas: AlertaInterna[] = [];

      for (const alerta of nextAlertas) {
        const alertaId = Number(alerta.id);
        if (!alerta.leida && !seenAlertIdsRef.current!.has(alertaId)) {
          nuevas.push(alerta);
        }
        seenAlertIdsRef.current!.add(alertaId);
      }

      dispatch({ type: "alertasChanged", value: nextAlertas });

      if (options?.emergente && nuevas.length) {
        const prioridadOrden: Record<string, number> = { urgente: 4, alta: 3, normal: 2, baja: 1 };
        const alertaPrincipal = nuevas.reduce((selected, alerta) => {
          const selectedPriority = prioridadOrden[selected.payload?.prioridad || "normal"] || 2;
          const alertPriority = prioridadOrden[alerta.payload?.prioridad || "normal"] || 2;
          if (alertPriority !== selectedPriority) return alertPriority > selectedPriority ? alerta : selected;
          return new Date(alerta.creadaEn).getTime() > new Date(selected.creadaEn).getTime() ? alerta : selected;
        }, nuevas[0]);
        void mostrarAlertaEmergente(alertaPrincipal);
      }
    } catch {
      dispatch({ type: "alertasChanged", value: [] });
    }
  }, [mostrarAlertaEmergente]);

  const cargarLogs = async () => {
    try {
      dispatch({ type: "logsLoadingChanged", value: true });
      const { data } = await api.get("/logs/me");
      dispatch({ type: "logsChanged", value: Array.isArray(data) ? data : [] });
    } catch {
      dispatch({ type: "logsChanged", value: [] });
    } finally {
      dispatch({ type: "logsLoadingChanged", value: false });
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
  }, [cargarAlertas]);

  const refrescarAlertasSocket = useEffectEvent((options?: { emergente?: boolean }) => {
    void cargarAlertas(options);
  });

  const cerrarSesionPorActualizacion = useEffectEvent(() => {
    logout();
    window.location.href = "/login";
  });

  useEffect(() => {
    const socket = io(api.defaults.baseURL || window.location.origin, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    alertasSocketRef.current = socket;

    const refrescarAlertas = () => {
      refrescarAlertasSocket();
    };
    const refrescarAlertasEmergente = () => {
      refrescarAlertasSocket({ emergente: true });
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
        cerrarSesionPorActualizacion();
      });
    };

    socket.on("connect", refrescarAlertas);
    socket.on("alertas:actualizadas", refrescarAlertasEmergente);
    socket.on("sistema:actualizacion", manejarActualizacionSistema);

    return () => {
      socket.off("connect", refrescarAlertas);
      socket.off("alertas:actualizadas", refrescarAlertasEmergente);
      socket.off("sistema:actualizacion", manejarActualizacionSistema);
      socket.disconnect();
      alertasSocketRef.current = null;
    };
    // Effect Events always read the latest values without becoming reactive deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const isAdmin = `${rol || ""}`.toUpperCase() === "ADMIN";
  const serverStatusLabel = getServerStatusLabel(serverStatus);
  const serverStatusColor = getServerStatusColor(serverStatus);
  const serverStatusTooltip = isAdmin
    ? `${serverStatusLabel}. Click para ver detalles`
    : serverStatusLabel;

  const abrirAlertas = (event: React.MouseEvent<HTMLElement>) => {
    dispatch({ type: "alertAnchorChanged", value: event.currentTarget });
    void cargarLogs();
  };

  const cerrarAlertas = () => {
    dispatch({ type: "alertAnchorChanged", value: null });
  };

  const abrirServerStatus = (event: React.MouseEvent<HTMLElement>) => {
    if (!isAdmin) return;
    dispatch({ type: "serverStatusAnchorChanged", value: event.currentTarget });
    void cargarServerDetails();
  };

  const cerrarServerStatus = () => {
    dispatch({ type: "serverStatusAnchorChanged", value: null });
  };

  const marcarLeida = async (alertaId: number) => {
    try {
      await api.post(`/alertas/${alertaId}/leida`);
      dispatch({ type: "alertRead", id: alertaId });
    } catch {
      // No bloquear la UI por un error de marcado.
    }
  };

  const marcarTodasLeidas = async () => {
    try {
      await api.post("/alertas/marcar-todas-leidas");
      dispatch({ type: "allAlertsRead" });
    } catch {
      // No bloquear la UI por un error de marcado.
    }
  };

  const abrirDetalleAlerta = async (alerta: AlertaInterna) => {
    // Solicitud de autorizacion sobre un cliente de la cartera propia: se
    // resuelve desde la propia alerta, sin salir de la pantalla actual.
    if (alerta.payload?.autorizacionClienteId) {
      cerrarAlertas();
      await gestionarAutorizacionCliente(alerta);
      return;
    }

    if (alerta.payload?.solicitudTrasladoId) {
      cerrarAlertas();
      await gestionarSolicitudTraslado(alerta);
      return;
    }

    if (alerta.payload?.autorizacionPedidoId && alerta.payload?.estado !== "aprobado" && alerta.payload?.estado !== "rechazado") {
      cerrarAlertas();
      await gestionarAutorizacionPedido(alerta);
      return;
    }

    await marcarLeida(alerta.id);
    cerrarAlertas();

    const pedidoId = Number(alerta.payload?.pedidoId);
    if (Number.isFinite(pedidoId) && pedidoId > 0) {
      navigate(`/produccion/${pedidoId}`);
    }
  };

  const cambiarAlertPanelTab = (value: AlertPanelTab) => {
    dispatch({ type: "alertPanelTabChanged", value });
    if (value === "log") void cargarLogs();
  };

  const refrescarServerDetails = () => {
    void cargarServerStatus();
    void cargarServerDetails();
  };

  const abrirConfiguracion = () => {
    navigate("/admin");
  };

  const abrirBorradores = () => {
    navigate("/documentos-borradores");
  };

  return {
    isDarkMode,
    toggleMode,
    alertAnchorEl,
    alertas,
    alertasNoLeidas,
    alertPanelTab,
    logs,
    logsLoading,
    serverStatus,
    serverStatusLabel,
    serverStatusColor,
    serverStatusTooltip,
    serverStatusAnchorEl,
    serverDetails,
    serverDetailsLoading,
    isAdmin,
    canViewDrafts,
    draftCount,
    displayName,
    sourceBodegaNombre,
    profileImageUrl,
    initials,
    abrirAlertas,
    cerrarAlertas,
    abrirDetalleAlerta,
    cambiarAlertPanelTab,
    marcarTodasLeidas,
    cargarLogs,
    abrirServerStatus,
    cerrarServerStatus,
    refrescarServerDetails,
    abrirConfiguracion,
    abrirBorradores,
    handleLogout,
  };
}

export default function Navbar({ sidebarWidth = 0, showMenuButton = false, onMenuClick }: NavbarProps) {
  const {
    isDarkMode,
    toggleMode,
    alertAnchorEl,
    alertas,
    alertasNoLeidas,
    alertPanelTab,
    logs,
    logsLoading,
    serverStatus,
    serverStatusLabel,
    serverStatusColor,
    serverStatusTooltip,
    serverStatusAnchorEl,
    serverDetails,
    serverDetailsLoading,
    isAdmin,
    displayName,
    sourceBodegaNombre,
    profileImageUrl,
    initials,
    abrirAlertas,
    cerrarAlertas,
    abrirDetalleAlerta,
    cambiarAlertPanelTab,
    marcarTodasLeidas,
    cargarLogs,
    abrirServerStatus,
    cerrarServerStatus,
    refrescarServerDetails,
    abrirConfiguracion,
    abrirBorradores,
    handleLogout,
    canViewDrafts,
    draftCount,
  } = useNavbarController();

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer,
        ml: `${sidebarWidth}px`,
        width: `calc(100% - ${sidebarWidth}px)`,
        maxWidth: `calc(100vw - ${sidebarWidth}px)`,
        boxSizing: "border-box",
        background: isDarkMode ? "rgba(13, 20, 34, 0.92)" : "rgba(255, 255, 255, 0.90)",
        backdropFilter: "blur(18px)",
        color: isDarkMode ? "#f9fafb" : "#1f2937",
        borderBottom: "1px solid",
        borderColor: isDarkMode ? "rgba(148,163,184,0.16)" : "#e8edf4",
        boxShadow: isDarkMode ? "0 8px 24px rgba(0,0,0,0.12)" : "0 8px 24px rgba(24,54,111,0.045)",
        transition: "margin-left 180ms ease, width 180ms ease",
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 56, md: 64 }, px: { xs: 1.25, sm: 1.75, xl: 3 }, gap: { xs: 0.75, sm: 1.25 } }}>
        {showMenuButton && (
          <IconButton color="inherit" edge="start" onClick={onMenuClick} aria-label="Abrir menu" sx={{ flexShrink: 0 }}>
            <MenuRoundedIcon />
          </IconButton>
        )}
        <Box sx={{ flexGrow: 1, minWidth: 0 }} />

        <Stack direction="row" spacing={{ xs: 0.5, sm: 1.25, md: 2 }} alignItems="center" sx={{ minWidth: 0 }}>
          <ServerStatusWidget
            isDarkMode={isDarkMode}
            isAdmin={isAdmin}
            serverStatus={serverStatus}
            serverStatusLabel={serverStatusLabel}
            serverStatusColor={serverStatusColor}
            serverStatusTooltip={serverStatusTooltip}
            serverStatusAnchorEl={serverStatusAnchorEl}
            serverDetails={serverDetails}
            serverDetailsLoading={serverDetailsLoading}
            onOpen={abrirServerStatus}
            onClose={cerrarServerStatus}
            onRefresh={refrescarServerDetails}
          />

          <ThemeModeToggle isDarkMode={isDarkMode} onToggle={toggleMode} />
          <UserIdentity
            isDarkMode={isDarkMode}
            displayName={displayName}
            bodegaNombre={sourceBodegaNombre}
            profileImageUrl={profileImageUrl}
            initials={initials}
          />
          {canViewDrafts && (
            <Tooltip title="Documentos preliminares">
              <IconButton color="inherit" onClick={abrirBorradores}>
                <Badge badgeContent={draftCount} color="warning">
                  <DescriptionOutlinedIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
          <AlertsMenu
            alertAnchorEl={alertAnchorEl}
            alertas={alertas}
            alertasNoLeidas={alertasNoLeidas}
            alertPanelTab={alertPanelTab}
            logs={logs}
            logsLoading={logsLoading}
            displayName={displayName}
            onOpen={abrirAlertas}
            onClose={cerrarAlertas}
            onMarkAllRead={() => void marcarTodasLeidas()}
            onReloadLogs={() => void cargarLogs()}
            onTabChange={cambiarAlertPanelTab}
            onOpenAlert={(alerta) => void abrirDetalleAlerta(alerta)}
          />

          <Tooltip title="Configuracion">
            <IconButton color="inherit" onClick={abrirConfiguracion}>
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
