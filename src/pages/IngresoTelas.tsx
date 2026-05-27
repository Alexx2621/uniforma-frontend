import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddBusinessOutlined from "@mui/icons-material/AddBusinessOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";
import { formatCurrency } from "../utils/currency";

interface Catalogo { id: number; nombre: string }
interface Proveedor { id: number; nombre: string; nit?: string | null }
interface ColorAlias {
  id: number;
  proveedorId: number;
  colorId: number;
  codigoProveedor?: string | null;
  nombreProveedor: string;
  activo: boolean;
}

interface IngresoTelaDetalle {
  id: number;
  linea: number;
  telaId?: number | null;
  bodegaId?: number | null;
  colorId?: number | null;
  rolloId?: number | null;
  proveedorCodigo?: string | null;
  proveedorNombre?: string | null;
  descripcionFactura: string;
  cantidad: number;
  unidad?: string | null;
  costoUnitario: number;
  total: number;
  lote?: string | null;
  tono?: string | null;
  ancho: number;
  ubicacion?: string | null;
  estado: string;
  tela?: Catalogo | null;
  bodega?: Catalogo | null;
  color?: Catalogo | null;
}

interface IngresoTela {
  id: number;
  correlativo: string;
  fecha: string;
  estado: string;
  observaciones?: string | null;
  proveedor?: Proveedor | null;
  proveedorId?: number | null;
  documentoTipo?: string | null;
  documentoReferencia?: string | null;
  documentoTotal?: number | null;
  facturaProveedor?: { id: number; serie?: string | null; numeroFactura?: string | null; total?: number | null } | null;
  detalle: IngresoTelaDetalle[];
}

const input = (value: any) => `${value ?? ""}`;
const today = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};
const emptyManualLine = {
  descripcionFactura: "",
  proveedorNombre: "",
  proveedorCodigo: "",
  tono: "",
  telaId: "",
  bodegaId: "",
  colorId: "",
  cantidad: "0",
  unidad: "metros",
  costoUnitario: "0",
  total: "0",
  lote: "",
  ancho: "0",
  ubicacion: "",
  observaciones: "",
};

