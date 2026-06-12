import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
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
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddBusinessOutlined from "@mui/icons-material/AddBusinessOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";
import { formatCurrency } from "../utils/currency";
import { emptyWhenZero } from "../utils/numberInputs";

interface Catalogo { id: number; nombre: string }
interface Proveedor { id: number; nombre: string; nit?: string | null }
interface ColorAlias {
  id: number;
  proveedorId: number;
  colorId: number;
  codigoProveedor?: string | null;
  nombreProveedor: string;
  activo: boolean;
}

interface IngresoTelaDetalle {
  id: number;
  linea: number;
  telaId?: number | null;
  bodegaId?: number | null;
  colorId?: number | null;
  rolloId?: number | null;
  proveedorCodigo?: string | null;
  proveedorNombre?: string | null;
  descripcionFactura: string;
  cantidad: number;
  unidad?: string | null;
  costoUnitario: number;
  total: number;
  lote?: string | null;
  tono?: string | null;
  ancho: number;
  ubicacion?: string | null;
  estado: string;
  tela?: Catalogo | null;
  bodega?: Catalogo | null;
  color?: Catalogo | null;
}

interface IngresoTela {
  id: number;
  correlativo: string;
  fecha: string;
  estado: string;
  observaciones?: string | null;
  proveedor?: Proveedor | null;
  proveedorId?: number | null;
  documentoTipo?: string | null;
  documentoReferencia?: string | null;
  documentoTotal?: number | null;
  facturaProveedor?: { id: number; serie?: string | null; numeroFactura?: string | null; total?: number | null } | null;
  detalle: IngresoTelaDetalle[];
}

const input = (value: any) => `${value ?? ""}`;
const today = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};
const emptyManualLine = {
  descripcionFactura: "",
  proveedorNombre: "",
  proveedorCodigo: "",
  tono: "",
  telaId: "",
  bodegaId: "",
  colorId: "",
  cantidad: "0",
  unidad: "metros",
  costoUnitario: "0",
  total: "0",
  lote: "",
  ancho: "0",
  ubicacion: "",
  observaciones: "",
};

type ManualLine = typeof emptyManualLine;
type ManualForm = {
  proveedorId: string;
  documentoTipo: string;
  documentoReferencia: string;
  documentoTotal: string;
  fecha: string;
  observaciones: string;
  detalle: ManualLine[];
};

interface IngresoTelasState {
  rows: IngresoTela[];
  telas: Catalogo[];
  bodegas: Catalogo[];
  colores: Catalogo[];
  proveedores: Proveedor[];
  loading: boolean;
  filtros: { estado: string; proveedorId: string };
  paginationModel: { page: number; pageSize: number };
  rowCount: number;
  dialog: { open: boolean; ingreso: IngresoTela | null; detalle: IngresoTelaDetalle[] };
  manualOpen: boolean;
  manualForm: ManualForm;
}

type IngresoTelasAction =
  | { type: "patch"; value: Partial<IngresoTelasState> }
  | { type: "filtrosChanged"; value: Partial<IngresoTelasState["filtros"]> }
  | { type: "dialogChanged"; value: IngresoTelasState["dialog"] }
  | { type: "dialogPatched"; value: Partial<IngresoTelasState["dialog"]> }
  | { type: "dialogDetailChanged"; value: IngresoTelaDetalle[] }
  | { type: "manualOpenChanged"; value: boolean }
  | { type: "manualFormChanged"; value: ManualForm }
  | { type: "manualFormPatched"; value: Partial<ManualForm> }
  | { type: "manualLineChanged"; index: number; value: ManualLine }
  | { type: "manualLineAdded" }
  | { type: "manualLineRemoved"; index: number };

const createInitialManualForm = (): ManualForm => ({
  proveedorId: "",
  documentoTipo: "recibo",
  documentoReferencia: "",
  documentoTotal: "0",
  fecha: today(),
  observaciones: "",
  detalle: [{ ...emptyManualLine }],
});

const initialIngresoTelasState: IngresoTelasState = {
  rows: [],
  telas: [],
  bodegas: [],
  colores: [],
  proveedores: [],
  loading: false,
  filtros: { estado: "", proveedorId: "" },
  paginationModel: { page: 0, pageSize: 25 },
  rowCount: 0,
  dialog: { open: false, ingreso: null, detalle: [] },
  manualOpen: false,
  manualForm: createInitialManualForm(),
};

