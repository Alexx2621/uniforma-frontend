import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
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
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import CloudUploadOutlined from "@mui/icons-material/CloudUploadOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import EditOutlined from "@mui/icons-material/EditOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";
import { formatCurrency } from "../utils/currency";

interface Proveedor {
  id: number;
  nombre: string;
  nit?: string | null;
}

interface FacturaProveedor {
  id: number;
  proveedorId?: number | null;
  proveedorNombre?: string | null;
  proveedorNit?: string | null;
  numeroFactura?: string | null;
  serie?: string | null;
  fechaFactura?: string | null;
  fechaVencimiento?: string | null;
  fechaRegistro?: string | null;
  moneda?: string | null;
  subtotal: number;
  impuestos: number;
  total: number;
  estado: string;
  metodoPago?: string | null;
  referenciaPago?: string | null;
  tipoGasto?: string | null;
  descripcion?: string | null;
  observaciones?: string | null;
  archivoNombre?: string | null;
  confianza?: number | null;
  proveedor?: Proveedor | null;
}

const estados = ["pendiente", "revisada", "pagada", "anulada"];
const tiposGasto = ["telas", "insumos", "bordados", "logistica", "servicios", "otros"];

const emptyForm = {
  proveedorId: "",
  proveedorNombre: "",
  proveedorNit: "",
  numeroFactura: "",
  serie: "",
  fechaFactura: "",
  fechaVencimiento: "",
  moneda: "GTQ",
  subtotal: "0",
  impuestos: "0",
  total: "0",
  estado: "pendiente",
  metodoPago: "",
  referenciaPago: "",
  tipoGasto: "",
  descripcion: "",
  observaciones: "",
};

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("es-GT") : "N/D");
const inputDate = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : "");

const toForm = (row: FacturaProveedor) => ({
  proveedorId: row.proveedorId ? String(row.proveedorId) : "",
  proveedorNombre: row.proveedorNombre || row.proveedor?.nombre || "",
  proveedorNit: row.proveedorNit || row.proveedor?.nit || "",
  numeroFactura: row.numeroFactura || "",
  serie: row.serie || "",
  fechaFactura: inputDate(row.fechaFactura),
  fechaVencimiento: inputDate(row.fechaVencimiento),
  moneda: row.moneda || "GTQ",
  subtotal: String(row.subtotal || 0),
  impuestos: String(row.impuestos || 0),
  total: String(row.total || 0),
  estado: row.estado || "pendiente",
  metodoPago: row.metodoPago || "",
  referenciaPago: row.referenciaPago || "",
  tipoGasto: row.tipoGasto || "",
  descripcion: row.descripcion || "",
  observaciones: row.observaciones || "",
});

