import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddBusinessOutlined from "@mui/icons-material/AddBusinessOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import EditOutlined from "@mui/icons-material/EditOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";
import { formatCurrency } from "../utils/currency";

interface Proveedor {
  id: number;
  nombre: string;
  razonSocial?: string | null;
  nit?: string | null;
  contacto?: string | null;
  puestoContacto?: string | null;
  telefono?: string | null;
  telefonoSecundario?: string | null;
  correo?: string | null;
  sitioWeb?: string | null;
  direccion?: string | null;
  tipo?: string | null;
  banco?: string | null;
  numeroCuenta?: string | null;
  tipoCuenta?: string | null;
  diasCredito: number;
  limiteCredito: number;
  estado: string;
  observaciones?: string | null;
  creadoEn?: string | null;
  _count?: {
    ordenes?: number;
    rollosTela?: number;
  };
}

const tiposProveedor = ["telas", "insumos", "bordados", "logistica", "servicios", "otros"];
const estadosProveedor = ["activo", "inactivo", "bloqueado"];
const tiposCuenta = ["monetaria", "ahorro", "cheque", "otro"];

const emptyForm = {
  nombre: "",
  razonSocial: "",
  nit: "",
  tipo: "telas",
  estado: "activo",
  contacto: "",
  puestoContacto: "",
  telefono: "",
  telefonoSecundario: "",
  correo: "",
  sitioWeb: "",
  direccion: "",
  banco: "",
  numeroCuenta: "",
  tipoCuenta: "",
  diasCredito: "0",
  limiteCredito: "0",
  observaciones: "",
};

const toForm = (row: Proveedor) => ({
  nombre: row.nombre || "",
  razonSocial: row.razonSocial || "",
  nit: row.nit || "",
  tipo: row.tipo || "telas",
  estado: row.estado || "activo",
  contacto: row.contacto || "",
  puestoContacto: row.puestoContacto || "",
  telefono: row.telefono || "",
  telefonoSecundario: row.telefonoSecundario || "",
  correo: row.correo || "",
  sitioWeb: row.sitioWeb || "",
  direccion: row.direccion || "",
  banco: row.banco || "",
  numeroCuenta: row.numeroCuenta || "",
  tipoCuenta: row.tipoCuenta || "",
  diasCredito: String(row.diasCredito || 0),
  limiteCredito: String(row.limiteCredito || 0),
  observaciones: row.observaciones || "",
});

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("es-GT") : "N/D");