const ingresoTelasReducer = (state: IngresoTelasState, action: IngresoTelasAction): IngresoTelasState => {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.value };
    case "filtrosChanged":
      return { ...state, filtros: { ...state.filtros, ...action.value }, paginationModel: { ...state.paginationModel, page: 0 } };
    case "dialogChanged":
      return { ...state, dialog: action.value };
    case "dialogPatched":
      return { ...state, dialog: { ...state.dialog, ...action.value } };
    case "dialogDetailChanged":
      return { ...state, dialog: { ...state.dialog, detalle: action.value } };
    case "manualOpenChanged":
      return { ...state, manualOpen: action.value };
    case "manualFormChanged":
      return { ...state, manualForm: action.value };
    case "manualFormPatched":
      return { ...state, manualForm: { ...state.manualForm, ...action.value } };
    case "manualLineChanged":
      return {
        ...state,
        manualForm: {
          ...state.manualForm,
          detalle: state.manualForm.detalle.map((item, index) => (index === action.index ? action.value : item)),
        },
      };
    case "manualLineAdded":
      return {
        ...state,
        manualForm: { ...state.manualForm, detalle: [...state.manualForm.detalle, { ...emptyManualLine }] },
      };
    case "manualLineRemoved":
      return {
        ...state,
        manualForm: {
          ...state.manualForm,
          detalle: state.manualForm.detalle.filter((_, index) => index !== action.index),
        },
      };
    default:
      return state;
  }
};

function IngresoTelasHeader({
  loading,
  canManage,
  onReload,
  onNew,
}: {
  loading: boolean;
  canManage: boolean;
  onReload: () => void;
  onNew: () => void;
}) {
  return (
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
      <Box>
        <Typography variant="h4" fontWeight={600}>Ingreso de telas</Typography>
        <Typography variant="body2" color="text.secondary">
          Documentos abiertos generados desde facturas, recibos o referencias de proveedores de telas para crear rollos en inventario.
        </Typography>
      </Box>
      <Stack direction="row" spacing={1}>
        <Button startIcon={<RefreshOutlined />} variant="outlined" onClick={onReload} disabled={loading}>
          Recargar
        </Button>
        <Button startIcon={<AddOutlined />} variant="contained" onClick={onNew} disabled={!canManage}>
          Nuevo ingreso
        </Button>
      </Stack>
    </Stack>
  );
}

