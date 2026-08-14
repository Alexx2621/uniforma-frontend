import { useCallback, useEffect, useMemo, useReducer } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AssessmentOutlined from "@mui/icons-material/AssessmentOutlined";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
import TrendingDownOutlined from "@mui/icons-material/TrendingDownOutlined";
import TrendingUpOutlined from "@mui/icons-material/TrendingUpOutlined";
import WarningAmberOutlined from "@mui/icons-material/WarningAmberOutlined";
import Swal from "sweetalert2";
import { api } from "../../api/axios";
import UniformaTableLoadingRow from "../../components/UniformaTableLoadingRow";
import { useTablePagination } from "../../utils/useTablePagination";
import { formatCurrency } from "../../utils/currency";

interface Bodega {
  id: number;
  nombre: string;
}

interface Venta {
  id: number;
  fecha: string;
  total: number;
  metodoPago?: string | null;
  vendedor?: string | null;
  bodegaId?: number | null;
  bodega?: { id?: number; nombre?: string | null } | null;
  cliente?: { nombre?: string | null } | null;
}

interface Pedido {
  id: number;
  fecha: string;
  estado: string;
  totalEstimado: number;
  anticipo?: number | null;
  saldoPendiente: number;
  bodegaId?: number | null;
  bodega?: { id?: number; nombre?: string | null } | null;
  cliente?: { nombre?: string | null } | null;
  clienteNombre?: string | null;
  folio?: string | null;
  displayFolio?: string | null;
}

interface DocumentoRow {
  id: number;
  tipo: string;
  correlativo: string;
  titulo?: string | null;
  data?: any;
  creadoEn: string;
  usuario?: { nombre?: string | null; usuario?: string | null; bodegaId?: number | null } | null;
}

interface Inventario {
  bodegaId: number;
  stock: number;
  stockMax: number;
}

interface TiendaRow {
  bodegaId: number;
  bodega: string;
  ventasTotal: number;
  ventasTickets: number;
  ticketPromedio: number;
  pedidosTotal: number;
  pedidosCantidad: number;
  pedidosAbiertos: number;
  saldoPendiente: number;
  cierresTotal: number;
  cierresCantidad: number;
  diferenciaVentaCierre: number;
  stockTotal: number;
  stockBajo: number;
  participacionVentas: number;
  productividad: number;
}

interface VentaRanking {
  id: number;
  fecha: string;
  tienda: string;
  cliente: string;
  vendedor: string;
  metodoPago: string;
  total: number;
}

interface ComparativoState {
  bodegas: Bodega[];
  ventas: Venta[];
  pedidos: Pedido[];
  documentos: DocumentoRow[];
  inventario: Inventario[];
  desde: string;
  hasta: string;
  bodegaIds: number[];
  loading: boolean;
}

type ComparativoAction =
  | { type: "loading"; value: boolean }
  | {
      type: "loaded";
      bodegas: Bodega[];
      ventas: Venta[];
      pedidos: Pedido[];
      documentos: DocumentoRow[];
      inventario: Inventario[];
    }
  | { type: "desde"; value: string }
  | { type: "hasta"; value: string }
  | { type: "bodegaIds"; value: number[] };

const money = formatCurrency;

const today = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const createInitialState = (): ComparativoState => ({
  bodegas: [],
  ventas: [],
  pedidos: [],
  documentos: [],
  inventario: [],
  desde: daysAgo(30),
  hasta: today(),
  bodegaIds: [],
  loading: false,
});

const comparativoReducer = (state: ComparativoState, action: ComparativoAction): ComparativoState => {
  switch (action.type) {
    case "loading":
      return { ...state, loading: action.value };
    case "loaded":
      return {
        ...state,
        bodegas: action.bodegas,
        ventas: action.ventas,
        pedidos: action.pedidos,
        documentos: action.documentos,
        inventario: action.inventario,
        bodegaIds: state.bodegaIds.length ? state.bodegaIds : action.bodegas.map((bodega) => Number(bodega.id)),
      };
    case "desde":
      return { ...state, desde: action.value };
    case "hasta":
      return { ...state, hasta: action.value };
    case "bodegaIds":
      return { ...state, bodegaIds: action.value };
    default:
      return state;
  }
};

const toDateOnly = (value?: string | null) => {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const normalizeText = (value?: string | null) =>
  `${value || ""}`
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);

