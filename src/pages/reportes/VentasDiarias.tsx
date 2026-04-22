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
  metodoPago: string;
}

interface RowDiaria {
  fecha: string;
  tickets: number;
  total: number;
  efectivo: number;
  tarjeta: number;
  transferencia: number;
}

const metodoCuentaComoTarjeta = (metodo?: string | null) => {
  const normalized = `${metodo || ""}`.trim().toLowerCase();
  return normalized === "tarjeta" || normalized === "visalink";
};

const toDateOnly = (value: string) => {
  const d = new Date(value);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const exportCsv = (rows: RowDiaria[]) => {
  const headers = ["Fecha", "Tickets", "Total", "Efectivo", "Tarjeta", "Transferencia"];
  const lines = rows.map((r) =>
    [r.fecha, r.tickets, r.total, r.efectivo, r.tarjeta, r.transferencia]
      .map((v) => (typeof v === "number" ? v.toFixed(2) : v))
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ventas-diarias.csv";
  link.click();
  URL.revokeObjectURL(url);
};

const exportPdf = (rows: RowDiaria[]) => {
  const win = window.open("", "_blank");
  if (!win) {
    Swal.fire("Aviso", "Habilita ventanas emergentes para exportar a PDF", "info");
    return;
  }
  const rowsHtml = rows
    .map(
      (r) => `<tr>
        <td>${r.fecha}</td>
        <td>${r.tickets}</td>
        <td>Q ${r.total.toFixed(2)}</td>
        <td>Q ${r.efectivo.toFixed(2)}</td>
        <td>Q ${r.tarjeta.toFixed(2)}</td>
        <td>Q ${r.transferencia.toFixed(2)}</td>
      </tr>`
    )
    .join("");
  win.document.write(`<!doctype html>
  <html><head>
    <meta charset="utf-8" />
    <title>Ventas diarias</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
      h2 { margin: 0 0 12px 0; }
      table { border-collapse: collapse; width: 100%; font-size: 12px; }
      th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
      th { background: #0f172a; color: #fff; }
    </style>
  </head>
  <body>
    <h2>Reporte de ventas diarias</h2>
    <table>
      <thead>
        <tr><th>Fecha</th><th>Tickets</th><th>Total</th><th>Efectivo</th><th>Tarjeta</th><th>Transferencia</th></tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <script>window.onload = function(){window.print();}</script>
  </body></html>`);
  win.document.close();
};

export default function VentasDiarias() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [loading, setLoading] = useState(false);

  const cargar = async () => {
    try {
      setLoading(true);
      const resp = await api.get("/ventas");
      setVentas(resp.data || []);
    } catch (e) {
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

  const filas = useMemo<RowDiaria[]>(() => {
    const map = new Map<string, RowDiaria>();
    filtradas.forEach((v) => {
      const d = toDateOnly(v.fecha);
      if (!map.has(d)) {
        map.set(d, {
          fecha: d,
          tickets: 0,
          total: 0,
          efectivo: 0,
          tarjeta: 0,
          transferencia: 0,
        });
      }
      const row = map.get(d)!;
      row.tickets += 1;
      row.total += v.total || 0;
      if (v.metodoPago === "efectivo") row.efectivo += v.total || 0;
      else if (metodoCuentaComoTarjeta(v.metodoPago)) row.tarjeta += v.total || 0;
      else row.transferencia += v.total || 0;
    });
    return Array.from(map.values()).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  }, [filtradas]);

  const totalGeneral = filas.reduce(
    (acc, r) => ({
      tickets: acc.tickets + r.tickets,
      total: acc.total + r.total,
      efectivo: acc.efectivo + r.efectivo,
      tarjeta: acc.tarjeta + r.tarjeta,
      transferencia: acc.transferencia + r.transferencia,
    }),
    { tickets: 0, total: 0, efectivo: 0, tarjeta: 0, transferencia: 0 }
  );

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">Ventas diarias</Typography>
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
        <Grid size={{ xs: 12, sm: 3 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ height: "100%" }}>
            <Chip label={`${filas.length} días`} />
            <Chip label={`Q ${totalGeneral.total.toFixed(2)}`} color="success" />
          </Stack>
        </Grid>
      </Grid>

      <Divider sx={{ mb: 2 }} />

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Tickets</TableCell>
              <TableCell>Total</TableCell>
              <TableCell>Efectivo</TableCell>
              <TableCell>Tarjeta</TableCell>
              <TableCell>Transferencia</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filas.map((row) => (
              <TableRow key={row.fecha}>
                <TableCell>{row.fecha}</TableCell>
                <TableCell>{row.tickets}</TableCell>
                <TableCell>{`Q ${row.total.toFixed(2)}`}</TableCell>
                <TableCell>{`Q ${row.efectivo.toFixed(2)}`}</TableCell>
                <TableCell>{`Q ${row.tarjeta.toFixed(2)}`}</TableCell>
                <TableCell>{`Q ${row.transferencia.toFixed(2)}`}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Totales</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{totalGeneral.tickets}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{`Q ${totalGeneral.total.toFixed(2)}`}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{`Q ${totalGeneral.efectivo.toFixed(2)}`}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{`Q ${totalGeneral.tarjeta.toFixed(2)}`}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{`Q ${totalGeneral.transferencia.toFixed(2)}`}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
