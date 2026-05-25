import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Chip,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import SearchIcon from "@mui/icons-material/Search";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Swal from "sweetalert2";
import { api } from "../api/axios";

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
  tela?: { nombre?: string | null } | null;
  talla?: { nombre?: string | null } | null;
  color?: { nombre?: string | null } | null;
}

interface KardexRow {
  id: number;
  fecha: string;
  bodegaId: number;
  productoId: number;
  tipo: string;
  cantidad: number;
  referencia?: string | null;
  bodega?: Bodega | null;
  producto?: Producto | null;
}

const toInputDate = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 10);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "N/D";
  return new Date(value).toLocaleString("es-GT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const tipoColor = (tipo: string) => {
  const normalized = `${tipo || ""}`.toLowerCase();
  if (normalized.includes("entrada") || normalized.includes("ingreso")) return "success";
  if (normalized.includes("salida") || normalized.includes("venta")) return "error";
  if (normalized.includes("conteo")) return "warning";
  if (normalized.includes("traslado")) return "info";
  return "default";
};

const csvEscape = (value: unknown) => `"${`${value ?? ""}`.replace(/"/g, '""')}"`;

export default function KardexInventario() {
  const today = useMemo(() => toInputDate(new Date()), []);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [rows, setRows] = useState<KardexRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [desde, setDesde] = useState(today);
  const [hasta, setHasta] = useState(today);
  const [bodegaId, setBodegaId] = useState<number | "">("");
  const [productoId, setProductoId] = useState<number | "">("");
  const [tipo, setTipo] = useState("");
  const [referencia, setReferencia] = useState("");
  const [productoSearch, setProductoSearch] = useState("");

  const cargarCatalogos = useCallback(async () => {
    try {
      const [respBodegas, respProductos] = await Promise.all([
        api.get("/bodegas", { params: { operacion: "stock" } }),
        api.get("/productos"),
      ]);
      setBodegas(Array.isArray(respBodegas.data) ? respBodegas.data : []);
      setProductos(Array.isArray(respProductos.data) ? respProductos.data : []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar bodegas o productos", "error");
    }
  }, []);

  const cargarKardex = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await api.get("/inventario/kardex", {
        params: {
          desde: desde || undefined,
          hasta: hasta || undefined,
          bodegaId: bodegaId || undefined,
          productoId: productoId || undefined,
          tipo: tipo || undefined,
          referencia: referencia.trim() || undefined,
          limit: 1000,
        },
      });
      setRows(Array.isArray(resp.data) ? resp.data : []);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo cargar Kardex", "error");
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, bodegaId, productoId, tipo, referencia]);

  useEffect(() => {
    void cargarCatalogos();
  }, [cargarCatalogos]);

  useEffect(() => {
    void cargarKardex();
  }, [cargarKardex]);

  const productosFiltrados = useMemo(() => {
    const term = productoSearch.trim().toLowerCase();
    const source = term
      ? productos.filter((producto) =>
          `${producto.codigo} ${producto.nombre} ${producto.tipo || ""} ${producto.genero || ""}`.toLowerCase().includes(term),
        )
      : productos;
    return source.slice(0, 80);
  }, [productos, productoSearch]);

  const tiposDisponibles = useMemo(
    () => Array.from(new Set(rows.map((row) => row.tipo).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const totalEntradas = rows
    .filter((row) => Number(row.cantidad || 0) > 0 && !`${row.tipo}`.toLowerCase().includes("salida"))
    .reduce((sum, row) => sum + Number(row.cantidad || 0), 0);
  const totalSalidas = rows
    .filter((row) => `${row.tipo}`.toLowerCase().includes("salida") || `${row.tipo}`.toLowerCase().includes("venta"))
    .reduce((sum, row) => sum + Number(row.cantidad || 0), 0);
  const totalAjustes = rows
    .filter((row) => `${row.tipo}`.toLowerCase().includes("conteo"))
    .reduce((sum, row) => sum + Number(row.cantidad || 0), 0);

  const limpiar = () => {
    setDesde(today);
    setHasta(today);
    setBodegaId("");
    setProductoId("");
    setTipo("");
    setReferencia("");
    setProductoSearch("");
  };

  const exportarCsv = () => {
    const header = ["Fecha", "Bodega", "Codigo", "Producto", "Tipo", "Cantidad", "Referencia"];
    const body = rows.map((row) => [
      formatDateTime(row.fecha),
      row.bodega?.nombre || "",
      row.producto?.codigo || row.productoId,
      row.producto?.nombre || "",
      row.tipo,
      row.cantidad,
      row.referencia || "",
    ]);
    const csv = [header, ...body].map((line) => line.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "kardex-inventario.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns: GridColDef<KardexRow>[] = [
    { field: "fecha", headerName: "Fecha", width: 170, valueGetter: (_, row) => formatDateTime(row.fecha) },
    { field: "bodega", headerName: "Bodega", width: 170, valueGetter: (_, row) => row.bodega?.nombre || "N/D" },
    { field: "codigo", headerName: "Codigo", width: 140, valueGetter: (_, row) => row.producto?.codigo || row.productoId },
    { field: "producto", headerName: "Producto", flex: 1, minWidth: 220, valueGetter: (_, row) => row.producto?.nombre || "Producto" },
    {
      field: "tipo",
      headerName: "Movimiento",
      width: 170,
      renderCell: ({ row }) => <Chip size="small" color={tipoColor(row.tipo) as any} label={row.tipo} />,
    },
    { field: "cantidad", headerName: "Cantidad", width: 110, align: "center", headerAlign: "center" },
    { field: "referencia", headerName: "Referencia", flex: 1, minWidth: 220, valueGetter: (_, row) => row.referencia || "-" },
  ];

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <HistoryOutlined color="primary" />
          <div>
            <Typography variant="h4">Kardex de inventario</Typography>
            <Typography color="text.secondary">Historial completo de movimientos por bodega, producto y referencia.</Typography>
          </div>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<DownloadOutlined />} variant="outlined" onClick={exportarCsv} disabled={!rows.length}>
            Exportar CSV
          </Button>
          <Button startIcon={<RefreshOutlined />} variant="contained" onClick={cargarKardex} disabled={loading}>
            Actualizar
          </Button>
        </Stack>
      </Stack>

      <Divider sx={{ mb: 2 }} />

      <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap">
        <TextField label="Desde" type="date" size="small" value={desde} onChange={(e) => setDesde(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField label="Hasta" type="date" size="small" value={hasta} onChange={(e) => setHasta(e.target.value)} InputLabelProps={{ shrink: true }} />
        <FormControl size="small" sx={{ minWidth: 190 }}>
          <InputLabel>Bodega</InputLabel>
          <Select
            label="Bodega"
            value={bodegaId}
            onChange={(e) => {
              const value = e.target.value as number | "";
              setBodegaId(value === "" ? "" : Number(value));
            }}
          >
            <MenuItem value="">Todas</MenuItem>
            {bodegas.map((bodega) => (
              <MenuItem key={bodega.id} value={bodega.id}>{bodega.nombre}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Buscar producto"
          value={productoSearch}
          onChange={(e) => setProductoSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel>Producto</InputLabel>
          <Select
            label="Producto"
            value={productoId}
            onChange={(e) => {
              const value = e.target.value as number | "";
              setProductoId(value === "" ? "" : Number(value));
            }}
          >
            <MenuItem value="">Todos</MenuItem>
            {productosFiltrados.map((producto) => (
              <MenuItem key={producto.id} value={producto.id}>{producto.codigo} - {producto.nombre}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Tipo</InputLabel>
          <Select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <MenuItem value="">Todos</MenuItem>
            {tiposDisponibles.map((item) => (
              <MenuItem key={item} value={item}>{item}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField size="small" label="Referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
        <Button startIcon={<ClearIcon />} variant="outlined" onClick={limpiar}>Limpiar</Button>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
        <Paper variant="outlined" sx={{ p: 1.5, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Movimientos</Typography>
          <Typography variant="h5">{rows.length}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Entradas</Typography>
          <Typography variant="h5">{totalEntradas}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Salidas</Typography>
          <Typography variant="h5">{totalSalidas}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Ajustes conteo</Typography>
          <Typography variant="h5">{totalAjustes}</Typography>
        </Paper>
      </Stack>

      <div style={{ height: 640, width: "100%" }}>
        <DataGrid
          loading={loading}
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </div>
    </Paper>
  );
}
