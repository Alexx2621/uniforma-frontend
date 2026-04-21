import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Paper,
  Typography,
  Grid,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Stack,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditOutlined from "@mui/icons-material/EditOutlined";
import PaymentIcon from "@mui/icons-material/Payment";
import Autocomplete from "@mui/material/Autocomplete";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../auth/useAuthStore";
import { useSystemConfigStore } from "../config/useSystemConfigStore";

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
  ubicacion?: string | null;
}

interface DetalleRow {
  key: number;
  productoId: number;
  cantidad: number;
  precio: number;
  bordado: number;
  descuento: number;
  descripcion: string;
  stock: number | null;
}

interface CapturaArticulo {
  productoId: number | "";
  cantidad: number;
  precio: number;
  bordado: number;
  descuento: number;
  descripcion: string;
  stock: number | null;
}

const detalleInicial: CapturaArticulo = {
  productoId: "",
  cantidad: 1,
  precio: 0,
  bordado: 0,
  descuento: 0,
  descripcion: "",
  stock: null,
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

export default function VentaNueva() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [telas, setTelas] = useState<any[]>([]);
  const [tallas, setTallas] = useState<any[]>([]);
  const [colores, setColores] = useState<any[]>([]);
  const [clienteId, setClienteId] = useState<number | "">("");
  const [bodegaId, setBodegaId] = useState<number | "">("");
  const [metodoPago, setMetodoPago] = useState<string>("efectivo");
  const [ubicacion, setUbicacion] = useState<string>("TIENDA");
  const [porcentajeRecargo, setPorcentajeRecargo] = useState<number>(0);
  const [observaciones, setObservaciones] = useState("");
  const [detalle, setDetalle] = useState<DetalleRow[]>([]);
  const [articuloActual, setArticuloActual] = useState<CapturaArticulo>(detalleInicial);
  const [cantidadInput, setCantidadInput] = useState("1");
  const [editingDetalleKey, setEditingDetalleKey] = useState<number | null>(null);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroGenero, setFiltroGenero] = useState("");
  const [filtroTela, setFiltroTela] = useState("");
  const [filtroTalla, setFiltroTalla] = useState("");
  const [filtroColor, setFiltroColor] = useState("");

  const navigate = useNavigate();
  const { usuario, rol, rolId, bodegaId: userBodegaId, bodegaNombre: authBodegaNombre } = useAuthStore();
  const { crossStoreRoleIds, fetchConfig } = useSystemConfigStore();
  const canAccessAllBodegas = rol === "ADMIN" || crossStoreRoleIds.includes(Number(rolId));
  const stockRestanteEstimado =
    articuloActual.stock != null ? Math.max(articuloActual.stock - (Number(cantidadInput) || 0), 0) : null;

  const normalizarUbicacion = (val?: string | null) => {
    if (!val) return "";
    const upper = val.toString().toUpperCase();
    if (["TIENDA", "CAPITAL", "DEPARTAMENTO"].includes(upper)) return upper;
    return upper;
  };

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
    void fetchConfig();
    void cargarCatalogos();
  }, [fetchConfig]);

  useEffect(() => {
    if (userBodegaId && !canAccessAllBodegas) {
      const parsed = Number(userBodegaId);
      const exists = bodegas.some((b) => b.id === parsed);
      setBodegaId(exists ? parsed : "");
      if (exists) {
        const selected = bodegas.find((b) => b.id === parsed);
        const ubic = normalizarUbicacion(selected?.ubicacion);
        setUbicacion(ubic || "TIENDA");
      }
    }
  }, [userBodegaId, canAccessAllBodegas, bodegas]);

  const fetchStock = async (bodega: number, producto: number) => {
    try {
      const resp = await api.get(`/inventario/${bodega}/${producto}`);
      return resp.data?.stock ?? null;
    } catch {
      return null;
    }
  };

  const obtenerTela = (prod?: Producto) => resolveTelaNombre(prod, telas);
  const obtenerTalla = (prod?: Producto) => resolveTallaNombre(prod, tallas);
  const obtenerColor = (prod?: Producto) => resolveColorNombre(prod, colores);

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

  const productosCoincidentes = useMemo(
    () =>
      productosBaseFiltrados.filter((producto) => {
        const matchesTalla = !filtroTalla || resolveTallaNombre(producto, tallas).trim() === filtroTalla;
        const matchesColor = !filtroColor || resolveColorNombre(producto, colores).trim() === filtroColor;
        return matchesTalla && matchesColor;
      }),
    [productosBaseFiltrados, tallas, colores, filtroTalla, filtroColor],
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
        setArticuloActual((prev) => ({
          ...prev,
          productoId: "",
          precio: 0,
          stock: null,
        }));
        return;
      }

      const stock = bodegaId ? await fetchStock(Number(bodegaId), productoDetectado.id) : null;
      setArticuloActual((prev) => ({
        ...prev,
        productoId: productoDetectado.id,
        precio: productoDetectado.precio ?? 0,
        stock,
      }));
    };

    void syncProducto();
  }, [productoDetectado, bodegaId]);

  const limpiarArticulo = () => {
    setArticuloActual(detalleInicial);
    setCantidadInput("1");
    setEditingDetalleKey(null);
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

    const cantidad = Number(cantidadInput) || 0;
    if (cantidad <= 0) {
      Swal.fire("Validacion", "Ingresa una cantidad mayor a 0", "warning");
      return;
    }

    if (articuloActual.stock != null && cantidad > articuloActual.stock) {
      Swal.fire("Validacion", `Solo hay ${articuloActual.stock} unidades disponibles en inventario`, "warning");
      return;
    }

    const row: DetalleRow = {
      key: editingDetalleKey ?? Date.now(),
      productoId: Number(articuloActual.productoId),
      cantidad,
      precio: Number(articuloActual.precio) || 0,
      bordado: Number(articuloActual.bordado) || 0,
      descuento: Number(articuloActual.descuento) || 0,
      descripcion: articuloActual.descripcion.trim(),
      stock: articuloActual.stock,
    };

    setDetalle((prev) =>
      editingDetalleKey === null ? [...prev, row] : prev.map((item) => (item.key === editingDetalleKey ? row : item)),
    );
    limpiarArticulo();
  };

  const editarArticulo = (row: DetalleRow) => {
    const producto = productos.find((p) => p.id === row.productoId);
    setEditingDetalleKey(row.key);
    setArticuloActual({
      productoId: row.productoId,
      cantidad: row.cantidad,
      precio: row.precio,
      bordado: row.bordado,
      descuento: row.descuento,
      descripcion: row.descripcion || "",
      stock: row.stock,
    });
    setCantidadInput(String(row.cantidad));
    setFiltroTipo(producto?.tipo || "");
    setFiltroGenero(producto?.genero || "");
    setFiltroTela(obtenerTela(producto) === "N/D" ? "" : obtenerTela(producto));
    setFiltroTalla(obtenerTalla(producto) === "N/D" ? "" : obtenerTalla(producto));
    setFiltroColor(obtenerColor(producto) === "N/D" ? "" : obtenerColor(producto));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const eliminarArticulo = (key: number) => {
    setDetalle((prev) => prev.filter((item) => item.key !== key));
    if (editingDetalleKey === key) {
      limpiarArticulo();
    }
  };

  const onBodegaChange = async (value: number) => {
    setBodegaId(value);
    const selected = bodegas.find((b) => b.id === value);
    const ubic = normalizarUbicacion(selected?.ubicacion);
    if (ubic) {
      setUbicacion(ubic);
    }

    const updated = await Promise.all(
      detalle.map(async (row) => {
        const stock = await fetchStock(value, row.productoId);
        return { ...row, stock };
      }),
    );
    setDetalle(updated);

    if (articuloActual.productoId) {
      const stock = await fetchStock(value, Number(articuloActual.productoId));
      setArticuloActual((prev) => ({ ...prev, stock }));
    }
  };

  const totals = useMemo(() => {
    const subtotal = detalle.reduce(
      (sum, item) =>
        sum +
        (Number(item.cantidad) || 0) *
          ((Number(item.precio) || 0) * (1 - (Number(item.descuento || 0) / 100)) + Number(item.bordado || 0)),
      0,
    );
    const recargo = metodoPago === "tarjeta" ? subtotal * ((porcentajeRecargo || 0) / 100) : 0;
    const total = subtotal + recargo;
    return { subtotal, recargo, total };
  }, [detalle, metodoPago, porcentajeRecargo]);

  const calcularSubtotal = (item: DetalleRow) => {
    const precioConDescuento = (Number(item.precio) || 0) * (1 - (Number(item.descuento || 0) / 100));
    return (Number(item.cantidad) || 0) * (precioConDescuento + (Number(item.bordado) || 0));
  };

  const calcularTotalesDesdeDetalle = (detalleActual: DetalleRow[]) => {
    const subtotal = detalleActual.reduce((sum, item) => sum + calcularSubtotal(item), 0);
    const recargoCalculado = metodoPago === "tarjeta" ? subtotal * ((porcentajeRecargo || 0) / 100) : 0;
    return { subtotal, recargo: recargoCalculado, total: subtotal + recargoCalculado };
  };

  const abrirPdfVenta = (venta: any, detalleUsado: DetalleRow[]) => {
    const nuevaVentana = window.open("", "_blank");
    if (!nuevaVentana) {
      Swal.fire("Aviso", "Habilita las ventanas emergentes para ver el PDF", "info");
      return;
    }

    const clienteNombre =
      clientes.find((c) => c.id === (clienteId === "" ? null : Number(clienteId)))?.nombre || "Consumidor final";
    const bodegaNombre = bodegas.find((b) => b.id === Number(bodegaId))?.nombre || authBodegaNombre || "N/D";
    const vendedor = usuario || "Vendedor";
    const fecha = venta?.fecha ? new Date(venta.fecha) : new Date();
    const folio = venta?.id ? `V-${venta.id}` : "Pendiente";
    const totalesPdf = calcularTotalesDesdeDetalle(detalleUsado);

    const filasHtml = detalleUsado
      .map((item, idx) => {
        const producto = productos.find((p) => p.id === item.productoId);
        return `<tr>
            <td>${idx + 1}</td>
            <td>${producto?.codigo || item.productoId}</td>
            <td>${producto?.nombre || "Producto"}</td>
            <td>${item.cantidad}</td>
            <td>${(Number(item.precio) || 0).toFixed(2)}</td>
            <td>${(Number(item.bordado) || 0).toFixed(2)}</td>
            <td>${(Number(item.descuento) || 0).toFixed(2)}%</td>
            <td>${item.descripcion || ""}</td>
            <td>${calcularSubtotal(item).toFixed(2)}</td>
          </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Resumen de venta</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; }
            .brand { font-size: 18px; font-weight: 700; letter-spacing: 0.5px; }
            .folio { font-size: 14px; color: #475569; }
            .section { margin-bottom: 18px; }
            .section h3 { margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; }
            .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px 16px; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
            th { background: #0f172a; color: #fff; text-align: left; padding: 8px; }
            td { border-bottom: 1px solid #e2e8f0; padding: 7px; }
            .totals { width: 280px; margin-left: auto; margin-top: 12px; font-size: 13px; }
            .totals-row { display: flex; justify-content: space-between; padding: 6px 0; }
            .totals-row.total { font-weight: 700; border-top: 2px solid #0f172a; margin-top: 4px; }
            .footer { margin-top: 20px; font-size: 12px; color: #475569; }
            .badge { display: inline-flex; padding: 4px 10px; border-radius: 999px; background: #e2e8f0; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="brand">Uniforma</div>
              <div>Uniformes y bordados</div>
            </div>
            <div style="text-align:right">
              <div class="folio">${folio}</div>
              <div>${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString()}</div>
            </div>
          </div>

          <div class="section">
            <h3>Resumen</h3>
            <div class="info-grid">
              <div><strong>Cliente:</strong> ${clienteNombre}</div>
              <div><strong>Metodo de pago:</strong> ${metodoPago}</div>
              <div><strong>Bodega/Tienda:</strong> ${bodegaNombre}</div>
              <div><strong>Ubicacion:</strong> ${ubicacion || "N/D"}</div>
              <div><strong>Vendedor:</strong> ${vendedor}</div>
              <div><strong>Observaciones:</strong> ${observaciones || "N/A"}</div>
            </div>
          </div>

          <div class="section">
            <h3>Articulos</h3>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Codigo</th>
                  <th>Producto</th>
                  <th>Cant.</th>
                  <th>Precio</th>
                  <th>Bordado</th>
                  <th>Desc.</th>
                  <th>Observacion</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${filasHtml}
              </tbody>
            </table>
          </div>

          <div class="totals">
            <div class="totals-row">
              <span>Subtotal</span>
              <span>Q ${totalesPdf.subtotal.toFixed(2)}</span>
            </div>
            ${
              metodoPago === "tarjeta"
                ? `<div class="totals-row"><span>Recargo (${porcentajeRecargo || 0}%)</span><span>Q ${totalesPdf.recargo.toFixed(2)}</span></div>`
                : ""
            }
            <div class="totals-row total">
              <span>Total</span>
              <span>Q ${totalesPdf.total.toFixed(2)}</span>
            </div>
          </div>

          <div class="footer">
            <div class="badge">Gracias por su compra</div>
            <div>Generado automaticamente por Uniforma POS. Conserve este comprobante.</div>
          </div>
          <script>
            window.onload = function() {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>`;

    nuevaVentana.document.write(html);
    nuevaVentana.document.close();
  };

  const guardar = async () => {
    if (!bodegaId) {
      Swal.fire("Validacion", "Selecciona una bodega", "warning");
      return;
    }
    if (!metodoPago) {
      Swal.fire("Validacion", "Selecciona metodo de pago", "warning");
      return;
    }
    if (!ubicacion) {
      Swal.fire("Validacion", "Selecciona ubicacion de la venta", "warning");
      return;
    }
    if (!detalle.length) {
      Swal.fire("Validacion", "Agrega al menos un producto", "warning");
      return;
    }

    const payload = {
      clienteId: clienteId === "" ? null : Number(clienteId),
      bodegaId: Number(bodegaId),
      ubicacion,
      metodoPago,
      porcentajeRecargo,
      observaciones: observaciones || null,
      vendedor: usuario,
        detalle: detalle.map((d) => ({
          productoId: d.productoId,
          cantidad: d.cantidad,
          precio: d.precio,
          bordado: d.bordado,
          descuento: d.descuento,
          descripcion: d.descripcion || "",
        })),
      };

    try {
      const resp = await api.post("/ventas", payload);
      Swal.fire("Guardado", "Venta registrada", "success");
      abrirPdfVenta(resp.data, detalle);
      navigate("/ventas");
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo guardar";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <PaymentIcon color="primary" />
        <Typography variant="h4">Nueva venta</Typography>
      </Stack>
      <Divider sx={{ mb: 2 }} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Autocomplete
            options={clientes}
            getOptionLabel={(option) => option.nombre}
            value={clientes.find((c) => c.id === clienteId) || null}
            onChange={(_, val) => setClienteId(val ? val.id : "")}
            renderInput={(params) => <TextField {...params} label="Cliente" fullWidth />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel>Bodega</InputLabel>
            <Select
              label="Bodega"
              value={bodegaId === "" ? "" : bodegaId}
              onChange={(e) => void onBodegaChange(Number(e.target.value))}
              disabled={!!userBodegaId && !canAccessAllBodegas}
            >
              {bodegas.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel>Ubicacion</InputLabel>
            <Select label="Ubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)}>
              <MenuItem value="TIENDA">TIENDA</MenuItem>
              <MenuItem value="CAPITAL">CAPITAL</MenuItem>
              <MenuItem value="DEPARTAMENTO">DEPARTAMENTO</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel>Metodo de pago</InputLabel>
            <Select label="Metodo de pago" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
              <MenuItem value="efectivo">Efectivo</MenuItem>
              <MenuItem value="tarjeta">Tarjeta</MenuItem>
              <MenuItem value="transferencia">Transferencia</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        {metodoPago === "tarjeta" && (
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Recargo %"
              type="number"
              fullWidth
              value={porcentajeRecargo}
              onChange={(e) => setPorcentajeRecargo(Number(e.target.value))}
            />
          </Grid>
        )}
        <Grid size={{ xs: 12 }}>
          <TextField
            label="Observaciones"
            fullWidth
            multiline
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" sx={{ mb: 2 }}>
        Agregar articulo
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Selecciona la combinacion del articulo y agregalo a la lista temporal antes de guardar la venta.
          </Typography>
          {articuloActual.stock != null && articuloActual.productoId ? (
            <Alert severity={stockRestanteEstimado !== null && stockRestanteEstimado <= 0 ? "warning" : "info"}>
              {`Stock actual: ${articuloActual.stock} unidades. `}
              {`Stock restante estimado con esta captura: ${stockRestanteEstimado ?? 0} unidades.`}
            </Alert>
          ) : (
            <Alert severity="info">Selecciona bodega y articulo para visualizar el stock disponible.</Alert>
          )}
        </Stack>

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
          <Grid size={{ xs: 12, sm: 3, md: 2 }}>
            <TextField
              label="Cantidad"
              type="text"
              fullWidth
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              value={cantidadInput}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "");
                const normalizado = raw.replace(/^0+(?=\d)/, "");
                const cantidad = Number(normalizado) || 0;
                setCantidadInput(normalizado);
                setArticuloActual((prev) => ({ ...prev, cantidad }));
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3, md: 2 }}>
            <TextField
              label="Precio"
              type="number"
              fullWidth
              value={articuloActual.precio}
              InputProps={{ readOnly: true }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3, md: 2 }}>
            <TextField
              label="Bordado"
              type="number"
              fullWidth
              value={articuloActual.bordado}
              onChange={(e) => setArticuloActual((prev) => ({ ...prev, bordado: Number(e.target.value) || 0 }))}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3, md: 2 }}>
            <TextField
              label="Descuento %"
              type="number"
              fullWidth
              value={articuloActual.descuento}
              onChange={(e) => setArticuloActual((prev) => ({ ...prev, descuento: Number(e.target.value) || 0 }))}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Observacion del articulo"
              fullWidth
              value={articuloActual.descripcion}
              onChange={(e) => setArticuloActual((prev) => ({ ...prev, descripcion: e.target.value }))}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Stock disponible"
              fullWidth
              disabled
              value={articuloActual.stock ?? ""}
              helperText={
                articuloActual.stock != null
                  ? `Restante estimado despues de agregar: ${stockRestanteEstimado ?? 0}`
                  : "Selecciona bodega y producto"
              }
            />
          </Grid>
        </Grid>

        <Stack spacing={1.5} alignItems="center" sx={{ mt: 2 }}>
          <Stack direction="row" spacing={1.5}>
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
              {editingDetalleKey === null ? "Agregar a la venta" : "Guardar cambios"}
            </Button>
            {editingDetalleKey !== null && (
              <Button variant="outlined" onClick={limpiarArticulo}>
                Cancelar edicion
              </Button>
            )}
          </Stack>
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
              <TableCell align="center" sx={{ fontWeight: 700 }}>Precio</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Bordado</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Desc.</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Observacion</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Stock</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Subtotal</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Acciones</TableCell>
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
                  <TableCell align="center">{`Q ${row.precio.toFixed(2)}`}</TableCell>
                  <TableCell align="center">{`Q ${row.bordado.toFixed(2)}`}</TableCell>
                  <TableCell align="center">{`${row.descuento.toFixed(2)}%`}</TableCell>
                  <TableCell align="center">{row.descripcion || "-"}</TableCell>
                  <TableCell align="center">{row.stock ?? "N/D"}</TableCell>
                  <TableCell align="center">{`Q ${calcularSubtotal(row).toFixed(2)}`}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Button size="small" variant="text" startIcon={<EditOutlined />} onClick={() => editarArticulo(row)}>
                        Editar
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => eliminarArticulo(row.key)}
                      >
                        Eliminar
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {!detalle.length && (
              <TableRow>
                <TableCell colSpan={13} align="center">
                  Aun no has agregado articulos a la venta.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

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
                <Typography fontWeight={700}>Total</Typography>
                <Typography fontWeight={700}>{`Q ${totals.total.toFixed(2)}`}</Typography>
              </Stack>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ mt: 3 }}>
        <Button variant="outlined" onClick={() => navigate("/ventas")}>
          Cancelar
        </Button>
        <Button variant="contained" color="success" onClick={guardar}>
          Guardar venta
        </Button>
      </Stack>
    </Paper>
  );
}
