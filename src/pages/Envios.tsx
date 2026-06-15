import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  ListItemIcon,
  Menu,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, GridColDef, GridRowSelectionModel } from "@mui/x-data-grid";
import AddOutlined from "@mui/icons-material/AddOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import PrintOutlined from "@mui/icons-material/PrintOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import SummarizeOutlined from "@mui/icons-material/SummarizeOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import { canUseVendedorDropdown, filterUsuariosByBodega } from "../utils/vendedorDropdownAccess";
import TransactionRelationMap, { RelationEdge, RelationNode } from "../components/TransactionRelationMap";
import { descargarEnvioManifiestoPdf } from "../utils/envioManifiestoPdf";

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
  manifiestoDetalles?: Array<{ manifiestoId: number }>;
}

interface EnvioSimpleRow {
  id: number;
  folio?: string | null;
  fecha: string;
  numeroGuia: string;
  destinatarioNombre: string;
  vendedorNombre?: string | null;
  estado: string;
  observaciones?: string | null;
  usuario?: { nombre?: string | null; usuario?: string | null };
  manifiestoDetalles?: Array<{ manifiestoId: number }>;
}

interface ManifiestoDisponibleRow {
  id: string;
  tipo: "envio" | "simple";
  numericId: number;
  fecha: string;
  numeroGuia?: string | null;
  destinatarioNombre: string;
  vendedorNombre?: string | null;
  estado: string;
  usuario?: { nombre?: string | null; usuario?: string | null };
}

interface ManifiestoConfig {
  saldoInicial: number;
  saldoActual: number;
  costoPorLinea: number;
  enviosDisponibles: number;
}

interface ManifiestoRow {
  id: number;
  folio?: string | null;
  fecha: string;
  totalLineas: number;
  costoPorLinea: number;
  totalConsumido: number;
  saldoAntes: number;
  saldoDespues: number;
  usuario?: { nombre?: string | null; usuario?: string | null };
  detalles: Array<{
    id: number;
    numeroGuia?: string | null;
    destinatario: string;
    vendedor?: string | null;
    estado?: string | null;
  }>;
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
  const [tab, setTab] = useState(0);
  const [envios, setEnvios] = useState<EnvioRow[]>([]);
  const [enviosSimples, setEnviosSimples] = useState<EnvioSimpleRow[]>([]);
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
  const [manifiestos, setManifiestos] = useState<ManifiestoRow[]>([]);
  const [manifiestoConfig, setManifiestoConfig] = useState<ManifiestoConfig>({ saldoInicial: 0, saldoActual: 0, costoPorLinea: 40, enviosDisponibles: 0 });
  const [saldoInicialInput, setSaldoInicialInput] = useState("0");
  const [costoLineaInput, setCostoLineaInput] = useState("40");
  const [enviosSeleccionados, setEnviosSeleccionados] = useState<GridRowSelectionModel>([]);
  const [loadingManifiestos, setLoadingManifiestos] = useState(false);
  const [guardandoSaldo, setGuardandoSaldo] = useState(false);
  const [generandoManifiesto, setGenerandoManifiesto] = useState(false);
  const [guardandoSimple, setGuardandoSimple] = useState(false);
  const [simpleForm, setSimpleForm] = useState({
    fecha: today,
    numeroGuia: "",
    destinatarioNombre: "",
    vendedorNombre: "",
    estado: "pendiente",
    observaciones: "",
  });
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

