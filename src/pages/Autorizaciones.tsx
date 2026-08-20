import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Box,
  Alert,
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
import { useSingleFlight } from "../hooks/useSingleFlight";
import { formatCurrency } from "../utils/currency";
import { getStatusColor, getStatusLabel } from "../utils/statusUi";

interface AutorizacionRow {
  id: string;
  sourceId: number;
  pedidoId?: number | null;
  tipo: "pedido" | "traslado" | "postventa" | "ajuste_pago" | "venta_especial";
  subtipo?: string;
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
  historial?: AutorizacionHistorialRow[];
  path?: string;
}

interface AutorizacionHistorialRow {
  id: number;
  estado: string;
  tipoSolicitud?: string;
  fecha?: string;
  autorizadoEn?: string | null;
  solicitadoPor?: string | null;
  autorizadoPor?: string | null;
  comentario?: string | null;
  respuestaComentario?: string | null;
}

const dateLabel = (value?: string | null) => (value ? new Date(value).toLocaleString("es-GT") : "N/D");
const getAutorizacionDetalleKey = (item: any) =>
  `${item.id ?? item.productoId ?? item.codigo ?? "linea"}-${item.cantidad ?? ""}-${item.precioUnit ?? ""}-${item.bordado ?? ""}-${item.descuento ?? ""}-${item.descripcion ?? ""}`;

