import { useEffect, useMemo, useState } from "react";
import {
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Stack,
  Divider,
  IconButton,
  Autocomplete,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import PaymentIcon from "@mui/icons-material/Payment";
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
}

interface Bodega {
  id: number;
  nombre: string;
  ubicacion?: string | null;
}

interface DetalleRow {
  key: number;
  productoId: number | "";
  cantidad: number;
  precio: number;
  bordado: number;
  descuento: number;
  stock: number | null;
}

export default function VentaNueva() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [clienteId, setClienteId] = useState<number | "">("");
  const [bodegaId, setBodegaId] = useState<number | "">("");
  const [metodoPago, setMetodoPago] = useState<string>("efectivo");
  const [ubicacion, setUbicacion] = useState<string>("TIENDA");
  const [porcentajeRecargo, setPorcentajeRecargo] = useState<number>(0);
  const [observaciones, setObservaciones] = useState("");
  const [detalle, setDetalle] = useState<DetalleRow[]>([
    {
      key: Date.now(),
      productoId: "",
      cantidad: 1,
      precio: 0,
      bordado: 0,
      descuento: 0,
      stock: null,
    },
  ]);

  const navigate = useNavigate();
  const { usuario, rol, rolId, bodegaId: userBodegaId, bodegaNombre: authBodegaNombre } = useAuthStore();
  const { crossStoreRoleIds, fetchConfig } = useSystemConfigStore();
  const canAccessAllBodegas = rol === "ADMIN" || crossStoreRoleIds.includes(Number(rolId));

  const normalizarUbicacion = (val?: string | null) => {
    if (!val) return "";
    const upper = val.toString().toUpperCase();
    if (["TIENDA", "CAPITAL", "DEPARTAMENTO"].includes(upper)) return upper;
    return upper;
  };

  const cargarCatalogos = async () => {
    try {
      const [respCli, respProd, respBod] = await Promise.all([
        api.get("/clientes"),
        api.get("/productos"),
        api.get("/bodegas"),
      ]);
      setClientes(respCli.data);
      setProductos(respProd.data);
      setBodegas(respBod.data);
    } catch (error) {
      Swal.fire("Error", "No se pudieron cargar catï¿½logos", "error");
    }
  };

  useEffect(() => {
    cargarCatalogos();
    void fetchConfig();
  }, [fetchConfig]);

  // fijar bodega solo cuando catÃ¡logo estÃ© cargado y la bodega existe
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

  const onProductoChange = async (rowKey: number, productoId: number | "") => {
    if (!productoId) {
      setDetalle((prev) =>
        prev.map((r) =>
          r.key === rowKey
            ? { ...r, productoId: "", precio: 0, bordado: 0, descuento: 0, stock: null }
            : r
        )
      );
      return;
    }

    const prod = productos.find((p) => p.id === productoId);
    const precio = prod?.precio ?? 0;
    let stock: number | null = null;
    if (bodegaId) {
      stock = await fetchStock(Number(bodegaId), productoId as number);
    }

    setDetalle((prev) =>
      prev.map((r) =>
        r.key === rowKey
          ? {
              ...r,
              productoId: productoId as number,
              precio,
              bordado: 0,
              descuento: 0,
              stock,
            }
          : r
      )
    );
  };

  const onBodegaChange = async (value: number) => {
    setBodegaId(value);
    const selected = bodegas.find((b) => b.id === value);
    const ubic = normalizarUbicacion(selected?.ubicacion);
    if (ubic) {
      setUbicacion(ubic);
    }
    // refrescar stock en filas existentes
    const updated = await Promise.all(
      detalle.map(async (row) => {
        if (!row.productoId) return row;
        const stock = await fetchStock(value, row.productoId as number);
        return { ...row, stock };
      })
    );
    setDetalle(updated);
  };

  const addRow = () => {
    setDetalle((prev) => [
      ...prev,
      {
        key: Date.now(),
        productoId: "",
        cantidad: 1,
        precio: 0,
        bordado: 0,
        descuento: 0,
        stock: null,
      },
    ]);
  };

  const removeRow = (key: number) => {
    setDetalle((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  };

  const onCantidadChange = (key: number, value: number) => {
    setDetalle((prev) => prev.map((r) => (r.key === key ? { ...r, cantidad: value } : r)));
  };

  const onBordadoChange = (key: number, value: number) => {
    setDetalle((prev) => prev.map((r) => (r.key === key ? { ...r, bordado: value } : r)));
  };

  const onDescuentoChange = (key: number, value: number) => {
    setDetalle((prev) => prev.map((r) => (r.key === key ? { ...r, descuento: value } : r)));
  };

  const totals = useMemo(() => {
    const subtotal = detalle.reduce(
      (sum, item) =>
        sum +
        (Number(item.cantidad) || 0) *
          ((Number(item.precio) || 0) * (1 - (Number(item.descuento || 0) / 100)) +
            Number(item.bordado || 0)),
      0
    );
    const recargo = metodoPago === "tarjeta" ? subtotal * ((porcentajeRecargo || 0) / 100) : 0;
    const total = subtotal + recargo;
    return { subtotal, recargo, total };
  }, [detalle, metodoPago, porcentajeRecargo]);

  const calcularSubtotal = (item: DetalleRow) => {
    const precioConDescuento =
      (Number(item.precio) || 0) * (1 - (Number(item.descuento || 0) / 100));
    return (Number(item.cantidad) || 0) * (precioConDescuento + (Number(item.bordado) || 0));
  };

  const calcularTotalesDesdeDetalle = (detalleActual: DetalleRow[]) => {
    const subtotal = detalleActual.reduce((sum, item) => sum + calcularSubtotal(item), 0);
    const recargoCalculado =
      metodoPago === "tarjeta" ? subtotal * ((porcentajeRecargo || 0) / 100) : 0;
    return { subtotal, recargo: recargoCalculado, total: subtotal + recargoCalculado };
  };

  const abrirPdfVenta = (venta: any, detalleUsado: DetalleRow[]) => {
    const nuevaVentana = window.open("", "_blank");
    if (!nuevaVentana) {
      Swal.fire("Aviso", "Habilita las ventanas emergentes para ver el PDF", "info");
      return;
    }

    const clienteNombre =
      clientes.find((c) => c.id === (clienteId === "" ? null : Number(clienteId)))?.nombre ||
      "Consumidor final";
    const bodegaNombre =
      bodegas.find((b) => b.id === Number(bodegaId))?.nombre || authBodegaNombre || "N/D";
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

    const detalleFiltrado = detalle.filter((d) => d.productoId && d.cantidad > 0 && d.precio >= 0);
    if (detalleFiltrado.length === 0) {
      Swal.fire("Validaciï¿½n", "Agrega al menos un producto con cantidad", "warning");
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
      detalle: detalleFiltrado.map((d) => ({
        productoId: d.productoId,
        cantidad: d.cantidad,
        precio: d.precio,
        bordado: d.bordado,
        descuento: d.descuento,
      })),
    };

    try {
      const resp = await api.post("/ventas", payload);
      Swal.fire("Guardado", "Venta registrada", "success");
      abrirPdfVenta(resp.data, detalleFiltrado);
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
        <Grid size={{xs: 12, sm: 4}}>
          <Autocomplete
            options={clientes}
            getOptionLabel={(option) => option.nombre}
            value={clientes.find((c) => c.id === clienteId) || null}
            onChange={(_, val) => setClienteId(val ? val.id : "")}
            renderInput={(params) => <TextField {...params} label="Cliente" fullWidth />}
          />
        </Grid>
        <Grid size={{xs: 12, sm: 4}}>
          <FormControl fullWidth>
            <InputLabel>Bodega</InputLabel>
            <Select
              label="Bodega"
              value={bodegaId === "" ? "" : bodegaId}
              onChange={(e) => onBodegaChange(Number(e.target.value))}
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
        <Grid size={{xs: 12, sm: 4}}>
          <FormControl fullWidth>
            <InputLabel>Ubicacion</InputLabel>
            <Select label="Ubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)}>
              <MenuItem value="TIENDA">TIENDA</MenuItem>
              <MenuItem value="CAPITAL">CAPITAL</MenuItem>
              <MenuItem value="DEPARTAMENTO">DEPARTAMENTO</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{xs: 12, sm: 4}}>
          <FormControl fullWidth>
            <InputLabel>Método de pago</InputLabel>
            <Select
              label="Método de pago"
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
            >
              <MenuItem value="efectivo">Efectivo</MenuItem>
              <MenuItem value="tarjeta">Tarjeta</MenuItem>
              <MenuItem value="transferencia">Transferencia</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        {metodoPago === "tarjeta" && (
          <Grid size={{xs: 12, sm: 4}}>
            <TextField
              label="Recargo %"
              type="number"
              fullWidth
              value={porcentajeRecargo}
              onChange={(e) => setPorcentajeRecargo(Number(e.target.value))}
            />
          </Grid>
        )}
        <Grid size={{xs: 12}}>
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

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6">Detalle</Typography>
        <Button startIcon={<AddIcon />} onClick={addRow}>
          Agregar línea
        </Button>
      </Stack>

      {detalle.map((row) => (
        <Grid container spacing={2} alignItems="center" key={row.key} sx={{ mb: 1 }}>
          <Grid size={{xs: 12, sm: 4}}>
            <Autocomplete
              options={productos}
              getOptionLabel={(option) => `${option.codigo} - ${option.nombre}`}
              value={productos.find((p) => p.id === row.productoId) || null}
              onChange={(_, val) => onProductoChange(row.key, val ? val.id : "")}
              renderInput={(params) => <TextField {...params} label="Producto" />}
              fullWidth
            />
          </Grid>
          <Grid size={{xs: 12, sm: 2}}>
            <TextField
              label="Cantidad"
              type="number"
              fullWidth
              value={row.cantidad}
              onChange={(e) => onCantidadChange(row.key, Number(e.target.value))}
              helperText={row.stock != null ? `Stock: ${row.stock}` : ""}
            />
          </Grid>
          <Grid size={{xs: 12, sm: 2}}>
            <TextField
              label="Precio"
              type="number"
              fullWidth
              value={row.precio}
              inputProps={{ readOnly: true }}
              onChange={() => {}}
            />
          </Grid>
          <Grid size={{xs: 12, sm: 2}}>
            <TextField
              label="Bordado (extra)"
              type="number"
              fullWidth
              value={row.bordado}
              onChange={(e) => onBordadoChange(row.key, Number(e.target.value))}
            />
          </Grid>
          <Grid size={{xs: 12, sm: 2}}>
            <TextField
              label="Descuento %"
              type="number"
              fullWidth
              value={row.descuento}
              onChange={(e) => onDescuentoChange(row.key, Number(e.target.value))}
            />
          </Grid>
          <Grid size={{xs: 12, sm: 2}}>
            <Typography sx={{ mt: 1 }}>{`Subtotal: Q ${(
              (row.cantidad || 0) *
              ((row.precio || 0) * (1 - (row.descuento || 0) / 100) + (row.bordado || 0))
            ).toFixed(2)}`}</Typography>
          </Grid>
          <Grid size={{xs: 12, sm: 2}} textAlign="right">
            <IconButton
              color="error"
              onClick={() => removeRow(row.key)}
              disabled={detalle.length === 1}
            >
              <DeleteIcon />
            </IconButton>
          </Grid>
        </Grid>
      ))}

      <Divider sx={{ my: 2 }} />

      <Grid container spacing={2} justifyContent="flex-end">
        <Grid size={{xs: 12, sm: 4}}>
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
        <Button variant="outlined" onClick={() => navigate("/ventas")}>Cancelar</Button>
        <Button variant="contained" color="success" onClick={guardar}>
          Guardar venta
        </Button>
      </Stack>
    </Paper>
  );
}
