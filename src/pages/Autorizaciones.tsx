import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ApprovalOutlined from "@mui/icons-material/ApprovalOutlined";
import CheckCircleOutlineOutlined from "@mui/icons-material/CheckCircleOutlineOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";
import { formatCurrency } from "../utils/currency";

interface AutorizacionRow {
  id: string;
  sourceId: number;
  tipo: "pedido" | "traslado" | "postventa";
  titulo: string;
  referencia: string;
  estado: string;
  fecha: string;
  solicitadoPor: string;
  autorizadoPor?: string | null;
  total: number;
  resumen: string;
  comentario?: string | null;
  respuestaComentario?: string | null;
  payload?: any;
  path?: string;
}

const dateLabel = (value?: string | null) => (value ? new Date(value).toLocaleString("es-GT") : "N/D");
const estadoColor = (estado?: string): "success" | "warning" | "error" | "info" | "default" => {
  const value = `${estado || ""}`.toLowerCase();
  if (["aprobado", "cerrado", "recibido", "pendiente"].includes(value)) return value === "pendiente" ? "warning" : "success";
  if (["rechazado", "anulado", "cancelado"].includes(value)) return "error";
  if (value.includes("revision") || value.includes("aprobacion")) return "info";
  return "default";
};

export default function Autorizaciones() {
  const { rol, permisos } = useAuthStore();
  const canView = hasPermission(rol, permisos, "autorizaciones.view");
  const canApprovePedidos = hasPermission(rol, permisos, "produccion.autorizar-pedidos");
  const canApproveTraslados = hasPermission(rol, permisos, "inventario.trasladar");
  const canManagePostventa = hasPermission(rol, permisos, "postventa.manage");
  const navigate = useNavigate();
  const [rows, setRows] = useState<AutorizacionRow[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState("pendiente");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AutorizacionRow | null>(null);

  const cargar = useCallback(async () => {
    if (!canView) return;
    try {
      setLoading(true);
      const { data } = await api.get("/autorizaciones", {
        params: {
          tipo: tipo || undefined,
          estado,
        },
      });
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setStats(data?.stats || {});
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo cargar la bandeja de autorizaciones", "error");
    } finally {
      setLoading(false);
    }
  }, [canView, estado, tipo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const resolver = useCallback(async (row: AutorizacionRow, accion: "aprobar" | "rechazar") => {
    const comentario =
      accion === "rechazar"
        ? await Swal.fire({
            title: "Motivo de rechazo",
            input: "textarea",
            inputPlaceholder: "Escribe el motivo",
            showCancelButton: true,
            confirmButtonText: "Rechazar",
            cancelButtonText: "Cancelar",
          })
        : await Swal.fire({
            title: "Confirmar autorizacion",
            text: `Se procesara ${row.referencia}.`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Autorizar",
            cancelButtonText: "Cancelar",
          });
    if (!comentario.isConfirmed) return;

    try {
      if (row.tipo === "pedido") {
        await api.post(`/produccion/autorizaciones/${row.sourceId}/${accion === "aprobar" ? "aprobar" : "rechazar"}`, {
          comentario: comentario.value || "",
        });
      } else if (row.tipo === "traslado") {
        await api.patch(`/traslados/solicitudes/${row.sourceId}/estado`, {
          estado: accion === "aprobar" ? "PENDIENTE" : "CANCELADO",
          observaciones: comentario.value || undefined,
        });
      } else if (row.tipo === "postventa") {
        await api.post(`/postventa/${row.sourceId}/${accion === "aprobar" ? "cerrar" : "anular"}`);
      }
      Swal.fire("Listo", accion === "aprobar" ? "Solicitud autorizada" : "Solicitud rechazada", "success");
      setSelected(null);
      await cargar();
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo resolver la autorizacion", "error");
    }
  }, [cargar]);

  const puedeResolver = useCallback(
    (row: AutorizacionRow) =>
      (row.tipo === "pedido" && canApprovePedidos) ||
      (row.tipo === "traslado" && canApproveTraslados) ||
      (row.tipo === "postventa" && canManagePostventa),
    [canApprovePedidos, canApproveTraslados, canManagePostventa],
  );

  const columns = useMemo<GridColDef<AutorizacionRow>[]>(
    () => [
      { field: "fecha", headerName: "Fecha", minWidth: 165, flex: 0.8, valueFormatter: (value) => dateLabel(`${value || ""}`) },
      { field: "tipo", headerName: "Tipo", minWidth: 120, flex: 0.6 },
      { field: "referencia", headerName: "Referencia", minWidth: 145, flex: 0.7 },
      { field: "resumen", headerName: "Resumen", minWidth: 300, flex: 1.5 },
      { field: "solicitadoPor", headerName: "Solicitado por", minWidth: 165, flex: 0.8 },
      {
        field: "total",
        headerName: "Monto",
        minWidth: 120,
        flex: 0.5,
        valueFormatter: (value) => formatCurrency(Number(value || 0)),
      },
      {
        field: "estado",
        headerName: "Estado",
        minWidth: 140,
        flex: 0.6,
        renderCell: ({ row }) => <Chip label={row.estado} size="small" color={estadoColor(row.estado)} />,
      },
      {
        field: "acciones",
        headerName: "Acciones",
        minWidth: 210,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={0.75}>
            <Button size="small" onClick={() => setSelected(row)}>
              Ver
            </Button>
            {puedeResolver(row) && (
              <Button size="small" color="success" onClick={() => void resolver(row, "aprobar")}>
                Aprobar
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    [puedeResolver, resolver],
  );

  if (!canView) return <Navigate to="/" replace />;

  return (
    <Paper sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ApprovalOutlined color="primary" />
          <Box>
            <Typography variant="h4">Autorizaciones</Typography>
            <Typography variant="body2" color="text.secondary">
              Bandeja central para pedidos, traslados y postventa en revision.
            </Typography>
          </Box>
        </Stack>
        <Button startIcon={<RefreshOutlined />} variant="outlined" onClick={() => void cargar()} disabled={loading}>
          Recargar
        </Button>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 4, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Pendientes</Typography>
            <Typography variant="h5">{stats.total || 0}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 4, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Pedidos</Typography>
            <Typography variant="h5">{stats.pedido || 0}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 4, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Traslados</Typography>
            <Typography variant="h5">{stats.traslado || 0}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 4, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Postventa</Typography>
            <Typography variant="h5">{stats.postventa || 0}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField select size="small" label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="pedido">Pedidos</MenuItem>
          <MenuItem value="traslado">Traslados</MenuItem>
          <MenuItem value="postventa">Postventa</MenuItem>
        </TextField>
        <TextField select size="small" label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="pendiente">Pendientes</MenuItem>
          <MenuItem value="todos">Todos</MenuItem>
          <MenuItem value="aprobado">Aprobados</MenuItem>
          <MenuItem value="rechazado">Rechazados</MenuItem>
        </TextField>
        <Button variant="contained" onClick={() => void cargar()} disabled={loading}>
          Filtrar
        </Button>
      </Stack>

      <Box sx={{ height: 590, width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          disableRowSelectionOnClick
          onRowDoubleClick={(params) => setSelected(params.row)}
        />
      </Box>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle>Detalle de autorizacion</DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={selected.tipo} />
                <Chip label={selected.estado} color={estadoColor(selected.estado)} />
                <Chip label={formatCurrency(selected.total)} color="primary" variant="outlined" />
              </Stack>
              <Typography variant="h6">{selected.referencia}</Typography>
              <Typography>{selected.resumen}</Typography>
              {selected.comentario && (
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Comentario</Typography>
                  <Typography variant="body2">{selected.comentario}</Typography>
                </Paper>
              )}
              <TextField
                label="Payload tecnico"
                value={JSON.stringify(selected.payload || {}, null, 2)}
                multiline
                minRows={6}
                fullWidth
                InputProps={{ readOnly: true }}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {selected?.path && (
            <Button startIcon={<OpenInNewOutlined />} onClick={() => navigate(selected.path || "/")}>
              Abrir modulo
            </Button>
          )}
          {selected && puedeResolver(selected) && (
            <>
              <Button startIcon={<CloseOutlined />} color="error" onClick={() => void resolver(selected, "rechazar")}>
                Rechazar
              </Button>
              <Button startIcon={<CheckCircleOutlineOutlined />} variant="contained" color="success" onClick={() => void resolver(selected, "aprobar")}>
                Aprobar
              </Button>
            </>
          )}
          <Button onClick={() => setSelected(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
