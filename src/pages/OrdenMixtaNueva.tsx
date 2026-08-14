import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Collapse,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import EditOutlined from "@mui/icons-material/EditOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import CallSplitOutlined from "@mui/icons-material/CallSplitOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import PrecisionManufacturingOutlined from "@mui/icons-material/PrecisionManufacturingOutlined";
import TuneOutlined from "@mui/icons-material/TuneOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import Swal from "sweetalert2";
import { io, Socket } from "socket.io-client";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";
import { formatCurrency } from "../utils/currency";
import { emptyWhenZero, parseNumberInput } from "../utils/numberInputs";

type Cliente = { id: number; nombre: string; telefono?: string | null };
type Bodega = { id: number; nombre: string; tipo?: string | null; usaInventarioVentas?: boolean };
type Producto = {
  id: number;
  codigo: string;
  nombre: string;
  precio: number;
  tipo?: string | null;
  genero?: string | null;
  stockMax?: number | null;
  mermaPorcentaje?: number | null;
  categoria?: { id?: number; nombre?: string | null } | null;
  telaId?: number | null;
  tallaId?: number | null;
  colorId?: number | null;
  tela_id?: number | null;
  talla_id?: number | null;
  color_id?: number | null;
  tela?: { id?: number; nombre?: string | null } | null;
  talla?: { id?: number; nombre?: string | null } | null;
  color?: { id?: number; nombre?: string | null } | null;
};

type BordadoArticulo = {
  key: number;
  monto: number;
  color: string;
  tamano: string;
  posicion: string;
  observaciones: string;
  imagenUrl: string;
};

type Linea = {
  key: number;
  productoId: number;
  tipoOperacion: "venta" | "pedido";
  bodegaId: number | "";
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
  descuento: number;
  estiloEspecial?: boolean;
  estiloEspecialMonto?: number;
  descripcion: string;
  stock: number | null;
  controlaInventario: boolean;
};

const lineBase: Omit<Linea, "key"> = {
  productoId: 0,
  tipoOperacion: "venta",
  bodegaId: "",
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
  descuento: 0,
  estiloEspecial: false,
  estiloEspecialMonto: 0,
  descripcion: "",
  stock: null,
  controlaInventario: false,
};

const ORDEN_MIXTA_BORRADOR_TIPO = "orden-mixta";
const ORDEN_MIXTA_BORRADOR_LOCAL_KEY = "orden-mixta:borrador-local:v1";
const PEDIDO_AUTORIZACION_MONTO_MINIMO = 3000;