function ResumenCards({ resumen }: { resumen: { documentos: number; abiertos: number; pendientes: number; total: number } }) {
  const cards = [
    { label: "Documentos", value: resumen.documentos },
    { label: "Abiertos", value: resumen.abiertos },
    { label: "Lineas pendientes", value: resumen.pendientes },
    { label: "Total documentos", value: formatCurrency(resumen.total) },
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 2 }}>
      {cards.map((card) => (
        <Grid key={card.label} size={{ xs: 12, sm: 6, lg: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">{card.label}</Typography>
            <Typography variant="h5">{card.value}</Typography>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

function FiltrosIngresoTelas({
  filtros,
  proveedores,
  onChange,
}: {
  filtros: IngresoTelasState["filtros"];
  proveedores: Proveedor[];
  onChange: (value: Partial<IngresoTelasState["filtros"]>) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField select label="Estado" size="small" fullWidth value={filtros.estado} onChange={(e) => onChange({ estado: e.target.value })}>
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="abierto">Abierto</MenuItem>
            <MenuItem value="parcial">Parcial</MenuItem>
            <MenuItem value="cerrado">Cerrado</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField select label="Proveedor" size="small" fullWidth value={filtros.proveedorId} onChange={(e) => onChange({ proveedorId: e.target.value })}>
            <MenuItem value="">Todos</MenuItem>
            {proveedores.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre}</MenuItem>)}
          </TextField>
        </Grid>
      </Grid>
    </Paper>
  );
}

function IngresoTelasTable({
  rows,
  loading,
  paginationModel,
  rowCount,
  canManage,
  onOpen,
  onDelete,
  onPaginationChange,
}: {
  rows: IngresoTela[];
  loading: boolean;
  paginationModel: IngresoTelasState["paginationModel"];
  rowCount: number;
  canManage: boolean;
  onOpen: (row: IngresoTela) => void;
  onDelete: (row: IngresoTela) => void;
  onPaginationChange: (model: IngresoTelasState["paginationModel"]) => void;
}) {
  const columns: GridColDef<IngresoTela>[] = [
    { field: "correlativo", headerName: "Documento", width: 130 },
    { field: "fecha", headerName: "Fecha", width: 120, valueFormatter: (value) => input(value).slice(0, 10) },
    { field: "proveedor", headerName: "Proveedor", minWidth: 210, flex: 1, valueGetter: (_, row) => row.proveedor?.nombre || "N/D" },
    { field: "factura", headerName: "Documento origen", width: 190, valueGetter: (_, row) => row.documentoReferencia || `${row.facturaProveedor?.serie || ""}-${row.facturaProveedor?.numeroFactura || ""}`.replace(/^-|-$/g, "") || "N/D" },
    { field: "lineas", headerName: "Lineas", width: 95, valueGetter: (_, row) => row.detalle.length },
    { field: "pendientes", headerName: "Pendientes", width: 115, valueGetter: (_, row) => row.detalle.filter((item) => !item.rolloId).length },
    { field: "total", headerName: "Total doc.", width: 130, valueGetter: (_, row) => Number(row.facturaProveedor?.total || row.documentoTotal || 0), valueFormatter: (value) => formatCurrency(Number(value || 0)) },
    {
      field: "estado",
      headerName: "Estado",
      width: 120,
      renderCell: ({ row }) => <Chip size="small" color={row.estado === "cerrado" ? "success" : row.estado === "parcial" ? "info" : "warning"} label={row.estado} />,
    },
    {
      field: "acciones",
      headerName: "Acciones",
      width: 160,
      sortable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          <Button size="small" endIcon={<OpenInNewOutlined />} onClick={() => onOpen(row)}>
            Revisar
          </Button>
          <Button
            size="small"
            color="error"
            disabled={!canManage || row.estado !== "abierto" || row.detalle.some((item) => Boolean(item.rolloId))}
            onClick={() => onDelete(row)}
          >
            <DeleteOutline fontSize="small" />
          </Button>
        </Stack>
      ),
    },
  ];

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ height: 590 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25, 50]}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={onPaginationChange}
          rowCount={rowCount}
          disableRowSelectionOnClick
        />
      </Box>
    </Paper>
  );
}

