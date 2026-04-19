import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Paper,
  Typography,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Stack,
  Divider,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import PlaylistAddCheckOutlined from "@mui/icons-material/PlaylistAddCheckOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../auth/useAuthStore";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import uniformaLogo from "../assets/3-logos.png";

interface Cliente {
  id: number;
  nombre: string;
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

interface DetalleRow {
  key: number;
  productoId: number;
  cantidad: number;
  precioUnit: number;
  descuento: number;
  descripcion: string;
}

interface CapturaArticulo {
  productoId: number | "";
  cantidad: number;
  precioUnit: number;
  descuento: number;
  descripcion: string;
}

const detalleInicial: CapturaArticulo = {
  productoId: "",
  cantidad: 1,
  precioUnit: 0,
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

const buildPdfStyles = () => `
  <style>
    @page { size: letter landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page { width: 100%; max-width: 1320px; margin: 0 auto; padding: 8px 10px 10px; }
    .topline { display:grid; grid-template-columns: 132px 1fr 170px; align-items:start; gap: 12px; margin-bottom: 4px; }
    .logo-wrap { display:flex; justify-content:center; }
    .logo { width: 110px; height: 110px; object-fit: contain; }
    .title-block { text-align:center; padding-top: 6px; }
    .pedido-no { margin: 0; font-size: 30px; font-weight: 800; color: #0f3274; letter-spacing: 0.4px; }
    .pedido-no .value { color: #d60000; }
    .date { text-align:right; font-size: 18px; font-weight: 800; padding-top: 8px; }
    .meta-wrap { margin: 2px auto 16px; width: 560px; }
    .meta-label { text-align:center; font-size: 18px; font-weight: 800; color: #e10600; margin-bottom: 2px; }
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
      font-weight: 800;
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
      font-weight: 800;
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
      font-weight: 700;
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
    thead th {
      background:#0f3274;
      color:#fff;
      text-align:center;
      border:1px solid #0f3274;
      padding:8px 6px;
      font-size:15px;
      font-weight:800;
    }
    tbody td {
      border:1px solid #1f1f1f;
      padding:8px 8px;
      font-size:14px;
      text-align:center;
      height:48px;
      vertical-align:middle;
      word-wrap:break-word;
    }
    tbody td.text-left { text-align:left; }
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
      font-weight:800;
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
  const [telas, setTelas] = useState<any[]>([]);
  const [tallas, setTallas] = useState<any[]>([]);
  const [colores, setColores] = useState<any[]>([]);
  const [clienteId, setClienteId] = useState<number | "">("");
  const [bodegaId, setBodegaId] = useState<number | "">("");
  const [metodoPago, setMetodoPago] = useState<string>("efectivo");
  const [porcentajeRecargo, setPorcentajeRecargo] = useState<number>(0);
  const [anticipo, setAnticipo] = useState<number>(0);
  const [observaciones, setObservaciones] = useState("");
  const [detalle, setDetalle] = useState<DetalleRow[]>([]);
  const [articuloActual, setArticuloActual] = useState<CapturaArticulo>(detalleInicial);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroGenero, setFiltroGenero] = useState("");
  const [filtroTela, setFiltroTela] = useState("");
  const [filtroTalla, setFiltroTalla] = useState("");
  const [filtroColor, setFiltroColor] = useState("");
  const [ocultarCamposCabecera, setOcultarCamposCabecera] = useState(false);
  const [cantidadAdvertida, setCantidadAdvertida] = useState<number | null>(null);

  const { rol, bodegaId: userBodegaId } = useAuthStore();
  const { productionInternalMode, fetchConfig } = useSystemConfigStore();
  const navigate = useNavigate();

  const cargarCatalogos = async () => {
    try {
      const [respCli, respProd, respBod, respTelas, respTallas, respColores] = await Promise.all([
        api.get("/clientes"),
        api.get("/productos"),
        api.get("/bodegas"),
        api.get("/telas").catch(() => ({ data: [] })),
        api.get("/tallas").catch(() => ({ data: [] })),
        api.get("/colores").catch(() => ({ data: [] })),
      ]);
      setClientes(respCli.data || []);
      setProductos(respProd.data || []);
      setBodegas(respBod.data || []);
      setTelas(respTelas.data || []);
      setTallas(respTallas.data || []);
      setColores(respColores.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar catalogos", "error");
    }
  };

  useEffect(() => {
    cargarCatalogos();
    void fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (userBodegaId && rol !== "ADMIN") {
      const parsed = Number(userBodegaId);
      const exists = bodegas.some((b) => b.id === parsed);
      setBodegaId(exists ? parsed : "");
    }
  }, [userBodegaId, rol, bodegas]);

  const totals = useMemo(() => {
    const subtotal = detalle.reduce((sum, d) => {
      const precio = Number(d.precioUnit) || 0;
      const desc = Number(d.descuento) || 0;
      const cantidad = Number(d.cantidad) || 0;
      const precioDesc = precio * (1 - desc / 100);
      return sum + cantidad * precioDesc;
    }, 0);
    const recargo = metodoPago === "tarjeta" ? subtotal * ((porcentajeRecargo || 0) / 100) : 0;
    const total = subtotal + recargo;
    const saldoPendiente = total - (Number(anticipo) || 0);
    return { subtotal, recargo, total, saldoPendiente };
  }, [detalle, anticipo, metodoPago, porcentajeRecargo]);

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
        precioUnit: productoDetectado.precio ?? 0,
      };
    });
  }, [productoDetectado]);

  const limpiarArticulo = () => {
    setArticuloActual(detalleInicial);
    setCantidadAdvertida(null);
    setFiltroTipo("");
    setFiltroGenero("");
    setFiltroTela("");
    setFiltroTalla("");
    setFiltroColor("");
  };

  const agregarArticulo = () => {
    if (!articuloActual.productoId) {
      Swal.fire("Validacion", "Selecciona un producto", "warning");
      return;
    }
    const cantidad = Number(articuloActual.cantidad) || 0;

    if (cantidad <= 0) {
      Swal.fire("Validacion", "Ingresa una cantidad mayor a 0", "warning");
      return;
    }

    const row: DetalleRow = {
      key: Date.now(),
      productoId: Number(articuloActual.productoId),
      cantidad,
      precioUnit: Number(articuloActual.precioUnit) || 0,
      descuento: Number(articuloActual.descuento) || 0,
      descripcion: articuloActual.descripcion || "",
    };

    setDetalle((prev) => [...prev, row]);

    limpiarArticulo();
  };

  const handleCantidadBlur = () => {
    const cantidad = Number(articuloActual.cantidad) || 0;

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

  const guardar = async () => {
    if (!bodegaId) {
      Swal.fire("Validacion", "Selecciona una bodega", "warning");
      return;
    }
    if (!productionInternalMode && (Number(anticipo) || 0) <= 0) {
      Swal.fire("Validacion", "Ingresa un anticipo mayor a 0", "warning");
      return;
    }
    if (!detalle.length) {
      Swal.fire("Validacion", "Agrega al menos un producto", "warning");
      return;
    }
    if (!productionInternalMode && (Number(anticipo) || 0) > totals.total) {
      Swal.fire("Validacion", "El anticipo no puede ser mayor al total del pedido", "warning");
      return;
    }

    const payload = {
      clienteId: productionInternalMode ? null : clienteId === "" ? null : Number(clienteId),
      bodegaId: Number(bodegaId),
      observaciones,
      solicitadoPor: "vendedor",
      totalEstimado: totals.total,
      anticipo: productionInternalMode ? 0 : Number(anticipo) || 0,
      metodoPago: productionInternalMode ? "interno" : metodoPago,
      porcentajeRecargo: productionInternalMode ? 0 : porcentajeRecargo,
      detalle: detalle.map((d) => ({
        productoId: d.productoId,
        cantidad: d.cantidad,
        precioUnit: d.precioUnit,
        descuento: d.descuento,
        descripcion: d.descripcion,
      })),
    };

    try {
      const resp = await api.post("/produccion", payload);
      Swal.fire("Guardado", "Pedido creado", "success");
      generarPdfPedido(resp.data?.id || "PEND");
      generarPdfPedidoProduccion(resp.data?.id || "PEND");
      navigate("/produccion");
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo guardar";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    }
  };

  const generarPdfPedido = (id: number | string) => {
    const win = window.open("", "_blank");
    if (!win) {
      Swal.fire("Aviso", "Habilita las ventanas emergentes para ver el PDF", "info");
      return;
    }
    const fecha = new Date();
    const clienteNombre = productionInternalMode
      ? "Interno"
      : clientes.find((c) => c.id === (clienteId === "" ? null : Number(clienteId)))?.nombre || "Mostrador";
    const bodegaNombre = bodegas.find((b) => b.id === Number(bodegaId))?.nombre || "N/D";
    const logoUrl = uniformaLogo;
    const filasHtml = detalle
      .map((d, idx) => {
        const prod = productos.find((p) => p.id === d.productoId);
        const precioDesc = (d.precioUnit || 0) * (1 - (d.descuento || 0) / 100);
        const subtotal = (d.cantidad || 0) * precioDesc;
        return `<tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(prod?.codigo || d.productoId)}</td>
          <td>${escapeHtml(prod?.nombre || "Producto")}</td>
          <td class="text-left">${escapeHtml(d.descripcion || "")}</td>
          <td>${escapeHtml(d.cantidad)}</td>
          <td>Q ${escapeHtml((d.precioUnit || 0).toFixed(2))}</td>
          <td>${escapeHtml((d.descuento || 0).toFixed(2))}%</td>
          <td>Q ${escapeHtml(subtotal.toFixed(2))}</td>
        </tr>`;
      })
      .join("");

    const html = `<!doctype html>
      <html><head><meta charset="utf-8" />
      <title>Pedido de produccion</title>
      ${buildPdfStyles()}
      </head>
      <body>
        <div class="page">
          <div class="topline">
            <div class="logo-wrap">
              <img class="logo" src="${logoUrl}" alt="Uniforma" />
            </div>
            <div class="title-block">
              <h1 class="pedido-no">PEDIDO No.: <span class="value">${escapeHtml(`P-${id}`)}</span></h1>
            </div>
            <div class="date">${escapeHtml(fecha.toLocaleDateString("es-GT"))}</div>
          </div>

