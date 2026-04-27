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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import CleaningServicesOutlined from "@mui/icons-material/CleaningServicesOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import Swal from "sweetalert2";
import { api } from "../../api/axios";
import { useAuthStore } from "../../auth/useAuthStore";
import LOGO_URL from "../../assets/3-logos.png";
import { PDF_FONT_BOLD_FAMILY, PDF_FONT_FAMILY, PDF_FONT_SEMIBOLD_FAMILY } from "../../utils/fontFamily";

interface QuincenaRow {
  day: number;
  weekday: string;
  ventaDiaria: number;
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

const monthNames = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
];

const weekdayNames = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];

const money = (value: number) =>
  `Q ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const percent = (value: number) => `${Number(value || 0).toFixed(2)}%`;

const getRows = (year: number, month: number, quincena: "1" | "2"): QuincenaRow[] => {
  const lastDay = new Date(year, month, 0).getDate();
  const start = quincena === "1" ? 1 : 16;
  const end = quincena === "1" ? 15 : lastDay;

  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
    .map((day) => {
      const date = new Date(year, month - 1, day);
      return {
        day,
        weekday: weekdayNames[date.getDay()],
        ventaDiaria: 0,
      };
    })
    .filter((row) => row.weekday !== "DOMINGO");
};

const buildReporteQuincenalHtml = ({
  tienda,
  month,
  year,
  vendedor,
  metaMes,
  promedioDiario,
  reporteNo,
  quincena,
  rows,
}: {
  tienda: string;
  month: number;
  year: number;
  vendedor: string;
  metaMes: number;
  promedioDiario: number;
  reporteNo: string;
  quincena: "1" | "2";
  rows: QuincenaRow[];
}) => {
  const totalVenta = rows.reduce((sum, row) => sum + Number(row.ventaDiaria || 0), 0);
  const totalPorcentaje = metaMes > 0 ? (totalVenta / metaMes) * 100 : 0;
  const quincenaLabel = quincena === "1" ? "1RA QUINCENA" : "2DA QUINCENA";

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Reporte quincenal ${monthNames[month - 1]} ${year}</title>
      <style>
        @page { size: portrait; margin: 10mm; }
        html, body, .page, table, th, td {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body {
          margin: 0;
          background: #fff;
          color: #111827;
          font-family: ${PDF_FONT_FAMILY};
        }
        .page {
          width: 170mm;
          margin: 0 auto;
          padding: 4mm 0 0;
        }
        .top {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6mm;
          width: 100%;
          margin: 0 auto 1.5mm;
        }
        .meta {
          width: 64mm;
          margin: 0;
        }
        .meta-row {
          display: grid;
          grid-template-columns: 32mm 32mm;
          min-height: 3.7mm;
          align-items: center;
          font-size: 10.5px;
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
        }
        .meta-label {
          background: #002060;
          color: #fff;
          text-align: right;
          padding: 0.35mm 1.5mm;
        }
        .meta-value {
          background: #ff3300;
          color: #fff;
          text-align: left;
          padding: 0.35mm 1.5mm;
        }
        .meta-row.vendor .meta-label,
        .meta-row.vendor .meta-value {
          background: #d9d9d9;
          color: #111827;
        }
        .logo {
          width: 25mm;
          height: 25mm;
          object-fit: contain;
          margin: 0;
        }
        table {
          width: 132mm;
          margin: 0 auto;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 12px;
        }
        th {
          background: #d9d9d9;
          color: #111827;
          font-size: 12px;
          font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
          font-weight: 600;
          text-align: center;
          padding: 0.45mm 1.2mm;
          border: none;
        }
        td {
          text-align: center;
          padding: 0.6mm 1.2mm;
          border: none;
          font-size: 13px;
        }
        td.money {
          white-space: nowrap;
        }
        .total-label {
          text-align: right;
          font-size: 13px;
          font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
          font-weight: 600;
        }
        .total-value {
          background: #ff3300;
          color: #fff;
          font-size: 13px;
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
          white-space: nowrap;
        }
        .footer-note {
          margin-top: 8mm;
          color: #4b5563;
          font-size: 10px;
        }
        @media print {
          th, td, .meta-label, .meta-value, .total-value {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="top">
          <div class="meta">
            <div class="meta-row"><div class="meta-label">TIENDA</div><div class="meta-value">${tienda || "-"}</div></div>
            <div class="meta-row"><div class="meta-label">MES</div><div class="meta-value">${monthNames[month - 1]}</div></div>
            <div class="meta-row vendor"><div class="meta-label">VENDEDOR</div><div class="meta-value">${vendedor || "-"}</div></div>
            <div class="meta-row"><div class="meta-label">META MES</div><div class="meta-value">${money(metaMes)}</div></div>
            <div class="meta-row"><div class="meta-label">PROMEDIO DIARIO</div><div class="meta-value">${money(promedioDiario)}</div></div>
            <div class="meta-row"><div class="meta-label">REPORTE No.</div><div class="meta-value">${reporteNo || "-"}</div></div>
          </div>
          <img class="logo" src="${LOGO_URL}" alt="Uniforma" />
        </div>

        <table>
          <colgroup>
            <col style="width: 18%;" />
            <col style="width: 28%;" />
            <col style="width: 28%;" />
            <col style="width: 26%;" />
          </colgroup>
          <thead>
            <tr>
              <th>FECHA</th>
              <th>DÍA</th>
              <th>VENTA DIARIA</th>
              <th>PORCENTAJE</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `<tr>
                  <td>${row.day}</td>
                  <td>${row.weekday}</td>
                  <td class="money">${money(row.ventaDiaria)}</td>
                  <td>${percent(metaMes > 0 ? (Number(row.ventaDiaria || 0) / metaMes) * 100 : 0)}</td>
                </tr>`
              )
              .join("")}
            <tr>
              <td></td>
              <td class="total-label">${quincenaLabel}</td>
              <td class="total-value">${money(totalVenta)}</td>
              <td class="total-value">${percent(totalPorcentaje)}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer-note">
          Generado desde Uniforma el ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}.
        </div>
      </div>
      <script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); } }</script>
    </body>
  </html>`;
};

