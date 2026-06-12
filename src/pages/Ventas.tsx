import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  Paper,
  Typography,
  Grid,
  Button,
  TextField,
  Stack,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useNavigate } from "react-router-dom";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import LOGO_URL from "../assets/3-logos.png";
import { PDF_FONT_FAMILY, PDF_FONT_SEMIBOLD_FAMILY } from "../utils/fontFamily";
import { buildVentaPdfHtml } from "../utils/ventaPdf";
import TransactionRelationMap, { RelationEdge, RelationNode } from "../components/TransactionRelationMap";
import { formatCurrency } from "../utils/currency";

interface VentaRow {
  id: number;
  fecha: string;
  cliente?: { nombre: string };
  clienteNombre?: string;
  clienteDisplay?: string;
  clienteId?: number | null;
  folio?: string;
  displayFolio?: string;
  productoCodigo?: string;
  total: number;
  metodoPago: string;
  recargo?: number;
  ubicacion?: string | null;
  vendedor?: string | null;
  bodegaId?: number | null;
  bodega?: { id?: number; nombre?: string };
  pagos?: { id?: number; metodo?: string; monto?: number; referencia?: string | null }[];
  referenciaPago?: string | null;
}

const metodoCuentaComoTarjeta = (metodo?: string | null) => {
  const normalized = `${metodo || ""}`.trim().toUpperCase();
  return normalized === "TARJETA" || normalized === "VISALINK";
};

