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

interface Venta {
  id: number;
  fecha: string;
  total: number;
  bodegaId?: number | null;
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
}

interface DocumentoRow {
  id: number;
  tipo: string;
  correlativo: string;
  titulo?: string | null;
  creadoEn: string;
  usuario?: { nombre?: string | null; usuario?: string | null } | null;
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

const formatCurrency = (value: number) => `Q ${Number(value || 0).toFixed(2)}`;

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
  const [inventario, setInventario] = useState<InventarioRow[]>([]);
  const [productos, setProductos] = useState<ProductoResumen[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [whatsappResumen, setWhatsappResumen] = useState<WhatsappResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [rango, setRango] = useState<"7" | "30" | "90">("30");
  const [bodegaFiltro, setBodegaFiltro] = useState<"all" | number>("all");
  const [saldoModalOpen, setSaldoModalOpen] = useState(false);
  const navigate = useNavigate();
  const { rol, permisos, bodegaId: userBodegaId } = useAuthStore();
  const { fetchConfig } = useSystemConfigStore();
  const canAccessAllBodegas = hasPermission(rol, permisos, "sistema.multi-tienda");
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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const [respVentas, respPedidos, respPostventa, respDocumentos, respInv, respProd, respBod, respWhatsapp] = await Promise.all([
          api.get("/ventas").catch(() => ({ data: [] })),
          api.get("/produccion").catch(() => ({ data: [] })),
          api.get("/postventa").catch(() => ({ data: [] })),
          api.get("/documentos").catch(() => ({ data: [] })),
          api.get("/inventario/reporte").catch(() => ({ data: [] })),
          api.get("/productos").catch(() => ({ data: [] })),
          api.get("/bodegas").catch(() => ({ data: [] })),
          whatsappFeatureEnabled ? api.get("/whatsapp/resumen").catch(() => ({ data: null })) : Promise.resolve({ data: null }),
        ]);
        setVentas(respVentas.data || []);
        setPedidos(respPedidos.data || []);
        setPostventa(respPostventa.data || []);
        setDocumentos(respDocumentos.data || []);
        setInventario(respInv.data || []);
        setProductos(respProd.data || []);
        setBodegas(respBod.data || []);
        setWhatsappResumen(respWhatsapp.data || null);
      } catch (error) {
        setLoadError("No se pudieron cargar todos los datos del dashboard.");
      } finally {
        setLoading(false);
      }
    };
    void load();
    void fetchConfig();
  }, [cargarWhatsapp, fetchConfig]);

  const marcarWhatsappLeidos = async (vendedorId?: number) => {
    if (!whatsappFeatureEnabled) return;
    await api.patch("/whatsapp/mensajes/leidos", { vendedorId });
    await cargarWhatsapp();
  };

  useEffect(() => {
    if (!canAccessAllBodegas) {
      const parsed = Number(userBodegaId);
      setBodegaFiltro(Number.isFinite(parsed) && parsed > 0 ? parsed : "all");
      return;
    }
    setBodegaFiltro("all");
  }, [canAccessAllBodegas, userBodegaId]);

  const stats = useMemo(() => {
    const hoy = toDateOnly(new Date());
    const desde = new Date();
    desde.setDate(desde.getDate() - Number(rango) + 1);
    desde.setHours(0, 0, 0, 0);

    const filtraBodega = (bodegaId?: number | null) =>
      bodegaFiltro === "all" ? true : Number(bodegaId) === Number(bodegaFiltro);

    const ventasFiltradas = ventas.filter((venta) => filtraBodega(venta.bodegaId));
    const ventasRango = ventasFiltradas.filter((venta) => new Date(venta.fecha) >= desde);
    const ventasHoy = ventasFiltradas.filter((venta) => toDateOnly(venta.fecha) === hoy);
    const pedidosFiltrados = pedidos.filter((pedido) => filtraBodega(pedido.bodegaId));
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

    const postventaAbierta = postventa.filter((row) =>
      ["pendiente", "en_revision"].includes(`${row.estado || ""}`.trim().toLowerCase())
    );

    const reportesRecientes = documentos
      .filter((doc) => ["reporteDiario", "reporteQuincenal"].includes(doc.tipo))
      .slice()
      .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime())
      .slice(0, 5);

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
      bajosStock,
      ventasPorDia: Array.from(ventasPorDia.entries()).map(([date, value]) => ({
        label: date.slice(5).replace("-", "/"),
        value,
      })),
      topVentas,
      actividad,
      productosActivos: productos.length,
      stockTotal: inventarioFiltrado.reduce((sum, row) => sum + Number(row.stock || 0), 0),
    };
  }, [ventas, pedidos, postventa, documentos, inventario, productos, rango, bodegaFiltro]);
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
          <FormControl size="small" sx={{ minWidth: 190 }} disabled={!canAccessAllBodegas}>
            <InputLabel>Tienda</InputLabel>
            <Select
              label="Tienda"
              value={bodegaFiltro === "all" ? "all" : String(bodegaFiltro)}
              onChange={(event) => setBodegaFiltro(event.target.value === "all" ? "all" : Number(event.target.value))}
            >
              <MenuItem value="all">Todas</MenuItem>
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