const getTiendaRowTotal = (row: any) =>
  Number(row?.total || 0) ||
  Number(row?.transferencia || 0) +
    Number(row?.deposito || 0) +
    Number(row?.tarjeta || 0) +
    Number(row?.efectivo || 0);

const metodoCuentaComoTarjeta = (metodo?: string | null) => {
  const normalized = `${metodo || ""}`.trim().toLowerCase();
  return normalized === "tarjeta" || normalized === "visalink";
};

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
  const ajustes = asArray(data?.ajustesPosteriores).reduce((sum, row) => sum + Number(row?.monto || 0), 0);
  return [
    ...(tiendaAutoRows.length ? tiendaAutoRows : ventasSnapshotRows),
    ...asArray(data?.tiendaManualRows),
  ].reduce(
    (sum, row) => sum + getTiendaRowTotal(row),
    capital + departamento + ajustes,
  );
};

const inRange = (fecha: string, desde: string, hasta: string) => {
  if (!fecha) return false;
  if (desde && fecha < desde) return false;
  if (hasta && fecha > hasta) return false;
  return true;
};

const exportCsv = (rows: TiendaRow[]) => {
  const headers = [
    "Tienda",
    "Ventas",
    "Tickets",
    "Ticket promedio",
    "Pedidos",
    "Pedidos abiertos",
    "Saldo pendiente",
    "Cierres diarios",
    "Total cierres",
    "Diferencia venta cierre",
    "Participacion ventas",
    "Stock total",
    "Stock bajo",
  ];
  const lines = rows.map((row) =>
    [
      row.bodega,
      row.ventasTotal.toFixed(2),
      row.ventasTickets,
      row.ticketPromedio.toFixed(2),
      row.pedidosCantidad,
      row.pedidosAbiertos,
      row.saldoPendiente.toFixed(2),
      row.cierresCantidad,
      row.cierresTotal.toFixed(2),
      row.diferenciaVentaCierre.toFixed(2),
      row.participacionVentas.toFixed(2),
      row.stockTotal,
      row.stockBajo,
    ]
      .map((value) => `"${`${value}`.replace(/"/g, '""')}"`)
      .join(";"),
  );
  const blob = new Blob(["\ufeff", [headers.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `comparativo-tiendas-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const Metric = ({
  title,
  value,
  helper,
  icon,
  tone = "primary",
}: {
  title: string;
  value: string | number;
  helper?: string;
  icon: React.ReactNode;
  tone?: "primary" | "success" | "warning" | "error" | "info";
}) => (
  <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, height: "100%" }}>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="caption" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {value}
        </Typography>
        {helper && (
          <Typography variant="caption" color="text.secondary">
            {helper}
          </Typography>
        )}
      </Stack>
      <Box sx={{ color: `${tone}.main`, display: "flex" }}>{icon}</Box>
    </Stack>
  </Paper>
);

const Bar = ({ value, max, color = "primary.main" }: { value: number; max: number; color?: string }) => {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 4 : 0) : 0;
  return (
    <Box sx={{ height: 8, bgcolor: "grey.100", borderRadius: 1, overflow: "hidden", minWidth: 120 }}>
      <Box sx={{ width: `${width}%`, height: "100%", bgcolor: color, borderRadius: 1 }} />
    </Box>
  );
};

const RankingPanel = ({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: VentaRanking[];
  tone: "success" | "warning";
}) => (
  <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, height: "100%" }}>
    <Stack spacing={1.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1" fontWeight={600}>
          {title}
        </Typography>
        <Chip
          size="small"
          color={tone}
          icon={tone === "success" ? <TrendingUpOutlined /> : <TrendingDownOutlined />}
          label={tone === "success" ? "Mas altas" : "Mas bajas"}
        />
      </Stack>
      {!rows.length ? (
        <Typography variant="body2" color="text.secondary">
          No hay ventas en el rango.
        </Typography>
      ) : (
        rows.map((row, index) => (
          <Stack key={`${row.id}-${index}`} direction="row" justifyContent="space-between" spacing={2}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={500} noWrap>
                {row.tienda}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                {row.fecha} | {row.cliente} | {row.vendedor}
              </Typography>
            </Box>
            <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: "nowrap" }}>
              {money(row.total)}
            </Typography>
          </Stack>
        ))
      )}
    </Stack>
  </Paper>
);

interface ComparativoTotals {
  ventasTotal: number;
  ventasTickets: number;
  pedidosTotal: number;
  pedidosCantidad: number;
  pedidosAbiertos: number;
  saldoPendiente: number;
  cierresTotal: number;
  cierresCantidad: number;
  stockBajo: number;
}

const ComparativoHeader = ({
  loading,
  rows,
  onReload,
  onExport,
}: {
  loading: boolean;
  rows: TiendaRow[];
  onReload: () => void;
  onExport: () => void;
}) => (
  <Paper variant="outlined" sx={{ p: 3, borderRadius: 1, mb: 2 }}>
    <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", lg: "center" }} spacing={2}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ color: "primary.main", display: "flex" }}>
          <StorefrontOutlined fontSize="large" />
        </Box>
        <Box>
          <Typography variant="h4" fontWeight={600}>
            Comparativo entre tiendas
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Compara ventas, pedidos, cierres diarios, saldos, stock y desempeno entre dos o mas tiendas.
          </Typography>
        </Box>
      </Stack>
      <Stack direction="row" spacing={1} justifyContent={{ xs: "flex-start", lg: "flex-end" }}>
        <Button startIcon={<RefreshOutlined />} variant="outlined" size="small" onClick={onReload} disabled={loading}>
          Recargar
        </Button>
        <Button startIcon={<FileDownloadOutlined />} variant="contained" size="small" onClick={onExport} disabled={!rows.length}>
          Excel/CSV
        </Button>
      </Stack>
    </Stack>
  </Paper>
);

const ComparativoFilters = ({
  desde,
  hasta,
  bodegas,
  bodegaIds,
  bodegaById,
  tiendasSeleccionadas,
  onDesdeChange,
  onHastaChange,
  onBodegaIdsChange,
}: {
  desde: string;
  hasta: string;
  bodegas: Bodega[];
  bodegaIds: number[];
  bodegaById: Map<number, Bodega>;
  tiendasSeleccionadas: number;
  onDesdeChange: (value: string) => void;
  onHastaChange: (value: string) => void;
  onBodegaIdsChange: (value: number[]) => void;
}) => (
  <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, mb: 2 }}>
    <Grid container spacing={2} alignItems="center">
      <Grid size={{ xs: 12, md: 3 }}>
        <TextField
          label="Desde"
          type="date"
          value={desde}
          onChange={(e) => onDesdeChange(e.target.value)}
          size="small"
          fullWidth
          InputLabelProps={{ shrink: true }}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 3 }}>
        <TextField
          label="Hasta"
          type="date"
          value={hasta}
          onChange={(e) => onHastaChange(e.target.value)}
          size="small"
          fullWidth
          InputLabelProps={{ shrink: true }}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <FormControl size="small" fullWidth>
          <InputLabel>Tiendas a comparar</InputLabel>
          <Select
            multiple
            value={bodegaIds.map(String)}
            input={<OutlinedInput label="Tiendas a comparar" />}
            renderValue={(selected) =>
              selected
                .map((value) => bodegaById.get(Number(value))?.nombre || `Tienda ${value}`)
                .join(", ")
            }
            onChange={(event) => {
              const value = event.target.value;
              onBodegaIdsChange((typeof value === "string" ? value.split(",") : value).map(Number));
            }}
          >
            {bodegas.map((bodega) => (
              <MenuItem key={bodega.id} value={String(bodega.id)}>
                <Checkbox checked={bodegaIds.includes(Number(bodega.id))} />
                <ListItemText primary={bodega.nombre} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
    </Grid>
    {tiendasSeleccionadas < 2 && (
      <Alert severity="info" sx={{ mt: 2 }}>
        Selecciona dos o mas tiendas para ver un comparativo real. Con una sola tienda se muestran sus indicadores individuales.
      </Alert>
    )}
  </Paper>
);

const ComparativoMetrics = ({
  totals,
  diferenciaCierres,
  ticketPromedioGeneral,
}: {
  totals: ComparativoTotals;
  diferenciaCierres: number;
  ticketPromedioGeneral: number;
}) => (
  <Grid container spacing={2} sx={{ mb: 2 }}>
    <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
      <Metric title="Ventas seleccionadas" value={money(totals.ventasTotal)} helper={`${totals.ventasTickets} tickets | prom. ${money(ticketPromedioGeneral)}`} icon={<TrendingUpOutlined />} tone="success" />
    </Grid>
    <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
      <Metric title="Pedidos" value={totals.pedidosCantidad} helper={`${totals.pedidosAbiertos} abiertos | ${money(totals.pedidosTotal)}`} icon={<AssessmentOutlined />} />
    </Grid>
    <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
      <Metric title="Cierres diarios" value={money(totals.cierresTotal)} helper={`${totals.cierresCantidad} cierre(s) | Dif. ${money(diferenciaCierres)}`} icon={<StorefrontOutlined />} tone={Math.abs(diferenciaCierres) > 1 ? "warning" : "info"} />
    </Grid>
    <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
      <Metric title="Saldo pendiente" value={money(totals.saldoPendiente)} helper={`${totals.stockBajo} productos en stock bajo`} icon={<WarningAmberOutlined />} tone="warning" />
    </Grid>
  </Grid>
);

const ParticipationPanel = ({
  rows,
  lider,
  menorVenta,
  mejoresVentas,
  peoresVentas,
  maxVentas,
  maxPedidos,
}: {
  rows: TiendaRow[];
  lider?: TiendaRow;
  menorVenta?: TiendaRow;
  mejoresVentas: VentaRanking[];
  peoresVentas: VentaRanking[];
  maxVentas: number;
  maxPedidos: number;
}) => (
  <Grid container spacing={2} sx={{ mb: 2 }}>
    <Grid size={{ xs: 12, lg: 8 }}>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, height: "100%" }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={600}>
              Participacion y desempeno por tienda
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Barras comparativas por ventas y volumen de pedidos.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {lider && <Chip color="success" label={`Lider: ${lider.bodega}`} />}
            {menorVenta && <Chip color="warning" variant="outlined" label={`Menor venta: ${menorVenta.bodega}`} />}
          </Stack>
        </Stack>
        <Stack spacing={1.5}>
          {rows.slice(0, 8).map((row) => (
            <Grid container key={row.bodegaId} spacing={1.5} alignItems="center">
              <Grid size={{ xs: 12, md: 3 }}>
                <Typography variant="body2" fontWeight={500}>
                  {row.bodega}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {row.participacionVentas.toFixed(1)}% de ventas
                </Typography>
              </Grid>
              <Grid size={{ xs: 8, md: 6 }}>
                <Bar value={row.ventasTotal} max={maxVentas} color="#1d4ed8" />
              </Grid>
              <Grid size={{ xs: 4, md: 3 }}>
                <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                  <Typography variant="body2" fontWeight={600}>
                    {money(row.ventasTotal)}
                  </Typography>
                  <Tooltip title={`${row.pedidosCantidad} pedido(s)`}>
                    <Box sx={{ minWidth: 46 }}>
                      <Bar value={row.pedidosCantidad} max={maxPedidos} color="#16a34a" />
                    </Box>
                  </Tooltip>
                </Stack>
              </Grid>
            </Grid>
          ))}
          {!rows.length && (
            <Typography variant="body2" color="text.secondary">
              No hay tiendas seleccionadas.
            </Typography>
          )}
        </Stack>
      </Paper>
    </Grid>
    <Grid size={{ xs: 12, lg: 4 }}>
      <Stack spacing={2} sx={{ height: "100%" }}>
        <RankingPanel title="Mejores ventas" rows={mejoresVentas} tone="success" />
        <RankingPanel title="Peores ventas" rows={peoresVentas} tone="warning" />
      </Stack>
    </Grid>
  </Grid>
);

const ComparativoMatrix = ({
  loading,
  rows,
  desde,
  hasta,
  page,
  rowsPerPage,
  paginatedRows,
  paginationProps,
}: {
  loading: boolean;
  rows: TiendaRow[];
  desde: string;
  hasta: string;
  page: number;
  rowsPerPage: number;
  paginatedRows: TiendaRow[];
  paginationProps: any;
}) => (
  <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 1.5 }}>
      <Box>
        <Typography variant="h6" fontWeight={600}>
          Matriz comparativa
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Ordenada por ventas totales del rango seleccionado.
        </Typography>
      </Box>
      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Chip size="small" label={`${rows.length} tienda(s)`} />
        <Chip size="small" variant="outlined" label={`Rango ${desde} a ${hasta}`} />
      </Stack>
    </Stack>
    <Divider sx={{ mb: 1 }} />
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Tienda</TableCell>
            <TableCell>Ventas</TableCell>
            <TableCell>Participacion</TableCell>
            <TableCell>Tickets</TableCell>
            <TableCell>Ticket prom.</TableCell>
            <TableCell>Pedidos</TableCell>
            <TableCell>Abiertos</TableCell>
            <TableCell>Saldo</TableCell>
            <TableCell>Cierres</TableCell>
            <TableCell>Diferencia</TableCell>
            <TableCell>Stock bajo</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <UniformaTableLoadingRow colSpan={12} />
          ) : paginatedRows.map((row, index) => (
            <TableRow key={row.bodegaId} hover>
              <TableCell>{page * rowsPerPage + index + 1}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {row.bodega}
                  </Typography>
                  {page === 0 && index === 0 && row.ventasTotal > 0 && <Chip label="Lider" size="small" color="success" />}
                </Stack>
              </TableCell>
              <TableCell>{money(row.ventasTotal)}</TableCell>
              <TableCell>
                <Stack spacing={0.5}>
                  <Typography variant="caption">{row.participacionVentas.toFixed(2)}%</Typography>
                  <Bar value={row.participacionVentas} max={100} color="#2563eb" />
                </Stack>
              </TableCell>
              <TableCell>{row.ventasTickets}</TableCell>
              <TableCell>{money(row.ticketPromedio)}</TableCell>
              <TableCell>{row.pedidosCantidad}</TableCell>
              <TableCell>{row.pedidosAbiertos}</TableCell>
              <TableCell>{money(row.saldoPendiente)}</TableCell>
              <TableCell>
                <Stack spacing={0.25}>
                  <Typography variant="body2">{money(row.cierresTotal)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {row.cierresCantidad} cierre(s)
                  </Typography>
                </Stack>
              </TableCell>
              <TableCell>
                <Typography color={Math.abs(row.diferenciaVentaCierre) > 1 ? "warning.main" : "text.primary"} fontWeight={500}>
                  {money(row.diferenciaVentaCierre)}
                </Typography>
              </TableCell>
              <TableCell>{row.stockBajo}</TableCell>
            </TableRow>
          ))}
          {!loading && !rows.length && (
            <TableRow>
              <TableCell colSpan={12} align="center">
                No hay tiendas para comparar.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
    <TablePagination {...paginationProps} />
  </Paper>
);

export default function ComparativoTiendas() {
  const [state, dispatch] = useReducer(comparativoReducer, undefined, createInitialState);
  const { bodegas, ventas, pedidos, documentos, inventario, desde, hasta, bodegaIds, loading } = state;

  const cargar = useCallback(async () => {
    try {
      dispatch({ type: "loading", value: true });
      const [respBodegas, respVentas, respPedidos, respDocumentos, respInventario] = await Promise.all([
        api.get("/bodegas").catch(() => ({ data: [] })),
        api.get("/ventas").catch(() => ({ data: [] })),
        api.get("/produccion").catch(() => ({ data: [] })),
        api.get("/documentos", { params: { tipo: "reporteDiario", _ts: Date.now() } }).catch(() => ({ data: [] })),
        api.get("/inventario/reporte").catch(() => ({ data: [] })),
      ]);
      dispatch({
        type: "loaded",
        bodegas: respBodegas.data || [],
        ventas: respVentas.data || [],
        pedidos: respPedidos.data || [],
        documentos: respDocumentos.data || [],
        inventario: respInventario.data || [],
      });
    } catch {
      Swal.fire("Error", "No se pudo cargar el comparativo de tiendas", "error");
    } finally {
      dispatch({ type: "loading", value: false });
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const bodegaById = useMemo(() => new Map(bodegas.map((bodega) => [Number(bodega.id), bodega])), [bodegas]);
  const selectedIds = useMemo(() => new Set(bodegaIds.map(Number)), [bodegaIds]);

  const getBodegaName = useCallback((id?: number | null, fallback?: string | null) => {
    const parsed = Number(id || 0);
    return bodegaById.get(parsed)?.nombre || fallback || (parsed ? `Tienda ${parsed}` : "Sin tienda");
  }, [bodegaById]);

  const resolveDocumentoBodegaId = useCallback((doc: DocumentoRow) => {
    const data = doc.data || {};
    const direct = Number(doc.usuario?.bodegaId || data.bodegaId || data.tiendaId || data.bodega?.id);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const tiendaText = normalizeText(data.tienda || data.bodega || data.bodegaNombre);
    if (!tiendaText) return 0;
    const match = bodegas.find((bodega) => normalizeText(bodega.nombre) === tiendaText);
    return Number(match?.id || 0);
  }, [bodegas]);

  const rows = useMemo<TiendaRow[]>(() => {
    const base = new Map<number, TiendaRow>();
    for (const bodega of bodegas) {
      if (!selectedIds.has(Number(bodega.id))) continue;
      base.set(Number(bodega.id), {
        bodegaId: Number(bodega.id),
        bodega: bodega.nombre,
        ventasTotal: 0,
        ventasTickets: 0,
        ticketPromedio: 0,
        pedidosTotal: 0,
        pedidosCantidad: 0,
        pedidosAbiertos: 0,
        saldoPendiente: 0,
        cierresTotal: 0,
        cierresCantidad: 0,
        diferenciaVentaCierre: 0,
        stockTotal: 0,
        stockBajo: 0,
        participacionVentas: 0,
        productividad: 0,
      });
    }

    const ensureRow = (bodegaId?: number | null, fallbackName?: string | null) => {
      const id = Number(bodegaId || 0);
      if (!selectedIds.has(id)) return null;
      if (!base.has(id)) {
        base.set(id, {
          bodegaId: id,
          bodega: getBodegaName(id, fallbackName),
          ventasTotal: 0,
          ventasTickets: 0,
          ticketPromedio: 0,
          pedidosTotal: 0,
          pedidosCantidad: 0,
          pedidosAbiertos: 0,
          saldoPendiente: 0,
          cierresTotal: 0,
          cierresCantidad: 0,
          diferenciaVentaCierre: 0,
          stockTotal: 0,
          stockBajo: 0,
          participacionVentas: 0,
          productividad: 0,
        });
      }
      return base.get(id)!;
    };

    ventas.forEach((venta) => {
      const fecha = toDateOnly(venta.fecha);
      if (!inRange(fecha, desde, hasta)) return;
      const row = ensureRow(venta.bodegaId, venta.bodega?.nombre);
      if (!row) return;
      row.ventasTickets += 1;
      row.ventasTotal += Number(venta.total || 0);
    });

    const estadosAbiertos = new Set(["nuevo", "en_produccion", "pendiente", "regresado_produccion"]);
    const estadosSinSaldo = new Set(["anulado", "recibido", "completado"]);
    pedidos.forEach((pedido) => {
      const fecha = toDateOnly(pedido.fecha);
      if (!inRange(fecha, desde, hasta)) return;
      const row = ensureRow(pedido.bodegaId, pedido.bodega?.nombre);
      if (!row) return;
      const estado = `${pedido.estado || ""}`.trim().toLowerCase();
      row.pedidosCantidad += 1;
      row.pedidosTotal += Number(pedido.totalEstimado || 0);
      if (!estadosSinSaldo.has(estado)) row.saldoPendiente += Number(pedido.saldoPendiente || 0);
      if (estadosAbiertos.has(estado)) row.pedidosAbiertos += 1;
    });

    documentos.forEach((doc) => {
      const fecha = `${doc.data?.fecha || doc.creadoEn || ""}`.slice(0, 10);
      if (doc.tipo !== "reporteDiario" || !inRange(fecha, desde, hasta)) return;
      const row = ensureRow(resolveDocumentoBodegaId(doc));
      if (!row) return;
      row.cierresCantidad += 1;
      row.cierresTotal += getReporteDiarioTotal(doc.data || {});
    });

    inventario.forEach((item) => {
      const row = ensureRow(item.bodegaId);
      if (!row) return;
      row.stockTotal += Number(item.stock || 0);
      if (Number(item.stockMax || 0) > 0 && Number(item.stock || 0) < Number(item.stockMax || 0)) {
        row.stockBajo += 1;
      }
    });

    const rowsBase = Array.from(base.values());
    const totalVentas = rowsBase.reduce((sum, row) => sum + row.ventasTotal, 0);
    return rowsBase
      .map((row) => ({
        ...row,
        ticketPromedio: row.ventasTickets ? row.ventasTotal / row.ventasTickets : 0,
        diferenciaVentaCierre: row.ventasTotal - row.cierresTotal,
        participacionVentas: totalVentas > 0 ? (row.ventasTotal / totalVentas) * 100 : 0,
        productividad: row.pedidosCantidad > 0 ? row.ventasTotal / row.pedidosCantidad : row.ventasTotal,
      }))
      .sort((a, b) => b.ventasTotal - a.ventasTotal);
  }, [bodegas, documentos, desde, getBodegaName, hasta, inventario, pedidos, resolveDocumentoBodegaId, selectedIds, ventas]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          ventasTotal: acc.ventasTotal + row.ventasTotal,
          ventasTickets: acc.ventasTickets + row.ventasTickets,
          pedidosTotal: acc.pedidosTotal + row.pedidosTotal,
          pedidosCantidad: acc.pedidosCantidad + row.pedidosCantidad,
          pedidosAbiertos: acc.pedidosAbiertos + row.pedidosAbiertos,
          saldoPendiente: acc.saldoPendiente + row.saldoPendiente,
          cierresTotal: acc.cierresTotal + row.cierresTotal,
          cierresCantidad: acc.cierresCantidad + row.cierresCantidad,
          stockBajo: acc.stockBajo + row.stockBajo,
        }),
        {
          ventasTotal: 0,
          ventasTickets: 0,
          pedidosTotal: 0,
          pedidosCantidad: 0,
          pedidosAbiertos: 0,
          saldoPendiente: 0,
          cierresTotal: 0,
          cierresCantidad: 0,
          stockBajo: 0,
        },
      ),
    [rows],
  );

  const ventasRanking = useMemo(() => {
    const ranking: VentaRanking[] = [];
    for (const venta of ventas) {
      const fecha = toDateOnly(venta.fecha);
      const bodegaId = Number(venta.bodegaId || 0);
      const total = Number(venta.total || 0);
      if (!selectedIds.has(bodegaId) || !inRange(fecha, desde, hasta) || total <= 0) continue;
      ranking.push({
        id: venta.id,
        fecha,
        tienda: getBodegaName(venta.bodegaId, venta.bodega?.nombre),
        cliente: venta.cliente?.nombre || "Mostrador",
        vendedor: venta.vendedor || "N/D",
        metodoPago: venta.metodoPago || "N/D",
        total,
      });
    }
    return ranking;
  }, [desde, getBodegaName, hasta, selectedIds, ventas]);

  const mejoresVentas = useMemo(() => ventasRanking.slice().sort((a, b) => b.total - a.total).slice(0, 5), [ventasRanking]);
  const peoresVentas = useMemo(() => ventasRanking.slice().sort((a, b) => a.total - b.total).slice(0, 5), [ventasRanking]);
  const maxVentas = Math.max(...rows.map((row) => row.ventasTotal), 1);
  const maxPedidos = Math.max(...rows.map((row) => row.pedidosCantidad), 1);
  const lider = rows[0];
  const menorVenta = rows.reduce<TiendaRow | undefined>(
    (menor, row) => (row.ventasTickets > 0 && (!menor || row.ventasTotal < menor.ventasTotal) ? row : menor),
    undefined,
  );
  const diferenciaCierres = totals.ventasTotal - totals.cierresTotal;
  const ticketPromedioGeneral = totals.ventasTickets ? totals.ventasTotal / totals.ventasTickets : 0;
  const tiendasSeleccionadas = bodegaIds.length;
  const { page, rowsPerPage, paginatedRows, paginationProps } = useTablePagination(rows, 10);

  return (
    <Box sx={{ p: 3, bgcolor: "background.default", minHeight: "100%" }}>
      <ComparativoHeader loading={loading} rows={rows} onReload={() => void cargar()} onExport={() => exportCsv(rows)} />

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <ComparativoFilters
        desde={desde}
        hasta={hasta}
        bodegas={bodegas}
        bodegaIds={bodegaIds}
        bodegaById={bodegaById}
        tiendasSeleccionadas={tiendasSeleccionadas}
        onDesdeChange={(value) => dispatch({ type: "desde", value })}
        onHastaChange={(value) => dispatch({ type: "hasta", value })}
        onBodegaIdsChange={(value) => dispatch({ type: "bodegaIds", value })}
      />

      <ComparativoMetrics totals={totals} diferenciaCierres={diferenciaCierres} ticketPromedioGeneral={ticketPromedioGeneral} />

      <ParticipationPanel
        rows={rows}
        lider={lider}
        menorVenta={menorVenta}
        mejoresVentas={mejoresVentas}
        peoresVentas={peoresVentas}
        maxVentas={maxVentas}
        maxPedidos={maxPedidos}
      />

      <ComparativoMatrix
        loading={loading}
        rows={rows}
        desde={desde}
        hasta={hasta}
        page={page}
        rowsPerPage={rowsPerPage}
        paginatedRows={paginatedRows}
        paginationProps={paginationProps}
      />
    </Box>
  );
}
