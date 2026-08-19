import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Alert,
  Paper,
  Typography,
  Stack,
  Button,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Chip,
} from "@mui/material";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import WarehouseOutlined from "@mui/icons-material/WarehouseOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { hasPermission } from "../auth/permissions";
import UniformaTableLoadingRow from "../components/UniformaTableLoadingRow";
import { useTablePagination } from "../utils/useTablePagination";

interface Bodega {
  id: number;
  nombre: string;
  ubicacion?: string | null;
  tipo?: string | null;
  activa?: boolean;
  permiteVentas?: boolean;
  usaInventarioVentas?: boolean;
  permitePedidos?: boolean;
  permiteTraslados?: boolean;
  visibleVendedores?: boolean;
  requiereAutorizacion?: boolean;
  esTransito?: boolean;
  permiteIngresos?: boolean;
  ordenPrioridad?: number;
  observaciones?: string | null;
  _count?: { inventario?: number; usuarios?: number; usuariosPermitidos?: number; ventas?: number };
}

const tiposBodega = ["tienda", "disparejos", "produccion", "general", "apartados", "otros"];

export default function Bodegas() {
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Bodega | null>(null);
  const [nombre, setNombre] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [tipo, setTipo] = useState("tienda");
  const [activa, setActiva] = useState(true);
  const [permiteVentas, setPermiteVentas] = useState(true);
  const [usaInventarioVentas, setUsaInventarioVentas] = useState(false);
  const [permitePedidos, setPermitePedidos] = useState(true);
  const [permiteTraslados, setPermiteTraslados] = useState(true);
  const [visibleVendedores, setVisibleVendedores] = useState(false);
  const [requiereAutorizacion, setRequiereAutorizacion] = useState(false);
  const [esTransito, setEsTransito] = useState(false);
  const [permiteIngresos, setPermiteIngresos] = useState(true);
  const [ordenPrioridad, setOrdenPrioridad] = useState("100");
  const [observaciones, setObservaciones] = useState("");
  const { rol, permisos } = useAuthStore();
  const denyAlertShown = useRef(false);
  const canView = hasPermission(rol, permisos, "bodegas.view");
  const canManage = hasPermission(rol, permisos, "bodegas.manage");
  const { paginatedRows, paginationProps } = useTablePagination(bodegas, 10);

  const cargar = async () => {
    try {
      setLoading(true);
      const resp = await api.get("/bodegas");
      setBodegas(resp.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar las bodegas", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      if (!denyAlertShown.current) {
        denyAlertShown.current = true;
        Swal.fire("Acceso restringido", "No tienes permisos para ingresar a Bodegas", "warning");
      }
      return;
    }
    void cargar();
  }, [canView]);

  if (!canView) {
    return <Navigate to="/" replace />;
  }

  const abrirNuevo = () => {
    if (!canManage) return;
    setEditing(null);
    setNombre("");
    setUbicacion("");
    setTipo("tienda");
    setActiva(true);
    setPermiteVentas(true);
    setUsaInventarioVentas(false);
    setPermitePedidos(true);
    setPermiteTraslados(true);
    setVisibleVendedores(false);
    setRequiereAutorizacion(false);
    setEsTransito(false);
    setPermiteIngresos(true);
    setOrdenPrioridad("100");
    setObservaciones("");
    setOpenForm(true);
  };

  const abrirEditar = (b: Bodega) => {
    if (!canManage) return;
    setEditing(b);
    setNombre(b.nombre);
    setUbicacion(b.ubicacion || "");
    setTipo(b.tipo || "tienda");
    setActiva(b.activa !== false);
    setPermiteVentas(b.permiteVentas !== false);
    setUsaInventarioVentas(Boolean(b.usaInventarioVentas));
    setPermitePedidos(b.permitePedidos !== false);
    setPermiteTraslados(b.permiteTraslados !== false);
    setVisibleVendedores(Boolean(b.visibleVendedores));
    setRequiereAutorizacion(Boolean(b.requiereAutorizacion));
    setEsTransito(Boolean(b.esTransito));
    setPermiteIngresos(b.permiteIngresos !== false);
    setOrdenPrioridad(String(b.ordenPrioridad ?? 100));
    setObservaciones(b.observaciones || "");
    setOpenForm(true);
  };

  const guardar = async () => {
    if (!canManage) {
      Swal.fire("Acceso restringido", "No tienes permisos para modificar bodegas", "warning");
      return;
    }

    const payload = {
      nombre: nombre.trim(),
      ubicacion: ubicacion.trim() || null,
      tipo,
      activa,
      permiteVentas,
      usaInventarioVentas,
      permitePedidos,
      permiteTraslados,
      visibleVendedores,
      requiereAutorizacion,
      esTransito,
      permiteIngresos,
      ordenPrioridad: Number(ordenPrioridad || 100),
      observaciones: observaciones.trim() || null,
    };
    if (!payload.nombre) {
      Swal.fire("Validacion", "Ingresa el nombre de la bodega", "info");
      return;
    }

    try {
      if (editing) {
        await api.put(`/bodegas/${editing.id}`, payload);
        Swal.fire("Actualizado", "Bodega actualizada", "success");
      } else {
        await api.post("/bodegas", payload);
        Swal.fire("Creado", "Bodega creada", "success");
      }
      setOpenForm(false);
      await cargar();
    } catch {
      Swal.fire("Error", "No se pudo guardar la bodega", "error");
    }
  };

  const eliminar = async (b: Bodega) => {
    if (!canManage) {
      Swal.fire("Acceso restringido", "No tienes permisos para eliminar bodegas", "warning");
      return;
    }

    const confirm = await Swal.fire({
      title: "Eliminar bodega",
      text: `Se eliminara "${b.nombre}".`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Si, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;

    try {
      await api.delete(`/bodegas/${b.id}`);
      Swal.fire("Eliminado", "Bodega eliminada", "success");
      await cargar();
    } catch {
      Swal.fire("Error", "No se pudo eliminar la bodega", "error");
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <WarehouseOutlined color="primary" />
          <Typography variant="h4">Bodegas</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<AddOutlined />}
            variant="contained"
            size="small"
            onClick={abrirNuevo}
            disabled={!canManage}
          >
            Nueva bodega
          </Button>
          <Button
            startIcon={<RefreshOutlined />}
            variant="outlined"
            size="small"
            onClick={cargar}
            disabled={loading}
          >
            Recargar
          </Button>
        </Stack>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Listado de bodegas registradas en el sistema.
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Ubicacion</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Uso</TableCell>
              <TableCell>Accesos</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <UniformaTableLoadingRow colSpan={8} />
            ) : paginatedRows.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{b.id}</TableCell>
                <TableCell>{b.nombre}</TableCell>
                <TableCell>{b.ubicacion || "N/D"}</TableCell>
                <TableCell>{b.tipo || "tienda"}</TableCell>
                <TableCell>
                  <Chip size="small" color={b.activa === false ? "default" : "success"} label={b.activa === false ? "Inactiva" : "Activa"} />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {b.esTransito && <Chip size="small" color="warning" label="En transito" />}
                    {b.permiteVentas !== false && <Chip size="small" label="Ventas" />}
                    {b.usaInventarioVentas && <Chip size="small" color="primary" label="Inv. ventas" />}
                    {b.permitePedidos !== false && <Chip size="small" label="Pedidos" />}
                    {b.permiteTraslados !== false && <Chip size="small" label="Traslados" />}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{b.visibleVendedores ? "Visible vendedores" : "Asignacion manual"}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {b._count?.usuariosPermitidos || 0} adicionales
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<EditOutlined />}
                      disabled={!canManage}
                      onClick={() => abrirEditar(b)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      color="error"
                      startIcon={<DeleteOutline />}
                      disabled={!canManage}
                      onClick={() => eliminar(b)}
                    >
                      Eliminar
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {!loading && !bodegas.length && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No hay bodegas registradas.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination {...paginationProps} />

      <Dialog open={openForm} onClose={() => setOpenForm(false)} fullWidth maxWidth="md">
        <DialogTitle>{editing ? "Editar bodega" : "Nueva bodega"}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              fullWidth
              disabled={!canManage}
            />
            <TextField
              label="Ubicacion"
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              fullWidth
              disabled={!canManage}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Tipo" select value={tipo} onChange={(e) => setTipo(e.target.value)} fullWidth disabled={!canManage}>
                {tiposBodega.map((item) => (
                  <MenuItem key={item} value={item}>{item}</MenuItem>
                ))}
              </TextField>
              <TextField label="Orden de prioridad" type="number" value={ordenPrioridad} onChange={(e) => setOrdenPrioridad(e.target.value)} fullWidth disabled={!canManage} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap">
              <FormControlLabel control={<Checkbox checked={activa} onChange={(e) => setActiva(e.target.checked)} disabled={!canManage} />} label="Activa" />
              <FormControlLabel control={<Checkbox checked={permiteVentas} onChange={(e) => {
                setPermiteVentas(e.target.checked);
                if (!e.target.checked) setUsaInventarioVentas(false);
              }} disabled={!canManage} />} label="Permite ventas" />
              <FormControlLabel control={<Checkbox checked={usaInventarioVentas} onChange={(e) => setUsaInventarioVentas(e.target.checked)} disabled={!canManage || !permiteVentas} />} label="Controlar inventario en ventas" />
              <FormControlLabel control={<Checkbox checked={permitePedidos} onChange={(e) => setPermitePedidos(e.target.checked)} disabled={!canManage} />} label="Permite pedidos" />
              <FormControlLabel control={<Checkbox checked={permiteTraslados} onChange={(e) => setPermiteTraslados(e.target.checked)} disabled={!canManage} />} label="Permite traslados" />
              <FormControlLabel control={<Checkbox checked={visibleVendedores} onChange={(e) => setVisibleVendedores(e.target.checked)} disabled={!canManage} />} label="Visible para vendedores" />
              <FormControlLabel control={<Checkbox checked={requiereAutorizacion} onChange={(e) => setRequiereAutorizacion(e.target.checked)} disabled={!canManage} />} label="Requiere autorizacion" />
              <FormControlLabel control={<Checkbox checked={permiteIngresos} onChange={(e) => setPermiteIngresos(e.target.checked)} disabled={!canManage || esTransito} />} label="Permite ingresos de inventario" />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={esTransito}
                    onChange={(e) => {
                      setEsTransito(e.target.checked);
                      // Una bodega puente no vende, no recibe pedidos y no debe
                      // aparecer en los desplegables ni admitir ingresos: su
                      // inventario solo entra y sale con los traslados.
                      if (e.target.checked) {
                        setPermiteVentas(false);
                        setUsaInventarioVentas(false);
                        setPermitePedidos(false);
                        setPermiteTraslados(false);
                        setVisibleVendedores(false);
                        setRequiereAutorizacion(false);
                        setPermiteIngresos(false);
                      }
                    }}
                    disabled={!canManage}
                  />
                }
                label="Es bodega de transito"
              />
            </Stack>
            {esTransito && (
              <Alert severity="info">
                La mercaderia queda aqui mientras viaja entre tiendas: sale del origen al despachar
                y llega al destino cuando este confirma la recepcion. Solo una bodega puede ser la
                de transito; al guardar, se desmarca cualquier otra.
              </Alert>
            )}
            <TextField label="Observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} fullWidth multiline minRows={2} disabled={!canManage} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenForm(false)}>Cancelar</Button>
          <Button variant="contained" onClick={guardar} disabled={!canManage}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