          <div class="meta-wrap">
            <div class="meta-label">PEDIDO DE PRODUCCION</div>
            <div class="meta-boxes">
              <div class="meta-primary">${escapeHtml(bodegaNombre.toUpperCase())}</div>
              <div class="meta-secondary">${escapeHtml((productionInternalMode ? "INTERNO" : metodoPago).toUpperCase())}</div>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-card">
              <div class="info-title">CLIENTE</div>
              <div class="info-value">${escapeHtml(clienteNombre)}</div>
            </div>
            <div class="info-card">
              <div class="info-title">BODEGA</div>
              <div class="info-value">${escapeHtml(bodegaNombre)}</div>
            </div>
            <div class="info-card">
              <div class="info-title">METODO DE PAGO</div>
              <div class="info-value">${escapeHtml(productionInternalMode ? "Interno" : metodoPago)}</div>
            </div>
            <div class="info-card">
              <div class="info-title">FECHA Y HORA</div>
              <div class="info-value">${escapeHtml(
                `${fecha.toLocaleDateString("es-GT")} ${fecha.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}`
              )}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr><th style="width:52px;">#</th><th style="width:120px;">CODIGO</th><th style="width:280px;">PRODUCTO</th><th>DETALLE</th><th style="width:80px;">CANT.</th><th style="width:110px;">PRECIO</th><th style="width:95px;">DESC.</th><th style="width:120px;">SUBTOTAL</th></tr>
            </thead>
            <tbody>${filasHtml}</tbody>
          </table>

