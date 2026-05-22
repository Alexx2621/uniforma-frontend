import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddOutlined from "@mui/icons-material/AddOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import EditOutlined from "@mui/icons-material/EditOutlined";
import PlaylistAddOutlined from "@mui/icons-material/PlaylistAddOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import StraightenOutlined from "@mui/icons-material/StraightenOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";
import { formatCurrency } from "../utils/currency";

interface Catalogo {
  id: number;
  nombre: string;
}

interface Proveedor {
  id: number;
  nombre: string;
  nit?: string | null;
  estado?: string | null;
}

interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  tipo?: string | null;
  genero?: string | null;
  tela?: Catalogo | null;
  talla?: Catalogo | null;
  color?: Catalogo | null;
}

interface RolloTela {
  id: number;
  codigo: string;
  telaId: number;
  colorId?: number | null;
  bodegaId?: number | null;
  proveedorId?: number | null;
  proveedor?: string | null;
  lote?: string | null;
  tono?: string | null;
  ancho: number;
  unidad: string;
  cantidadInicial: number;
  cantidadDisponible: number;
  costoUnitario: number;
  ubicacion?: string | null;
  estado: string;
  fechaIngreso: string;
  observaciones?: string | null;
  tela?: Catalogo;
  color?: Catalogo | null;
  bodega?: Catalogo | null;
  proveedorRef?: Proveedor | null;
}

interface MovimientoTela {
  id: number;
  rolloId: number;
  tipo: string;
  cantidad: number;
  fecha: string;
  referencia?: string | null;
  motivo?: string | null;
  observaciones?: string | null;
  rollo?: RolloTela;
}

interface ConsumoTela {
  id: number;
  productoId: number;
  telaId?: number | null;
  tallaId?: number | null;
  cantidad: number;
  unidad: string;
  mermaPorcentaje: number;
  observaciones?: string | null;
  producto?: Producto;
  tela?: Catalogo | null;
  talla?: Catalogo | null;
}

const today = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const toDate = (value?: string | null) => (value ? value.slice(0, 10) : "");

const emptyRollo = {
  codigo: "",
  telaId: "",
  colorId: "",
  bodegaId: "",
  proveedorId: "",
  proveedor: "",
  lote: "",
  tono: "",
  ancho: "0",
  unidad: "metros",
  cantidadInicial: "0",
  cantidadDisponible: "0",
  costoUnitario: "0",
  ubicacion: "",
  estado: "disponible",
  fechaIngreso: today(),
  observaciones: "",
};

const emptyMovimiento = {
  rolloId: "",
  tipo: "ingreso",
  cantidad: "0",
  fecha: today(),
  referencia: "",
  motivo: "",
  observaciones: "",
};

const emptyConsumo = {
  productoId: "",
  telaId: "",
  tallaId: "",
  cantidad: "0",
  unidad: "metros",
  mermaPorcentaje: "0",
  observaciones: "",
};