  const cargarEnviosSimples = useCallback(async () => {
    if (!canManage) return;
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
      const resp = await api.get("/envios/simples", { params });
      setEnviosSimples(resp.data || []);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudieron cargar los envios simples", "error");
    } finally {
      setLoading(false);
    }
  }, [canManage, fechaDesde, fechaHasta, estadoFiltro, canUseDropdown, usuarioFiltro, userId]);

  const cargarManifiestos = useCallback(async () => {
    if (!canManage) return;
    try {
      setLoadingManifiestos(true);
      const [configResp, manifiestosResp] = await Promise.all([
        api.get("/envios/manifiestos/config"),
        api.get("/envios/manifiestos"),
      ]);
      const config = configResp.data || { saldoInicial: 0, saldoActual: 0, costoPorLinea: 40, enviosDisponibles: 0 };
      setManifiestoConfig(config);
      setSaldoInicialInput(String(Number(config.saldoActual || config.saldoInicial || 0)));
      setCostoLineaInput(String(Number(config.costoPorLinea || 40)));
      setManifiestos(manifiestosResp.data || []);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudieron cargar los manifiestos", "error");
    } finally {
      setLoadingManifiestos(false);
    }
  }, [canManage]);

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
    void cargarEnviosSimples();
    void cargarManifiestos();
  }, [canView, cargarEnvios, cargarEnviosSimples, cargarManifiestos]);

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

  const cambiarEstadoSimple = async (row: EnvioSimpleRow, estado: string) => {
    if (!canManage || !estado || estado === row.estado) return;
    try {
      const resp = await api.patch(`/envios/simples/${row.id}/estado`, { estado });
      setEnviosSimples((current) => current.map((item) => (item.id === row.id ? { ...item, ...resp.data } : item)));
      Swal.fire("Listo", "Estado actualizado correctamente", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo actualizar el estado", "error");
    }
  };

  const crearEnvioSimple = async () => {
    if (!simpleForm.numeroGuia.trim() || !simpleForm.destinatarioNombre.trim()) {
      Swal.fire("Datos requeridos", "Ingresa numero de guia y destinatario.", "warning");
      return;
    }
    try {
      setGuardandoSimple(true);
      await api.post("/envios/simples", simpleForm);
      setSimpleForm({
        fecha: today,
        numeroGuia: "",
        destinatarioNombre: "",
        vendedorNombre: "",
        estado: "pendiente",
        observaciones: "",
      });
      await Promise.all([cargarEnviosSimples(), cargarManifiestos()]);
      Swal.fire("Listo", "Envio simple registrado.", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo registrar el envio simple", "error");
    } finally {
      setGuardandoSimple(false);
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

  const enviosDisponiblesManifiesto = useMemo<ManifiestoDisponibleRow[]>(() => {
    const normales = envios
      .filter((envio) => envio.estado !== "anulado" && !(envio.manifiestoDetalles || []).length)
      .map((envio) => ({
        id: `envio-${envio.id}`,
        tipo: "envio" as const,
        numericId: envio.id,
        fecha: envio.fecha,
        numeroGuia: envio.numeroGuia || envio.folio || `ENV-${envio.id}`,
        destinatarioNombre: envio.destinatarioNombre,
        vendedorNombre: envio.usuario?.nombre || envio.usuario?.usuario || "N/D",
        estado: envio.estado,
        usuario: envio.usuario,
      }));
    const simples = enviosSimples
      .filter((envio) => envio.estado !== "anulado" && !(envio.manifiestoDetalles || []).length)
      .map((envio) => ({
        id: `simple-${envio.id}`,
        tipo: "simple" as const,
        numericId: envio.id,
        fecha: envio.fecha,
        numeroGuia: envio.numeroGuia,
        destinatarioNombre: envio.destinatarioNombre,
        vendedorNombre: envio.vendedorNombre || envio.usuario?.nombre || envio.usuario?.usuario || "N/D",
        estado: envio.estado,
        usuario: envio.usuario,
      }));
    return [...normales, ...simples];
  }, [envios, enviosSimples]);

  const enviosSeleccionadosRows = useMemo(() => {
    const selected = new Set(enviosSeleccionados.map((id) => String(id)));
    return enviosDisponiblesManifiesto.filter((envio) => selected.has(envio.id));
  }, [enviosDisponiblesManifiesto, enviosSeleccionados]);

  const consumoEstimado = enviosSeleccionadosRows.length * Number(manifiestoConfig.costoPorLinea || 0);
  const saldoDespuesEstimado = Number(manifiestoConfig.saldoActual || 0) - consumoEstimado;

  const guardarConfiguracionManifiesto = async () => {
    const saldoInicial = Math.max(0, Number(saldoInicialInput || 0));
    const costoPorLinea = Math.max(0, Number(costoLineaInput || 0));
    if (costoPorLinea <= 0) {
      Swal.fire("Dato requerido", "El costo por linea debe ser mayor a cero.", "warning");
      return;
    }

    const confirm = await Swal.fire({
      title: "Actualizar saldo",
      text: "El saldo disponible se ajustara al saldo ingresado. Usalo cuando recibas o recargues saldo de Cargo Expreso.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Actualizar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;

    try {
      setGuardandoSaldo(true);
      const resp = await api.patch("/envios/manifiestos/config", { saldoInicial, costoPorLinea });
      setManifiestoConfig(resp.data);
      setSaldoInicialInput(String(Number(resp.data?.saldoActual || 0)));
      setCostoLineaInput(String(Number(resp.data?.costoPorLinea || 40)));
      Swal.fire("Listo", "Saldo de manifiestos actualizado.", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo actualizar el saldo", "error");
    } finally {
      setGuardandoSaldo(false);
    }
  };

  const generarManifiesto = async () => {
    if (!enviosSeleccionadosRows.length) {
      Swal.fire("Selecciona envios", "Marca las lineas que quieres incluir en el manifiesto.", "warning");
      return;
    }
    if (saldoDespuesEstimado < 0) {
      Swal.fire("Saldo insuficiente", `Necesitas ${money(consumoEstimado)} para generar este manifiesto.`, "warning");
      return;
    }

    const confirm = await Swal.fire({
      title: "Generar manifiesto",
      html: `<p>Se generara un manifiesto con <strong>${enviosSeleccionadosRows.length}</strong> envio(s).</p><p>Consumo: <strong>${money(consumoEstimado)}</strong></p><p>Saldo despues: <strong>${money(saldoDespuesEstimado)}</strong></p>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Generar PDF",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;

    try {
      setGenerandoManifiesto(true);
      const resp = await api.post("/envios/manifiestos", {
        fecha: fechaHasta || today,
        envioIds: enviosSeleccionadosRows.filter((envio) => envio.tipo === "envio").map((envio) => envio.numericId),
        envioSimpleIds: enviosSeleccionadosRows.filter((envio) => envio.tipo === "simple").map((envio) => envio.numericId),
      });
      await descargarEnvioManifiestoPdf(resp.data);
      setEnviosSeleccionados([]);
      await Promise.all([cargarEnvios(), cargarEnviosSimples(), cargarManifiestos()]);
      Swal.fire("Listo", "Manifiesto generado y saldo actualizado.", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo generar el manifiesto", "error");
    } finally {
      setGenerandoManifiesto(false);
    }
  };

  const recargarActual = () => {
    if (tab === 1 && canManage) {
      void cargarEnviosSimples();
      return;
    }
    if (tab === 2 && canManage) {
      void Promise.all([cargarEnvios(), cargarEnviosSimples(), cargarManifiestos()]);
      return;
    }
    void cargarEnvios();
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

  const simpleColumns: GridColDef<EnvioSimpleRow>[] = [
    { field: "folio", headerName: "Registro", minWidth: 120, valueGetter: (_, row) => row.folio || `ES-${row.id}` },
    {
      field: "fecha",
      headerName: "Fecha",
      minWidth: 140,
      valueFormatter: (value) => (value ? new Date(value as string).toLocaleDateString("es-GT") : "-"),
    },
    { field: "numeroGuia", headerName: "No. Guia", minWidth: 160 },
    { field: "destinatarioNombre", headerName: "Destinatario", minWidth: 190, flex: 1 },
    { field: "vendedorNombre", headerName: "Vendedor", minWidth: 170, valueGetter: (_, row) => row.vendedorNombre || row.usuario?.nombre || row.usuario?.usuario || "N/D" },
    {
      field: "estado",
      headerName: "Estado",
      minWidth: 170,
      renderCell: (params) => (
        <TextField
          select
          size="small"
          value={params.row.estado || "pendiente"}
          onChange={(event) => void cambiarEstadoSimple(params.row, event.target.value)}
          sx={{ minWidth: 145 }}
        >
          {ESTADOS_ENVIO.map((estado) => (
            <MenuItem key={estado.value} value={estado.value}>
              <Chip size="small" label={estado.label} color={estadoColor(estado.value) as any} />
            </MenuItem>
          ))}
        </TextField>
      ),
    },
    { field: "observaciones", headerName: "Observaciones", minWidth: 220, flex: 1 },
  ];

  const manifiestoDisponibleColumns: GridColDef<ManifiestoDisponibleRow>[] = [
    {
      field: "tipo",
      headerName: "Tipo",
      minWidth: 100,
      renderCell: (params) => <Chip size="small" color={params.row.tipo === "simple" ? "info" : "primary"} label={params.row.tipo === "simple" ? "Simple" : "Envio"} />,
    },
    {
      field: "fecha",
      headerName: "Fecha",
      minWidth: 130,
      valueFormatter: (value) => (value ? new Date(value as string).toLocaleDateString("es-GT") : "-"),
    },
    { field: "numeroGuia", headerName: "No. Guia", minWidth: 160 },
    { field: "destinatarioNombre", headerName: "Destinatario", minWidth: 190, flex: 1 },
    { field: "vendedorNombre", headerName: "Vendedor", minWidth: 170 },
    {
      field: "estado",
      headerName: "Estado",
      minWidth: 130,
      renderCell: (params) => <Chip size="small" label={params.row.estado || "pendiente"} color={estadoColor(params.row.estado) as any} />,
    },
  ];

  const manifiestoColumns: GridColDef<ManifiestoRow>[] = [
    { field: "folio", headerName: "Manifiesto", minWidth: 140, valueGetter: (_, row) => row.folio || `MAN-${row.id}` },
    {
      field: "fecha",
      headerName: "Fecha",
      minWidth: 150,
      valueFormatter: (value) => (value ? new Date(value as string).toLocaleDateString("es-GT") : "-"),
    },
    { field: "totalLineas", headerName: "Lineas", minWidth: 90, align: "right", headerAlign: "right" },
    {
      field: "totalConsumido",
      headerName: "Consumido",
      minWidth: 130,
      align: "right",
      headerAlign: "right",
      renderCell: (params) => money(params.row.totalConsumido),
    },
    {
      field: "saldoDespues",
      headerName: "Saldo despues",
      minWidth: 140,
      align: "right",
      headerAlign: "right",
      renderCell: (params) => money(params.row.saldoDespues),
    },
    { field: "usuario", headerName: "Creado por", minWidth: 170, valueGetter: (_, row) => row.usuario?.nombre || row.usuario?.usuario || "N/D" },
    {
      field: "acciones",
      headerName: "Acciones",
      minWidth: 120,
      sortable: false,
      renderCell: (params) => (
        <Button size="small" startIcon={<PrintOutlined />} onClick={() => void descargarEnvioManifiestoPdf(params.row)}>
          PDF
        </Button>
      ),
    },
  ];

  if (!canView) return <Navigate to="/" replace />;

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
          <Button startIcon={<RefreshOutlined />} variant="outlined" onClick={recargarActual} disabled={loading || loadingManifiestos}>
            Recargar
          </Button>
        </Stack>
      </Stack>

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tab label="Envios" />
        {canManage && <Tab label="Envios simples" />}
        {canManage && <Tab icon={<SummarizeOutlined />} iconPosition="start" label="Manifiestos" />}
      </Tabs>

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

      {tab === 0 && (
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
      )}

      {tab === 1 && canManage && (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Nuevo envio simple</Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "160px 1fr 1fr 1fr 170px" },
                gap: 2,
                alignItems: "start",
              }}
            >
              <TextField
                label="Fecha"
                type="date"
                size="small"
                value={simpleForm.fecha}
                onChange={(e) => setSimpleForm((prev) => ({ ...prev, fecha: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="No. Guia"
                size="small"
                value={simpleForm.numeroGuia}
                onChange={(e) => setSimpleForm((prev) => ({ ...prev, numeroGuia: e.target.value }))}
              />
              <TextField
                label="Destinatario"
                size="small"
                value={simpleForm.destinatarioNombre}
                onChange={(e) => setSimpleForm((prev) => ({ ...prev, destinatarioNombre: e.target.value }))}
              />
              <TextField
                label="Vendedor"
                size="small"
                value={simpleForm.vendedorNombre}
                onChange={(e) => setSimpleForm((prev) => ({ ...prev, vendedorNombre: e.target.value }))}
                helperText="Opcional, si queda vacio usa el usuario que registra."
              />
              <TextField
                select
                label="Estado"
                size="small"
                value={simpleForm.estado}
                onChange={(e) => setSimpleForm((prev) => ({ ...prev, estado: e.target.value }))}
              >
                {ESTADOS_ENVIO.map((estado) => (
                  <MenuItem key={estado.value} value={estado.value}>
                    {estado.label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 2 }} alignItems={{ xs: "stretch", md: "center" }}>
              <TextField
                label="Observaciones"
                size="small"
                fullWidth
                value={simpleForm.observaciones}
                onChange={(e) => setSimpleForm((prev) => ({ ...prev, observaciones: e.target.value }))}
              />
              <Button startIcon={<AddOutlined />} variant="contained" onClick={crearEnvioSimple} disabled={guardandoSimple}>
                Agregar
              </Button>
            </Stack>
          </Paper>

          <div style={{ height: 470, width: "100%" }}>
            <DataGrid
              rows={enviosSimples}
              columns={simpleColumns}
              loading={loading}
              getRowId={(row) => row.id}
              disableRowSelectionOnClick
              pageSizeOptions={[10, 25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              localeText={{ noRowsLabel: "No hay envios simples registrados para los filtros seleccionados." }}
            />
          </div>
        </Stack>
      )}

      {tab === 2 && canManage && (
        <Stack spacing={2}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" },
              gap: 2,
            }}
          >
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography color="text.secondary" fontSize={12}>Saldo disponible</Typography>
              <Typography variant="h5">{money(manifiestoConfig.saldoActual)}</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography color="text.secondary" fontSize={12}>Envios disponibles</Typography>
              <Typography variant="h5">{manifiestoConfig.enviosDisponibles}</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography color="text.secondary" fontSize={12}>Costo por linea</Typography>
              <Typography variant="h5">{money(manifiestoConfig.costoPorLinea)}</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography color="text.secondary" fontSize={12}>Consumo seleccionado</Typography>
              <Typography variant="h5" color={saldoDespuesEstimado < 0 ? "error.main" : "text.primary"}>{money(consumoEstimado)}</Typography>
            </Paper>
          </Box>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
              <TextField
                label="Saldo Cargo Expreso"
                type="number"
                size="small"
                value={saldoInicialInput}
                onChange={(e) => setSaldoInicialInput(e.target.value)}
                helperText="Al guardar, este sera el nuevo saldo disponible."
              />
              <TextField
                label="Costo por linea"
                type="number"
                size="small"
                value={costoLineaInput}
                onChange={(e) => setCostoLineaInput(e.target.value)}
                helperText="Ejemplo: Q40 por guia."
              />
              <Button startIcon={<SaveOutlined />} variant="outlined" onClick={guardarConfiguracionManifiesto} disabled={guardandoSaldo}>
                Guardar saldo
              </Button>
              <Button startIcon={<PrintOutlined />} variant="contained" onClick={generarManifiesto} disabled={generandoManifiesto || !enviosSeleccionadosRows.length}>
                Generar manifiesto
              </Button>
            </Stack>
          </Paper>

          <Alert severity={saldoDespuesEstimado < 0 ? "warning" : "info"}>
            Seleccionados: {enviosSeleccionadosRows.length}. Saldo despues de generar: {money(saldoDespuesEstimado)}.
            Los envios anulados o ya incluidos en un manifiesto no se muestran para nueva generacion.
          </Alert>

          <div style={{ height: 430, width: "100%" }}>
            <DataGrid
              rows={enviosDisponiblesManifiesto}
              columns={manifiestoDisponibleColumns}
              loading={loading}
              getRowId={(row) => row.id}
              checkboxSelection
              disableRowSelectionOnClick
              rowSelectionModel={enviosSeleccionados}
              onRowSelectionModelChange={(model) => setEnviosSeleccionados(model)}
              pageSizeOptions={[10, 25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              localeText={{ noRowsLabel: "No hay envios disponibles para manifiesto con los filtros seleccionados." }}
            />
          </div>

          <Divider />

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Manifiestos generados</Typography>
            <Button startIcon={<RefreshOutlined />} variant="outlined" onClick={cargarManifiestos} disabled={loadingManifiestos}>
              Recargar manifiestos
            </Button>
          </Stack>
          <div style={{ height: 340, width: "100%" }}>
            <DataGrid
              rows={manifiestos}
              columns={manifiestoColumns}
              loading={loadingManifiestos}
              getRowId={(row) => row.id}
              disableRowSelectionOnClick
              pageSizeOptions={[10, 25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              localeText={{ noRowsLabel: "No hay manifiestos generados." }}
            />
          </div>
        </Stack>
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