export default function Proveedores() {
  const { rol, permisos } = useAuthStore();
  const canManage = hasPermission(rol, permisos, "proveedores.manage");
  const [rows, setRows] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({ q: "", estado: "", tipo: "" });
  const [dialog, setDialog] = useState<{ open: boolean; editing: Proveedor | null; form: typeof emptyForm }>({
    open: false,
    editing: null,
    form: emptyForm,
  });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filtros).filter(([, value]) => value));
      const resp = await api.get("/proveedores", { params });
      setRows(resp.data || []);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudieron cargar los proveedores", "error");
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const resumen = useMemo(() => {
    const activos = rows.filter((row) => row.estado === "activo").length;
    const conTela = rows.filter((row) => Number(row._count?.rollosTela || 0) > 0).length;
    const credito = rows.reduce((sum, row) => sum + Number(row.limiteCredito || 0), 0);
    return { total: rows.length, activos, conTela, credito };
  }, [rows]);

  const abrirNuevo = () => {
    if (!canManage) return;
    setDialog({ open: true, editing: null, form: emptyForm });
  };

  const abrirEditar = (row: Proveedor) => {
    if (!canManage) return;
    setDialog({ open: true, editing: row, form: toForm(row) });
  };

  const guardar = async () => {
    if (!canManage) {
      Swal.fire("Acceso restringido", "No tienes permisos para modificar proveedores", "warning");
      return;
    }
    if (!dialog.form.nombre.trim()) {
      Swal.fire("Validacion", "Ingresa el nombre del proveedor", "info");
      return;
    }

    const payload = {
      ...dialog.form,
      diasCredito: Number(dialog.form.diasCredito || 0),
      limiteCredito: Number(dialog.form.limiteCredito || 0),
    };

    try {
      if (dialog.editing) {
        await api.patch(`/proveedores/${dialog.editing.id}`, payload);
      } else {
        await api.post("/proveedores", payload);
      }
      setDialog({ open: false, editing: null, form: emptyForm });
      await cargar();
      Swal.fire("Listo", "Proveedor guardado correctamente", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo guardar el proveedor", "error");
    }
  };

  const eliminar = async (row: Proveedor) => {
    if (!canManage) return;
    const result = await Swal.fire({
      title: "Eliminar proveedor",
      text: `Se eliminara ${row.nombre}.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/proveedores/${row.id}`);
      await cargar();
      Swal.fire("Listo", "Proveedor eliminado", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo eliminar el proveedor", "error");
    }
  };

  const columns: GridColDef<Proveedor>[] = [
    { field: "nombre", headerName: "Proveedor", minWidth: 190, flex: 1 },
    { field: "nit", headerName: "NIT", width: 130, valueGetter: (value) => value || "N/D" },
    { field: "tipo", headerName: "Tipo", width: 120, valueGetter: (value) => value || "N/D" },
    {
      field: "estado",
      headerName: "Estado",
      width: 120,
      renderCell: ({ row }) => (
        <Chip
          size="small"
          label={row.estado || "activo"}
          color={row.estado === "activo" ? "success" : row.estado === "bloqueado" ? "error" : "default"}
        />
      ),
    },
    { field: "contacto", headerName: "Contacto", minWidth: 170, flex: 0.8, valueGetter: (value) => value || "N/D" },
    { field: "telefono", headerName: "Telefono", width: 135, valueGetter: (value) => value || "N/D" },
    { field: "correo", headerName: "Correo", minWidth: 190, flex: 0.9, valueGetter: (value) => value || "N/D" },
    { field: "diasCredito", headerName: "Dias credito", width: 120 },
    {
      field: "limiteCredito",
      headerName: "Limite credito",
      width: 140,
      valueFormatter: (value) => formatCurrency(Number(value || 0)),
    },
    {
      field: "rollosTela",
      headerName: "Rollos tela",
      width: 120,
      valueGetter: (_, row) => row._count?.rollosTela || 0,
    },
    {
      field: "ordenes",
      headerName: "Ordenes",
      width: 105,
      valueGetter: (_, row) => row._count?.ordenes || 0,
    },
    { field: "creadoEn", headerName: "Creado", width: 120, valueFormatter: (value) => formatDate(String(value || "")) },
    {
      field: "acciones",
      headerName: "Acciones",
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" disabled={!canManage} onClick={() => abrirEditar(row)}>
            <EditOutlined fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" disabled={!canManage} onClick={() => void eliminar(row)}>
            <DeleteOutline fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  const setFormValue = (field: keyof typeof emptyForm, value: string) => {
    setDialog((prev) => ({ ...prev, form: { ...prev.form, [field]: value } }));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={600}>
            Proveedores
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Catalogo de proveedores para telas, insumos, bordados, servicios y logistica.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RefreshOutlined />} variant="outlined" onClick={() => void cargar()} disabled={loading}>
            Recargar
          </Button>
          <Button startIcon={<AddBusinessOutlined />} variant="contained" onClick={abrirNuevo} disabled={!canManage}>
            Nuevo proveedor
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <StorefrontOutlined color="primary" />
              <Box>
                <Typography variant="caption" color="text.secondary">Total proveedores</Typography>
                <Typography variant="h5" fontWeight={600}>{resumen.total}</Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">Activos</Typography>
            <Typography variant="h5" fontWeight={600}>{resumen.activos}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Inventory2Outlined color="primary" />
              <Box>
                <Typography variant="caption" color="text.secondary">Con rollos vinculados</Typography>
                <Typography variant="h5" fontWeight={600}>{resumen.conTela}</Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">Credito registrado</Typography>
            <Typography variant="h5" fontWeight={600}>{formatCurrency(resumen.credito)}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 5 }}>
            <TextField
              label="Buscar"
              size="small"
              fullWidth
              value={filtros.q}
              onChange={(e) => setFiltros((prev) => ({ ...prev, q: e.target.value }))}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              select
              label="Tipo"
              size="small"
              fullWidth
              value={filtros.tipo}
              onChange={(e) => setFiltros((prev) => ({ ...prev, tipo: e.target.value }))}
            >
              <MenuItem value="">Todos</MenuItem>
              {tiposProveedor.map((tipo) => (
                <MenuItem key={tipo} value={tipo}>{tipo}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              select
              label="Estado"
              size="small"
              fullWidth
              value={filtros.estado}
              onChange={(e) => setFiltros((prev) => ({ ...prev, estado: e.target.value }))}
            >
              <MenuItem value="">Todos</MenuItem>
              {estadosProveedor.map((estado) => (
                <MenuItem key={estado} value={estado}>{estado}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 1 }}>
        <Box sx={{ height: 620, p: 2 }}>
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            disableRowSelectionOnClick
          />
        </Box>
      </Paper>

      <Dialog open={dialog.open} onClose={() => setDialog((prev) => ({ ...prev, open: false }))} maxWidth="md" fullWidth>
        <DialogTitle>{dialog.editing ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="subtitle2" color="primary">Datos generales</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField label="Nombre comercial" required fullWidth value={dialog.form.nombre} onChange={(e) => setFormValue("nombre", e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField label="Razon social" fullWidth value={dialog.form.razonSocial} onChange={(e) => setFormValue("razonSocial", e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField label="NIT" fullWidth value={dialog.form.nit} onChange={(e) => setFormValue("nit", e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField select label="Tipo" fullWidth value={dialog.form.tipo} onChange={(e) => setFormValue("tipo", e.target.value)}>
                  {tiposProveedor.map((tipo) => <MenuItem key={tipo} value={tipo}>{tipo}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField select label="Estado" fullWidth value={dialog.form.estado} onChange={(e) => setFormValue("estado", e.target.value)}>
                  {estadosProveedor.map((estado) => <MenuItem key={estado} value={estado}>{estado}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>

            <Divider />
            <Typography variant="subtitle2" color="primary">Contacto</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 5 }}>
                <TextField label="Persona de contacto" fullWidth value={dialog.form.contacto} onChange={(e) => setFormValue("contacto", e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField label="Puesto" fullWidth value={dialog.form.puestoContacto} onChange={(e) => setFormValue("puestoContacto", e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField label="Telefono" fullWidth value={dialog.form.telefono} onChange={(e) => setFormValue("telefono", e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField label="Telefono secundario" fullWidth value={dialog.form.telefonoSecundario} onChange={(e) => setFormValue("telefonoSecundario", e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField label="Correo" type="email" fullWidth value={dialog.form.correo} onChange={(e) => setFormValue("correo", e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <TextField label="Sitio web" fullWidth value={dialog.form.sitioWeb} onChange={(e) => setFormValue("sitioWeb", e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField label="Direccion" fullWidth value={dialog.form.direccion} onChange={(e) => setFormValue("direccion", e.target.value)} />
              </Grid>
            </Grid>

            <Divider />
            <Typography variant="subtitle2" color="primary">Credito y banco</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField label="Dias credito" type="number" fullWidth value={dialog.form.diasCredito} onChange={(e) => setFormValue("diasCredito", e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField label="Limite credito" type="number" fullWidth value={dialog.form.limiteCredito} onChange={(e) => setFormValue("limiteCredito", e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField label="Banco" fullWidth value={dialog.form.banco} onChange={(e) => setFormValue("banco", e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField label="Numero de cuenta" fullWidth value={dialog.form.numeroCuenta} onChange={(e) => setFormValue("numeroCuenta", e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField select label="Tipo de cuenta" fullWidth value={dialog.form.tipoCuenta} onChange={(e) => setFormValue("tipoCuenta", e.target.value)}>
                  <MenuItem value="">Sin definir</MenuItem>
                  {tiposCuenta.map((tipo) => <MenuItem key={tipo} value={tipo}>{tipo}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField label="Observaciones" multiline minRows={2} fullWidth value={dialog.form.observaciones} onChange={(e) => setFormValue("observaciones", e.target.value)} />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog((prev) => ({ ...prev, open: false }))}>Cancelar</Button>
          <Button variant="contained" onClick={() => void guardar()}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