export default function InventarioTelas() {
  const { rol, permisos } = useAuthStore();
  const canManage = hasPermission(rol, permisos, "inventario.telas.manage");
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [rollos, setRollos] = useState<RolloTela[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoTela[]>([]);
  const [consumos, setConsumos] = useState<ConsumoTela[]>([]);
  const [resumen, setResumen] = useState<any>(null);
  const [telas, setTelas] = useState<Catalogo[]>([]);
  const [colores, setColores] = useState<Catalogo[]>([]);
  const [bodegas, setBodegas] = useState<Catalogo[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [tallas, setTallas] = useState<Catalogo[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [filtros, setFiltros] = useState({ q: "", telaId: "", colorId: "", bodegaId: "", proveedorId: "", estado: "" });
  const [rolloDialog, setRolloDialog] = useState<{ open: boolean; editing?: RolloTela | null; form: any }>({
    open: false,
    editing: null,
    form: emptyRollo,
  });
  const [movDialog, setMovDialog] = useState<{ open: boolean; form: any }>({ open: false, form: emptyMovimiento });
  const [consumoDialog, setConsumoDialog] = useState<{ open: boolean; editing?: ConsumoTela | null; form: any }>({
    open: false,
    editing: null,
    form: emptyConsumo,
  });

  const loadCatalogos = async () => {
    const [respTelas, respColores, respBodegas, respProveedores, respTallas, respProductos] = await Promise.all([
      api.get("/telas"),
      api.get("/colores"),
      api.get("/bodegas"),
      api.get("/proveedores", { params: { estado: "activo" } }).catch(() => ({ data: [] })),
      api.get("/tallas"),
      api.get("/productos"),
    ]);
    setTelas(respTelas.data || []);
    setColores(respColores.data || []);
    setBodegas(respBodegas.data || []);
    setProveedores(respProveedores.data || []);
    setTallas(respTallas.data || []);
    setProductos(respProductos.data || []);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filtros).filter(([, value]) => value));
      const [respRollos, respMovimientos, respConsumos, respResumen] = await Promise.all([
        api.get("/inventario-telas/rollos", { params }),
        api.get("/inventario-telas/movimientos"),
        api.get("/inventario-telas/consumos"),
        api.get("/inventario-telas/resumen", { params }),
      ]);
      setRollos(respRollos.data || []);
      setMovimientos(respMovimientos.data || []);
      setConsumos(respConsumos.data || []);
      setResumen(respResumen.data || null);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo cargar inventario de telas", "error");
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    void loadCatalogos();
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openRollo = (row?: RolloTela) => {
    setRolloDialog({
      open: true,
      editing: row || null,
      form: row
        ? {
            codigo: row.codigo || "",
            telaId: String(row.telaId || ""),
            colorId: row.colorId ? String(row.colorId) : "",
            bodegaId: row.bodegaId ? String(row.bodegaId) : "",
            proveedorId: row.proveedorId ? String(row.proveedorId) : "",
            proveedor: row.proveedor || "",
            lote: row.lote || "",
            tono: row.tono || "",
            ancho: String(row.ancho || 0),
            unidad: row.unidad || "metros",
            cantidadInicial: String(row.cantidadInicial || 0),
            cantidadDisponible: String(row.cantidadDisponible || 0),
            costoUnitario: String(row.costoUnitario || 0),
            ubicacion: row.ubicacion || "",
            estado: row.estado || "disponible",
            fechaIngreso: toDate(row.fechaIngreso) || today(),
            observaciones: row.observaciones || "",
          }
        : emptyRollo,
    });
  };

  const saveRollo = async () => {
    try {
      const payload = { ...rolloDialog.form };
      if (rolloDialog.editing) {
        await api.patch(`/inventario-telas/rollos/${rolloDialog.editing.id}`, payload);
      } else {
        await api.post("/inventario-telas/rollos", payload);
      }
      setRolloDialog({ open: false, editing: null, form: emptyRollo });
      await loadData();
      Swal.fire("Listo", "Rollo guardado correctamente", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo guardar el rollo", "error");
    }
  };

  const deleteRollo = async (row: RolloTela) => {
    const result = await Swal.fire({
      title: "Eliminar rollo",
      text: `Se eliminara ${row.codigo}.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/inventario-telas/rollos/${row.id}`);
      await loadData();
      Swal.fire("Listo", "Rollo eliminado", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo eliminar", "error");
    }
  };

  const saveMovimiento = async () => {
    try {
      await api.post("/inventario-telas/movimientos", movDialog.form);
      setMovDialog({ open: false, form: emptyMovimiento });
      await loadData();
      Swal.fire("Listo", "Movimiento registrado", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo registrar movimiento", "error");
    }
  };

  const openConsumo = (row?: ConsumoTela) => {
    setConsumoDialog({
      open: true,
      editing: row || null,
      form: row
        ? {
            productoId: String(row.productoId || ""),
            telaId: row.telaId ? String(row.telaId) : "",
            tallaId: row.tallaId ? String(row.tallaId) : "",
            cantidad: String(row.cantidad || 0),
            unidad: row.unidad || "metros",
            mermaPorcentaje: String(row.mermaPorcentaje || 0),
            observaciones: row.observaciones || "",
          }
        : emptyConsumo,
    });
  };

  const saveConsumo = async () => {
    try {
      if (consumoDialog.editing) {
        await api.patch(`/inventario-telas/consumos/${consumoDialog.editing.id}`, consumoDialog.form);
      } else {
        await api.post("/inventario-telas/consumos", consumoDialog.form);
      }
      setConsumoDialog({ open: false, editing: null, form: emptyConsumo });
      await loadData();
      Swal.fire("Listo", "Consumo guardado", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo guardar consumo", "error");
    }
  };

  const deleteConsumo = async (row: ConsumoTela) => {
    const result = await Swal.fire({
      title: "Eliminar consumo",
      text: "Se eliminara esta regla de consumo estimado.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    await api.delete(`/inventario-telas/consumos/${row.id}`);
    await loadData();
  };

  const rolloColumns: GridColDef<RolloTela>[] = [
    { field: "codigo", headerName: "Rollo", width: 130 },
    { field: "tela", headerName: "Tela", width: 140, valueGetter: (_, row) => row.tela?.nombre || "N/D" },
    { field: "color", headerName: "Color", width: 130, valueGetter: (_, row) => row.color?.nombre || "N/D" },
    { field: "bodega", headerName: "Bodega", width: 140, valueGetter: (_, row) => row.bodega?.nombre || "Sin bodega" },
    { field: "proveedor", headerName: "Proveedor", width: 170, valueGetter: (_, row) => row.proveedorRef?.nombre || row.proveedor || "N/D" },
    { field: "lote", headerName: "Lote", width: 110 },
    { field: "tono", headerName: "Tono", width: 110 },
    { field: "ancho", headerName: "Ancho", width: 90 },
    { field: "cantidadDisponible", headerName: "Disponible", width: 120, valueFormatter: (value) => Number(value || 0).toFixed(2) },
    { field: "unidad", headerName: "Unidad", width: 95 },
    { field: "costoUnitario", headerName: "Costo", width: 110, valueFormatter: (value) => formatCurrency(Number(value || 0)) },
    {
      field: "valor",
      headerName: "Valor",
      width: 120,
      valueGetter: (_, row) => Number(row.cantidadDisponible || 0) * Number(row.costoUnitario || 0),
      valueFormatter: (value) => formatCurrency(Number(value || 0)),
    },
    {
      field: "estado",
      headerName: "Estado",
      width: 120,
      renderCell: ({ row }) => <Chip size="small" color={row.estado === "agotado" ? "error" : "success"} label={row.estado} />,
    },
    {
      field: "acciones",
      headerName: "Acciones",
      width: 150,
      sortable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" disabled={!canManage} onClick={() => openRollo(row)}>
            <EditOutlined fontSize="small" />
          </IconButton>
          <IconButton size="small" disabled={!canManage} onClick={() => setMovDialog({ open: true, form: { ...emptyMovimiento, rolloId: String(row.id) } })}>
            <PlaylistAddOutlined fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" disabled={!canManage} onClick={() => void deleteRollo(row)}>
            <DeleteOutline fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  const movimientoColumns: GridColDef<MovimientoTela>[] = [
    { field: "fecha", headerName: "Fecha", width: 120, valueFormatter: (value) => toDate(String(value || "")) },
    { field: "rollo", headerName: "Rollo", width: 130, valueGetter: (_, row) => row.rollo?.codigo || row.rolloId },
    { field: "tela", headerName: "Tela", width: 140, valueGetter: (_, row) => row.rollo?.tela?.nombre || "N/D" },
    { field: "tipo", headerName: "Tipo", width: 110 },
    { field: "cantidad", headerName: "Cantidad", width: 110, valueFormatter: (value) => Number(value || 0).toFixed(2) },
    { field: "referencia", headerName: "Referencia", width: 140 },
    { field: "motivo", headerName: "Motivo", width: 180 },
    { field: "observaciones", headerName: "Observaciones", flex: 1, minWidth: 180 },
  ];

  const consumoColumns: GridColDef<ConsumoTela>[] = [
    { field: "codigo", headerName: "Codigo", width: 130, valueGetter: (_, row) => row.producto?.codigo || "N/D" },
    { field: "producto", headerName: "Producto", width: 170, valueGetter: (_, row) => row.producto?.nombre || row.producto?.tipo || "N/D" },
    { field: "tela", headerName: "Tela", width: 140, valueGetter: (_, row) => row.tela?.nombre || row.producto?.tela?.nombre || "N/D" },
    { field: "talla", headerName: "Talla", width: 100, valueGetter: (_, row) => row.talla?.nombre || row.producto?.talla?.nombre || "N/D" },
    { field: "cantidad", headerName: "Consumo", width: 110, valueFormatter: (value) => Number(value || 0).toFixed(2) },
    { field: "unidad", headerName: "Unidad", width: 100 },
    { field: "mermaPorcentaje", headerName: "Merma %", width: 110 },
    { field: "observaciones", headerName: "Observaciones", flex: 1, minWidth: 180 },
    {
      field: "acciones",
      headerName: "Acciones",
      width: 120,
      sortable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" disabled={!canManage} onClick={() => openConsumo(row)}>
            <EditOutlined fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" disabled={!canManage} onClick={() => void deleteConsumo(row)}>
            <DeleteOutline fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  const productosOptions = useMemo(
    () =>
      productos
        .slice()
        .sort((a, b) => `${a.codigo}`.localeCompare(`${b.codigo}`))
        .map((p) => ({
          ...p,
          label: `${p.codigo} - ${p.tipo || p.nombre}${p.talla?.nombre ? ` / ${p.talla.nombre}` : ""}${p.color?.nombre ? ` / ${p.color.nombre}` : ""}`,
        })),
    [productos],
  );

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={600}>Inventario de telas</Typography>
          <Typography variant="body2" color="text.secondary">
            Control de rollos por tela, color, lote, tono y bodega. Sin reservas ni rebajas automaticas.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RefreshOutlined />} variant="outlined" onClick={() => void loadData()} disabled={loading}>
            Recargar
          </Button>
          <Button startIcon={<AddOutlined />} variant="contained" onClick={() => openRollo()} disabled={!canManage}>
            Nuevo rollo
          </Button>
        </Stack>
      </Stack>

      {!canManage && <Alert severity="info" sx={{ mb: 2 }}>Puedes consultar el inventario de telas. Para crear o editar necesitas permiso de gestion.</Alert>}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">Rollos</Typography>
            <Typography variant="h5" fontWeight={600}>{resumen?.rollos || 0}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">Cantidad disponible</Typography>
            <Typography variant="h5" fontWeight={600}>{Number(resumen?.totalDisponible || 0).toFixed(2)}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">Valor estimado</Typography>
            <Typography variant="h5" fontWeight={600}>{formatCurrency(Number(resumen?.valorEstimado || 0))}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">Agotados</Typography>
            <Typography variant="h5" fontWeight={600}>{resumen?.agotados || 0}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField label="Buscar" size="small" fullWidth value={filtros.q} onChange={(e) => setFiltros((prev) => ({ ...prev, q: e.target.value }))} />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField select label="Tela" size="small" fullWidth value={filtros.telaId} onChange={(e) => setFiltros((prev) => ({ ...prev, telaId: e.target.value }))}>
              <MenuItem value="">Todas</MenuItem>
              {telas.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField select label="Color" size="small" fullWidth value={filtros.colorId} onChange={(e) => setFiltros((prev) => ({ ...prev, colorId: e.target.value }))}>
              <MenuItem value="">Todos</MenuItem>
              {colores.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField select label="Bodega" size="small" fullWidth value={filtros.bodegaId} onChange={(e) => setFiltros((prev) => ({ ...prev, bodegaId: e.target.value }))}>
              <MenuItem value="">Todas</MenuItem>
              {bodegas.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField select label="Proveedor" size="small" fullWidth value={filtros.proveedorId} onChange={(e) => setFiltros((prev) => ({ ...prev, proveedorId: e.target.value }))}>
              <MenuItem value="">Todos</MenuItem>
              {proveedores.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField select label="Estado" size="small" fullWidth value={filtros.estado} onChange={(e) => setFiltros((prev) => ({ ...prev, estado: e.target.value }))}>
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="disponible">Disponible</MenuItem>
              <MenuItem value="agotado">Agotado</MenuItem>
              <MenuItem value="bloqueado">Bloqueado</MenuItem>
              <MenuItem value="danado">Dañado</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 1 }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ px: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Tab label="Rollos" />
          <Tab label="Movimientos" />
          <Tab label="Consumo estimado" />
        </Tabs>
        <Box sx={{ height: 620, p: 2 }}>
          {tab === 0 && <DataGrid rows={rollos} columns={rolloColumns} loading={loading} pageSizeOptions={[10, 25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }} />}
          {tab === 1 && (
            <Stack spacing={1} sx={{ height: "100%" }}>
              <Box><Button startIcon={<PlaylistAddOutlined />} variant="contained" size="small" disabled={!canManage} onClick={() => setMovDialog({ open: true, form: emptyMovimiento })}>Nuevo movimiento</Button></Box>
              <Box sx={{ flex: 1 }}><DataGrid rows={movimientos} columns={movimientoColumns} loading={loading} pageSizeOptions={[10, 25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }} /></Box>
            </Stack>
          )}
          {tab === 2 && (
            <Stack spacing={1} sx={{ height: "100%" }}>
              <Box><Button startIcon={<StraightenOutlined />} variant="contained" size="small" disabled={!canManage} onClick={() => openConsumo()}>Nuevo consumo</Button></Box>
              <Box sx={{ flex: 1 }}><DataGrid rows={consumos} columns={consumoColumns} loading={loading} pageSizeOptions={[10, 25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }} /></Box>
            </Stack>
          )}
        </Box>
      </Paper>

      <Dialog open={rolloDialog.open} onClose={() => setRolloDialog((prev) => ({ ...prev, open: false }))} maxWidth="md" fullWidth>
        <DialogTitle>{rolloDialog.editing ? "Editar rollo" : "Nuevo rollo"}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12, md: 4 }}><TextField label="Codigo" fullWidth value={rolloDialog.form.codigo} onChange={(e) => setRolloDialog((p) => ({ ...p, form: { ...p.form, codigo: e.target.value } }))} helperText="Si lo dejas vacio se genera automatico" /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField select label="Tela" fullWidth required value={rolloDialog.form.telaId} onChange={(e) => setRolloDialog((p) => ({ ...p, form: { ...p.form, telaId: e.target.value } }))}>{telas.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField select label="Color" fullWidth value={rolloDialog.form.colorId} onChange={(e) => setRolloDialog((p) => ({ ...p, form: { ...p.form, colorId: e.target.value } }))}><MenuItem value="">Sin color</MenuItem>{colores.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField select label="Bodega" fullWidth value={rolloDialog.form.bodegaId} onChange={(e) => setRolloDialog((p) => ({ ...p, form: { ...p.form, bodegaId: e.target.value } }))}><MenuItem value="">Sin bodega</MenuItem>{bodegas.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField select label="Proveedor" fullWidth value={rolloDialog.form.proveedorId} onChange={(e) => setRolloDialog((p) => ({ ...p, form: { ...p.form, proveedorId: e.target.value } }))}><MenuItem value="">Sin proveedor</MenuItem>{proveedores.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre}{item.nit ? ` - ${item.nit}` : ""}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField label="Proveedor manual" fullWidth value={rolloDialog.form.proveedor} onChange={(e) => setRolloDialog((p) => ({ ...p, form: { ...p.form, proveedor: e.target.value } }))} helperText="Usalo solo si aun no existe en catalogo" /></Grid>
            <Grid size={{ xs: 12, md: 2 }}><TextField label="Lote" fullWidth value={rolloDialog.form.lote} onChange={(e) => setRolloDialog((p) => ({ ...p, form: { ...p.form, lote: e.target.value } }))} /></Grid>
            <Grid size={{ xs: 12, md: 2 }}><TextField label="Tono" fullWidth value={rolloDialog.form.tono} onChange={(e) => setRolloDialog((p) => ({ ...p, form: { ...p.form, tono: e.target.value } }))} /></Grid>
            <Grid size={{ xs: 12, md: 3 }}><TextField label="Cantidad inicial" type="number" fullWidth value={rolloDialog.form.cantidadInicial} onChange={(e) => setRolloDialog((p) => ({ ...p, form: { ...p.form, cantidadInicial: e.target.value, cantidadDisponible: p.editing ? p.form.cantidadDisponible : e.target.value } }))} /></Grid>
            <Grid size={{ xs: 12, md: 3 }}><TextField label="Cantidad disponible" type="number" fullWidth value={rolloDialog.form.cantidadDisponible} onChange={(e) => setRolloDialog((p) => ({ ...p, form: { ...p.form, cantidadDisponible: e.target.value } }))} /></Grid>
            <Grid size={{ xs: 12, md: 2 }}><TextField label="Unidad" fullWidth value={rolloDialog.form.unidad} onChange={(e) => setRolloDialog((p) => ({ ...p, form: { ...p.form, unidad: e.target.value } }))} /></Grid>
            <Grid size={{ xs: 12, md: 2 }}><TextField label="Ancho" type="number" fullWidth value={rolloDialog.form.ancho} onChange={(e) => setRolloDialog((p) => ({ ...p, form: { ...p.form, ancho: e.target.value } }))} /></Grid>
            <Grid size={{ xs: 12, md: 2 }}><TextField label="Costo unitario" type="number" fullWidth value={rolloDialog.form.costoUnitario} onChange={(e) => setRolloDialog((p) => ({ ...p, form: { ...p.form, costoUnitario: e.target.value } }))} /></Grid>
            <Grid size={{ xs: 12, md: 3 }}><TextField label="Fecha ingreso" type="date" InputLabelProps={{ shrink: true }} fullWidth value={rolloDialog.form.fechaIngreso} onChange={(e) => setRolloDialog((p) => ({ ...p, form: { ...p.form, fechaIngreso: e.target.value } }))} /></Grid>
            <Grid size={{ xs: 12, md: 3 }}><TextField select label="Estado" fullWidth value={rolloDialog.form.estado} onChange={(e) => setRolloDialog((p) => ({ ...p, form: { ...p.form, estado: e.target.value } }))}><MenuItem value="disponible">Disponible</MenuItem><MenuItem value="agotado">Agotado</MenuItem><MenuItem value="bloqueado">Bloqueado</MenuItem><MenuItem value="danado">Dañado</MenuItem></TextField></Grid>
            <Grid size={{ xs: 12, md: 6 }}><TextField label="Ubicacion" fullWidth value={rolloDialog.form.ubicacion} onChange={(e) => setRolloDialog((p) => ({ ...p, form: { ...p.form, ubicacion: e.target.value } }))} /></Grid>
            <Grid size={{ xs: 12 }}><TextField label="Observaciones" multiline minRows={2} fullWidth value={rolloDialog.form.observaciones} onChange={(e) => setRolloDialog((p) => ({ ...p, form: { ...p.form, observaciones: e.target.value } }))} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRolloDialog((prev) => ({ ...prev, open: false }))}>Cancelar</Button>
          <Button variant="contained" onClick={() => void saveRollo()}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={movDialog.open} onClose={() => setMovDialog((prev) => ({ ...prev, open: false }))} maxWidth="sm" fullWidth>
        <DialogTitle>Movimiento de tela</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select label="Rollo" fullWidth value={movDialog.form.rolloId} onChange={(e) => setMovDialog((p) => ({ ...p, form: { ...p.form, rolloId: e.target.value } }))}>{rollos.map((r) => <MenuItem key={r.id} value={r.id}>{r.codigo} - {r.tela?.nombre} / {r.color?.nombre || "Sin color"}</MenuItem>)}</TextField>
            <TextField select label="Tipo" fullWidth value={movDialog.form.tipo} onChange={(e) => setMovDialog((p) => ({ ...p, form: { ...p.form, tipo: e.target.value } }))}><MenuItem value="ingreso">Ingreso</MenuItem><MenuItem value="salida">Salida manual</MenuItem><MenuItem value="merma">Merma</MenuItem><MenuItem value="ajuste">Ajuste a cantidad final</MenuItem></TextField>
            <TextField label="Cantidad" type="number" fullWidth value={movDialog.form.cantidad} onChange={(e) => setMovDialog((p) => ({ ...p, form: { ...p.form, cantidad: e.target.value } }))} />
            <TextField label="Fecha" type="date" InputLabelProps={{ shrink: true }} fullWidth value={movDialog.form.fecha} onChange={(e) => setMovDialog((p) => ({ ...p, form: { ...p.form, fecha: e.target.value } }))} />
            <TextField label="Referencia" fullWidth value={movDialog.form.referencia} onChange={(e) => setMovDialog((p) => ({ ...p, form: { ...p.form, referencia: e.target.value } }))} />
            <TextField label="Motivo" fullWidth value={movDialog.form.motivo} onChange={(e) => setMovDialog((p) => ({ ...p, form: { ...p.form, motivo: e.target.value } }))} />
            <TextField label="Observaciones" multiline minRows={2} fullWidth value={movDialog.form.observaciones} onChange={(e) => setMovDialog((p) => ({ ...p, form: { ...p.form, observaciones: e.target.value } }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMovDialog((prev) => ({ ...prev, open: false }))}>Cancelar</Button>
          <Button variant="contained" onClick={() => void saveMovimiento()}>Registrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={consumoDialog.open} onClose={() => setConsumoDialog((prev) => ({ ...prev, open: false }))} maxWidth="sm" fullWidth>
        <DialogTitle>{consumoDialog.editing ? "Editar consumo estimado" : "Nuevo consumo estimado"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select label="Producto" fullWidth value={consumoDialog.form.productoId} onChange={(e) => setConsumoDialog((p) => ({ ...p, form: { ...p.form, productoId: e.target.value } }))}>{productosOptions.map((p: any) => <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>)}</TextField>
            <TextField select label="Tela aplicable" fullWidth value={consumoDialog.form.telaId} onChange={(e) => setConsumoDialog((p) => ({ ...p, form: { ...p.form, telaId: e.target.value } }))}><MenuItem value="">Usar tela del producto</MenuItem>{telas.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre}</MenuItem>)}</TextField>
            <TextField select label="Talla aplicable" fullWidth value={consumoDialog.form.tallaId} onChange={(e) => setConsumoDialog((p) => ({ ...p, form: { ...p.form, tallaId: e.target.value } }))}><MenuItem value="">Usar talla del producto</MenuItem>{tallas.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre}</MenuItem>)}</TextField>
            <TextField label="Cantidad por unidad" type="number" fullWidth value={consumoDialog.form.cantidad} onChange={(e) => setConsumoDialog((p) => ({ ...p, form: { ...p.form, cantidad: e.target.value } }))} />
            <TextField label="Unidad" fullWidth value={consumoDialog.form.unidad} onChange={(e) => setConsumoDialog((p) => ({ ...p, form: { ...p.form, unidad: e.target.value } }))} />
            <TextField label="Merma %" type="number" fullWidth value={consumoDialog.form.mermaPorcentaje} onChange={(e) => setConsumoDialog((p) => ({ ...p, form: { ...p.form, mermaPorcentaje: e.target.value } }))} />
            <TextField label="Observaciones" multiline minRows={2} fullWidth value={consumoDialog.form.observaciones} onChange={(e) => setConsumoDialog((p) => ({ ...p, form: { ...p.form, observaciones: e.target.value } }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConsumoDialog((prev) => ({ ...prev, open: false }))}>Cancelar</Button>
          <Button variant="contained" onClick={() => void saveConsumo()}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
