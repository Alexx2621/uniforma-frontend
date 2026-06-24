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
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import PrintOutlined from "@mui/icons-material/PrintOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import Swal from "sweetalert2";
import { useLocation } from "react-router-dom";
import { api } from "../api/axios";
import { hasPermission } from "../auth/permissions";
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

interface IngresoRegistro {
  id: number;
  folio?: string | null;
  fecha: string;
  bodegaId: number;
  observaciones?: string | null;
  responsable?: string | null;
  bodega?: Bodega | null;
  detalle?: Array<{
    id: number;
    productoId: number;
    cantidad: number;
    producto?: Producto | null;
  }>;
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

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(`${reader.result || ""}`);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const createIngresoRequestId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const INGRESO_BORRADOR_TIPO = "ingreso-inventario";
const INGRESO_BORRADOR_LOCAL_KEY = "ingreso-inventario:borrador-local:v1";

export default function IngresoInventario() {
  const today = useMemo(() => toInputDate(new Date()), []);
  const [vista, setVista] = useState<"listado" | "nuevo">("listado");
  const [ingresos, setIngresos] = useState<IngresoRegistro[]>([]);
  const [loadingIngresos, setLoadingIngresos] = useState(false);
  const [filtroDesde, setFiltroDesde] = useState(today);
  const [filtroHasta, setFiltroHasta] = useState(today);
  const [filtroBodega, setFiltroBodega] = useState<number | "">("");
  const [filtroResponsable, setFiltroResponsable] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [ingresoSeleccionado, setIngresoSeleccionado] = useState<IngresoRegistro | null>(null);
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
  const [guardandoIngreso, setGuardandoIngreso] = useState(false);
  const [importandoIngreso, setImportandoIngreso] = useState(false);
  const [ingresoRequestId, setIngresoRequestId] = useState(() => createIngresoRequestId());
  const [documentoBorradorId, setDocumentoBorradorId] = useState<number | null>(null);
  const [borradorGuardadoEn, setBorradorGuardadoEn] = useState("");
  const [borradorEstado, setBorradorEstado] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const guardandoIngresoRef = useRef(false);
  const importandoIngresoRef = useRef(false);
  const borradorInicializadoRef = useRef(false);
  const restaurandoBorradorRef = useRef(false);
  const autoguardadoBorradorBloqueadoRef = useRef(false);
  const ultimoBorradorJsonRef = useRef("");

  const location = useLocation();
  const returnState = location.state as { borradorId?: number } | null;
  const { usuario, rol, permisos, bodegaId: userBodegaId, id: userId } = useAuthStore();
  const { fetchConfig } = useSystemConfigStore();
  const canAccessAllBodegas = hasPermission(rol, permisos, "sistema.multi-tienda");

  const cargarIngresos = useCallback(async () => {
    try {
      setLoadingIngresos(true);
      const resp = await api.get("/ingresos", {
        params: {
          desde: filtroDesde || undefined,
          hasta: filtroHasta || undefined,
          bodegaId: filtroBodega || undefined,
          responsable: filtroResponsable.trim() || undefined,
        },
      });
      setIngresos(Array.isArray(resp.data) ? resp.data : []);
      setPage(0);
    } catch {
      Swal.fire("Error", "No se pudieron cargar los ingresos de inventario", "error");
    } finally {
      setLoadingIngresos(false);
    }
  }, [filtroDesde, filtroHasta, filtroBodega, filtroResponsable]);

  const cargarCatalogos = async () => {
    try {
      const [respBod, respProd, respTelas, respTallas, respColores] = await Promise.all([
        api.get("/bodegas", { params: { operacion: "ajustes" } }),
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
    void cargarIngresos();
  }, [cargarIngresos]);

  useEffect(() => {
    if (userBodegaId && !canAccessAllBodegas && !bodegaId) {
      const parsed = Number(userBodegaId);
      const exists = bodegas.some((b) => b.id === parsed);
      setBodegaId(exists ? parsed : "");
      setFiltroBodega((prev) => prev || (exists ? parsed : ""));
    }
  }, [userBodegaId, canAccessAllBodegas, bodegas, bodegaId]);

  const limpiarFormularioIngreso = useCallback(() => {
    setBodegaId(userBodegaId && !canAccessAllBodegas ? Number(userBodegaId) || "" : "");
    setObservaciones("");
    setDetalle([]);
    setArticuloActual(detalleInicial);
    setCantidadInput("1");
    setEditingDetalleKey(null);
    setFiltroTipo("");
    setFiltroGenero("");
    setFiltroTela("");
    setFiltroTalla("");
    setFiltroColor("");
    setIngresoRequestId(createIngresoRequestId());
  }, [canAccessAllBodegas, userBodegaId]);

  const restaurarBorradorIngreso = useCallback((data: any) => {
    restaurandoBorradorRef.current = true;
    const encabezado = data?.encabezado || {};
    const captura = data?.capturaArticulo || {};
    setBodegaId(encabezado.bodegaId ? Number(encabezado.bodegaId) : "");
    setObservaciones(`${encabezado.observaciones || ""}`);
    setIngresoRequestId(`${data?.requestId || createIngresoRequestId()}`);
    setDetalle(
      (Array.isArray(data?.detalle) ? data.detalle : []).map((item: any, index: number) => ({
        ...item,
        key: Number(item?.key || 0) || Date.now() + index,
        productoId: Number(item?.productoId || 0),
        cantidad: Number(item?.cantidad || 0),
        stockMax: item?.stockMax ?? null,
        stockActual: item?.stockActual ?? null,
      })),
    );
    setArticuloActual({
      ...detalleInicial,
      ...captura,
      productoId: captura?.productoId ? Number(captura.productoId) : "",
      cantidad: Number(captura?.cantidad || 1),
      stockMax: captura?.stockMax ?? null,
      stockActual: captura?.stockActual ?? null,
    });
    setCantidadInput(`${captura?.cantidad || data?.cantidadInput || "1"}`);
    setFiltroTipo(data?.filtros?.tipo || "");
    setFiltroGenero(data?.filtros?.genero || "");
    setFiltroTela(data?.filtros?.tela || "");
    setFiltroTalla(data?.filtros?.talla || "");
    setFiltroColor(data?.filtros?.color || "");
    setVista("nuevo");
    setTimeout(() => {
      restaurandoBorradorRef.current = false;
    }, 0);
  }, []);

  const finalizarBorradorActual = useCallback(async (documentoFinal?: { tipo?: string; id?: number | null; folio?: string | null }) => {
    autoguardadoBorradorBloqueadoRef.current = true;
    const id = documentoBorradorId;
    setDocumentoBorradorId(null);
    setBorradorGuardadoEn("");
    setBorradorEstado("idle");
    ultimoBorradorJsonRef.current = "";
    localStorage.removeItem(INGRESO_BORRADOR_LOCAL_KEY);
    if (!id) return;
    try {
      await api.post(`/documentos-borradores/${id}/finalizar`, {
        documentoFinalTipo: documentoFinal?.tipo || "ingreso-inventario",
        documentoFinalId: documentoFinal?.id || null,
        documentoFinalFolio: documentoFinal?.folio || null,
      });
    } catch {
      // El ingreso ya fue creado; el cierre del preliminar no debe bloquear el flujo.
    }
  }, [documentoBorradorId]);

  const descartarBorradorActual = useCallback(async () => {
    if (!documentoBorradorId) return;
    const result = await Swal.fire({
      title: "Descartar preliminar",
      text: "Se eliminara el ingreso preliminar y se limpiara esta pantalla.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Descartar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d32f2f",
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/documentos-borradores/${documentoBorradorId}`);
    } catch {
      // Si ya no existe, limpiamos localmente.
    }
    setDocumentoBorradorId(null);
    setBorradorGuardadoEn("");
    setBorradorEstado("idle");
    ultimoBorradorJsonRef.current = "";
    localStorage.removeItem(INGRESO_BORRADOR_LOCAL_KEY);
    limpiarFormularioIngreso();
    autoguardadoBorradorBloqueadoRef.current = false;
  }, [documentoBorradorId, limpiarFormularioIngreso]);

  useEffect(() => {
    let cancelled = false;
    const cargarBorrador = async () => {
      try {
        const { data } = returnState?.borradorId
          ? await api.get(`/documentos-borradores/${returnState.borradorId}`)
          : await api.get("/documentos-borradores/activo", { params: { tipoDocumento: INGRESO_BORRADOR_TIPO } });
        if (cancelled) return;
        if (!data?.id) {
          const localRaw = localStorage.getItem(INGRESO_BORRADOR_LOCAL_KEY);
          const localData = localRaw ? JSON.parse(localRaw) : null;
          if (localData?.data) {
            const result = await Swal.fire({
              title: "Respaldo local encontrado",
              text: "Hay un ingreso preliminar guardado en este navegador que aun no estaba en servidor.",
              icon: "info",
              showDenyButton: true,
              showCancelButton: true,
              confirmButtonText: "Recuperar",
              denyButtonText: "Descartar",
              cancelButtonText: "Ahora no",
              confirmButtonColor: "#1f3f87",
            });
            if (result.isConfirmed) {
              restaurarBorradorIngreso(localData.data);
              ultimoBorradorJsonRef.current = JSON.stringify(localData.data);
            } else if (result.isDenied) {
              localStorage.removeItem(INGRESO_BORRADOR_LOCAL_KEY);
            }
          }
          borradorInicializadoRef.current = true;
          return;
        }
        const result = await Swal.fire({
          title: "Ingreso preliminar encontrado",
          text: "Tienes un ingreso de inventario que no fue finalizado. Puedes continuarlo o descartarlo.",
          icon: "info",
          showDenyButton: true,
          showCancelButton: true,
          confirmButtonText: "Continuar",
          denyButtonText: "Descartar",
          cancelButtonText: "Ahora no",
          confirmButtonColor: "#1f3f87",
        });
        if (cancelled) return;
        if (result.isConfirmed) {
          autoguardadoBorradorBloqueadoRef.current = false;
          setDocumentoBorradorId(Number(data.id));
          setBorradorGuardadoEn(data.actualizadoEn || "");
          restaurarBorradorIngreso(data.data || {});
          ultimoBorradorJsonRef.current = JSON.stringify(data.data || {});
        } else if (result.isDenied) {
          await api.delete(`/documentos-borradores/${data.id}`).catch(() => undefined);
          localStorage.removeItem(INGRESO_BORRADOR_LOCAL_KEY);
        }
      } catch {
        try {
          const localRaw = localStorage.getItem(INGRESO_BORRADOR_LOCAL_KEY);
          const localData = localRaw ? JSON.parse(localRaw) : null;
          if (!cancelled && localData?.data) {
            const result = await Swal.fire({
              title: "Respaldo local encontrado",
              text: "No se pudo consultar el preliminar del servidor, pero hay una copia local en este navegador.",
              icon: "info",
              showDenyButton: true,
              showCancelButton: true,
              confirmButtonText: "Recuperar",
              denyButtonText: "Descartar",
              cancelButtonText: "Ahora no",
              confirmButtonColor: "#1f3f87",
            });
            if (result.isConfirmed) {
              restaurarBorradorIngreso(localData.data);
              ultimoBorradorJsonRef.current = JSON.stringify(localData.data);
            } else if (result.isDenied) {
              localStorage.removeItem(INGRESO_BORRADOR_LOCAL_KEY);
            }
          }
        } catch {
          // Sin respaldo local legible.
        }
      } finally {
        if (!cancelled) borradorInicializadoRef.current = true;
      }
    };
    void cargarBorrador();
    return () => {
      cancelled = true;
    };
  }, [restaurarBorradorIngreso, returnState?.borradorId]);

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
    const folio = ingreso?.folio || (ingreso?.id ? `ING-${ingreso.id}` : "Pendiente");
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

  const abrirPdfIngresoRegistro = (ingreso: IngresoRegistro) => {
    const nuevaVentana = window.open("", "_blank");
    if (!nuevaVentana) {
      Swal.fire("Aviso", "Habilita las ventanas emergentes para ver el PDF", "info");
      return;
    }

    const detalleRegistro = Array.isArray(ingreso.detalle) ? ingreso.detalle : [];
    const html = buildIngresoInventarioPdfHtml({
      folio: ingreso.folio || `ING-${ingreso.id}`,
      fecha: ingreso.fecha ? new Date(ingreso.fecha) : new Date(),
      bodega: ingreso.bodega?.nombre || bodegas.find((b) => b.id === Number(ingreso.bodegaId))?.nombre || "N/D",
      responsable: ingreso.responsable || "Responsable",
      observaciones: ingreso.observaciones || "",
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

  useEffect(() => {
    if (!userId || !borradorInicializadoRef.current || restaurandoBorradorRef.current || autoguardadoBorradorBloqueadoRef.current) {
      return;
    }

    const hasContenido =
      detalle.length > 0 ||
      Boolean(articuloActual.productoId) ||
      Boolean(observaciones.trim()) ||
      Boolean(filtroTipo || filtroGenero || filtroTela || filtroTalla || filtroColor);

    if (!hasContenido) return;

    const data = {
      version: 1,
      requestId: ingresoRequestId,
      encabezado: {
        bodegaId: bodegaId === "" ? null : Number(bodegaId),
        observaciones,
        responsable: usuario || null,
      },
      detalle,
      capturaArticulo: articuloActual,
      cantidadInput,
      filtros: {
        tipo: filtroTipo,
        genero: filtroGenero,
        tela: filtroTela,
        talla: filtroTalla,
        color: filtroColor,
      },
    };

    const serialized = JSON.stringify(data);
    if (serialized === ultimoBorradorJsonRef.current) return;

    try {
      localStorage.setItem(
        INGRESO_BORRADOR_LOCAL_KEY,
        JSON.stringify({ tipoDocumento: INGRESO_BORRADOR_TIPO, actualizadoEn: new Date().toISOString(), data }),
      );
    } catch {
      // El respaldo local es secundario; seguimos con backend.
    }

    const timer = window.setTimeout(async () => {
      try {
        if (autoguardadoBorradorBloqueadoRef.current) return;
        setBorradorEstado("saving");
        const { data: saved } = await api.post("/documentos-borradores/autoguardar", {
          id: documentoBorradorId,
          tipoDocumento: INGRESO_BORRADOR_TIPO,
          titulo: bodegaId
            ? `Ingreso preliminar ${bodegas.find((b) => b.id === Number(bodegaId))?.nombre || ""}`.trim()
            : "Ingreso preliminar",
          bodegaId: bodegaId === "" ? null : Number(bodegaId),
          totalEstimado: totalItems,
          data,
        });
        ultimoBorradorJsonRef.current = serialized;
        setDocumentoBorradorId(Number(saved?.id || documentoBorradorId || 0) || null);
        setBorradorGuardadoEn(saved?.actualizadoEn || new Date().toISOString());
        setBorradorEstado("saved");
      } catch {
        setBorradorEstado("error");
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    articuloActual,
    bodegaId,
    bodegas,
    cantidadInput,
    detalle,
    documentoBorradorId,
    filtroColor,
    filtroGenero,
    filtroTalla,
    filtroTela,
    filtroTipo,
    ingresoRequestId,
    observaciones,
    totalItems,
    userId,
    usuario,
  ]);

  const guardar = async () => {
    if (guardandoIngresoRef.current) return;
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
      requestId: ingresoRequestId,
      bodegaId: Number(bodegaId),
      observaciones: observaciones || null,
      responsable: usuario || null,
      detalle: detalle.map((d) => ({
        productoId: d.productoId,
        cantidad: d.cantidad,
      })),
    };

    try {
      guardandoIngresoRef.current = true;
      setGuardandoIngreso(true);
      const resp = await api.post("/ingresos", payload);
      await finalizarBorradorActual({
        tipo: "ingreso-inventario",
        id: resp.data?.id || null,
        folio: resp.data?.folio || null,
      });
      Swal.fire("Guardado", "Ingreso registrado", "success");
      abrirPdfIngreso(resp.data, detalle);
      setObservaciones("");
      setDetalle([]);
      setIngresoRequestId(createIngresoRequestId());
      limpiarArticulo();
      await cargarIngresos();
      setVista("listado");
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo guardar";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    } finally {
      guardandoIngresoRef.current = false;
      setGuardandoIngreso(false);
    }
  };

  const importarMasivo = async () => {
    if (importandoIngresoRef.current) return;
    importandoIngresoRef.current = true;
    setImportandoIngreso(true);
    const bodegaOptions = bodegas
      .map((bodega) => `<option value="${bodega.id}">${bodega.nombre}</option>`)
      .join("");
    const resp = await Swal.fire({
      title: "Importacion masiva con vista previa",
      width: 780,
      html: `
        <div style="text-align:left;display:grid;gap:12px">
          <label>Bodega</label>
          <select id="import-bodega" class="swal2-input" style="width:100%;margin:0">${bodegaOptions}</select>
          <label>Archivo Excel</label>
          <input id="import-file" type="file" accept=".xlsx,.xls" class="swal2-file" style="width:100%;margin:0" />
          <label>O pega codigos y cantidades</label>
          <textarea id="import-data" class="swal2-textarea" style="width:100%;height:180px;margin:0" placeholder="CODIGO,CANTIDAD&#10;FDSSVMU,5&#10;PDSXVMU,2"></textarea>
          <small>
            Formatos aceptados: 1) codigo en columna A y cantidad en columna B. 2) matriz con TELA, GENERO y TIPO arriba,
            colores en columnas, tallas en filas y cantidades en las celdas.
          </small>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Validar",
      preConfirm: async () => {
        const bodega = Number((document.getElementById("import-bodega") as HTMLSelectElement)?.value || 0);
        const raw = (document.getElementById("import-data") as HTMLTextAreaElement)?.value || "";
        const file = ((document.getElementById("import-file") as HTMLInputElement)?.files || [])[0];
        if (!bodega || (!raw.trim() && !file)) {
          Swal.showValidationMessage("Selecciona bodega y carga un Excel o pega datos");
          return false;
        }
        const fileBase64 = file ? await fileToBase64(file) : "";
        return { bodegaId: bodega, raw, fileBase64, fileName: file?.name || "" };
      },
    });
    if (!resp.isConfirmed || !resp.value) {
      importandoIngresoRef.current = false;
      setImportandoIngreso(false);
      return;
    }
    try {
      const previewResp = await api.post("/ingresos/importar/preview", resp.value);
      const preview = previewResp.data || {};
      const rows = Array.isArray(preview.rows) ? preview.rows : [];
      const tableRows = rows
        .slice(0, 80)
        .map((row: any) => {
          const errores = row.errores?.length ? row.errores.join(", ") : row.advertencias?.join(", ") || "OK";
          const color = row.errores?.length ? "#b91c1c" : row.advertencias?.length ? "#92400e" : "#166534";
          const colorDetalle =
            row.colorInternoDetectado && row.colorInternoDetectado !== row.colorDetectado
              ? `${row.colorDetectado} -> ${row.colorInternoDetectado}`
              : row.colorDetectado;
          return `<tr>
            <td>${row.linea}</td>
            <td>${row.codigo}</td>
            <td>${row.cantidad}</td>
            <td>${row.producto?.nombre || row.tipoDetectado || "-"}</td>
            <td>${[row.telaDetectada, row.tallaDetectada, colorDetalle].filter(Boolean).join(" / ") || "-"}</td>
            <td style="color:${color};font-weight:600">${errores}</td>
          </tr>`;
        })
        .join("");
      const confirmar = await Swal.fire({
        title: "Vista previa de importacion",
        width: 980,
        html: `
          <div style="display:flex;gap:16px;margin-bottom:12px;text-align:left">
            <div><b>Filas:</b> ${preview.totalFilas || 0}</div>
            <div><b>Validas:</b> ${preview.filasValidas || 0}</div>
            <div><b>Errores:</b> ${preview.filasInvalidas || 0}</div>
            <div><b>Unidades:</b> ${preview.totalUnidades || 0}</div>
          </div>
          <div style="max-height:390px;overflow:auto">
            <table style="width:100%;border-collapse:collapse;text-align:left;font-size:12px">
              <thead><tr><th>Linea</th><th>Codigo</th><th>Cantidad</th><th>Producto</th><th>Detalle</th><th>Estado</th></tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        `,
        icon: preview.filasInvalidas ? "warning" : "question",
        showCancelButton: true,
        confirmButtonText: preview.filasInvalidas ? "Corregir archivo" : "Aplicar ingreso",
        cancelButtonText: "Cancelar",
        showConfirmButton: !preview.filasInvalidas,
      });
      if (!confirmar.isConfirmed) return;

      const result = await api.post("/ingresos/importar", {
        requestId: createIngresoRequestId(),
        bodegaId: preview.bodegaId,
        items: preview.items || [],
        responsable: usuario || null,
        observaciones: "Importacion masiva de inventario",
      });
      Swal.fire("Importado", "Ingreso masivo registrado correctamente", "success");
      abrirPdfIngresoRegistro(result.data);
      await cargarIngresos();
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo importar el ingreso", "error");
    } finally {
      importandoIngresoRef.current = false;
      setImportandoIngreso(false);
    }
  };

  const ingresosPaginados = ingresos.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const totalItemsSeleccionado =
    ingresoSeleccionado?.detalle?.reduce((sum, item) => sum + Number(item.cantidad || 0), 0) || 0;

  if (vista === "listado") {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1} sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Inventory2Outlined color="primary" />
            <Typography variant="h4">Ingresos de inventario</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={importarMasivo} disabled={importandoIngreso}>
              {importandoIngreso ? "Procesando..." : "Importar masivo"}
            </Button>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={() => {
                autoguardadoBorradorBloqueadoRef.current = false;
                limpiarFormularioIngreso();
                setVista("nuevo");
              }}
            >
              Nuevo ingreso
            </Button>
          </Stack>
        </Stack>

        <Divider sx={{ mb: 2 }} />

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Desde"
                type="date"
                fullWidth
                value={filtroDesde}
                onChange={(e) => setFiltroDesde(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Hasta"
                type="date"
                fullWidth
                value={filtroHasta}
                onChange={(e) => setFiltroHasta(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Bodega</InputLabel>
                <Select
                  label="Bodega"
                  value={filtroBodega}
                  onChange={(e) => {
                    const value = e.target.value as number | "";
                    setFiltroBodega(value === "" ? "" : Number(value));
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
              <TextField
                label="Responsable"
                fullWidth
                value={filtroResponsable}
                onChange={(e) => setFiltroResponsable(e.target.value)}
              />
            </Grid>
          </Grid>
        </Paper>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Registro</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Bodega</TableCell>
                <TableCell>Responsable</TableCell>
                <TableCell align="center">Lineas</TableCell>
                <TableCell align="center">Items</TableCell>
                <TableCell>Observaciones</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingIngresos ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    Cargando ingresos...
                  </TableCell>
                </TableRow>
              ) : ingresosPaginados.length ? (
                ingresosPaginados.map((ingreso) => {
                  const lineas = ingreso.detalle?.length || 0;
                  const items = ingreso.detalle?.reduce((sum, item) => sum + Number(item.cantidad || 0), 0) || 0;
                  return (
                    <TableRow key={ingreso.id} hover>
                      <TableCell>
                        <Chip size="small" color="primary" variant="outlined" label={ingreso.folio || `ING-${ingreso.id}`} />
                      </TableCell>
                      <TableCell>{formatDateTime(ingreso.fecha)}</TableCell>
                      <TableCell>{ingreso.bodega?.nombre || bodegas.find((b) => b.id === ingreso.bodegaId)?.nombre || "N/D"}</TableCell>
                      <TableCell>{ingreso.responsable || "N/D"}</TableCell>
                      <TableCell align="center">{lineas}</TableCell>
                      <TableCell align="center">{items}</TableCell>
                      <TableCell>{ingreso.observaciones || "-"}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<VisibilityOutlined />}
                            onClick={() => setIngresoSeleccionado(ingreso)}
                          >
                            Ver
                          </Button>
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<PrintOutlined />}
                            onClick={() => abrirPdfIngresoRegistro(ingreso)}
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
                  <TableCell colSpan={8} align="center">
                    No hay ingresos registrados con los filtros seleccionados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={ingresos.length}
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

        <Dialog open={Boolean(ingresoSeleccionado)} onClose={() => setIngresoSeleccionado(null)} fullWidth maxWidth="lg">
          <DialogTitle>{ingresoSeleccionado ? `Ingreso ${ingresoSeleccionado.folio || `ING-${ingresoSeleccionado.id}`}` : "Ingreso"}</DialogTitle>
          <DialogContent dividers>
            {ingresoSeleccionado && (
              <Stack spacing={2}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Fecha</Typography>
                    <Typography>{formatDateTime(ingresoSeleccionado.fecha)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Bodega</Typography>
                    <Typography>{ingresoSeleccionado.bodega?.nombre || "N/D"}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Responsable</Typography>
                    <Typography>{ingresoSeleccionado.responsable || "N/D"}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Total items</Typography>
                    <Typography>{totalItemsSeleccionado}</Typography>
                  </Grid>
                </Grid>
                <Typography variant="body2" color="text.secondary">
                  {ingresoSeleccionado.observaciones || "Sin observaciones"}
                </Typography>
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
                      {(ingresoSeleccionado.detalle || []).map((item) => {
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
            {ingresoSeleccionado && (
              <Button startIcon={<PrintOutlined />} onClick={() => abrirPdfIngresoRegistro(ingresoSeleccionado)}>
                Reimprimir PDF
              </Button>
            )}
            <Button onClick={() => setIngresoSeleccionado(null)}>Cerrar</Button>
          </DialogActions>
        </Dialog>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1} sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Inventory2Outlined color="primary" />
          <Typography variant="h4">Ingreso de inventario</Typography>
        </Stack>
        <Button startIcon={<ArrowBackOutlined />} variant="outlined" onClick={() => setVista("listado")}>
          Regresar
        </Button>
      </Stack>
      <Divider sx={{ mb: 2 }} />

      {(documentoBorradorId || borradorEstado === "error") && (
        <Alert
          severity={borradorEstado === "error" ? "warning" : "info"}
          sx={{ mb: 2 }}
          action={
            documentoBorradorId ? (
              <Button color="inherit" size="small" onClick={descartarBorradorActual}>
                Descartar
              </Button>
            ) : undefined
          }
        >
          {borradorEstado === "saving"
            ? `Guardando ingreso preliminar PRE-${String(documentoBorradorId).padStart(6, "0")}...`
            : borradorEstado === "error"
              ? "No se pudo autoguardar el ingreso preliminar en servidor. Se mantiene una copia local en este navegador."
              : `Ingreso preliminar PRE-${String(documentoBorradorId).padStart(6, "0")} guardado${
                  borradorGuardadoEn
                    ? ` (${new Date(borradorGuardadoEn).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })})`
                    : ""
                }.`}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel>Bodega</InputLabel>
            <Select
              label="Bodega"
              value={bodegaId === "" ? "" : bodegaId}
              onChange={(e) => void onBodegaChange(Number(e.target.value))}
              disabled={bodegas.length <= 1}
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
        <Button variant="contained" color="success" onClick={guardar} disabled={guardandoIngreso}>
          {guardandoIngreso ? "Guardando..." : "Guardar ingreso"}
        </Button>
      </Stack>
    </Paper>
  );
}
