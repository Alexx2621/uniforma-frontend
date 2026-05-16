import { ElementType, useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AssignmentOutlined from "@mui/icons-material/AssignmentOutlined";
import ContentCutOutlined from "@mui/icons-material/ContentCutOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import SendOutlined from "@mui/icons-material/SendOutlined";
import TaskAltOutlined from "@mui/icons-material/TaskAltOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";
import trackingLogo from "../assets/3-logos.png";

interface TrackingRow {
  id: number;
  folio: string;
  fecha: string;
  estado: string;
  clienteNombre: string;
  clienteCorreo?: string | null;
  bodega?: string | null;
  usuario?: string | null;
  tieneBordado?: boolean;
  estadosTracking?: Array<{ key: string; label: string }>;
  tracking?: {
    token: string;
    ultimoEstado: string;
    ultimoEnvioEn?: string | null;
  } | null;
}

interface UsuarioOption {
  id: number;
  nombre?: string | null;
  usuario?: string | null;
}

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString("es-GT") : "N/D");
const formatEstado = (value?: string | null) => `${value || "SIN ENVIAR"}`.replace(/_/g, " ").toUpperCase();
const todayInput = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const trackingIcons: Record<string, ElementType> = {
  pedido_ingresado: AssignmentOutlined,
  en_bordado: ContentCutOutlined,
  pedido_recibido: Inventory2Outlined,
  en_ruta_entrega: LocalShippingOutlined,
  entregado: TaskAltOutlined,
};

