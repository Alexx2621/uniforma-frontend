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
} from "@mui/material";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import WarehouseOutlined from "@mui/icons-material/WarehouseOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { hasPermission } from "../auth/permissions";

interface Bodega {
  id: number;
  nombre: string;
  ubicacion?: string | null;
}

export default function Bodegas() {
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Bodega | null>(null);
  const [nombre, setNombre] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const { rol, permisos } = useAuthStore();
  const denyAlertShown = useRef(false);
  const canView = hasPermission(rol, permisos, "bodegas.view");
  const canManage = hasPermission(rol, permisos, "bodegas.manage");

  const cargar = async () => {
    try {
      setLoading(true);
      const resp = await api.get("/bodegas");
      setBodegas(resp.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar las bodegas", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      if (!denyAlertShown.current) {
        denyAlertShown.current = true;
        Swal.fire("Acceso restringido", "No tienes permisos para ingresar a Bodegas", "warning");
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
    setUbicacion("");
    setOpenForm(true);
  };

  const abrirEditar = (b: Bodega) => {
    if (!canManage) return;
    setEditing(b);
    setNombre(b.nombre);
    setUbicacion(b.ubicacion || "");
    setOpenForm(true);
  };

  const guardar = async () => {
    if (!canManage) {
      Swal.fire("Acceso restringido", "No tienes permisos para modificar bodegas", "warning");
      return;
    }

    const payload = { nombre: nombre.trim(), ubicacion: ubicacion.trim() || null };
    if (!payload.nombre) {
      Swal.fire("Validacion", "Ingresa el nombre de la bodega", "info");
      return;
    }

    try {
      if (editing) {
        await api.put(`/bodegas/${editing.id}`, payload);
        Swal.fire("Actualizado", "Bodega actualizada", "success");
      } else {
        await api.post("/bodegas", payload);
        Swal.fire("Creado", "Bodega creada", "success");
      }
      setOpenForm(false);
      await cargar();
    } catch {
      Swal.fire("Error", "No se pudo guardar la bodega", "error");
    }
  };

  const eliminar = async (b: Bodega) => {
    if (!canManage) {
      Swal.fire("Acceso restringido", "No tienes permisos para eliminar bodegas", "warning");
      return;
    }

    const confirm = await Swal.fire({
      title: "Eliminar bodega",
      text: `Se eliminara "${b.nombre}".`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Si, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;

    try {
      await api.delete(`/bodegas/${b.id}`);
      Swal.fire("Eliminado", "Bodega eliminada", "success");
      await cargar();
    } catch {
      Swal.fire("Error", "No se pudo eliminar la bodega", "error");
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <WarehouseOutlined color="primary" />
          <Typography variant="h4">Bodegas</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<AddOutlined />}
            variant="contained"
            size="small"
            onClick={abrirNuevo}
            disabled={!canManage}
          >
            Nueva bodega
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
        Listado de bodegas registradas en el sistema.
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Ubicacion</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {bodegas.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{b.id}</TableCell>
                <TableCell>{b.nombre}</TableCell>
                <TableCell>{b.ubicacion || "N/D"}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<EditOutlined />}
                      disabled={!canManage}
                      onClick={() => abrirEditar(b)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      color="error"
                      startIcon={<DeleteOutline />}
                      disabled={!canManage}
                      onClick={() => eliminar(b)}
                    >
                      Eliminar
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {!bodegas.length && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  No hay bodegas registradas.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openForm} onClose={() => setOpenForm(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Editar bodega" : "Nueva bodega"}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              fullWidth
              autoFocus
              disabled={!canManage}
            />
            <TextField
              label="Ubicacion"
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              fullWidth
              disabled={!canManage}
            />
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