export default function IngresoTelas() {
  const { rol, permisos } = useAuthStore();
  const canManage = hasPermission(rol, permisos, "inventario.telas.manage");
  const [rows, setRows] = useState<IngresoTela[]>([]);
  const [telas, setTelas] = useState<Catalogo[]>([]);
  const [bodegas, setBodegas] = useState<Catalogo[]>([]);
  const [colores, setColores] = useState<Catalogo[]>([]);
  const [colorAliases, setColorAliases] = useState<ColorAlias[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({ estado: "", proveedorId: "" });
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [rowCount, setRowCount] = useState(0);
  const [dialog, setDialog] = useState<{ open: boolean; ingreso: IngresoTela | null; detalle: IngresoTelaDetalle[] }>({
    open: false,
    ingreso: null,
    detalle: [],
  });
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    proveedorId: "",
    documentoTipo: "recibo",
    documentoReferencia: "",
    documentoTotal: "0",
    fecha: today(),
    observaciones: "",
    detalle: [emptyManualLine],
  });

  const normalize = (value: any) =>
    `${value ?? ""}`.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
  const normalizeProviderCode = (value: any) => `${value ?? ""}`.replace(/^#\s*/, "").trim().toUpperCase();

  const detectarColorProveedor = (item: Partial<IngresoTelaDetalle>) => {
    const descripcion = `${item.descripcionFactura || ""}`.replace(/\s+/g, " ").trim();
    const codigo = `${item.proveedorCodigo || item.lote || ""}`.trim();
    if (codigo && descripcion.includes(codigo)) {
      const afterCode = descripcion.slice(descripcion.indexOf(codigo) + codigo.length).replace(/^[@#\s-]+/, "").trim();
      const token = afterCode.replace(/@.*$/g, "").replace(/\b\d+(?:\.\d+)?$/g, "").replace(/[,\-/\s]+$/g, "").trim();
      if (token) return token;
    }
    const token = descripcion.match(/#?\d+[A-Z0-9-]*\s+(.+?)(?:@|\s+\d+(?:\.\d+)?\s*$|$)/i)?.[1]?.trim();
    return token || `${item.tono || ""}`.trim();
  };

  const detectarLoteProveedor = (item: Partial<IngresoTelaDetalle>) => {
    const descripcion = `${item.descripcionFactura || ""}`.replace(/\s+/g, " ").trim();
    const lote = descripcion.match(/@([A-Z0-9-]+)/i)?.[1]?.trim();
    return lote || `${item.lote || ""}`.trim();
  };

  const resolverColorProveedor = (proveedorId: any, item: Partial<IngresoTelaDetalle>) => {
    const colorProveedor = detectarColorProveedor(item);
    const codigoProveedor = normalizeProviderCode(item.proveedorCodigo);
    const colorNormalizado = normalize(colorProveedor);
    const alias = colorAliases.find((row) => {
      if (Number(row.proveedorId) !== Number(proveedorId) || row.activo === false) return false;
      const codigo = normalizeProviderCode(row.codigoProveedor);
      const nombre = normalize(row.nombreProveedor);
      return Boolean((nombre && colorNormalizado && nombre === colorNormalizado) || (codigo && codigoProveedor && codigo === codigoProveedor));
    });
    return { colorProveedor, colorId: alias?.colorId || item.colorId || "" };
  };

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        ...Object.fromEntries(Object.entries(filtros).filter(([, value]) => value)),
        page: paginationModel.page,
        pageSize: paginationModel.pageSize,
      };
      const [respIng, respTelas, respBod, respCol, respColorAliases, respProv] = await Promise.all([
        api.get("/inventario-telas/ingresos", { params }),
        api.get("/telas"),
        api.get("/bodegas"),
        api.get("/colores"),
        api.get("/colores/proveedor-aliases").catch(() => ({ data: [] })),
        api.get("/proveedores", { params: { estado: "activo" } }).catch(() => ({ data: [] })),
      ]);
      const payload = respIng.data;
      setRows(Array.isArray(payload) ? payload : payload?.data || []);
      setRowCount(Array.isArray(payload) ? payload.length : Number(payload?.total || 0));
      setTelas(respTelas.data || []);
      setBodegas(respBod.data || []);
      setColores(respCol.data || []);
      setColorAliases(respColorAliases.data || []);
      setProveedores(respProv.data || []);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudieron cargar ingresos de telas", "error");
    } finally {
      setLoading(false);
    }
  }, [filtros, paginationModel]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const resumen = useMemo(() => {
    const abiertos = rows.filter((row) => row.estado !== "cerrado").length;
    const pendientes = rows.reduce((sum, row) => sum + row.detalle.filter((item) => !item.rolloId).length, 0);
    const total = rows.reduce((sum, row) => sum + Number(row.facturaProveedor?.total || row.documentoTotal || 0), 0);
    return { documentos: rows.length, abiertos, pendientes, total };
  }, [rows]);

  const abrir = async (row: IngresoTela) => {
    const { data } = await api.get(`/inventario-telas/ingresos/${row.id}`);
    const proveedorId = data.proveedorId || data.proveedor?.id;
    const detalle = (data.detalle || []).map((item: IngresoTelaDetalle) => {
      const match = resolverColorProveedor(proveedorId, item);
      const loteDetectado = detectarLoteProveedor(item);
      return {
        ...item,
        tono: match.colorProveedor || item.tono,
        lote: !item.lote || item.lote === item.proveedorCodigo ? loteDetectado : item.lote,
        colorId: match.colorId || item.colorId,
      };
    });
    setDialog({ open: true, ingreso: data, detalle });
  };

  const setDetalleValue = (index: number, field: keyof IngresoTelaDetalle, value: any) => {
    setDialog((prev) => ({
      ...prev,
      detalle: prev.detalle.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, [field]: value };
        if (field === "tono" || field === "descripcionFactura" || field === "proveedorCodigo") {
          const match = resolverColorProveedor(prev.ingreso?.proveedorId || prev.ingreso?.proveedor?.id, next);
          next.tono = match.colorProveedor || next.tono;
          next.lote = detectarLoteProveedor(next) || next.lote;
          if (match.colorId) next.colorId = Number(match.colorId);
        }
        return next;
      }),
    }));
  };

  const setManualLineValue = (index: number, field: string, value: any) => {
    setManualForm((prev) => ({
      ...prev,
      detalle: prev.detalle.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next: any = { ...item, [field]: value };
        if (field === "tono" || field === "descripcionFactura" || field === "proveedorCodigo") {
          const match = resolverColorProveedor(prev.proveedorId, next);
          next.tono = match.colorProveedor || next.tono;
          next.lote = detectarLoteProveedor(next) || next.lote;
          if (match.colorId) next.colorId = String(match.colorId);
        }
        if (field === "cantidad" || field === "costoUnitario") {
          next.total = String(Number(next.cantidad || 0) * Number(next.costoUnitario || 0));
        }
        return next;
      }),
    }));
  };

  const crearManual = async () => {
    try {
      const { data } = await api.post("/inventario-telas/ingresos", manualForm);
      setManualOpen(false);
      setManualForm({ proveedorId: "", documentoTipo: "recibo", documentoReferencia: "", documentoTotal: "0", fecha: today(), observaciones: "", detalle: [emptyManualLine] });
      await cargar();
      await abrir(data);
      Swal.fire("Listo", "Ingreso manual creado", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo crear el ingreso", "error");
    }
  };

  const guardarLinea = async (item: IngresoTelaDetalle) => {
    if (!dialog.ingreso) return;
    await api.patch(`/inventario-telas/ingresos/${dialog.ingreso.id}/detalle/${item.id}`, item);
  };

  const eliminarLinea = async (item: IngresoTelaDetalle) => {
    if (!dialog.ingreso) return;
    const result = await Swal.fire({
      title: "Eliminar linea",
      text: `Se eliminara la linea ${item.linea}.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    try {
      const { data } = await api.delete(`/inventario-telas/ingresos/${dialog.ingreso.id}/detalle/${item.id}`);
      setDialog({ open: true, ingreso: data, detalle: data.detalle || [] });
      await cargar();
      Swal.fire("Listo", "Linea eliminada", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo eliminar la linea", "error");
    }
  };

  const eliminarIngreso = async (row: IngresoTela) => {
    const result = await Swal.fire({
      title: "Eliminar ingreso",
      text: `Se eliminara ${row.correlativo}. Esta accion no se puede deshacer.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/inventario-telas/ingresos/${row.id}`);
      await cargar();
      Swal.fire("Listo", "Ingreso eliminado", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo eliminar el ingreso", "error");
    }
  };

  const guardarTodo = async () => {
    if (!dialog.ingreso) return;
    try {
      for (const item of dialog.detalle) await guardarLinea(item);
      const { data } = await api.get(`/inventario-telas/ingresos/${dialog.ingreso.id}`);
      setDialog({ open: true, ingreso: data, detalle: data.detalle || [] });
      await cargar();
      Swal.fire("Listo", "Lineas actualizadas", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudieron guardar las lineas", "error");
    }
  };

  const procesar = async () => {
    if (!dialog.ingreso) return;
    const incompletas = dialog.detalle.filter((item) => !item.rolloId && (!item.telaId || !item.bodegaId || Number(item.cantidad || 0) <= 0));
    if (incompletas.length) {
      Swal.fire("Faltan datos", "Todas las lineas pendientes deben tener tela, bodega y cantidad mayor a cero.", "warning");
      return;
    }
    const result = await Swal.fire({
      title: "Ingresar telas",
      text: "Se crearan rollos en inventario para las lineas que tengan tela, bodega y cantidad.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ingresar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    try {
      await guardarTodo();
      await api.post(`/inventario-telas/ingresos/${dialog.ingreso.id}/procesar`);
      setDialog({ open: false, ingreso: null, detalle: [] });
      await cargar();
      Swal.fire("Listo", "Ingreso procesado y rollos creados", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo procesar el ingreso", "error");
    }
  };

  const columns: GridColDef<IngresoTela>[] = [
    { field: "correlativo", headerName: "Documento", width: 130 },
    { field: "fecha", headerName: "Fecha", width: 120, valueFormatter: (value) => input(value).slice(0, 10) },
    { field: "proveedor", headerName: "Proveedor", minWidth: 210, flex: 1, valueGetter: (_, row) => row.proveedor?.nombre || "N/D" },
    { field: "factura", headerName: "Documento origen", width: 190, valueGetter: (_, row) => row.documentoReferencia || `${row.facturaProveedor?.serie || ""}-${row.facturaProveedor?.numeroFactura || ""}`.replace(/^-|-$/g, "") || "N/D" },
    { field: "lineas", headerName: "Lineas", width: 95, valueGetter: (_, row) => row.detalle.length },
    { field: "pendientes", headerName: "Pendientes", width: 115, valueGetter: (_, row) => row.detalle.filter((item) => !item.rolloId).length },
    { field: "total", headerName: "Total doc.", width: 130, valueGetter: (_, row) => Number(row.facturaProveedor?.total || row.documentoTotal || 0), valueFormatter: (value) => formatCurrency(Number(value || 0)) },
    {
      field: "estado",
      headerName: "Estado",
      width: 120,
      renderCell: ({ row }) => <Chip size="small" color={row.estado === "cerrado" ? "success" : row.estado === "parcial" ? "info" : "warning"} label={row.estado} />,
    },
    {
      field: "acciones",
      headerName: "Acciones",
      width: 160,
      sortable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          <Button size="small" endIcon={<OpenInNewOutlined />} onClick={() => void abrir(row)}>
            Revisar
          </Button>
          <Button
            size="small"
            color="error"
            disabled={!canManage || row.estado !== "abierto" || row.detalle.some((item) => Boolean(item.rolloId))}
            onClick={() => void eliminarIngreso(row)}
          >
            <DeleteOutline fontSize="small" />
          </Button>
        </Stack>
      ),
    },
  ];

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={600}>Ingreso de telas</Typography>
          <Typography variant="body2" color="text.secondary">
            Documentos abiertos generados desde facturas, recibos o referencias de proveedores de telas para crear rollos en inventario.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RefreshOutlined />} variant="outlined" onClick={() => void cargar()} disabled={loading}>
            Recargar
          </Button>
          <Button startIcon={<AddOutlined />} variant="contained" onClick={() => setManualOpen(true)} disabled={!canManage}>
            Nuevo ingreso
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><Paper variant="outlined" sx={{ p: 2 }}><Typography variant="caption" color="text.secondary">Documentos</Typography><Typography variant="h5">{resumen.documentos}</Typography></Paper></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><Paper variant="outlined" sx={{ p: 2 }}><Typography variant="caption" color="text.secondary">Abiertos</Typography><Typography variant="h5">{resumen.abiertos}</Typography></Paper></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><Paper variant="outlined" sx={{ p: 2 }}><Typography variant="caption" color="text.secondary">Lineas pendientes</Typography><Typography variant="h5">{resumen.pendientes}</Typography></Paper></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><Paper variant="outlined" sx={{ p: 2 }}><Typography variant="caption" color="text.secondary">Total documentos</Typography><Typography variant="h5">{formatCurrency(resumen.total)}</Typography></Paper></Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField select label="Estado" size="small" fullWidth value={filtros.estado} onChange={(e) => { setPaginationModel((p) => ({ ...p, page: 0 })); setFiltros((p) => ({ ...p, estado: e.target.value })); }}>
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="abierto">Abierto</MenuItem>
              <MenuItem value="parcial">Parcial</MenuItem>
              <MenuItem value="cerrado">Cerrado</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField select label="Proveedor" size="small" fullWidth value={filtros.proveedorId} onChange={(e) => { setPaginationModel((p) => ({ ...p, page: 0 })); setFiltros((p) => ({ ...p, proveedorId: e.target.value })); }}>
              <MenuItem value="">Todos</MenuItem>
              {proveedores.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ height: 590 }}>
          <DataGrid rows={rows} columns={columns} loading={loading} pageSizeOptions={[10, 25, 50]} paginationMode="server" paginationModel={paginationModel} onPaginationModelChange={setPaginationModel} rowCount={rowCount} disableRowSelectionOnClick />
        </Box>
      </Paper>

      <Dialog open={dialog.open} onClose={() => setDialog((p) => ({ ...p, open: false }))} maxWidth="xl" fullWidth>
        <DialogTitle>{dialog.ingreso?.correlativo || "Ingreso de telas"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Selecciona la tela interna, bodega obligatoria y datos de rollo. El color proveedor detectado se compara con el catalogo de colores del proveedor para asignar el color interno.
            </Typography>
            <Box sx={{ overflowX: "auto" }}>
              <Grid container spacing={1.25} sx={{ minWidth: 1480 }}>
                {dialog.detalle.map((item, index) => (
                  <Grid key={item.id} size={{ xs: 12 }}>
                    <Paper variant="outlined" sx={{ p: 1.5 }}>
                      <Grid container spacing={1.25} alignItems="center">
                        <Grid size={{ xs: 0.4 }}><Typography fontWeight={700}>{item.linea}</Typography></Grid>
                        <Grid size={{ xs: 2.2 }}><TextField size="small" label="Descripcion documento" fullWidth value={item.descripcionFactura} disabled /></Grid>
                        <Grid size={{ xs: 1.25 }}><TextField size="small" label="Tela segun proveedor" fullWidth value={item.proveedorNombre || ""} onChange={(e) => setDetalleValue(index, "proveedorNombre", e.target.value)} /></Grid>
                        <Grid size={{ xs: 1 }}><TextField size="small" label="Codigo prov." fullWidth value={item.proveedorCodigo || ""} onChange={(e) => setDetalleValue(index, "proveedorCodigo", e.target.value)} /></Grid>
                        <Grid size={{ xs: 1 }}><TextField size="small" label="Color proveedor" fullWidth value={item.tono || ""} onChange={(e) => setDetalleValue(index, "tono", e.target.value)} /></Grid>
                        <Grid size={{ xs: 1.25 }}><TextField select size="small" label="Tela" fullWidth value={item.telaId || ""} onChange={(e) => setDetalleValue(index, "telaId", e.target.value)}><MenuItem value="">Pendiente</MenuItem>{telas.map((t) => <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>)}</TextField></Grid>
                        <Grid size={{ xs: 1.2 }}><TextField select size="small" label="Bodega" required fullWidth value={item.bodegaId || ""} onChange={(e) => setDetalleValue(index, "bodegaId", e.target.value)}><MenuItem value="">Seleccionar</MenuItem>{bodegas.map((b) => <MenuItem key={b.id} value={b.id}>{b.nombre}</MenuItem>)}</TextField></Grid>
                        <Grid size={{ xs: 1 }}><TextField select size="small" label="Color interno" fullWidth value={item.colorId || ""} onChange={(e) => setDetalleValue(index, "colorId", e.target.value)}><MenuItem value="">Sin color</MenuItem>{colores.map((c) => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}</TextField></Grid>
                        <Grid size={{ xs: 0.8 }}><TextField size="small" type="number" label="Cant." fullWidth value={item.cantidad} onChange={(e) => setDetalleValue(index, "cantidad", e.target.value)} /></Grid>
                        <Grid size={{ xs: 0.8 }}><TextField size="small" type="number" label="Costo" fullWidth value={item.costoUnitario} onChange={(e) => setDetalleValue(index, "costoUnitario", e.target.value)} /></Grid>
                        <Grid size={{ xs: 0.8 }}><TextField size="small" label="Lote" fullWidth value={item.lote || ""} onChange={(e) => setDetalleValue(index, "lote", e.target.value)} /></Grid>
                        <Grid size={{ xs: 0.8 }}><Chip size="small" color={item.rolloId ? "success" : item.telaId && item.bodegaId ? "info" : "warning"} label={item.rolloId ? "Ingresado" : item.telaId && item.bodegaId ? "Listo" : "Pendiente"} /></Grid>
                        <Grid size={{ xs: 0.45 }}>
                          <Button
                            color="error"
                            disabled={!canManage || dialog.ingreso?.estado !== "abierto" || Boolean(item.rolloId) || dialog.detalle.length <= 1}
                            onClick={() => void eliminarLinea(item)}
                          >
                            <DeleteOutline fontSize="small" />
                          </Button>
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog((p) => ({ ...p, open: false }))}>Cerrar</Button>
          <Button variant="outlined" onClick={() => void guardarTodo()} disabled={!canManage}>Guardar cambios</Button>
          <Button startIcon={<AddBusinessOutlined />} variant="contained" onClick={() => void procesar()} disabled={!canManage || dialog.ingreso?.estado === "cerrado"}>Procesar ingreso</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={manualOpen} onClose={() => setManualOpen(false)} maxWidth="xl" fullWidth>
        <DialogTitle>Nuevo ingreso de tela</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField select label="Proveedor" fullWidth required value={manualForm.proveedorId} onChange={(e) => setManualForm((p) => ({ ...p, proveedorId: e.target.value }))}>
                  {proveedores.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre}{item.nit ? ` - ${item.nit}` : ""}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField select label="Tipo documento" fullWidth value={manualForm.documentoTipo} onChange={(e) => setManualForm((p) => ({ ...p, documentoTipo: e.target.value }))}>
                  <MenuItem value="recibo">Recibo</MenuItem>
                  <MenuItem value="factura">Factura manual</MenuItem>
                  <MenuItem value="nota">Nota</MenuItem>
                  <MenuItem value="manual">Manual</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField label="Referencia / numero" fullWidth value={manualForm.documentoReferencia} onChange={(e) => setManualForm((p) => ({ ...p, documentoReferencia: e.target.value }))} />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField label="Fecha" type="date" InputLabelProps={{ shrink: true }} fullWidth value={manualForm.fecha} onChange={(e) => setManualForm((p) => ({ ...p, fecha: e.target.value }))} />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField label="Total documento" type="number" fullWidth value={manualForm.documentoTotal} onChange={(e) => setManualForm((p) => ({ ...p, documentoTotal: e.target.value }))} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField label="Observaciones" fullWidth multiline minRows={2} value={manualForm.observaciones} onChange={(e) => setManualForm((p) => ({ ...p, observaciones: e.target.value }))} />
              </Grid>
            </Grid>

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1">Lineas de tela</Typography>
              <Button
                startIcon={<AddOutlined />}
                onClick={() => setManualForm((p) => ({ ...p, detalle: [...p.detalle, { ...emptyManualLine }] }))}
              >
                Agregar linea
              </Button>
            </Stack>

            <Box sx={{ overflowX: "auto" }}>
              <Grid container spacing={1.25} sx={{ minWidth: 1420 }}>
                {manualForm.detalle.map((item, index) => (
                  <Grid key={index} size={{ xs: 12 }}>
                    <Paper variant="outlined" sx={{ p: 1.5 }}>
                      <Grid container spacing={1.25} alignItems="center">
                        <Grid size={{ xs: 0.35 }}><Typography fontWeight={700}>{index + 1}</Typography></Grid>
                        <Grid size={{ xs: 1.9 }}><TextField size="small" label="Descripcion" fullWidth value={item.descripcionFactura} onChange={(e) => setManualLineValue(index, "descripcionFactura", e.target.value)} /></Grid>
                        <Grid size={{ xs: 1.2 }}><TextField size="small" label="Tela proveedor" fullWidth value={item.proveedorNombre} onChange={(e) => setManualLineValue(index, "proveedorNombre", e.target.value)} /></Grid>
                        <Grid size={{ xs: 0.9 }}><TextField size="small" label="Codigo prov." fullWidth value={item.proveedorCodigo} onChange={(e) => setManualLineValue(index, "proveedorCodigo", e.target.value)} /></Grid>
                        <Grid size={{ xs: 0.9 }}><TextField size="small" label="Color prov." fullWidth value={item.tono} onChange={(e) => setManualLineValue(index, "tono", e.target.value)} /></Grid>
                        <Grid size={{ xs: 1.15 }}><TextField select size="small" label="Tela" fullWidth value={item.telaId} onChange={(e) => setManualLineValue(index, "telaId", e.target.value)}><MenuItem value="">Pendiente</MenuItem>{telas.map((t) => <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>)}</TextField></Grid>
                        <Grid size={{ xs: 1.05 }}><TextField select size="small" label="Bodega" required fullWidth value={item.bodegaId} onChange={(e) => setManualLineValue(index, "bodegaId", e.target.value)}><MenuItem value="">Seleccionar</MenuItem>{bodegas.map((b) => <MenuItem key={b.id} value={b.id}>{b.nombre}</MenuItem>)}</TextField></Grid>
                        <Grid size={{ xs: 1 }}><TextField select size="small" label="Color interno" fullWidth value={item.colorId} onChange={(e) => setManualLineValue(index, "colorId", e.target.value)}><MenuItem value="">Sin color</MenuItem>{colores.map((c) => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}</TextField></Grid>
                        <Grid size={{ xs: 0.75 }}><TextField size="small" type="number" label="Cant." fullWidth value={item.cantidad} onChange={(e) => setManualLineValue(index, "cantidad", e.target.value)} /></Grid>
                        <Grid size={{ xs: 0.75 }}><TextField size="small" type="number" label="Costo" fullWidth value={item.costoUnitario} onChange={(e) => setManualLineValue(index, "costoUnitario", e.target.value)} /></Grid>
                        <Grid size={{ xs: 0.75 }}><TextField size="small" label="Lote" fullWidth value={item.lote} onChange={(e) => setManualLineValue(index, "lote", e.target.value)} /></Grid>
                        <Grid size={{ xs: 0.45 }}>
                          <Button
                            color="error"
                            disabled={manualForm.detalle.length === 1}
                            onClick={() => setManualForm((p) => ({ ...p, detalle: p.detalle.filter((_, i) => i !== index) }))}
                          >
                            <DeleteOutline fontSize="small" />
                          </Button>
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManualOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => void crearManual()} disabled={!canManage}>Crear ingreso</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
