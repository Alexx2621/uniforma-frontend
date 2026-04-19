import { useEffect, useState } from "react";
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
import PeopleOutline from "@mui/icons-material/PeopleOutline";
import Swal from "sweetalert2";
import { api } from "../api/axios";

interface Cliente {
  id: number;
  nombre: string;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  tipoCliente?: string | null;
}

const tipos = ["mayorista", "minorista", "corporativo", "frecuente"];

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [direccion, setDireccion] = useState("");
  const [tipoCliente, setTipoCliente] = useState("");

  const cargar = async () => {
    try {
      setLoading(true);
      const resp = await api.get("/clientes");
      setClientes(resp.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar los clientes", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirNuevo = () => {
    setEditing(null);
    setNombre("");
    setTelefono("");
    setCorreo("");
    setDireccion("");
    setTipoCliente("");
    setOpenForm(true);
  };

  const abrirEditar = (c: Cliente) => {
    setEditing(c);
    setNombre(c.nombre);
    setTelefono(c.telefono || "");
    setCorreo(c.correo || "");
    setDireccion(c.direccion || "");
    setTipoCliente(c.tipoCliente || "");
    setOpenForm(true);
  };

  const guardar = async () => {
    const payload = {
      nombre: nombre.trim(),
      telefono: telefono.trim() || null,
      correo: correo.trim() || null,
      direccion: direccion.trim() || null,
      tipoCliente: tipoCliente || null,
    };
    if (!payload.nombre) {
      Swal.fire("Validación", "Ingresa el nombre del cliente", "info");
      return;
    }

    try {
      if (editing) {
        await api.patch(`/clientes/${editing.id}`, payload);
        Swal.fire("Actualizado", "Cliente actualizado", "success");
      } else {
        await api.post("/clientes", payload);
        Swal.fire("Creado", "Cliente creado", "success");
      }
      setOpenForm(false);
      await cargar();
    } catch {
      Swal.fire("Error", "No se pudo guardar el cliente", "error");
    }
  };

  const eliminar = async (c: Cliente) => {
    const confirm = await Swal.fire({
      title: "¿Eliminar cliente?",
      text: `Se eliminará "${c.nombre}".`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
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

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <PeopleOutline color="primary" />
          <Typography variant="h4">Clientes</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<AddOutlined />} variant="contained" size="small" onClick={abrirNuevo}>
            Nuevo cliente
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
        Gestiona tus clientes para ventas y reportes.
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Teléfono</TableCell>
              <TableCell>Correo</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {clientes.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.id}</TableCell>
                <TableCell>{c.nombre}</TableCell>
                <TableCell>{c.telefono || "N/D"}</TableCell>
                <TableCell>{c.correo || "N/D"}</TableCell>
                <TableCell>{c.tipoCliente || "N/D"}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<EditOutlined />}
                      onClick={() => abrirEditar(c)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      color="error"
                      startIcon={<DeleteOutline />}
                      onClick={() => eliminar(c)}
                    >
                      Eliminar
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {!clientes.length && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No hay clientes registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openForm} onClose={() => setOpenForm(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              fullWidth
              autoFocus
            />
            <TextField
              label="Teléfono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              fullWidth
            />
            <TextField
              label="Correo"
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              fullWidth
            />
            <TextField
              label="Dirección"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              fullWidth
            />
            <TextField
              label="Tipo de cliente"
              select
              value={tipoCliente}
              onChange={(e) => setTipoCliente(e.target.value)}
              fullWidth
            >
              <MenuItem value="">Sin especificar</MenuItem>
              {tipos.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenForm(false)}>Cancelar</Button>
          <Button variant="contained" onClick={guardar}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
