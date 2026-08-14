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
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  TextField,
  Button,
  Stack,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Chip,
  createFilterOptions,
  Collapse,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditOutlined from "@mui/icons-material/EditOutlined";
import PaymentIcon from "@mui/icons-material/Payment";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import TuneOutlined from "@mui/icons-material/TuneOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import Autocomplete from "@mui/material/Autocomplete";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../auth/useAuthStore";
import LOGO_URL from "../assets/3-logos.png";
import { buildVentaPdfHtml } from "../utils/ventaPdf";
import { formatCurrency } from "../utils/currency";
import { emptyWhenZero, parseNumberInput } from "../utils/numberInputs";
import { createProductSearchEntry, filterIndexedProducts } from "../utils/productSearch";

interface Cliente {
  id: number;
  nombre: string;
  telefono?: string | null;
  usuarioId?: number | null;
  usuario?: { id?: number; nombre?: string | null; usuario?: string | null } | null;
}

const CLIENTE_CF_ID = -1;
const CLIENTE_CF_OPTION: Cliente = {
  id: CLIENTE_CF_ID,
  nombre: "CF",
};
const VENTA_BORRADOR_TIPO = "venta";
const VENTA_BORRADOR_LOCAL_KEY = "venta:borrador-local:v1";

const formatClienteOption = (cliente: Cliente) => {
  const telefono = `${cliente.telefono || ""}`.trim();
  return telefono ? `${telefono} - ${cliente.nombre}` : cliente.nombre;
};

const filterClienteOptions = createFilterOptions<Cliente>({
  stringify: (cliente) => `${cliente.nombre || ""} ${cliente.telefono || ""}`,
});

type ClienteVenta = {
  id?: number | null;
  nombre: string;
  telefono?: string | null;
};

const normalizeTelefono = (value?: string | null) => `${value || ""}`.replace(/\D/g, "");

const escapeInputValue = (value?: string | null) =>
  `${value || ""}`
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  precio: number;
  tipo?: string;
  genero?: string;
  tela?: { id?: number; nombre?: string } | null;
  talla?: { id?: number; nombre?: string } | null;
  color?: { id?: number; nombre?: string } | null;
  telaId?: number | null;
  tallaId?: number | null;
  colorId?: number | null;
  tela_id?: number | null;
  talla_id?: number | null;
  color_id?: number | null;
  stockMax?: number | null;
  mermaPorcentaje?: number | null;
  categoria?: { id?: number; nombre?: string | null } | null;
}

interface Bodega {
  id: number;
  nombre: string;
  ubicacion?: string | null;
  tipo?: string | null;
  usaInventarioVentas?: boolean;
}

interface BordadoArticulo {
  key: number;
  monto: number;
  color: string;
  tamano: string;
  posicion: string;
  observaciones: string;
  imagenUrl: string;
}

interface DetalleRow {
  key: number;
  productoId: number;
  bodegaId: number;
  bodegaNombre: string;
  controlaInventario: boolean;
  requiereTraslado: boolean;
  cantidad: number;
  precio: number;
  bordado: number;
  bordadoActivo: boolean;
  bordados: BordadoArticulo[];
  bordadoColor: string;
  bordadoTamano: string;
  bordadoPosicion: string;
  bordadoObservaciones: string;
  bordadoImagenUrl: string;
  estiloEspecial: boolean;
  estiloEspecialMonto: number;
  descuento: number;
  descripcion: string;
  stock: number | null;
}

interface CapturaArticulo {
  productoId: number | "";
  bodegaId: number | "";
  cantidad: number;
  precio: number;
  bordado: number;
  bordadoActivo: boolean;
  bordados: BordadoArticulo[];
  bordadoColor: string;
  bordadoTamano: string;
  bordadoPosicion: string;
  bordadoObservaciones: string;
  bordadoImagenUrl: string;
  estiloEspecial: boolean;
  estiloEspecialMonto: number;
  descuento: number;
  descripcion: string;
  stock: number | null;
}

const detalleInicial: CapturaArticulo = {
  productoId: "",
  bodegaId: "",
  cantidad: 1,
  precio: 0,
  bordado: 0,
  bordadoActivo: false,
  bordados: [],
  bordadoColor: "FULL COLOR",
  bordadoTamano: "NORMAL",
  bordadoPosicion: "PECHO IZQUIERDO",
  bordadoObservaciones: "",
  bordadoImagenUrl: "",
  estiloEspecial: false,
  estiloEspecialMonto: 25,
  descuento: 0,
  descripcion: "",
  stock: null,
};

const calcularImportesDetalleVenta = (row: Pick<DetalleRow, "cantidad" | "precio" | "bordado" | "estiloEspecial" | "estiloEspecialMonto" | "descuento">) => {
  const cantidad = Number(row.cantidad) || 0;
  const precio = Number(row.precio) || 0;
  const estilo = row.estiloEspecial ? Number(row.estiloEspecialMonto) || 0 : 0;
  const bordado = Number(row.bordado) || 0;
  const descuentoFactor = 1 - (Number(row.descuento) || 0) / 100;
  const precioNeto = cantidad * precio * descuentoFactor;
  const estiloNeto = cantidad * estilo * descuentoFactor;
  const bordadoTotal = cantidad * bordado;
  return {
    precio: precioNeto,
    estiloEspecial: estiloNeto,
    bordado: bordadoTotal,
    subtotal: precioNeto + estiloNeto + bordadoTotal,
  };
};

const resolveTelaNombre = (prod: Producto | undefined, telas: any[]) => {
  if (!prod) return "N/D";
  const telaId =
    prod.telaId ?? prod.tela_id ?? prod.tela?.id ?? (prod as any).telaid ?? (prod as any).tela_id ?? null;
  return (
    prod.tela?.nombre ||
    (prod as any).telaNombre ||
    telas.find((t) => Number(t.id) === Number(telaId))?.nombre ||
    "N/D"
  );
};

const resolveTallaNombre = (prod: Producto | undefined, tallas: any[]) => {
  if (!prod) return "N/D";
  const tallaId =
    prod.tallaId ?? prod.talla_id ?? prod.talla?.id ?? (prod as any).tallaid ?? (prod as any).talla_id ?? null;
  return (
    prod.talla?.nombre ||
    (prod as any).tallaNombre ||
    tallas.find((t) => Number(t.id) === Number(tallaId))?.nombre ||
    "N/D"
  );
};

const resolveColorNombre = (prod: Producto | undefined, colores: any[]) => {
  if (!prod) return "N/D";
  const colorId =
    prod.colorId ?? prod.color_id ?? prod.color?.id ?? (prod as any).colorid ?? (prod as any).color_id ?? null;
  return (
    prod.color?.nombre ||
    (prod as any).colorNombre ||
    colores.find((c) => Number(c.id) === Number(colorId))?.nombre ||
    "N/D"
  );
};

const uniqueSorted = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

const upperText = (value: unknown, fallback = "N/D") =>
  `${value ?? ""}`.trim().toLocaleUpperCase("es-GT") || fallback;

