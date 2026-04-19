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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from "@mui/material";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import Swal from "sweetalert2";
import { api } from "../../api/axios";

interface DetalleIngreso {
  cantidad: number;
}

interface Ingreso {
  id: number;
  fecha: string;
  bodegaId: number;
  observaciones?: string | null;
  detalle: DetalleIngreso[];
}

interface Bodega {
  id: number;
  nombre: string;
}

const toDateOnly = (value: string) => {
  const d = new Date(value);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const exportCsv = (rows: any[]) => {
  const headers = ["Folio", "Fecha", "Bodega", "Items", "Observaciones"];
  const lines = rows.map((r) =>
    [r.folio, r.fecha, r.bodega, r.items, r.observaciones?.replace(/,/g, " ") || ""].join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ingresos-inventario.csv";
  link.click();
  URL.revokeObjectURL(url);
};

const exportPdf = (rows: any[]) => {
  const win = window.open("", "_blank");
  if (!win) {
    Swal.fire("Aviso", "Habilita ventanas emergentes para exportar a PDF", "info");
    return;
  }
  const rowsHtml = rows
    .map(
      (r) => `<tr>
        <td>${r.folio}</td>
        <td>${r.fecha}</td>
        <td>${r.bodega}</td>
        <td>${r.items}</td>
        <td>${r.observaciones || ""}</td>
      </tr>`
    )
    .join("");
  win.document.write(`<!doctype html>
  <html><head>
    <meta charset="utf-8" />
    <title>Ingresos de inventario</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
      h2 { margin: 0 0 12px 0; }
      table { border-collapse: collapse; width: 100%; font-size: 12px; }
      th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
      th { background: #0f172a; color: #fff; }
    </style>
  </head>
  <body>
    <h2>Ingresos de inventario</h2>
    <table>
      <thead>
        <tr><th>Folio</th><th>Fecha</th><th>Bodega</th><th>Items</th><th>Observaciones</th></tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <script>window.onload = function(){window.print();}</script>
  </body></html>`);
  win.document.close();
};

export default function IngresosInventarioReporte() {
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [bodegaId, setBodegaId] = useState<string>("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [loading, setLoading] = useState(false);

  const cargar = async () => {
    try {
      setLoading(true);
      const [respIng, respBod] = await Promise.all([api.get("/ingresos"), api.get("/bodegas")]);
      setIngresos(respIng.data || []);
      setBodegas(respBod.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar ingresos o bodegas", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const filas = useMemo(() => {
    return ingresos
      .filter((ing) => {
        const d = toDateOnly(ing.fecha);
        if (desde && d < desde) return false;
        if (hasta && d > hasta) return false;
        if (bodegaId && ing.bodegaId !== Number(bodegaId)) return false;
        return true;
      })
      .map((ing) => {
        const fecha = toDateOnly(ing.fecha);
        const bodega = bodegas.find((b) => b.id === ing.bodegaId)?.nombre || `B-${ing.bodegaId}`;
        const items = ing.detalle?.reduce((sum, d) => sum + (d.cantidad || 0), 0) || 0;
        return {
          folio: `ING-${ing.id}`,
          fecha,
          bodega,
          items,
          observaciones: ing.observaciones || "",
        };
      });
  }, [ingresos, bodegas, desde, hasta, bodegaId]);

  const totalItems = filas.reduce((sum, r) => sum + r.items, 0);

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">Ingresos de inventario</Typography>
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
          <FormControl fullWidth size="small">
            <InputLabel>Bodega</InputLabel>
            <Select
              label="Bodega"
              value={bodegaId}
              onChange={(e: SelectChangeEvent<string>) => {
                setBodegaId(e.target.value);
              }}
            >
              <MenuItem value="">Todas</MenuItem>
              {bodegas.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ height: "100%" }}>
            <Chip label={`${filas.length} ingresos`} />
            <Chip label={`${totalItems} items`} color="primary" />
          </Stack>
        </Grid>
      </Grid>

      <Divider sx={{ mb: 2 }} />

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Folio</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>Bodega</TableCell>
              <TableCell>Items</TableCell>
              <TableCell>Observaciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filas.map((row) => (
              <TableRow key={row.folio}>
                <TableCell>{row.folio}</TableCell>
                <TableCell>{row.fecha}</TableCell>
                <TableCell>{row.bodega}</TableCell>
                <TableCell>{row.items}</TableCell>
                <TableCell>{row.observaciones}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Totales</TableCell>
              <TableCell />
              <TableCell />
              <TableCell sx={{ fontWeight: 700 }}>{totalItems}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
