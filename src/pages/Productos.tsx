import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Paper,
  Box,
  Typography,
  Grid,
  Button,
  TextField,
  IconButton,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";

import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";

import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { hasPermission } from "../auth/permissions";
import { formatCurrency } from "../utils/currency";
import { emptyWhenZero, parseNumberInput } from "../utils/numberInputs";

interface FormProducto {
  id: number | null;
  codigo: string;
  nombre: string;
  tipo: string;
  genero: string;
  telaId: number | string;
  tallaId: number | string;
  colorId: number | string;
  categoriaId: number | string;
  precio: number;
  stockMax: number;
  mermaPorcentaje: number;
}

export default function Productos() {
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [filter, setFilter] = useState("");
  const [editar, setEditar] = useState(false);
  const navigate = useNavigate();

  const [form, setForm] = useState<FormProducto>({
    id: null,
    codigo: "",
    nombre: "",
    tipo: "",
    genero: "",
    precio: 0,
    stockMax: 0,
    categoriaId: "",
    telaId: "",
    colorId: "",
    tallaId: "",
    mermaPorcentaje: 0,
  });

  const [categorias, setCategorias] = useState<any[]>([]);
  const [telas, setTelas] = useState<any[]>([]);
  const [colores, setColores] = useState<any[]>([]);
  const [tallas, setTallas] = useState<any[]>([]);
  const { rol, permisos } = useAuthStore();
  const canManageProducts = hasPermission(rol, permisos, "productos.manage");

  const cargarCatalogos = async () => {
    try {
      const [respCat, respTel, respCol, respTal] = await Promise.all([
        api.get("/categorias"),
        api.get("/telas"),
        api.get("/colores"),
        api.get("/tallas"),
      ]);

      setCategorias(respCat.data);
      setTelas(respTel.data);
      setColores(respCol.data);
      setTallas(respTal.data);
    } catch (error) {
      Swal.fire("Error", "No se pudieron cargar catálogos", "error");
    }
  };

  const cargar = async () => {
    setLoading(true);
    try {
      const resp = await api.get("/productos");
      const parsed = (resp.data || []).map((p: any) => ({
        ...p,
        telaNombre: p.tela?.nombre ?? "",
        tallaNombre: p.talla?.nombre ?? "",
        colorNombre: p.color?.nombre ?? "",
      }));
      setProductos(parsed);
    } catch (error) {
      Swal.fire("Error", "No se pudieron cargar productos", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    cargarCatalogos();
  }, []);

  const nuevo = () => {
    if (!canManageProducts) return;
    navigate("/productos/nuevo");
  };

  const editarProducto = useCallback((p: any) => {
    if (!canManageProducts) return;
    setEditar(true);
    setForm({
      id: p.id ?? null,
      codigo: p.codigo ?? "",
      nombre: p.nombre ?? "",
      tipo: p.tipo ?? "",
      genero: p.genero ?? "",
      precio: p.precio ?? 0,
      stockMax: p.stockMax ?? 0,
      categoriaId: p.categoriaId ?? "",
      telaId: p.telaId ?? "",
      colorId: p.colorId ?? "",
      tallaId: p.tallaId ?? "",
      mermaPorcentaje: p.mermaPorcentaje ?? 0,
    });
    setOpenForm(true);
  }, [canManageProducts]);

  const guardar = async () => {
    if (!canManageProducts) {
      Swal.fire("Sin acceso", "Tu usuario no tiene permisos para modificar productos", "warning");
      return;
    }
    try {
      // Preparo payload para que IDs vayan como número o null
      const payload = {
        ...form,
        telaId: form.telaId === "" ? null : Number(form.telaId),
        tallaId: form.tallaId === "" ? null : Number(form.tallaId),
        colorId: form.colorId === "" ? null : Number(form.colorId),
        categoriaId:
          form.categoriaId === "" ? null : Number(form.categoriaId),
      };

      if (editar) {
        await api.patch(`/productos/${form.id}`, payload);
        Swal.fire("Actualizado", "Producto modificado", "success");
      } else {
        await api.post("/productos", payload);
        Swal.fire("Guardado", "Producto creado", "success");
      }

      setOpenForm(false);
      cargar();
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "No se pudo guardar";
      const text = Array.isArray(msg) ? msg.join(", ") : msg;
      Swal.fire("Error", text, "error");
    }
  };

  const eliminar = useCallback(async (p: any) => {
    if (!canManageProducts) {
      Swal.fire("Sin acceso", "Tu usuario no tiene permisos para eliminar productos", "warning");
      return;
    }
    const confirm = await Swal.fire({
      title: "¿Eliminar?",
      text: `Código: ${p.codigo}`,
      icon: "warning",
      showCancelButton: true,
    });

    if (!confirm.isConfirmed) return;

    try {
      await api.delete(`/productos/${p.id}`);
      Swal.fire("Eliminado", "Producto borrado", "success");
      cargar();
    } catch {
      Swal.fire("Error", "No se pudo eliminar", "error");
    }
  }, [canManageProducts]);

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "codigo", headerName: "Código", minWidth: 120, flex: 0.9 },
      { field: "nombre", headerName: "Nombre", minWidth: 160, flex: 1.2 },
      { field: "tipo", headerName: "Tipo", minWidth: 130, flex: 1 },
      { field: "genero", headerName: "Género", minWidth: 120, flex: 0.9 },
      { field: "telaNombre", headerName: "Tela", minWidth: 120, flex: 0.9 },
      { field: "tallaNombre", headerName: "Talla", minWidth: 90, flex: 0.7 },
      { field: "colorNombre", headerName: "Color", minWidth: 140, flex: 1 },
      {
        field: "precio",
        headerName: "Precio",
        minWidth: 115,
        flex: 0.8,
        valueFormatter: (value: number | string | null) =>
          formatCurrency(value as number),
      },
      ...(canManageProducts
        ? [
            {
              field: "acciones",
              headerName: "Acciones",
              sortable: false,
              minWidth: 120,
              flex: 0.8,
              renderCell: (params: any) => (
                <>
                  <IconButton color="info" onClick={() => editarProducto(params.row)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton color="error" onClick={() => eliminar(params.row)}>
                    <DeleteIcon />
                  </IconButton>
                </>
              ),
            } satisfies GridColDef,
          ]
        : []),
    ],
    [canManageProducts, editarProducto, eliminar]
  );

  const filtrados = useMemo(
    () =>
      productos.filter((p) =>
        p.codigo?.toLowerCase().includes(filter.toLowerCase())
      ),
    [productos, filter]
  );

  return (
    <Paper sx={{ p: { xs: 2, md: 3 }, height: "100%", overflow: "hidden" }}>
      <Typography variant="h4" gutterBottom>
        Productos
      </Typography>

      <Divider sx={{ mb: 2 }} />

      {/* HEADER */}
      <Grid container justifyContent="space-between" alignItems="center" spacing={1.5}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <TextField
            label="Buscar código"
            size="small"
            fullWidth
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            InputProps={{
              endAdornment: <SearchIcon />,
            }}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: "flex", justifyContent: { xs: "stretch", sm: "flex-end" } }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={nuevo}
            disabled={!canManageProducts}
            fullWidth
            sx={{ maxWidth: { sm: 220 } }}
          >
            Nuevo Producto
          </Button>
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />

      {/* DATAGRID */}
      <Box sx={{ height: { xs: "calc(100dvh - 265px)", sm: 600 }, minHeight: 430, width: "100%", overflow: "hidden" }}>
        <DataGrid
          loading={loading}
          rows={filtrados}
          columns={columns}
          getRowId={(row: any) => row.id}
          pageSizeOptions={[10, 20, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
        />
      </Box>

      {/* DIALOG FORMULARIO */}
      <Dialog
        open={openForm}
        onClose={() => {
          setOpenForm(false);
          setEditar(false);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {editar ? "Editar Producto" : "Nuevo Producto"}
        </DialogTitle>

        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Código"
                fullWidth
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Nombre"
                fullWidth
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Tipo"
                fullWidth
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Género"
                fullWidth
                value={form.genero}
                onChange={(e) => setForm({ ...form, genero: e.target.value })}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Tela</InputLabel>
                <Select
                  label="Tela"
                  value={form.telaId || ""}
                  onChange={(e) =>
                    setForm({ ...form, telaId: e.target.value })
                  }
                >
                  {telas.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Talla</InputLabel>
                <Select
                  label="Talla"
                  value={form.tallaId || ""}
                  onChange={(e) =>
                    setForm({ ...form, tallaId: e.target.value })
                  }
                >
                  {tallas.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Color</InputLabel>
                <Select
                  label="Color"
                  value={form.colorId || ""}
                  onChange={(e) =>
                    setForm({ ...form, colorId: e.target.value })
                  }
                >
                  {colores.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Categoría</InputLabel>
                <Select
                  label="Categoría"
                  value={form.categoriaId || ""}
                  onChange={(e) =>
                    setForm({ ...form, categoriaId: e.target.value })
                  }
                >
                  {categorias.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Precio"
                type="number"
                fullWidth
                value={emptyWhenZero(form.precio)}
                onChange={(e) =>
                  setForm({ ...form, precio: parseNumberInput(e.target.value) })
                }
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Stock Máximo"
                type="number"
                fullWidth
                value={emptyWhenZero(form.stockMax)}
                onChange={(e) =>
                  setForm({ ...form, stockMax: parseNumberInput(e.target.value) })
                }
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Merma %"
                type="number"
                fullWidth
                value={emptyWhenZero(form.mermaPorcentaje)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    mermaPorcentaje: parseNumberInput(e.target.value),
                  })
                }
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button
            variant="outlined"
            onClick={() => {
              setOpenForm(false);
              setEditar(false);
            }}
          >
            Cancelar
          </Button>
          <Button variant="contained" color="success" onClick={guardar}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
