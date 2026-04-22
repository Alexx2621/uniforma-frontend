import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Paper,
  Typography,
  Grid,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  IconButton,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import EditOutlined from "@mui/icons-material/EditOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import LOGO_URL from "../assets/3-logos.png";
import { buildIngresoInventarioPdfHtml } from "../utils/inventarioPdf";

interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  tipo?: string;
  genero?: string;
  stockMax?: number | null;
  tela?: { id?: number; nombre?: string } | null;
  talla?: { id?: number; nombre?: string } | null;
  color?: { id?: number; nombre?: string } | null;
  telaId?: number | null;
  tallaId?: number | null;
  colorId?: number | null;
  tela_id?: number | null;
  talla_id?: number | null;
  color_id?: number | null;
}

interface Bodega {
  id: number;
  nombre: string;
}

interface CatalogoItem {
  id: number;
  nombre?: string | null;
}

interface DetalleRow {
  key: number;
  productoId: number;
  cantidad: number;
  stockMax: number | null;
  stockActual: number | null;
}

interface CapturaArticulo {
  productoId: number | "";
  cantidad: number;
  stockMax: number | null;
  stockActual: number | null;
}

const detalleInicial: CapturaArticulo = {
  productoId: "",
  cantidad: 1,
  stockMax: null,
  stockActual: null,
};

const resolveTelaNombre = (prod: Producto | undefined, telas: CatalogoItem[]) => {
  if (!prod) return "N/D";
  const telaId =
    prod.telaId ?? prod.tela_id ?? prod.tela?.id ?? (prod as any).telaid ?? (prod as any).tela_id ?? null;
  return prod.tela?.nombre || (prod as any).telaNombre || telas.find((t) => Number(t.id) === Number(telaId))?.nombre || "N/D";
};

const resolveTallaNombre = (prod: Producto | undefined, tallas: CatalogoItem[]) => {
  if (!prod) return "N/D";
  const tallaId =
    prod.tallaId ?? prod.talla_id ?? prod.talla?.id ?? (prod as any).tallaid ?? (prod as any).talla_id ?? null;
  return (
    prod.talla?.nombre || (prod as any).tallaNombre || tallas.find((t) => Number(t.id) === Number(tallaId))?.nombre || "N/D"
  );
};

const resolveColorNombre = (prod: Producto | undefined, colores: CatalogoItem[]) => {
  if (!prod) return "N/D";
  const colorId =
    prod.colorId ?? prod.color_id ?? prod.color?.id ?? (prod as any).colorid ?? (prod as any).color_id ?? null;
  return (
    prod.color?.nombre || (prod as any).colorNombre || colores.find((c) => Number(c.id) === Number(colorId))?.nombre || "N/D"
  );
};

const uniqueSorted = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