export default function Autorizaciones() {
  const { rol, permisos } = useAuthStore();
  const canView = hasPermission(rol, permisos, "autorizaciones.view");
  const canApprovePedidos = hasPermission(rol, permisos, "produccion.autorizar-pedidos");
  const canApproveTraslados = hasPermission(rol, permisos, "inventario.trasladar");
  const canManagePostventa = hasPermission(rol, permisos, "postventa.manage");
  const canApproveAdjustments = hasPermission(rol, permisos, "correcciones.manage");
  // La entrega sin cobro la autoriza un ADMIN y nadie mas. El servidor lo
  // vuelve a exigir: esto solo evita mostrar botones que no van a funcionar.
  const canApproveVentaEspecial = `${rol || ""}`.trim().toUpperCase() === "ADMIN";
  const navigate = useNavigate();
  const [rows, setRows] = useState<AutorizacionRow[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState("pendiente");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AutorizacionRow | null>(null);
  const [warnings, setWarnings] = useState<Array<{ tipo: string; code: string }>>([]);

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
      setWarnings(Array.isArray(data?.warnings) ? data.warnings : []);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo cargar la bandeja de autorizaciones", "error");
    } finally {
      setLoading(false);
    }
  }, [canView, estado, tipo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const resolverBase = useCallback(async (row: AutorizacionRow, accion: "aprobar" | "rechazar") => {
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
      let response: any = null;
      if (row.tipo === "pedido") {
        await api.post(`/produccion/autorizaciones/${row.sourceId}/${accion === "aprobar" ? "aprobar" : "rechazar"}`, {
          comentario: comentario.value || "",
        });
      } else if (row.tipo === "traslado") {
        await api.patch(`/traslados/solicitudes/${row.sourceId}/estado`, {
          estado: accion === "aprobar" ? "PENDIENTE" : "CANCELADO",
          observaciones: comentario.value || undefined,
          resolverAutorizacion: true,
        });
      } else if (row.tipo === "postventa") {
        await api.post(`/postventa/${row.sourceId}/${accion === "aprobar" ? "cerrar" : "anular"}`);
      } else if (row.tipo === "venta_especial") {
        await api.post(`/ventas-especiales/${row.sourceId}/${accion === "aprobar" ? "aprobar" : "rechazar"}`, {
          comentario: comentario.value || "",
        });
      } else if (row.tipo === "ajuste_pago") {
        response = await api.post(`/ajustes-pagos-pedidos/${row.sourceId}/${accion === "aprobar" ? "aprobar" : "rechazar"}`, {
          comentario: comentario.value || "",
        });
      }
      const quedaSegunda = response?.data?.estado === "pendiente_segunda_aprobacion";
      Swal.fire("Listo", quedaSegunda
        ? "Primera aprobacion registrada. Falta la autorizacion de otro administrador."
        : accion === "aprobar" ? "Solicitud autorizada y aplicada" : "Solicitud rechazada", "success");
      setSelected(null);
      await cargar();
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo resolver la autorizacion", "error");
      if (error?.response?.status === 409) {
        setSelected(null);
        await cargar();
      }
    }
  }, [cargar]);
  const { run: resolver, running: resolviendo } = useSingleFlight(resolverBase);

  const puedeResolver = useCallback(
    (row: AutorizacionRow) =>
      (row.tipo === "pedido" && canApprovePedidos) ||
      (row.tipo === "traslado" && canApproveTraslados) ||
      (row.tipo === "postventa" && canManagePostventa) ||
      (row.tipo === "ajuste_pago" && canApproveAdjustments) ||
      (row.tipo === "venta_especial" && canApproveVentaEspecial),
    [canApproveAdjustments, canApprovePedidos, canApproveTraslados, canApproveVentaEspecial, canManagePostventa],
  );

  const estaPendiente = (row: AutorizacionRow) => ["pendiente", "pendiente_segunda_aprobacion"].includes(row.estado);

  const columns = useMemo<GridColDef<AutorizacionRow>[]>(
    () => [
      { field: "fecha", headerName: "Fecha", minWidth: 165, flex: 0.8, valueFormatter: (value) => dateLabel(`${value || ""}`) },
      { field: "titulo", headerName: "Tipo", minWidth: 150, flex: 0.7 },
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
        renderCell: ({ row }) => <Chip label={getStatusLabel(row.estado)} size="small" color={getStatusColor(row.estado)} />,
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
            {puedeResolver(row) && estaPendiente(row) && (
              <Button size="small" color="success" disabled={resolviendo} onClick={() => void resolver(row, "aprobar")}>
                Aprobar
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    [puedeResolver, resolver, resolviendo],
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
        <Grid size={{ xs: 12, sm: 4, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Ajustes de pago</Typography>
            <Typography variant="h5">{stats.ajuste_pago || 0}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 4, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Reemplazadas</Typography>
            <Typography variant="h5">{stats.reemplazada || 0}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField select size="small" label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="pedido">Pedidos</MenuItem>
          <MenuItem value="traslado">Traslados</MenuItem>
          <MenuItem value="venta_especial">Entregas a trabajadores</MenuItem>
          <MenuItem value="postventa">Postventa</MenuItem>
          <MenuItem value="ajuste_pago">Ajustes de pago</MenuItem>
        </TextField>
        <TextField select size="small" label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="pendiente">Pendientes</MenuItem>
          <MenuItem value="todos">Todos</MenuItem>
          <MenuItem value="aprobado">Aprobados</MenuItem>
          <MenuItem value="rechazado">Rechazados</MenuItem>
          <MenuItem value="aplicado">Aplicados</MenuItem>
          <MenuItem value="pendiente_segunda_aprobacion">Pendientes de segunda aprobacion</MenuItem>
          <MenuItem value="reemplazada">Reemplazadas</MenuItem>
        </TextField>
        <Button variant="contained" onClick={() => void cargar()} disabled={loading}>
          Filtrar
        </Button>
      </Stack>

      {warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Se cargaron las autorizaciones disponibles, pero falta actualizar en cPanel: {warnings.map((item) => item.tipo).join(", ")}.
        </Alert>
      )}

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
                <Chip label={getStatusLabel(selected.estado)} color={getStatusColor(selected.estado)} />
                <Chip label={formatCurrency(selected.total)} color="primary" variant="outlined" />
              </Stack>
              <Typography variant="h6">{selected.referencia}</Typography>
              <Typography>{selected.resumen}</Typography>
              {selected.tipo === "ajuste_pago" && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 4 }}><Typography variant="caption" color="text.secondary">Monto registrado</Typography><Typography>{formatCurrency(Number(selected.payload?.montoRegistrado || 0))}</Typography></Grid>
                    <Grid size={{ xs: 12, sm: 4 }}><Typography variant="caption" color="text.secondary">Monto correcto</Typography><Typography>{formatCurrency(Number(selected.payload?.montoCorrecto || 0))}</Typography></Grid>
                    <Grid size={{ xs: 12, sm: 4 }}><Typography variant="caption" color="text.secondary">Diferencia</Typography><Typography color={Number(selected.payload?.diferencia || 0) < 0 ? "error" : "success.main"}>{formatCurrency(Number(selected.payload?.diferencia || 0))}</Typography></Grid>
                    <Grid size={{ xs: 12, sm: 4 }}><Typography variant="caption" color="text.secondary">Fecha real</Typography><Typography>{dateLabel(selected.payload?.fechaPagoReal)}</Typography></Grid>
                    <Grid size={{ xs: 12, sm: 4 }}><Typography variant="caption" color="text.secondary">Metodo / referencia</Typography><Typography>{selected.payload?.metodo || "N/D"} / {selected.payload?.referenciaPago || "N/D"}</Typography></Grid>
                    <Grid size={{ xs: 12, sm: 4 }}><Typography variant="caption" color="text.secondary">Evidencia</Typography><Typography>{selected.payload?.evidenciaReferencia || "N/D"}</Typography></Grid>
                    <Grid size={{ xs: 12 }}><Typography variant="caption" color="text.secondary">Aprobaciones</Typography><Typography>{selected.payload?.primeraAprobacion || "Pendiente"}{Number(selected.payload?.aprobacionesRequeridas || 1) > 1 ? ` / ${selected.payload?.segundaAprobacion || "Segunda pendiente"}` : ""}</Typography></Grid>
                  </Grid>
                </Paper>
              )}
              {selected.tipo === "pedido" && Array.isArray(selected.payload?.detalle) && selected.payload.detalle.length > 0 && (
                <Paper variant="outlined" sx={{ overflowX: "auto" }}>
                  <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", "& th, & td": { p: 1, borderBottom: "1px solid", borderColor: "divider", fontSize: 13 } }}>
                    <Box component="thead">
                      <Box component="tr">
                        <Box component="th" sx={{ textAlign: "left" }}>Producto</Box>
                        <Box component="th" sx={{ textAlign: "right" }}>Cant.</Box>
                        <Box component="th" sx={{ textAlign: "right" }}>Precio</Box>
                        <Box component="th" sx={{ textAlign: "right" }}>Bordado</Box>
                        <Box component="th" sx={{ textAlign: "right" }}>Desc.</Box>
                        <Box component="th" sx={{ textAlign: "left" }}>Observacion</Box>
                      </Box>
                    </Box>
                    <Box component="tbody">
                      {selected.payload.detalle.map((item: any) => (
                        <Box component="tr" key={getAutorizacionDetalleKey(item)}>
                          <Box component="td">{item.codigo || item.productoId || "N/D"}</Box>
                          <Box component="td" sx={{ textAlign: "right" }}>{Number(item.cantidad || 0)}</Box>
                          <Box component="td" sx={{ textAlign: "right" }}>{formatCurrency(Number(item.precioUnit || 0))}</Box>
                          <Box component="td" sx={{ textAlign: "right" }}>{formatCurrency(Number(item.bordado || 0))}</Box>
                          <Box component="td" sx={{ textAlign: "right" }}>{Number(item.descuento || 0).toFixed(2)}%</Box>
                          <Box component="td">{item.descripcion || "-"}</Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Paper>
              )}
              {selected.comentario && (
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Comentario</Typography>
                  <Typography variant="body2">{selected.comentario}</Typography>
                </Paper>
              )}
              {selected.tipo === "pedido" && Array.isArray(selected.historial) && selected.historial.length > 0 && (
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Historial de autorizaciones del pedido
                  </Typography>
                  <Stack spacing={1}>
                    {selected.historial.map((item) => (
                      <Stack
                        key={item.id}
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        alignItems={{ xs: "flex-start", sm: "center" }}
                        justifyContent="space-between"
                        sx={{ borderBottom: "1px solid", borderColor: "divider", pb: 1 }}
                      >
                        <Box>
                          <Typography variant="body2">
                            {dateLabel(item.fecha)} | {item.solicitadoPor || "N/D"} | {item.tipoSolicitud || "creacion"}
                          </Typography>
                          {(item.respuestaComentario || item.comentario) && (
                            <Typography variant="caption" color="text.secondary">
                              {item.respuestaComentario || item.comentario}
                            </Typography>
                          )}
                        </Box>
                        <Chip size="small" label={getStatusLabel(item.estado)} color={getStatusColor(item.estado)} />
                      </Stack>
                    ))}
                  </Stack>
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
          {selected && puedeResolver(selected) && estaPendiente(selected) && (
            <>
              <Button startIcon={<CloseOutlined />} color="error" disabled={resolviendo} onClick={() => void resolver(selected, "rechazar")}>
                Rechazar
              </Button>
              <Button startIcon={<CheckCircleOutlineOutlined />} variant="contained" color="success" disabled={resolviendo} onClick={() => void resolver(selected, "aprobar")}>
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
