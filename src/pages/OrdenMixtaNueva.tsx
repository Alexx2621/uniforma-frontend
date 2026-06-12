import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
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
import Swal from "sweetalert2";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/axios";
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

type Linea = {
  key: number;
  productoId: number;
  tipoOperacion: "venta" | "pedido";
  bodegaId: number | "";
  cantidad: number;
  precioUnit: number;
  bordado: number;
  descuento: number;
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
  descuento: 0,
  descripcion: "",
  stock: null,
  controlaInventario: false,
};

const ORDEN_MIXTA_BORRADOR_TIPO = "orden-mixta";
const ORDEN_MIXTA_BORRADOR_LOCAL_KEY = "orden-mixta:borrador-local:v1";

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

const calcularSubtotal = (linea: Pick<Linea, "cantidad" | "precioUnit" | "bordado" | "descuento">) => {
  const cantidad = Number(linea.cantidad || 0);
  const precio = Number(linea.precioUnit || 0);
  const bordado = Number(linea.bordado || 0);
  const descuento = 1 - Number(linea.descuento || 0) / 100;
  return Math.round(cantidad * (precio * descuento + bordado) * 100) / 100;
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
  const [filtroGenero, setFiltroGenero] = useState("");
  const [filtroTela, setFiltroTela] = useState("");
  const [filtroTalla, setFiltroTalla] = useState("");
  const [filtroColor, setFiltroColor] = useState("");
  const [documentoBorradorId, setDocumentoBorradorId] = useState<number | null>(null);
  const [borradorGuardadoEn, setBorradorGuardadoEn] = useState("");
  const [borradorEstado, setBorradorEstado] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const borradorInicializadoRef = useRef(false);
  const restaurandoBorradorRef = useRef(false);
  const autoguardadoBorradorBloqueadoRef = useRef(false);
  const ultimoBorradorJsonRef = useRef("");
  const savingRef = useRef(false);

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
        key: Number(data?.capturaLinea?.key || Date.now()),
        bodegaId: data?.capturaLinea?.bodegaId || encabezado.bodegaId || (auth.bodegaId ? Number(auth.bodegaId) : ""),
      });
      setLineas(Array.isArray(data?.lineas) ? data.lineas : []);
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
  const requiereReferencia = metodoPago !== "efectivo";
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
  const pedidoSinAnticipo = subtotalPedido > 0 && anticipoPedido <= 0 && metodoPago !== "orden_compra";
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

  const seleccionarCliente = (value: Cliente | null) => {
    setCliente(value);
    if (value) {
      setClienteNombre(value.nombre || "");
      setClienteTelefono(value.telefono || "");
    }
  };

  const agregarLinea = () => {
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
    setLineas((prev) =>
      editingKey == null
        ? [...prev, { ...linea, key: Date.now() }]
        : prev.map((row) => (row.key === editingKey ? { ...linea, key: editingKey } : row)),
    );
    setLinea({ ...lineBase, key: Date.now(), bodegaId: bodegaId || "" });
    setEditingKey(null);
    setFiltroTipo("");
    setFiltroGenero("");
    setFiltroTela("");
    setFiltroTalla("");
    setFiltroColor("");
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
    if (requiereReferencia && !referenciaPago.trim()) {
      void Swal.fire("Referencia requerida", "Ingresa la referencia del pago.", "warning");
      return;
    }
    if (metodoPago === "deposito_bancario" && !bancoPago.trim()) {
      void Swal.fire("Banco requerido", "Ingresa el banco del depósito.", "warning");
      return;
    }
    if (pedidoSinAnticipo) {
      void Swal.fire("Anticipo requerido", "La parte de producción necesita anticipo si no es orden de compra.", "warning");
      return;
    }

    const confirm = await Swal.fire({
      title: "Generar orden mixta",
      text: "Se creara una venta para inventario y un pedido para producción según el detalle.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Generar",
      cancelButtonText: "Cancelar",
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
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <div>
          <Typography variant="h4" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CallSplitOutlined /> Nueva orden mixta
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Usa venta para lo que sale de stock y pedido para lo que debe producirse.
          </Typography>
        </div>
        <Button variant="outlined" startIcon={<ArrowBackOutlined />} onClick={() => navigate("/orden-mixta")}>
          Volver
        </Button>
      </Stack>

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

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Datos del documento</Typography>
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
            <TextField fullWidth type="number" label="Anticipo total" value={emptyWhenZero(anticipoTotal)} onChange={(event) => setAnticipoTotal(parseNumberInput(event.target.value))} />
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

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Agregar artículo</Typography>
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
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Operacion</InputLabel>
              <Select label="Operacion" value={linea.tipoOperacion} onChange={(event) => setLinea((prev) => ({ ...prev, tipoOperacion: event.target.value as "venta" | "pedido" }))}>
                <MenuItem value="venta">Venta desde stock</MenuItem>
                <MenuItem value="pedido">Pedido producción</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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
          <Grid size={{ xs: 6, sm: 3, md: 1 }}>
            <TextField fullWidth type="number" label="Cant." value={emptyWhenZero(linea.cantidad)} onChange={(event) => setLinea((prev) => ({ ...prev, cantidad: parseNumberInput(event.target.value) }))} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 1 }}>
            <TextField fullWidth type="number" label="Precio" value={linea.precioUnit} disabled helperText="Catalogo" />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 1 }}>
            <TextField fullWidth type="number" label="Bordado" value={emptyWhenZero(linea.bordado)} onChange={(event) => setLinea((prev) => ({ ...prev, bordado: parseNumberInput(event.target.value) }))} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 1 }}>
            <TextField fullWidth type="number" label="Desc. %" value={emptyWhenZero(linea.descuento)} onChange={(event) => setLinea((prev) => ({ ...prev, descuento: parseNumberInput(event.target.value) }))} />
          </Grid>
          <Grid size={{ xs: 12, sm: 3, md: 2 }}>
            <Button fullWidth variant="contained" startIcon={<AddIcon />} onClick={agregarLinea} sx={{ minHeight: 40, mt: "8px" }}>
              {editingKey == null ? "Agregar" : "Guardar"}
            </Button>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth label="Observación de línea" value={linea.descripcion} onChange={(event) => setLinea((prev) => ({ ...prev, descripcion: event.target.value }))} />
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">Artículos agregados</Typography>
          <Stack direction="row" spacing={1}>
            <Chip label={`Venta: ${formatCurrency(subtotalVenta)}`} color="primary" variant="outlined" />
            <Chip label={`Producción: ${formatCurrency(subtotalPedido)}`} color="success" variant="outlined" />
          </Stack>
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Codigo</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Genero</TableCell>
                <TableCell>Tela</TableCell>
                <TableCell>Talla</TableCell>
                <TableCell>Color</TableCell>
                <TableCell>Bodega origen</TableCell>
                <TableCell>Traslado</TableCell>
                <TableCell>Cantidad</TableCell>
                <TableCell>Precio</TableCell>
                <TableCell>Bordado</TableCell>
                <TableCell>Detalle bordado</TableCell>
                <TableCell>Estilo especial</TableCell>
                <TableCell>Desc.</TableCell>
                <TableCell>Observacion</TableCell>
                <TableCell>Subtotal</TableCell>
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
                const detalleBordado = Number(item.bordado || 0) > 0 ? formatCurrency(item.bordado) : "No";
                return (
                  <TableRow key={item.key}>
                    <TableCell>{producto?.codigo || item.productoId}</TableCell>
                    <TableCell>{producto?.tipo || producto?.nombre || "Producto"}</TableCell>
                    <TableCell>{producto?.genero || "N/D"}</TableCell>
                    <TableCell>{resolveTelaNombre(producto, telas)}</TableCell>
                    <TableCell>{resolveTallaNombre(producto, tallas)}</TableCell>
                    <TableCell>{resolveColorNombre(producto, colores)}</TableCell>
                    <TableCell>{item.tipoOperacion === "venta" ? bodegaOrigen?.nombre || "N/D" : "Produccion"}</TableCell>
                    <TableCell>
                      {requiereTraslado ? <Chip size="small" color="warning" label="Pendiente" /> : <Chip size="small" label="No aplica" />}
                    </TableCell>
                    <TableCell>{item.cantidad}</TableCell>
                    <TableCell>{formatCurrency(item.precioUnit)}</TableCell>
                    <TableCell>{formatCurrency(item.bordado)}</TableCell>
                    <TableCell>{detalleBordado}</TableCell>
                    <TableCell>No</TableCell>
                    <TableCell>{item.descuento}%</TableCell>
                    <TableCell>{item.descripcion || "-"}</TableCell>
                    <TableCell>{formatCurrency(calcularSubtotal(item))}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Button size="small" startIcon={<EditOutlined />} onClick={() => editarLinea(item)}>
                          Editar
                        </Button>
                        <Button color="error" size="small" startIcon={<DeleteOutline />} onClick={() => setLineas((prev) => prev.filter((row) => row.key !== item.key))}>
                          Quitar
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!lineas.length && (
                <TableRow>
                  <TableCell colSpan={17} align="center" sx={{ py: 4 }}>Aun no has agregado articulos a la orden mixta.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={{ p: 2 }}>
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
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
              {[
                ["Venta desde inventario", subtotalVenta],
                ["Pedido producción", subtotalPedido],
                ["Envio", envioMonto],
                ["Total operación", total],
                ["Anticipo aplicado a venta", anticipoVenta],
                ["Anticipo aplicado a pedido", anticipoPedido],
                ["Saldo total", saldoTotal],
              ].map(([label, value]) => (
                <Stack key={String(label)} direction="row" justifyContent="space-between" sx={{ px: 2, py: 1 }}>
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
    </Stack>
  );
}


