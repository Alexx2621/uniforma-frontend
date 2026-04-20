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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import PlaylistAddCheckOutlined from "@mui/icons-material/PlaylistAddCheckOutlined";
import DoneAllOutlined from "@mui/icons-material/DoneAllOutlined";
import PaidOutlined from "@mui/icons-material/PaidOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { useSystemConfigStore } from "../config/useSystemConfigStore";

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
  descuento?: number;
  descripcion?: string;
}

interface Pago {
  id: number;
  monto: number;
  metodo: string;
  tipo: string;
  fecha: string;
}

interface Pedido {
  id: number;
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

export default function PedidoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { rol, rolId, bodegaId: userBodegaId } = useAuthStore();
  const { productionInternalMode, crossStoreRoleIds, fetchConfig } = useSystemConfigStore();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(false);
  const [pagoFinal, setPagoFinal] = useState(0);
  const [metodoPagoFinal, setMetodoPagoFinal] = useState("efectivo");
  const [porcRecargoFinal, setPorcRecargoFinal] = useState(0);
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
      setPedido(respPedido.data);
      setBodegas(respBod.data || []);
      setTelas(respTelas.data || []);
      setTallas(respTallas.data || []);
      setColores(respColores.data || []);
      const pref = userBodegaId && !canAccessAllBodegas ? Number(userBodegaId) : "";
      setBodegaIngreso(pref || respPedido.data?.bodegaId || "");
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
    () => (pedido?.pagos || []).reduce((sum, p) => sum + (p.monto || 0), 0),
    [pedido]
  );

  const esAnulado = `${pedido?.estado || ""}`.trim().toLowerCase() === "anulado";
  const esRecibido = ["recibido", "completado"].includes(`${pedido?.estado || ""}`.trim().toLowerCase());

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
    if (!productionInternalMode) {
      const saldo = pedido?.saldoPendiente || 0;
      const restante = Math.max(0, saldo - (Number(pagoFinal) || 0));
      if (restante > 0) {
        Swal.fire("Validacion", `Saldo pendiente Q ${restante.toFixed(2)}. Cancela antes de terminar.`, "warning");
        return;
      }
    }

    try {
      await api.post(`/produccion/${id}/terminar`, {
        pagoFinal: productionInternalMode ? 0 : pagoFinal,
        metodoPagoFinal,
        porcentajeRecargo: productionInternalMode ? 0 : porcRecargoFinal,
      });
      if (!productionInternalMode && pagoFinal > 0) {
        const rec = metodoPagoFinal === "tarjeta" ? pagoFinal * ((porcRecargoFinal || 0) / 100) : 0;
        generarPdfPago(pagoFinal + rec, metodoPagoFinal, "saldo");
      }
      Swal.fire("Listo", "Pedido marcado como recibido", "success");
      navigate("/produccion");
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo terminar";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    }
  };

  const pagarSaldo = async () => {
    if (productionInternalMode) {
      Swal.fire("Aviso", "Los pagos estan deshabilitados en modo interno", "info");
      return;
    }
    if (pagoFinal <= 0) {
      Swal.fire("Validacion", "Ingresa un monto mayor a 0", "warning");
      return;
    }
    if ((pedido?.saldoPendiente || 0) <= 0) {
      Swal.fire("Aviso", "El saldo ya esta en cero. No se puede registrar mas pagos.", "info");
      return;
    }
    if (pagoFinal > (pedido?.saldoPendiente || 0)) {
      Swal.fire(
        "Aviso",
        `El pago excede el saldo (Q ${Number(pedido?.saldoPendiente || 0).toFixed(2)}). Ajusta el monto.`,
        "info"
      );
      return;
    }
    try {
      await api.post(`/produccion/${id}/pago`, {
        monto: pagoFinal,
        metodo: metodoPagoFinal,
        tipo: "saldo",
        porcentajeRecargo: metodoPagoFinal === "tarjeta" ? porcRecargoFinal : 0,
      });
      Swal.fire("Pago registrado", "Saldo actualizado", "success");
      const rec = metodoPagoFinal === "tarjeta" ? pagoFinal * ((porcRecargoFinal || 0) / 100) : 0;
      generarPdfPago(pagoFinal + rec, metodoPagoFinal, "saldo");
      setPagoFinal(0);
      await cargar();
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo registrar pago";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    }
  };

  const generarPdfPago = (monto: number, metodo: string, tipo: string) => {
    if (!pedido) return;
    const win = window.open("", "_blank");
    if (!win) {
      Swal.fire("Aviso", "Habilita las ventanas emergentes para ver el comprobante", "info");
      return;
    }
    const fecha = new Date();
    const html = `<!doctype html>
      <html><head><meta charset="utf-8" />
      <title>Pago pedido</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
        .header { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:12px; }
        .brand { font-weight:700; font-size:18px; }
        table { width:100%; border-collapse:collapse; margin-top:8px; font-size:13px; }
        th { background:#0f172a; color:#fff; padding:8px; text-align:left; }
        td { padding:8px; border-bottom:1px solid #e2e8f0; }
      </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">Uniforma</div>
            <div>Comprobante de pago</div>
          </div>
          <div style="text-align:right">
            <div>Pedido: P-${pedido.id}</div>
            <div>${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString()}</div>
          </div>
        </div>
        <table>
          <tbody>
            <tr><td>Cliente</td><td>${pedido.cliente?.nombre || "Mostrador"}</td></tr>
            <tr><td>Bodega</td><td>${pedido.bodega?.nombre || "N/D"}</td></tr>
            <tr><td>Monto</td><td>Q ${Number(monto || 0).toFixed(2)}</td></tr>
            <tr><td>Metodo</td><td>${metodo}</td></tr>
            <tr><td>Tipo</td><td>${tipo}</td></tr>
            <tr><td>Saldo pendiente</td><td>Q ${Number(pedido.saldoPendiente || 0).toFixed(2)}</td></tr>
          </tbody>
        </table>
        <script>window.onload = function(){ window.print(); }</script>
      </body></html>`;
    win.document.write(html);
    win.document.close();
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
      const desc = Number(d.descuento || 0);
      const cantidad = Number(d.cantidad || 0);
      const precioDesc = precio * (1 - desc / 100);
      return sum + cantidad * precioDesc;
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
        const precioDesc = Number(d.precioUnit || 0) * (1 - desc / 100);
        const sub = (d.cantidad || 0) * precioDesc;
        return `<tr>
          <td>${idx + 1}</td>
          <td>${d.producto?.codigo || d.productoId}</td>
          <td>${d.producto?.nombre || "Producto"}</td>
          <td>${(d as any).descripcion || ""}</td>
          <td>${d.cantidad}</td>
          <td>${Number(d.precioUnit || 0).toFixed(2)}</td>
          <td>${desc.toFixed(2)}%</td>
          <td>${sub.toFixed(2)}</td>
        </tr>`;
      })
      .join("");
    const html = `<!doctype html>
      <html><head><meta charset="utf-8" />
      <title>Pedido de produccion</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
        .header { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:12px; }
        .brand { font-size:18px; font-weight:700; letter-spacing:0.5px; }
        table { width:100%; border-collapse: collapse; margin-top:8px; font-size:12px; }
        th { background:#0f172a; color:#fff; text-align:left; padding:8px; }
        td { border-bottom:1px solid #e2e8f0; padding:7px; }
        .totals { width: 280px; margin-left:auto; margin-top:12px; font-size:13px; }
        .totals-row { display:flex; justify-content:space-between; padding:6px 0; }
        .totals-row.total { font-weight:700; border-top:2px solid #0f172a; margin-top:4px; }
        .watermark {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 110px;
          font-weight: 800;
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
            <div>Folio: P-${pedido.id}</div>
            <div>${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString()}</div>
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <strong>Cliente:</strong> ${productionInternalMode ? "Interno" : pedido.cliente?.nombre || "Mostrador"} |
          <strong>Bodega:</strong> ${pedido.bodega?.nombre || "N/D"} |
          <strong>Metodo:</strong> ${productionInternalMode ? "interno" : (pedido as any).metodoPago || "efectivo"}
        </div>
        <table>
          <thead>
            <tr><th>#</th><th>Codigo</th><th>Producto</th><th>Detalle</th><th>Cant.</th><th>Precio</th><th>Desc.</th><th>Subtotal</th></tr>
          </thead>
          <tbody>${filasHtml}</tbody>
        </table>
        <div class="totals">
          <div class="totals-row"><span>Subtotal</span><span>Q ${subtotal.toFixed(2)}</span></div>
          ${!productionInternalMode && recargo ? `<div class="totals-row"><span>Recargo</span><span>Q ${recargo.toFixed(2)}</span></div>` : ""}
          ${!productionInternalMode ? `<div class="totals-row"><span>Anticipo</span><span>Q ${anticipo.toFixed(2)}</span></div>` : ""}
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
        body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
        .header { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:12px; }
        .brand { font-size:18px; font-weight:700; letter-spacing:0.5px; }
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
          font-weight: 800;
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
            <div>Folio: P-${pedido.id}</div>
            <div>${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString()}</div>
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <strong>Cliente:</strong> ${productionInternalMode ? "Interno" : pedido.cliente?.nombre || "Mostrador"} |
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
        <Typography variant="h4">{`Pedido P-${pedido.id}`}</Typography>
        <Chip
          label={pedido.estado}
          color={
            esAnulado ? "error" : esRecibido ? "success" : "info"
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
        Cliente: {productionInternalMode ? "Interno" : pedido.cliente?.nombre || "Mostrador"} | Bodega:{" "}
        {pedido.bodega?.nombre || "N/D"} | Fecha: {pedido.fecha ? new Date(pedido.fecha).toLocaleString() : ""}
      </Typography>
      {esAnulado && (
        <Typography variant="body2" color="error" sx={{ mb: 2, fontWeight: 600 }}>
          Este pedido esta anulado. Solo se permite visualizar la informacion.
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
              <TableCell>Tela</TableCell>
              <TableCell>Talla</TableCell>
              <TableCell>Color</TableCell>
              <TableCell>Cantidad</TableCell>
              <TableCell>Observacion</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pedido.detalle.map((d, idx) => (
              <TableRow key={idx}>
                <TableCell>{d.producto?.codigo}</TableCell>
                <TableCell>{d.producto?.tipo || d.producto?.nombre || "N/D"}</TableCell>
                <TableCell>{obtenerTela(d.producto)}</TableCell>
                <TableCell>{obtenerTalla(d.producto)}</TableCell>
                <TableCell>{obtenerColor(d.producto)}</TableCell>
                <TableCell>{d.cantidad}</TableCell>
                <TableCell>{d.descripcion?.trim() ? d.descripcion : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Divider sx={{ my: 2 }} />

      <Grid container spacing={3} sx={{ mt: 1, alignItems: "stretch" }}>
        {!productionInternalMode && (
          <Grid size={{ xs: 12, md: 6 }} sx={{ minWidth: 0 }}>
            <Paper
              variant="outlined"
              sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column", borderRadius: 2, width: "100%", boxSizing: "border-box" }}
            >
              <Stack spacing={1.5}>
                <Typography variant="h6">Pagos</Typography>
                <Stack direction="row" justifyContent="space-between">
                  <Typography>Estimado</Typography>
                  <Typography>{`Q ${Number(pedido.totalEstimado || 0).toFixed(2)}`}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography>Pagado</Typography>
                  <Typography>{`Q ${totalPagado.toFixed(2)}`}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography fontWeight={700}>Saldo</Typography>
                  <Typography fontWeight={700}>{`Q ${Number(pedido.saldoPendiente || 0).toFixed(2)}`}</Typography>
                </Stack>
                <Divider />
                <Typography variant="subtitle2">Registrar pago de saldo</Typography>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  sx={{ alignItems: { xs: "stretch", sm: "center" }, flexWrap: "wrap", columnGap: 2, rowGap: 1.2 }}
                >
                  <TextField
                    label="Monto"
                    type="number"
                    size="small"
                    value={pagoFinal}
                    onChange={(e) => setPagoFinal(Number(e.target.value))}
                    disabled={esAnulado}
                    sx={{ flex: 1, minWidth: 180 }}
                  />
                  <FormControl size="small" sx={{ minWidth: 200, flex: 1 }} disabled={esAnulado}>
                    <InputLabel>Metodo</InputLabel>
                    <Select label="Metodo" value={metodoPagoFinal} onChange={(e) => setMetodoPagoFinal(e.target.value)}>
                      <MenuItem value="efectivo">Efectivo</MenuItem>
                      <MenuItem value="tarjeta">Tarjeta</MenuItem>
                      <MenuItem value="transferencia">Transferencia</MenuItem>
                    </Select>
                  </FormControl>
                  {metodoPagoFinal === "tarjeta" && (
                    <TextField
                      label="Recargo %"
                      type="number"
                      size="small"
                      value={porcRecargoFinal}
                      onChange={(e) => setPorcRecargoFinal(Number(e.target.value))}
                      disabled={esAnulado}
                      sx={{ width: { xs: "100%", sm: 180 } }}
                    />
                  )}
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PaidOutlined />}
                    onClick={pagarSaldo}
                    disabled={esAnulado}
                    sx={{ width: { xs: "100%", sm: "auto" }, minWidth: { sm: 150 }, mt: { xs: 1, sm: 0 } }}
                  >
                    Pagar
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Grid>
        )}

        <Grid size={{ xs: 12, md: productionInternalMode ? 12 : 6 }} sx={{ minWidth: 0 }}>
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
                Este boton solo cambiara el estado del pedido a recibido. No se movera stock al inventario.
              </Typography>
              <Button
                variant="contained"
                color="success"
                startIcon={<DoneAllOutlined />}
                onClick={terminar}
                disabled={esAnulado || esRecibido || loading || (!productionInternalMode && (pedido?.saldoPendiente || 0) > 0)}
              >
                Marcar como recibido
              </Button>
              {esRecibido && (
                <Typography variant="caption" color="success.main">
                  Este pedido ya fue marcado como recibido.
                </Typography>
              )}
              {!productionInternalMode && (pedido?.saldoPendiente || 0) > 0 && (
                <Typography variant="caption" color="error">
                  Liquida el saldo antes de marcarlo como recibido.
                </Typography>
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Paper>
  );
}
