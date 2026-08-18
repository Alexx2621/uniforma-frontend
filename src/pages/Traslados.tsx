import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import EditOutlined from "@mui/icons-material/EditOutlined";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import PrintOutlined from "@mui/icons-material/PrintOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { hasPermission } from "../auth/permissions";
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

interface TrasladoRegistro {
  id: number;
  folio?: string | null;
  fecha: string;
  desdeBodegaId: number;
  haciaBodegaId: number;
  observaciones?: string | null;
  responsable?: string | null;
  desdeBodega?: Bodega | null;
  haciaBodega?: Bodega | null;
  detalle?: Array<{
    id: number;
    productoId: number;
    cantidad: number;
    producto?: Producto | null;
  }>;
}

interface SolicitudTrasladoRegistro {
  id: number;
  folio?: string | null;
  fecha: string;
  estado: string;
  responsable?: string | null;
  observaciones?: string | null;
  solicitanteId?: number | null;
  venta?: { id: number; folio?: string | null; clienteNombre?: string | null } | null;
  desdeBodegaId: number;
  haciaBodegaId: number;
  desdeBodega?: Bodega | null;
  haciaBodega?: Bodega | null;
  detalle?: Array<{
    id: number;
    productoId: number;
    cantidad: number;
    cantidadRecibida?: number;
    estado?: string;
    producto?: Producto | null;
  }>;
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

const toInputDate = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 10);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "N/D";
  return new Date(value).toLocaleString("es-GT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function Traslados() {
  const today = useMemo(() => toInputDate(new Date()), []);
  const [vista, setVista] = useState<"listado" | "nuevo" | "solicitar">("listado");
  const [traslados, setTraslados] = useState<TrasladoRegistro[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudTrasladoRegistro[]>([]);
  const [loadingTraslados, setLoadingTraslados] = useState(false);
  const [guardandoTraslado, setGuardandoTraslado] = useState(false);
  const guardandoTrasladoRef = useRef(false);
  const [filtroDesdeFecha, setFiltroDesdeFecha] = useState(today);
  const [filtroHastaFecha, setFiltroHastaFecha] = useState(today);
  const [filtroDesdeBodegaId, setFiltroDesdeBodegaId] = useState<number | "">("");
  const [filtroHaciaBodegaId, setFiltroHaciaBodegaId] = useState<number | "">("");
  const [filtroResponsable, setFiltroResponsable] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [trasladoSeleccionado, setTrasladoSeleccionado] = useState<TrasladoRegistro | null>(null);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [bodegasTodas, setBodegasTodas] = useState<Bodega[]>([]);
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

  const { rol, permisos, bodegaId: userBodegaId, usuario } = useAuthStore();
  const { fetchConfig } = useSystemConfigStore();
  const canAccessAllBodegas = hasPermission(rol, permisos, "sistema.multi-tienda");
  const mismaBodegaSeleccionada =
    desdeBodegaId !== "" && haciaBodegaId !== "" && Number(desdeBodegaId) === Number(haciaBodegaId);

  const cargarTraslados = useCallback(async () => {
    try {
      setLoadingTraslados(true);
      const params = {
        desde: filtroDesdeFecha || undefined,
        hasta: filtroHastaFecha || undefined,
        desdeBodegaId: filtroDesdeBodegaId || undefined,
        haciaBodegaId: filtroHaciaBodegaId || undefined,
        responsable: filtroResponsable.trim() || undefined,
      };
      const [resp, respSolicitudes] = await Promise.all([
        api.get("/traslados", { params }),
        api.get("/traslados/solicitudes", { params }),
      ]);
      setTraslados(Array.isArray(resp.data) ? resp.data : []);
      setSolicitudes(Array.isArray(respSolicitudes.data) ? respSolicitudes.data : []);
      setPage(0);
    } catch {
      Swal.fire("Error", "No se pudieron cargar los traslados", "error");
    } finally {
      setLoadingTraslados(false);
    }
  }, [filtroDesdeFecha, filtroHastaFecha, filtroDesdeBodegaId, filtroHaciaBodegaId, filtroResponsable]);

  const cargarCatalogos = async () => {
    try {
      const [respBod, respBodTodas, respProd, respTelas, respTallas, respColores] = await Promise.all([
        api.get("/bodegas", { params: { operacion: "traslados" } }),
        api.get("/bodegas", { params: { operacion: "solicitud-traslado" } }),
        api.get("/productos"),
        api.get("/telas").catch(() => ({ data: [] })),
        api.get("/tallas").catch(() => ({ data: [] })),
        api.get("/colores").catch(() => ({ data: [] })),
      ]);
      setBodegas(respBod.data || []);
      setBodegasTodas(respBodTodas.data || []);
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
    void cargarTraslados();
  }, [cargarTraslados]);

  useEffect(() => {
    // En modo "solicitar" el origen es la OTRA tienda: no autocompletar con la propia.
    if (vista === "solicitar") return;
    if (userBodegaId && !canAccessAllBodegas && !desdeBodegaId) {
      const parsed = Number(userBodegaId);
      const exists = bodegas.some((b) => b.id === parsed);
      setDesdeBodegaId(exists ? parsed : "");
      setFiltroDesdeBodegaId((prev) => prev || (exists ? parsed : ""));
    }
  }, [userBodegaId, canAccessAllBodegas, bodegas, desdeBodegaId, vista]);

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
    const folio = traslado?.folio || (traslado?.id ? `TR-${traslado.id}` : "Pendiente");
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

  const abrirPdfTrasladoRegistro = (traslado: TrasladoRegistro) => {
    const nuevaVentana = window.open("", "_blank");
    if (!nuevaVentana) {
      Swal.fire("Aviso", "Habilita las ventanas emergentes para ver el PDF", "info");
      return;
    }

    const detalleRegistro = Array.isArray(traslado.detalle) ? traslado.detalle : [];
    const html = buildTrasladoPdfHtml({
      folio: traslado.folio || `TR-${traslado.id}`,
      fecha: traslado.fecha ? new Date(traslado.fecha) : new Date(),
      origen: traslado.desdeBodega?.nombre || bodegas.find((b) => b.id === Number(traslado.desdeBodegaId))?.nombre || "Origen",
      destino: traslado.haciaBodega?.nombre || bodegas.find((b) => b.id === Number(traslado.haciaBodegaId))?.nombre || "Destino",
      responsable: traslado.responsable || "Responsable",
      observaciones: traslado.observaciones || "",
      totalItems: detalleRegistro.reduce((sum, item) => sum + Number(item.cantidad || 0), 0),
      logoUrl: LOGO_URL,
      items: detalleRegistro.map((item) => {
        const producto = item.producto || productos.find((p) => p.id === item.productoId);
        return {
          codigo: producto?.codigo || `${item.productoId}`,
          nombre: producto?.nombre || "Producto",
          tipo: producto?.tipo || "N/D",
          genero: producto?.genero || "N/D",
          tela: resolveTelaNombre(producto || undefined, telas),
          talla: resolveTallaNombre(producto || undefined, tallas),
          color: resolveColorNombre(producto || undefined, colores),
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
    if (guardandoTrasladoRef.current) return;
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
      responsable: usuario || null,
      detalle: detalle.map((d) => ({ productoId: d.productoId, cantidad: d.cantidad })),
    };

    try {
      guardandoTrasladoRef.current = true;
      setGuardandoTraslado(true);
      const resp = await api.post("/traslados", payload);
      Swal.fire("Guardado", "Traslado registrado", "success");
      abrirPdfTraslado(resp.data, detalle);
      setObservaciones("");
      setDetalle([]);
      limpiarArticulo();
      await cargarTraslados();
      setVista("listado");
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo guardar";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    } finally {
      guardandoTrasladoRef.current = false;
      setGuardandoTraslado(false);
    }
  };

  const enviarSolicitud = async () => {
    if (guardandoTrasladoRef.current) return;
    if (!desdeBodegaId || !haciaBodegaId) {
      Swal.fire("Validacion", "Selecciona a que tienda le pides el producto y para cual tienda es", "warning");
      return;
    }
    if (desdeBodegaId === haciaBodegaId) {
      Swal.fire("Validacion", "No puedes pedirle un producto a tu propia tienda", "warning");
      return;
    }
    if (!detalle.length) {
      Swal.fire("Validacion", "Agrega al menos un producto con cantidad mayor a 0", "warning");
      return;
    }
    if (!observaciones.trim()) {
      Swal.fire("Validacion", "Escribe un mensaje para la tienda que recibira la solicitud", "warning");
      return;
    }

    const payload = {
      desdeBodegaId: Number(desdeBodegaId),
      haciaBodegaId: Number(haciaBodegaId),
      observaciones: observaciones.trim(),
      responsable: usuario || null,
      detalle: detalle.map((d) => ({ productoId: d.productoId, cantidad: d.cantidad })),
    };

    try {
      guardandoTrasladoRef.current = true;
      setGuardandoTraslado(true);
      await api.post("/traslados/solicitudes", payload);
      Swal.fire("Enviada", "La tienda recibira una alerta con tu solicitud", "success");
      setObservaciones("");
      setDetalle([]);
      limpiarArticulo();
      await cargarTraslados();
      setVista("listado");
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo enviar la solicitud";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    } finally {
      guardandoTrasladoRef.current = false;
      setGuardandoTraslado(false);
    }
  };

  const trasladosPaginados = traslados.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const totalItemsSeleccionado =
    trasladoSeleccionado?.detalle?.reduce((sum, item) => sum + Number(item.cantidad || 0), 0) || 0;

  const estadoColor = (estado: string) => {
    const normalized = `${estado || ""}`.toUpperCase();
    if (normalized === "RECIBIDO") return "success";
    if (normalized === "RECIBIDO_PARCIAL") return "warning";
    if (normalized === "CANCELADO") return "error";
    if (normalized === "PENDIENTE_APROBACION") return "warning";
    if (normalized === "EN_TRANSITO") return "info";
    return "default";
  };

  const cambiarEstadoSolicitud = async (solicitud: SolicitudTrasladoRegistro, estado: string) => {
    const resp = await Swal.fire({
      title: "Cambiar estado",
      text: `La solicitud ${solicitud.folio || `#${solicitud.id}`} quedara como ${estado}.`,
      icon: estado === "RECIBIDO" ? "question" : "info",
      showCancelButton: true,
      confirmButtonText: "Confirmar",
      cancelButtonText: "Cancelar",
    });
    if (!resp.isConfirmed) return;
    try {
      await api.patch(`/traslados/solicitudes/${solicitud.id}/estado`, { estado });
      Swal.fire("Actualizado", "Estado de solicitud actualizado", "success");
      await cargarTraslados();
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo actualizar la solicitud", "error");
    }
  };

  const recibirParcialSolicitud = async (solicitud: SolicitudTrasladoRegistro) => {
    const detallePendiente = (solicitud.detalle || [])
      .map((item) => ({
        ...item,
        pendiente: Math.max(0, Number(item.cantidad || 0) - Number(item.cantidadRecibida || 0)),
      }))
      .filter((item) => item.pendiente > 0);

    if (!detallePendiente.length) {
      Swal.fire("Solicitud recibida", "No hay cantidades pendientes para recibir", "info");
      return;
    }

    const rowsHtml = detallePendiente
      .map((item) => {
        const producto = item.producto;
        const codigo = producto?.codigo || item.productoId;
        const nombre = producto?.nombre || "Producto";
        return `
          <tr>
            <td style="padding:6px;border-bottom:1px solid #ddd">${codigo}</td>
            <td style="padding:6px;border-bottom:1px solid #ddd">${nombre}</td>
            <td style="padding:6px;border-bottom:1px solid #ddd;text-align:center">${item.cantidad}</td>
            <td style="padding:6px;border-bottom:1px solid #ddd;text-align:center">${item.cantidadRecibida || 0}</td>
            <td style="padding:6px;border-bottom:1px solid #ddd;text-align:center">${item.pendiente}</td>
            <td style="padding:6px;border-bottom:1px solid #ddd;text-align:center">
              <input id="recibir-${item.id}" type="number" min="0" max="${item.pendiente}" value="${item.pendiente}" class="swal2-input" style="width:90px;margin:0;height:34px" />
            </td>
          </tr>
        `;
      })
      .join("");

    const resp = await Swal.fire({
      title: `Recibir parcial ${solicitud.folio || `ST-${solicitud.id}`}`,
      width: 980,
      html: `
        <div style="text-align:left;margin-bottom:10px">
          Registra solo la cantidad que llegó físicamente. El saldo quedará pendiente.
        </div>
        <div style="max-height:420px;overflow:auto">
          <table style="width:100%;border-collapse:collapse;text-align:left;font-size:12px">
            <thead>
              <tr>
                <th>Codigo</th><th>Producto</th><th>Solicitado</th><th>Recibido</th><th>Pendiente</th><th>Recibir</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Registrar recepcion",
      cancelButtonText: "Cancelar",
      preConfirm: () => {
        const detalle = detallePendiente
          .map((item) => {
            const value = Number((document.getElementById(`recibir-${item.id}`) as HTMLInputElement | null)?.value || 0);
            return { detalleId: item.id, cantidad: value, pendiente: item.pendiente };
          })
          .filter((item) => item.cantidad > 0);
        const invalid = detalle.find((item) => item.cantidad > item.pendiente);
        if (!detalle.length) {
          Swal.showValidationMessage("Ingresa al menos una cantidad a recibir");
          return false;
        }
        if (invalid) {
          Swal.showValidationMessage("Una cantidad supera lo pendiente");
          return false;
        }
        return { detalle };
      },
    });
    if (!resp.isConfirmed || !resp.value) return;

    try {
      await api.patch(`/traslados/solicitudes/${solicitud.id}/recibir-parcial`, resp.value);
      Swal.fire("Registrado", "Recepcion parcial registrada correctamente", "success");
      await cargarTraslados();
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo registrar la recepcion parcial", "error");
    }
  };

  if (vista === "listado") {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1} sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <SwapHorizIcon color="primary" />
            <Typography variant="h4">Traslados entre bodegas</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<SendOutlinedIcon />}
              variant="outlined"
              onClick={() => {
                limpiarArticulo();
                setDetalle([]);
                setObservaciones("");
                setDesdeBodegaId("");
                setHaciaBodegaId(userBodegaId ? Number(userBodegaId) : "");
                setVista("solicitar");
              }}
            >
              Solicitar a otra tienda
            </Button>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={() => {
                limpiarArticulo();
                setDetalle([]);
                setObservaciones("");
                setVista("nuevo");
              }}
            >
              Nuevo traslado
            </Button>
          </Stack>
        </Stack>

        <Divider sx={{ mb: 2 }} />

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 2 }}>
              <TextField
                label="Desde"
                type="date"
                fullWidth
                value={filtroDesdeFecha}
                onChange={(e) => setFiltroDesdeFecha(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 2 }}>
              <TextField
                label="Hasta"
                type="date"
                fullWidth
                value={filtroHastaFecha}
                onChange={(e) => setFiltroHastaFecha(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Origen</InputLabel>
                <Select
                  label="Origen"
                  value={filtroDesdeBodegaId}
                  onChange={(e) => {
                    const value = e.target.value as number | "";
                    setFiltroDesdeBodegaId(value === "" ? "" : Number(value));
                  }}
                  disabled={!canAccessAllBodegas && bodegas.length <= 1}
                >
                  {canAccessAllBodegas && <MenuItem value="">Todas</MenuItem>}
                  {bodegas.map((b) => (
                    <MenuItem key={b.id} value={b.id}>
                      {b.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Destino</InputLabel>
                <Select
                  label="Destino"
                  value={filtroHaciaBodegaId}
                  onChange={(e) => {
                    const value = e.target.value as number | "";
                    setFiltroHaciaBodegaId(value === "" ? "" : Number(value));
                  }}
                >
                  <MenuItem value="">Todas</MenuItem>
                  {bodegas.map((b) => (
                    <MenuItem key={b.id} value={b.id}>
                      {b.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 2 }}>
              <TextField
                label="Responsable"
                fullWidth
                value={filtroResponsable}
                onChange={(e) => setFiltroResponsable(e.target.value)}
              />
            </Grid>
          </Grid>
        </Paper>

        <Typography variant="h6" sx={{ mb: 1 }}>
          Solicitudes pendientes y trazabilidad
        </Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Solicitud</TableCell>
                <TableCell>Venta</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Origen</TableCell>
                <TableCell>Destino</TableCell>
                <TableCell align="center">Items</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingTraslados ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">Cargando solicitudes...</TableCell>
                </TableRow>
              ) : solicitudes.length ? (
                solicitudes.map((solicitud) => {
                  const items = solicitud.detalle?.reduce((sum, item) => sum + Number(item.cantidad || 0), 0) || 0;
                  const recibidos = solicitud.detalle?.reduce((sum, item) => sum + Number(item.cantidadRecibida || 0), 0) || 0;
                  // Quien solicita no puede autorizar su propia solicitud: eso le
                  // corresponde a la tienda dueña del stock (o a un admin).
                  const esSoloElSolicitante =
                    !canAccessAllBodegas && Number(userBodegaId) === solicitud.haciaBodegaId;
                  return (
                    <TableRow key={solicitud.id} hover>
                      <TableCell>
                        <Chip size="small" color="primary" variant="outlined" label={solicitud.folio || `ST-${solicitud.id}`} />
                      </TableCell>
                      <TableCell>{solicitud.venta?.folio || (solicitud.venta?.id ? `Venta #${solicitud.venta.id}` : "-")}</TableCell>
                      <TableCell>{formatDateTime(solicitud.fecha)}</TableCell>
                      <TableCell>{solicitud.desdeBodega?.nombre || "N/D"}</TableCell>
                      <TableCell>{solicitud.haciaBodega?.nombre || "N/D"}</TableCell>
                      <TableCell align="center">
                        <Stack spacing={0.25} alignItems="center">
                          <Typography variant="body2">{items}</Typography>
                          {recibidos > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              Recibido: {recibidos}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" color={estadoColor(solicitud.estado) as any} label={solicitud.estado} />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          {solicitud.estado === "PENDIENTE_APROBACION" && !esSoloElSolicitante && (
                            <Button size="small" onClick={() => cambiarEstadoSolicitud(solicitud, "PENDIENTE")}>
                              Aprobar
                            </Button>
                          )}
                          {solicitud.estado === "PENDIENTE_APROBACION" && esSoloElSolicitante && (
                            <Chip size="small" variant="outlined" label="Esperando autorizacion" />
                          )}
                          {solicitud.estado !== "RECIBIDO" && solicitud.estado !== "CANCELADO" && (
                            <>
                              <Button size="small" onClick={() => cambiarEstadoSolicitud(solicitud, "EN_TRANSITO")}>
                                En transito
                              </Button>
                              <Button size="small" color="warning" onClick={() => recibirParcialSolicitud(solicitud)}>
                                Parcial
                              </Button>
                              <Button size="small" color="success" onClick={() => cambiarEstadoSolicitud(solicitud, "RECIBIDO")}>
                                Recibir
                              </Button>
                              <Button size="small" color="error" onClick={() => cambiarEstadoSolicitud(solicitud, "CANCELADO")}>
                                Cancelar
                              </Button>
                            </>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No hay solicitudes de traslado con los filtros seleccionados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Typography variant="h6" sx={{ mb: 1 }}>
          Traslados registrados
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Documento</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Origen</TableCell>
                <TableCell>Destino</TableCell>
                <TableCell>Responsable</TableCell>
                <TableCell align="center">Lineas</TableCell>
                <TableCell align="center">Items</TableCell>
                <TableCell>Observaciones</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingTraslados ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    Cargando traslados...
                  </TableCell>
                </TableRow>
              ) : trasladosPaginados.length ? (
                trasladosPaginados.map((traslado) => {
                  const lineas = traslado.detalle?.length || 0;
                  const items = traslado.detalle?.reduce((sum, item) => sum + Number(item.cantidad || 0), 0) || 0;
                  return (
                    <TableRow key={traslado.id} hover>
                      <TableCell>
                        <Chip size="small" color="primary" variant="outlined" label={traslado.folio || `TR-${traslado.id}`} />
                      </TableCell>
                      <TableCell>{formatDateTime(traslado.fecha)}</TableCell>
                      <TableCell>{traslado.desdeBodega?.nombre || bodegas.find((b) => b.id === traslado.desdeBodegaId)?.nombre || "N/D"}</TableCell>
                      <TableCell>{traslado.haciaBodega?.nombre || bodegas.find((b) => b.id === traslado.haciaBodegaId)?.nombre || "N/D"}</TableCell>
                      <TableCell>{traslado.responsable || "N/D"}</TableCell>
                      <TableCell align="center">{lineas}</TableCell>
                      <TableCell align="center">{items}</TableCell>
                      <TableCell>{traslado.observaciones || "-"}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<VisibilityOutlined />}
                            onClick={() => setTrasladoSeleccionado(traslado)}
                          >
                            Ver
                          </Button>
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<PrintOutlined />}
                            onClick={() => abrirPdfTrasladoRegistro(traslado)}
                          >
                            PDF
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    No hay traslados registrados con los filtros seleccionados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={traslados.length}
          page={page}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(Number(e.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="Rows per page:"
        />

        <Dialog open={Boolean(trasladoSeleccionado)} onClose={() => setTrasladoSeleccionado(null)} fullWidth maxWidth="lg">
          <DialogTitle>{trasladoSeleccionado ? `Traslado ${trasladoSeleccionado.folio || `TR-${trasladoSeleccionado.id}`}` : "Traslado"}</DialogTitle>
          <DialogContent dividers>
            {trasladoSeleccionado && (
              <Stack spacing={2}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Fecha</Typography>
                    <Typography>{formatDateTime(trasladoSeleccionado.fecha)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Origen</Typography>
                    <Typography>{trasladoSeleccionado.desdeBodega?.nombre || "N/D"}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Destino</Typography>
                    <Typography>{trasladoSeleccionado.haciaBodega?.nombre || "N/D"}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Total items</Typography>
                    <Typography>{totalItemsSeleccionado}</Typography>
                  </Grid>
                </Grid>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Responsable</Typography>
                    <Typography>{trasladoSeleccionado.responsable || "N/D"}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 9 }}>
                    <Typography variant="caption" color="text.secondary">Observaciones</Typography>
                    <Typography>{trasladoSeleccionado.observaciones || "Sin observaciones"}</Typography>
                  </Grid>
                </Grid>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Codigo</TableCell>
                        <TableCell>Producto</TableCell>
                        <TableCell>Tipo</TableCell>
                        <TableCell>Genero</TableCell>
                        <TableCell>Tela</TableCell>
                        <TableCell>Talla</TableCell>
                        <TableCell>Color</TableCell>
                        <TableCell align="center">Cantidad</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(trasladoSeleccionado.detalle || []).map((item) => {
                        const producto = item.producto || productos.find((p) => p.id === item.productoId);
                        return (
                          <TableRow key={item.id}>
                            <TableCell>{producto?.codigo || item.productoId}</TableCell>
                            <TableCell>{producto?.nombre || "Producto"}</TableCell>
                            <TableCell>{producto?.tipo || "N/D"}</TableCell>
                            <TableCell>{producto?.genero || "N/D"}</TableCell>
                            <TableCell>{resolveTelaNombre(producto || undefined, telas)}</TableCell>
                            <TableCell>{resolveTallaNombre(producto || undefined, tallas)}</TableCell>
                            <TableCell>{resolveColorNombre(producto || undefined, colores)}</TableCell>
                            <TableCell align="center">{item.cantidad}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            {trasladoSeleccionado && (
              <Button startIcon={<PrintOutlined />} onClick={() => abrirPdfTrasladoRegistro(trasladoSeleccionado)}>
                Reimprimir PDF
              </Button>
            )}
            <Button onClick={() => setTrasladoSeleccionado(null)}>Cerrar</Button>
          </DialogActions>
        </Dialog>
      </Paper>
    );
  }

  const esSolicitud = vista === "solicitar";
  const bodegasOrigenOpciones = esSolicitud ? bodegasTodas : bodegas;

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1} sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {esSolicitud ? <SendOutlinedIcon color="primary" /> : <SwapHorizIcon color="primary" />}
          <Typography variant="h4">{esSolicitud ? "Solicitar traslado a otra tienda" : "Traslados entre bodegas"}</Typography>
        </Stack>
        <Button startIcon={<ArrowBackOutlined />} variant="outlined" onClick={() => setVista("listado")}>
          Regresar
        </Button>
      </Stack>
      <Divider sx={{ mb: 2 }} />

      {esSolicitud && (
        <Alert severity="info" sx={{ mb: 2 }}>
          La tienda que elijas como origen recibira una alerta con tu mensaje y debera autorizarla antes de preparar el traslado.
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel>{esSolicitud ? "Tienda que tiene el producto" : "Bodega origen"}</InputLabel>
            <Select
              label={esSolicitud ? "Tienda que tiene el producto" : "Bodega origen"}
              value={desdeBodegaId === "" ? "" : desdeBodegaId}
              onChange={(e) => void onBodegaChange("desde", Number(e.target.value))}
              disabled={!esSolicitud && bodegas.length <= 1}
            >
              {bodegasOrigenOpciones.map((b) => (
                <MenuItem key={b.id} value={b.id} disabled={Number(haciaBodegaId || 0) === b.id}>
                  {b.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel>{esSolicitud ? "Tu tienda (recibe)" : "Bodega destino"}</InputLabel>
            <Select
              label={esSolicitud ? "Tu tienda (recibe)" : "Bodega destino"}
              value={haciaBodegaId === "" ? "" : haciaBodegaId}
              onChange={(e) => void onBodegaChange("hacia", Number(e.target.value))}
              disabled={esSolicitud && bodegas.length <= 1}
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
            label={esSolicitud ? "Mensaje para la tienda" : "Observaciones"}
            required={esSolicitud}
            placeholder={esSolicitud ? "Ej. Lo necesito para un pedido urgente de hoy" : undefined}
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
        <Button
          variant="contained"
          color="success"
          startIcon={esSolicitud ? <SendOutlinedIcon /> : undefined}
          onClick={esSolicitud ? enviarSolicitud : guardar}
          disabled={guardandoTraslado}
        >
          {guardandoTraslado ? "Guardando..." : esSolicitud ? "Enviar solicitud" : "Guardar traslado"}
        </Button>
      </Stack>
    </Paper>
  );
}
