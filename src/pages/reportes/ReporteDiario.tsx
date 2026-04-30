import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Paper,
  Typography,
  Stack,
  Grid,
  TextField,
  Button,
  Divider,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from "@mui/material";
import AddCircleOutlineOutlined from "@mui/icons-material/AddCircleOutlineOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import CleaningServicesOutlined from "@mui/icons-material/CleaningServicesOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import Swal from "sweetalert2";
import { api } from "../../api/axios";
import { useAuthStore } from "../../auth/useAuthStore";

interface PagoVenta {
  referencia?: string | null;
}

interface DocumentoGenerado {
  id: number;
  tipo: string;
  correlativo: string;
  titulo?: string | null;
  data: any;
  creadoEn: string;
  actualizadoEn: string;
  usuario?: { nombre?: string | null; usuario?: string | null };
}

interface Usuario {
  id: number;
  nombre: string;
  usuario: string;
}

interface Venta {
  id: number;
  fecha: string;
  total: number;
  metodoPago?: string | null;
  clienteNombre?: string | null;
  pagos?: PagoVenta[];
}

interface CapitalRow {
  id: number;
  fecha: string;
  envio: string;
  transferencia: number;
  autorizacion: string;
  deposito: number;
  boleta: string;
  banco: string;
  efectivo: number;
  observaciones: string;
}

interface DepartamentoRow {
  id: number;
  fecha: string;
  envio: string;
  transferencia: number;
  autorizacion: string;
  deposito: number;
  boleta: string;
  banco: string;
  observaciones: string;
}

interface TiendaRow {
  id: number;
  fecha: string;
  recibo: string;
  transferencia: number;
  autorizacionTransferencia: string;
  tarjeta: number;
  autorizacionTarjeta: string;
  efectivo: number;
  total: number;
  observaciones: string;
}

