import { useEffect, useMemo, useState } from "react";
import {
  Paper,
  Typography,
  Stack,
  Grid,
  TextField,
  Button,
  Divider,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
} from "@mui/material";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import Swal from "sweetalert2";
import { api } from "../../api/axios";

interface Venta {
  id: number;
  fecha: string;
  total: number;
  cliente?: { id: number; nombre: string };
}

interface RowCliente {
  clienteId: number | null;
  nombre: string;
  tickets: number;
  total: number;
  promedio: number;
}

const toDateOnly = (value: string) => {
  const d = new Date(value);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const exportCsv = (rows: RowCliente[]) => {
  const headers = ["Cliente", "Tickets", "Total", "Promedio"];
  const lines = rows.map((r) =>
    [r.nombre, r.tickets, r.total.toFixed(2), r.promedio.toFixed(2)].join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "top-clientes.csv";
  link.click();
  URL.revokeObjectURL(url);
};

const exportPdf = (rows: RowCliente[]) => {
  const win = window.open("", "_blank");
  if (!win) {
    Swal.fire("Aviso", "Habilita ventanas emergentes para exportar a PDF", "info");
    return;
  }
  const rowsHtml = rows
    .map(
      (r) => `<tr>
        <td>${r.nombre}</td>
        <td>${r.tickets}</td>
        <td>Q ${r.total.toFixed(2)}</td>
        <td>Q ${r.promedio.toFixed(2)}</td>
      </tr>`
    )
    .join("");
  win.document.write(`<!doctype html>
  <html><head>
    <meta charset="utf-8" />
    <title>Top clientes</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
      h2 { margin: 0 0 12px 0; }
      table { border-collapse: collapse; width: 100%; font-size: 12px; }
      th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
      th { background: #0f172a; color: #fff; }
    </style>
  </head>
  <body>
    <h2>Top clientes</h2>
    <table>
      <thead>
        <tr><th>Cliente</th><th>Tickets</th><th>Total</th><th>Promedio ticket</th></tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <script>window.onload = function(){window.print();}</script>
  </body></html>`);
  win.document.close();
};

export default function TopClientes() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [filtroTexto, setFiltroTexto] = useState("");
  const [loading, setLoading] = useState(false);

  const cargar = async () => {
    try {
      setLoading(true);
      const resp = await api.get("/ventas");
      setVentas(resp.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar ventas", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const filtradas = useMemo(() => {
    return ventas.filter((v) => {
      const d = toDateOnly(v.fecha);
      if (desde && d < desde) return false;
      if (hasta && d > hasta) return false;
      return true;
    });
  }, [ventas, desde, hasta]);

  const filas = useMemo<RowCliente[]>(() => {
    const map = new Map<number | null, RowCliente>();
    filtradas.forEach((v) => {
      const id = v.cliente?.id ?? null;
      const nombre = v.cliente?.nombre || "Sin cliente";
      if (!map.has(id)) {
        map.set(id, { clienteId: id, nombre, tickets: 0, total: 0, promedio: 0 });
      }
      const row = map.get(id)!;
      row.tickets += 1;
      row.total += v.total || 0;
    });
    let arr = Array.from(map.values()).map((r) => ({
      ...r,
      promedio: r.tickets > 0 ? r.total / r.tickets : 0,
    }));
    if (filtroTexto) {
      const search = filtroTexto.toLowerCase();
      arr = arr.filter((r) => r.nombre.toLowerCase().includes(search));
    }
    return arr.sort((a, b) => b.total - a.total);
  }, [filtradas, filtroTexto]);

  const totalTickets = filas.reduce((sum, r) => sum + r.tickets, 0);
  const totalMonto = filas.reduce((sum, r) => sum + r.total, 0);

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">Top clientes</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<RefreshOutlined />}
            variant="outlined"
            size="small"
            onClick={cargar}
            disabled={loading}
          >
            Recargar
          </Button>
          <Button
            startIcon={<FileDownloadOutlined />}
            variant="outlined"
            size="small"
            onClick={() => exportCsv(filas)}
            disabled={!filas.length}
          >
            Excel/CSV
          </Button>
          <Button
            startIcon={<PictureAsPdfOutlined />}
            variant="contained"
            color="secondary"
            size="small"
            onClick={() => exportPdf(filas)}
            disabled={!filas.length}
          >
            PDF
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField
            label="Desde"
            type="date"
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField
            label="Hasta"
            type="date"
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label="Buscar cliente"
            fullWidth
            size="small"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ height: "100%" }}>
            <Chip label={`${filas.length} clientes`} />
            <Chip label={`Q ${totalMonto.toFixed(2)}`} color="success" />
          </Stack>
        </Grid>
      </Grid>

      <Divider sx={{ mb: 2 }} />

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Cliente</TableCell>
              <TableCell>Tickets</TableCell>
              <TableCell>Total</TableCell>
              <TableCell>Promedio ticket</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filas.map((row) => (
              <TableRow key={`${row.clienteId ?? "na"}`}>
                <TableCell>{row.nombre}</TableCell>
                <TableCell>{row.tickets}</TableCell>
                <TableCell>{`Q ${row.total.toFixed(2)}`}</TableCell>
                <TableCell>{`Q ${row.promedio.toFixed(2)}`}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Totales</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{totalTickets}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{`Q ${totalMonto.toFixed(2)}`}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
