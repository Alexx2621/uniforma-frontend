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
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
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
import { useNavigate } from "react-router-dom";
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
  numeroAutorizacion?: string | null;
  numeroAcceso?: string | null;
  numeroCertificacion?: string | null;
  tipoDocumento?: string | null;
  condicionPago?: string | null;
  receptorNombre?: string | null;
  receptorNit?: string | null;
  receptorDireccion?: string | null;
  certificadorNombre?: string | null;
  certificadorNit?: string | null;
  fechaFactura?: string | null;
  fechaCertificacion?: string | null;
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
  detalle?: FacturaProveedorDetalle[];
}

interface FacturaProveedorDetalle {
  id?: number;
  linea: number;
  cantidad: number | string;
  unidad?: string | null;
  tipo?: string | null;
  descripcion: string;
  precioUnitario: number | string;
  descuento: number | string;
  impuestoNombre?: string | null;
  impuestoMonto: number | string;
  total: number | string;
}

const estados = ["pendiente", "revisada", "pagada", "anulada"];
const tiposGasto = ["telas", "insumos", "bordados", "logistica", "servicios", "otros"];

const emptyForm = {
  proveedorId: "",
  proveedorNombre: "",
  proveedorNit: "",
  numeroFactura: "",
  serie: "",
  numeroAutorizacion: "",
  numeroAcceso: "",
  numeroCertificacion: "",
  tipoDocumento: "factura",
  condicionPago: "contado",
  receptorNombre: "",
  receptorNit: "",
  receptorDireccion: "",
  certificadorNombre: "",
  certificadorNit: "",
  fechaFactura: "",
  fechaCertificacion: "",
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

const emptyDetalle = (): FacturaProveedorDetalle => ({
  linea: 1,
  cantidad: 0,
  unidad: "",
  tipo: "",
  descripcion: "",
  precioUnitario: 0,
  descuento: 0,
  impuestoNombre: "IVA",
  impuestoMonto: 0,
  total: 0,
});

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("es-GT") : "N/D");
const inputDate = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : "");
const moneyInputProps = {
  startAdornment: <InputAdornment position="start">Q</InputAdornment>,
};
const getApiErrorPayload = (error: any) => {
  const data = error?.response?.data;
  const nested = data?.message && typeof data.message === "object" ? data.message : null;
  return {
    code: data?.code || nested?.code,
    message:
      (typeof data?.message === "string" && data.message) ||
      nested?.message ||
      error?.message ||
      "Ocurrio un error",
    proveedorNombre: data?.proveedorNombre || nested?.proveedorNombre,
    proveedorNit: data?.proveedorNit || nested?.proveedorNit,
  };
};

