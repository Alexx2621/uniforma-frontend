import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { hasPermission } from "../auth/permissions";
import { useTablePagination } from "../utils/useTablePagination";

interface DocumentoCorreccion {
  id: number;
  tipo: string;
  correlativo: string;
  titulo?: string | null;
  data: any;
  actualizadoEn: string;
  usuario?: { nombre?: string | null; usuario?: string | null };
  _count?: { correcciones?: number };
}

interface CorreccionRow {
  id: number;
  campo: string;
  etiqueta: string;
  valorAnterior: any;
  valorNuevo: any;
  motivo: string;
  creadoEn: string;
  usuario?: { nombre?: string | null; usuario?: string | null };
  documento?: { correlativo?: string | null; titulo?: string | null; tipo?: string | null };
}

const money = (value: number) =>
  `Q ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const METODO_OPTIONS = ["efectivo", "transferencia", "deposito_bancario", "tarjeta", "visalink", "orden_compra", "sin_cobro", "sin_cobro_stock"];

const formatValue = (value: any) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return Number.isFinite(value) ? money(value) : `${value}`;
  if (typeof value === "object") return JSON.stringify(value);
  return `${value}`;
};

const getDocumentoTotal = (doc?: DocumentoCorreccion | null) => {
  if (!doc) return 0;
  if (doc.tipo === "pagoPedido") {
    return Number(doc.data?.monto || 0) + Number(doc.data?.recargo || 0);
  }
  if (doc.tipo === "pagoVenta") {
    return Number(doc.data?.monto || 0);
  }
  if (doc.tipo === "reporteQuincenal") {
    return Object.values(doc.data?.ventasPorDia || {}).reduce((sum: number, value: any) => sum + Number(value || 0), 0);
  }
  const capital = Array.isArray(doc.data?.capitalRows)
    ? doc.data.capitalRows.reduce(
        (sum: number, row: any) => sum + Number(row.transferencia || 0) + Number(row.deposito || 0) + Number(row.efectivo || 0),
        0
      )
    : 0;
  const departamento = Array.isArray(doc.data?.departamentoRows)
    ? doc.data.departamentoRows.reduce((sum: number, row: any) => sum + Number(row.transferencia || 0) + Number(row.deposito || 0), 0)
    : 0;
  const tienda = Array.isArray(doc.data?.tiendaManualRows)
    ? doc.data.tiendaManualRows.reduce(
        (sum: number, row: any) =>
          sum + (Number(row.total || 0) || Number(row.transferencia || 0) + Number(row.tarjeta || 0) + Number(row.efectivo || 0)),
        0
      )
    : 0;
  return capital + departamento + tienda;
};

const getTipoLabel = (tipo?: string | null) => {
  if (tipo === "reporteQuincenal") return "Reporte quincenal";
  if (tipo === "reporteDiario") return "Reporte diario";
  if (tipo === "pagoPedido") return "Pago de pedido";
  if (tipo === "pagoVenta") return "Pago de venta";
  return tipo || "N/D";
};

const getFieldValue = (doc: DocumentoCorreccion | null, field: string) =>
  field.split(".").reduce<any>((current, part) => (current == null ? undefined : current[part]), doc?.data || {});

const getCorrectionFields = (doc: DocumentoCorreccion | null) => {
  if (!doc) return [];
  if (doc.tipo === "pagoPedido" || doc.tipo === "pagoVenta") {
    const fields = [
      { value: "monto", label: "Monto ingresado", current: doc.data?.monto },
      { value: "metodo", label: "Metodo de pago", current: doc.data?.metodo },
      { value: "referencia", label: "Numero de referencia", current: doc.data?.referencia },
      { value: "banco", label: "Banco", current: doc.data?.banco },
    ];
    if (doc.tipo === "pagoPedido") {
      fields.push(
        { value: "numeroEnvio", label: "Numero de envio/guia", current: doc.data?.numeroEnvio },
        { value: "numeroRecibo", label: "Numero de recibo", current: doc.data?.numeroRecibo },
        { value: "referenciaDocumento", label: "Referencia de documento externo", current: doc.data?.referenciaDocumento },
        { value: "observacionesPago", label: "Observaciones del pago", current: doc.data?.observacionesPago },
      );
    }
    return fields;
  }
  if (doc.tipo === "reporteQuincenal") {
    const ventasPorDia = doc.data?.ventasPorDia || {};
    return Object.keys(ventasPorDia)
      .sort((a, b) => Number(a) - Number(b))
      .map((day) => ({ value: `ventasPorDia.${day}`, label: `Dia ${day}`, current: ventasPorDia[day] }));
  }
  return [
    { value: "fecha", label: "Fecha", current: doc.data?.fecha },
    { value: "tienda", label: "Tienda", current: doc.data?.tienda },
    { value: "vendedor", label: "Vendedor", current: doc.data?.vendedor },
  ].filter((item) => item.current !== undefined);
};

export default function Correcciones() {
  const { rol, permisos } = useAuthStore();
  const canView = hasPermission(rol, permisos, "correcciones.view");
  const canManage = hasPermission(rol, permisos, "correcciones.manage");
  const [tipo, setTipo] = useState("reporteQuincenal");
  const [q, setQ] = useState("");
  const [documentos, setDocumentos] = useState<DocumentoCorreccion[]>([]);
  const [selected, setSelected] = useState<DocumentoCorreccion | null>(null);
  const [historial, setHistorial] = useState<CorreccionRow[]>([]);
  const [campo, setCampo] = useState("");
  const [valorNuevo, setValorNuevo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fields = useMemo(() => getCorrectionFields(selected), [selected]);
  const currentValue = selected && campo ? getFieldValue(selected, campo) : undefined;
  const { paginatedRows: historialPaginado, paginationProps: historialPaginationProps } = useTablePagination(historial, 10);
  const cargarHistorial = useCallback(async (params: { documentoId?: number; tipo?: string; entidadId?: number } = {}) => {
    const { data } = await api.get("/correcciones/historial", { params });
    setHistorial(Array.isArray(data) ? data : []);
  }, []);

  const buscar = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/correcciones/objetos", { params: { tipo, q, limit: 50, _ts: Date.now() } });
      setDocumentos(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudieron buscar documentos", "error");
    } finally {
      setLoading(false);
    }
  }, [q, tipo]);

  useEffect(() => {
    if (canView) {
      void buscar();
      void cargarHistorial();
    }
  }, [buscar, canView, cargarHistorial]);

  const seleccionarDocumento = async (doc: DocumentoCorreccion) => {
    try {
      const { data } = await api.get(`/correcciones/objetos/${doc.tipo}/${doc.id}`, { params: { _ts: Date.now() } });
      setSelected(data);
      const nextFields = getCorrectionFields(data);
      const firstField = nextFields[0]?.value || "";
      setCampo(firstField);
      setValorNuevo(firstField ? `${getFieldValue(data, firstField) ?? ""}` : "");
      setMotivo("");
      await cargarHistorial(
        ["pagoPedido", "pagoVenta"].includes(data.tipo)
          ? { tipo: data.tipo, entidadId: data.id }
          : { documentoId: data.id }
      );
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo cargar el documento", "error");
    }
  };

  const aplicarCorreccion = async () => {
    if (!selected || !campo) return;
    if (!canManage) {
      Swal.fire("Acceso restringido", "No tienes permiso para aplicar correcciones", "warning");
      return;
    }
    try {
      setSaving(true);
      const resp = await api.patch(`/correcciones/objetos/${selected.tipo}/${selected.id}`, { campo, valorNuevo, motivo });
      setSelected(resp.data?.documento || null);
      setValorNuevo(`${getFieldValue(resp.data?.documento || null, campo) ?? ""}`);
      setMotivo("");
      await Promise.all([
        buscar(),
        cargarHistorial(
          ["pagoPedido", "pagoVenta"].includes(selected.tipo)
            ? { tipo: selected.tipo, entidadId: selected.id }
            : { documentoId: selected.id }
        ),
      ]);
      Swal.fire("Guardado", "Correccion aplicada y registrada en auditoria", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo aplicar la correccion", "error");
    } finally {
      setSaving(false);
    }
  };

  const columns: GridColDef[] = [
    { field: "correlativo", headerName: "Correlativo", minWidth: 150 },
    { field: "titulo", headerName: "Titulo", minWidth: 230, flex: 1 },
    {
      field: "tipo",
      headerName: "Tipo",
      minWidth: 150,
      renderCell: (params) => <Chip size="small" label={getTipoLabel(params.row.tipo)} />,
    },
    {
      field: "total",
      headerName: "Total",
      minWidth: 140,
      valueGetter: (_, row) => getDocumentoTotal(row),
      valueFormatter: (value) => money(Number(value || 0)),
    },
    { field: "correcciones", headerName: "Correcciones", minWidth: 130, valueGetter: (_, row) => row._count?.correcciones || 0 },
    {
      field: "acciones",
      headerName: "Accion",
      minWidth: 130,
      sortable: false,
      renderCell: (params) => (
        <Button size="small" variant="outlined" onClick={() => seleccionarDocumento(params.row)}>
          Abrir
        </Button>
      ),
    },
  ];

  if (!canView) return <Navigate to="/" replace />;

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4">Correcciones controladas</Typography>
          <Typography variant="body2" color="text.secondary">
            Corrige reportes y pagos con motivo obligatorio y registro de auditoria.
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField select label="Tipo" size="small" value={tipo} onChange={(e) => setTipo(e.target.value)} sx={{ minWidth: 210 }}>
            <MenuItem value="reporteQuincenal">Reporte quincenal</MenuItem>
            <MenuItem value="reporteDiario">Reporte diario</MenuItem>
            <MenuItem value="pagoPedido">Pagos de pedidos</MenuItem>
            <MenuItem value="pagoVenta">Pagos de ventas</MenuItem>
          </TextField>
          <TextField
            label="Buscar por correlativo o titulo"
            size="small"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void buscar();
            }}
            sx={{ minWidth: { xs: "100%", md: 360 } }}
          />
          <Button variant="contained" startIcon={<SearchOutlined />} onClick={buscar} disabled={loading}>
            Buscar
          </Button>
        </Stack>

        <Box sx={{ height: 360, width: "100%" }}>
          <DataGrid rows={documentos} columns={columns} loading={loading} disableRowSelectionOnClick pageSizeOptions={[10, 25, 50]} />
        </Box>

        {selected && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }}>
                <Chip label={selected.correlativo} color="primary" />
                <Typography fontWeight={700}>{selected.titulo || "Sin titulo"}</Typography>
                <Typography color="text.secondary">Total actual: {money(getDocumentoTotal(selected))}</Typography>
              </Stack>

              {!canManage && <Alert severity="info">Puedes revisar correcciones, pero no aplicarlas con tu rol actual.</Alert>}

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Campo</InputLabel>
                  <Select
                    label="Campo"
                    value={campo}
                    onChange={(e) => {
                      setCampo(e.target.value);
                      setValorNuevo(`${getFieldValue(selected, e.target.value) ?? ""}`);
                    }}
                  >
                    {fields.map((field) => (
                      <MenuItem key={field.value} value={field.value}>
                        {field.label} - actual: {formatValue(field.current)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField label="Valor actual" size="small" value={formatValue(currentValue)} disabled sx={{ minWidth: 190 }} />
                {campo === "metodo" ? (
                  <TextField
                    select
                    label="Nuevo valor"
                    size="small"
                    value={valorNuevo}
                    onChange={(e) => setValorNuevo(e.target.value)}
                    sx={{ minWidth: 220 }}
                  >
                    {METODO_OPTIONS.map((metodo) => (
                      <MenuItem key={metodo} value={metodo}>
                        {metodo}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <TextField
                    label="Nuevo valor"
                    size="small"
                    type={campo === "monto" ? "number" : "text"}
                    value={valorNuevo}
                    onChange={(e) => setValorNuevo(e.target.value)}
                    sx={{ minWidth: 190 }}
                  />
                )}
              </Stack>
              <TextField
                label="Motivo de la correccion"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                multiline
                minRows={2}
                fullWidth
                placeholder="Ej. Se corrigio digitacion del cierre; valor correcto validado contra boleta."
              />
              <Stack direction="row" justifyContent="flex-end">
                <Button variant="contained" startIcon={<SaveOutlined />} onClick={aplicarCorreccion} disabled={saving || !canManage}>
                  Aplicar correccion
                </Button>
              </Stack>
            </Stack>
          </Paper>
        )}

        <Divider />

        <Stack direction="row" spacing={1} alignItems="center">
          <HistoryOutlined color="action" />
          <Typography variant="h6">Historial de correcciones</Typography>
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Documento</TableCell>
                <TableCell>Campo</TableCell>
                <TableCell>Anterior</TableCell>
                <TableCell>Nuevo</TableCell>
                <TableCell>Usuario</TableCell>
                <TableCell>Motivo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {historialPaginado.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{new Date(row.creadoEn).toLocaleString("es-GT")}</TableCell>
                  <TableCell>{row.documento?.correlativo || selected?.correlativo || row.id}</TableCell>
                  <TableCell>{row.etiqueta || row.campo}</TableCell>
                  <TableCell>{formatValue(row.valorAnterior)}</TableCell>
                  <TableCell>{formatValue(row.valorNuevo)}</TableCell>
                  <TableCell>{row.usuario?.nombre || row.usuario?.usuario || "N/D"}</TableCell>
                  <TableCell sx={{ maxWidth: 320 }}>{row.motivo}</TableCell>
                </TableRow>
              ))}
              {!historial.length && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No hay correcciones registradas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination {...historialPaginationProps} />
      </Stack>
    </Paper>
  );
}
