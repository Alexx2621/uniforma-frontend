import { useCallback, useEffect, useMemo, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { formatCurrency } from "../utils/currency";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";

interface ProductoBordado {
  id?: number | null;
  codigo?: string | null;
  nombre?: string | null;
  tela?: { nombre?: string | null } | null;
  talla?: { nombre?: string | null } | null;
  color?: { nombre?: string | null } | null;
}

interface DetalleBordado {
  id: number;
  productoId: number;
  cantidad: number;
  descripcion?: string | null;
  bordado: number;
  bordadoColor?: string | null;
  bordadoTamano?: string | null;
  bordadoPosicion?: string | null;
  bordadoObservaciones?: string | null;
  bordadoImagenUrl?: string | null;
  bordadoEstado?: string | null;
  bordadoFechaEntrega?: string | null;
  bordados?: Array<{
    id?: number | null;
    monto?: number | null;
    color?: string | null;
    tamano?: string | null;
    posicion?: string | null;
    observaciones?: string | null;
    imagenUrl?: string | null;
    estado?: string | null;
    fechaEntrega?: string | null;
  }>;
  producto?: ProductoBordado | null;
}

interface PedidoBordado {
  id: number;
  origen?: "pedido" | "venta";
  ventaId?: number | null;
  folio?: string | null;
  fecha: string;
  estado: string;
  clienteNombre?: string | null;
  clienteTelefono?: string | null;
  cliente?: { nombre?: string | null } | null;
  bodega?: { nombre?: string | null } | null;
  usuario?: { nombre?: string | null; usuario?: string | null } | null;
  solicitadoPor?: string | null;
  detalle?: DetalleBordado[];
}

interface UsuarioOption {
  id: number;
  nombre?: string | null;
  usuario?: string | null;
}

type DetalleDraft = {
  bordadoEstado: string;
  bordadoFechaEntrega: string;
};

interface BordadosNavigationState {
  returnTo?: string;
  returnLabel?: string;
  bordadosState?: {
    usuarioFiltro?: string;
    fechaInicio?: string;
    fechaFin?: string;
    pagination?: {
      page?: number;
      pageSize?: number;
    };
    selectedRowId?: string | null;
  };
}

const BORDADO_ESTADOS = ["EN PRODUCCION", "EN COLA", "BORDANDO", "ENVIADO"];
const BORDADO_ESTADO_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  "EN PRODUCCION": { bg: "#e3f2fd", color: "#0d47a1", border: "#90caf9" },
  "EN COLA": { bg: "#fff8e1", color: "#8a5a00", border: "#ffca28" },
  BORDANDO: { bg: "#f3e5f5", color: "#6a1b9a", border: "#ce93d8" },
  ENVIADO: { bg: "#e8f5e9", color: "#1b5e20", border: "#81c784" },
  ANULADO: { bg: "#ffebee", color: "#b71c1c", border: "#ef9a9a" },
  VARIOS: { bg: "#eceff1", color: "#263238", border: "#b0bec5" },
};
const getFolio = (pedido: PedidoBordado) => pedido.folio || `P-${pedido.id}`;
const getCliente = (pedido: PedidoBordado) => pedido.clienteNombre || pedido.cliente?.nombre || "Mostrador";
const getUsuario = (pedido: PedidoBordado) => pedido.usuario?.nombre || pedido.solicitadoPor || pedido.usuario?.usuario || "N/D";
const getProducto = (detalle: DetalleBordado) => detalle.producto?.nombre || detalle.descripcion || `Producto #${detalle.productoId}`;
const getEstadoBordado = (detalle: DetalleBordado) => detalle.bordadoEstado || "EN PRODUCCION";
const getBordadosDetalle = (detalle: DetalleBordado) =>
  detalle.bordados?.length
    ? detalle.bordados
    : [
        {
          monto: detalle.bordado,
          color: detalle.bordadoColor,
          tamano: detalle.bordadoTamano,
          posicion: detalle.bordadoPosicion,
          observaciones: detalle.bordadoObservaciones,
          imagenUrl: detalle.bordadoImagenUrl,
          estado: detalle.bordadoEstado,
          fechaEntrega: detalle.bordadoFechaEntrega,
        },
      ];
