import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { formatCurrency } from "../utils/currency";

export default function OrdenMixtaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [orden, setOrden] = useState<any>(null);
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [pago, setPago] = useState({
    monto: 0,
    metodo: "efectivo",
    ubicacion: "TIENDA",
    referencia: "",
    banco: "",
    numeroRecibo: "",
    observacionesPago: "",
  });

  const cargar = useCallback(async () => {
    if (!id) return;
    const { data } = await api.get(`/orden-mixta/${id}`);
    setOrden(data);
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!orden) return;
    setPago((prev) => ({
      ...prev,
      monto: Number(orden.saldoTotal || 0),
      ubicacion: orden.ubicacion || prev.ubicacion || "TIENDA",
    }));
  }, [orden]);

  const metodoRequiereReferencia = useMemo(() => pago.metodo !== "efectivo", [pago.metodo]);
  const saldoTotal = Number(orden?.saldoTotal || 0);
  const saldoVenta = Number(orden?.saldoVenta || 0);
  const saldoPedido = Number(orden?.saldoPedido || 0);

  const registrarPago = async () => {
    const monto = Number(pago.monto || 0);
    if (monto <= 0) {
      Swal.fire("Validacion", "Ingresa un monto mayor a 0", "warning");
      return;
    }
    if (monto > saldoTotal) {
      Swal.fire("Validacion", `El pago no puede superar el saldo pendiente ${formatCurrency(saldoTotal)}`, "warning");
      return;
    }
    if (metodoRequiereReferencia && !pago.referencia.trim()) {
      Swal.fire("Validacion", "Ingresa la referencia del pago", "warning");
      return;
    }
    if (pago.metodo === "deposito_bancario" && !pago.banco.trim()) {
      Swal.fire("Validacion", "Ingresa el banco del deposito", "warning");
      return;
    }

    const confirmar = await Swal.fire({
      title: "Registrar pago",
      text: `Se aplicaran ${formatCurrency(monto)} entre la venta y el pedido relacionados a esta orden mixta.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Registrar",
      cancelButtonText: "Cancelar",
    });
    if (!confirmar.isConfirmed) return;

    try {
      setGuardandoPago(true);
      const { data } = await api.post(`/orden-mixta/${id}/pago`, pago);
      setOrden(data.orden);
      setPago((prev) => ({
        ...prev,
        monto: Number(data.orden?.saldoTotal || 0),
        referencia: "",
        banco: "",
        numeroRecibo: "",
        observacionesPago: "",
      }));
      await Swal.fire("Pago registrado", "La orden mixta y sus documentos relacionados fueron actualizados.", "success");
    } catch (error: any) {
      const msg = error?.response?.data?.message || "No se pudo registrar el pago";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    } finally {
      setGuardandoPago(false);
    }
  };

  if (!orden) {
    return <Typography>Cargando orden mixta...</Typography>;
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <div>
          <Typography variant="h4">{orden.folio}</Typography>
          <Typography variant="body2" color="text.secondary">
            {orden.clienteNombre} | {new Date(orden.fecha).toLocaleString()}
          </Typography>
        </div>
        <Button variant="outlined" startIcon={<ArrowBackOutlined />} onClick={() => navigate("/orden-mixta")}>
          Volver
        </Button>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="caption">Total</Typography>
            <Typography variant="h5">{formatCurrency(orden.total)}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="caption">Venta inventario</Typography>
            <Typography variant="h5">{formatCurrency(orden.subtotalVenta)}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="caption">Pedido produccion</Typography>
            <Typography variant="h5">{formatCurrency(orden.subtotalPedido)}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="caption">Saldo</Typography>
            <Typography variant="h5">{formatCurrency(orden.saldoTotal)}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}>
            <div>
              <Typography variant="h6">Cancelar saldo de orden mixta</Typography>
              <Typography variant="body2" color="text.secondary">
                El pago se distribuye contra los documentos abiertos relacionados a esta orden.
              </Typography>
            </div>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip label={`Saldo venta: ${formatCurrency(saldoVenta)}`} color={saldoVenta > 0 ? "primary" : "default"} />
              <Chip label={`Saldo pedido: ${formatCurrency(saldoPedido)}`} color={saldoPedido > 0 ? "success" : "default"} />
              <Chip label={`Saldo total: ${formatCurrency(saldoTotal)}`} color={saldoTotal > 0 ? "warning" : "default"} />
            </Stack>
          </Stack>

          {saldoTotal <= 0 ? (
            <Alert severity="success">Esta orden mixta ya no tiene saldo pendiente.</Alert>
          ) : (
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Monto"
                  value={pago.monto}
                  onChange={(e) => setPago((prev) => ({ ...prev, monto: Number(e.target.value) }))}
                  inputProps={{ min: 0, step: "0.01" }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Metodo</InputLabel>
                  <Select label="Metodo" value={pago.metodo} onChange={(e) => setPago((prev) => ({ ...prev, metodo: String(e.target.value) }))}>
                    <MenuItem value="efectivo">Efectivo</MenuItem>
                    <MenuItem value="transferencia">Transferencia</MenuItem>
                    <MenuItem value="deposito_bancario">Deposito bancario</MenuItem>
                    <MenuItem value="tarjeta">Tarjeta</MenuItem>
                    <MenuItem value="visalink">Visalink</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Ubicacion</InputLabel>
                  <Select label="Ubicacion" value={pago.ubicacion} onChange={(e) => setPago((prev) => ({ ...prev, ubicacion: String(e.target.value) }))}>
                    <MenuItem value="TIENDA">Tienda</MenuItem>
                    <MenuItem value="CAPITAL">Capital / Mensajero</MenuItem>
                    <MenuItem value="DEPARTAMENTO">Departamento / Cargo expreso</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {metodoRequiereReferencia && (
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    fullWidth
                    label="Referencia"
                    value={pago.referencia}
                    onChange={(e) => setPago((prev) => ({ ...prev, referencia: e.target.value }))}
                  />
                </Grid>
              )}
              {pago.metodo === "deposito_bancario" && (
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    fullWidth
                    label="Banco"
                    value={pago.banco}
                    onChange={(e) => setPago((prev) => ({ ...prev, banco: e.target.value }))}
                  />
                </Grid>
              )}
              <Grid size={{ xs: 12, md: 2 }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<PaymentsOutlined />}
                  onClick={registrarPago}
                  disabled={guardandoPago}
                  sx={{ minHeight: 48 }}
                >
                  Registrar pago
                </Button>
              </Grid>
            </Grid>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          {orden.venta?.folio && (
            <Button variant="outlined" startIcon={<OpenInNewOutlined />} onClick={() => navigate("/ventas")}>
              Venta {orden.venta.folio}
            </Button>
          )}
          {orden.pedido?.folio && (
            <Button variant="outlined" startIcon={<OpenInNewOutlined />} onClick={() => navigate(`/produccion/${orden.pedido.id}`)}>
              Pedido {orden.pedido.folio}
            </Button>
          )}
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Operacion</TableCell>
                <TableCell>Codigo</TableCell>
                <TableCell>Producto</TableCell>
                <TableCell>Cantidad</TableCell>
                <TableCell>Precio</TableCell>
                <TableCell>Bordado</TableCell>
                <TableCell>Descuento</TableCell>
                <TableCell>Subtotal</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(orden.detalle || []).map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Chip size="small" color={item.tipoOperacion === "venta" ? "primary" : "success"} label={item.tipoOperacion === "venta" ? "Inventario" : "Produccion"} />
                  </TableCell>
                  <TableCell>{item.producto?.codigo || item.productoId}</TableCell>
                  <TableCell>{item.producto?.nombre || "Producto"}</TableCell>
                  <TableCell>{item.cantidad}</TableCell>
                  <TableCell>{formatCurrency(item.precioUnit)}</TableCell>
                  <TableCell>{formatCurrency(item.bordado)}</TableCell>
                  <TableCell>{item.descuento}%</TableCell>
                  <TableCell>{formatCurrency(item.subtotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Stack>
  );
}
