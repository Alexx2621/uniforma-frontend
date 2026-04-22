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
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import LOGO_URL from "../assets/3-logos.png";
import { buildTrasladoPdfHtml } from "../utils/trasladoPdf";

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
  stockOrigen: number | null;
  stockDestino: number | null;
}

interface CapturaArticulo {
  productoId: number | "";
  cantidad: number;
  stockOrigen: number | null;
  stockDestino: number | null;
}

const detalleInicial: CapturaArticulo = {
  productoId: "",
  cantidad: 1,
  stockOrigen: null,
  stockDestino: null,
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

export default function Traslados() {
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [telas, setTelas] = useState<CatalogoItem[]>([]);
  const [tallas, setTallas] = useState<CatalogoItem[]>([]);
  const [colores, setColores] = useState<CatalogoItem[]>([]);
  const [desdeBodegaId, setDesdeBodegaId] = useState<number | "">("");
  const [haciaBodegaId, setHaciaBodegaId] = useState<number | "">("");
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

  const { rol, rolId, bodegaId: userBodegaId, usuario } = useAuthStore();
  const { crossStoreRoleIds, fetchConfig } = useSystemConfigStore();
  const canAccessAllBodegas = rol === "ADMIN" || crossStoreRoleIds.includes(Number(rolId));
  const mismaBodegaSeleccionada =
    desdeBodegaId !== "" && haciaBodegaId !== "" && Number(desdeBodegaId) === Number(haciaBodegaId);

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
      setDesdeBodegaId(exists ? parsed : "");
    }
  }, [userBodegaId, canAccessAllBodegas, bodegas]);

  const fetchStock = async (bodega: number, producto: number) => {
    if (!bodega || !producto) return null;
    try {
      const resp = await api.get(`/inventario/${bodega}/${producto}`);
      return resp.data?.stock ?? 0;
    } catch {
      return 0;
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
          stockOrigen: null,
          stockDestino: null,
        }));
        return;
      }

      const [stockOrigen, stockDestino] = await Promise.all([
        desdeBodegaId ? fetchStock(Number(desdeBodegaId), productoDetectado.id) : Promise.resolve(null),
        haciaBodegaId ? fetchStock(Number(haciaBodegaId), productoDetectado.id) : Promise.resolve(null),
      ]);

      setArticuloActual((prev) => ({
        ...prev,
        productoId: productoDetectado.id,
        stockOrigen,
        stockDestino,
      }));
    };

    void syncProducto();
  }, [productoDetectado, desdeBodegaId, haciaBodegaId]);

  const stockRestanteOrigenEstimado = useMemo(
    () =>
      articuloActual.stockOrigen != null ? Math.max(articuloActual.stockOrigen - (Number(cantidadInput) || 0), 0) : null,
    [articuloActual.stockOrigen, cantidadInput],
  );

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

  const agregarArticulo = () => {
    if (!desdeBodegaId || !haciaBodegaId) {
      Swal.fire("Validacion", "Selecciona bodega origen y destino antes de agregar articulos", "warning");
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

    if (articuloActual.stockOrigen != null && cantidad > articuloActual.stockOrigen) {
      Swal.fire("Validacion", `Solo hay ${articuloActual.stockOrigen} unidades disponibles en la bodega origen`, "warning");
      return;
    }

    const row: DetalleRow = {
      key: editingDetalleKey ?? Date.now(),
      productoId: Number(articuloActual.productoId),
      cantidad,
      stockOrigen: articuloActual.stockOrigen,
      stockDestino: articuloActual.stockDestino,
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
      stockOrigen: row.stockOrigen,
      stockDestino: row.stockDestino,
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

  const abrirPdfTraslado = (traslado: any, detalleUsado: DetalleRow[]) => {
    const nuevaVentana = window.open("", "_blank");
    if (!nuevaVentana) {
      Swal.fire("Aviso", "Habilita las ventanas emergentes para ver el PDF", "info");
      return;
    }

    const origenNombre =
      traslado?.desdeBodega?.nombre ||
      bodegas.find((b) => b.id === Number(desdeBodegaId))?.nombre ||
      "Origen";
    const destinoNombre =
      traslado?.haciaBodega?.nombre ||
      bodegas.find((b) => b.id === Number(haciaBodegaId))?.nombre ||
      "Destino";
    const fecha = traslado?.fecha ? new Date(traslado.fecha) : new Date();
    const folio = traslado?.id ? `TR-${traslado.id}` : "Pendiente";
    const responsable = usuario || "Responsable";
    const html = buildTrasladoPdfHtml({
      folio,
      fecha,
      origen: origenNombre,
      destino: destinoNombre,
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

  const onBodegaChange = async (dir: "desde" | "hacia", value: number) => {
    const otraBodegaId = dir === "desde" ? Number(haciaBodegaId || 0) : Number(desdeBodegaId || 0);
    if (value > 0 && otraBodegaId > 0 && value === otraBodegaId) {
      Swal.fire("Validacion", "No puedes hacer un traslado sobre la misma tienda", "warning");
      return;
    }

    if (dir === "desde") {
      setDesdeBodegaId(value);
    } else {
      setHaciaBodegaId(value);
    }

    const siguienteOrigen = dir === "desde" ? value : Number(desdeBodegaId || 0);
    const siguienteDestino = dir === "hacia" ? value : Number(haciaBodegaId || 0);

    const updated = await Promise.all(
      detalle.map(async (row) => {
        const [stockOrigen, stockDestino] = await Promise.all([
          siguienteOrigen ? fetchStock(siguienteOrigen, row.productoId) : Promise.resolve(null),
          siguienteDestino ? fetchStock(siguienteDestino, row.productoId) : Promise.resolve(null),
        ]);
        return { ...row, stockOrigen, stockDestino };
      }),
    );
    setDetalle(updated);

    if (articuloActual.productoId) {
      const [stockOrigen, stockDestino] = await Promise.all([
        siguienteOrigen ? fetchStock(siguienteOrigen, Number(articuloActual.productoId)) : Promise.resolve(null),
        siguienteDestino ? fetchStock(siguienteDestino, Number(articuloActual.productoId)) : Promise.resolve(null),
      ]);
      setArticuloActual((prev) => ({ ...prev, stockOrigen, stockDestino }));
    }
  };

  const totalItems = useMemo(() => detalle.reduce((sum, r) => sum + (Number(r.cantidad) || 0), 0), [detalle]);

  const guardar = async () => {
    if (!desdeBodegaId || !haciaBodegaId) {
      Swal.fire("Validacion", "Selecciona bodega origen y destino", "warning");
      return;
    }
    if (desdeBodegaId === haciaBodegaId) {
      Swal.fire("Validacion", "Las bodegas deben ser diferentes", "warning");
      return;
    }
    if (!detalle.length) {
      Swal.fire("Validacion", "Agrega al menos un producto con cantidad mayor a 0", "warning");
      return;
    }

    const invalid = detalle.find((d) => d.stockOrigen != null && d.cantidad > d.stockOrigen);
    if (invalid) {
      Swal.fire(
        "Validacion",
        `Hay un producto que supera el stock disponible en la bodega origen. Disponible: ${invalid.stockOrigen ?? 0}`,
        "warning",
      );
      return;
    }

    const payload = {
      desdeBodegaId: Number(desdeBodegaId),
      haciaBodegaId: Number(haciaBodegaId),
      observaciones: observaciones || null,
      detalle: detalle.map((d) => ({ productoId: d.productoId, cantidad: d.cantidad })),
    };

    try {
      const resp = await api.post("/traslados", payload);
      Swal.fire("Guardado", "Traslado registrado", "success");
      abrirPdfTraslado(resp.data, detalle);
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
        <SwapHorizIcon />
        <Typography variant="h4">Traslados entre bodegas</Typography>
      </Stack>
      <Divider sx={{ mb: 2 }} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel>Bodega origen</InputLabel>
            <Select
              label="Bodega origen"
              value={desdeBodegaId === "" ? "" : desdeBodegaId}
              onChange={(e) => void onBodegaChange("desde", Number(e.target.value))}
              disabled={!!userBodegaId && !canAccessAllBodegas}
            >
              {bodegas.map((b) => (
                <MenuItem key={b.id} value={b.id} disabled={Number(haciaBodegaId || 0) === b.id}>
                  {b.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel>Bodega destino</InputLabel>
            <Select
              label="Bodega destino"
              value={haciaBodegaId === "" ? "" : haciaBodegaId}
              onChange={(e) => void onBodegaChange("hacia", Number(e.target.value))}
            >
              {bodegas.map((b) => (
                <MenuItem key={b.id} value={b.id} disabled={Number(desdeBodegaId || 0) === b.id}>
                  {b.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
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
            Selecciona la combinacion del producto y agregalo a la lista temporal antes de guardar el traslado.
          </Typography>
          {mismaBodegaSeleccionada ? (
            <Alert severity="warning">La bodega origen y la bodega destino no pueden ser la misma.</Alert>
          ) : null}
          {!desdeBodegaId ? (
            <Alert severity="info">Selecciona la bodega origen para consultar el stock disponible.</Alert>
          ) : articuloActual.productoId && articuloActual.stockOrigen != null ? (
            <Alert severity={stockRestanteOrigenEstimado !== null && stockRestanteOrigenEstimado <= 0 ? "warning" : "info"}>
              {`Stock actual en origen: ${articuloActual.stockOrigen} unidades. `}
              {haciaBodegaId !== "" ? `Stock actual en destino: ${articuloActual.stockDestino ?? 0} unidades. ` : ""}
              {`Stock restante estimado en origen con esta captura: ${stockRestanteOrigenEstimado ?? 0} unidades.`}
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
              helperText={`Disponible en origen: ${articuloActual.stockOrigen ?? 0}`}
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
              <TableCell align="center" sx={{ fontWeight: 700 }}>Stock origen</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Stock destino</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {detalle.map((row) => {
              const producto = productos.find((p) => p.id === row.productoId);
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
                  <TableCell align="center">{row.stockOrigen ?? "N/D"}</TableCell>
                  <TableCell align="center">{row.stockDestino ?? "N/D"}</TableCell>
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
                  Aun no has agregado articulos al traslado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction="row" justifyContent="space-between" sx={{ mt: 2 }}>
        <Typography>Total items: {totalItems}</Typography>
        <Button variant="contained" color="success" onClick={guardar}>
          Guardar traslado
        </Button>
      </Stack>
    </Paper>
  );
}
