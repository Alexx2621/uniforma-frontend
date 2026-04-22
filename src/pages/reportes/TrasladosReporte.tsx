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
import { PDF_FONT_FAMILY, PDF_FONT_SEMIBOLD_FAMILY } from "../../utils/fontFamily";
import { buildTrasladoPdfHtml } from "../../utils/trasladoPdf";

interface DetalleTraslado {
  productoId: number;
  cantidad: number;
}

interface Traslado {
  id: number;
  fecha: string;
  desdeBodegaId: number;
  haciaBodegaId: number;
  observaciones?: string | null;
  detalle: DetalleTraslado[];
  desdeBodega?: { nombre: string };
  haciaBodega?: { nombre: string };
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
  const headers = ["Folio", "Fecha", "Origen", "Destino", "Items", "Observaciones"];
  const lines = rows.map((r) =>
    [r.folio, r.fecha, r.origen, r.destino, r.items, r.observaciones?.replace(/,/g, " ") || ""].join(
      ","
    )
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "traslados.csv";
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
        <td>${r.origen}</td>
        <td>${r.destino}</td>
        <td>${r.items}</td>
        <td>${r.observaciones || ""}</td>
      </tr>`
    )
    .join("");
  win.document.write(`<!doctype html>
  <html><head>
    <meta charset="utf-8" />
    <title>Traslados</title>
    <style>
      body { font-family: ${PDF_FONT_FAMILY}; margin: 24px; color: #1f2937; }
      h2 { margin: 0 0 12px 0; font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; font-weight: 600; }
      table { border-collapse: collapse; width: 100%; font-size: 12px; }
      th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
      th { background: #0f172a; color: #fff; font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; font-weight: 600; }
    </style>
  </head>
  <body>
    <h2>Traslados de inventario</h2>
    <table>
      <thead>
        <tr><th>Folio</th><th>Fecha</th><th>Origen</th><th>Destino</th><th>Items</th><th>Observaciones</th></tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <script>window.onload = function(){window.print();}</script>
  </body></html>`);
  win.document.close();
};

export default function TrasladosReporte() {
  const [traslados, setTraslados] = useState<Traslado[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [telas, setTelas] = useState<CatalogoItem[]>([]);
  const [tallas, setTallas] = useState<CatalogoItem[]>([]);
  const [colores, setColores] = useState<CatalogoItem[]>([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [origenId, setOrigenId] = useState<string>("");
  const [destinoId, setDestinoId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const cargar = async () => {
    try {
      setLoading(true);
      const [resp, respBod, respProd, respTelas, respTallas, respColores] = await Promise.all([
        api.get("/traslados"),
        api.get("/bodegas"),
        api.get("/productos").catch(() => ({ data: [] })),
        api.get("/telas").catch(() => ({ data: [] })),
        api.get("/tallas").catch(() => ({ data: [] })),
        api.get("/colores").catch(() => ({ data: [] })),
      ]);
      setTraslados(resp.data || []);
      setBodegas(respBod.data || []);
      setProductos(respProd.data || []);
      setTelas(respTelas.data || []);
      setTallas(respTallas.data || []);
      setColores(respColores.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar traslados o bodegas", "error");
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
    return traslados
      .filter((t) => {
        const d = toDateOnly(t.fecha);
        if (desde && d < desde) return false;
        if (hasta && d > hasta) return false;
        if (origenId && t.desdeBodegaId !== Number(origenId)) return false;
        if (destinoId && t.haciaBodegaId !== Number(destinoId)) return false;
        return true;
      })
      .map((t) => {
        const fecha = toDateOnly(t.fecha);
        const origen =
          t.desdeBodega?.nombre || bodegas.find((b) => b.id === t.desdeBodegaId)?.nombre || `B-${t.desdeBodegaId}`;
        const destino =
          t.haciaBodega?.nombre || bodegas.find((b) => b.id === t.haciaBodegaId)?.nombre || `B-${t.haciaBodegaId}`;
        const items = t.detalle?.reduce((sum, d) => sum + (d.cantidad || 0), 0) || 0;
        return {
          traslado: t,
          folio: `TR-${t.id}`,
          fecha,
          origen,
          destino,
          items,
          observaciones: t.observaciones || "",
        };
      });
  }, [traslados, bodegas, desde, hasta, origenId, destinoId]);

  const reimprimirTrasladoPdf = (row: (typeof filas)[number]) => {
    const win = window.open("", "_blank");
    if (!win) {
      Swal.fire("Aviso", "Habilita ventanas emergentes para reimprimir el PDF", "info");
      return;
    }

    const traslado = row.traslado;
    const html = buildTrasladoPdfHtml({
      folio: row.folio,
      fecha: traslado?.fecha ? new Date(traslado.fecha) : new Date(),
      origen: row.origen,
      destino: row.destino,
      responsable: "Responsable",
      observaciones: row.observaciones || "",
      totalItems: row.items,
      logoUrl: LOGO_URL,
      items: (traslado?.detalle || []).map((item) => {
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
        <Typography variant="h4">Traslados</Typography>
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
            <InputLabel>Origen</InputLabel>
            <Select
              label="Origen"
              value={origenId}
              onChange={(e: SelectChangeEvent<string>) => {
                setOrigenId(e.target.value);
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
          <FormControl fullWidth size="small">
            <InputLabel>Destino</InputLabel>
            <Select
              label="Destino"
              value={destinoId}
              onChange={(e: SelectChangeEvent<string>) => {
                setDestinoId(e.target.value);
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
      </Grid>

      <Divider sx={{ mb: 2 }} />

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Folio</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>Origen</TableCell>
              <TableCell>Destino</TableCell>
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
                <TableCell>{row.origen}</TableCell>
                <TableCell>{row.destino}</TableCell>
                <TableCell>{row.items}</TableCell>
                <TableCell>{row.observaciones}</TableCell>
                <TableCell align="center">
                  <IconButton color="secondary" onClick={() => reimprimirTrasladoPdf(row)}>
                    <PictureAsPdfOutlined />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Totales</TableCell>
              <TableCell />
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
