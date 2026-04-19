import { useEffect, useMemo, useState } from "react";
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
  IconButton,
  Divider,
  Stack,
  Box,
  Autocomplete,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";

interface DetalleRow {
  key: number;
  productoId: number | "";
  cantidad: number;
  stockMax: number | null;
  stockActual: number | null;
}

export default function IngresoInventario() {
  const [bodegas, setBodegas] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [bodegaId, setBodegaId] = useState<number | "">("");
  const [observaciones, setObservaciones] = useState("");
  const [detalle, setDetalle] = useState<DetalleRow[]>([
    { key: Date.now(), productoId: "", cantidad: 0, stockMax: null, stockActual: null },
  ]);
  const { usuario } = useAuthStore();

  const cargarCatalogos = async () => {
    try {
      const [respBod, respProd] = await Promise.all([
        api.get("/bodegas"),
        api.get("/productos"),
      ]);
      setBodegas(respBod.data);
      setProductos(respProd.data);
    } catch (error) {
      Swal.fire("Error", "No se pudieron cargar bodegas o productos", "error");
    }
  };

  const { rol, bodegaId: userBodegaId } = useAuthStore();

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    if (userBodegaId && rol !== "ADMIN") {
      const parsed = Number(userBodegaId);
      const exists = bodegas.some((b) => b.id === parsed);
      setBodegaId(exists ? parsed : "");
    }
  }, [userBodegaId, rol, bodegas]);

  const addRow = () => {
    setDetalle((prev) => [
      ...prev,
      { key: Date.now(), productoId: "", cantidad: 0, stockMax: null, stockActual: null },
    ]);
  };

  const removeRow = (key: number) => {
    setDetalle((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  };

  const fetchStockActual = async (bodega: number, producto: number) => {
    if (!bodega || !producto) return null;
    try {
      const resp = await api.get(`/inventario/${bodega}/${producto}`);
      return resp.data?.stock ?? 0;
    } catch {
      return null;
    }
  };

  const refreshRowStock = async (key: number, productoId: number | "") => {
    if (!bodegaId || productoId === "") {
      setDetalle((prev) =>
        prev.map((row) =>
          row.key === key
            ? { ...row, productoId, stockMax: null, stockActual: null }
            : row
        )
      );
      return;
    }

    const prod = productos.find((p) => p.id === Number(productoId));
    const stockActual = await fetchStockActual(Number(bodegaId), Number(productoId));

    setDetalle((prev) =>
      prev.map((row) =>
        row.key === key
          ? {
              ...row,
              productoId: Number(productoId),
              stockMax: prod?.stockMax ?? null,
              stockActual,
            }
          : row
      )
    );
  };

  const onProductoChange = (key: number, value: number | "") => {
    refreshRowStock(key, value);
  };

  const onCantidadChange = (key: number, value: number) => {
    setDetalle((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const max = row.stockMax ?? Infinity;
        const safe = Math.min(value, max);
        if (value > max && max !== Infinity) {
          Swal.fire("Aviso", `No puedes ingresar mas de ${max} unidades para este producto`, "info");
        }
        return { ...row, cantidad: safe };
      })
    );
  };

  const totalItems = useMemo(
    () => detalle.reduce((sum, r) => sum + (Number(r.cantidad) || 0), 0),
    [detalle]
  );

  const abrirPdfIngreso = (ingreso: any, detalleUsado: DetalleRow[]) => {
    const nuevaVentana = window.open("", "_blank");
    if (!nuevaVentana) {
      Swal.fire("Aviso", "Habilita las ventanas emergentes para ver el PDF", "info");
      return;
    }

    const bodegaNombre = bodegas.find((b) => b.id === Number(bodegaId))?.nombre || "N/D";
    const fecha = ingreso?.fecha ? new Date(ingreso.fecha) : new Date();
    const folio = ingreso?.id ? `ING-${ingreso.id}` : "Pendiente";
    const responsable = usuario || "Responsable";

    const filasHtml = detalleUsado
      .map((item, idx) => {
        const producto = productos.find((p) => p.id === item.productoId);
        return `<tr>
            <td>${idx + 1}</td>
            <td>${producto?.codigo || item.productoId}</td>
            <td>${producto?.nombre || "Producto"}</td>
            <td>${item.cantidad}</td>
          </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Ingreso de inventario</title>
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
            .footer { margin-top: 20px; font-size: 12px; color: #475569; }
            .badge { display: inline-flex; padding: 4px 10px; border-radius: 999px; background: #e2e8f0; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="brand">Uniforma</div>
              <div>Ingreso de inventario</div>
            </div>
            <div style="text-align:right">
              <div class="folio">${folio}</div>
              <div>${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString()}</div>
            </div>
          </div>

          <div class="section">
            <h3>Resumen</h3>
            <div class="info-grid">
              <div><strong>Bodega:</strong> ${bodegaNombre}</div>
              <div><strong>Total items:</strong> ${totalItems}</div>
              <div><strong>Responsable:</strong> ${responsable}</div>
              <div><strong>Observaciones:</strong> ${observaciones || "N/A"}</div>
            </div>
          </div>

          <div class="section">
            <h3>Articulos ingresados</h3>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Codigo</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                ${filasHtml}
              </tbody>
            </table>
          </div>

          <div class="footer">
            <div class="badge">Ingreso registrado</div>
            <div>Generado automaticamente por Uniforma. Conserve este comprobante.</div>
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

  const onBodegaChange = async (newBodegaId: number) => {
    setBodegaId(newBodegaId);
    // actualizar stockActual para las filas con producto ya seleccionado
    const updates = await Promise.all(
      detalle.map(async (row) => {
        if (!row.productoId) return row;
        const prod = productos.find((p) => p.id === row.productoId);
        const stockActual = await fetchStockActual(newBodegaId, row.productoId);
        return { ...row, stockMax: prod?.stockMax ?? null, stockActual };
      })
    );
    setDetalle(updates);
  };

  const guardar = async () => {
    const detalleFiltrado = detalle.filter((d) => d.productoId && d.cantidad > 0);
    if (!bodegaId) {
      Swal.fire("Validacion", "Selecciona una bodega", "warning");
      return;
    }
    if (detalleFiltrado.length === 0) {
      Swal.fire("Validacion", "Agrega al menos un producto con cantidad mayor a 0", "warning");
      return;
    }

    const invalid = detalleFiltrado.find(
      (d) => d.stockMax != null && d.cantidad > (d.stockMax ?? Infinity)
    );
    if (invalid) {
      Swal.fire(
        "Validacion",
        "Hay cantidades que superan el stock maximo permitido para un producto",
        "warning"
      );
      return;
    }

    const payload = {
      bodegaId: Number(bodegaId),
      observaciones: observaciones || null,
      detalle: detalleFiltrado.map((d) => ({
        productoId: d.productoId,
        cantidad: d.cantidad,
      })),
    };

    try {
      const resp = await api.post("/ingresos", payload);
      Swal.fire("Guardado", "Ingreso registrado", "success");
      abrirPdfIngreso(resp.data, detalleFiltrado);
      setDetalle([
        { key: Date.now(), productoId: "", cantidad: 0, stockMax: null, stockActual: null },
      ]);
      setObservaciones("");
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo guardar";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Ingreso de inventario
      </Typography>
      <Divider sx={{ mb: 2 }} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel>Bodega</InputLabel>
            <Select
              label="Bodega"
              value={bodegaId === "" ? "" : bodegaId}
              onChange={(e) => onBodegaChange(Number(e.target.value))}
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

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6">Detalle</Typography>
        <Button startIcon={<AddIcon />} onClick={addRow}>
          Agregar linea
        </Button>
      </Stack>

      <Box sx={{ border: "1px solid #e0e0e0", borderRadius: 2, p: 2 }}>
        {detalle.map((row) => (
          <Grid container spacing={2} alignItems="center" key={row.key} sx={{ mb: 1 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Autocomplete
                options={productos}
                getOptionLabel={(option: any) => `${option.codigo} - ${option.nombre}`}
                value={productos.find((p) => p.id === row.productoId) || null}
                onChange={(_, newValue) =>
                  onProductoChange(row.key, newValue ? newValue.id : "")
                }
                renderInput={(params) => <TextField {...params} label="Producto" />}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Cantidad"
                type="number"
                fullWidth
                value={row.cantidad}
                onChange={(e) => onCantidadChange(row.key, Number(e.target.value))}
                helperText={
                  row.stockMax != null
                    ? `Actual: ${row.stockActual ?? 0} | Max: ${row.stockMax}`
                    : `Actual: ${row.stockActual ?? 0} | Sin limite definido`
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Box />
            </Grid>
            <Grid size={{ xs: 12, sm: 2 }} textAlign="right">
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
      </Box>

      <Stack direction="row" justifyContent="space-between" sx={{ mt: 2 }}>
        <Typography>Total items: {totalItems}</Typography>
        <Button variant="contained" color="success" onClick={guardar}>
          Guardar ingreso
        </Button>
      </Stack>
    </Paper>
  );
}
