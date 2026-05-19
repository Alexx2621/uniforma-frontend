import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PaidOutlined from "@mui/icons-material/PaidOutlined";
import NoteAddOutlined from "@mui/icons-material/NoteAddOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { PDF_FONT_FAMILY, PDF_FONT_SEMIBOLD_FAMILY } from "../utils/fontFamily";
import { useAuthStore } from "../auth/useAuthStore";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import { canUseVendedorDropdown } from "../utils/vendedorDropdownAccess";

interface Pago {
  monto: number;
  recargo?: number;
}

interface PedidoPago {
  id: number;
  folio?: string | null;
  fecha: string;
  estado: string;
  totalEstimado: number;
  saldoPendiente: number;
  cliente?: { nombre?: string | null } | null;
  clienteNombre?: string | null;
  bodega?: { nombre?: string | null } | null;
  bodegaId?: number | string | null;
  pagos?: Pago[];
  vendedor: string;
}

type PagoForm = {
  monto: number;
  metodo: string;
  porcentajeRecargo: number;
  referencia: string;
  numeroEnvio: string;
  numeroRecibo: string;
  referenciaDocumento: string;
  observacionesPago: string;
};

const emptyPagoForm: PagoForm = {
  monto: 0,
  metodo: "efectivo",
  porcentajeRecargo: 0,
  referencia: "",
  numeroEnvio: "",
  numeroRecibo: "",
  referenciaDocumento: "",
  observacionesPago: "",
};

