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
  FormControlLabel,
  Checkbox,
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
import { hasPermission } from "../../auth/permissions";
import { useSystemConfigStore } from "../../config/useSystemConfigStore";
import { UniformaLoader } from "../../components/UniformaLoader";
import { canUseVendedorDropdown, filterUsuariosByBodega } from "../../utils/vendedorDropdownAccess";
import { formatReportScheduleForDay, getReportSchedule, isReportScheduleOpen } from "../../utils/reportSchedule";
import { emptyWhenZero, parseNumberInput } from "../../utils/numberInputs";

interface PagoVenta {
  id?: number | string | null;
  metodo?: string | null;
  referencia?: string | null;
  banco?: string | null;
  ubicacion?: string | null;
  fecha?: string | null;
  monto?: number | null;
  recargo?: number | null;
}

interface DocumentoGenerado {
  id: number;
  tipo: string;
  correlativo: string;
  titulo?: string | null;
  data: any;
  creadoEn: string;
  actualizadoEn: string;
  usuarioId?: number | string | null;
  usuario?: { nombre?: string | null; usuario?: string | null; bodegaId?: number | string | null };
}

interface Usuario {
  id: number;
  nombre: string;
  usuario: string;
  primerNombre?: string | null;
  primerApellido?: string | null;
  usuarioCorrelativo?: string | null;
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
  vendedor?: string | null;
  bodegaId?: number | string | null;
  bodega?: { id?: number | string | null; nombre?: string | null; ubicacion?: string | null } | null;
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
  solicitadoPor?: string | null;
  cliente?: { nombre?: string | null } | null;
  usuarioId?: number | string | null;
  usuario?: { id?: number | string | null; nombre?: string | null; usuario?: string | null } | null;
  bodega?: { nombre?: string | null; ubicacion?: string | null } | null;
  pagos?: PagoVenta[];
}

