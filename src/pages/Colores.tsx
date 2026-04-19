import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Paper,
  Typography,
  Grid,
  Button,
  TextField,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import Swal from "sweetalert2";
import { api } from "../api/axios";

interface ColorForm {
  id: number | null;
  nombre: string;
  codigoHex: string;
}

export default function Colores() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editar, setEditar] = useState(false);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState<ColorForm>({
    id: null,
    nombre: "",
    codigoHex: "",
  });

  const cargar = async () => {
    try {
      const resp = await api.get("/colores");
      setRows(resp.data);
    } catch (error) {
      Swal.fire("Error", "No se pudieron cargar colores", "error");
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const nuevo = () => {
    setEditar(false);
    setForm({ id: null, nombre: "", codigoHex: "" });
    setOpen(true);
  };

  const editarFila = useCallback((row: any) => {
    setEditar(true);
    setForm({
      id: row.id,
      nombre: row.nombre ?? "",
      codigoHex: row.codigoHex ?? "",
    });
    setOpen(true);
  }, []);

  const guardar = async () => {
    try {
      const payload = { nombre: form.nombre, codigoHex: form.codigoHex || null };

      if (editar && form.id != null) {
        await api.patch(`/colores/${form.id}`, payload);
        Swal.fire("Actualizado", "Color modificado", "success");
      } else {
        await api.post("/colores", payload);
        Swal.fire("Guardado", "Color creado", "success");
      }

      setOpen(false);
      setEditar(false);
      cargar();
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo guardar";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    }
  };

  const eliminar = useCallback(async (row: any) => {
    const confirm = await Swal.fire({
      title: "Eliminar?",
      text: `Color: ${row.nombre}`,
      icon: "warning",
      showCancelButton: true,
    });
    if (!confirm.isConfirmed) return;

    try {
      await api.delete(`/colores/${row.id}`);
      Swal.fire("Eliminado", "Color borrado", "success");
      cargar();
    } catch (error) {
      Swal.fire("Error", "No se pudo eliminar", "error");
    }
  }, []);

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "nombre", headerName: "Nombre", flex: 1.5 },
      { field: "codigoHex", headerName: "Codigo HEX", flex: 1 },
      {
        field: "acciones",
        headerName: "Acciones",
        sortable: false,
        flex: 0.8,
        renderCell: (params: any) => (
          <>
            <IconButton color="info" onClick={() => editarFila(params.row)}>
              <EditIcon />
            </IconButton>
            <IconButton color="error" onClick={() => eliminar(params.row)}>
              <DeleteIcon />
            </IconButton>
          </>
        ),
      },
    ],
    [editarFila, eliminar]
  );

  const filtrados = useMemo(
    () =>
      rows.filter((r) =>
        `${r.nombre ?? ""}${r.codigoHex ?? ""}`.toLowerCase().includes(filter.toLowerCase())
      ),
    [rows, filter]
  );

  return (
    <Paper sx={{ p: 3, height: "100%" }}>
      <Typography variant="h4" gutterBottom>
        Colores
      </Typography>
      <Divider sx={{ mb: 2 }} />

      <Grid container justifyContent="space-between" alignItems="center">
        <Grid size={{xs:12, sm:4}}>
          <TextField
            label="Buscar"
            size="small"
            fullWidth
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </Grid>
        <Grid size={{xs:12, sm:3}} textAlign="right">
          <Button variant="contained" startIcon={<AddIcon />} onClick={nuevo}>
            Nuevo color
          </Button>
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />

      <div style={{ height: 520, width: "100%" }}>
        <DataGrid
          rows={filtrados}
          columns={columns}
          getRowId={(row) => row.id}
          pageSizeOptions={[10, 20, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        />
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editar ? "Editar color" : "Nuevo color"}</DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Nombre"
            fullWidth
            margin="dense"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
          <TextField
            label="Codigo HEX"
            fullWidth
            margin="dense"
            value={form.codigoHex}
            onChange={(e) => setForm({ ...form, codigoHex: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={guardar} color="success">
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