const money = (value: number) =>
  `Q ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const metodoUsaRecargo = (metodo: string) => metodo === "tarjeta" || metodo === "visalink";
const metodoRequiereReferencia = (metodo: string) => metodo !== "efectivo";

const getPagoAplicado = (pago: Pago) => Number(pago.monto || 0) + Number(pago.recargo || 0);

export default function PagosPedidos() {
  const { rol, rolId, permisos } = useAuthStore();
  const { vendedorDropdownRoleIds, fetchConfig } = useSystemConfigStore();
  const canUseDropdown = canUseVendedorDropdown(rol, rolId, vendedorDropdownRoleIds, permisos);
  const [pedidos, setPedidos] = useState<PedidoPago[]>([]);
  const [forms, setForms] = useState<Record<number, PagoForm>>({});
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [selectedVendedor, setSelectedVendedor] = useState("all");
  const [loading, setLoading] = useState(false);
  const [extrasPedido, setExtrasPedido] = useState<PedidoPago | null>(null);

  const cargar = async () => {
    try {
      setLoading(true);
      const resp = await api.get("/produccion");
      const data = (resp.data || []).map((pedido: any) => ({
        ...pedido,
        totalEstimado: Number(pedido?.totalEstimado || 0),
        saldoPendiente: Number(pedido?.saldoPendiente || 0),
        pagos: Array.isArray(pedido?.pagos)
          ? pedido.pagos.map((pago: any) => ({
              ...pago,
              monto: Number(pago?.monto || 0),
              recargo: Number(pago?.recargo || 0),
            }))
          : [],
        vendedor: `${pedido?.solicitadoPor || pedido?.vendedor || pedido?.usuario || (pedido?.usuario?.usuario ?? "") || "N/D"}`.trim(),
      }));
      setPedidos(data);
      setForms((current) => {
        const next = { ...current };
        data.forEach((pedido: PedidoPago) => {
          if (!next[pedido.id]) {
            next[pedido.id] = {
              ...emptyPagoForm,
              monto: Number(pedido.saldoPendiente || 0),
            };
          }
        });
        return next;
      });
    } catch {
      Swal.fire("Error", "No se pudieron cargar los pagos pendientes", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    void cargar();
  }, []);

  const vendedores = useMemo(
    () => Array.from(new Set(pedidos.map((pedido) => pedido.vendedor).filter((value) => value))).sort((a, b) => a.localeCompare(b)),
    [pedidos]
  );

  const pendientes = useMemo(
    () =>
      pedidos.filter((pedido) => {
        const estado = `${pedido.estado || ""}`.trim().toLowerCase();
        const fecha = `${pedido.fecha || ""}`.slice(0, 10);
        const estadoCerrado = ["anulado", "recibido", "completado", "regresado_produccion"].includes(estado);
        if (estadoCerrado) return false;
        if (Number(pedido.saldoPendiente || 0) <= 0) return false;
        if (filtroDesde && fecha < filtroDesde) return false;
        if (filtroHasta && fecha > filtroHasta) return false;
        if (selectedVendedor !== "all" && pedido.vendedor !== selectedVendedor) return false;
        return true;
      }),
    [pedidos, filtroDesde, filtroHasta, selectedVendedor]
  );

  const updateForm = (pedidoId: number, patch: Partial<PagoForm>) => {
    setForms((current) => ({
      ...current,
      [pedidoId]: {
        ...(current[pedidoId] || emptyPagoForm),
        ...patch,
      },
    }));
  };

  const getForm = (pedido: PedidoPago) => forms[pedido.id] || { ...emptyPagoForm, monto: Number(pedido.saldoPendiente || 0) };

  const hasExtraData = (form: PagoForm) =>
    Boolean(
      form.numeroEnvio.trim() ||
        form.numeroRecibo.trim() ||
        form.referenciaDocumento.trim() ||
        form.observacionesPago.trim()
    );

  const generarPdfPago = (pedido: PedidoPago, monto: number, metodo: string, tipo: string, referencia = "", extras?: PagoForm) => {
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
        body { font-family: ${PDF_FONT_FAMILY}; margin: 24px; color: #1f2937; }
        .header { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:12px; }
        .brand { font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; font-weight:600; font-size:18px; }
        strong, th { font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; font-weight:600; }
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
            <div>Pedido: ${pedido.folio || `P-${pedido.id}`}</div>
            <div>${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString()}</div>
          </div>
        </div>
        <table>
          <tbody>
            <tr><td>Cliente</td><td>${pedido.cliente?.nombre || pedido.clienteNombre || "Mostrador"}</td></tr>
            <tr><td>Bodega</td><td>${pedido.bodega?.nombre || "N/D"}</td></tr>
            <tr><td>Monto</td><td>${money(monto)}</td></tr>
            <tr><td>Metodo</td><td>${metodo}</td></tr>
            ${referencia ? `<tr><td>Referencia</td><td>${referencia}</td></tr>` : ""}
            ${extras?.numeroEnvio ? `<tr><td>Numero de envio/guia</td><td>${extras.numeroEnvio}</td></tr>` : ""}
            ${extras?.numeroRecibo ? `<tr><td>Numero de recibo</td><td>${extras.numeroRecibo}</td></tr>` : ""}
            ${extras?.referenciaDocumento ? `<tr><td>Documento externo</td><td>${extras.referenciaDocumento}</td></tr>` : ""}
            ${extras?.observacionesPago ? `<tr><td>Observaciones</td><td>${extras.observacionesPago}</td></tr>` : ""}
            <tr><td>Tipo</td><td>${tipo}</td></tr>
          </tbody>
        </table>
        <script>window.onload = function(){ window.print(); }</script>
      </body></html>`;
    win.document.write(html);
    win.document.close();
  };

  const pagar = async (pedido: PedidoPago) => {
    const form = getForm(pedido);
    const monto = Number(form.monto || 0);
    const porcRecargo = metodoUsaRecargo(form.metodo) ? Number(form.porcentajeRecargo || 0) : 0;
    const recargo = monto * (porcRecargo / 100);
    const aplicado = monto + recargo;
    const saldo = Number(pedido.saldoPendiente || 0);

    if (monto <= 0) {
      Swal.fire("Validacion", "Ingresa un monto mayor a 0", "warning");
      return;
    }
    if (aplicado > saldo) {
      Swal.fire("Aviso", `El pago mas recargo excede el saldo (${money(saldo)}). Ajusta el monto.`, "info");
      return;
    }
    if (metodoRequiereReferencia(form.metodo) && !form.referencia.trim()) {
      Swal.fire("Validacion", "Ingresa la referencia o numero de transaccion del pago", "warning");
      return;
    }

    const confirm = await Swal.fire({
      title: "Confirmar pago",
      html: `
        <div style="text-align:left">
          <p><strong>Pedido:</strong> ${pedido.folio || `P-${pedido.id}`}</p>
          <p><strong>Monto:</strong> ${money(monto)}</p>
          ${recargo ? `<p><strong>Recargo:</strong> ${money(recargo)}</p>` : ""}
          <p><strong>Total a aplicar:</strong> ${money(aplicado)}</p>
          <p><strong>Metodo:</strong> ${form.metodo}</p>
          ${form.referencia.trim() ? `<p><strong>Referencia:</strong> ${form.referencia.trim()}</p>` : ""}
          ${hasExtraData(form) ? "<p><strong>Datos adicionales:</strong> registrados</p>" : ""}
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Si, registrar pago",
      cancelButtonText: "Revisar datos",
    });
    if (!confirm.isConfirmed) return;

    try {
      await api.post(`/produccion/${pedido.id}/pago`, {
        monto,
        metodo: form.metodo,
        tipo: "saldo",
        porcentajeRecargo: porcRecargo,
        referenciaPago: metodoRequiereReferencia(form.metodo) ? form.referencia.trim() : null,
        numeroEnvio: form.numeroEnvio.trim() || null,
        numeroRecibo: form.numeroRecibo.trim() || null,
        referenciaDocumento: form.referenciaDocumento.trim() || null,
        observacionesPago: form.observacionesPago.trim() || null,
      });
      generarPdfPago(pedido, aplicado, form.metodo, "saldo", form.referencia.trim(), form);
      Swal.fire("Pago registrado", "Saldo actualizado", "success");
      await cargar();
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo registrar pago";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ReceiptLongOutlined color="primary" />
          <Typography variant="h4">Pagos pedidos</Typography>
        </Stack>
        <Button startIcon={<RefreshOutlined />} variant="outlined" onClick={cargar} disabled={loading}>
          Recargar
        </Button>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        {canUseDropdown ? (
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Vendedor</InputLabel>
            <Select
              label="Vendedor"
              value={selectedVendedor}
              onChange={(e) => setSelectedVendedor(e.target.value)}
            >
              <MenuItem value="all">Todos</MenuItem>
              {vendedores.map((vendedor) => (
                <MenuItem key={vendedor} value={vendedor}>
                  {vendedor}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}

        <TextField
          label="Desde"
          type="date"
          size="small"
          value={filtroDesde}
          onChange={(e) => setFiltroDesde(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Hasta"
          type="date"
          size="small"
          value={filtroHasta}
          onChange={(e) => setFiltroHasta(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Stack>

      <Box display="grid" gap={2} gridTemplateColumns={{ xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }}>
        {pendientes.map((pedido) => {
          const totalPagado = (pedido.pagos || []).reduce((sum, pago) => sum + getPagoAplicado(pago), 0);
          const form = getForm(pedido);
          const usaRecargo = metodoUsaRecargo(form.metodo);
          const requiereReferencia = metodoRequiereReferencia(form.metodo);
          return (
            <Box key={pedido.id}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Typography variant="h6">{pedido.folio || `P-${pedido.id}`}</Typography>
                      <Chip label={pedido.estado === "pendiente_pago" ? "Pendiente de pago" : pedido.estado} color="warning" size="small" />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {pedido.cliente?.nombre || pedido.clienteNombre || "Mostrador"} | {pedido.bodega?.nombre || "N/D"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Vendedor: {pedido.vendedor || "-"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {pedido.fecha ? new Date(pedido.fecha).toLocaleString() : ""}
                    </Typography>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography>Total</Typography>
                      <Typography>{money(pedido.totalEstimado)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography>Pagado</Typography>
                      <Typography>{money(totalPagado)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography fontWeight={700}>Saldo</Typography>
                      <Typography fontWeight={700}>{money(pedido.saldoPendiente)}</Typography>
                    </Stack>
                    <Divider />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                      <TextField
                        label="Monto"
                        type="number"
                        size="small"
                        value={form.monto}
                        onChange={(e) => updateForm(pedido.id, { monto: Number(e.target.value) })}
                        sx={{ flex: 1 }}
                      />
                      <FormControl size="small" sx={{ flex: 1 }}>
                        <InputLabel>Metodo</InputLabel>
                        <Select
                          label="Metodo"
                          value={form.metodo}
                          onChange={(e) => {
                            const metodo = e.target.value;
                            updateForm(pedido.id, {
                              metodo,
                              referencia: metodo === "efectivo" ? "" : form.referencia,
                              porcentajeRecargo: metodoUsaRecargo(metodo) ? form.porcentajeRecargo : 0,
                            });
                          }}
                        >
                          <MenuItem value="efectivo">Efectivo</MenuItem>
                          <MenuItem value="tarjeta">Tarjeta</MenuItem>
                          <MenuItem value="visalink">Visalink</MenuItem>
                          <MenuItem value="transferencia">Transferencia</MenuItem>
                          <MenuItem value="deposito_bancario">Deposito bancario</MenuItem>
                        </Select>
                      </FormControl>
                    </Stack>
                    {usaRecargo && (
                      <TextField
                        label="Recargo %"
                        type="number"
                        size="small"
                        value={form.porcentajeRecargo}
                        onChange={(e) => updateForm(pedido.id, { porcentajeRecargo: Number(e.target.value) })}
                      />
                    )}
                    {requiereReferencia && (
                      <TextField
                        label="Referencia"
                        size="small"
                        value={form.referencia}
                        onChange={(e) => updateForm(pedido.id, { referencia: e.target.value })}
                        helperText="Numero de transaccion"
                      />
                    )}
                    <Button
                      variant={hasExtraData(form) ? "contained" : "outlined"}
                      color={hasExtraData(form) ? "secondary" : "primary"}
                      startIcon={<NoteAddOutlined />}
                      onClick={() => setExtrasPedido(pedido)}
                    >
                      {hasExtraData(form) ? "Datos adicionales agregados" : "Datos adicionales"}
                    </Button>
                    <Button variant="contained" startIcon={<PaidOutlined />} onClick={() => pagar(pedido)}>
                      Registrar pago
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          );
        })}
        {!pendientes.length && (
          <Box sx={{ gridColumn: "1 / -1" }}>
            <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
              <Typography color="text.secondary">No hay pedidos pendientes de pago.</Typography>
            </Paper>
          </Box>
        )}
      </Box>

      <Dialog open={Boolean(extrasPedido)} onClose={() => setExtrasPedido(null)} fullWidth maxWidth="sm">
        <DialogTitle>Datos adicionales del pago</DialogTitle>
        <DialogContent dividers>
          {extrasPedido ? (
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Estos datos son opcionales y ayudan a relacionar el pago con envios, recibos o documentos externos.
              </Typography>
              <TextField
                label="Numero de envio o guia"
                size="small"
                value={getForm(extrasPedido).numeroEnvio}
                onChange={(e) => updateForm(extrasPedido.id, { numeroEnvio: e.target.value })}
                fullWidth
              />
              <TextField
                label="Numero de recibo"
                size="small"
                value={getForm(extrasPedido).numeroRecibo}
                onChange={(e) => updateForm(extrasPedido.id, { numeroRecibo: e.target.value })}
                fullWidth
              />
              <TextField
                label="Referencia de otro documento"
                size="small"
                value={getForm(extrasPedido).referenciaDocumento}
                onChange={(e) => updateForm(extrasPedido.id, { referenciaDocumento: e.target.value })}
                helperText="Ej. numero de factura, deposito, voucher externo, orden o recibo relacionado"
                fullWidth
              />
              <TextField
                label="Observaciones del pago"
                size="small"
                value={getForm(extrasPedido).observacionesPago}
                onChange={(e) => updateForm(extrasPedido.id, { observacionesPago: e.target.value })}
                multiline
                minRows={3}
                fullWidth
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExtrasPedido(null)}>Cerrar</Button>
          <Button variant="contained" onClick={() => setExtrasPedido(null)}>
            Guardar datos
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
