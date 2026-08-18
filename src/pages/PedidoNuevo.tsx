import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Divider,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  createFilterOptions,
  Alert,
  Collapse,
  IconButton,
  Chip,
} from "@mui/material";
import PlaylistAddCheckOutlined from "@mui/icons-material/PlaylistAddCheckOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import KeyboardArrowDownOutlined from "@mui/icons-material/KeyboardArrowDownOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import TuneOutlined from "@mui/icons-material/TuneOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import Swal from "sweetalert2";
import { io, Socket } from "socket.io-client";
import { api } from "../api/axios";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import uniformaLogo from "../assets/3-logos.png";
import { PDF_FONT_FAMILY, PDF_FONT_SEMIBOLD_FAMILY } from "../utils/fontFamily";
import { findPotentialMisspellings } from "../utils/spellcheck";
import { formatCurrency } from "../utils/currency";
import { formatReportScheduleForDay, getActionSchedule, isReportScheduleOpen } from "../utils/reportSchedule";
import { emptyWhenZero, parseNumberInput } from "../utils/numberInputs";
import { createProductSearchEntry, filterIndexedProducts } from "../utils/productSearch";

interface Cliente {
  id: number;
  nombre: string;
  telefono?: string | null;
  correo?: string | null;
  usuarioId?: number | null;
  usuario?: { id?: number; nombre?: string | null; usuario?: string | null } | null;
}

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
}

interface RegistroPostventa {
  id: number;
  folio: string;
  tipo: "cambio" | "devolucion";
  fecha: string;
  clienteNombre: string;
  clienteTelefono?: string | null;
  documentoReferencia?: string | null;
  motivo: string;
  estado: string;
  monto: number;
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
  cantidad: number;
  precioUnit: number;
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
}

interface CapturaArticulo {
  productoId: number | "";
  cantidad: number;
  precioUnit: number;
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
}