          <div class="totals">
            <div class="totals-row"><span>Subtotal</span><span>Q ${escapeHtml(totals.subtotal.toFixed(2))}</span></div>
            ${!productionInternalMode && metodoPago === "tarjeta"
              ? `<div class="totals-row"><span>Recargo (${porcentajeRecargo || 0}%)</span><span>Q ${totals.recargo.toFixed(2)}</span></div>`
              : ""
            }
            <div class="totals-row"><span>Anticipo</span><span>Q ${escapeHtml(
              (productionInternalMode ? 0 : Number(anticipo) || 0).toFixed(2)
            )}</span></div>
            <div class="totals-row total"><span>Total</span><span>Q ${escapeHtml(totals.total.toFixed(2))}</span></div>
          </div>

          <div class="footer-note">Observaciones generales: ${escapeHtml(observaciones || "Sin observaciones")}</div>
        </div>
        <script>window.onload = function(){ window.print(); }</script>
      </body></html>`;
    win.document.write(html);
    win.document.close();
  };

  const generarPdfPedidoProduccion = (id: number | string) => {
    const win = window.open("", "_blank");
    if (!win) {
      Swal.fire("Aviso", "Habilita las ventanas emergentes para ver el PDF", "info");
      return;
    }
    const fecha = new Date();
    const clienteNombre = productionInternalMode
      ? "Interno"
      : clientes.find((c) => c.id === (clienteId === "" ? null : Number(clienteId)))?.nombre || "Mostrador";
    const bodegaNombre = bodegas.find((b) => b.id === Number(bodegaId))?.nombre || "N/D";
    const logoUrl = uniformaLogo;
    const filasHtml = detalle
      .map((d, idx) => {
        const prod = productos.find((p) => p.id === d.productoId);
        return `<tr>
          <td>${escapeHtml(d.cantidad)}</td>
          <td>${escapeHtml(prod?.tipo || "N/D")}</td>
          <td>${escapeHtml(obtenerTela(prod))}</td>
          <td>${escapeHtml(obtenerColor(prod))}</td>
          <td>${escapeHtml(obtenerTalla(prod))}</td>
          <td>${escapeHtml(prod?.genero || "N/D")}</td>
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
              <h1 class="pedido-no">PEDIDO No.: <span class="value">${escapeHtml(`P-${id}`)}</span></h1>
            </div>
            <div class="date">${escapeHtml(fecha.toLocaleDateString("es-GT"))}</div>
          </div>

