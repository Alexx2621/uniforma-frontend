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
} from "@mui/material";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import Swal from "sweetalert2";
import { api } from "../../api/axios";

interface RowInv {
  productoId: number;
  bodegaId: number;
  codigo: string;
  producto: string;
  talla: string | null;
  color: string | null;
  tela: string | null;
  bodega: string;
  stock: number;
  stockMax: number;
  faltan: number;
}

const exportCsv = (rows: RowInv[]) => {
  const headers = ["Código", "Producto", "Bodega", "Stock", "Stock Max", "Faltan"];
  const lines = rows.map((r) =>
    [r.codigo, r.producto, r.bodega, r.stock, r.stockMax, r.faltan].join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "stock-bajo.csv";
  link.click();
  URL.revokeObjectURL(url);
};

const exportPdf = (rows: RowInv[]) => {
  const win = window.open("", "_blank");
  if (!win) {
    Swal.fire("Aviso", "Habilita ventanas emergentes para exportar a PDF", "info");
    return;
  }
  const rowsHtml = rows
    .map(
      (r) => `<tr>
        <td>${r.codigo}</td>
        <td>${r.producto}</td>
        <td>${r.bodega}</td>
        <td>${r.stock}</td>
        <td>${r.stockMax}</td>
        <td>${r.faltan}</td>
      </tr>`
    )
    .join("");
  win.document.write(`<!doctype html>
  <html><head>
    <meta charset="utf-8" />
    <title>Stock bajo</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
      h2 { margin: 0 0 12px 0; }
      table { border-collapse: collapse; width: 100%; font-size: 12px; }
      th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
      th { background: #0f172a; color: #fff; }
    </style>
  </head>
  <body>
    <h2>Stock bajo / rupturas</h2>
    <table>
      <thead>
        <tr><th>Código</th><th>Producto</th><th>Bodega</th><th>Stock</th><th>Stock Max</th><th>Faltan</th></tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <script>window.onload = function(){window.print();}</script>
  </body></html>`);
  win.document.close();
};

export default function StockBajo() {
  const [inventario, setInventario] = useState<RowInv[]>([]);
  const [bodega, setBodega] = useState<string | number>("");
  const [umbral, setUmbral] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const cargar = async () => {
    try {
      setLoading(true);
      const resp = await api.get("/inventario/reporte");
      setInventario(resp.data || []);
    } catch {
      Swal.fire("Error", "No se pudo cargar inventario", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const bodegas = useMemo(() => {
    const map = new Map<number, string>();
    inventario.forEach((r) => map.set(r.bodegaId, r.bodega));
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [inventario]);

  const filas = useMemo(() => {
    return inventario.filter((r) => {
      if (bodega && r.bodegaId !== Number(bodega)) return false;
      const faltantes = r.stockMax > 0 ? r.stockMax - r.stock : 0;
      if (umbral > 0) {
        return faltantes >= umbral;
      }
      return faltantes > 0;
    });
  }, [inventario, bodega, umbral]);

  const totalFaltantes = filas.reduce((sum, r) => sum + r.faltan, 0);

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">Stock bajo / rupturas</Typography>
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
          <FormControl fullWidth size="small">
            <InputLabel>Bodega</InputLabel>
            <Select
              label="Bodega"
              value={bodega === "" ? "" : bodega}
              onChange={(e) => setBodega(e.target.value === "" ? "" : Number(e.target.value))}
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
          <TextField
            label="Umbral mínimo faltantes"
            type="number"
            fullWidth
            size="small"
            value={umbral}
            onChange={(e) => setUmbral(Number(e.target.value))}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ height: "100%" }}>
            <Chip label={`${filas.length} líneas`} />
            <Chip label={`${totalFaltantes} faltantes`} color="warning" />
          </Stack>
        </Grid>
      </Grid>

      <Divider sx={{ mb: 2 }} />

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Producto</TableCell>
              <TableCell>Bodega</TableCell>
              <TableCell>Stock</TableCell>
              <TableCell>Stock Max</TableCell>
              <TableCell>Faltan</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filas.map((row) => (
              <TableRow key={`${row.productoId}-${row.bodegaId}`}>
                <TableCell>{row.codigo}</TableCell>
                <TableCell>{row.producto}</TableCell>
                <TableCell>{row.bodega}</TableCell>
                <TableCell>{row.stock}</TableCell>
                <TableCell>{row.stockMax}</TableCell>
                <TableCell>{row.faltan}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Totales</TableCell>
              <TableCell />
              <TableCell />
              <TableCell />
              <TableCell />
              <TableCell sx={{ fontWeight: 700 }}>{totalFaltantes}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