const detalleInicial: CapturaArticulo = {
  productoId: "",
  cantidad: 1,
  precioUnit: 0,
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

const escapeHtml = (value?: string | number | null) =>
  `${value ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const BORDADO_OBSERVACION_RE = /^(BORDADO\b.*?\.)\s*(.*)$/i;
const PEDIDO_AUTORIZACION_MONTO_MINIMO = 3000;
const PEDIDO_BORRADOR_TIPO = "pedido-produccion";
const PEDIDO_BORRADOR_LOCAL_KEY = "pedido-produccion:borrador-local:v1";

const buildBordadoObservacionPrefix = (bordados: Array<Pick<BordadoArticulo, "posicion">>) => {
  const posiciones = Array.from(
    new Set(
      (bordados || [])
        .map((bordado) => `${bordado.posicion || ""}`.trim().toUpperCase())
        .filter(Boolean)
    )
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

const formatDetalleObservacionesHtml = (descripcion?: string | null) => {
  const texto = `${descripcion || ""}`.trim();
  const match = texto.match(BORDADO_OBSERVACION_RE);
  if (!match) return escapeHtml(texto);
  return `<span class="bordado-prefix">${escapeHtml(match[1])}</span>${match[2] ? ` ${escapeHtml(match[2])}` : ""}`;
};

const renderDetalleObservaciones = (descripcion?: string | null) => {
  const texto = `${descripcion || ""}`.trim();
  if (!texto) return "-";
  const match = texto.match(BORDADO_OBSERVACION_RE);
  if (!match) return texto;
  return (
    <>
      <Box component="span" sx={{ color: "error.main", fontWeight: 700 }}>
        {match[1]}
      </Box>
      {match[2] ? ` ${match[2]}` : ""}
    </>
  );
};

const formatClienteOption = (cliente: Cliente) => {
  const telefono = formatTelefono(cliente.telefono);
  return telefono ? `${telefono} - ${cliente.nombre}` : cliente.nombre;
};

const filterClienteOptions = createFilterOptions<Cliente>({
  stringify: (cliente) => `${cliente.nombre || ""} ${cliente.telefono || ""}`,
});

type ClientePedido = {
  id?: number | null;
  nombre: string;
  telefono?: string | null;
  correo?: string | null;
};

const normalizeTelefono = (value?: string | null) => `${value || ""}`.replace(/\D/g, "");

const formatTelefono = (value?: string | null) => {
  const digits = normalizeTelefono(value).slice(0, 8);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
};

const escapeInputValue = (value?: string | null) =>
  `${value || ""}`
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const getApiErrorMessage = (error: any, fallback: string) => {
  const data = error?.response?.data;
  const message = data?.message || data?.error || error?.message;
  return Array.isArray(message) ? message.join(", ") : message || fallback;
};

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

  const bordado: BordadoArticulo = {
    key: getBordadoKey(),
    monto,
    color: `${articulo.bordadoColor || "FULL COLOR"}`.trim(),
    tamano: `${articulo.bordadoTamano || "NORMAL"}`.trim(),
    posicion: `${articulo.bordadoPosicion || "PECHO IZQUIERDO"}`.trim(),
    observaciones,
    imagenUrl,
  };
  return bordado;
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

const calcularImportesDetallePedido = (row: Pick<DetalleRow, "cantidad" | "precioUnit" | "bordado" | "estiloEspecial" | "estiloEspecialMonto" | "descuento">) => {
  const cantidad = Number(row.cantidad) || 0;
  const precio = Number(row.precioUnit) || 0;
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

const buildPdfStyles = () => `
  <style>
    @page { size: letter landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; }
    body {
      font-family: ${PDF_FONT_FAMILY};
      margin: 0;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page { width: 100%; max-width: 1320px; margin: 0 auto; padding: 8px 10px 10px; }
    .topline { display:grid; grid-template-columns: 132px 1fr 170px; align-items:start; gap: 12px; margin-bottom: 4px; }
    .logo-wrap { display:flex; justify-content:center; }
    .logo { width: 92px; height: 92px; object-fit: contain; }
    .title-block { text-align:center; padding-top: 6px; }
    .pedido-no { margin: 0; font-size: 30px; font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; font-weight: 600; color: #0f3274; letter-spacing: 0.4px; }
    .pedido-no .value { color: #d60000; }
    .date { text-align:right; font-size: 18px; font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; font-weight: 600; padding-top: 8px; }
    .meta-wrap { margin: 2px auto 16px; width: 560px; }
    .meta-label { text-align:center; font-size: 18px; font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; font-weight: 600; color: #e10600; margin-bottom: 2px; }
    .meta-boxes { display:grid; grid-template-columns: 1fr 1fr; }
    .meta-primary {
      background:#123072;
      color:#fff;
      min-height:50px;
      display:flex;
      align-items:center;
      justify-content:center;
      text-align:center;
      padding: 8px 12px;
      font-size: 16px;
      font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
      font-weight: 600;
    }
    .meta-secondary {
      background:#ff1200;
      color:#fff;
      min-height:50px;
      display:flex;
      align-items:center;
      justify-content:center;
      text-align:center;
      padding: 8px 12px;
      font-size: 15px;
      font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
      font-weight: 600;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 10px;
    }
    .info-card {
      border: 1px solid #0f3274;
      min-height: 56px;
      background: #fff;
    }
    .info-title {
      background: #0f3274;
      color: #fff;
      font-size: 12px;
      font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
      font-weight: 600;
      padding: 4px 8px;
      letter-spacing: 0.3px;
    }
    .info-value {
      padding: 8px;
      font-size: 13px;
      min-height: 34px;
      display:flex;
      align-items:center;
    }
    table { width:100%; border-collapse:collapse; table-layout:fixed; }
    .items-table { font-size: 11px; }
    thead th {
      background:#0f3274;
      color:#fff;
      text-align:center;
      border:1px solid #0f3274;
      padding:6px 4px;
      font-size:11px;
      font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
      font-weight:600;
      white-space:nowrap;
    }
    tbody td {
      border:1px solid #1f1f1f;
      padding:6px 5px;
      font-size:11px;
      text-align:center;
      height:32px;
      line-height:1.2;
      vertical-align:middle;
      word-break:normal;
      overflow-wrap:normal;
    }
    tbody td.text-left { text-align:left; }
    tbody td.wrap {
      white-space:normal;
      overflow-wrap:break-word;
    }
    tbody td.money,
    tbody td.nowrap {
      white-space:nowrap;
    }
    .bordado-prefix {
      color:#d60000;
      font-family:${PDF_FONT_SEMIBOLD_FAMILY};
      font-weight:600;
    }
    .totals {
      width: 340px;
      margin-left: auto;
      margin-top: 12px;
      border: 1px solid #0f3274;
    }
    .totals-row {
      display:flex;
      justify-content:space-between;
      padding:8px 12px;
      font-size:14px;
      border-top:1px solid #cbd5e1;
      background:#fff;
    }
    .totals-row:first-child { border-top:none; }
    .totals-row.total {
      background:#0f3274;
      color:#fff;
      font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
      font-weight:600;
    }
    .footer-note { margin-top:8px; font-size:11px; color:#475569; }
    @media print {
      html, body { width: auto; height: auto; }
      body { margin:0; background:#fff; }
      .page { max-width: none; padding: 0; }
    }
  </style>
`;

export default function PedidoNuevo() {
  const { id: pedidoEditIdParam } = useParams();
  const pedidoEditId = Number(pedidoEditIdParam || 0) || null;
  const isEditingPedido = Boolean(pedidoEditId);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [postventaDocs, setPostventaDocs] = useState<RegistroPostventa[]>([]);
  const [telas, setTelas] = useState<any[]>([]);
  const [tallas, setTallas] = useState<any[]>([]);
  const [colores, setColores] = useState<any[]>([]);
  const [clienteId, setClienteId] = useState<number | "">("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [clienteCorreo, setClienteCorreo] = useState("");
  const [clienteNombre, setClienteNombre] = useState("Mostrador");
  const [bodegaId, setBodegaId] = useState<number | "">("");
  const [ubicacion, setUbicacion] = useState<string>("TIENDA");
  const [metodoPago, setMetodoPago] = useState<string>("efectivo");
  const [pedidoParaStock, setPedidoParaStock] = useState(false);
  const [porcentajeRecargo, setPorcentajeRecargo] = useState<number>(0);
  const [referenciaPago, setReferenciaPago] = useState("");
  const [bancoPago, setBancoPago] = useState("");
  const [anticipo, setAnticipo] = useState<number>(0);
  const [envio, setEnvio] = useState<number>(0);
  const [postventaId, setPostventaId] = useState<number | "">("");
  const [postventaCobro, setPostventaCobro] = useState<"normal" | "sin_cobro">("normal");
  const [postventaSectionOpen, setPostventaSectionOpen] = useState(false);
  const [detalle, setDetalle] = useState<DetalleRow[]>([]);
  const [articuloActual, setArticuloActual] = useState<CapturaArticulo>(detalleInicial);
  const [cantidadInput, setCantidadInput] = useState("1");
  const [editingDetalleKey, setEditingDetalleKey] = useState<number | null>(null);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtrosArticuloOpen, setFiltrosArticuloOpen] = useState(false);
  const [filtroGenero, setFiltroGenero] = useState("");
  const [filtroTela, setFiltroTela] = useState("");
  const [filtroTalla, setFiltroTalla] = useState("");
  const [filtroColor, setFiltroColor] = useState("");
  const [cantidadAdvertida, setCantidadAdvertida] = useState<number | null>(null);
  const [bordadoPreviewOpen, setBordadoPreviewOpen] = useState(false);
  const [bordadosModalOpen, setBordadosModalOpen] = useState(false);
  const [pedidoEditFolio, setPedidoEditFolio] = useState("");
  const [loadingPedidoEdit, setLoadingPedidoEdit] = useState(false);
  const [guardandoPedido, setGuardandoPedido] = useState(false);
  const [scheduleTick, setScheduleTick] = useState(() => Date.now());
  const [documentoBorradorId, setDocumentoBorradorId] = useState<number | null>(null);
  const [borradorGuardadoEn, setBorradorGuardadoEn] = useState("");
  const [borradorEstado, setBorradorEstado] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const autorizacionSocketRef = useRef<Socket | null>(null);
  const borradorInicializadoRef = useRef(false);
  const restaurandoBorradorRef = useRef(false);
  const autoguardadoBorradorBloqueadoRef = useRef(false);
  const ultimoBorradorJsonRef = useRef("");
  const guardandoPedidoRef = useRef(false);
  const complementoSugeridoProductoIdRef = useRef<number | null>(null);
  const autorizacionPendienteRef = useRef<{
    id: number;
    clienteParaPedido: ClientePedido;
    pedidoParaStock: boolean;
    modo?: "creacion" | "edicion";
  } | null>(null);

  const {
    usuario,
    nombre,
    primerNombre,
    primerApellido,
    bodegaNombre: authBodegaNombre,
    rol,
    permisos,
    bodegaId: userBodegaId,
    id: userId,
  } = useAuthStore();
  const usuarioSolicitante =
    [primerNombre?.trim(), primerApellido?.trim()].filter(Boolean).join(" ") ||
    nombre?.trim() ||
    usuario?.trim() ||
    authBodegaNombre?.trim() ||
    "usuario";
  const { fetchConfig, reportesConfig } = useSystemConfigStore();
  const navigate = useNavigate();
  const location = useLocation();
  const returnState = location.state as { returnTo?: string; returnLabel?: string; pedidosState?: any; borradorId?: number } | null;
  const canAccessAllBodegas = hasPermission(rol, permisos, "sistema.multi-tienda");
  const canCrearPedidoSinAutorizacion =
    hasPermission(rol, permisos, "produccion.autorizar-pedidos") ||
    hasPermission(rol, permisos, "produccion.crear-sin-autorizacion");
  const metodoUsaRecargo = metodoPago === "tarjeta" || metodoPago === "visalink";
  const metodoRequiereReferencia = metodoPago !== "efectivo";
  const metodoRequiereBanco = metodoPago === "deposito_bancario";
  const metodoPermiteSinAnticipo = metodoPago === "orden_compra";
  const clienteSeleccionado = clientes.find((c) => c.id === clienteId) || null;
  const postventaSeleccionada = postventaDocs.find((doc) => doc.id === Number(postventaId)) || null;
  const pedidoSinCobro = Boolean(postventaSeleccionada && postventaCobro === "sin_cobro");
  const pedidoSinValor = pedidoSinCobro || pedidoParaStock;
  const pedidoSchedule = useMemo(() => getActionSchedule(reportesConfig, "pedidoNuevo"), [reportesConfig]);
  const pedidoScheduleOpen = useMemo(() => isReportScheduleOpen(pedidoSchedule, new Date(scheduleTick)), [pedidoSchedule, scheduleTick]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setScheduleTick(Date.now()), 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  const volverAlListado = (selectedId?: number | null) => {
    const nextState =
      selectedId && returnState?.pedidosState
        ? {
            ...returnState,
            pedidosState: {
              ...returnState.pedidosState,
              selectedId,
            },
          }
        : returnState || undefined;

    navigate(returnState?.returnTo || "/produccion", {
      state: nextState,
      replace: true,
    });
  };

  const limpiarFormularioPedido = useCallback(() => {
    setPedidoParaStock(false);
    setClienteId("");
    setClienteTelefono("");
    setClienteCorreo("");
    setClienteNombre("Mostrador");
    setBodegaId(userBodegaId && !canAccessAllBodegas ? Number(userBodegaId) || "" : "");
    setUbicacion("TIENDA");
    setMetodoPago("efectivo");
    setPorcentajeRecargo(0);
    setReferenciaPago("");
    setBancoPago("");
    setAnticipo(0);
    setEnvio(0);
    setPostventaId("");
    setPostventaCobro("normal");
    setPostventaSectionOpen(false);
    setDetalle([]);
    setArticuloActual(detalleInicial);
    setCantidadInput("1");
    setEditingDetalleKey(null);
    setFiltroTipo("");
    setFiltroGenero("");
    setFiltroTela("");
    setFiltroTalla("");
    setFiltroColor("");
    setCantidadAdvertida(null);
  }, [canAccessAllBodegas, userBodegaId]);

  const restaurarBorradorPedido = useCallback(
    (data: any) => {
      restaurandoBorradorRef.current = true;
      const encabezado = data?.encabezado || {};
      const captura = data?.capturaArticulo || {};
      setPedidoParaStock(Boolean(encabezado.pedidoParaStock));
      setClienteId(encabezado.clienteId ? Number(encabezado.clienteId) : "");
      setClienteNombre(encabezado.clienteNombre || (encabezado.pedidoParaStock ? "Pedido para stock" : "Mostrador"));
      setClienteTelefono(formatTelefono(encabezado.clienteTelefono || ""));
      setClienteCorreo(`${encabezado.clienteCorreo || ""}`.trim().toLowerCase());
      setBodegaId(encabezado.bodegaId ? Number(encabezado.bodegaId) : "");
      setUbicacion(encabezado.ubicacion || "TIENDA");
      setMetodoPago(encabezado.metodoPago || "efectivo");
      setPorcentajeRecargo(Number(encabezado.porcentajeRecargo || 0));
      setReferenciaPago(`${encabezado.referenciaPago || ""}`);
      setBancoPago(`${encabezado.bancoPago || ""}`);
      setAnticipo(Number(encabezado.anticipo || 0));
      setEnvio(Number(encabezado.envio || 0));
      setPostventaId(encabezado.postventaId ? Number(encabezado.postventaId) : "");
      setPostventaCobro(encabezado.postventaCobro === "sin_cobro" ? "sin_cobro" : "normal");
      setPostventaSectionOpen(Boolean(encabezado.postventaSectionOpen));
      setDetalle(
        (Array.isArray(data?.detalle) ? data.detalle : []).map((item: any, index: number) => ({
          ...item,
          key: Number(item?.key || 0) || Date.now() + index,
          productoId: Number(item?.productoId || 0),
          cantidad: Number(item?.cantidad || 0),
          precioUnit: Number(item?.precioUnit || 0),
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
        cantidad: Number(captura?.cantidad || 1),
        precioUnit: Number(captura?.precioUnit || 0),
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
    },
    [],
  );

  /**
   * Carga los catalogos de forma independiente.
   *
   * Antes usaba Promise.all, asi que el fallo de una sola peticion descartaba
   * las otras seis y dejaba la pantalla inservible. El 18/08, con la base de
   * datos al limite de conexiones, eso impidio crear pedidos aunque casi todo
   * cargaba bien. Con allSettled cada catalogo entra por su cuenta y solo se
   * bloquea si falta alguno sin el que de verdad no se puede trabajar.
   */
  const cargarCatalogos = async () => {
    const peticiones = [
      { nombre: "clientes", esencial: true, promesa: api.get("/clientes/todos") },
      { nombre: "productos", esencial: true, promesa: api.get("/productos") },
      { nombre: "bodegas", esencial: true, promesa: api.get("/bodegas") },
      { nombre: "telas", esencial: false, promesa: api.get("/telas") },
      { nombre: "tallas", esencial: false, promesa: api.get("/tallas") },
      { nombre: "colores", esencial: false, promesa: api.get("/colores") },
      { nombre: "postventa", esencial: false, promesa: api.get("/postventa") },
    ];

    const resultados = await Promise.allSettled(peticiones.map((p) => p.promesa));
    const datos = (i: number): any[] => {
      const r = resultados[i];
      if (r.status !== "fulfilled") return [];
      return Array.isArray(r.value?.data) ? r.value.data : [];
    };

    setClientes(datos(0));
    setProductos(datos(1));
    setBodegas(datos(2));
    setTelas(datos(3));
    setTallas(datos(4));
    setColores(datos(5));
    setPostventaDocs(
      datos(6).filter((doc: RegistroPostventa) => `${doc.estado || ""}`.toLowerCase() !== "anulado"),
    );

    const fallidos = peticiones.filter((_, i) => resultados[i].status === "rejected");
    if (!fallidos.length) return;

    const esenciales = fallidos.filter((f) => f.esencial).map((f) => f.nombre);
    const opcionales = fallidos.filter((f) => !f.esencial).map((f) => f.nombre);

    if (esenciales.length) {
      const resultado = await Swal.fire({
        icon: "error",
        title: "Faltan datos para crear el pedido",
        html: `No se pudieron cargar: <b>${esenciales.join(", ")}</b>.<br/><br/>` +
          "Suele ser un problema temporal del servidor. Puedes reintentar sin perder lo que ya escribiste.",
        showCancelButton: true,
        confirmButtonText: "Reintentar",
        cancelButtonText: "Continuar igual",
      });
      if (resultado.isConfirmed) await cargarCatalogos();
      return;
    }

    // Solo fallaron catalogos accesorios: se avisa sin interrumpir el trabajo.
    Swal.fire({
      icon: "warning",
      title: "Algunos catalogos no cargaron",
      text: `Puedes continuar, pero faltan: ${opcionales.join(", ")}.`,
      timer: 4000,
      timerProgressBar: true,
      showConfirmButton: false,
    });
  };

  useEffect(() => {
    cargarCatalogos();
    void fetchConfig();
  }, [fetchConfig]);

  const finalizarBorradorActual = useCallback(async (documentoFinal?: { tipo?: string; id?: number | null; folio?: string | null }) => {
    autoguardadoBorradorBloqueadoRef.current = true;
    if (!documentoBorradorId) return;
    const id = documentoBorradorId;
    setDocumentoBorradorId(null);
    setBorradorGuardadoEn("");
    setBorradorEstado("idle");
    ultimoBorradorJsonRef.current = "";
    localStorage.removeItem(PEDIDO_BORRADOR_LOCAL_KEY);
    try {
      await api.post(`/documentos-borradores/${id}/finalizar`, {
        documentoFinalTipo: documentoFinal?.tipo || "pedido",
        documentoFinalId: documentoFinal?.id || null,
        documentoFinalFolio: documentoFinal?.folio || null,
      });
    } catch {
      // El pedido ya se genero; si la limpieza del borrador falla, no debe bloquear el flujo principal.
    }
  }, [documentoBorradorId]);

  const descartarBorradorActual = useCallback(async () => {
    const id = documentoBorradorId;
    if (!id) return;
    const result = await Swal.fire({
      title: "Descartar borrador",
      text: "Se eliminara el documento preliminar y se limpiara esta pantalla.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Descartar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d32f2f",
    });
    if (!result.isConfirmed) return;

    try {
      await api.delete(`/documentos-borradores/${id}`);
    } catch {
      // Si ya fue eliminado en otra sesion, igual limpiamos la captura local.
    }
    setDocumentoBorradorId(null);
    setBorradorGuardadoEn("");
    setBorradorEstado("idle");
    ultimoBorradorJsonRef.current = "";
    localStorage.removeItem(PEDIDO_BORRADOR_LOCAL_KEY);
    limpiarFormularioPedido();
    autoguardadoBorradorBloqueadoRef.current = false;
  }, [documentoBorradorId, limpiarFormularioPedido]);

  useEffect(() => {
    if (isEditingPedido || !userId) {
      borradorInicializadoRef.current = true;
      return;
    }

    let cancelled = false;
    const cargarBorrador = async () => {
      try {
        const { data } = returnState?.borradorId
          ? await api.get(`/documentos-borradores/${returnState.borradorId}`)
          : await api.get("/documentos-borradores/activo", {
              params: { tipoDocumento: PEDIDO_BORRADOR_TIPO },
            });
        if (cancelled) return;
        if (!data?.id) {
          borradorInicializadoRef.current = true;
          return;
        }

        const result = await Swal.fire({
          title: "Pedido preliminar encontrado",
          text: "Tienes un pedido que no fue finalizado. Puedes continuar donde lo dejaste o descartarlo.",
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
          restaurarBorradorPedido(data.data || {});
          ultimoBorradorJsonRef.current = JSON.stringify(data.data || {});
        } else if (result.isDenied) {
          await api.delete(`/documentos-borradores/${data.id}`).catch(() => undefined);
          localStorage.removeItem(PEDIDO_BORRADOR_LOCAL_KEY);
        }
      } catch {
        try {
          const localRaw = localStorage.getItem(PEDIDO_BORRADOR_LOCAL_KEY);
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
              restaurarBorradorPedido(localData.data);
              ultimoBorradorJsonRef.current = JSON.stringify(localData.data);
            } else if (result.isDenied) {
              localStorage.removeItem(PEDIDO_BORRADOR_LOCAL_KEY);
            }
          }
        } catch {
          // No bloqueamos la pantalla de pedido si el respaldo local no puede leerse.
        }
      } finally {
        if (!cancelled) borradorInicializadoRef.current = true;
      }
    };

    void cargarBorrador();
    return () => {
      cancelled = true;
    };
  }, [isEditingPedido, restaurarBorradorPedido, returnState?.borradorId, userId]);

  useEffect(() => {
    if (!pedidoEditId) return;
    let cancelled = false;
    const cargarPedidoEdicion = async () => {
      try {
        setLoadingPedidoEdit(true);
        const { data } = await api.get(`/produccion/${pedidoEditId}`);
        if (cancelled) return;
        if (rol !== "ADMIN" && Number(data?.usuarioId || 0) !== Number(userId || 0)) {
          await Swal.fire("Acceso restringido", "Solo el usuario que registro el pedido o un administrador puede modificarlo.", "warning");
          navigate(returnState?.returnTo || "/produccion", {
            state: returnState || undefined,
            replace: true,
          });
          return;
        }
        const metodo = `${data?.metodoPago || "efectivo"}`.trim().toLowerCase();
        const esStock = metodo === "sin_cobro_stock";
        setPedidoEditFolio(data?.folio || `P-${data?.id || pedidoEditId}`);
        setPedidoParaStock(esStock);
        setClienteId(data?.clienteId ? Number(data.clienteId) : "");
        setClienteNombre(data?.clienteNombre || data?.cliente?.nombre || (esStock ? "Pedido para stock" : "Mostrador"));
        setClienteTelefono(formatTelefono(data?.clienteTelefono || data?.cliente?.telefono || ""));
        setClienteCorreo(`${data?.clienteCorreo || data?.cliente?.correo || ""}`.trim().toLowerCase());
        setBodegaId(data?.bodegaId ? Number(data.bodegaId) : "");
        setUbicacion(data?.ubicacion || "TIENDA");
        setMetodoPago(metodo || "efectivo");
        setPorcentajeRecargo(Number(data?.porcentajeRecargo || 0));
        const pagoAnticipo = Array.isArray(data?.pagos)
          ? data.pagos.find((pago: any) => `${pago?.tipo || ""}`.toLowerCase() === "anticipo") || data.pagos[0]
          : null;
        setReferenciaPago(`${pagoAnticipo?.referencia || ""}`);
        setBancoPago(`${pagoAnticipo?.banco || ""}`);
        setAnticipo(Number(data?.anticipo ?? pagoAnticipo?.monto ?? 0));
        setEnvio(Number(data?.envio || 0));
        setPostventaId(data?.postventaId ? Number(data.postventaId) : "");
        setPostventaCobro(data?.postventaCobro === "sin_cobro" ? "sin_cobro" : "normal");
        setDetalle(
          (Array.isArray(data?.detalle) ? data.detalle : []).map((item: any, index: number) => {
            const bordados = Array.isArray(item?.bordados)
              ? item.bordados.map((bordado: any) => ({
                  key: getBordadoKey() + index,
                  monto: Number(bordado?.monto || 0),
                  color: bordado?.color || "FULL COLOR",
                  tamano: bordado?.tamano || "NORMAL",
                  posicion: bordado?.posicion || "PECHO IZQUIERDO",
                  observaciones: bordado?.observaciones || "",
                  imagenUrl: bordado?.imagenUrl || "",
                }))
              : [];
            const bordadosFinales =
              bordados.length > 0
                ? bordados
                : Number(item?.bordado || 0) > 0 || item?.bordadoColor || item?.bordadoPosicion
                  ? [
                      {
                        key: getBordadoKey() + index,
                        monto: Number(item?.bordado || 0),
                        color: item?.bordadoColor || "FULL COLOR",
                        tamano: item?.bordadoTamano || "NORMAL",
                        posicion: item?.bordadoPosicion || "PECHO IZQUIERDO",
                        observaciones: item?.bordadoObservaciones || "",
                        imagenUrl: item?.bordadoImagenUrl || "",
                      },
                    ]
                  : [];
            const primerBordado = bordadosFinales[0] || null;
            return {
              key: Date.now() + index,
              productoId: Number(item?.productoId || item?.producto?.id || 0),
              cantidad: Number(item?.cantidad || 0),
              precioUnit: Number(item?.precioUnit || 0),
              bordado: getBordadoTotal(bordadosFinales),
              bordadoActivo: bordadosFinales.length > 0,
              bordados: bordadosFinales,
              bordadoColor: primerBordado?.color || item?.bordadoColor || "FULL COLOR",
              bordadoTamano: primerBordado?.tamano || item?.bordadoTamano || "NORMAL",
              bordadoPosicion: primerBordado?.posicion || item?.bordadoPosicion || "PECHO IZQUIERDO",
              bordadoObservaciones: primerBordado?.observaciones || item?.bordadoObservaciones || "",
              bordadoImagenUrl: primerBordado?.imagenUrl || item?.bordadoImagenUrl || "",
              estiloEspecial: Boolean(item?.estiloEspecial),
              estiloEspecialMonto: Number(item?.estiloEspecialMonto || 0),
              descuento: Number(item?.descuento || 0),
              descripcion: `${item?.descripcion || ""}`,
            };
          }),
        );
      } catch (error: any) {
        Swal.fire("Error", getApiErrorMessage(error, "No se pudo cargar el pedido para modificar"), "error");
        navigate(returnState?.returnTo || "/produccion", {
          state: pedidoEditId && returnState?.pedidosState
            ? {
                ...returnState,
                pedidosState: {
                  ...returnState.pedidosState,
                  selectedId: pedidoEditId,
                },
              }
            : returnState || undefined,
          replace: true,
        });
      } finally {
        if (!cancelled) setLoadingPedidoEdit(false);
      }
    };
    void cargarPedidoEdicion();
    return () => {
      cancelled = true;
    };
  }, [pedidoEditId, navigate, returnState, rol, userId]);

  const clientePerteneceCartera = (cliente: Cliente) =>
    rol === "ADMIN" || Number(cliente.usuarioId || 0) === Number(userId || 0);

  const alertarClienteFueraCartera = (cliente: Cliente) => {
    Swal.fire(
      "Cliente fuera de cartera",
      `El cliente "${cliente.nombre}" pertenece a ${cliente.usuario?.nombre || cliente.usuario?.usuario || "otro usuario"}. No puedes seleccionarlo.`,
      "warning"
    );
  };

  const sincronizarCliente = (cliente: Cliente) => {
    if (!clientePerteneceCartera(cliente)) {
      alertarClienteFueraCartera(cliente);
      return;
    }
    setClienteId(cliente.id);
    setClienteNombre(cliente.nombre || "Mostrador");
    setClienteTelefono(formatTelefono(cliente.telefono));
    setClienteCorreo(`${cliente.correo || ""}`.trim().toLowerCase());
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
    const formatted = formatTelefono(value);
    setClienteTelefono(formatted);
    const encontrado = buscarClientePorTelefono(value);
    if (encontrado) {
      sincronizarCliente(encontrado);
      return;
    }
    if (clienteId !== "" && Number(clienteId) > 0) setClienteId("");
  };

  useEffect(() => {
    if (userBodegaId && !canAccessAllBodegas) {
      const parsed = Number(userBodegaId);
      const exists = bodegas.some((b) => b.id === parsed);
      setBodegaId(exists ? parsed : "");
    }
  }, [userBodegaId, canAccessAllBodegas, bodegas]);

  useEffect(() => {
    if (!postventaSeleccionada) {
      setPostventaCobro("normal");
      return;
    }
    if (postventaSeleccionada.clienteNombre) {
      setClienteNombre(postventaSeleccionada.clienteNombre);
      setClienteTelefono(formatTelefono(postventaSeleccionada.clienteTelefono));
      setClienteCorreo("");
      if (clienteId !== "" && Number(clienteId) > 0) setClienteId("");
    }
  }, [postventaSeleccionada, clienteId]);

  const totals = useMemo(() => {
    const subtotal = detalle.reduce((sum, d) => {
      return sum + calcularImportesDetallePedido(d).subtotal;
    }, 0);
    const recargo = metodoUsaRecargo ? subtotal * ((porcentajeRecargo || 0) / 100) : 0;
    const envioMonto = Math.max(0, Number(envio) || 0);
    const total = subtotal + recargo + envioMonto;
    const saldoPendiente = total - (Number(anticipo) || 0);
    return { subtotal, recargo, envio: envioMonto, total, saldoPendiente };
  }, [detalle, anticipo, metodoUsaRecargo, porcentajeRecargo, envio]);

  const totalsPedido = pedidoSinValor
    ? { subtotal: 0, recargo: 0, envio: 0, total: 0, saldoPendiente: 0 }
    : totals;

  const detalleTableTotals = useMemo(
    () =>
      detalle.reduce(
        (sum, row) => ({
          cantidad: sum.cantidad + (Number(row.cantidad) || 0),
          precio: sum.precio + calcularImportesDetallePedido(row).precio,
          bordado: sum.bordado + calcularImportesDetallePedido(row).bordado,
          estiloEspecial: sum.estiloEspecial + calcularImportesDetallePedido(row).estiloEspecial,
          subtotal: sum.subtotal + calcularImportesDetallePedido(row).subtotal,
        }),
        {
          cantidad: 0,
          precio: 0,
          bordado: 0,
          estiloEspecial: 0,
          subtotal: 0,
        },
      ),
    [detalle],
  );

  useEffect(() => {
    if (
      isEditingPedido ||
      !userId ||
      !borradorInicializadoRef.current ||
      restaurandoBorradorRef.current ||
      autoguardadoBorradorBloqueadoRef.current
    ) {
      return;
    }

    const hasContenido =
      detalle.length > 0 ||
      Boolean(articuloActual.productoId) ||
      clienteId !== "" ||
      clienteNombre.trim().toLowerCase() !== "mostrador" ||
      Boolean(clienteTelefono.trim()) ||
      Boolean(clienteCorreo.trim()) ||
      pedidoParaStock ||
      Boolean(postventaId) ||
      Boolean(referenciaPago.trim()) ||
      Boolean(bancoPago.trim()) ||
      Number(envio || 0) > 0 ||
      Boolean(filtroTipo || filtroGenero || filtroTela || filtroTalla || filtroColor);

    if (!hasContenido) return;

    const data = {
      version: 1,
      encabezado: {
        clienteId: clienteId === "" ? null : Number(clienteId),
        clienteNombre,
        clienteTelefono,
        clienteCorreo,
        bodegaId: bodegaId === "" ? null : Number(bodegaId),
        ubicacion,
        metodoPago,
        pedidoParaStock,
        porcentajeRecargo,
        referenciaPago,
        bancoPago,
        anticipo,
        envio,
        postventaId: postventaId === "" ? null : Number(postventaId),
        postventaCobro,
        postventaSectionOpen,
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
        PEDIDO_BORRADOR_LOCAL_KEY,
        JSON.stringify({
          tipoDocumento: PEDIDO_BORRADOR_TIPO,
          actualizadoEn: new Date().toISOString(),
          data,
        }),
      );
    } catch {
      // Si el navegador no permite guardar localmente, seguimos con el autoguardado en servidor.
    }

    const timer = window.setTimeout(async () => {
      try {
        if (autoguardadoBorradorBloqueadoRef.current) return;
        setBorradorEstado("saving");
        const { data: saved } = await api.post("/documentos-borradores/autoguardar", {
          id: documentoBorradorId,
          tipoDocumento: PEDIDO_BORRADOR_TIPO,
          titulo: clienteNombre && clienteNombre.trim().toLowerCase() !== "mostrador" ? clienteNombre : "Pedido preliminar",
          bodegaId: bodegaId === "" ? null : Number(bodegaId),
          clienteId: clienteId === "" ? null : Number(clienteId),
          totalEstimado: totalsPedido.total,
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
    clienteCorreo,
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
    isEditingPedido,
    metodoPago,
    pedidoParaStock,
    porcentajeRecargo,
    postventaCobro,
    postventaId,
    postventaSectionOpen,
    referenciaPago,
    totalsPedido.total,
    ubicacion,
    userId,
    anticipo,
  ]);

  useEffect(() => {
    if (pedidoSinValor || metodoPermiteSinAnticipo) {
      setAnticipo(0);
      return;
    }
    const anticipoCalculado = detalle.length ? Number((totals.total * 0.5).toFixed(2)) : 0;
    setAnticipo(anticipoCalculado);
  }, [detalle, totals.total, metodoPermiteSinAnticipo, pedidoSinValor]);

  useEffect(() => {
    if (!pedidoParaStock) return;
    setClienteId("");
    setClienteTelefono("");
    setClienteCorreo("");
    setClienteNombre("Pedido para stock");
    setPostventaId("");
    setPostventaCobro("normal");
    setPostventaSectionOpen(false);
    setMetodoPago("sin_cobro_stock");
    setPorcentajeRecargo(0);
    setReferenciaPago("");
    setBancoPago("");
    setAnticipo(0);
    setEnvio(0);
    setArticuloActual((prev) => ({
      ...prev,
      precioUnit: 0,
      bordado: 0,
      bordadoActivo: false,
      bordados: [],
      bordadoColor: "FULL COLOR",
      bordadoTamano: "NORMAL",
      bordadoPosicion: "PECHO IZQUIERDO",
      bordadoObservaciones: "",
      bordadoImagenUrl: "",
      estiloEspecial: false,
      estiloEspecialMonto: 0,
      descuento: 0,
    }));
    setDetalle((prev) =>
      prev.map((row) => ({
        ...row,
        precioUnit: 0,
        bordado: 0,
        bordadoActivo: false,
        bordados: [],
        bordadoColor: "FULL COLOR",
        bordadoTamano: "NORMAL",
        bordadoPosicion: "PECHO IZQUIERDO",
        bordadoObservaciones: "",
        bordadoImagenUrl: "",
        estiloEspecial: false,
        estiloEspecialMonto: 0,
        descuento: 0,
      })),
    );
  }, [pedidoParaStock]);

  const obtenerTela = (prod?: Producto) => {
    return resolveTelaNombre(prod, telas);
  };

  const obtenerTalla = (prod?: Producto) => {
    return resolveTallaNombre(prod, tallas);
  };

  const obtenerColor = (prod?: Producto) => {
    return resolveColorNombre(prod, colores);
  };

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

  const terminosOrtografiaPedido = useMemo(
    () => [
      filtroTipo,
      filtroGenero,
      filtroTela,
      filtroTalla,
      filtroColor,
      ...tiposDisponibles,
      ...generosDisponibles,
      ...telasDisponibles,
      ...tallasDisponibles,
      ...coloresDisponibles,
      ...productos.flatMap((producto) => [
        producto.codigo,
        producto.nombre,
        producto.tipo,
        producto.genero,
        resolveTelaNombre(producto, telas),
        resolveTallaNombre(producto, tallas),
        resolveColorNombre(producto, colores),
      ]),
    ],
    [
      filtroTipo,
      filtroGenero,
      filtroTela,
      filtroTalla,
      filtroColor,
      tiposDisponibles,
      generosDisponibles,
      telasDisponibles,
      tallasDisponibles,
      coloresDisponibles,
      productos,
      telas,
      tallas,
      colores,
    ],
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

  const productosCoincidentes = useMemo(() => {
    return productosBaseFiltrados.filter((producto) => {
      const matchesTalla = !filtroTalla || resolveTallaNombre(producto, tallas).trim() === filtroTalla;
      const matchesColor = !filtroColor || resolveColorNombre(producto, colores).trim() === filtroColor;
      return matchesTalla && matchesColor;
    });
  }, [productosBaseFiltrados, tallas, colores, filtroTalla, filtroColor]);

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
    setCantidadAdvertida(null);
    setArticuloActual({
      ...detalleInicial,
      cantidad: cantidadSugerida || 1,
      descuento: pedidoParaStock ? 0 : descuentoSugerido || 0,
    });
    setFiltroTipo(complementario.tipo || "");
    setFiltroGenero(complementario.genero || "");
    setFiltroTela(obtenerTela(complementario) === "N/D" ? "" : obtenerTela(complementario));
    setFiltroTalla(obtenerTalla(complementario) === "N/D" ? "" : obtenerTalla(complementario));
    setFiltroColor(obtenerColor(complementario) === "N/D" ? "" : obtenerColor(complementario));
  };

  const filtrosArticuloCompletos = Boolean(filtroTipo && filtroGenero && filtroTela && filtroTalla && filtroColor);
  const alertaArticulo = (() => {
    if (!filtrosArticuloCompletos) {
      return {
        severity: "info" as const,
        message: "Completa tipo, genero, tela, talla y color para detectar el producto automaticamente.",
      };
    }
    if (productosCoincidentes.length === 0) {
      return {
        severity: "warning" as const,
        message: "No existe un producto con esa combinacion. Revisa los filtros antes de agregarlo.",
      };
    }
    if (productosCoincidentes.length > 1) {
      return {
        severity: "warning" as const,
        message: "La combinacion coincide con varios productos. Ajusta los filtros para seleccionar uno solo.",
      };
    }
    return {
      severity: "success" as const,
      message: `Articulo detectado: ${productoDetectado?.codigo || productoDetectado?.nombre || "Producto"}. Revisa la cantidad antes de agregarlo al pedido.`,
    };
  })();

  useEffect(() => {
    if (filtroTipo && !tiposDisponibles.includes(filtroTipo)) {
      setFiltroTipo("");
    }
  }, [filtroTipo, tiposDisponibles]);

  useEffect(() => {
    if (filtroGenero && !generosDisponibles.includes(filtroGenero)) {
      setFiltroGenero("");
    }
  }, [filtroGenero, generosDisponibles]);

  useEffect(() => {
    if (filtroTela && !telasDisponibles.includes(filtroTela)) {
      setFiltroTela("");
    }
  }, [filtroTela, telasDisponibles]);

  useEffect(() => {
    if (filtroTalla && !tallasDisponibles.includes(filtroTalla)) {
      setFiltroTalla("");
    }
  }, [filtroTalla, tallasDisponibles]);

  useEffect(() => {
    if (filtroColor && !coloresDisponibles.includes(filtroColor)) {
      setFiltroColor("");
    }
  }, [filtroColor, coloresDisponibles]);

  useEffect(() => {
    setArticuloActual((prev) => {
      if (!productoDetectado) {
        if (prev.productoId === "" && prev.precioUnit === 0) {
          return prev;
        }
        return {
          ...prev,
          productoId: "",
          precioUnit: 0,
        };
      }
      if (prev.productoId === productoDetectado.id && prev.precioUnit === productoDetectado.precio) {
        return prev;
      }
      return {
        ...prev,
        productoId: productoDetectado.id,
        precioUnit: pedidoParaStock ? 0 : productoDetectado.precio ?? 0,
      };
    });
  }, [productoDetectado, pedidoParaStock]);

  const limpiarArticulo = () => {
    setArticuloActual(detalleInicial);
    setCantidadInput("1");
    setEditingDetalleKey(null);
    setCantidadAdvertida(null);
    setFiltroTipo("");
    setFiltroGenero("");
    setFiltroTela("");
    setFiltroTalla("");
    setFiltroColor("");
    complementoSugeridoProductoIdRef.current = null;
  };

  const agregarArticulo = async () => {
    if (!articuloActual.productoId) {
      Swal.fire("Validacion", alertaArticulo.message, "warning");
      return;
    }
    const posiblesFaltas = findPotentialMisspellings(articuloActual.descripcion, terminosOrtografiaPedido);
    if (posiblesFaltas.length) {
      const result = await Swal.fire({
        title: "Revisa la ortografia",
        html: `Se detectaron posibles faltas en observaciones:<br/><strong>${posiblesFaltas.join(", ")}</strong>`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Agregar de todos modos",
        cancelButtonText: "Corregir",
      });
      if (!result.isConfirmed) return;
    }
    const cantidad = Number(cantidadInput) || 0;
    const productoId = Number(articuloActual.productoId);

    if (cantidad <= 0) {
      Swal.fire("Validacion", "Ingresa una cantidad mayor a 0", "warning");
      return;
    }
    const bordadoEnCaptura = buildBordadoDesdeArticulo(articuloActual);
    const bordadosFinales = !pedidoParaStock
      ? agregarBordadoSiNoExiste(
          articuloActual.bordados.filter(
            (bordado) =>
              Number(bordado.monto || 0) > 0 ||
              Boolean(`${bordado.observaciones || ""}`.trim()) ||
              Boolean(bordado.imagenUrl),
          ),
          bordadoEnCaptura,
        )
      : [];
    const tieneBordado = !pedidoParaStock && (Boolean(articuloActual.bordadoActivo) || bordadosFinales.length > 0);
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
    const descripcionNormalizada = descripcion.trim().toLowerCase();
    const productoDuplicado = detalle.find(
      (item) =>
        item.productoId === productoId &&
        `${item.descripcion || ""}`.trim().toLowerCase() === descripcionNormalizada &&
        item.key !== editingDetalleKey,
    );

    if (productoDuplicado) {
      const producto = productos.find((p) => p.id === productoId);
      Swal.fire(
        "Articulo ya agregado",
        `Este articulo${producto?.nombre ? ` (${producto.nombre})` : ""} con la misma observacion ya esta en la lista temporal. Puedes editarlo o eliminarlo desde la tabla.`,
        "info",
      );
      return;
    }

    const row: DetalleRow = {
      key: editingDetalleKey ?? Date.now(),
      productoId,
      cantidad,
      precioUnit: pedidoParaStock ? 0 : Number(articuloActual.precioUnit) || 0,
      bordado: bordadoTotal,
      bordadoActivo: tieneBordado,
      bordados: bordadosFinales,
      bordadoColor: primerBordado?.color || "",
      bordadoTamano: primerBordado?.tamano || "",
      bordadoPosicion: primerBordado?.posicion || "",
      bordadoObservaciones: primerBordado?.observaciones || "",
      bordadoImagenUrl: primerBordado?.imagenUrl || "",
      estiloEspecial: pedidoParaStock ? false : Boolean(articuloActual.estiloEspecial),
      estiloEspecialMonto: pedidoParaStock || !articuloActual.estiloEspecial ? 0 : Number(articuloActual.estiloEspecialMonto) || 0,
      descuento: pedidoParaStock ? 0 : Number(articuloActual.descuento) || 0,
      descripcion,
    };

    const productoAgregadoDesdeSugerencia = complementoSugeridoProductoIdRef.current === Number(productoId);
    const debeSugerirComplementario = editingDetalleKey === null && !productoAgregadoDesdeSugerencia;
    const productoAgregado = productos.find((p) => Number(p.id) === Number(productoId));
    const cantidadSugerida = cantidad;
    const descuentoSugerido = Number(articuloActual.descuento) || 0;

    setDetalle((prev) =>
      editingDetalleKey === null ? [...prev, row] : prev.map((item) => (item.key === editingDetalleKey ? row : item))
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
      cantidad: row.cantidad,
      precioUnit: row.precioUnit,
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
    });
    setCantidadInput(String(row.cantidad));
    setCantidadAdvertida(row.cantidad);
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

  const togglePedidoParaStock = () => {
    setPedidoParaStock((current) => {
      if (current) {
        setMetodoPago("efectivo");
        setClienteNombre("Mostrador");
        setClienteCorreo("");
      }
      return !current;
    });
  };

  const handleCantidadBlur = () => {
    if (`${cantidadInput}`.trim() === "") {
      setCantidadInput("1");
      setArticuloActual((prev) => ({ ...prev, cantidad: 1 }));
      return;
    }

    const cantidad = Number(cantidadInput) || 0;

    if (cantidad < 5 || cantidadAdvertida === cantidad) {
      return;
    }

    setCantidadAdvertida(cantidad);
    void Swal.fire({
      icon: "warning",
      title: "Revision de cantidad ingresada",
      text: "La cantidad registrada es superior a la habitual para este tipo de pedido. Se recomienda verificar la informacion antes de continuar con el proceso.",
      confirmButtonText: "Entendido",
    });
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

  const mostrarFormularioRegistroCliente = async (datosIniciales: ClientePedido) => {
    const result = await Swal.fire({
      title: "Registrar cliente",
      html: `
        <input id="cliente-nombre" class="swal2-input" placeholder="Nombre" value="${escapeInputValue(datosIniciales.nombre)}">
        <input id="cliente-telefono" class="swal2-input" placeholder="Telefono" value="${escapeInputValue(formatTelefono(datosIniciales.telefono))}">
        <input id="cliente-correo" class="swal2-input" placeholder="Correo (opcional)" value="${escapeInputValue(datosIniciales.correo?.toLowerCase())}">
        <input id="cliente-direccion" class="swal2-input" placeholder="Direccion (opcional)">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Registrar",
      cancelButtonText: "Cancelar",
      preConfirm: () => {
        const nombre = (document.getElementById("cliente-nombre") as HTMLInputElement | null)?.value.trim() || "";
        const telefono = formatTelefono((document.getElementById("cliente-telefono") as HTMLInputElement | null)?.value || "");
        const correo = ((document.getElementById("cliente-correo") as HTMLInputElement | null)?.value.trim() || "").toLowerCase();
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

  const resolverClientePedido = async (): Promise<ClientePedido | false> => {
    const nombreCliente = clienteNombre.trim() || "Mostrador";
    const telefono = formatTelefono(clienteTelefono);
    const correoCliente = clienteCorreo.trim().toLowerCase();
    const mostrador = !telefono && nombreCliente.toLowerCase() === "mostrador";
    const seleccionado =
      clienteId !== "" && Number(clienteId) > 0
        ? clientes.find((cliente) => cliente.id === Number(clienteId)) || null
        : null;
    const existente = seleccionado || buscarClienteExistente(nombreCliente, telefono);

    if (existente) {
      if (!clientePerteneceCartera(existente)) {
        alertarClienteFueraCartera(existente);
        return false;
      }
      sincronizarCliente(existente);
      return {
        id: existente.id,
        nombre: existente.nombre,
        telefono: formatTelefono(existente.telefono) || null,
        correo: correoCliente || `${existente.correo || ""}`.trim().toLowerCase() || null,
      };
    }

    if (mostrador) {
      return {
        id: null,
        nombre: "Mostrador",
        telefono: null,
        correo: correoCliente || null,
      };
    }

    const respuesta = await Swal.fire({
      icon: "question",
      title: "Cliente no registrado",
      text: "Este cliente no existe. ¿Deseas registrarlo antes de crear el pedido?",
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
        nombre: nombreCliente,
        telefono: telefono || null,
        correo: correoCliente || null,
      };
    }

    try {
      const creado = await mostrarFormularioRegistroCliente({ nombre: nombreCliente, telefono, correo: correoCliente });
      if (!creado) return false;
      return {
        id: creado.id,
        nombre: creado.nombre,
        telefono: formatTelefono(creado.telefono) || null,
        correo: `${creado.correo || ""}`.trim().toLowerCase() || null,
      };
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo registrar el cliente";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
      return false;
    }
  };

  const guardar = async () => {
    if (guardandoPedidoRef.current) return;
    const liberarGuardadoPedido = () => {
      guardandoPedidoRef.current = false;
      setGuardandoPedido(false);
    };
    guardandoPedidoRef.current = true;
    setGuardandoPedido(true);
    const horarioPedidoAbiertoAhora = isReportScheduleOpen(pedidoSchedule, new Date());
    if (!isEditingPedido && !horarioPedidoAbiertoAhora) {
      setScheduleTick(Date.now());
      Swal.fire(
        "Horario no habilitado",
        `La creacion de pedidos esta habilitada en este horario: ${formatReportScheduleForDay(pedidoSchedule)}.`,
        "info"
      );
      liberarGuardadoPedido();
      return;
    }
    if (!bodegaId) {
      Swal.fire("Validacion", "Selecciona una bodega", "warning");
      liberarGuardadoPedido();
      return;
    }
    if (!pedidoParaStock && !ubicacion) {
      Swal.fire("Validacion", "Selecciona ubicacion del pedido", "warning");
      liberarGuardadoPedido();
      return;
    }
    if (!pedidoParaStock && postventaCobro === "sin_cobro" && !postventaSeleccionada) {
      Swal.fire("Validacion", "Selecciona el documento de cambio/devolucion para crear un pedido sin valor monetario", "warning");
      liberarGuardadoPedido();
      return;
    }
    if (!pedidoSinValor && !metodoPermiteSinAnticipo && (Number(anticipo) || 0) <= 0) {
      Swal.fire("Validacion", "Ingresa un anticipo mayor a 0", "warning");
      liberarGuardadoPedido();
      return;
    }
    if (!detalle.length) {
      Swal.fire("Validacion", "Agrega al menos un producto", "warning");
      liberarGuardadoPedido();
      return;
    }
    if ((Number(anticipo) || 0) > totalsPedido.total) {
      Swal.fire("Validacion", "El anticipo no puede ser mayor al total del pedido", "warning");
      liberarGuardadoPedido();
      return;
    }
    if (!pedidoSinValor && metodoRequiereReferencia && !referenciaPago.trim()) {
      Swal.fire("Validacion", "Ingresa la referencia o numero de transaccion del pago", "warning");
      liberarGuardadoPedido();
      return;
    }
    if (!pedidoSinValor && metodoRequiereBanco && !bancoPago.trim()) {
      Swal.fire("Validacion", "Ingresa el banco del deposito", "warning");
      liberarGuardadoPedido();
      return;
    }

    const clienteParaPedido = pedidoParaStock
      ? { id: null, nombre: "Pedido para stock", telefono: null, correo: null }
      : await resolverClientePedido();
    if (clienteParaPedido === false) {
      liberarGuardadoPedido();
      return;
    }

    const solicitadoPor = usuarioSolicitante;

    const payload = {
      clienteId: clienteParaPedido.id && Number(clienteParaPedido.id) > 0 ? Number(clienteParaPedido.id) : null,
      clienteNombre: clienteParaPedido.nombre,
      clienteTelefono: clienteParaPedido.telefono || null,
      clienteCorreo: clienteParaPedido.correo || null,
      bodegaId: Number(bodegaId),
      ubicacion: pedidoParaStock ? "TIENDA" : ubicacion,
      observaciones: postventaSeleccionada
        ? `Vinculado a ${postventaSeleccionada.folio} (${postventaSeleccionada.tipo}). ${pedidoSinCobro ? "Pedido sin valor monetario por cambio/devolucion." : "Pedido con cobro normal."}`
        : pedidoParaStock
          ? "Pedido para stock sin valores monetarios."
        : null,
      solicitadoPor,
      totalEstimado: totalsPedido.total,
      anticipo: pedidoSinValor ? 0 : Number(anticipo) || 0,
      envio: totalsPedido.envio,
      metodoPago: pedidoParaStock ? "sin_cobro_stock" : pedidoSinCobro ? "sin_cobro" : metodoPago,
      porcentajeRecargo: pedidoSinValor ? 0 : metodoUsaRecargo ? porcentajeRecargo : 0,
      referenciaPago: !pedidoSinValor && metodoRequiereReferencia ? referenciaPago.trim() : null,
      bancoPago: !pedidoSinValor && metodoRequiereBanco ? bancoPago.trim() : null,
      postventaId: pedidoParaStock ? null : postventaSeleccionada?.id || null,
      postventaCobro: pedidoParaStock ? "normal" : postventaCobro,
      detalle: detalle.map((d) => ({
        productoId: d.productoId,
        cantidad: d.cantidad,
        precioUnit: pedidoParaStock ? 0 : d.precioUnit,
        bordado: pedidoParaStock ? 0 : d.bordado,
        bordadoColor: pedidoParaStock || !d.bordadoActivo ? null : d.bordadoColor,
        bordadoTamano: pedidoParaStock || !d.bordadoActivo ? null : d.bordadoTamano,
        bordadoPosicion: pedidoParaStock || !d.bordadoActivo ? null : d.bordadoPosicion,
        bordadoObservaciones: pedidoParaStock || !d.bordadoActivo ? null : d.bordadoObservaciones,
        bordadoImagenUrl: pedidoParaStock || !d.bordadoActivo ? null : d.bordadoImagenUrl,
        bordados:
          pedidoParaStock || !d.bordadoActivo
            ? []
            : (d.bordados || []).map((bordado) => ({
                monto: Number(bordado.monto) || 0,
                color: bordado.color,
                tamano: bordado.tamano,
                posicion: bordado.posicion,
                observaciones: bordado.observaciones,
                imagenUrl: bordado.imagenUrl,
              })),
        estiloEspecial: pedidoParaStock ? false : d.estiloEspecial,
        estiloEspecialMonto: pedidoParaStock ? 0 : d.estiloEspecialMonto,
        descuento: pedidoParaStock ? 0 : d.descuento,
        descripcion: d.descripcion,
      })),
    };

  const manejarPedidoCreado = (pedidoData: any) => {
      autoguardadoBorradorBloqueadoRef.current = true;
      void finalizarBorradorActual({
        tipo: "pedido",
        id: Number(pedidoData?.id || 0) || null,
        folio: pedidoData?.folio || null,
      });
      Swal.fire("Guardado", "Pedido creado", "success");
      const folioPedido = pedidoData?.folio || (pedidoData?.id ? `P-${pedidoData.id}` : "PEND");
      const fechaPedido = pedidoData?.fecha ? new Date(pedidoData.fecha) : new Date();
      const nuevoPedidoId = Number(pedidoData?.id) || null;
      generarPdfPedidoProduccion(folioPedido, clienteParaPedido, fechaPedido);
      if (pedidoParaStock) {
        setTimeout(() => {
          volverAlListado(nuevoPedidoId);
        }, 300);
        return;
      }
      // Pequeño retraso para que el navegador no bloquee la segunda ventana
      setTimeout(() => {
        generarPdfReciboPedido(folioPedido, clienteParaPedido, fechaPedido);
        // Navegar después de que ambos PDFs se hayan abierto
        setTimeout(() => {
          volverAlListado(nuevoPedidoId);
        }, 300);
      }, 300);
    };

    try {
      if (isEditingPedido && pedidoEditId) {
        if (rol === "ADMIN") {
          const confirmacion = await Swal.fire({
            title: "Guardar cambios",
            text: `Se modificara el pedido ${pedidoEditFolio || `P-${pedidoEditId}`}.`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Guardar",
            cancelButtonText: "Cancelar",
          });
          if (!confirmacion.isConfirmed) return;
          const resp = await api.put(`/produccion/${pedidoEditId}`, payload);
          Swal.fire("Guardado", "Pedido modificado", "success");
          volverAlListado(Number(resp.data?.id || pedidoEditId));
          return;
        }

        const detalleHtml = detalle
          .map((item, index) => {
            const producto = productos.find((p) => p.id === item.productoId);
            return `<li>${index + 1}. ${escapeHtml(producto?.codigo || item.productoId)} - ${escapeHtml(producto?.nombre || "Producto")} (${escapeHtml(item.cantidad)})</li>`;
          })
          .join("");
        const result = await Swal.fire({
          title: "Solicitar autorizacion de cambio",
          html: `
            <div style="text-align:left;font-size:14px;line-height:1.45;">
              <p>Los cambios del pedido ${escapeHtml(pedidoEditFolio || `P-${pedidoEditId}`)} deben ser autorizados por un administrador antes de aplicarse.</p>
              <p><strong>Cliente:</strong> ${escapeHtml(clienteParaPedido.nombre)}<br/>
              <strong>Total estimado:</strong> ${escapeHtml(formatCurrency(totalsPedido.total))}<br/>
              <strong>Detalle actualizado:</strong></p>
              <ul style="max-height:140px;overflow:auto;margin:0 0 12px 18px;padding:0;">${detalleHtml}</ul>
              <label for="pedido-autorizacion-comentario" style="display:block;margin-bottom:6px;font-weight:600;">Comentario para autorizacion</label>
              <textarea id="pedido-autorizacion-comentario" class="swal2-textarea" placeholder="Explica que se modifico..." style="height:90px;margin:0;width:100%;"></textarea>
            </div>
          `,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Solicitar autorizacion",
          cancelButtonText: "Cancelar",
          confirmButtonColor: "#1f3f87",
          width: 680,
          preConfirm: () =>
            (document.getElementById("pedido-autorizacion-comentario") as HTMLTextAreaElement | null)?.value || "",
        });
        if (!result.isConfirmed) return;

        const resp = await api.put(`/produccion/${pedidoEditId}`, {
          ...payload,
          comentarioAutorizacion: result.value || "",
        });
        const solicitudId = Number(resp.data?.id || 0);
        autorizacionPendienteRef.current = {
          id: solicitudId,
          clienteParaPedido,
          pedidoParaStock,
          modo: "edicion",
        };

        const espera = await Swal.fire({
          title: "Esperando autorizacion",
          text: "La solicitud fue enviada. Puedes esperar aqui hasta que se autorice o regresar al modulo de pedidos generados.",
          icon: "info",
          showCancelButton: true,
          showConfirmButton: false,
          cancelButtonText: "Ir a pedidos",
          allowOutsideClick: false,
          allowEscapeKey: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });
        if (espera.dismiss === Swal.DismissReason.cancel && autorizacionPendienteRef.current?.id === solicitudId) {
          autorizacionPendienteRef.current = null;
          volverAlListado(pedidoEditId);
        }
        return;
      }

      const requiereAutorizacion = pedidoParaStock || Number(totalsPedido.total || 0) > PEDIDO_AUTORIZACION_MONTO_MINIMO;
      if (canCrearPedidoSinAutorizacion || !requiereAutorizacion) {
        const resp = await api.post("/produccion", payload);
        manejarPedidoCreado(resp.data);
        return;
      }

      const detalleHtml = detalle
        .map((item, index) => {
          const producto = productos.find((p) => p.id === item.productoId);
          return `<li>${index + 1}. ${escapeHtml(producto?.codigo || item.productoId)} - ${escapeHtml(producto?.nombre || "Producto")} (${escapeHtml(item.cantidad)})</li>`;
        })
        .join("");
      const result = await Swal.fire({
        title: "Este pedido necesita autorizacion",
        html: `
          <div style="text-align:left;font-size:14px;line-height:1.45;">
            <p>Antes de generar el pedido, se enviara una solicitud a los usuarios autorizados porque ${pedidoParaStock ? "es un pedido para stock" : `supera ${escapeHtml(formatCurrency(PEDIDO_AUTORIZACION_MONTO_MINIMO))}`}.</p>
            <p><strong>Cliente:</strong> ${escapeHtml(clienteParaPedido.nombre)}<br/>
            <strong>Total estimado:</strong> ${escapeHtml(formatCurrency(totalsPedido.total))}<br/>
            <strong>Detalle:</strong></p>
            <ul style="max-height:140px;overflow:auto;margin:0 0 12px 18px;padding:0;">${detalleHtml}</ul>
            <label for="pedido-autorizacion-comentario" style="display:block;margin-bottom:6px;font-weight:600;">Comentario para autorizacion</label>
            <textarea id="pedido-autorizacion-comentario" class="swal2-textarea" placeholder="Explica brevemente por que debe autorizarse..." style="height:90px;margin:0;width:100%;"></textarea>
          </div>
        `,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Solicitar autorizacion",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#1f3f87",
        width: 680,
        preConfirm: () =>
          (document.getElementById("pedido-autorizacion-comentario") as HTMLTextAreaElement | null)?.value || "",
      });
      if (!result.isConfirmed) return;

      const resp = await api.post("/produccion/autorizaciones", {
        pedido: payload,
        comentario: result.value || "",
      });
      const solicitudId = Number(resp.data?.id || 0);
      autorizacionPendienteRef.current = {
        id: solicitudId,
        clienteParaPedido,
        pedidoParaStock,
        modo: "creacion",
      };

      const espera = await Swal.fire({
        title: "Esperando autorizacion",
        text: "La solicitud fue enviada. Puedes esperar aqui hasta que se autorice o regresar al modulo de pedidos generados.",
        icon: "info",
        showCancelButton: true,
        showConfirmButton: false,
        cancelButtonText: "Ir a pedidos",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });
      if (espera.dismiss === Swal.DismissReason.cancel && autorizacionPendienteRef.current?.id === solicitudId) {
        autorizacionPendienteRef.current = null;
        volverAlListado();
      }
    } catch (error: any) {
      Swal.fire("Error", getApiErrorMessage(error, "No se pudo guardar"), "error");
    } finally {
      guardandoPedidoRef.current = false;
      setGuardandoPedido(false);
    }
  };

  const generarPdfReciboPedido = (id: number | string, clienteSnapshot?: ClientePedido, fechaPedido?: Date | string) => {
    const win = window.open("", "_blank");
    if (!win) {
      Swal.fire("Aviso", "Habilita las ventanas emergentes para ver el PDF", "info");
      return;
    }
    const fechaImpresion = new Date();
    const fechaDocumento = fechaPedido ? new Date(fechaPedido) : fechaImpresion;
    const clienteNombrePdf =
      clienteSnapshot?.nombre ||
      clienteNombre.trim() ||
      clientes.find((c) => c.id === (clienteId === "" ? null : Number(clienteId)))?.nombre ||
      "Mostrador";
    const clienteTelefonoPdf = formatTelefono(clienteSnapshot?.telefono || clienteTelefono);
    const bodegaNombre = bodegas.find((b) => b.id === Number(bodegaId))?.nombre || "N/D";
    const logoUrl = uniformaLogo;
    const filasHtml = detalle
      .map((d, idx) => {
        const prod = productos.find((p) => p.id === d.productoId);
        const estiloEspecialMonto = d.estiloEspecial ? Number(d.estiloEspecialMonto) || 0 : 0;
        const baseConEstilo = (Number(d.precioUnit) || 0) + estiloEspecialMonto;
        const precioConDescuento = baseConEstilo * (1 - (Number(d.descuento) || 0) / 100);
        const subtotal = (d.cantidad || 0) * (precioConDescuento + (Number(d.bordado) || 0));
        return `<tr>
          <td>${idx + 1}</td>
          <td class="nowrap">${escapeHtml(prod?.codigo || d.productoId)}</td>
          <td class="wrap">${escapeHtml(prod?.nombre || "Producto")}</td>
          <td class="text-left wrap">${escapeHtml(d.descripcion || "")}</td>
          <td class="nowrap">${escapeHtml(d.cantidad)}</td>
          <td class="money">${escapeHtml(formatCurrency(d.precioUnit || 0))}</td>
          <td class="money">${escapeHtml(formatCurrency(Number(d.bordado) || 0))}</td>
          <td class="money">${escapeHtml(formatCurrency(estiloEspecialMonto))}</td>
          <td class="nowrap">${escapeHtml((d.descuento || 0).toFixed(2))}%</td>
          <td class="money">${escapeHtml(formatCurrency(subtotal))}</td>
        </tr>`;
      })
      .join("");

    const html = `<!doctype html>
      <html><head><meta charset="utf-8" />
      <title>Recibo de Pedido</title>
      ${buildPdfStyles()}
      </head>
      <body>
        <div class="page">
          <div class="topline">
            <div class="logo-wrap">
              <img class="logo" src="${logoUrl}" alt="Uniforma" />
            </div>
            <div class="title-block">
              <h1 class="pedido-no">RECIBO No.: <span class="value">${escapeHtml(id)}</span></h1>
            </div>
            <div class="date">${escapeHtml(fechaImpresion.toLocaleDateString("es-GT"))}</div>
          </div>

          <div class="meta-wrap">
            <div class="meta-label">RECIBO DE PEDIDO</div>
            <div class="meta-boxes">
              <div class="meta-primary">${escapeHtml(bodegaNombre.toUpperCase())}</div>
              <div class="meta-secondary">${escapeHtml(pedidoSinCobro ? "SIN COBRO" : metodoPago.toUpperCase())}</div>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-card">
              <div class="info-title">CLIENTE</div>
              <div class="info-value">${escapeHtml(clienteNombrePdf)}</div>
            </div>
            ${
              clienteTelefonoPdf
                ? `<div class="info-card">
                    <div class="info-title">TELEFONO</div>
                    <div class="info-value">${escapeHtml(clienteTelefonoPdf)}</div>
                  </div>`
                : ""
            }
            <div class="info-card">
              <div class="info-title">BODEGA</div>
              <div class="info-value">${escapeHtml(bodegaNombre)}</div>
            </div>
            <div class="info-card">
              <div class="info-title">USUARIO</div>
              <div class="info-value">${escapeHtml(usuarioSolicitante)}</div>
            </div>
            <div class="info-card">
              <div class="info-title">METODO DE PAGO</div>
              <div class="info-value">${escapeHtml(pedidoSinCobro ? "Sin cobro por cambio/devolucion" : metodoPago)}</div>
            </div>
            ${
              postventaSeleccionada
                ? `<div class="info-card">
                    <div class="info-title">DOCUMENTO CAMBIO/DEV.</div>
                    <div class="info-value">${escapeHtml(postventaSeleccionada.folio)}</div>
                  </div>`
                : ""
            }
            ${
              !pedidoSinCobro && metodoRequiereReferencia
                ? `<div class="info-card">
                    <div class="info-title">REFERENCIA</div>
                    <div class="info-value">${escapeHtml(referenciaPago.trim())}</div>
                  </div>`
                : ""
            }
            <div class="info-card">
              <div class="info-title">FECHA Y HORA</div>
              <div class="info-value">${escapeHtml(
                `${fechaDocumento.toLocaleDateString("es-GT")} ${fechaDocumento.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}`
              )}</div>
            </div>
          </div>

          <table class="items-table">
            <colgroup>
              <col style="width:4%;" />
              <col style="width:9%;" />
              <col style="width:18%;" />
              <col style="width:18%;" />
              <col style="width:5%;" />
              <col style="width:9%;" />
              <col style="width:9%;" />
              <col style="width:9%;" />
              <col style="width:7%;" />
              <col style="width:12%;" />
            </colgroup>
            <thead>
              <tr><th>#</th><th>CODIGO</th><th>PRODUCTO</th><th>DETALLE</th><th>CANT.</th><th>PRECIO</th><th>BORDADO</th><th>ESTILO ESP.</th><th>DESC.</th><th>SUBTOTAL</th></tr>
            </thead>
            <tbody>${filasHtml}</tbody>
          </table>

          ${
            pedidoSinCobro
              ? `<div class="footer-note"><strong>Pedido sin valor monetario:</strong> cubierto por ${escapeHtml(postventaSeleccionada?.folio || "documento de cambio/devolucion")}.</div>`
              : ""
          }
          <div class="totals">
            <div class="totals-row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(totalsPedido.subtotal))}</span></div>
            ${!pedidoSinCobro && metodoUsaRecargo
              ? `<div class="totals-row"><span>Recargo (${porcentajeRecargo || 0}%)</span><span>${formatCurrency(totalsPedido.recargo)}</span></div>`
              : ""
            }
            <div class="totals-row"><span>Envio</span><span>${escapeHtml(formatCurrency(totalsPedido.envio))}</span></div>
            <div class="totals-row"><span>Anticipo</span><span>${escapeHtml(formatCurrency(pedidoSinCobro ? 0 : Number(anticipo) || 0))}</span></div>
            <div class="totals-row total"><span>Total</span><span>${escapeHtml(formatCurrency(totalsPedido.total))}</span></div>
          </div>
        </div>
        <script>window.onload = function(){ window.print(); }</script>
      </body></html>`;
    win.document.write(html);
    win.document.close();
  };

  const generarPdfPedidoProduccion = (id: number | string, clienteSnapshot?: ClientePedido, fechaPedido?: Date | string) => {
    const win = window.open("", "_blank");
    if (!win) {
      Swal.fire("Aviso", "Habilita las ventanas emergentes para ver el PDF", "info");
      return;
    }
    const fechaImpresion = new Date();
    const fechaDocumento = fechaPedido ? new Date(fechaPedido) : fechaImpresion;
    const clienteNombrePdf =
      clienteSnapshot?.nombre ||
      clienteNombre.trim() ||
      clientes.find((c) => c.id === (clienteId === "" ? null : Number(clienteId)))?.nombre ||
      "Mostrador";
    const clienteTelefonoPdf = formatTelefono(clienteSnapshot?.telefono || clienteTelefono);
    const bodegaNombre = bodegas.find((b) => b.id === Number(bodegaId))?.nombre || "N/D";
    const logoUrl = uniformaLogo;
    const filasHtml = detalle
      .map((d, idx) => {
        const prod = productos.find((p) => p.id === d.productoId);
        return `<tr>
          <td>${escapeHtml(d.cantidad)}</td>
          <td>${escapeHtml(prod?.tipo || "N/D")}</td>
          <td>${escapeHtml(prod?.genero || "N/D")}</td>
          <td>${escapeHtml(obtenerTela(prod))}</td>
          <td>${escapeHtml(obtenerColor(prod))}</td>
          <td>${escapeHtml(obtenerTalla(prod))}</td>
          <td class="text-left">${formatDetalleObservacionesHtml(d.descripcion)}</td>
        </tr>`;
      })
      .join("");

    const html = `<!doctype html>
      <html><head><meta charset="utf-8" />
      <title>Orden de produccion</title>
      ${buildPdfStyles()}
      </head>
      <body>
        <div class="page">
          <div class="topline">
            <div class="logo-wrap">
              <img class="logo" src="${logoUrl}" alt="Uniforma" />
            </div>
            <div class="title-block">
              <h1 class="pedido-no">PEDIDO No.: <span class="value">${escapeHtml(id)}</span></h1>
            </div>
            <div class="date">${escapeHtml(fechaImpresion.toLocaleDateString("es-GT"))}</div>
          </div>

          <div class="meta-wrap" style="width:418px;">
            <div class="meta-label">ORDEN DE PRODUCCION</div>
            <div class="meta-boxes" style="grid-template-columns: 1fr 210px;">
              <div class="meta-primary">${escapeHtml(bodegaNombre.toUpperCase())}</div>
              <div class="meta-secondary">RECIBIDO NOMBRE:</div>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-card">
              <div class="info-title">CLIENTE</div>
              <div class="info-value">${escapeHtml(clienteNombrePdf)}</div>
            </div>
            ${
              clienteTelefonoPdf
                ? `<div class="info-card">
                    <div class="info-title">TELEFONO</div>
                    <div class="info-value">${escapeHtml(clienteTelefonoPdf)}</div>
                  </div>`
                : ""
            }
            <div class="info-card">
              <div class="info-title">BODEGA</div>
              <div class="info-value">${escapeHtml(bodegaNombre)}</div>
            </div>
            <div class="info-card">
              <div class="info-title">USUARIO</div>
              <div class="info-value">${escapeHtml(usuarioSolicitante)}</div>
            </div>
            <div class="info-card">
              <div class="info-title">ARTICULOS</div>
              <div class="info-value">${escapeHtml(detalle.length)}</div>
            </div>
            <div class="info-card">
              <div class="info-title">FECHA Y HORA</div>
              <div class="info-value">${escapeHtml(
                `${fechaDocumento.toLocaleDateString("es-GT")} ${fechaDocumento.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}`
              )}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr><th style="width:78px;">CANT</th><th style="width:180px;">TIPO</th><th style="width:100px;">GENERO</th><th style="width:104px;">TELA</th><th style="width:104px;">COLOR</th><th style="width:106px;">TALLA</th><th>OBSERVACIONES</th></tr>
            </thead>
            <tbody>${filasHtml}</tbody>
          </table>
        </div>
        <script>window.onload = function(){ window.print(); }</script>
      </body></html>`;
    win.document.write(html);
    win.document.close();
  };

  const manejarAutorizacionResuelta = useEffectEvent((payload: any) => {
      const pendiente = autorizacionPendienteRef.current;
      if (!pendiente || Number(payload?.solicitudId || 0) !== pendiente.id) return;
      if (payload?.solicitanteId && Number(payload.solicitanteId) !== Number(userId || 0)) return;

      autorizacionPendienteRef.current = null;
      Swal.close();

      if (payload?.estado === "aprobado") {
        autoguardadoBorradorBloqueadoRef.current = true;
        void finalizarBorradorActual({
          tipo: "pedido",
          id: Number(payload?.pedido?.id || payload?.pedidoId || 0) || null,
          folio: payload?.pedido?.folio || null,
        });
        const pedido = payload?.pedido || {};
        const folioPedido = pedido?.folio || (pedido?.id ? `P-${pedido.id}` : "PEND");
        const fechaPedido = pedido?.fecha ? new Date(pedido.fecha) : new Date();
        const nuevoPedidoId = Number(pedido?.id) || null;
        if (pendiente.modo === "edicion") {
          Swal.fire("Autorizado", "El cambio fue autorizado y el pedido quedo modificado.", "success");
          setTimeout(() => volverAlListado(nuevoPedidoId), 300);
          return;
        }
        Swal.fire("Autorizado", "El pedido fue autorizado y generado correctamente.", "success");
        generarPdfPedidoProduccion(folioPedido, pendiente.clienteParaPedido, fechaPedido);
        if (pendiente.pedidoParaStock) {
          setTimeout(() => volverAlListado(nuevoPedidoId), 300);
          return;
        }
        setTimeout(() => {
          generarPdfReciboPedido(folioPedido, pendiente.clienteParaPedido, fechaPedido);
          setTimeout(() => volverAlListado(nuevoPedidoId), 300);
        }, 300);
        return;
      }

      if (payload?.estado === "reemplazada") {
        Swal.fire(
          "Solicitud reemplazada",
          payload?.comentario || "Se envio una nueva solicitud para este pedido. La solicitud anterior quedo sin efecto.",
          "info",
        );
        return;
      }

      Swal.fire(
        "Solicitud rechazada",
        payload?.comentario ? `Motivo: ${payload.comentario}` : "El pedido no fue autorizado.",
        "warning",
      );
    });

  useEffect(() => {
    const socket = io(api.defaults.baseURL || window.location.origin, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    autorizacionSocketRef.current = socket;

    socket.on("produccion:autorizacion-resuelta", manejarAutorizacionResuelta);

    return () => {
      socket.off("produccion:autorizacion-resuelta", manejarAutorizacionResuelta);
      socket.disconnect();
      autorizacionSocketRef.current = null;
    };
    // Effect Events read the latest values without forcing a socket re-subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <Stack spacing={2.25}>
      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, position: "sticky", top: { xs: 60, md: 68 }, zIndex: 10, bgcolor: "background.paper" }}>
        <Stack direction={{ xs: "column", lg: "row" }} alignItems={{ xs: "stretch", lg: "center" }} justifyContent="space-between" spacing={1.5}>
          <Box>
            <Typography variant="h4" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <PlaylistAddCheckOutlined color="primary" />
              {isEditingPedido ? `Modificar ${pedidoEditFolio || "pedido"}` : "Nuevo pedido"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Define la prenda, confirma el anticipo y enviala a produccion con toda la informacion necesaria.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip label={`${detalleTableTotals.cantidad} unidad${detalleTableTotals.cantidad === 1 ? "" : "es"}`} variant="outlined" />
            {!pedidoParaStock && <Chip label={`Total ${formatCurrency(totalsPedido.total)}`} color="primary" />}
            {!pedidoParaStock && <Chip label={`Saldo ${formatCurrency(Math.max(0, totalsPedido.saldoPendiente))}`} variant="outlined" />}
            <Button variant={pedidoParaStock ? "contained" : "outlined"} color={pedidoParaStock ? "success" : "primary"} onClick={togglePedidoParaStock} disabled={loadingPedidoEdit}>
              Pedido para stock
            </Button>
            <Button variant="outlined" startIcon={<ArrowBackOutlined />} onClick={() => volverAlListado()}>Volver</Button>
          </Stack>
        </Stack>
      </Paper>
      {isEditingPedido && (
        <Alert severity={rol === "ADMIN" ? "info" : "warning"} sx={{ mb: 2 }}>
          {rol === "ADMIN"
            ? "Como administrador puedes guardar cambios directamente."
            : "Los cambios que realices se enviaran a autorizacion antes de aplicarse al pedido."}
        </Alert>
      )}
      {!isEditingPedido && documentoBorradorId && (
        <Alert
          severity={borradorEstado === "error" ? "warning" : "info"}
          action={
            <Button color="inherit" size="small" onClick={descartarBorradorActual}>
              DESCARTAR
            </Button>
          }
        >
          {borradorEstado === "saving"
            ? `Guardando pedido preliminar PRE-${String(documentoBorradorId).padStart(6, "0")}...`
            : borradorEstado === "error"
              ? "No se pudo autoguardar el pedido preliminar. Revisa tu conexion."
              : `Pedido preliminar PRE-${String(documentoBorradorId).padStart(6, "0")} guardado${borradorGuardadoEn ? ` (${new Date(borradorGuardadoEn).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })})` : ""}.`}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="overline" color="primary" fontWeight={700}>01</Typography>
          <Typography variant="h6">Cliente y pedido</Typography>
        </Stack>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 3 }}>
          <FormControl fullWidth>
            <InputLabel>Bodega</InputLabel>
            <Select
              label="Bodega"
              value={bodegaId === "" ? "" : bodegaId}
              onChange={(e) => setBodegaId(Number(e.target.value))}
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
        {!pedidoParaStock && (
          <Grid size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Ubicacion</InputLabel>
              <Select label="Ubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)}>
                <MenuItem value="TIENDA">TIENDA</MenuItem>
                <MenuItem value="CAPITAL">CAPITAL</MenuItem>
                <MenuItem value="DEPARTAMENTO">DEPARTAMENTO</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        )}
        {!pedidoParaStock && (
          <Grid size={{ xs: 12, sm: 3 }}>
            <Autocomplete<Cliente, false, false, true>
            freeSolo
            options={clientes.filter((cliente) => `${cliente.telefono || ""}`.trim())}
            getOptionLabel={(option) =>
              typeof option === "string" ? formatTelefono(option) : formatTelefono(option.telefono)
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
              setClienteCorreo("");
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
        )}
        {!pedidoParaStock && (
          <Grid size={{ xs: 12, sm: 3 }}>
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
              helperText="Se guardara con el pedido"
            />
          </Grid>
        )}
        {!pedidoParaStock && (
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              label="Correo del cliente"
              type="email"
              fullWidth
              value={clienteCorreo}
              onChange={(e) => setClienteCorreo(e.target.value.toLowerCase())}
              helperText="Se usara para enviar el tracking"
            />
          </Grid>
        )}
      </Grid>
      </Paper>

      {!pedidoParaStock && (
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          onClick={() => setPostventaSectionOpen((open) => !open)}
          sx={{ cursor: "pointer" }}
        >
          <Typography variant="h6">Vinculo con cambio/devolucion</Typography>
          <IconButton
            size="small"
            aria-label={postventaSectionOpen ? "Ocultar vinculo con cambio/devolucion" : "Mostrar vinculo con cambio/devolucion"}
            sx={{
              transform: postventaSectionOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 160ms ease-in-out",
            }}
          >
            <KeyboardArrowDownOutlined />
          </IconButton>
        </Stack>

        <Collapse in={postventaSectionOpen} timeout="auto" unmountOnExit>
          <Grid container spacing={2} alignItems="center" sx={{ mt: 2 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Documento de cambio/devolucion</InputLabel>
                <Select
                  label="Documento de cambio/devolucion"
                  value={postventaId === "" ? "" : postventaId}
                  onChange={(e) => {
                    const value = e.target.value as string | number;
                    setPostventaId(value === "" ? "" : Number(value));
                  }}
                >
                  <MenuItem value="">Sin vincular</MenuItem>
                  {postventaDocs.map((doc) => (
                    <MenuItem key={doc.id} value={doc.id}>
                      {`${doc.folio} - ${doc.tipo === "cambio" ? "Cambio" : "Devolucion"} - ${doc.clienteNombre}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth disabled={!postventaSeleccionada}>
                <InputLabel>Tratamiento del cobro</InputLabel>
                <Select
                  label="Tratamiento del cobro"
                  value={postventaCobro}
                  onChange={(e) => setPostventaCobro(e.target.value as "normal" | "sin_cobro")}
                >
                  <MenuItem value="normal">Con cobro normal</MenuItem>
                  <MenuItem value="sin_cobro">Sin valor monetario</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={pedidoSinCobro}
                    disabled={!postventaSeleccionada}
                    onChange={(e) => setPostventaCobro(e.target.checked ? "sin_cobro" : "normal")}
                  />
                }
                label="Cubierto por cambio/devolucion"
              />
            </Grid>
            {postventaSeleccionada && (
              <Grid size={{ xs: 12 }}>
                <Alert severity={pedidoSinCobro ? "warning" : "info"}>
                  {pedidoSinCobro
                    ? `El pedido quedara ligado a ${postventaSeleccionada.folio} y se enviara a produccion sin total, anticipo ni saldo pendiente.`
                    : `El pedido quedara ligado a ${postventaSeleccionada.folio}, pero se cobrara normalmente.`}
                </Alert>
              </Grid>
            )}
          </Grid>
        </Collapse>
      </Paper>
      )}

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} gap={1} sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="overline" color="primary" fontWeight={700}>02</Typography>
            <Typography variant="h6">Agregar articulo</Typography>
          </Stack>
          <Button
            size="small"
            variant={filtrosArticuloOpen ? "contained" : "outlined"}
            startIcon={<TuneOutlined />}
            endIcon={<ExpandMoreOutlined sx={{ transform: filtrosArticuloOpen ? "rotate(180deg)" : "none", transition: "transform 160ms" }} />}
            onClick={() => setFiltrosArticuloOpen((open) => !open)}
          >
            Filtros del producto
          </Button>
        </Stack>
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Selecciona la combinacion del articulo y agregalo a la lista temporal antes de guardar el pedido.
          </Typography>
          <Alert severity={alertaArticulo.severity}>{alertaArticulo.message}</Alert>
        </Stack>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <Autocomplete
              options={productos}
              value={productoDetectado || null}
              getOptionLabel={(producto) => `${upperText(producto.codigo)} · ${upperText(producto.nombre)} · TALLA ${upperText(resolveTallaNombre(producto, tallas))}`}
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
                        <Typography variant="body2" fontWeight={500}><Box component="span" sx={{ fontWeight: 650 }}>{upperText(producto.codigo)}</Box> · {upperText(producto.nombre)} · TALLA {upperText(resolveTallaNombre(producto, tallas))}</Typography>
                        {!pedidoParaStock && <Typography variant="body2" color="primary.main" fontWeight={600} sx={{ whiteSpace: "nowrap" }}>{formatCurrency(producto.precio)}</Typography>}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.45, lineHeight: 1.45 }}>{detalles.join(" · ")}</Typography>
                    </Box>
                  </li>
                );
              }}
              renderInput={(params) => <TextField {...params} label="BUSCAR PRODUCTO" placeholder="CÓDIGO, NOMBRE O VARIANTE" helperText="Busca en cualquier orden por código, nombre, talla, tela o color" inputProps={{ ...params.inputProps, style: { textTransform: "uppercase" } }} />}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Collapse in={filtrosArticuloOpen} timeout="auto">
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
          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
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
                setCantidadAdvertida((prev) => (prev !== null && prev !== cantidad ? null : prev));
                setCantidadInput(normalizado);
                setArticuloActual((prev) => ({ ...prev, cantidad }));
              }}
              onBlur={handleCantidadBlur}
            />
          </Grid>
          {!pedidoParaStock && (
            <>
              <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                <TextField
                  label="Precio"
                  type="number"
                  fullWidth
                  value={articuloActual.precioUnit}
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
              {false && articuloActual.bordadoActivo && (
                <>
                  <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                    <TextField
                      label="Color de bordado"
                      fullWidth
                      required
                      value={articuloActual.bordadoColor}
                      onChange={(e) => setArticuloActual((prev) => ({ ...prev, bordadoColor: e.target.value }))}
                      sx={bordadoTextFieldSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                    <TextField
                      label="Tamano de bordado"
                      fullWidth
                      required
                      value={articuloActual.bordadoTamano}
                      onChange={(e) => setArticuloActual((prev) => ({ ...prev, bordadoTamano: e.target.value }))}
                      sx={bordadoTextFieldSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                    <TextField
                      label="Posicion de bordado"
                      fullWidth
                      required
                      value={articuloActual.bordadoPosicion}
                      onChange={(e) => setArticuloActual((prev) => ({ ...prev, bordadoPosicion: e.target.value }))}
                      sx={bordadoTextFieldSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 8, md: 4 }}>
                    <TextField
                      label="Observaciones especiales"
                      fullWidth
                      value={articuloActual.bordadoObservaciones}
                      onChange={(e) => setArticuloActual((prev) => ({ ...prev, bordadoObservaciones: e.target.value }))}
                      sx={bordadoTextFieldSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 8, md: 4 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Button variant="outlined" component="label" color="success">
                        Imagen de bordado (opcional)
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
                      <Button
                        variant="text"
                        disabled={!articuloActual.bordadoImagenUrl}
                        onClick={() => setBordadoPreviewOpen(true)}
                      >
                        Vista previa
                      </Button>
                      {articuloActual.bordadoImagenUrl && (
                        <Button
                          variant="text"
                          color="error"
                          onClick={() => setArticuloActual((prev) => ({ ...prev, bordadoImagenUrl: "" }))}
                        >
                          Quitar
                        </Button>
                      )}
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Paper variant="outlined" sx={{ p: 1.5, borderColor: "success.light", bgcolor: "#f8fff9" }}>
                      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between">
                        <Box>
                          <Typography variant="subtitle2" color="success.dark">
                            Bordados de esta prenda: {articuloActual.bordados.length}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Agrega uno por cada ubicación o imagen diferente. El monto total se suma al artículo.
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
                      {articuloActual.bordados.length > 0 && (
                        <TableContainer sx={{ mt: 1.5 }}>
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
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </Paper>
                  </Grid>
                </>
              )}
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
              <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                <TextField
                  label="Descuento %"
                  type="number"
                  fullWidth
                  value={emptyWhenZero(articuloActual.descuento)}
                  onChange={(e) =>
                    setArticuloActual((prev) => ({ ...prev, descuento: parseNumberInput(e.target.value) }))
                  }
                />
              </Grid>
            </>
          )}
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
              {editingDetalleKey === null ? "Agregar al pedido" : "Guardar cambios"}
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
      <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, minWidth: 280 }}>Producto</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Cantidad</TableCell>
              {!pedidoParaStock && (
                <>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Precio</TableCell>
                  <TableCell sx={{ fontWeight: 700, minWidth: 170 }}>Adicionales</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Desc.</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Subtotal</TableCell>
                </>
              )}
              <TableCell sx={{ fontWeight: 700, minWidth: 180 }}>Observacion</TableCell>
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
                  <TableCell align="center">{row.cantidad}</TableCell>
                  {!pedidoParaStock && (
                    <>
                      <TableCell align="right">{formatCurrency(row.precioUnit || 0)}</TableCell>
                      <TableCell>
                        <Stack spacing={0.5} alignItems="flex-start">
                          {row.bordado > 0 && <Chip size="small" color="success" variant="outlined" label={`Bordado ${formatCurrency(row.bordado)}`} />}
                          {row.estiloEspecial && <Chip size="small" variant="outlined" label={`Estilo ${formatCurrency(row.estiloEspecialMonto || 0)}`} />}
                          {!row.bordado && !row.estiloEspecial && <Typography variant="body2" color="text.secondary">Sin adicionales</Typography>}
                        </Stack>
                      </TableCell>
                      <TableCell align="center">{`${Number(row.descuento || 0).toFixed(2)}%`}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 650 }}>{formatCurrency(calcularImportesDetallePedido(row).subtotal)}</TableCell>
                    </>
                  )}
                  <TableCell>{renderDetalleObservaciones(row.descripcion)}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<EditOutlined />}
                        onClick={() => editarArticulo(row)}
                      >
                        Editar
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        color="error"
                        startIcon={<DeleteOutline />}
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
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Totales
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>
                  {detalleTableTotals.cantidad}
                </TableCell>
                {!pedidoParaStock && (
                  <>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {formatCurrency(detalleTableTotals.precio)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {formatCurrency(detalleTableTotals.bordado + detalleTableTotals.estiloEspecial)}
                    </TableCell>
                    <TableCell align="center">-</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {formatCurrency(detalleTableTotals.subtotal)}
                    </TableCell>
                  </>
                )}
                <TableCell align="center">-</TableCell>
                <TableCell align="center">-</TableCell>
              </TableRow>
            )}
            {!detalle.length && (
              <TableRow>
                <TableCell colSpan={pedidoParaStock ? 4 : 8} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  Aun no has agregado articulos al pedido.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      </Paper>

      {!pedidoParaStock && (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="overline" color="primary" fontWeight={700}>04</Typography>
        <Typography variant="h6">Anticipo y pago</Typography>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label="Anticipo"
            type="number"
            fullWidth
            value={emptyWhenZero(anticipo)}
            onChange={(e) => setAnticipo(parseNumberInput(e.target.value))}
            disabled={pedidoSinCobro}
            error={!pedidoSinCobro && Number(anticipo || 0) > totalsPedido.total}
            helperText={pedidoSinCobro ? "Este pedido no genera cobro" : Number(anticipo || 0) > totalsPedido.total ? "No puede superar el total del pedido" : `Saldo restante: ${formatCurrency(Math.max(0, totalsPedido.saldoPendiente))}`}
          />
          {!pedidoSinCobro && totalsPedido.total > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
              {[25, 50, 100].map((percent) => (
                <Button key={percent} size="small" variant="text" onClick={() => setAnticipo(Math.round(totalsPedido.total * percent) / 100)}>
                  {percent}%
                </Button>
              ))}
            </Stack>
          )}
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel>Metodo de pago anticipo</InputLabel>
            <Select
              label="Metodo de pago anticipo"
              value={metodoPago}
              disabled={pedidoSinCobro}
              onChange={(e) => {
                const nextMetodo = e.target.value;
                setMetodoPago(nextMetodo);
                if (nextMetodo === "orden_compra") setAnticipo(0);
                if (metodoPago === "orden_compra" && nextMetodo !== "orden_compra" && totals.total > 0) {
                  setAnticipo(Number((totals.total * 0.5).toFixed(2)));
                }
                if (nextMetodo === "efectivo") setReferenciaPago("");
                if (nextMetodo !== "deposito_bancario") setBancoPago("");
                if (nextMetodo !== "tarjeta" && nextMetodo !== "visalink") setPorcentajeRecargo(0);
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
        {!pedidoSinCobro && metodoUsaRecargo && (
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Recargo %"
              type="number"
              fullWidth
              value={emptyWhenZero(porcentajeRecargo)}
              onChange={(e) => setPorcentajeRecargo(parseNumberInput(e.target.value))}
              helperText="Aplica para pagos con tarjeta o Visalink"
            />
          </Grid>
        )}
        {!pedidoSinCobro && metodoRequiereReferencia && (
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
        {!pedidoSinCobro && metodoRequiereBanco && (
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
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label="Envio"
            type="number"
            fullWidth
            value={emptyWhenZero(envio)}
            onChange={(e) => setEnvio(Math.max(0, parseNumberInput(e.target.value)))}
            disabled={pedidoSinCobro}
            helperText="Monto cobrado por envio en este pedido"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} justifyContent="flex-end">
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between">
                <Typography>Subtotal</Typography>
                <Typography>{formatCurrency(totalsPedido.subtotal)}</Typography>
              </Stack>
              {!pedidoSinCobro && metodoUsaRecargo && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography>Recargo</Typography>
                  <Typography>{formatCurrency(totalsPedido.recargo)}</Typography>
                </Stack>
              )}
              <Stack direction="row" justifyContent="space-between">
                <Typography>Envio</Typography>
                <Typography>{formatCurrency(totalsPedido.envio)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography fontWeight={700}>Total</Typography>
                <Typography fontWeight={700}>{formatCurrency(totalsPedido.total)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography>Anticipo</Typography>
                <Typography>{formatCurrency(pedidoSinCobro ? 0 : Number(anticipo) || 0)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography fontWeight={700}>Saldo estimado</Typography>
                <Typography fontWeight={700}>{formatCurrency(totalsPedido.saldoPendiente)}</Typography>
              </Stack>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
        </Paper>
      )}

      <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ mt: 3 }}>
        {!isEditingPedido && !pedidoScheduleOpen && (
          <Alert severity="info" sx={{ mr: "auto" }}>
            La creacion de pedidos esta fuera de horario. Horario de hoy: {formatReportScheduleForDay(pedidoSchedule)}.
          </Alert>
        )}
        <Button variant="outlined" onClick={() => volverAlListado()}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={guardar}
          sx={{
            backgroundColor: "#2F2C61",
            color: "#fff",
            fontWeight: 700,
            "&:hover": {
              backgroundColor: "#232148",
            },
          }}
          disabled={loadingPedidoEdit || guardandoPedido || (!isEditingPedido && !pedidoScheduleOpen)}
        >
          {guardandoPedido
            ? "Procesando..."
            : isEditingPedido
              ? rol === "ADMIN"
                ? "Guardar cambios"
                : "Solicitar autorizacion"
              : "Guardar pedido"}
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
            <Stack spacing={2} alignItems="center">
              <Box
                component="img"
                src={articuloActual.bordadoImagenUrl}
                alt="Imagen de bordado"
                sx={{ maxWidth: "100%", maxHeight: 420, objectFit: "contain" }}
              />
            </Stack>
          ) : (
            <Typography color="text.secondary">No hay imagen seleccionada.</Typography>
          )}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
