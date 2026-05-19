import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  ListItemIcon,
  Menu,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddOutlined from "@mui/icons-material/AddOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import { canUseVendedorDropdown, filterUsuariosByBodega } from "../utils/vendedorDropdownAccess";
import TransactionRelationMap, { RelationEdge, RelationNode } from "../components/TransactionRelationMap";

interface Usuario {
  id: number;
  nombre?: string | null;
  usuario?: string | null;
  bodegaId?: number | string | null;
}

interface EnvioRow {
  id: number;
  folio?: string | null;
  fecha: string;
  estado: string;
  destinatarioNombre: string;
  destinatarioTelefono?: string | null;
  direccion: string;
  municipio?: string | null;
  departamento?: string | null;
  empresaTransporte?: string | null;
  numeroGuia?: string | null;
  costo: number;
  recargo?: number;
  metodoPagoEnvio?: string | null;
  referenciaPagoEnvio?: string | null;
  usuario?: { nombre?: string | null; usuario?: string | null };
  bodega?: { nombre?: string | null };
  documentos?: Array<{ id: number; tipo: string; referencia?: string | null; titulo?: string | null; monto?: number | null }>;
}

const toDateKey = (date: Date) => {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
};

const money = (value: number) =>
  `Q ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const estadoColor = (estado?: string | null) => {
  const value = `${estado || ""}`.toLowerCase();
  if (value === "entregado") return "success";
  if (value === "enviado") return "primary";
  if (value === "anulado") return "error";
  if (value === "preparado") return "warning";
  return "default";
};

const ESTADOS_ENVIO = [
  { value: "pendiente", label: "Pendiente" },
  { value: "preparado", label: "Preparado" },
  { value: "enviado", label: "Enviado" },
  { value: "entregado", label: "Entregado" },
  { value: "anulado", label: "Anulado" },
];

export default function Envios() {
  const today = useMemo(() => toDateKey(new Date()), []);
  const [envios, setEnvios] = useState<EnvioRow[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [fechaDesde, setFechaDesde] = useState(today);
  const [fechaHasta, setFechaHasta] = useState(today);
  const [usuarioFiltro, setUsuarioFiltro] = useState<number | "">("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [loading, setLoading] = useState(false);
  const [contextMenuAnchor, setContextMenuAnchor] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const [contextMenuEnvio, setContextMenuEnvio] = useState<EnvioRow | null>(null);
  const [relationModalOpen, setRelationModalOpen] = useState(false);
  const [relationModalTitle, setRelationModalTitle] = useState("Relaciones de envio");
  const [relationModalData, setRelationModalData] = useState<{ nodes: RelationNode[]; edges: RelationEdge[] } | null>(null);
  const denyAlertShown = useRef(false);
  const navigate = useNavigate();
  const { rol, rolId, permisos, id: userId } = useAuthStore();
  const { vendedorDropdownRoleIds, vendedorDropdownBodegaIds, fetchConfig } = useSystemConfigStore();
  const canView = hasPermission(rol, permisos, "envios.view");
  const canManage = hasPermission(rol, permisos, "envios.manage");
  const isAdmin = rol === "ADMIN";
  const canUseDropdown = canUseVendedorDropdown(rol, rolId, vendedorDropdownRoleIds, permisos);

  const usuariosDropdown = useMemo(
    () => (isAdmin ? usuarios : filterUsuariosByBodega(usuarios, vendedorDropdownBodegaIds)),
    [isAdmin, usuarios, vendedorDropdownBodegaIds],
  );

  const cargarEnvios = useCallback(async () => {
    if (!canView) return;
    try {
      setLoading(true);
      const params: any = {
        desde: fechaDesde,
        hasta: fechaHasta,
        _ts: Date.now(),
      };
      if (estadoFiltro) params.estado = estadoFiltro;
      if (canUseDropdown && usuarioFiltro) params.usuarioId = usuarioFiltro;
      if (!canUseDropdown && userId) params.usuarioId = userId;
      const resp = await api.get("/envios", { params });
      setEnvios(resp.data || []);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudieron cargar los envios", "error");
    } finally {
      setLoading(false);
    }
  }, [canView, fechaDesde, fechaHasta, estadoFiltro, canUseDropdown, usuarioFiltro, userId]);

  useEffect(() => {
    void fetchConfig();
    api.get("/usuarios").then((resp) => setUsuarios(resp.data || [])).catch(() => setUsuarios([]));
  }, [fetchConfig]);

  useEffect(() => {
    if (!canView) {
      if (!denyAlertShown.current) {
        denyAlertShown.current = true;
        Swal.fire("Acceso restringido", "No tienes permisos para ingresar a Envios", "warning");
      }
      return;
    }
    void cargarEnvios();
  }, [canView, cargarEnvios]);

  if (!canView) return <Navigate to="/" replace />;

  const cambiarEstado = async (row: EnvioRow, estado: string) => {
    if (!canManage || !estado || estado === row.estado) return;
    const estadoLabel = ESTADOS_ENVIO.find((item) => item.value === estado)?.label || estado;
    const confirm = await Swal.fire({
      title: "Cambiar estado",
      text: `El envio ${row.folio || `ENV-${row.id}`} pasara a estado ${estadoLabel}.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Si, actualizar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;

    try {
      const resp = await api.patch(`/envios/${row.id}/estado`, { estado });
      setEnvios((current) => current.map((item) => (item.id === row.id ? { ...item, ...resp.data } : item)));
      Swal.fire("Listo", "Estado actualizado correctamente", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo actualizar el estado", "error");
    }
  };

  const handleGridContextMenu = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    const rowElement = target?.closest("[data-id]") as HTMLElement | null;
    const rowId = rowElement?.getAttribute("data-id");
    if (!rowId) return;
    const row = envios.find((item) => String(item.id) === rowId);
    if (!row) return;
    event.preventDefault();
    setContextMenuEnvio(row);
    setContextMenuAnchor({ mouseX: event.clientX - 2, mouseY: event.clientY - 4 });
  };

  const closeContextMenu = () => {
    setContextMenuAnchor(null);
    setContextMenuEnvio(null);
  };

  const openRelationModal = async (row: EnvioRow) => {
    try {
      const resp = await api.get(`/relaciones/envio/${row.id}`);
      setRelationModalTitle(`Relaciones de ${row.folio || `ENV-${row.id}`}`);
      setRelationModalData(resp.data || { nodes: [], edges: [] });
      setRelationModalOpen(true);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudieron cargar las relaciones", "error");
    }
  };

  const openEstadoMenu = async (row: EnvioRow) => {
    const result = await Swal.fire({
      title: "Cambiar estado",
      input: "select",
      inputOptions: ESTADOS_ENVIO.reduce<Record<string, string>>((acc, item) => {
        acc[item.value] = item.label;
        return acc;
      }, {}),
      inputValue: row.estado || "pendiente",
      showCancelButton: true,
      confirmButtonText: "Actualizar",
      cancelButtonText: "Cancelar",
    });
    if (result.isConfirmed && result.value) {
      await cambiarEstado(row, result.value);
    }
  };

  const handleContextMenuAction = (action: "relations" | "status") => {
    if (!contextMenuEnvio) {
      closeContextMenu();
      return;
    }
    if (action === "relations") void openRelationModal(contextMenuEnvio);
    if (action === "status") void openEstadoMenu(contextMenuEnvio);
    closeContextMenu();
  };

  const columns: GridColDef<EnvioRow>[] = [
    { field: "folio", headerName: "Envio", minWidth: 130, valueGetter: (_, row) => row.folio || `ENV-${row.id}` },
    {
      field: "fecha",
      headerName: "Fecha",
      minWidth: 160,
      valueFormatter: (value) => (value ? new Date(value as string).toLocaleString("es-GT") : "-"),
    },
    {
      field: "estado",
      headerName: "Estado",
      minWidth: 170,
      renderCell: (params) =>
        canManage ? (
          <TextField
            select
            size="small"
            value={params.row.estado || "pendiente"}
            onChange={(event) => void cambiarEstado(params.row, event.target.value)}
            sx={{ minWidth: 145 }}
          >
            {ESTADOS_ENVIO.map((estado) => (
              <MenuItem key={estado.value} value={estado.value}>
                <Chip size="small" label={estado.label} color={estadoColor(estado.value) as any} />
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <Chip size="small" label={params.row.estado || "pendiente"} color={estadoColor(params.row.estado) as any} />
        ),
    },
    { field: "destinatarioNombre", headerName: "Destinatario", minWidth: 180, flex: 0.8 },
    { field: "destinatarioTelefono", headerName: "Telefono", minWidth: 130 },
    {
      field: "destino",
      headerName: "Destino",
      minWidth: 220,
      flex: 1,
      valueGetter: (_, row) => [row.municipio, row.departamento].filter(Boolean).join(", ") || row.direccion,
    },
    { field: "empresaTransporte", headerName: "Transporte", minWidth: 150 },
    { field: "numeroGuia", headerName: "Guia", minWidth: 150 },
    {
      field: "documentos",
      headerName: "Docs",
      minWidth: 90,
      valueGetter: (_, row) => row.documentos?.length || 0,
    },
    { field: "metodoPagoEnvio", headerName: "Pago envio", minWidth: 130 },
    { field: "referenciaPagoEnvio", headerName: "Referencia", minWidth: 140 },
    {
      field: "costo",
      headerName: "Costo",
      minWidth: 120,
      align: "right",
      headerAlign: "right",
      renderCell: (params) => money(Number(params.row.costo || 0) + Number(params.row.recargo || 0)),
    },
    { field: "usuarioNombre", headerName: "Usuario", minWidth: 170, valueGetter: (_, row) => row.usuario?.nombre || row.usuario?.usuario || "N/D" },
  ];

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <LocalShippingOutlined color="primary" />
          <Typography variant="h4">Envios</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<AddOutlined />} variant="contained" disabled={!canManage} onClick={() => navigate("/envios/nuevo")}>
            Nuevo envio
          </Button>
          <Button startIcon={<RefreshOutlined />} variant="outlined" onClick={cargarEnvios} disabled={loading}>
            Recargar
          </Button>
        </Stack>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
        <TextField label="Desde" type="date" size="small" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField label="Hasta" type="date" size="small" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField select label="Estado" size="small" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} sx={{ minWidth: 170 }}>
          <MenuItem value="">Todos</MenuItem>
          {ESTADOS_ENVIO.map((estado) => (
            <MenuItem key={estado.value} value={estado.value}>
              {estado.label}
            </MenuItem>
          ))}
        </TextField>
        {canUseDropdown && (
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Usuario</InputLabel>
            <Select label="Usuario" value={usuarioFiltro} onChange={(e) => setUsuarioFiltro(e.target.value as number | "")}>
              <MenuItem value="">Todos</MenuItem>
              {usuariosDropdown.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.nombre || u.usuario}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Stack>

      <div style={{ height: 520, width: "100%" }} onContextMenu={handleGridContextMenu}>
        <DataGrid
          rows={envios}
          columns={columns}
          loading={loading}
          getRowId={(row) => row.id}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          localeText={{ noRowsLabel: "No hay envios generados para los filtros seleccionados." }}
        />
      </div>

      <Menu
        open={Boolean(contextMenuAnchor)}
        onClose={closeContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenuAnchor ? { top: contextMenuAnchor.mouseY, left: contextMenuAnchor.mouseX } : undefined}
      >
        <MenuItem onClick={() => handleContextMenuAction("relations")}>
          <ListItemIcon>
            <VisibilityOutlined fontSize="small" />
          </ListItemIcon>
          Ver relaciones
        </MenuItem>
        <MenuItem disabled={!canManage} onClick={() => handleContextMenuAction("status")}>
          <ListItemIcon>
            <EditOutlined fontSize="small" />
          </ListItemIcon>
          Cambiar estado
        </MenuItem>
      </Menu>

      <TransactionRelationMap
        open={relationModalOpen}
        title={relationModalTitle}
        nodes={relationModalData?.nodes || []}
        edges={relationModalData?.edges || []}
        onClose={() => setRelationModalOpen(false)}
        onCardClick={(node) => {
          if (node.path) navigate(node.path);
        }}
      />
    </Paper>
  );
}
