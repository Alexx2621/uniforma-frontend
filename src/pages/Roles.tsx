import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Box,
  Checkbox,
  FormControlLabel,
  Paper,
  Typography,
  Stack,
  Button,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import AdminPanelSettingsOutlined from "@mui/icons-material/AdminPanelSettingsOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { hasPermission } from "../auth/permissions";

interface Rol {
  id: number;
  nombre: string;
  descripcion?: string | null;
  permisos?: Array<{ permiso: { nombre: string; descripcion?: string | null } }>;
}

interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  category: string;
}

export default function Roles() {
  const [roles, setRoles] = useState<Rol[]>([]);
  const [catalogo, setCatalogo] = useState<PermissionDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Rol | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [permisosSeleccionados, setPermisosSeleccionados] = useState<string[]>([]);
  const denyAlertShown = useRef(false);
  const { rol, permisos } = useAuthStore();
  const canView = hasPermission(rol, permisos, "roles.view");
  const canManage = hasPermission(rol, permisos, "roles.manage");

  const cargar = async () => {
    try {
      setLoading(true);
      const [rolesResp, catalogoResp] = await Promise.all([
        api.get("/roles"),
        api.get("/roles/permisos/catalogo"),
      ]);
      setRoles(rolesResp.data || []);
      setCatalogo(catalogoResp.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar los roles", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      if (!denyAlertShown.current) {
        denyAlertShown.current = true;
        Swal.fire("Acceso restringido", "No tienes permisos para ingresar a Roles", "warning");
      }
      return;
    }
    cargar();
  }, [canView]);

  if (!canView) {
    return <Navigate to="/" replace />;
  }

  const abrirNuevo = () => {
    setEditing(null);
    setNombre("");
    setDescripcion("");
    setPermisosSeleccionados([]);
    setOpenForm(true);
  };

  const abrirEditar = (item: Rol) => {
    setEditing(item);
    setNombre(item.nombre);
    setDescripcion(item.descripcion || "");
    setPermisosSeleccionados(item.permisos?.map((permiso) => permiso.permiso.nombre) || []);
    setOpenForm(true);
  };

  const guardar = async () => {
    if (!editing && !nombre.trim()) {
      Swal.fire("Validacion", "Ingresa el nombre del rol", "info");
      return;
    }

    const payload = {
      descripcion: descripcion.trim() || null,
      permisos: permisosSeleccionados,
    } as { nombre?: string; descripcion: string | null };

    if (!editing) {
      payload.nombre = nombre.trim();
    }

    try {
      if (editing) {
        await api.put(`/roles/${editing.id}`, payload);
        Swal.fire("Actualizado", "Rol actualizado", "success");
      } else {
        await api.post("/roles", payload);
        Swal.fire("Creado", "Rol creado", "success");
      }
      setOpenForm(false);
      await cargar();
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo guardar el rol", "error");
    }
  };

  const eliminar = async (item: Rol) => {
    const confirm = await Swal.fire({
      title: "Eliminar rol",
      text: `Se eliminara "${item.nombre}".`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Si, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;

    try {
      await api.delete(`/roles/${item.id}`);
      Swal.fire("Eliminado", "Rol eliminado", "success");
      await cargar();
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo eliminar el rol", "error");
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AdminPanelSettingsOutlined color="primary" />
          <Typography variant="h4">Roles</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<AddOutlined />} variant="contained" size="small" onClick={abrirNuevo} disabled={!canManage}>
            Nuevo rol
          </Button>
          <Button
            startIcon={<RefreshOutlined />}
            variant="outlined"
            size="small"
            onClick={cargar}
            disabled={loading}
          >
            Recargar
          </Button>
        </Stack>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Administra los roles disponibles para asignarlos a los usuarios.
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Descripcion</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.id}</TableCell>
                <TableCell>{item.nombre}</TableCell>
                <TableCell>{item.descripcion || "N/D"}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<EditOutlined />}
                      disabled={!canManage}
                      onClick={() => abrirEditar(item)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      color="error"
                      startIcon={<DeleteOutline />}
                      disabled={!canManage}
                      onClick={() => eliminar(item)}
                    >
                      Eliminar
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {!roles.length && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  No hay roles registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openForm} onClose={() => setOpenForm(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Editar rol" : "Nuevo rol"}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              fullWidth
              autoFocus
              disabled={Boolean(editing)}
              helperText={editing ? "El nombre del rol no se puede modificar" : undefined}
            />
            <TextField
              label="Descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Permisos del rol
              </Typography>
              <Stack spacing={1}>
                {Array.from(
                  catalogo.reduce((acc, permission) => {
                    const list = acc.get(permission.category) || [];
                    list.push(permission);
                    acc.set(permission.category, list);
                    return acc;
                  }, new Map<string, PermissionDefinition[]>())
                ).map(([category, permissionsGroup]) => (
                  <Paper key={category} variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      {category}
                    </Typography>
                    <Stack>
                      {permissionsGroup.map((permission) => (
                        <FormControlLabel
                          key={permission.key}
                          control={
                            <Checkbox
                              checked={permisosSeleccionados.includes(permission.key)}
                              onChange={(e) =>
                                setPermisosSeleccionados((current) =>
                                  e.target.checked
                                    ? [...current, permission.key]
                                    : current.filter((item) => item !== permission.key)
                                )
                              }
                            />
                          }
                          label={`${permission.label} - ${permission.description}`}
                        />
                      ))}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
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