const toDateOnly = (val: string) => {
  const d = new Date(val);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export default function Ventas() {
  const [clientes, setClientes] = useState<{ id: number; nombre: string }[]>([]);
  const [productos, setProductos] = useState<{ id: number; codigo: string; nombre: string }[]>([]);
  const [ventas, setVentas] = useState<VentaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterCliente, setFilterCliente] = useState("");
  const [filterCodigo, setFilterCodigo] = useState("");
  const [fechaDesde, setFechaDesde] = useState(() => toDateOnly(new Date().toISOString()));
  const [fechaHasta, setFechaHasta] = useState(() => toDateOnly(new Date().toISOString()));
  const [cierreFecha, setCierreFecha] = useState(() => toDateOnly(new Date().toISOString()));
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [rowCount, setRowCount] = useState(0);
  const [contextMenuAnchor, setContextMenuAnchor] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const [contextMenuVenta, setContextMenuVenta] = useState<VentaRow | null>(null);
  const [relationModalOpen, setRelationModalOpen] = useState(false);
  const [relationModalTitle, setRelationModalTitle] = useState("Relaciones de venta");
  const [relationModalData, setRelationModalData] = useState<{ nodes: RelationNode[]; edges: RelationEdge[] } | null>(null);
  const { usuario, rol, permisos, bodegaId: userBodegaId } = useAuthStore();
  const { fetchConfig } = useSystemConfigStore();
  const navigate = useNavigate();
  const canAccessAllBodegas = hasPermission(rol, permisos, "sistema.multi-tienda");
  const clienteMap = useMemo(
    () => new Map(clientes.map((c) => [c.id, c.nombre])),
    [clientes]
  );
  const productoMap = useMemo(
    () => new Map(productos.map((p) => [p.id, { codigo: p.codigo, nombre: p.nombre }])),
    [productos]
  );

  const normalizarVentas = (rows: any[], clientesData: any[] = []) => {
    const localClienteMap = new Map<number, string>(
      clientesData.map((c: any) => [Number(c.id), c.nombre]),
    );
    return rows.map((v: any, idx: number) => {
      const rawId =
        v?.id ??
        v?.ventaId ??
        v?.venta_id ??
        v?.folioId ??
        (typeof v?.folio === "number" ? v.folio : undefined) ??
        (typeof v?.folio === "string" ? Number(v.folio.replace(/\D/g, "")) : undefined);
      const numericId = Number(rawId);
      const id = Number.isFinite(numericId) && numericId > 0 ? numericId : idx + 1;
      const folioNormalizado =
        v?.folio && `${v.folio}`.trim() !== ""
          ? `${v.folio}`.startsWith("V-")
            ? `${v.folio}`
            : `V-${v.folio}`
          : `V-${id}`;
      const clienteNombreNormalizado =
        v?.cliente?.nombre ||
        v?.clienteNombre ||
        v?.cliente_name ||
        v?.clienteNombreCompleto ||
        v?.nombreCliente ||
        v?.nombre_cliente ||
        (localClienteMap.get(Number(v?.clienteId ?? v?.cliente_id ?? v?.clienteid)) as
          | string
          | undefined) ||
        (typeof v?.cliente === "string" ? v.cliente : "") ||
        "CF";
      return {
        ...v,
        id,
        clienteId: v?.clienteId ?? v?.cliente_id ?? v?.clienteid ?? null,
        folio: folioNormalizado,
        displayFolio: folioNormalizado,
        clienteNombre: clienteNombreNormalizado,
        clienteDisplay: clienteNombreNormalizado,
        referenciaPago:
          v?.referenciaPago ||
          v?.referencia_pago ||
          v?.pagos?.[0]?.referencia ||
          null,
      };
    });
  };

  useEffect(() => {
    const cargarCatalogos = async () => {
      const [respClientes, respProductos] = await Promise.all([
        api.get("/clientes").catch(() => ({ data: [] })),
        api.get("/productos").catch(() => ({ data: [] })),
      ]);
      setClientes(respClientes.data || []);
      setProductos(respProductos.data || []);
    };
    void cargarCatalogos();
    void fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    void cargarVentas();
  }, [fechaDesde, fechaHasta, filterCliente, filterCodigo, paginationModel.page, paginationModel.pageSize]);

  useEffect(() => {
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, [fechaDesde, fechaHasta, filterCliente, filterCodigo]);

  const cargarVentas = async () => {
    setLoading(true);
    try {
      const respVentas = await api.get("/ventas", {
        params: {
          paginated: 1,
          page: paginationModel.page,
          pageSize: paginationModel.pageSize,
          desde: fechaDesde,
          hasta: fechaHasta,
          cliente: filterCliente || undefined,
          folio: filterCodigo || undefined,
        },
      });
      const payload = respVentas.data || {};
      const rows = Array.isArray(payload) ? payload : payload.data || [];
      setVentas(normalizarVentas(rows, clientes));
      setRowCount(Number(payload.total ?? rows.length));
    } catch (error) {
      Swal.fire("Error", "No se pudo cargar ventas", "error");
    } finally {
      setLoading(false);
    }
  };

  const filtered = ventas;

  const cargarVentasParaCierre = async () => {
    const acumuladas: VentaRow[] = [];
    let page = 0;
    let total = 0;
    const pageSize = 100;
    do {
      const resp = await api.get("/ventas", {
        params: {
          paginated: 1,
          page,
          pageSize,
          desde: cierreFecha,
          hasta: cierreFecha,
        },
      });
      const payload = resp.data || {};
      const rows = Array.isArray(payload) ? payload : payload.data || [];
      acumuladas.push(...normalizarVentas(rows, clientes));
      total = Number(payload.total ?? acumuladas.length);
      page += 1;
    } while (acumuladas.length < total && page < 50);

    return acumuladas.filter((v) => {
      const bodegaVisible =
        canAccessAllBodegas || !userBodegaId ? true : Number(v.bodegaId) === Number(userBodegaId);
      return bodegaVisible;
    });
  };

  const formatter = formatCurrency;

  const getVentaRowId = (row: VentaRow) => {
    const idVal = row.id ?? (row as any).ventaId ?? (row as any).venta_id;
    if (idVal && idVal !== 0) return idVal;
    if (row.folio && `${row.folio}`.trim() !== "") return row.folio;
    if (row.displayFolio) return row.displayFolio;
    return `tmp-${row.fecha}-${row.total}`;
  };

  const handleGridContextMenu = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    const rowElement = target?.closest("[data-id]") as HTMLElement | null;
    const rowId = rowElement?.getAttribute("data-id");
    if (!rowId) return;
    const row = filtered.find((item) => String(getVentaRowId(item)) === rowId);
    if (!row) return;
    event.preventDefault();
    setContextMenuVenta(row);
    setContextMenuAnchor({ mouseX: event.clientX - 2, mouseY: event.clientY - 4 });
  };

  const closeContextMenu = () => {
    setContextMenuAnchor(null);
    setContextMenuVenta(null);
  };

  const openRelationModal = async (row: VentaRow) => {
    try {
      const resp = await api.get(`/relaciones/venta/${row.id}`);
      setRelationModalTitle(`Relaciones de ${row.displayFolio || row.folio || `V-${row.id}`}`);
      setRelationModalData(resp.data || { nodes: [], edges: [] });
      setRelationModalOpen(true);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudieron cargar las relaciones", "error");
    }
  };

  const handleContextMenuAction = (action: "relations" | "open" | "pdf") => {
    if (!contextMenuVenta) {
      closeContextMenu();
      return;
    }
    if (action === "relations") void openRelationModal(contextMenuVenta);
    if (action === "open") verVenta(contextMenuVenta);
    if (action === "pdf") exportVentaPdf(contextMenuVenta);
    closeContextMenu();
  };

  const exportVentaPdf = (row: any) => {
    const win = window.open("", "_blank");
    if (!win) {
      Swal.fire("Aviso", "Habilita ventanas emergentes para ver el PDF", "info");
      return;
    }
    const folio = row.displayFolio || row.folio || `V-${row.id ?? row.ventaId ?? ""}`;
    const fecha = row.fecha ? new Date(row.fecha) : new Date();
    const cliente = obtenerNombreCliente(row);
    const bodega = row.bodega?.nombre || row.bodegaNombre || "N/D";
    const vendedor = row.vendedor || "Vendedor";
    const ubicacion = row.ubicacion || "N/D";
    const metodo = row.metodoPago || "";
    const referenciaPago = row.referenciaPago || row.pagos?.[0]?.referencia || "";
    const recargo = Number(row.recargo || 0);
    const envio = Number(row.envio || 0);
    const detalle = Array.isArray(row.detalle) ? row.detalle : [];
    const subtotal = detalle.reduce((sum: number, d: any) => sum + Number(d.subtotal || 0), 0);
    const total = row.total != null ? Number(row.total) : subtotal + recargo + envio;
    win.document.write(
      buildVentaPdfHtml({
        folio,
        fecha,
        cliente,
        metodoPago: metodo,
        referenciaPago: referenciaPago || "No aplica",
        bodega,
        ubicacion,
        vendedor,
        subtotal,
        recargo,
        envio,
        total,
        recargoEtiqueta: recargo ? "Recargo" : undefined,
        logoUrl: LOGO_URL,
        items: detalle.map((item: any) => {
          const prod = productoMap.get(Number(item.productoId));
          return {
            codigo: prod?.codigo || item.producto?.codigo || `${item.productoId || ""}`,
            nombre: prod?.nombre || item.producto?.nombre || "Producto",
            cantidad: Number(item.cantidad || 0),
            precio: Number(item.precioUnit || 0),
            bordado: Number(item.bordado || 0),
            bordadoColor: item.bordadoColor || null,
            bordadoTamano: item.bordadoTamano || null,
            bordadoPosicion: item.bordadoPosicion || null,
            bordadoObservaciones: item.bordadoObservaciones || null,
            bordadoFechaEntrega: item.bordadoFechaEntrega ? new Date(item.bordadoFechaEntrega).toLocaleDateString("es-GT") : null,
            bordados: Array.isArray(item.bordados)
              ? item.bordados.map((bordado: any) => ({
                  monto: Number(bordado.monto || 0),
                  color: bordado.color || null,
                  tamano: bordado.tamano || null,
                  posicion: bordado.posicion || null,
                  observaciones: bordado.observaciones || null,
                  fechaEntrega: bordado.fechaEntrega ? new Date(bordado.fechaEntrega).toLocaleDateString("es-GT") : null,
                }))
              : [],
            estiloEspecial: Boolean(item.estiloEspecial),
            estiloEspecialMonto: Number(item.estiloEspecialMonto || 0),
            descuento: Number(item.descuento || 0),
            subtotal: Number(item.subtotal || 0),
          };
        }),
      }),
    );
    win.document.close();
  };

  const verVenta = (row: any) => {
    const infoCliente = obtenerNombreCliente(row);
    const folio = row.displayFolio || row.folio || `V-${row.id ?? row.ventaId ?? ""}`;
    const fecha = row.fecha ? new Date(row.fecha).toLocaleString() : "";
    const metodo = row.metodoPago || "";
    const bodega = row.bodega?.nombre || row.bodegaNombre || "";
    const vendedor = row.vendedor || "";
    const referenciaPago = row.referenciaPago || row.pagos?.[0]?.referencia || "";
    const recargo = formatter(Number(row.recargo || 0));
    const total = formatter(Number(row.total || 0));
    const detalleRows =
      Array.isArray(row.detalle) && row.detalle.length > 0
        ? row.detalle
            .map(
              (d: any, idx: number) => `<tr>
              <td>${idx + 1}</td>
              <td>${productoMap.get(Number(d.productoId))?.codigo || d.producto?.codigo || d.productoId || ""}</td>
              <td>${d.cantidad ?? 0}</td>
              <td>${formatter(Number(d.precioUnit || 0))}</td>
              <td>${d.bodegaOrigen?.nombre || d.bodegaNombre || "Bodega venta"}</td>
              <td>${d.requiereTraslado ? d.trasladoEstado || "PENDIENTE" : "No aplica"}</td>
              <td>${d.descripcion || ""}</td>
              <td>${formatter(Number(d.subtotal || 0))}</td>
            </tr>`,
            )
            .join("")
        : `<tr><td colspan="8" style="text-align:center;color:#6b7280;">Sin detalle</td></tr>`;

    Swal.fire({
      title: "Detalle de venta",
      html: `
        <div style="text-align:left;font-size:13px;color:#0f172a;">
          <div style="margin-bottom:12px;">
            <div><strong>Folio:</strong> ${folio}</div>
            <div><strong>Fecha:</strong> ${fecha}</div>
            <div><strong>Cliente:</strong> ${infoCliente}</div>
            <div><strong>Metodo:</strong> ${metodo}</div>
            ${referenciaPago ? `<div><strong>Referencia:</strong> ${referenciaPago}</div>` : ""}
            <div><strong>Ubicacion:</strong> ${row.ubicacion || ""}</div>
            <div><strong>Bodega:</strong> ${bodega}</div>
            <div><strong>Vendedor:</strong> ${vendedor}</div>
            <div><strong>Recargo:</strong> ${recargo}</div>
            <div><strong>Total:</strong> ${total}</div>
          </div>
          <div style="margin-top:10px;font-weight:600;">Detalle</div>
          <table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:12px;">
            <thead>
              <tr>
                <th style="border:1px solid #e5e7eb;padding:6px;text-align:left;">#</th>
                <th style="border:1px solid #e5e7eb;padding:6px;text-align:left;">Producto</th>
                <th style="border:1px solid #e5e7eb;padding:6px;text-align:left;">Cant.</th>
                <th style="border:1px solid #e5e7eb;padding:6px;text-align:left;">Precio</th>
                <th style="border:1px solid #e5e7eb;padding:6px;text-align:left;">Bodega origen</th>
                <th style="border:1px solid #e5e7eb;padding:6px;text-align:left;">Traslado</th>
                <th style="border:1px solid #e5e7eb;padding:6px;text-align:left;">Observacion</th>
                <th style="border:1px solid #e5e7eb;padding:6px;text-align:left;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${detalleRows}
            </tbody>
          </table>
        </div>
      `,
      width: 720,
    });
  };

  const obtenerNombreCliente = (row: any) => {
    const byId = clienteMap.get(Number(row?.clienteId ?? row?.cliente_id ?? row?.clienteid));
    return (
      row?.clienteDisplay ||
      row?.clienteNombre ||
      row?.cliente?.nombre ||
      row?.cliente_name ||
      row?.nombreCliente ||
      row?.nombre_cliente ||
      byId ||
      (typeof row?.cliente === "string" ? row?.cliente : undefined) ||
      "CF"
    );
  };

  const exportCierreVendedor = async () => {
    if (!usuario) {
      Swal.fire("Aviso", "No se puede generar cierre sin usuario activo", "warning");
      return;
    }
    const ventasDelDia = await cargarVentasParaCierre();
    const filtradas = ventasDelDia.filter((v) => {
      const mismoVendedor = (v.vendedor || "").trim() === usuario.trim();
      const mismaBodega = canAccessAllBodegas || !userBodegaId || Number(v.bodegaId) === Number(userBodegaId);
      return mismoVendedor && mismaBodega;
    });
    if (filtradas.length === 0) {
      Swal.fire("Sin datos", "No hay ventas para el cierre de ese dí­a", "info");
      return;
    }
    const ubicaciones = [
      { key: "CAPITAL", title: "CAPITAL / MENSAJERO" },
      { key: "DEPARTAMENTO", title: "DEPARTAMENTOS / CARGO EXPRESO" },
      { key: "TIENDA", title: "TIENDA" },
    ];
    const secciones = ubicaciones
      .map((u) => {
        const filas = filtradas.filter((v) => (v.ubicacion || "").toUpperCase() === u.key);
        const rows = filas
          .map((v) => {
            const metodo = v.metodoPago?.toUpperCase();
            return `<tr>
                <td>${new Date(v.fecha).toLocaleDateString()}</td>
                <td>${v.displayFolio || v.folio || `V-${v.id}`}</td>
                <td>${metodo === "TRANSFERENCIA" ? formatter(v.total) : ""}</td>
                <td>${metodoCuentaComoTarjeta(metodo) ? formatter(v.total) : ""}</td>
                <td>${metodo === "EFECTIVO" ? formatter(v.total) : ""}</td>
                <td>${formatter(v.total)}</td>
              </tr>`;
          })
          .join("");
        const subtotal = filas.reduce((sum, v) => sum + (v.total || 0), 0);
        return `
          <div class="section-title">${u.title}</div>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Folio</th>
                <th>Transferencia</th>
                <th>Tarjeta</th>
                <th>Efectivo</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="6" style="text-align:center;color:#6b7280;">Sin registros</td></tr>`}
              <tr class="tot">
                <td colspan="5" style="text-align:right;font-family:${PDF_FONT_SEMIBOLD_FAMILY};font-weight:600;">Subtotal</td>
                <td style="font-family:${PDF_FONT_SEMIBOLD_FAMILY};font-weight:600;">${formatter(subtotal)}</td>
              </tr>
            </tbody>
          </table>
        `;
      })
      .join("");
    const resumenRows = ubicaciones
      .map((u) => {
        const subtotal = filtradas
          .filter((v) => (v.ubicacion || "").toUpperCase() === u.key)
          .reduce((sum, v) => sum + (v.total || 0), 0);
        return `<tr><td>${u.title}</td><td>${formatter(subtotal)}</td></tr>`;
      })
      .join("");
    const totalFinal = filtradas.reduce((sum, v) => sum + (v.total || 0), 0);

    const win = window.open("", "_blank");
    if (!win) {
      Swal.fire("Aviso", "Habilita ventanas emergentes para exportar", "info");
      return;
    }
    const generacion = new Date();
    win.document.write(`<!doctype html>
      <html><head><meta charset="utf-8" />
      <title>Cierre diario por vendedor</title>
      <style>
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @page { margin: 12px; }
        body { font-family: ${PDF_FONT_FAMILY}; margin: 12px; color: #0f172a; }
        h2 { margin: 0 0 12px 0; }
        .header { display:flex; justify-content: space-between; align-items:center; border-bottom:2px solid #0b2c52; padding-bottom:10px; margin-bottom:12px; }
        .brand { display:flex; align-items:center; gap:10px; }
        .brand img { height: 42px; }
        .brand .fallback { display:none; font-family:${PDF_FONT_SEMIBOLD_FAMILY}; font-weight:600; font-size:18px; color:#0b2c52; }
        .meta { font-size:12px; color:#475569; text-align:right; line-height:1.4; }
        .section-title { background: #b30006; color: #fff; padding: 8px 12px; margin: 18px 0 6px 0; font-size: 13px; letter-spacing: 0.5px; border-radius:6px; text-align:center; font-family:${PDF_FONT_SEMIBOLD_FAMILY}; font-weight:600; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
        th { background: #0b2c52; color: #fff; font-family:${PDF_FONT_SEMIBOLD_FAMILY}; font-weight:600; }
        .resumen th { background: #facc15; color: #111827; }
        .tot td { background: #0b2c52; color: #fff; font-family:${PDF_FONT_SEMIBOLD_FAMILY}; font-weight:600; }
        .info-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:6px 12px; font-size:12px; margin-bottom:12px; }
        .chip { display:inline-flex; padding:4px 10px; border-radius:999px; background:#e2e8f0; font-family:${PDF_FONT_SEMIBOLD_FAMILY}; font-weight:600; }
        .brand-title, strong { font-family:${PDF_FONT_SEMIBOLD_FAMILY}; font-weight:600; }
      </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">
            <img src="${LOGO_URL}" alt="Uniforma" onerror="this.style.display='none';document.getElementById('logo-fallback-v').style.display='block';" />
            <div id="logo-fallback-v" class="fallback">UNIFORMA</div>
            <div>
              <div class="brand-title" style="font-size:18px;">Uniforma</div>
              <div style="font-size:12px;color:#475569;">Cierre diario por vendedor</div>
            </div>
          </div>
          <div class="meta">
            <div><strong>Fecha de corte:</strong> ${cierreFecha}</div>
            <div><strong>Generado:</strong> ${generacion.toLocaleDateString()} ${generacion.toLocaleTimeString()}</div>
            <div><strong>Vendedor:</strong> ${usuario}</div>
          </div>
        </div>
        ${secciones}
        <div class="section-title">RESUMEN</div>
        <table class="resumen">
          <thead><tr><th>Detalle</th><th>Sub-total</th></tr></thead>
          <tbody>
            ${resumenRows}
            <tr><td style="font-family:${PDF_FONT_SEMIBOLD_FAMILY};font-weight:600;">Total</td><td style="font-family:${PDF_FONT_SEMIBOLD_FAMILY};font-weight:600;">${formatter(totalFinal)}</td></tr>
          </tbody>
        </table>
        <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    win.document.close();
  };

  const exportCierreTienda = async () => {
    if (!canAccessAllBodegas && !userBodegaId) {
      Swal.fire("Aviso", "Asigna una bodega al usuario para generar el cierre por tienda", "warning");
      return;
    }
    const ventasDelDia = await cargarVentasParaCierre();
    const filtradas = canAccessAllBodegas
      ? ventasDelDia
      : ventasDelDia.filter((v) => Number(v.bodegaId) === Number(userBodegaId));
    if (filtradas.length === 0) {
      Swal.fire("Sin datos", "No hay ventas para el cierre de ese di­a", "info");
      return;
    }
    const ubicaciones = [
      { key: "CAPITAL", title: "CAPITAL / MENSAJERO" },
      { key: "DEPARTAMENTO", title: "DEPARTAMENTOS / CARGO EXPRESO" },
      { key: "TIENDA", title: "TIENDA" },
    ];
    const secciones = ubicaciones
      .map((u) => {
        const filas = filtradas.filter((v) => (v.ubicacion || "").toUpperCase() === u.key);
        const rows = filas
          .map((v) => {
            const metodo = v.metodoPago?.toUpperCase();
            return `<tr>
                <td>${new Date(v.fecha).toLocaleDateString()}</td>
                <td>${v.displayFolio || v.folio || `V-${v.id}`}</td>
                <td>${metodo === "TRANSFERENCIA" ? formatter(v.total) : ""}</td>
                <td>${metodoCuentaComoTarjeta(metodo) ? formatter(v.total) : ""}</td>
                <td>${metodo === "EFECTIVO" ? formatter(v.total) : ""}</td>
                <td>${formatter(v.total)}</td>
                <td>${v.vendedor || "N/D"}</td>
              </tr>`;
          })
          .join("");
        const subtotal = filas.reduce((sum, v) => sum + (v.total || 0), 0);
        return `
          <div class="section-title">${u.title}</div>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Folio</th>
                <th>Transferencia</th>
                <th>Tarjeta</th>
                <th>Efectivo</th>
                <th>Total</th>
                <th>Vendedor</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="7" style="text-align:center;color:#6b7280;">Sin registros</td></tr>`}
              <tr class="tot">
                <td colspan="5" style="text-align:right;font-family:${PDF_FONT_SEMIBOLD_FAMILY};font-weight:600;">Subtotal</td>
                <td colspan="2" style="font-family:${PDF_FONT_SEMIBOLD_FAMILY};font-weight:600;">${formatter(subtotal)}</td>
              </tr>
            </tbody>
          </table>
        `;
      })
      .join("");
    const resumenRows = ubicaciones
      .map((u) => {
        const subtotal = filtradas
          .filter((v) => (v.ubicacion || "").toUpperCase() === u.key)
          .reduce((sum, v) => sum + (v.total || 0), 0);
        return `<tr><td>${u.title}</td><td>${formatter(subtotal)}</td></tr>`;
      })
      .join("");
    const totalFinal = filtradas.reduce((sum, v) => sum + (v.total || 0), 0);

    const win = window.open("", "_blank");
    if (!win) {
      Swal.fire("Aviso", "Habilita ventanas emergentes para exportar", "info");
      return;
    }
    const generacion = new Date();
    win.document.write(`<!doctype html>
      <html><head><meta charset="utf-8" />
      <title>Cierre diario por tienda</title>
      <style>
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @page { margin: 12px; }
        body { font-family: ${PDF_FONT_FAMILY}; margin: 12px; color: #0f172a; }
        h2 { margin: 0 0 12px 0; }
        .header { display:flex; justify-content: space-between; align-items:center; border-bottom:2px solid #0b2c52; padding-bottom:10px; margin-bottom:12px; }
        .brand { display:flex; align-items:center; gap:10px; }
        .brand img { height: 42px; }
        .brand .fallback { display:none; font-family:${PDF_FONT_SEMIBOLD_FAMILY}; font-weight:600; font-size:18px; color:#0b2c52; }
        .meta { font-size:12px; color:#475569; text-align:right; line-height:1.4; }
        .section-title { background: #b30006; color: #fff; padding: 8px 12px; margin: 18px 0 6px 0; font-size: 13px; letter-spacing: 0.5px; border-radius:6px; text-align:center; font-family:${PDF_FONT_SEMIBOLD_FAMILY}; font-weight:600; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #0b2c52; color: #fff; font-family:${PDF_FONT_SEMIBOLD_FAMILY}; font-weight:600; }
        .resumen th { background: #facc15; color: #111827; }
        .tot td { background: #0b2c52; color: #fff; font-family:${PDF_FONT_SEMIBOLD_FAMILY}; font-weight:600; }
        .info-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:6px 12px; font-size:12px; margin-bottom:12px; }
        .brand-title, strong { font-family:${PDF_FONT_SEMIBOLD_FAMILY}; font-weight:600; }
      </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">
            <img src="${LOGO_URL}" alt="Uniforma" onerror="this.style.display='none';document.getElementById('logo-fallback-t').style.display='block';" />
            <div id="logo-fallback-t" class="fallback">UNIFORMA</div>
            <div>
              <div class="brand-title" style="font-size:18px;">Uniforma</div>
              <div style="font-size:12px;color:#475569;">Cierre diario por tienda</div>
            </div>
          </div>
          <div class="meta">
            <div><strong>Fecha de corte:</strong> ${cierreFecha}</div>
            <div><strong>Generado:</strong> ${generacion.toLocaleDateString()} ${generacion.toLocaleTimeString()}</div>
            <div><strong>Tienda:</strong> ${canAccessAllBodegas ? "Todas las tiendas visibles" : ventasDelDia[0]?.bodega?.nombre || "N/D"}</div>
          </div>
        </div>
        ${secciones}
        <div class="section-title">RESUMEN</div>
        <table class="resumen">
          <thead><tr><th>Detalle</th><th>Sub-total</th></tr></thead>
          <tbody>
            ${resumenRows}
            <tr><td style="font-family:${PDF_FONT_SEMIBOLD_FAMILY};font-weight:600;">Total</td><td style="font-family:${PDF_FONT_SEMIBOLD_FAMILY};font-weight:600;">${formatter(totalFinal)}</td></tr>
          </tbody>
        </table>
        <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    win.document.close();
  };

  const columns: GridColDef[] = [
    {
      field: "folio",
      headerName: "Folio",
      width: 110,
      valueGetter: (params: any) => {
        const row = params?.row || {};
        if (row.displayFolio) return row.displayFolio;
        if (row.folio && `${row.folio}`.trim() !== "") return `${row.folio}`;
        const idVal = row.id ?? row.ventaId ?? row.venta_id ?? params?.id;
        return idVal ? `V-${idVal}` : "";
      },
      renderCell: (params: any) => {
        const row = params?.row || {};
        const idVal = row.id ?? row.ventaId ?? row.venta_id ?? params?.id;
        const folioVal =
          row.displayFolio ||
          (row.folio && `${row.folio}`.trim() !== "" ? `${row.folio}` : undefined) ||
          (idVal ? `V-${idVal}` : "");
        return <span>{folioVal}</span>;
      },
    },
    {
      field: "fecha",
      headerName: "Fecha",
      width: 150,
      valueFormatter: (value: string) =>
        value ? new Date(value).toLocaleDateString() : "",
    },
    {
      field: "clienteDisplay",
      headerName: "Cliente",
      flex: 1.2,
      renderCell: (params: any) => <span>{obtenerNombreCliente(params?.row)}</span>,
    },
    {
      field: "metodoPago",
      headerName: "Método",
      width: 140,
      renderCell: (params) => (
        <Chip label={params.value} size="small" color="primary" variant="outlined" />
      ),
    },
    {
      field: "total",
      headerName: "Total",
      width: 130,
      valueFormatter: (value: number) => formatCurrency(value),
    },
    {
      field: "acciones",
      headerName: "Acciones",
      width: 170,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" onClick={() => verVenta(params?.row)}>
            Ver
          </Button>
          <Button size="small" variant="contained" color="secondary" onClick={() => exportVentaPdf(params?.row)}>
            PDF
          </Button>
        </Stack>
      ),
    },
  ];

  return (
    <Paper sx={{ p: 3, height: "100%" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ReceiptLongIcon color="primary" />
          <Typography variant="h4">Ventas</Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
          <TextField
            label="Fecha cierre"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={cierreFecha}
            onChange={(e) => setCierreFecha(e.target.value)}
            sx={{ minWidth: 180 }}
          />
          <Button
            variant="outlined"
            startIcon={<PictureAsPdfOutlined />}
            onClick={() => void exportCierreVendedor()}
          >
            Cierre vendedor
          </Button>
          <Button
            variant="outlined"
            startIcon={<PictureAsPdfOutlined />}
            onClick={() => void exportCierreTienda()}
          >
            Cierre tienda
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate("/ventas/nueva")}
          >
            Nueva venta
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{xs: 12, sm: 3}}>
          <TextField
            label="Buscar por cliente"
            fullWidth
            size="small"
            value={filterCliente}
            onChange={(e) => setFilterCliente(e.target.value)}
          />
        </Grid>
        <Grid size={{xs: 12, sm: 3}}>
          <TextField
            label="Buscar por folio"
            fullWidth
            size="small"
            value={filterCodigo}
            onChange={(e) => setFilterCodigo(e.target.value)}
          />
        </Grid>
        <Grid size={{xs: 12, sm: 3}}>
          <TextField
            label="Desde"
            type="date"
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
          />
        </Grid>
        <Grid size={{xs: 12, sm: 3}}>
          <TextField
            label="Hasta"
            type="date"
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
          />
        </Grid>
      </Grid>

      <div style={{ height: 620, width: "100%" }} onContextMenu={handleGridContextMenu}>
        <DataGrid
          loading={loading}
          rows={filtered}
          columns={columns}
          getRowId={getVentaRowId}
          pageSizeOptions={[10, 25, 50]}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          rowCount={rowCount}
        />
      </div>

      <Menu
        open={Boolean(contextMenuAnchor)}
        onClose={closeContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenuAnchor ? { top: contextMenuAnchor.mouseY, left: contextMenuAnchor.mouseX } : undefined}
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
          Ver venta
        </MenuItem>
        <MenuItem onClick={() => handleContextMenuAction("pdf")}>
          <ListItemIcon>
            <PictureAsPdfOutlined fontSize="small" />
          </ListItemIcon>
          Generar PDF
        </MenuItem>
      </Menu>

      <TransactionRelationMap
        open={relationModalOpen}
        title={relationModalTitle}
        nodes={relationModalData?.nodes || []}
        edges={relationModalData?.edges || []}
        onClose={() => setRelationModalOpen(false)}
        onCardClick={(node) => {
          if (node.path) navigate(node.path);
        }}
      />
    </Paper>
  );
}