const normalizeSearch = (value: unknown) =>
  upperText(value, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const bordadoTextFieldSx = {
  "& .MuiOutlinedInput-root": {
    "& fieldset": { borderColor: "success.main" },
    "&:hover fieldset": { borderColor: "success.dark" },
    "&.Mui-focused fieldset": { borderColor: "success.main" },
  },
};

const getBordadoKey = () => Date.now() + Math.floor(Math.random() * 1000);

const buildBordadoDesdeArticulo = (articulo: CapturaArticulo): BordadoArticulo | null => {
  if (!articulo.bordadoActivo) return null;
  const monto = Number(articulo.bordado) || 0;
  const observaciones = `${articulo.bordadoObservaciones || ""}`.trim();
  const imagenUrl = articulo.bordadoImagenUrl || "";
  const tieneContenidoReal = monto > 0 || Boolean(observaciones) || Boolean(imagenUrl);
  if (!tieneContenidoReal) return null;

  return {
    key: getBordadoKey(),
    monto,
    color: `${articulo.bordadoColor || "FULL COLOR"}`.trim(),
    tamano: `${articulo.bordadoTamano || "NORMAL"}`.trim(),
    posicion: `${articulo.bordadoPosicion || "PECHO IZQUIERDO"}`.trim(),
    observaciones,
    imagenUrl,
  };
};

const getBordadoTotal = (bordados: BordadoArticulo[]) =>
  bordados.reduce((sum, bordado) => sum + Number(bordado.monto || 0), 0);

const bordadosIguales = (a: BordadoArticulo, b: BordadoArticulo) =>
  Number(a.monto || 0) === Number(b.monto || 0) &&
  `${a.color || ""}`.trim().toUpperCase() === `${b.color || ""}`.trim().toUpperCase() &&
  `${a.tamano || ""}`.trim().toUpperCase() === `${b.tamano || ""}`.trim().toUpperCase() &&
  `${a.posicion || ""}`.trim().toUpperCase() === `${b.posicion || ""}`.trim().toUpperCase() &&
  `${a.observaciones || ""}`.trim().toUpperCase() === `${b.observaciones || ""}`.trim().toUpperCase() &&
  `${a.imagenUrl || ""}` === `${b.imagenUrl || ""}`;

const agregarBordadoSiNoExiste = (bordados: BordadoArticulo[], bordado: BordadoArticulo | null) =>
  bordado && !bordados.some((item) => bordadosIguales(item, bordado)) ? [...bordados, bordado] : bordados;

const buildBordadoObservacionPrefix = (bordados: Array<Pick<BordadoArticulo, "posicion">>) => {
  const posiciones = Array.from(
    new Set(
      (bordados || [])
        .map((bordado) => `${bordado.posicion || ""}`.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
  return posiciones.length ? `BORDADO ${posiciones.join(" / ")}.` : "";
};

const formatDetalleObservaciones = (descripcion: string, bordados: Array<Pick<BordadoArticulo, "posicion">>) => {
  const prefix = buildBordadoObservacionPrefix(bordados);
  const texto = `${descripcion || ""}`.trim();
  if (!prefix) return texto;
  const sinPrefixAnterior = texto.replace(/^BORDADO\b.*?\.\s*/i, "").trim();
  return [prefix, sinPrefixAnterior].filter(Boolean).join(" ");
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const original = `${reader.result || ""}`;
      const image = new Image();
      image.onload = () => {
        try {
          const maxSide = 1200;
          const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
          const width = Math.max(1, Math.round(image.width * ratio));
          const height = Math.max(1, Math.round(image.height * ratio));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(original);
            return;
          }
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        } catch {
          resolve(original);
        }
      };
      image.onerror = () => resolve(original);
      image.src = original;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export default function VentaNueva() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [telas, setTelas] = useState<any[]>([]);
  const [tallas, setTallas] = useState<any[]>([]);
  const [colores, setColores] = useState<any[]>([]);
  const [clienteId, setClienteId] = useState<number | "">(CLIENTE_CF_ID);
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [clienteNombre, setClienteNombre] = useState("CF");
  const [autorizacionClienteId, setAutorizacionClienteId] = useState<number | null>(null);
  const [bodegaId, setBodegaId] = useState<number | "">("");
  const [metodoPago, setMetodoPago] = useState<string>("efectivo");
  const [ubicacion, setUbicacion] = useState<string>("TIENDA");
  const [porcentajeRecargo, setPorcentajeRecargo] = useState<number>(0);
  const [referenciaPago, setReferenciaPago] = useState("");
  const [bancoPago, setBancoPago] = useState("");
  const [envio, setEnvio] = useState<number>(0);
  const [detalle, setDetalle] = useState<DetalleRow[]>([]);
  const [articuloActual, setArticuloActual] = useState<CapturaArticulo>(detalleInicial);
  const [cantidadInput, setCantidadInput] = useState("1");
  const [editingDetalleKey, setEditingDetalleKey] = useState<number | null>(null);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [filtroGenero, setFiltroGenero] = useState("");
  const [filtroTela, setFiltroTela] = useState("");
  const [filtroTalla, setFiltroTalla] = useState("");
  const [filtroColor, setFiltroColor] = useState("");
  const [bordadosModalOpen, setBordadosModalOpen] = useState(false);
  const [bordadoPreviewOpen, setBordadoPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [documentoBorradorId, setDocumentoBorradorId] = useState<number | null>(null);
  const [borradorGuardadoEn, setBorradorGuardadoEn] = useState("");
  const [borradorEstado, setBorradorEstado] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const borradorInicializadoRef = useRef(false);
  const restaurandoBorradorRef = useRef(false);
  const autoguardadoBorradorBloqueadoRef = useRef(false);
  const ultimoBorradorJsonRef = useRef("");
  const savingRef = useRef(false);
  const complementoSugeridoProductoIdRef = useRef<number | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const returnState = location.state as { borradorId?: number } | null;
  const { usuario, rol, bodegaId: userBodegaId, bodegaNombre: authBodegaNombre, id: userId } = useAuthStore();
  const isAdmin = `${rol || ""}`.trim().toUpperCase() === "ADMIN";
  const parsedUserBodegaId = Number(userBodegaId || 0);
  const documentBodegaLocked = !isAdmin && Number.isFinite(parsedUserBodegaId) && parsedUserBodegaId > 0;
  const metodoUsaRecargo = metodoPago === "tarjeta" || metodoPago === "visalink";
  const metodoRequiereReferencia = metodoPago !== "efectivo";
  const metodoRequiereBanco = metodoPago === "deposito_bancario";
  const clientesConCf = useMemo(() => {
    const hasCf = clientes.some((cliente) => `${cliente.nombre || ""}`.trim().toUpperCase() === "CF");
    return hasCf ? clientes : [CLIENTE_CF_OPTION, ...clientes];
  }, [clientes]);
  const clienteSeleccionado = clientesConCf.find((c) => c.id === clienteId) || null;

  const normalizarUbicacion = (val?: string | null) => {
    if (!val) return "";
    const upper = val.toString().toUpperCase();
    if (["TIENDA", "CAPITAL", "DEPARTAMENTO"].includes(upper)) return upper;
    return upper;
  };

  const cargarCatalogos = async () => {
    try {
      const [respCli, respProd, respBod, respTelas, respTallas, respColores] = await Promise.all([
        api.get("/clientes/todos"),
        api.get("/productos"),
        api.get("/bodegas", { params: { operacion: "ventas" } }),
        api.get("/telas").catch(() => ({ data: [] })),
        api.get("/tallas").catch(() => ({ data: [] })),
        api.get("/colores").catch(() => ({ data: [] })),
      ]);
      setClientes(respCli.data || []);
      setProductos(respProd.data || []);
      setBodegas(respBod.data || []);
      setTelas(respTelas.data || []);
      setTallas(respTallas.data || []);
      setColores(respColores.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar catalogos", "error");
    }
  };

  useEffect(() => {
    void cargarCatalogos();
  }, []);

  const limpiarFormularioVenta = useCallback(() => {
    setClienteId(CLIENTE_CF_ID);
    setClienteTelefono("");
    setClienteNombre("CF");
    setBodegaId(documentBodegaLocked ? parsedUserBodegaId || "" : "");
    setMetodoPago("efectivo");
    setUbicacion("TIENDA");
    setPorcentajeRecargo(0);
    setReferenciaPago("");
    setBancoPago("");
    setEnvio(0);
    setDetalle([]);
    setArticuloActual(detalleInicial);
    setCantidadInput("1");
    setEditingDetalleKey(null);
    setFiltroTipo("");
    setFiltroGenero("");
    setFiltroTela("");
    setFiltroTalla("");
    setFiltroColor("");
  }, [documentBodegaLocked, parsedUserBodegaId]);

  const restaurarBorradorVenta = useCallback((data: any) => {
    restaurandoBorradorRef.current = true;
    const encabezado = data?.encabezado || {};
    const captura = data?.capturaArticulo || {};
    setClienteId(encabezado.clienteId ? Number(encabezado.clienteId) : CLIENTE_CF_ID);
    setClienteNombre(encabezado.clienteNombre || "CF");
    setClienteTelefono(`${encabezado.clienteTelefono || ""}`);
    setBodegaId(encabezado.bodegaId ? Number(encabezado.bodegaId) : "");
    setMetodoPago(encabezado.metodoPago || "efectivo");
    setUbicacion(encabezado.ubicacion || "TIENDA");
    setPorcentajeRecargo(Number(encabezado.porcentajeRecargo || 0));
    setReferenciaPago(`${encabezado.referenciaPago || ""}`);
    setBancoPago(`${encabezado.bancoPago || ""}`);
    setEnvio(Number(encabezado.envio || 0));
    setDetalle(
      (Array.isArray(data?.detalle) ? data.detalle : []).map((item: any, index: number) => ({
        ...item,
        key: Number(item?.key || 0) || Date.now() + index,
        productoId: Number(item?.productoId || 0),
        bodegaId: item?.bodegaId ? Number(item.bodegaId) : "",
        cantidad: Number(item?.cantidad || 0),
        precio: Number(item?.precio || 0),
        bordado: Number(item?.bordado || 0),
        estiloEspecialMonto: Number(item?.estiloEspecialMonto || 0),
        descuento: Number(item?.descuento || 0),
        bordados: Array.isArray(item?.bordados) ? item.bordados : [],
      })),
    );
    setArticuloActual({
      ...detalleInicial,
      ...captura,
      productoId: captura?.productoId ? Number(captura.productoId) : "",
      bodegaId: captura?.bodegaId ? Number(captura.bodegaId) : "",
      cantidad: Number(captura?.cantidad || 1),
      precio: Number(captura?.precio || 0),
      bordado: Number(captura?.bordado || 0),
      estiloEspecialMonto: Number(captura?.estiloEspecialMonto || 0),
      descuento: Number(captura?.descuento || 0),
      bordados: Array.isArray(captura?.bordados) ? captura.bordados : [],
    });
    setCantidadInput(`${captura?.cantidad || data?.cantidadInput || "1"}`);
    setFiltroTipo(data?.filtros?.tipo || "");
    setFiltroGenero(data?.filtros?.genero || "");
    setFiltroTela(data?.filtros?.tela || "");
    setFiltroTalla(data?.filtros?.talla || "");
    setFiltroColor(data?.filtros?.color || "");
    setTimeout(() => {
      restaurandoBorradorRef.current = false;
    }, 0);
  }, []);

  const finalizarBorradorActual = useCallback(async (documentoFinal?: { tipo?: string; id?: number | null; folio?: string | null }) => {
    autoguardadoBorradorBloqueadoRef.current = true;
    if (!documentoBorradorId) return;
    const id = documentoBorradorId;
    setDocumentoBorradorId(null);
    setBorradorGuardadoEn("");
    setBorradorEstado("idle");
    ultimoBorradorJsonRef.current = "";
    localStorage.removeItem(VENTA_BORRADOR_LOCAL_KEY);
    try {
      await api.post(`/documentos-borradores/${id}/finalizar`, {
        documentoFinalTipo: documentoFinal?.tipo || "venta",
        documentoFinalId: documentoFinal?.id || null,
        documentoFinalFolio: documentoFinal?.folio || null,
      });
    } catch {
      // La venta ya fue generada; no bloqueamos por limpieza de preliminar.
    }
  }, [documentoBorradorId]);

  const descartarBorradorActual = useCallback(async () => {
    if (!documentoBorradorId) return;
    const result = await Swal.fire({
      title: "Descartar preliminar",
      text: "Se eliminara la venta preliminar y se limpiara esta pantalla.",
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
    localStorage.removeItem(VENTA_BORRADOR_LOCAL_KEY);
    limpiarFormularioVenta();
    autoguardadoBorradorBloqueadoRef.current = false;
  }, [documentoBorradorId, limpiarFormularioVenta]);

  useEffect(() => {
    let cancelled = false;
    const cargarBorrador = async () => {
      try {
        const { data } = returnState?.borradorId
          ? await api.get(`/documentos-borradores/${returnState.borradorId}`)
          : await api.get("/documentos-borradores/activo", { params: { tipoDocumento: VENTA_BORRADOR_TIPO } });
        if (cancelled) return;
        if (!data?.id) {
          borradorInicializadoRef.current = true;
          return;
        }
        const result = await Swal.fire({
          title: "Venta preliminar encontrada",
          text: "Tienes una venta que no fue finalizada. Puedes continuarla o descartarla.",
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
          restaurarBorradorVenta(data.data || {});
          ultimoBorradorJsonRef.current = JSON.stringify(data.data || {});
        } else if (result.isDenied) {
          await api.delete(`/documentos-borradores/${data.id}`).catch(() => undefined);
          localStorage.removeItem(VENTA_BORRADOR_LOCAL_KEY);
        }
      } catch {
        try {
          const localRaw = localStorage.getItem(VENTA_BORRADOR_LOCAL_KEY);
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
              restaurarBorradorVenta(localData.data);
              ultimoBorradorJsonRef.current = JSON.stringify(localData.data);
            } else if (result.isDenied) {
              localStorage.removeItem(VENTA_BORRADOR_LOCAL_KEY);
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
  }, [restaurarBorradorVenta, returnState?.borradorId]);

  useEffect(() => {
    if (clienteId !== CLIENTE_CF_ID || clienteNombre !== "CF" || clienteTelefono) return;
    const cf = clientes.find((cliente) => `${cliente.nombre || ""}`.trim().toUpperCase() === "CF");
    if (cf) setClienteId(cf.id);
  }, [clientes, clienteId, clienteNombre, clienteTelefono]);

  const clientePerteneceCartera = (cliente: Cliente) =>
    cliente.id === CLIENTE_CF_ID || rol === "ADMIN" || Number(cliente.usuarioId || 0) === Number(userId || 0);

  const solicitarClienteFueraCartera = async (cliente: Cliente) => {
    try {
      const { data } = await api.post("/autorizaciones-clientes", { clienteId: cliente.id, motivo: `Autorizacion para una venta a ${cliente.nombre}` });
      if (data?.estado === "aprobado") {
        setAutorizacionClienteId(Number(data.id));
        setClienteId(cliente.id); setClienteNombre(cliente.nombre || "CF"); setClienteTelefono(`${cliente.telefono || ""}`.trim());
        await Swal.fire("Autorizado", "La autorizacion esta vigente y se consumira con esta venta.", "success");
        return true;
      }
      await Swal.fire("Solicitud enviada", `Se solicito autorizacion a ${cliente.usuario?.nombre || cliente.usuario?.usuario || "su vendedor"}. Intenta seleccionarlo nuevamente cuando sea aprobada.`, "info");
    } catch (error: any) { Swal.fire("Error", error?.response?.data?.message || "No se pudo solicitar autorizacion", "error"); }
    return false;
  };

  const sincronizarCliente = (cliente: Cliente) => {
    if (!clientePerteneceCartera(cliente)) {
      void solicitarClienteFueraCartera(cliente);
      return;
    }
    setAutorizacionClienteId(null);
    setClienteId(cliente.id);
    setClienteNombre(cliente.nombre || "CF");
    setClienteTelefono(`${cliente.telefono || ""}`.trim());
  };

  const buscarClientePorTelefono = (telefono: string) => {
    const normalizado = normalizeTelefono(telefono);
    if (!normalizado) return null;
    return clientes.find((cliente) => normalizeTelefono(cliente.telefono) === normalizado) || null;
  };

  const buscarClienteExistente = (nombre: string, telefono: string) => {
    const telefonoNormalizado = normalizeTelefono(telefono);
    const nombreNormalizado = nombre.trim().toLowerCase();
    return (
      (telefonoNormalizado
        ? clientes.find((cliente) => normalizeTelefono(cliente.telefono) === telefonoNormalizado)
        : null) ||
      (nombreNormalizado
        ? clientes.find((cliente) => `${cliente.nombre || ""}`.trim().toLowerCase() === nombreNormalizado)
        : null) ||
      null
    );
  };

  const manejarTelefonoCliente = (value: string) => {
    setClienteTelefono(value);
    const encontrado = buscarClientePorTelefono(value);
    if (encontrado) {
      sincronizarCliente(encontrado);
      return;
    }
    if (clienteId !== "" && Number(clienteId) > 0) setClienteId("");
  };

  useEffect(() => {
    if (!documentBodegaLocked) return;
    const parsed = parsedUserBodegaId;
    const exists = bodegas.some((b) => Number(b.id) === parsed);
    if (!exists) {
      setBodegaId("");
      return;
    }
    setBodegaId(parsed);
    setArticuloActual((prev) => ({ ...prev, bodegaId: prev.bodegaId || parsed }));
    setDetalle((prev) =>
      prev.map((row) => ({
        ...row,
        requiereTraslado: Number(row.bodegaId) !== parsed,
      })),
    );
    const selected = bodegas.find((b) => Number(b.id) === parsed);
    const ubic = normalizarUbicacion(selected?.ubicacion);
    setUbicacion(ubic || "TIENDA");
  }, [documentBodegaLocked, parsedUserBodegaId, bodegas]);

  const fetchStock = async (bodega: number, producto: number) => {
    try {
      const resp = await api.get(`/inventario/${bodega}/${producto}`);
      return resp.data?.stock ?? null;
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

  const tallasBusquedaExacta = useMemo(
    () => new Set(tallas.map((talla) => normalizeSearch(talla.nombre))),
    [tallas],
  );
  const productoSearchIndex = useMemo(
    () => new Map(productos.map((producto) => {
      const talla = resolveTallaNombre(producto, tallas);
      return [producto, createProductSearchEntry([
        producto.codigo,
        producto.nombre,
        producto.categoria?.nombre,
        producto.tipo,
        producto.genero,
        resolveTelaNombre(producto, telas),
        talla,
        resolveColorNombre(producto, colores),
      ], talla)];
    })),
    [productos, telas, tallas, colores],
  );
  const productoDetectado = productosCoincidentes.length === 1 ? productosCoincidentes[0] : undefined;

  const seleccionarProducto = (producto: Producto | null) => {
    if (!producto) {
      setFiltroTipo("");
      setFiltroGenero("");
      setFiltroTela("");
      setFiltroTalla("");
      setFiltroColor("");
      return;
    }
    setFiltroTipo(producto.tipo || "");
    setFiltroGenero(producto.genero || "");
    setFiltroTela(resolveTelaNombre(producto, telas) === "N/D" ? "" : resolveTelaNombre(producto, telas));
    setFiltroTalla(resolveTallaNombre(producto, tallas) === "N/D" ? "" : resolveTallaNombre(producto, tallas));
    setFiltroColor(resolveColorNombre(producto, colores) === "N/D" ? "" : resolveColorNombre(producto, colores));
  };
  const bodegaOrigenArticuloId = Number(articuloActual.bodegaId || bodegaId || 0) || null;
  const bodegaOrigenArticulo = bodegas.find((b) => Number(b.id) === Number(bodegaOrigenArticuloId)) || null;
  const controlaInventarioArticulo = Boolean(bodegaOrigenArticulo?.usaInventarioVentas);
  const mostrarColumnaStock = detalle.some((row) => row.controlaInventario) || controlaInventarioArticulo;
  const stockRestanteEstimado =
    controlaInventarioArticulo && articuloActual.stock != null ? Math.max(articuloActual.stock - (Number(cantidadInput) || 0), 0) : null;
  const requiereTrasladoArticulo =
    Boolean(bodegaId && bodegaOrigenArticuloId) && Number(bodegaOrigenArticuloId) !== Number(bodegaId);
  const trasladosPendientes = detalle.filter((row) => row.requiereTraslado);

  const normalizarTextoProducto = (value?: string | null) =>
    `${value || ""}`
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const getTipoComplementario = (tipo?: string | null) => {
    const normalized = normalizarTextoProducto(tipo);
    if (normalized.includes("FILIPINA")) return "PANTALON";
    if (normalized.includes("PANTALON")) return "FILIPINA";
    return "";
  };

  const buscarProductoComplementario = (producto?: Producto) => {
    const tipoComplementario = getTipoComplementario(producto?.tipo);
    if (!producto || !tipoComplementario) return null;

    const genero = normalizarTextoProducto(producto.genero);
    const tela = normalizarTextoProducto(obtenerTela(producto));
    const talla = normalizarTextoProducto(obtenerTalla(producto));
    const color = normalizarTextoProducto(obtenerColor(producto));

    return (
      productos.find(
        (candidate) =>
          normalizarTextoProducto(candidate.tipo) === tipoComplementario &&
          normalizarTextoProducto(candidate.genero) === genero &&
          normalizarTextoProducto(obtenerTela(candidate)) === tela &&
          normalizarTextoProducto(obtenerTalla(candidate)) === talla &&
          normalizarTextoProducto(obtenerColor(candidate)) === color,
      ) || null
    );
  };

  const sugerirProductoComplementario = async (productoAgregado?: Producto, cantidadSugerida = 1, descuentoSugerido = 0) => {
    const complementario = buscarProductoComplementario(productoAgregado);
    if (!complementario) return;

    const tipoComplementario = getTipoComplementario(productoAgregado?.tipo).toLowerCase();
    const result = await Swal.fire({
      title: `Agregar ${tipoComplementario}?`,
      text: `Se encontro ${complementario.codigo}. Puedo rellenar la captura con la misma tela, talla, color y genero para que lo revises antes de agregarlo.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Rellenar campos",
      cancelButtonText: "No",
      confirmButtonColor: "#1f3f87",
    });
    if (!result.isConfirmed) return;

    complementoSugeridoProductoIdRef.current = Number(complementario.id);
    setEditingDetalleKey(null);
    setCantidadInput(String(cantidadSugerida || 1));
    setArticuloActual({
      ...detalleInicial,
      bodegaId: articuloActual.bodegaId || bodegaId || "",
      cantidad: cantidadSugerida || 1,
      descuento: descuentoSugerido || 0,
    });
    setFiltroTipo(complementario.tipo || "");
    setFiltroGenero(complementario.genero || "");
    setFiltroTela(obtenerTela(complementario) === "N/D" ? "" : obtenerTela(complementario));
    setFiltroTalla(obtenerTalla(complementario) === "N/D" ? "" : obtenerTalla(complementario));
    setFiltroColor(obtenerColor(complementario) === "N/D" ? "" : obtenerColor(complementario));
  };

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
          precio: 0,
          stock: null,
        }));
        return;
      }

      const sourceBodegaId = Number(articuloActual.bodegaId || bodegaId || 0);
      const sourceBodega = bodegas.find((b) => Number(b.id) === Number(sourceBodegaId));
      const stock = sourceBodega?.usaInventarioVentas && sourceBodegaId ? await fetchStock(sourceBodegaId, productoDetectado.id) : null;
      setArticuloActual((prev) => ({
        ...prev,
        productoId: productoDetectado.id,
        precio: productoDetectado.precio ?? 0,
        stock,
      }));
    };

    void syncProducto();
  }, [productoDetectado, articuloActual.bodegaId, bodegaId, bodegas]);

  const limpiarArticulo = () => {
    setArticuloActual(detalleInicial);
    setCantidadInput("1");
    setEditingDetalleKey(null);
    setFiltroTipo("");
    setFiltroGenero("");
    setFiltroTela("");
    setFiltroTalla("");
    setFiltroColor("");
    complementoSugeridoProductoIdRef.current = null;
  };

  const agregarArticulo = async () => {
    if (!articuloActual.productoId) {
      Swal.fire("Validacion", "Selecciona un producto", "warning");
      return;
    }
    if (!bodegaOrigenArticuloId) {
      Swal.fire("Validacion", "Selecciona la bodega origen del articulo", "warning");
      return;
    }

    const cantidad = Number(cantidadInput) || 0;
    if (cantidad <= 0) {
      Swal.fire("Validacion", "Ingresa una cantidad mayor a 0", "warning");
      return;
    }

    if (controlaInventarioArticulo && articuloActual.stock != null && cantidad > articuloActual.stock) {
      Swal.fire("Validacion", `Solo hay ${articuloActual.stock} unidades disponibles en inventario`, "warning");
      return;
    }
    if (controlaInventarioArticulo && articuloActual.stock != null) {
      const cantidadYaAgregada = detalle
        .filter(
          (row) =>
            row.key !== editingDetalleKey &&
            Number(row.bodegaId) === Number(bodegaOrigenArticuloId) &&
            Number(row.productoId) === Number(articuloActual.productoId),
        )
        .reduce((sum, row) => sum + (Number(row.cantidad) || 0), 0);
      if (cantidadYaAgregada + cantidad > articuloActual.stock) {
        Swal.fire(
          "Validacion",
          `Ya agregaste ${cantidadYaAgregada} unidades de este producto. Disponible en inventario: ${articuloActual.stock}.`,
          "warning",
        );
        return;
      }
    }

    const bordadoEnCaptura = buildBordadoDesdeArticulo(articuloActual);
    const bordadosFinales = agregarBordadoSiNoExiste(
      articuloActual.bordados.filter(
        (bordado) =>
          Number(bordado.monto || 0) > 0 ||
          Boolean(`${bordado.observaciones || ""}`.trim()) ||
          Boolean(bordado.imagenUrl),
      ),
      bordadoEnCaptura,
    );
    const tieneBordado = Boolean(articuloActual.bordadoActivo) || bordadosFinales.length > 0;
    if (
      tieneBordado &&
      (!bordadosFinales.length ||
        bordadosFinales.some((bordado) => !bordado.color || !bordado.tamano || !bordado.posicion))
    ) {
      Swal.fire("Validacion", "Agrega al menos un bordado con color, tamano y posicion", "warning");
      return;
    }
    const bordadoTotal = getBordadoTotal(bordadosFinales);
    const primerBordado = bordadosFinales[0] || null;
    const descripcion = formatDetalleObservaciones(articuloActual.descripcion || "", bordadosFinales);

    const row: DetalleRow = {
      key: editingDetalleKey ?? Date.now(),
      productoId: Number(articuloActual.productoId),
      bodegaId: bodegaOrigenArticuloId,
      bodegaNombre: bodegaOrigenArticulo?.nombre || `Bodega ${bodegaOrigenArticuloId}`,
      controlaInventario: controlaInventarioArticulo,
      requiereTraslado: requiereTrasladoArticulo,
      cantidad,
      precio: Number(articuloActual.precio) || 0,
      bordado: bordadoTotal,
      bordadoActivo: tieneBordado,
      bordados: bordadosFinales,
      bordadoColor: primerBordado?.color || "",
      bordadoTamano: primerBordado?.tamano || "",
      bordadoPosicion: primerBordado?.posicion || "",
      bordadoObservaciones: primerBordado?.observaciones || "",
      bordadoImagenUrl: primerBordado?.imagenUrl || "",
      estiloEspecial: Boolean(articuloActual.estiloEspecial),
      estiloEspecialMonto: articuloActual.estiloEspecial ? Number(articuloActual.estiloEspecialMonto) || 0 : 0,
      descuento: Number(articuloActual.descuento) || 0,
      descripcion,
      stock: articuloActual.stock,
    };

    const productoAgregadoDesdeSugerencia = complementoSugeridoProductoIdRef.current === Number(articuloActual.productoId);
    const debeSugerirComplementario = editingDetalleKey === null && !productoAgregadoDesdeSugerencia;
    const productoAgregado = productos.find((p) => Number(p.id) === Number(articuloActual.productoId));
    const cantidadSugerida = cantidad;
    const descuentoSugerido = Number(articuloActual.descuento) || 0;

    setDetalle((prev) =>
      editingDetalleKey === null ? [...prev, row] : prev.map((item) => (item.key === editingDetalleKey ? row : item)),
    );
    limpiarArticulo();
    if (debeSugerirComplementario) {
      await sugerirProductoComplementario(productoAgregado, cantidadSugerida, descuentoSugerido);
    }
  };

  const editarArticulo = (row: DetalleRow) => {
    const producto = productos.find((p) => p.id === row.productoId);
    setEditingDetalleKey(row.key);
    setArticuloActual({
      productoId: row.productoId,
      bodegaId: row.bodegaId,
      cantidad: row.cantidad,
      precio: row.precio,
      bordado: row.bordado,
      bordadoActivo: row.bordadoActivo || Number(row.bordado || 0) > 0,
      bordados: row.bordados || [],
      bordadoColor: row.bordadoColor || "FULL COLOR",
      bordadoTamano: row.bordadoTamano || "NORMAL",
      bordadoPosicion: row.bordadoPosicion || "PECHO IZQUIERDO",
      bordadoObservaciones: row.bordadoObservaciones || "",
      bordadoImagenUrl: row.bordadoImagenUrl || "",
      estiloEspecial: row.estiloEspecial,
      estiloEspecialMonto: row.estiloEspecialMonto,
      descuento: row.descuento,
      descripcion: row.descripcion || "",
      stock: row.stock,
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

  const limpiarBordadoActual = () => {
    setArticuloActual((prev) => ({
      ...prev,
      bordado: 0,
      bordadoColor: "FULL COLOR",
      bordadoTamano: "NORMAL",
      bordadoPosicion: "PECHO IZQUIERDO",
      bordadoObservaciones: "",
      bordadoImagenUrl: "",
    }));
  };

  const agregarBordadoActual = () => {
    const bordado = buildBordadoDesdeArticulo(articuloActual);
    if (!bordado) {
      Swal.fire("Validacion", "Ingresa un monto, una imagen u observaciones antes de agregar el bordado", "warning");
      return;
    }
    if (!bordado.color || !bordado.tamano || !bordado.posicion) {
      Swal.fire("Validacion", "Color, tamano y posicion de bordado son obligatorios", "warning");
      return;
    }
    if (articuloActual.bordados.some((item) => bordadosIguales(item, bordado))) {
      Swal.fire("Bordado duplicado", "Este bordado ya esta agregado a la prenda", "info");
      return;
    }
    setArticuloActual((prev) => ({
      ...prev,
      bordados: [...prev.bordados, bordado],
      bordadoActivo: true,
      bordado: 0,
      bordadoColor: "FULL COLOR",
      bordadoTamano: "NORMAL",
      bordadoPosicion: "PECHO IZQUIERDO",
      bordadoObservaciones: "",
      bordadoImagenUrl: "",
    }));
  };

  const editarBordadoActual = (bordado: BordadoArticulo) => {
    setArticuloActual((prev) => ({
      ...prev,
      bordadoActivo: true,
      bordado: bordado.monto,
      bordadoColor: bordado.color || "FULL COLOR",
      bordadoTamano: bordado.tamano || "NORMAL",
      bordadoPosicion: bordado.posicion || "PECHO IZQUIERDO",
      bordadoObservaciones: bordado.observaciones || "",
      bordadoImagenUrl: bordado.imagenUrl || "",
      bordados: prev.bordados.filter((item) => item.key !== bordado.key),
    }));
  };

  const quitarBordadoActual = (key: number) => {
    setArticuloActual((prev) => ({
      ...prev,
      bordados: prev.bordados.filter((item) => item.key !== key),
    }));
  };

  const onBodegaChange = async (value: number) => {
    const previousBodegaId = bodegaId;
    setBodegaId(value);
    const selected = bodegas.find((b) => b.id === value);
    const ubic = normalizarUbicacion(selected?.ubicacion);
    if (ubic) {
      setUbicacion(ubic);
    }

    setDetalle((prev) =>
      prev.map((row) => ({
        ...row,
        requiereTraslado: Number(row.bodegaId) !== Number(value),
      })),
    );

    if (articuloActual.productoId) {
      const nextSourceBodegaId =
        !articuloActual.bodegaId || Number(articuloActual.bodegaId) === Number(previousBodegaId)
          ? value
          : Number(articuloActual.bodegaId);
      const sourceBodega = bodegas.find((b) => Number(b.id) === Number(nextSourceBodegaId));
      const stock = sourceBodega?.usaInventarioVentas ? await fetchStock(nextSourceBodegaId, Number(articuloActual.productoId)) : null;
      setArticuloActual((prev) => ({ ...prev, bodegaId: nextSourceBodegaId, stock }));
    } else {
      setArticuloActual((prev) => ({
        ...prev,
        bodegaId: !prev.bodegaId || Number(prev.bodegaId) === Number(previousBodegaId) ? value : prev.bodegaId,
      }));
    }
  };

  const totals = useMemo(() => {
    const subtotal = detalle.reduce(
      (sum, item) => sum + calcularImportesDetalleVenta(item).subtotal,
      0,
    );
    const recargo = metodoUsaRecargo ? subtotal * ((porcentajeRecargo || 0) / 100) : 0;
    const envioMonto = Math.max(0, Number(envio) || 0);
    const total = subtotal + recargo + envioMonto;
    return { subtotal, recargo, envio: envioMonto, total };
  }, [detalle, metodoUsaRecargo, porcentajeRecargo, envio]);

  const calcularSubtotal = (item: DetalleRow) => {
    return calcularImportesDetalleVenta(item).subtotal;
  };

  const detalleTableTotals = useMemo(
    () =>
      detalle.reduce(
        (sum, row) => ({
          cantidad: sum.cantidad + (Number(row.cantidad) || 0),
          precio: sum.precio + calcularImportesDetalleVenta(row).precio,
          bordado: sum.bordado + calcularImportesDetalleVenta(row).bordado,
          estiloEspecial: sum.estiloEspecial + calcularImportesDetalleVenta(row).estiloEspecial,
          subtotal: sum.subtotal + calcularImportesDetalleVenta(row).subtotal,
        }),
        { cantidad: 0, precio: 0, bordado: 0, estiloEspecial: 0, subtotal: 0 },
      ),
    [detalle],
  );

  useEffect(() => {
    if (!userId || !borradorInicializadoRef.current || restaurandoBorradorRef.current || autoguardadoBorradorBloqueadoRef.current) {
      return;
    }

    const hasContenido =
      detalle.length > 0 ||
      Boolean(articuloActual.productoId) ||
      clienteId !== CLIENTE_CF_ID ||
      clienteNombre.trim().toUpperCase() !== "CF" ||
      Boolean(clienteTelefono.trim()) ||
      Boolean(referenciaPago.trim()) ||
      Boolean(bancoPago.trim()) ||
      Number(envio || 0) > 0 ||
      Boolean(filtroTipo || filtroGenero || filtroTela || filtroTalla || filtroColor);

    if (!hasContenido) return;

    const data = {
      version: 1,
      encabezado: {
        clienteId: clienteId === "" || clienteId === CLIENTE_CF_ID ? null : Number(clienteId),
        clienteNombre,
        clienteTelefono,
        bodegaId: bodegaId === "" ? null : Number(bodegaId),
        metodoPago,
        ubicacion,
        porcentajeRecargo,
        referenciaPago,
        bancoPago,
        envio,
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
        VENTA_BORRADOR_LOCAL_KEY,
        JSON.stringify({ tipoDocumento: VENTA_BORRADOR_TIPO, actualizadoEn: new Date().toISOString(), data }),
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
          tipoDocumento: VENTA_BORRADOR_TIPO,
          titulo: clienteNombre && clienteNombre.trim().toUpperCase() !== "CF" ? clienteNombre : "Venta preliminar",
          bodegaId: bodegaId === "" ? null : Number(bodegaId),
          clienteId: clienteId === "" || clienteId === CLIENTE_CF_ID ? null : Number(clienteId),
          totalEstimado: totals.total,
          data,
        });
        ultimoBorradorJsonRef.current = serialized;
        setDocumentoBorradorId(Number(saved?.id || documentoBorradorId || 0) || null);
        setBorradorGuardadoEn(saved?.actualizadoEn || new Date().toISOString());
        setBorradorEstado("saved");
      } catch {
        setBorradorEstado("error");
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    articuloActual,
    bancoPago,
    bodegaId,
    cantidadInput,
    clienteId,
    clienteNombre,
    clienteTelefono,
    detalle,
    documentoBorradorId,
    envio,
    filtroColor,
    filtroGenero,
    filtroTalla,
    filtroTela,
    filtroTipo,
    metodoPago,
    porcentajeRecargo,
    referenciaPago,
    totals.total,
    ubicacion,
    userId,
  ]);

  const calcularTotalesDesdeDetalle = (detalleActual: DetalleRow[]) => {
    const subtotal = detalleActual.reduce((sum, item) => sum + calcularSubtotal(item), 0);
    const recargoCalculado = metodoUsaRecargo ? subtotal * ((porcentajeRecargo || 0) / 100) : 0;
    const envioCalculado = Math.max(0, Number(envio) || 0);
    return { subtotal, recargo: recargoCalculado, envio: envioCalculado, total: subtotal + recargoCalculado + envioCalculado };
  };

  const abrirPdfVenta = (venta: any, detalleUsado: DetalleRow[]) => {
    const nuevaVentana = window.open("", "_blank");
    if (!nuevaVentana) {
      Swal.fire("Aviso", "Habilita las ventanas emergentes para ver el PDF", "info");
      return;
    }

    const clienteNombrePdf =
      venta?.clienteNombre ||
      venta?.cliente?.nombre ||
      clienteNombre.trim() ||
      clientesConCf.find((c) => c.id === (clienteId === "" ? null : Number(clienteId)))?.nombre ||
      "CF";
    const bodegaNombre = bodegas.find((b) => b.id === Number(bodegaId))?.nombre || authBodegaNombre || "N/D";
    const vendedor = usuario || "Vendedor";
    const fecha = venta?.fecha ? new Date(venta.fecha) : new Date();
    const folio = venta?.folio || (venta?.id ? `V-${venta.id}` : "Pendiente");
    const totalesPdf = calcularTotalesDesdeDetalle(detalleUsado);

    const html = buildVentaPdfHtml({
      folio,
      fecha,
      cliente: clienteNombrePdf,
      metodoPago,
      referenciaPago: metodoRequiereReferencia ? referenciaPago || "N/D" : "No aplica",
      bodega: bodegaNombre,
      ubicacion: ubicacion || "N/D",
      vendedor,
      subtotal: totalesPdf.subtotal,
      recargo: totalesPdf.recargo,
      envio: totalesPdf.envio,
      total: totalesPdf.total,
      recargoEtiqueta: metodoUsaRecargo ? `Recargo (${porcentajeRecargo || 0}%)` : undefined,
      logoUrl: LOGO_URL,
      items: detalleUsado.map((item) => {
        const producto = productos.find((p) => p.id === item.productoId);
        return {
          codigo: producto?.codigo || `${item.productoId}`,
          nombre: producto?.nombre || "Producto",
          cantidad: Number(item.cantidad) || 0,
          precio: Number(item.precio) || 0,
          bordado: Number(item.bordado) || 0,
          bordadoColor: item.bordadoColor,
          bordadoTamano: item.bordadoTamano,
          bordadoPosicion: item.bordadoPosicion,
          bordadoObservaciones: item.bordadoObservaciones,
          bordados: item.bordados.map((bordado) => ({
            monto: Number(bordado.monto) || 0,
            color: bordado.color,
            tamano: bordado.tamano,
            posicion: bordado.posicion,
            observaciones: bordado.observaciones,
          })),
          estiloEspecial: item.estiloEspecial,
          estiloEspecialMonto: Number(item.estiloEspecialMonto) || 0,
          descuento: Number(item.descuento) || 0,
          subtotal: calcularSubtotal(item),
        };
      }),
    });

    nuevaVentana.document.write(html);
    nuevaVentana.document.close();
  };

  const mostrarFormularioRegistroCliente = async (datosIniciales: ClienteVenta) => {
    const result = await Swal.fire({
      title: "Registrar cliente",
      html: `
        <input id="cliente-nombre" class="swal2-input" placeholder="Nombre" value="${escapeInputValue(datosIniciales.nombre)}">
        <input id="cliente-telefono" class="swal2-input" placeholder="Telefono" value="${escapeInputValue(datosIniciales.telefono)}">
        <input id="cliente-correo" class="swal2-input" placeholder="Correo (opcional)">
        <input id="cliente-direccion" class="swal2-input" placeholder="Direccion (opcional)">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Registrar",
      cancelButtonText: "Cancelar",
      preConfirm: () => {
        const nombre = (document.getElementById("cliente-nombre") as HTMLInputElement | null)?.value.trim() || "";
        const telefono = (document.getElementById("cliente-telefono") as HTMLInputElement | null)?.value.trim() || "";
        const correo = (document.getElementById("cliente-correo") as HTMLInputElement | null)?.value.trim() || "";
        const direccion = (document.getElementById("cliente-direccion") as HTMLInputElement | null)?.value.trim() || "";
        if (!nombre) {
          Swal.showValidationMessage("Ingresa el nombre del cliente");
          return false;
        }
        return {
          nombre,
          telefono: telefono || null,
          correo: correo || null,
          direccion: direccion || null,
          tipoCliente: "CLIENTE",
        };
      },
    });

    if (!result.isConfirmed || !result.value) return null;

    const resp = await api.post("/clientes", result.value);
    const nuevoCliente = resp.data as Cliente;
    setClientes((prev) => [nuevoCliente, ...prev.filter((cliente) => cliente.id !== nuevoCliente.id)]);
    sincronizarCliente(nuevoCliente);
    return nuevoCliente;
  };

  const resolverClienteVenta = async (): Promise<ClienteVenta | false> => {
    const nombre = clienteNombre.trim() || "CF";
    const telefono = clienteTelefono.trim();
    const consumidorFinal = !telefono && nombre.toUpperCase() === "CF";
    const seleccionado =
      clienteId !== "" && Number(clienteId) > 0
        ? clientes.find((cliente) => cliente.id === Number(clienteId)) || null
        : null;
    const existente = seleccionado || buscarClienteExistente(nombre, telefono);

    if (existente) {
      if (!clientePerteneceCartera(existente)) {
        if (!autorizacionClienteId || Number(clienteId) !== existente.id) return await solicitarClienteFueraCartera(existente) ? { id: existente.id, nombre: existente.nombre, telefono: existente.telefono || null } : false;
      }
      sincronizarCliente(existente);
      return {
        id: existente.id,
        nombre: existente.nombre,
        telefono: existente.telefono || null,
      };
    }

    if (consumidorFinal) {
      return {
        id: null,
        nombre: "CF",
        telefono: null,
      };
    }

    const respuesta = await Swal.fire({
      icon: "question",
      title: "Cliente no registrado",
      text: "Este cliente no existe. ¿Deseas registrarlo antes de finalizar la venta?",
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: "Registrar cliente",
      denyButtonText: "Continuar sin registrar",
      cancelButtonText: "Cancelar",
    });

    if (respuesta.isDismissed) return false;

    if (respuesta.isDenied) {
      setClienteId("");
      return {
        id: null,
        nombre,
        telefono: telefono || null,
      };
    }

    try {
      const creado = await mostrarFormularioRegistroCliente({ nombre, telefono });
      if (!creado) return false;
      return {
        id: creado.id,
        nombre: creado.nombre,
        telefono: creado.telefono || null,
      };
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo registrar el cliente";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
      return false;
    }
  };

  const guardar = async () => {
    if (savingRef.current) return;
    const liberarGuardadoVenta = () => {
      savingRef.current = false;
      setSaving(false);
    };
    savingRef.current = true;
    setSaving(true);
    if (!bodegaId) {
      Swal.fire("Validacion", "Selecciona una bodega", "warning");
      liberarGuardadoVenta();
      return;
    }
    if (documentBodegaLocked && Number(bodegaId) !== parsedUserBodegaId) {
      Swal.fire("Validacion", "La bodega de la venta debe ser tu bodega asignada", "warning");
      setBodegaId(parsedUserBodegaId);
      liberarGuardadoVenta();
      return;
    }
    if (!metodoPago) {
      Swal.fire("Validacion", "Selecciona metodo de pago", "warning");
      liberarGuardadoVenta();
      return;
    }
    if (!ubicacion) {
      Swal.fire("Validacion", "Selecciona ubicacion de la venta", "warning");
      liberarGuardadoVenta();
      return;
    }
    if (!detalle.length) {
      Swal.fire("Validacion", "Agrega al menos un producto", "warning");
      liberarGuardadoVenta();
      return;
    }
    if (metodoRequiereReferencia && !`${referenciaPago}`.trim()) {
      Swal.fire("Validacion", "Ingresa la referencia o numero de transaccion", "warning");
      liberarGuardadoVenta();
      return;
    }
    if (metodoRequiereBanco && !bancoPago.trim()) {
      Swal.fire("Validacion", "Ingresa el banco del deposito", "warning");
      liberarGuardadoVenta();
      return;
    }

    const clienteParaVenta = await resolverClienteVenta();
    if (clienteParaVenta === false) {
      liberarGuardadoVenta();
      return;
    }

    const payload = {
      clienteId: clienteParaVenta.id && Number(clienteParaVenta.id) > 0 ? Number(clienteParaVenta.id) : null,
      clienteNombre: clienteParaVenta.nombre,
      clienteTelefono: clienteParaVenta.telefono || null,
      autorizacionClienteId,
      bodegaId: Number(bodegaId),
      ubicacion,
      metodoPago,
      porcentajeRecargo,
      referenciaPago: metodoRequiereReferencia ? referenciaPago.trim() : null,
      bancoPago: metodoRequiereBanco ? bancoPago.trim() : null,
      envio: Math.max(0, Number(envio) || 0),
      usuarioId: userId,
      vendedor: usuario,
        detalle: detalle.map((d) => ({
          productoId: d.productoId,
          bodegaId: d.bodegaId,
          cantidad: d.cantidad,
          precio: d.precio,
          bordado: d.bordado,
          bordadoColor: d.bordadoActivo ? d.bordadoColor : null,
          bordadoTamano: d.bordadoActivo ? d.bordadoTamano : null,
          bordadoPosicion: d.bordadoActivo ? d.bordadoPosicion : null,
          bordadoObservaciones: d.bordadoActivo ? d.bordadoObservaciones : null,
          bordadoImagenUrl: d.bordadoActivo ? d.bordadoImagenUrl : null,
          bordados: d.bordadoActivo
            ? d.bordados.map((bordado) => ({
                monto: bordado.monto,
                color: bordado.color,
                tamano: bordado.tamano,
                posicion: bordado.posicion,
                observaciones: bordado.observaciones,
                imagenUrl: bordado.imagenUrl,
              }))
            : [],
          estiloEspecial: d.estiloEspecial,
          estiloEspecialMonto: d.estiloEspecialMonto,
          descuento: d.descuento,
          descripcion: d.descripcion || "",
        })),
      };

    try {
      const resp = await api.post("/ventas", payload);
      autoguardadoBorradorBloqueadoRef.current = true;
      await finalizarBorradorActual({
        tipo: "venta",
        id: Number(resp.data?.id || 0) || null,
        folio: resp.data?.folio || null,
      });
      Swal.fire("Guardado", "Venta registrada", "success");
      abrirPdfVenta(resp.data, detalle);
      navigate("/ventas");
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo guardar";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    } finally {
      liberarGuardadoVenta();
    }
  };

  const revisarSolicitudesCartera = async () => {
    const { data } = await api.get("/autorizaciones-clientes/pendientes");
    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) return void Swal.fire("Sin solicitudes", "No tienes solicitudes pendientes de otros vendedores.", "info");
    for (const row of rows) {
      const result = await Swal.fire({ title: "Autorizar venta por esta ocasion", text: `${row.solicitante?.nombre || row.solicitante?.usuario || "Otro vendedor"} solicita vender a ${row.cliente?.nombre || "tu cliente"}.`, icon: "question", showDenyButton: true, showCancelButton: true, confirmButtonText: "Autorizar", denyButtonText: "Rechazar", cancelButtonText: "Después" });
      if (result.isDismissed) break;
      await api.post(`/autorizaciones-clientes/${row.id}/${result.isConfirmed ? "aprobar" : "rechazar"}`, {});
    }
  };

  return (
    <Stack spacing={2.25}>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 1.5, md: 2 },
          position: "sticky",
          top: { xs: 60, md: 68 },
          zIndex: 10,
          bgcolor: "background.paper",
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} gap={1.5}>
          <Box>
            <Typography variant="h4" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <PaymentIcon color="primary" /> Nueva venta
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Registra una venta, valida existencias y prepara el comprobante en un solo flujo.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={`${detalleTableTotals.cantidad} unidad${detalleTableTotals.cantidad === 1 ? "" : "es"}`} variant="outlined" />
            <Chip label={formatCurrency(totals.total)} color="primary" />
            <Button variant="outlined" onClick={() => void revisarSolicitudesCartera()}>Solicitudes de cartera</Button>
            <Button variant="outlined" startIcon={<ArrowBackOutlined />} onClick={() => navigate("/ventas")}>Volver</Button>
          </Stack>
        </Stack>
      </Paper>
      {documentoBorradorId && (
        <Alert
          severity={borradorEstado === "error" ? "warning" : "info"}
          action={
            <Button color="inherit" size="small" onClick={() => void descartarBorradorActual()} disabled={saving}>
              Descartar
            </Button>
          }
        >
          Venta preliminar PRE-{String(documentoBorradorId).padStart(6, "0")}
          {borradorEstado === "saving"
            ? " guardandose..."
            : borradorGuardadoEn
              ? ` guardada ${new Date(borradorGuardadoEn).toLocaleString("es-GT")}`
              : ""}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="overline" color="primary" fontWeight={700}>01</Typography>
          <Typography variant="h6">Cliente y documento</Typography>
        </Stack>
        <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel>Bodega</InputLabel>
            <Select
              label="Bodega"
              value={bodegaId === "" ? "" : bodegaId}
              onChange={(e) => void onBodegaChange(Number(e.target.value))}
              disabled={documentBodegaLocked || bodegas.length <= 1}
            >
              {bodegas.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {documentBodegaLocked && (
            <Typography variant="caption" color="text.secondary">
              La venta se registra con tu bodega asignada. Para surtir productos de otra bodega usa "Bodega origen" en el articulo.
            </Typography>
          )}
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Autocomplete<Cliente, false, false, true>
            freeSolo
            options={clientes.filter((cliente) => `${cliente.telefono || ""}`.trim())}
            getOptionLabel={(option) =>
              typeof option === "string" ? option : `${option.telefono || ""}`.trim()
            }
            filterOptions={filterClienteOptions}
            inputValue={clienteTelefono}
            value={clienteSeleccionado?.telefono ? clienteSeleccionado : null}
            onInputChange={(_, value, reason) => {
              if (reason === "reset") return;
              manejarTelefonoCliente(value);
            }}
            onChange={(_, value) => {
              if (typeof value === "string") {
                manejarTelefonoCliente(value);
                return;
              }
              if (value) {
                sincronizarCliente(value);
                return;
              }
              setClienteId("");
              setClienteTelefono("");
            }}
            renderOption={(props, option) => {
              const { key: _key, ...optionProps } = props;
              return (
                <li key={option.id} {...optionProps}>
                  {formatClienteOption(option)}
                </li>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Telefono del cliente"
                fullWidth
                helperText="Busca por telefono o escribe uno nuevo"
              />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label="Nombre del cliente"
            fullWidth
            value={clienteNombre}
            onChange={(e) => {
              const value = e.target.value;
              setClienteNombre(value);
              if (clienteSeleccionado && value.trim() !== `${clienteSeleccionado.nombre || ""}`.trim()) {
                setClienteId("");
              }
            }}
            helperText="Se guardara con la venta"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel>Ubicacion</InputLabel>
            <Select label="Ubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)}>
              <MenuItem value="TIENDA">TIENDA</MenuItem>
              <MenuItem value="CAPITAL">CAPITAL</MenuItem>
              <MenuItem value="DEPARTAMENTO">DEPARTAMENTO</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel>Metodo de pago</InputLabel>
            <Select
              label="Metodo de pago"
              value={metodoPago}
              onChange={(e) => {
                const nextMetodo = e.target.value;
                setMetodoPago(nextMetodo);
                if (nextMetodo !== "deposito_bancario") setBancoPago("");
              }}
            >
              <MenuItem value="efectivo">Efectivo</MenuItem>
              <MenuItem value="tarjeta">Tarjeta</MenuItem>
              <MenuItem value="visalink">Visalink</MenuItem>
              <MenuItem value="transferencia">Transferencia</MenuItem>
              <MenuItem value="deposito_bancario">Deposito bancario</MenuItem>
              <MenuItem value="orden_compra">Orden de compra</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label="Envio"
            type="number"
            fullWidth
            value={emptyWhenZero(envio)}
            onChange={(e) => setEnvio(Math.max(0, parseNumberInput(e.target.value)))}
            helperText="Monto cobrado por envio en esta venta"
          />
        </Grid>
        {metodoUsaRecargo && (
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Recargo %"
              type="number"
              fullWidth
              value={emptyWhenZero(porcentajeRecargo)}
              onChange={(e) => setPorcentajeRecargo(parseNumberInput(e.target.value))}
            />
          </Grid>
        )}
        {metodoRequiereReferencia && (
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Referencia"
              fullWidth
              value={referenciaPago}
              onChange={(e) => setReferenciaPago(e.target.value)}
              helperText="Numero de transaccion del metodo de pago"
            />
          </Grid>
        )}
        {metodoRequiereBanco && (
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Banco"
              fullWidth
              value={bancoPago}
              onChange={(e) => setBancoPago(e.target.value)}
              helperText="Banco donde se realizo el deposito"
            />
          </Grid>
        )}
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} gap={1} sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="overline" color="primary" fontWeight={700}>02</Typography>
            <Typography variant="h6">Agregar articulo</Typography>
          </Stack>
          <Button
            size="small"
            variant={filtrosAbiertos ? "contained" : "outlined"}
            startIcon={<TuneOutlined />}
            endIcon={<ExpandMoreOutlined sx={{ transform: filtrosAbiertos ? "rotate(180deg)" : "none", transition: "transform 160ms" }} />}
            onClick={() => setFiltrosAbiertos((value) => !value)}
          >
            Filtros del producto
          </Button>
        </Stack>
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Selecciona la combinacion del articulo y agregalo a la lista temporal antes de guardar la venta.
          </Typography>
          {bodegaOrigenArticulo && !controlaInventarioArticulo ? (
            <Alert severity="warning">
              Esta bodega no controla inventario en ventas. La venta no validara ni descontara stock para esta linea.
            </Alert>
          ) : articuloActual.stock != null && articuloActual.productoId ? (
            <Alert severity={stockRestanteEstimado !== null && stockRestanteEstimado <= 0 ? "warning" : "info"}>
              {`Stock actual en ${bodegaOrigenArticulo?.nombre || "bodega origen"}: ${articuloActual.stock} unidades. `}
              {`Stock restante estimado con esta captura: ${stockRestanteEstimado ?? 0} unidades.`}
              {requiereTrasladoArticulo ? " Este articulo quedara marcado como traslado pendiente." : ""}
            </Alert>
          ) : (
            <Alert severity="info">Selecciona bodega y articulo para visualizar el stock disponible.</Alert>
          )}
        </Stack>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Bodega origen</InputLabel>
              <Select
                label="Bodega origen"
                value={articuloActual.bodegaId || bodegaId || ""}
                onChange={async (e) => {
                  const nextBodegaId = Number(e.target.value);
                  const nextBodega = bodegas.find((b) => Number(b.id) === Number(nextBodegaId));
                  const stock =
                    nextBodega?.usaInventarioVentas && articuloActual.productoId
                      ? await fetchStock(nextBodegaId, Number(articuloActual.productoId))
                      : null;
                  setArticuloActual((prev) => ({ ...prev, bodegaId: nextBodegaId, stock }));
                }}
              >
                {bodegas.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.nombre}{b.tipo ? ` - ${b.tipo}` : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          {requiereTrasladoArticulo && (
            <Grid size={{ xs: 12, md: 3 }}>
              <Alert severity="warning" sx={{ height: "100%", alignItems: "center" }}>
                Requiere traslado hacia la bodega de la venta.
              </Alert>
            </Grid>
          )}
          <Grid size={{ xs: 12, md: requiereTrasladoArticulo ? 6 : 9 }}>
            <Autocomplete
              options={productos}
              value={productoDetectado || null}
              getOptionLabel={(producto) =>
                `${upperText(producto.codigo)} · ${upperText(producto.nombre)} · TALLA ${upperText(resolveTallaNombre(producto, tallas))}`
              }
              filterOptions={(options, { inputValue }) => filterIndexedProducts(
                options,
                productoSearchIndex,
                inputValue,
                tallasBusquedaExacta,
              )}
              isOptionEqualToValue={(option, value) => Number(option.id) === Number(value.id)}
              onChange={(_, value) => seleccionarProducto(value)}
              renderOption={(props, producto) => {
                const categoria = upperText(producto.categoria?.nombre);
                const tipo = upperText(producto.tipo);
                const detalles = [
                  categoria !== tipo ? `CATEGORÍA ${categoria}` : null,
                  `TIPO ${tipo}`,
                  `GÉNERO ${upperText(producto.genero)}`,
                  `TELA ${upperText(resolveTelaNombre(producto, telas))}`,
                  `TALLA ${upperText(resolveTallaNombre(producto, tallas))}`,
                  `COLOR ${upperText(resolveColorNombre(producto, colores))}`,
                  producto.stockMax != null ? `STOCK MÁX. ${Number(producto.stockMax)}` : null,
                  producto.mermaPorcentaje != null ? `MERMA ${Number(producto.mermaPorcentaje)}%` : null,
                ].filter(Boolean);
                return (
                  <li {...props} key={producto.id}>
                    <Box sx={{ width: "100%", py: 0.45 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
                        <Typography variant="body2" fontWeight={500}>
                          <Box component="span" sx={{ fontWeight: 650 }}>{upperText(producto.codigo)}</Box> · {upperText(producto.nombre)} · TALLA {upperText(resolveTallaNombre(producto, tallas))}
                        </Typography>
                        <Typography variant="body2" color="primary.main" fontWeight={600} sx={{ whiteSpace: "nowrap" }}>
                          {formatCurrency(producto.precio)}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.45, fontWeight: 400, lineHeight: 1.45 }}>
                        {detalles.join(" · ")}
                      </Typography>
                    </Box>
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="BUSCAR PRODUCTO"
                  placeholder="CÓDIGO, NOMBRE O VARIANTE"
                  helperText="Busca en cualquier orden por código, nombre, talla, tela o color"
                  inputProps={{ ...params.inputProps, style: { textTransform: "uppercase" } }}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Collapse in={filtrosAbiertos} timeout="auto">
              <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.default" }}>
                <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
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
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
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
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
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
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
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
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
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
          <Grid size={{ xs: 12 }}>
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
                </Grid>
              </Paper>
            </Collapse>
          </Grid>
          <Grid size={{ xs: 12, sm: 3, md: 2 }}>
            <TextField
              label="Cantidad"
              type="text"
              fullWidth
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              value={cantidadInput}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "");
                const normalizado = raw.replace(/^0+(?=\d)/, "");
                const cantidad = Number(normalizado) || 0;
                setCantidadInput(normalizado);
                setArticuloActual((prev) => ({ ...prev, cantidad }));
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3, md: 2 }}>
            <TextField
              label="Precio"
              type="number"
              fullWidth
              value={articuloActual.precio}
              InputProps={{ readOnly: true }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 1,
                minHeight: 56,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
                borderColor: articuloActual.bordadoActivo ? "success.main" : "divider",
                bgcolor: articuloActual.bordadoActivo ? "#f8fff9" : "background.paper",
              }}
            >
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Checkbox
                  checked={articuloActual.bordadoActivo}
                  onChange={(e) =>
                    setArticuloActual((prev) => ({
                      ...prev,
                      bordadoActivo: e.target.checked,
                      bordado: e.target.checked ? prev.bordado : 0,
                      bordadoColor: e.target.checked ? prev.bordadoColor || "FULL COLOR" : "FULL COLOR",
                      bordadoTamano: e.target.checked ? prev.bordadoTamano || "NORMAL" : "NORMAL",
                      bordadoPosicion: e.target.checked ? prev.bordadoPosicion || "PECHO IZQUIERDO" : "PECHO IZQUIERDO",
                      bordadoObservaciones: e.target.checked ? prev.bordadoObservaciones || "" : "",
                      bordadoImagenUrl: e.target.checked ? prev.bordadoImagenUrl || "" : "",
                      bordados: e.target.checked ? prev.bordados : [],
                    }))
                  }
                  sx={{ p: 0.5 }}
                />
                <Box>
                  <Typography variant="body2" fontWeight={700}>
                    Bordado
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {articuloActual.bordados.length} item(s) | {formatCurrency(getBordadoTotal(articuloActual.bordados))}
                  </Typography>
                </Box>
              </Stack>
              <Button size="small" variant="outlined" disabled={!articuloActual.bordadoActivo} onClick={() => setBordadosModalOpen(true)}>
                Gestionar
              </Button>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
            <TextField
              label="Monto estilo"
              type="number"
              fullWidth
              value={emptyWhenZero(articuloActual.estiloEspecialMonto)}
              onChange={(e) =>
                setArticuloActual((prev) => ({
                  ...prev,
                  estiloEspecialMonto: parseNumberInput(e.target.value),
                }))
              }
              InputProps={{
                readOnly: !articuloActual.estiloEspecial,
                startAdornment: (
                  <InputAdornment position="start" sx={{ mr: 0.5 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Checkbox
                        checked={articuloActual.estiloEspecial}
                        onChange={(e) =>
                          setArticuloActual((prev) => ({
                            ...prev,
                            estiloEspecial: e.target.checked,
                            estiloEspecialMonto: e.target.checked
                              ? prev.estiloEspecialMonto > 0
                                ? prev.estiloEspecialMonto
                                : 25
                              : 0,
                          }))
                        }
                        sx={{ p: 0.5 }}
                      />
                      {!articuloActual.estiloEspecial && (
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                          Estilo especial
                        </Typography>
                      )}
                    </Stack>
                  </InputAdornment>
                ),
              }}
              sx={{
                "& .MuiInputBase-root": {
                  backgroundColor: articuloActual.estiloEspecial ? "transparent" : "action.disabledBackground",
                },
              }}
              helperText={articuloActual.estiloEspecial ? "Monto editable por producto" : "Activa estilo especial para habilitar el monto"}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3, md: 2 }}>
            <TextField
              label="Descuento %"
              type="number"
              fullWidth
              value={emptyWhenZero(articuloActual.descuento)}
              onChange={(e) => setArticuloActual((prev) => ({ ...prev, descuento: parseNumberInput(e.target.value) }))}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 8, md: 6 }}>
            <TextField
              label="Observaciones"
              fullWidth
              value={articuloActual.descripcion}
              onChange={(e) => setArticuloActual((prev) => ({ ...prev, descripcion: e.target.value }))}
            />
          </Grid>
        </Grid>

        <Stack spacing={1.5} alignItems="center" sx={{ mt: 2 }}>
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              onClick={agregarArticulo}
              sx={{
                backgroundColor: "#d32f2f",
                color: "#fff",
                px: 4,
                fontWeight: 700,
                "&:hover": {
                  backgroundColor: "#b71c1c",
                },
              }}
            >
              {editingDetalleKey === null ? "Agregar a la venta" : "Guardar cambios"}
            </Button>
            {editingDetalleKey !== null && (
              <Button variant="outlined" onClick={limpiarArticulo}>
                Cancelar edicion
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="overline" color="primary" fontWeight={700}>03</Typography>
            <Typography variant="h6">Articulos agregados</Typography>
          </Stack>
          <Chip size="small" label={`${detalle.length} linea${detalle.length === 1 ? "" : "s"}`} variant="outlined" />
        </Stack>
        {trasladosPendientes.length > 0 && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            {trasladosPendientes.length} articulo(s) salen de una bodega distinta a la venta. Quedan como referencia de traslado pendiente.
          </Alert>
        )}
      <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, minWidth: 260 }}>Producto</TableCell>
              <TableCell sx={{ fontWeight: 700, minWidth: 170 }}>Origen</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Cantidad</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Precio</TableCell>
              <TableCell sx={{ fontWeight: 700, minWidth: 160 }}>Adicionales</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Desc.</TableCell>
              <TableCell sx={{ fontWeight: 700, minWidth: 180 }}>Observacion</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Subtotal</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {detalle.map((row) => {
              const producto = productos.find((p) => p.id === row.productoId);
              return (
                <TableRow key={row.key}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={650}>{upperText(producto?.codigo || row.productoId)}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.45 }}>
                      {[producto?.tipo || producto?.nombre || "Producto", producto?.genero, obtenerTela(producto), `TALLA ${obtenerTalla(producto)}`, obtenerColor(producto)].filter(Boolean).map((value) => upperText(value)).join(" · ")}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.bodegaNombre}</Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                      {row.requiereTraslado && <Chip size="small" color="warning" label="Traslado" />}
                      {mostrarColumnaStock && <Chip size="small" variant="outlined" label={row.controlaInventario ? `Stock ${row.stock ?? "N/D"}` : "Sin control"} />}
                    </Stack>
                  </TableCell>
                  <TableCell align="center">{row.cantidad}</TableCell>
                  <TableCell align="right">{formatCurrency(row.precio)}</TableCell>
                  <TableCell>
                    <Stack spacing={0.5} alignItems="flex-start">
                      {row.bordado > 0 && <Chip size="small" color="success" variant="outlined" label={`Bordado ${formatCurrency(row.bordado)}`} />}
                      {row.estiloEspecial && <Chip size="small" variant="outlined" label={`Estilo ${formatCurrency(row.estiloEspecialMonto || 0)}`} />}
                      {!row.bordado && !row.estiloEspecial && <Typography variant="body2" color="text.secondary">Sin adicionales</Typography>}
                    </Stack>
                  </TableCell>
                  <TableCell align="center">{`${row.descuento.toFixed(2)}%`}</TableCell>
                  <TableCell>{row.descripcion || "-"}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 650 }}>{formatCurrency(calcularSubtotal(row))}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Button size="small" variant="text" startIcon={<EditOutlined />} onClick={() => editarArticulo(row)}>
                        Editar
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => eliminarArticulo(row.key)}
                      >
                        Eliminar
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {detalle.length > 0 && (
              <TableRow sx={{ backgroundColor: "action.hover" }}>
                <TableCell align="right" colSpan={2} sx={{ fontWeight: 700 }}>
                  Totales
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>
                  {detalleTableTotals.cantidad}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  {formatCurrency(detalleTableTotals.precio)}
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  {formatCurrency(detalleTableTotals.bordado + detalleTableTotals.estiloEspecial)}
                </TableCell>
                <TableCell align="center">-</TableCell>
                <TableCell align="center">-</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  {formatCurrency(detalleTableTotals.subtotal)}
                </TableCell>
                <TableCell align="center">-</TableCell>
              </TableRow>
            )}
            {!detalle.length && (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  Aun no has agregado articulos a la venta.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      </Paper>

      <Grid container spacing={2} justifyContent="flex-end">
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between">
                <Typography>Subtotal</Typography>
                <Typography>{formatCurrency(totals.subtotal)}</Typography>
              </Stack>
              {metodoUsaRecargo && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography>Recargo</Typography>
                  <Typography>{formatCurrency(totals.recargo)}</Typography>
                </Stack>
              )}
              <Stack direction="row" justifyContent="space-between">
                <Typography>Envio</Typography>
                <Typography>{formatCurrency(totals.envio)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography fontWeight={700}>Total</Typography>
                <Typography fontWeight={700}>{formatCurrency(totals.total)}</Typography>
              </Stack>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ mt: 3 }}>
        <Button variant="outlined" onClick={() => navigate("/ventas")} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" color="success" onClick={guardar} disabled={saving}>
          {saving ? "Guardando..." : "Guardar venta"}
        </Button>
      </Stack>

      <Dialog open={bordadosModalOpen} onClose={() => setBordadosModalOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Gestionar bordados de la prenda</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Monto"
                  type="number"
                  fullWidth
                  value={emptyWhenZero(articuloActual.bordado)}
                  onChange={(e) => setArticuloActual((prev) => ({ ...prev, bordado: parseNumberInput(e.target.value) }))}
                  sx={bordadoTextFieldSx}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Color de bordado"
                  fullWidth
                  required
                  value={articuloActual.bordadoColor}
                  onChange={(e) => setArticuloActual((prev) => ({ ...prev, bordadoColor: e.target.value }))}
                  sx={bordadoTextFieldSx}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Tamano de bordado"
                  fullWidth
                  required
                  value={articuloActual.bordadoTamano}
                  onChange={(e) => setArticuloActual((prev) => ({ ...prev, bordadoTamano: e.target.value }))}
                  sx={bordadoTextFieldSx}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Posicion de bordado"
                  fullWidth
                  required
                  value={articuloActual.bordadoPosicion}
                  onChange={(e) => setArticuloActual((prev) => ({ ...prev, bordadoPosicion: e.target.value }))}
                  sx={bordadoTextFieldSx}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Observaciones especiales"
                  fullWidth
                  value={articuloActual.bordadoObservaciones}
                  onChange={(e) => setArticuloActual((prev) => ({ ...prev, bordadoObservaciones: e.target.value }))}
                  sx={bordadoTextFieldSx}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Button variant="outlined" component="label" color="success">
                    Imagen de bordado
                    <input
                      hidden
                      type="file"
                      accept="image/*"
                      aria-label="Seleccionar imagen de bordado"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        if (!file.type.startsWith("image/")) {
                          Swal.fire("Validacion", "Selecciona un archivo de imagen", "warning");
                          return;
                        }
                        const dataUrl = await fileToDataUrl(file);
                        setArticuloActual((prev) => ({ ...prev, bordadoImagenUrl: dataUrl }));
                        setBordadoPreviewOpen(true);
                        event.target.value = "";
                      }}
                    />
                  </Button>
                  <Button variant="text" disabled={!articuloActual.bordadoImagenUrl} onClick={() => setBordadoPreviewOpen(true)}>
                    Vista previa
                  </Button>
                  {articuloActual.bordadoImagenUrl && (
                    <Button variant="text" color="error" onClick={() => setArticuloActual((prev) => ({ ...prev, bordadoImagenUrl: "" }))}>
                      Quitar imagen
                    </Button>
                  )}
                </Stack>
              </Grid>
            </Grid>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }}>
              <Box>
                <Typography variant="subtitle2">Bordados agregados: {articuloActual.bordados.length}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Total de bordados: {formatCurrency(getBordadoTotal(articuloActual.bordados))}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button variant="contained" color="success" onClick={agregarBordadoActual}>
                  Agregar bordado
                </Button>
                <Button variant="text" onClick={limpiarBordadoActual}>
                  Limpiar captura
                </Button>
              </Stack>
            </Stack>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Posicion</TableCell>
                    <TableCell>Color</TableCell>
                    <TableCell>Tamano</TableCell>
                    <TableCell align="right">Monto</TableCell>
                    <TableCell>Imagen</TableCell>
                    <TableCell>Observaciones</TableCell>
                    <TableCell align="center">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {articuloActual.bordados.map((bordado) => (
                    <TableRow key={bordado.key}>
                      <TableCell>{bordado.posicion}</TableCell>
                      <TableCell>{bordado.color}</TableCell>
                      <TableCell>{bordado.tamano}</TableCell>
                      <TableCell align="right">{formatCurrency(bordado.monto)}</TableCell>
                      <TableCell>{bordado.imagenUrl ? "Si" : "No"}</TableCell>
                      <TableCell>{bordado.observaciones || "-"}</TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Button size="small" onClick={() => editarBordadoActual(bordado)}>
                            Editar
                          </Button>
                          <Button size="small" color="error" onClick={() => quitarBordadoActual(bordado.key)}>
                            Quitar
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!articuloActual.bordados.length && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        No hay bordados agregados para esta prenda.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBordadosModalOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bordadoPreviewOpen} onClose={() => setBordadoPreviewOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Vista previa de imagen de bordado</DialogTitle>
        <DialogContent dividers>
          {articuloActual.bordadoImagenUrl ? (
            <Box
              component="img"
              src={articuloActual.bordadoImagenUrl}
              alt="Imagen de bordado"
              sx={{
                width: "100%",
                maxHeight: 420,
                objectFit: "contain",
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
              }}
            />
          ) : (
            <Typography color="text.secondary">No hay imagen cargada.</Typography>
          )}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
