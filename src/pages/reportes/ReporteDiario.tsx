import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Grid,
  TextField,
  Button,
  Divider,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddCircleOutlineOutlined from "@mui/icons-material/AddCircleOutlineOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import CleaningServicesOutlined from "@mui/icons-material/CleaningServicesOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import Swal from "sweetalert2";
import { api } from "../../api/axios";
import { useAuthStore } from "../../auth/useAuthStore";
import { useSystemConfigStore } from "../../config/useSystemConfigStore";
import { UniformaLoader } from "../../components/UniformaLoader";
import { canUseVendedorDropdown, filterUsuariosByBodega } from "../../utils/vendedorDropdownAccess";

interface PagoVenta {
  referencia?: string | null;
  banco?: string | null;
}

interface DocumentoGenerado {
  id: number;
  tipo: string;
  correlativo: string;
  titulo?: string | null;
  data: any;
  creadoEn: string;
  actualizadoEn: string;
  usuario?: { nombre?: string | null; usuario?: string | null; bodegaId?: number | string | null };
}

interface Usuario {
  id: number;
  nombre: string;
  usuario: string;
  bodegaId?: number | string | null;
}

interface Venta {
  id: number;
  folio?: string | null;
  fecha: string;
  total: number;
  envio?: number | null;
  ubicacion?: string | null;
  metodoPago?: string | null;
  clienteNombre?: string | null;
  pagos?: PagoVenta[];
}

interface PedidoReporte {
  id: number;
  folio?: string | null;
  fecha: string;
  anticipo?: number | null;
  envio?: number | null;
  ubicacion?: string | null;
  metodoPago?: string | null;
  clienteNombre?: string | null;
  cliente?: { nombre?: string | null } | null;
  bodega?: { nombre?: string | null; ubicacion?: string | null } | null;
  pagos?: PagoVenta[];
}

interface CapitalRow {
  id: number;
  fecha: string;
  envio: string;
  transferencia: number;
  autorizacion: string;
  deposito: number;
  boleta: string;
  banco: string;
  efectivo: number;
  observaciones: string;
}

interface DepartamentoRow {
  id: number;
  fecha: string;
  envio: string;
  transferencia: number;
  autorizacion: string;
  deposito: number;
  boleta: string;
  banco: string;
  observaciones: string;
}

interface TiendaRow {
  id: number;
  fecha: string;
  recibo: string;
  transferencia: number;
  autorizacionTransferencia: string;
  deposito: number;
  boleta: string;
  banco: string;
  tarjeta: number;
  autorizacionTarjeta: string;
  efectivo: number;
  total: number;
  observaciones: string;
}

