import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  ListItemIcon,
  Alert,
  Divider,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import AccountBalanceOutlined from "@mui/icons-material/AccountBalanceOutlined";
import PaidOutlined from "@mui/icons-material/PaidOutlined";
import StoreOutlined from "@mui/icons-material/StoreOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import EditNoteOutlined from "@mui/icons-material/EditNoteOutlined";
import Swal from "sweetalert2";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import { canUseVendedorDropdown } from "../utils/vendedorDropdownAccess";
import TransactionRelationMap, { RelationEdge, RelationNode } from "../components/TransactionRelationMap";

interface PagoRecibido {
  id: number;
  monto: number;
  recargo: number;
  tipo?: string | null;
  metodo?: string | null;
  referenciaPago?: string | null;
  banco?: string | null;
  ubicacion?: string | null;
  numeroEnvio?: string | null;
  numeroRecibo?: string | null;
  referenciaDocumento?: string | null;
  observacionesPago?: string | null;
  fecha?: string | null;
  pedidoId: number;
  pedidoFolio: string;
  clienteNombre: string;
  bodegaNombre: string;
  bodegaId?: number | string | null;
  estado?: string | null;
  vendedor: string;
}

const money = (value: number) =>
  `Q ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("es-GT", {
        timeZone: "America/Guatemala",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "N/D";

const normalizeText = (value?: string | number | null) =>
  `${value || ""}`
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const prettyLabel = (value?: string | null) =>
  `${value || "N/D"}`
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

interface AjusteForm {
  montoCorrecto: string;
  fechaPagoReal: string;
  metodo: string;
  referencia: string;
  banco: string;
  ubicacion: string;
  motivo: string;
  evidenciaReferencia: string;
}

const emptyAjusteForm: AjusteForm = {
  montoCorrecto: "",
  fechaPagoReal: "",
  metodo: "efectivo",
  referencia: "",
  banco: "",
  ubicacion: "",
  motivo: "",
  evidenciaReferencia: "",
};

export default function PagosRecibidos() {
  const { usuario, usuarioCorrelativo, rol, rolId, permisos } = useAuthStore();
  const { vendedorDropdownRoleIds, vendedorDropdownBodegaIds, fetchConfig } = useSystemConfigStore();
  const isAdmin = Boolean(rol?.toLowerCase().includes("admin"));
  const canUseDropdown = canUseVendedorDropdown(rol, rolId, vendedorDropdownRoleIds, permisos);
  const currentUser = `${usuario || ""}`.trim().toLowerCase();
  const currentUserAlt = `${usuarioCorrelativo || ""}`.trim().toLowerCase();
  const [pagos, setPagos] = useState<PagoRecibido[]>([]);
  const [selectedPago, setSelectedPago] = useState<PagoRecibido | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [selectedVendedor, setSelectedVendedor] = useState("all");
  const [selectedMetodo, setSelectedMetodo] = useState("all");
  const [selectedUbicacion, setSelectedUbicacion] = useState("all");
  const [selectedEstado, setSelectedEstado] = useState("all");
  const [contextMenuAnchor, setContextMenuAnchor] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const [contextMenuPago, setContextMenuPago] = useState<PagoRecibido | null>(null);
  const [relationModalOpen, setRelationModalOpen] = useState(false);
  const [relationModalTitle, setRelationModalTitle] = useState("Relaciones de pago");
  const [relationModalData, setRelationModalData] = useState<{ nodes: RelationNode[]; edges: RelationEdge[] } | null>(null);
  const [ajustePago, setAjustePago] = useState<PagoRecibido | null>(null);
  const [ajusteForm, setAjusteForm] = useState<AjusteForm>(emptyAjusteForm);
  const [enviandoAjuste, setEnviandoAjuste] = useState(false);

  const cargarPagos = async () => {
    try {
      setLoading(true);
      const resp = await api.get("/produccion");
      const pagosRecibidos: PagoRecibido[] = [];
      (resp.data || []).forEach((pedido: any) => {
        const clienteNombre = pedido?.cliente?.nombre || pedido?.clienteNombre || "Mostrador";
        const bodegaNombre = pedido?.bodega?.nombre || pedido?.bodegaNombre || "N/D";
        const pedidoFolio = pedido?.folio || `P-${pedido?.id}`;
        const vendedor = `${pedido?.solicitadoPor || pedido?.vendedor || pedido?.usuario || (pedido?.usuario?.usuario ?? "") || "N/D"}`.trim();
        if (Array.isArray(pedido?.pagos)) {
          pedido.pagos.forEach((pago: any) => {
            pagosRecibidos.push({
              id: Number(pago?.id || 0),
              monto: Number(pago?.monto || 0),
              recargo: Number(pago?.recargo || 0),
              tipo: pago?.tipo || null,
              metodo: pago?.metodo || null,
              referenciaPago: pago?.referenciaPago || pago?.referencia || null,
              banco: pago?.banco || null,
              ubicacion: pago?.ubicacion || pedido?.ubicacion || null,
              numeroEnvio: pago?.numeroEnvio || null,
              numeroRecibo: pago?.numeroRecibo || null,
              referenciaDocumento: pago?.referenciaDocumento || null,
              observacionesPago: pago?.observacionesPago || null,
              fecha: pago?.fecha || pedido?.fecha || null,
              pedidoId: Number(pedido?.id || 0),
              pedidoFolio,
              clienteNombre,
              bodegaNombre,
              bodegaId: pedido?.bodegaId ?? null,
              estado: pedido?.estado || null,
              vendedor,
            });
          });
        }
      });
      setPagos(pagosRecibidos);
    } catch (error) {
      Swal.fire("Error", "No se pudieron cargar los pagos recibidos", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    void cargarPagos();
  }, []);

  const pedidoFiltro = Number(searchParams.get("pedido") || "0") || null;

  const pagosPermitidos = useMemo(
    () =>
      isAdmin || !canUseDropdown || !vendedorDropdownBodegaIds.length
        ? pagos
        : pagos.filter((pago) => {
            const bodegaId = Number(pago.bodegaId);
            return Number.isFinite(bodegaId) && vendedorDropdownBodegaIds.includes(bodegaId);
          }),
    [canUseDropdown, isAdmin, pagos, vendedorDropdownBodegaIds]
  );

  const vendedores = useMemo(
    () => Array.from(new Set(pagosPermitidos.map((pago) => pago.vendedor).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [pagosPermitidos]
  );

  const metodos = useMemo(
    () => Array.from(new Set(pagosPermitidos.map((pago) => pago.metodo || "N/D"))).sort((a, b) => a.localeCompare(b)),
    [pagosPermitidos]
  );

  const ubicaciones = useMemo(
    () => Array.from(new Set(pagosPermitidos.map((pago) => pago.ubicacion || "N/D"))).sort((a, b) => a.localeCompare(b)),
    [pagosPermitidos]
  );

  const estados = useMemo(
    () => Array.from(new Set(pagosPermitidos.map((pago) => pago.estado || "N/D"))).sort((a, b) => a.localeCompare(b)),
    [pagosPermitidos]
  );

  const isMatchingCurrentUser = useCallback((vendedor?: string) => {
    const value = `${vendedor || ""}`.trim().toLowerCase();
    if (!value) return false;
    return [currentUser, currentUserAlt].some((key) => key && value.includes(key));
  }, [currentUser, currentUserAlt]);

  const pagosFiltrados = useMemo(
    () =>
      pagosPermitidos
        .filter((pago) => (pedidoFiltro ? pago.pedidoId === pedidoFiltro : true))
        .filter((pago) => {
          if (!canUseDropdown && currentUser) {
            return isMatchingCurrentUser(pago.vendedor);
          }
          if (canUseDropdown && selectedVendedor !== "all") {
            return pago.vendedor === selectedVendedor;
          }
          return true;
        })
        .filter((pago) => {
          const fecha = pago.fecha ? pago.fecha.slice(0, 10) : "";
          if (filtroDesde && fecha < filtroDesde) return false;
          if (filtroHasta && fecha > filtroHasta) return false;
          return true;
        })
        .filter((pago) => (selectedMetodo === "all" ? true : (pago.metodo || "N/D") === selectedMetodo))
        .filter((pago) => (selectedUbicacion === "all" ? true : (pago.ubicacion || "N/D") === selectedUbicacion))
        .filter((pago) => (selectedEstado === "all" ? true : (pago.estado || "N/D") === selectedEstado))
        .filter((pago) => {
          const term = normalizeText(search);
          if (!term) return true;
          const haystack = normalizeText([
            pago.id,
            pago.pedidoFolio,
            pago.clienteNombre,
            pago.bodegaNombre,
            pago.vendedor,
            pago.metodo,
            pago.referenciaPago,
            pago.banco,
            pago.ubicacion,
            pago.numeroEnvio,
            pago.numeroRecibo,
            pago.referenciaDocumento,
            pago.observacionesPago,
          ].join(" "));
          return haystack.includes(term);
        }),
    [
      pagosPermitidos,
      pedidoFiltro,
      filtroDesde,
      filtroHasta,
      selectedMetodo,
      selectedUbicacion,
      selectedEstado,
      search,
      canUseDropdown,
      selectedVendedor,
      currentUser,
      isMatchingCurrentUser,
    ]
  );

  const resumen = useMemo(() => {
    const total = pagosFiltrados.reduce((sum, pago) => sum + Number(pago.monto || 0) + Number(pago.recargo || 0), 0);
    const recargos = pagosFiltrados.reduce((sum, pago) => sum + Number(pago.recargo || 0), 0);
    const pagosConReferencia = pagosFiltrados.filter((pago) => `${pago.referenciaPago || ""}`.trim()).length;
    const metodosCount = new Map<string, number>();
    pagosFiltrados.forEach((pago) => {
      const metodo = prettyLabel(pago.metodo);
      metodosCount.set(metodo, (metodosCount.get(metodo) || 0) + 1);
    });
    return {
      total,
      recargos,
      pagosConReferencia,
      promedio: pagosFiltrados.length ? total / pagosFiltrados.length : 0,
      metodoPrincipal: Array.from(metodosCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
    };
  }, [pagosFiltrados]);

  const openRelationModal = async (pago: PagoRecibido) => {
    try {
      const resp = await api.get(`/relaciones/pagoPedido/${pago.id}`);
      setRelationModalTitle(`Relaciones de pago #${pago.id}`);
      setRelationModalData(resp.data || { nodes: [], edges: [] });
      setRelationModalOpen(true);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudieron cargar las relaciones", "error");
    }
  };

  const closeContextMenu = () => {
    setContextMenuAnchor(null);
    setContextMenuPago(null);
  };

  const abrirAjuste = (pago: PagoRecibido) => {
    setSelectedPago(null);
    setAjustePago(pago);
    setAjusteForm({
      ...emptyAjusteForm,
      montoCorrecto: Number(pago.monto || 0).toFixed(2),
      fechaPagoReal: `${pago.fecha || ""}`.slice(0, 10),
      metodo: `${pago.metodo || "efectivo"}`.toLowerCase().replace(/[\s.-]+/g, "_"),
      referencia: pago.referenciaPago || "",
      banco: pago.banco || "",
      ubicacion: pago.ubicacion || "",
    });
  };

  const actualizarAjuste = (field: keyof AjusteForm, value: string) => {
    setAjusteForm((current) => ({ ...current, [field]: value }));
  };

  const enviarAjuste = async () => {
    if (!ajustePago || enviandoAjuste) return;
    try {
      setEnviandoAjuste(true);
      const randomId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const { data } = await api.post("/ajustes-pagos-pedidos", {
        requestId: randomId,
        pedidoId: ajustePago.pedidoId,
        pagoOriginalId: ajustePago.id,
        montoCorrecto: Number(ajusteForm.montoCorrecto),
        fechaPagoReal: ajusteForm.fechaPagoReal,
        metodo: ajusteForm.metodo,
        referencia: ajusteForm.referencia,
        banco: ajusteForm.banco,
        ubicacion: ajusteForm.ubicacion,
        motivo: ajusteForm.motivo,
        evidenciaReferencia: ajusteForm.evidenciaReferencia,
      });
      setAjustePago(null);
      await Swal.fire({
        title: "Solicitud creada",
        html: `Se genero <strong>${data?.folio || "el ajuste"}</strong>. ${Number(data?.aprobacionesRequeridas || 1) > 1 ? "Requiere dos administradores distintos para aplicarse." : "Quedo pendiente de autorizacion."}`,
        icon: "success",
      });
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo solicitar el ajuste", "error");
    } finally {
      setEnviandoAjuste(false);
    }
  };

  const handleContextMenuAction = (action: "relations" | "detail" | "pedido") => {
    if (!contextMenuPago) {
      closeContextMenu();
      return;
    }
    if (action === "relations") void openRelationModal(contextMenuPago);
    if (action === "detail") setSelectedPago(contextMenuPago);
    if (action === "pedido") navigate(`/produccion/${contextMenuPago.pedidoId}`);
    closeContextMenu();
  };

  const handleGridContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    const rowElement = (event.target as HTMLElement).closest("[data-id]");
    const rowId = rowElement?.getAttribute("data-id");
    if (!rowId) return;
    const pago = pagosFiltrados.find((item) => `${item.pedidoId}-${item.id}` === rowId);
    if (!pago) return;
    event.preventDefault();
    setContextMenuPago(pago);
    setContextMenuAnchor({ mouseX: event.clientX - 2, mouseY: event.clientY - 4 });
  };

  const columns: GridColDef<PagoRecibido>[] = [
    {
      field: "fecha",
      headerName: "Fecha",
      minWidth: 155,
      flex: 0.8,
      valueFormatter: (value) => formatDateTime(value as string | null),
    },
    {
      field: "id",
      headerName: "Pago",
      minWidth: 90,
      flex: 0.45,
      renderCell: (params) => <Chip size="small" label={`#${params.row.id}`} variant="outlined" />,
    },
    { field: "pedidoFolio", headerName: "Pedido", minWidth: 130, flex: 0.65 },
    { field: "clienteNombre", headerName: "Cliente", minWidth: 190, flex: 1.1 },
    { field: "vendedor", headerName: "Vendedor", minWidth: 170, flex: 0.9 },
    { field: "bodegaNombre", headerName: "Bodega", minWidth: 150, flex: 0.85 },
    {
      field: "metodo",
      headerName: "Metodo",
      minWidth: 140,
      flex: 0.7,
      renderCell: (params) => <Chip size="small" color="primary" variant="outlined" label={prettyLabel(params.row.metodo)} />,
    },
    {
      field: "ubicacion",
      headerName: "Ubicacion",
      minWidth: 150,
      flex: 0.75,
      renderCell: (params) => <Chip size="small" color="success" variant="outlined" label={prettyLabel(params.row.ubicacion)} />,
    },
    { field: "banco", headerName: "Banco", minWidth: 120, flex: 0.65, valueFormatter: (value) => value || "-" },
    { field: "referenciaPago", headerName: "Referencia", minWidth: 150, flex: 0.8, valueFormatter: (value) => value || "-" },
    {
      field: "totalPagado",
      headerName: "Total",
      minWidth: 125,
      flex: 0.6,
      align: "right",
      headerAlign: "right",
      valueGetter: (_value, row) => Number(row.monto || 0) + Number(row.recargo || 0),
      valueFormatter: (value) => money(Number(value || 0)),
    },
    {
      field: "estado",
      headerName: "Estado pedido",
      minWidth: 130,
      flex: 0.65,
      renderCell: (params) => <Chip size="small" label={prettyLabel(params.row.estado)} />,
    },
    {
      field: "acciones",
      headerName: "Acciones",
      minWidth: 250,
      sortable: false,
      filterable: false,
      align: "right",
      headerAlign: "right",
      renderCell: (params) => (
        <Stack direction="row" spacing={0.75} justifyContent="flex-end" sx={{ width: "100%" }}>
          <Button size="small" variant="outlined" onClick={() => setSelectedPago(params.row)}>
            Ver
          </Button>
          <Button size="small" variant="contained" startIcon={<OpenInNewOutlined />} onClick={() => navigate(`/produccion/${params.row.pedidoId}`)}>
            Pedido
          </Button>
        </Stack>
      ),
    },
  ];

  const diferenciaAjuste = ajustePago
    ? Number(ajusteForm.montoCorrecto || 0) - Number(ajustePago.monto || 0)
    : 0;
  const referenciaRequerida = ["transferencia", "deposito_bancario", "tarjeta", "visalink"].includes(ajusteForm.metodo);
  const ajusteValido = Boolean(
    ajustePago &&
    ajusteForm.fechaPagoReal &&
    Number.isFinite(Number(ajusteForm.montoCorrecto)) &&
    Number(ajusteForm.montoCorrecto) >= 0 &&
    Math.abs(diferenciaAjuste) >= 0.01 &&
    ajusteForm.motivo.trim().length >= 15 &&
    ajusteForm.evidenciaReferencia.trim().length >= 5 &&
    (!referenciaRequerida || ajusteForm.referencia.trim()) &&
    (ajusteForm.metodo !== "deposito_bancario" || ajusteForm.banco.trim())
  );

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <ReceiptLongOutlined color="primary" />
          <Box>
            <Typography variant="h4">Pagos recibidos</Typography>
            <Typography variant="body2" color="text.secondary">
              Control de pagos aplicados a pedidos, referencias, bancos y ubicacion para cierre diario.
            </Typography>
          </Box>
        </Stack>
        <Button startIcon={<RefreshOutlined />} variant="outlined" onClick={cargarPagos} disabled={loading}>
          Recargar
        </Button>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
        <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <PaidOutlined color="primary" />
            <Box>
              <Typography variant="caption" color="text.secondary">Total recibido</Typography>
              <Typography variant="h5">{money(resumen.total)}</Typography>
            </Box>
          </Stack>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ReceiptLongOutlined color="primary" />
            <Box>
              <Typography variant="caption" color="text.secondary">Pagos filtrados</Typography>
              <Typography variant="h5">{pagosFiltrados.length}</Typography>
            </Box>
          </Stack>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <AccountBalanceOutlined color="primary" />
            <Box>
              <Typography variant="caption" color="text.secondary">Metodo principal</Typography>
              <Typography variant="h6">{resumen.metodoPrincipal}</Typography>
            </Box>
          </Stack>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <StoreOutlined color="primary" />
            <Box>
              <Typography variant="caption" color="text.secondary">Recargos / promedio</Typography>
              <Typography variant="h6">{money(resumen.recargos)} / {money(resumen.promedio)}</Typography>
            </Box>
          </Stack>
        </Paper>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
          <TextField
            label="Buscar"
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: { xs: "100%", lg: 280 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined fontSize="small" />
                </InputAdornment>
              ),
            }}
            placeholder="Cliente, pedido, referencia, banco..."
          />
        {canUseDropdown ? (
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Vendedor</InputLabel>
            <Select
              label="Vendedor"
              value={selectedVendedor}
              onChange={(e) => setSelectedVendedor(e.target.value)}
            >
              <MenuItem value="all">Todos</MenuItem>
              {vendedores.map((vendedor) => (
                <MenuItem key={vendedor} value={vendedor}>
                  {vendedor}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Metodo</InputLabel>
            <Select label="Metodo" value={selectedMetodo} onChange={(e) => setSelectedMetodo(e.target.value)}>
              <MenuItem value="all">Todos</MenuItem>
              {metodos.map((metodo) => (
                <MenuItem key={metodo} value={metodo}>{prettyLabel(metodo)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Ubicacion</InputLabel>
            <Select label="Ubicacion" value={selectedUbicacion} onChange={(e) => setSelectedUbicacion(e.target.value)}>
              <MenuItem value="all">Todas</MenuItem>
              {ubicaciones.map((ubicacion) => (
                <MenuItem key={ubicacion} value={ubicacion}>{prettyLabel(ubicacion)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Estado</InputLabel>
            <Select label="Estado" value={selectedEstado} onChange={(e) => setSelectedEstado(e.target.value)}>
              <MenuItem value="all">Todos</MenuItem>
              {estados.map((estado) => (
                <MenuItem key={estado} value={estado}>{prettyLabel(estado)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Desde" type="date" size="small" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Hasta" type="date" size="small" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ height: 560, width: "100%", overflow: "hidden" }} onContextMenu={handleGridContextMenu}>
        <DataGrid
          rows={pagosFiltrados}
          columns={columns}
          getRowId={(row) => `${row.pedidoId}-${row.id}`}
          loading={loading}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          disableRowSelectionOnClick
          localeText={{ noRowsLabel: "No se encontraron pagos recibidos." }}
          sx={{
            border: 0,
            "& .MuiDataGrid-cell": { minWidth: 0 },
            "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 600 },
          }}
        />
      </Paper>

      {!loading && !pagosFiltrados.length && (
        <Paper variant="outlined" sx={{ p: 4, mt: 2, textAlign: "center" }}>
          <Typography color="text.secondary">No se encontraron pagos recibidos.</Typography>
        </Paper>
      )}

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
        <MenuItem onClick={() => handleContextMenuAction("detail")}>
          <ListItemIcon>
            <ReceiptLongOutlined fontSize="small" />
          </ListItemIcon>
          Ver pago
        </MenuItem>
        <MenuItem onClick={() => handleContextMenuAction("pedido")}>
          <ListItemIcon>
            <OpenInNewOutlined fontSize="small" />
          </ListItemIcon>
          Abrir pedido
        </MenuItem>
      </Menu>

      <Dialog open={Boolean(selectedPago)} onClose={() => setSelectedPago(null)} fullWidth maxWidth="sm">
        <DialogTitle>Detalle de pago</DialogTitle>
        <DialogContent dividers>
          {selectedPago ? (
            <Stack spacing={1.5}>
              <Typography>
                <strong>Pago:</strong> #{selectedPago.id}
              </Typography>
              <Typography>
                <strong>Pedido:</strong> {selectedPago.pedidoFolio}
              </Typography>
              <Typography>
                <strong>Cliente:</strong> {selectedPago.clienteNombre}
              </Typography>
              <Typography>
                <strong>Bodega:</strong> {selectedPago.bodegaNombre}
              </Typography>
              <Typography>
                <strong>Vendedor:</strong> {selectedPago.vendedor || "-"}
              </Typography>
              <Typography>
                <strong>Fecha:</strong> {selectedPago.fecha ? new Date(selectedPago.fecha).toLocaleString() : "No disponible"}
              </Typography>
              <Typography>
                <strong>Monto:</strong> {money(selectedPago.monto)}
              </Typography>
              <Typography>
                <strong>Recargo:</strong> {money(selectedPago.recargo)}
              </Typography>
              <Typography>
                <strong>Total pagado:</strong> {money(selectedPago.monto + selectedPago.recargo)}
              </Typography>
              <Typography>
                <strong>Método:</strong> {selectedPago.metodo || "N/D"}
              </Typography>
              <Typography>
                <strong>Tipo:</strong> {selectedPago.tipo || "N/D"}
              </Typography>
              <Typography>
                <strong>Referencia:</strong> {selectedPago.referenciaPago || "N/D"}
              </Typography>
              <Typography>
                <strong>Banco:</strong> {selectedPago.banco || "N/D"}
              </Typography>
              <Typography>
                <strong>Ubicacion del pago:</strong> {selectedPago.ubicacion || "N/D"}
              </Typography>
              <Typography>
                <strong>Numero de envio/guia:</strong> {selectedPago.numeroEnvio || "N/D"}
              </Typography>
              <Typography>
                <strong>Numero de recibo:</strong> {selectedPago.numeroRecibo || "N/D"}
              </Typography>
              <Typography>
                <strong>Documento externo:</strong> {selectedPago.referenciaDocumento || "N/D"}
              </Typography>
              <Typography>
                <strong>Observaciones pago:</strong> {selectedPago.observacionesPago || "N/D"}
              </Typography>
              <Typography>
                <strong>Estado pedido:</strong> {selectedPago.estado || "N/D"}
              </Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          {selectedPago && !`${selectedPago.tipo || ""}`.toLowerCase().startsWith("ajuste_") && (
            <Button startIcon={<EditNoteOutlined />} color="warning" onClick={() => abrirAjuste(selectedPago)}>
              Solicitar ajuste
            </Button>
          )}
          <Button onClick={() => setSelectedPago(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(ajustePago)} onClose={() => !enviandoAjuste && setAjustePago(null)} fullWidth maxWidth="md">
        <DialogTitle>Solicitar ajuste de pago historico</DialogTitle>
        <DialogContent dividers>
          {ajustePago && (
            <Stack spacing={2}>
              <Alert severity="warning">
                Esta solicitud no modifica ni elimina el pago original. Al autorizarse se registrara la diferencia y, si ya existe un cierre para la fecha real, se creara una rectificacion vinculada sin importar la antiguedad del pedido.
              </Alert>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Pedido" value={ajustePago.pedidoFolio} fullWidth InputProps={{ readOnly: true }} />
                <TextField label="Pago original" value={`#${ajustePago.id}`} fullWidth InputProps={{ readOnly: true }} />
                <TextField label="Monto registrado" value={money(ajustePago.monto)} fullWidth InputProps={{ readOnly: true }} />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Monto correcto"
                  type="number"
                  value={ajusteForm.montoCorrecto}
                  onChange={(event) => actualizarAjuste("montoCorrecto", event.target.value)}
                  inputProps={{ min: 0, step: 0.01 }}
                  fullWidth
                  required
                />
                <TextField
                  label="Diferencia"
                  value={money(diferenciaAjuste)}
                  color={diferenciaAjuste < 0 ? "error" : "primary"}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
                <TextField
                  label="Fecha real del pago"
                  type="date"
                  value={ajusteForm.fechaPagoReal}
                  onChange={(event) => actualizarAjuste("fechaPagoReal", event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ max: new Date().toISOString().slice(0, 10) }}
                  fullWidth
                  required
                />
              </Stack>
              <Divider />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField select label="Metodo" value={ajusteForm.metodo} onChange={(event) => actualizarAjuste("metodo", event.target.value)} fullWidth>
                  <MenuItem value="efectivo">Efectivo</MenuItem>
                  <MenuItem value="transferencia">Transferencia</MenuItem>
                  <MenuItem value="deposito_bancario">Deposito bancario</MenuItem>
                  <MenuItem value="tarjeta">Tarjeta</MenuItem>
                  <MenuItem value="visalink">Visalink</MenuItem>
                </TextField>
                <TextField
                  label="Referencia"
                  value={ajusteForm.referencia}
                  onChange={(event) => actualizarAjuste("referencia", event.target.value)}
                  required={["transferencia", "deposito_bancario", "tarjeta", "visalink"].includes(ajusteForm.metodo)}
                  fullWidth
                />
                {ajusteForm.metodo === "deposito_bancario" && (
                  <TextField label="Banco" value={ajusteForm.banco} onChange={(event) => actualizarAjuste("banco", event.target.value)} required fullWidth />
                )}
                <TextField label="Ubicacion" value={ajusteForm.ubicacion} onChange={(event) => actualizarAjuste("ubicacion", event.target.value)} fullWidth />
              </Stack>
              <TextField
                label="Motivo del ajuste"
                value={ajusteForm.motivo}
                onChange={(event) => actualizarAjuste("motivo", event.target.value)}
                helperText="Minimo 15 caracteres. Explica que ocurrio y por que el monto correcto es distinto."
                multiline
                minRows={3}
                required
                fullWidth
              />
              <TextField
                label="Comprobante o evidencia"
                value={ajusteForm.evidenciaReferencia}
                onChange={(event) => actualizarAjuste("evidenciaReferencia", event.target.value)}
                helperText="Numero de boleta, recibo, enlace o referencia donde se puede verificar."
                required
                fullWidth
              />
              {Math.abs(diferenciaAjuste) >= 5000 && (
                <Alert severity="info">Por ser un ajuste de Q5,000 o mas, requerira dos aprobaciones de administradores diferentes.</Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAjustePago(null)} disabled={enviandoAjuste}>Cancelar</Button>
          <Button variant="contained" onClick={() => void enviarAjuste()} disabled={enviandoAjuste || !ajusteValido}>Enviar a autorizacion</Button>
        </DialogActions>
      </Dialog>

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