const money = (value: number) =>
  `Q ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toDateOnly = (value: string | Date) => {
  const d = typeof value === "string" ? new Date(value) : value;
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const formatDisplayDate = (value: string) => {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

const metodoCuentaComoTarjeta = (metodo?: string | null) => {
  const normalized = `${metodo || ""}`.trim().toLowerCase();
  return normalized === "tarjeta" || normalized === "visalink";
};

const createCapitalRow = (fecha: string): CapitalRow => ({
  id: Date.now() + Math.floor(Math.random() * 100000),
  fecha,
  envio: "",
  transferencia: 0,
  autorizacion: "",
  deposito: 0,
  boleta: "",
  banco: "",
  efectivo: 0,
  observaciones: "",
});

const createDepartamentoRow = (fecha: string): DepartamentoRow => ({
  id: Date.now() + Math.floor(Math.random() * 100000),
  fecha,
  envio: "",
  transferencia: 0,
  autorizacion: "",
  deposito: 0,
  boleta: "",
  banco: "",
  observaciones: "",
});

const createTiendaRow = (fecha: string): TiendaRow => ({
  id: Date.now() + Math.floor(Math.random() * 100000),
  fecha,
  recibo: "",
  transferencia: 0,
  autorizacionTransferencia: "",
  tarjeta: 0,
  autorizacionTarjeta: "",
  efectivo: 0,
  total: 0,
  observaciones: "",
});

const getTiendaRowTotal = (row: TiendaRow) =>
  Number(row.total || 0) || Number(row.transferencia || 0) + Number(row.tarjeta || 0) + Number(row.efectivo || 0);

const hasTiendaRowData = (row: TiendaRow) =>
  Boolean(
    `${row.recibo || ""}`.trim() ||
      `${row.autorizacionTransferencia || ""}`.trim() ||
      `${row.autorizacionTarjeta || ""}`.trim() ||
      `${row.observaciones || ""}`.trim() ||
      Number(row.transferencia || 0) > 0 ||
      Number(row.tarjeta || 0) > 0 ||
      Number(row.efectivo || 0) > 0 ||
      Number(row.total || 0) > 0
  );

export default function ReporteDiario() {
  const today = toDateOnly(new Date());
  const { nombre, primerNombre, primerApellido, usuario, rol, id: userId } = useAuthStore();
  const location = useLocation();
  const [documentos, setDocumentos] = useState<DocumentoGenerado[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [filtroUsuarioId, setFiltroUsuarioId] = useState<number | null | "">("");
  const [documentoId, setDocumentoId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [fecha, setFecha] = useState(today);
  const [liquidacionNo, setLiquidacionNo] = useState("Pendiente");
  const [capitalRows, setCapitalRows] = useState<CapitalRow[]>(() => [createCapitalRow(today)]);
  const [departamentoRows, setDepartamentoRows] = useState<DepartamentoRow[]>(() => [createDepartamentoRow(today)]);
  const [tiendaManualRows, setTiendaManualRows] = useState<TiendaRow[]>(() => [createTiendaRow(today)]);
  const [loading, setLoading] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const isAdmin = rol === "ADMIN";

  const cargarSiguienteLiquidacion = async () => {
    try {
      const resp = await api.get("/correlativos/usuario-operaciones/actual/reporteDiario");
      setLiquidacionNo(resp.data?.correlativo || "Pendiente");
    } catch {
      setLiquidacionNo("Pendiente");
    }
  };

  const cargarDocumentos = useCallback(async () => {
    try {
      const params: any = { tipo: "reporteDiario" };
      if (!isAdmin && !userId) {
        setDocumentos([]);
        return;
      }
      if (typeof filtroUsuarioId === 'number') params.usuarioId = filtroUsuarioId;
      const resp = await api.get("/documentos", { params });
      setDocumentos(resp.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar los reportes diarios generados", "error");
    }
  }, [filtroUsuarioId, isAdmin, userId]);

  const cargar = async () => {
    try {
      setLoading(true);
      const resp = await api.get("/ventas");
      setVentas(resp.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar las ventas para el reporte diario", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      api.get("/usuarios").then(resp => setUsuarios(resp.data || []));
    }
    setFiltroUsuarioId(isAdmin ? "" : userId ?? "");
  }, [isAdmin, userId]);

  useEffect(() => {
    void cargarDocumentos();
  }, [cargarDocumentos]);

  useEffect(() => {
    if ((location.state as any)?.sidebarClickAt) {
      setShowForm(false);
      void cargarDocumentos();
    }
  }, [location.state, cargarDocumentos]);

  const documentosFiltrados = useMemo(
    () =>
      documentos.filter((doc) => {
        const docFecha = doc.data?.fecha || String(doc.creadoEn || "").slice(0, 10);
        if (filtroDesde && docFecha < filtroDesde) return false;
        if (filtroHasta && docFecha > filtroHasta) return false;
        return true;
      }),
    [documentos, filtroDesde, filtroHasta]
  );

  const nuevoReporte = async () => {
    setDocumentoId(null);
    await cargarSiguienteLiquidacion();
    await cargar();
    setFecha(today);
    setCapitalRows([createCapitalRow(today)]);
    setDepartamentoRows([createDepartamentoRow(today)]);
    setTiendaManualRows([createTiendaRow(today)]);
    setShowForm(true);
  };

  const ventasDelDia = useMemo(
    () => ventas.filter((venta) => toDateOnly(venta.fecha) === fecha),
    [ventas, fecha]
  );

  const tiendaAutoRows = useMemo<TiendaRow[]>(() => {
    return ventasDelDia.map((venta) => {
      const metodo = `${venta.metodoPago || ""}`.trim().toLowerCase();
      const referencia = `${venta.pagos?.[0]?.referencia || ""}`.trim();
      return {
        id: venta.id,
        fecha,
        recibo: `V-${venta.id}`,
        transferencia: metodo === "transferencia" ? Number(venta.total || 0) : 0,
        autorizacionTransferencia: metodo === "transferencia" ? referencia : "",
        tarjeta: metodoCuentaComoTarjeta(metodo) ? Number(venta.total || 0) : 0,
        autorizacionTarjeta: metodoCuentaComoTarjeta(metodo) ? referencia : "",
        efectivo: metodo === "efectivo" ? Number(venta.total || 0) : 0,
        total: Number(venta.total || 0),
        observaciones: `${venta.clienteNombre || ""}`.trim(),
      };
    });
  }, [ventasDelDia, fecha]);

  const tiendaRows = useMemo<TiendaRow[]>(
    () => [...tiendaAutoRows, ...tiendaManualRows.filter(hasTiendaRowData)],
    [tiendaAutoRows, tiendaManualRows]
  );

  const subtotalCapital = useMemo(
    () =>
      capitalRows.reduce(
        (sum, row) => sum + Number(row.transferencia || 0) + Number(row.deposito || 0) + Number(row.efectivo || 0),
        0
      ),
    [capitalRows]
  );

  const subtotalDepartamento = useMemo(
    () =>
      departamentoRows.reduce(
        (sum, row) => sum + Number(row.transferencia || 0) + Number(row.deposito || 0),
        0
      ),
    [departamentoRows]
  );

  const subtotalTienda = useMemo(
    () => tiendaRows.reduce((sum, row) => sum + getTiendaRowTotal(row), 0),
    [tiendaRows]
  );

  const totalResumen = useMemo(
    () => Number(subtotalCapital || 0) + Number(subtotalDepartamento || 0) + Number(subtotalTienda || 0),
    [subtotalCapital, subtotalDepartamento, subtotalTienda]
  );

  const updateCapitalRow = (id: number, field: keyof CapitalRow, value: string | number) => {
    setCapitalRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const updateDepartamentoRow = (id: number, field: keyof DepartamentoRow, value: string | number) => {
    setDepartamentoRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const updateTiendaManualRow = (id: number, field: keyof TiendaRow, value: string | number) => {
    setTiendaManualRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const limpiarCapturas = () => {
    setCapitalRows([createCapitalRow(fecha)]);
    setDepartamentoRows([createDepartamentoRow(fecha)]);
    setTiendaManualRows([createTiendaRow(fecha)]);
  };

  const getGeneradoPor = () =>
    [primerNombre?.trim(), primerApellido?.trim()].filter(Boolean).join(" ") ||
    nombre?.trim() ||
    usuario?.trim() ||
    "Usuario";

  const getPayload = () => ({
    fecha,
    generadoPor: getGeneradoPor(),
    capitalRows,
    departamentoRows,
    tiendaManualRows,
    ventasSnapshot: ventasDelDia,
  });

  const guardarDocumento = async () => {
    const payload = {
      titulo: `Reporte diario ${fecha}`,
      data: getPayload(),
    };
    if (documentoId) {
      const resp = await api.patch(`/documentos/${documentoId}`, payload);
      return resp.data as DocumentoGenerado;
    }
    const resp = await api.post("/documentos", { tipo: "reporteDiario", ...payload });
    const doc = resp.data as DocumentoGenerado;
    setDocumentoId(doc.id);
    setLiquidacionNo(doc.correlativo);
    return doc;
  };

  const descargarDocumentoPdf = async (doc: DocumentoGenerado) => {
    const resp = await api.get(`/documentos/${doc.id}/pdf`, {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([resp.data], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Reporte diario ${doc.data?.fecha || fecha}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const reimprimirDocumento = async (doc: DocumentoGenerado) => {
    if (generandoPdf) return;
    try {
      setGenerandoPdf(true);
      await descargarDocumentoPdf(doc);
    } catch {
      Swal.fire("Error", "No se pudo descargar el PDF del reporte diario", "error");
    } finally {
      setGenerandoPdf(false);
    }
  };

  const imprimir = async () => {
    if (generandoPdf) return;
    setGenerandoPdf(true);
    let docGenerado: DocumentoGenerado;
    try {
      docGenerado = await guardarDocumento();
      setLiquidacionNo(docGenerado.correlativo || liquidacionNo);
      await descargarDocumentoPdf(docGenerado);
    } catch (error: any) {
      const msg = error?.response?.data?.message || "No se pudo generar o descargar el reporte diario";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
      return;
    } finally {
      setGenerandoPdf(false);
    }

    await Swal.fire("Listo", "El PDF del cierre diario se descargo automaticamente.", "success");
    setShowForm(false);
    void cargarDocumentos();
  };

  if (!showForm) {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h4">Reporte diario</Typography>
          <Button startIcon={<AddOutlined />} variant="contained" onClick={nuevoReporte}>
            Nuevo reporte
          </Button>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
          <TextField label="Desde" type="date" size="small" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Hasta" type="date" size="small" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} InputLabelProps={{ shrink: true }} />
          {isAdmin && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Usuario</InputLabel>
              <Select
                label="Usuario"
                value={filtroUsuarioId}
                onChange={(e) => setFiltroUsuarioId(e.target.value as number | null | "")}
              >
                <MenuItem value="">Todos</MenuItem>
                {usuarios.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.nombre || u.usuario}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Correlativo</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Usuario</TableCell>
                <TableCell align="right">Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documentosFiltrados.map((doc) => {
                const total =
                  (doc.data?.capitalRows || []).reduce(
                    (sum: number, row: any) => sum + Number(row.transferencia || 0) + Number(row.deposito || 0) + Number(row.efectivo || 0),
                    0
                  ) +
                  (doc.data?.departamentoRows || []).reduce(
                    (sum: number, row: any) => sum + Number(row.transferencia || 0) + Number(row.deposito || 0),
                    0
                  ) +
                  (doc.data?.ventasSnapshot || []).reduce((sum: number, venta: any) => sum + Number(venta.total || 0), 0) +
                  (doc.data?.tiendaManualRows || []).reduce((sum: number, row: any) => sum + getTiendaRowTotal(row), 0);
                return (
                  <TableRow key={doc.id}>
                    <TableCell>{doc.correlativo}</TableCell>
                    <TableCell>{doc.data?.fecha || new Date(doc.creadoEn).toLocaleDateString()}</TableCell>
                    <TableCell>{money(total)}</TableCell>
                    <TableCell>{doc.usuario?.nombre || doc.usuario?.usuario || "N/D"}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="contained"
                          color="secondary"
                          disabled={generandoPdf}
                          startIcon={generandoPdf ? <CircularProgress size={14} color="inherit" /> : undefined}
                          onClick={() => reimprimirDocumento(doc)}
                        >
                          {generandoPdf ? "Generando..." : "Reimprimir"}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!documentosFiltrados.length && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No hay reportes diarios generados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">Reporte diario</Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<ArrowBackOutlined />} variant="outlined" size="small" disabled={generandoPdf} onClick={() => { setShowForm(false); void cargarDocumentos(); }}>
            Volver
          </Button>
          <Button startIcon={<RefreshOutlined />} variant="outlined" size="small" onClick={cargar} disabled={loading || generandoPdf}>
            Recargar ventas
          </Button>
          <Button
            startIcon={<CleaningServicesOutlined />}
            variant="outlined"
            size="small"
            disabled={generandoPdf}
            onClick={limpiarCapturas}
          >
            Limpiar capturas
          </Button>
          <Button
            startIcon={generandoPdf ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfOutlined />}
            variant="contained"
            color="secondary"
            size="small"
            onClick={imprimir}
            disabled={generandoPdf}
          >
            {generandoPdf ? "Generando PDF..." : "Imprimir / PDF"}
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField
            label="Fecha"
            type="date"
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
            value={fecha}
            disabled={generandoPdf}
            onChange={(e) => setFecha(e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField
            label="Liquidación No."
            fullWidth
            size="small"
            value={liquidacionNo}
            disabled
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ height: "100%", flexWrap: "wrap" }}>
            <Chip label={`${tiendaRows.length} ventas del día`} />
            <Chip label={`Capital ${money(subtotalCapital)}`} color="primary" variant="outlined" />
            <Chip label={`Departamento ${money(subtotalDepartamento)}`} color="warning" variant="outlined" />
            <Chip label={`Tienda ${money(subtotalTienda)}`} color="success" />
          </Stack>
        </Grid>
      </Grid>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Este reporte no se guarda. Puedes completar los bloques manuales, revisar las ventas del día y luego imprimirlo o guardarlo como PDF.
      </Typography>

      <Divider sx={{ mb: 2 }} />

      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6">Capital / Mensajero</Typography>
            <Button
              size="small"
              startIcon={<AddCircleOutlineOutlined />}
              onClick={() => setCapitalRows((prev) => [...prev, createCapitalRow(fecha)])}
            >
              Agregar fila
            </Button>
          </Stack>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Envío</TableCell>
                  <TableCell>Transferencia</TableCell>
                  <TableCell>Autorización</TableCell>
                  <TableCell>Depósito</TableCell>
                  <TableCell>Boleta</TableCell>
                  <TableCell>Banco</TableCell>
                  <TableCell>Efectivo</TableCell>
                  <TableCell>Total</TableCell>
                  <TableCell>Observaciones</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {capitalRows.map((row) => {
                  const total = Number(row.transferencia || 0) + Number(row.deposito || 0) + Number(row.efectivo || 0);
                  return (
                    <TableRow key={row.id}>
                      <TableCell sx={{ minWidth: 140 }}>
                        <TextField
                          type="date"
                          size="small"
                          fullWidth
                          value={row.fecha}
                          onChange={(e) => updateCapitalRow(row.id, "fecha", e.target.value)}
                          InputLabelProps={{ shrink: true }}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField size="small" fullWidth value={row.envio} onChange={(e) => updateCapitalRow(row.id, "envio", e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField
                          type="number"
                          size="small"
                          fullWidth
                          value={row.transferencia}
                          onChange={(e) => updateCapitalRow(row.id, "transferencia", Number(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 140 }}>
                        <TextField size="small" fullWidth value={row.autorizacion} onChange={(e) => updateCapitalRow(row.id, "autorizacion", e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField
                          type="number"
                          size="small"
                          fullWidth
                          value={row.deposito}
                          onChange={(e) => updateCapitalRow(row.id, "deposito", Number(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField size="small" fullWidth value={row.boleta} onChange={(e) => updateCapitalRow(row.id, "boleta", e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField size="small" fullWidth value={row.banco} onChange={(e) => updateCapitalRow(row.id, "banco", e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField
                          type="number"
                          size="small"
                          fullWidth
                          value={row.efectivo}
                          onChange={(e) => updateCapitalRow(row.id, "efectivo", Number(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>{money(total)}</TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <TextField
                          size="small"
                          fullWidth
                          value={row.observaciones}
                          onChange={(e) => updateCapitalRow(row.id, "observaciones", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setCapitalRows((prev) => prev.filter((item) => item.id !== row.id))}
                          disabled={capitalRows.length === 1}
                        >
                          <DeleteOutlineOutlined fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6">Departamentos / Cargo expreso</Typography>
            <Button
              size="small"
              startIcon={<AddCircleOutlineOutlined />}
              onClick={() => setDepartamentoRows((prev) => [...prev, createDepartamentoRow(fecha)])}
            >
              Agregar fila
            </Button>
          </Stack>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Envío</TableCell>
                  <TableCell>Transferencia</TableCell>
                  <TableCell>Autorización</TableCell>
                  <TableCell>Depósito</TableCell>
                  <TableCell>Boleta</TableCell>
                  <TableCell>Banco</TableCell>
                  <TableCell>Total</TableCell>
                  <TableCell>Observaciones</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {departamentoRows.map((row) => {
                  const total = Number(row.transferencia || 0) + Number(row.deposito || 0);
                  return (
                    <TableRow key={row.id}>
                      <TableCell sx={{ minWidth: 140 }}>
                        <TextField
                          type="date"
                          size="small"
                          fullWidth
                          value={row.fecha}
                          onChange={(e) => updateDepartamentoRow(row.id, "fecha", e.target.value)}
                          InputLabelProps={{ shrink: true }}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField size="small" fullWidth value={row.envio} onChange={(e) => updateDepartamentoRow(row.id, "envio", e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField
                          type="number"
                          size="small"
                          fullWidth
                          value={row.transferencia}
                          onChange={(e) => updateDepartamentoRow(row.id, "transferencia", Number(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 140 }}>
                        <TextField size="small" fullWidth value={row.autorizacion} onChange={(e) => updateDepartamentoRow(row.id, "autorizacion", e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField
                          type="number"
                          size="small"
                          fullWidth
                          value={row.deposito}
                          onChange={(e) => updateDepartamentoRow(row.id, "deposito", Number(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField size="small" fullWidth value={row.boleta} onChange={(e) => updateDepartamentoRow(row.id, "boleta", e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField size="small" fullWidth value={row.banco} onChange={(e) => updateDepartamentoRow(row.id, "banco", e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>{money(total)}</TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <TextField
                          size="small"
                          fullWidth
                          value={row.observaciones}
                          onChange={(e) => updateDepartamentoRow(row.id, "observaciones", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDepartamentoRows((prev) => prev.filter((item) => item.id !== row.id))}
                          disabled={departamentoRows.length === 1}
                        >
                          <DeleteOutlineOutlined fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6">Tienda</Typography>
            <Button
              size="small"
              startIcon={<AddCircleOutlineOutlined />}
              onClick={() => setTiendaManualRows((prev) => [...prev, createTiendaRow(fecha)])}
            >
              Agregar fila
            </Button>
          </Stack>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Recibo</TableCell>
                  <TableCell>Transferencia</TableCell>
                  <TableCell>Autorización</TableCell>
                  <TableCell>Tarjeta</TableCell>
                  <TableCell>Autorización</TableCell>
                  <TableCell>Efectivo</TableCell>
                  <TableCell>Total</TableCell>
                  <TableCell>Observaciones</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tiendaAutoRows.length ? (
                  tiendaAutoRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatDisplayDate(row.fecha)}</TableCell>
                      <TableCell>{row.recibo}</TableCell>
                      <TableCell>{money(row.transferencia)}</TableCell>
                      <TableCell>{row.autorizacionTransferencia || "-"}</TableCell>
                      <TableCell>{money(row.tarjeta)}</TableCell>
                      <TableCell>{row.autorizacionTarjeta || "-"}</TableCell>
                      <TableCell>{money(row.efectivo)}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{money(getTiendaRowTotal(row))}</TableCell>
                      <TableCell>{row.observaciones || "-"}</TableCell>
                      <TableCell>-</TableCell>
                    </TableRow>
                  ))
                ) : null}

                {tiendaManualRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell sx={{ minWidth: 140 }}>
                      <TextField
                        type="date"
                        size="small"
                        fullWidth
                        value={row.fecha}
                        onChange={(e) => updateTiendaManualRow(row.id, "fecha", e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 120 }}>
                      <TextField size="small" fullWidth value={row.recibo} onChange={(e) => updateTiendaManualRow(row.id, "recibo", e.target.value)} />
                    </TableCell>
                    <TableCell sx={{ minWidth: 120 }}>
                      <TextField
                        type="number"
                        size="small"
                        fullWidth
                        value={row.transferencia}
                        onChange={(e) => updateTiendaManualRow(row.id, "transferencia", Number(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 150 }}>
                      <TextField
                        size="small"
                        fullWidth
                        value={row.autorizacionTransferencia}
                        onChange={(e) => updateTiendaManualRow(row.id, "autorizacionTransferencia", e.target.value)}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 120 }}>
                      <TextField
                        type="number"
                        size="small"
                        fullWidth
                        value={row.tarjeta}
                        onChange={(e) => updateTiendaManualRow(row.id, "tarjeta", Number(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 150 }}>
                      <TextField
                        size="small"
                        fullWidth
                        value={row.autorizacionTarjeta}
                        onChange={(e) => updateTiendaManualRow(row.id, "autorizacionTarjeta", e.target.value)}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 120 }}>
                      <TextField
                        type="number"
                        size="small"
                        fullWidth
                        value={row.efectivo}
                        onChange={(e) => updateTiendaManualRow(row.id, "efectivo", Number(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>{money(getTiendaRowTotal(row))}</TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <TextField
                        size="small"
                        fullWidth
                        value={row.observaciones}
                        onChange={(e) => updateTiendaManualRow(row.id, "observaciones", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setTiendaManualRows((prev) => prev.filter((item) => item.id !== row.id))}
                        disabled={tiendaManualRows.length === 1}
                      >
                        <DeleteOutlineOutlined fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}

                {!tiendaAutoRows.length && !tiendaManualRows.length ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      No hay ventas registradas para esta fecha.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, mt: 6, width: { xs: "100%", md: "50%" } }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Resumen
          </Typography>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between"><Typography>Capital</Typography><Typography>{money(subtotalCapital)}</Typography></Stack>
            <Stack direction="row" justifyContent="space-between"><Typography>Departamento</Typography><Typography>{money(subtotalDepartamento)}</Typography></Stack>
            <Stack direction="row" justifyContent="space-between"><Typography>Tienda</Typography><Typography>{money(subtotalTienda)}</Typography></Stack>
            <Divider />
            <Stack direction="row" justifyContent="space-between">
              <Typography fontWeight={700}>TOTAL</Typography>
              <Typography fontWeight={700}>{money(totalResumen)}</Typography>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Paper>
  );
}