export default function TrackingPedidos() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<TrackingRow[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([]);
  const [usuarioFiltro, setUsuarioFiltro] = useState("");
  const [fechaInicio, setFechaInicio] = useState(todayInput);
  const [fechaFin, setFechaFin] = useState(todayInput);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [preview, setPreview] = useState<TrackingRow | null>(null);
  const { rol, permisos, id: currentUserId, nombre: currentNombre, usuario: currentUsuario } = useAuthStore();
  const isAdmin = `${rol || ""}`.toUpperCase() === "ADMIN";
  const canManage = hasPermission(rol, permisos, "tracking.manage");

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        fechaInicio,
        fechaFin,
        ...(isAdmin && usuarioFiltro ? { usuarioId: usuarioFiltro } : {}),
      };
      const { data } = await api.get("/tracking/pedidos", { params });
      setRows(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo cargar el tracking", "error");
    } finally {
      setLoading(false);
    }
  }, [fechaFin, fechaInicio, isAdmin, usuarioFiltro]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!isAdmin) {
      setUsuarioFiltro(currentUserId ? String(currentUserId) : "");
      return;
    }
    api
      .get("/usuarios")
      .then(({ data }) => setUsuarios(Array.isArray(data) ? data : []))
      .catch(() => setUsuarios([]));
  }, [currentUserId, isAdmin]);

  const reenviar = useCallback(async (pedidoId: number) => {
    try {
      setSendingId(pedidoId);
      await api.post(`/tracking/pedidos/${pedidoId}/enviar`);
      Swal.fire("Enviado", "Tracking enviado al correo del cliente", "success");
      await cargar();
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo enviar el tracking", "error");
    } finally {
      setSendingId(null);
    }
  }, [cargar]);

  const actualizarEstado = useCallback(async (pedidoId: number, estado: string) => {
    try {
      setUpdatingId(pedidoId);
      await api.patch(`/tracking/pedidos/${pedidoId}/estado`, { estado });
      Swal.fire("Actualizado", "Estado enviado al correo del cliente", "success");
      await cargar();
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo actualizar el estado", "error");
    } finally {
      setUpdatingId(null);
    }
  }, [cargar]);

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "folio", headerName: "Pedido", minWidth: 130 },
      {
        field: "fecha",
        headerName: "Fecha",
        minWidth: 150,
        valueFormatter: (value) => formatDate(`${value || ""}`),
      },
      { field: "clienteNombre", headerName: "Cliente", minWidth: 220, flex: 1 },
      { field: "clienteCorreo", headerName: "Correo", minWidth: 220, flex: 1 },
      { field: "bodega", headerName: "Tienda", minWidth: 170 },
      { field: "usuario", headerName: "Usuario", minWidth: 180 },
      {
        field: "trackingEstado",
        headerName: "Tracking",
        minWidth: 170,
        valueGetter: (_, row) => row.tracking?.ultimoEstado || "SIN ENVIAR",
        renderCell: (params) => (
          <Chip size="small" label={formatEstado(`${params.value || ""}`)} color={params.value ? "primary" : "default"} variant="outlined" />
        ),
      },
      {
        field: "ultimoEnvio",
        headerName: "Ultimo envio",
        minWidth: 170,
        valueGetter: (_, row) => row.tracking?.ultimoEnvioEn || "",
        valueFormatter: (value) => formatDate(`${value || ""}`),
      },
      {
        field: "acciones",
        headerName: "Acciones",
        minWidth: 560,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Stack direction="row" spacing={1} alignItems="center">
            <Select
              size="small"
              value={params.row.tracking?.ultimoEstado || "pedido_ingresado"}
              disabled={!canManage || updatingId === params.row.id}
              onChange={(event) => actualizarEstado(params.row.id, `${event.target.value}`)}
              sx={{ minWidth: 190 }}
            >
              {(params.row.estadosTracking || []).map((estado: { key: string; label: string }) => (
                <MenuItem key={estado.key} value={estado.key}>
                  {estado.label}
                </MenuItem>
              ))}
            </Select>
            <Button
              size="small"
              variant="outlined"
              startIcon={<VisibilityOutlined />}
              onClick={() => setPreview(params.row)}
            >
              Ver
            </Button>
            <Button
              size="small"
              variant="outlined"
              endIcon={<OpenInNewOutlined />}
              onClick={() => navigate(`/produccion/${params.row.id}`)}
            >
              Pedido
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<SendOutlined />}
              disabled={!canManage || !params.row.clienteCorreo || sendingId === params.row.id}
              onClick={() => reenviar(params.row.id)}
            >
              Enviar
            </Button>
          </Stack>
        ),
      },
    ],
    [actualizarEstado, canManage, navigate, reenviar, sendingId, updatingId],
  );

  const previewEstado = preview?.tracking?.ultimoEstado || "pedido_ingresado";
  const previewEstados = preview?.estadosTracking || [];
  const currentIndex = Math.max(0, previewEstados.findIndex((estado) => estado.key === previewEstado));

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4">Tracking de pedidos</Typography>
          <Typography variant="body2" color="text.secondary">
            Actualiza el avance del pedido y envia el estado al correo del cliente.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={cargar} disabled={loading}>
          Recargar
        </Button>
      </Stack>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 240 }} disabled={!isAdmin}>
          <InputLabel>Usuario</InputLabel>
          <Select
            label="Usuario"
            value={isAdmin ? usuarioFiltro : currentUserId ? String(currentUserId) : ""}
            onChange={(event) => setUsuarioFiltro(event.target.value)}
          >
            {isAdmin ? (
              [
                <MenuItem key="all" value="">Todos los usuarios</MenuItem>,
                ...usuarios.map((item) => (
                  <MenuItem key={item.id} value={String(item.id)}>
                    {item.nombre || item.usuario || `Usuario #${item.id}`}
                  </MenuItem>
                )),
              ]
            ) : (
              <MenuItem value={currentUserId ? String(currentUserId) : ""}>
                {currentNombre || currentUsuario || "Usuario actual"}
              </MenuItem>
            )}
          </Select>
        </FormControl>
        <TextField
          label="Fecha inicio"
          type="date"
          size="small"
          value={fechaInicio}
          onChange={(event) => setFechaInicio(event.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Fecha fin"
          type="date"
          size="small"
          value={fechaFin}
          onChange={(event) => setFechaFin(event.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Stack>
      <Box sx={{ height: 650, width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{ pagination: { paginationModel: { page: 0, pageSize: 25 } } }}
        />
      </Box>
      <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} fullWidth maxWidth="md">
        <DialogTitle>Tracking de pedido {preview?.folio}</DialogTitle>
        <DialogContent>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, bgcolor: "background.default" }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1} sx={{ mb: 3 }}>
              <Box>
                <Typography variant="overline" color="primary" fontWeight={800}>
                  UNIFORMA GUATEMALA
                </Typography>
                <Typography variant="h5" fontWeight={800}>
                  Tracking de pedido {preview?.folio}
                </Typography>
              </Box>
              <Stack alignItems={{ xs: "flex-start", sm: "flex-end" }} spacing={1}>
                <Box
                  component="img"
                  src={trackingLogo}
                  alt=""
                  sx={{ width: 76, height: 76, objectFit: "contain" }}
                />
                <Chip color="primary" label={formatEstado(previewEstado)} sx={{ fontWeight: 800 }} />
              </Stack>
            </Stack>
            <Typography sx={{ mb: 1.5 }}>
              Hola <strong>{preview?.clienteNombre}</strong>,
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Tu pedido se encuentra actualmente en estado: <strong>{formatEstado(previewEstado)}</strong>.
            </Typography>
            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3, bgcolor: "background.paper", mb: 3 }}>
              <Stack direction="row" alignItems="center" sx={{ width: "100%" }}>
                {previewEstados.map((estado, index) => {
                  const done = index <= currentIndex;
                  const current = index === currentIndex;
                  const Icon = trackingIcons[estado.key] || AssignmentOutlined;
                  return (
                    <Box key={estado.key} sx={{ display: "flex", alignItems: "center", flex: 1 }}>
                      <Stack alignItems="center" spacing={1} sx={{ minWidth: 92 }}>
                        <Box
                          sx={{
                            width: 46,
                            height: 46,
                            borderRadius: "50%",
                            display: "grid",
                            placeItems: "center",
                            bgcolor: done ? "primary.main" : "grey.100",
                            color: done ? "primary.contrastText" : "text.disabled",
                            border: "3px solid",
                            borderColor: current ? "error.main" : done ? "primary.main" : "grey.300",
                            boxShadow: current ? 3 : 0,
                          }}
                        >
                          <Icon fontSize="small" />
                        </Box>
                        <Typography
                          variant="caption"
                          fontWeight={800}
                          textAlign="center"
                          color={done ? "text.primary" : "text.secondary"}
                          sx={{ lineHeight: 1.15 }}
                        >
                          {estado.label}
                        </Typography>
                      </Stack>
                      {index < previewEstados.length - 1 && (
                        <Box sx={{ height: 4, flex: 1, bgcolor: index < currentIndex ? "primary.main" : "grey.300", borderRadius: 999, mx: 1 }} />
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </Box>
            <Stack spacing={1}>
              <Typography variant="body2"><strong>Cliente:</strong> {preview?.clienteNombre}</Typography>
              <Typography variant="body2"><strong>Correo:</strong> {preview?.clienteCorreo || "N/D"}</Typography>
              <Typography variant="body2"><strong>Tienda:</strong> {preview?.bodega || "N/D"}</Typography>
              <Typography variant="body2"><strong>Ultimo envio:</strong> {formatDate(preview?.tracking?.ultimoEnvioEn)}</Typography>
            </Stack>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreview(null)}>Cerrar</Button>
          {preview && (
            <Button variant="contained" endIcon={<OpenInNewOutlined />} onClick={() => navigate(`/produccion/${preview.id}`)}>
              Ver pedido
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
