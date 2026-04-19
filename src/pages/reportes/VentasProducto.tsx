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

interface VentaDetalle {
  productoId: number;
  cantidad: number;
  precioUnit: number;
  bordado: number;
  descuento: number;
}

interface Venta {
  id: number;
  fecha: string;
  detalle: VentaDetalle[];
}

interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  categoriaId?: number | null;
}

interface RowProducto {
  productoId: number;
  codigo: string;
  nombre: string;
  unidades: number;
  ingresos: number;
}

const toDateOnly = (value: string) => {
  const d = new Date(value);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const calcSubtotal = (d: VentaDetalle) => {
  const precio = d.precioUnit * (1 - (d.descuento || 0) / 100);
  return d.cantidad * (precio + (d.bordado || 0));
};

const exportCsv = (rows: RowProducto[]) => {
  const headers = ["Codigo", "Producto", "Unidades", "Ingresos"];
  const lines = rows.map((r) =>
    [r.codigo, r.nombre, r.unidades, r.ingresos.toFixed(2)].join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ventas-por-producto.csv";
  link.click();
  URL.revokeObjectURL(url);
};

const exportPdf = (rows: RowProducto[]) => {
  const win = window.open("", "_blank");
  if (!win) {
    Swal.fire("Aviso", "Habilita ventanas emergentes para exportar a PDF", "info");
    return;
  }
  const rowsHtml = rows
    .map(
      (r) => `<tr>
        <td>${r.codigo}</td>
        <td>${r.nombre}</td>
        <td>${r.unidades}</td>
        <td>Q ${r.ingresos.toFixed(2)}</td>
      </tr>`
    )
    .join("");
  win.document.write(`<!doctype html>
  <html><head>
    <meta charset="utf-8" />
    <title>Ventas por producto</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
      h2 { margin: 0 0 12px 0; }
      table { border-collapse: collapse; width: 100%; font-size: 12px; }
      th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
      th { background: #0f172a; color: #fff; }
    </style>
  </head>
  <body>
    <h2>Reporte de ventas por producto</h2>
    <table>
      <thead>
        <tr><th>Código</th><th>Producto</th><th>Unidades</th><th>Ingresos</th></tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <script>window.onload = function(){window.print();}</script>
  </body></html>`);
  win.document.close();
};

export default function VentasProducto() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [filtroTexto, setFiltroTexto] = useState("");
  const [loading, setLoading] = useState(false);

  const cargar = async () => {
    try {
      setLoading(true);
      const [respVentas, respProd] = await Promise.all([api.get("/ventas"), api.get("/productos")]);
      setVentas(respVentas.data || []);
      setProductos(respProd.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar ventas o productos", "error");
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

  const filas = useMemo<RowProducto[]>(() => {
    const map = new Map<number, RowProducto>();
    filtradas.forEach((venta) => {
      venta.detalle?.forEach((d) => {
        if (!map.has(d.productoId)) {
          const prod = productos.find((p) => p.id === d.productoId);
          map.set(d.productoId, {
            productoId: d.productoId,
            codigo: prod?.codigo || `P-${d.productoId}`,
            nombre: prod?.nombre || "Producto",
            unidades: 0,
            ingresos: 0,
          });
        }
        const row = map.get(d.productoId)!;
        row.unidades += d.cantidad || 0;
        row.ingresos += calcSubtotal(d);
      });
    });
    let arr = Array.from(map.values());
    if (filtroTexto) {
      const search = filtroTexto.toLowerCase();
      arr = arr.filter(
        (r) => r.codigo.toLowerCase().includes(search) || r.nombre.toLowerCase().includes(search)
      );
    }
    return arr.sort((a, b) => b.ingresos - a.ingresos);
  }, [filtradas, productos, filtroTexto]);

  const totalUnidades = filas.reduce((sum, r) => sum + r.unidades, 0);
  const totalIngresos = filas.reduce((sum, r) => sum + r.ingresos, 0);

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">Ventas por producto</Typography>
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
            label="Buscar producto"
            fullWidth
            size="small"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ height: "100%" }}>
            <Chip label={`${filas.length} productos`} />
            <Chip label={`Q ${totalIngresos.toFixed(2)}`} color="success" />
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
              <TableCell>Unidades</TableCell>
              <TableCell>Ingresos</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filas.map((row) => (
              <TableRow key={row.productoId}>
                <TableCell>{row.codigo}</TableCell>
                <TableCell>{row.nombre}</TableCell>
                <TableCell>{row.unidades}</TableCell>
                <TableCell>{`Q ${row.ingresos.toFixed(2)}`}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Totales</TableCell>
              <TableCell />
              <TableCell sx={{ fontWeight: 700 }}>{totalUnidades}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{`Q ${totalIngresos.toFixed(2)}`}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