const toForm = (row: FacturaProveedor) => ({
  proveedorId: row.proveedorId ? String(row.proveedorId) : "",
  proveedorNombre: row.proveedorNombre || row.proveedor?.nombre || "",
  proveedorNit: row.proveedorNit || row.proveedor?.nit || "",
  numeroFactura: row.numeroFactura || "",
  serie: row.serie || "",
  numeroAutorizacion: row.numeroAutorizacion || "",
  numeroAcceso: row.numeroAcceso || "",
  numeroCertificacion: row.numeroCertificacion || "",
  tipoDocumento: row.tipoDocumento || "factura",
  condicionPago: row.condicionPago || (row.fechaVencimiento ? "credito" : "contado"),
  receptorNombre: row.receptorNombre || "",
  receptorNit: row.receptorNit || "",
  receptorDireccion: row.receptorDireccion || "",
  certificadorNombre: row.certificadorNombre || "",
  certificadorNit: row.certificadorNit || "",
  fechaFactura: inputDate(row.fechaFactura),
  fechaCertificacion: inputDate(row.fechaCertificacion),
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

const toDetalle = (row?: FacturaProveedor | null): FacturaProveedorDetalle[] =>
  (row?.detalle || []).map((item, index) => ({
    id: item.id,
    linea: Number(item.linea || index + 1),
    cantidad: Number(item.cantidad || 0),
    unidad: item.unidad || "",
    tipo: item.tipo || "",
    descripcion: item.descripcion || "",
    precioUnitario: Number(item.precioUnitario || 0),
    descuento: Number(item.descuento || 0),
    impuestoNombre: item.impuestoNombre || "IVA",
    impuestoMonto: Number(item.impuestoMonto || 0),
    total: Number(item.total || 0),
  }));

export default function FacturasProveedores() {
  const { rol, permisos } = useAuthStore();
  const navigate = useNavigate();
  const canManage = hasPermission(rol, permisos, "proveedores.facturas.manage");
  const [rows, setRows] = useState<FacturaProveedor[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [filtros, setFiltros] = useState({ q: "", estado: "", proveedorId: "", desde: "", hasta: "" });
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [rowCount, setRowCount] = useState(0);
  const [dialog, setDialog] = useState<{ open: boolean; editing: FacturaProveedor | null; form: typeof emptyForm; detalle: FacturaProveedorDetalle[] }>({
    open: false,
    editing: null,
    form: emptyForm,
    detalle: [],
  });
  const [uploadDialog, setUploadDialog] = useState(false);
  const [uploadProveedorId, setUploadProveedorId] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        ...Object.fromEntries(Object.entries(filtros).filter(([, value]) => value)),
        page: paginationModel.page,
        pageSize: paginationModel.pageSize,
      };
      const [respFacturas, respProveedores] = await Promise.all([
        api.get("/facturas-proveedores", { params }),
        api.get("/proveedores", { params: { estado: "activo" } }).catch(() => ({ data: [] })),
      ]);
      const payload = respFacturas.data;
      setRows(Array.isArray(payload) ? payload : payload?.data || []);
      setRowCount(Array.isArray(payload) ? payload.length : Number(payload?.total || 0));
      setProveedores(respProveedores.data || []);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudieron cargar las facturas", "error");
    } finally {
      setLoading(false);
    }
  }, [filtros, paginationModel]);

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
    setDialog({ open: true, editing: row, form: toForm(row), detalle: toDetalle(row) });
  };

  const agregarDetalle = () => {
    setDialog((prev) => ({
      ...prev,
      detalle: [...prev.detalle, { ...emptyDetalle(), linea: prev.detalle.length + 1 }],
    }));
  };

  const setDetalleValue = (index: number, field: keyof FacturaProveedorDetalle, value: string) => {
    setDialog((prev) => ({
      ...prev,
      detalle: prev.detalle.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
  };

  const quitarDetalle = (index: number) => {
    setDialog((prev) => ({
      ...prev,
      detalle: prev.detalle
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({ ...item, linea: itemIndex + 1 })),
    }));
  };

  const recalcularTotalesDesdeDetalle = () => {
    const subtotal = dialog.detalle.reduce((sum, item) => sum + Number(item.total || 0) - Number(item.impuestoMonto || 0), 0);
    const impuestos = dialog.detalle.reduce((sum, item) => sum + Number(item.impuestoMonto || 0), 0);
    const total = dialog.detalle.reduce((sum, item) => sum + Number(item.total || 0), 0);
    setDialog((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        subtotal: subtotal.toFixed(2),
        impuestos: impuestos.toFixed(2),
        total: total.toFixed(2),
      },
    }));
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
        detalle: dialog.detalle.map((item, index) => ({
          ...item,
          linea: index + 1,
          cantidad: Number(item.cantidad || 0),
          precioUnitario: Number(item.precioUnitario || 0),
          descuento: Number(item.descuento || 0),
          impuestoMonto: Number(item.impuestoMonto || 0),
          total: Number(item.total || 0),
        })),
      };
      if (dialog.editing) await api.patch(`/facturas-proveedores/${dialog.editing.id}`, payload);
      else await api.post("/facturas-proveedores", payload);
      setDialog({ open: false, editing: null, form: emptyForm, detalle: [] });
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
      const apiError = getApiErrorPayload(error);
      if (apiError.code === "PROVEEDOR_NO_EXISTE" || apiError.code === "PROVEEDOR_SIN_NIT") {
        const result = await Swal.fire({
          title: apiError.code === "PROVEEDOR_SIN_NIT" ? "Proveedor sin NIT valido" : "Proveedor no registrado",
          text: apiError.message,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Ir a proveedores",
          cancelButtonText: "Cancelar",
        });
        if (result.isConfirmed) {
          setUploadDialog(false);
          navigate("/proveedores", {
            state: {
              openCreate: true,
              proveedorDraft: {
                nombre: apiError.proveedorNombre || "",
                razonSocial: apiError.proveedorNombre || "",
                nit: apiError.proveedorNit || "",
                tipo: "insumos",
                observaciones: "Creado desde lectura de factura proveedor.",
              },
            },
          });
        }
      } else {
        Swal.fire("Error", apiError.message || "No se pudo cargar el PDF", "error");
      }
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
    { field: "numeroFactura", headerName: "Factura", minWidth: 125, flex: 0.65, valueGetter: (value) => value || "N/D" },
    { field: "serie", headerName: "Serie", minWidth: 105, flex: 0.5, valueGetter: (value) => value || "N/D" },
    { field: "numeroAutorizacion", headerName: "Autorizacion", minWidth: 185, flex: 1, valueGetter: (value) => value || "N/D" },
    {
      field: "proveedor",
      headerName: "Proveedor",
      minWidth: 190,
      flex: 1,
      valueGetter: (_, row) => row.proveedor?.nombre || row.proveedorNombre || "N/D",
    },
    { field: "proveedorNit", headerName: "NIT", minWidth: 115, flex: 0.55, valueGetter: (value, row) => value || row.proveedor?.nit || "N/D" },
    { field: "fechaFactura", headerName: "Fecha", minWidth: 110, flex: 0.55, valueFormatter: (value) => formatDate(String(value || "")) },
    { field: "archivoNombre", headerName: "Archivo origen", minWidth: 150, flex: 0.75, valueGetter: (value) => value || "N/D" },
    { field: "tipoGasto", headerName: "Tipo", minWidth: 105, flex: 0.5, valueGetter: (value) => value || "N/D" },
    { field: "condicionPago", headerName: "Pago", minWidth: 100, flex: 0.45, valueGetter: (value) => value || "N/D" },
    { field: "subtotal", headerName: "Subtotal", minWidth: 120, flex: 0.55, valueFormatter: (value) => formatCurrency(Number(value || 0)) },
    { field: "impuestos", headerName: "Impuestos", minWidth: 120, flex: 0.55, valueFormatter: (value) => formatCurrency(Number(value || 0)) },
    { field: "total", headerName: "Total", minWidth: 125, flex: 0.55, valueFormatter: (value) => formatCurrency(Number(value || 0)) },
    {
      field: "estado",
      headerName: "Estado",
      minWidth: 115,
      flex: 0.5,
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
      minWidth: 95,
      flex: 0.4,
      valueFormatter: (value) => `${Math.round(Number(value || 0) * 100)}%`,
    },
    {
      field: "acciones",
      headerName: "Acciones",
      width: 105,
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
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: "100%", overflowX: "hidden" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2, minWidth: 0 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <ReceiptLongOutlined color="primary" />
            <Typography variant="h4" fontWeight={600}>Facturas proveedores</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Carga facturas PDF, revisa la lectura automatica y controla estado, pagos y documentos.
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: { xs: "100%", md: "auto" } }}>
          <Button startIcon={<RefreshOutlined />} variant="outlined" onClick={() => void cargar()} disabled={loading}>
            Recargar
          </Button>
          <Button startIcon={<CloudUploadOutlined />} variant="contained" onClick={() => setUploadDialog(true)} disabled={!canManage}>
            Cargar PDF
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><Paper variant="outlined" sx={{ p: 2 }}><Typography variant="caption" color="text.secondary">Facturas</Typography><Typography variant="h5">{resumen.facturas}</Typography></Paper></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><Paper variant="outlined" sx={{ p: 2 }}><Typography variant="caption" color="text.secondary">Pendientes</Typography><Typography variant="h5">{resumen.pendientes}</Typography></Paper></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><Paper variant="outlined" sx={{ p: 2 }}><Typography variant="caption" color="text.secondary">Pagadas</Typography><Typography variant="h5">{resumen.pagadas}</Typography></Paper></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><Paper variant="outlined" sx={{ p: 2 }}><Typography variant="caption" color="text.secondary">Total cargado</Typography><Typography variant="h5">{formatCurrency(resumen.total)}</Typography></Paper></Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 3 }}><TextField label="Buscar" size="small" fullWidth value={filtros.q} onChange={(e) => { setPaginationModel((p) => ({ ...p, page: 0 })); setFiltros((p) => ({ ...p, q: e.target.value })); }} /></Grid>
          <Grid size={{ xs: 12, md: 3 }}><TextField select label="Proveedor" size="small" fullWidth value={filtros.proveedorId} onChange={(e) => { setPaginationModel((p) => ({ ...p, page: 0 })); setFiltros((p) => ({ ...p, proveedorId: e.target.value })); }}><MenuItem value="">Todos</MenuItem>{proveedores.map((p) => <MenuItem key={p.id} value={String(p.id)}>{p.nombre}</MenuItem>)}</TextField></Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2 }}><TextField select label="Estado" size="small" fullWidth value={filtros.estado} onChange={(e) => { setPaginationModel((p) => ({ ...p, page: 0 })); setFiltros((p) => ({ ...p, estado: e.target.value })); }}><MenuItem value="">Todos</MenuItem>{estados.map((e) => <MenuItem key={e} value={e}>{e}</MenuItem>)}</TextField></Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2 }}><TextField label="Desde" type="date" size="small" fullWidth value={filtros.desde} onChange={(e) => { setPaginationModel((p) => ({ ...p, page: 0 })); setFiltros((p) => ({ ...p, desde: e.target.value })); }} InputLabelProps={{ shrink: true }} /></Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2 }}><TextField label="Hasta" type="date" size="small" fullWidth value={filtros.hasta} onChange={(e) => { setPaginationModel((p) => ({ ...p, page: 0 })); setFiltros((p) => ({ ...p, hasta: e.target.value })); }} InputLabelProps={{ shrink: true }} /></Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 1, md: 2 }, minWidth: 0 }}>
        <Box sx={{ height: "calc(100vh - 360px)", minHeight: 420, width: "100%" }}>
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            pageSizeOptions={[10, 25, 50]}
            paginationMode="server"
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            rowCount={rowCount}
            disableRowSelectionOnClick
            sx={{
              "& .MuiDataGrid-columnHeaderTitle": { whiteSpace: "normal", lineHeight: 1.2 },
              "& .MuiDataGrid-cell": { minWidth: 0 },
            }}
          />
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
              El proveedor debe existir y estar activo en el catalogo. Si el PDF pertenece a otro proveedor, la carga sera rechazada.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => void cargarPdf()} disabled={uploading || !archivo}>Cargar y leer</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={dialog.open}
        onClose={() => setDialog((p) => ({ ...p, open: false }))}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { height: { xs: "96vh", md: "92vh" }, maxWidth: 1180 } }}
      >
        <DialogTitle>{dialog.editing ? "Editar factura proveedor" : "Nueva factura proveedor"}</DialogTitle>
        <DialogContent dividers sx={{ p: 2.5, overflow: "auto", bgcolor: "background.default" }}>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, lg: 7 }}>
              <Paper variant="outlined" sx={{ p: 2, height: "100%", bgcolor: "background.paper" }}>
                <Typography variant="subtitle1" sx={{ mb: 1.5 }}>Datos fiscales</Typography>
                <Grid container spacing={1.75}>
                  <Grid size={{ xs: 12, md: 6 }}><TextField size="small" select label="Proveedor" fullWidth value={dialog.form.proveedorId} onChange={(e) => seleccionarProveedor(e.target.value)}><MenuItem value="">Sin relacionar</MenuItem>{proveedores.map((p) => <MenuItem key={p.id} value={String(p.id)}>{p.nombre}</MenuItem>)}</TextField></Grid>
                  <Grid size={{ xs: 12, md: 6 }}><TextField size="small" label="Proveedor detectado/manual" fullWidth value={dialog.form.proveedorNombre} onChange={(e) => setFormValue("proveedorNombre", e.target.value)} /></Grid>
                  <Grid size={{ xs: 12, sm: 4 }}><TextField size="small" label="NIT" fullWidth value={dialog.form.proveedorNit} onChange={(e) => setFormValue("proveedorNit", e.target.value)} /></Grid>
                  <Grid size={{ xs: 12, sm: 4 }}><TextField size="small" label="Numero factura" fullWidth value={dialog.form.numeroFactura} onChange={(e) => setFormValue("numeroFactura", e.target.value)} /></Grid>
                  <Grid size={{ xs: 12, sm: 4 }}><TextField size="small" label="Serie" fullWidth value={dialog.form.serie} onChange={(e) => setFormValue("serie", e.target.value)} /></Grid>
                  <Grid size={{ xs: 12 }}><TextField size="small" label="Numero de autorizacion / DTE" fullWidth value={dialog.form.numeroAutorizacion} onChange={(e) => setFormValue("numeroAutorizacion", e.target.value)} /></Grid>
                  <Grid size={{ xs: 12, sm: 6 }}><TextField size="small" label="Numero certificacion" fullWidth value={dialog.form.numeroCertificacion} onChange={(e) => setFormValue("numeroCertificacion", e.target.value)} /></Grid>
                  <Grid size={{ xs: 12, sm: 6 }}><TextField size="small" label="Numero acceso" fullWidth value={dialog.form.numeroAcceso} onChange={(e) => setFormValue("numeroAcceso", e.target.value)} /></Grid>
                  <Grid size={{ xs: 12, sm: 6 }}><TextField size="small" select label="Tipo documento" fullWidth value={dialog.form.tipoDocumento} onChange={(e) => setFormValue("tipoDocumento", e.target.value)}><MenuItem value="factura">Factura</MenuItem><MenuItem value="factura cambiaria">Factura cambiaria</MenuItem><MenuItem value="nota credito">Nota credito</MenuItem><MenuItem value="otro">Otro</MenuItem></TextField></Grid>
                  <Grid size={{ xs: 12, sm: 6 }}><TextField size="small" select label="Condicion de pago" fullWidth value={dialog.form.condicionPago} onChange={(e) => setFormValue("condicionPago", e.target.value)}><MenuItem value="contado">Contado</MenuItem><MenuItem value="credito">Credito</MenuItem></TextField></Grid>
                  <Grid size={{ xs: 12, sm: 4 }}><TextField size="small" label="Fecha factura" type="date" fullWidth value={dialog.form.fechaFactura} onChange={(e) => setFormValue("fechaFactura", e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
                  <Grid size={{ xs: 12, sm: 4 }}><TextField size="small" label="Fecha certificacion" type="date" fullWidth value={dialog.form.fechaCertificacion} onChange={(e) => setFormValue("fechaCertificacion", e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
                  <Grid size={{ xs: 12, sm: 4 }}><TextField size="small" label="Fecha vencimiento" type="date" fullWidth value={dialog.form.fechaVencimiento} onChange={(e) => setFormValue("fechaVencimiento", e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
                  <Grid size={{ xs: 12, sm: 4 }}><TextField size="small" select label="Estado" fullWidth value={dialog.form.estado} onChange={(e) => setFormValue("estado", e.target.value)}>{estados.map((e) => <MenuItem key={e} value={e}>{e}</MenuItem>)}</TextField></Grid>
                  <Grid size={{ xs: 12, sm: 5 }}><TextField size="small" label="Receptor / comprador" fullWidth value={dialog.form.receptorNombre} onChange={(e) => setFormValue("receptorNombre", e.target.value)} /></Grid>
                  <Grid size={{ xs: 12, sm: 3 }}><TextField size="small" label="NIT receptor" fullWidth value={dialog.form.receptorNit} onChange={(e) => setFormValue("receptorNit", e.target.value)} /></Grid>
                  <Grid size={{ xs: 12, sm: 5 }}><TextField size="small" label="Certificador" fullWidth value={dialog.form.certificadorNombre} onChange={(e) => setFormValue("certificadorNombre", e.target.value)} /></Grid>
                  <Grid size={{ xs: 12, sm: 3 }}><TextField size="small" label="NIT certificador" fullWidth value={dialog.form.certificadorNit} onChange={(e) => setFormValue("certificadorNit", e.target.value)} /></Grid>
                  <Grid size={{ xs: 12 }}><TextField size="small" label="Direccion receptor" fullWidth value={dialog.form.receptorDireccion} onChange={(e) => setFormValue("receptorDireccion", e.target.value)} /></Grid>
                </Grid>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, lg: 5 }}>
              <Paper variant="outlined" sx={{ p: 2, height: "100%", bgcolor: "background.paper" }}>
                <Typography variant="subtitle1" sx={{ mb: 1.5 }}>Totales y control</Typography>
                <Grid container spacing={1.75}>
                  <Grid size={{ xs: 6 }}><TextField size="small" label="Subtotal" type="number" fullWidth value={dialog.form.subtotal} onChange={(e) => setFormValue("subtotal", e.target.value)} InputProps={moneyInputProps} /></Grid>
                  <Grid size={{ xs: 6 }}><TextField size="small" label="Impuestos" type="number" fullWidth value={dialog.form.impuestos} onChange={(e) => setFormValue("impuestos", e.target.value)} InputProps={moneyInputProps} /></Grid>
                  <Grid size={{ xs: 6 }}><TextField size="small" label="Total" type="number" fullWidth value={dialog.form.total} onChange={(e) => setFormValue("total", e.target.value)} InputProps={moneyInputProps} /></Grid>
                  <Grid size={{ xs: 6 }}><TextField size="small" label="Moneda" fullWidth value={dialog.form.moneda} onChange={(e) => setFormValue("moneda", e.target.value)} /></Grid>
                  <Grid size={{ xs: 12 }}><TextField size="small" select label="Tipo gasto" fullWidth value={dialog.form.tipoGasto} onChange={(e) => setFormValue("tipoGasto", e.target.value)}><MenuItem value="">Sin clasificar</MenuItem>{tiposGasto.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}</TextField></Grid>
                  <Grid size={{ xs: 6 }}><TextField size="small" label="Metodo pago" fullWidth value={dialog.form.metodoPago} onChange={(e) => setFormValue("metodoPago", e.target.value)} /></Grid>
                  <Grid size={{ xs: 6 }}><TextField size="small" label="Referencia pago" fullWidth value={dialog.form.referenciaPago} onChange={(e) => setFormValue("referenciaPago", e.target.value)} /></Grid>
                  <Grid size={{ xs: 12 }}><TextField size="small" label="Descripcion" fullWidth multiline minRows={2} value={dialog.form.descripcion} onChange={(e) => setFormValue("descripcion", e.target.value)} /></Grid>
                  <Grid size={{ xs: 12 }}><TextField size="small" label="Observaciones" fullWidth multiline minRows={2} value={dialog.form.observaciones} onChange={(e) => setFormValue("observaciones", e.target.value)} /></Grid>
                </Grid>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.paper" }}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={1} sx={{ mb: 1 }}>
                  <Box>
                    <Typography variant="subtitle1">Detalle de productos / servicios</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Cuerpo de la factura detectado desde el PDF. En facturas al credito, este detalle ayuda a validar el monto antes de pagar.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="outlined" onClick={recalcularTotalesDesdeDetalle}>Recalcular totales</Button>
                    <Button size="small" variant="contained" onClick={agregarDetalle}>Agregar linea</Button>
                  </Stack>
                </Stack>
                <Box sx={{ overflow: "auto", maxHeight: { xs: 280, md: 340 }, mt: 1 }}>
                  <Table size="small" stickyHeader sx={{ minWidth: 1050 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 60 }}>#</TableCell>
                        <TableCell sx={{ minWidth: 115 }}>Cantidad</TableCell>
                        <TableCell sx={{ minWidth: 90 }}>Tipo</TableCell>
                        <TableCell sx={{ minWidth: 360 }}>Descripcion</TableCell>
                        <TableCell sx={{ minWidth: 125 }} align="right">P. unitario</TableCell>
                        <TableCell sx={{ minWidth: 120 }} align="right">Descuento</TableCell>
                        <TableCell sx={{ minWidth: 120 }} align="right">Impuesto</TableCell>
                        <TableCell sx={{ minWidth: 125 }} align="right">Total</TableCell>
                        <TableCell sx={{ width: 70 }} align="right">Accion</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dialog.detalle.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9}>
                            <Typography variant="body2" color="text.secondary">Sin lineas detectadas. Puedes agregarlas manualmente.</Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        dialog.detalle.map((item, index) => (
                          <TableRow key={item.id || index} sx={{ "& .MuiTextField-root": { bgcolor: "background.paper" } }}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell><TextField size="small" type="number" value={item.cantidad} onChange={(e) => setDetalleValue(index, "cantidad", e.target.value)} /></TableCell>
                            <TableCell><TextField size="small" value={item.tipo || ""} onChange={(e) => setDetalleValue(index, "tipo", e.target.value)} /></TableCell>
                            <TableCell><TextField size="small" fullWidth value={item.descripcion} onChange={(e) => setDetalleValue(index, "descripcion", e.target.value)} /></TableCell>
                            <TableCell><TextField size="small" type="number" value={item.precioUnitario} onChange={(e) => setDetalleValue(index, "precioUnitario", e.target.value)} InputProps={moneyInputProps} inputProps={{ style: { textAlign: "right" } }} /></TableCell>
                            <TableCell><TextField size="small" type="number" value={item.descuento} onChange={(e) => setDetalleValue(index, "descuento", e.target.value)} InputProps={moneyInputProps} inputProps={{ style: { textAlign: "right" } }} /></TableCell>
                            <TableCell><TextField size="small" type="number" value={item.impuestoMonto} onChange={(e) => setDetalleValue(index, "impuestoMonto", e.target.value)} InputProps={moneyInputProps} inputProps={{ style: { textAlign: "right" } }} /></TableCell>
                            <TableCell><TextField size="small" type="number" value={item.total} onChange={(e) => setDetalleValue(index, "total", e.target.value)} InputProps={moneyInputProps} inputProps={{ style: { textAlign: "right" } }} /></TableCell>
                            <TableCell align="right">
                              <IconButton size="small" color="error" onClick={() => quitarDetalle(index)}>
                                <DeleteOutline fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </Box>
              </Paper>
            </Grid>
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
