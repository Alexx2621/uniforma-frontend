import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Paper,
  Typography,
  Stack,
  Button,
  Grid,
  Chip,
  Divider,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import PlaylistAddCheckOutlined from "@mui/icons-material/PlaylistAddCheckOutlined";
import DoneAllOutlined from "@mui/icons-material/DoneAllOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import AssignmentReturnOutlined from "@mui/icons-material/AssignmentReturnOutlined";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import { PDF_FONT_FAMILY, PDF_FONT_SEMIBOLD_FAMILY } from "../utils/fontFamily";
import uniformaLogo from "../assets/3-logos.png";

interface Detalle {
  producto: {
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
    tela?: { id?: number | null; nombre?: string | null } | null;
    talla?: { id?: number | null; nombre?: string | null } | null;
    color?: { id?: number | null; nombre?: string | null } | null;
    telaNombre?: string | null;
    tallaNombre?: string | null;
    colorNombre?: string | null;
  };
  productoId: number;
  cantidad: number;
  precioUnit: number;
  bordado?: number;
  estiloEspecial?: boolean;
  estiloEspecialMonto?: number;
  descuento?: number;
  descripcion?: string;
}

interface Pago {
  id: number;
  monto: number;
  recargo?: number;
  metodo: string;
  tipo: string;
  fecha: string;
}

interface Pedido {
  id: number;
  folio?: string | null;
  fecha: string;
  estado: string;
  totalEstimado: number;
  anticipo: number;
  saldoPendiente: number;
  observaciones?: string | null;
  metodoPago?: string | null;
  recargo?: number;
  cliente?: { nombre: string };
  bodega?: { nombre: string };
  bodegaId?: number | null;
  detalle: Detalle[];
  pagos: Pago[];
}

