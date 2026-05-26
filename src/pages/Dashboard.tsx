import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
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
  Typography,
} from "@mui/material";
import AssignmentOutlined from "@mui/icons-material/AssignmentOutlined";
import ChangeCircleOutlined from "@mui/icons-material/ChangeCircleOutlined";
import InventoryIcon from "@mui/icons-material/Inventory";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import PlaylistAddCheckOutlined from "@mui/icons-material/PlaylistAddCheckOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
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

const metodoCuentaComoTarjeta = (metodo?: string | null) => {
  const normalized = `${metodo || ""}`.trim().toLowerCase();
  return normalized === "tarjeta" || normalized === "visalink";
};

const getTiendaRowTotal = (row: any) =>
  Number(row?.total || 0) ||
  Number(row?.transferencia || 0) + Number(row?.tarjeta || 0) + Number(row?.efectivo || 0);

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
  const tiendaRows = [...ventasSnapshotRows, ...asArray(data?.tiendaManualRows)];
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

const getDocumentoFechaReporte = (doc: DocumentoRow) => `${doc?.data?.fecha || doc.creadoEn || ""}`.slice(0, 10);

const getDocumentoVendedor = (doc: DocumentoRow) =>
  doc.usuario?.nombre ||
  doc.usuario?.usuario ||
  doc.data?.vendedorNombre ||
  doc.data?.usuarioNombre ||
  doc.data?.vendedor ||
  doc.data?.usuario ||
  doc.data?.generadoPor ||
  "N/D";

const getDocumentoTienda = (doc: DocumentoRow) =>
  doc.data?.tienda || doc.data?.bodegaNombre || doc.data?.bodega || "N/D";

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
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <Box component="svg" viewBox={`0 0 ${width} ${height}`} sx={{ width: "100%", minWidth: 520, display: "block" }}>
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

