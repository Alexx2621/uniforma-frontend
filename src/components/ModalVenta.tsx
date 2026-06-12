import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { formatCurrency } from "../utils/currency";
import { emptyWhenZero, parseNumberInput } from "../utils/numberInputs";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function ModalVenta({ open, onClose, onSaved }: Props) {
  const [clientes, setClientes] = useState<any[]>([]);
  const [detalle, setDetalle] = useState<any[]>([]);

  const [form, setForm] = useState({
    clienteId: "",
    metodoPago: "EFECTIVO",
    observaciones: "",
  });

  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    cargarClientes();
  }, []);

  const cargarClientes = async () => {
    const resp = await api.get("/clientes");
    setClientes(resp.data);
  };

  const buscarProducto = async () => {
    if (!busqueda) return;
    try {
      const resp = await api.get(`/productos/codigo/${busqueda}`);
      const prod = resp.data;

      setDetalle((prev) => {
        const existe = prev.find((d) => d.productoId === prod.id);
        if (existe) {
          return prev.map((item) => {
            if (item.productoId !== prod.id) return item;
            const cantidad = Number(item.cantidad || 0) + 1;
            return {
              ...item,
              cantidad,
              subtotal: cantidad * Number(item.precio || 0),
            };
          });
        }

        return [
          ...prev,
          {
            productoId: prod.id,
            nombre: prod.nombre,
            precio: prod.precio,
            cantidad: 1,
            subtotal: prod.precio,
          },
        ];
      });

      setBusqueda("");
    } catch {
      Swal.fire("No encontrado", "Producto no existe", "warning");
    }
  };

  const actualizarCantidad = (productoId: number, cantidad: number) => {
    setDetalle((prev) =>
      prev.map((item) =>
        item.productoId === productoId
          ? { ...item, cantidad, subtotal: cantidad * Number(item.precio || 0) }
          : item
      )
    );
  };

  const eliminarItem = (productoId: number) => {
    setDetalle((prev) => prev.filter((item) => item.productoId !== productoId));
  };

  const total = detalle.reduce((acc, r) => acc + r.subtotal, 0);

  const guardarVenta = async () => {
    try {
      await api.post("/ventas", {
        clienteId: Number(form.clienteId),
        metodoPago: form.metodoPago,
        observaciones: form.observaciones,
        detalle: detalle.map((d) => ({
          productoId: d.productoId,
          cantidad: d.cantidad,
          precio: d.precio,
        })),
      });

      Swal.fire("Éxito", "Venta guardada", "success");
      onSaved();
      onClose();
    } catch (e) {
      Swal.fire("Error", "No se pudo guardar", "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Nueva Venta</DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={2}>
          {/* Cliente */}
          <Grid size={{xs:6}}>
            <TextField
              select
              label="Cliente"
              fullWidth
              value={form.clienteId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, clienteId: e.target.value }))
              }
            >
              {clientes.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.nombre}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          {/* Metodo Pago */}
          <Grid size={{xs:6}}>
            <TextField
              select
              label="Método Pago"
              fullWidth
              value={form.metodoPago}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, metodoPago: e.target.value }))
              }
            >
              <MenuItem value="EFECTIVO">Efectivo</MenuItem>
              <MenuItem value="TARJETA">Tarjeta</MenuItem>
              <MenuItem value="TRANSFERENCIA">Transferencia</MenuItem>
            </TextField>
          </Grid>

          {/* Observaciones */}
          <Grid size={{xs:12}}>
            <TextField
              label="Observaciones"
              fullWidth
              multiline
              rows={2}
              value={form.observaciones}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, observaciones: e.target.value }))
              }
            />
          </Grid>

          {/* Buscar producto */}
          <Grid size={{xs:9}}>
            <TextField
              label="Código producto"
              fullWidth
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </Grid>
          <Grid size={{xs:3}}>
            <Button fullWidth onClick={buscarProducto} variant="outlined">
              Buscar
            </Button>
          </Grid>
        </Grid>

        <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Producto</TableCell>
                <TableCell align="right">Precio</TableCell>
                <TableCell align="center" sx={{ width: 120 }}>Cant.</TableCell>
                <TableCell align="right">Subtotal</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {detalle.map((r) => (
                <TableRow key={r.productoId} hover>
                  <TableCell>{r.nombre}</TableCell>
                  <TableCell align="right">{formatCurrency(r.precio)}</TableCell>
                  <TableCell align="center">
                    <TextField
                      type="number"
                      size="small"
                      aria-label={`Cantidad de ${r.nombre}`}
                      value={emptyWhenZero(r.cantidad)}
                      inputProps={{ min: 1, style: { textAlign: "center" } }}
                      onChange={(e) => actualizarCantidad(r.productoId, parseNumberInput(e.target.value))}
                    />
                  </TableCell>
                  <TableCell align="right">{formatCurrency(r.subtotal)}</TableCell>
                  <TableCell align="right">
                    <Button color="error" onClick={() => eliminarItem(r.productoId)}>
                      Eliminar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!detalle.length && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    Aun no has agregado productos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Total */}
        <h3 style={{ textAlign: "right" }}>
          Total: <b>{formatCurrency(total)}</b>
        </h3>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={guardarVenta} variant="contained">
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