const escapeHtml = (value?: string | number | null) =>
  `${value ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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

const normalizeDetalle = (detalle: any): Detalle => ({
  ...detalle,
  cantidad: Number(detalle?.cantidad || 0),
  precioUnit: Number(detalle?.precioUnit || 0),
  bordado: Number(detalle?.bordado ?? 0),
  estiloEspecial: Boolean(detalle?.estiloEspecial),
  estiloEspecialMonto: Number(detalle?.estiloEspecialMonto ?? 0),
  descuento: Number(detalle?.descuento ?? 0),
});

const normalizePedido = (pedido: any): Pedido => ({
  ...pedido,
  totalEstimado: Number(pedido?.totalEstimado || 0),
  anticipo: Number(pedido?.anticipo || 0),
  saldoPendiente: Number(pedido?.saldoPendiente || 0),
  recargo: Number(pedido?.recargo || 0),
  detalle: Array.isArray(pedido?.detalle) ? pedido.detalle.map(normalizeDetalle) : [],
  pagos: Array.isArray(pedido?.pagos)
    ? pedido.pagos.map((p: any) => ({
        ...p,
        monto: Number(p?.monto || 0),
        recargo: Number(p?.recargo || 0),
      }))
    : [],
});

const getDetalleSubtotal = (detalle: Detalle) => {
  const precio = Number(detalle.precioUnit || 0);
  const bordado = Number(detalle.bordado || 0);
  const estiloEspecialMonto = detalle.estiloEspecial ? Number(detalle.estiloEspecialMonto || 0) : 0;
  const descuento = Number(detalle.descuento || 0);
  const cantidad = Number(detalle.cantidad || 0);
  const baseConEstilo = precio + estiloEspecialMonto;
  const precioConDescuento = baseConEstilo * (1 - descuento / 100);
  return cantidad * (precioConDescuento + bordado);
};

const getPagoAplicado = (pago: Pago) => Number(pago.monto || 0) + Number(pago.recargo || 0);

export default function PedidoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { rol, rolId, bodegaId: userBodegaId } = useAuthStore();
  const { crossStoreRoleIds, fetchConfig } = useSystemConfigStore();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(false);
  const [bodegas, setBodegas] = useState<any[]>([]);
  const [bodegaIngreso, setBodegaIngreso] = useState<number | "">("");
  const [telas, setTelas] = useState<any[]>([]);
  const [tallas, setTallas] = useState<any[]>([]);
  const [colores, setColores] = useState<any[]>([]);
  const canAccessAllBodegas = rol === "ADMIN" || crossStoreRoleIds.includes(Number(rolId));

  const cargar = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [respPedido, respBod, respTelas, respTallas, respColores] = await Promise.all([
        api.get(`/produccion/${id}`),
        api.get("/bodegas"),
        api.get("/telas").catch(() => ({ data: [] })),
        api.get("/tallas").catch(() => ({ data: [] })),
        api.get("/colores").catch(() => ({ data: [] })),
      ]);
      const pedidoNormalizado = normalizePedido(respPedido.data);
      setPedido(pedidoNormalizado);
      setBodegas(respBod.data || []);
      setTelas(respTelas.data || []);
      setTallas(respTallas.data || []);
      setColores(respColores.data || []);
      const pref = userBodegaId && !canAccessAllBodegas ? Number(userBodegaId) : "";
      setBodegaIngreso(pref || pedidoNormalizado?.bodegaId || "");
    } catch {
      Swal.fire("Error", "No se pudo cargar el pedido", "error");
    } finally {
      setLoading(false);
    }
  }, [id, userBodegaId, canAccessAllBodegas]);

  useEffect(() => {
    void fetchConfig();
    void cargar();
  }, [fetchConfig, cargar]);

  const totalPagado = useMemo(
    () => (pedido?.pagos || []).reduce((sum, p) => sum + getPagoAplicado(p), 0),
    [pedido]
  );
  const saldoCalculado = useMemo(
    () => Math.max(0, Number(pedido?.totalEstimado || 0) - totalPagado),
    [pedido?.totalEstimado, totalPagado]
  );

  const esAnulado = `${pedido?.estado || ""}`.trim().toLowerCase() === "anulado";
  const esPendientePago = `${pedido?.estado || ""}`.trim().toLowerCase() === "pendiente_pago";
  const esRegresadoProduccion = `${pedido?.estado || ""}`.trim().toLowerCase() === "regresado_produccion";
  const esRecibido = ["recibido", "completado", "pendiente_pago"].includes(`${pedido?.estado || ""}`.trim().toLowerCase());

  const obtenerTela = (prod?: any) => {
    if (!prod) return "N/D";
    const telaId = prod?.telaId ?? prod?.tela_id ?? prod?.tela?.id ?? prod?.telaid ?? null;
    return prod?.tela?.nombre || prod?.telaNombre || telas.find((t) => Number(t.id) === Number(telaId))?.nombre || "N/D";
  };

  const obtenerTalla = (prod?: any) => {
    if (!prod) return "N/D";
    const tallaId = prod?.tallaId ?? prod?.talla_id ?? prod?.talla?.id ?? prod?.tallaid ?? null;
    return prod?.talla?.nombre || prod?.tallaNombre || tallas.find((t) => Number(t.id) === Number(tallaId))?.nombre || "N/D";
  };

  const obtenerColor = (prod?: any) => {
    if (!prod) return "N/D";
    const colorId = prod?.colorId ?? prod?.color_id ?? prod?.color?.id ?? prod?.colorid ?? null;
    return prod?.color?.nombre || prod?.colorNombre || colores.find((c) => Number(c.id) === Number(colorId))?.nombre || "N/D";
  };

  const terminar = async () => {
    try {
      await api.post(`/produccion/${id}/terminar`, {});
      Swal.fire("Listo", saldoCalculado > 0 ? "Pedido recibido y pendiente de pago" : "Pedido marcado como recibido", "success");
      navigate("/produccion");
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo terminar";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    }
  };

  const regresarPorInconformidad = async () => {
    const result = await Swal.fire({
      title: "Regresar pedido",
      text: "Describe la inconformidad de produccion.",
      input: "textarea",
      inputPlaceholder: "Motivo o detalle de la inconformidad",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Regresar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ed6c02",
    });

    if (!result.isConfirmed) return;

    try {
      await api.post(`/produccion/${id}/regresar`, {
        motivo: `${result.value || ""}`.trim(),
      });
      Swal.fire("Listo", "Pedido regresado por inconformidades de produccion", "success");
      await cargar();
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo regresar el pedido";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    }
  };

  if (!pedido) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography>Cargando...</Typography>
      </Paper>
    );
  }

  const generarPdfReciboPedido = () => {
    const win = window.open("", "_blank");
    if (!win) {
      Swal.fire("Aviso", "Habilita las ventanas emergentes para ver el PDF", "info");
      return;
    }
    const fecha = new Date();
    const subtotal = pedido.detalle.reduce((sum, d: any) => {
      const precio = Number(d.precioUnit || 0);
      const bordado = Number(d.bordado || 0);
      const estiloEspecialMonto = d.estiloEspecial ? Number(d.estiloEspecialMonto || 0) : 0;
      const desc = Number(d.descuento || 0);
      const cantidad = Number(d.cantidad || 0);
      const baseConEstilo = precio + estiloEspecialMonto;
      const precioConDescuento = baseConEstilo * (1 - desc / 100);
      return sum + cantidad * (precioConDescuento + bordado);
    }, 0);
    const recargo = Number((pedido as any).recargo || 0);
    const total = Number((pedido as any).totalEstimado || subtotal + recargo);
    const anticipo = Number((pedido as any).anticipo || 0);
    const logoUrl = uniformaLogo;
    const filasHtml = pedido.detalle
      .map((d, idx) => {
        const desc = Number((d as any).descuento || 0);
        const bordado = Number((d as any).bordado || 0);
        const estiloEspecialMonto = (d as any).estiloEspecial ? Number((d as any).estiloEspecialMonto || 0) : 0;
        const baseConEstilo = Number(d.precioUnit || 0) + estiloEspecialMonto;
        const precioConDescuento = baseConEstilo * (1 - desc / 100);
        const sub = (d.cantidad || 0) * (precioConDescuento + bordado);
        return `<tr>
          <td>${idx + 1}</td>
          <td class="nowrap">${escapeHtml(d.producto?.codigo || d.productoId)}</td>
          <td class="wrap">${escapeHtml(d.producto?.nombre || "Producto")}</td>
          <td class="text-left wrap">${escapeHtml((d as any).descripcion || "")}</td>
          <td class="nowrap">${escapeHtml(d.cantidad)}</td>
          <td class="money">Q ${escapeHtml((d.precioUnit || 0).toFixed(2))}</td>
          <td class="money">Q ${escapeHtml(bordado.toFixed(2))}</td>
          <td class="money">Q ${escapeHtml(estiloEspecialMonto.toFixed(2))}</td>
          <td class="nowrap">${escapeHtml(desc.toFixed(2))}%</td>
          <td class="money">Q ${escapeHtml(sub.toFixed(2))}</td>
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
              <h1 class="pedido-no">RECIBO No.: <span class="value">${escapeHtml(pedido.folio || `P-${pedido.id}`)}</span></h1>
            </div>
            <div class="date">${escapeHtml(fecha.toLocaleDateString("es-GT"))}</div>
          </div>

          <div class="meta-wrap">
            <div class="meta-label">RECIBO DE PEDIDO</div>
            <div class="meta-boxes">
              <div class="meta-primary">${escapeHtml((pedido.bodega?.nombre || "N/D").toUpperCase())}</div>
              <div class="meta-secondary">${escapeHtml(((pedido as any).metodoPago || "efectivo").toUpperCase())}</div>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-card">
              <div class="info-title">CLIENTE</div>
              <div class="info-value">${escapeHtml(pedido.cliente?.nombre || (pedido as any).clienteNombre || "Mostrador")}</div>
            </div>
            ${(pedido as any).clienteTelefono ? `<div class="info-card">
              <div class="info-title">TELEFONO</div>
              <div class="info-value">${escapeHtml((pedido as any).clienteTelefono)}</div>
            </div>` : ""}
            <div class="info-card">
              <div class="info-title">BODEGA</div>
              <div class="info-value">${escapeHtml(pedido.bodega?.nombre || "N/D")}</div>
            </div>
            <div class="info-card">
              <div class="info-title">METODO DE PAGO</div>
              <div class="info-value">${escapeHtml((pedido as any).metodoPago || "efectivo")}</div>
            </div>
            <div class="info-card">
              <div class="info-title">FECHA Y HORA</div>
              <div class="info-value">${escapeHtml(`${fecha.toLocaleDateString("es-GT")} ${fecha.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}`)}</div>
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

          <div class="totals">
            <div class="totals-row"><span>Subtotal</span><span>Q ${escapeHtml(subtotal.toFixed(2))}</span></div>
            ${recargo ? `<div class="totals-row"><span>Recargo</span><span>Q ${escapeHtml(recargo.toFixed(2))}</span></div>` : ""}
            <div class="totals-row"><span>Anticipo</span><span>Q ${escapeHtml(anticipo.toFixed(2))}</span></div>
            <div class="totals-row total"><span>Total</span><span>Q ${escapeHtml(total.toFixed(2))}</span></div>
          </div>
        </div>
        <script>window.onload = function(){ window.print(); }</script>
      </body></html>`;
    win.document.write(html);
    win.document.close();
  };

  const generarPdfPedidoProduccion = () => {
    const win = window.open("", "_blank");
    if (!win) {
      Swal.fire("Aviso", "Habilita las ventanas emergentes para ver el PDF", "info");
      return;
    }
    const fecha = new Date();
    const logoUrl = uniformaLogo;
    const filasHtml = pedido.detalle
      .map((d: any, idx: number) => {
        const prod: any = d.producto || {};
        return `<tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(prod.codigo || d.productoId)}</td>
          <td>${escapeHtml(prod.tipo || "N/D")}</td>
          <td>${escapeHtml(prod.genero || "N/D")}</td>
          <td>${escapeHtml(obtenerTela(prod))}</td>
          <td>${escapeHtml(obtenerColor(prod))}</td>
          <td>${escapeHtml(obtenerTalla(prod))}</td>
          <td>${escapeHtml(d.cantidad)}</td>
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
              <h1 class="pedido-no">PEDIDO No.: <span class="value">${escapeHtml(pedido.folio || `P-${pedido.id}`)}</span></h1>
            </div>
            <div class="date">${escapeHtml(fecha.toLocaleDateString("es-GT"))}</div>
          </div>

          <div class="meta-wrap" style="width:418px;">
            <div class="meta-label">ORDEN DE PRODUCCION</div>
            <div class="meta-boxes" style="grid-template-columns: 1fr 210px;">
              <div class="meta-primary">${escapeHtml((pedido.bodega?.nombre || "N/D").toUpperCase())}</div>
              <div class="meta-secondary">RECIBIDO NOMBRE:</div>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-card">
              <div class="info-title">CLIENTE</div>
              <div class="info-value">${escapeHtml(pedido.cliente?.nombre || (pedido as any).clienteNombre || "Mostrador")}</div>
            </div>
            ${(pedido as any).clienteTelefono ? `<div class="info-card">
              <div class="info-title">TELEFONO</div>
              <div class="info-value">${escapeHtml((pedido as any).clienteTelefono)}</div>
            </div>` : ""}
            <div class="info-card">
              <div class="info-title">BODEGA</div>
              <div class="info-value">${escapeHtml(pedido.bodega?.nombre || "N/D")}</div>
            </div>
            <div class="info-card">
              <div class="info-title">ARTICULOS</div>
              <div class="info-value">${escapeHtml(pedido.detalle.length)}</div>
            </div>
            <div class="info-card">
              <div class="info-title">FECHA Y HORA</div>
              <div class="info-value">${escapeHtml(`${fecha.toLocaleDateString("es-GT")} ${fecha.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}`)}</div>
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
    <Paper sx={{ p: 3, maxWidth: 1200, mx: "auto", width: "100%" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
        <PlaylistAddCheckOutlined color="primary" />
        <Typography variant="h4">{`Pedido ${pedido.folio || `P-${pedido.id}`}`}</Typography>
        <Chip
          label={pedido.estado}
          color={
            esAnulado ? "error" : esRegresadoProduccion ? "warning" : esRecibido ? "success" : "info"
          }
          size="small"
        />
        <Stack direction="row" spacing={1} sx={{ ml: "auto" }}>
          <Button size="small" variant="outlined" startIcon={<PictureAsPdfOutlined />} onClick={generarPdfReciboPedido}>
            PDF Recibo
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="secondary"
            startIcon={<PictureAsPdfOutlined />}
            onClick={generarPdfPedidoProduccion}
          >
            PDF Produccion
          </Button>
        </Stack>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Cliente: {pedido.cliente?.nombre || (pedido as any).clienteNombre || "Mostrador"} | Bodega:{" "}
        {pedido.bodega?.nombre || "N/D"} | Fecha: {pedido.fecha ? new Date(pedido.fecha).toLocaleString() : ""}
      </Typography>
      {esAnulado && (
        <Typography variant="body2" color="error" sx={{ mb: 2, fontWeight: 600 }}>
          Este pedido esta anulado. Solo se permite visualizar la informacion.
        </Typography>
      )}
      {esRegresadoProduccion && (
        <Typography variant="body2" color="warning.main" sx={{ mb: 2, fontWeight: 600 }}>
          Este pedido fue regresado por inconformidades de produccion.
        </Typography>
      )}

      <Divider sx={{ mb: 2 }} />

      <Typography variant="h6" sx={{ mb: 1 }}>
        Detalle
      </Typography>
      <TableContainer sx={{ overflowX: "auto", borderRadius: 1, border: "1px solid #eceff3" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Codigo</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Genero</TableCell>
              <TableCell>Tela</TableCell>
              <TableCell>Talla</TableCell>
              <TableCell>Color</TableCell>
              <TableCell>Cantidad</TableCell>
              <TableCell>Precio</TableCell>
              <TableCell>Bordado</TableCell>
              <TableCell>Estilo especial</TableCell>
              <TableCell>Descuento</TableCell>
              <TableCell>Subtotal</TableCell>
              <TableCell>Observacion</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pedido.detalle.map((d, idx) => (
              <TableRow key={idx}>
                <TableCell>{d.producto?.codigo}</TableCell>
                <TableCell>{d.producto?.tipo || d.producto?.nombre || "N/D"}</TableCell>
                <TableCell>{d.producto?.genero || "N/D"}</TableCell>
                <TableCell>{obtenerTela(d.producto)}</TableCell>
                <TableCell>{obtenerTalla(d.producto)}</TableCell>
                <TableCell>{obtenerColor(d.producto)}</TableCell>
                <TableCell>{d.cantidad}</TableCell>
                <TableCell>{`Q ${Number(d.precioUnit || 0).toFixed(2)}`}</TableCell>
                <TableCell>{`Q ${Number(d.bordado || 0).toFixed(2)}`}</TableCell>
                <TableCell>
                  {d.estiloEspecial ? `Q ${Number(d.estiloEspecialMonto || 0).toFixed(2)}` : "No"}
                </TableCell>
                <TableCell>{`${Number(d.descuento || 0).toFixed(2)}%`}</TableCell>
                <TableCell>{`Q ${getDetalleSubtotal(d).toFixed(2)}`}</TableCell>
                <TableCell>{d.descripcion?.trim() ? d.descripcion : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Divider sx={{ my: 2 }} />

      <Grid container spacing={3} sx={{ mt: 1, alignItems: "stretch" }}>
        <Grid size={{ xs: 12 }} sx={{ minWidth: 0 }}>
          <Paper
            variant="outlined"
            sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column", borderRadius: 2, width: "100%", boxSizing: "border-box" }}
          >
            <Stack spacing={1.5}>
              <Typography variant="h6">Marcar pedido como recibido</Typography>
              <FormControl fullWidth size="small" disabled={esAnulado || esRecibido}>
                <InputLabel>Bodega ingreso</InputLabel>
                <Select
                  label="Bodega ingreso"
                  value={bodegaIngreso === "" ? "" : bodegaIngreso}
                  onChange={(e) => setBodegaIngreso(Number(e.target.value))}
                  disabled={esAnulado || esRecibido || (!!userBodegaId && !canAccessAllBodegas)}
                >
                  {bodegas.map((b) => (
                    <MenuItem key={b.id} value={b.id}>
                      {b.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary">
                Este boton cambiara el estado del pedido a pendiente de pago si aun tiene saldo. No se movera stock al inventario.
              </Typography>
              <Button
                variant="contained"
                color="success"
                startIcon={<DoneAllOutlined />}
                onClick={terminar}
                disabled={esAnulado || esRecibido || loading}
              >
                Marcar como recibido
              </Button>
              {esPendientePago && (
                <Typography variant="caption" color="warning.main">
                  Este pedido ya fue recibido y quedo pendiente de pago.
                </Typography>
              )}
              {esRecibido && !esPendientePago && (
                <Typography variant="caption" color="success.main">
                  Este pedido ya fue marcado como recibido.
                </Typography>
              )}
              {esRecibido && (
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<AssignmentReturnOutlined />}
                  onClick={regresarPorInconformidad}
                  disabled={loading}
                >
                  Regresar por inconformidad
                </Button>
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Paper>
  );
}
