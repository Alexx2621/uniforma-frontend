import { useEffect, useMemo, useState } from "react";
import {
  Paper,
  Typography,
  Grid,
  Button,
  TextField,
  Stack,
  Chip,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../auth/useAuthStore";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import LOGO_URL from "../assets/3-logos.png";
import { buildVentaPdfHtml } from "../utils/ventaPdf";

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
  const [filterCliente, setFilterCliente] = useState("");
  const [filterCodigo, setFilterCodigo] = useState("");
  const [fechaDesde, setFechaDesde] = useState(toDateOnly(new Date().toISOString()));
  const [fechaHasta, setFechaHasta] = useState(toDateOnly(new Date().toISOString()));
  const [cierreFecha, setCierreFecha] = useState(toDateOnly(new Date().toISOString()));
  const { usuario, rol, rolId, bodegaId: userBodegaId } = useAuthStore();
  const { crossStoreRoleIds, fetchConfig } = useSystemConfigStore();
  const navigate = useNavigate();
  const canAccessAllBodegas = rol === "ADMIN" || crossStoreRoleIds.includes(Number(rolId));
  const clienteMap = useMemo(
    () => new Map(clientes.map((c) => [c.id, c.nombre])),
    [clientes]
  );
  const productoMap = useMemo(
    () => new Map(productos.map((p) => [p.id, { codigo: p.codigo, nombre: p.nombre }])),
    [productos]
  );

  useEffect(() => {
    cargarVentas();
    void fetchConfig();
  }, [fetchConfig]);

  const cargarVentas = async () => {
    try {
      const [respVentas, respClientes, respProductos] = await Promise.all([
        api.get("/ventas"),
        api.get("/clientes").catch(() => ({ data: [] })),
        api.get("/productos").catch(() => ({ data: [] })),
      ]);
      const clientesData = respClientes.data || [];
      const localClienteMap = new Map<number, string>(
        clientesData.map((c: any) => [Number(c.id), c.nombre]),
      );
      setClientes(clientesData);
      setProductos(respProductos.data || []);

      const data = (respVentas.data || []).map((v: any, idx: number) => {
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
      setVentas(data);
    } catch (error) {
      Swal.fire("Error", "No se pudo cargar ventas", "error");
    }
  };

  const filtered = useMemo(
    () =>
      ventas.filter((v) => {
        const cliente = (
          v.clienteDisplay ||
          v.clienteNombre ||
          v.cliente?.nombre ||
          ""
        ).toLowerCase();
        const codigo = (v.folio || `V-${v.id || ""}`).toLowerCase();
        const fechaVenta = toDateOnly(v.fecha);
        const dentroRango =
          (!fechaDesde || fechaVenta >= fechaDesde) && (!fechaHasta || fechaVenta <= fechaHasta);
        const bodegaVisible =
          canAccessAllBodegas || !userBodegaId ? true : Number(v.bodegaId) === Number(userBodegaId);
        return (
          dentroRango &&
          bodegaVisible &&
          cliente.includes(filterCliente.toLowerCase()) &&
          codigo.includes(filterCodigo.toLowerCase())
        );
      }),
    [ventas, filterCliente, filterCodigo, fechaDesde, fechaHasta, canAccessAllBodegas, userBodegaId]
  );

  const ventasDelDia = useMemo(
    () =>
      ventas.filter((v) => {
        const mismaFecha = toDateOnly(v.fecha) === cierreFecha;
        const bodegaVisible =
          canAccessAllBodegas || !userBodegaId ? true : Number(v.bodegaId) === Number(userBodegaId);
        return mismaFecha && bodegaVisible;
      }),
    [ventas, cierreFecha, canAccessAllBodegas, userBodegaId]
  );

  const formatter = (v: number) => `Q ${v.toFixed(2)}`;

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
    const detalle = Array.isArray(row.detalle) ? row.detalle : [];
    const subtotal = detalle.reduce((sum: number, d: any) => sum + Number(d.subtotal || 0), 0);
    const total = row.total != null ? Number(row.total) : subtotal + recargo;
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
              <td>${d.descripcion || ""}</td>
              <td>${formatter(Number(d.subtotal || 0))}</td>
            </tr>`,
            )
            .join("")
        : `<tr><td colspan="6" style="text-align:center;color:#6b7280;">Sin detalle</td></tr>`;

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

  const exportCierreVendedor = () => {
    if (!usuario) {
      Swal.fire("Aviso", "No se puede generar cierre sin usuario activo", "warning");
      return;
    }
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
                <td>V-${v.id}</td>
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
                <td colspan="5" style="text-align:right;font-weight:700;">Subtotal</td>
                <td style="font-weight:700;">${formatter(subtotal)}</td>
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
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 12px; color: #0f172a; }
        h2 { margin: 0 0 12px 0; }
        .header { display:flex; justify-content: space-between; align-items:center; border-bottom:2px solid #0b2c52; padding-bottom:10px; margin-bottom:12px; }
        .brand { display:flex; align-items:center; gap:10px; }
        .brand img { height: 48px; }
        .brand .fallback { display:none; font-weight:700; font-size:18px; color:#0b2c52; }
        .meta { font-size:12px; color:#475569; text-align:right; line-height:1.4; }
        .section-title { background: #b30006; color: #fff; padding: 8px 12px; margin: 18px 0 6px 0; font-size: 13px; letter-spacing: 0.5px; border-radius:6px; text-align:center; font-weight:700; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
        th { background: #0b2c52; color: #fff; }
        .resumen th { background: #facc15; color: #111827; }
        .tot td { background: #0b2c52; color: #fff; }
        .info-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:6px 12px; font-size:12px; margin-bottom:12px; }
        .chip { display:inline-flex; padding:4px 10px; border-radius:999px; background:#e2e8f0; font-weight:600; }
      </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">
            <img src="${LOGO_URL}" alt="Uniforma" onerror="this.style.display='none';document.getElementById('logo-fallback-v').style.display='block';" />
            <div id="logo-fallback-v" class="fallback">UNIFORMA</div>
            <div>
              <div style="font-size:18px;font-weight:700;">Uniforma</div>
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
            <tr><td style="font-weight:700;">Total</td><td style="font-weight:700;">${formatter(totalFinal)}</td></tr>
          </tbody>
        </table>
        <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    win.document.close();
  };

  const exportCierreTienda = () => {
    if (!canAccessAllBodegas && !userBodegaId) {
      Swal.fire("Aviso", "Asigna una bodega al usuario para generar el cierre por tienda", "warning");
      return;
    }
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
                <td>V-${v.id}</td>
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
                <td colspan="5" style="text-align:right;font-weight:700;">Subtotal</td>
                <td colspan="2" style="font-weight:700;">${formatter(subtotal)}</td>
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
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 12px; color: #0f172a; }
        h2 { margin: 0 0 12px 0; }
        .header { display:flex; justify-content: space-between; align-items:center; border-bottom:2px solid #0b2c52; padding-bottom:10px; margin-bottom:12px; }
        .brand { display:flex; align-items:center; gap:10px; }
        .brand img { height: 48px; }
        .brand .fallback { display:none; font-weight:700; font-size:18px; color:#0b2c52; }
        .meta { font-size:12px; color:#475569; text-align:right; line-height:1.4; }
        .section-title { background: #b30006; color: #fff; padding: 8px 12px; margin: 18px 0 6px 0; font-size: 13px; letter-spacing: 0.5px; border-radius:6px; text-align:center; font-weight:700; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #0b2c52; color: #fff; }
        .resumen th { background: #facc15; color: #111827; }
        .tot td { background: #0b2c52; color: #fff; }
        .info-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:6px 12px; font-size:12px; margin-bottom:12px; }
      </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">
            <img src="${LOGO_URL}" alt="Uniforma" onerror="this.style.display='none';document.getElementById('logo-fallback-t').style.display='block';" />
            <div id="logo-fallback-t" class="fallback">UNIFORMA</div>
            <div>
              <div style="font-size:18px;font-weight:700;">Uniforma</div>
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
            <tr><td style="font-weight:700;">Total</td><td style="font-weight:700;">${formatter(totalFinal)}</td></tr>
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
      valueFormatter: (value: number) => `Q ${Number(value || 0).toFixed(2)}`,
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
            onClick={exportCierreVendedor}
          >
            Cierre vendedor
          </Button>
          <Button
            variant="outlined"
            startIcon={<PictureAsPdfOutlined />}
            onClick={exportCierreTienda}
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

      <div style={{ height: 620, width: "100%" }}>
        <DataGrid
          rows={filtered}
          columns={columns}
          getRowId={(row) => {
            const idVal = row.id ?? row.ventaId ?? row.venta_id;
            if (idVal && idVal !== 0) return idVal;
            if (row.folio && `${row.folio}`.trim() !== "") return row.folio;
            if (row.displayFolio) return row.displayFolio;
            return `tmp-${Math.random()}`;
          }}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        />
      </div>
    </Paper>
  );
}
