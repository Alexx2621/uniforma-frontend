import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
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
  bodegaId?: number | null;
}

interface Pedido {
  id: number;
  fecha: string;
  estado: string;
  totalEstimado: number;
  saldoPendiente: number;
  bodegaId?: number | null;
}

interface Postventa {
  id: number;
  estado: string;
  monto: number;
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
  stockTotal: number;
  stockBajo: number;
}

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

const toDateOnly = (value: string) => {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
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
      row.stockTotal,
      row.stockBajo,
    ]
      .map((value) => `"${`${value}`.replace(/"/g, '""')}"`)
      .join(";")
  );
  const blob = new Blob(["\ufeff", [headers.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `comparativo-tiendas-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const Metric = ({ title, value, helper, icon }: { title: string; value: string | number; helper?: string; icon: React.ReactNode }) => (
  <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, height: "100%" }}>
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="caption" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
        {helper && (
          <Typography variant="caption" color="text.secondary">
            {helper}
          </Typography>
        )}
      </Stack>
      <Box sx={{ color: "primary.main", display: "flex" }}>{icon}</Box>
    </Stack>
  </Paper>
);

export default function ComparativoTiendas() {
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [postventa, setPostventa] = useState<Postventa[]>([]);
  const [inventario, setInventario] = useState<Inventario[]>([]);
  const [desde, setDesde] = useState(() => daysAgo(30));
  const [hasta, setHasta] = useState(() => today());
  const [loading, setLoading] = useState(false);

  const cargar = async () => {
    try {
      setLoading(true);
      const [respBodegas, respVentas, respPedidos, respPostventa, respInventario] = await Promise.all([
        api.get("/bodegas").catch(() => ({ data: [] })),
        api.get("/ventas").catch(() => ({ data: [] })),
        api.get("/produccion").catch(() => ({ data: [] })),
        api.get("/postventa").catch(() => ({ data: [] })),
        api.get("/inventario/reporte").catch(() => ({ data: [] })),
      ]);
      setBodegas(respBodegas.data || []);
      setVentas(respVentas.data || []);
      setPedidos(respPedidos.data || []);
      setPostventa(respPostventa.data || []);
      setInventario(respInventario.data || []);
    } catch {
      Swal.fire("Error", "No se pudo cargar el comparativo de tiendas", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const rows = useMemo<TiendaRow[]>(() => {
    const base = new Map<number, TiendaRow>();
    bodegas.forEach((bodega) => {
      base.set(bodega.id, {
        bodegaId: bodega.id,
        bodega: bodega.nombre,
        ventasTotal: 0,
        ventasTickets: 0,
        ticketPromedio: 0,
        pedidosTotal: 0,
        pedidosCantidad: 0,
        pedidosAbiertos: 0,
        saldoPendiente: 0,
        stockTotal: 0,
        stockBajo: 0,
      });
    });

    const ensureRow = (bodegaId?: number | null) => {
      const id = Number(bodegaId || 0);
      if (!base.has(id)) {
        base.set(id, {
          bodegaId: id,
          bodega: id ? `Tienda ${id}` : "Sin tienda",
          ventasTotal: 0,
          ventasTickets: 0,
          ticketPromedio: 0,
          pedidosTotal: 0,
          pedidosCantidad: 0,
          pedidosAbiertos: 0,
          saldoPendiente: 0,
          stockTotal: 0,
          stockBajo: 0,
        });
      }
      return base.get(id)!;
    };

    ventas.forEach((venta) => {
      const fecha = toDateOnly(venta.fecha);
      if (desde && fecha < desde) return;
      if (hasta && fecha > hasta) return;
      const row = ensureRow(venta.bodegaId);
      row.ventasTickets += 1;
      row.ventasTotal += Number(venta.total || 0);
    });

    const estadosAbiertos = new Set(["nuevo", "en_produccion", "pendiente", "regresado_produccion"]);
    pedidos.forEach((pedido) => {
      const fecha = toDateOnly(pedido.fecha);
      if (desde && fecha < desde) return;
      if (hasta && fecha > hasta) return;
      const row = ensureRow(pedido.bodegaId);
      row.pedidosCantidad += 1;
      row.pedidosTotal += Number(pedido.totalEstimado || 0);
      row.saldoPendiente += Number(pedido.saldoPendiente || 0);
      if (estadosAbiertos.has(`${pedido.estado || ""}`.toLowerCase())) row.pedidosAbiertos += 1;
    });

    inventario.forEach((item) => {
      const row = ensureRow(item.bodegaId);
      row.stockTotal += Number(item.stock || 0);
      if (Number(item.stockMax || 0) > 0 && Number(item.stock || 0) < Number(item.stockMax || 0)) {
        row.stockBajo += 1;
      }
    });

    return Array.from(base.values())
      .map((row) => ({
        ...row,
        ticketPromedio: row.ventasTickets ? row.ventasTotal / row.ventasTickets : 0,
      }))
      .sort((a, b) => b.ventasTotal - a.ventasTotal);
  }, [bodegas, ventas, pedidos, inventario, desde, hasta]);

  const totals = rows.reduce(
    (acc, row) => ({
      ventasTotal: acc.ventasTotal + row.ventasTotal,
      ventasTickets: acc.ventasTickets + row.ventasTickets,
      pedidosCantidad: acc.pedidosCantidad + row.pedidosCantidad,
      pedidosAbiertos: acc.pedidosAbiertos + row.pedidosAbiertos,
      saldoPendiente: acc.saldoPendiente + row.saldoPendiente,
      stockBajo: acc.stockBajo + row.stockBajo,
    }),
    { ventasTotal: 0, ventasTickets: 0, pedidosCantidad: 0, pedidosAbiertos: 0, saldoPendiente: 0, stockBajo: 0 }
  );

  const lider = rows[0];
  const { page, rowsPerPage, paginatedRows, paginationProps } = useTablePagination(rows, 10);
  const postventaAbierta = postventa.filter((row) => ["pendiente", "en_revision"].includes(`${row.estado || ""}`.toLowerCase())).length;

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <StorefrontOutlined color="primary" />
          <Box>
            <Typography variant="h4">Comparativo entre tiendas</Typography>
            <Typography variant="body2" color="text.secondary">
              Ranking operativo por ventas, pedidos, saldos y stock bajo.
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RefreshOutlined />} variant="outlined" size="small" onClick={() => void cargar()} disabled={loading}>
            Recargar
          </Button>
          <Button startIcon={<FileDownloadOutlined />} variant="contained" size="small" onClick={() => exportCsv(rows)} disabled={!rows.length}>
            Excel/CSV
          </Button>
        </Stack>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <TextField label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <TextField label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Metric title="Ventas totales" value={money(totals.ventasTotal)} helper={`${totals.ventasTickets} tickets`} icon={<TrendingUpOutlined />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Metric title="Tienda lider" value={lider?.bodega || "N/D"} helper={lider ? money(lider.ventasTotal) : "Sin ventas"} icon={<StorefrontOutlined />} />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Metric title="Pedidos" value={totals.pedidosCantidad} helper={`${totals.pedidosAbiertos} abiertos`} icon={<StorefrontOutlined />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Metric title="Saldo pendiente" value={money(totals.saldoPendiente)} helper="Pedidos con saldo acumulado" icon={<WarningAmberOutlined />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Metric title="Stock bajo" value={totals.stockBajo} helper="Productos por debajo del maximo" icon={<WarningAmberOutlined />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Metric title="Postventa abierta" value={postventaAbierta} helper="Cambios/devoluciones pendientes" icon={<WarningAmberOutlined />} />
        </Grid>
      </Grid>

      <Divider sx={{ mb: 2 }} />

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Tienda</TableCell>
              <TableCell>Ventas</TableCell>
              <TableCell>Tickets</TableCell>
              <TableCell>Ticket prom.</TableCell>
              <TableCell>Pedidos</TableCell>
              <TableCell>Abiertos</TableCell>
              <TableCell>Saldo</TableCell>
              <TableCell>Stock total</TableCell>
              <TableCell>Stock bajo</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <UniformaTableLoadingRow colSpan={10} />
            ) : paginatedRows.map((row, index) => (
              <TableRow key={row.bodegaId} hover>
                <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {row.bodega}
                    </Typography>
                    {page === 0 && index === 0 && row.ventasTotal > 0 && <Chip label="Lider" size="small" color="success" />}
                  </Stack>
                </TableCell>
                <TableCell>{money(row.ventasTotal)}</TableCell>
                <TableCell>{row.ventasTickets}</TableCell>
                <TableCell>{money(row.ticketPromedio)}</TableCell>
                <TableCell>{row.pedidosCantidad}</TableCell>
                <TableCell>{row.pedidosAbiertos}</TableCell>
                <TableCell>{money(row.saldoPendiente)}</TableCell>
                <TableCell>{row.stockTotal}</TableCell>
                <TableCell>{row.stockBajo}</TableCell>
              </TableRow>
            ))}
            {!loading && !rows.length && (
              <TableRow>
                <TableCell colSpan={10} align="center">
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
}