export default function FacturasProveedores() {
  const { rol, permisos } = useAuthStore();
  const canManage = hasPermission(rol, permisos, "proveedores.facturas.manage");
  const [rows, setRows] = useState<FacturaProveedor[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [filtros, setFiltros] = useState({ q: "", estado: "", proveedorId: "", desde: "", hasta: "" });
  const [dialog, setDialog] = useState<{ open: boolean; editing: FacturaProveedor | null; form: typeof emptyForm }>({
    open: false,
    editing: null,
    form: emptyForm,
  });
  const [uploadDialog, setUploadDialog] = useState(false);
  const [uploadProveedorId, setUploadProveedorId] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filtros).filter(([, value]) => value));
      const [respFacturas, respProveedores] = await Promise.all([
        api.get("/facturas-proveedores", { params }),
        api.get("/proveedores", { params: { estado: "activo" } }).catch(() => ({ data: [] })),
      ]);
      setRows(respFacturas.data || []);
      setProveedores(respProveedores.data || []);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudieron cargar las facturas", "error");
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const resumen = useMemo(() => {
    const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const pendientes = rows.filter((row) => row.estado === "pendiente").length;
    const pagadas = rows.filter((row) => row.estado === "pagada").length;
    return { total, pendientes, pagadas, facturas: rows.length };
  }, [rows]);

  const setFormValue = (field: keyof typeof emptyForm, value: string) => {
    setDialog((prev) => ({ ...prev, form: { ...prev.form, [field]: value } }));
  };

  const seleccionarProveedor = (value: string) => {
    const proveedor = proveedores.find((item) => String(item.id) === value);
    setDialog((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        proveedorId: value,
        proveedorNombre: proveedor?.nombre || prev.form.proveedorNombre,
        proveedorNit: proveedor?.nit || prev.form.proveedorNit,
      },
    }));
  };

  const abrirEditar = (row: FacturaProveedor) => {
    setDialog({ open: true, editing: row, form: toForm(row) });
  };

  const guardar = async () => {
    if (!canManage) return;
    try {
      const payload = {
        ...dialog.form,
        proveedorId: dialog.form.proveedorId ? Number(dialog.form.proveedorId) : null,
        subtotal: Number(dialog.form.subtotal || 0),
        impuestos: Number(dialog.form.impuestos || 0),
        total: Number(dialog.form.total || 0),
      };
      if (dialog.editing) await api.patch(`/facturas-proveedores/${dialog.editing.id}`, payload);
      else await api.post("/facturas-proveedores", payload);
      setDialog({ open: false, editing: null, form: emptyForm });
      await cargar();
      Swal.fire("Listo", "Factura guardada correctamente", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo guardar la factura", "error");
    }
  };

  const cargarPdf = async () => {
    if (!archivo) {
      Swal.fire("Validacion", "Selecciona una factura PDF", "info");
      return;
    }
    const form = new FormData();
    form.append("archivo", archivo);
    if (uploadProveedorId) form.append("proveedorId", uploadProveedorId);
    setUploading(true);
    try {
      await api.post("/facturas-proveedores/cargar-pdf", form);
      setUploadDialog(false);
      setArchivo(null);
      setUploadProveedorId("");
      await cargar();
      Swal.fire("Factura cargada", "Se leyeron y guardaron los datos detectados. Revisa la factura antes de marcarla como pagada.", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo cargar el PDF", "error");
    } finally {
      setUploading(false);
    }
  };

  const eliminar = async (row: FacturaProveedor) => {
    if (!canManage) return;
    const confirm = await Swal.fire({
      title: "Eliminar factura",
      text: `Se eliminara la factura ${row.numeroFactura || row.archivoNombre || row.id}.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
    try {
      await api.delete(`/facturas-proveedores/${row.id}`);
      await cargar();
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo eliminar la factura", "error");
    }
  };

  const columns: GridColDef<FacturaProveedor>[] = [
    { field: "numeroFactura", headerName: "Factura", width: 135, valueGetter: (value) => value || "N/D" },
    { field: "serie", headerName: "Serie", width: 110, valueGetter: (value) => value || "N/D" },
    {
      field: "proveedor",
      headerName: "Proveedor",
      minWidth: 210,
      flex: 1,
      valueGetter: (_, row) => row.proveedor?.nombre || row.proveedorNombre || "N/D",
    },
    { field: "proveedorNit", headerName: "NIT", width: 125, valueGetter: (value, row) => value || row.proveedor?.nit || "N/D" },
    { field: "fechaFactura", headerName: "Fecha", width: 115, valueFormatter: (value) => formatDate(String(value || "")) },
    { field: "archivoNombre", headerName: "Archivo origen", width: 180, valueGetter: (value) => value || "N/D" },
    { field: "tipoGasto", headerName: "Tipo", width: 120, valueGetter: (value) => value || "N/D" },
    { field: "subtotal", headerName: "Subtotal", width: 125, valueFormatter: (value) => formatCurrency(Number(value || 0)) },
    { field: "impuestos", headerName: "Impuestos", width: 125, valueFormatter: (value) => formatCurrency(Number(value || 0)) },
    { field: "total", headerName: "Total", width: 130, valueFormatter: (value) => formatCurrency(Number(value || 0)) },
    {
      field: "estado",
      headerName: "Estado",
      width: 120,
      renderCell: ({ row }) => (
        <Chip
          size="small"
          label={row.estado || "pendiente"}
          color={row.estado === "pagada" ? "success" : row.estado === "anulada" ? "error" : row.estado === "revisada" ? "info" : "warning"}
        />
      ),
    },
    {
      field: "confianza",
      headerName: "Lectura",
      width: 105,
      valueFormatter: (value) => `${Math.round(Number(value || 0) * 100)}%`,
    },
    {
      field: "acciones",
      headerName: "Acciones",
      width: 140,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={() => abrirEditar(row)} disabled={!canManage}>
            <EditOutlined fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" onClick={() => void eliminar(row)} disabled={!canManage}>
            <DeleteOutline fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <ReceiptLongOutlined color="primary" />
            <Typography variant="h4" fontWeight={600}>Facturas proveedores</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Carga facturas PDF, revisa la lectura automatica y controla estado, pagos y documentos.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RefreshOutlined />} variant="outlined" onClick={() => void cargar()} disabled={loading}>
            Recargar
          </Button>
          <Button startIcon={<CloudUploadOutlined />} variant="contained" onClick={() => setUploadDialog(true)} disabled={!canManage}>
            Cargar PDF
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 3 }}><Paper variant="outlined" sx={{ p: 2 }}><Typography variant="caption" color="text.secondary">Facturas</Typography><Typography variant="h5">{resumen.facturas}</Typography></Paper></Grid>
        <Grid size={{ xs: 12, md: 3 }}><Paper variant="outlined" sx={{ p: 2 }}><Typography variant="caption" color="text.secondary">Pendientes</Typography><Typography variant="h5">{resumen.pendientes}</Typography></Paper></Grid>
        <Grid size={{ xs: 12, md: 3 }}><Paper variant="outlined" sx={{ p: 2 }}><Typography variant="caption" color="text.secondary">Pagadas</Typography><Typography variant="h5">{resumen.pagadas}</Typography></Paper></Grid>
        <Grid size={{ xs: 12, md: 3 }}><Paper variant="outlined" sx={{ p: 2 }}><Typography variant="caption" color="text.secondary">Total cargado</Typography><Typography variant="h5">{formatCurrency(resumen.total)}</Typography></Paper></Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 3 }}><TextField label="Buscar" size="small" fullWidth value={filtros.q} onChange={(e) => setFiltros((p) => ({ ...p, q: e.target.value }))} /></Grid>
          <Grid size={{ xs: 12, md: 3 }}><TextField select label="Proveedor" size="small" fullWidth value={filtros.proveedorId} onChange={(e) => setFiltros((p) => ({ ...p, proveedorId: e.target.value }))}><MenuItem value="">Todos</MenuItem>{proveedores.map((p) => <MenuItem key={p.id} value={String(p.id)}>{p.nombre}</MenuItem>)}</TextField></Grid>
          <Grid size={{ xs: 12, md: 2 }}><TextField select label="Estado" size="small" fullWidth value={filtros.estado} onChange={(e) => setFiltros((p) => ({ ...p, estado: e.target.value }))}><MenuItem value="">Todos</MenuItem>{estados.map((e) => <MenuItem key={e} value={e}>{e}</MenuItem>)}</TextField></Grid>
          <Grid size={{ xs: 12, md: 2 }}><TextField label="Desde" type="date" size="small" fullWidth value={filtros.desde} onChange={(e) => setFiltros((p) => ({ ...p, desde: e.target.value }))} InputLabelProps={{ shrink: true }} /></Grid>
          <Grid size={{ xs: 12, md: 2 }}><TextField label="Hasta" type="date" size="small" fullWidth value={filtros.hasta} onChange={(e) => setFiltros((p) => ({ ...p, hasta: e.target.value }))} InputLabelProps={{ shrink: true }} /></Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ height: 620 }}>
          <DataGrid rows={rows} columns={columns} loading={loading} pageSizeOptions={[10, 25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} disableRowSelectionOnClick />
        </Box>
      </Paper>

      <Dialog open={uploadDialog} onClose={() => setUploadDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Cargar factura PDF</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField select label="Proveedor relacionado" value={uploadProveedorId} onChange={(e) => setUploadProveedorId(e.target.value)} fullWidth>
              <MenuItem value="">Detectar del PDF o dejar manual</MenuItem>
              {proveedores.map((p) => <MenuItem key={p.id} value={String(p.id)}>{p.nombre}{p.nit ? ` - ${p.nit}` : ""}</MenuItem>)}
            </TextField>
            <Button component="label" variant="outlined" startIcon={<PictureAsPdfOutlined />}>
              {archivo ? archivo.name : "Seleccionar PDF"}
              <input hidden type="file" accept="application/pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => setArchivo(event.target.files?.[0] || null)} />
            </Button>
            <Typography variant="caption" color="text.secondary">
              El microservicio intentara leer proveedor, NIT, numero, fecha, subtotal, IVA y total. Los datos quedan editables.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => void cargarPdf()} disabled={uploading || !archivo}>Cargar y leer</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog.open} onClose={() => setDialog((p) => ({ ...p, open: false }))} maxWidth="md" fullWidth>
        <DialogTitle>{dialog.editing ? "Editar factura proveedor" : "Nueva factura proveedor"}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}><TextField select label="Proveedor" fullWidth value={dialog.form.proveedorId} onChange={(e) => seleccionarProveedor(e.target.value)}><MenuItem value="">Sin relacionar</MenuItem>{proveedores.map((p) => <MenuItem key={p.id} value={String(p.id)}>{p.nombre}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, md: 6 }}><TextField label="Proveedor detectado/manual" fullWidth value={dialog.form.proveedorNombre} onChange={(e) => setFormValue("proveedorNombre", e.target.value)} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField label="NIT" fullWidth value={dialog.form.proveedorNit} onChange={(e) => setFormValue("proveedorNit", e.target.value)} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField label="Numero factura" fullWidth value={dialog.form.numeroFactura} onChange={(e) => setFormValue("numeroFactura", e.target.value)} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField label="Serie" fullWidth value={dialog.form.serie} onChange={(e) => setFormValue("serie", e.target.value)} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField label="Fecha factura" type="date" fullWidth value={dialog.form.fechaFactura} onChange={(e) => setFormValue("fechaFactura", e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField label="Fecha vencimiento" type="date" fullWidth value={dialog.form.fechaVencimiento} onChange={(e) => setFormValue("fechaVencimiento", e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField select label="Estado" fullWidth value={dialog.form.estado} onChange={(e) => setFormValue("estado", e.target.value)}>{estados.map((e) => <MenuItem key={e} value={e}>{e}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, md: 3 }}><TextField label="Subtotal" type="number" fullWidth value={dialog.form.subtotal} onChange={(e) => setFormValue("subtotal", e.target.value)} /></Grid>
            <Grid size={{ xs: 12, md: 3 }}><TextField label="Impuestos" type="number" fullWidth value={dialog.form.impuestos} onChange={(e) => setFormValue("impuestos", e.target.value)} /></Grid>
            <Grid size={{ xs: 12, md: 3 }}><TextField label="Total" type="number" fullWidth value={dialog.form.total} onChange={(e) => setFormValue("total", e.target.value)} /></Grid>
            <Grid size={{ xs: 12, md: 3 }}><TextField label="Moneda" fullWidth value={dialog.form.moneda} onChange={(e) => setFormValue("moneda", e.target.value)} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField select label="Tipo gasto" fullWidth value={dialog.form.tipoGasto} onChange={(e) => setFormValue("tipoGasto", e.target.value)}><MenuItem value="">Sin clasificar</MenuItem>{tiposGasto.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField label="Metodo pago" fullWidth value={dialog.form.metodoPago} onChange={(e) => setFormValue("metodoPago", e.target.value)} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField label="Referencia pago" fullWidth value={dialog.form.referenciaPago} onChange={(e) => setFormValue("referenciaPago", e.target.value)} /></Grid>
            <Grid size={{ xs: 12 }}><TextField label="Descripcion" fullWidth multiline minRows={2} value={dialog.form.descripcion} onChange={(e) => setFormValue("descripcion", e.target.value)} /></Grid>
            <Grid size={{ xs: 12 }}><TextField label="Observaciones" fullWidth multiline minRows={2} value={dialog.form.observaciones} onChange={(e) => setFormValue("observaciones", e.target.value)} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog((p) => ({ ...p, open: false }))}>Cancelar</Button>
          <Button variant="contained" onClick={() => void guardar()} disabled={!canManage}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
