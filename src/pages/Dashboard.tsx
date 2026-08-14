import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddCircleOutlineOutlined from "@mui/icons-material/AddCircleOutlineOutlined";
import AssignmentOutlined from "@mui/icons-material/AssignmentOutlined";
import ChangeCircleOutlined from "@mui/icons-material/ChangeCircleOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import DashboardCustomizeOutlined from "@mui/icons-material/DashboardCustomizeOutlined";
import DragIndicatorOutlined from "@mui/icons-material/DragIndicatorOutlined";
import InventoryIcon from "@mui/icons-material/Inventory";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import PlaylistAddCheckOutlined from "@mui/icons-material/PlaylistAddCheckOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import RestartAltOutlined from "@mui/icons-material/RestartAltOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";
import { whatsappFeatureEnabled } from "../config/features";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import { useTablePagination } from "../utils/useTablePagination";
import { formatCurrency } from "../utils/currency";

interface Venta {
  id: number;
  fecha: string;
  total: number;
  bodegaId?: number | null;
  usuarioId?: number | null;
  vendedor?: string | null;
  bodega?: { nombre?: string };
}

interface PedidoProduccion {
  id: number;
  fecha: string;
  estado: string;
  totalEstimado: number;
  anticipo: number;
  saldoPendiente: number;
  bodegaId?: number | null;
  bodega?: { nombre?: string };
  cliente?: { nombre?: string };
  clienteNombre?: string | null;
  usuarioId?: number | null;
  solicitadoPor?: string | null;
  usuario?: { id?: number; nombre?: string | null; usuario?: string | null } | null;
  displayFolio?: string | null;
  folio?: string | null;
  postventaId?: number | null;
  postventaCobro?: string | null;
  postventa?: { folio?: string | null; tipo?: string | null } | null;
}

interface PostventaRow {
  id: number;
  folio: string;
  tipo: "cambio" | "devolucion";
  fecha: string;
  clienteNombre: string;
  motivo: string;
  estado: string;
  monto: number;
  usuarioId?: number | null;
  usuario?: { id?: number; nombre?: string | null; usuario?: string | null } | null;
}

interface DocumentoRow {
  id: number;
  tipo: string;
  correlativo: string;
  titulo?: string | null;
  data?: any;
  creadoEn: string;
  usuarioId?: number | null;
  usuario?: { id?: number; nombre?: string | null; usuario?: string | null; bodegaId?: number | null } | null;
}

interface TopCierreDiaAnterior {
  id: number;
  correlativo: string;
  vendedor: string;
  tienda: string;
  fecha: string;
  total: number;
}

interface MetaMensualResumen {
  metaMes: number;
  promedioDiario: number;
  source: "vendedor" | "tienda" | "global" | "consolidado" | "none";
}

interface ProductoResumen {
  id: number;
  codigo: string;
  nombre: string;
  stockMax: number;
}

interface InventarioRow {
  productoId: number;
  bodegaId: number;
  codigo: string;
  producto: string;
  stock: number;
  stockMax: number;
  bodega: string;
}

interface Bodega {
  id: number;
  nombre: string;
}

interface UsuarioOption {
  id: number;
  nombre?: string | null;
  usuario?: string | null;
  bodegaId?: number | null;
  bodega?: { id?: number; nombre?: string | null } | null;
}

interface WhatsappUltimoMensaje {
  id: number;
  remitente: string;
  remitenteNombre?: string | null;
  mensaje?: string | null;
  leido: boolean;
  recibidoEn: string;
}

interface WhatsappResumenUsuario {
  usuarioId: number;
  usuario: string;
  nombre: string;
  telefono?: string | null;
  totalNuevos: number;
  totalHoy: number;
  ultimoMensaje?: WhatsappUltimoMensaje | null;
}

interface WhatsappResumen {
  totalNuevos: number;
  totalHoy: number;
  usuarios: WhatsappResumenUsuario[];
}

interface DashboardBackendResumen {
  checkedAt?: string;
  filtros?: { alcance?: string; bodegaId?: number | null; usuarioId?: number | null };
  ventas?: {
    totalRango?: number;
    cantidadRango?: number;
    totalHoy?: number;
    cantidadHoy?: number;
  };
  pedidos?: {
    abiertos?: number;
    conSaldo?: number;
    saldoPendiente?: number;
    totalRango?: number;
  };
  inventario?: { bajoMinimo?: number };
}

const toDateOnly = (value: string | Date) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const normalizeDashboardText = (value?: string | null) =>
  `${value || ""}`
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const valuesMatchUser = (values: Array<string | number | null | undefined>, usuario?: UsuarioOption | null) => {
  if (!usuario) return true;
  const usuarioId = Number(usuario.id);
  if (values.some((value) => Number(value) === usuarioId)) return true;
  const userValues = [usuario.nombre, usuario.usuario]
    .map((value) => normalizeDashboardText(value))
    .filter(Boolean);
  if (!userValues.length) return false;
  const rowValues = values.map((value) => normalizeDashboardText(String(value || ""))).filter(Boolean);
  return rowValues.some((rowValue) =>
    userValues.some((userValue) => rowValue === userValue || rowValue.includes(userValue) || userValue.includes(rowValue)),
  );
};

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);
const apiRows = (value: any): any[] => (Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : []);

const roundMoney = (value: unknown) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
};

const hasPendingBalance = (value: unknown) => roundMoney(value) > 0;

const metodoCuentaComoTarjeta = (metodo?: string | null) => {
  const normalized = `${metodo || ""}`.trim().toLowerCase();
  return normalized === "tarjeta" || normalized === "visalink";
};

const getTiendaRowTotal = (row: any) =>
  Number(row?.total || 0) ||
  Number(row?.transferencia || 0) +
    Number(row?.deposito || 0) +
    Number(row?.tarjeta || 0) +
    Number(row?.efectivo || 0);

const getReporteDiarioTotal = (data: any) => {
  const capital = asArray(data?.capitalRows).reduce(
    (sum, row) =>
      sum + Number(row?.transferencia || 0) + Number(row?.deposito || 0) + Number(row?.efectivo || 0),
    0,
  );
  const departamento = asArray(data?.departamentoRows).reduce(
    (sum, row) => sum + Number(row?.transferencia || 0) + Number(row?.deposito || 0),
    0,
  );
  const ventasSnapshotRows = asArray(data?.ventasSnapshot).map((venta) => {
    const total = Number(venta?.total || 0);
    const metodo = `${venta?.metodoPago || ""}`.trim().toLowerCase();
    return {
      transferencia: metodo === "transferencia" ? total : 0,
      tarjeta: metodoCuentaComoTarjeta(metodo) ? total : 0,
      efectivo: metodo === "efectivo" ? total : 0,
      total,
    };
  });
  const tiendaAutoRows = asArray(data?.tiendaAutoRows);
  const tiendaRows = [
    ...(tiendaAutoRows.length ? tiendaAutoRows : ventasSnapshotRows),
    ...asArray(data?.tiendaManualRows),
  ];
  const tienda = tiendaRows.reduce((sum, row) => sum + getTiendaRowTotal(row), 0);
  return capital + departamento + tienda;
};

const estadoLabel = (estado?: string | null) =>
  `${estado || "N/D"}`
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getPedidoFolio = (pedido: PedidoProduccion) =>
  pedido.displayFolio || pedido.folio || `P-${pedido.id}`;

const getPedidoCliente = (pedido: PedidoProduccion) =>
  pedido.clienteNombre || pedido.cliente?.nombre || "Mostrador";

const MiniBars = ({ data }: { data: { label: string; value: number }[] }) => {
  if (!data.length) {
    return <Typography variant="body2" color="text.secondary">Sin datos para graficar.</Typography>;
  }
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <Stack direction="row" alignItems="flex-end" spacing={0.75} sx={{ height: 150 }}>
      {data.map((item) => (
        <Box key={item.label} sx={{ flex: 1, minWidth: 14 }}>
          <Box
            title={`${item.label}: ${formatCurrency(item.value)}`}
            sx={{
              height: `${Math.max((item.value / max) * 100, item.value > 0 ? 8 : 2)}%`,
              minHeight: item.value > 0 ? 8 : 2,
              bgcolor: "primary.main",
              borderRadius: "6px 6px 2px 2px",
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75, textAlign: "center" }}>
            {item.label}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
};

const MiniLineChart = ({
  data,
  target = 0,
}: {
  data: { label: string; value: number }[];
  target?: number;
}) => {
  if (!data.length) {
    return <Typography variant="body2" color="text.secondary">Sin datos para graficar.</Typography>;
  }
  const width = 640;
  const height = 170;
  const pad = 18;
  const max = Math.max(...data.map((item) => item.value), target, 1);
  const step = data.length > 1 ? (width - pad * 2) / (data.length - 1) : 0;
  const pointFor = (item: { value: number }, index: number) => ({
    x: pad + index * step,
    y: height - pad - (Number(item.value || 0) / max) * (height - pad * 2),
  });
  const points = data.map(pointFor);
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const targetY = height - pad - (Number(target || 0) / max) * (height - pad * 2);

  return (
    <Box sx={{ width: "100%", minWidth: 0, overflow: "hidden" }}>
      <Box component="svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" sx={{ width: "100%", minWidth: 0, display: "block" }}>
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#cbd5e1" />
        {target > 0 && (
          <>
            <line x1={pad} y1={targetY} x2={width - pad} y2={targetY} stroke="#ef4444" strokeDasharray="5 5" />
            <text x={width - pad} y={Math.max(12, targetY - 6)} textAnchor="end" fontSize="11" fill="#ef4444">
              Meta diaria
            </text>
          </>
        )}
        <path d={path} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={`${data[index].label}-${index}`}>
            <circle cx={point.x} cy={point.y} r="4" fill="#2563eb" />
            {index % Math.ceil(data.length / 8) === 0 || index === data.length - 1 ? (
              <text x={point.x} y={height - 4} textAnchor="middle" fontSize="10" fill="#64748b">
                {data[index].label}
              </text>
            ) : null}
          </g>
        ))}
      </Box>
    </Box>
  );
};

type InteractiveChartDatum = { label: string; value: number; color?: string };
const DASHBOARD_CHART_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];

const InteractivePieChart = ({ data, valueFormatter = (value) => `${value}` }: { data: InteractiveChartDatum[]; valueFormatter?: (value: number) => string }) => {
  const theme = useTheme();
  const cleanData = data.filter((item) => Number(item.value || 0) > 0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const total = cleanData.reduce((sum, item) => sum + Number(item.value || 0), 0);
  let cursor = -Math.PI / 2;
  const arcs = cleanData.map((item, index) => {
    const start = cursor;
    const angle = total > 0 ? (Number(item.value || 0) / total) * Math.PI * 2 : 0;
    cursor += angle;
    const end = cursor;
    const point = (value: number) => ({ x: 90 + Math.cos(value) * 66, y: 90 + Math.sin(value) * 66 });
    const from = point(start);
    const to = point(end);
    const path = angle >= Math.PI * 2 - 0.0001
      ? "M 90 24 A 66 66 0 1 1 89.99 24 Z"
      : `M 90 90 L ${from.x} ${from.y} A 66 66 0 ${angle > Math.PI ? 1 : 0} 1 ${to.x} ${to.y} Z`;
    return { item, index, path, color: item.color || DASHBOARD_CHART_COLORS[index % DASHBOARD_CHART_COLORS.length] };
  });
  const active = activeIndex == null ? null : cleanData[activeIndex];

  if (!cleanData.length) return <Typography variant="body2" color="text.secondary">No hay datos para graficar.</Typography>;
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
      <Box component="svg" viewBox="0 0 180 180" sx={{ width: 190, maxWidth: "100%", overflow: "visible" }}>
        {arcs.map(({ item, index, path, color }) => (
          <Box
            component="path"
            key={item.label}
            d={path}
            fill={color}
            tabIndex={0}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex(index)}
            onBlur={() => setActiveIndex(null)}
            sx={{
              cursor: "pointer", transformOrigin: "90px 90px", transition: "opacity 160ms ease, transform 160ms ease, filter 160ms ease",
              opacity: activeIndex == null || activeIndex === index ? 1 : 0.42,
              transform: activeIndex === index ? "scale(1.035)" : "scale(1)",
              filter: activeIndex === index ? "drop-shadow(0 5px 6px rgba(15,23,42,.24))" : "none",
              outline: "none",
            }}
          ><title>{`${item.label}: ${valueFormatter(item.value)}`}</title></Box>
        ))}
        <circle cx="90" cy="90" r="39" fill={theme.palette.background.paper} />
        <text x="90" y="86" textAnchor="middle" fontSize="11" fill={theme.palette.text.secondary}>{active?.label || "Total"}</text>
        <text x="90" y="104" textAnchor="middle" fontSize="14" fontWeight="700" fill={theme.palette.text.primary}>{valueFormatter(active?.value ?? total)}</text>
      </Box>
      <Stack spacing={0.75} sx={{ width: "100%", minWidth: 0 }}>
        {arcs.map(({ item, index, color }) => <Stack key={item.label} direction="row" justifyContent="space-between" spacing={1} onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)} sx={{ px: 0.75, py: 0.4, borderRadius: 1, bgcolor: activeIndex === index ? "action.hover" : "transparent", transition: "background-color 150ms ease" }}><Stack direction="row" spacing={0.75} alignItems="center" minWidth={0}><Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} /><Typography variant="body2" noWrap>{item.label}</Typography></Stack><Typography variant="body2" fontWeight={700}>{valueFormatter(item.value)}</Typography></Stack>)}
      </Stack>
    </Stack>
  );
};

