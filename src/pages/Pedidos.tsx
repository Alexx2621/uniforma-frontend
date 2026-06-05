import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  Paper,
  Typography,
  Stack,
  Button,
  Chip,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  Menu,
  MenuItem,
  ListItemIcon,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { DataGrid, GridColDef, useGridApiRef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import MergeTypeOutlined from "@mui/icons-material/MergeTypeOutlined";
import PlaylistAddCheckOutlined from "@mui/icons-material/PlaylistAddCheckOutlined";
import BlockOutlined from "@mui/icons-material/BlockOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { io, Socket } from "socket.io-client";
import { api } from "../api/axios";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import TransactionRelationMap, { RelationEdge, RelationNode } from "../components/TransactionRelationMap";
import { descargarProduccionDetallePedidosPdf, descargarProduccionUnificadoPdf, ProduccionDetallePedidoPdf } from "../utils/produccionUnificadoPdf";
import { formatCurrency } from "../utils/currency";
import { formatReportScheduleForDay, getActionSchedule, isReportScheduleOpen } from "../utils/reportSchedule";

interface ProductoCatalogo {
  id: number;
  codigo?: string;
  nombre?: string;
  tipo?: string | null;
  genero?: string | null;
  telaId?: number | null;
  tallaId?: number | null;
  colorId?: number | null;
  tela_id?: number | null;
  talla_id?: number | null;
  color_id?: number | null;
  telaNombre?: string | null;
  tallaNombre?: string | null;
  colorNombre?: string | null;
  tela?: { id?: number | null; nombre?: string | null } | null;
  talla?: { id?: number | null; nombre?: string | null } | null;
  color?: { id?: number | null; nombre?: string | null } | null;
}

interface PedidoDetalle {
  productoId: number;
  cantidad: number;
  descripcion?: string | null;
  producto?: ProductoCatalogo | null;
}

interface PedidoRow {
  id: number;
  fecha: string;
  estado: string;
  totalEstimado: number;
  anticipo: number;
  saldoPendiente: number;
  cliente?: { nombre: string };
  clienteId?: number | null;
  clienteNombre?: string;
  clienteDisplay?: string;
  bodega?: { nombre: string };
  bodegaId?: number | null;
  bodegaNombre?: string;
  bodegaDisplay?: string;
  folio?: string;
  displayFolio?: string;
  metodoPago?: string | null;
  solicitadoPor?: string | null;
  unificado?: boolean;
  unificadoCorrelativo?: string | null;
  unificaciones?: Array<{
    produccionUnificadoId: number;
    produccionUnificado?: { id?: number; correlativo?: string | null } | null;
  }>;
  detalle?: PedidoDetalle[];
  pagos?: Array<{ id: number; total: number; fecha?: string }>;
  avances?: Array<{ id: number; total: number; fecha?: string }>;
  postventaId?: number | null;
  postventaCobro?: string | null;
  postventa?: {
    id?: number | null;
    folio?: string | null;
    tipo?: string | null;
    motivo?: string | null;
    monto?: number | null;
    fecha?: string | null;
    estado?: string | null;
    clienteNombre?: string | null;
  } | null;
}

interface RelationNodeItem extends RelationNode {}

interface RelationEdgeItem extends RelationEdge {}

interface PedidosNavigationState {
  returnTo?: string;
  returnLabel?: string;
  pedidosState?: {
    filters?: {
      cliente?: string;
      fechaInicio?: string;
      fechaFin?: string;
      bodega?: number | "all";
      tipoPedido?: "clientes" | "stock" | "ambos";
    };
    pagination?: {
      page?: number;
      pageSize?: number;
    };
    selectedId?: number | null;
  };
}

interface Bodega {
  id: number;
  nombre: string;
}

interface CatalogoItem {
  id: number;
  nombre?: string | null;
}

interface ArticuloUnificado {
  key: string;
  codigo: string;
  nombre: string;
  tipo: string;
  genero: string;
  tela: string;
  talla: string;
  color: string;
  descripcion: string;
  cantidad: number;
  compactadoPor?: "talla" | "color" | "tela" | "genero" | "descripcion";
  fuentes: {
    pedidoId: number;
    folio: string;
    solicitadoPor: string;
    cantidad: number;
    valorAgrupado?: string;
  }[];
}

const getTodayDateInputValue = () => {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().slice(0, 10);
};

const formatDateForFilename = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const sanitizeFilename = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_");

const PEDIDOS_AUTO_REFRESH_MS = 30000;

const compareText = (a?: string | null, b?: string | null) =>
  `${a || ""}`.localeCompare(`${b || ""}`, "es", { numeric: true, sensitivity: "base" });

const compareArticuloUnificadoPorPedido = (a: ArticuloUnificado, b: ArticuloUnificado) => {
  const porPedido = compareText(a.tipo, b.tipo);
  if (porPedido !== 0) return porPedido;
  const porTela = compareText(a.tela, b.tela);
  if (porTela !== 0) return porTela;
  const porColor = compareText(a.color, b.color);
  if (porColor !== 0) return porColor;
  const porTalla = compareText(a.talla, b.talla);
  if (porTalla !== 0) return porTalla;
  const porSexo = compareText(a.genero, b.genero);
  if (porSexo !== 0) return porSexo;
  return compareText(a.descripcion, b.descripcion);
};

const COMPACTABLE_FIELDS = ["talla", "color", "tela", "genero", "descripcion"] as const;

type CompactableField = (typeof COMPACTABLE_FIELDS)[number];

const getArticuloField = (articulo: ArticuloUnificado, field: CompactableField) => `${articulo[field] || "N/D"}`;

const buildArticuloKey = (articulo: Pick<ArticuloUnificado, "tipo" | "genero" | "tela" | "talla" | "color" | "descripcion">) =>
  [articulo.tipo, articulo.genero, articulo.tela, articulo.talla, articulo.color, articulo.descripcion].join("|");

const buildArticuloKeyWithoutField = (articulo: ArticuloUnificado, field: CompactableField) =>
  [
    articulo.tipo,
    field === "genero" ? "*" : articulo.genero,
    field === "tela" ? "*" : articulo.tela,
    field === "talla" ? "*" : articulo.talla,
    field === "color" ? "*" : articulo.color,
    field === "descripcion" ? "*" : articulo.descripcion,
  ].join("|");

const formatCantidadValor = (cantidad: number, value: string) => `${Number(cantidad || 0)}. ${value}`;

const mergeValueBreakdown = (items: ArticuloUnificado[], field: CompactableField) => {
  const quantities = new Map<string, number>();

  items.forEach((item) => {
    const value = getArticuloField(item, field);
    quantities.set(value, (quantities.get(value) || 0) + Number(item.cantidad || 0));
  });

  return Array.from(quantities.entries())
    .sort(([a], [b]) => compareText(a, b))
    .map(([value, quantity]) => formatCantidadValor(quantity, value))
    .join("\n");
};

const compactArticulosUnificados = (articulos: ArticuloUnificado[]) => {
  const pending = [...articulos];
  const compactados: ArticuloUnificado[] = [];

  for (const field of COMPACTABLE_FIELDS) {
    const buckets = new Map<string, ArticuloUnificado[]>();

    pending.forEach((item) => {
      if (item.compactadoPor) return;
      const key = buildArticuloKeyWithoutField(item, field);
      const bucket = buckets.get(key) || [];
      bucket.push(item);
      buckets.set(key, bucket);
    });

    const used = new Set<string>();

    buckets.forEach((bucket) => {
      if (bucket.length < 2) return;
      const distinctValues = new Set(bucket.map((item) => getArticuloField(item, field)));
      if (distinctValues.size < 2) return;

      const [base] = bucket;
      const merged: ArticuloUnificado = {
        ...base,
        key: `${field}|${buildArticuloKeyWithoutField(base, field)}`,
        cantidad: bucket.reduce((sum, item) => sum + Number(item.cantidad || 0), 0),
        compactadoPor: field,
        fuentes: bucket.flatMap((item) =>
          item.fuentes.map((fuente) => ({
            ...fuente,
            valorAgrupado: getArticuloField(item, field),
          })),
        ),
      };
      merged[field] = mergeValueBreakdown(bucket, field) as never;
      compactados.push(merged);
      bucket.forEach((item) => used.add(item.key));
    });

    if (used.size) {
      for (let index = pending.length - 1; index >= 0; index -= 1) {
        if (used.has(pending[index].key)) {
          pending.splice(index, 1);
        }
      }
    }
  }

  return [...pending, ...compactados].sort(compareArticuloUnificadoPorPedido);
};

const buildResumenUnificacion = (
  articulos: ArticuloUnificado[],
  pedidos: PedidoRow[],
  bodegaId: number | null,
  filtroTienda: string
) => ({
  bodegaId,
  filtroTienda,
  pedidos: [...pedidos]
    .map((pedido) => ({
      id: Number(pedido.id) || 0,
      folio: pedido.displayFolio || `P-${pedido.id}`,
      fecha: pedido.fecha || "",
      solicitadoPor: `${pedido.solicitadoPor || ""}`.trim(),
      bodegaId: pedido.bodegaId ?? null,
    }))
    .sort((a, b) => a.id - b.id),
  articulos: [...articulos].map((articulo) => ({
    key: articulo.key,
    codigo: articulo.codigo,
    nombre: articulo.nombre,
    tipo: articulo.tipo,
    genero: articulo.genero,
    tela: articulo.tela,
    talla: articulo.talla,
    color: articulo.color,
    descripcion: articulo.descripcion,
    cantidad: articulo.cantidad,
    fuentes: [...articulo.fuentes]
      .map((fuente) => ({
        pedidoId: Number(fuente.pedidoId) || 0,
        folio: fuente.folio,
        solicitadoPor: fuente.solicitadoPor,
        cantidad: Number(fuente.cantidad) || 0,
      }))
      .sort((a, b) => {
        const porPedido = a.pedidoId - b.pedidoId;
        if (porPedido !== 0) return porPedido;
        const porFolio = a.folio.localeCompare(b.folio);
        if (porFolio !== 0) return porFolio;
        const porUsuario = a.solicitadoPor.localeCompare(b.solicitadoPor);
        if (porUsuario !== 0) return porUsuario;
        return a.cantidad - b.cantidad;
      }),
  })),
});

export default function Pedidos() {
  const navigate = useNavigate();
  const location = useLocation();
  const restoredPedidosState = (location.state as PedidosNavigationState | null)?.pedidosState;
  const pedidosGridApiRef = useGridApiRef();
  const [rows, setRows] = useState<PedidoRow[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [telas, setTelas] = useState<CatalogoItem[]>([]);
  const [tallas, setTallas] = useState<CatalogoItem[]>([]);
  const [colores, setColores] = useState<CatalogoItem[]>([]);
  const [filterCliente, setFilterCliente] = useState(() => restoredPedidosState?.filters?.cliente || "");
  const [filterFechaInicio, setFilterFechaInicio] = useState(
    () => restoredPedidosState?.filters?.fechaInicio || getTodayDateInputValue()
  );
  const [filterFechaFin, setFilterFechaFin] = useState(
    () => restoredPedidosState?.filters?.fechaFin || getTodayDateInputValue()
  );
  const [filterBodega, setFilterBodega] = useState<number | "all">(
    () => restoredPedidosState?.filters?.bodega ?? "all"
  );
  const [filterTipoPedido, setFilterTipoPedido] = useState<"clientes" | "stock" | "ambos">(
    () => restoredPedidosState?.filters?.tipoPedido || "clientes"
  );
  const [paginationModel, setPaginationModel] = useState(() => ({
    page: Math.max(0, Number(restoredPedidosState?.pagination?.page || 0)),
    pageSize: Number(restoredPedidosState?.pagination?.pageSize || 10),
  }));
  const [selectedPedidoId, setSelectedPedidoId] = useState<number | null>(() => {
    const value = Number(restoredPedidosState?.selectedId);
    return Number.isFinite(value) && value > 0 ? value : null;
  });
  const [generandoUnificado, setGenerandoUnificado] = useState(false);
  const [generandoDetallePedidos, setGenerandoDetallePedidos] = useState(false);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const cargandoPedidosRef = useRef(false);
  const pedidosSocketRef = useRef<Socket | null>(null);
  const skipInitialPaginationResetRef = useRef(Boolean(restoredPedidosState));
  const { rol, permisos, bodegaId: userBodegaId } = useAuthStore();
  const { fetchConfig, reportesConfig } = useSystemConfigStore();
  const canAccessAllBodegas = hasPermission(rol, permisos, "sistema.multi-tienda");
  const canUnifyPedidos = hasPermission(rol, permisos, "produccion.unificar");
  const pedidoSchedule = useMemo(() => getActionSchedule(reportesConfig, "pedidoNuevo"), [reportesConfig]);
  const pedidoScheduleOpen = useMemo(() => isReportScheduleOpen(pedidoSchedule), [pedidoSchedule]);

  const [relationModalOpen, setRelationModalOpen] = useState(false);
  const [relationModalData, setRelationModalData] = useState<{ nodes: RelationNodeItem[]; edges: RelationEdgeItem[] } | null>(null);
  const [relationModalTitle, setRelationModalTitle] = useState("Relaciones del pedido");
  const [contextMenuAnchor, setContextMenuAnchor] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const [contextMenuPedido, setContextMenuPedido] = useState<PedidoRow | null>(null);

  const buildPedidosReturnState = (pedidoId?: number | null): PedidosNavigationState => ({
    returnTo: "/produccion",
    returnLabel: "Regresar a pedidos",
    pedidosState: {
      filters: {
        cliente: filterCliente,
        fechaInicio: filterFechaInicio,
        fechaFin: filterFechaFin,
        bodega: filterBodega,
        tipoPedido: filterTipoPedido,
      },
      pagination: paginationModel,
      selectedId: pedidoId ?? selectedPedidoId,
    },
  });

  const abrirPedidoDetalle = (pedido: Pick<PedidoRow, "id">) => {
    const pedidoId = Number(pedido.id);
    setSelectedPedidoId(pedidoId);
    navigate(`/produccion/${pedidoId}`, { state: buildPedidosReturnState(pedidoId) });
  };

  const openRelationModal = async (pedido: PedidoRow) => {
    try {
      const resp = await api.get(`/relaciones/pedido/${pedido.id}`);
      setRelationModalTitle(`Relaciones de ${pedido.displayFolio || pedido.folio || `P-${pedido.id}`}`);
      setRelationModalData(resp.data || { nodes: [], edges: [] });
      setRelationModalOpen(true);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudieron cargar las relaciones", "error");
    }
  };

  const closeRelationModal = () => {
    setRelationModalOpen(false);
    setRelationModalData(null);
  };

  const abrirNuevoPedido = () => {
    if (!pedidoScheduleOpen) {
      Swal.fire(
        "Horario no habilitado",
        `La creacion de pedidos esta habilitada en este horario: ${formatReportScheduleForDay(pedidoSchedule)}.`,
        "info"
      );
      return;
    }
    navigate("/produccion/nuevo", { state: buildPedidosReturnState(selectedPedidoId) });
  };

  const handleRelationNodeClick = (node: RelationNodeItem) => {
    if (!node.path) return;
    const match = node.path.match(/^\/produccion\/(\d+)$/);
    if (match) {
      const pedidoId = Number(match[1]);
      setSelectedPedidoId(pedidoId);
      navigate(node.path, { state: buildPedidosReturnState(pedidoId) });
      return;
    }
    navigate(node.path);
  };

  const handleGridContextMenu = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    const rowElement = target?.closest("[data-id]") as HTMLElement | null;
    const rowId = rowElement?.getAttribute("data-id");
    if (!rowId) return;
    const row = filtered.find((item) => String(item.id) === rowId);
    if (!row) return;
    event.preventDefault();
    setContextMenuPedido(row);
    setContextMenuAnchor({ mouseX: event.clientX - 2, mouseY: event.clientY - 4 });
  };

  const handleCloseContextMenu = () => {
    setContextMenuAnchor(null);
    setContextMenuPedido(null);
  };

  const handleContextMenuAction = (action: "relations" | "open" | "payments") => {
    if (!contextMenuPedido) {
      handleCloseContextMenu();
      return;
    }
    switch (action) {
      case "relations":
        void openRelationModal(contextMenuPedido);
        break;
      case "open":
        abrirPedidoDetalle(contextMenuPedido);
        break;
      case "payments":
        setSelectedPedidoId(Number(contextMenuPedido.id));
        navigate(`/pagos/recibidos?pedido=${contextMenuPedido.id}`, { state: buildPedidosReturnState(contextMenuPedido.id) });
        break;
    }
    handleCloseContextMenu();
  };

  const obtenerNombreCliente = (row: any) =>
    row?.clienteDisplay ||
    row?.clienteNombre ||
    row?.cliente?.nombre ||
    row?.cliente_name ||
    row?.nombreCliente ||
    row?.nombre_cliente ||
    (typeof row?.cliente === "string" ? row?.cliente : undefined) ||
    "Mostrador";

  const obtenerNombreBodega = (row: any) =>
    row?.bodegaDisplay ||
    row?.bodegaNombre ||
    row?.bodega?.nombre ||
    row?.bodega_name ||
    (typeof row?.bodega === "string" ? row?.bodega : undefined) ||
    "N/D";

  const obtenerUsuarioPedido = (row: any) => {
    const solicitadoPor = `${row?.solicitadoPor || ""}`.trim();
    const usuarioReal = row?.usuario?.nombre || row?.usuario?.usuario || row?.creadoPor || row?.vendedor || "";
    if (solicitadoPor && solicitadoPor.toLowerCase() !== "stock bajo") return solicitadoPor;
    return usuarioReal || solicitadoPor || "N/D";
  };

  const normalizarTexto = (value?: string | null) => {
    const limpio = `${value || ""}`.trim();
    return limpio || "N/D";
  };

  const toDateOnly = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  };

  const buscarNombreCatalogo = (
    producto: ProductoCatalogo | PedidoDetalle["producto"] | undefined | null,
    tipo: "tela" | "talla" | "color"
  ) => {
    if (!producto) return "N/D";

    const fromNested =
      tipo === "tela"
        ? producto.tela?.nombre
        : tipo === "talla"
          ? producto.talla?.nombre
          : producto.color?.nombre;
    if (`${fromNested || ""}`.trim()) return normalizarTexto(fromNested);

    const fromNamed =
      tipo === "tela"
        ? (producto as any).telaNombre
        : tipo === "talla"
          ? (producto as any).tallaNombre
          : (producto as any).colorNombre;
    if (`${fromNamed || ""}`.trim()) return normalizarTexto(fromNamed);

    const itemId =
      tipo === "tela"
        ? producto.telaId ?? producto.tela_id ?? (producto as any).telaid ?? producto.tela?.id
        : tipo === "talla"
          ? producto.tallaId ?? producto.talla_id ?? (producto as any).tallaid ?? producto.talla?.id
          : producto.colorId ?? producto.color_id ?? (producto as any).colorid ?? producto.color?.id;

    const source = tipo === "tela" ? telas : tipo === "talla" ? tallas : colores;
    const found = source.find((item) => Number(item.id) === Number(itemId))?.nombre;
    return normalizarTexto(found);
  };

  const cargar = async (silent = false) => {
    if (cargandoPedidosRef.current) return;
    cargandoPedidosRef.current = true;
    if (!silent) setLoadingPedidos(true);

    try {
      const [resp, respClientes, respBodegas, respProductos, respTelas, respTallas, respColores] = await Promise.all([
        api.get("/produccion"),
        api.get("/clientes").catch(() => ({ data: [] })),
        api.get("/bodegas").catch(() => ({ data: [] })),
        api.get("/productos").catch(() => ({ data: [] })),
        api.get("/telas").catch(() => ({ data: [] })),
        api.get("/tallas").catch(() => ({ data: [] })),
        api.get("/colores").catch(() => ({ data: [] })),
      ]);
      const clientes = respClientes.data || [];
      const bodegas = respBodegas.data || [];
      const productos = respProductos.data || [];
      const telas = respTelas.data || [];
      const tallas = respTallas.data || [];
      const colores = respColores.data || [];
      const clienteMap = new Map<number, string>(clientes.map((c: any) => [Number(c.id), c.nombre]));
      const bodegaMap = new Map<number, string>(bodegas.map((b: any) => [Number(b.id), b.nombre]));

      const normalizados = (resp.data || []).map((p: any, idx: number) => {
        const rawId =
          p?.id ??
          p?.pedidoId ??
          p?.pedido_id ??
          p?.folioId ??
          (typeof p?.folio === "number" ? p.folio : undefined) ??
          (typeof p?.folio === "string" ? Number(p.folio.replace(/\D/g, "")) : undefined);
        const numericId = Number(rawId);
        const id = Number.isFinite(numericId) && numericId > 0 ? numericId : idx + 1;
        const folioTexto = p?.folio != null ? `${p.folio}`.trim() : "";
        const folioNormalizado =
          folioTexto !== ""
            ? /^\d+$/.test(folioTexto)
              ? `P-${folioTexto}`
              : folioTexto
            : `P-${id}`;
        const clienteId = p?.clienteId ?? p?.cliente_id ?? p?.clienteid ?? null;
        const clienteNombre =
          p?.cliente?.nombre ||
          p?.clienteNombre ||
          p?.cliente_name ||
          p?.nombreCliente ||
          p?.nombre_cliente ||
          (clienteMap.get(Number(clienteId)) as string | undefined) ||
          (typeof p?.cliente === "string" ? p.cliente : undefined) ||
          "Mostrador";
        const bodegaId = p?.bodegaId ?? p?.bodega_id ?? p?.bodegaid ?? null;
        const bodegaNombre =
          p?.bodega?.nombre ||
          p?.bodegaNombre ||
          p?.bodega_name ||
          (bodegaMap.get(Number(bodegaId)) as string | undefined) ||
          (typeof p?.bodega === "string" ? p.bodega : undefined) ||
          "N/D";
        return {
          ...p,
          id,
          folio: folioNormalizado,
          displayFolio: folioNormalizado,
          clienteId,
          clienteNombre,
          clienteDisplay: clienteNombre,
          bodegaId,
          bodegaNombre,
          bodegaDisplay: bodegaNombre,
        };
      });
      setBodegas(bodegas);
      setProductos(productos);
      setTelas(telas);
      setTallas(tallas);
      setColores(colores);
      setRows(normalizados);
    } catch {
      if (!silent) {
        Swal.fire("Error", "No se pudieron cargar pedidos", "error");
      }
    } finally {
      cargandoPedidosRef.current = false;
      if (!silent) setLoadingPedidos(false);
    }
  };

  useEffect(() => {
    void cargar();
    void fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    const refrescarSilencioso = () => {
      if (document.visibilityState !== "visible") return;
      void cargar(true);
    };

    const intervalId = window.setInterval(refrescarSilencioso, PEDIDOS_AUTO_REFRESH_MS);
    window.addEventListener("focus", refrescarSilencioso);
    document.addEventListener("visibilitychange", refrescarSilencioso);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refrescarSilencioso);
      document.removeEventListener("visibilitychange", refrescarSilencioso);
    };
  }, []);

  useEffect(() => {
    const socket = io(api.defaults.baseURL || window.location.origin, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    pedidosSocketRef.current = socket;

    const manejarPedidosActualizados = () => {
      void cargar(true);
    };

    const manejarConexion = () => {
      void cargar(true);
    };

    socket.on("connect", manejarConexion);
    socket.on("produccion:pedidos-actualizados", manejarPedidosActualizados);

    return () => {
      socket.off("connect", manejarConexion);
      socket.off("produccion:pedidos-actualizados", manejarPedidosActualizados);
      socket.disconnect();
      pedidosSocketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (canAccessAllBodegas) {
      return;
    }

    const parsedBodegaId = Number(userBodegaId);
    setFilterBodega(Number.isFinite(parsedBodegaId) && parsedBodegaId > 0 ? parsedBodegaId : "all");
  }, [canAccessAllBodegas, userBodegaId]);

  useEffect(() => {
    if (skipInitialPaginationResetRef.current) {
      skipInitialPaginationResetRef.current = false;
      return;
    }
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, [filterCliente, filterFechaInicio, filterFechaFin, filterBodega, filterTipoPedido]);

  useEffect(() => {
    const nextState = (location.state as PedidosNavigationState | null)?.pedidosState;
    if (!nextState) return;

    setFilterCliente(nextState.filters?.cliente || "");
    setFilterFechaInicio(nextState.filters?.fechaInicio || getTodayDateInputValue());
    setFilterFechaFin(nextState.filters?.fechaFin || getTodayDateInputValue());
    setFilterBodega(nextState.filters?.bodega ?? "all");
    setFilterTipoPedido(nextState.filters?.tipoPedido || "clientes");
    setPaginationModel({
      page: Math.max(0, Number(nextState.pagination?.page || 0)),
      pageSize: Number(nextState.pagination?.pageSize || 10),
    });

    const selectedId = Number(nextState.selectedId);
    setSelectedPedidoId(Number.isFinite(selectedId) && selectedId > 0 ? selectedId : null);
  }, [location.key, location.state]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const cli = obtenerNombreCliente(r).toLowerCase();
      const parsedUserBodegaId = Number(userBodegaId);
      const fechaPedido = toDateOnly(r.fecha);
      const bodegaUsuario =
        !canAccessAllBodegas && Number.isFinite(parsedUserBodegaId) && parsedUserBodegaId > 0
          ? Number(r.bodegaId) === parsedUserBodegaId
          : true;
      const bodegaSeleccionada =
        filterBodega === "all" ? true : Number(r.bodegaId) === Number(filterBodega);
      const cumpleFechaInicio = !filterFechaInicio || (!!fechaPedido && fechaPedido >= filterFechaInicio);
      const cumpleFechaFin = !filterFechaFin || (!!fechaPedido && fechaPedido <= filterFechaFin);
      const esStock = `${r.metodoPago || ""}`.trim().toLowerCase() === "sin_cobro_stock";
      const cumpleTipoPedido =
        filterTipoPedido === "ambos" ? true : filterTipoPedido === "stock" ? esStock : !esStock;

      return (
        cli.includes(filterCliente.toLowerCase()) &&
        bodegaUsuario &&
        bodegaSeleccionada &&
        cumpleFechaInicio &&
        cumpleFechaFin &&
        cumpleTipoPedido
      );
    });
  }, [rows, filterCliente, filterBodega, filterFechaInicio, filterFechaFin, filterTipoPedido, canAccessAllBodegas, userBodegaId]);

  useEffect(() => {
    if (!selectedPedidoId || !filtered.length) return;

    const rowIndex = filtered.findIndex((row) => Number(row.id) === Number(selectedPedidoId));
    if (rowIndex < 0) return;

    const nextPage = Math.floor(rowIndex / Math.max(1, paginationModel.pageSize));
    if (paginationModel.page !== nextPage) {
      setPaginationModel((prev) => ({ ...prev, page: nextPage }));
      return;
    }

    window.requestAnimationFrame(() => {
      pedidosGridApiRef.current.selectRow(selectedPedidoId, true, true);
      pedidosGridApiRef.current.scrollToIndexes({ rowIndex });
    });
  }, [filtered, paginationModel.page, paginationModel.pageSize, pedidosGridApiRef, selectedPedidoId]);

  const bodegasDisponibles = useMemo(() => {
    if (canAccessAllBodegas) return bodegas;
    const parsedUserBodegaId = Number(userBodegaId);
    if (!Number.isFinite(parsedUserBodegaId) || parsedUserBodegaId <= 0) return [];
    return bodegas.filter((b) => b.id === parsedUserBodegaId);
  }, [bodegas, canAccessAllBodegas, userBodegaId]);

  const productosMap = useMemo(
    () => new Map<number, ProductoCatalogo>(productos.map((producto) => [Number(producto.id), producto])),
    [productos]
  );

  const pedidosUnificables = useMemo(() => {
    if (!canUnifyPedidos) return [];
    return filtered.filter((pedido) => {
      const estado = `${pedido.estado || ""}`.trim().toLowerCase();
      const esStock = `${pedido.metodoPago || ""}`.trim().toLowerCase() === "sin_cobro_stock";
      return estado !== "anulado" && !pedido.unificado && !esStock;
    });
  }, [filtered, canUnifyPedidos]);

  const anularPedido = async (pedido: PedidoRow) => {
    const estado = `${pedido.estado || ""}`.trim().toLowerCase();
    if (estado === "anulado") {
      Swal.fire("Aviso", "Este pedido ya esta anulado", "info");
      return;
    }
    if (["completado", "recibido"].includes(estado)) {
      Swal.fire("Aviso", "No se puede anular un pedido recibido", "info");
      return;
    }

    const confirm = await Swal.fire({
      title: "Anular pedido",
      text: `El pedido ${pedido.displayFolio || `P-${pedido.id}`} pasara a estado anulado y ya no se incluira en el unificado. Deseas continuar?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Si, anular",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d32f2f",
    });

    if (!confirm.isConfirmed) return;

    try {
      await api.post(`/produccion/${pedido.id}/anular`);
      await cargar();
      Swal.fire("Listo", "Pedido anulado correctamente", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo anular el pedido", "error");
    }
  };

  const abrirVistaPreviaUnificada = async () => {
    if (!canUnifyPedidos || generandoUnificado) return;
    if (!pedidosUnificables.length) {
      Swal.fire("Aviso", "No hay pedidos nuevos sin unificar.", "info");
      return;
    }

    const confirmacion = await Swal.fire({
      title: "Unificar pedidos nuevos",
      text: `Se unificaran ${pedidosUnificables.length} pedido(s) sin unificar. Los pedidos ya unificados no se incluiran.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Si, unificar",
      cancelButtonText: "Cancelar",
    });

    if (!confirmacion.isConfirmed) return;

    setGenerandoUnificado(true);

    try {
      const agrupados = new Map<string, ArticuloUnificado>();

      pedidosUnificables.forEach((pedido) => {
        (pedido.detalle || []).forEach((detalle) => {
          const producto = detalle.producto || productosMap.get(Number(detalle.productoId));
          const codigo = normalizarTexto(producto?.codigo);
          const nombre = normalizarTexto(producto?.nombre);
          const tipo = normalizarTexto(producto?.tipo);
          const genero = normalizarTexto(producto?.genero);
          const tela = buscarNombreCatalogo(producto, "tela");
          const talla = buscarNombreCatalogo(producto, "talla");
          const color = buscarNombreCatalogo(producto, "color");
          const descripcion = normalizarTexto(detalle.descripcion);
          const key = buildArticuloKey({
            tipo,
            genero,
            tela,
            talla,
            color,
            descripcion,
          });

          const fuente = {
            pedidoId: pedido.id,
            folio: pedido.displayFolio || `P-${pedido.id}`,
            solicitadoPor: normalizarTexto(pedido.solicitadoPor),
            cantidad: Number(detalle.cantidad) || 0,
          };

          const existente = agrupados.get(key);
          if (existente) {
            existente.cantidad += Number(detalle.cantidad) || 0;
            existente.fuentes.push(fuente);
            return;
          }

          agrupados.set(key, {
            key,
            codigo,
            nombre,
            tipo,
            genero,
            tela,
            talla,
            color,
            descripcion,
            cantidad: Number(detalle.cantidad) || 0,
            fuentes: [fuente],
          });
        });
      });

      const articulos = compactArticulosUnificados(Array.from(agrupados.values()));

      const bodegaCorrelativo = filterBodega === "all" ? null : Number(filterBodega);
      const filtroTienda =
        filterBodega === "all"
          ? "Todas las tiendas"
          : bodegas.find((b) => b.id === Number(filterBodega))?.nombre || "Tienda filtrada";
      const resumenCorrelativo = buildResumenUnificacion(articulos, pedidosUnificables, bodegaCorrelativo, filtroTienda);
      const pedidoIds = pedidosUnificables
        .map((pedido) => Number(pedido.id))
        .filter((pedidoId) => Number.isInteger(pedidoId) && pedidoId > 0);

      let correlativo = "";
      const resp = await api.post("/correlativos/produccion/generar", {
        bodegaId: bodegaCorrelativo,
        pedidoIds,
        resumen: resumenCorrelativo,
      });
      correlativo = resp.data?.correlativo || "";

      const fechaGeneracion = new Date();
      const fechaArchivo = formatDateForFilename(fechaGeneracion);
      const pedidoNo = correlativo || `UNI-${fechaGeneracion.getFullYear()}${String(fechaGeneracion.getMonth() + 1).padStart(2, "0")}${String(
        fechaGeneracion.getDate()
      ).padStart(2, "0")}`;
      const fileName = `${sanitizeFilename(pedidoNo)}_${fechaArchivo}.pdf`;
      const articulosUnificados = articulos.filter((articulo) => articulo.fuentes.length > 1);

      const pedidosHtml = articulosUnificados.length
        ? `<div style="text-align:left;max-height:260px;overflow:auto;">
          <p style="margin:0 0 10px 0;">Se detectaron ${articulosUnificados.length} articulo(s) unificados:</p>
          <ul style="margin:0;padding-left:18px;">
            ${articulosUnificados
              .map((articulo) => {
                const usuarios = Array.from(new Set(articulo.fuentes.map((fuente) => fuente.solicitadoPor))).join(", ");
                const pedidos = Array.from(new Set(articulo.fuentes.map((fuente) => fuente.folio))).join(", ");
                const nombreArticulo = [articulo.tipo, articulo.tela, articulo.color, articulo.talla, articulo.genero]
                  .filter((value) => value && value !== "N/D")
                  .join(" / ");
                const descripcion = articulo.descripcion !== "N/D" ? ` | ${articulo.descripcion}` : "";
                return `<li><strong>${nombreArticulo || articulo.nombre}</strong>${descripcion}<br/>Usuarios: ${usuarios}<br/>Pedidos: ${pedidos}</li>`;
              })
              .join("")}
          </ul>
        </div>`
        : `<p style="margin:0;">Los pedidos se unificaron, pero no hubieron articulos unificados. Se descargara el PDF igualmente.</p>`;

      await Swal.fire({
        title: articulosUnificados.length ? "Articulos unificados" : "Sin articulos unificados",
        html: pedidosHtml,
        icon: articulosUnificados.length ? "success" : "info",
        confirmButtonText: "Descargar PDF",
        width: 640,
      });

      await descargarProduccionUnificadoPdf({
        articulos,
        fileName,
        pedidoNo,
        filtroTienda,
        totalPedidos: pedidosUnificables.length,
        fechasPedidos: pedidosUnificables.map((pedido) => pedido.fecha),
      });
      await cargar();
    } catch (error: any) {
      Swal.fire(
        "Error",
        error?.response?.data?.message || "No se pudo generar el correlativo del reporte unificado",
        "error"
      );
    } finally {
      setGenerandoUnificado(false);
    }
  };

  const generarDetallePedidosPdf = async () => {
    if (generandoDetallePedidos) return;
    if (!filtered.length) {
      Swal.fire("Sin datos", "No hay pedidos visibles para generar el detalle.", "info");
      return;
    }

    const articulos: ProduccionDetallePedidoPdf[] = [...filtered]
      .sort((a, b) => {
        const porUsuario = compareText(obtenerUsuarioPedido(a), obtenerUsuarioPedido(b));
        if (porUsuario !== 0) return porUsuario;
        const porFecha = toDateOnly(a.fecha).localeCompare(toDateOnly(b.fecha));
        if (porFecha !== 0) return porFecha;
        return Number(a.id || 0) - Number(b.id || 0);
      })
      .flatMap((pedido) =>
        (pedido.detalle || []).map((detalle) => {
          const producto = detalle.producto || productosMap.get(Number(detalle.productoId));
          return {
            orden: pedido.displayFolio || pedido.folio || `P-${pedido.id}`,
            usuario: normalizarTexto(obtenerUsuarioPedido(pedido)),
            codigo: normalizarTexto(producto?.codigo),
            nombre: normalizarTexto(producto?.nombre),
            tipo: normalizarTexto(producto?.tipo),
            genero: normalizarTexto(producto?.genero),
            tela: buscarNombreCatalogo(producto, "tela"),
            talla: buscarNombreCatalogo(producto, "talla"),
            color: buscarNombreCatalogo(producto, "color"),
            descripcion: normalizarTexto(detalle.descripcion),
            cantidad: Number(detalle.cantidad) || 0,
          };
        }),
      )
      .filter((articulo) => Number(articulo.cantidad || 0) > 0);

    if (!articulos.length) {
      Swal.fire("Sin detalle", "Los pedidos visibles no tienen lineas de detalle para imprimir.", "info");
      return;
    }

    const filtroTienda =
      filterBodega === "all"
        ? "Todas las tiendas"
        : bodegas.find((b) => b.id === Number(filterBodega))?.nombre || "Tienda filtrada";
    const rango =
      filterFechaInicio && filterFechaFin
        ? `${filterFechaInicio} a ${filterFechaFin}`
        : filterFechaInicio || filterFechaFin || "rango actual";

    const confirmacion = await Swal.fire({
      title: "Generar detalle de pedidos",
      text: `Se generara un PDF con ${filtered.length} pedido(s) y ${articulos.length} linea(s) del ${rango}.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Si, generar PDF",
      cancelButtonText: "Cancelar",
    });
    if (!confirmacion.isConfirmed) return;

    try {
      setGenerandoDetallePedidos(true);
      const fechaArchivo = formatDateForFilename(new Date());
      const desde = filterFechaInicio || "inicio";
      const hasta = filterFechaFin || "fin";
      await descargarProduccionDetallePedidosPdf({
        articulos,
        fileName: `Detalle_pedidos_${sanitizeFilename(desde)}_${sanitizeFilename(hasta)}_${fechaArchivo}.pdf`,
        filtroTienda,
        totalPedidos: filtered.length,
        fechasPedidos: filtered.map((pedido) => pedido.fecha),
      });
    } catch (error: any) {
      Swal.fire("Error", error?.message || "No se pudo generar el detalle de pedidos", "error");
    } finally {
      setGenerandoDetallePedidos(false);
    }
  };

  const columns: GridColDef[] = [
    {
      field: "folio",
      headerName: "Folio",
      width: 120,
      valueGetter: (p) => {
        const row = (p as any)?.row || {};
        if (row.displayFolio) return row.displayFolio;
        if (row.folio && `${row.folio}`.trim() !== "") return `${row.folio}`;
        const idVal = row.id ?? row.pedidoId ?? row.pedido_id ?? (p as any)?.id;
        return idVal ? `P-${idVal}` : "";
      },
      renderCell: (p) => {
        const row = (p as any)?.row || {};
        const idVal = row.id ?? row.pedidoId ?? row.pedido_id ?? (p as any)?.id;
        const folioVal =
          row.displayFolio ||
          (row.folio && `${row.folio}`.trim() !== "" ? `${row.folio}` : undefined) ||
          (idVal ? `P-${idVal}` : "");
        return <span>{folioVal}</span>;
      },
    },
    {
      field: "fecha",
      headerName: "Fecha",
      width: 150,
      valueFormatter: (v: string) => (v ? new Date(v).toLocaleDateString() : ""),
    },
    {
      field: "cliente",
      headerName: "Cliente",
      flex: 1,
      renderCell: (p) => <span>{obtenerNombreCliente((p as any)?.row)}</span>,
    },
    {
      field: "tipoPedido",
      headerName: "Tipo",
      width: 110,
      renderCell: (p) => {
        const esStock = `${p.row.metodoPago || ""}`.trim().toLowerCase() === "sin_cobro_stock";
        return <Chip size="small" label={esStock ? "Stock" : "Cliente"} color={esStock ? "warning" : "primary"} variant="outlined" />;
      },
    },
    {
      field: "bodega",
      headerName: "Bodega",
      flex: 1,
      renderCell: (p) => <span>{obtenerNombreBodega((p as any)?.row)}</span>,
    },
    {
      field: "solicitadoPor",
      headerName: "Registrado por",
      width: 200,
      renderCell: (p) => <span>{obtenerUsuarioPedido(p.row)}</span>,
    },
    {
      field: "estado",
      headerName: "Estado",
      width: 140,
      renderCell: (p) => {
        const estado = `${p.value || ""}`.trim().toLowerCase();
        const color =
          estado === "anulado"
            ? "error"
            : estado === "regresado_produccion"
              ? "warning"
              : ["completado", "recibido", "pendiente_pago"].includes(estado)
                ? "success"
                : "info";
        return <Chip label={p.value} size="small" color={color} />;
      },
    },
    {
      field: "unificado",
      headerName: "Unificacion",
      width: 140,
      renderCell: (p) => {
        const unificado = Boolean(p.row.unificado);
        const correlativo =
          p.row.unificadoCorrelativo ||
          p.row.unificaciones?.find((item: any) => item?.produccionUnificado?.correlativo)?.produccionUnificado?.correlativo ||
          null;
        return (
          <Chip
            label={unificado ? correlativo || "Unificado" : "Sin unificar"}
            size="small"
            color={unificado ? "success" : "default"}
            variant={unificado ? "filled" : "outlined"}
          />
        );
      },
    },
    {
      field: "totalEstimado",
      headerName: "Total",
      width: 120,
      valueFormatter: (v: number) => formatCurrency(v),
    },
    {
      field: "anticipo",
      headerName: "Anticipo",
      width: 120,
      valueFormatter: (v: number) => formatCurrency(v),
    },
    {
      field: "saldoPendiente",
      headerName: "Saldo",
      width: 120,
      valueFormatter: (v: number) => formatCurrency(v),
    },
    {
      field: "acciones",
      headerName: "Acciones",
      width: 220,
      sortable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" onClick={() => abrirPedidoDetalle(p.row)}>
            Ver
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<BlockOutlined />}
            disabled={["anulado", "completado", "recibido"].includes(`${p.row.estado || ""}`.trim().toLowerCase())}
            onClick={() => anularPedido(p.row)}
          >
            Anular
          </Button>
        </Stack>
      ),
    },
  ];

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <PlaylistAddCheckOutlined color="primary" />
          <Typography variant="h4">Pedidos de produccion</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<PictureAsPdfOutlined />}
            variant="outlined"
            onClick={generarDetallePedidosPdf}
            disabled={generandoDetallePedidos || filtered.length === 0}
          >
            {generandoDetallePedidos ? "Generando..." : "Detalle PDF"}
          </Button>
          {canUnifyPedidos && (
            <Button
              startIcon={<MergeTypeOutlined />}
              variant="outlined"
              onClick={abrirVistaPreviaUnificada}
              disabled={generandoUnificado || pedidosUnificables.length === 0}
            >
              {generandoUnificado ? "Unificando..." : `Unificar nuevos (${pedidosUnificables.length})`}
            </Button>
          )}
          <Button startIcon={<AddIcon />} variant="contained" onClick={abrirNuevoPedido}>
            Nuevo pedido
          </Button>
        </Stack>
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} spacing={2}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filterTipoPedido}
          onChange={(_, value) => {
            if (value) setFilterTipoPedido(value);
          }}
        >
          <ToggleButton value="clientes">Clientes</ToggleButton>
          <ToggleButton value="stock">Stock</ToggleButton>
          <ToggleButton value="ambos">Ambos</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="body2" color="text.secondary">
          Los pedidos para stock no se incluyen en el unificado. Usa Detalle PDF para imprimirlos individualmente.
        </Typography>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label="Buscar por cliente"
            size="small"
            fullWidth
            value={filterCliente}
            onChange={(e) => setFilterCliente(e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth size="small" disabled={!canAccessAllBodegas}>
            <InputLabel>Tienda</InputLabel>
            <Select
              label="Tienda"
              value={filterBodega === "all" ? "all" : String(filterBodega)}
              onChange={(e) => setFilterBodega(e.target.value === "all" ? "all" : Number(e.target.value))}
            >
              {canAccessAllBodegas && <MenuItem value="all">Todas</MenuItem>}
              {bodegasDisponibles.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label="Fecha inicio"
            type="date"
            size="small"
            fullWidth
            value={filterFechaInicio}
            onChange={(e) => setFilterFechaInicio(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label="Fecha fin"
            type="date"
            size="small"
            fullWidth
            value={filterFechaFin}
            onChange={(e) => setFilterFechaFin(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
      </Grid>

      <div style={{ height: 620, width: "100%" }} onContextMenu={handleGridContextMenu}>
        <DataGrid
          apiRef={pedidosGridApiRef}
          loading={loadingPedidos}
          rows={filtered}
          columns={columns}
          getRowId={(row) => row.id}
          pageSizeOptions={[10, 25, 50]}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          keepNonExistentRowsSelected
          rowSelectionModel={selectedPedidoId ? [selectedPedidoId] : []}
          onRowSelectionModelChange={(model) => {
            const selected = Array.isArray(model) ? model[0] : Array.from((model as any)?.ids || [])[0];
            if (!selected && selectedPedidoId && (loadingPedidos || !filtered.length)) {
              return;
            }
            const selectedId = Number(selected);
            setSelectedPedidoId(Number.isFinite(selectedId) && selectedId > 0 ? selectedId : null);
          }}
        />
      </div>

      <Menu
        open={Boolean(contextMenuAnchor)}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenuAnchor ? { top: contextMenuAnchor.mouseY, left: contextMenuAnchor.mouseX } : undefined
        }
      >
        <MenuItem onClick={() => handleContextMenuAction("relations")}> 
          <ListItemIcon>
            <VisibilityOutlined fontSize="small" />
          </ListItemIcon>
          Ver relaciones
        </MenuItem>
        <MenuItem onClick={() => handleContextMenuAction("open")}> 
          <ListItemIcon>
            <OpenInNewOutlined fontSize="small" />
          </ListItemIcon>
          Abrir pedido
        </MenuItem>
        <MenuItem onClick={() => handleContextMenuAction("payments")}> 
          <ListItemIcon>
            <PaymentsOutlined fontSize="small" />
          </ListItemIcon>
          Ver pagos del pedido
        </MenuItem>
      </Menu>

      <TransactionRelationMap
        open={relationModalOpen}
        title={relationModalTitle}
        nodes={relationModalData?.nodes || []}
        edges={relationModalData?.edges || []}
        onClose={closeRelationModal}
        onCardClick={handleRelationNodeClick}
      />
    </Paper>
  );
}
