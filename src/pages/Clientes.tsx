import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import InsightsOutlined from "@mui/icons-material/InsightsOutlined";
import PeopleOutline from "@mui/icons-material/PeopleOutline";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { hasPermission } from "../auth/permissions";

interface Cliente {
  id: number;
  nombre: string;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  tipoCliente?: string | null;
  logoUrl?: string | null;
  creadoEn?: string | null;
  fechaRegistro?: string | null;
  _count?: { ventas?: number };
  usuarioId?: number | null;
  usuario?: { id: number; nombre?: string | null; usuario?: string | null } | null;
}

interface UsuarioOption {
  id: number;
  nombre: string;
  usuario: string;
}

const tipos = ["mayorista", "minorista", "corporativo", "frecuente"];

const getImageUrl = (path?: string | null) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) return path;
  return `${api.defaults.baseURL || ""}${path}`;
};

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString("es-GT") : "N/D");

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [selected, setSelected] = useState<Cliente | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [direccion, setDireccion] = useState("");
  const [tipoCliente, setTipoCliente] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [usuarioFiltro, setUsuarioFiltro] = useState<string>("");
  const { rol, permisos, id: currentUserId, nombre: currentNombre, usuario: currentUsuario } = useAuthStore();
  const canManage = hasPermission(rol, permisos, "clientes.manage");
  const isAdmin = rol === "ADMIN";
  const navigate = useNavigate();

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const params = isAdmin && usuarioFiltro ? { usuarioId: usuarioFiltro } : undefined;
      const resp = await api.get("/clientes", { params });
      setClientes(resp.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar los clientes", "error");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, usuarioFiltro]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!isAdmin) {
      setUsuarioFiltro(currentUserId ? String(currentUserId) : "");
      return;
    }
    api
      .get("/usuarios")
      .then(({ data }) => {
        const rows = Array.isArray(data) ? data : [];
        setUsuarios(rows.map((item: any) => ({ id: Number(item.id), nombre: item.nombre || item.usuario, usuario: item.usuario })));
      })
      .catch(() => setUsuarios([]));
  }, [currentUserId, isAdmin]);

  const limpiarFormulario = () => {
    setEditing(null);
    setNombre("");
    setTelefono("");
    setCorreo("");
    setDireccion("");
    setTipoCliente("");
    setLogoFile(null);
    setLogoPreview("");
  };

  const abrirNuevo = () => {
    if (!canManage) return;
    limpiarFormulario();
    setOpenForm(true);
  };

  const abrirEditar = (c: Cliente) => {
    if (!canManage) return;
    setEditing(c);
    setNombre(c.nombre);
    setTelefono(c.telefono || "");
    setCorreo(c.correo || "");
    setDireccion(c.direccion || "");
    setTipoCliente(c.tipoCliente || "");
    setLogoFile(null);
    setLogoPreview(getImageUrl(c.logoUrl));
    setOpenForm(true);
  };

  const abrirVer = (c: Cliente) => {
    setSelected(c);
    setOpenView(true);
  };

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setLogoFile(file);
    if (logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoPreview(file ? URL.createObjectURL(file) : editing?.logoUrl ? getImageUrl(editing.logoUrl) : "");
  };

  const guardar = async () => {
    if (!canManage) {
      Swal.fire("Acceso restringido", "No tienes permisos para modificar clientes", "warning");
      return;
    }

    if (!nombre.trim()) {
      Swal.fire("Validacion", "Ingresa el nombre del cliente", "info");
      return;
    }

    const payload = new FormData();
    payload.append("nombre", nombre.trim());
    payload.append("telefono", telefono.trim());
    payload.append("correo", correo.trim());
    payload.append("direccion", direccion.trim());
    payload.append("tipoCliente", tipoCliente);
    if (logoFile) payload.append("logo", logoFile);

    try {
      if (editing) {
        await api.patch(`/clientes/${editing.id}`, payload);
        Swal.fire("Actualizado", "Cliente actualizado", "success");
      } else {
        await api.post("/clientes", payload);
        Swal.fire("Creado", "Cliente creado", "success");
      }
      setOpenForm(false);
      limpiarFormulario();
      await cargar();
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo guardar el cliente", "error");
    }
  };

  const eliminar = async (c: Cliente) => {
    if (!canManage) {
      Swal.fire("Acceso restringido", "No tienes permisos para eliminar clientes", "warning");
      return;
    }

    const confirm = await Swal.fire({
      title: "Eliminar cliente",
      text: `Se eliminara "${c.nombre}".`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Si, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;

    try {
      await api.delete(`/clientes/${c.id}`);
      Swal.fire("Eliminado", "Cliente eliminado", "success");
      await cargar();
    } catch {
      Swal.fire("Error", "No se pudo eliminar el cliente", "error");
    }
  };

  const columns: GridColDef<Cliente>[] = [
      {
        field: "logoUrl",
        headerName: "Logo",
        width: 80,
        sortable: false,
        renderCell: (params) => (
          <Avatar src={getImageUrl(params.row.logoUrl)} sx={{ width: 34, height: 34 }}>
            {(params.row.nombre || "C").slice(0, 1).toUpperCase()}
          </Avatar>
        ),
      },
      { field: "id", headerName: "ID", width: 80 },
      { field: "nombre", headerName: "Nombre", minWidth: 220, flex: 1 },
      { field: "telefono", headerName: "Telefono", minWidth: 140, flex: 0.7, valueGetter: (value) => value || "N/D" },
      { field: "correo", headerName: "Correo", minWidth: 190, flex: 0.9, valueGetter: (value) => value || "N/D" },
      { field: "tipoCliente", headerName: "Tipo", minWidth: 130, flex: 0.6, valueGetter: (value) => value || "N/D" },
      {
        field: "usuarioCartera",
        headerName: "Cartera",
        minWidth: 170,
        flex: 0.8,
        valueGetter: (_, row) => row.usuario?.nombre || row.usuario?.usuario || "Sin asignar",
      },
      {
        field: "fechaRegistro",
        headerName: "Fecha registro",
        minWidth: 180,
        flex: 0.8,
        valueGetter: (value, row) => formatDate(`${value || row.creadoEn || ""}`),
      },
      {
        field: "ventas",
        headerName: "Ventas",
        width: 110,
        valueGetter: (_, row) => row._count?.ventas || 0,
      },
      {
        field: "acciones",
        headerName: "Acciones",
        minWidth: 330,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ height: "100%" }}>
            <Button variant="text" size="small" startIcon={<VisibilityOutlined />} onClick={() => abrirVer(params.row)}>
              Ver
            </Button>
            <Button variant="text" size="small" startIcon={<InsightsOutlined />} onClick={() => navigate(`/clientes/${params.row.id}/ficha`)}>
              Ficha
            </Button>
            <Button variant="text" size="small" startIcon={<EditOutlined />} disabled={!canManage} onClick={() => abrirEditar(params.row)}>
              Editar
            </Button>
            <Button variant="text" size="small" color="error" startIcon={<DeleteOutline />} disabled={!canManage} onClick={() => eliminar(params.row)}>
              Eliminar
            </Button>
          </Stack>
        ),
      },
  ];

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <PeopleOutline color="primary" />
          <Typography variant="h4">Clientes</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<AddOutlined />} variant="contained" size="small" onClick={abrirNuevo} disabled={!canManage}>
            Nuevo cliente
          </Button>
          <Button startIcon={<RefreshOutlined />} variant="outlined" size="small" onClick={cargar} disabled={loading}>
            Recargar
          </Button>
        </Stack>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Gestiona clientes, logotipos y revisa su actividad comercial.
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
        {isAdmin ? (
          <TextField
            select
            label="Cartera de usuario"
            size="small"
            value={usuarioFiltro}
            onChange={(event) => setUsuarioFiltro(event.target.value)}
            sx={{ minWidth: 260 }}
          >
            <MenuItem value="">Todos los usuarios</MenuItem>
            {usuarios.map((item) => (
              <MenuItem key={item.id} value={String(item.id)}>
                {item.nombre} ({item.usuario})
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <TextField
            label="Cartera de usuario"
            size="small"
            value={currentNombre || currentUsuario || ""}
            disabled
            sx={{ minWidth: 260 }}
          />
        )}
      </Stack>

      <Box sx={{ height: 560, width: "100%" }}>
        <DataGrid
          rows={clientes}
          columns={columns}
          getRowId={(row) => row.id}
          loading={loading}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          disableRowSelectionOnClick
          localeText={{ noRowsLabel: "No hay clientes registrados." }}
        />
      </Box>

      <Dialog open={openView} onClose={() => setOpenView(false)} fullWidth maxWidth="sm">
        <DialogTitle>Datos del cliente</DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar src={getImageUrl(selected.logoUrl)} sx={{ width: 72, height: 72 }}>
                  {(selected.nombre || "C").slice(0, 1).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="h6">{selected.nombre}</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                    <Chip size="small" label={selected.tipoCliente || "Sin tipo"} />
                    <Chip size="small" color="primary" label={`${selected._count?.ventas || 0} venta(s)`} />
                  </Stack>
                </Box>
              </Stack>
              <Box>
                <Typography variant="caption" color="text.secondary">Telefono</Typography>
                <Typography>{selected.telefono || "N/D"}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Correo</Typography>
                <Typography>{selected.correo || "N/D"}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Direccion</Typography>
                <Typography>{selected.direccion || "N/D"}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Fecha de creacion</Typography>
                <Typography>{formatDate(selected.fechaRegistro || selected.creadoEn)}</Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenView(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openForm} onClose={() => setOpenForm(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} fullWidth autoFocus disabled={!canManage} />
            <TextField label="Telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} fullWidth disabled={!canManage} />
            <TextField label="Correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} fullWidth disabled={!canManage} />
            <TextField label="Direccion" value={direccion} onChange={(e) => setDireccion(e.target.value)} fullWidth disabled={!canManage} />
            <TextField label="Tipo de cliente" select value={tipoCliente} onChange={(e) => setTipoCliente(e.target.value)} fullWidth disabled={!canManage}>
              <MenuItem value="">Sin especificar</MenuItem>
              {tipos.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar src={logoPreview} sx={{ width: 64, height: 64 }}>
                {(nombre || "C").slice(0, 1).toUpperCase()}
              </Avatar>
              <Box>
                <Button component="label" variant="outlined" disabled={!canManage}>
                  Subir logotipo
                  <input hidden type="file" accept="image/*" onChange={handleLogoChange} />
                </Button>
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                  JPG, PNG o WebP. Tamano maximo 5 MB.
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenForm(false)}>Cancelar</Button>
          <Button variant="contained" onClick={guardar} disabled={!canManage}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