const InteractiveDotChart = ({ data }: { data: { label: string; value: number }[] }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const visible = data.slice(-36);
  if (!visible.length) return <Typography variant="body2" color="text.secondary">No hay datos para graficar.</Typography>;
  const width = 700;
  const height = 210;
  const pad = 25;
  const max = Math.max(...visible.map((item) => item.value), 1);
  const step = visible.length > 1 ? (width - pad * 2) / (visible.length - 1) : 0;
  return (
    <Box sx={{ width: "100%", minWidth: 0, overflow: "hidden" }}>
      <Box component="svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" sx={{ width: "100%", minWidth: 0, display: "block" }}>
        {[0.25, 0.5, 0.75, 1].map((ratio) => <line key={ratio} x1={pad} x2={width - pad} y1={height - pad - ratio * (height - pad * 2)} y2={height - pad - ratio * (height - pad * 2)} stroke="#e2e8f0" strokeDasharray="4 5" />)}
        {visible.map((item, index) => {
          const x = pad + index * step;
          const y = height - pad - (item.value / max) * (height - pad * 2);
          const active = activeIndex === index;
          return <Box component="circle" key={`${item.label}-${index}`} cx={x} cy={y} r={active ? 8 : 5} fill={active ? "#dc2626" : "#2563eb"} tabIndex={0} onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)} onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)} sx={{ cursor: "pointer", transition: "r 150ms ease, fill 150ms ease, filter 150ms ease", filter: active ? "drop-shadow(0 3px 5px rgba(220,38,38,.35))" : "none", outline: "none" }}><title>{`${item.label}: ${formatCurrency(item.value)}`}</title></Box>;
        })}
        {activeIndex != null && visible[activeIndex] && <><Box component="text" x={width / 2} y="16" textAnchor="middle" fontSize="12" fontWeight="700" sx={{ fill: "text.primary" }}>{visible[activeIndex].label} · {formatCurrency(visible[activeIndex].value)}</Box></>}
      </Box>
    </Box>
  );
};