          <div class="meta-wrap" style="width:418px;">
            <div class="meta-label">VENDEDOR</div>
            <div class="meta-boxes" style="grid-template-columns: 1fr 210px;">
              <div class="meta-primary">${escapeHtml(bodegaNombre.toUpperCase())}</div>
              <div class="meta-secondary">RECIBIDO NOMBRE:</div>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-card">
              <div class="info-title">CLIENTE</div>
              <div class="info-value">${escapeHtml(clienteNombre)}</div>
            </div>
            <div class="info-card">
              <div class="info-title">BODEGA</div>
              <div class="info-value">${escapeHtml(bodegaNombre)}</div>
            </div>
            <div class="info-card">
              <div class="info-title">ARTICULOS</div>
              <div class="info-value">${escapeHtml(detalle.length)}</div>
            </div>
            <div class="info-card">
              <div class="info-title">FECHA Y HORA</div>
              <div class="info-value">${escapeHtml(
                `${fecha.toLocaleDateString("es-GT")} ${fecha.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}`
              )}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr><th style="width:78px;">CANT</th><th style="width:220px;">PEDIDO</th><th style="width:104px;">TELA</th><th style="width:104px;">COLOR</th><th style="width:106px;">TALLA</th><th style="width:104px;">SEXO</th><th>OBSERVACIONES</th></tr>
            </thead>
            <tbody>${filasHtml}</tbody>
          </table>

