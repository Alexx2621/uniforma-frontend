import { useEffect, useState } from "react";
import {
  Paper,
  Typography,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Stack,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../auth/useAuthStore";
import { hasPermission } from "../auth/permissions";

interface FormProducto {
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

export default function ProductoNuevo() {
  const navigate = useNavigate();
  const { rol, permisos } = useAuthStore();
  const canManageProducts = hasPermission(rol, permisos, "productos.manage");
  const [form, setForm] = useState<FormProducto>({
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
      Swal.fire("Error", "No se pudieron cargar catalogos", "error");
    }
  };

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    if (!canManageProducts) {
      Swal.fire("Sin acceso", "Tu usuario no tiene permisos para crear productos", "warning");
      navigate("/productos", { replace: true });
    }
  }, [canManageProducts, navigate]);

  const guardar = async () => {
    if (!canManageProducts) {
      Swal.fire("Sin acceso", "Tu usuario no tiene permisos para crear productos", "warning");
      return;
    }
    try {
      const payload = {
        ...form,
        telaId: form.telaId === "" ? null : Number(form.telaId),
        tallaId: form.tallaId === "" ? null : Number(form.tallaId),
        colorId: form.colorId === "" ? null : Number(form.colorId),
        categoriaId: form.categoriaId === "" ? null : Number(form.categoriaId),
      };

      await api.post("/productos", payload);
      Swal.fire("Guardado", "Producto creado", "success");
      navigate("/productos");
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "No se pudo guardar";
      const text = Array.isArray(msg) ? msg.join(", ") : msg;
      Swal.fire("Error", text, "error");
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Regresar
        </Button>
        <Typography variant="h5">Nuevo producto</Typography>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{xs:12, sm:6}}>
          <TextField
            label="Codigo"
            fullWidth
            value={form.codigo}
            onChange={(e) => setForm({ ...form, codigo: e.target.value })}
          />
        </Grid>

        <Grid size={{xs:12, sm:6}}>
          <TextField
            label="Nombre"
            fullWidth
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
        </Grid>

        <Grid size={{xs:12, sm:6}}>
          <TextField
            label="Tipo"
            fullWidth
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          />
        </Grid>

        <Grid size={{xs:12, sm:6}}>
          <TextField
            label="Genero"
            fullWidth
            value={form.genero}
            onChange={(e) => setForm({ ...form, genero: e.target.value })}
          />
        </Grid>

        <Grid size={{xs:12, sm:6}}>
          <FormControl fullWidth>
            <InputLabel>Tela</InputLabel>
            <Select
              label="Tela"
              value={form.telaId || ""}
              onChange={(e) => setForm({ ...form, telaId: e.target.value })}
            >
              {telas.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid size={{xs:12, sm:6}}>
          <FormControl fullWidth>
            <InputLabel>Talla</InputLabel>
            <Select
              label="Talla"
              value={form.tallaId || ""}
              onChange={(e) => setForm({ ...form, tallaId: e.target.value })}
            >
              {tallas.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid size={{xs:12, sm:6}}>
          <FormControl fullWidth>
            <InputLabel>Color</InputLabel>
            <Select
              label="Color"
              value={form.colorId || ""}
              onChange={(e) => setForm({ ...form, colorId: e.target.value })}
            >
              {colores.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid size={{xs:12, sm:6}}>
          <FormControl fullWidth>
            <InputLabel>Categoria</InputLabel>
            <Select
              label="Categoria"
              value={form.categoriaId || ""}
              onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
            >
              {categorias.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid size={{xs:12, sm:6}}>
          <TextField
            label="Precio"
            type="number"
            fullWidth
            value={form.precio}
            onChange={(e) => setForm({ ...form, precio: Number(e.target.value) })}
          />
        </Grid>

        <Grid size={{xs:12, sm:6}}>
          <TextField
            label="Stock Maximo"
            type="number"
            fullWidth
            value={form.stockMax}
            onChange={(e) => setForm({ ...form, stockMax: Number(e.target.value) })}
          />
        </Grid>

        <Grid size={{xs:12, sm:6}}>
          <TextField
            label="Merma %"
            type="number"
            fullWidth
            value={form.mermaPorcentaje}
            onChange={(e) =>
              setForm({ ...form, mermaPorcentaje: Number(e.target.value) })
            }
          />
        </Grid>
      </Grid>

      <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 3 }}>
        <Button variant="outlined" onClick={() => navigate(-1)}>
          Cancelar
        </Button>
        <Button variant="contained" color="success" startIcon={<SaveIcon />} onClick={guardar}>
          Guardar
        </Button>
      </Stack>
    </Paper>
  );
}