interface OrdenMixtaReporte {
  id: number;
  folio?: string | null;
  fecha: string;
  total?: number | null;
  envio?: number | null;
  ubicacion?: string | null;
  metodoPago?: string | null;
  referenciaPago?: string | null;
  bancoPago?: string | null;
  clienteNombre?: string | null;
  vendedor?: string | null;
  usuarioId?: number | string | null;
  usuario?: { id?: number | string | null; nombre?: string | null; usuario?: string | null } | null;
  ventaId?: number | string | null;
  pedidoId?: number | string | null;
  venta?: { id?: number | string | null; folio?: string | null; total?: number | null; pagos?: PagoVenta[] } | null;
  pedido?: { id?: number | string | null; folio?: string | null; pagos?: PagoVenta[] } | null;
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

const normalizeText = (value?: string | null) =>
  `${value || ""}`
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");

const getUsuarioDisplayName = (usuario?: Usuario | null) =>
  [usuario?.primerNombre, usuario?.primerApellido].filter(Boolean).join(" ").trim() ||
  `${usuario?.nombre || ""}`.trim() ||
  `${usuario?.usuario || ""}`.trim() ||
  "Usuario";

const getUsuarioMatchValues = (usuario?: Usuario | null) => {
  if (!usuario) return [];
  const nombreParts = `${usuario.nombre || ""}`.trim().split(/\s+/).filter(Boolean);
  return Array.from(
    new Set(
      [
        usuario.usuario,
        usuario.nombre,
        usuario.usuarioCorrelativo,
        [usuario.primerNombre, usuario.primerApellido].filter(Boolean).join(" "),
        nombreParts.length >= 2 ? `${nombreParts[0]} ${nombreParts[1]}` : null,
      ]
        .map((value) => normalizeText(value))
        .filter(Boolean)
    )
  );
};

const textMatchesUsuario = (value: string | null | undefined, usuario: Usuario | null) => {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return getUsuarioMatchValues(usuario).some(
    (userValue) => normalized === userValue || normalized.includes(userValue) || userValue.includes(normalized)
  );
};

const ventaPerteneceAUsuario = (venta: Venta, usuario: Usuario | null) => {
  if (!usuario) return true;
  const userBodegaId = Number(usuario.bodegaId || 0);
  const ventaBodegaId = Number(venta.bodegaId || venta.bodega?.id || 0);
  if (userBodegaId && ventaBodegaId && userBodegaId === ventaBodegaId) return true;
  return textMatchesUsuario(venta.vendedor, usuario);
};

const pedidoPerteneceAUsuario = (pedido: PedidoReporte, usuario: Usuario | null) => {
  if (!usuario) return true;
  if (Number(pedido.usuarioId || pedido.usuario?.id || 0) === Number(usuario.id)) return true;
  return textMatchesUsuario(pedido.solicitadoPor, usuario) || textMatchesUsuario(pedido.usuario?.nombre, usuario) || textMatchesUsuario(pedido.usuario?.usuario, usuario);
};

const ordenMixtaPerteneceAUsuario = (orden: OrdenMixtaReporte, usuario: Usuario | null) => {
  if (!usuario) return true;
  if (Number(orden.usuarioId || orden.usuario?.id || 0) === Number(usuario.id)) return true;
  return textMatchesUsuario(orden.vendedor, usuario) || textMatchesUsuario(orden.usuario?.nombre, usuario) || textMatchesUsuario(orden.usuario?.usuario, usuario);
};

const metodoCuentaComoTarjeta = (metodo?: string | null) => {
  const normalized = normalizarMetodoPago(metodo);
  return normalized === "tarjeta" || normalized === "visalink";
};

const normalizarMetodoPago = (metodo?: string | null) => {
  const normalized = normalizeText(metodo);
  if (!normalized) return "";
  if (normalized.includes("transfer")) return "transferencia";
  if (normalized.includes("deposit")) return "deposito_bancario";
  if (normalized.includes("visa link") || normalized.includes("visalink")) return "visalink";
  if (normalized.includes("tarjeta")) return "tarjeta";
  if (normalized.includes("efectivo")) return "efectivo";
  return normalized.replace(/\s+/g, "_");
};

const normalizeUbicacionVenta = (venta: Venta) => {
  const normalized = `${venta.ubicacion || "TIENDA"}`.trim().toUpperCase();
  if (normalized.includes("CAPITAL")) return "CAPITAL";
  if (normalized.includes("DEPART")) return "DEPARTAMENTO";
  return "TIENDA";
};

const normalizeUbicacionPedido = (pedido: PedidoReporte, pago?: PagoVenta | null) => {
  const raw = `${pago?.ubicacion || pedido.ubicacion || ""}`.trim();
  const fallbackFromBodega = `${pedido.bodega?.ubicacion || pedido.bodega?.nombre || ""}`.trim();
  const normalized = (raw || fallbackFromBodega || "TIENDA").toUpperCase();
  if (normalized.includes("CAPITAL")) return "CAPITAL";
  if (normalized.includes("DEPART")) return "DEPARTAMENTO";
  if (normalized.includes("ANTIGUA")) return "DEPARTAMENTO";
  return "TIENDA";
};

const normalizeUbicacionOrdenMixta = (orden: OrdenMixtaReporte, pago?: PagoVenta | null) => {
  const normalized = `${pago?.ubicacion || orden.ubicacion || "TIENDA"}`.trim().toUpperCase();
  if (normalized.includes("CAPITAL")) return "CAPITAL";
  if (normalized.includes("DEPART")) return "DEPARTAMENTO";
  if (normalized.includes("ANTIGUA")) return "DEPARTAMENTO";
  return "TIENDA";
};

const getVentaMetodo = (venta: Venta) => normalizarMetodoPago(venta.metodoPago);

const getVentaReferencia = (venta: Venta) => `${venta.pagos?.[0]?.referencia || ""}`.trim();

const getVentaBanco = (venta: Venta) => `${venta.pagos?.[0]?.banco || ""}`.trim();

const getVentaRecibo = (venta: Venta) => venta.folio || `V-${venta.id}`;

const getPedidoMetodo = (pedido: PedidoReporte, pago?: PagoVenta | null) => normalizarMetodoPago(pago?.metodo || pedido.metodoPago);

const getPedidoReferencia = (pedido: PedidoReporte, pago?: PagoVenta | null) => `${pago?.referencia || pedido.pagos?.[0]?.referencia || ""}`.trim();

const getPedidoBanco = (pedido: PedidoReporte, pago?: PagoVenta | null) => `${pago?.banco || pedido.pagos?.[0]?.banco || ""}`.trim();

const getPedidoRecibo = (pedido: PedidoReporte) => pedido.folio || `PE-${pedido.id}`;

const getPagoMontoAplicado = (pago?: PagoVenta | null) =>
  Number(pago?.monto || 0) + Number(pago?.recargo || 0);

const getPedidoMontoReporte = (pedido: PedidoReporte, fechaReporte?: string, pago?: PagoVenta | null) => {
  if (pago) return getPagoMontoAplicado(pago);
  const targetFecha = fechaReporte || toDateOnly(pedido.fecha);
  const pagosMismoDia = Array.isArray(pedido.pagos)
    ? pedido.pagos.filter((item) => !item.fecha || toDateOnly(item.fecha) === targetFecha)
    : [];
  const totalPagos = pagosMismoDia.reduce((sum, pago) => sum + getPagoMontoAplicado(pago), 0);
  return totalPagos > 0 ? totalPagos : Number(pedido.anticipo || 0);
};

const getPedidoPagosReporte = (pedido: PedidoReporte, fecha: string): PagoVenta[] => {
  const pagos = Array.isArray(pedido.pagos)
    ? pedido.pagos.filter((pago) => pago.fecha && toDateOnly(pago.fecha) === fecha && getPagoMontoAplicado(pago) > 0)
    : [];
  if (pagos.length) return pagos;
  if (toDateOnly(pedido.fecha) !== fecha || Number(pedido.anticipo || 0) <= 0) return [];
  return [
    {
      id: `anticipo-${pedido.id}`,
      metodo: pedido.metodoPago,
      referencia: pedido.pagos?.[0]?.referencia || null,
      banco: pedido.pagos?.[0]?.banco || null,
      ubicacion: pedido.pagos?.[0]?.ubicacion || pedido.ubicacion || null,
      fecha: pedido.fecha,
      monto: Number(pedido.anticipo || 0),
      recargo: 0,
    },
  ];
};

const getPedidoPagoRowId = (pedido: PedidoReporte, pago?: PagoVenta | null) => {
  const pagoId = `${pago?.id || ""}`.replace(/\D/g, "");
  return -(Number(pedido.id || 0) * 100000 + Number(pagoId || 0));
};

const getOrdenMixtaRecibo = (orden: OrdenMixtaReporte) => orden.folio || `OM-${orden.id}`;

const getOrdenMixtaPagosReporte = (orden: OrdenMixtaReporte, fecha: string): PagoVenta[] => {
  const pagosVenta = Array.isArray(orden.venta?.pagos) ? orden.venta?.pagos || [] : [];
  const pagosPedido = Array.isArray(orden.pedido?.pagos) ? orden.pedido?.pagos || [] : [];
  const pagos = [
    ...pagosVenta,
    ...pagosPedido,
  ].filter((pago) => pago.fecha && toDateOnly(pago.fecha) === fecha && getPagoMontoAplicado(pago) > 0);
  const grouped = new Map<string, PagoVenta>();
  pagos.forEach((pago) => {
    const metodo = normalizarMetodoPago(pago.metodo || orden.metodoPago);
    const referencia = `${pago.referencia || orden.referenciaPago || ""}`.trim();
    const banco = `${pago.banco || orden.bancoPago || ""}`.trim();
    const ubicacion = `${pago.ubicacion || orden.ubicacion || ""}`.trim();
    const key = [metodo, referencia, banco, ubicacion].join("|");
    const current = grouped.get(key);
    grouped.set(key, {
      id: current?.id || `om-${orden.id}-${grouped.size + 1}`,
      metodo,
      referencia,
      banco,
      ubicacion,
      fecha,
      monto: Number(current?.monto || 0) + getPagoMontoAplicado(pago),
      recargo: 0,
    });
  });
  return Array.from(grouped.values());
};

const getOrdenMixtaPagoRowId = (orden: OrdenMixtaReporte, pago?: PagoVenta | null) => {
  const pagoId = `${pago?.id || ""}`.replace(/\D/g, "");
  return -(900000000 + Number(orden.id || 0) * 100000 + Number(pagoId || 0));
};

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

const createCapitalRowFromPedido = (pedido: PedidoReporte, fecha: string, pago?: PagoVenta | null): CapitalRow => {
  const metodo = getPedidoMetodo(pedido, pago);
  const referencia = getPedidoReferencia(pedido, pago);
  const banco = getPedidoBanco(pedido, pago);
  const total = getPedidoMontoReporte(pedido, fecha, pago);
  return {
    id: getPedidoPagoRowId(pedido, pago),
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

const createDepartamentoRowFromPedido = (pedido: PedidoReporte, fecha: string, pago?: PagoVenta | null): DepartamentoRow => {
  const metodo = getPedidoMetodo(pedido, pago);
  const referencia = getPedidoReferencia(pedido, pago);
  const banco = getPedidoBanco(pedido, pago);
  const total = getPedidoMontoReporte(pedido, fecha, pago);
  return {
    id: getPedidoPagoRowId(pedido, pago),
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

const createTiendaRowFromPedido = (pedido: PedidoReporte, fecha: string, pago?: PagoVenta | null): TiendaRow => {
  const metodo = getPedidoMetodo(pedido, pago);
  const referencia = getPedidoReferencia(pedido, pago);
  const banco = getPedidoBanco(pedido, pago);
  const total = getPedidoMontoReporte(pedido, fecha, pago);
  return {
    id: getPedidoPagoRowId(pedido, pago),
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

const createCapitalRowFromOrdenMixta = (orden: OrdenMixtaReporte, fecha: string, pago: PagoVenta): CapitalRow => {
  const metodo = normalizarMetodoPago(pago.metodo || orden.metodoPago);
  const referencia = `${pago.referencia || orden.referenciaPago || ""}`.trim();
  const banco = `${pago.banco || orden.bancoPago || ""}`.trim();
  const total = getPagoMontoAplicado(pago);
  return {
    id: getOrdenMixtaPagoRowId(orden, pago),
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

const createDepartamentoRowFromOrdenMixta = (orden: OrdenMixtaReporte, fecha: string, pago: PagoVenta): DepartamentoRow => {
  const metodo = normalizarMetodoPago(pago.metodo || orden.metodoPago);
  const referencia = `${pago.referencia || orden.referenciaPago || ""}`.trim();
  const banco = `${pago.banco || orden.bancoPago || ""}`.trim();
  const total = getPagoMontoAplicado(pago);
  return {
    id: getOrdenMixtaPagoRowId(orden, pago),
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

const createTiendaRowFromOrdenMixta = (orden: OrdenMixtaReporte, fecha: string, pago: PagoVenta): TiendaRow => {
  const metodo = normalizarMetodoPago(pago.metodo || orden.metodoPago);
  const referencia = `${pago.referencia || orden.referenciaPago || ""}`.trim();
  const banco = `${pago.banco || orden.bancoPago || ""}`.trim();
  const total = getPagoMontoAplicado(pago);
  return {
    id: getOrdenMixtaPagoRowId(orden, pago),
    fecha,
    recibo: getOrdenMixtaRecibo(orden),
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

const nextReporteRowId = (index: number) => Date.now() + index + Math.floor(Math.random() * 100000);

const hydrateCapitalRows = (rows: any[], fecha: string): CapitalRow[] =>
  rows.map((row, index) => ({
    id: Number(row?.id || 0) || nextReporteRowId(index),
    fecha: `${row?.fecha || fecha}`.slice(0, 10),
    envio: `${row?.envio || ""}`,
    transferencia: Number(row?.transferencia || 0),
    autorizacion: `${row?.autorizacion || ""}`,
    deposito: Number(row?.deposito || 0),
    boleta: `${row?.boleta || ""}`,
    banco: `${row?.banco || ""}`,
    efectivo: Number(row?.efectivo || 0),
    observaciones: `${row?.observaciones || ""}`,
  }));

const hydrateDepartamentoRows = (rows: any[], fecha: string): DepartamentoRow[] =>
  rows.map((row, index) => ({
    id: Number(row?.id || 0) || nextReporteRowId(index),
    fecha: `${row?.fecha || fecha}`.slice(0, 10),
    envio: `${row?.envio || ""}`,
    transferencia: Number(row?.transferencia || 0),
    autorizacion: `${row?.autorizacion || ""}`,
    deposito: Number(row?.deposito || 0),
    boleta: `${row?.boleta || ""}`,
    banco: `${row?.banco || ""}`,
    observaciones: `${row?.observaciones || ""}`,
  }));

const hydrateTiendaRows = (rows: any[], fecha: string): TiendaRow[] =>
  rows.map((row, index) => ({
    id: Number(row?.id || 0) || nextReporteRowId(index),
    fecha: `${row?.fecha || fecha}`.slice(0, 10),
    recibo: `${row?.recibo || ""}`,
    transferencia: Number(row?.transferencia || 0),
    autorizacionTransferencia: `${row?.autorizacionTransferencia || ""}`,
    deposito: Number(row?.deposito || 0),
    boleta: `${row?.boleta || ""}`,
    banco: `${row?.banco || ""}`,
    tarjeta: Number(row?.tarjeta || 0),
    autorizacionTarjeta: `${row?.autorizacionTarjeta || ""}`,
    efectivo: Number(row?.efectivo || 0),
    total: Number(row?.total || 0),
    observaciones: `${row?.observaciones || ""}`,
  }));

const getTiendaRowTotal = (row: TiendaRow) =>
  Number(row.total || 0) ||
  Number(row.transferencia || 0) + Number(row.deposito || 0) + Number(row.tarjeta || 0) + Number(row.efectivo || 0);

const getReporteDiarioDocumentoTotal = (doc: DocumentoGenerado) => {
  const tiendaAutoRows = Array.isArray(doc.data?.tiendaAutoRows) ? doc.data.tiendaAutoRows : null;
  const tiendaAutoTotal = tiendaAutoRows
    ? tiendaAutoRows.reduce((sum: number, row: any) => sum + getTiendaRowTotal(row), 0)
    : null;
  const tiendaSnapshotTotal =
    tiendaAutoTotal ??
    (doc.data?.ventasSnapshot || [])
      .filter((venta: Venta) => normalizeUbicacionVenta(venta) === "TIENDA")
      .reduce((sum: number, venta: any) => sum + Number(venta.total || 0), 0) +
      (doc.data?.pedidosSnapshot || []).reduce(
        (sum: number, pedido: PedidoReporte) =>
          sum +
          getPedidoPagosReporte(pedido, doc.data?.fecha || toDateOnly(pedido.fecha))
            .filter((pago) => normalizeUbicacionPedido(pedido, pago) === "TIENDA")
            .reduce((pagoSum, pago) => pagoSum + getPagoMontoAplicado(pago), 0),
        0
      );
  return (
    (doc.data?.capitalRows || []).reduce(
      (sum: number, row: any) => sum + Number(row.transferencia || 0) + Number(row.deposito || 0) + Number(row.efectivo || 0),
      0
    ) +
    (doc.data?.departamentoRows || []).reduce(
      (sum: number, row: any) => sum + Number(row.transferencia || 0) + Number(row.deposito || 0),
      0
    ) +
    tiendaSnapshotTotal +
    (doc.data?.tiendaManualRows || []).reduce((sum: number, row: any) => sum + getTiendaRowTotal(row), 0)
  );
};

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

const reportTableContainerSx = {
  overflowX: "auto",
  width: "100%",
  "& .MuiTable-root": {
    width: "max-content",
    minWidth: "100%",
    tableLayout: "auto",
  },
  "& .MuiTableCell-root": {
    px: 1,
    py: 0.75,
    fontSize: "0.8rem",
    lineHeight: 1.25,
    whiteSpace: "nowrap",
    verticalAlign: "top",
  },
  "& .MuiTableHead-root .MuiTableCell-root": {
    fontSize: "0.84rem",
    fontWeight: 700,
  },
  "& .MuiInputBase-root": {
    minHeight: 36,
  },
  "& .MuiInputBase-input": {
    px: 1,
    py: 0.7,
    fontSize: "0.82rem",
  },
  "& input[type='date']": {
    fontSize: "0.78rem",
  },
  "& .MuiIconButton-root": {
    p: 0.25,
  },
};

export default function ReporteDiario() {
  const today = toDateOnly(new Date());
  const { nombre, primerNombre, primerApellido, usuario, rol, rolId, permisos, id: userId } = useAuthStore();
  const { vendedorDropdownRoleIds, vendedorDropdownBodegaIds, reportesConfig, loaded: configLoaded, fetchConfig } = useSystemConfigStore();
  const { state: routeState } = useLocation();
  const sidebarClickAt = (routeState as any)?.sidebarClickAt;
  const [documentos, setDocumentos] = useState<DocumentoGenerado[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [filtroUsuarioId, setFiltroUsuarioId] = useState<number | null | "">("");
  const [documentoId, setDocumentoId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filtroDesde, setFiltroDesde] = useState(today);
  const [filtroHasta, setFiltroHasta] = useState(today);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [pedidos, setPedidos] = useState<PedidoReporte[]>([]);
  const [ordenesMixtas, setOrdenesMixtas] = useState<OrdenMixtaReporte[]>([]);
  const [fecha, setFecha] = useState(today);
  const [reporteUsuarioId, setReporteUsuarioId] = useState<number | "">(userId ?? "");
  const [omitirCorreoReporte, setOmitirCorreoReporte] = useState(false);
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
  const canGenerateForOtherUser = hasPermission(rol, permisos, "reportes.reporte-diario.generar-ajeno");
  const canUseDropdown = canUseVendedorDropdown(rol, rolId, vendedorDropdownRoleIds, permisos);
  const usuariosDropdown = useMemo(
    () => (isAdmin ? usuarios : filterUsuariosByBodega(usuarios, vendedorDropdownBodegaIds)),
    [isAdmin, usuarios, vendedorDropdownBodegaIds]
  );
  const reporteUsuario = useMemo(
    () => usuarios.find((item) => Number(item.id) === Number(reporteUsuarioId)) || null,
    [usuarios, reporteUsuarioId]
  );

  const cargarSiguienteLiquidacion = useCallback(async (targetUsuarioId?: number | "") => {
    try {
    const params = canGenerateForOtherUser && targetUsuarioId ? { usuarioId: targetUsuarioId } : undefined;
      const resp = await api.get("/correlativos/usuario-operaciones/actual/reporteDiario", { params });
      setLiquidacionNo(resp.data?.correlativo || "Pendiente");
    } catch {
      setLiquidacionNo("Pendiente");
    }
  }, [canGenerateForOtherUser]);

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
      const [respVentas, respPedidos, respOrdenesMixtas] = await Promise.all([
        api.get("/ventas"),
        api.get("/produccion"),
        api.get("/orden-mixta"),
      ]);
      setVentas(respVentas.data || []);
      setPedidos(respPedidos.data || []);
      setOrdenesMixtas(respOrdenesMixtas.data || []);
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
        `Se rellenaron las ventas, pedidos y ordenes mixtas registrados para ${fecha}. Revisa cada seccion antes de imprimir.`,
        "success"
      );
    } catch {
      Swal.fire("Error", "No se pudieron rellenar las ventas, pedidos y ordenes mixtas del reporte diario", "error");
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
    setReporteUsuarioId(userId ?? "");
  }, [canUseDropdown, userId]);

  useEffect(() => {
    if (!showForm || !canGenerateForOtherUser) return;
    void cargarSiguienteLiquidacion(reporteUsuarioId || "");
  }, [showForm, canGenerateForOtherUser, reporteUsuarioId, cargarSiguienteLiquidacion]);

  useEffect(() => {
    void cargarDocumentos();
  }, [cargarDocumentos]);

  useEffect(() => {
    if (sidebarClickAt) {
      setShowForm(false);
      void cargarDocumentos();
    }
  }, [sidebarClickAt, cargarDocumentos]);

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
  const dailyReportSchedule = useMemo(
    () => getReportSchedule(reportesConfig, "reporteDiario"),
    [reportesConfig]
  );

  const nuevoReporte = async () => {
    if (!canGenerateForOtherUser && !isReportScheduleOpen(dailyReportSchedule)) {
      Swal.fire(
        "Horario no habilitado",
        `El boton se habilitara en este horario: ${formatReportScheduleForDay(dailyReportSchedule)}.`,
        "info"
      );
      return;
    }
    setDocumentoId(null);
    const defaultUsuarioId = canGenerateForOtherUser ? Number(reporteUsuarioId || userId || 0) || "" : userId ?? "";
    setReporteUsuarioId(defaultUsuarioId);
    await cargarSiguienteLiquidacion(defaultUsuarioId);
    setVentas([]);
    setPedidos([]);
    setOrdenesMixtas([]);
    setFecha(today);
    setOmitirCorreoReporte(false);
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

  const editarCierreDiario = (doc: DocumentoGenerado) => {
    const data = doc.data || {};
    const docFecha = `${data.fecha || String(doc.creadoEn || "").slice(0, 10) || today}`.slice(0, 10);
    const targetUsuarioId = Number(doc.usuarioId || data.usuarioId || 0) || "";
    const capitalGuardado = Array.isArray(data.capitalRows) ? data.capitalRows : [];
    const departamentoGuardado = Array.isArray(data.departamentoRows) ? data.departamentoRows : [];
    const tiendaGuardado = [
      ...(Array.isArray(data.tiendaAutoRows) ? data.tiendaAutoRows : []),
      ...(Array.isArray(data.tiendaManualRows) ? data.tiendaManualRows : []),
    ];

    setDocumentoId(doc.id);
    setLiquidacionNo(doc.correlativo || "Pendiente");
    setFecha(docFecha);
    setReporteUsuarioId(targetUsuarioId);
    setOmitirCorreoReporte(Boolean(data.omitirCorreoReporte));
    setVentas([]);
    setPedidos([]);
    setOrdenesMixtas([]);
    setCapitalRows(hydrateCapitalRows(capitalGuardado, docFecha).filter(hasCapitalRowData));
    setDepartamentoRows(hydrateDepartamentoRows(departamentoGuardado, docFecha).filter(hasDepartamentoRowData));
    setTiendaManualRows(hydrateTiendaRows(tiendaGuardado, docFecha).filter(hasTiendaRowData));
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

  const ordenesMixtasDelDia = useMemo(
    () =>
      ordenesMixtas.filter((orden) => {
        const pagosDelDia = getOrdenMixtaPagosReporte(orden, fecha);
        if (!pagosDelDia.length) return false;
        if (canGenerateForOtherUser && reporteUsuarioId) return ordenMixtaPerteneceAUsuario(orden, reporteUsuario);
        return true;
      }),
    [ordenesMixtas, fecha, canGenerateForOtherUser, reporteUsuarioId, reporteUsuario]
  );

  const ordenMixtaVentaIds = useMemo(
    () => new Set(ordenesMixtas.map((orden) => Number(orden.ventaId || orden.venta?.id || 0)).filter(Boolean)),
    [ordenesMixtas]
  );

  const ordenMixtaPedidoIds = useMemo(
    () => new Set(ordenesMixtas.map((orden) => Number(orden.pedidoId || orden.pedido?.id || 0)).filter(Boolean)),
    [ordenesMixtas]
  );

  const ventasDelDia = useMemo(
    () =>
      ventas.filter((venta) => {
        if (toDateOnly(venta.fecha) !== fecha) return false;
        if (ordenMixtaVentaIds.has(Number(venta.id))) return false;
        if (canGenerateForOtherUser && reporteUsuarioId) return ventaPerteneceAUsuario(venta, reporteUsuario);
        return true;
      }),
    [ventas, fecha, ordenMixtaVentaIds, canGenerateForOtherUser, reporteUsuarioId, reporteUsuario]
  );

  const pedidosPagosDelDia = useMemo(
    () =>
      pedidos.flatMap((pedido) => {
        if (ordenMixtaPedidoIds.has(Number(pedido.id))) return [];
        if (canGenerateForOtherUser && reporteUsuarioId && !pedidoPerteneceAUsuario(pedido, reporteUsuario)) return [];
        return getPedidoPagosReporte(pedido, fecha).map((pago) => ({ pedido, pago }));
      }),
    [pedidos, fecha, ordenMixtaPedidoIds, canGenerateForOtherUser, reporteUsuarioId, reporteUsuario]
  );

  const pedidosDelDia = useMemo(() => {
    const map = new Map<number, PedidoReporte>();
    pedidosPagosDelDia.forEach(({ pedido }) => map.set(Number(pedido.id), pedido));
    return Array.from(map.values());
  }, [pedidosPagosDelDia]);

  const capitalAutoRows = useMemo<CapitalRow[]>(
    () =>
      [
        ...ventasDelDia
          .filter((venta) => normalizeUbicacionVenta(venta) === "CAPITAL")
          .map((venta) => createCapitalRowFromVenta(venta, fecha)),
        ...pedidosDelDia
          .flatMap((pedido) =>
            getPedidoPagosReporte(pedido, fecha)
              .filter((pago) => normalizeUbicacionPedido(pedido, pago) === "CAPITAL")
              .map((pago) => createCapitalRowFromPedido(pedido, fecha, pago))
          ),
        ...ordenesMixtasDelDia.flatMap((orden) =>
          getOrdenMixtaPagosReporte(orden, fecha)
            .filter((pago) => normalizeUbicacionOrdenMixta(orden, pago) === "CAPITAL")
            .map((pago) => createCapitalRowFromOrdenMixta(orden, fecha, pago))
        ),
      ].map((row) => ({
        ...row,
        envio: capitalAutoEnvios[row.id] || "",
        observaciones: capitalAutoObservaciones[row.id] || "",
      })),
    [ventasDelDia, pedidosDelDia, ordenesMixtasDelDia, fecha, capitalAutoEnvios, capitalAutoObservaciones]
  );

  const departamentoAutoRows = useMemo<DepartamentoRow[]>(
    () =>
      [
        ...ventasDelDia
          .filter((venta) => normalizeUbicacionVenta(venta) === "DEPARTAMENTO")
          .map((venta) => createDepartamentoRowFromVenta(venta, fecha)),
        ...pedidosDelDia
          .flatMap((pedido) =>
            getPedidoPagosReporte(pedido, fecha)
              .filter((pago) => normalizeUbicacionPedido(pedido, pago) === "DEPARTAMENTO")
              .map((pago) => createDepartamentoRowFromPedido(pedido, fecha, pago))
          ),
        ...ordenesMixtasDelDia.flatMap((orden) =>
          getOrdenMixtaPagosReporte(orden, fecha)
            .filter((pago) => normalizeUbicacionOrdenMixta(orden, pago) === "DEPARTAMENTO")
            .map((pago) => createDepartamentoRowFromOrdenMixta(orden, fecha, pago))
        ),
      ].map((row) => ({
        ...row,
        envio: departamentoAutoEnvios[row.id] || "",
        observaciones: departamentoAutoObservaciones[row.id] || "",
      })),
    [ventasDelDia, pedidosDelDia, ordenesMixtasDelDia, fecha, departamentoAutoEnvios, departamentoAutoObservaciones]
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
      .flatMap((pedido) =>
        getPedidoPagosReporte(pedido, fecha)
          .filter((pago) => normalizeUbicacionPedido(pedido, pago) === "TIENDA")
          .map((pago) => createTiendaRowFromPedido(pedido, fecha, pago))
      );
    const ordenMixtaRows = ordenesMixtasDelDia.flatMap((orden) =>
      getOrdenMixtaPagosReporte(orden, fecha)
        .filter((pago) => normalizeUbicacionOrdenMixta(orden, pago) === "TIENDA")
        .map((pago) => createTiendaRowFromOrdenMixta(orden, fecha, pago))
    );
    return [...ventaRows, ...pedidoRows, ...ordenMixtaRows].map((row) => ({
      ...row,
      observaciones: tiendaAutoObservaciones[row.id] || "",
    }));
  }, [ventasDelDia, pedidosDelDia, ordenesMixtasDelDia, fecha, tiendaAutoObservaciones]);

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
    (canGenerateForOtherUser && reporteUsuario ? getUsuarioDisplayName(reporteUsuario) : "") ||
    [primerNombre?.trim(), primerApellido?.trim()].filter(Boolean).join(" ") ||
    nombre?.trim() ||
    usuario?.trim() ||
    "Usuario";

  const getPayload = () => ({
    fecha,
    generadoPor: getGeneradoPor(),
    usuarioId: canGenerateForOtherUser && reporteUsuarioId ? Number(reporteUsuarioId) : userId,
    usuarioNombre: getGeneradoPor(),
    omitirCorreoReporte,
    actualizadoAdministrativamente: Boolean(documentoId),
    actualizadoAdministrativamenteEn: documentoId ? new Date().toISOString() : undefined,
    capitalRows: [...capitalAutoRows, ...capitalRows.filter(hasCapitalRowData)],
    departamentoRows: [...departamentoAutoRows, ...departamentoRows.filter(hasDepartamentoRowData)],
    tiendaAutoRows,
    tiendaManualRows,
    ventasSnapshot: ventasDelDia,
    pedidosSnapshot: pedidosDelDia,
    ordenesMixtasSnapshot: ordenesMixtasDelDia,
  });

  const guardarDocumento = async () => {
    const payload = {
      titulo: `Reporte diario ${fecha}`,
      data: getPayload(),
      omitirCorreo: Boolean(documentoId) || omitirCorreoReporte,
    };
    if (documentoId) {
      const resp = await api.patch(`/documentos/${documentoId}`, payload);
      return resp.data as DocumentoGenerado;
    }
    const resp = await api.post("/documentos", {
      tipo: "reporteDiario",
      usuarioId: canGenerateForOtherUser && reporteUsuarioId ? Number(reporteUsuarioId) : undefined,
      ...payload,
    });
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
    if (canGenerateForOtherUser && !reporteUsuarioId) {
      Swal.fire("Vendedor requerido", "Selecciona el vendedor al que pertenece este cierre diario.", "info");
      return;
    }
    if (Number(totalResumen || 0) <= 0) {
      Swal.fire("Sin datos", "No hay datos con monto para generar el PDF del cierre diario. Usa Rellenar o ingresa datos antes de imprimir.", "info");
      return;
    }
    const confirmar = await Swal.fire({
      icon: "question",
      title: documentoId ? "Actualizar reporte diario" : "Generar reporte diario",
      text: `Se generara el PDF del cierre diario ${fecha} por ${money(totalResumen)}. ¿Deseas continuar?`,
      html: documentoId
        ? `Se actualizara el cierre <strong>${liquidacionNo}</strong> del ${fecha} por <strong>${money(totalResumen)}</strong>.<br/>El quincenal tomara este dato al volver a rellenar.`
        : undefined,
      showCancelButton: true,
      confirmButtonText: documentoId ? "Si, actualizar" : "Si, generar PDF",
      cancelButtonText: "Cancelar",
    });
    if (!confirmar.isConfirmed) return;
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

    await Swal.fire(
      "Listo",
      documentoId
        ? "El cierre diario se actualizo y el PDF corregido se descargo automaticamente."
        : "El PDF del cierre diario se descargo automaticamente.",
      "success"
    );
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
      minWidth: canGenerateForOtherUser ? 230 : 150,
      sortable: false,
      filterable: false,
      align: "right",
      headerAlign: "right",
      renderCell: (params) => (
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          {canGenerateForOtherUser && (
            <Button
              size="small"
              variant="outlined"
              disabled={generandoPdf}
              onClick={() => editarCierreDiario(params.row)}
            >
              Editar
            </Button>
          )}
          <Button
            size="small"
            variant="contained"
            color="secondary"
            disabled={generandoPdf}
            onClick={() => reimprimirDocumento(params.row)}
          >
            Reimprimir
          </Button>
        </Stack>
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
          sx={{ mt: 2, p: 2, borderRadius: 1, bgcolor: "action.hover", border: 1, borderColor: "divider" }}
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
          <Button
            startIcon={<RefreshOutlined />}
            variant="outlined"
            size="small"
            onClick={rellenarDesdeVentas}
            disabled
            title="Rellenado automatico deshabilitado temporalmente"
          >
            Rellenar
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
            {documentoId ? "Actualizar / PDF" : "Imprimir / PDF"}
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {canGenerateForOtherUser && (
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth size="small" disabled={generandoPdf}>
              <InputLabel>Vendedor del cierre</InputLabel>
              <Select
                label="Vendedor del cierre"
                value={reporteUsuarioId}
                onChange={(e) => {
                  const value = e.target.value as number | "";
                  setReporteUsuarioId(value);
                  setDocumentoId(null);
                  setVentas([]);
                  setPedidos([]);
                  setCapitalAutoEnvios({});
                  setDepartamentoAutoEnvios({});
                  setCapitalAutoObservaciones({});
                  setDepartamentoAutoObservaciones({});
                  setTiendaAutoObservaciones({});
                }}
              >
                <MenuItem value="">Selecciona vendedor</MenuItem>
                {usuariosDropdown.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {getUsuarioDisplayName(u)}
                    {u.bodegaId ? ` - Tienda ${u.bodegaId}` : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}
        <Grid size={{ xs: 12, sm: canGenerateForOtherUser ? 4 : 3, md: canGenerateForOtherUser ? 2 : 3 }}>
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
        <Grid size={{ xs: 12, sm: canGenerateForOtherUser ? 4 : 3, md: canGenerateForOtherUser ? 2 : 3 }}>
          <TextField
            label="Liquidación No."
            fullWidth
            size="small"
            value={liquidacionNo}
            disabled
          />
        </Grid>
        {canGenerateForOtherUser && (
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControlLabel
              sx={{ height: "100%", alignItems: "center", m: 0 }}
              control={
                <Checkbox
                  checked={omitirCorreoReporte}
                  disabled={generandoPdf}
                  onChange={(e) => setOmitirCorreoReporte(e.target.checked)}
                />
              }
              label="No enviar correo para este cierre"
            />
          </Grid>
        )}
        <Grid size={{ xs: 12, sm: 6, md: canGenerateForOtherUser ? 12 : 6 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ height: "100%", flexWrap: "wrap" }}>
          <Chip label={`${ventasDelDia.length + pedidosDelDia.length + ordenesMixtasDelDia.length} registros del dia`} />
            <Chip label={`Capital ${money(subtotalCapital)}`} color="primary" variant="outlined" />
            <Chip label={`Departamento ${money(subtotalDepartamento)}`} color="warning" variant="outlined" />
            <Chip label={`Tienda ${money(subtotalTienda)}`} color="success" />
          </Stack>
        </Grid>
      </Grid>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {documentoId
          ? `Editando cierre ${liquidacionNo}. Corrige las lineas necesarias y actualiza el PDF; luego vuelve a rellenar el reporte quincenal.`
          : "Completa los bloques manuales, revisa las ventas y pedidos del dia y luego genera el PDF para guardar el cierre diario."}
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
          <TableContainer sx={reportTableContainerSx}>
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
                          value={emptyWhenZero(row.transferencia)}
                          onChange={(e) => updateCapitalRow(row.id, "transferencia", parseNumberInput(e.target.value))}
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
                          value={emptyWhenZero(row.deposito)}
                          onChange={(e) => updateCapitalRow(row.id, "deposito", parseNumberInput(e.target.value))}
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
                          value={emptyWhenZero(row.efectivo)}
                          onChange={(e) => updateCapitalRow(row.id, "efectivo", parseNumberInput(e.target.value))}
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
          <TableContainer sx={reportTableContainerSx}>
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
                          value={emptyWhenZero(row.transferencia)}
                          onChange={(e) => updateDepartamentoRow(row.id, "transferencia", parseNumberInput(e.target.value))}
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
                          value={emptyWhenZero(row.deposito)}
                          onChange={(e) => updateDepartamentoRow(row.id, "deposito", parseNumberInput(e.target.value))}
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
          <TableContainer sx={reportTableContainerSx}>
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
                        value={emptyWhenZero(row.transferencia)}
                        onChange={(e) => updateTiendaManualRow(row.id, "transferencia", parseNumberInput(e.target.value))}
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
                        value={emptyWhenZero(row.deposito)}
                        onChange={(e) => updateTiendaManualRow(row.id, "deposito", parseNumberInput(e.target.value))}
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
                        value={emptyWhenZero(row.tarjeta)}
                        onChange={(e) => updateTiendaManualRow(row.id, "tarjeta", parseNumberInput(e.target.value))}
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
                        value={emptyWhenZero(row.efectivo)}
                        onChange={(e) => updateTiendaManualRow(row.id, "efectivo", parseNumberInput(e.target.value))}
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
            <Stack
              direction="row"
              justifyContent="space-between"
              sx={{ bgcolor: "action.hover", borderRadius: 1, px: 1.5, py: 1, color: "text.primary" }}
            >
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
