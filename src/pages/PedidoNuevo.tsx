import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "@mui/material";
import PlaylistAddCheckOutlined from "@mui/icons-material/PlaylistAddCheckOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import KeyboardArrowDownOutlined from "@mui/icons-material/KeyboardArrowDownOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useNavigate } from "react-router-dom";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import uniformaLogo from "../assets/3-logos.png";
import { PDF_FONT_FAMILY, PDF_FONT_SEMIBOLD_FAMILY } from "../utils/fontFamily";
import { findPotentialMisspellings } from "../utils/spellcheck";
import { formatCurrency } from "../utils/currency";

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

interface DetalleRow {
  key: number;
  productoId: number;
  cantidad: number;
  precioUnit: number;
  bordado: number;
  bordadoActivo: boolean;
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

const escapeHtml = (value?: string | number | null) =>
  `${value ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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
  const [filtroGenero, setFiltroGenero] = useState("");
  const [filtroTela, setFiltroTela] = useState("");
  const [filtroTalla, setFiltroTalla] = useState("");
  const [filtroColor, setFiltroColor] = useState("");
  const [cantidadAdvertida, setCantidadAdvertida] = useState<number | null>(null);
  const [bordadoPreviewOpen, setBordadoPreviewOpen] = useState(false);

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
  const { fetchConfig } = useSystemConfigStore();
  const navigate = useNavigate();
  const canAccessAllBodegas = hasPermission(rol, permisos, "sistema.multi-tienda");
  const metodoUsaRecargo = metodoPago === "tarjeta" || metodoPago === "visalink";
  const metodoRequiereReferencia = metodoPago !== "efectivo";
  const metodoRequiereBanco = metodoPago === "deposito_bancario";
  const metodoPermiteSinAnticipo = metodoPago === "orden_compra";
  const clienteSeleccionado = clientes.find((c) => c.id === clienteId) || null;
  const postventaSeleccionada = postventaDocs.find((doc) => doc.id === Number(postventaId)) || null;
  const pedidoSinCobro = Boolean(postventaSeleccionada && postventaCobro === "sin_cobro");
  const pedidoSinValor = pedidoSinCobro || pedidoParaStock;

  const cargarCatalogos = async () => {
    try {
      const [respCli, respProd, respBod, respTelas, respTallas, respColores, respPostventa] = await Promise.all([
        api.get("/clientes/todos"),
        api.get("/productos"),
        api.get("/bodegas"),
        api.get("/telas").catch(() => ({ data: [] })),
        api.get("/tallas").catch(() => ({ data: [] })),
        api.get("/colores").catch(() => ({ data: [] })),
        api.get("/postventa").catch(() => ({ data: [] })),
      ]);
      setClientes(respCli.data || []);
      setProductos(respProd.data || []);
      setBodegas(respBod.data || []);
      setTelas(respTelas.data || []);
      setTallas(respTallas.data || []);
      setColores(respColores.data || []);
      setPostventaDocs(
        (Array.isArray(respPostventa.data) ? respPostventa.data : []).filter(
          (doc: RegistroPostventa) => `${doc.estado || ""}`.toLowerCase() !== "anulado",
        ),
      );
    } catch {
      Swal.fire("Error", "No se pudieron cargar catalogos", "error");
    }
  };

  useEffect(() => {
    cargarCatalogos();
    void fetchConfig();
  }, [fetchConfig]);

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
      const precio = Number(d.precioUnit) || 0;
      const bordado = Number(d.bordado) || 0;
      const estiloEspecialMonto = d.estiloEspecial ? Number(d.estiloEspecialMonto) || 0 : 0;
      const desc = Number(d.descuento) || 0;
      const cantidad = Number(d.cantidad) || 0;
      const baseConEstilo = precio + estiloEspecialMonto;
      const precioConDescuento = baseConEstilo * (1 - desc / 100);
      return sum + cantidad * (precioConDescuento + bordado);
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
          precio: sum.precio + (Number(row.precioUnit) || 0),
          bordado: sum.bordado + (Number(row.bordado) || 0),
          estiloEspecial:
            sum.estiloEspecial +
            (row.estiloEspecial ? Number(row.estiloEspecialMonto) || 0 : 0),
        }),
        {
          cantidad: 0,
          precio: 0,
          bordado: 0,
          estiloEspecial: 0,
        },
      ),
    [detalle],
  );

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

  const productoDetectado = productosCoincidentes.length === 1 ? productosCoincidentes[0] : undefined;
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
    const descripcionNormalizada = `${articuloActual.descripcion || ""}`.trim().toLowerCase();
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

    if (cantidad <= 0) {
      Swal.fire("Validacion", "Ingresa una cantidad mayor a 0", "warning");
      return;
    }
    const tieneBordado = !pedidoParaStock && Boolean(articuloActual.bordadoActivo);
    if (
      tieneBordado &&
      (!`${articuloActual.bordadoColor || ""}`.trim() ||
        !`${articuloActual.bordadoTamano || ""}`.trim() ||
        !`${articuloActual.bordadoPosicion || ""}`.trim())
    ) {
      Swal.fire("Validacion", "Color, tamano y posicion de bordado son obligatorios", "warning");
      return;
    }

    const row: DetalleRow = {
      key: editingDetalleKey ?? Date.now(),
      productoId,
      cantidad,
      precioUnit: pedidoParaStock ? 0 : Number(articuloActual.precioUnit) || 0,
      bordado: pedidoParaStock ? 0 : Number(articuloActual.bordado) || 0,
      bordadoActivo: tieneBordado,
      bordadoColor: tieneBordado ? `${articuloActual.bordadoColor || "FULL COLOR"}`.trim() : "",
      bordadoTamano: tieneBordado ? `${articuloActual.bordadoTamano || "NORMAL"}`.trim() : "",
      bordadoPosicion: tieneBordado ? `${articuloActual.bordadoPosicion || "PECHO IZQUIERDO"}`.trim() : "",
      bordadoObservaciones: tieneBordado ? `${articuloActual.bordadoObservaciones || ""}`.trim() : "",
      bordadoImagenUrl: tieneBordado ? articuloActual.bordadoImagenUrl || "" : "",
      estiloEspecial: pedidoParaStock ? false : Boolean(articuloActual.estiloEspecial),
      estiloEspecialMonto: pedidoParaStock || !articuloActual.estiloEspecial ? 0 : Number(articuloActual.estiloEspecialMonto) || 0,
      descuento: pedidoParaStock ? 0 : Number(articuloActual.descuento) || 0,
      descripcion: articuloActual.descripcion || "",
    };

    setDetalle((prev) =>
      editingDetalleKey === null ? [...prev, row] : prev.map((item) => (item.key === editingDetalleKey ? row : item))
    );

    limpiarArticulo();
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
    if (!bodegaId) {
      Swal.fire("Validacion", "Selecciona una bodega", "warning");
      return;
    }
    if (!pedidoParaStock && !ubicacion) {
      Swal.fire("Validacion", "Selecciona ubicacion del pedido", "warning");
      return;
    }
    if (!pedidoParaStock && postventaCobro === "sin_cobro" && !postventaSeleccionada) {
      Swal.fire("Validacion", "Selecciona el documento de cambio/devolucion para crear un pedido sin valor monetario", "warning");
      return;
    }
    if (!pedidoSinValor && !metodoPermiteSinAnticipo && (Number(anticipo) || 0) <= 0) {
      Swal.fire("Validacion", "Ingresa un anticipo mayor a 0", "warning");
      return;
    }
    if (!detalle.length) {
      Swal.fire("Validacion", "Agrega al menos un producto", "warning");
      return;
    }
    if ((Number(anticipo) || 0) > totalsPedido.total) {
      Swal.fire("Validacion", "El anticipo no puede ser mayor al total del pedido", "warning");
      return;
    }
    if (!pedidoSinValor && metodoRequiereReferencia && !referenciaPago.trim()) {
      Swal.fire("Validacion", "Ingresa la referencia o numero de transaccion del pago", "warning");
      return;
    }
    if (!pedidoSinValor && metodoRequiereBanco && !bancoPago.trim()) {
      Swal.fire("Validacion", "Ingresa el banco del deposito", "warning");
      return;
    }

    const clienteParaPedido = pedidoParaStock
      ? { id: null, nombre: "Pedido para stock", telefono: null, correo: null }
      : await resolverClientePedido();
    if (clienteParaPedido === false) return;

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
        estiloEspecial: pedidoParaStock ? false : d.estiloEspecial,
        estiloEspecialMonto: pedidoParaStock ? 0 : d.estiloEspecialMonto,
        descuento: pedidoParaStock ? 0 : d.descuento,
        descripcion: d.descripcion,
      })),
    };

    try {
      const resp = await api.post("/produccion", payload);
      Swal.fire("Guardado", "Pedido creado", "success");
      const folioPedido = resp.data?.folio || (resp.data?.id ? `P-${resp.data.id}` : "PEND");
      const fechaPedido = resp.data?.fecha ? new Date(resp.data.fecha) : new Date();
      generarPdfPedidoProduccion(folioPedido, clienteParaPedido, fechaPedido);
      if (pedidoParaStock) {
        setTimeout(() => {
          navigate("/produccion");
        }, 300);
        return;
      }
      // Pequeño retraso para que el navegador no bloquee la segunda ventana
      setTimeout(() => {
        generarPdfReciboPedido(folioPedido, clienteParaPedido, fechaPedido);
        // Navegar después de que ambos PDFs se hayan abierto
        setTimeout(() => {
          navigate("/produccion");
        }, 300);
      }, 300);
    } catch (error: any) {
      Swal.fire("Error", getApiErrorMessage(error, "No se pudo guardar"), "error");
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
          <td class="text-left">${escapeHtml(d.descripcion || "")}</td>
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

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PlaylistAddCheckOutlined color="primary" />
          <Typography variant="h4">NUEVO PEDIDO</Typography>
        </Stack>
        <Button
          variant={pedidoParaStock ? "contained" : "outlined"}
          color={pedidoParaStock ? "success" : "primary"}
          onClick={togglePedidoParaStock}
        >
          Pedido para stock
        </Button>
      </Stack>
      <Divider sx={{ mb: 2 }} />

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
            renderOption={(props, option) => (
              <li {...props}>{formatClienteOption(option)}</li>
            )}
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

      <Divider sx={{ my: 2 }} />

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

      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" sx={{ mb: 2 }}>
        Agregar articulo
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Selecciona la combinacion del articulo y agregalo a la lista temporal antes de guardar el pedido.
          </Typography>
          <Alert severity={alertaArticulo.severity}>{alertaArticulo.message}</Alert>
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
              <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                <TextField
                  label="Bordado"
                  type="number"
                  fullWidth
                  value={articuloActual.bordado}
                  onChange={(e) =>
                    setArticuloActual((prev) => {
                      const bordado = Number(e.target.value) || 0;
                      return {
                        ...prev,
                        bordado,
                        bordadoActivo: bordado > 0 ? true : prev.bordadoActivo,
                        bordadoColor: prev.bordadoColor || "FULL COLOR",
                        bordadoTamano: prev.bordadoTamano || "NORMAL",
                        bordadoPosicion: prev.bordadoPosicion || "PECHO IZQUIERDO",
                        bordadoObservaciones: prev.bordadoObservaciones || "",
                        bordadoImagenUrl: prev.bordadoImagenUrl || "",
                      };
                    })
                  }
                  InputProps={{
                    readOnly: !articuloActual.bordadoActivo,
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.5 }}>
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
                              }))
                            }
                            sx={{ p: 0.5 }}
                          />
                          {!articuloActual.bordadoActivo && (
                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                              Bordado
                            </Typography>
                          )}
                        </Stack>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    "& .MuiInputBase-root": {
                      backgroundColor: articuloActual.bordadoActivo ? "transparent" : "action.disabledBackground",
                    },
                  }}
                  helperText={articuloActual.bordadoActivo ? "Monto editable por producto" : "Activa bordado para habilitar el monto"}
                />
              </Grid>
              {articuloActual.bordadoActivo && (
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
                </>
              )}
              <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                <TextField
                  label="Monto estilo"
                  type="number"
                  fullWidth
                  value={articuloActual.estiloEspecialMonto}
                  onChange={(e) =>
                    setArticuloActual((prev) => ({
                      ...prev,
                      estiloEspecialMonto: Number(e.target.value) || 0,
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
                  value={articuloActual.descuento}
                  onChange={(e) =>
                    setArticuloActual((prev) => ({ ...prev, descuento: Number(e.target.value) || 0 }))
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

      <Typography variant="h6" sx={{ mb: 1 }}>
        Articulos agregados
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Codigo</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Tipo</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Genero</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Tela</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Talla</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Color</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Cantidad</TableCell>
              {!pedidoParaStock && (
                <>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Precio</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Bordado</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Estilo especial</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Descuento</TableCell>
                </>
              )}
              <TableCell align="center" sx={{ fontWeight: 700 }}>Observacion</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {detalle.map((row) => {
              const producto = productos.find((p) => p.id === row.productoId);
              return (
                <TableRow key={row.key}>
                  <TableCell align="center">{producto?.codigo || row.productoId}</TableCell>
                  <TableCell align="center">{producto?.tipo || producto?.nombre || "Producto"}</TableCell>
                  <TableCell align="center">{producto?.genero || "N/D"}</TableCell>
                  <TableCell align="center">{obtenerTela(producto)}</TableCell>
                  <TableCell align="center">{obtenerTalla(producto)}</TableCell>
                  <TableCell align="center">{obtenerColor(producto)}</TableCell>
                  <TableCell align="center">{row.cantidad}</TableCell>
                  {!pedidoParaStock && (
                    <>
                      <TableCell align="center">{formatCurrency(row.precioUnit || 0)}</TableCell>
                      <TableCell align="center">{formatCurrency(row.bordado || 0)}</TableCell>
                      <TableCell align="center">
                        {row.estiloEspecial ? formatCurrency(row.estiloEspecialMonto || 0) : "No"}
                      </TableCell>
                      <TableCell align="center">{`${Number(row.descuento || 0).toFixed(2)}%`}</TableCell>
                    </>
                  )}
                  <TableCell align="center">{row.descripcion || "-"}</TableCell>
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
                <TableCell align="right" colSpan={6} sx={{ fontWeight: 700 }}>
                  Totales
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>
                  {detalleTableTotals.cantidad}
                </TableCell>
                {!pedidoParaStock && (
                  <>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                      {formatCurrency(detalleTableTotals.precio)}
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                      {formatCurrency(detalleTableTotals.bordado)}
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                      {formatCurrency(detalleTableTotals.estiloEspecial)}
                    </TableCell>
                    <TableCell align="center">-</TableCell>
                  </>
                )}
                <TableCell align="center">-</TableCell>
                <TableCell align="center">-</TableCell>
              </TableRow>
            )}
            {!detalle.length && (
              <TableRow>
                <TableCell colSpan={pedidoParaStock ? 9 : 13} align="center">
                  Aun no has agregado articulos al pedido.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {!pedidoParaStock && (
        <>
      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" sx={{ mb: 2 }}>
        Datos de pago
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label="Anticipo"
            type="number"
            fullWidth
            value={anticipo}
            onChange={(e) => setAnticipo(Number(e.target.value))}
            disabled={pedidoSinCobro}
            helperText="Se calcula automaticamente como el 50% del total y puedes modificarlo"
          />
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
              value={porcentajeRecargo}
              onChange={(e) => setPorcentajeRecargo(Number(e.target.value))}
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
            value={envio}
            onChange={(e) => setEnvio(Math.max(0, Number(e.target.value) || 0))}
            disabled={pedidoSinCobro}
            helperText="Monto cobrado por envio en este pedido"
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />

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
        </>
      )}

      <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ mt: 3 }}>
        <Button variant="outlined" onClick={() => navigate("/produccion")}>
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
        >
          Guardar pedido
        </Button>
      </Stack>

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
    </Paper>
  );
}
