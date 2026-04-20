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
  Autocomplete,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { useSystemConfigStore } from "../config/useSystemConfigStore";

interface DetalleRow {
  key: number;
  productoId: number | "";
  cantidad: number;
  stockOrigen: number | null;
  stockMaxDestino: number | null;
}

export default function Traslados() {
  const [bodegas, setBodegas] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [desdeBodegaId, setDesdeBodegaId] = useState<number | "">("");
  const [haciaBodegaId, setHaciaBodegaId] = useState<number | "">("");
  const [observaciones, setObservaciones] = useState("");
  const [detalle, setDetalle] = useState<DetalleRow[]>([
    { key: Date.now(), productoId: "", cantidad: 0, stockOrigen: null, stockMaxDestino: null },
  ]);
  const { rol, rolId, bodegaId: userBodegaId } = useAuthStore();
  const { usuario } = useAuthStore();
  const { crossStoreRoleIds, fetchConfig } = useSystemConfigStore();
  const canAccessAllBodegas = rol === "ADMIN" || crossStoreRoleIds.includes(Number(rolId));

  const cargarCatalogos = async () => {
    try {
      const [respBod, respProd] = await Promise.all([api.get("/bodegas"), api.get("/productos")]);
      setBodegas(respBod.data);
      setProductos(respProd.data);
    } catch (error) {
      Swal.fire("Error", "No se pudieron cargar bodegas o productos", "error");
    }
  };

  useEffect(() => {
    cargarCatalogos();
    void fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (userBodegaId && !canAccessAllBodegas) {
      const parsed = Number(userBodegaId);
      const exists = bodegas.some((b) => b.id === parsed);
      setDesdeBodegaId(exists ? parsed : "");
    }
  }, [userBodegaId, canAccessAllBodegas, bodegas]);

  const fetchStock = async (bodega: number, producto: number) => {
    try {
      const resp = await api.get(`/inventario/${bodega}/${producto}`);
      return resp.data?.stock ?? 0;
    } catch {
      return 0;
    }
  };

  const refreshRow = async (rowKey: number, productoId: number | "") => {
    if (productoId === "" || !desdeBodegaId) {
      setDetalle((prev) =>
        prev.map((r) =>
          r.key === rowKey
            ? { ...r, productoId, stockOrigen: null, stockMaxDestino: null, cantidad: 0 }
            : r
        )
      );
      return;
    }

    const prod = productos.find((p) => p.id === Number(productoId));
    const origen = await fetchStock(Number(desdeBodegaId), Number(productoId));
    const stockMax = prod?.stockMax ?? null;

    setDetalle((prev) =>
      prev.map((r) =>
        r.key === rowKey
          ? {
              ...r,
              productoId: Number(productoId),
              stockOrigen: origen,
              stockMaxDestino: stockMax,
              cantidad: 0,
            }
          : r
      )
    );
  };

  const onBodegaChange = async (dir: "desde" | "hacia", value: number) => {
    if (dir === "desde") {
      setDesdeBodegaId(value);
      // refrescar stocks en filas
      const updates = await Promise.all(
        detalle.map(async (row) => {
          if (!row.productoId) return row;
          const origen = await fetchStock(value, row.productoId as number);
          const prod = productos.find((p) => p.id === row.productoId);
          return { ...row, stockOrigen: origen, stockMaxDestino: prod?.stockMax ?? null };
        })
      );
      setDetalle(updates);
    } else {
      setHaciaBodegaId(value);
    }
  };

  const addRow = () => {
    setDetalle((prev) => [
      ...prev,
      { key: Date.now(), productoId: "", cantidad: 0, stockOrigen: null, stockMaxDestino: null },
    ]);
  };

  const removeRow = (key: number) => {
    setDetalle((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  };

  const onCantidadChange = (key: number, value: number) => {
    setDetalle((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const maxSalida = row.stockOrigen ?? 0;
        const safe = Math.min(value, maxSalida);
        if (value > maxSalida) {
          Swal.fire("Aviso", `Solo hay ${maxSalida} en bodega origen`, "info");
        }
        return { ...row, cantidad: safe };
      })
    );
  };

  const totalItems = useMemo(() => detalle.reduce((sum, r) => sum + (Number(r.cantidad) || 0), 0), [detalle]);

  const abrirPdfTraslado = (traslado: any, detalleUsado: DetalleRow[]) => {
    const nuevaVentana = window.open("", "_blank");
    if (!nuevaVentana) {
      Swal.fire("Aviso", "Habilita las ventanas emergentes para ver el PDF", "info");
      return;
    }

    const origenNombre =
      traslado?.desdeBodega?.nombre ||
      bodegas.find((b) => b.id === Number(desdeBodegaId))?.nombre ||
      "Origen";
    const destinoNombre =
      traslado?.haciaBodega?.nombre ||
      bodegas.find((b) => b.id === Number(haciaBodegaId))?.nombre ||
      "Destino";
    const fecha = traslado?.fecha ? new Date(traslado.fecha) : new Date();
    const folio = traslado?.id ? `TR-${traslado.id}` : "Pendiente";
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
          <title>Traslado de inventario</title>
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
              <div>Traslado de inventario</div>
            </div>
            <div style="text-align:right">
              <div class="folio">${folio}</div>
              <div>${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString()}</div>
            </div>
          </div>

          <div class="section">
            <h3>Resumen</h3>
            <div class="info-grid">
              <div><strong>Origen:</strong> ${origenNombre}</div>
              <div><strong>Destino:</strong> ${destinoNombre}</div>
              <div><strong>Total items:</strong> ${totalItems}</div>
              <div><strong>Responsable:</strong> ${responsable}</div>
              <div><strong>Observaciones:</strong> ${observaciones || "N/A"}</div>
            </div>
          </div>

          <div class="section">
            <h3>Detalle de traslado</h3>
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
            <div class="badge">Traslado registrado</div>
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

  const guardar = async () => {
    if (!desdeBodegaId || !haciaBodegaId) {
      Swal.fire("Validacion", "Selecciona bodega origen y destino", "warning");
      return;
    }
    if (desdeBodegaId === haciaBodegaId) {
      Swal.fire("Validacion", "Las bodegas deben ser diferentes", "warning");
      return;
    }

    const detalleFiltrado = detalle.filter((d) => d.productoId && d.cantidad > 0);
    if (detalleFiltrado.length === 0) {
      Swal.fire("Validacion", "Agrega al menos un producto con cantidad mayor a 0", "warning");
      return;
    }

    const payload = {
      desdeBodegaId: Number(desdeBodegaId),
      haciaBodegaId: Number(haciaBodegaId),
      observaciones: observaciones || null,
      detalle: detalleFiltrado.map((d) => ({ productoId: d.productoId, cantidad: d.cantidad })),
    };

    try {
      const resp = await api.post("/traslados", payload);
      Swal.fire("Guardado", "Traslado registrado", "success");
      abrirPdfTraslado(resp.data, detalleFiltrado);
      setDetalle([
        { key: Date.now(), productoId: "", cantidad: 0, stockOrigen: null, stockMaxDestino: null },
      ]);
      setObservaciones("");
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo guardar";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <SwapHorizIcon />
        <Typography variant="h4">Traslados entre bodegas</Typography>
      </Stack>
      <Divider sx={{ mb: 2 }} />

      <Grid container spacing={2}>
        <Grid size={{xs: 12, sm: 4}}>
          <FormControl fullWidth>
            <InputLabel>Bodega origen</InputLabel>
            <Select
              label="Bodega origen"
              value={desdeBodegaId === "" ? "" : desdeBodegaId}
              onChange={(e) => onBodegaChange("desde", Number(e.target.value))}
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
            <InputLabel>Bodega destino</InputLabel>
            <Select
              label="Bodega destino"
              value={haciaBodegaId === "" ? "" : haciaBodegaId}
              onChange={(e) => onBodegaChange("hacia", Number(e.target.value))}
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
          <TextField
            label="Observaciones"
            fullWidth
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6">Detalle</Typography>
        <Button startIcon={<AddIcon />} onClick={addRow}>
          Agregar l�nea
        </Button>
      </Stack>

      {detalle.map((row) => (
        <Grid container spacing={2} alignItems="center" key={row.key} sx={{ mb: 1 }}>
          <Grid size={{xs: 12, sm: 4}}>
            <Autocomplete
              options={productos}
              getOptionLabel={(option: any) => `${option.codigo} - ${option.nombre}`}
              value={productos.find((p) => p.id === row.productoId) || null}
              onChange={(_, newValue) => refreshRow(row.key, newValue ? newValue.id : "")}
              renderInput={(params) => <TextField {...params} label="Producto" />}
              fullWidth
            />
          </Grid>
          <Grid size={{xs: 12, sm: 3}}>
            <TextField
              label="Cantidad"
              type="number"
              fullWidth
              value={row.cantidad}
              onChange={(e) => onCantidadChange(row.key, Number(e.target.value))}
              helperText={`Origen: ${row.stockOrigen ?? 0}${
                row.stockMaxDestino ? ` | Max destino: ${row.stockMaxDestino}` : ""
              }`}
            />
          </Grid>
          <Grid size={{xs: 12, sm: 3}}></Grid>
          <Grid size={{xs: 12, sm: 3}} textAlign="right">
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

      <Stack direction="row" justifyContent="space-between" sx={{ mt: 2 }}>
        <Typography>Total items: {totalItems}</Typography>
        <Button variant="contained" color="success" onClick={guardar}>
          Guardar traslado
        </Button>
      </Stack>
    </Paper>
  );
}