function RevisarIngresoDialog({
  dialog,
  telas,
  bodegas,
  colores,
  canManage,
  onClose,
  onChangeDetalle,
  onDeleteLine,
  onSave,
  onProcess,
  processing,
}: {
  dialog: IngresoTelasState["dialog"];
  telas: Catalogo[];
  bodegas: Catalogo[];
  colores: Catalogo[];
  canManage: boolean;
  onClose: () => void;
  onChangeDetalle: (index: number, field: keyof IngresoTelaDetalle, value: any) => void;
  onDeleteLine: (item: IngresoTelaDetalle) => void;
  onSave: () => void;
  onProcess: () => void;
  processing: boolean;
}) {
  return (
    <Dialog open={dialog.open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>{dialog.ingreso?.correlativo || "Ingreso de telas"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Selecciona la tela interna, bodega obligatoria y datos de rollo. El color proveedor detectado se compara con el catalogo de colores del proveedor para asignar el color interno.
          </Typography>
          <Box sx={{ overflowX: "auto" }}>
            <Grid container spacing={1.25} sx={{ minWidth: 1480 }}>
              {dialog.detalle.map((item, index) => (
                <Grid key={item.id} size={{ xs: 12 }}>
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Grid container spacing={1.25} alignItems="center">
                      <Grid size={{ xs: 0.4 }}><Typography fontWeight={700}>{item.linea}</Typography></Grid>
                      <Grid size={{ xs: 2.2 }}><TextField size="small" label="Descripcion documento" fullWidth value={item.descripcionFactura} disabled /></Grid>
                      <Grid size={{ xs: 1.25 }}><TextField size="small" label="Tela segun proveedor" fullWidth value={item.proveedorNombre || ""} onChange={(e) => onChangeDetalle(index, "proveedorNombre", e.target.value)} /></Grid>
                      <Grid size={{ xs: 1 }}><TextField size="small" label="Codigo prov." fullWidth value={item.proveedorCodigo || ""} onChange={(e) => onChangeDetalle(index, "proveedorCodigo", e.target.value)} /></Grid>
                      <Grid size={{ xs: 1 }}><TextField size="small" label="Color proveedor" fullWidth value={item.tono || ""} onChange={(e) => onChangeDetalle(index, "tono", e.target.value)} /></Grid>
                      <Grid size={{ xs: 1.25 }}><TextField select size="small" label="Tela" fullWidth value={item.telaId || ""} onChange={(e) => onChangeDetalle(index, "telaId", e.target.value)}><MenuItem value="">Pendiente</MenuItem>{telas.map((t) => <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>)}</TextField></Grid>
                      <Grid size={{ xs: 1.2 }}><TextField select size="small" label="Bodega" required fullWidth value={item.bodegaId || ""} onChange={(e) => onChangeDetalle(index, "bodegaId", e.target.value)}><MenuItem value="">Seleccionar</MenuItem>{bodegas.map((b) => <MenuItem key={b.id} value={b.id}>{b.nombre}</MenuItem>)}</TextField></Grid>
                      <Grid size={{ xs: 1 }}><TextField select size="small" label="Color interno" fullWidth value={item.colorId || ""} onChange={(e) => onChangeDetalle(index, "colorId", e.target.value)}><MenuItem value="">Sin color</MenuItem>{colores.map((c) => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}</TextField></Grid>
                      <Grid size={{ xs: 0.8 }}><TextField size="small" type="number" label="Cant." fullWidth value={emptyWhenZero(item.cantidad)} onChange={(e) => onChangeDetalle(index, "cantidad", e.target.value)} /></Grid>
                      <Grid size={{ xs: 0.8 }}><TextField size="small" type="number" label="Costo" fullWidth value={emptyWhenZero(item.costoUnitario)} onChange={(e) => onChangeDetalle(index, "costoUnitario", e.target.value)} /></Grid>
                      <Grid size={{ xs: 0.8 }}><TextField size="small" label="Lote" fullWidth value={item.lote || ""} onChange={(e) => onChangeDetalle(index, "lote", e.target.value)} /></Grid>
                      <Grid size={{ xs: 0.8 }}><Chip size="small" color={item.rolloId ? "success" : item.telaId && item.bodegaId ? "info" : "warning"} label={item.rolloId ? "Ingresado" : item.telaId && item.bodegaId ? "Listo" : "Pendiente"} /></Grid>
                      <Grid size={{ xs: 0.45 }}>
                        <Button color="error" disabled={!canManage || dialog.ingreso?.estado !== "abierto" || Boolean(item.rolloId) || dialog.detalle.length <= 1} onClick={() => onDeleteLine(item)}>
                          <DeleteOutline fontSize="small" />
                        </Button>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        <Button variant="outlined" onClick={onSave} disabled={!canManage || processing}>Guardar cambios</Button>
        <Button startIcon={<AddBusinessOutlined />} variant="contained" onClick={onProcess} disabled={!canManage || processing || dialog.ingreso?.estado === "cerrado"}>
          {processing ? "Procesando..." : "Procesar ingreso"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ManualIngresoDialog({
  open,
  manualForm,
  proveedores,
  telas,
  bodegas,
  colores,
  canManage,
  onClose,
  onPatchForm,
  onAddLine,
  onRemoveLine,
  onChangeLine,
  onCreate,
  creating,
}: {
  open: boolean;
  manualForm: ManualForm;
  proveedores: Proveedor[];
  telas: Catalogo[];
  bodegas: Catalogo[];
  colores: Catalogo[];
  canManage: boolean;
  onClose: () => void;
  onPatchForm: (value: Partial<ManualForm>) => void;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  onChangeLine: (index: number, field: string, value: any) => void;
  onCreate: () => void;
  creating: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>Nuevo ingreso de tela</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField select label="Proveedor" fullWidth required value={manualForm.proveedorId} onChange={(e) => onPatchForm({ proveedorId: e.target.value })}>
                {proveedores.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre}{item.nit ? ` - ${item.nit}` : ""}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField select label="Tipo documento" fullWidth value={manualForm.documentoTipo} onChange={(e) => onPatchForm({ documentoTipo: e.target.value })}>
                <MenuItem value="recibo">Recibo</MenuItem>
                <MenuItem value="factura">Factura manual</MenuItem>
                <MenuItem value="nota">Nota</MenuItem>
                <MenuItem value="manual">Manual</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}><TextField label="Referencia / numero" fullWidth value={manualForm.documentoReferencia} onChange={(e) => onPatchForm({ documentoReferencia: e.target.value })} /></Grid>
            <Grid size={{ xs: 12, md: 2 }}><TextField label="Fecha" type="date" InputLabelProps={{ shrink: true }} fullWidth value={manualForm.fecha} onChange={(e) => onPatchForm({ fecha: e.target.value })} /></Grid>
            <Grid size={{ xs: 12, md: 2 }}><TextField label="Total documento" type="number" fullWidth value={emptyWhenZero(manualForm.documentoTotal)} onChange={(e) => onPatchForm({ documentoTotal: e.target.value })} /></Grid>
            <Grid size={{ xs: 12 }}><TextField label="Observaciones" fullWidth multiline minRows={2} value={manualForm.observaciones} onChange={(e) => onPatchForm({ observaciones: e.target.value })} /></Grid>
          </Grid>

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1">Lineas de tela</Typography>
            <Button startIcon={<AddOutlined />} onClick={onAddLine}>Agregar linea</Button>
          </Stack>

          <Box sx={{ overflowX: "auto" }}>
            <Grid container spacing={1.25} sx={{ minWidth: 1420 }}>
              {manualForm.detalle.map((item, index) => (
                <Grid key={`${item.descripcionFactura}-${item.proveedorCodigo}-${index}`} size={{ xs: 12 }}>
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Grid container spacing={1.25} alignItems="center">
                      <Grid size={{ xs: 0.35 }}><Typography fontWeight={700}>{index + 1}</Typography></Grid>
                      <Grid size={{ xs: 1.9 }}><TextField size="small" label="Descripcion" fullWidth value={item.descripcionFactura} onChange={(e) => onChangeLine(index, "descripcionFactura", e.target.value)} /></Grid>
                      <Grid size={{ xs: 1.2 }}><TextField size="small" label="Tela proveedor" fullWidth value={item.proveedorNombre} onChange={(e) => onChangeLine(index, "proveedorNombre", e.target.value)} /></Grid>
                      <Grid size={{ xs: 0.9 }}><TextField size="small" label="Codigo prov." fullWidth value={item.proveedorCodigo} onChange={(e) => onChangeLine(index, "proveedorCodigo", e.target.value)} /></Grid>
                      <Grid size={{ xs: 0.9 }}><TextField size="small" label="Color prov." fullWidth value={item.tono} onChange={(e) => onChangeLine(index, "tono", e.target.value)} /></Grid>
                      <Grid size={{ xs: 1.15 }}><TextField select size="small" label="Tela" fullWidth value={item.telaId} onChange={(e) => onChangeLine(index, "telaId", e.target.value)}><MenuItem value="">Pendiente</MenuItem>{telas.map((t) => <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>)}</TextField></Grid>
                      <Grid size={{ xs: 1.05 }}><TextField select size="small" label="Bodega" required fullWidth value={item.bodegaId} onChange={(e) => onChangeLine(index, "bodegaId", e.target.value)}><MenuItem value="">Seleccionar</MenuItem>{bodegas.map((b) => <MenuItem key={b.id} value={b.id}>{b.nombre}</MenuItem>)}</TextField></Grid>
                      <Grid size={{ xs: 1 }}><TextField select size="small" label="Color interno" fullWidth value={item.colorId} onChange={(e) => onChangeLine(index, "colorId", e.target.value)}><MenuItem value="">Sin color</MenuItem>{colores.map((c) => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}</TextField></Grid>
                      <Grid size={{ xs: 0.75 }}><TextField size="small" type="number" label="Cant." fullWidth value={emptyWhenZero(item.cantidad)} onChange={(e) => onChangeLine(index, "cantidad", e.target.value)} /></Grid>
                      <Grid size={{ xs: 0.75 }}><TextField size="small" type="number" label="Costo" fullWidth value={emptyWhenZero(item.costoUnitario)} onChange={(e) => onChangeLine(index, "costoUnitario", e.target.value)} /></Grid>
                      <Grid size={{ xs: 0.75 }}><TextField size="small" label="Lote" fullWidth value={item.lote} onChange={(e) => onChangeLine(index, "lote", e.target.value)} /></Grid>
                      <Grid size={{ xs: 0.45 }}>
                        <Button color="error" disabled={manualForm.detalle.length === 1} onClick={() => onRemoveLine(index)}>
                          <DeleteOutline fontSize="small" />
                        </Button>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={creating}>Cancelar</Button>
        <Button variant="contained" onClick={onCreate} disabled={!canManage || creating}>
          {creating ? "Creando..." : "Crear ingreso"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function IngresoTelas() {
  const { rol, permisos } = useAuthStore();
  const canManage = hasPermission(rol, permisos, "inventario.telas.manage");
  const [state, dispatch] = useReducer(ingresoTelasReducer, initialIngresoTelasState);
  const [creandoManual, setCreandoManual] = useState(false);
  const [procesandoIngreso, setProcesandoIngreso] = useState(false);
  const { rows, telas, bodegas, colores, proveedores, loading, filtros, paginationModel, rowCount, dialog, manualOpen, manualForm } = state;
  const colorAliasesRef = useRef<ColorAlias[]>([]);
  const creandoManualRef = useRef(false);
  const procesandoIngresoRef = useRef(false);

  const normalize = (value: any) =>
    `${value ?? ""}`.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
  const normalizeProviderCode = (value: any) => `${value ?? ""}`.replace(/^#\s*/, "").trim().toUpperCase();

  const detectarColorProveedor = (item: Partial<IngresoTelaDetalle>) => {
    const descripcion = `${item.descripcionFactura || ""}`.replace(/\s+/g, " ").trim();
    const codigo = `${item.proveedorCodigo || item.lote || ""}`.trim();
    if (codigo && descripcion.includes(codigo)) {
      const afterCode = descripcion.slice(descripcion.indexOf(codigo) + codigo.length).replace(/^[@#\s-]+/, "").trim();
      const token = afterCode.replace(/@.*$/g, "").replace(/\b\d+(?:\.\d+)?$/g, "").replace(/[,\-/\s]+$/g, "").trim();
      if (token) return token;
    }
    const token = descripcion.match(/#?\d+[A-Z0-9-]*\s+(.+?)(?:@|\s+\d+(?:\.\d+)?\s*$|$)/i)?.[1]?.trim();
    return token || `${item.tono || ""}`.trim();
  };

  const detectarLoteProveedor = (item: Partial<IngresoTelaDetalle>) => {
    const descripcion = `${item.descripcionFactura || ""}`.replace(/\s+/g, " ").trim();
    const lote = descripcion.match(/@([A-Z0-9-]+)/i)?.[1]?.trim();
    return lote || `${item.lote || ""}`.trim();
  };

  const resolverColorProveedor = (proveedorId: any, item: Partial<IngresoTelaDetalle>) => {
    const colorProveedor = detectarColorProveedor(item);
    const codigoProveedor = normalizeProviderCode(item.proveedorCodigo);
    const colorNormalizado = normalize(colorProveedor);
    const alias = colorAliasesRef.current.find((row) => {
      if (Number(row.proveedorId) !== Number(proveedorId) || row.activo === false) return false;
      const codigo = normalizeProviderCode(row.codigoProveedor);
      const nombre = normalize(row.nombreProveedor);
      return Boolean((nombre && colorNormalizado && nombre === colorNormalizado) || (codigo && codigoProveedor && codigo === codigoProveedor));
    });
    return { colorProveedor, colorId: alias?.colorId || item.colorId || "" };
  };

  const cargar = useCallback(async () => {
    dispatch({ type: "patch", value: { loading: true } });
    try {
      const params = {
        ...Object.fromEntries(Object.entries(filtros).filter(([, value]) => value)),
        page: paginationModel.page,
        pageSize: paginationModel.pageSize,
      };
      const [respIng, respTelas, respBod, respCol, respColorAliases, respProv] = await Promise.all([
        api.get("/inventario-telas/ingresos", { params }),
        api.get("/telas"),
        api.get("/bodegas"),
        api.get("/colores"),
        api.get("/colores/proveedor-aliases").catch(() => ({ data: [] })),
        api.get("/proveedores", { params: { estado: "activo" } }).catch(() => ({ data: [] })),
      ]);
      const payload = respIng.data;
      colorAliasesRef.current = respColorAliases.data || [];
      dispatch({
        type: "patch",
        value: {
          rows: Array.isArray(payload) ? payload : payload?.data || [],
          rowCount: Array.isArray(payload) ? payload.length : Number(payload?.total || 0),
          telas: respTelas.data || [],
          bodegas: respBod.data || [],
          colores: respCol.data || [],
          proveedores: respProv.data || [],
        },
      });
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudieron cargar ingresos de telas", "error");
    } finally {
      dispatch({ type: "patch", value: { loading: false } });
    }
  }, [filtros, paginationModel]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const resumen = useMemo(() => {
    const abiertos = rows.filter((row) => row.estado !== "cerrado").length;
    const pendientes = rows.reduce((sum, row) => sum + row.detalle.filter((item) => !item.rolloId).length, 0);
    const total = rows.reduce((sum, row) => sum + Number(row.facturaProveedor?.total || row.documentoTotal || 0), 0);
    return { documentos: rows.length, abiertos, pendientes, total };
  }, [rows]);

  const abrir = async (row: IngresoTela) => {
    const { data } = await api.get(`/inventario-telas/ingresos/${row.id}`);
    const proveedorId = data.proveedorId || data.proveedor?.id;
    const detalle = (data.detalle || []).map((item: IngresoTelaDetalle) => {
      const match = resolverColorProveedor(proveedorId, item);
      const loteDetectado = detectarLoteProveedor(item);
      return {
        ...item,
        tono: match.colorProveedor || item.tono,
        lote: !item.lote || item.lote === item.proveedorCodigo ? loteDetectado : item.lote,
        colorId: match.colorId || item.colorId,
      };
    });
    dispatch({ type: "dialogChanged", value: { open: true, ingreso: data, detalle } });
  };

  const setDetalleValue = (index: number, field: keyof IngresoTelaDetalle, value: any) => {
    const nextDetalle = dialog.detalle.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, [field]: value };
        if (field === "tono" || field === "descripcionFactura" || field === "proveedorCodigo") {
          const match = resolverColorProveedor(dialog.ingreso?.proveedorId || dialog.ingreso?.proveedor?.id, next);
          next.tono = match.colorProveedor || next.tono;
          next.lote = detectarLoteProveedor(next) || next.lote;
          if (match.colorId) next.colorId = Number(match.colorId);
        }
        return next;
      });
    dispatch({ type: "dialogDetailChanged", value: nextDetalle });
  };

  const setManualLineValue = (index: number, field: string, value: any) => {
    const nextDetalle = manualForm.detalle.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next: any = { ...item, [field]: value };
        if (field === "tono" || field === "descripcionFactura" || field === "proveedorCodigo") {
          const match = resolverColorProveedor(manualForm.proveedorId, next);
          next.tono = match.colorProveedor || next.tono;
          next.lote = detectarLoteProveedor(next) || next.lote;
          if (match.colorId) next.colorId = String(match.colorId);
        }
        if (field === "cantidad" || field === "costoUnitario") {
          next.total = String(Number(next.cantidad || 0) * Number(next.costoUnitario || 0));
        }
        return next;
      });
    dispatch({ type: "manualFormPatched", value: { detalle: nextDetalle } });
  };

  const crearManual = async () => {
    if (creandoManualRef.current) return;
    try {
      creandoManualRef.current = true;
      setCreandoManual(true);
      const { data } = await api.post("/inventario-telas/ingresos", manualForm);
      dispatch({ type: "manualOpenChanged", value: false });
      dispatch({ type: "manualFormChanged", value: createInitialManualForm() });
      await cargar();
      await abrir(data);
      Swal.fire("Listo", "Ingreso manual creado", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo crear el ingreso", "error");
    } finally {
      creandoManualRef.current = false;
      setCreandoManual(false);
    }
  };

  const guardarLinea = async (item: IngresoTelaDetalle) => {
    if (!dialog.ingreso) return;
    await api.patch(`/inventario-telas/ingresos/${dialog.ingreso.id}/detalle/${item.id}`, item);
  };

  const eliminarLinea = async (item: IngresoTelaDetalle) => {
    if (!dialog.ingreso) return;
    const result = await Swal.fire({
      title: "Eliminar linea",
      text: `Se eliminara la linea ${item.linea}.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    if (procesandoIngresoRef.current) return;
    try {
      const { data } = await api.delete(`/inventario-telas/ingresos/${dialog.ingreso.id}/detalle/${item.id}`);
      dispatch({ type: "dialogChanged", value: { open: true, ingreso: data, detalle: data.detalle || [] } });
      await cargar();
      Swal.fire("Listo", "Linea eliminada", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo eliminar la linea", "error");
    }
  };

  const eliminarIngreso = async (row: IngresoTela) => {
    const result = await Swal.fire({
      title: "Eliminar ingreso",
      text: `Se eliminara ${row.correlativo}. Esta accion no se puede deshacer.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/inventario-telas/ingresos/${row.id}`);
      await cargar();
      Swal.fire("Listo", "Ingreso eliminado", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo eliminar el ingreso", "error");
    }
  };

  const guardarTodo = async () => {
    if (!dialog.ingreso) return;
    try {
      await Promise.all(dialog.detalle.map((item) => guardarLinea(item)));
      const { data } = await api.get(`/inventario-telas/ingresos/${dialog.ingreso.id}`);
      dispatch({ type: "dialogChanged", value: { open: true, ingreso: data, detalle: data.detalle || [] } });
      await cargar();
      Swal.fire("Listo", "Lineas actualizadas", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudieron guardar las lineas", "error");
    }
  };

  const procesar = async () => {
    if (procesandoIngresoRef.current) return;
    if (!dialog.ingreso) return;
    const incompletas = dialog.detalle.filter((item) => !item.rolloId && (!item.telaId || !item.bodegaId || Number(item.cantidad || 0) <= 0));
    if (incompletas.length) {
      Swal.fire("Faltan datos", "Todas las lineas pendientes deben tener tela, bodega y cantidad mayor a cero.", "warning");
      return;
    }
    const result = await Swal.fire({
      title: "Ingresar telas",
      text: "Se crearan rollos en inventario para las lineas que tengan tela, bodega y cantidad.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ingresar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    try {
      procesandoIngresoRef.current = true;
      setProcesandoIngreso(true);
      await guardarTodo();
      await api.post(`/inventario-telas/ingresos/${dialog.ingreso.id}/procesar`);
      dispatch({ type: "dialogChanged", value: { open: false, ingreso: null, detalle: [] } });
      await cargar();
      Swal.fire("Listo", "Ingreso procesado y rollos creados", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo procesar el ingreso", "error");
    } finally {
      procesandoIngresoRef.current = false;
      setProcesandoIngreso(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      <IngresoTelasHeader
        loading={loading}
        canManage={canManage}
        onReload={() => void cargar()}
        onNew={() => dispatch({ type: "manualOpenChanged", value: true })}
      />
      <ResumenCards resumen={resumen} />
      <FiltrosIngresoTelas filtros={filtros} proveedores={proveedores} onChange={(value) => dispatch({ type: "filtrosChanged", value })} />
      <IngresoTelasTable
        rows={rows}
        loading={loading}
        paginationModel={paginationModel}
        rowCount={rowCount}
        canManage={canManage}
        onOpen={(row) => void abrir(row)}
        onDelete={(row) => void eliminarIngreso(row)}
        onPaginationChange={(model) => dispatch({ type: "patch", value: { paginationModel: model } })}
      />
      <RevisarIngresoDialog
        dialog={dialog}
        telas={telas}
        bodegas={bodegas}
        colores={colores}
        canManage={canManage}
        onClose={() => dispatch({ type: "dialogPatched", value: { open: false } })}
        onChangeDetalle={setDetalleValue}
        onDeleteLine={(item) => void eliminarLinea(item)}
        onSave={() => void guardarTodo()}
        onProcess={() => void procesar()}
        processing={procesandoIngreso}
      />
      <ManualIngresoDialog
        open={manualOpen}
        manualForm={manualForm}
        proveedores={proveedores}
        telas={telas}
        bodegas={bodegas}
        colores={colores}
        canManage={canManage}
        onClose={() => dispatch({ type: "manualOpenChanged", value: false })}
        onPatchForm={(value) => dispatch({ type: "manualFormPatched", value })}
        onAddLine={() => dispatch({ type: "manualLineAdded" })}
        onRemoveLine={(index) => dispatch({ type: "manualLineRemoved", index })}
        onChangeLine={setManualLineValue}
        onCreate={() => void crearManual()}
        creating={creandoManual}
      />
    </Box>
  );
}
