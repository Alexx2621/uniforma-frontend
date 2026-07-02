import { useCallback, useEffect, useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlined from "@mui/icons-material/EditOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  IconButton,
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
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Swal from "sweetalert2";
import { api } from "../../api/axios";
import { useAuthStore } from "../../auth/useAuthStore";
import { formatCurrency } from "../../utils/currency";

type PeriodoComision = "primera" | "segunda" | "mes";
type EstadoComision = "abierto" | "finalizado";

interface ComisionLinea {
  id: string;
  fecha: string;
  cliente: string;
  venta: number;
  anticipo1: number;
  documento1: string;
  anticipo2: number;
  fecha2: string;
  documento2: string;
  saldo: number;
  observaciones: string;
}

interface DocumentoComision {
  id: number;
  correlativo: string;
  titulo?: string | null;
  data?: any;
  creadoEn: string;
  actualizadoEn?: string;
  usuario?: { nombre?: string | null; usuario?: string | null };
}

const TIPO_REPORTE = "reporteComisiones";

const meses = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const emptyLine = (): ComisionLinea => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  fecha: "",
  cliente: "",
  venta: 0,
  anticipo1: 0,
  documento1: "",
  anticipo2: 0,
  fecha2: "",
  documento2: "",
  saldo: 0,
  observaciones: "",
});

const toInputDate = (value?: string | Date | null) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const toInputMonth = (value?: string | Date | null) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return toInputDate().slice(0, 7);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 7);
};

const parseNumber = (value: unknown) => Number(value || 0) || 0;

const dateDisplay = (value?: string | null) => {
  if (!value) return "-";
  const [year, month, day] = `${value}`.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : `${value}`;
};

