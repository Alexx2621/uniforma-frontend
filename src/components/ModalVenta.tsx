import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Grid,
} from "@mui/material";
import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { api } from "../api/axios";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function ModalVenta({ open, onClose, onSaved }: Props) {
  const [clientes, setClientes] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
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

      const existe = detalle.find((d) => d.productoId === prod.id);

      if (existe) {
        existe.cantidad++;
        existe.subtotal = existe.cantidad * existe.precio;
        setDetalle([...detalle]);
      } else {
        detalle.push({
          productoId: prod.id,
          nombre: prod.nombre,
          precio: prod.precio,
          cantidad: 1,
          subtotal: prod.precio,
        });
        setDetalle([...detalle]);
      }

      setBusqueda("");
    } catch {
      Swal.fire("No encontrado", "Producto no existe", "warning");
    }
  };

  const actualizarCantidad = (i: number, cantidad: number) => {
    detalle[i].cantidad = cantidad;
    detalle[i].subtotal = cantidad * detalle[i].precio;
    setDetalle([...detalle]);
  };

  const eliminarItem = (i: number) => {
    detalle.splice(i, 1);
    setDetalle([...detalle]);
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
                setForm({ ...form, clienteId: e.target.value })
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
                setForm({ ...form, metodoPago: e.target.value })
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
                setForm({ ...form, observaciones: e.target.value })
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

        {/* Tabla productos */}
        <table className="table" style={{ marginTop: 15 }}>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Precio</th>
              <th>Cant</th>
              <th>Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {detalle.map((r, i) => (
              <tr key={i}>
                <td>{r.nombre}</td>
                <td>Q {r.precio}</td>
                <td>
                  <input
                    type="number"
                    value={r.cantidad}
                    min={1}
                    onChange={(e) =>
                      actualizarCantidad(i, Number(e.target.value))
                    }
                    style={{ width: 60 }}
                  />
                </td>
                <td>Q {r.subtotal}</td>
                <td>
                  <Button color="error" onClick={() => eliminarItem(i)}>
                    X
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Total */}
        <h3 style={{ textAlign: "right" }}>
          Total: <b>Q {total.toFixed(2)}</b>
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
