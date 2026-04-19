import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import {
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
  MenuItem,
} from "@mui/material";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import ManageAccountsOutlined from "@mui/icons-material/ManageAccountsOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { hasPermission } from "../auth/permissions";

interface Usuario {
  id: number;
  nombre: string;
  usuario: string;
  correo?: string | null;
  rolId: number;
  rol?: { id: number; nombre: string };
  bodegaId?: number | null;
  bodega?: { id: number; nombre: string };
}

interface Rol {
  id: number;
  nombre: string;
}

interface Bodega {
  id: number;
  nombre: string;
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [nombre, setNombre] = useState("");
  const [usuario, setUsuario] = useState("");
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [rolId, setRolId] = useState<number | "">("");
  const [bodegaId, setBodegaId] = useState<number | "">("");
  const { rol, permisos } = useAuthStore();
  const denyAlertShown = useRef(false);
  const canView = hasPermission(rol, permisos, "usuarios.view");
  const canManage = hasPermission(rol, permisos, "usuarios.manage");

  const cargar = async () => {
    try {
      setLoading(true);
      const [respUsers, respRoles, respBod] = await Promise.all([
        api.get("/usuarios"),
        api.get("/roles"),
        api.get("/bodegas"),
      ]);
      setUsuarios(respUsers.data || []);
      setRoles(respRoles.data || []);
      setBodegas(respBod.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar usuarios, roles o bodegas", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      if (!denyAlertShown.current) {
        denyAlertShown.current = true;
        Swal.fire("Acceso restringido", "No tienes permisos para ingresar a Usuarios", "warning");
      }
      return;
    }
    void cargar();
  }, [canView]);

  if (!canView) {
    return <Navigate to="/" replace />;
  }

  const abrirNuevo = () => {
    if (!canManage) return;
    setEditing(null);
    setNombre("");
    setUsuario("");
    setCorreo("");
    setPassword("");
    setRolId("");
    setBodegaId("");
    setOpenForm(true);
  };

  const abrirEditar = (u: Usuario) => {
    if (!canManage) return;
    setEditing(u);
    setNombre(u.nombre);
    setUsuario(u.usuario);
    setCorreo(u.correo || "");
    setPassword("");
    setRolId(u.rolId || "");
    setBodegaId(u.bodegaId ?? "");
    setOpenForm(true);
  };

  const guardar = async () => {
    if (!canManage) {
      Swal.fire("Acceso restringido", "No tienes permisos para modificar usuarios", "warning");
      return;
    }

    if (!nombre.trim() || !usuario.trim() || !correo.trim() || (!editing && !password.trim())) {
      Swal.fire("Validacion", "Nombre, usuario, correo y contraseña son obligatorios", "info");
      return;
    }
    if (!rolId) {
      Swal.fire("Validacion", "Selecciona un rol", "info");
      return;
    }
    if (!bodegaId) {
      Swal.fire("Validacion", "Selecciona una bodega", "info");
      return;
    }

    const payload: any = {
      nombre: nombre.trim(),
      usuario: usuario.trim(),
      correo: correo.trim(),
      rolId: Number(rolId),
      bodegaId: Number(bodegaId),
    };
    if (password.trim()) payload.password = password;

    try {
      if (editing) {
        await api.patch(`/usuarios/${editing.id}`, payload);
        Swal.fire("Actualizado", "Usuario actualizado", "success");
      } else {
        await api.post("/usuarios", payload);
        Swal.fire("Creado", "Usuario creado", "success");
      }
      setOpenForm(false);
      await cargar();
    } catch {
      Swal.fire("Error", "No se pudo guardar el usuario", "error");
    }
  };

  const eliminar = async (u: Usuario) => {
    if (!canManage) {
      Swal.fire("Acceso restringido", "No tienes permisos para eliminar usuarios", "warning");
      return;
    }

    const confirm = await Swal.fire({
      title: "Eliminar usuario",
      text: `Se eliminara "${u.usuario}".`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Si, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;

    try {
      await api.delete(`/usuarios/${u.id}`);
      Swal.fire("Eliminado", "Usuario eliminado", "success");
      await cargar();
    } catch {
      Swal.fire("Error", "No se pudo eliminar el usuario", "error");
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ManageAccountsOutlined color="primary" />
          <Typography variant="h4">Usuarios</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<AddOutlined />} variant="contained" size="small" onClick={abrirNuevo} disabled={!canManage}>
            Nuevo usuario
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
        Administra usuarios y sus roles.
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Usuario</TableCell>
              <TableCell>Correo</TableCell>
              <TableCell>Rol</TableCell>
              <TableCell>Bodega</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {usuarios.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.id}</TableCell>
                <TableCell>{u.nombre}</TableCell>
                <TableCell>{u.usuario}</TableCell>
                <TableCell>{u.correo || "N/D"}</TableCell>
                <TableCell>{u.rol?.nombre || u.rolId}</TableCell>
                <TableCell>{u.bodega?.nombre || u.bodegaId || "N/D"}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<EditOutlined />}
                      disabled={!canManage}
                      onClick={() => abrirEditar(u)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      color="error"
                      startIcon={<DeleteOutline />}
                      disabled={!canManage}
                      onClick={() => eliminar(u)}
                    >
                      Eliminar
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {!usuarios.length && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No hay usuarios registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openForm} onClose={() => setOpenForm(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} fullWidth autoFocus disabled={!canManage} />
            <TextField label="Usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} fullWidth disabled={!canManage} />
            <TextField label="Correo electrónico" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} fullWidth disabled={!canManage} />
            <TextField
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              disabled={!canManage}
              helperText={editing ? "Déjalo vacío para no cambiarla" : ""}
            />
            <TextField label="Rol" select value={rolId === "" ? "" : rolId} onChange={(e) => setRolId(Number(e.target.value))} fullWidth disabled={!canManage}>
              <MenuItem value="">Selecciona un rol</MenuItem>
              {roles.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.nombre}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Bodega" select value={bodegaId === "" ? "" : bodegaId} onChange={(e) => setBodegaId(Number(e.target.value))} fullWidth disabled={!canManage}>
              <MenuItem value="">Selecciona una bodega</MenuItem>
              {bodegas.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.nombre}
                </MenuItem>
              ))}
            </TextField>
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