const uniqueSorted = (values: string[]) =>
  Array.from(new Set(values.map((value) => `${value || ""}`.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );

const resolveTelaNombre = (prod: Producto | undefined, telas: any[]) => {
  if (!prod) return "N/D";
  const telaId = prod.telaId ?? prod.tela_id ?? prod.tela?.id ?? (prod as any).telaid ?? null;
  return prod.tela?.nombre || (prod as any).telaNombre || telas.find((t) => Number(t.id) === Number(telaId))?.nombre || "N/D";
};

const resolveTallaNombre = (prod: Producto | undefined, tallas: any[]) => {
  if (!prod) return "N/D";
  const tallaId = prod.tallaId ?? prod.talla_id ?? prod.talla?.id ?? (prod as any).tallaid ?? null;
  return prod.talla?.nombre || (prod as any).tallaNombre || tallas.find((t) => Number(t.id) === Number(tallaId))?.nombre || "N/D";
};

const resolveColorNombre = (prod: Producto | undefined, colores: any[]) => {
  if (!prod) return "N/D";
  const colorId = prod.colorId ?? prod.color_id ?? prod.color?.id ?? (prod as any).colorid ?? null;
  return prod.color?.nombre || (prod as any).colorNombre || colores.find((c) => Number(c.id) === Number(colorId))?.nombre || "N/D";
};

const upperText = (value: unknown, fallback = "N/D") =>
  `${value ?? ""}`.trim().toLocaleUpperCase("es-GT") || fallback;

const normalizeSearch = (value: unknown) =>
  upperText(value, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const getBordadoKey = () => Date.now() + Math.floor(Math.random() * 1000);

const buildBordadoDesdeLinea = (linea: Linea): BordadoArticulo | null => {
  if (!linea.bordadoActivo) return null;
  const monto = Number(linea.bordado) || 0;
  const observaciones = `${linea.bordadoObservaciones || ""}`.trim();
  const imagenUrl = linea.bordadoImagenUrl || "";
  if (monto <= 0 && !observaciones && !imagenUrl) return null;
  return {
    key: getBordadoKey(),
    monto,
    color: `${linea.bordadoColor || "FULL COLOR"}`.trim(),
    tamano: `${linea.bordadoTamano || "NORMAL"}`.trim(),
    posicion: `${linea.bordadoPosicion || "PECHO IZQUIERDO"}`.trim(),
    observaciones,
    imagenUrl,
  };
};

const bordadosIguales = (a: BordadoArticulo, b: BordadoArticulo) =>
  Number(a.monto || 0) === Number(b.monto || 0) &&
  upperText(a.color, "") === upperText(b.color, "") &&
  upperText(a.tamano, "") === upperText(b.tamano, "") &&
  upperText(a.posicion, "") === upperText(b.posicion, "") &&
  upperText(a.observaciones, "") === upperText(b.observaciones, "") &&
  `${a.imagenUrl || ""}` === `${b.imagenUrl || ""}`;

const agregarBordadoSiNoExiste = (bordados: BordadoArticulo[], bordado: BordadoArticulo | null) =>
  bordado && !bordados.some((item) => bordadosIguales(item, bordado)) ? [...bordados, bordado] : bordados;

const getBordadoTotal = (bordados: BordadoArticulo[]) =>
  bordados.reduce((sum, bordado) => sum + Number(bordado.monto || 0), 0);

const formatDetalleObservaciones = (descripcion: string, bordados: BordadoArticulo[]) => {
  const posiciones = Array.from(new Set(bordados.map((bordado) => upperText(bordado.posicion, "")).filter(Boolean)));
  const prefix = posiciones.length ? `BORDADO ${posiciones.join(" / ")}.` : "";
  const texto = `${descripcion || ""}`.trim().replace(/^BORDADO\b.*?\.\s*/i, "");
  return [prefix, texto].filter(Boolean).join(" ");
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(`${reader.result || ""}`);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const calcularSubtotal = (linea: Pick<Linea, "cantidad" | "precioUnit" | "bordado" | "descuento" | "estiloEspecial" | "estiloEspecialMonto">) => {
  const cantidad = Number(linea.cantidad || 0);
  const precio = Number(linea.precioUnit || 0);
  const bordado = Number(linea.bordado || 0);
  const estiloEspecial = linea.estiloEspecial ? Number(linea.estiloEspecialMonto || 0) : 0;
  const descuento = 1 - Number(linea.descuento || 0) / 100;
  return Math.round(cantidad * ((precio + estiloEspecial) * descuento + bordado) * 100) / 100;
};

export default function OrdenMixtaNueva() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuthStore();
  const returnState = location.state as { borradorId?: number } | null;
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [telas, setTelas] = useState<any[]>([]);
  const [tallas, setTallas] = useState<any[]>([]);
  const [colores, setColores] = useState<any[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [clienteNombre, setClienteNombre] = useState("CF");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [bodegaId, setBodegaId] = useState<number | "">(auth.bodegaId ? Number(auth.bodegaId) : "");
  const [ubicacion, setUbicacion] = useState("TIENDA");
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [referenciaPago, setReferenciaPago] = useState("");
  const [bancoPago, setBancoPago] = useState("");
  const [envio, setEnvio] = useState(0);
  const [anticipoTotal, setAnticipoTotal] = useState(0);
  const [linea, setLinea] = useState<Linea>({ ...lineBase, key: Date.now(), bodegaId: auth.bodegaId ? Number(auth.bodegaId) : "" });
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [editingKey, setEditingKey] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [filtroGenero, setFiltroGenero] = useState("");
  const [filtroTela, setFiltroTela] = useState("");
  const [filtroTalla, setFiltroTalla] = useState("");
  const [filtroColor, setFiltroColor] = useState("");
  const [bordadosModalOpen, setBordadosModalOpen] = useState(false);
  const [bordadoPreviewOpen, setBordadoPreviewOpen] = useState(false);
  const [documentoBorradorId, setDocumentoBorradorId] = useState<number | null>(null);
  const [borradorGuardadoEn, setBorradorGuardadoEn] = useState("");
  const [borradorEstado, setBorradorEstado] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const borradorInicializadoRef = useRef(false);
  const restaurandoBorradorRef = useRef(false);
  const autoguardadoBorradorBloqueadoRef = useRef(false);
  const ultimoBorradorJsonRef = useRef("");
  const savingRef = useRef(false);
  const autorizacionSocketRef = useRef<Socket | null>(null);
  const autorizacionPendienteRef = useRef<number | null>(null);
  const complementoSugeridoProductoIdRef = useRef<number | null>(null);

  useEffect(() => {
    const cargar = async () => {
      const [clientesResp, productosResp, bodegasResp, telasResp, tallasResp, coloresResp] = await Promise.all([
        api.get("/clientes").catch(() => ({ data: [] })),
        api.get("/productos").catch(() => ({ data: [] })),
        api.get("/bodegas").catch(() => ({ data: [] })),
        api.get("/telas").catch(() => ({ data: [] })),
        api.get("/tallas").catch(() => ({ data: [] })),
        api.get("/colores").catch(() => ({ data: [] })),
      ]);
      setClientes(Array.isArray(clientesResp.data) ? clientesResp.data : []);
      setProductos(Array.isArray(productosResp.data) ? productosResp.data : []);
      setBodegas(Array.isArray(bodegasResp.data) ? bodegasResp.data : []);
      setTelas(Array.isArray(telasResp.data) ? telasResp.data : []);
      setTallas(Array.isArray(tallasResp.data) ? tallasResp.data : []);
      setColores(Array.isArray(coloresResp.data) ? coloresResp.data : []);
    };
    void cargar();
  }, []);

  const limpiarFormularioOrdenMixta = useCallback(() => {
    const defaultBodegaId = auth.bodegaId ? Number(auth.bodegaId) : "";
    setCliente(null);
    setClienteNombre("CF");
    setClienteTelefono("");
    setBodegaId(defaultBodegaId);
    setUbicacion("TIENDA");
    setMetodoPago("efectivo");
    setReferenciaPago("");
    setBancoPago("");
    setEnvio(0);
    setAnticipoTotal(0);
    setLinea({ ...lineBase, key: Date.now(), bodegaId: defaultBodegaId });
    setLineas([]);
    setEditingKey(null);
    setFiltroTipo("");
    setFiltroGenero("");
    setFiltroTela("");
    setFiltroTalla("");
    setFiltroColor("");
  }, [auth.bodegaId]);

  const restaurarBorradorOrdenMixta = useCallback(
    (rawData: any) => {
      const data = rawData?.data ? rawData.data : rawData;
      const encabezado = data?.encabezado || {};
      const filtros = data?.filtros || {};
      const nextClienteId = Number(encabezado.clienteId || 0);
      const clienteEncontrado = nextClienteId ? clientes.find((item) => Number(item.id) === nextClienteId) || null : null;

      restaurandoBorradorRef.current = true;
      setCliente(clienteEncontrado);
      setClienteNombre(`${encabezado.clienteNombre || clienteEncontrado?.nombre || "CF"}`);
      setClienteTelefono(`${encabezado.clienteTelefono || clienteEncontrado?.telefono || ""}`);
      setBodegaId(encabezado.bodegaId ? Number(encabezado.bodegaId) : auth.bodegaId ? Number(auth.bodegaId) : "");
      setUbicacion(`${encabezado.ubicacion || "TIENDA"}`);
      setMetodoPago(`${encabezado.metodoPago || "efectivo"}`);
      setReferenciaPago(`${encabezado.referenciaPago || ""}`);
      setBancoPago(`${encabezado.bancoPago || ""}`);
      setEnvio(Number(encabezado.envio || 0));
      setAnticipoTotal(Number(encabezado.anticipoTotal || 0));
      setLinea({
        ...lineBase,
        ...(data?.capturaLinea || {}),
        bordados: Array.isArray(data?.capturaLinea?.bordados) ? data.capturaLinea.bordados : [],
        key: Number(data?.capturaLinea?.key || Date.now()),
        bodegaId: data?.capturaLinea?.bodegaId || encabezado.bodegaId || (auth.bodegaId ? Number(auth.bodegaId) : ""),
      });
      setLineas(Array.isArray(data?.lineas) ? data.lineas.map((item: any) => ({ ...lineBase, ...item, bordados: Array.isArray(item?.bordados) ? item.bordados : [] })) : []);
      setEditingKey(data?.editingKey ?? null);
      setFiltroTipo(`${filtros.tipo || ""}`);
      setFiltroGenero(`${filtros.genero || ""}`);
      setFiltroTela(`${filtros.tela || ""}`);
      setFiltroTalla(`${filtros.talla || ""}`);
      setFiltroColor(`${filtros.color || ""}`);
      window.setTimeout(() => {
        restaurandoBorradorRef.current = false;
      }, 0);
    },
    [auth.bodegaId, clientes],
  );

  const finalizarBorradorActual = useCallback(async (documentoFinal?: { tipo?: string; id?: number | null; folio?: string | null }) => {
    autoguardadoBorradorBloqueadoRef.current = true;
    if (!documentoBorradorId) return;
    const id = documentoBorradorId;
    setDocumentoBorradorId(null);
    setBorradorGuardadoEn("");
    setBorradorEstado("idle");
    ultimoBorradorJsonRef.current = "";
    localStorage.removeItem(ORDEN_MIXTA_BORRADOR_LOCAL_KEY);
    try {
      await api.post(`/documentos-borradores/${id}/finalizar`, {
        documentoFinalTipo: documentoFinal?.tipo || "orden-mixta",
        documentoFinalId: documentoFinal?.id || null,
        documentoFinalFolio: documentoFinal?.folio || null,
      });
    } catch {
      // El documento ya se creo; no bloqueamos al usuario por el cierre del borrador.
    }
  }, [documentoBorradorId]);

  const descartarBorradorActual = useCallback(async () => {
    if (documentoBorradorId) {
      try {
        await api.delete(`/documentos-borradores/${documentoBorradorId}`);
      } catch {
        // Si falla el descarte remoto, al menos limpiamos la pantalla y el respaldo local.
      }
    }
    localStorage.removeItem(ORDEN_MIXTA_BORRADOR_LOCAL_KEY);
    setDocumentoBorradorId(null);
    setBorradorGuardadoEn("");
    setBorradorEstado("idle");
    ultimoBorradorJsonRef.current = "";
    limpiarFormularioOrdenMixta();
  }, [documentoBorradorId, limpiarFormularioOrdenMixta]);

  useEffect(() => {
    if (borradorInicializadoRef.current) return;
    borradorInicializadoRef.current = true;

    const cargarBorrador = async () => {
      const restoreLocal = () => {
        try {
          const localRaw = localStorage.getItem(ORDEN_MIXTA_BORRADOR_LOCAL_KEY);
          if (!localRaw) return false;
          const parsed = JSON.parse(localRaw);
          restaurarBorradorOrdenMixta(parsed);
          setBorradorEstado("saved");
          setBorradorGuardadoEn(parsed?.actualizadoEn || "");
          ultimoBorradorJsonRef.current = JSON.stringify(parsed?.data || {});
          return true;
        } catch {
          localStorage.removeItem(ORDEN_MIXTA_BORRADOR_LOCAL_KEY);
          return false;
        }
      };

      try {
        const borradorId = Number(returnState?.borradorId || 0);
        const { data } = borradorId
          ? await api.get(`/documentos-borradores/${borradorId}`)
          : await api.get("/documentos-borradores/activo", { params: { tipoDocumento: ORDEN_MIXTA_BORRADOR_TIPO } });

        if (data?.id && data?.estado === "abierto") {
          setDocumentoBorradorId(Number(data.id));
          setBorradorGuardadoEn(data.actualizadoEn || "");
          setBorradorEstado("saved");
          restaurarBorradorOrdenMixta(data.data || {});
          ultimoBorradorJsonRef.current = JSON.stringify(data.data || {});
          return;
        }
        restoreLocal();
      } catch {
        restoreLocal();
      }
    };

    void cargarBorrador();
  }, [restaurarBorradorOrdenMixta, returnState?.borradorId]);

  const productoMap = useMemo(() => new Map(productos.map((producto) => [producto.id, producto])), [productos]);
  const bodegaMap = useMemo(() => new Map(bodegas.map((bodega) => [bodega.id, bodega])), [bodegas]);
  const bodegaOrigenLineaId = Number(linea.bodegaId || bodegaId || 0) || null;
  const bodegaOrigenLinea = bodegas.find((bodega) => Number(bodega.id) === Number(bodegaOrigenLineaId)) || null;
  const controlaInventarioLinea = linea.tipoOperacion === "venta" && Boolean(bodegaOrigenLinea?.usaInventarioVentas);
  const requiereReferencia = Number(anticipoTotal || 0) > 0 && metodoPago !== "efectivo" && metodoPago !== "orden_compra";
  const subtotalVenta = useMemo(
    () => lineas.filter((item) => item.tipoOperacion === "venta").reduce((sum, item) => sum + calcularSubtotal(item), 0),
    [lineas],
  );
  const subtotalPedido = useMemo(
    () => lineas.filter((item) => item.tipoOperacion === "pedido").reduce((sum, item) => sum + calcularSubtotal(item), 0),
    [lineas],
  );
  const envioMonto = Math.max(0, Number(envio || 0));
  const total = subtotalVenta + subtotalPedido + envioMonto;
  const totalVentaDocumento = subtotalVenta + (subtotalVenta > 0 ? envioMonto : 0);
  const totalPedidoDocumento = subtotalPedido + (subtotalVenta > 0 ? 0 : envioMonto);
  const anticipoVenta =
    totalVentaDocumento > 0 && totalPedidoDocumento > 0
      ? Math.round(Number(anticipoTotal || 0) * (totalVentaDocumento / total) * 100) / 100
      : totalVentaDocumento > 0
        ? Number(anticipoTotal || 0)
        : 0;
  const anticipoPedido = Math.max(0, Math.round((Number(anticipoTotal || 0) - anticipoVenta) * 100) / 100);
  const saldoTotal = Math.max(0, total - Number(anticipoTotal || 0));
  const anticipoExcedeTotal = Number(anticipoTotal || 0) > total;
  const pedidoSinAnticipo = subtotalPedido > 0 && anticipoPedido <= 0 && metodoPago !== "orden_compra";

  useEffect(() => {
    if (total >= 0 && Number(anticipoTotal || 0) > total) {
      setAnticipoTotal(Math.round(total * 100) / 100);
    }
  }, [total, anticipoTotal]);
  const puedeCrearProduccionSinAutorizacion =
    auth.rol === "ADMIN" ||
    hasPermission(auth.rol, auth.permisos, "produccion.autorizar-pedidos") ||
    hasPermission(auth.rol, auth.permisos, "produccion.crear-sin-autorizacion");
  const produccionRequiereAutorizacion =
    subtotalPedido > PEDIDO_AUTORIZACION_MONTO_MINIMO && !puedeCrearProduccionSinAutorizacion;
  const stockRestanteEstimado =
    controlaInventarioLinea && linea.stock != null ? Math.max(linea.stock - (Number(linea.cantidad) || 0), 0) : null;

  useEffect(() => {
    if (
      !auth?.id ||
      !borradorInicializadoRef.current ||
      restaurandoBorradorRef.current ||
      autoguardadoBorradorBloqueadoRef.current
    ) {
      return;
    }

    const hasContenido =
      lineas.length > 0 ||
      Boolean(linea.productoId) ||
      clienteNombre.trim().toUpperCase() !== "CF" ||
      Boolean(clienteTelefono.trim()) ||
      Boolean(referenciaPago.trim()) ||
      Boolean(bancoPago.trim()) ||
      Number(envio || 0) > 0 ||
      Number(anticipoTotal || 0) > 0 ||
      Boolean(filtroTipo || filtroGenero || filtroTela || filtroTalla || filtroColor);

    if (!hasContenido) return;

    const data = {
      version: 1,
      encabezado: {
        clienteId: cliente?.id || null,
        clienteNombre,
        clienteTelefono,
        bodegaId: bodegaId === "" ? null : Number(bodegaId),
        ubicacion,
        metodoPago,
        referenciaPago,
        bancoPago,
        envio,
        anticipoTotal,
      },
      lineas,
      capturaLinea: linea,
      editingKey,
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
        ORDEN_MIXTA_BORRADOR_LOCAL_KEY,
        JSON.stringify({ tipoDocumento: ORDEN_MIXTA_BORRADOR_TIPO, actualizadoEn: new Date().toISOString(), data }),
      );
    } catch {
      // El respaldo local es secundario; el backend sigue siendo la fuente principal.
    }

    const timer = window.setTimeout(async () => {
      try {
        if (autoguardadoBorradorBloqueadoRef.current) return;
        setBorradorEstado("saving");
        const { data: saved } = await api.post("/documentos-borradores/autoguardar", {
          id: documentoBorradorId,
          tipoDocumento: ORDEN_MIXTA_BORRADOR_TIPO,
          titulo: clienteNombre && clienteNombre.trim().toUpperCase() !== "CF" ? clienteNombre : "Orden mixta preliminar",
          bodegaId: bodegaId === "" ? null : Number(bodegaId),
          clienteId: cliente?.id || null,
          totalEstimado: total,
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
    anticipoTotal,
    auth?.id,
    bancoPago,
    bodegaId,
    cliente,
    clienteNombre,
    clienteTelefono,
    documentoBorradorId,
    editingKey,
    envio,
    filtroColor,
    filtroGenero,
    filtroTalla,
    filtroTela,
    filtroTipo,
    linea,
    lineas,
    metodoPago,
    referenciaPago,
    total,
    ubicacion,
  ]);

  const fetchStock = useCallback(async (bodega: number, producto: number) => {
    try {
      const resp = await api.get(`/inventario/${bodega}/${producto}`);
      return resp.data?.stock ?? null;
    } catch {
      return null;
    }
  }, []);

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
        filtrarProductos({ tipo: "", genero: filtroGenero, tela: filtroTela, talla: filtroTalla, color: filtroColor }).map(
          (producto) => producto.tipo || "",
        ),
      ),
    [filtrarProductos, filtroGenero, filtroTela, filtroTalla, filtroColor],
  );

  const generosDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({ tipo: filtroTipo, genero: "", tela: filtroTela, talla: filtroTalla, color: filtroColor }).map(
          (producto) => producto.genero || "",
        ),
      ),
    [filtrarProductos, filtroTipo, filtroTela, filtroTalla, filtroColor],
  );

  const telasDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({ tipo: filtroTipo, genero: filtroGenero, tela: "", talla: filtroTalla, color: filtroColor })
          .map((producto) => resolveTelaNombre(producto, telas))
          .filter((nombre) => nombre !== "N/D"),
      ),
    [filtrarProductos, filtroTipo, filtroGenero, filtroTalla, filtroColor, telas],
  );

  const tallasDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({ tipo: filtroTipo, genero: filtroGenero, tela: filtroTela, talla: "", color: filtroColor })
          .map((producto) => resolveTallaNombre(producto, tallas))
          .filter((nombre) => nombre !== "N/D"),
      ),
    [filtrarProductos, filtroTipo, filtroGenero, filtroTela, filtroColor, tallas],
  );

  const coloresDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({ tipo: filtroTipo, genero: filtroGenero, tela: filtroTela, talla: filtroTalla, color: "" })
          .map((producto) => resolveColorNombre(producto, colores))
          .filter((nombre) => nombre !== "N/D"),
      ),
    [filtrarProductos, filtroTipo, filtroGenero, filtroTela, filtroTalla, colores],
  );

  const productosCoincidentes = useMemo(
    () => filtrarProductos({ tipo: filtroTipo, genero: filtroGenero, tela: filtroTela, talla: filtroTalla, color: filtroColor }),
    [filtrarProductos, filtroTipo, filtroGenero, filtroTela, filtroTalla, filtroColor],
  );
  const tallasBusquedaExacta = useMemo(
    () => new Set(tallas.map((talla) => normalizeSearch(talla.nombre))),
    [tallas],
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
        setLinea((prev) => ({ ...prev, productoId: 0, precioUnit: 0, stock: null, controlaInventario: false }));
        return;
      }
      const sourceBodegaId = Number(linea.bodegaId || bodegaId || 0);
      const sourceBodega = bodegas.find((bodega) => Number(bodega.id) === Number(sourceBodegaId));
      const controlaInventario = linea.tipoOperacion === "venta" && Boolean(sourceBodega?.usaInventarioVentas);
      const stock = controlaInventario && sourceBodegaId ? await fetchStock(sourceBodegaId, productoDetectado.id) : null;
      setLinea((prev) => ({
        ...prev,
        productoId: productoDetectado.id,
        precioUnit: Number(productoDetectado.precio || 0),
        stock,
        controlaInventario,
      }));
    };
    void syncProducto();
  }, [productoDetectado, linea.bodegaId, linea.tipoOperacion, bodegaId, bodegas, fetchStock]);

  useEffect(() => {
    const socket = io(api.defaults.baseURL || window.location.origin, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    autorizacionSocketRef.current = socket;

    const manejarResolucion = (payload: any) => {
      const solicitudId = Number(payload?.solicitudId || 0);
      if (!autorizacionPendienteRef.current || solicitudId !== autorizacionPendienteRef.current) return;

      autorizacionPendienteRef.current = null;
      Swal.close();

      if (payload?.estado === "aprobado") {
        const ordenId = Number(payload?.ordenMixta?.id || 0);
        void Swal.fire("Orden autorizada", "La orden mixta fue generada correctamente.", "success").then(() => {
          navigate(ordenId > 0 ? `/orden-mixta/${ordenId}` : "/orden-mixta");
        });
        return;
      }

      if (payload?.estado === "rechazado") {
        void Swal.fire("Solicitud rechazada", payload?.comentario || "La orden mixta no fue autorizada.", "warning");
      }
    };

    socket.on("produccion:autorizacion-resuelta", manejarResolucion);

    return () => {
      socket.off("produccion:autorizacion-resuelta", manejarResolucion);
      socket.disconnect();
      autorizacionSocketRef.current = null;
    };
  }, [navigate]);

  const seleccionarCliente = (value: Cliente | null) => {
    setCliente(value);
    if (value) {
      setClienteNombre(value.nombre || "");
      setClienteTelefono(value.telefono || "");
    }
  };

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

  const getTipoComplementario = (tipo?: string | null) => {
    const normalized = normalizeSearch(tipo);
    if (normalized.includes("FILIPINA")) return "PANTALON";
    if (normalized.includes("PANTALON")) return "FILIPINA";
    return "";
  };

  const buscarProductoComplementario = (producto?: Producto) => {
    const tipoComplementario = getTipoComplementario(producto?.tipo);
    if (!producto || !tipoComplementario) return null;
    return productos.find((candidate) =>
      normalizeSearch(candidate.tipo) === tipoComplementario &&
      normalizeSearch(candidate.genero) === normalizeSearch(producto.genero) &&
      normalizeSearch(resolveTelaNombre(candidate, telas)) === normalizeSearch(resolveTelaNombre(producto, telas)) &&
      normalizeSearch(resolveTallaNombre(candidate, tallas)) === normalizeSearch(resolveTallaNombre(producto, tallas)) &&
      normalizeSearch(resolveColorNombre(candidate, colores)) === normalizeSearch(resolveColorNombre(producto, colores)),
    ) || null;
  };

  const sugerirProductoComplementario = async (producto?: Producto, captura?: Linea) => {
    const complementario = buscarProductoComplementario(producto);
    if (!complementario || !captura) return;
    const result = await Swal.fire({
      title: `Agregar ${getTipoComplementario(producto?.tipo).toLowerCase()}?`,
      text: `Se encontro ${complementario.codigo}. Puedo rellenar la captura con la misma operacion, tela, talla, color y genero para que lo revises antes de agregarlo.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Rellenar campos",
      cancelButtonText: "No",
      confirmButtonColor: "#1f3f87",
    });
    if (!result.isConfirmed) return;
    complementoSugeridoProductoIdRef.current = Number(complementario.id);
    setLinea({
      ...lineBase,
      key: Date.now(),
      tipoOperacion: captura.tipoOperacion,
      bodegaId: captura.bodegaId || bodegaId || "",
      cantidad: captura.cantidad,
      descuento: captura.descuento,
    });
    setEditingKey(null);
    setFiltroTipo(complementario.tipo || "");
    setFiltroGenero(complementario.genero || "");
    setFiltroTela(resolveTelaNombre(complementario, telas) === "N/D" ? "" : resolveTelaNombre(complementario, telas));
    setFiltroTalla(resolveTallaNombre(complementario, tallas) === "N/D" ? "" : resolveTallaNombre(complementario, tallas));
    setFiltroColor(resolveColorNombre(complementario, colores) === "N/D" ? "" : resolveColorNombre(complementario, colores));
  };

  const limpiarBordadoActual = () => setLinea((prev) => ({
    ...prev,
    bordado: 0,
    bordadoColor: "FULL COLOR",
    bordadoTamano: "NORMAL",
    bordadoPosicion: "PECHO IZQUIERDO",
    bordadoObservaciones: "",
    bordadoImagenUrl: "",
  }));

  const agregarBordadoActual = () => {
    const bordado = buildBordadoDesdeLinea(linea);
    if (!bordado) {
      void Swal.fire("Validacion", "Ingresa un monto, una imagen u observaciones antes de agregar el bordado", "warning");
      return;
    }
    if (!bordado.color || !bordado.tamano || !bordado.posicion) {
      void Swal.fire("Validacion", "Color, tamano y posicion de bordado son obligatorios", "warning");
      return;
    }
    if (linea.bordados.some((item) => bordadosIguales(item, bordado))) {
      void Swal.fire("Bordado duplicado", "Este bordado ya esta agregado a la prenda", "info");
      return;
    }
    setLinea((prev) => ({ ...prev, bordados: [...prev.bordados, bordado], bordadoActivo: true, bordado: 0, bordadoObservaciones: "", bordadoImagenUrl: "" }));
  };

  const editarBordadoActual = (bordado: BordadoArticulo) => setLinea((prev) => ({
    ...prev,
    bordadoActivo: true,
    bordado: bordado.monto,
    bordadoColor: bordado.color,
    bordadoTamano: bordado.tamano,
    bordadoPosicion: bordado.posicion,
    bordadoObservaciones: bordado.observaciones,
    bordadoImagenUrl: bordado.imagenUrl,
    bordados: prev.bordados.filter((item) => item.key !== bordado.key),
  }));

  const agregarLinea = async () => {
    if (!linea.productoId) {
      void Swal.fire("Producto requerido", "Selecciona un producto para agregarlo.", "warning");
      return;
    }
    if (linea.cantidad <= 0) {
      void Swal.fire("Cantidad invalida", "La cantidad debe ser mayor a 0.", "warning");
      return;
    }
    if (linea.tipoOperacion === "venta" && !linea.bodegaId) {
      void Swal.fire("Bodega requerida", "Selecciona la bodega origen para rebajar inventario.", "warning");
      return;
    }
    if (linea.tipoOperacion === "venta" && linea.controlaInventario && linea.stock != null && linea.cantidad > linea.stock) {
      void Swal.fire("Stock insuficiente", `Solo hay ${linea.stock} unidades disponibles en inventario.`, "warning");
      return;
    }
    if (linea.tipoOperacion === "venta" && linea.controlaInventario && linea.stock != null) {
      const cantidadYaAgregada = lineas
        .filter(
          (row) =>
            row.key !== editingKey &&
            Number(row.productoId) === Number(linea.productoId) &&
            Number(row.bodegaId) === Number(linea.bodegaId),
        )
        .reduce((sum, row) => sum + Number(row.cantidad || 0), 0);
      if (cantidadYaAgregada + Number(linea.cantidad || 0) > linea.stock) {
        void Swal.fire(
          "Stock insuficiente",
          `Ya agregaste ${cantidadYaAgregada} unidades de este producto. Disponible en inventario: ${linea.stock}.`,
          "warning",
        );
        return;
      }
    }
    const bordadoEnCaptura = buildBordadoDesdeLinea(linea);
    const bordadosFinales = agregarBordadoSiNoExiste(linea.bordados || [], bordadoEnCaptura);
    const tieneBordado = linea.bordadoActivo || bordadosFinales.length > 0;
    if (tieneBordado && (!bordadosFinales.length || bordadosFinales.some((bordado) => !bordado.color || !bordado.tamano || !bordado.posicion))) {
      void Swal.fire("Validacion", "Agrega al menos un bordado con color, tamano y posicion", "warning");
      return;
    }
    const lineaFinal: Linea = {
      ...linea,
      bordadoActivo: tieneBordado,
      bordados: bordadosFinales,
      bordado: getBordadoTotal(bordadosFinales),
      bordadoColor: bordadosFinales[0]?.color || "",
      bordadoTamano: bordadosFinales[0]?.tamano || "",
      bordadoPosicion: bordadosFinales[0]?.posicion || "",
      bordadoObservaciones: bordadosFinales[0]?.observaciones || "",
      bordadoImagenUrl: bordadosFinales[0]?.imagenUrl || "",
      descripcion: formatDetalleObservaciones(linea.descripcion, bordadosFinales),
    };
    const productoAgregado = productos.find((producto) => Number(producto.id) === Number(linea.productoId));
    const debeSugerir = editingKey == null && complementoSugeridoProductoIdRef.current !== Number(linea.productoId);
    setLineas((prev) =>
      editingKey == null
        ? [...prev, { ...lineaFinal, key: Date.now() }]
        : prev.map((row) => (row.key === editingKey ? { ...lineaFinal, key: editingKey } : row)),
    );
    setLinea({ ...lineBase, key: Date.now(), bodegaId: bodegaId || "" });
    setEditingKey(null);
    setFiltroTipo("");
    setFiltroGenero("");
    setFiltroTela("");
    setFiltroTalla("");
    setFiltroColor("");
    complementoSugeridoProductoIdRef.current = null;
    if (debeSugerir) await sugerirProductoComplementario(productoAgregado, lineaFinal);
  };

  const editarLinea = (item: Linea) => {
    const producto = productoMap.get(item.productoId);
    setLinea({ ...item });
    setEditingKey(item.key);
    setFiltroTipo(producto?.tipo || "");
    setFiltroGenero(producto?.genero || "");
    setFiltroTela(resolveTelaNombre(producto, telas) === "N/D" ? "" : resolveTelaNombre(producto, telas));
    setFiltroTalla(resolveTallaNombre(producto, tallas) === "N/D" ? "" : resolveTallaNombre(producto, tallas));
    setFiltroColor(resolveColorNombre(producto, colores) === "N/D" ? "" : resolveColorNombre(producto, colores));
  };

  const guardar = async () => {
    if (savingRef.current) return;
    if (!lineas.length) {
      void Swal.fire("Sin detalle", "Agrega al menos una linea a la orden mixta.", "warning");
      return;
    }
    if (!bodegaId) {
      void Swal.fire("Bodega requerida", "Selecciona la bodega del documento.", "warning");
      return;
    }
    if (anticipoExcedeTotal) {
      void Swal.fire("Anticipo invalido", "El anticipo no puede superar el total de la orden.", "warning");
      return;
    }
    if (requiereReferencia && !referenciaPago.trim()) {
      void Swal.fire("Referencia requerida", "Ingresa la referencia del pago.", "warning");
      return;
    }
    if (Number(anticipoTotal || 0) > 0 && metodoPago === "deposito_bancario" && !bancoPago.trim()) {
      void Swal.fire("Banco requerido", "Ingresa el banco del depósito.", "warning");
      return;
    }
    if (pedidoSinAnticipo) {
      void Swal.fire("Anticipo requerido", "La parte de producción necesita anticipo si no es orden de compra.", "warning");
      return;
    }

    if (produccionRequiereAutorizacion) {
      const detalleHtml = lineas
        .slice(0, 12)
        .map((item, index) => {
          const producto = productoMap.get(Number(item.productoId));
          return `<li>${index + 1}. ${producto?.codigo || item.productoId} - ${producto?.nombre || "Producto"} x ${item.cantidad}</li>`;
        })
        .join("");
      const result = await Swal.fire({
        title: "Esta orden mixta necesita autorizacion",
        html: `
          <div style="text-align:left;font-size:14px;line-height:1.45;">
            <p>La parte de producción es <strong>${formatCurrency(subtotalPedido)}</strong> y supera el límite de <strong>${formatCurrency(PEDIDO_AUTORIZACION_MONTO_MINIMO)}</strong>.</p>
            <p><strong>Cliente:</strong> ${clienteNombre || "CF"}<br/>
            <strong>Total orden:</strong> ${formatCurrency(total)}<br/>
            <strong>Detalle:</strong></p>
            <ul style="max-height:140px;overflow:auto;margin:0 0 12px 18px;padding:0;">${detalleHtml}</ul>
            <label for="orden-mixta-autorizacion-comentario" style="display:block;margin-bottom:6px;font-weight:600;">Comentario para autorizacion</label>
            <textarea id="orden-mixta-autorizacion-comentario" class="swal2-textarea" placeholder="Explica brevemente por que debe autorizarse..." style="height:90px;margin:0;width:100%;"></textarea>
          </div>
        `,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Solicitar autorizacion",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#1f3f87",
        width: 680,
        preConfirm: () =>
          (document.getElementById("orden-mixta-autorizacion-comentario") as HTMLTextAreaElement | null)?.value || "",
      });
      if (!result.isConfirmed) return;

      savingRef.current = true;
      setSaving(true);
      try {
        const { data } = await api.post("/orden-mixta/autorizaciones", {
          orden: {
            clienteId: cliente?.id || null,
            clienteNombre,
            clienteTelefono,
            bodegaId,
            ubicacion,
            metodoPago,
            referenciaPago,
            bancoPago,
            envio: envioMonto,
            anticipoTotal: Number(anticipoTotal || 0),
            vendedor: auth.nombre || auth.usuario,
            detalle: lineas,
          },
          comentario: result.value || "",
        });
        const solicitudId = Number(data?.id || 0);
        autorizacionPendienteRef.current = solicitudId || null;
        const espera = await Swal.fire({
          title: "Esperando autorizacion",
          text: "La solicitud fue enviada. Puedes esperar aqui hasta que se autorice o regresar al modulo de ordenes mixtas.",
          icon: "info",
          showConfirmButton: false,
          showCancelButton: true,
          cancelButtonText: "Regresar a ordenes mixtas",
          allowOutsideClick: false,
          allowEscapeKey: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });
        if (espera.dismiss === Swal.DismissReason.cancel && autorizacionPendienteRef.current === solicitudId) {
          autorizacionPendienteRef.current = null;
          navigate("/orden-mixta");
        }
      } catch (error: any) {
        await Swal.fire("Error", error?.response?.data?.message || "No se pudo enviar la solicitud de autorizacion", "error");
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
      return;
    }

    const confirm = await Swal.fire({
      title: "Generar orden mixta",
      html: `<div style="text-align:left;line-height:1.55">
        <p style="color:#64748b;margin-top:0">El sistema distribuira automaticamente el anticipo de forma proporcional entre venta y produccion.</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:7px;border-bottom:1px solid #e5e7eb">Venta desde inventario</td><td style="padding:7px;text-align:right;border-bottom:1px solid #e5e7eb"><b>${formatCurrency(subtotalVenta)}</b></td></tr>
          <tr><td style="padding:7px;border-bottom:1px solid #e5e7eb">Pedido de produccion</td><td style="padding:7px;text-align:right;border-bottom:1px solid #e5e7eb"><b>${formatCurrency(subtotalPedido)}</b></td></tr>
          <tr><td style="padding:7px;border-bottom:1px solid #e5e7eb">Envio</td><td style="padding:7px;text-align:right;border-bottom:1px solid #e5e7eb"><b>${formatCurrency(envioMonto)}</b></td></tr>
          <tr><td style="padding:9px 7px">Total</td><td style="padding:9px 7px;text-align:right"><b>${formatCurrency(total)}</b></td></tr>
        </table>
        <div style="background:#f4f7fb;border-radius:10px;padding:12px;margin-top:12px">
          <b>Anticipo: ${formatCurrency(anticipoTotal)}</b><br/>
          <span style="color:#475569">Venta: ${formatCurrency(anticipoVenta)} · Produccion: ${formatCurrency(anticipoPedido)} · Saldo: ${formatCurrency(saldoTotal)}</span>
        </div>
      </div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Generar",
      cancelButtonText: "Cancelar",
      width: 680,
    });
    if (!confirm.isConfirmed) return;
    if (savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    try {
      const { data } = await api.post("/orden-mixta", {
        clienteId: cliente?.id || null,
        clienteNombre,
        clienteTelefono,
        bodegaId,
        ubicacion,
        metodoPago,
        referenciaPago,
        bancoPago,
        envio: envioMonto,
        anticipoTotal: Number(anticipoTotal || 0),
        vendedor: auth.nombre || auth.usuario,
        detalle: lineas,
      });
      autoguardadoBorradorBloqueadoRef.current = true;
      await finalizarBorradorActual({
        tipo: "orden-mixta",
        id: Number(data?.id || 0) || null,
        folio: data?.folio || null,
      });
      await Swal.fire(
        "Orden generada",
        `Orden ${data?.folio || ""}${data?.venta?.folio ? ` | Venta ${data.venta.folio}` : ""}${data?.pedido?.folio ? ` | Pedido ${data.pedido.folio}` : ""}`,
        "success",
      );
      navigate("/orden-mixta");
    } catch (error: any) {
      await Swal.fire("Error", error?.response?.data?.message || "No se pudo generar la orden mixta", "error");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2.25}>
      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, position: "sticky", top: { xs: 60, md: 68 }, zIndex: 10, bgcolor: "background.paper" }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} gap={1.5}>
        <div>
          <Typography variant="h4" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CallSplitOutlined /> Nueva orden mixta
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Usa venta para lo que sale de stock y pedido para lo que debe producirse.
          </Typography>
        </div>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip label={`${lineas.length} articulo${lineas.length === 1 ? "" : "s"}`} variant="outlined" />
          <Chip label={formatCurrency(total)} color="primary" />
          <Button variant="outlined" startIcon={<ArrowBackOutlined />} onClick={() => navigate("/orden-mixta")}>Volver</Button>
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
          Orden mixta preliminar PRE-{String(documentoBorradorId).padStart(6, "0")}
          {borradorEstado === "saving"
            ? " guardandose..."
            : borradorGuardadoEn
              ? ` guardada ${new Date(borradorGuardadoEn).toLocaleString("es-GT")}`
              : ""}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}><Typography variant="overline" color="primary" fontWeight={700}>01</Typography><Typography variant="h6">Cliente y documento</Typography></Stack>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Autocomplete
              options={clientes}
              value={cliente}
              getOptionLabel={(option) => option.telefono ? `${option.telefono} - ${option.nombre}` : option.nombre}
              onChange={(_, value) => seleccionarCliente(value)}
              renderInput={(params) => <TextField {...params} label="Cliente existente" />}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth label="Nombre del cliente" value={clienteNombre} onChange={(event) => setClienteNombre(event.target.value)} disabled={Boolean(cliente)} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth label="Telefono" value={clienteTelefono} onChange={(event) => setClienteTelefono(event.target.value)} disabled={Boolean(cliente)} />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Bodega documento</InputLabel>
              <Select
                label="Bodega documento"
                value={bodegaId}
                onChange={(event) => {
                  const nextBodegaId = Number(event.target.value);
                  setBodegaId(nextBodegaId);
                  setLinea((prev) => ({ ...prev, bodegaId: prev.bodegaId || nextBodegaId }));
                }}
              >
                {bodegas.map((bodega) => (
                  <MenuItem key={bodega.id} value={bodega.id}>{bodega.nombre}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Ubicación pago</InputLabel>
              <Select label="Ubicación pago" value={ubicacion} onChange={(event) => setUbicacion(event.target.value)}>
                <MenuItem value="TIENDA">Tienda</MenuItem>
                <MenuItem value="CAPITAL">Capital</MenuItem>
                <MenuItem value="DEPARTAMENTO">Departamento</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Método de pago</InputLabel>
              <Select label="Método de pago" value={metodoPago} onChange={(event) => setMetodoPago(event.target.value)}>
                <MenuItem value="efectivo">Efectivo</MenuItem>
                <MenuItem value="transferencia">Transferencia</MenuItem>
                <MenuItem value="deposito_bancario">Depósito bancario</MenuItem>
                <MenuItem value="tarjeta">Tarjeta</MenuItem>
                <MenuItem value="orden_compra">Orden de compra</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              type="number"
              label="Anticipo total"
              value={emptyWhenZero(anticipoTotal)}
              error={anticipoExcedeTotal}
              helperText={anticipoExcedeTotal ? "No puede superar el total" : total > 0 ? `Maximo ${formatCurrency(total)}` : "Agrega articulos para calcularlo"}
              inputProps={{ min: 0, max: total, step: "0.01" }}
              onChange={(event) => setAnticipoTotal(Math.max(0, parseNumberInput(event.target.value)))}
            />
            {total > 0 && (
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                {[25, 50, 100].map((percent) => (
                  <Button key={percent} size="small" variant="text" onClick={() => setAnticipoTotal(Math.round(total * percent) / 100)}>
                    {percent}%
                  </Button>
                ))}
              </Stack>
            )}
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField fullWidth type="number" label="Envio" value={emptyWhenZero(envio)} onChange={(event) => setEnvio(parseNumberInput(event.target.value))} />
          </Grid>
          {requiereReferencia && (
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField fullWidth label="Referencia" value={referenciaPago} onChange={(event) => setReferenciaPago(event.target.value)} />
            </Grid>
          )}
          {metodoPago === "deposito_bancario" && (
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField fullWidth label="Banco" value={bancoPago} onChange={(event) => setBancoPago(event.target.value)} />
            </Grid>
          )}
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} gap={1} sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center"><Typography variant="overline" color="primary" fontWeight={700}>02</Typography><Typography variant="h6">Agregar articulo</Typography></Stack>
          <Button size="small" variant={filtrosAbiertos ? "contained" : "outlined"} startIcon={<TuneOutlined />} endIcon={<ExpandMoreOutlined sx={{ transform: filtrosAbiertos ? "rotate(180deg)" : "none", transition: "transform 160ms" }} />} onClick={() => setFiltrosAbiertos((value) => !value)}>Filtros del producto</Button>
        </Stack>
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {bodegaOrigenLinea && linea.tipoOperacion === "venta" && !controlaInventarioLinea ? (
            <Alert severity="warning">
              Esta bodega no controla inventario en ventas. La orden no validara ni descontara stock para esta linea.
            </Alert>
          ) : linea.stock != null && linea.productoId && linea.tipoOperacion === "venta" ? (
            <Alert severity={stockRestanteEstimado !== null && stockRestanteEstimado <= 0 ? "warning" : "info"}>
              {`Stock actual en ${bodegaOrigenLinea?.nombre || "bodega origen"}: ${linea.stock} unidades. `}
              {`Stock restante estimado con esta captura: ${stockRestanteEstimado ?? 0} unidades.`}
            </Alert>
          ) : (
            <Alert severity="info">Selecciona bodega y articulo para visualizar el stock disponible.</Alert>
          )}
        </Stack>
        <Grid container spacing={2} alignItems="flex-start">
          <Grid size={{ xs: 12 }}>
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: 6 }}><Button fullWidth variant="outlined" startIcon={<Inventory2Outlined />} onClick={() => setLinea((prev) => ({ ...prev, tipoOperacion: "venta" }))} sx={{ justifyContent: "flex-start", textAlign: "left", p: 1.5, borderWidth: linea.tipoOperacion === "venta" ? 2 : 1, borderColor: linea.tipoOperacion === "venta" ? "primary.main" : "divider", bgcolor: linea.tipoOperacion === "venta" ? "rgba(24,54,111,.05)" : "transparent", color: "text.primary" }}><Box><Typography fontWeight={650}>Venta desde inventario</Typography><Typography variant="caption" color="text.secondary">Entrega disponible desde una bodega</Typography></Box></Button></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><Button fullWidth variant="outlined" startIcon={<PrecisionManufacturingOutlined />} onClick={() => setLinea((prev) => ({ ...prev, tipoOperacion: "pedido" }))} sx={{ justifyContent: "flex-start", textAlign: "left", p: 1.5, borderWidth: linea.tipoOperacion === "pedido" ? 2 : 1, borderColor: linea.tipoOperacion === "pedido" ? "success.main" : "divider", bgcolor: linea.tipoOperacion === "pedido" ? "rgba(22,163,74,.05)" : "transparent", color: "text.primary" }}><Box><Typography fontWeight={650}>Pedido de produccion</Typography><Typography variant="caption" color="text.secondary">Producto que debe fabricarse</Typography></Box></Button></Grid>
            </Grid>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Grid container spacing={2} alignItems="flex-start">
              <Grid size={{ xs: 12, lg: 9 }}>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.default" }}>
                  <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <FormControl fullWidth>
              <InputLabel>Bodega origen</InputLabel>
              <Select
                label="Bodega origen"
                value={linea.bodegaId || bodegaId || ""}
                onChange={async (event) => {
                  const nextBodegaId = Number(event.target.value);
                  const nextBodega = bodegas.find((bodega) => Number(bodega.id) === Number(nextBodegaId));
                  const controlaInventario = linea.tipoOperacion === "venta" && Boolean(nextBodega?.usaInventarioVentas);
                  const stock = controlaInventario && linea.productoId ? await fetchStock(nextBodegaId, Number(linea.productoId)) : null;
                  setLinea((prev) => ({ ...prev, bodegaId: nextBodegaId, stock, controlaInventario }));
                }}
                disabled={linea.tipoOperacion === "pedido"}
              >
                {bodegas.map((bodega) => (
                  <MenuItem key={bodega.id} value={bodega.id}>
                    {bodega.nombre}{bodega.tipo ? ` - ${bodega.tipo}` : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 8 }}>
            <Autocomplete
              options={productos}
              value={productoDetectado || null}
              getOptionLabel={(producto) =>
                `${upperText(producto.codigo)} · ${upperText(producto.nombre)} · TALLA ${upperText(resolveTallaNombre(producto, tallas))}`
              }
              filterOptions={(options, { inputValue }) => {
                const terms = normalizeSearch(inputValue).split(/\s+/).filter(Boolean);
                if (!terms.length) return options;
                return options.filter((producto) => {
                  const tallaProducto = normalizeSearch(resolveTallaNombre(producto, tallas));
                  const values = [
                    producto.codigo,
                    producto.nombre,
                    producto.categoria?.nombre,
                    producto.tipo,
                    producto.genero,
                    resolveTelaNombre(producto, telas),
                    resolveTallaNombre(producto, tallas),
                    resolveColorNombre(producto, colores),
                  ].map(normalizeSearch);
                  const haystack = values.join(" ");
                  return terms.every((term) =>
                    tallasBusquedaExacta.has(term) ? tallaProducto === term : haystack.includes(term),
                  );
                });
              }}
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
                  `STOCK MÁX. ${Number(producto.stockMax || 0)}`,
                  `MERMA ${Number(producto.mermaPorcentaje || 0)}%`,
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
              renderInput={(params) => <TextField {...params} label="BUSCAR PRODUCTO" placeholder="CÓDIGO, NOMBRE O VARIANTE" helperText="Busca por código, nombre, talla, tela o color" inputProps={{ ...params.inputProps, style: { textTransform: "uppercase" } }} />}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Collapse in={filtrosAbiertos} timeout="auto">
              <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.default" }}><Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <FormControl fullWidth>
              <InputLabel>Tipo</InputLabel>
              <Select label="Tipo" value={filtroTipo} onChange={(event) => setFiltroTipo(event.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                {tiposDisponibles.map((tipo) => (
                  <MenuItem key={tipo} value={tipo}>{tipo}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <FormControl fullWidth>
              <InputLabel>Genero</InputLabel>
              <Select label="Genero" value={filtroGenero} onChange={(event) => setFiltroGenero(event.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                {generosDisponibles.map((genero) => (
                  <MenuItem key={genero} value={genero}>{genero}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <FormControl fullWidth>
              <InputLabel>Tela</InputLabel>
              <Select label="Tela" value={filtroTela} onChange={(event) => setFiltroTela(event.target.value)}>
                <MenuItem value="">Todas</MenuItem>
                {telasDisponibles.map((tela) => (
                  <MenuItem key={tela} value={tela}>{tela}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <FormControl fullWidth>
              <InputLabel>Talla</InputLabel>
              <Select label="Talla" value={filtroTalla} onChange={(event) => setFiltroTalla(event.target.value)}>
                <MenuItem value="">Todas</MenuItem>
                {tallasDisponibles.map((talla) => (
                  <MenuItem key={talla} value={talla}>{talla}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <FormControl fullWidth>
              <InputLabel>Color</InputLabel>
              <Select label="Color" value={filtroColor} onChange={(event) => setFiltroColor(event.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                {coloresDisponibles.map((color) => (
                  <MenuItem key={color} value={color}>{color}</MenuItem>
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
              </Grid></Paper>
            </Collapse>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  xl: "110px 130px minmax(285px, 320px) 125px minmax(240px, 1fr)",
                },
                gap: 1.5,
                alignItems: "start",
                justifyContent: "start",
                maxWidth: "100%",
              }}
            >
              <TextField fullWidth type="number" label="Cant." value={emptyWhenZero(linea.cantidad)} onChange={(event) => setLinea((prev) => ({ ...prev, cantidad: parseNumberInput(event.target.value) }))} />
              <TextField fullWidth type="number" label="Precio" value={linea.precioUnit} disabled helperText="Catalogo" />
              <Paper
                variant="outlined"
                sx={{
                  minWidth: 0,
                  minHeight: 56,
                  px: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                  borderColor: linea.bordadoActivo ? "success.main" : "divider",
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
                  <Checkbox
                    checked={linea.bordadoActivo}
                    onChange={(event) => setLinea((prev) => ({
                      ...prev,
                      bordadoActivo: event.target.checked,
                      bordado: event.target.checked ? prev.bordado : 0,
                      bordados: event.target.checked ? prev.bordados : [],
                    }))}
                    sx={{ p: 0.5 }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={650}>Bordado</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">{linea.bordados.length} item(s) · {formatCurrency(getBordadoTotal(linea.bordados))}</Typography>
                  </Box>
                </Stack>
                <Button size="small" variant="outlined" disabled={!linea.bordadoActivo} onClick={() => setBordadosModalOpen(true)} sx={{ flexShrink: 0, minWidth: 84 }}>Gestionar</Button>
              </Paper>
              <TextField fullWidth type="number" label="Desc. %" value={emptyWhenZero(linea.descuento)} onChange={(event) => setLinea((prev) => ({ ...prev, descuento: parseNumberInput(event.target.value) }))} />
              <TextField fullWidth label="Observación de línea" value={linea.descripcion} onChange={(event) => setLinea((prev) => ({ ...prev, descripcion: event.target.value }))} sx={{ gridColumn: { xs: "1 / -1", xl: "auto" } }} />
            </Box>
          </Grid>
                  </Grid>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, lg: 3 }}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    bgcolor: "background.default",
                  }}
                >
                  <Stack spacing={1.1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="overline" color="text.secondary" fontWeight={700}>Resumen de linea</Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={linea.tipoOperacion === "venta" ? "primary" : "success"}
                        label={linea.tipoOperacion === "venta" ? "Inventario" : "Produccion"}
                      />
                    </Stack>
                    <Divider />
                    <Typography variant="caption" color="text.secondary">
                      {Number(linea.cantidad || 0)} × {formatCurrency(linea.precioUnit)}
                      {Number(linea.bordado || 0) > 0 ? ` · Bordado ${formatCurrency(linea.bordado)}` : ""}
                      {Number(linea.descuento || 0) > 0 ? ` · Desc. ${linea.descuento}%` : ""}
                    </Typography>
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={2}>
                      <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                      <Typography variant="h5" color="primary.main" fontWeight={750}>{formatCurrency(calcularSubtotal(linea))}</Typography>
                    </Stack>
                  </Stack>
                </Paper>
              </Grid>
          <Grid size={{ xs: 12 }}>
            <Stack alignItems="center" sx={{ mt: 0.5 }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={agregarLinea}
                sx={{
                  minHeight: 42,
                  minWidth: 170,
                  px: 3,
                  bgcolor: "#dc2f2f",
                  boxShadow: "0 6px 16px rgba(220, 47, 47, 0.24)",
                  "&:hover": { bgcolor: "#b91f1f", boxShadow: "0 7px 18px rgba(185, 31, 31, 0.28)" },
                }}
              >
                {editingKey == null ? "Agregar" : "Guardar cambios"}
              </Button>
            </Stack>
          </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="overline" color="primary" fontWeight={700}>03</Typography>
            <Typography variant="h6">Artículos agregados</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Chip label={`Venta: ${formatCurrency(subtotalVenta)}`} color="primary" variant="outlined" />
            <Chip label={`Producción: ${formatCurrency(subtotalPedido)}`} color="success" variant="outlined" />
          </Stack>
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Operacion</TableCell>
                <TableCell>Producto</TableCell>
                <TableCell>Variante</TableCell>
                <TableCell>Origen</TableCell>
                <TableCell align="center">Cantidad</TableCell>
                <TableCell>Precio y ajustes</TableCell>
                <TableCell align="right">Subtotal</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lineas.map((item) => {
                const producto = productoMap.get(item.productoId);
                const bodegaOrigen = item.bodegaId ? bodegaMap.get(Number(item.bodegaId)) : null;
                const requiereTraslado =
                  item.tipoOperacion === "venta" &&
                  Boolean(bodegaId && item.bodegaId) &&
                  Number(item.bodegaId) !== Number(bodegaId);
                return (
                  <TableRow key={item.key} hover>
                    <TableCell>
                      <Chip
                        size="small"
                        color={item.tipoOperacion === "venta" ? "primary" : "success"}
                        variant="outlined"
                        label={item.tipoOperacion === "venta" ? "Inventario" : "Produccion"}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>{producto?.codigo || item.productoId}</Typography>
                      <Typography variant="caption" color="text.secondary">{producto?.nombre || producto?.tipo || "Producto"}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{producto?.genero || "N/D"} · {resolveTelaNombre(producto, telas)}</Typography>
                      <Typography variant="caption" color="text.secondary">{resolveTallaNombre(producto, tallas)} · {resolveColorNombre(producto, colores)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.tipoOperacion === "venta" ? bodegaOrigen?.nombre || "N/D" : "Produccion"}</Typography>
                      {requiereTraslado && <Chip size="small" color="warning" variant="outlined" label="Requiere traslado" sx={{ mt: 0.5 }} />}
                    </TableCell>
                    <TableCell align="center"><Typography fontWeight={700}>{item.cantidad}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatCurrency(item.precioUnit)} c/u</Typography>
                      {(Number(item.bordado || 0) > 0 || Number(item.descuento || 0) > 0) && (
                        <Typography variant="caption" color="text.secondary">
                          {Number(item.bordado || 0) > 0 ? `Bordado ${formatCurrency(item.bordado)}` : ""}
                          {Number(item.bordado || 0) > 0 && Number(item.descuento || 0) > 0 ? " · " : ""}
                          {Number(item.descuento || 0) > 0 ? `Descuento ${item.descuento}%` : ""}
                        </Typography>
                      )}
                      {item.descripcion && <Typography variant="caption" display="block" color="text.secondary">{item.descripcion}</Typography>}
                    </TableCell>
                    <TableCell align="right"><Typography fontWeight={700}>{formatCurrency(calcularSubtotal(item))}</Typography></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Button size="small" aria-label="Editar articulo" onClick={() => editarLinea(item)} sx={{ minWidth: 36, px: 1 }}><EditOutlined fontSize="small" /></Button>
                        <Button color="error" size="small" aria-label="Quitar articulo" onClick={() => setLineas((prev) => prev.filter((row) => row.key !== item.key))} sx={{ minWidth: 36, px: 1 }}><DeleteOutline fontSize="small" /></Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!lineas.length && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    <Typography color="text.secondary">Aun no has agregado articulos.</Typography>
                    <Typography variant="caption" color="text.secondary">Busca un producto arriba y completa su cantidad.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="overline" color="primary" fontWeight={700}>04</Typography>
          <Typography variant="h6">Resumen y confirmacion</Typography>
        </Stack>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 8 }}>
            {subtotalVenta > 0 && subtotalPedido > 0 && (
              <Alert severity="info">
                El anticipo se repartira proporcionalmente: {formatCurrency(anticipoVenta)} a venta y {formatCurrency(anticipoPedido)} a pedido.
              </Alert>
            )}
            {pedidoSinAnticipo && (
              <Alert severity="warning">La parte de producción necesita anticipo mayor a 0, salvo que sea orden de compra.</Alert>
            )}
            {produccionRequiereAutorizacion && (
              <Alert severity="warning">
                La parte de produccion supera {formatCurrency(PEDIDO_AUTORIZACION_MONTO_MINIMO)}. Esta orden debe generarla un administrador o un usuario autorizado.
              </Alert>
            )}
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.default", overflow: "hidden" }}>
              {[
                ["Venta desde inventario", subtotalVenta],
                ["Pedido producción", subtotalPedido],
                ["Envio", envioMonto],
                ["Total operación", total],
                ["Anticipo aplicado a venta", anticipoVenta],
                ["Anticipo aplicado a pedido", anticipoPedido],
                ["Saldo total", saldoTotal],
              ].map(([label, value]) => (
                <Stack key={String(label)} direction="row" justifyContent="space-between" sx={{ px: 2, py: 1, borderBottom: label === "Saldo total" ? 0 : "1px solid", borderColor: "divider" }}>
                  <Typography variant="body2">{label}</Typography>
                  <Typography variant="body2" fontWeight={600}>{formatCurrency(Number(value))}</Typography>
                </Stack>
              ))}
            </Box>
          </Grid>
        </Grid>
        <Divider sx={{ my: 2 }} />
        <Stack direction="row" justifyContent="flex-end" spacing={1}>
          <Button variant="outlined" onClick={() => navigate("/orden-mixta")} disabled={saving}>Cancelar</Button>
          <Button variant="contained" startIcon={<SaveOutlined />} onClick={guardar} disabled={saving || pedidoSinAnticipo}>
            {saving ? "Generando..." : "Generar orden"}
          </Button>
        </Stack>
      </Paper>

      <Dialog open={bordadosModalOpen} onClose={() => setBordadosModalOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Gestionar bordados de la prenda</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Monto" value={emptyWhenZero(linea.bordado)} onChange={(event) => setLinea((prev) => ({ ...prev, bordado: parseNumberInput(event.target.value) }))} /></Grid>
              <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth required label="Color de bordado" value={linea.bordadoColor} onChange={(event) => setLinea((prev) => ({ ...prev, bordadoColor: event.target.value }))} /></Grid>
              <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth required label="Tamano de bordado" value={linea.bordadoTamano} onChange={(event) => setLinea((prev) => ({ ...prev, bordadoTamano: event.target.value }))} /></Grid>
              <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth required label="Posicion de bordado" value={linea.bordadoPosicion} onChange={(event) => setLinea((prev) => ({ ...prev, bordadoPosicion: event.target.value }))} /></Grid>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Observaciones especiales" value={linea.bordadoObservaciones} onChange={(event) => setLinea((prev) => ({ ...prev, bordadoObservaciones: event.target.value }))} /></Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Button variant="outlined" component="label" color="success">
                    Imagen de bordado
                    <input hidden type="file" accept="image/*" onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (!file.type.startsWith("image/")) { void Swal.fire("Validacion", "Selecciona un archivo de imagen", "warning"); return; }
                      const dataUrl = await fileToDataUrl(file);
                      setLinea((prev) => ({ ...prev, bordadoImagenUrl: dataUrl }));
                      setBordadoPreviewOpen(true);
                      event.target.value = "";
                    }} />
                  </Button>
                  <Button variant="text" disabled={!linea.bordadoImagenUrl} onClick={() => setBordadoPreviewOpen(true)}>Vista previa</Button>
                  {linea.bordadoImagenUrl && <Button variant="text" color="error" onClick={() => setLinea((prev) => ({ ...prev, bordadoImagenUrl: "" }))}>Quitar imagen</Button>}
                </Stack>
              </Grid>
            </Grid>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box><Typography variant="subtitle2">Bordados agregados: {linea.bordados.length}</Typography><Typography variant="caption" color="text.secondary">Agrega uno por cada posicion o diseño diferente.</Typography></Box>
              <Stack direction="row" spacing={1}><Button variant="contained" color="success" onClick={agregarBordadoActual}>Agregar bordado</Button><Button variant="text" onClick={limpiarBordadoActual}>Limpiar captura</Button></Stack>
            </Stack>
            <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
              <Table size="small">
                <TableHead><TableRow><TableCell>Posicion</TableCell><TableCell>Color</TableCell><TableCell>Tamano</TableCell><TableCell align="right">Monto</TableCell><TableCell>Imagen</TableCell><TableCell>Observaciones</TableCell><TableCell align="center">Acciones</TableCell></TableRow></TableHead>
                <TableBody>
                  {linea.bordados.map((bordado) => <TableRow key={bordado.key}><TableCell>{bordado.posicion}</TableCell><TableCell>{bordado.color}</TableCell><TableCell>{bordado.tamano}</TableCell><TableCell align="right">{formatCurrency(bordado.monto)}</TableCell><TableCell>{bordado.imagenUrl ? "Si" : "No"}</TableCell><TableCell>{bordado.observaciones || "-"}</TableCell><TableCell align="center"><Button size="small" onClick={() => editarBordadoActual(bordado)}>Editar</Button><Button size="small" color="error" onClick={() => setLinea((prev) => ({ ...prev, bordados: prev.bordados.filter((item) => item.key !== bordado.key) }))}>Quitar</Button></TableCell></TableRow>)}
                  {!linea.bordados.length && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3, color: "text.secondary" }}>Aun no has agregado bordados.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setBordadosModalOpen(false)}>Cerrar</Button></DialogActions>
      </Dialog>

      <Dialog open={bordadoPreviewOpen} onClose={() => setBordadoPreviewOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Vista previa de imagen de bordado</DialogTitle>
        <DialogContent dividers>
          {linea.bordadoImagenUrl ? <Box component="img" src={linea.bordadoImagenUrl} alt="Imagen de bordado" sx={{ width: "100%", maxHeight: 420, objectFit: "contain" }} /> : <Typography color="text.secondary">No hay imagen seleccionada.</Typography>}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}