const isPedidoAnulado = (pedido?: Pick<PedidoBordado, "estado"> | null) =>
  `${pedido?.estado || ""}`.trim().toLowerCase() === "anulado";
const money = formatCurrency;
const safeText = (value?: string | null) => `${value || ""}`.trim() || "N/D";
const getTodayInputValue = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const getInputValueDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const estadoChipSx = (estado?: string | null) => {
  const palette = BORDADO_ESTADO_COLORS[`${estado || "EN PRODUCCION"}`] || BORDADO_ESTADO_COLORS.VARIOS;
  return {
    bgcolor: palette.bg,
    color: palette.color,
    borderColor: palette.border,
    fontWeight: 700,
  };
};
const toDateInputValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};
export default function Bordados() {
  const navigate = useNavigate();
  const location = useLocation();
  const restoredBordadosState = (location.state as BordadosNavigationState | null)?.bordadosState;
  const [pedidos, setPedidos] = useState<PedidoBordado[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([]);
  const [usuarioFiltro, setUsuarioFiltro] = useState(() => restoredBordadosState?.usuarioFiltro || "");
  const [fechaInicio, setFechaInicio] = useState(() => restoredBordadosState?.fechaInicio || getInputValueDaysAgo(5));
  const [fechaFin, setFechaFin] = useState(() => restoredBordadosState?.fechaFin || getTodayInputValue());
  const [paginationModel, setPaginationModel] = useState(() => ({
    page: Math.max(0, Number(restoredBordadosState?.pagination?.page || 0)),
    pageSize: Number(restoredBordadosState?.pagination?.pageSize || 25),
  }));
  const [selectedRowId, setSelectedRowId] = useState<string | null>(() => restoredBordadosState?.selectedRowId || null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PedidoBordado | null>(null);
  const [drafts, setDrafts] = useState<Record<number, DetalleDraft>>({});
  const [saving, setSaving] = useState(false);
  const { rol, id: currentUserId, nombre: currentNombre, usuario: currentUsuario, permisos } = useAuthStore();
  const isAdmin = `${rol || ""}`.toUpperCase() === "ADMIN";
  const canEditSeguimiento = ["ADMIN", "BORDADOR"].includes(`${rol || ""}`.toUpperCase()) || hasPermission(rol, permisos, "bordados.manage");
  const canFilterUsuarios = ["ADMIN", "BORDADOR"].includes(`${rol || ""}`.toUpperCase()) || hasPermission(rol, permisos, "sistema.multi-tienda");

  const buildBordadosReturnState = (rowId?: string | null): BordadosNavigationState => ({
    returnTo: "/bordados",
    returnLabel: "Regresar a bordados",
    bordadosState: {
      usuarioFiltro,
      fechaInicio,
      fechaFin,
      pagination: paginationModel,
      selectedRowId: rowId ?? selectedRowId,
    },
  });

  const abrirPedidoDocumento = (pedido: PedidoBordado & { rowId?: string }) => {
    const rowId = pedido.rowId || `${pedido.origen || "pedido"}-${pedido.id}`;
    setSelectedRowId(rowId);
    navigate(`/produccion/${pedido.id}`, { state: buildBordadosReturnState(rowId) });
  };

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        ...(isAdmin && usuarioFiltro ? { usuarioId: usuarioFiltro } : {}),
        ...(!isAdmin && canFilterUsuarios && usuarioFiltro ? { usuarioId: usuarioFiltro } : {}),
        ...(fechaInicio ? { fechaInicio } : {}),
        ...(fechaFin ? { fechaFin } : {}),
      };
      const { data } = await api.get("/produccion/bordados", { params });
      setPedidos(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudieron cargar los bordados", "error");
    } finally {
      setLoading(false);
    }
  }, [canFilterUsuarios, fechaFin, fechaInicio, isAdmin, usuarioFiltro]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!canFilterUsuarios) {
      setUsuarioFiltro(currentUserId ? String(currentUserId) : "");
      return;
    }
    api
      .get("/usuarios")
      .then(({ data }) => {
        setUsuarios(Array.isArray(data) ? data : []);
      })
      .catch(() => setUsuarios([]));
  }, [canFilterUsuarios, currentUserId]);

  const abrirPedido = (pedido: PedidoBordado) => {
    setSelected(pedido);
    const next: Record<number, DetalleDraft> = {};
    (pedido.detalle || []).forEach((detalle) => {
      next[detalle.id] = {
        bordadoEstado: getEstadoBordado(detalle),
        bordadoFechaEntrega: toDateInputValue(detalle.bordadoFechaEntrega),
      };
    });
    setDrafts(next);
  };

  const updateDraft = (detalleId: number, patch: Partial<DetalleDraft>) => {
    setDrafts((current) => ({
      ...current,
      [detalleId]: {
        ...(current[detalleId] || {}),
        ...patch,
      },
    }));
  };

  const guardar = async () => {
    if (!selected) return;
    if (isPedidoAnulado(selected)) {
      Swal.fire("Pedido anulado", "No se puede actualizar el seguimiento de bordado de un pedido anulado", "info");
      return;
    }
    if (!canEditSeguimiento) {
      Swal.fire("Acceso restringido", "Solo ADMIN o BORDADOR pueden actualizar el seguimiento de bordado", "warning");
      return;
    }
    try {
      setSaving(true);
      await Promise.all(
        (selected.detalle || []).map((detalle) =>
          api.post(
            selected.origen === "venta"
              ? `/produccion/bordados/venta/detalle/${detalle.id}`
              : `/produccion/bordados/detalle/${detalle.id}`,
            drafts[detalle.id] || {}
          )
        )
      );
      Swal.fire("Guardado", "Seguimiento de bordado actualizado", "success");
      setSelected(null);
      await cargar();
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudieron guardar las especificaciones", "error");
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(
    () =>
      pedidos.map((pedido) => ({
        ...pedido,
        rowId: `${pedido.origen || "pedido"}-${pedido.id}`,
        origenDisplay: pedido.origen === "venta" ? "Venta" : "Pedido",
        folioDisplay: getFolio(pedido),
        clienteDisplay: getCliente(pedido),
        referenciaClienteDisplay: pedido.clienteTelefono || getCliente(pedido),
        bodegaDisplay: pedido.bodega?.nombre || "N/D",
        usuarioDisplay: getUsuario(pedido),
        totalPrendasBordado: (pedido.detalle || []).reduce((sum, item) => sum + Number(item.cantidad || 0), 0),
        totalLineasBordado: (pedido.detalle || []).reduce((sum, item) => sum + getBordadosDetalle(item).length, 0),
        estadoBordadoDisplay: (() => {
          if (isPedidoAnulado(pedido)) return "ANULADO";
          const estados = Array.from(
            new Set((pedido.detalle || []).flatMap((item) => getBordadosDetalle(item).map((bordado) => bordado.estado || getEstadoBordado(item)))),
          );
          return estados.length === 1 ? estados[0] : "VARIOS";
        })(),
      })),
    [pedidos]
  );

  const columns: GridColDef[] = [
    {
      field: "origenDisplay",
      headerName: "Origen",
      minWidth: 110,
      renderCell: (params) => (
        <Chip
          size="small"
          label={params.row.origenDisplay}
          color={params.row.origen === "venta" ? "success" : "default"}
          variant={params.row.origen === "venta" ? "filled" : "outlined"}
        />
      ),
    },
    { field: "folioDisplay", headerName: "Folio", minWidth: 120 },
    {
      field: "fecha",
      headerName: "Fecha",
      minWidth: 130,
      valueFormatter: (value) => (value ? new Date(`${value}`).toLocaleDateString() : "N/D"),
    },
    { field: "clienteDisplay", headerName: "Cliente", minWidth: 190, flex: 1 },
    { field: "referenciaClienteDisplay", headerName: "Referencia cliente", minWidth: 170, flex: 0.7 },
    { field: "bodegaDisplay", headerName: "Tienda", minWidth: 170, flex: 0.8 },
    { field: "usuarioDisplay", headerName: "Registrado por", minWidth: 170, flex: 0.8 },
    {
      field: "estadoBordadoDisplay",
      headerName: "Estado",
      minWidth: 150,
      renderCell: (params) => (
        <Chip size="small" label={params.row.estadoBordadoDisplay} variant="outlined" sx={estadoChipSx(params.row.estadoBordadoDisplay)} />
      ),
    },
    {
      field: "totalLineasBordado",
      headerName: "Articulos",
      minWidth: 100,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => <Chip size="small" label={params.row.totalLineasBordado} />,
    },
    {
      field: "totalPrendasBordado",
      headerName: "Prendas",
      minWidth: 100,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "acciones",
      headerName: "Acciones",
      minWidth: 170,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" startIcon={<VisibilityOutlined />} onClick={() => abrirPedido(params.row)}>
            Ver
          </Button>
          {params.row.origen !== "venta" && (
            <Button size="small" endIcon={<OpenInNewOutlined />} onClick={() => abrirPedidoDocumento(params.row)}>
              Pedido
            </Button>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4">Bordados</Typography>
          <Typography variant="body2" color="text.secondary">
            Bordados provenientes de pedidos de produccion y ventas directas.
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
          <FormControl size="small" sx={{ minWidth: 240 }} disabled={!canFilterUsuarios}>
            <InputLabel>Usuario</InputLabel>
            <Select
              label="Usuario"
              value={canFilterUsuarios ? usuarioFiltro : currentUserId ? String(currentUserId) : ""}
              onChange={(event) => setUsuarioFiltro(event.target.value)}
            >
              {canFilterUsuarios ? (
                [
                  <MenuItem key="todos" value="">
                    Todos los usuarios
                  </MenuItem>,
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
            size="small"
            type="date"
            label="Desde"
            value={fechaInicio}
            onChange={(event) => setFechaInicio(event.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 150 }}
          />
          <TextField
            size="small"
            type="date"
            label="Hasta"
            value={fechaFin}
            onChange={(event) => setFechaFin(event.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 150 }}
          />
          {(fechaInicio !== getInputValueDaysAgo(5) || fechaFin !== getTodayInputValue()) && (
            <Button
              variant="text"
              onClick={() => {
                setFechaInicio(getInputValueDaysAgo(5));
                setFechaFin(getTodayInputValue());
              }}
            >
              Ultimos 5 dias
            </Button>
          )}
          <Button variant="outlined" onClick={cargar} disabled={loading}>
            Recargar
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ height: 620, width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.rowId}
          loading={loading}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50, 100]}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          rowSelectionModel={selectedRowId ? [selectedRowId] : []}
          onRowSelectionModelChange={(model) => {
            const selected = Array.isArray(model) ? model[0] : Array.from((model as any)?.ids || [])[0];
            setSelectedRowId(selected ? String(selected) : null);
          }}
          getRowClassName={(params) => (String(params.id) === selectedRowId ? "bordado-row-returned" : "")}
          sx={{
            "& .bordado-row-returned .MuiDataGrid-cell": {
              backgroundColor: "rgba(25, 118, 210, 0.14) !important",
              borderTop: "1px solid rgba(25, 118, 210, 0.35)",
              borderBottom: "1px solid rgba(25, 118, 210, 0.35)",
            },
            "& .bordado-row-returned .MuiDataGrid-cell:first-of-type": {
              borderLeft: "5px solid #1976d2",
            },
            "& .MuiDataGrid-row.Mui-selected": {
              backgroundColor: "rgba(25, 118, 210, 0.14)",
            },
            "& .MuiDataGrid-row.Mui-selected:hover": {
              backgroundColor: "rgba(25, 118, 210, 0.18)",
            },
          }}
        />
      </Box>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="xl" fullWidth>
        <DialogTitle>
          {selected ? `Bordados de ${getFolio(selected)}` : "Bordados"}
        </DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                <Chip label={getCliente(selected)} />
                <Chip label={selected.bodega?.nombre || "N/D"} variant="outlined" />
                <Chip label={getUsuario(selected)} variant="outlined" />
                {isPedidoAnulado(selected) && (
                  <Chip label="Anulado" variant="outlined" sx={estadoChipSx("ANULADO")} />
                )}
              </Stack>
              {isPedidoAnulado(selected) && (
                <Typography color="error" fontWeight={700}>
                  Este pedido esta anulado. El seguimiento de bordado queda solo en modo consulta.
                </Typography>
              )}
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Prenda</TableCell>
                      <TableCell align="center">Cant.</TableCell>
                      <TableCell align="right">Bordado</TableCell>
                      <TableCell>Color de bordado</TableCell>
                      <TableCell>Tamano</TableCell>
                      <TableCell>Posicion</TableCell>
                      <TableCell>Observaciones especiales</TableCell>
                      <TableCell>Imagen</TableCell>
                      <TableCell>Estado</TableCell>
                      <TableCell>Fecha estimada</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selected.detalle || []).map((detalle) => {
                      const draft = drafts[detalle.id] || {};
                      const readOnly = !canEditSeguimiento || isPedidoAnulado(selected);
                      const bordados = getBordadosDetalle(detalle);
                      return (
                        <TableRow key={detalle.id} hover>
                          <TableCell>
                            <Typography variant="subtitle2">{getProducto(detalle)}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {[detalle.producto?.tela?.nombre, detalle.producto?.color?.nombre, detalle.producto?.talla?.nombre]
                                .filter(Boolean)
                                .join(" | ") || detalle.descripcion || "Sin detalle"}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">{detalle.cantidad}</TableCell>
                          <TableCell align="right">
                            {money(bordados.reduce((sum, bordado) => sum + Number(bordado.monto || 0), 0))}
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.5} sx={{ minWidth: 140 }}>
                              {bordados.map((bordado, index) => (
                                <Typography key={`${detalle.id}-color-${index}`} variant="body2">
                                  {index + 1}. {safeText(bordado.color)}
                                </Typography>
                              ))}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.5} sx={{ minWidth: 120 }}>
                              {bordados.map((bordado, index) => (
                                <Typography key={`${detalle.id}-tamano-${index}`} variant="body2">
                                  {safeText(bordado.tamano)}
                                </Typography>
                              ))}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.5} sx={{ minWidth: 160 }}>
                              {bordados.map((bordado, index) => (
                                <Typography key={`${detalle.id}-posicion-${index}`} variant="body2">
                                  {safeText(bordado.posicion)}
                                </Typography>
                              ))}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.5} sx={{ minWidth: 240 }}>
                              {bordados.map((bordado, index) => (
                                <Typography key={`${detalle.id}-obs-${index}`} variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                                  {safeText(bordado.observaciones)}
                                </Typography>
                              ))}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.5} sx={{ minWidth: 110 }}>
                              {bordados.map((bordado, index) =>
                                bordado.imagenUrl ? (
                                  <Button key={`${detalle.id}-img-${index}`} size="small" href={bordado.imagenUrl} target="_blank" rel="noreferrer" endIcon={<OpenInNewOutlined />}>
                                    Ver {index + 1}
                                  </Button>
                                ) : (
                                  <Typography key={`${detalle.id}-img-${index}`} variant="body2" color="text.secondary">
                                    N/D
                                  </Typography>
                                ),
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <FormControl size="small" sx={{ minWidth: 170 }}>
                              <InputLabel>Estado</InputLabel>
                              <Select
                                label="Estado"
                                value={draft.bordadoEstado || "EN PRODUCCION"}
                                onChange={(event) => updateDraft(detalle.id, { bordadoEstado: event.target.value })}
                                disabled={readOnly}
                                renderValue={(value) => (
                                  <Chip size="small" label={`${value}`} variant="outlined" sx={estadoChipSx(`${value}`)} />
                                )}
                              >
                                {BORDADO_ESTADOS.map((estado) => (
                                  <MenuItem key={estado} value={estado}>
                                    <Chip size="small" label={estado} variant="outlined" sx={estadoChipSx(estado)} />
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="date"
                              label="Fecha estimada"
                              value={draft.bordadoFechaEntrega || ""}
                              onChange={(event) => updateDraft(detalle.id, { bordadoFechaEntrega: event.target.value })}
                              InputLabelProps={{ shrink: true }}
                              disabled={readOnly}
                              sx={{ minWidth: 170 }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>{canEditSeguimiento && !isPedidoAnulado(selected) ? "Cancelar" : "Cerrar"}</Button>
          {canEditSeguimiento && !isPedidoAnulado(selected) && (
            <Button variant="contained" startIcon={<SaveOutlined />} onClick={guardar} disabled={saving}>
              Guardar
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