export default function ReporteQuincenal() {
  const currentDate = new Date();
  const { bodegaNombre, usuario, nombre, primerNombre, primerApellido, rol, id: userId } = useAuthStore();
  const location = useLocation();
  const [documentos, setDocumentos] = useState<DocumentoGenerado[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [filtroUsuarioId, setFiltroUsuarioId] = useState<number | null | "">("");
  const [documentoId, setDocumentoId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const tienda = `${bodegaNombre || "TIENDA"}`.trim().toUpperCase();
  const vendedor = `${usuario || nombre || [primerNombre, primerApellido].filter(Boolean).join(" ") || "USUARIO"}`
    .trim()
    .toUpperCase();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());
  const [metaMes, setMetaMes] = useState(130000);
  const [promedioDiario, setPromedioDiario] = useState(9000);
  const [quincena, setQuincena] = useState<"1" | "2">("2");
  const [reporteNo, setReporteNo] = useState("Pendiente");
  const [ventasPorDia, setVentasPorDia] = useState<Record<number, number>>({});

  const isAdmin = rol === "ADMIN";

  const cargarSiguienteReporte = async () => {
    try {
      const resp = await api.get("/correlativos/usuario-operaciones/actual/reporteQuincenal");
      setReporteNo(resp.data?.correlativo || "Pendiente");
    } catch {
      setReporteNo("Pendiente");
    }
  };

  const cargarDocumentos = useCallback(async () => {
    try {
      const params: any = { tipo: "reporteQuincenal" };
      if (!isAdmin && !userId) {
        setDocumentos([]);
        return;
      }
      if (typeof filtroUsuarioId === 'number') params.usuarioId = filtroUsuarioId;
      const resp = await api.get("/documentos", { params });
      setDocumentos(resp.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar los reportes quincenales generados", "error");
    }
  }, [filtroUsuarioId, isAdmin, userId]);

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
        const docFecha = String(doc.creadoEn || "").slice(0, 10);
        if (filtroDesde && docFecha < filtroDesde) return false;
        if (filtroHasta && docFecha > filtroHasta) return false;
        return true;
      }),
    [documentos, filtroDesde, filtroHasta]
  );

  const nuevoReporte = async () => {
    setDocumentoId(null);
    await cargarSiguienteReporte();
    setMonth(currentDate.getMonth() + 1);
    setYear(currentDate.getFullYear());
    setMetaMes(130000);
    setPromedioDiario(9000);
    setQuincena("2");
    setVentasPorDia({});
    setShowForm(true);
  };


  const getPayload = () => ({
    tienda,
    vendedor,
    month,
    year,
    metaMes,
    promedioDiario,
    quincena,
    ventasPorDia,
  });

  const guardarDocumento = async () => {
    const payload = {
      titulo: `${quincena}RA QUINCENA ${monthNames[month - 1]} ${year}`,
      data: getPayload(),
    };
    if (documentoId) {
      const resp = await api.patch(`/documentos/${documentoId}`, payload);
      return resp.data as DocumentoGenerado;
    }
    const resp = await api.post("/documentos", { tipo: "reporteQuincenal", ...payload });
    const doc = resp.data as DocumentoGenerado;
    setDocumentoId(doc.id);
    setReporteNo(doc.correlativo);
    return doc;
  };

  const rows = useMemo(
    () =>
      getRows(year, month, quincena).map((row) => ({
        ...row,
        ventaDiaria: Number(ventasPorDia[row.day] || 0),
      })),
    [year, month, quincena, ventasPorDia]
  );

  const totalVenta = useMemo(() => rows.reduce((sum, row) => sum + Number(row.ventaDiaria || 0), 0), [rows]);
  const totalPorcentaje = metaMes > 0 ? (totalVenta / metaMes) * 100 : 0;

  const updateVenta = (day: number, value: number) => {
    setVentasPorDia((prev) => ({ ...prev, [day]: value }));
  };

  const limpiarCapturas = () => {
    setVentasPorDia({});
  };

  const reimprimirDocumento = (doc: DocumentoGenerado) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      Swal.fire("Aviso", "Habilita ventanas emergentes para imprimir o guardar en PDF", "info");
      return;
    }
    const data = doc.data || {};
    const docMonth = Number(data.month || currentDate.getMonth() + 1);
    const docYear = Number(data.year || currentDate.getFullYear());
    const docQuincena = data.quincena === "1" ? "1" : "2";
    const docVentasPorDia = data.ventasPorDia || {};
    const docRows = getRows(docYear, docMonth, docQuincena).map((row) => ({
      ...row,
      ventaDiaria: Number(docVentasPorDia[row.day] || 0),
    }));
    printWindow.document.open();
    printWindow.document.write(
      buildReporteQuincenalHtml({
        tienda: data.tienda || tienda,
        month: docMonth,
        year: docYear,
        vendedor: data.vendedor || vendedor,
        metaMes: Number(data.metaMes || 0),
        promedioDiario: Number(data.promedioDiario || 0),
        reporteNo: doc.correlativo,
        quincena: docQuincena,
        rows: docRows,
      })
    );
    printWindow.document.close();
  };

  const imprimir = async () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      Swal.fire("Aviso", "Habilita ventanas emergentes para imprimir o guardar en PDF", "info");
      return;
    }

    let correlativo = reporteNo;
    try {
      const doc = await guardarDocumento();
      correlativo = doc.correlativo || reporteNo;
      setReporteNo(correlativo);
    } catch (error: any) {
      printWindow.close();
      const msg = error?.response?.data?.message || "No se pudo guardar el reporte quincenal";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildReporteQuincenalHtml({
        tienda,
        month,
        year,
        vendedor,
        metaMes,
        promedioDiario,
        reporteNo: correlativo,
        quincena,
        rows,
      })
    );
    printWindow.document.close();
    void cargarDocumentos();
  };

  if (!showForm) {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h4">Reporte quincenal</Typography>
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
                <TableCell>Periodo</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Usuario</TableCell>
                <TableCell align="right">Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documentosFiltrados.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>{doc.correlativo}</TableCell>
                  <TableCell>{doc.titulo || `${doc.data?.quincena || ""} quincena ${doc.data?.month || ""}/${doc.data?.year || ""}`}</TableCell>
                  <TableCell>{money(Object.values(doc.data?.ventasPorDia || {}).reduce((sum: number, value: any) => sum + Number(value || 0), 0))}</TableCell>
                  <TableCell>{doc.usuario?.nombre || doc.usuario?.usuario || "N/D"}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" variant="contained" color="secondary" onClick={() => reimprimirDocumento(doc)}>
                        Reimprimir
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {!documentosFiltrados.length && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No hay reportes quincenales generados.
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
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h4">Reporte quincenal</Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<ArrowBackOutlined />} variant="outlined" size="small" onClick={() => { setShowForm(false); void cargarDocumentos(); }}>
            Volver
          </Button>
          <Button startIcon={<CleaningServicesOutlined />} variant="outlined" size="small" onClick={limpiarCapturas}>
            Limpiar capturas
          </Button>
          <Button startIcon={<PictureAsPdfOutlined />} variant="contained" color="secondary" size="small" onClick={imprimir}>
            Imprimir / PDF
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField label="Tienda" fullWidth size="small" value={tienda} disabled />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField select label="Mes" fullWidth size="small" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {monthNames.map((name, index) => (
              <MenuItem key={name} value={index + 1}>
                {name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 2 }}>
          <TextField label="Año" type="number" fullWidth size="small" value={year} onChange={(e) => setYear(Number(e.target.value) || currentDate.getFullYear())} />
        </Grid>
        <Grid size={{ xs: 12, sm: 2 }}>
          <TextField select label="Quincena" fullWidth size="small" value={quincena} onChange={(e) => setQuincena(e.target.value as "1" | "2")}>
            <MenuItem value="1">1RA QUINCENA</MenuItem>
            <MenuItem value="2">2DA QUINCENA</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 2 }}>
          <TextField label="Vendedor" fullWidth size="small" value={vendedor} disabled />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField label="Reporte No." fullWidth size="small" value={reporteNo} disabled />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField label="Meta mes" type="number" fullWidth size="small" value={metaMes} onChange={(e) => setMetaMes(Number(e.target.value) || 0)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField label="Promedio diario" type="number" fullWidth size="small" value={promedioDiario} onChange={(e) => setPromedioDiario(Number(e.target.value) || 0)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ height: "100%" }}>
            <Typography fontWeight={700}>Total: {money(totalVenta)}</Typography>
            <Typography fontWeight={700}>Porcentaje: {percent(totalPorcentaje)}</Typography>
          </Stack>
        </Grid>
      </Grid>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Este reporte no se guarda. Completa las ventas de la quincena y luego imprímelo o guárdalo como PDF.
      </Typography>

      <Divider sx={{ mb: 2 }} />

      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center">Fecha</TableCell>
              <TableCell align="center">Día</TableCell>
              <TableCell align="center">Venta diaria</TableCell>
              <TableCell align="center">Porcentaje</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.day}>
                <TableCell align="center">{row.day}</TableCell>
                <TableCell align="center">{row.weekday}</TableCell>
                <TableCell sx={{ minWidth: 160 }}>
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    value={row.ventaDiaria}
                    onChange={(e) => updateVenta(row.day, Number(e.target.value) || 0)}
                  />
                </TableCell>
                <TableCell align="center">{percent(metaMes > 0 ? (row.ventaDiaria / metaMes) * 100 : 0)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell />
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                {quincena === "1" ? "1RA QUINCENA" : "2DA QUINCENA"}
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                {money(totalVenta)}
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                {percent(totalPorcentaje)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