const InteractiveBars = ({ data, valueFormatter = formatCurrency }: { data: InteractiveChartDatum[]; valueFormatter?: (value: number) => string }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const max = Math.max(...data.map((item) => Number(item.value || 0)), 1);
  if (!data.length) return <Typography variant="body2" color="text.secondary">No hay datos para graficar.</Typography>;
  return <Stack spacing={1.05}>{data.slice(0, 8).map((item, index) => <Box key={item.label} tabIndex={0} onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)} onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)} sx={{ outline: "none" }}><Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.35 }}><Typography variant="caption" noWrap>{item.label}</Typography><Typography variant="caption" fontWeight={700}>{valueFormatter(item.value)}</Typography></Stack><Box sx={{ height: activeIndex === index ? 13 : 9, bgcolor: "action.hover", borderRadius: 4, overflow: "hidden", transition: "height 150ms ease" }}><Box sx={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 3 : 0)}%`, height: "100%", borderRadius: 4, bgcolor: item.color || DASHBOARD_CHART_COLORS[index % DASHBOARD_CHART_COLORS.length], boxShadow: activeIndex === index ? 3 : 0, transition: "width 280ms cubic-bezier(.2,.8,.2,1), height 150ms ease, box-shadow 150ms ease" }} /></Box></Box>)}</Stack>;
};

const MetaTimeline = ({
  data,
  target,
  today,
}: {
  data: { day: number; value: number; hasReport: boolean }[];
  target: number;
  today: number;
}) => {
  const max = Math.max(...data.map((item) => item.value), target, 1);
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(24px, 1fr))", gap: 0.75, alignItems: "end" }}>
      {data.map((item) => {
        const height = Math.max((item.value / max) * 70, item.hasReport ? 8 : 3);
        const isToday = item.day === today;
        return (
          <TooltipLike key={item.day} title={`Dia ${item.day}: ${item.hasReport ? formatCurrency(item.value) : "Sin reporte"}`}>
            <Box sx={{ textAlign: "center" }}>
              <Box
                sx={{
                  height,
                  mx: "auto",
                  width: "100%",
                  maxWidth: 18,
                  borderRadius: "5px 5px 2px 2px",
                  bgcolor: item.hasReport ? (item.value >= target ? "success.main" : "primary.main") : "action.disabledBackground",
                  border: isToday ? "2px solid" : "1px solid transparent",
                  borderColor: isToday ? "warning.main" : "transparent",
                }}
              />
              <Typography variant="caption" color={isToday ? "warning.main" : "text.secondary"} sx={{ display: "block", mt: 0.25, fontWeight: isToday ? 700 : 400 }}>
                {item.day}
              </Typography>
            </Box>
          </TooltipLike>
        );
      })}
    </Box>
  );
};

const TooltipLike = ({ title, children }: { title: string; children: React.ReactElement }) => (
  <Box title={title} sx={{ minWidth: 0 }}>
    {children}
  </Box>
);

const MetricCard = ({
  title,
  value,
  helper,
  icon,
  tone = "primary",
  onClick,
}: {
  title: string;
  value: string | number;
  helper?: string;
  icon: React.ReactNode;
  tone?: "primary" | "success" | "warning" | "error" | "info";
  onClick?: () => void;
}) => (
  <Paper
    variant="outlined"
    onClick={onClick}
    sx={{
      p: 2,
      height: "100%",
      borderRadius: 1,
      cursor: onClick ? "pointer" : "default",
      transition: "border-color 120ms ease, box-shadow 120ms ease",
      "&:hover": onClick
        ? {
            borderColor: `${tone}.main`,
            boxShadow: 2,
          }
        : undefined,
    }}
  >
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="caption" color="text.secondary">{title}</Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>{value}</Typography>
        {helper && <Typography variant="caption" color="text.secondary">{helper}</Typography>}
      </Stack>
      <Box sx={{ color: `${tone}.main`, display: "flex" }}>{icon}</Box>
    </Stack>
  </Paper>
);

type DashboardWidgetId =
  | "server-summary" | "monthly-goal" | "sales-range" | "production-open"
  | "pending-balance" | "post-sale-open" | "previous-day-top" | "whatsapp"
  | "sales-by-day" | "tasks" | "low-stock" | "recent-reports"
  | "inventory-summary" | "top-sales" | "sales-tickets" | "average-ticket"
  | "daily-sales-average" | "highest-sale" | "production-value" | "production-advances"
  | "orders-without-advance" | "production-status" | "post-sale-range"
  | "post-sale-amount" | "inventory-zero" | "inventory-health" | "reports-month"
  | "sales-store-bars" | "sales-seller-bars" | "sales-dot-chart" | "production-pie"
  | "post-sale-pie" | "inventory-pie" | "payment-pie";

type DashboardWidgetDefinition = {
  id: DashboardWidgetId;
  title: string;
  description: string;
  size: { xs: number; sm?: number; md?: number; lg?: number };
  permissions?: string[];
  requireAllPermissions?: boolean;
  content: React.ReactNode;
};

type DashboardWidgetPreferences = {
  version: 2;
  order: DashboardWidgetId[];
  hidden: DashboardWidgetId[];
  layouts: Partial<Record<DashboardWidgetId, DashboardWidgetLayout>>;
};

type DashboardWidgetLayout = { columns: number; height?: number };

type DashboardPreferencesResponse = {
  preferences?: unknown;
  updatedAt?: string | null;
};

const DEFAULT_WIDGET_ORDER: DashboardWidgetId[] = [
  "server-summary", "monthly-goal", "sales-range", "production-open", "pending-balance", "post-sale-open",
  "sales-tickets", "average-ticket", "daily-sales-average", "highest-sale",
  "production-value", "production-advances", "orders-without-advance", "production-status",
  "post-sale-range", "post-sale-amount", "inventory-zero", "inventory-health", "reports-month",
  "sales-store-bars", "sales-seller-bars", "sales-dot-chart", "production-pie", "post-sale-pie", "inventory-pie", "payment-pie",
  "previous-day-top", "whatsapp", "sales-by-day", "tasks", "low-stock", "recent-reports",
  "inventory-summary", "top-sales",
];

const mergeWidgetOrder = (saved: unknown): DashboardWidgetId[] => {
  const incoming = Array.isArray(saved) ? saved.filter((id): id is DashboardWidgetId => DEFAULT_WIDGET_ORDER.includes(id as DashboardWidgetId)) : [];
  return [...incoming, ...DEFAULT_WIDGET_ORDER.filter((id) => !incoming.includes(id))];
};

const normalizeSavedWidgetPreferences = (saved: unknown): DashboardWidgetPreferences | null => {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return null;
  const input = saved as Partial<DashboardWidgetPreferences>;
  if (input.version !== 2) return null;

  const hidden = Array.isArray(input.hidden)
    ? input.hidden.filter((id): id is DashboardWidgetId => DEFAULT_WIDGET_ORDER.includes(id as DashboardWidgetId))
    : [];
  const layouts: Partial<Record<DashboardWidgetId, DashboardWidgetLayout>> = {};
  if (input.layouts && typeof input.layouts === "object" && !Array.isArray(input.layouts)) {
    Object.entries(input.layouts).forEach(([id, rawLayout]) => {
      if (!DEFAULT_WIDGET_ORDER.includes(id as DashboardWidgetId) || !rawLayout || typeof rawLayout !== "object") return;
      const columns = Number(rawLayout.columns);
      const rawHeight = rawLayout.height == null ? undefined : Number(rawLayout.height);
      if (!Number.isFinite(columns)) return;
      layouts[id as DashboardWidgetId] = {
        columns: Math.min(12, Math.max(3, Math.round(columns))),
        ...(Number.isFinite(rawHeight) ? { height: Math.max(100, Math.min(2_000, Math.round(rawHeight!))) } : {}),
      };
    });
  }

  return { version: 2, order: mergeWidgetOrder(input.order), hidden, layouts };
};

const getDefaultWidgetColumns = (widget: DashboardWidgetDefinition) =>
  Math.min(12, Math.max(3, Math.round(widget.size.lg || widget.size.md || widget.size.sm || widget.size.xs || 12)));

const DASHBOARD_WIDGET_MIN_HEIGHTS: Partial<Record<DashboardWidgetId, number>> = {
  "server-summary": 118,
  "monthly-goal": 166,
  "sales-by-day": 270,
  tasks: 250,
  "low-stock": 250,
  "recent-reports": 250,
  "inventory-summary": 250,
  "top-sales": 250,
  "sales-store-bars": 260,
  "sales-seller-bars": 260,
  "sales-dot-chart": 270,
  "production-pie": 250,
  "post-sale-pie": 250,
  "inventory-pie": 250,
  "payment-pie": 250,
};

const getWidgetMinimumHeight = (widgetId: DashboardWidgetId) => DASHBOARD_WIDGET_MIN_HEIGHTS[widgetId] || 132;

const normalizeWidgetLayout = (layout: DashboardWidgetLayout, minimumHeight: number): DashboardWidgetLayout => ({
  columns: Math.min(12, Math.max(3, Math.round(layout.columns))),
  height: layout.height == null ? undefined : Math.max(minimumHeight, Math.round(layout.height)),
});

function DashboardWidgetTile({
  widget,
  editMode,
  layout,
  onHide,
  onResize,
}: {
  widget: DashboardWidgetDefinition;
  editMode: boolean;
  layout: DashboardWidgetLayout;
  onHide: (id: DashboardWidgetId) => void;
  onResize: (id: DashboardWidgetId, layout: DashboardWidgetLayout) => void;
}) {
  const minimumHeight = getWidgetMinimumHeight(widget.id);
  const [draftLayout, setDraftLayout] = useState<DashboardWidgetLayout>(() => normalizeWidgetLayout(layout, minimumHeight));
  const [isResizing, setIsResizing] = useState(false);
  const draftLayoutRef = useRef(draftLayout);
  const resizingRef = useRef(false);
  const resizeFrameRef = useRef<number | null>(null);
  const draggable = useDraggable({ id: widget.id, disabled: !editMode });
  const droppable = useDroppable({ id: widget.id, disabled: !editMode });
  const setNodeRef = useCallback((node: HTMLElement | null) => {
    draggable.setNodeRef(node);
    droppable.setNodeRef(node);
  }, [draggable, droppable]);
  const transform = draggable.transform
    ? `translate3d(${Math.round(draggable.transform.x)}px, ${Math.round(draggable.transform.y)}px, 0)`
    : undefined;

  useEffect(() => {
    if (resizingRef.current) return;
    const normalized = normalizeWidgetLayout(layout, minimumHeight);
    draftLayoutRef.current = normalized;
    setDraftLayout(normalized);
  }, [layout.columns, layout.height, minimumHeight]);

  useEffect(() => () => {
    if (resizeFrameRef.current != null) cancelAnimationFrame(resizeFrameRef.current);
  }, []);

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editMode) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const widgetNode = event.currentTarget.parentElement;
    const gridNode = widgetNode?.parentElement;
    if (!widgetNode || !gridNode) return;
    const widgetRect = widgetNode.getBoundingClientRect();
    const gridRect = gridNode.getBoundingClientRect();
    const gap = 16;
    const columnWidth = Math.max((gridRect.width - gap * 11) / 12, 1);
    resizingRef.current = true;
    setIsResizing(true);
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = widgetRect.width;
    const startHeight = widgetRect.height;
    let pendingLayout = draftLayoutRef.current;
    const onMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.max(columnWidth * 3, startWidth + moveEvent.clientX - startX);
      const nextColumns = Math.min(12, Math.max(3, Math.round((nextWidth + gap) / (columnWidth + gap))));
      const nextHeight = Math.max(minimumHeight, Math.round(startHeight + moveEvent.clientY - startY));
      pendingLayout = { columns: nextColumns, height: nextHeight };
      if (resizeFrameRef.current != null) return;
      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        draftLayoutRef.current = pendingLayout;
        setDraftLayout(pendingLayout);
      });
    };
    const onEnd = () => {
      if (resizeFrameRef.current != null) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      draftLayoutRef.current = pendingLayout;
      setDraftLayout(pendingLayout);
      resizingRef.current = false;
      setIsResizing(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      onResize(widget.id, pendingLayout);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd, { once: true });
    window.addEventListener("pointercancel", onEnd, { once: true });
  };

  return (
    <Box
      ref={setNodeRef}
      sx={{
        gridColumn: { xs: "span 12", sm: `span ${draftLayout.columns}` },
        position: "relative",
        minWidth: 0,
        minHeight: minimumHeight,
        height: draftLayout.height || "auto",
        transform,
        opacity: draggable.isDragging ? 0.34 : 1,
        zIndex: draggable.isDragging ? 3 : 1,
        transition: draggable.isDragging || isResizing ? "none" : "height 150ms cubic-bezier(.2,.8,.2,1), transform 150ms cubic-bezier(.2,.8,.2,1), box-shadow 150ms ease, opacity 150ms ease, outline-color 150ms ease",
        willChange: draggable.isDragging ? "transform" : isResizing ? "height" : "auto",
        borderRadius: 1,
        outline: editMode ? "1px dashed" : "none",
        outlineColor: editMode ? "primary.light" : "transparent",
        outlineOffset: editMode ? 3 : 0,
        boxShadow: editMode && droppable.isOver ? "0 0 0 4px rgba(25, 118, 210, 0.22), 0 18px 36px rgba(25, 118, 210, 0.22)" : "none",
        "&::after": editMode && droppable.isOver ? {
          content: '""', position: "absolute", inset: -6, border: "2px dashed", borderColor: "primary.main",
          borderRadius: 1.5, pointerEvents: "none",
        } : undefined,
        "& > .MuiPaper-root": {
          height: "100%",
          minHeight: minimumHeight,
          overflow: "hidden",
          pt: editMode ? "42px !important" : undefined,
          transition: isResizing ? "none" : "padding 150ms ease, border-color 150ms ease, box-shadow 150ms ease",
        },
      }}
    >
      {editMode && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ position: "absolute", zIndex: 5, top: 6, left: 10, right: 7, height: 29 }}
        >
          <Typography variant="caption" color="text.secondary" fontWeight={700} noWrap sx={{ pr: 1 }}>{widget.title}</Typography>
          <Stack direction="row" spacing={0.25} alignItems="center">
            <Tooltip title="Arrastrar para mover">
              <IconButton size="small" aria-label={`Mover ${widget.title}`} {...draggable.attributes} {...draggable.listeners} sx={{ width: 28, height: 28, cursor: draggable.isDragging ? "grabbing" : "grab" }}><DragIndicatorOutlined sx={{ fontSize: 18 }} /></IconButton>
            </Tooltip>
            <Tooltip title="Quitar del tablero">
              <IconButton size="small" aria-label={`Ocultar ${widget.title}`} onClick={() => onHide(widget.id)} sx={{ width: 28, height: 28 }}><CloseOutlined sx={{ fontSize: 17 }} /></IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      )}
      {widget.content}
      {editMode && (
        <Tooltip title="Arrastra para cambiar ancho y alto">
          <Box
            role="separator"
            aria-label={`Cambiar tamaño de ${widget.title}`}
            onPointerDown={handleResizeStart}
            sx={{
              position: "absolute", zIndex: 6, right: 4, bottom: 4, width: 22, height: 22, cursor: "nwse-resize",
              touchAction: "none",
              borderRadius: "0 0 5px 0",
              "&::before, &::after": { content: '""', position: "absolute", right: 3, bottom: 4, width: 11, height: 1.5, bgcolor: "primary.main", transform: "rotate(-45deg)", transformOrigin: "right center" },
              "&::after": { right: 3, bottom: 8, width: 7 },
            }}
          />
        </Tooltip>
      )}
    </Box>
  );
}

export default function Dashboard() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [pedidos, setPedidos] = useState<PedidoProduccion[]>([]);
  const [postventa, setPostventa] = useState<PostventaRow[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoRow[]>([]);
  const [reportesDiariosUsuario, setReportesDiariosUsuario] = useState<DocumentoRow[]>([]);
  const [topCierresGlobal, setTopCierresGlobal] = useState<TopCierreDiaAnterior[]>([]);
  const [metaMensual, setMetaMensual] = useState<MetaMensualResumen>({ metaMes: 0, promedioDiario: 0, source: "none" });
  const [inventario, setInventario] = useState<InventarioRow[]>([]);
  const [productos, setProductos] = useState<ProductoResumen[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([]);
  const [whatsappResumen, setWhatsappResumen] = useState<WhatsappResumen | null>(null);
  const [backendResumen, setBackendResumen] = useState<DashboardBackendResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [rango, setRango] = useState<"7" | "30" | "90">("30");
  const [bodegaFiltro, setBodegaFiltro] = useState<"all" | number>("all");
  const [vendedorFiltro, setVendedorFiltro] = useState<"all" | number>("all");
  const [saldoModalOpen, setSaldoModalOpen] = useState(false);
  const [metaModalOpen, setMetaModalOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [dashboardEditMode, setDashboardEditMode] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState<DashboardWidgetId[]>(DEFAULT_WIDGET_ORDER);
  const [hiddenWidgets, setHiddenWidgets] = useState<DashboardWidgetId[]>([]);
  const [widgetLayouts, setWidgetLayouts] = useState<Partial<Record<DashboardWidgetId, DashboardWidgetLayout>>>({});
  const [activeWidgetId, setActiveWidgetId] = useState<DashboardWidgetId | null>(null);
  const [widgetPreferencesDirty, setWidgetPreferencesDirty] = useState(false);
  const [widgetPreferencesSavedAt, setWidgetPreferencesSavedAt] = useState("");
  const [widgetPreferencesReady, setWidgetPreferencesReady] = useState(false);
  const [widgetPreferencesSaving, setWidgetPreferencesSaving] = useState(false);
  const [widgetPreferencesSyncError, setWidgetPreferencesSyncError] = useState("");
  const navigate = useNavigate();
  const { rol, permisos, bodegaId: userBodegaId, id: userId, nombre: userNombre, usuario: userUsuario } = useAuthStore();
  const { fetchConfig } = useSystemConfigStore();
  const canAccessAllBodegas =
    hasPermission(rol, permisos, "sistema.multi-tienda") || hasPermission(rol, permisos, "dashboard.filtro-tienda");
  const canFilterVendedores =
    hasPermission(rol, permisos, "sistema.selector-vendedores") || hasPermission(rol, permisos, "dashboard.filtro-vendedor");
  const canViewDashboardAll = hasPermission(rol, permisos, "dashboard.ver-todo");
  const canManageWhatsapp = rol === "ADMIN";
  const canViewSalesWidgets = hasPermission(rol, permisos, "ventas.view");
  const canViewProductionWidgets = hasPermission(rol, permisos, "produccion.view");
  const canViewPostSaleWidgets = hasPermission(rol, permisos, "postventa.view");
  const canViewInventoryWidgets =
    hasPermission(rol, permisos, "inventario.resumen.view") || hasPermission(rol, permisos, "inventario.minimos.view");
  const canViewReportWidgets =
    hasPermission(rol, permisos, "reportes.reporte-diario.view")
    || hasPermission(rol, permisos, "reportes.reporte-quincenal.view")
    || hasPermission(rol, permisos, "reportes.ventas-diarias.view");
  const canViewMetaWidgets = hasPermission(rol, permisos, "metas.view") || canViewSalesWidgets;
  const widgetPreferenceKey = useMemo(
    () => `uniforma:dashboard-widgets:v2:${userId || userUsuario || rol || "usuario"}`,
    [rol, userId, userUsuario],
  );
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 7 } }));

  useEffect(() => {
    let active = true;
    setWidgetPreferencesReady(false);
    setWidgetPreferencesSyncError("");

    const applyPreferences = (preferences: DashboardWidgetPreferences | null) => {
      if (!active) return;
      setWidgetOrder(preferences?.order || DEFAULT_WIDGET_ORDER);
      setHiddenWidgets(preferences?.hidden || []);
      setWidgetLayouts(preferences?.layouts || {});
      setWidgetPreferencesDirty(false);
    };

    const readLocalPreferences = () => {
      try {
        const saved = window.localStorage.getItem(widgetPreferenceKey);
        return saved ? normalizeSavedWidgetPreferences(JSON.parse(saved)) : null;
      } catch {
        return null;
      }
    };

    void (async () => {
      const localPreferences = readLocalPreferences();
      try {
        const { data } = await api.get<DashboardPreferencesResponse>("/dashboard/preferencias");
        if (!active) return;
        const remotePreferences = normalizeSavedWidgetPreferences(data?.preferences);

        if (remotePreferences) {
          applyPreferences(remotePreferences);
          window.localStorage.setItem(widgetPreferenceKey, JSON.stringify(remotePreferences));
          setWidgetPreferencesSavedAt("Sincronizado con tu cuenta");
          return;
        }

        applyPreferences(localPreferences);
        if (localPreferences) {
          await api.put("/dashboard/preferencias", localPreferences);
          if (active) setWidgetPreferencesSavedAt("Diseño anterior sincronizado");
        } else {
          setWidgetPreferencesSavedAt("");
        }
      } catch {
        applyPreferences(localPreferences);
        if (active) {
          setWidgetPreferencesSavedAt(localPreferences ? "Diseño local cargado" : "");
          setWidgetPreferencesSyncError("No se pudo sincronizar el diseño con tu cuenta");
        }
      } finally {
        if (active) setWidgetPreferencesReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [widgetPreferenceKey]);

  const cargarWhatsapp = useCallback(async () => {
    if (!whatsappFeatureEnabled) return;
    try {
      const { data } = await api.get("/whatsapp/resumen");
      setWhatsappResumen(data || null);
    } catch {
      setWhatsappResumen(null);
    }
  }, []);

  const usuarioActualOption = useMemo<UsuarioOption | null>(() => {
    if (!userId) return null;
    const parsedBodegaId = Number(userBodegaId);
    return {
      id: Number(userId),
      nombre: userNombre || userUsuario || "Mi usuario",
      usuario: userUsuario || userNombre || "Mi usuario",
      bodegaId: Number.isFinite(parsedBodegaId) ? parsedBodegaId : null,
    };
  }, [userBodegaId, userId, userNombre, userUsuario]);

  const usuariosDashboard = useMemo(() => {
    const map = new Map<number, UsuarioOption>();
    if (usuarioActualOption) map.set(usuarioActualOption.id, usuarioActualOption);
    usuarios.forEach((usuario) => {
      const id = Number(usuario.id);
      if (Number.isInteger(id) && id > 0) map.set(id, { ...usuario, id });
    });
    return Array.from(map.values()).sort((a, b) =>
      `${a.nombre || a.usuario || ""}`.localeCompare(`${b.nombre || b.usuario || ""}`, "es"),
    );
  }, [usuarioActualOption, usuarios]);

  const vendedorSeleccionado = useMemo(
    () => (vendedorFiltro === "all" ? null : usuariosDashboard.find((usuario) => Number(usuario.id) === Number(vendedorFiltro)) || null),
    [usuariosDashboard, vendedorFiltro],
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const dashboardGet = (url: string, config: Record<string, unknown> = {}) =>
      api.get(url, { ...config, signal: controller.signal });
    const load = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        const diaAnteriorDate = new Date();
        diaAnteriorDate.setDate(diaAnteriorDate.getDate() - 1);
        const parsedUserBodegaId = Number(userBodegaId);
        const effectiveVendedorId =
          vendedorFiltro === "all" ? (canViewDashboardAll ? undefined : userId || undefined) : Number(vendedorFiltro);
        const effectiveBodegaId =
          bodegaFiltro === "all"
            ? !canViewDashboardAll && Number.isFinite(parsedUserBodegaId) && parsedUserBodegaId > 0
              ? parsedUserBodegaId
              : undefined
            : Number(bodegaFiltro);
        const metaParams: Record<string, string | number | undefined> = {
          year: currentYear,
          month: currentMonth,
          _ts: Date.now(),
        };
        if (effectiveVendedorId) {
          metaParams.usuarioId = effectiveVendedorId;
          if (effectiveBodegaId) metaParams.bodegaId = effectiveBodegaId;
        } else if (effectiveBodegaId) {
          metaParams.scope = "tienda";
          metaParams.bodegaId = effectiveBodegaId;
        } else {
          metaParams.scope = "consolidado";
        }
        const reportesParams: Record<string, string | number> = { tipo: "reporteDiario", _ts: Date.now() };
        if (effectiveVendedorId) reportesParams.usuarioId = effectiveVendedorId;
        const postventaParams: Record<string, number> = {};
        if (effectiveVendedorId) postventaParams.usuarioId = effectiveVendedorId;
        const resumenDesde = new Date();
        resumenDesde.setDate(resumenDesde.getDate() - (Number(rango) - 1));
        const resumenParams: Record<string, string | number> = {
          desde: toDateOnly(resumenDesde),
          hasta: toDateOnly(new Date()),
          _ts: Date.now(),
        };
        if (effectiveVendedorId) resumenParams.usuarioId = effectiveVendedorId;
        if (effectiveBodegaId) resumenParams.bodegaId = effectiveBodegaId;

        const [
          respResumen,
          respVentas,
          respPedidos,
          respPostventa,
          respDocumentos,
          respReportesDiarios,
          respTopCierresGlobal,
          respMeta,
          respInv,
          respProd,
          respBod,
          respUsuarios,
          respWhatsapp,
        ] = await Promise.all([
          dashboardGet("/dashboard/resumen", { params: resumenParams }).catch(() => ({ data: null })),
          canViewSalesWidgets ? dashboardGet("/ventas", { params: { lite: 1 } }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          canViewProductionWidgets ? dashboardGet("/produccion", { params: { lite: 1 } }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          canViewPostSaleWidgets ? dashboardGet("/postventa", { params: postventaParams }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          canViewReportWidgets ? dashboardGet("/documentos").catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          canViewReportWidgets ? dashboardGet("/documentos", { params: reportesParams }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          canViewReportWidgets ? api
            .get("/documentos/dashboard/top-cierres-dia-anterior", {
              params: { fecha: toDateOnly(diaAnteriorDate), _ts: Date.now() },
              signal: controller.signal,
            })
            .catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          canViewMetaWidgets ? dashboardGet("/metas/mensuales/actual", {
              params: metaParams,
            })
            .catch(() => ({ data: { metaMes: 0, promedioDiario: 0, source: "none" } })) : Promise.resolve({ data: { metaMes: 0, promedioDiario: 0, source: "none" } }),
          canViewInventoryWidgets ? dashboardGet("/inventario/reporte").catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          canViewInventoryWidgets ? dashboardGet("/productos").catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          canAccessAllBodegas || canViewDashboardAll ? dashboardGet("/bodegas").catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          canFilterVendedores ? dashboardGet("/usuarios").catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          whatsappFeatureEnabled && canManageWhatsapp ? dashboardGet("/whatsapp/resumen").catch(() => ({ data: null })) : Promise.resolve({ data: null }),
        ]);
        if (!active) return;
        setBackendResumen(respResumen.data || null);
        setVentas(apiRows(respVentas.data));
        setPedidos(apiRows(respPedidos.data));
        setPostventa(respPostventa.data || []);
        setDocumentos(respDocumentos.data || []);
        setReportesDiariosUsuario(respReportesDiarios.data || []);
        setTopCierresGlobal(respTopCierresGlobal.data || []);
        setMetaMensual({
          metaMes: Number(respMeta.data?.metaMes || 0),
          promedioDiario: Number(respMeta.data?.promedioDiario || 0),
          source: respMeta.data?.source || "none",
        });
        setInventario(respInv.data || []);
        setProductos(respProd.data || []);
        setBodegas(respBod.data || []);
        setUsuarios(respUsuarios.data || []);
        setWhatsappResumen(respWhatsapp.data || null);
      } catch (error) {
        if (active) setLoadError("No se pudieron cargar todos los datos del dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    void fetchConfig();
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    bodegaFiltro, canAccessAllBodegas, canFilterVendedores, canViewDashboardAll, canViewInventoryWidgets,
    canManageWhatsapp, canViewMetaWidgets, canViewPostSaleWidgets, canViewProductionWidgets, canViewReportWidgets, canViewSalesWidgets,
    cargarWhatsapp, fetchConfig, rango, userBodegaId, userId, vendedorFiltro,
  ]);

  const marcarWhatsappLeidos = async (vendedorId?: number) => {
    if (!whatsappFeatureEnabled) return;
    await api.patch("/whatsapp/mensajes/leidos", { vendedorId });
    await cargarWhatsapp();
  };

  useEffect(() => {
    const parsed = Number(userBodegaId);
    if (!canAccessAllBodegas) {
      setBodegaFiltro(Number.isFinite(parsed) && parsed > 0 ? parsed : "all");
      return;
    }
    setBodegaFiltro(canViewDashboardAll ? "all" : Number.isFinite(parsed) && parsed > 0 ? parsed : "all");
  }, [canAccessAllBodegas, canViewDashboardAll, userBodegaId]);

  useEffect(() => {
    if (!canFilterVendedores) {
      setVendedorFiltro(userId || "all");
      return;
    }
    setVendedorFiltro(canViewDashboardAll ? "all" : userId || "all");
  }, [canFilterVendedores, canViewDashboardAll, userId]);

  const stats = useMemo(() => {
    const hoy = toDateOnly(new Date());
    const diaAnteriorDate = new Date();
    diaAnteriorDate.setDate(diaAnteriorDate.getDate() - 1);
    const diaAnterior = toDateOnly(diaAnteriorDate);
    const desde = new Date();
    desde.setDate(desde.getDate() - Number(rango) + 1);
    desde.setHours(0, 0, 0, 0);

    const filtraBodega = (bodegaId?: number | null) =>
      bodegaFiltro === "all" ? true : Number(bodegaId) === Number(bodegaFiltro);
    const filtraBodegaDocumento = (doc: DocumentoRow) => {
      if (bodegaFiltro === "all") return true;
      const data = doc.data || {};
      const docBodegaId = Number(doc.usuario?.bodegaId || data.bodegaId || data.tiendaId || data.bodega?.id);
      if (Number.isFinite(docBodegaId) && docBodegaId > 0) return docBodegaId === Number(bodegaFiltro);
      const bodega = bodegas.find((item) => Number(item.id) === Number(bodegaFiltro));
      const tiendaValues = [data.tienda, data.bodega, data.bodegaNombre, doc.usuario?.bodegaId].map((value) =>
        normalizeDashboardText(String(value || "")),
      );
      return Boolean(bodega && tiendaValues.includes(normalizeDashboardText(bodega.nombre)));
    };
    const usuarioFiltroActual =
      vendedorFiltro === "all"
        ? null
        : vendedorSeleccionado || { id: Number(vendedorFiltro), nombre: null, usuario: null };
    const filtraVendedor = (values: Array<string | number | null | undefined>) =>
      vendedorFiltro === "all" ? true : valuesMatchUser(values, usuarioFiltroActual);
    const filtraVendedorDocumento = (doc: DocumentoRow) => {
      const data = doc.data || {};
      return filtraVendedor([
        doc.usuarioId,
        doc.usuario?.id,
        doc.usuario?.nombre,
        doc.usuario?.usuario,
        data.usuarioId,
        data.vendedorId,
        data.vendedor,
        data.usuario,
        data.usuarioNombre,
        data.vendedorNombre,
        data.generadoPor,
      ]);
    };

    const ventasFiltradas = ventas.filter(
      (venta) => filtraBodega(venta.bodegaId) && filtraVendedor([venta.usuarioId, venta.vendedor]),
    );
    const ventasRango = ventasFiltradas.filter((venta) => new Date(venta.fecha) >= desde);
    const ventasHoy = ventasFiltradas.filter((venta) => toDateOnly(venta.fecha) === hoy);
    const pedidosFiltrados = pedidos.filter(
      (pedido) =>
        filtraBodega(pedido.bodegaId) &&
        filtraVendedor([pedido.usuarioId, pedido.usuario?.id, pedido.usuario?.nombre, pedido.usuario?.usuario, pedido.solicitadoPor]),
    );
    const inventarioFiltrado = inventario.filter((row) => filtraBodega(row.bodegaId));

    const totalVentasRango = ventasRango.reduce((sum, venta) => sum + Number(venta.total || 0), 0);
    const totalVentasHoy = ventasHoy.reduce((sum, venta) => sum + Number(venta.total || 0), 0);
    const ticketsRango = ventasRango.length;
    const ticketPromedio = ticketsRango > 0 ? totalVentasRango / ticketsRango : 0;
    const promedioVentaDiaria = Number(rango) > 0 ? totalVentasRango / Number(rango) : 0;
    const ventaMasAlta = ventasRango.reduce((max, venta) => Math.max(max, Number(venta.total || 0)), 0);

    const estadosAbiertos = new Set(["nuevo", "en_produccion", "pendiente", "regresado_produccion"]);
    const pedidosProduccion = pedidosFiltrados.filter((pedido) =>
      estadosAbiertos.has(`${pedido.estado || ""}`.trim().toLowerCase())
    );
    const estadosSinSaldo = new Set(["anulado", "recibido", "completado"]);
    const pedidosSaldo = pedidosFiltrados.filter((pedido) => {
      const estado = `${pedido.estado || ""}`.trim().toLowerCase();
      return !estadosSinSaldo.has(estado) && hasPendingBalance(pedido.saldoPendiente);
    });
    const pedidosSaldoOrdenados = pedidosSaldo
      .slice()
      .sort((a, b) => roundMoney(b.saldoPendiente) - roundMoney(a.saldoPendiente));
    const saldoPendiente = roundMoney(pedidosSaldoOrdenados.reduce((sum, pedido) => sum + roundMoney(pedido.saldoPendiente), 0));
    const pedidosSinCobro = pedidosFiltrados.filter((pedido) => pedido.postventaCobro === "sin_cobro");
    const valorPedidosProduccion = pedidosProduccion.reduce((sum, pedido) => sum + Number(pedido.totalEstimado || 0), 0);
    const anticiposPedidosProduccion = pedidosProduccion.reduce((sum, pedido) => sum + Number(pedido.anticipo || 0), 0);
    const pedidosSinAnticipo = pedidosProduccion.filter((pedido) => Number(pedido.anticipo || 0) <= 0);
    const produccionPorEstado = Array.from(pedidosProduccion.reduce((map, pedido) => {
      const estado = estadoLabel(pedido.estado);
      map.set(estado, (map.get(estado) || 0) + 1);
      return map;
    }, new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]);

    const postventaAbierta = postventa.filter(
      (row) =>
        ["pendiente", "en_revision"].includes(`${row.estado || ""}`.trim().toLowerCase()) &&
        filtraVendedor([row.usuarioId, row.usuario?.id, row.usuario?.nombre, row.usuario?.usuario]),
    );
    const postventaRango = postventa.filter((row) =>
      new Date(row.fecha) >= desde && filtraVendedor([row.usuarioId, row.usuario?.id, row.usuario?.nombre, row.usuario?.usuario]),
    );
    const postventaMontoRango = postventaRango.reduce((sum, row) => sum + Number(row.monto || 0), 0);
    const cambiosRango = postventaRango.filter((row) => row.tipo === "cambio").length;
    const devolucionesRango = postventaRango.filter((row) => row.tipo === "devolucion").length;

    const reportesRecientes = documentos
      .filter(
        (doc) =>
          ["reporteDiario", "reporteQuincenal"].includes(doc.tipo) &&
          filtraBodegaDocumento(doc) &&
          filtraVendedorDocumento(doc),
      )
      .slice()
      .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime())
      .slice(0, 5);

    const topCierresDiaAnterior = topCierresGlobal
      .map((cierre) => ({
        ...cierre,
        total: Number(cierre.total || 0),
      }))
      .sort((a, b) => Number(b.total || 0) - Number(a.total || 0))
      .slice(0, 3);

    const bajosStock = inventarioFiltrado
      .filter((row) => Number(row.stockMax || 0) > 0 && Number(row.stock || 0) < Number(row.stockMax || 0))
      .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0))
      .slice(0, 6);
    const inventarioAgotado = inventarioFiltrado.filter((row) => Number(row.stock || 0) <= 0);
    const inventarioConMinimo = inventarioFiltrado.filter((row) => Number(row.stockMax || 0) > 0);
    const inventarioSaludable = inventarioConMinimo.filter((row) => Number(row.stock || 0) >= Number(row.stockMax || 0));
    const inventarioBajoConStock = inventarioConMinimo.filter((row) => Number(row.stock || 0) > 0 && Number(row.stock || 0) < Number(row.stockMax || 0));
    const saludInventario = inventarioConMinimo.length > 0 ? (inventarioSaludable.length / inventarioConMinimo.length) * 100 : 100;

    const ventasPorDia = new Map<string, number>();
    for (let index = Number(rango) - 1; index >= 0; index -= 1) {
      const day = new Date();
      day.setDate(day.getDate() - index);
      ventasPorDia.set(toDateOnly(day), 0);
    }
    ventasRango.forEach((venta) => {
      const key = toDateOnly(venta.fecha);
      ventasPorDia.set(key, (ventasPorDia.get(key) || 0) + Number(venta.total || 0));
    });

    const topVentas = ventasRango
      .slice()
      .sort((a, b) => Number(b.total || 0) - Number(a.total || 0))
      .slice(0, 5);
    const ventasPorTiendaMap = ventasRango.reduce((map, venta) => {
      const label = venta.bodega?.nombre || `Tienda ${venta.bodegaId || "N/D"}`;
      map.set(label, (map.get(label) || 0) + Number(venta.total || 0));
      return map;
    }, new Map<string, number>());
    const ventasPorVendedorMap = ventasRango.reduce((map, venta) => {
      const label = `${venta.vendedor || "Sin vendedor"}`.trim() || "Sin vendedor";
      map.set(label, (map.get(label) || 0) + Number(venta.total || 0));
      return map;
    }, new Map<string, number>());
    const ventasPorTienda = Array.from(ventasPorTiendaMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    const ventasPorVendedor = Array.from(ventasPorVendedorMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    const dispersionVentas = ventasRango.slice().sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()).slice(-36).map((venta) => ({ label: `V-${venta.id}`, value: Number(venta.total || 0) }));

    const mesActual = new Date();
    const currentYear = mesActual.getFullYear();
    const currentMonth = mesActual.getMonth() + 1;
    const currentDay = mesActual.getDate();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const reportesDiariosMes = reportesDiariosUsuario.filter((doc) => {
      if (!filtraBodegaDocumento(doc) || !filtraVendedorDocumento(doc)) return false;
      const fechaReporte = `${doc?.data?.fecha || doc.creadoEn || ""}`.slice(0, 10);
      if (!fechaReporte) return false;
      const [yearValue, monthValue] = fechaReporte.split("-").map(Number);
      return yearValue === currentYear && monthValue === currentMonth;
    });
    const ventasReportePorDia = new Map<number, number>();
    reportesDiariosMes.forEach((doc) => {
      const fechaReporte = `${doc?.data?.fecha || doc.creadoEn || ""}`.slice(0, 10);
      const day = Number(fechaReporte.split("-")[2] || 0);
      if (!Number.isFinite(day) || day <= 0) return;
      ventasReportePorDia.set(day, (ventasReportePorDia.get(day) || 0) + getReporteDiarioTotal(doc.data || {}));
    });
    const acumuladoReportesDiarios = reportesDiariosMes.reduce(
      (sum, doc) => sum + getReporteDiarioTotal(doc.data || {}),
      0,
    );
    const metaMes = Number(metaMensual.metaMes || 0);
    const avanceMeta = metaMes > 0 ? Math.min((acumuladoReportesDiarios / metaMes) * 100, 100) : 0;
    const excedenteMeta = metaMes > 0 ? Math.max(acumuladoReportesDiarios - metaMes, 0) : 0;
    const restanteMeta = metaMes > 0 ? Math.max(metaMes - acumuladoReportesDiarios, 0) : 0;
    const diasConReporte = Array.from(ventasReportePorDia.values()).filter((value) => value > 0).length;
    const hayReporteHoy = ventasReportePorDia.has(currentDay);
    const diasRestantesCaptura = Math.max(daysInMonth - currentDay + (hayReporteHoy ? 0 : 1), 0);
    const diasRestantesCalendario = Math.max(daysInMonth - currentDay, 0);
    const promedioReportado = diasConReporte > 0 ? acumuladoReportesDiarios / diasConReporte : 0;
    const promedioCalendario = currentDay > 0 ? acumuladoReportesDiarios / currentDay : 0;
    const ventaNecesariaDiaria = diasRestantesCaptura > 0 ? restanteMeta / diasRestantesCaptura : restanteMeta;
    const proyeccionCierre = acumuladoReportesDiarios + promedioCalendario * diasRestantesCalendario;
    const diferenciaProyectada = proyeccionCierre - metaMes;
    const metaDiariaObjetivo = Number(metaMensual.promedioDiario || 0) || (daysInMonth > 0 ? metaMes / daysInMonth : 0);
    const cumplimientoPromedio = metaDiariaObjetivo > 0 ? (promedioCalendario / metaDiariaObjetivo) * 100 : 0;
    const timelineMeta = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const value = ventasReportePorDia.get(day) || 0;
      return {
        day,
        value,
        hasReport: ventasReportePorDia.has(day),
      };
    });
    const lineMeta = timelineMeta
      .filter((item) => item.day <= currentDay || item.hasReport)
      .map((item) => ({ label: `${item.day}`, value: item.value }));
    const mejoresDiasMeta = timelineMeta
      .filter((item) => item.hasReport)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    const metaSourceLabel =
      metaMensual.source === "vendedor"
        ? "Meta de vendedor"
        : metaMensual.source === "tienda"
          ? "Meta de tienda"
          : metaMensual.source === "consolidado"
            ? "Meta consolidada"
            : metaMensual.source === "global"
              ? "Meta global"
              : "Sin meta configurada";

    const actividad = [
      ...pedidosProduccion.slice(0, 4).map((pedido) => ({
        key: `pedido-${pedido.id}`,
        title: `${getPedidoFolio(pedido)} - ${getPedidoCliente(pedido)}`,
        detail: `Produccion: ${estadoLabel(pedido.estado)}`,
        action: "Abrir",
        path: `/produccion/${pedido.id}`,
      })),
      ...postventaAbierta.slice(0, 3).map((row) => ({
        key: `postventa-${row.id}`,
        title: `${row.folio} - ${row.clienteNombre}`,
        detail: `${row.tipo === "devolucion" ? "Devolucion" : "Cambio"}: ${row.motivo}`,
        action: "Ver",
        path: row.tipo === "devolucion" ? "/devoluciones" : "/cambios",
      })),
    ].slice(0, 6);

    return {
      totalVentasRango,
      totalVentasHoy,
      ticketsHoy: ventasHoy.length,
      ticketsRango,
      ticketPromedio,
      promedioVentaDiaria,
      ventaMasAlta,
      ventasPorTienda,
      ventasPorVendedor,
      dispersionVentas,
      pedidosProduccion,
      pedidosSaldo: pedidosSaldoOrdenados,
      saldoPendiente,
      pedidosSinCobro,
      valorPedidosProduccion,
      anticiposPedidosProduccion,
      pedidosSinAnticipo,
      produccionPorEstado,
      postventaAbierta,
      postventaRango,
      postventaMontoRango,
      cambiosRango,
      devolucionesRango,
      reportesRecientes,
      topCierresDiaAnterior,
      diaAnterior,
      bajosStock,
      inventarioAgotado,
      inventarioSaludable: inventarioSaludable.length,
      inventarioBajoConStock: inventarioBajoConStock.length,
      saludInventario,
      ventasPorDia: Array.from(ventasPorDia.entries()).map(([date, value]) => ({
        label: date.slice(5).replace("-", "/"),
        value,
      })),
      topVentas,
      metaMensual: {
        metaMes,
        promedioDiario: Number(metaMensual.promedioDiario || 0),
        acumuladoReportesDiarios,
        reportesDiariosMes: reportesDiariosMes.length,
        avanceMeta,
        restanteMeta,
        excedenteMeta,
        sourceLabel: metaSourceLabel,
        currentDay,
        daysInMonth,
        diasConReporte,
        diasRestantesCaptura,
        promedioReportado,
        promedioCalendario,
        ventaNecesariaDiaria,
        proyeccionCierre,
        diferenciaProyectada,
        metaDiariaObjetivo,
        cumplimientoPromedio,
        timelineMeta,
        lineMeta,
        mejoresDiasMeta,
      },
      actividad,
      productosActivos: productos.length,
      stockTotal: inventarioFiltrado.reduce((sum, row) => sum + Number(row.stock || 0), 0),
    };
  }, [
    ventas,
    pedidos,
    postventa,
    documentos,
    reportesDiariosUsuario,
    topCierresGlobal,
    metaMensual,
    inventario,
    productos,
    rango,
    bodegaFiltro,
    bodegas,
    vendedorFiltro,
    vendedorSeleccionado,
  ]);
  const { paginatedRows: pedidosSaldoPaginados, paginationProps: pedidosSaldoPaginationProps } =
    useTablePagination(stats.pedidosSaldo, 10);

  const widgetDefinitions = useMemo<DashboardWidgetDefinition[]>(() => [
    {
      id: "server-summary", title: "Resumen del servidor", description: "Cifras agregadas para el rango seleccionado.",
      size: { xs: 12 }, permissions: ["dashboard.ver-todo"],
      content: <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }} justifyContent="space-between">
          <Box><Typography variant="subtitle2" fontWeight={700}>Resumen calculado por servidor</Typography><Typography variant="caption" color="text.secondary">Consultas agregadas para el rango seleccionado.</Typography></Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={`Ventas ${formatCurrency(backendResumen?.ventas?.totalRango || 0)}`} />
            <Chip size="small" label={`Pedidos abiertos ${backendResumen?.pedidos?.abiertos || 0}`} />
            <Chip size="small" label={`Saldo ${formatCurrency(backendResumen?.pedidos?.saldoPendiente || 0)}`} />
            <Chip size="small" label={`Stock bajo ${backendResumen?.inventario?.bajoMinimo || 0}`} />
          </Stack>
        </Stack>
      </Paper>,
    },
    {
      id: "monthly-goal", title: "Meta mensual", description: "Avance de la meta del vendedor o tienda.",
      size: { xs: 12 }, permissions: ["metas.view", "ventas.view"],
      content: <Paper variant="outlined" onClick={() => setMetaModalOpen(true)} sx={{ p: 2, borderRadius: 1, cursor: "pointer", "&:hover": { borderColor: "primary.main", boxShadow: 2 } }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 1.5 }}>
          <Box><Typography variant="h6">Meta mensual</Typography><Typography variant="body2" color="text.secondary">Acumulado desde reportes diarios según los filtros activos.</Typography></Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap><Chip label={stats.metaMensual.sourceLabel} color={stats.metaMensual.metaMes > 0 ? "primary" : "warning"} /><Chip variant="outlined" label={`${stats.metaMensual.reportesDiariosMes} reporte(s)`} /></Stack>
        </Stack>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 4 }}><Typography variant="caption" color="text.secondary">Meta mes</Typography><Typography variant="h5" fontWeight={700}>{formatCurrency(stats.metaMensual.metaMes)}</Typography><Typography variant="caption" color="text.secondary">Promedio diario: {formatCurrency(stats.metaMensual.promedioDiario)}</Typography></Grid>
          <Grid size={{ xs: 12, md: 4 }}><Typography variant="caption" color="text.secondary">Acumulado</Typography><Typography variant="h5" fontWeight={700}>{formatCurrency(stats.metaMensual.acumuladoReportesDiarios)}</Typography><Typography variant="caption" color="text.secondary">Restante: {formatCurrency(stats.metaMensual.restanteMeta)}</Typography></Grid>
          <Grid size={{ xs: 12, md: 4 }}><Stack direction="row" justifyContent="space-between"><Typography variant="caption">Avance</Typography><Typography variant="caption" fontWeight={700}>{stats.metaMensual.avanceMeta.toFixed(2)}%</Typography></Stack><LinearProgress variant="determinate" value={stats.metaMensual.avanceMeta} color={stats.metaMensual.avanceMeta >= 100 ? "success" : "primary"} sx={{ height: 10, borderRadius: 1, mt: 0.75 }} /></Grid>
        </Grid>
      </Paper>,
    },
    { id: "sales-range", title: "Ventas del rango", description: "Total vendido en el periodo.", size: { xs: 12, sm: 6, lg: 3 }, permissions: ["ventas.view"], content: <MetricCard title={`Ventas últimos ${rango} días`} value={formatCurrency(stats.totalVentasRango)} helper={`Hoy: ${formatCurrency(stats.totalVentasHoy)} | Tickets: ${stats.ticketsHoy}`} icon={<TrendingUpIcon />} tone="success" /> },
    { id: "production-open", title: "Pedidos en producción", description: "Pedidos que siguen activos.", size: { xs: 12, sm: 6, lg: 3 }, permissions: ["produccion.view"], content: <MetricCard title="Pedidos en producción" value={stats.pedidosProduccion.length} helper={`${stats.pedidosSinCobro.length} ligados a postventa sin cobro`} icon={<PlaylistAddCheckOutlined />} tone="primary" /> },
    { id: "pending-balance", title: "Saldo pendiente", description: "Saldo pendiente en pedidos.", size: { xs: 12, sm: 6, lg: 3 }, permissions: ["produccion.view", "pagos.view"], requireAllPermissions: true, content: <MetricCard title="Saldo pendiente" value={formatCurrency(stats.saldoPendiente)} helper={`${stats.pedidosSaldo.length} pedidos con saldo`} icon={<PaymentsOutlined />} tone="warning" onClick={() => setSaldoModalOpen(true)} /> },
    { id: "post-sale-open", title: "Postventa abierta", description: "Cambios y devoluciones pendientes.", size: { xs: 12, sm: 6, lg: 3 }, permissions: ["postventa.view"], content: <MetricCard title="Postventa abierta" value={stats.postventaAbierta.length} helper="Pendientes o en revisión" icon={<ChangeCircleOutlined />} tone="info" /> },
    { id: "sales-tickets", title: "Tickets del rango", description: "Cantidad de ventas registradas.", size: { xs: 12, sm: 6, lg: 3 }, permissions: ["ventas.view"], content: <MetricCard title={`Tickets en ${rango} días`} value={stats.ticketsRango} helper={`${stats.ticketsHoy} generados hoy`} icon={<ReceiptLongOutlined />} tone="info" /> },
    { id: "average-ticket", title: "Ticket promedio", description: "Promedio monetario por venta.", size: { xs: 12, sm: 6, lg: 3 }, permissions: ["ventas.view"], content: <MetricCard title="Ticket promedio" value={formatCurrency(stats.ticketPromedio)} helper="Total vendido / número de tickets" icon={<PaymentsOutlined />} tone="success" /> },
    { id: "daily-sales-average", title: "Promedio diario", description: "Promedio vendido por día del rango.", size: { xs: 12, sm: 6, lg: 3 }, permissions: ["ventas.view"], content: <MetricCard title="Promedio diario" value={formatCurrency(stats.promedioVentaDiaria)} helper={`Calculado sobre ${rango} días`} icon={<TrendingUpIcon />} tone="primary" /> },
    { id: "highest-sale", title: "Venta más alta", description: "Mayor ticket del periodo.", size: { xs: 12, sm: 6, lg: 3 }, permissions: ["ventas.view"], content: <MetricCard title="Venta más alta" value={formatCurrency(stats.ventaMasAlta)} helper="Mayor ticket del rango" icon={<TrendingUpIcon />} tone="success" /> },
    { id: "production-value", title: "Valor en producción", description: "Valor estimado de pedidos activos.", size: { xs: 12, sm: 6, lg: 3 }, permissions: ["produccion.view"], content: <MetricCard title="Valor en producción" value={formatCurrency(stats.valorPedidosProduccion)} helper={`${stats.pedidosProduccion.length} pedidos activos`} icon={<PlaylistAddCheckOutlined />} tone="primary" /> },
    { id: "production-advances", title: "Anticipos en producción", description: "Anticipos recibidos de pedidos activos.", size: { xs: 12, sm: 6, lg: 3 }, permissions: ["produccion.view", "pagos.view"], requireAllPermissions: true, content: <MetricCard title="Anticipos en producción" value={formatCurrency(stats.anticiposPedidosProduccion)} helper="Aplicados a pedidos activos" icon={<PaymentsOutlined />} tone="success" /> },
    { id: "orders-without-advance", title: "Pedidos sin anticipo", description: "Pedidos activos con anticipo en cero.", size: { xs: 12, sm: 6, lg: 3 }, permissions: ["produccion.view"], content: <MetricCard title="Pedidos sin anticipo" value={stats.pedidosSinAnticipo.length} helper="Requieren seguimiento de cobro" icon={<WarningAmberIcon />} tone={stats.pedidosSinAnticipo.length ? "warning" : "success"} /> },
    {
      id: "production-status", title: "Estados de producción", description: "Distribución de pedidos activos.", size: { xs: 12, md: 6, lg: 4 }, permissions: ["produccion.view"],
      content: <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}><Typography variant="h6">Estados de producción</Typography><Divider sx={{ my: 1 }} />{!stats.produccionPorEstado.length ? <Typography variant="body2" color="text.secondary">No hay pedidos activos.</Typography> : <Stack spacing={1}>{stats.produccionPorEstado.map(([estado, cantidad]) => <Stack key={estado} direction="row" justifyContent="space-between"><Typography variant="body2">{estado}</Typography><Chip size="small" label={cantidad} /></Stack>)}</Stack>}</Paper>,
    },
    { id: "post-sale-range", title: "Postventa del rango", description: "Cambios y devoluciones registrados.", size: { xs: 12, sm: 6, lg: 3 }, permissions: ["postventa.view"], content: <MetricCard title={`Postventa en ${rango} días`} value={stats.postventaRango.length} helper={`${stats.cambiosRango} cambios | ${stats.devolucionesRango} devoluciones`} icon={<ChangeCircleOutlined />} tone="info" /> },
    { id: "post-sale-amount", title: "Monto de postventa", description: "Monto relacionado con postventa.", size: { xs: 12, sm: 6, lg: 3 }, permissions: ["postventa.view"], content: <MetricCard title="Monto de postventa" value={formatCurrency(stats.postventaMontoRango)} helper={`Movimientos de los últimos ${rango} días`} icon={<PaymentsOutlined />} tone="warning" /> },
    { id: "inventory-zero", title: "Existencias agotadas", description: "Variantes con stock en cero.", size: { xs: 12, sm: 6, lg: 3 }, permissions: ["inventario.resumen.view", "inventario.minimos.view"], content: <MetricCard title="Existencias agotadas" value={stats.inventarioAgotado.length} helper="Productos/bodega con stock cero" icon={<WarningAmberIcon />} tone={stats.inventarioAgotado.length ? "error" : "success"} /> },
    { id: "inventory-health", title: "Salud de inventario", description: "Porcentaje de variantes sobre su mínimo.", size: { xs: 12, sm: 6, lg: 3 }, permissions: ["inventario.resumen.view", "inventario.minimos.view"], content: <MetricCard title="Salud de inventario" value={`${stats.saludInventario.toFixed(1)}%`} helper="Existencias que alcanzan su stock objetivo" icon={<InventoryIcon />} tone={stats.saludInventario >= 80 ? "success" : stats.saludInventario >= 55 ? "warning" : "error"} /> },
    { id: "reports-month", title: "Reportes del mes", description: "Reportes diarios registrados este mes.", size: { xs: 12, sm: 6, lg: 3 }, permissions: ["reportes.reporte-diario.view", "reportes.ventas-diarias.view"], content: <MetricCard title="Reportes diarios del mes" value={stats.metaMensual.reportesDiariosMes} helper={`${stats.metaMensual.diasConReporte} días con información`} icon={<ReceiptLongOutlined />} tone="primary" /> },
    {
      id: "sales-store-bars", title: "Ventas por tienda", description: "Comparativo interactivo de ventas por tienda.", size: { xs: 12, lg: 6 }, permissions: ["ventas.view", "dashboard.ver-todo"], requireAllPermissions: true,
      content: <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}><Typography variant="h6">Ventas por tienda</Typography><Typography variant="body2" color="text.secondary">Pasa el cursor por cada barra para resaltarla.</Typography><Divider sx={{ my: 1.5 }} /><InteractiveBars data={stats.ventasPorTienda} /></Paper>,
    },
    {
      id: "sales-seller-bars", title: "Ventas por vendedor", description: "Ranking interactivo de vendedores.", size: { xs: 12, lg: 6 }, permissions: ["ventas.view", "dashboard.ver-todo"], requireAllPermissions: true,
      content: <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}><Typography variant="h6">Ventas por vendedor</Typography><Typography variant="body2" color="text.secondary">Ranking según el rango y tienda seleccionados.</Typography><Divider sx={{ my: 1.5 }} /><InteractiveBars data={stats.ventasPorVendedor} /></Paper>,
    },
    {
      id: "sales-dot-chart", title: "Dispersión de tickets", description: "Gráfico de puntos de las últimas ventas.", size: { xs: 12, lg: 6 }, permissions: ["ventas.view"],
      content: <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}><Typography variant="h6">Dispersión de tickets</Typography><Typography variant="body2" color="text.secondary">Cada punto representa una venta; enfócalo para ver su monto.</Typography><Divider sx={{ my: 1 }} /><InteractiveDotChart data={stats.dispersionVentas} /></Paper>,
    },
    {
      id: "production-pie", title: "Producción por estado", description: "Distribución interactiva de pedidos activos.", size: { xs: 12, lg: 6 }, permissions: ["produccion.view"],
      content: <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}><Typography variant="h6">Producción por estado</Typography><Typography variant="body2" color="text.secondary">Distribución de los pedidos que siguen activos.</Typography><Divider sx={{ my: 1 }} /><InteractivePieChart data={stats.produccionPorEstado.map(([label, value]) => ({ label, value }))} /></Paper>,
    },
    {
      id: "post-sale-pie", title: "Cambios y devoluciones", description: "Distribución de movimientos de postventa.", size: { xs: 12, lg: 4 }, permissions: ["postventa.view"],
      content: <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}><Typography variant="h6">Cambios y devoluciones</Typography><Divider sx={{ my: 1 }} /><InteractivePieChart data={[{ label: "Cambios", value: stats.cambiosRango, color: "#2563eb" }, { label: "Devoluciones", value: stats.devolucionesRango, color: "#dc2626" }]} /></Paper>,
    },
    {
      id: "inventory-pie", title: "Estado del inventario", description: "Salud, faltantes y existencias agotadas.", size: { xs: 12, lg: 4 }, permissions: ["inventario.resumen.view", "inventario.minimos.view"],
      content: <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}><Typography variant="h6">Estado del inventario</Typography><Divider sx={{ my: 1 }} /><InteractivePieChart data={[{ label: "Saludable", value: stats.inventarioSaludable, color: "#16a34a" }, { label: "Bajo", value: stats.inventarioBajoConStock, color: "#f59e0b" }, { label: "Agotado", value: stats.inventarioAgotado.length, color: "#dc2626" }]} /></Paper>,
    },
    {
      id: "payment-pie", title: "Anticipo y saldo", description: "Composición financiera de pedidos activos.", size: { xs: 12, lg: 4 }, permissions: ["produccion.view", "pagos.view"], requireAllPermissions: true,
      content: <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}><Typography variant="h6">Anticipo y saldo de pedidos</Typography><Divider sx={{ my: 1 }} /><InteractivePieChart valueFormatter={formatCurrency} data={[{ label: "Anticipos", value: stats.anticiposPedidosProduccion, color: "#16a34a" }, { label: "Saldo", value: stats.saldoPendiente, color: "#f59e0b" }]} /></Paper>,
    },
    {
      id: "previous-day-top", title: "Top del día anterior", description: "Mejores cierres del día anterior.", size: { xs: 12 }, permissions: ["reportes.reporte-diario.view"],
      content: <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}><Box><Typography variant="h6">Top 3 ventas del día anterior</Typography><Typography variant="body2" color="text.secondary">Ranking general basado en el cierre diario.</Typography></Box><Button size="small" endIcon={<OpenInNewOutlined />} onClick={() => navigate("/reportes/reporte-diario")}>Ver cierres</Button></Stack><Divider sx={{ my: 1 }} />{!stats.topCierresDiaAnterior.length ? <Typography variant="body2" color="text.secondary">No hay cierres para mostrar.</Typography> : <Grid container spacing={1}>{stats.topCierresDiaAnterior.map((cierre, index) => <Grid key={cierre.id} size={{ xs: 12, md: 4 }}><Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}><Typography variant="caption">#{index + 1} | {cierre.correlativo}</Typography><Typography variant="h6">{formatCurrency(cierre.total)}</Typography><Typography variant="body2">{cierre.vendedor}</Typography><Typography variant="caption" color="text.secondary">{cierre.tienda}</Typography></Box></Grid>)}</Grid>}</Paper>,
    },
    {
      id: "whatsapp", title: "WhatsApp Business", description: "Mensajes nuevos recibidos.", size: { xs: 12 },
      content: <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}><Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}><Box><Stack direction="row" spacing={1} alignItems="center"><WhatsAppIcon color="success" /><Typography variant="h6">Mensajes WhatsApp Business</Typography></Stack><Typography variant="body2" color="text.secondary">{canManageWhatsapp ? "Resumen por vendedor." : "Mensajes nuevos en tu número asignado."}</Typography></Box><Stack direction="row" spacing={1}><Chip color="success" label={`${whatsappResumen?.totalNuevos || 0} nuevos`} /><Chip variant="outlined" label={`${whatsappResumen?.totalHoy || 0} hoy`} /></Stack></Stack></Paper>,
    },
    {
      id: "sales-by-day", title: "Ventas por día", description: "Evolución de ventas del rango.", size: { xs: 12, lg: 8 }, permissions: ["ventas.view"],
      content: <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}><Stack direction="row" justifyContent="space-between"><Typography variant="h6">Ventas por día</Typography><Chip size="small" label={`${rango} días`} /></Stack><Divider sx={{ my: 1.5 }} /><MiniBars data={stats.ventasPorDia} /></Paper>,
    },
    {
      id: "tasks", title: "Pendientes para atender", description: "Producción y postventa que requieren atención.", size: { xs: 12, lg: 4 }, permissions: ["produccion.view", "postventa.view"],
      content: <Paper variant="outlined" sx={{ p: 2, minHeight: 245, borderRadius: 1 }}><Typography variant="h6">Pendientes para atender</Typography><Divider sx={{ my: 1 }} />{!stats.actividad.length ? <Typography variant="body2" color="text.secondary">No hay pendientes urgentes.</Typography> : <List dense disablePadding>{stats.actividad.map((item) => <ListItem key={item.key} disableGutters secondaryAction={<Button size="small" onClick={() => navigate(item.path)}>{item.action}</Button>}><ListItemText primary={item.title} secondary={item.detail} sx={{ pr: 7 }} /></ListItem>)}</List>}</Paper>,
    },
    {
      id: "low-stock", title: "Stock bajo", description: "Productos por debajo del objetivo.", size: { xs: 12, md: 6, lg: 4 }, permissions: ["inventario.resumen.view", "inventario.minimos.view"],
      content: <Paper variant="outlined" sx={{ p: 2, minHeight: 300, borderRadius: 1 }}><Typography variant="h6">Stock bajo</Typography><Divider sx={{ my: 1 }} />{!stats.bajosStock.length ? <Typography variant="body2" color="text.secondary">No hay productos bajo el objetivo.</Typography> : <List dense disablePadding>{stats.bajosStock.map((row) => <ListItem key={`${row.productoId}-${row.bodegaId}`} disableGutters><ListItemText primary={`${row.codigo} - ${row.producto}`} secondary={`${row.bodega} | ${row.stock}/${row.stockMax}`} /></ListItem>)}</List>}</Paper>,
    },
    {
      id: "recent-reports", title: "Reportes recientes", description: "Últimos reportes generados.", size: { xs: 12, md: 6, lg: 4 }, permissions: ["reportes.reporte-diario.view", "reportes.reporte-quincenal.view"],
      content: <Paper variant="outlined" sx={{ p: 2, minHeight: 300, borderRadius: 1 }}><Typography variant="h6">Reportes recientes</Typography><Divider sx={{ my: 1 }} />{!stats.reportesRecientes.length ? <Typography variant="body2" color="text.secondary">Aún no hay reportes.</Typography> : <List dense disablePadding>{stats.reportesRecientes.map((doc) => <ListItem key={doc.id} disableGutters><ListItemText primary={doc.correlativo} secondary={`${doc.tipo} | ${new Date(doc.creadoEn).toLocaleString()}`} /></ListItem>)}</List>}</Paper>,
    },
    {
      id: "inventory-summary", title: "Resumen de inventario", description: "Stock y catálogo disponible.", size: { xs: 12, md: 6, lg: 4 }, permissions: ["inventario.resumen.view"],
      content: <Paper variant="outlined" sx={{ p: 2, minHeight: 300, borderRadius: 1 }}><Typography variant="h6">Resumen inventario</Typography><Divider sx={{ my: 1 }} /><Stack spacing={1.5}><Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Stock total</Typography><Typography fontWeight={700}>{stats.stockTotal}</Typography></Stack><Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Productos catálogo</Typography><Typography fontWeight={700}>{stats.productosActivos}</Typography></Stack><Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Existencias agotadas</Typography><Typography fontWeight={700}>{stats.inventarioAgotado.length}</Typography></Stack><Button variant="outlined" onClick={() => navigate("/inventario/resumen")}>Ver inventario</Button></Stack></Paper>,
    },
    {
      id: "top-sales", title: "Ventas más altas", description: "Tickets de mayor valor del rango.", size: { xs: 12 }, permissions: ["ventas.view"],
      content: <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}><Stack direction="row" justifyContent="space-between"><Typography variant="h6">Ventas más altas del rango</Typography><Button size="small" onClick={() => navigate("/ventas")}>Ver ventas</Button></Stack><Divider sx={{ my: 1 }} />{!stats.topVentas.length ? <Typography variant="body2" color="text.secondary">No hay ventas en el rango.</Typography> : <Grid container spacing={1}>{stats.topVentas.map((venta) => <Grid key={venta.id} size={{ xs: 12, md: 6, lg: 2.4 }}><Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}><Typography variant="subtitle2">V-{venta.id}</Typography><Typography variant="h6">{formatCurrency(venta.total)}</Typography><Typography variant="caption" color="text.secondary">{new Date(venta.fecha).toLocaleDateString()}</Typography></Box></Grid>)}</Grid>}</Paper>,
    },
  ], [backendResumen, canManageWhatsapp, navigate, rango, stats, whatsappResumen]);

  const allowedWidgets = useMemo(() => widgetDefinitions.filter((widget) => {
    if (widget.id === "server-summary" && !backendResumen) return false;
    if (widget.id === "whatsapp") return whatsappFeatureEnabled && canManageWhatsapp;
    if (!widget.permissions?.length) return true;
    return widget.requireAllPermissions
      ? widget.permissions.every((permission) => hasPermission(rol, permisos, permission))
      : widget.permissions.some((permission) => hasPermission(rol, permisos, permission));
  }), [backendResumen, canManageWhatsapp, permisos, rol, widgetDefinitions]);
  const allowedWidgetMap = useMemo(() => new Map(allowedWidgets.map((widget) => [widget.id, widget])), [allowedWidgets]);
  const visibleWidgets = useMemo(() => widgetOrder
    .filter((id) => allowedWidgetMap.has(id) && !hiddenWidgets.includes(id))
    .map((id) => allowedWidgetMap.get(id)!), [allowedWidgetMap, hiddenWidgets, widgetOrder]);
  const hiddenAllowedWidgets = useMemo(() => allowedWidgets.filter((widget) => hiddenWidgets.includes(widget.id)), [allowedWidgets, hiddenWidgets]);

  const hideWidget = (id: DashboardWidgetId) => {
    setHiddenWidgets((current) => current.includes(id) ? current : [...current, id]);
    setWidgetPreferencesDirty(true);
  };
  const showWidget = (id: DashboardWidgetId) => {
    setHiddenWidgets((current) => current.filter((item) => item !== id));
    setWidgetPreferencesDirty(true);
  };
  const saveWidgetPreferences = async () => {
    const preferences: DashboardWidgetPreferences = { version: 2, order: widgetOrder, hidden: hiddenWidgets, layouts: widgetLayouts };
    window.localStorage.setItem(widgetPreferenceKey, JSON.stringify(preferences));
    setWidgetPreferencesSaving(true);
    setWidgetPreferencesSyncError("");
    try {
      await api.put("/dashboard/preferencias", preferences);
      setWidgetPreferencesDirty(false);
      setWidgetPreferencesSavedAt(`Guardado en tu cuenta ${new Date().toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}`);
      return true;
    } catch {
      setWidgetPreferencesDirty(true);
      setWidgetPreferencesSavedAt("Diseño guardado solo en este dispositivo");
      setWidgetPreferencesSyncError("No se pudo guardar el diseño en tu cuenta. Intenta nuevamente.");
      return false;
    } finally {
      setWidgetPreferencesSaving(false);
    }
  };
  const restoreDefaultWidgets = () => {
    setWidgetOrder(DEFAULT_WIDGET_ORDER);
    setHiddenWidgets([]);
    setWidgetLayouts({});
    setWidgetPreferencesDirty(true);
  };
  const resizeWidget = (id: DashboardWidgetId, layout: DashboardWidgetLayout) => {
    setWidgetLayouts((current) => ({ ...current, [id]: layout }));
    setWidgetPreferencesDirty(true);
  };
  const handleWidgetDragStart = (event: DragStartEvent) => {
    if (!dashboardEditMode) return;
    setActiveWidgetId(event.active.id as DashboardWidgetId);
  };
  const handleWidgetDragEnd = (event: DragEndEvent) => {
    const activeId = event.active.id as DashboardWidgetId;
    const overId = event.over?.id as DashboardWidgetId | undefined;
    setActiveWidgetId(null);
    if (!dashboardEditMode || !overId || activeId === overId) return;
    setWidgetOrder((current) => {
      const from = current.indexOf(activeId);
      const to = current.indexOf(overId);
      if (from < 0 || to < 0) return current;
      const next = current.slice();
      next.splice(from, 1);
      next.splice(to, 0, activeId);
      return next;
    });
    setWidgetPreferencesDirty(true);
  };

  return (
    <Box sx={{ p: { xs: 0, xl: 0.5 }, minWidth: 0, maxWidth: "100%", minHeight: "100%", bgcolor: "background.default", overflowX: "hidden" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={2} sx={{ mb: 2 }}>
        <Stack spacing={0.5}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Dashboard operativo</Typography>
          <Typography variant="body2" color="text.secondary">
            Ventas, produccion, postventa, saldos y stock en una sola vista.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 190, xl: 220 }, flex: { xs: "1 1 100%", sm: "1 1 190px" } }} disabled={!canFilterVendedores}>
            <InputLabel>Vendedor</InputLabel>
            <Select
              label="Vendedor"
              value={vendedorFiltro === "all" ? "all" : String(vendedorFiltro)}
              onChange={(event) => setVendedorFiltro(event.target.value === "all" ? "all" : Number(event.target.value))}
            >
              {canViewDashboardAll && <MenuItem value="all">Todos los vendedores</MenuItem>}
              {usuariosDashboard.map((usuario) => (
                <MenuItem key={usuario.id} value={usuario.id}>
                  {usuario.nombre || usuario.usuario || `Usuario #${usuario.id}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 165, xl: 190 }, flex: { xs: "1 1 100%", sm: "1 1 165px" } }} disabled={!canAccessAllBodegas}>
            <InputLabel>Tienda</InputLabel>
            <Select
              label="Tienda"
              value={bodegaFiltro === "all" ? "all" : String(bodegaFiltro)}
              onChange={(event) => setBodegaFiltro(event.target.value === "all" ? "all" : Number(event.target.value))}
            >
              {canViewDashboardAll && <MenuItem value="all">Todas las tiendas</MenuItem>}
              {bodegas.map((bodega) => (
                <MenuItem key={bodega.id} value={bodega.id}>{bodega.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <ToggleButtonGroup value={rango} exclusive size="small" onChange={(_, value) => value && setRango(value)}>
            <ToggleButton value="7">7d</ToggleButton>
            <ToggleButton value="30">30d</ToggleButton>
            <ToggleButton value="90">90d</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {loadError && <Alert severity="warning" sx={{ mb: 2 }}>{loadError}</Alert>}

      <Paper variant="outlined" sx={{ p: 1.25, mb: 2, borderRadius: 1 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={1.5}>
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>Mi tablero</Typography>
            <Typography variant="caption" color="text.secondary">
              {dashboardEditMode
                ? "Modo edición activo: mueve los widgets o ajusta su tamaño desde la esquina inferior derecha."
                : "Vista personalizada según tu rol. Activa el modo edición cuando quieras reorganizarla."}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip size="small" variant="outlined" label={`${visibleWidgets.length} widgets visibles`} />
            {(widgetPreferencesDirty || widgetPreferencesSavedAt || widgetPreferencesSaving) && (
              <Chip
                size="small"
                color={widgetPreferencesSyncError ? "error" : widgetPreferencesDirty ? "warning" : "success"}
                label={widgetPreferencesSaving ? "Guardando diseño..." : widgetPreferencesSyncError || (widgetPreferencesDirty ? "Cambios sin sincronizar" : widgetPreferencesSavedAt)}
              />
            )}
            <Button size="small" startIcon={<DashboardCustomizeOutlined />} onClick={() => setCustomizeOpen(true)}>Personalizar</Button>
            <Button
              size="small"
              variant={dashboardEditMode ? "contained" : "outlined"}
              color={dashboardEditMode ? "warning" : "primary"}
              onClick={() => { setDashboardEditMode((current) => !current); setActiveWidgetId(null); }}
            >
              {dashboardEditMode ? "Finalizar edición" : "Editar tablero"}
            </Button>
            <Button size="small" variant="contained" startIcon={<SaveOutlined />} disabled={!widgetPreferencesDirty || !widgetPreferencesReady || widgetPreferencesSaving} onClick={() => void saveWidgetPreferences()}>Guardar diseño</Button>
          </Stack>
        </Stack>
      </Paper>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleWidgetDragStart} onDragEnd={handleWidgetDragEnd} onDragCancel={() => setActiveWidgetId(null)}>
        {visibleWidgets.length ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
              gap: 2,
              alignItems: "start",
              mb: 2,
              pt: dashboardEditMode ? 0.75 : 0,
              transition: "padding 180ms ease",
            }}
          >
            {visibleWidgets.map((widget) => (
              <DashboardWidgetTile
                key={widget.id}
                widget={widget}
                editMode={dashboardEditMode}
                layout={widgetLayouts[widget.id] || { columns: getDefaultWidgetColumns(widget) }}
                onHide={hideWidget}
                onResize={resizeWidget}
              />
            ))}
          </Box>
        ) : (
          <Alert severity="info" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => setCustomizeOpen(true)}>Agregar widgets</Button>}>
            No tienes widgets visibles. Puedes recuperarlos desde Personalizar.
          </Alert>
        )}
        <DragOverlay>
          {dashboardEditMode && activeWidgetId && allowedWidgetMap.get(activeWidgetId) ? (
            <Paper variant="outlined" sx={{ px: 2, py: 1.25, minWidth: 240, boxShadow: 8, borderColor: "primary.main" }}>
              <Stack direction="row" spacing={1} alignItems="center"><DragIndicatorOutlined color="primary" /><Typography fontWeight={700}>{allowedWidgetMap.get(activeWidgetId)?.title}</Typography></Stack>
            </Paper>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={customizeOpen} onClose={() => setCustomizeOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Personalizar dashboard</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="info">Solo aparecen widgets permitidos para tu rol. El diseño se guarda en tu cuenta y estará disponible en cualquier computadora.</Alert>
            <Box>
              <Typography variant="subtitle2">Widgets ocultos</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Recupera cualquier widget que hayas cerrado con la X.</Typography>
              {!hiddenAllowedWidgets.length ? (
                <Typography variant="body2" color="text.secondary">No tienes widgets ocultos.</Typography>
              ) : (
                <Stack spacing={1}>
                  {hiddenAllowedWidgets.map((widget) => (
                    <Paper key={widget.id} variant="outlined" sx={{ p: 1.25 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                        <Box><Typography variant="body2" fontWeight={700}>{widget.title}</Typography><Typography variant="caption" color="text.secondary">{widget.description}</Typography></Box>
                        <Button size="small" startIcon={<AddCircleOutlineOutlined />} onClick={() => showWidget(widget.id)}>Agregar</Button>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button startIcon={<RestartAltOutlined />} onClick={restoreDefaultWidgets}>Restaurar predeterminado</Button>
          <Button onClick={() => setCustomizeOpen(false)}>Cerrar</Button>
          <Button
            variant="contained"
            startIcon={<SaveOutlined />}
            disabled={!widgetPreferencesReady || widgetPreferencesSaving}
            onClick={() => void saveWidgetPreferences().then((saved) => { if (saved) setCustomizeOpen(false); })}
          >
            {widgetPreferencesSaving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      {backendResumen && (
        <Paper variant="outlined" sx={{ display: "none", p: 1.5, mb: 2, borderRadius: 1, bgcolor: "background.paper" }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between">
            <Stack spacing={0.25}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Resumen calculado por servidor
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Menos carga en el navegador y consultas agregadas en MySQL para el rango seleccionado.
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent={{ xs: "flex-start", md: "flex-end" }}>
              <Chip size="small" label={`Ventas ${formatCurrency(backendResumen.ventas?.totalRango || 0)}`} />
              <Chip size="small" label={`Pedidos abiertos ${backendResumen.pedidos?.abiertos || 0}`} />
              <Chip size="small" label={`Saldo ${formatCurrency(backendResumen.pedidos?.saldoPendiente || 0)}`} />
              <Chip size="small" label={`Stock bajo ${backendResumen.inventario?.bajoMinimo || 0}`} />
            </Stack>
          </Stack>
        </Paper>
      )}

      <Paper
        variant="outlined"
        onClick={() => setMetaModalOpen(true)}
        sx={{
          display: "none",
          p: 2,
          mb: 2,
          borderRadius: 1,
          cursor: "pointer",
          transition: "border-color 120ms ease, box-shadow 120ms ease",
          "&:hover": { borderColor: "primary.main", boxShadow: 2 },
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 1.5 }}>
          <Stack spacing={0.5}>
            <Typography variant="h6">Meta mensual</Typography>
            <Typography variant="body2" color="text.secondary">
              Acumulado desde reportes diarios segun el vendedor y tienda seleccionados.
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent={{ xs: "flex-start", md: "flex-end" }}>
            <Chip label={stats.metaMensual.sourceLabel} color={stats.metaMensual.metaMes > 0 ? "primary" : "warning"} />
            <Chip variant="outlined" label={`${stats.metaMensual.reportesDiariosMes} reporte(s) diarios`} />
          </Stack>
        </Stack>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="caption" color="text.secondary">Meta mes</Typography>
            <Typography variant="h5" fontWeight={700}>{formatCurrency(stats.metaMensual.metaMes)}</Typography>
            <Typography variant="caption" color="text.secondary">
              Promedio diario: {formatCurrency(stats.metaMensual.promedioDiario)}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="caption" color="text.secondary">Acumulado reportes diarios</Typography>
            <Typography variant="h5" fontWeight={700}>{formatCurrency(stats.metaMensual.acumuladoReportesDiarios)}</Typography>
            <Typography variant="caption" color={stats.metaMensual.excedenteMeta > 0 ? "success.main" : "text.secondary"}>
              {stats.metaMensual.excedenteMeta > 0
                ? `Sobre meta: ${formatCurrency(stats.metaMensual.excedenteMeta)}`
                : `Restante: ${formatCurrency(stats.metaMensual.restanteMeta)}`}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
              <Typography variant="caption" color="text.secondary">Avance</Typography>
              <Typography variant="caption" fontWeight={700}>{stats.metaMensual.avanceMeta.toFixed(2)}%</Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={stats.metaMensual.avanceMeta}
              color={stats.metaMensual.metaMes <= 0 ? "warning" : stats.metaMensual.avanceMeta >= 100 ? "success" : "primary"}
              sx={{ height: 10, borderRadius: 1 }}
            />
            {stats.metaMensual.metaMes <= 0 && (
              <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.75 }}>
                Configura una meta mensual para ver el avance real.
              </Typography>
            )}
          </Grid>
        </Grid>
      </Paper>

      <Dialog open={metaModalOpen} onClose={() => setMetaModalOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Proyeccion de meta mensual</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Avance calculado desde los reportes diarios registrados del mes actual.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Dia {stats.metaMensual.currentDay} de {stats.metaMensual.daysInMonth} | {stats.metaMensual.sourceLabel}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip color={stats.metaMensual.avanceMeta >= 100 ? "success" : "primary"} label={`Avance ${stats.metaMensual.avanceMeta.toFixed(2)}%`} />
                <Chip variant="outlined" label={`${stats.metaMensual.diasConReporte} dia(s) con reporte`} />
              </Stack>
            </Stack>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}>
                <MetricCard
                  title="Meta mensual"
                  value={formatCurrency(stats.metaMensual.metaMes)}
                  helper={`Meta diaria: ${formatCurrency(stats.metaMensual.metaDiariaObjetivo)}`}
                  icon={<TrendingUpIcon />}
                  tone="primary"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <MetricCard
                  title="Acumulado real"
                  value={formatCurrency(stats.metaMensual.acumuladoReportesDiarios)}
                  helper={`${stats.metaMensual.reportesDiariosMes} reporte(s) diario(s)`}
                  icon={<ReceiptLongOutlined />}
                  tone="success"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <MetricCard
                  title="Venta necesaria diaria"
                  value={formatCurrency(stats.metaMensual.ventaNecesariaDiaria)}
                  helper={`${stats.metaMensual.diasRestantesCaptura} dia(s) restantes`}
                  icon={<PaymentsOutlined />}
                  tone={stats.metaMensual.ventaNecesariaDiaria <= stats.metaMensual.metaDiariaObjetivo ? "success" : "warning"}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <MetricCard
                  title="Proyeccion de cierre"
                  value={formatCurrency(stats.metaMensual.proyeccionCierre)}
                  helper={
                    stats.metaMensual.metaMes > 0
                      ? stats.metaMensual.diferenciaProyectada >= 0
                        ? `Sobre meta: ${formatCurrency(stats.metaMensual.diferenciaProyectada)}`
                        : `Faltante proyectado: ${formatCurrency(Math.abs(stats.metaMensual.diferenciaProyectada))}`
                      : "Configura una meta mensual"
                  }
                  icon={<TrendingUpIcon />}
                  tone={stats.metaMensual.diferenciaProyectada >= 0 ? "success" : "error"}
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2, height: "100%", borderRadius: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">Promedio por dia calendario</Typography>
                  <Typography variant="h5" fontWeight={700}>{formatCurrency(stats.metaMensual.promedioCalendario)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Cumplimiento contra meta diaria: {stats.metaMensual.cumplimientoPromedio.toFixed(2)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(stats.metaMensual.cumplimientoPromedio, 100)}
                    color={stats.metaMensual.cumplimientoPromedio >= 100 ? "success" : "primary"}
                    sx={{ height: 9, borderRadius: 1, mt: 1.25 }}
                  />
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2, height: "100%", borderRadius: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">Promedio de dias reportados</Typography>
                  <Typography variant="h5" fontWeight={700}>{formatCurrency(stats.metaMensual.promedioReportado)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Mide solo los dias que tienen reporte diario generado.
                  </Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2, height: "100%", borderRadius: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">Restante real</Typography>
                  <Typography variant="h5" fontWeight={700}>{formatCurrency(stats.metaMensual.restanteMeta)}</Typography>
                  <Typography variant="caption" color={stats.metaMensual.excedenteMeta > 0 ? "success.main" : "text.secondary"}>
                    {stats.metaMensual.excedenteMeta > 0
                      ? `Ya va arriba por ${formatCurrency(stats.metaMensual.excedenteMeta)}`
                      : "Se reparte entre los dias restantes de captura."}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
                <Box>
                  <Typography variant="h6">Tendencia diaria</Typography>
                  <Typography variant="body2" color="text.secondary">
                    La linea azul muestra ventas registradas por reporte diario; la linea roja marca la meta diaria esperada.
                  </Typography>
                </Box>
                <Chip variant="outlined" label={`Objetivo diario ${formatCurrency(stats.metaMensual.metaDiariaObjetivo)}`} />
              </Stack>
              <MiniLineChart data={stats.metaMensual.lineMeta} target={stats.metaMensual.metaDiariaObjetivo} />
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1} sx={{ mb: 1.5 }}>
                <Box>
                  <Typography variant="h6">Linea de tiempo del mes</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Cada barra representa un dia del mes. El borde amarillo marca hoy.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Chip size="small" color="success" label="Cumple meta diaria" />
                  <Chip size="small" color="primary" label="Con reporte" />
                </Stack>
              </Stack>
              <MetaTimeline
                data={stats.metaMensual.timelineMeta}
                target={stats.metaMensual.metaDiariaObjetivo}
                today={stats.metaMensual.currentDay}
              />
            </Paper>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 2, height: "100%", borderRadius: 1 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>Mejores dias registrados</Typography>
                  {!stats.metaMensual.mejoresDiasMeta.length ? (
                    <Typography variant="body2" color="text.secondary">Aun no hay reportes diarios este mes.</Typography>
                  ) : (
                    <List dense disablePadding>
                      {stats.metaMensual.mejoresDiasMeta.map((item, index) => (
                        <ListItem key={item.day} disableGutters>
                          <ListItemText
                            primary={`#${index + 1} | Dia ${item.day}`}
                            secondary={formatCurrency(item.value)}
                          />
                          <Chip
                            size="small"
                            color={item.value >= stats.metaMensual.metaDiariaObjetivo ? "success" : "default"}
                            label={item.value >= stats.metaMensual.metaDiariaObjetivo ? "Arriba" : "Bajo meta"}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 2, height: "100%", borderRadius: 1 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>Lectura rapida</Typography>
                  <List dense disablePadding>
                    <ListItem disableGutters>
                      <ListItemText
                        primary="Ritmo actual"
                        secondary={
                          stats.metaMensual.diferenciaProyectada >= 0
                            ? "Si mantiene este promedio, llegaria o superaria la meta."
                            : "Con el promedio actual, no alcanzaria la meta mensual."
                        }
                      />
                    </ListItem>
                    <ListItem disableGutters>
                      <ListItemText
                        primary="Ajuste diario recomendado"
                        secondary={`Vender ${formatCurrency(stats.metaMensual.ventaNecesariaDiaria)} por dia restante.`}
                      />
                    </ListItem>
                    <ListItem disableGutters>
                      <ListItemText
                        primary="Control de reportes"
                        secondary={`${stats.metaMensual.diasConReporte} dia(s) tienen reporte; los dias sin reporte aparecen apagados en la linea de tiempo.`}
                      />
                    </ListItem>
                  </List>
                </Paper>
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
      </Dialog>

      <Grid container spacing={2} sx={{ display: "none", mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            title={`Ventas ultimos ${rango} dias`}
            value={formatCurrency(stats.totalVentasRango)}
            helper={`Hoy: ${formatCurrency(stats.totalVentasHoy)} | Tickets: ${stats.ticketsHoy}`}
            icon={<TrendingUpIcon />}
            tone="success"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            title="Pedidos en produccion"
            value={stats.pedidosProduccion.length}
            helper={`${stats.pedidosSinCobro.length} ligados a cambio/devolucion sin cobro`}
            icon={<PlaylistAddCheckOutlined />}
            tone="primary"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            title="Saldo pendiente"
            value={formatCurrency(stats.saldoPendiente)}
            helper={`${stats.pedidosSaldo.length} pedidos con saldo`}
            icon={<PaymentsOutlined />}
            tone="warning"
            onClick={() => setSaldoModalOpen(true)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            title="Postventa abierta"
            value={stats.postventaAbierta.length}
            helper="Cambios/devoluciones pendientes o en revision"
            icon={<ChangeCircleOutlined />}
            tone="info"
          />
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ display: "none", p: 2, mb: 2, borderRadius: 1 }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1} sx={{ mb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <ReceiptLongOutlined color="primary" />
            <Box>
              <Typography variant="h6">Top 3 ventas del dia anterior</Typography>
              <Typography variant="body2" color="text.secondary">
                Ranking general basado en el total del cierre diario del {stats.diaAnterior ? new Date(`${stats.diaAnterior}T00:00:00`).toLocaleDateString("es-GT") : "dia anterior"}.
              </Typography>
            </Box>
          </Stack>
          <Button size="small" endIcon={<OpenInNewOutlined />} onClick={() => navigate("/reportes/reporte-diario")}>
            Ver cierres
          </Button>
        </Stack>
        <Divider sx={{ mb: 1 }} />
        {stats.topCierresDiaAnterior.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No hay cierres diarios del dia anterior para mostrar el ranking.
          </Typography>
        ) : (
          <Grid container spacing={1}>
            {stats.topCierresDiaAnterior.map((cierre, index) => (
              <Grid key={cierre.id} size={{ xs: 12, md: 4 }}>
                <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1, height: "100%" }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">#{index + 1} | {cierre.correlativo}</Typography>
                      <Typography variant="h6" sx={{ mt: 0.25 }}>{formatCurrency(cierre.total)}</Typography>
                    </Box>
                    <Chip size="small" color={index === 0 ? "success" : "default"} label={index === 0 ? "Mayor" : "Top"} />
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 0.75 }}>{cierre.vendedor}</Typography>
                  <Typography variant="caption" color="text.secondary">{cierre.tienda}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      <Dialog open={saldoModalOpen} onClose={() => setSaldoModalOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Pedidos que suman el saldo pendiente</DialogTitle>
        <DialogContent dividers>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {stats.pedidosSaldo.length} pedido(s) con saldo en la tienda seleccionada.
            </Typography>
            <Chip color="warning" label={`Total: ${formatCurrency(stats.saldoPendiente)}`} />
          </Stack>
          {!stats.pedidosSaldo.length ? (
            <Typography color="text.secondary">No hay pedidos con saldo pendiente para este filtro.</Typography>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Folio</TableCell>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Cliente</TableCell>
                    <TableCell>Tienda</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Anticipo</TableCell>
                    <TableCell align="right">Saldo</TableCell>
                    <TableCell align="right">Accion</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pedidosSaldoPaginados.map((pedido) => (
                    <TableRow key={pedido.id} hover>
                      <TableCell>{getPedidoFolio(pedido)}</TableCell>
                      <TableCell>{pedido.fecha ? new Date(pedido.fecha).toLocaleDateString() : "N/D"}</TableCell>
                      <TableCell>{getPedidoCliente(pedido)}</TableCell>
                      <TableCell>{pedido.bodega?.nombre || "N/D"}</TableCell>
                      <TableCell>
                        <Chip size="small" label={estadoLabel(pedido.estado)} />
                      </TableCell>
                      <TableCell align="right">{formatCurrency(pedido.totalEstimado)}</TableCell>
                      <TableCell align="right">{formatCurrency(pedido.anticipo)}</TableCell>
                      <TableCell align="right">
                        <Typography component="span" fontWeight={700}>
                          {formatCurrency(pedido.saldoPendiente)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          endIcon={<OpenInNewOutlined fontSize="small" />}
                          onClick={() => navigate(`/produccion/${pedido.id}`)}
                        >
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination {...pedidosSaldoPaginationProps} />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {whatsappFeatureEnabled && <Paper variant="outlined" sx={{ display: "none", p: 2, mb: 2, borderRadius: 1 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={1.5} sx={{ mb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <WhatsAppIcon color="success" />
            <Box>
              <Typography variant="h6">Mensajes WhatsApp Business</Typography>
              <Typography variant="body2" color="text.secondary">
                {canManageWhatsapp ? "Resumen de mensajes nuevos por vendedor." : "Mensajes nuevos recibidos en tu numero asignado."}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip color="success" label={`${whatsappResumen?.totalNuevos || 0} nuevos`} />
            <Chip variant="outlined" label={`${whatsappResumen?.totalHoy || 0} hoy`} />
          </Stack>
        </Stack>
        <Divider sx={{ mb: 1 }} />
        {!whatsappResumen?.usuarios?.length ? (
          <Typography variant="body2" color="text.secondary">
            Aun no hay numeros con mensajes registrados. Cuando se conecte el webhook de WhatsApp Business, apareceran aqui.
          </Typography>
        ) : (
          <Grid container spacing={1}>
            {whatsappResumen.usuarios.map((item) => (
              <Grid key={item.usuarioId} size={{ xs: 12, md: canManageWhatsapp ? 6 : 12, lg: canManageWhatsapp ? 4 : 12 }}>
                <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1, height: "100%" }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box>
                      <Typography variant="subtitle2">{item.nombre || item.usuario}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.telefono || "Sin numero asignado"}
                      </Typography>
                    </Box>
                    <Chip size="small" color={item.totalNuevos ? "success" : "default"} label={`${item.totalNuevos} nuevos`} />
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {item.ultimoMensaje?.mensaje || "Sin mensajes recientes"}
                  </Typography>
                  {item.ultimoMensaje && (
                    <Typography variant="caption" color="text.secondary">
                      {item.ultimoMensaje.remitenteNombre || item.ultimoMensaje.remitente} | {new Date(item.ultimoMensaje.recibidoEn).toLocaleString()}
                    </Typography>
                  )}
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {item.totalHoy} recibido(s) hoy
                    </Typography>
                    <Button size="small" disabled={!item.totalNuevos} onClick={() => marcarWhatsappLeidos(item.usuarioId)}>
                      Marcar leidos
                    </Button>
                  </Stack>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>}

      <Grid container spacing={2} sx={{ display: "none" }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%", borderRadius: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6">Ventas por dia</Typography>
              <Chip size="small" label={`${rango} dias`} />
            </Stack>
            <Divider sx={{ mb: 2 }} />
            <MiniBars data={stats.ventasPorDia} />
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%", borderRadius: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <AssignmentOutlined color="primary" />
              <Typography variant="h6">Pendientes para atender</Typography>
            </Stack>
            <Divider sx={{ mb: 1 }} />
            {stats.actividad.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No hay pendientes urgentes.</Typography>
            ) : (
              <List dense disablePadding>
                {stats.actividad.map((item) => (
                  <ListItem
                    key={item.key}
                    disableGutters
                    secondaryAction={
                      <Button size="small" endIcon={<OpenInNewOutlined />} onClick={() => navigate(item.path)}>
                        {item.action}
                      </Button>
                    }
                  >
                    <ListItemText primary={item.title} secondary={item.detail} sx={{ pr: 9 }} />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%", minHeight: 300, borderRadius: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <WarningAmberIcon color="warning" />
              <Typography variant="h6">Stock bajo</Typography>
            </Stack>
            <Divider sx={{ mb: 1 }} />
            {stats.bajosStock.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No hay productos por debajo del stock maximo.</Typography>
            ) : (
              <List dense disablePadding>
                {stats.bajosStock.map((row) => {
                  const percent = Math.max(0, Math.min((Number(row.stock || 0) / Number(row.stockMax || 1)) * 100, 100));
                  return (
                    <ListItem key={`${row.productoId}-${row.bodegaId}`} disableGutters>
                      <ListItemText
                        primary={`${row.codigo} - ${row.producto}`}
                        secondary={`${row.bodega} | ${row.stock}/${row.stockMax}`}
                      />
                      <Box sx={{ width: 90, ml: 1 }}>
                        <LinearProgress variant="determinate" value={percent} color={percent < 35 ? "error" : "warning"} />
                      </Box>
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%", minHeight: 300, borderRadius: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <ReceiptLongOutlined color="secondary" />
              <Typography variant="h6">Reportes recientes</Typography>
            </Stack>
            <Divider sx={{ mb: 1 }} />
            {stats.reportesRecientes.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Aun no hay reportes generados.</Typography>
            ) : (
              <List dense disablePadding>
                {stats.reportesRecientes.map((doc) => (
                  <ListItem key={doc.id} disableGutters>
                    <ListItemText
                      primary={doc.correlativo}
                      secondary={`${doc.tipo === "reporteQuincenal" ? "Reporte quincenal" : "Reporte diario"} | ${new Date(doc.creadoEn).toLocaleString()}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%", minHeight: 300, borderRadius: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <InventoryIcon color="primary" />
              <Typography variant="h6">Resumen inventario</Typography>
            </Stack>
            <Divider sx={{ mb: 1 }} />
            <Stack spacing={1.5}>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Stock total</Typography>
                <Typography sx={{ fontWeight: 700 }}>{stats.stockTotal}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Productos catalogo</Typography>
                <Typography sx={{ fontWeight: 700 }}>{stats.productosActivos}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Productos bajos</Typography>
                <Typography sx={{ fontWeight: 700 }}>{stats.bajosStock.length}</Typography>
              </Stack>
              <Button variant="outlined" endIcon={<OpenInNewOutlined />} onClick={() => navigate("/inventario/resumen")}>
                Ver inventario
              </Button>
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6">Ventas mas altas del rango</Typography>
              <Button size="small" endIcon={<OpenInNewOutlined />} onClick={() => navigate("/ventas")}>Ver ventas</Button>
            </Stack>
            <Divider sx={{ mb: 1 }} />
            {stats.topVentas.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No hay ventas en el rango seleccionado.</Typography>
            ) : (
              <Grid container spacing={1}>
                {stats.topVentas.map((venta) => (
                  <Grid key={venta.id} size={{ xs: 12, md: 6, lg: 2.4 }}>
                    <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                      <Typography variant="subtitle2">V-{venta.id}</Typography>
                      <Typography variant="h6">{formatCurrency(venta.total)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(venta.fecha).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
