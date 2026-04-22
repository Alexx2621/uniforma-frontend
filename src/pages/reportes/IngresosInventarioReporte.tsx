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
  IconButton,
} from "@mui/material";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import Swal from "sweetalert2";
import { api } from "../../api/axios";
import LOGO_URL from "../../assets/3-logos.png";
import { buildIngresoInventarioPdfHtml } from "../../utils/inventarioPdf";

interface DetalleIngreso {
  productoId: number;
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

interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  tipo?: string | null;
  genero?: string | null;
  tela?: { id?: number; nombre?: string } | null;
  talla?: { id?: number; nombre?: string } | null;
  color?: { id?: number; nombre?: string } | null;
  telaId?: number | null;
  tallaId?: number | null;
  colorId?: number | null;
  tela_id?: number | null;
  talla_id?: number | null;
  color_id?: number | null;
}

interface CatalogoItem {
  id: number;
  nombre?: string | null;
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
  const [productos, setProductos] = useState<Producto[]>([]);
  const [telas, setTelas] = useState<CatalogoItem[]>([]);
  const [tallas, setTallas] = useState<CatalogoItem[]>([]);
  const [colores, setColores] = useState<CatalogoItem[]>([]);
  const [bodegaId, setBodegaId] = useState<string>("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [loading, setLoading] = useState(false);

  const cargar = async () => {
    try {
      setLoading(true);
      const [respIng, respBod, respProd, respTelas, respTallas, respColores] = await Promise.all([
        api.get("/ingresos"),
        api.get("/bodegas"),
        api.get("/productos").catch(() => ({ data: [] })),
        api.get("/telas").catch(() => ({ data: [] })),
        api.get("/tallas").catch(() => ({ data: [] })),
        api.get("/colores").catch(() => ({ data: [] })),
      ]);
      setIngresos(respIng.data || []);
      setBodegas(respBod.data || []);
      setProductos(respProd.data || []);
      setTelas(respTelas.data || []);
      setTallas(respTallas.data || []);
      setColores(respColores.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar ingresos o bodegas", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const obtenerTela = (prod?: Producto) => {
    if (!prod) return "N/D";
    const telaId =
      prod.telaId ?? prod.tela_id ?? prod.tela?.id ?? (prod as any).telaid ?? (prod as any).tela_id ?? null;
    return prod.tela?.nombre || (prod as any).telaNombre || telas.find((t) => Number(t.id) === Number(telaId))?.nombre || "N/D";
  };

  const obtenerTalla = (prod?: Producto) => {
    if (!prod) return "N/D";
    const tallaId =
      prod.tallaId ?? prod.talla_id ?? prod.talla?.id ?? (prod as any).tallaid ?? (prod as any).talla_id ?? null;
    return (
      prod.talla?.nombre || (prod as any).tallaNombre || tallas.find((t) => Number(t.id) === Number(tallaId))?.nombre || "N/D"
    );
  };

  const obtenerColor = (prod?: Producto) => {
    if (!prod) return "N/D";
    const colorId =
      prod.colorId ?? prod.color_id ?? prod.color?.id ?? (prod as any).colorid ?? (prod as any).color_id ?? null;
    return (
      prod.color?.nombre || (prod as any).colorNombre || colores.find((c) => Number(c.id) === Number(colorId))?.nombre || "N/D"
    );
  };

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
          ingreso: ing,
          folio: `ING-${ing.id}`,
          fecha,
          bodega,
          items,
          observaciones: ing.observaciones || "",
        };
      });
  }, [ingresos, bodegas, desde, hasta, bodegaId]);

  const reimprimirIngresoPdf = (row: (typeof filas)[number]) => {
    const win = window.open("", "_blank");
    if (!win) {
      Swal.fire("Aviso", "Habilita ventanas emergentes para reimprimir el PDF", "info");
      return;
    }

    const ingreso = row.ingreso;
    const html = buildIngresoInventarioPdfHtml({
      folio: row.folio,
      fecha: ingreso?.fecha ? new Date(ingreso.fecha) : new Date(),
      bodega: row.bodega,
      responsable: "Responsable",
      observaciones: row.observaciones || "",
      totalItems: row.items,
      logoUrl: LOGO_URL,
      items: (ingreso?.detalle || []).map((item) => {
        const producto = productos.find((p) => p.id === Number(item.productoId));
        return {
          codigo: producto?.codigo || `${item.productoId}`,
          nombre: producto?.nombre || "Producto",
          tipo: producto?.tipo || "N/D",
          genero: producto?.genero || "N/D",
          tela: obtenerTela(producto),
          talla: obtenerTalla(producto),
          color: obtenerColor(producto),
          cantidad: Number(item.cantidad) || 0,
        };
      }),
    });

    win.document.write(html);
    win.document.close();
  };

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
              <TableCell align="center">Acciones</TableCell>
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
                <TableCell align="center">
                  <IconButton color="secondary" onClick={() => reimprimirIngresoPdf(row)}>
                    <PictureAsPdfOutlined />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Totales</TableCell>
              <TableCell />
              <TableCell />
              <TableCell sx={{ fontWeight: 700 }}>{totalItems}</TableCell>
              <TableCell />
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
