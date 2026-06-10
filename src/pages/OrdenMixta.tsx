import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Chip,
  Grid,
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
import AddIcon from "@mui/icons-material/Add";
import CallSplitOutlined from "@mui/icons-material/CallSplitOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import { useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { formatCurrency } from "../utils/currency";

type OrdenMixtaRow = {
  id: number;
  folio: string;
  fecha: string;
  clienteNombre: string;
  subtotalVenta: number;
  subtotalPedido: number;
  total: number;
  anticipoTotal: number;
  saldoTotal: number;
  venta?: { folio?: string | null } | null;
  pedido?: { folio?: string | null } | null;
};

const today = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

export default function OrdenMixta() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<OrdenMixtaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [desde, setDesde] = useState(() => today());
  const [hasta, setHasta] = useState(() => today());
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const resumen = useMemo(
    () => ({
      documentos: rows.length,
      total: rows.reduce((sum, row) => sum + Number(row.total || 0), 0),
      inventario: rows.reduce((sum, row) => sum + Number(row.subtotalVenta || 0), 0),
      produccion: rows.reduce((sum, row) => sum + Number(row.subtotalPedido || 0), 0),
    }),
    [rows],
  );

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/orden-mixta", { params: { desde, hasta } });
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const visibleRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <div>
          <Typography variant="h4" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CallSplitOutlined /> Orden mixta
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Separa una misma operación en venta desde inventario y pedido de producción.
          </Typography>
        </div>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/orden-mixta/nueva")}>
          Nueva orden mixta
        </Button>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="caption">Documentos</Typography>
            <Typography variant="h5">{resumen.documentos}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="caption">Total</Typography>
            <Typography variant="h5">{formatCurrency(resumen.total)}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="caption">Venta inventario</Typography>
            <Typography variant="h5">{formatCurrency(resumen.inventario)}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="caption">Producción</Typography>
            <Typography variant="h5">{formatCurrency(resumen.produccion)}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField fullWidth type="date" label="Desde" value={desde} onChange={(event) => setDesde(event.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField fullWidth type="date" label="Hasta" value={hasta} onChange={(event) => setHasta(event.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <Button fullWidth variant="outlined" onClick={cargar} disabled={loading}>
              Recargar
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper>
        <TableContainer sx={{ minHeight: 420 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Folio</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Venta</TableCell>
                <TableCell>Pedido</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Anticipo</TableCell>
                <TableCell>Saldo</TableCell>
                <TableCell>Docs.</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.folio}</TableCell>
                  <TableCell>{new Date(row.fecha).toLocaleDateString()}</TableCell>
                  <TableCell>{row.clienteNombre}</TableCell>
                  <TableCell>{formatCurrency(row.subtotalVenta)}</TableCell>
                  <TableCell>{formatCurrency(row.subtotalPedido)}</TableCell>
                  <TableCell>{formatCurrency(row.total)}</TableCell>
                  <TableCell>{formatCurrency(row.anticipoTotal)}</TableCell>
                  <TableCell>{formatCurrency(row.saldoTotal)}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      {row.venta?.folio && <Chip size="small" label={row.venta.folio} color="primary" variant="outlined" />}
                      {row.pedido?.folio && <Chip size="small" label={row.pedido.folio} color="success" variant="outlined" />}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<VisibilityOutlined />} onClick={() => navigate(`/orden-mixta/${row.id}`)}>
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!visibleRows.length && (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 6 }} color="text.secondary">
                    No hay ordenes mixtas en el rango seleccionado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={rows.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
        />
      </Paper>
    </Stack>
  );
}