const money = (value: number) =>
  `Q ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toDateOnly = (value: string | Date) => {
  const d = typeof value === "string" ? new Date(value) : value;
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const formatDisplayDate = (value: string) => {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

const metodoCuentaComoTarjeta = (metodo?: string | null) => {
  const normalized = `${metodo || ""}`.trim().toLowerCase();
  return normalized === "tarjeta" || normalized === "visalink";
};

const normalizeUbicacionVenta = (venta: Venta) => {
  const normalized = `${venta.ubicacion || "TIENDA"}`.trim().toUpperCase();
  if (normalized.includes("CAPITAL")) return "CAPITAL";
  if (normalized.includes("DEPART")) return "DEPARTAMENTO";
  return "TIENDA";
};

const normalizeUbicacionPedido = (pedido: PedidoReporte) => {
  const raw = `${pedido.ubicacion || ""}`.trim();
  const fallbackFromBodega = `${pedido.bodega?.ubicacion || pedido.bodega?.nombre || ""}`.trim();
  const normalized = (raw || fallbackFromBodega || "TIENDA").toUpperCase();
  if (normalized.includes("CAPITAL")) return "CAPITAL";
  if (normalized.includes("DEPART")) return "DEPARTAMENTO";
  if (normalized.includes("ANTIGUA")) return "DEPARTAMENTO";
  return "TIENDA";
};

const getVentaMetodo = (venta: Venta) => `${venta.metodoPago || ""}`.trim().toLowerCase();

const getVentaReferencia = (venta: Venta) => `${venta.pagos?.[0]?.referencia || ""}`.trim();

const getVentaBanco = (venta: Venta) => `${venta.pagos?.[0]?.banco || ""}`.trim();

const getVentaRecibo = (venta: Venta) => venta.folio || `V-${venta.id}`;

const getPedidoMetodo = (pedido: PedidoReporte) => `${pedido.metodoPago || ""}`.trim().toLowerCase();

const getPedidoReferencia = (pedido: PedidoReporte) => `${pedido.pagos?.[0]?.referencia || ""}`.trim();

const getPedidoBanco = (pedido: PedidoReporte) => `${pedido.pagos?.[0]?.banco || ""}`.trim();

const getPedidoRecibo = (pedido: PedidoReporte) => pedido.folio || `PE-${pedido.id}`;

const getPedidoMontoReporte = (pedido: PedidoReporte) =>
  Number(pedido.anticipo || 0) + Number(pedido.envio || 0);

const createCapitalRowFromVenta = (venta: Venta, fecha: string): CapitalRow => {
  const metodo = getVentaMetodo(venta);
  const referencia = getVentaReferencia(venta);
  const banco = getVentaBanco(venta);
  const total = Number(venta.total || 0);
  return {
    id: venta.id,
    fecha,
    envio: "",
    transferencia: metodo === "transferencia" ? total : 0,
    autorizacion: metodo === "transferencia" ? referencia : "",
    deposito: metodo === "deposito_bancario" ? total : 0,
    boleta: metodo === "deposito_bancario" ? referencia : "",
    banco: metodo === "deposito_bancario" ? banco : "",
    efectivo: metodo === "efectivo" ? total : 0,
    observaciones: "",
  };
};

const createDepartamentoRowFromVenta = (venta: Venta, fecha: string): DepartamentoRow => {
  const metodo = getVentaMetodo(venta);
  const referencia = getVentaReferencia(venta);
  const banco = getVentaBanco(venta);
  const total = Number(venta.total || 0);
  return {
    id: venta.id,
    fecha,
    envio: "",
    transferencia: metodo === "transferencia" ? total : 0,
    autorizacion: metodo === "transferencia" ? referencia : "",
    deposito: metodo === "deposito_bancario" ? total : 0,
    boleta: metodo === "deposito_bancario" ? referencia : "",
    banco: metodo === "deposito_bancario" ? banco : "",
    observaciones: "",
  };
};

const createCapitalRowFromPedido = (pedido: PedidoReporte, fecha: string): CapitalRow => {
  const metodo = getPedidoMetodo(pedido);
  const referencia = getPedidoReferencia(pedido);
  const banco = getPedidoBanco(pedido);
  const total = getPedidoMontoReporte(pedido);
  return {
    id: -pedido.id,
    fecha,
    envio: "",
    transferencia: metodo === "transferencia" ? total : 0,
    autorizacion: metodo === "transferencia" ? referencia : "",
    deposito: metodo === "deposito_bancario" ? total : 0,
    boleta: metodo === "deposito_bancario" ? referencia : "",
    banco: metodo === "deposito_bancario" ? banco : "",
    efectivo: metodo === "efectivo" ? total : 0,
    observaciones: "",
  };
};

const createDepartamentoRowFromPedido = (pedido: PedidoReporte, fecha: string): DepartamentoRow => {
  const metodo = getPedidoMetodo(pedido);
  const referencia = getPedidoReferencia(pedido);
  const banco = getPedidoBanco(pedido);
  const total = getPedidoMontoReporte(pedido);
  return {
    id: -pedido.id,
    fecha,
    envio: "",
    transferencia: metodo === "transferencia" ? total : 0,
    autorizacion: metodo === "transferencia" ? referencia : "",
    deposito: metodo === "deposito_bancario" ? total : 0,
    boleta: metodo === "deposito_bancario" ? referencia : "",
    banco: metodo === "deposito_bancario" ? banco : "",
    observaciones: "",
  };
};

const createTiendaRowFromPedido = (pedido: PedidoReporte, fecha: string): TiendaRow => {
  const metodo = getPedidoMetodo(pedido);
  const referencia = getPedidoReferencia(pedido);
  const banco = getPedidoBanco(pedido);
  const total = getPedidoMontoReporte(pedido);
  return {
    id: -pedido.id,
    fecha,
    recibo: getPedidoRecibo(pedido),
    transferencia: metodo === "transferencia" ? total : 0,
    autorizacionTransferencia: metodo === "transferencia" ? referencia : "",
    deposito: metodo === "deposito_bancario" ? total : 0,
    boleta: metodo === "deposito_bancario" ? referencia : "",
    banco: metodo === "deposito_bancario" ? banco : "",
    tarjeta: metodoCuentaComoTarjeta(metodo) ? total : 0,
    autorizacionTarjeta: metodoCuentaComoTarjeta(metodo) ? referencia : "",
    efectivo: metodo === "efectivo" ? total : 0,
    total,
    observaciones: "",
  };
};

const createCapitalRow = (fecha: string): CapitalRow => ({
  id: Date.now() + Math.floor(Math.random() * 100000),
  fecha,
  envio: "",
  transferencia: 0,
  autorizacion: "",
  deposito: 0,
  boleta: "",
  banco: "",
  efectivo: 0,
  observaciones: "",
});

const createDepartamentoRow = (fecha: string): DepartamentoRow => ({
  id: Date.now() + Math.floor(Math.random() * 100000),
  fecha,
  envio: "",
  transferencia: 0,
  autorizacion: "",
  deposito: 0,
  boleta: "",
  banco: "",
  observaciones: "",
});

const createTiendaRow = (fecha: string): TiendaRow => ({
  id: Date.now() + Math.floor(Math.random() * 100000),
  fecha,
  recibo: "",
  transferencia: 0,
  autorizacionTransferencia: "",
  deposito: 0,
  boleta: "",
  banco: "",
  tarjeta: 0,
  autorizacionTarjeta: "",
  efectivo: 0,
  total: 0,
  observaciones: "",
});

const getTiendaRowTotal = (row: TiendaRow) =>
  Number(row.total || 0) ||
  Number(row.transferencia || 0) + Number(row.deposito || 0) + Number(row.tarjeta || 0) + Number(row.efectivo || 0);

const getReporteDiarioDocumentoTotal = (doc: DocumentoGenerado) =>
  (doc.data?.capitalRows || []).reduce(
    (sum: number, row: any) => sum + Number(row.transferencia || 0) + Number(row.deposito || 0) + Number(row.efectivo || 0),
    0
  ) +
  (doc.data?.departamentoRows || []).reduce(
    (sum: number, row: any) => sum + Number(row.transferencia || 0) + Number(row.deposito || 0),
    0
  ) +
  (doc.data?.ventasSnapshot || [])
    .filter((venta: Venta) => normalizeUbicacionVenta(venta) === "TIENDA")
    .reduce((sum: number, venta: any) => sum + Number(venta.total || 0), 0) +
  (doc.data?.pedidosSnapshot || [])
    .filter((pedido: PedidoReporte) => normalizeUbicacionPedido(pedido) === "TIENDA")
    .reduce((sum: number, pedido: PedidoReporte) => sum + getPedidoMontoReporte(pedido), 0) +
  (doc.data?.tiendaManualRows || []).reduce((sum: number, row: any) => sum + getTiendaRowTotal(row), 0);

const hasTiendaRowData = (row: TiendaRow) =>
  Boolean(
      `${row.recibo || ""}`.trim() ||
      `${row.autorizacionTransferencia || ""}`.trim() ||
      `${row.boleta || ""}`.trim() ||
      `${row.banco || ""}`.trim() ||
      `${row.autorizacionTarjeta || ""}`.trim() ||
      `${row.observaciones || ""}`.trim() ||
      Number(row.transferencia || 0) > 0 ||
      Number(row.deposito || 0) > 0 ||
      Number(row.tarjeta || 0) > 0 ||
      Number(row.efectivo || 0) > 0 ||
      Number(row.total || 0) > 0
  );

const hasCapitalRowData = (row: CapitalRow) =>
  Boolean(
    `${row.envio || ""}`.trim() ||
      `${row.autorizacion || ""}`.trim() ||
      `${row.boleta || ""}`.trim() ||
      `${row.banco || ""}`.trim() ||
      `${row.observaciones || ""}`.trim() ||
      Number(row.transferencia || 0) > 0 ||
      Number(row.deposito || 0) > 0 ||
      Number(row.efectivo || 0) > 0
  );

const hasDepartamentoRowData = (row: DepartamentoRow) =>
  Boolean(
    `${row.envio || ""}`.trim() ||
      `${row.autorizacion || ""}`.trim() ||
      `${row.boleta || ""}`.trim() ||
      `${row.banco || ""}`.trim() ||
      `${row.observaciones || ""}`.trim() ||
      Number(row.transferencia || 0) > 0 ||
      Number(row.deposito || 0) > 0
  );

export default function ReporteDiario() {
  const today = toDateOnly(new Date());
  const { nombre, primerNombre, primerApellido, usuario, rol, rolId, id: userId } = useAuthStore();
  const { vendedorDropdownRoleIds, vendedorDropdownBodegaIds, loaded: configLoaded, fetchConfig } = useSystemConfigStore();
  const location = useLocation();
  const [documentos, setDocumentos] = useState<DocumentoGenerado[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [filtroUsuarioId, setFiltroUsuarioId] = useState<number | null | "">("");
  const [documentoId, setDocumentoId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filtroDesde, setFiltroDesde] = useState(today);
  const [filtroHasta, setFiltroHasta] = useState(today);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [pedidos, setPedidos] = useState<PedidoReporte[]>([]);
  const [fecha, setFecha] = useState(today);
  const [liquidacionNo, setLiquidacionNo] = useState("Pendiente");
  const [capitalRows, setCapitalRows] = useState<CapitalRow[]>(() => [createCapitalRow(today)]);
  const [departamentoRows, setDepartamentoRows] = useState<DepartamentoRow[]>(() => [createDepartamentoRow(today)]);
  const [tiendaManualRows, setTiendaManualRows] = useState<TiendaRow[]>(() => [createTiendaRow(today)]);
  const [capitalAutoEnvios, setCapitalAutoEnvios] = useState<Record<number, string>>({});
  const [departamentoAutoEnvios, setDepartamentoAutoEnvios] = useState<Record<number, string>>({});
  const [capitalAutoObservaciones, setCapitalAutoObservaciones] = useState<Record<number, string>>({});
  const [departamentoAutoObservaciones, setDepartamentoAutoObservaciones] = useState<Record<number, string>>({});
  const [tiendaAutoObservaciones, setTiendaAutoObservaciones] = useState<Record<number, string>>({});
  const [capitalAutoEditId, setCapitalAutoEditId] = useState<number | null>(null);
  const [departamentoAutoEditId, setDepartamentoAutoEditId] = useState<number | null>(null);
  const [tiendaAutoEditId, setTiendaAutoEditId] = useState<number | null>(null);
  const [rellenando, setRellenando] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const isAdmin = rol === "ADMIN";
  const canUseDropdown = canUseVendedorDropdown(rol, rolId, vendedorDropdownRoleIds);
  const usuariosDropdown = useMemo(
    () => (isAdmin ? usuarios : filterUsuariosByBodega(usuarios, vendedorDropdownBodegaIds)),
    [isAdmin, usuarios, vendedorDropdownBodegaIds]
  );

  const cargarSiguienteLiquidacion = async () => {
    try {
      const resp = await api.get("/correlativos/usuario-operaciones/actual/reporteDiario");
      setLiquidacionNo(resp.data?.correlativo || "Pendiente");
    } catch {
      setLiquidacionNo("Pendiente");
    }
  };

  const cargarDocumentos = useCallback(async () => {
    try {
      if (!configLoaded) return;
      const params: any = { tipo: "reporteDiario" };
      if (!canUseDropdown && !userId) {
        setDocumentos([]);
        return;
      }
      if (!canUseDropdown) {
        params.usuarioId = userId;
      } else if (typeof filtroUsuarioId === 'number') {
        params.usuarioId = filtroUsuarioId;
      }
      const resp = await api.get("/documentos", { params });
      setDocumentos(resp.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar los reportes diarios generados", "error");
    }
  }, [filtroUsuarioId, canUseDropdown, userId, configLoaded]);

  const rellenarDesdeVentas = async () => {
    if (rellenando || generandoPdf) return;
    try {
      setRellenando(true);
      const [respVentas, respPedidos] = await Promise.all([
        api.get("/ventas"),
        api.get("/produccion"),
      ]);
      setVentas(respVentas.data || []);
      setPedidos(respPedidos.data || []);
      setCapitalAutoEnvios({});
      setDepartamentoAutoEnvios({});
      setCapitalAutoObservaciones({});
      setDepartamentoAutoObservaciones({});
      setTiendaAutoObservaciones({});
      setCapitalAutoEditId(null);
      setDepartamentoAutoEditId(null);
      setTiendaAutoEditId(null);
      Swal.fire(
        "Listo",
        `Se rellenaron las ventas y pedidos registrados para ${fecha}. Revisa cada seccion antes de imprimir.`,
        "success"
      );
    } catch {
      Swal.fire("Error", "No se pudieron rellenar las ventas y pedidos del reporte diario", "error");
    } finally {
      setRellenando(false);
    }
  };

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (canUseDropdown) {
      api.get("/usuarios").then(resp => setUsuarios(resp.data || []));
    }
    setFiltroUsuarioId(canUseDropdown ? "" : userId ?? "");
  }, [canUseDropdown, userId]);

  useEffect(() => {
    void cargarDocumentos();
  }, [cargarDocumentos]);

  useEffect(() => {
    if ((location.state as any)?.sidebarClickAt) {
      setShowForm(false);
      void cargarDocumentos();
    }
  }, [location.state, cargarDocumentos]);

  const documentosFiltrados = useMemo(
    () =>
      documentos.filter((doc) => {
        const docFecha = doc.data?.fecha || String(doc.creadoEn || "").slice(0, 10);
        if (filtroDesde && docFecha < filtroDesde) return false;
        if (filtroHasta && docFecha > filtroHasta) return false;
        if (!isAdmin && canUseDropdown && vendedorDropdownBodegaIds.length && typeof filtroUsuarioId !== "number") {
          const bodegaId = Number(doc.usuario?.bodegaId);
          if (!Number.isFinite(bodegaId) || !vendedorDropdownBodegaIds.includes(bodegaId)) return false;
        }
        return true;
      }),
    [documentos, filtroDesde, filtroHasta, canUseDropdown, filtroUsuarioId, isAdmin, vendedorDropdownBodegaIds]
  );

  const documentosGridRows = useMemo(
    () =>
      documentosFiltrados.map((doc) => ({
        ...doc,
        fechaReporte: doc.data?.fecha || String(doc.creadoEn || "").slice(0, 10),
        totalReporte: getReporteDiarioDocumentoTotal(doc),
        usuarioNombre: doc.usuario?.nombre || doc.usuario?.usuario || "N/D",
      })),
    [documentosFiltrados]
  );

  const totalCierresFiltrados = useMemo(
    () => documentosGridRows.reduce((sum, doc) => sum + Number(doc.totalReporte || 0), 0),
    [documentosGridRows]
  );

  const nuevoReporte = async () => {
    setDocumentoId(null);
    await cargarSiguienteLiquidacion();
    setVentas([]);
    setPedidos([]);
    setFecha(today);
    setCapitalRows([createCapitalRow(today)]);
    setDepartamentoRows([createDepartamentoRow(today)]);
    setTiendaManualRows([createTiendaRow(today)]);
    setCapitalAutoEnvios({});
    setDepartamentoAutoEnvios({});
    setCapitalAutoObservaciones({});
    setDepartamentoAutoObservaciones({});
    setTiendaAutoObservaciones({});
    setCapitalAutoEditId(null);
    setDepartamentoAutoEditId(null);
    setTiendaAutoEditId(null);
    setShowForm(true);
  };

  const ventasDelDia = useMemo(
    () => ventas.filter((venta) => toDateOnly(venta.fecha) === fecha),
    [ventas, fecha]
  );

  const pedidosDelDia = useMemo(
    () => pedidos.filter((pedido) => toDateOnly(pedido.fecha) === fecha),
    [pedidos, fecha]
  );

  const capitalAutoRows = useMemo<CapitalRow[]>(
    () =>
      [
        ...ventasDelDia
          .filter((venta) => normalizeUbicacionVenta(venta) === "CAPITAL")
          .map((venta) => createCapitalRowFromVenta(venta, fecha)),
        ...pedidosDelDia
          .filter((pedido) => normalizeUbicacionPedido(pedido) === "CAPITAL")
          .map((pedido) => createCapitalRowFromPedido(pedido, fecha)),
      ].map((row) => ({
        ...row,
        envio: capitalAutoEnvios[row.id] || "",
        observaciones: capitalAutoObservaciones[row.id] || "",
      })),
    [ventasDelDia, pedidosDelDia, fecha, capitalAutoEnvios, capitalAutoObservaciones]
  );

  const departamentoAutoRows = useMemo<DepartamentoRow[]>(
    () =>
      [
        ...ventasDelDia
          .filter((venta) => normalizeUbicacionVenta(venta) === "DEPARTAMENTO")
          .map((venta) => createDepartamentoRowFromVenta(venta, fecha)),
        ...pedidosDelDia
          .filter((pedido) => normalizeUbicacionPedido(pedido) === "DEPARTAMENTO")
          .map((pedido) => createDepartamentoRowFromPedido(pedido, fecha)),
      ].map((row) => ({
        ...row,
        envio: departamentoAutoEnvios[row.id] || "",
        observaciones: departamentoAutoObservaciones[row.id] || "",
      })),
    [ventasDelDia, pedidosDelDia, fecha, departamentoAutoEnvios, departamentoAutoObservaciones]
  );

  const tiendaAutoRows = useMemo<TiendaRow[]>(() => {
    const ventaRows = ventasDelDia.filter((venta) => normalizeUbicacionVenta(venta) === "TIENDA").map((venta) => {
      const metodo = getVentaMetodo(venta);
      const referencia = getVentaReferencia(venta);
      const banco = getVentaBanco(venta);
      return {
        id: venta.id,
        fecha,
        recibo: getVentaRecibo(venta),
        transferencia: metodo === "transferencia" ? Number(venta.total || 0) : 0,
        autorizacionTransferencia: metodo === "transferencia" ? referencia : "",
        deposito: metodo === "deposito_bancario" ? Number(venta.total || 0) : 0,
        boleta: metodo === "deposito_bancario" ? referencia : "",
        banco: metodo === "deposito_bancario" ? banco : "",
        tarjeta: metodoCuentaComoTarjeta(metodo) ? Number(venta.total || 0) : 0,
        autorizacionTarjeta: metodoCuentaComoTarjeta(metodo) ? referencia : "",
        efectivo: metodo === "efectivo" ? Number(venta.total || 0) : 0,
        total: Number(venta.total || 0),
        observaciones: "",
      };
    });
    const pedidoRows = pedidosDelDia
      .filter((pedido) => normalizeUbicacionPedido(pedido) === "TIENDA")
      .map((pedido) => createTiendaRowFromPedido(pedido, fecha));
    return [...ventaRows, ...pedidoRows].map((row) => ({
      ...row,
      observaciones: tiendaAutoObservaciones[row.id] || "",
    }));
  }, [ventasDelDia, pedidosDelDia, fecha, tiendaAutoObservaciones]);

  const tiendaRows = useMemo<TiendaRow[]>(
    () => [...tiendaAutoRows, ...tiendaManualRows.filter(hasTiendaRowData)],
    [tiendaAutoRows, tiendaManualRows]
  );

  const subtotalCapital = useMemo(
    () =>
      [...capitalAutoRows, ...capitalRows].reduce(
        (sum, row) => sum + Number(row.transferencia || 0) + Number(row.deposito || 0) + Number(row.efectivo || 0),
        0
      ),
    [capitalAutoRows, capitalRows]
  );

  const subtotalDepartamento = useMemo(
    () =>
      [...departamentoAutoRows, ...departamentoRows].reduce(
        (sum, row) => sum + Number(row.transferencia || 0) + Number(row.deposito || 0),
        0
      ),
    [departamentoAutoRows, departamentoRows]
  );

  const subtotalTienda = useMemo(
    () => tiendaRows.reduce((sum, row) => sum + getTiendaRowTotal(row), 0),
    [tiendaRows]
  );

  const totalResumen = useMemo(
    () => Number(subtotalCapital || 0) + Number(subtotalDepartamento || 0) + Number(subtotalTienda || 0),
    [subtotalCapital, subtotalDepartamento, subtotalTienda]
  );

  const updateCapitalRow = (id: number, field: keyof CapitalRow, value: string | number) => {
    setCapitalRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const updateDepartamentoRow = (id: number, field: keyof DepartamentoRow, value: string | number) => {
    setDepartamentoRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const updateTiendaManualRow = (id: number, field: keyof TiendaRow, value: string | number) => {
    setTiendaManualRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const updateCapitalAutoEnvio = (id: number, value: string) => {
    setCapitalAutoEnvios((prev) => ({ ...prev, [id]: value }));
  };

  const updateDepartamentoAutoEnvio = (id: number, value: string) => {
    setDepartamentoAutoEnvios((prev) => ({ ...prev, [id]: value }));
  };

  const updateCapitalAutoObservacion = (id: number, value: string) => {
    setCapitalAutoObservaciones((prev) => ({ ...prev, [id]: value }));
  };

  const updateDepartamentoAutoObservacion = (id: number, value: string) => {
    setDepartamentoAutoObservaciones((prev) => ({ ...prev, [id]: value }));
  };

  const updateTiendaAutoObservacion = (id: number, value: string) => {
    setTiendaAutoObservaciones((prev) => ({ ...prev, [id]: value }));
  };

  const limpiarCapturas = () => {
    setCapitalRows([createCapitalRow(fecha)]);
    setDepartamentoRows([createDepartamentoRow(fecha)]);
    setTiendaManualRows([createTiendaRow(fecha)]);
    setVentas([]);
    setPedidos([]);
    setCapitalAutoEnvios({});
    setDepartamentoAutoEnvios({});
    setCapitalAutoObservaciones({});
    setDepartamentoAutoObservaciones({});
    setTiendaAutoObservaciones({});
    setCapitalAutoEditId(null);
    setDepartamentoAutoEditId(null);
    setTiendaAutoEditId(null);
  };

  const getGeneradoPor = () =>
    [primerNombre?.trim(), primerApellido?.trim()].filter(Boolean).join(" ") ||
    nombre?.trim() ||
    usuario?.trim() ||
    "Usuario";

  const getPayload = () => ({
    fecha,
    generadoPor: getGeneradoPor(),
    capitalRows: [...capitalAutoRows, ...capitalRows.filter(hasCapitalRowData)],
    departamentoRows: [...departamentoAutoRows, ...departamentoRows.filter(hasDepartamentoRowData)],
    tiendaAutoRows,
    tiendaManualRows,
    ventasSnapshot: ventasDelDia,
    pedidosSnapshot: pedidosDelDia,
  });

  const guardarDocumento = async () => {
    const payload = {
      titulo: `Reporte diario ${fecha}`,
      data: getPayload(),
    };
    if (documentoId) {
      const resp = await api.patch(`/documentos/${documentoId}`, payload);
      return resp.data as DocumentoGenerado;
    }
    const resp = await api.post("/documentos", { tipo: "reporteDiario", ...payload });
    const doc = resp.data as DocumentoGenerado;
    setDocumentoId(doc.id);
    setLiquidacionNo(doc.correlativo);
    return doc;
  };

  const descargarDocumentoPdf = async (doc: DocumentoGenerado) => {
    const resp = await api.get(`/documentos/${doc.id}/pdf?t=${Date.now()}`, {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([resp.data], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Reporte diario ${doc.data?.fecha || fecha}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const reimprimirDocumento = async (doc: DocumentoGenerado) => {
    if (generandoPdf) return;
    try {
      setGenerandoPdf(true);
      await descargarDocumentoPdf(doc);
    } catch {
      Swal.fire("Error", "No se pudo descargar el PDF del reporte diario", "error");
    } finally {
      setGenerandoPdf(false);
    }
  };

  const imprimir = async () => {
    if (generandoPdf) return;
    setGenerandoPdf(true);
    let docGenerado: DocumentoGenerado;
    try {
      docGenerado = await guardarDocumento();
      setLiquidacionNo(docGenerado.correlativo || liquidacionNo);
      await descargarDocumentoPdf(docGenerado);
    } catch (error: any) {
      const msg = error?.response?.data?.message || "No se pudo generar o descargar el reporte diario";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
      return;
    } finally {
      setGenerandoPdf(false);
    }

    await Swal.fire("Listo", "El PDF del cierre diario se descargo automaticamente.", "success");
    setShowForm(false);
    void cargarDocumentos();
  };

  const documentosColumns: GridColDef<(typeof documentosGridRows)[number]>[] = [
    { field: "correlativo", headerName: "Correlativo", minWidth: 150, flex: 0.8 },
    {
      field: "fechaReporte",
      headerName: "Fecha",
      minWidth: 130,
      flex: 0.7,
      valueFormatter: (value) => `${value || ""}`,
    },
    {
      field: "totalReporte",
      headerName: "Total",
      minWidth: 140,
      flex: 0.7,
      valueFormatter: (value) => money(Number(value || 0)),
    },
    { field: "usuarioNombre", headerName: "Usuario", minWidth: 180, flex: 1 },
    {
      field: "acciones",
      headerName: "Accion",
      minWidth: 150,
      sortable: false,
      filterable: false,
      align: "right",
      headerAlign: "right",
      renderCell: (params) => (
        <Button
          size="small"
          variant="contained"
          color="secondary"
          disabled={generandoPdf}
          onClick={() => reimprimirDocumento(params.row)}
        >
          Reimprimir
        </Button>
      ),
    },
  ];

  if (!showForm) {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h4">Reporte diario</Typography>
          <Button startIcon={<AddOutlined />} variant="contained" onClick={nuevoReporte}>
            Nuevo reporte
          </Button>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
          <TextField label="Desde" type="date" size="small" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Hasta" type="date" size="small" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} InputLabelProps={{ shrink: true }} />
          {canUseDropdown && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Usuario</InputLabel>
              <Select
                label="Usuario"
                value={filtroUsuarioId}
                onChange={(e) => setFiltroUsuarioId(e.target.value as number | null | "")}
              >
                <MenuItem value="">Todos</MenuItem>
                {usuariosDropdown.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.nombre || u.usuario}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>
        <Box sx={{ height: 460, width: "100%" }}>
          <DataGrid
            rows={documentosGridRows}
            columns={documentosColumns}
            getRowId={(row) => row.id}
            pageSizeOptions={[5, 10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            disableRowSelectionOnClick
            localeText={{ noRowsLabel: "No hay reportes diarios generados." }}
          />
        </Box>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="flex-end"
          spacing={2}
          sx={{ mt: 2, p: 2, borderRadius: 1, bgcolor: "grey.50" }}
        >
          <Typography color="text.secondary">
            Cierres visibles: <strong>{documentosGridRows.length}</strong>
          </Typography>
          <Typography fontWeight={700}>Suma de todas las tiendas: {money(totalCierresFiltrados)}</Typography>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, position: "relative", overflow: "hidden" }}>
      {generandoPdf && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "rgba(255,255,255,0.68)",
            backdropFilter: "blur(1px)",
          }}
        >
          <UniformaLoader size={96} />
        </Box>
      )}
      <Box sx={{ opacity: generandoPdf ? 0.42 : 1, pointerEvents: generandoPdf ? "none" : "auto" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">Reporte diario</Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<ArrowBackOutlined />} variant="outlined" size="small" disabled={generandoPdf} onClick={() => { setShowForm(false); void cargarDocumentos(); }}>
            Volver
          </Button>
          <Button startIcon={<RefreshOutlined />} variant="outlined" size="small" onClick={rellenarDesdeVentas} disabled={rellenando || generandoPdf}>
            {rellenando ? "Rellenando..." : "Rellenar"}
          </Button>
          <Button
            startIcon={<CleaningServicesOutlined />}
            variant="outlined"
            size="small"
            disabled={generandoPdf}
            onClick={limpiarCapturas}
          >
            Limpiar capturas
          </Button>
          <Button
            startIcon={<PictureAsPdfOutlined />}
            variant="contained"
            color="secondary"
            size="small"
            onClick={imprimir}
            disabled={generandoPdf}
          >
            Imprimir / PDF
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField
            label="Fecha"
            type="date"
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
            value={fecha}
            disabled={generandoPdf}
            onChange={(e) => setFecha(e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField
            label="Liquidación No."
            fullWidth
            size="small"
            value={liquidacionNo}
            disabled
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ height: "100%", flexWrap: "wrap" }}>
            <Chip label={`${ventasDelDia.length + pedidosDelDia.length} registros del dia`} />
            <Chip label={`Capital ${money(subtotalCapital)}`} color="primary" variant="outlined" />
            <Chip label={`Departamento ${money(subtotalDepartamento)}`} color="warning" variant="outlined" />
            <Chip label={`Tienda ${money(subtotalTienda)}`} color="success" />
          </Stack>
        </Grid>
      </Grid>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Este reporte no se guarda. Puedes completar los bloques manuales, revisar las ventas y pedidos del dia y luego imprimirlo o guardarlo como PDF.
      </Typography>

      <Divider sx={{ mb: 2 }} />

      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6">Capital / Mensajero</Typography>
            <Button
              size="small"
              startIcon={<AddCircleOutlineOutlined />}
              onClick={() => setCapitalRows((prev) => [...prev, createCapitalRow(fecha)])}
            >
              Agregar fila
            </Button>
          </Stack>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Envío</TableCell>
                  <TableCell>Transferencia</TableCell>
                  <TableCell>Autorización</TableCell>
                  <TableCell>Depósito</TableCell>
                  <TableCell>Boleta</TableCell>
                  <TableCell>Banco</TableCell>
                  <TableCell>Efectivo</TableCell>
                  <TableCell>Total</TableCell>
                  <TableCell>Observaciones</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {capitalAutoRows.map((row) => {
                  const total = Number(row.transferencia || 0) + Number(row.deposito || 0) + Number(row.efectivo || 0);
                  return (
                    <TableRow key={`capital-auto-${row.id}`}>
                      <TableCell>{formatDisplayDate(row.fecha)}</TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        {capitalAutoEditId === row.id ? (
                          <TextField
                            size="small"
                            fullWidth
                            value={row.envio}
                            onChange={(e) => updateCapitalAutoEnvio(row.id, e.target.value)}
                          />
                        ) : (
                          row.envio || "-"
                        )}
                      </TableCell>
                      <TableCell>{money(row.transferencia)}</TableCell>
                      <TableCell>{row.autorizacion || "-"}</TableCell>
                      <TableCell>{money(row.deposito)}</TableCell>
                      <TableCell>{row.boleta || "-"}</TableCell>
                      <TableCell>{row.banco || "-"}</TableCell>
                      <TableCell>{money(row.efectivo)}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{money(total)}</TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        {capitalAutoEditId === row.id ? (
                          <TextField
                            size="small"
                            fullWidth
                            value={row.observaciones}
                            onChange={(e) => updateCapitalAutoObservacion(row.id, e.target.value)}
                          />
                        ) : (
                          row.observaciones || "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => setCapitalAutoEditId((current) => (current === row.id ? null : row.id))}
                        >
                          {capitalAutoEditId === row.id ? <SaveOutlined fontSize="small" /> : <EditOutlined fontSize="small" />}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {capitalRows.map((row) => {
                  const total = Number(row.transferencia || 0) + Number(row.deposito || 0) + Number(row.efectivo || 0);
                  return (
                    <TableRow key={row.id}>
                      <TableCell sx={{ minWidth: 140 }}>
                        <TextField
                          type="date"
                          size="small"
                          fullWidth
                          value={row.fecha}
                          onChange={(e) => updateCapitalRow(row.id, "fecha", e.target.value)}
                          InputLabelProps={{ shrink: true }}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField size="small" fullWidth value={row.envio} onChange={(e) => updateCapitalRow(row.id, "envio", e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField
                          type="number"
                          size="small"
                          fullWidth
                          value={row.transferencia}
                          onChange={(e) => updateCapitalRow(row.id, "transferencia", Number(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 140 }}>
                        <TextField size="small" fullWidth value={row.autorizacion} onChange={(e) => updateCapitalRow(row.id, "autorizacion", e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField
                          type="number"
                          size="small"
                          fullWidth
                          value={row.deposito}
                          onChange={(e) => updateCapitalRow(row.id, "deposito", Number(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField size="small" fullWidth value={row.boleta} onChange={(e) => updateCapitalRow(row.id, "boleta", e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField size="small" fullWidth value={row.banco} onChange={(e) => updateCapitalRow(row.id, "banco", e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField
                          type="number"
                          size="small"
                          fullWidth
                          value={row.efectivo}
                          onChange={(e) => updateCapitalRow(row.id, "efectivo", Number(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>{money(total)}</TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <TextField
                          size="small"
                          fullWidth
                          value={row.observaciones}
                          onChange={(e) => updateCapitalRow(row.id, "observaciones", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setCapitalRows((prev) => prev.filter((item) => item.id !== row.id))}
                          disabled={capitalRows.length === 1}
                        >
                          <DeleteOutlineOutlined fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6">Departamentos / Cargo expreso</Typography>
            <Button
              size="small"
              startIcon={<AddCircleOutlineOutlined />}
              onClick={() => setDepartamentoRows((prev) => [...prev, createDepartamentoRow(fecha)])}
            >
              Agregar fila
            </Button>
          </Stack>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Envío</TableCell>
                  <TableCell>Transferencia</TableCell>
                  <TableCell>Autorización</TableCell>
                  <TableCell>Depósito</TableCell>
                  <TableCell>Boleta</TableCell>
                  <TableCell>Banco</TableCell>
                  <TableCell>Total</TableCell>
                  <TableCell>Observaciones</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {departamentoAutoRows.map((row) => {
                  const total = Number(row.transferencia || 0) + Number(row.deposito || 0);
                  return (
                    <TableRow key={`departamento-auto-${row.id}`}>
                      <TableCell>{formatDisplayDate(row.fecha)}</TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        {departamentoAutoEditId === row.id ? (
                          <TextField
                            size="small"
                            fullWidth
                            value={row.envio}
                            onChange={(e) => updateDepartamentoAutoEnvio(row.id, e.target.value)}
                          />
                        ) : (
                          row.envio || "-"
                        )}
                      </TableCell>
                      <TableCell>{money(row.transferencia)}</TableCell>
                      <TableCell>{row.autorizacion || "-"}</TableCell>
                      <TableCell>{money(row.deposito)}</TableCell>
                      <TableCell>{row.boleta || "-"}</TableCell>
                      <TableCell>{row.banco || "-"}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{money(total)}</TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        {departamentoAutoEditId === row.id ? (
                          <TextField
                            size="small"
                            fullWidth
                            value={row.observaciones}
                            onChange={(e) => updateDepartamentoAutoObservacion(row.id, e.target.value)}
                          />
                        ) : (
                          row.observaciones || "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => setDepartamentoAutoEditId((current) => (current === row.id ? null : row.id))}
                        >
                          {departamentoAutoEditId === row.id ? <SaveOutlined fontSize="small" /> : <EditOutlined fontSize="small" />}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {departamentoRows.map((row) => {
                  const total = Number(row.transferencia || 0) + Number(row.deposito || 0);
                  return (
                    <TableRow key={row.id}>
                      <TableCell sx={{ minWidth: 140 }}>
                        <TextField
                          type="date"
                          size="small"
                          fullWidth
                          value={row.fecha}
                          onChange={(e) => updateDepartamentoRow(row.id, "fecha", e.target.value)}
                          InputLabelProps={{ shrink: true }}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField size="small" fullWidth value={row.envio} onChange={(e) => updateDepartamentoRow(row.id, "envio", e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField
                          type="number"
                          size="small"
                          fullWidth
                          value={row.transferencia}
                          onChange={(e) => updateDepartamentoRow(row.id, "transferencia", Number(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 140 }}>
                        <TextField size="small" fullWidth value={row.autorizacion} onChange={(e) => updateDepartamentoRow(row.id, "autorizacion", e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField
                          type="number"
                          size="small"
                          fullWidth
                          value={row.deposito}
                          onChange={(e) => updateDepartamentoRow(row.id, "deposito", Number(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField size="small" fullWidth value={row.boleta} onChange={(e) => updateDepartamentoRow(row.id, "boleta", e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField size="small" fullWidth value={row.banco} onChange={(e) => updateDepartamentoRow(row.id, "banco", e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>{money(total)}</TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <TextField
                          size="small"
                          fullWidth
                          value={row.observaciones}
                          onChange={(e) => updateDepartamentoRow(row.id, "observaciones", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDepartamentoRows((prev) => prev.filter((item) => item.id !== row.id))}
                          disabled={departamentoRows.length === 1}
                        >
                          <DeleteOutlineOutlined fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6">Tienda</Typography>
            <Button
              size="small"
              startIcon={<AddCircleOutlineOutlined />}
              onClick={() => setTiendaManualRows((prev) => [...prev, createTiendaRow(fecha)])}
            >
              Agregar fila
            </Button>
          </Stack>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Recibo</TableCell>
                  <TableCell>Transferencia</TableCell>
                  <TableCell>Autorización</TableCell>
                  <TableCell>Deposito</TableCell>
                  <TableCell>Boleta</TableCell>
                  <TableCell>Banco</TableCell>
                  <TableCell>Tarjeta</TableCell>
                  <TableCell>Autorización</TableCell>
                  <TableCell>Efectivo</TableCell>
                  <TableCell>Total</TableCell>
                  <TableCell>Observaciones</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tiendaAutoRows.length ? (
                  tiendaAutoRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatDisplayDate(row.fecha)}</TableCell>
                      <TableCell>{row.recibo}</TableCell>
                      <TableCell>{money(row.transferencia)}</TableCell>
                      <TableCell>{row.autorizacionTransferencia || "-"}</TableCell>
                      <TableCell>{money(row.deposito)}</TableCell>
                      <TableCell>{row.boleta || "-"}</TableCell>
                      <TableCell>{row.banco || "-"}</TableCell>
                      <TableCell>{money(row.tarjeta)}</TableCell>
                      <TableCell>{row.autorizacionTarjeta || "-"}</TableCell>
                      <TableCell>{money(row.efectivo)}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{money(getTiendaRowTotal(row))}</TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        {tiendaAutoEditId === row.id ? (
                          <TextField
                            size="small"
                            fullWidth
                            value={row.observaciones}
                            onChange={(e) => updateTiendaAutoObservacion(row.id, e.target.value)}
                          />
                        ) : (
                          row.observaciones || "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => setTiendaAutoEditId((current) => (current === row.id ? null : row.id))}
                        >
                          {tiendaAutoEditId === row.id ? <SaveOutlined fontSize="small" /> : <EditOutlined fontSize="small" />}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                ) : null}

                {tiendaManualRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell sx={{ minWidth: 140 }}>
                      <TextField
                        type="date"
                        size="small"
                        fullWidth
                        value={row.fecha}
                        onChange={(e) => updateTiendaManualRow(row.id, "fecha", e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 120 }}>
                      <TextField size="small" fullWidth value={row.recibo} onChange={(e) => updateTiendaManualRow(row.id, "recibo", e.target.value)} />
                    </TableCell>
                    <TableCell sx={{ minWidth: 120 }}>
                      <TextField
                        type="number"
                        size="small"
                        fullWidth
                        value={row.transferencia}
                        onChange={(e) => updateTiendaManualRow(row.id, "transferencia", Number(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 120 }}>
                      <TextField
                        size="small"
                        fullWidth
                        value={row.autorizacionTransferencia}
                        onChange={(e) => updateTiendaManualRow(row.id, "autorizacionTransferencia", e.target.value)}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 120 }}>
                      <TextField
                        type="number"
                        size="small"
                        fullWidth
                        value={row.deposito}
                        onChange={(e) => updateTiendaManualRow(row.id, "deposito", Number(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 120 }}>
                      <TextField size="small" fullWidth value={row.boleta} onChange={(e) => updateTiendaManualRow(row.id, "boleta", e.target.value)} />
                    </TableCell>
                    <TableCell sx={{ minWidth: 120 }}>
                      <TextField size="small" fullWidth value={row.banco} onChange={(e) => updateTiendaManualRow(row.id, "banco", e.target.value)} />
                    </TableCell>
                    <TableCell sx={{ minWidth: 120 }}>
                      <TextField
                        type="number"
                        size="small"
                        fullWidth
                        value={row.tarjeta}
                        onChange={(e) => updateTiendaManualRow(row.id, "tarjeta", Number(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 150 }}>
                      <TextField
                        size="small"
                        fullWidth
                        value={row.autorizacionTarjeta}
                        onChange={(e) => updateTiendaManualRow(row.id, "autorizacionTarjeta", e.target.value)}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 120 }}>
                      <TextField
                        type="number"
                        size="small"
                        fullWidth
                        value={row.efectivo}
                        onChange={(e) => updateTiendaManualRow(row.id, "efectivo", Number(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>{money(getTiendaRowTotal(row))}</TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <TextField
                        size="small"
                        fullWidth
                        value={row.observaciones}
                        onChange={(e) => updateTiendaManualRow(row.id, "observaciones", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setTiendaManualRows((prev) => prev.filter((item) => item.id !== row.id))}
                        disabled={tiendaManualRows.length === 1}
                      >
                        <DeleteOutlineOutlined fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}

                {!tiendaAutoRows.length && !tiendaManualRows.length ? (
                  <TableRow>
                    <TableCell colSpan={13} align="center">
                      No hay ventas o pedidos registrados para esta fecha.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, mt: 6, width: { xs: "100%", md: "50%" } }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Resumen
          </Typography>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between"><Typography>Capital</Typography><Typography>{money(subtotalCapital)}</Typography></Stack>
            <Stack direction="row" justifyContent="space-between"><Typography>Departamento</Typography><Typography>{money(subtotalDepartamento)}</Typography></Stack>
            <Stack direction="row" justifyContent="space-between"><Typography>Tienda</Typography><Typography>{money(subtotalTienda)}</Typography></Stack>
            <Divider />
            <Stack direction="row" justifyContent="space-between">
              <Typography fontWeight={700}>TOTAL</Typography>
              <Typography fontWeight={700}>{money(totalResumen)}</Typography>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
      </Box>
    </Paper>
  );
}