export default function IngresoInventario() {
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [telas, setTelas] = useState<CatalogoItem[]>([]);
  const [tallas, setTallas] = useState<CatalogoItem[]>([]);
  const [colores, setColores] = useState<CatalogoItem[]>([]);
  const [bodegaId, setBodegaId] = useState<number | "">("");
  const [observaciones, setObservaciones] = useState("");
  const [detalle, setDetalle] = useState<DetalleRow[]>([]);
  const [articuloActual, setArticuloActual] = useState<CapturaArticulo>(detalleInicial);
  const [cantidadInput, setCantidadInput] = useState("1");
  const [editingDetalleKey, setEditingDetalleKey] = useState<number | null>(null);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroGenero, setFiltroGenero] = useState("");
  const [filtroTela, setFiltroTela] = useState("");
  const [filtroTalla, setFiltroTalla] = useState("");
  const [filtroColor, setFiltroColor] = useState("");

  const { usuario, rol, rolId, bodegaId: userBodegaId } = useAuthStore();
  const { crossStoreRoleIds, fetchConfig } = useSystemConfigStore();
  const canAccessAllBodegas = rol === "ADMIN" || crossStoreRoleIds.includes(Number(rolId));

  const cargarCatalogos = async () => {
    try {
      const [respBod, respProd, respTelas, respTallas, respColores] = await Promise.all([
        api.get("/bodegas"),
        api.get("/productos"),
        api.get("/telas").catch(() => ({ data: [] })),
        api.get("/tallas").catch(() => ({ data: [] })),
        api.get("/colores").catch(() => ({ data: [] })),
      ]);
      setBodegas(respBod.data || []);
      setProductos(respProd.data || []);
      setTelas(respTelas.data || []);
      setTallas(respTallas.data || []);
      setColores(respColores.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar bodegas o productos", "error");
    }
  };

  useEffect(() => {
    void fetchConfig();
    void cargarCatalogos();
  }, [fetchConfig]);

  useEffect(() => {
    if (userBodegaId && !canAccessAllBodegas) {
      const parsed = Number(userBodegaId);
      const exists = bodegas.some((b) => b.id === parsed);
      setBodegaId(exists ? parsed : "");
    }
  }, [userBodegaId, canAccessAllBodegas, bodegas]);

  const fetchStockActual = async (bodega: number, producto: number) => {
    if (!bodega || !producto) return null;
    try {
      const resp = await api.get(`/inventario/${bodega}/${producto}`);
      return resp.data?.stock ?? 0;
    } catch {
      return null;
    }
  };

  const obtenerTela = (prod?: Producto) => resolveTelaNombre(prod, telas);
  const obtenerTalla = (prod?: Producto) => resolveTallaNombre(prod, tallas);
  const obtenerColor = (prod?: Producto) => resolveColorNombre(prod, colores);

  const filtrarProductos = useCallback(
    ({
      tipo = filtroTipo,
      genero = filtroGenero,
      tela = filtroTela,
      talla = filtroTalla,
      color = filtroColor,
    }: {
      tipo?: string;
      genero?: string;
      tela?: string;
      talla?: string;
      color?: string;
    }) =>
      productos.filter((producto) => {
        const matchesTipo = !tipo || (producto.tipo || "").trim() === tipo;
        const matchesGenero = !genero || (producto.genero || "").trim() === genero;
        const matchesTela = !tela || resolveTelaNombre(producto, telas).trim() === tela;
        const matchesTalla = !talla || resolveTallaNombre(producto, tallas).trim() === talla;
        const matchesColor = !color || resolveColorNombre(producto, colores).trim() === color;
        return matchesTipo && matchesGenero && matchesTela && matchesTalla && matchesColor;
      }),
    [productos, filtroTipo, filtroGenero, filtroTela, filtroTalla, filtroColor, telas, tallas, colores],
  );

  const tiposDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({
          tipo: "",
          genero: filtroGenero,
          tela: filtroTela,
          talla: filtroTalla,
          color: filtroColor,
        }).map((producto) => (producto.tipo || "").trim()),
      ),
    [filtrarProductos, filtroGenero, filtroTela, filtroTalla, filtroColor],
  );

  const generosDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({
          tipo: filtroTipo,
          genero: "",
          tela: filtroTela,
          talla: filtroTalla,
          color: filtroColor,
        }).map((producto) => (producto.genero || "").trim()),
      ),
    [filtrarProductos, filtroTipo, filtroTela, filtroTalla, filtroColor],
  );

  const telasDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({
          tipo: filtroTipo,
          genero: filtroGenero,
          tela: "",
          talla: filtroTalla,
          color: filtroColor,
        })
          .map((producto) => resolveTelaNombre(producto, telas).trim())
          .filter((nombre) => nombre !== "N/D"),
      ),
    [filtrarProductos, filtroTipo, filtroGenero, filtroTalla, filtroColor, telas],
  );

  const tallasDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({
          tipo: filtroTipo,
          genero: filtroGenero,
          tela: filtroTela,
          talla: "",
          color: filtroColor,
        })
          .map((producto) => resolveTallaNombre(producto, tallas).trim())
          .filter((nombre) => nombre !== "N/D"),
      ),
    [filtrarProductos, filtroTipo, filtroGenero, filtroTela, filtroColor, tallas],
  );

  const coloresDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({
          tipo: filtroTipo,
          genero: filtroGenero,
          tela: filtroTela,
          talla: filtroTalla,
          color: "",
        })
          .map((producto) => resolveColorNombre(producto, colores).trim())
          .filter((nombre) => nombre !== "N/D"),
      ),
    [filtrarProductos, filtroTipo, filtroGenero, filtroTela, filtroTalla, colores],
  );

  const productosBaseFiltrados = useMemo(
    () =>
      filtrarProductos({
        tipo: filtroTipo,
        genero: filtroGenero,
        tela: filtroTela,
        talla: "",
        color: "",
      }),
    [filtrarProductos, filtroTipo, filtroGenero, filtroTela],
  );

  const productosCoincidentes = useMemo(
    () =>
      productosBaseFiltrados.filter((producto) => {
        const matchesTalla = !filtroTalla || resolveTallaNombre(producto, tallas).trim() === filtroTalla;
        const matchesColor = !filtroColor || resolveColorNombre(producto, colores).trim() === filtroColor;
        return matchesTalla && matchesColor;
      }),
    [productosBaseFiltrados, tallas, colores, filtroTalla, filtroColor],
  );

  const productoDetectado = productosCoincidentes.length === 1 ? productosCoincidentes[0] : undefined;

  useEffect(() => {
    if (filtroTipo && !tiposDisponibles.includes(filtroTipo)) setFiltroTipo("");
  }, [filtroTipo, tiposDisponibles]);

  useEffect(() => {
    if (filtroGenero && !generosDisponibles.includes(filtroGenero)) setFiltroGenero("");
  }, [filtroGenero, generosDisponibles]);

  useEffect(() => {
    if (filtroTela && !telasDisponibles.includes(filtroTela)) setFiltroTela("");
  }, [filtroTela, telasDisponibles]);

  useEffect(() => {
    if (filtroTalla && !tallasDisponibles.includes(filtroTalla)) setFiltroTalla("");
  }, [filtroTalla, tallasDisponibles]);

  useEffect(() => {
    if (filtroColor && !coloresDisponibles.includes(filtroColor)) setFiltroColor("");
  }, [filtroColor, coloresDisponibles]);

  useEffect(() => {
    const syncProducto = async () => {
      if (!productoDetectado) {
        setArticuloActual((prev) => ({
          ...prev,
          productoId: "",
          stockMax: null,
          stockActual: null,
        }));
        return;
      }

      const stockActual = bodegaId ? await fetchStockActual(Number(bodegaId), productoDetectado.id) : null;
      setArticuloActual((prev) => ({
        ...prev,
        productoId: productoDetectado.id,
        stockMax: productoDetectado.stockMax ?? null,
        stockActual,
      }));
    };

    void syncProducto();
  }, [productoDetectado, bodegaId]);

  const capacidadDisponibleActual = useMemo(() => {
    const stockMax = Number(articuloActual.stockMax ?? 0);
    const stockActual = Number(articuloActual.stockActual ?? 0);
    if (stockMax > 0) return Math.max(stockMax - stockActual, 0);
    return null;
  }, [articuloActual.stockMax, articuloActual.stockActual]);

  const capacidadRestanteEstimada = useMemo(() => {
    if (capacidadDisponibleActual === null) return null;
    return Math.max(capacidadDisponibleActual - (Number(cantidadInput) || 0), 0);
  }, [capacidadDisponibleActual, cantidadInput]);

  const limpiarArticulo = () => {
    setArticuloActual(detalleInicial);
    setCantidadInput("1");
    setEditingDetalleKey(null);
    setFiltroTipo("");
    setFiltroGenero("");
    setFiltroTela("");
    setFiltroTalla("");
    setFiltroColor("");
  };

  const capacidadDisponibleRow = (row: Pick<DetalleRow, "stockMax" | "stockActual">) => {
    const stockMax = Number(row.stockMax ?? 0);
    const stockActual = Number(row.stockActual ?? 0);
    if (stockMax > 0) return Math.max(stockMax - stockActual, 0);
    return null;
  };

  const agregarArticulo = () => {
    if (!bodegaId) {
      Swal.fire("Validacion", "Selecciona una bodega antes de agregar articulos", "warning");
      return;
    }
    if (!articuloActual.productoId) {
      Swal.fire("Validacion", "Selecciona un producto", "warning");
      return;
    }

    const cantidad = Number(cantidadInput) || 0;
    if (cantidad <= 0) {
      Swal.fire("Validacion", "Ingresa una cantidad mayor a 0", "warning");
      return;
    }

    const capacidadDisponible = capacidadDisponibleActual;
    if (capacidadDisponible !== null && cantidad > capacidadDisponible) {
      Swal.fire("Validacion", `Solo puedes ingresar ${capacidadDisponible} unidades mas de este producto en esta bodega`, "warning");
      return;
    }

    const row: DetalleRow = {
      key: editingDetalleKey ?? Date.now(),
      productoId: Number(articuloActual.productoId),
      cantidad,
      stockMax: articuloActual.stockMax,
      stockActual: articuloActual.stockActual,
    };

    setDetalle((prev) =>
      editingDetalleKey === null ? [...prev, row] : prev.map((item) => (item.key === editingDetalleKey ? row : item)),
    );
    limpiarArticulo();
  };

  const editarArticulo = (row: DetalleRow) => {
    const producto = productos.find((p) => p.id === row.productoId);
    setEditingDetalleKey(row.key);
    setArticuloActual({
      productoId: row.productoId,
      cantidad: row.cantidad,
      stockMax: row.stockMax,
      stockActual: row.stockActual,
    });
    setCantidadInput(String(row.cantidad));
    setFiltroTipo(producto?.tipo || "");
    setFiltroGenero(producto?.genero || "");
    setFiltroTela(obtenerTela(producto) === "N/D" ? "" : obtenerTela(producto));
    setFiltroTalla(obtenerTalla(producto) === "N/D" ? "" : obtenerTalla(producto));
    setFiltroColor(obtenerColor(producto) === "N/D" ? "" : obtenerColor(producto));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const eliminarArticulo = (key: number) => {
    setDetalle((prev) => prev.filter((item) => item.key !== key));
    if (editingDetalleKey === key) {
      limpiarArticulo();
    }
  };

  const abrirPdfIngreso = (ingreso: any, detalleUsado: DetalleRow[]) => {
    const nuevaVentana = window.open("", "_blank");
    if (!nuevaVentana) {
      Swal.fire("Aviso", "Habilita las ventanas emergentes para ver el PDF", "info");
      return;
    }

    const bodegaNombre = bodegas.find((b) => b.id === Number(bodegaId))?.nombre || "N/D";
    const fecha = ingreso?.fecha ? new Date(ingreso.fecha) : new Date();
    const folio = ingreso?.id ? `ING-${ingreso.id}` : "Pendiente";
    const responsable = usuario || "Responsable";

    const html = buildIngresoInventarioPdfHtml({
      folio,
      fecha,
      bodega: bodegaNombre,
      responsable,
      observaciones,
      totalItems: detalleUsado.reduce((sum, item) => sum + item.cantidad, 0),
      logoUrl: LOGO_URL,
      items: detalleUsado.map((item) => {
        const producto = productos.find((p) => p.id === item.productoId);
        return {
          codigo: producto?.codigo || `${item.productoId}`,
          nombre: producto?.nombre || "Producto",
          tipo: producto?.tipo || "N/D",
          genero: producto?.genero || "N/D",
          tela: obtenerTela(producto),
          talla: obtenerTalla(producto),
          color: obtenerColor(producto),
          cantidad: Number(item.cantidad) || 0,
        };
      }),
    });

    nuevaVentana.document.write(html);
    nuevaVentana.document.close();
  };

  const onBodegaChange = async (newBodegaId: number) => {
    setBodegaId(newBodegaId);

    const updates = await Promise.all(
      detalle.map(async (row) => {
        const stockActual = await fetchStockActual(newBodegaId, row.productoId);
        const prod = productos.find((p) => p.id === row.productoId);
        return { ...row, stockMax: prod?.stockMax ?? null, stockActual };
      }),
    );
    setDetalle(updates);

    if (articuloActual.productoId) {
      const stockActual = await fetchStockActual(newBodegaId, Number(articuloActual.productoId));
      const producto = productos.find((p) => p.id === Number(articuloActual.productoId));
      setArticuloActual((prev) => ({
        ...prev,
        stockActual,
        stockMax: producto?.stockMax ?? null,
      }));
    }
  };

  const totalItems = useMemo(() => detalle.reduce((sum, r) => sum + (Number(r.cantidad) || 0), 0), [detalle]);

  const guardar = async () => {
    if (!bodegaId) {
      Swal.fire("Validacion", "Selecciona una bodega", "warning");
      return;
    }
    if (!detalle.length) {
      Swal.fire("Validacion", "Agrega al menos un producto con cantidad mayor a 0", "warning");
      return;
    }

    const invalid = detalle.find((d) => {
      const stockMax = Number(d.stockMax ?? 0);
      return stockMax > 0 && Number(d.stockActual ?? 0) + d.cantidad > stockMax;
    });
    if (invalid) {
      const disponible = capacidadDisponibleRow(invalid);
      Swal.fire(
        "Validacion",
        `Hay un producto que supera el stock maximo permitido. Disponible para ingreso: ${disponible ?? 0}`,
        "warning",
      );
      return;
    }

    const payload = {
      bodegaId: Number(bodegaId),
      observaciones: observaciones || null,
      detalle: detalle.map((d) => ({
        productoId: d.productoId,
        cantidad: d.cantidad,
      })),
    };

    try {
      const resp = await api.post("/ingresos", payload);
      Swal.fire("Guardado", "Ingreso registrado", "success");
      abrirPdfIngreso(resp.data, detalle);
      setObservaciones("");
      setDetalle([]);
      limpiarArticulo();
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo guardar";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Inventory2Outlined color="primary" />
        <Typography variant="h4">Ingreso de inventario</Typography>
      </Stack>
      <Divider sx={{ mb: 2 }} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel>Bodega</InputLabel>
            <Select
              label="Bodega"
              value={bodegaId === "" ? "" : bodegaId}
              onChange={(e) => void onBodegaChange(Number(e.target.value))}
              disabled={!!userBodegaId && !canAccessAllBodegas}
            >
              {bodegas.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 8 }}>
          <TextField
            label="Observaciones"
            fullWidth
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" sx={{ mb: 2 }}>
        Agregar articulo
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Selecciona la combinacion del producto y agregalo a la lista temporal antes de guardar el ingreso.
          </Typography>
          {!bodegaId ? (
            <Alert severity="info">Selecciona una bodega para consultar el stock actual y la capacidad disponible.</Alert>
          ) : articuloActual.productoId && articuloActual.stockActual != null ? (
            <Alert severity={capacidadDisponibleActual !== null && capacidadDisponibleActual <= 0 ? "warning" : "info"}>
              {`Stock actual en bodega: ${articuloActual.stockActual} unidades. `}
              {capacidadDisponibleActual !== null
                ? `Capacidad disponible para ingreso: ${capacidadDisponibleActual} unidades. Capacidad restante estimada con esta captura: ${capacidadRestanteEstimada ?? 0} unidades.`
                : "Este producto no tiene stock maximo definido, por lo que no hay un limite configurado para el ingreso."}
            </Alert>
          ) : (
            <Alert severity="info">Completa los filtros del articulo para detectar automaticamente el producto.</Alert>
          )}
        </Stack>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Tipo</InputLabel>
              <Select label="Tipo" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                {tiposDisponibles.map((tipo) => (
                  <MenuItem key={tipo} value={tipo}>
                    {tipo}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Genero</InputLabel>
              <Select label="Genero" value={filtroGenero} onChange={(e) => setFiltroGenero(e.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                {generosDisponibles.map((genero) => (
                  <MenuItem key={genero} value={genero}>
                    {genero}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Tela</InputLabel>
              <Select label="Tela" value={filtroTela} onChange={(e) => setFiltroTela(e.target.value)}>
                <MenuItem value="">Todas</MenuItem>
                {telasDisponibles.map((tela) => (
                  <MenuItem key={tela} value={tela}>
                    {tela}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Talla</InputLabel>
              <Select label="Talla" value={filtroTalla} onChange={(e) => setFiltroTalla(e.target.value)}>
                <MenuItem value="">Todas</MenuItem>
                {tallasDisponibles.map((talla) => (
                  <MenuItem key={talla} value={talla}>
                    {talla}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Color</InputLabel>
              <Select label="Color" value={filtroColor} onChange={(e) => setFiltroColor(e.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                {coloresDisponibles.map((color) => (
                  <MenuItem key={color} value={color}>
                    {color}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField
              label="Codigo"
              fullWidth
              disabled
              value={productoDetectado?.codigo || ""}
              helperText={
                !filtroTipo || !filtroGenero || !filtroTela || !filtroTalla || !filtroColor
                  ? "Completa todos los filtros"
                  : productosCoincidentes.length > 1
                    ? "La combinacion coincide con varios productos"
                    : productosCoincidentes.length === 0
                      ? "No existe un producto con esa combinacion"
                      : "Codigo detectado automaticamente"
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <TextField
              label="Cantidad"
              type="text"
              fullWidth
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              value={cantidadInput}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "");
                const normalizado = raw.replace(/^0+(?=\d)/, "");
                setCantidadInput(normalizado);
              }}
              helperText={
                capacidadDisponibleActual !== null
                  ? `Disponible para ingreso: ${capacidadDisponibleActual}`
                  : "Sin limite configurado"
              }
            />
          </Grid>
        </Grid>

        <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 2 }}>
          {editingDetalleKey !== null && (
            <Button variant="outlined" color="inherit" onClick={limpiarArticulo}>
              Cancelar edicion
            </Button>
          )}
          <Button
            startIcon={editingDetalleKey !== null ? <EditOutlined /> : <AddIcon />}
            variant="contained"
            onClick={agregarArticulo}
          >
            {editingDetalleKey !== null ? "Actualizar articulo" : "Agregar a lista"}
          </Button>
        </Stack>
      </Paper>

      <Typography variant="h6" sx={{ mb: 1 }}>
        Lista temporal
      </Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Codigo</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Producto</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Tipo</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Genero</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Tela</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Talla</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Color</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Cantidad</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Stock actual</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Capacidad</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {detalle.map((row) => {
              const producto = productos.find((p) => p.id === row.productoId);
              const capacidad = capacidadDisponibleRow(row);
              return (
                <TableRow key={row.key}>
                  <TableCell align="center">{producto?.codigo || row.productoId}</TableCell>
                  <TableCell align="center">{producto?.nombre || "Producto"}</TableCell>
                  <TableCell align="center">{producto?.tipo || "N/D"}</TableCell>
                  <TableCell align="center">{producto?.genero || "N/D"}</TableCell>
                  <TableCell align="center">{obtenerTela(producto)}</TableCell>
                  <TableCell align="center">{obtenerTalla(producto)}</TableCell>
                  <TableCell align="center">{obtenerColor(producto)}</TableCell>
                  <TableCell align="center">{row.cantidad}</TableCell>
                  <TableCell align="center">{row.stockActual ?? "N/D"}</TableCell>
                  <TableCell align="center">{capacidad === null ? "Sin limite" : capacidad}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} justifyContent="center">
                      <IconButton color="primary" onClick={() => editarArticulo(row)}>
                        <EditOutlined />
                      </IconButton>
                      <IconButton color="error" onClick={() => eliminarArticulo(row.key)}>
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {!detalle.length && (
              <TableRow>
                <TableCell colSpan={11} align="center">
                  Aun no has agregado articulos al ingreso.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction="row" justifyContent="space-between" sx={{ mt: 2 }}>
        <Typography>Total items: {totalItems}</Typography>
        <Button variant="contained" color="success" onClick={guardar}>
          Guardar ingreso
        </Button>
      </Stack>
    </Paper>
  );
}