export default function Dashboard() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [pedidos, setPedidos] = useState<PedidoProduccion[]>([]);
  const [postventa, setPostventa] = useState<PostventaRow[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoRow[]>([]);
  const [reportesDiariosUsuario, setReportesDiariosUsuario] = useState<DocumentoRow[]>([]);
  const [metaMensual, setMetaMensual] = useState<MetaMensualResumen>({ metaMes: 0, promedioDiario: 0, source: "none" });
  const [inventario, setInventario] = useState<InventarioRow[]>([]);
  const [productos, setProductos] = useState<ProductoResumen[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([]);
  const [whatsappResumen, setWhatsappResumen] = useState<WhatsappResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [rango, setRango] = useState<"7" | "30" | "90">("30");
  const [bodegaFiltro, setBodegaFiltro] = useState<"all" | number>("all");
  const [vendedorFiltro, setVendedorFiltro] = useState<"all" | number>("all");
  const [saldoModalOpen, setSaldoModalOpen] = useState(false);
  const [metaModalOpen, setMetaModalOpen] = useState(false);
  const navigate = useNavigate();
  const { rol, permisos, bodegaId: userBodegaId, id: userId, nombre: userNombre, usuario: userUsuario } = useAuthStore();
  const { fetchConfig } = useSystemConfigStore();
  const canAccessAllBodegas =
    hasPermission(rol, permisos, "sistema.multi-tienda") || hasPermission(rol, permisos, "dashboard.filtro-tienda");
  const canFilterVendedores =
    hasPermission(rol, permisos, "sistema.selector-vendedores") || hasPermission(rol, permisos, "dashboard.filtro-vendedor");
  const canViewDashboardAll = hasPermission(rol, permisos, "dashboard.ver-todo");
  const canManageWhatsapp = rol === "ADMIN";

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
    const load = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
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

        const [
          respVentas,
          respPedidos,
          respPostventa,
          respDocumentos,
          respReportesDiarios,
          respMeta,
          respInv,
          respProd,
          respBod,
          respUsuarios,
          respWhatsapp,
        ] = await Promise.all([
          api.get("/ventas").catch(() => ({ data: [] })),
          api.get("/produccion").catch(() => ({ data: [] })),
          api.get("/postventa", { params: postventaParams }).catch(() => ({ data: [] })),
          api.get("/documentos").catch(() => ({ data: [] })),
          api.get("/documentos", { params: reportesParams }).catch(() => ({ data: [] })),
          api
            .get("/metas/mensuales/actual", {
              params: metaParams,
            })
            .catch(() => ({ data: { metaMes: 0, promedioDiario: 0, source: "none" } })),
          api.get("/inventario/reporte").catch(() => ({ data: [] })),
          api.get("/productos").catch(() => ({ data: [] })),
          api.get("/bodegas").catch(() => ({ data: [] })),
          api.get("/usuarios").catch(() => ({ data: [] })),
          whatsappFeatureEnabled ? api.get("/whatsapp/resumen").catch(() => ({ data: null })) : Promise.resolve({ data: null }),
        ]);
        setVentas(respVentas.data || []);
        setPedidos(respPedidos.data || []);
        setPostventa(respPostventa.data || []);
        setDocumentos(respDocumentos.data || []);
        setReportesDiariosUsuario(respReportesDiarios.data || []);
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
        setLoadError("No se pudieron cargar todos los datos del dashboard.");
      } finally {
        setLoading(false);
      }
    };
    void load();
    void fetchConfig();
  }, [bodegaFiltro, canViewDashboardAll, cargarWhatsapp, fetchConfig, userBodegaId, userId, vendedorFiltro]);

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

    const estadosAbiertos = new Set(["nuevo", "en_produccion", "pendiente", "regresado_produccion"]);
    const pedidosProduccion = pedidosFiltrados.filter((pedido) =>
      estadosAbiertos.has(`${pedido.estado || ""}`.trim().toLowerCase())
    );
    const estadosSinSaldo = new Set(["anulado", "recibido", "completado"]);
    const pedidosSaldo = pedidosFiltrados.filter((pedido) => {
      const estado = `${pedido.estado || ""}`.trim().toLowerCase();
      return !estadosSinSaldo.has(estado) && Number(pedido.saldoPendiente || 0) > 0;
    });
    const pedidosSaldoOrdenados = pedidosSaldo
      .slice()
      .sort((a, b) => Number(b.saldoPendiente || 0) - Number(a.saldoPendiente || 0));
    const saldoPendiente = pedidosSaldoOrdenados.reduce((sum, pedido) => sum + Number(pedido.saldoPendiente || 0), 0);
    const pedidosSinCobro = pedidosFiltrados.filter((pedido) => pedido.postventaCobro === "sin_cobro");

    const postventaAbierta = postventa.filter(
      (row) =>
        ["pendiente", "en_revision"].includes(`${row.estado || ""}`.trim().toLowerCase()) &&
        filtraVendedor([row.usuarioId, row.usuario?.id, row.usuario?.nombre, row.usuario?.usuario]),
    );

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

    const topCierresDiaAnterior = reportesDiariosUsuario
      .filter(
        (doc) =>
          doc.tipo === "reporteDiario" &&
          getDocumentoFechaReporte(doc) === diaAnterior,
      )
      .map((doc) => ({
        id: doc.id,
        correlativo: doc.correlativo,
        vendedor: getDocumentoVendedor(doc),
        tienda: getDocumentoTienda(doc),
        fecha: getDocumentoFechaReporte(doc),
        total: getReporteDiarioTotal(doc.data || {}),
      }))
      .sort((a, b) => Number(b.total || 0) - Number(a.total || 0))
      .slice(0, 3);

    const bajosStock = inventarioFiltrado
      .filter((row) => Number(row.stockMax || 0) > 0 && Number(row.stock || 0) < Number(row.stockMax || 0))
      .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0))
      .slice(0, 6);

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
      pedidosProduccion,
      pedidosSaldo: pedidosSaldoOrdenados,
      saldoPendiente,
      pedidosSinCobro,
      postventaAbierta,
      reportesRecientes,
      topCierresDiaAnterior,
      diaAnterior,
      bajosStock,
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

  return (
    <Box sx={{ p: 3, minHeight: "100%", bgcolor: "background.default" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={2} sx={{ mb: 2 }}>
        <Stack spacing={0.5}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Dashboard operativo</Typography>
          <Typography variant="body2" color="text.secondary">
            Ventas, produccion, postventa, saldos y stock en una sola vista.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
          <FormControl size="small" sx={{ minWidth: 220 }} disabled={!canFilterVendedores}>
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
          <FormControl size="small" sx={{ minWidth: 190 }} disabled={!canAccessAllBodegas}>
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

      <Paper
        variant="outlined"
        onClick={() => setMetaModalOpen(true)}
        sx={{
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

      <Grid container spacing={2} sx={{ mb: 2 }}>
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

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 1 }}>
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

      {whatsappFeatureEnabled && <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 1 }}>
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

      <Grid container spacing={2}>
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
