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
  MenuItem,
  Stack,
  Chip,
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

interface Proveedor {
  id: number;
  nombre: string;
  nit?: string | null;
}

interface ColorAlias {
  id: number;
  proveedorId: number;
  colorId: number;
  codigoProveedor?: string | null;
  nombreProveedor: string;
  descripcionProveedor?: string | null;
  activo: boolean;
  proveedor?: Proveedor;
  color?: { id: number; nombre: string; codigoHex?: string | null };
}

const emptyAlias = {
  proveedorId: "",
  colorId: "",
  codigoProveedor: "",
  nombreProveedor: "",
  descripcionProveedor: "",
  activo: "true",
};

export default function Colores() {
  const [rows, setRows] = useState<any[]>([]);
  const [aliases, setAliases] = useState<ColorAlias[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [aliasManagerOpen, setAliasManagerOpen] = useState(false);
  const [aliasOpen, setAliasOpen] = useState(false);
  const [editar, setEditar] = useState(false);
  const [aliasEditando, setAliasEditando] = useState<ColorAlias | null>(null);
  const [selectedColor, setSelectedColor] = useState<any | null>(null);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState<ColorForm>({
    id: null,
    nombre: "",
    codigoHex: "",
  });
  const [aliasForm, setAliasForm] = useState(emptyAlias);

  const cargar = async () => {
    setLoading(true);
    try {
      const [resp, respAliases, respProveedores] = await Promise.all([
        api.get("/colores"),
        api.get("/colores/proveedor-aliases"),
        api.get("/proveedores", { params: { estado: "activo" } }).catch(() => ({ data: [] })),
      ]);
      setRows(resp.data || []);
      setAliases(respAliases.data || []);
      setProveedores(respProveedores.data || []);
    } catch (error) {
      Swal.fire("Error", "No se pudieron cargar colores", "error");
    } finally {
      setLoading(false);
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

  const abrirAliasesColor = useCallback((row: any) => {
    setSelectedColor(row);
    setAliasManagerOpen(true);
  }, []);

  const nuevoAlias = () => {
    if (!selectedColor?.id) return;
    setAliasEditando(null);
    setAliasForm({ ...emptyAlias, colorId: String(selectedColor.id) });
    setAliasOpen(true);
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

  const editarAlias = useCallback((row: ColorAlias) => {
    setAliasEditando(row);
    setAliasForm({
      proveedorId: String(row.proveedorId || ""),
      colorId: String(row.colorId || ""),
      codigoProveedor: row.codigoProveedor || "",
      nombreProveedor: row.nombreProveedor || "",
      descripcionProveedor: row.descripcionProveedor || "",
      activo: String(row.activo !== false),
    });
    setAliasOpen(true);
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

  const guardarAlias = async () => {
    try {
      if (aliasEditando) {
        await api.patch(`/colores/proveedor-aliases/${aliasEditando.id}`, aliasForm);
        Swal.fire("Actualizado", "Equivalencia de color modificada", "success");
      } else {
        await api.post("/colores/proveedor-aliases", aliasForm);
        Swal.fire("Guardado", "Equivalencia de color creada", "success");
      }
      setAliasOpen(false);
      setAliasEditando(null);
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

  const eliminarAlias = useCallback(async (row: ColorAlias) => {
    const confirm = await Swal.fire({
      title: "Eliminar equivalencia?",
      text: `${row.proveedor?.nombre || "Proveedor"}: ${row.nombreProveedor}`,
      icon: "warning",
      showCancelButton: true,
    });
    if (!confirm.isConfirmed) return;

    try {
      await api.delete(`/colores/proveedor-aliases/${row.id}`);
      Swal.fire("Eliminado", "Equivalencia borrada", "success");
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
        field: "proveedores",
        headerName: "Proveedores",
        flex: 1,
        valueGetter: (_, row) => aliases.filter((alias) => Number(alias.colorId) === Number(row.id)).length,
        renderCell: (params: any) => (
          <Button size="small" variant="outlined" onClick={() => abrirAliasesColor(params.row)}>
            {aliases.filter((alias) => Number(alias.colorId) === Number(params.row.id)).length} equivalencias
          </Button>
        ),
      },
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
    [aliases, abrirAliasesColor, editarFila, eliminar]
  );

  const filtrados = useMemo(
    () =>
      rows.filter((r) =>
        `${r.nombre ?? ""}${r.codigoHex ?? ""}`.toLowerCase().includes(filter.toLowerCase())
      ),
    [rows, filter]
  );

  const aliasColumns: GridColDef[] = useMemo(
    () => [
      { field: "proveedor", headerName: "Proveedor", flex: 1.2, valueGetter: (_, row) => row.proveedor?.nombre || "N/D" },
      { field: "codigoProveedor", headerName: "Codigo proveedor", flex: 0.9 },
      { field: "nombreProveedor", headerName: "Color proveedor", flex: 1 },
      { field: "color", headerName: "Color interno", flex: 1, valueGetter: (_, row) => row.color?.nombre || "N/D" },
      {
        field: "activo",
        headerName: "Estado",
        flex: 0.6,
        renderCell: (params: any) => <Chip size="small" color={params.row.activo ? "success" : "default"} label={params.row.activo ? "Activo" : "Inactivo"} />,
      },
      {
        field: "acciones",
        headerName: "Acciones",
        sortable: false,
        flex: 0.8,
        renderCell: (params: any) => (
          <>
            <IconButton color="info" onClick={() => editarAlias(params.row)}>
              <EditIcon />
            </IconButton>
            <IconButton color="error" onClick={() => eliminarAlias(params.row)}>
              <DeleteIcon />
            </IconButton>
          </>
        ),
      },
    ],
    [editarAlias, eliminarAlias]
  );

  const aliasesColorSeleccionado = useMemo(
    () =>
      aliases.filter((r) =>
        Number(r.colorId) === Number(selectedColor?.id)
      ),
    [aliases, selectedColor]
  );

  return (
    <Paper sx={{ p: 3, height: "100%" }}>
      <Typography variant="h4" gutterBottom>
        Colores
      </Typography>
      <Divider sx={{ mb: 2 }} />

      <Grid container justifyContent="space-between" alignItems="center" spacing={2}>
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
          loading={loading}
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

      <Dialog open={aliasManagerOpen} onClose={() => setAliasManagerOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Equivalencias de proveedor - {selectedColor?.nombre || "Color"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1} sx={{ height: 470 }}>
            <Typography variant="body2" color="text.secondary">
              Registra como llama cada proveedor a este color para que facturas como BASIL puedan caer automaticamente en {selectedColor?.nombre || "este color"}.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={nuevoAlias} sx={{ alignSelf: "flex-start" }}>
              Nueva equivalencia
            </Button>
            <div style={{ flex: 1 }}>
              <DataGrid
                loading={loading}
                rows={aliasesColorSeleccionado}
                columns={aliasColumns}
                getRowId={(row) => row.id}
                pageSizeOptions={[10, 20, 50]}
                initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              />
            </div>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAliasManagerOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={aliasOpen} onClose={() => setAliasOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{aliasEditando ? "Editar color proveedor" : "Nuevo color proveedor"}</DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Color interno"
            fullWidth
            margin="dense"
            value={rows.find((item) => Number(item.id) === Number(aliasForm.colorId))?.nombre || selectedColor?.nombre || ""}
            disabled
          />
          <TextField
            select
            label="Proveedor"
            fullWidth
            required
            margin="dense"
            value={aliasForm.proveedorId}
            onChange={(e) => setAliasForm({ ...aliasForm, proveedorId: e.target.value })}
          >
            {proveedores.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.nombre}
                {item.nit ? ` - ${item.nit}` : ""}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Codigo proveedor"
            fullWidth
            margin="dense"
            value={aliasForm.codigoProveedor}
            onChange={(e) => setAliasForm({ ...aliasForm, codigoProveedor: e.target.value })}
          />
          <TextField
            label="Color proveedor"
            fullWidth
            required
            margin="dense"
            value={aliasForm.nombreProveedor}
            onChange={(e) => setAliasForm({ ...aliasForm, nombreProveedor: e.target.value })}
            helperText="Ejemplo: BASIL, MOSS, VERDE 12"
          />
          <TextField
            select
            label="Estado"
            fullWidth
            margin="dense"
            value={aliasForm.activo}
            onChange={(e) => setAliasForm({ ...aliasForm, activo: e.target.value })}
          >
            <MenuItem value="true">Activo</MenuItem>
            <MenuItem value="false">Inactivo</MenuItem>
          </TextField>
          <TextField
            label="Descripcion"
            fullWidth
            multiline
            minRows={2}
            margin="dense"
            value={aliasForm.descripcionProveedor}
            onChange={(e) => setAliasForm({ ...aliasForm, descripcionProveedor: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAliasOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={guardarAlias} color="success">
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
