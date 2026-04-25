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

  const generarPdfPedidoCliente = () => {
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
    const watermarkHtml = esAnulado
      ? `<div class="watermark">ANULADO</div>`
      : "";
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
          <td>${d.producto?.codigo || d.productoId}</td>
          <td>${d.producto?.nombre || "Producto"}</td>
          <td>${(d as any).descripcion || ""}</td>
          <td>${d.cantidad}</td>
          <td>${Number(d.precioUnit || 0).toFixed(2)}</td>
          <td>${bordado.toFixed(2)}</td>
          <td>${estiloEspecialMonto.toFixed(2)}</td>
          <td>${desc.toFixed(2)}%</td>
          <td>${sub.toFixed(2)}</td>
        </tr>`;
      })
      .join("");
    const html = `<!doctype html>
      <html><head><meta charset="utf-8" />
      <title>Pedido de produccion</title>
      <style>
        body { font-family: ${PDF_FONT_FAMILY}; margin: 24px; color: #1f2937; }
        .header { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:12px; }
        .brand { font-size:18px; font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; font-weight:600; letter-spacing:0.5px; }
        strong, th { font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; font-weight:600; }
        table { width:100%; border-collapse: collapse; margin-top:8px; font-size:12px; }
        th { background:#0f172a; color:#fff; text-align:left; padding:8px; }
        td { border-bottom:1px solid #e2e8f0; padding:7px; }
        .totals { width: 280px; margin-left:auto; margin-top:12px; font-size:13px; }
        .totals-row { display:flex; justify-content:space-between; padding:6px 0; }
        .totals-row.total { font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; font-weight:600; border-top:2px solid #0f172a; margin-top:4px; }
        .watermark {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 110px;
          font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
          font-weight: 600;
          color: rgba(220, 38, 38, 0.16);
          transform: rotate(-28deg);
          letter-spacing: 8px;
          pointer-events: none;
          z-index: 9999;
        }
      </style>
      </head>
      <body>
        ${watermarkHtml}
        <div class="header">
          <div>
            <div class="brand">Uniforma</div>
            <div>Pedido de produccion</div>
          </div>
          <div style="text-align:right">
            <div>Folio: ${pedido.folio || `P-${pedido.id}`}</div>
            <div>${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString()}</div>
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <strong>Cliente:</strong> ${pedido.cliente?.nombre || (pedido as any).clienteNombre || "Mostrador"} |
          <strong>Bodega:</strong> ${pedido.bodega?.nombre || "N/D"} |
          <strong>Metodo:</strong> ${(pedido as any).metodoPago || "efectivo"}
        </div>
        <table>
          <thead>
            <tr><th>#</th><th>Codigo</th><th>Producto</th><th>Detalle</th><th>Cant.</th><th>Precio</th><th>Bordado</th><th>Estilo esp.</th><th>Desc.</th><th>Subtotal</th></tr>
          </thead>
          <tbody>${filasHtml}</tbody>
        </table>
        <div class="totals">
          <div class="totals-row"><span>Subtotal</span><span>Q ${subtotal.toFixed(2)}</span></div>
          ${recargo ? `<div class="totals-row"><span>Recargo</span><span>Q ${recargo.toFixed(2)}</span></div>` : ""}
          <div class="totals-row"><span>Anticipo</span><span>Q ${anticipo.toFixed(2)}</span></div>
          <div class="totals-row total"><span>Total</span><span>Q ${total.toFixed(2)}</span></div>
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
    const watermarkHtml = esAnulado
      ? `<div class="watermark">ANULADO</div>`
      : "";
    const filasHtml = pedido.detalle
      .map((d: any, idx: number) => {
        const prod: any = d.producto || {};
        return `<tr>
          <td>${idx + 1}</td>
          <td>${prod.codigo || d.productoId}</td>
          <td>${prod.tipo || "N/D"}</td>
          <td>${prod.genero || "N/D"}</td>
          <td>${obtenerTela(prod)}</td>
          <td>${obtenerTalla(prod)}</td>
          <td>${obtenerColor(prod)}</td>
          <td>${d.cantidad}</td>
          <td>${d.descripcion || ""}</td>
        </tr>`;
      })
      .join("");
    const html = `<!doctype html>
      <html><head><meta charset="utf-8" />
      <title>Orden de produccion</title>
      <style>
        body { font-family: ${PDF_FONT_FAMILY}; margin: 24px; color: #1f2937; }
        .header { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:12px; }
        .brand { font-size:18px; font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; font-weight:600; letter-spacing:0.5px; }
        strong, th { font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; font-weight:600; }
        table { width:100%; border-collapse: collapse; margin-top:8px; font-size:12px; }
        th { background:#0f172a; color:#fff; text-align:left; padding:8px; }
        td { border-bottom:1px solid #e2e8f0; padding:7px; }
        .watermark {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 110px;
          font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
          font-weight: 600;
          color: rgba(220, 38, 38, 0.16);
          transform: rotate(-28deg);
          letter-spacing: 8px;
          pointer-events: none;
          z-index: 9999;
        }
      </style>
      </head>
      <body>
        ${watermarkHtml}
        <div class="header">
          <div>
            <div class="brand">Uniforma</div>
            <div>Orden de produccion</div>
          </div>
          <div style="text-align:right">
            <div>Folio: ${pedido.folio || `P-${pedido.id}`}</div>
            <div>${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString()}</div>
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <strong>Cliente:</strong> ${pedido.cliente?.nombre || (pedido as any).clienteNombre || "Mostrador"} |
          <strong>Bodega:</strong> ${pedido.bodega?.nombre || "N/D"}
        </div>
        <table>
          <thead>
            <tr><th>#</th><th>Codigo</th><th>Tipo</th><th>Genero</th><th>Tela</th><th>Talla</th><th>Color</th><th>Cant.</th><th>Detalle</th></tr>
          </thead>
          <tbody>${filasHtml}</tbody>
        </table>
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
          <Button size="small" variant="outlined" startIcon={<PictureAsPdfOutlined />} onClick={generarPdfPedidoCliente}>
            PDF pedido
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="secondary"
            startIcon={<PictureAsPdfOutlined />}
            onClick={generarPdfPedidoProduccion}
          >
            PDF produccion
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