          <div class="footer-note">Observaciones generales: ${escapeHtml(observaciones || "Sin observaciones")}</div>
        </div>
        <script>window.onload = function(){ window.print(); }</script>
      </body></html>`;
    win.document.write(html);
    win.document.close();
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PlaylistAddCheckOutlined color="primary" />
          <Typography variant="h4">NUEVO PEDIDO</Typography>
        </Stack>
        <Button variant="outlined" onClick={() => setOcultarCamposCabecera((prev) => !prev)}>
          {ocultarCamposCabecera ? "Mostrar datos" : "Ocultar datos"}
        </Button>
      </Stack>
      <Divider sx={{ mb: 2 }} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: ocultarCamposCabecera ? 12 : 4 }}>
          <FormControl fullWidth>
            <InputLabel>Bodega</InputLabel>
            <Select
              label="Bodega"
              value={bodegaId === "" ? "" : bodegaId}
              onChange={(e) => setBodegaId(Number(e.target.value))}
              disabled={!!userBodegaId && rol !== "ADMIN"}
            >
              {bodegas.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        {!ocultarCamposCabecera && (
          <Grid size={{ xs: 12, sm: 4 }}>
            {productionInternalMode ? (
              <TextField
                label="Cliente"
                fullWidth
                disabled
                value="Interno"
                helperText="Deshabilitado en modo interno de produccion"
              />
            ) : (
              <Autocomplete
                options={clientes}
                getOptionLabel={(option) => option.nombre}
                value={clientes.find((c) => c.id === clienteId) || null}
                onChange={(_, val) => setClienteId(val ? val.id : "")}
                renderInput={(params) => <TextField {...params} label="Cliente" fullWidth />}
              />
            )}
          </Grid>
        )}
        {!ocultarCamposCabecera && (
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Anticipo"
              type="number"
              fullWidth
              disabled={productionInternalMode}
              value={productionInternalMode ? 0 : anticipo}
              onChange={(e) => setAnticipo(Number(e.target.value))}
              helperText={productionInternalMode ? "Deshabilitado en modo interno de produccion" : undefined}
            />
          </Grid>
        )}
        {!ocultarCamposCabecera && (
          <Grid size={{ xs: 12, sm: 4 }}>
            {productionInternalMode ? (
              <TextField
                label="Metodo de pago anticipo"
                fullWidth
                disabled
                value="Interno"
                helperText="Deshabilitado en modo interno de produccion"
              />
            ) : (
              <FormControl fullWidth>
                <InputLabel>Metodo de pago anticipo</InputLabel>
                <Select label="Metodo de pago anticipo" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                  <MenuItem value="efectivo">Efectivo</MenuItem>
                  <MenuItem value="tarjeta">Tarjeta</MenuItem>
                  <MenuItem value="transferencia">Transferencia</MenuItem>
                </Select>
              </FormControl>
            )}
          </Grid>
        )}
        {!ocultarCamposCabecera && !productionInternalMode && (
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Recargo % tarjeta"
              type="number"
              fullWidth
              disabled={metodoPago !== "tarjeta"}
              value={porcentajeRecargo}
              onChange={(e) => setPorcentajeRecargo(Number(e.target.value))}
              helperText={metodoPago !== "tarjeta" ? "Disponible solo para pagos con tarjeta" : undefined}
            />
          </Grid>
        )}
        {!ocultarCamposCabecera && (
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Observaciones"
              fullWidth
              multiline
              rows={2}
              value={observaciones}
              disabled={productionInternalMode}
              onChange={(e) => setObservaciones(e.target.value)}
              helperText={productionInternalMode ? "Deshabilitado en modo interno de produccion" : undefined}
            />
          </Grid>
        )}
      </Grid>

      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" sx={{ mb: 2 }}>
        Agregar articulo
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
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
              type="number"
              fullWidth
              value={articuloActual.cantidad}
              onChange={(e) => {
                const cantidad = Number(e.target.value) || 0;
                setCantidadAdvertida((prev) => (prev !== null && prev !== cantidad ? null : prev));
                setArticuloActual((prev) => ({ ...prev, cantidad }));
              }}
              onBlur={handleCantidadBlur}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
            <TextField
              label="Precio"
              type="number"
              fullWidth
              value={articuloActual.precioUnit}
              disabled={productionInternalMode}
              InputProps={{ readOnly: true }}
              helperText={productionInternalMode ? "Deshabilitado en modo interno de produccion" : undefined}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
            <TextField
              label="Descuento %"
              type="number"
              fullWidth
              value={articuloActual.descuento}
              disabled={productionInternalMode}
              onChange={(e) =>
                setArticuloActual((prev) => ({ ...prev, descuento: Number(e.target.value) || 0 }))
              }
              helperText={productionInternalMode ? "Deshabilitado en modo interno de produccion" : undefined}
            />
          </Grid>
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
            Agregar al pedido
          </Button>
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
              <TableCell align="center" sx={{ fontWeight: 700 }}>Tela</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Talla</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Color</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Cantidad</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Observacion</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {detalle.map((row) => {
              const producto = productos.find((p) => p.id === row.productoId);
              return (
                <TableRow key={row.key}>
                  <TableCell align="center">{producto?.codigo || row.productoId}</TableCell>
                  <TableCell align="center">{producto?.tipo || producto?.nombre || "Producto"}</TableCell>
                  <TableCell align="center">{obtenerTela(producto)}</TableCell>
                  <TableCell align="center">{obtenerTalla(producto)}</TableCell>
                  <TableCell align="center">{obtenerColor(producto)}</TableCell>
                  <TableCell align="center">{row.cantidad}</TableCell>
                  <TableCell align="center">{row.descripcion || "-"}</TableCell>
                </TableRow>
              );
            })}
            {!detalle.length && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  Aun no has agregado articulos al pedido.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {!productionInternalMode && (
        <>
          <Divider sx={{ my: 2 }} />

          <Grid container spacing={2} justifyContent="flex-end">
            <Grid size={{ xs: 12, sm: 4 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography>Subtotal</Typography>
                    <Typography>{`Q ${totals.subtotal.toFixed(2)}`}</Typography>
                  </Stack>
                  {metodoPago === "tarjeta" && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography>Recargo</Typography>
                      <Typography>{`Q ${totals.recargo.toFixed(2)}`}</Typography>
                    </Stack>
                  )}
                  <Stack direction="row" justifyContent="space-between">
                    <Typography>Anticipo</Typography>
                    <Typography>{`Q ${(Number(anticipo) || 0).toFixed(2)}`}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography fontWeight={700}>Saldo estimado</Typography>
                    <Typography fontWeight={700}>{`Q ${totals.saldoPendiente.toFixed(2)}`}</Typography>
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
            backgroundColor: "#0b1f4d",
            color: "#fff",
            fontWeight: 700,
            "&:hover": {
              backgroundColor: "#081633",
            },
          }}
        >
          Guardar pedido
        </Button>
      </Stack>
    </Paper>
  );
}
