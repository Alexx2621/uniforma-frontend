import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
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
  primerNombre?: string | null;
  segundoNombre?: string | null;
  primerApellido?: string | null;
  segundoApellido?: string | null;
  usuario: string;
  correo?: string | null;
  telefono?: string | null;
  dpi?: string | null;
  direccion?: string | null;
  fechaNacimiento?: string | null;
  fotoUrl?: string | null;
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

const getImageUrl = (path?: string | null) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) return path;
  return `${api.defaults.baseURL || ""}${path}`;
};

const formatDateForInput = (value?: string | null) => {
  if (!value) return "";
  return value.slice(0, 10);
};

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [primerNombre, setPrimerNombre] = useState("");
  const [segundoNombre, setSegundoNombre] = useState("");
  const [primerApellido, setPrimerApellido] = useState("");
  const [segundoApellido, setSegundoApellido] = useState("");
  const [usuario, setUsuario] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [dpi, setDpi] = useState("");
  const [direccion, setDireccion] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [password, setPassword] = useState("");
  const [rolId, setRolId] = useState<number | "">("");
  const [bodegaId, setBodegaId] = useState<number | "">("");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const { rol, permisos } = useAuthStore();
  const denyAlertShown = useRef(false);
  const canView = hasPermission(rol, permisos, "usuarios.view");
  const canManage = hasPermission(rol, permisos, "usuarios.manage");
  const canViewRoles = hasPermission(rol, permisos, "roles.view");

  const nombreCompleto = useMemo(
    () =>
      [primerNombre, segundoNombre, primerApellido, segundoApellido]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(" "),
    [primerNombre, segundoNombre, primerApellido, segundoApellido]
  );

  const cargar = async () => {
    try {
      setLoading(true);
      const [respUsers, respRoles, respBod] = await Promise.allSettled([
        api.get("/usuarios"),
        canViewRoles || canManage ? api.get("/roles") : Promise.resolve({ data: [] }),
        api.get("/bodegas"),
      ]);

      if (respUsers.status !== "fulfilled") {
        throw new Error("usuarios");
      }

      if (respBod.status !== "fulfilled") {
        throw new Error("bodegas");
      }

      setUsuarios(respUsers.value.data || []);
      setBodegas(respBod.value.data || []);
      setRoles(respRoles.status === "fulfilled" ? respRoles.value.data || [] : []);

      if (respRoles.status !== "fulfilled" && (canViewRoles || canManage)) {
        Swal.fire("Aviso", "Se cargaron los usuarios, pero no fue posible cargar el catalogo de roles.", "warning");
      }
    } catch {
      Swal.fire("Error", "No se pudieron cargar usuarios o bodegas", "error");
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

  useEffect(() => {
    return () => {
      if (fotoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(fotoPreview);
      }
    };
  }, [fotoPreview]);

  if (!canView) {
    return <Navigate to="/" replace />;
  }

  const limpiarFormulario = () => {
    setEditing(null);
    setPrimerNombre("");
    setSegundoNombre("");
    setPrimerApellido("");
    setSegundoApellido("");
    setUsuario("");
    setCorreo("");
    setTelefono("");
    setDpi("");
    setDireccion("");
    setFechaNacimiento("");
    setPassword("");
    setRolId("");
    setBodegaId("");
    setFotoFile(null);
    setFotoPreview("");
  };

  const abrirNuevo = () => {
    if (!canManage) return;
    limpiarFormulario();
    setOpenForm(true);
  };

  const abrirEditar = (u: Usuario) => {
    if (!canManage) return;
    setEditing(u);
    setPrimerNombre(u.primerNombre || u.nombre || "");
    setSegundoNombre(u.segundoNombre || "");
    setPrimerApellido(u.primerApellido || "");
    setSegundoApellido(u.segundoApellido || "");
    setUsuario(u.usuario);
    setCorreo(u.correo || "");
    setTelefono(u.telefono || "");
    setDpi(u.dpi || "");
    setDireccion(u.direccion || "");
    setFechaNacimiento(formatDateForInput(u.fechaNacimiento));
    setPassword("");
    setRolId(u.rolId || "");
    setBodegaId(u.bodegaId ?? "");
    setFotoFile(null);
    setFotoPreview(getImageUrl(u.fotoUrl));
    setOpenForm(true);
  };

  const handleFotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setFotoFile(file);

    if (fotoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(fotoPreview);
    }

    if (file) {
      setFotoPreview(URL.createObjectURL(file));
    } else {
      setFotoPreview(editing?.fotoUrl ? getImageUrl(editing.fotoUrl) : "");
    }
  };

  const guardar = async () => {
    if (!canManage) {
      Swal.fire("Acceso restringido", "No tienes permisos para modificar usuarios", "warning");
      return;
    }

    if (!primerNombre.trim() || !usuario.trim() || !correo.trim() || (!editing && !password.trim())) {
      Swal.fire("Validacion", "Primer nombre, usuario, correo y contraseña son obligatorios", "info");
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

    const payload = new FormData();
    payload.append("nombre", nombreCompleto || primerNombre.trim());
    payload.append("primerNombre", primerNombre.trim());
    payload.append("segundoNombre", segundoNombre.trim());
    payload.append("primerApellido", primerApellido.trim());
    payload.append("segundoApellido", segundoApellido.trim());
    payload.append("usuario", usuario.trim());
    payload.append("correo", correo.trim());
    payload.append("telefono", telefono.trim());
    payload.append("dpi", dpi.trim());
    payload.append("direccion", direccion.trim());
    payload.append("fechaNacimiento", fechaNacimiento.trim());
    payload.append("rolId", String(rolId));
    payload.append("bodegaId", String(bodegaId));
    if (password.trim()) payload.append("password", password);
    if (fotoFile) payload.append("foto", fotoFile);

    try {
      if (editing) {
        await api.patch(`/usuarios/${editing.id}`, payload);
        Swal.fire("Actualizado", "Usuario actualizado", "success");
      } else {
        await api.post("/usuarios", payload);
        Swal.fire("Creado", "Usuario creado", "success");
      }
      setOpenForm(false);
      limpiarFormulario();
      await cargar();
    } catch (error: any) {
      const msg = error?.response?.data?.message || "No se pudo guardar el usuario";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
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
          <Button startIcon={<RefreshOutlined />} variant="outlined" size="small" onClick={cargar} disabled={loading}>
            Recargar
          </Button>
        </Stack>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Administra usuarios, datos personales y foto de perfil.
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Foto</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Usuario</TableCell>
              <TableCell>Telefono</TableCell>
              <TableCell>DPI</TableCell>
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
                <TableCell>
                  <Avatar src={getImageUrl(u.fotoUrl)} sx={{ width: 36, height: 36 }}>
                    {(u.nombre || u.usuario || "U").slice(0, 1).toUpperCase()}
                  </Avatar>
                </TableCell>
                <TableCell>{u.nombre}</TableCell>
                <TableCell>{u.usuario}</TableCell>
                <TableCell>{u.telefono || "N/D"}</TableCell>
                <TableCell>{u.dpi || "N/D"}</TableCell>
                <TableCell>{u.correo || "N/D"}</TableCell>
                <TableCell>{u.rol?.nombre || u.rolId}</TableCell>
                <TableCell>{u.bodega?.nombre || u.bodegaId || "N/D"}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button variant="text" size="small" startIcon={<EditOutlined />} disabled={!canManage} onClick={() => abrirEditar(u)}>
                      Editar
                    </Button>
                    <Button variant="text" size="small" color="error" startIcon={<DeleteOutline />} disabled={!canManage} onClick={() => eliminar(u)}>
                      Eliminar
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {!usuarios.length && (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  No hay usuarios registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openForm} onClose={() => setOpenForm(false)} fullWidth maxWidth="md">
        <DialogTitle>{editing ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Primer nombre" value={primerNombre} onChange={(e) => setPrimerNombre(e.target.value)} fullWidth autoFocus disabled={!canManage} />
              <TextField label="Segundo nombre" value={segundoNombre} onChange={(e) => setSegundoNombre(e.target.value)} fullWidth disabled={!canManage} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Primer apellido" value={primerApellido} onChange={(e) => setPrimerApellido(e.target.value)} fullWidth disabled={!canManage} />
              <TextField label="Segundo apellido" value={segundoApellido} onChange={(e) => setSegundoApellido(e.target.value)} fullWidth disabled={!canManage} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} fullWidth disabled={!canManage} />
              <TextField label="Correo electronico" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} fullWidth disabled={!canManage} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Numero de telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} fullWidth disabled={!canManage} />
              <TextField label="Numero de DPI" value={dpi} onChange={(e) => setDpi(e.target.value)} fullWidth disabled={!canManage} />
            </Stack>
            <TextField label="Direccion de domicilio" value={direccion} onChange={(e) => setDireccion(e.target.value)} fullWidth multiline minRows={2} disabled={!canManage} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Fecha de nacimiento"
                type="date"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                fullWidth
                disabled={!canManage}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Contrasena"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                disabled={!canManage}
                helperText={editing ? "Dejalo vacio para no cambiarla" : ""}
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
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

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "flex-start", sm: "center" }}>
              <Avatar src={fotoPreview} sx={{ width: 72, height: 72 }}>
                {(nombreCompleto || usuario || "U").slice(0, 1).toUpperCase()}
              </Avatar>
              <Box>
                <Button component="label" variant="outlined" disabled={!canManage}>
                  Subir foto
                  <input hidden type="file" accept="image/*" onChange={handleFotoChange} />
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