const escapeHtml = (value: unknown) =>
  `${value ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const normalizarLineas = (lineas?: any[]): ComisionLinea[] => {
  if (!Array.isArray(lineas) || !lineas.length) return [emptyLine()];
  return lineas.map((linea) => ({
    id: `${linea.id || Date.now()}-${Math.random().toString(16).slice(2)}`,
    fecha: `${linea.fecha || ""}`.slice(0, 10),
    cliente: `${linea.cliente || ""}`,
    venta: parseNumber(linea.venta),
    anticipo1: parseNumber(linea.anticipo1),
    documento1: `${linea.documento1 || ""}`,
    anticipo2: parseNumber(linea.anticipo2),
    fecha2: `${linea.fecha2 || ""}`.slice(0, 10),
    documento2: `${linea.documento2 || ""}`,
    saldo: parseNumber(linea.saldo),
    observaciones: `${linea.observaciones || ""}`,
  }));
};

const lineHasData = (linea: ComisionLinea) =>
  Boolean(
    linea.fecha ||
      linea.cliente.trim() ||
      linea.venta ||
      linea.anticipo1 ||
      linea.documento1.trim() ||
      linea.anticipo2 ||
      linea.fecha2 ||
      linea.documento2.trim() ||
      linea.saldo ||
      linea.observaciones.trim(),
  );

const periodoLabel = (periodo: PeriodoComision, mesValue: string) => {
  const [, month] = mesValue.split("-").map(Number);
  const nombreMes = meses[(month || 1) - 1] || "";
  if (periodo === "primera") return `Del 01 al 15 de ${nombreMes}.`;
  if (periodo === "segunda") return `Del 16 al 30 de ${nombreMes}.`;
  return `Del 01 al 30 de ${nombreMes}.`;
};

const periodoLista = (periodo: PeriodoComision, mesValue: string) => {
  const [year, month] = mesValue.split("-").map(Number);
  const nombreMes = meses[(month || 1) - 1] || "";
  const anio = year || new Date().getFullYear();
  if (periodo === "primera") return `1ra quincena ${nombreMes} ${anio}`;
  if (periodo === "segunda") return `2da quincena ${nombreMes} ${anio}`;
  return `${nombreMes} ${anio}`;
};

const calcularTotales = (lineas: ComisionLinea[], comisionPct: number) => {
  const lineasConDatos = lineas.filter(lineHasData);
  const totalVenta = lineasConDatos.reduce((sum, linea) => sum + parseNumber(linea.venta), 0);
  const totalAnticipo1 = lineasConDatos.reduce((sum, linea) => sum + parseNumber(linea.anticipo1), 0);
  const totalAnticipo2 = lineasConDatos.reduce((sum, linea) => sum + parseNumber(linea.anticipo2), 0);
  const totalSaldo = lineasConDatos.reduce((sum, linea) => sum + parseNumber(linea.saldo), 0);
  const totalSinIva = totalVenta / 1.12;
  const comision = totalSinIva * (parseNumber(comisionPct) / 100);
  return { lineasConDatos, totalVenta, totalAnticipo1, totalAnticipo2, totalSaldo, totalSinIva, comision };
};

export default function Comisiones() {
  const { nombre, usuario } = useAuthStore();
  const vendedorDefault = (nombre || usuario || "").toUpperCase();
  const hoy = useMemo(() => toInputDate(), []);
  const mesActual = useMemo(() => toInputMonth(), []);
  const desdeInicial = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return toInputDate(date);
  }, []);

  const [vista, setVista] = useState<"listado" | "editor">("listado");
  const [documentos, setDocumentos] = useState<DocumentoComision[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroDesde, setFiltroDesde] = useState(desdeInicial);
  const [filtroHasta, setFiltroHasta] = useState(hoy);
  const [filtroEstado, setFiltroEstado] = useState<"todos" | EstadoComision>("todos");

  const [documentoId, setDocumentoId] = useState<number | null>(null);
  const [correlativo, setCorrelativo] = useState("");
  const [estado, setEstado] = useState<EstadoComision>("abierto");
  const [vendedor, setVendedor] = useState(vendedorDefault);
  const [periodo, setPeriodo] = useState<PeriodoComision>("primera");
  const [mes, setMes] = useState(mesActual);
  const [comisionPct, setComisionPct] = useState(7.5);
  const [lineas, setLineas] = useState<ComisionLinea[]>([emptyLine()]);

  const bloqueado = estado === "finalizado";
  const totales = useMemo(() => calcularTotales(lineas, comisionPct), [lineas, comisionPct]);

  const cargarDocumentos = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/documentos", {
        params: { tipo: TIPO_REPORTE, _ts: Date.now() },
      });
      setDocumentos(Array.isArray(data) ? data : []);
    } catch (error: any) {
      await Swal.fire("Error", error?.response?.data?.message || "No se pudieron cargar las comisiones.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargarDocumentos();
  }, [cargarDocumentos]);

  const rowsListado = useMemo(() => {
    return documentos
      .filter((documento) => {
        const fecha = `${documento.creadoEn || ""}`.slice(0, 10);
        const estadoDoc = (documento.data?.estado || "abierto") as EstadoComision;
        if (filtroDesde && fecha < filtroDesde) return false;
        if (filtroHasta && fecha > filtroHasta) return false;
        if (filtroEstado !== "todos" && estadoDoc !== filtroEstado) return false;
        return true;
      })
      .map((documento) => {
        const data = documento.data || {};
        const lineasDoc = normalizarLineas(data.lineas || data.rows || []);
        const totals = calcularTotales(lineasDoc, parseNumber(data.comisionPct || 7.5));
        const estadoDoc = (data.estado || "abierto") as EstadoComision;
        const periodoDoc = (data.periodo || "primera") as PeriodoComision;
        const mesDoc = data.mes || mesActual;
        return {
          id: documento.id,
          correlativo: documento.correlativo,
          vendedor: data.vendedor || documento.usuario?.nombre || documento.usuario?.usuario || "N/D",
          periodo: data.periodoLista || periodoLista(periodoDoc, mesDoc),
          totalVenta: totals.totalVenta,
          comision: totals.comision,
          estado: estadoDoc,
          creadoEn: documento.creadoEn,
          actualizadoEn: documento.actualizadoEn || documento.creadoEn,
          raw: documento,
        };
      });
  }, [documentos, filtroDesde, filtroHasta, filtroEstado, mesActual]);

  const limpiarEditor = () => {
    setDocumentoId(null);
    setCorrelativo("");
    setEstado("abierto");
    setVendedor(vendedorDefault);
    setPeriodo("primera");
    setMes(mesActual);
    setComisionPct(7.5);
    setLineas([emptyLine()]);
  };

  const nuevoReporte = () => {
    limpiarEditor();
    setVista("editor");
  };

  const abrirDocumento = (documento: DocumentoComision) => {
    const data = documento.data || {};
    setDocumentoId(documento.id);
    setCorrelativo(documento.correlativo || "");
    setEstado((data.estado || "abierto") as EstadoComision);
    setVendedor(data.vendedor || documento.usuario?.nombre || documento.usuario?.usuario || vendedorDefault);
    setPeriodo((data.periodo || "primera") as PeriodoComision);
    setMes(data.mes || mesActual);
    setComisionPct(parseNumber(data.comisionPct || 7.5));
    setLineas(normalizarLineas(data.lineas || data.rows || []));
    setVista("editor");
  };

  const actualizarLinea = (id: string, field: keyof ComisionLinea, value: string | number) => {
    setLineas((prev) =>
      prev.map((linea) => {
        if (linea.id !== id) return linea;
        const next = { ...linea, [field]: value };
        if (["venta", "anticipo1", "anticipo2"].includes(field)) {
          next.saldo = Math.max(0, parseNumber(next.venta) - parseNumber(next.anticipo1) - parseNumber(next.anticipo2));
        }
        return next;
      }),
    );
  };

  const agregarLinea = () => setLineas((prev) => [...prev, emptyLine()]);
  const eliminarLinea = (id: string) => setLineas((prev) => (prev.length > 1 ? prev.filter((linea) => linea.id !== id) : prev));

  const buildPayload = (nextEstado = estado, finalizadoEn?: string) => {
    const lineasLimpias = lineas.map((linea) => ({
      fecha: linea.fecha,
      cliente: linea.cliente,
      venta: parseNumber(linea.venta),
      anticipo1: parseNumber(linea.anticipo1),
      documento1: linea.documento1,
      anticipo2: parseNumber(linea.anticipo2),
      fecha2: linea.fecha2,
      documento2: linea.documento2,
      saldo: parseNumber(linea.saldo),
      observaciones: linea.observaciones,
    }));
    const periodoTexto = periodoLista(periodo, mes);
    return {
      titulo: `Comisiones ${vendedor || "VENDEDOR"} ${periodoTexto}`,
      data: {
        vendedor,
        periodo,
        mes,
        periodoLista: periodoTexto,
        periodoPdf: periodoLabel(periodo, mes),
        comisionPct: parseNumber(comisionPct),
        estado: nextEstado,
        finalizadoEn: finalizadoEn || null,
        lineas: lineasLimpias,
      },
    };
  };

  const guardarDocumento = async (nextEstado = estado, finalizadoEn?: string) => {
    const payload = buildPayload(nextEstado, finalizadoEn);
    try {
      const { data } = documentoId
        ? await api.patch(`/documentos/${documentoId}`, payload)
        : await api.post("/documentos", { tipo: TIPO_REPORTE, ...payload });
      setDocumentoId(data.id);
      setCorrelativo(data.correlativo || correlativo);
      setEstado((data.data?.estado || nextEstado) as EstadoComision);
      await cargarDocumentos();
      return data as DocumentoComision;
    } catch (error: any) {
      await Swal.fire("Error", error?.response?.data?.message || "No se pudo guardar el reporte.", "error");
      return null;
    }
  };

  const guardar = async () => {
    const saved = await guardarDocumento("abierto");
    if (saved) await Swal.fire("Guardado", "El reporte quedo abierto para seguir editandolo.", "success");
  };

  const finalizar = async () => {
    const confirm = await Swal.fire({
      title: "Finalizar cierre",
      text: "Al finalizarlo ya no se podra editar desde esta pantalla.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Finalizar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
    const saved = await guardarDocumento("finalizado", new Date().toISOString());
    if (saved) {
      await Swal.fire("Finalizado", "El cierre de comisiones quedo bloqueado.", "success");
      setVista("listado");
    }
  };

  const abrirPdf = (data: any) => {
    const lineasPdf = normalizarLineas(data.lineas || []).filter(lineHasData);
    const totals = calcularTotales(lineasPdf, parseNumber(data.comisionPct || 7.5));
    const vendedorPdf = `${data.vendedor || vendedor || "VENDEDOR"}`.toUpperCase();
    const periodoPdf = data.periodoPdf || periodoLabel((data.periodo || periodo) as PeriodoComision, data.mes || mes);
    const rowsHtml = lineasPdf
      .map(
        (linea) => `
        <tr>
          <td>${escapeHtml(dateDisplay(linea.fecha))}</td>
          <td>${escapeHtml(linea.cliente)}</td>
          <td class="money">Q ${parseNumber(linea.venta).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
          <td class="money">Q ${parseNumber(linea.anticipo1).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
          <td>${escapeHtml(linea.documento1 || "-")}</td>
          <td class="money">Q ${parseNumber(linea.anticipo2).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
          <td>${escapeHtml(dateDisplay(linea.fecha2))}</td>
          <td>${escapeHtml(linea.documento2 || "-")}</td>
          <td class="money">Q ${parseNumber(linea.saldo).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
          <td>${escapeHtml(linea.observaciones)}</td>
        </tr>`,
      )
      .join("");

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Reporte de comisiones</title>
        <style>
          @page { size: letter landscape; margin: 18px; }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body { margin: 0; padding: 0; background: #fff; }
          body { font-family: Arial, sans-serif; color: #000; font-size: 11px; }
          .sheet { width: 100%; }
          .top {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin: 0;
          }
          .top td {
            background-color: #092b68 !important;
            color: #fff !important;
            border: 2px solid #000;
            padding: 8px 10px;
            font-weight: 700;
          }
          .top .name { width: 22%; font-size: 14px; text-align: center; }
          .top .quote { width: 56%; font-style: italic; text-align: center; }
          .top .period { width: 22%; text-align: right; font-style: italic; }
          .data { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 0; }
          .data th, .data td {
            border: 1px solid #000;
            padding: 4px 4px;
            text-align: center;
            min-height: 22px;
            line-height: 1.15;
            white-space: normal;
            overflow-wrap: normal;
            word-break: keep-all;
            vertical-align: middle;
          }
          .data th { font-weight: 700; white-space: nowrap; overflow-wrap: normal; }
          .data th.blue {
            background-color: #092b68 !important;
            color: #fff !important;
            border: 1px solid #092b68;
            padding: 8px 10px;
            font-size: 14px;
          }
          .data th.blue.quote { font-style: italic; font-size: 11px; }
          .data th.blue.period { text-align: right; font-style: italic; font-size: 11px; }
          .data th.red { background-color: #ff0000 !important; color: #fff !important; border-color: #ff0000; }
          .data th.white { background-color: #fff !important; color: #000 !important; }
          .data .gap td {
            height: 7px;
            padding: 0;
            background-color: #fff !important;
            border: 0 !important;
          }
          .data th:nth-child(1), .data td:nth-child(1) { width: 5.3%; }
          .data th:nth-child(2), .data td:nth-child(2) { width: 17.7%; }
          .data th:nth-child(3), .data td:nth-child(3) { width: 7%; }
          .data th:nth-child(4), .data td:nth-child(4) { width: 8%; }
          .data th:nth-child(5), .data td:nth-child(5) { width: 18%; }
          .data th:nth-child(6), .data td:nth-child(6) { width: 8%; }
          .data th:nth-child(7), .data td:nth-child(7) { width: 5.3%; }
          .data th:nth-child(8), .data td:nth-child(8) { width: 18%; }
          .data th:nth-child(9), .data td:nth-child(9) { width: 5.7%; }
          .data th:nth-child(10), .data td:nth-child(10) { width: 7%; }
          .money { text-align: right !important; white-space: nowrap; overflow-wrap: normal; font-size: 10.5px; }
          .totals { margin-top: 26px; margin-left: 240px; border-collapse: collapse; font-weight: 700; }
          .totals td { padding: 4px 8px; }
          .totals .label { text-align: right; }
          .totals .box { background-color: #e6e6e6 !important; }
          .notes { margin-top: 62px; font-size: 10.5px; line-height: 1.55; }
          .notes h3 { margin: 0 0 6px; font-size: 13px; }
          @media print {
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body { width: 100%; }
            .top { margin-bottom: 0 !important; }
            .top td { background-color: #092b68 !important; color: #fff !important; }
            .data th.blue { background-color: #092b68 !important; color: #fff !important; }
            .data th.red { background-color: #ff0000 !important; color: #fff !important; }
            .totals .box { background-color: #e6e6e6 !important; }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <table class="data">
            <thead>
              <tr>
                <th class="blue" colspan="2">${escapeHtml(vendedorPdf)}</th>
                <th class="blue quote" colspan="6">"La confianza es buena, pero el control es mejor"</th>
                <th class="blue period" colspan="2">${escapeHtml(periodoPdf)}</th>
              </tr>
              <tr>
                <th class="white">FECHA</th>
                <th class="white">CLIENTE</th>
              <th class="red">VENTA</th>
              <th class="red">ANTICIPO 1</th>
              <th class="red">DOCUMENTO</th>
              <th class="red">ANTICIPO 2</th>
              <th class="red">FECHA</th>
              <th class="red">DOCUMENTO</th>
              <th class="red">SALDO</th>
              <th class="white">OBSERVACIONES</th>
            </tr>
          </thead>
          <tbody><tr class="gap"><td colspan="10"></td></tr>${rowsHtml}</tbody>
          </table>
          <table class="totals">
          <tr>
            <td class="money">Q ${totals.totalVenta.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
            <td class="money">Q ${totals.totalAnticipo1.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
            <td style="width: 160px;"></td>
            <td class="money">Q ${totals.totalAnticipo2.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
            <td style="width: 160px;"></td>
            <td class="money">Q ${totals.totalSaldo.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td class="label box">S/IVA</td>
            <td class="money box">Q ${totals.totalSinIva.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td class="label">COMISION ${parseNumber(data.comisionPct || 7.5)}%</td>
            <td class="money">Q ${totals.comision.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
          </tr>
          </table>
          <div class="notes">
            <h3>IMPORTANTE</h3>
            <div>1. Cada venta/facturacion debe tener todo el soporte impreso (cotizacion, retenciones de IVA, ISR y exenciones de IVA, vouchers si fue con TC, cheques etc.).</div>
            <div>2. Todo ingreso por cualquier via debe liquidarse el mismo dia o a mas tardar el dia habil siguiente por la manana (NO fabricar nada hasta confirmar 100% la acreditacion).</div>
            <div>3. El mensajero debe pasar depositando el mismo dia si es efectivo o dejar el efectivo con el encargado con una nota a quien o a que corresponde ese efectivo.</div>
            <div>4. El pago de las cotizaciones debe ser 50% de anticipo y 50% al momento de la entrega. La facturacion la realizara una persona especifica. El cobro de las facturas corresponde al vendedor (en primera linea).</div>
          </div>
        </div>
      </body>
      </html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  };

  const generarPdfActual = () => abrirPdf(buildPayload().data);
  const generarPdfDocumento = (documento: DocumentoComision) => abrirPdf(documento.data || {});

  const columns: GridColDef[] = [
    { field: "correlativo", headerName: "Correlativo", minWidth: 140 },
    { field: "periodo", headerName: "Periodo", minWidth: 190, flex: 1 },
    { field: "vendedor", headerName: "Vendedor", minWidth: 190, flex: 1 },
    {
      field: "totalVenta",
      headerName: "Venta",
      minWidth: 130,
      renderCell: (params) => formatCurrency(params.row.totalVenta),
    },
    {
      field: "comision",
      headerName: "Comision",
      minWidth: 130,
      renderCell: (params) => formatCurrency(params.row.comision),
    },
    {
      field: "estado",
      headerName: "Estado",
      minWidth: 120,
      renderCell: (params) => (
        <Chip
          size="small"
          label={params.row.estado}
          color={params.row.estado === "finalizado" ? "success" : "warning"}
        />
      ),
    },
    { field: "creadoEn", headerName: "Creado", minWidth: 130, renderCell: (params) => dateDisplay(params.row.creadoEn) },
    {
      field: "acciones",
      headerName: "Acciones",
      minWidth: 220,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={params.row.estado === "finalizado" ? <VisibilityOutlined /> : <EditOutlined />}
            onClick={() => abrirDocumento(params.row.raw)}
          >
            {params.row.estado === "finalizado" ? "Ver" : "Editar"}
          </Button>
          <Button size="small" color="error" variant="outlined" startIcon={<PictureAsPdfOutlined />} onClick={() => generarPdfDocumento(params.row.raw)}>
            PDF
          </Button>
        </Stack>
      ),
    },
  ];

  if (vista === "listado") {
    return (
      <Box sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              Comisiones
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Reportes internos abiertos o finalizados para controlar anticipos, saldos y comisiones.
            </Typography>
          </Box>
          <Button startIcon={<AddIcon />} variant="contained" onClick={nuevoReporte}>
            Nuevo reporte
          </Button>
        </Stack>

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField label="Desde" type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="Hasta" type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            <FormControl fullWidth>
              <InputLabel>Estado</InputLabel>
              <Select label="Estado" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as any)}>
                <MenuItem value="todos">Todos</MenuItem>
                <MenuItem value="abierto">Abiertos</MenuItem>
                <MenuItem value="finalizado">Finalizados</MenuItem>
              </Select>
            </FormControl>
            <Button variant="outlined" onClick={cargarDocumentos}>
              Recargar
            </Button>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ height: 540 }}>
          <DataGrid
            rows={rowsListado}
            columns={columns}
            loading={loading}
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            localeText={{ noRowsLabel: "No hay reportes de comisiones en el rango seleccionado." }}
          />
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Button startIcon={<ArrowBackOutlined />} variant="outlined" onClick={() => setVista("listado")}>
            Volver
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Reporte de comisiones
          </Typography>
          {correlativo && <Chip label={correlativo} variant="outlined" />}
          <Chip label={estado} color={estado === "finalizado" ? "success" : "warning"} />
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end">
          <Button startIcon={<PictureAsPdfOutlined />} color="error" variant="outlined" onClick={generarPdfActual}>
            PDF
          </Button>
          <Button startIcon={<SaveOutlined />} variant="outlined" disabled={bloqueado} onClick={guardar}>
            Guardar avance
          </Button>
          <Button startIcon={<LockOutlined />} variant="contained" disabled={bloqueado} onClick={finalizar}>
            Finalizar cierre
          </Button>
        </Stack>
      </Stack>

      {bloqueado && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Este cierre ya fue finalizado. Puedes revisarlo e imprimirlo, pero no modificar sus datos.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField label="Vendedor" value={vendedor} onChange={(e) => setVendedor(e.target.value.toUpperCase())} disabled={bloqueado} fullWidth />
          <FormControl fullWidth>
            <InputLabel>Periodo</InputLabel>
            <Select label="Periodo" value={periodo} disabled={bloqueado} onChange={(e) => setPeriodo(e.target.value as PeriodoComision)}>
              <MenuItem value="primera">Primera quincena</MenuItem>
              <MenuItem value="segunda">Segunda quincena</MenuItem>
              <MenuItem value="mes">Total del mes</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} disabled={bloqueado} InputLabelProps={{ shrink: true }} fullWidth />
          <TextField
            label="% comision"
            type="number"
            value={comisionPct}
            onChange={(e) => setComisionPct(parseNumber(e.target.value))}
            disabled={bloqueado}
            fullWidth
          />
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 1320 }}>
          <TableHead>
            <TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell>Venta</TableCell>
              <TableCell>Anticipo 1</TableCell>
              <TableCell>Documento</TableCell>
              <TableCell>Anticipo 2</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>Documento</TableCell>
              <TableCell>Saldo</TableCell>
              <TableCell>Observaciones</TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lineas.map((linea) => (
              <TableRow key={linea.id}>
                <TableCell><TextField type="date" size="small" value={linea.fecha} disabled={bloqueado} onChange={(e) => actualizarLinea(linea.id, "fecha", e.target.value)} /></TableCell>
                <TableCell><TextField size="small" value={linea.cliente} disabled={bloqueado} onChange={(e) => actualizarLinea(linea.id, "cliente", e.target.value.toUpperCase())} sx={{ width: 170 }} /></TableCell>
                <TableCell><TextField type="number" size="small" value={linea.venta || ""} disabled={bloqueado} onChange={(e) => actualizarLinea(linea.id, "venta", parseNumber(e.target.value))} sx={{ width: 110 }} /></TableCell>
                <TableCell><TextField type="number" size="small" value={linea.anticipo1 || ""} disabled={bloqueado} onChange={(e) => actualizarLinea(linea.id, "anticipo1", parseNumber(e.target.value))} sx={{ width: 110 }} /></TableCell>
                <TableCell><TextField size="small" value={linea.documento1} disabled={bloqueado} onChange={(e) => actualizarLinea(linea.id, "documento1", e.target.value.toUpperCase())} sx={{ width: 170 }} /></TableCell>
                <TableCell><TextField type="number" size="small" value={linea.anticipo2 || ""} disabled={bloqueado} onChange={(e) => actualizarLinea(linea.id, "anticipo2", parseNumber(e.target.value))} sx={{ width: 110 }} /></TableCell>
                <TableCell><TextField type="date" size="small" value={linea.fecha2} disabled={bloqueado} onChange={(e) => actualizarLinea(linea.id, "fecha2", e.target.value)} /></TableCell>
                <TableCell><TextField size="small" value={linea.documento2} disabled={bloqueado} onChange={(e) => actualizarLinea(linea.id, "documento2", e.target.value.toUpperCase())} sx={{ width: 170 }} /></TableCell>
                <TableCell><TextField type="number" size="small" value={linea.saldo || ""} disabled={bloqueado} onChange={(e) => actualizarLinea(linea.id, "saldo", parseNumber(e.target.value))} sx={{ width: 110 }} /></TableCell>
                <TableCell><TextField size="small" value={linea.observaciones} disabled={bloqueado} onChange={(e) => actualizarLinea(linea.id, "observaciones", e.target.value.toUpperCase())} sx={{ width: 170 }} /></TableCell>
                <TableCell align="center">
                  <IconButton color="error" disabled={bloqueado || lineas.length === 1} onClick={() => eliminarLinea(linea.id)}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-start">
        <Button startIcon={<AddIcon />} variant="outlined" disabled={bloqueado} onClick={agregarLinea}>
          Agregar linea
        </Button>
        <Paper variant="outlined" sx={{ p: 2, ml: { md: "auto" }, minWidth: { xs: "100%", md: 380 } }}>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between"><Typography>Venta</Typography><Typography>{formatCurrency(totales.totalVenta)}</Typography></Stack>
            <Stack direction="row" justifyContent="space-between"><Typography>Anticipo 1</Typography><Typography>{formatCurrency(totales.totalAnticipo1)}</Typography></Stack>
            <Stack direction="row" justifyContent="space-between"><Typography>Anticipo 2</Typography><Typography>{formatCurrency(totales.totalAnticipo2)}</Typography></Stack>
            <Stack direction="row" justifyContent="space-between"><Typography>Saldo</Typography><Typography>{formatCurrency(totales.totalSaldo)}</Typography></Stack>
            <Divider />
            <Stack direction="row" justifyContent="space-between"><Typography>S/IVA</Typography><Typography>{formatCurrency(totales.totalSinIva)}</Typography></Stack>
            <Stack direction="row" justifyContent="space-between"><Typography fontWeight={700}>Comision {comisionPct}%</Typography><Typography fontWeight={700}>{formatCurrency(totales.comision)}</Typography></Stack>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
