import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
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
  Switch,
  FormControlLabel,
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
import RestartAltOutlined from "@mui/icons-material/RestartAltOutlined";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
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
  usuarioId?: number | null;
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
      folio?: string;
      unificacion?: string;
      fechaInicio?: string;
      fechaFin?: string;
      bodega?: number | "all";
      tipoPedido?: "clientes" | "stock" | "ambos";
      incluirStockUnificado?: boolean;
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
  orden?: string;
  usuario?: string;
  codigo: string;
  nombre: string;
  tipo: string;
  genero: string;
  tela: string;
  talla: string;
  color: string;
  descripcion: string;
  cantidad: number;
  fuentes: {
    pedidoId: number;
    folio: string;
    solicitadoPor: string;
    cantidad: number;
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
    usuario: articulo.usuario,
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
  const [filterFolioInput, setFilterFolioInput] = useState(() => restoredPedidosState?.filters?.folio || "");
  const [filterUnificacionInput, setFilterUnificacionInput] = useState(() => restoredPedidosState?.filters?.unificacion || "");
  const [filterFolio, setFilterFolio] = useState(() => restoredPedidosState?.filters?.folio || "");
  const [filterUnificacion, setFilterUnificacion] = useState(() => restoredPedidosState?.filters?.unificacion || "");
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
    () => restoredPedidosState?.filters?.tipoPedido || "ambos"
  );
  const [incluirStockUnificado, setIncluirStockUnificado] = useState(
    () => restoredPedidosState?.filters?.incluirStockUnificado ?? true
  );
  const busquedaDocumentoActiva = Boolean(filterFolio.trim() || filterUnificacion.trim());
  const [paginationModel, setPaginationModel] = useState(() => ({
    page: Math.max(0, Number(restoredPedidosState?.pagination?.page || 0)),
    pageSize: Number(restoredPedidosState?.pagination?.pageSize || 10),
  }));
  const [rowCount, setRowCount] = useState(0);
  const [selectedPedidoId, setSelectedPedidoId] = useState<number | null>(() => {
    const value = Number(restoredPedidosState?.selectedId);
    return Number.isFinite(value) && value > 0 ? value : null;
  });
  const [generandoUnificado, setGenerandoUnificado] = useState(false);
  const [generandoDetallePedidos, setGenerandoDetallePedidos] = useState(false);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const pedidosRequestSeqRef = useRef(0);
  const loadingPedidosSeqRef = useRef(0);
  const pedidosLoadAbortRef = useRef<AbortController | null>(null);
  const cargarPedidosRef = useRef<((silent?: boolean) => Promise<void>) | null>(null);
  const skipInitialPaginationResetRef = useRef(Boolean(restoredPedidosState));
  const pendingRestoreSelectionRef = useRef(Boolean(restoredPedidosState?.selectedId));
  const { rol, permisos, bodegaId: userBodegaId, id: userId } = useAuthStore();
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

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFilterFolio(filterFolioInput.trim());
      setFilterUnificacion(filterUnificacionInput.trim());
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [filterFolioInput, filterUnificacionInput]);

  const buildPedidosReturnState = (pedidoId?: number | null): PedidosNavigationState => ({
    returnTo: "/produccion",
    returnLabel: "Regresar a pedidos",
    pedidosState: {
      filters: {
        cliente: filterCliente,
        folio: filterFolio,
        unificacion: filterUnificacion,
        fechaInicio: filterFechaInicio,
        fechaFin: filterFechaFin,
        bodega: filterBodega,
        tipoPedido: filterTipoPedido,
        incluirStockUnificado,
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

  const pedidoEstaUnificado = (pedido: PedidoRow) =>
    Boolean(
      pedido.unificado ||
        pedido.unificadoCorrelativo ||
        pedido.unificaciones?.some((item) => item?.produccionUnificadoId || item?.produccionUnificado?.id || item?.produccionUnificado?.correlativo),
    );

  const puedeModificarPedido = (pedido: PedidoRow) =>
    !pedidoEstaUnificado(pedido) &&
    !["anulado", "recibido", "completado"].includes(`${pedido.estado || ""}`.trim().toLowerCase()) &&
    (rol === "ADMIN" || Number(pedido.usuarioId || 0) === Number(userId || 0));

  const abrirModificarPedido = (pedido: PedidoRow) => {
    const pedidoId = Number(pedido.id);
    setSelectedPedidoId(pedidoId);
    navigate(`/produccion/${pedidoId}/editar`, { state: buildPedidosReturnState(pedidoId) });
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

  const normalizarPedidos = useCallback((pedidoRows: any[], clientes: any[] = [], bodegasSource: any[] = []) => {
    const clienteMap = new Map<number, string>(clientes.map((c: any) => [Number(c.id), c.nombre]));
    const bodegaMap = new Map<number, string>(bodegasSource.map((b: any) => [Number(b.id), b.nombre]));

    return pedidoRows.map((p: any, idx: number) => {
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
  }, []);

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

  const cargar = useCallback(async (silent = false) => {
    pedidosLoadAbortRef.current?.abort();
    const requestController = new AbortController();
    pedidosLoadAbortRef.current = requestController;
    const requestSeq = pedidosRequestSeqRef.current + 1;
    pedidosRequestSeqRef.current = requestSeq;
    if (!silent) {
      loadingPedidosSeqRef.current = requestSeq;
      setLoadingPedidos(true);
    }

    try {
      const [resp, respClientes, respBodegas, respProductos, respTelas, respTallas, respColores] = await Promise.all([
        api.get("/produccion", {
          signal: requestController.signal,
          params: {
            paginated: 1,
            page: paginationModel.page,
            pageSize: paginationModel.pageSize,
            cliente: filterCliente || undefined,
            folio: filterFolio || undefined,
            unificacion: filterUnificacion || undefined,
            fechaInicio: busquedaDocumentoActiva ? undefined : filterFechaInicio || undefined,
            fechaFin: busquedaDocumentoActiva ? undefined : filterFechaFin || undefined,
            bodegaId: filterBodega === "all" ? undefined : filterBodega,
            tipoPedido: filterTipoPedido,
          },
        }),
        api.get("/clientes", { signal: requestController.signal }).catch(() => ({ data: [] })),
        api.get("/bodegas", { signal: requestController.signal }).catch(() => ({ data: [] })),
        api.get("/productos", { signal: requestController.signal }).catch(() => ({ data: [] })),
        api.get("/telas", { signal: requestController.signal }).catch(() => ({ data: [] })),
        api.get("/tallas", { signal: requestController.signal }).catch(() => ({ data: [] })),
        api.get("/colores", { signal: requestController.signal }).catch(() => ({ data: [] })),
      ]);
      const clientes = respClientes.data || [];
      const bodegas = respBodegas.data || [];
      const productos = respProductos.data || [];
      const telas = respTelas.data || [];
      const tallas = respTallas.data || [];
      const colores = respColores.data || [];

      const payload = resp.data || {};
      const pedidoRows = Array.isArray(payload) ? payload : payload.data || [];
      const normalizados = normalizarPedidos(pedidoRows, clientes, bodegas);
      if (requestSeq !== pedidosRequestSeqRef.current) return;

      setBodegas(bodegas);
      setProductos(productos);
      setTelas(telas);
      setTallas(tallas);
      setColores(colores);
      setRows(normalizados);
      setRowCount(Number(payload.total ?? normalizados.length));
    } catch (error: any) {
      if (error?.code !== "ERR_CANCELED" && !requestController.signal.aborted && requestSeq === pedidosRequestSeqRef.current && !silent) {
        Swal.fire("Error", "No se pudieron cargar pedidos", "error");
      }
    } finally {
      if (pedidosLoadAbortRef.current === requestController) pedidosLoadAbortRef.current = null;
      if (!silent && requestSeq === loadingPedidosSeqRef.current) setLoadingPedidos(false);
    }
  }, [paginationModel.page, paginationModel.pageSize, filterCliente, filterFolio, filterUnificacion, busquedaDocumentoActiva, filterFechaInicio, filterFechaFin, filterBodega, filterTipoPedido, normalizarPedidos]);

  useEffect(() => {
    cargarPedidosRef.current = cargar;
  }, [cargar]);

  useEffect(() => () => pedidosLoadAbortRef.current?.abort(), []);

  useEffect(() => {
    void cargar();
    void fetchConfig();
  }, [cargar, fetchConfig]);

  useEffect(() => {
    const refrescarSilencioso = () => {
      if (document.visibilityState !== "visible") return;
      void cargarPedidosRef.current?.(true);
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
  }, [filterCliente, filterFolio, filterUnificacion, filterFechaInicio, filterFechaFin, filterBodega, filterTipoPedido, incluirStockUnificado]);

  useEffect(() => {
    const nextState = restoredPedidosState;
    if (!nextState) return;

    setFilterCliente(nextState.filters?.cliente || "");
    setFilterFolioInput(nextState.filters?.folio || "");
    setFilterUnificacionInput(nextState.filters?.unificacion || "");
    setFilterFolio(nextState.filters?.folio || "");
    setFilterUnificacion(nextState.filters?.unificacion || "");
    setFilterFechaInicio(nextState.filters?.fechaInicio || getTodayDateInputValue());
    setFilterFechaFin(nextState.filters?.fechaFin || getTodayDateInputValue());
    setFilterBodega(nextState.filters?.bodega ?? "all");
    setFilterTipoPedido(nextState.filters?.tipoPedido || "ambos");
    setIncluirStockUnificado(nextState.filters?.incluirStockUnificado ?? true);
    setPaginationModel({
      page: Math.max(0, Number(nextState.pagination?.page || 0)),
      pageSize: Number(nextState.pagination?.pageSize || 10),
    });

    const selectedId = Number(nextState.selectedId);
    setSelectedPedidoId(Number.isFinite(selectedId) && selectedId > 0 ? selectedId : null);
  }, [restoredPedidosState]);

  const aplicarFiltrosLocales = useCallback((items: PedidoRow[]) => {
    const folioSearch = filterFolio.trim().toLowerCase();
    const unificacionSearch = filterUnificacion.trim().toLowerCase();
    return items.filter((r) => {
      const cli = obtenerNombreCliente(r).toLowerCase();
      const folio = `${r.displayFolio || r.folio || ""}`.trim().toLowerCase();
      const unificacion =
        `${r.unificadoCorrelativo || r.unificaciones?.find((item) => item?.produccionUnificado?.correlativo)?.produccionUnificado?.correlativo || ""}`
          .trim()
          .toLowerCase();
      const parsedUserBodegaId = Number(userBodegaId);
      const fechaPedido = toDateOnly(r.fecha);
      const bodegaUsuario =
        !canAccessAllBodegas && Number.isFinite(parsedUserBodegaId) && parsedUserBodegaId > 0
          ? Number(r.bodegaId) === parsedUserBodegaId
          : true;
      const bodegaSeleccionada =
        filterBodega === "all" ? true : Number(r.bodegaId) === Number(filterBodega);
      const cumpleFechaInicio = busquedaDocumentoActiva || !filterFechaInicio || (!!fechaPedido && fechaPedido >= filterFechaInicio);
      const cumpleFechaFin = busquedaDocumentoActiva || !filterFechaFin || (!!fechaPedido && fechaPedido <= filterFechaFin);
      const esStock = `${r.metodoPago || ""}`.trim().toLowerCase() === "sin_cobro_stock";
      const cumpleTipoPedido =
        filterTipoPedido === "ambos" ? true : filterTipoPedido === "stock" ? esStock : !esStock;
      const cumpleFolio = !folioSearch || folio.includes(folioSearch);
      const cumpleUnificacion = !unificacionSearch || unificacion.includes(unificacionSearch);

      return (
        cli.includes(filterCliente.toLowerCase()) &&
        cumpleFolio &&
        cumpleUnificacion &&
        bodegaUsuario &&
        bodegaSeleccionada &&
        cumpleFechaInicio &&
        cumpleFechaFin &&
        cumpleTipoPedido
      );
    });
  }, [filterCliente, filterFolio, filterUnificacion, filterBodega, filterFechaInicio, filterFechaFin, filterTipoPedido, busquedaDocumentoActiva, canAccessAllBodegas, userBodegaId]);

  const filtered = useMemo(() => aplicarFiltrosLocales(rows), [rows, aplicarFiltrosLocales]);
  const paginaResumen = useMemo(() => {
    const total = filtered.reduce((sum, pedido) => sum + (Number(pedido.totalEstimado) || 0), 0);
    const saldo = filtered.reduce((sum, pedido) => sum + Math.max(0, Number(pedido.saldoPendiente) || 0), 0);
    const abiertos = filtered.filter((pedido) => !["anulado", "completado", "recibido"].includes(`${pedido.estado || ""}`.trim().toLowerCase())).length;
    return { total, saldo, abiertos };
  }, [filtered]);

  const limpiarFiltros = () => {
    const hoy = getTodayDateInputValue();
    setFilterCliente("");
    setFilterFolioInput("");
    setFilterFolio("");
    setFilterUnificacionInput("");
    setFilterUnificacion("");
    setFilterFechaInicio(hoy);
    setFilterFechaFin(hoy);
    setFilterTipoPedido("ambos");
    setFilterBodega(canAccessAllBodegas ? "all" : Number(userBodegaId || 0) || "all");
  };

  useEffect(() => {
    if (!busquedaDocumentoActiva || !filtered.length) return;

    const folioSearch = filterFolio.trim().toLowerCase();
    const unificacionSearch = filterUnificacion.trim().toLowerCase();
    const exactMatch =
      filtered.find((pedido) => {
        const folio = `${pedido.displayFolio || pedido.folio || ""}`.trim().toLowerCase();
        const unificacion =
          `${pedido.unificadoCorrelativo || pedido.unificaciones?.find((item) => item?.produccionUnificado?.correlativo)?.produccionUnificado?.correlativo || ""}`
            .trim()
            .toLowerCase();
        return (folioSearch && folio === folioSearch) || (unificacionSearch && unificacion === unificacionSearch);
      }) || filtered[0];

    const fechaPedido = toDateOnly(exactMatch.fecha);
    if (!fechaPedido) return;
    if (filterFechaInicio !== fechaPedido) setFilterFechaInicio(fechaPedido);
    if (filterFechaFin !== fechaPedido) setFilterFechaFin(fechaPedido);
  }, [busquedaDocumentoActiva, filtered, filterFolio, filterUnificacion, filterFechaInicio, filterFechaFin]);

  const cargarPedidosCompletosParaReporte = useCallback(async () => {
    const resp = await api.get("/produccion", {
      params: {
        cliente: filterCliente || undefined,
        folio: filterFolio || undefined,
        unificacion: filterUnificacion || undefined,
        fechaInicio: busquedaDocumentoActiva ? undefined : filterFechaInicio || undefined,
        fechaFin: busquedaDocumentoActiva ? undefined : filterFechaFin || undefined,
        bodegaId: filterBodega === "all" ? undefined : filterBodega,
        tipoPedido: filterTipoPedido,
        _ts: Date.now(),
      },
    });
    const payload = resp.data || {};
    const pedidoRows = Array.isArray(payload) ? payload : payload.data || [];
    return aplicarFiltrosLocales(normalizarPedidos(pedidoRows, [], bodegas));
  }, [
    aplicarFiltrosLocales,
    bodegas,
    filterBodega,
    filterCliente,
    filterFolio,
    filterUnificacion,
    busquedaDocumentoActiva,
    filterFechaFin,
    filterFechaInicio,
    filterTipoPedido,
    normalizarPedidos,
  ]);

  useEffect(() => {
    if (!pendingRestoreSelectionRef.current || !selectedPedidoId || !filtered.length) return;

    const rowIndex = filtered.findIndex((row) => Number(row.id) === Number(selectedPedidoId));
    if (rowIndex < 0) {
      pendingRestoreSelectionRef.current = false;
      return;
    }

    window.requestAnimationFrame(() => {
      pedidosGridApiRef.current.selectRow(selectedPedidoId, true, true);
      pedidosGridApiRef.current.scrollToIndexes({ rowIndex });
      pendingRestoreSelectionRef.current = false;
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

    setGenerandoUnificado(true);

    try {
      const pedidosCompletos = await cargarPedidosCompletosParaReporte();
      const pedidosUnificablesCompletos = pedidosCompletos.filter((pedido) => {
        const estado = `${pedido.estado || ""}`.trim().toLowerCase();
        const esStock = `${pedido.metodoPago || ""}`.trim().toLowerCase() === "sin_cobro_stock";
        return estado !== "anulado" && !pedido.unificado && (incluirStockUnificado || !esStock);
      });

      if (!pedidosUnificablesCompletos.length) {
        Swal.fire("Aviso", "No hay pedidos nuevos sin unificar.", "info");
        return;
      }

      const confirmacion = await Swal.fire({
        title: "Unificar pedidos nuevos",
        text: `Se unificaran ${pedidosUnificablesCompletos.length} pedido(s) sin unificar de todo el rango filtrado. Los pedidos ya unificados no se incluiran.`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Si, unificar",
        cancelButtonText: "Cancelar",
      });

      if (!confirmacion.isConfirmed) return;

      const articulos: ArticuloUnificado[] = [...pedidosUnificablesCompletos]
        .flatMap((pedido) =>
          (pedido.detalle || []).map((detalle, index) => {
            const producto = detalle.producto || productosMap.get(Number(detalle.productoId));
            const folio = pedido.displayFolio || pedido.folio || `P-${pedido.id}`;
            const usuarioPedido = normalizarTexto(obtenerUsuarioPedido(pedido));
            const cantidad = Number(detalle.cantidad) || 0;
            return {
              key: `${pedido.id}-${index}-${detalle.productoId}`,
              orden: folio,
              usuario: usuarioPedido,
              codigo: normalizarTexto(producto?.codigo),
              nombre: normalizarTexto(producto?.nombre),
              tipo: normalizarTexto(producto?.tipo),
              genero: normalizarTexto(producto?.genero),
              tela: buscarNombreCatalogo(producto, "tela"),
              talla: buscarNombreCatalogo(producto, "talla"),
              color: buscarNombreCatalogo(producto, "color"),
              descripcion: normalizarTexto(detalle.descripcion),
              cantidad,
              fuentes: [
                {
                  pedidoId: pedido.id,
                  folio,
                  solicitadoPor: usuarioPedido,
                  cantidad,
                },
              ],
            };
          }),
        )
        .filter((articulo) => Number(articulo.cantidad || 0) > 0)
        .sort((a, b) => {
          const porPrenda = compareText(a.tipo, b.tipo);
          if (porPrenda !== 0) return porPrenda;
          const porTela = compareText(a.tela, b.tela);
          if (porTela !== 0) return porTela;
          const porColor = compareText(a.color, b.color);
          if (porColor !== 0) return porColor;
          const porTalla = compareText(a.talla, b.talla);
          if (porTalla !== 0) return porTalla;
          const porGenero = compareText(a.genero, b.genero);
          if (porGenero !== 0) return porGenero;
          return compareText(a.usuario, b.usuario);
        });

      if (!articulos.length) {
        Swal.fire("Sin detalle", "Los pedidos nuevos sin unificar no tienen lineas de detalle para imprimir.", "info");
        return;
      }

      const bodegaCorrelativo = filterBodega === "all" ? null : Number(filterBodega);
      const filtroTienda =
        filterBodega === "all"
          ? "Todas las tiendas"
          : bodegas.find((b) => b.id === Number(filterBodega))?.nombre || "Tienda filtrada";
      const resumenCorrelativo = buildResumenUnificacion(articulos, pedidosUnificablesCompletos, bodegaCorrelativo, filtroTienda);
      const pedidoIds = pedidosUnificablesCompletos
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

      await Swal.fire({
        title: "Pedidos unificados",
        text: `Se generara el PDF ${pedidoNo} con ${pedidosUnificablesCompletos.length} pedido(s) y ${articulos.length} linea(s), sin consolidar articulos repetidos.`,
        icon: "success",
        confirmButtonText: "Descargar PDF",
        width: 640,
      });

      await Promise.all([
        descargarProduccionUnificadoPdf({
          articulos,
          fileName,
          pedidoNo,
          filtroTienda,
          totalPedidos: pedidosUnificablesCompletos.length,
          fechasPedidos: pedidosUnificablesCompletos.map((pedido) => pedido.fecha),
        }),
        cargar(),
      ]);
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
    try {
      setGenerandoDetallePedidos(true);
      const pedidosCompletos = await cargarPedidosCompletosParaReporte();
      const pedidosParaDetallePdfCompletos = pedidosCompletos.filter(
        (pedido) => `${pedido.estado || ""}`.trim().toLowerCase() !== "anulado",
      );

      if (!pedidosParaDetallePdfCompletos.length) {
        Swal.fire("Sin datos", "No hay pedidos activos en el rango filtrado para generar el detalle.", "info");
        return;
      }

      const articulos: ProduccionDetallePedidoPdf[] = [...pedidosParaDetallePdfCompletos]
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
            const unificado =
              pedido.unificadoCorrelativo ||
              pedido.unificaciones?.find((item) => item?.produccionUnificado?.correlativo)?.produccionUnificado?.correlativo ||
              "";
            return {
              orden: pedido.displayFolio || pedido.folio || `P-${pedido.id}`,
              unificado,
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
        Swal.fire("Sin detalle", "Los pedidos activos del rango filtrado no tienen lineas de detalle para imprimir.", "info");
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
        text: `Se generara un PDF con ${pedidosParaDetallePdfCompletos.length} pedido(s) activo(s) y ${articulos.length} linea(s) del ${rango}. Los pedidos anulados no se incluiran.`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Si, generar PDF",
        cancelButtonText: "Cancelar",
      });
      if (!confirmacion.isConfirmed) return;

      const fechaArchivo = formatDateForFilename(new Date());
      const desde = filterFechaInicio || "inicio";
      const hasta = filterFechaFin || "fin";
      await descargarProduccionDetallePedidosPdf({
        articulos,
        fileName: `Detalle_pedidos_${sanitizeFilename(desde)}_${sanitizeFilename(hasta)}_${fechaArchivo}.pdf`,
        filtroTienda,
        totalPedidos: pedidosParaDetallePdfCompletos.length,
        fechasPedidos: pedidosParaDetallePdfCompletos.map((pedido) => pedido.fecha),
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
      width: 310,
      sortable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" onClick={() => abrirPedidoDetalle(p.row)}>
            Ver
          </Button>
          {puedeModificarPedido(p.row) && (
            <Button size="small" variant="outlined" onClick={() => abrirModificarPedido(p.row)}>
              Modificar
            </Button>
          )}
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
    <Stack spacing={2.25}>
      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 } }}>
      <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", lg: "center" }} gap={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <PlaylistAddCheckOutlined color="primary" />
          <Stack spacing={0.25}>
            <Typography variant="h4">Pedidos de produccion</Typography>
            <Typography variant="body2" color="text.secondary">Consulta avances, saldos, unificaciones y documentos de produccion.</Typography>
          </Stack>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<PictureAsPdfOutlined />}
            variant="outlined"
            onClick={generarDetallePedidosPdf}
            disabled={generandoDetallePedidos || loadingPedidos || rowCount === 0}
          >
            {generandoDetallePedidos ? "Generando..." : "Detalle PDF"}
          </Button>
          {canUnifyPedidos && (
            <Button
              startIcon={<MergeTypeOutlined />}
              variant="outlined"
              onClick={abrirVistaPreviaUnificada}
              disabled={generandoUnificado || loadingPedidos || rowCount === 0}
            >
              {generandoUnificado ? "Unificando..." : "Unificar nuevos"}
            </Button>
          )}
          <Button startIcon={<AddIcon />} variant="contained" onClick={abrirNuevoPedido}>
            Nuevo pedido
          </Button>
        </Stack>
      </Stack>
      </Paper>

      <Grid container spacing={1.5}>
        {[
          { label: "Pedidos encontrados", value: rowCount.toLocaleString("es-GT"), helper: "En el periodo filtrado" },
          { label: "Monto de esta pagina", value: formatCurrency(paginaResumen.total), helper: `${filtered.length} pedido${filtered.length === 1 ? "" : "s"} visible${filtered.length === 1 ? "" : "s"}` },
          { label: "Saldo de esta pagina", value: formatCurrency(paginaResumen.saldo), helper: "Pendiente por recibir" },
          { label: "Pedidos abiertos", value: paginaResumen.abiertos.toLocaleString("es-GT"), helper: "Activos en esta pagina" },
        ].map((item) => (
          <Grid key={item.label} size={{ xs: 12, sm: 6, lg: 3 }}>
            <Paper variant="outlined" sx={{ p: 1.75, height: "100%" }}>
              <Typography variant="caption" color="text.secondary">{item.label}</Typography>
              <Typography variant="h6" sx={{ mt: 0.25 }}>{item.value}</Typography>
              <Typography variant="caption" color="text.secondary">{item.helper}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 } }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} sx={{ mb: 2 }} spacing={2}>
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
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "flex-start", sm: "center" }}>
          {canUnifyPedidos && (
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={incluirStockUnificado}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setIncluirStockUnificado(checked);
                    if (checked && filterTipoPedido === "clientes") {
                      setFilterTipoPedido("ambos");
                    }
                  }}
                />
              }
              label="Incluir stock en unificado"
            />
          )}
          <Typography variant="body2" color="text.secondary">
            {incluirStockUnificado
              ? "Los pedidos para stock seleccionados por filtros tambien se incluiran en Unificar nuevos."
              : "Los pedidos para stock no se incluyen en el unificado. Activa el switch para incluirlos."}
          </Typography>
        </Stack>
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="h6">Filtros de consulta</Typography>
        <Button size="small" variant="text" startIcon={<RestartAltOutlined />} onClick={limpiarFiltros}>Limpiar</Button>
      </Stack>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4, md: 2 }}>
          <TextField
            label="Buscar por cliente"
            size="small"
            fullWidth
            value={filterCliente}
            onChange={(e) => setFilterCliente(e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4, md: 2 }}>
          <TextField
            label="Buscar por folio"
            size="small"
            fullWidth
            value={filterFolioInput}
            onChange={(e) => setFilterFolioInput(e.target.value)}
            placeholder="PE-BO-0033"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4, md: 2 }}>
          <TextField
            label="Buscar por unificacion"
            size="small"
            fullWidth
            value={filterUnificacionInput}
            onChange={(e) => setFilterUnificacionInput(e.target.value)}
            placeholder="UNI-0044"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4, md: 2 }}>
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
        <Grid size={{ xs: 12, sm: 4, md: 2 }}>
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
        <Grid size={{ xs: 12, sm: 4, md: 2 }}>
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
      </Paper>

      <Paper variant="outlined" sx={{ p: 1, overflow: "hidden" }}>
      <div style={{ height: 620, width: "100%" }} onContextMenu={handleGridContextMenu}>
        <DataGrid
          apiRef={pedidosGridApiRef}
          loading={loadingPedidos}
          rows={filtered}
          columns={columns}
          getRowId={(row) => row.id}
          pageSizeOptions={[10, 25, 50]}
          paginationMode="server"
          paginationModel={paginationModel}
          rowCount={rowCount}
          onPaginationModelChange={(model) => {
            pendingRestoreSelectionRef.current = false;
            setPaginationModel(model);
          }}
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
      </Paper>

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
    </Stack>
  );
}
