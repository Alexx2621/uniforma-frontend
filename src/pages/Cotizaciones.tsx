import { useEffect, useMemo, useState } from "react";
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
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import CleaningServicesOutlined from "@mui/icons-material/CleaningServicesOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import LOGO_URL from "../assets/cotizacion-logo.png";
import { PDF_FONT_BOLD_FAMILY, PDF_FONT_FAMILY } from "../utils/fontFamily";

interface CotizacionItem {
  key: number;
  cantidad: number;
  descripcion: string;
  precioUnitario: number;
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

const createKey = () => Date.now() + Math.floor(Math.random() * 100000);

const createItem = (): CotizacionItem => ({
  key: createKey(),
  cantidad: 1,
  descripcion: "",
  precioUnitario: 0,
});

const todayInput = () => {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatDate = (value: string) => {
  if (!value) return "";
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return value;
  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return `${day} de ${months[month - 1]} de ${year}`;
};

const money = (value: number) =>
  `Q ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const moneyValue = (value: number) =>
  Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const moneyCell = (value: number) => `<span class="q">Q</span><span class="amount">${moneyValue(value)}</span>`;

const esc = (value: unknown) =>
  `${value ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const nl2br = (value: string) => esc(value).replace(/\n/g, "<br />");

const buildCotizacionHtml = ({
  cotizacionNo,
  dirigidoA,
  cliente,
  entrega,
  fecha,
  ejecutivo,
  celular,
  items,
  notasCalidad,
  condicionesPago,
  banco,
  cuenta,
  validez,
}: {
  cotizacionNo: string;
  dirigidoA: string;
  cliente: string;
  entrega: string;
  fecha: string;
  ejecutivo: string;
  celular: string;
  items: CotizacionItem[];
  notasCalidad: string;
  condicionesPago: string;
  banco: string;
  cuenta: string;
  validez: string;
}) => {
  const rows = items.filter((item) => item.descripcion.trim() || Number(item.cantidad || 0) || Number(item.precioUnitario || 0));
  const total = rows.reduce((sum, item) => sum + Number(item.cantidad || 0) * Number(item.precioUnitario || 0), 0);

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Cotizacion ${esc(cotizacionNo)}</title>
      <style>
        @page { size: letter landscape; margin: 10mm 14mm; }
        html, body, .page, table, th, td {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body {
          margin: 0;
          background: #fff;
          color: #1f2937;
          font-family: ${PDF_FONT_FAMILY};
          font-size: 11px;
        }
        .page {
          --brand-blue: #20275d;
          --qty-col: 19mm;
          --price-col: 19mm;
          --total-col: 24mm;
          --retention-col: 74mm;
          width: 244mm;
          margin: 0 auto;
          padding: 0;
        }
        .top {
          display: grid;
          grid-template-columns: 96mm 1fr 55mm;
          align-items: start;
          gap: 6mm;
          min-height: 26mm;
        }
        .logo {
          width: 68mm;
          height: 25mm;
          object-fit: contain;
          object-position: left top;
        }
        .company {
          padding-top: 0;
          line-height: 1.22;
          color: #0c2340;
          text-align: left;
          font-size: 14px;
        }
        .company .name {
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
          font-style: italic;
          font-size: 14px;
          color: #0c2340;
        }
        .company .site {
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
          color: #0c2340;
        }
        .quote-box,
        .quote-box td {
          border: 0;
        }
        .quote-box {
          width: 100%;
          text-align: center;
        }
        .quote-box td {
          height: 8mm;
          vertical-align: middle;
        }
        .quote-title {
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
          font-size: 17px;
          color: #0f172a;
        }
        .quote-no {
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
          font-size: 16px;
          color: #ef0000;
        }
        .band-grid {
          margin-top: 3mm;
          display: grid;
          grid-template-columns: 1fr var(--retention-col) 50mm;
          gap: 0;
        }
        .section-title {
          background: var(--brand-blue);
          color: #fff;
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
          text-align: center;
          padding: 1.7mm 1mm;
          font-size: 12px;
          line-height: 1;
        }
        .section-title.gray {
          background: #777272;
        }
        .client-contact-grid {
          display: grid;
          grid-template-columns: 1fr 50mm;
          gap: 0;
          min-height: 19mm;
        }
        .client-block {
          text-align: left;
          padding-top: 2mm;
          padding-left: var(--qty-col);
          padding-right: 3mm;
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
          color: #152238;
          font-size: 13px;
          line-height: 1.45;
        }
        .client-row {
          display: block;
        }
        .delivery {
          display: block;
          margin-top: 0.5mm;
          margin-left: 0;
          width: 80%;
          box-sizing: border-box;
          background: #777272;
          color: #fff;
          padding: 1mm 3mm;
          line-height: 1;
          font-size: 11px;
          text-align: left;
        }
        .contact-block {
          padding-top: 2mm;
          text-align: center;
          color: #0c2340;
          font-size: 10px;
          line-height: 1.55;
        }
        .contact-block strong {
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
        }
        .items, .notes, .total-table {
          width: 100%;
          border-collapse: collapse;
        }
        .items {
          margin-top: 1.5mm;
          table-layout: fixed;
        }
        .items th {
          background: var(--brand-blue);
          color: #fff;
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
          padding: 1.7mm 1mm;
          text-align: center;
          font-size: 12px;
          border-top: 1.4pt solid var(--brand-blue);
          border-bottom: 1.4pt solid var(--brand-blue);
          border-left: 0.7pt solid var(--brand-blue);
          border-right: 0.7pt solid var(--brand-blue);
          line-height: 1;
        }
        .items th:first-child {
          border-left-width: 1.4pt;
        }
        .items th:last-child {
          border-right-width: 1.4pt;
        }
        .items td {
          background: #fff;
          border: 0.7pt solid #000;
          padding: 2.1mm 1.4mm;
          vertical-align: middle;
          font-size: 10.6px;
        }
        .items tbody tr:first-child td {
          border-top-width: 1.4pt;
        }
        .items tbody tr:last-child td {
          border-bottom-width: 1.4pt;
        }
        .items tbody td:first-child {
          border-left-width: 1.4pt;
        }
        .items tbody td:last-child {
          border-right-width: 1.4pt;
        }
        .qty {
          width: var(--qty-col);
          text-align: center;
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
          color: #0c2340;
        }
        .desc {
          width: auto;
          color: #0c2340;
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
          line-height: 1.35;
        }
        .price { width: var(--price-col); }
        .line-total { width: var(--total-col); }
        .price,
        .line-total,
        .total-amount {
          color: #0c2340;
          white-space: nowrap;
        }
        .money {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 3mm;
          width: 100%;
        }
        .money .q {
          min-width: 5mm;
          text-align: left;
        }
        .money .amount {
          flex: 1;
          text-align: right;
        }
        .total-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
        }
        .total-table .total-spacer {
          border: 0;
          padding: 0;
        }
        .total-table .total-amount {
          border: 1.4pt solid #000;
          border-top: 0;
          padding: 2.4mm 1.4mm;
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
          font-size: 12px;
        }
        .total-table .money {
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
        }
        .notes-wrap {
          display: grid;
          grid-template-columns: 1fr 58mm;
          gap: 10mm;
          margin-top: 2.5mm;
        }
        .notes td {
          padding: 1mm 0;
          border: 0;
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
          color: #000;
          font-size: 11px;
        }
        .payment {
          margin-top: 6mm;
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
          line-height: 1.45;
          text-align: left;
          font-size: 13px;
        }
        .payment .red {
          color: #ef0000;
        }
        .payment .blue {
          color: #17365d;
        }
        .signature {
          margin-top: 22mm;
          text-align: center;
        }
        .signature .line {
          border-top: 1px solid #000;
          height: 0;
          margin-bottom: 1.2mm;
        }
        .signature .label {
          font-size: 8px;
          color: #111827;
        }
        .validity {
          margin-top: 4mm;
          background: #fff;
          color: #ef0000;
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
          font-size: 12px;
        }
        @media print {
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="top">
          <img class="logo" src="${LOGO_URL}" alt="Uniforma" />
          <div class="company">
            <div class="name">UNIFORMA GUATEMALA</div>
            <div>Tel: (502) 2232-9914</div>
            <div>info@uniformaguatemala.com</div>
            <div class="site">www.uniformaguatemala.com</div>
          </div>
          <table class="quote-box">
            <tr><td class="quote-title">COTIZACIÓN</td></tr>
            <tr><td class="quote-no">No. ${esc(cotizacionNo || "000001")}</td></tr>
          </table>
        </div>

        <div class="band-grid">
          <div class="section-title">DATOS DEL CLIENTE</div>
          <div class="section-title gray">SUJETOS A RETENCIÓN DEFINITIVA</div>
          <div class="section-title">FECHA / CONTACTO</div>
        </div>

        <div class="client-contact-grid">
          <div class="client-block">
            <span class="client-row">DIRIGIDO A: ${esc(dirigidoA)}</span>
            <span class="client-row">CLIENTE: ${esc(cliente)}</span>
            <span class="delivery">ENTREGA: ${esc(entrega)}</span>
          </div>
          <div class="contact-block">
            <div>${esc(formatDate(fecha))}</div>
            <div>Ejecutivo: ${esc(ejecutivo)}</div>
            <div><strong>Celular: ${esc(celular)}</strong></div>
          </div>
        </div>

        <table class="items">
          <colgroup>
            <col style="width: var(--qty-col);" />
            <col />
            <col style="width: var(--price-col);" />
            <col style="width: var(--total-col);" />
          </colgroup>
          <thead>
            <tr>
              <th class="qty">CANTIDAD</th>
              <th class="desc">DESCRIPCIÓN</th>
              <th class="price">P. U</th>
              <th class="line-total">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map(
                      (item) => `
                        <tr>
                          <td class="qty">${Number(item.cantidad || 0)}</td>
                          <td class="desc">${nl2br(item.descripcion)}</td>
                          <td class="price"><span class="money">${moneyCell(item.precioUnitario)}</span></td>
                          <td class="line-total"><span class="money">${moneyCell(Number(item.cantidad || 0) * Number(item.precioUnitario || 0))}</span></td>
                        </tr>
                      `
                    )
                    .join("")
                : `<tr><td class="qty">&nbsp;</td><td class="desc">&nbsp;</td><td class="price">&nbsp;</td><td class="line-total">&nbsp;</td></tr>`
            }
          </tbody>
        </table>

        <table class="total-table">
          <colgroup>
            <col style="width: var(--qty-col);" />
            <col />
            <col style="width: var(--price-col);" />
            <col style="width: var(--total-col);" />
          </colgroup>
          <tr>
            <td class="total-spacer"></td>
            <td class="total-spacer"></td>
            <td class="total-spacer"></td>
            <td class="total-amount"><span class="money">${moneyCell(total)}</span></td>
          </tr>
        </table>

        <div class="notes-wrap">
          <div>
            <table class="notes">
              ${notasCalidad
                .split("\n")
                .filter((line) => line.trim())
                .map((line) => `<tr><td>${esc(line)}</td></tr>`)
                .join("")}
            </table>
            <div class="payment">
              <div class="red">${esc(condicionesPago)}</div>
              <div class="blue">${esc(banco)}</div>
              <div><span class="red">${esc(cuenta.split(" ").slice(0, 4).join(" "))}</span><span class="blue"> ${esc(cuenta.split(" ").slice(4).join(" "))}</span></div>
            </div>
            <div class="validity">${esc(validez)}</div>
          </div>
          <div>
            <div class="signature">
              <div class="line"></div>
              <div class="label">NOMBRE, FIRMA Y SELLO / CLIENTE</div>
            </div>
          </div>
        </div>
      </div>
      <script>
        window.addEventListener('load', () => setTimeout(() => {
          window.print();
          window.onafterprint = () => window.close();
        }
          window.print();
          window.onafterprint = () => window.close();
        }, 350));
      </script>
    </body>
  </html>`;
};

export default function Cotizaciones() {
  const { nombre, usuario, rol, id: userId } = useAuthStore();
  const location = useLocation();
  const [documentos, setDocumentos] = useState<DocumentoGenerado[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [filtroUsuarioId, setFiltroUsuarioId] = useState<number | null | "">("");
  const [documentoId, setDocumentoId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [cotizacionNo, setCotizacionNo] = useState("Pendiente");
  const [dirigidoA, setDirigidoA] = useState("");
  const [cliente, setCliente] = useState("");
  const [entrega, setEntrega] = useState("7 DÍAS HÁBILES UNA VEZ RECIBIDO EL ANTICIPO.");
  const [fecha, setFecha] = useState(todayInput());
  const [ejecutivo, setEjecutivo] = useState(nombre || usuario || "");
  const [celular, setCelular] = useState("");
  const [items, setItems] = useState<CotizacionItem[]>([
    {
      key: createKey(),
      cantidad: 1,
      descripcion: "",
      precioUnitario: 0,
    },
  ]);
  const [notasCalidad, setNotasCalidad] = useState(
    "COSTURAS DE PUNTADA PEQUEÑA PARA MAYOR RESISTENCIA Y COMODIDAD.\nENTRETELAS ADECUADAS PARA CADA TIPO DE PRENDA."
  );
  const [condicionesPago, setCondicionesPago] = useState("50% de anticipo 50% al momento de la entrega.");
  const banco = "ACREDITAR A CUENTA MONETARIA BANRURAL";
  const cuenta = "0310 2300 3413 83 UNIFORMA GUATEMALA";
  const [validez, setValidez] = useState("COTIZACIÓN CON VALIDEZ DE 3 DÍAS.");

  const isAdmin = rol === "ADMIN";

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.cantidad || 0) * Number(item.precioUnitario || 0), 0),
    [items]
  );

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

  const cargarSiguienteCotizacion = async () => {
    try {
      const resp = await api.get("/correlativos/usuario-operaciones/actual/cotizacion");
      setCotizacionNo(resp.data?.correlativo || "Pendiente");
    } catch {
      setCotizacionNo("Pendiente");
    }
  };

  const cargarDocumentos = async () => {
    try {
      const params: any = { tipo: "cotizacion" };
      if (!isAdmin && !userId) {
        setDocumentos([]);
        return;
      }
      if (typeof filtroUsuarioId === 'number') params.usuarioId = filtroUsuarioId;
      const resp = await api.get("/documentos", { params });
      setDocumentos(resp.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar las cotizaciones generadas", "error");
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
  }, [filtroUsuarioId]);

  useEffect(() => {
    if ((location.state as any)?.sidebarClickAt) {
      setShowForm(false);
      void cargarDocumentos();
    }
  }, [location.state]);

  const resetForm = async () => {
    setDocumentoId(null);
    await cargarSiguienteCotizacion();
    setDirigidoA("");
    setCliente("");
    setEntrega("7 DÃAS HÃBILES UNA VEZ RECIBIDO EL ANTICIPO.");
    setFecha(todayInput());
    setEjecutivo(nombre || usuario || "");
    setCelular("");
    setItems([createItem()]);
  };

  const nuevaCotizacion = async () => {
    await resetForm();
    setShowForm(true);
  };

  const getPayload = () => ({
    dirigidoA,
    cliente,
    entrega,
    fecha,
    ejecutivo,
    celular,
    items,
    notasCalidad,
    condicionesPago,
    validez,
  });

  const guardarDocumento = async () => {
    const payload = {
      titulo: cliente || dirigidoA || "Cotizacion",
      data: getPayload(),
    };
    if (documentoId) {
      const resp = await api.patch(`/documentos/${documentoId}`, payload);
      return resp.data as DocumentoGenerado;
    }
    const resp = await api.post("/documentos", { tipo: "cotizacion", ...payload });
    const doc = resp.data as DocumentoGenerado;
    setDocumentoId(doc.id);
    setCotizacionNo(doc.correlativo);
    return doc;
  };

  const reimprimirDocumento = (doc: DocumentoGenerado) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      Swal.fire("Aviso", "Habilita ventanas emergentes para imprimir o guardar en PDF", "info");
      return;
    }
    const data = doc.data || {};
    printWindow.document.open();
    printWindow.document.write(
      buildCotizacionHtml({
        cotizacionNo: doc.correlativo,
        dirigidoA: data.dirigidoA || "",
        cliente: data.cliente || "",
        entrega: data.entrega || "",
        fecha: data.fecha || "",
        ejecutivo: data.ejecutivo || "",
        celular: data.celular || "",
        items: Array.isArray(data.items) ? data.items : [],
        notasCalidad: data.notasCalidad || "",
        condicionesPago: data.condicionesPago || "",
        banco,
        cuenta,
        validez: data.validez || "",
      })
    );
    printWindow.document.close();
  };

  const updateItem = (key: number, field: keyof Omit<CotizacionItem, "key">, value: string | number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.key === key
          ? {
              ...item,
              [field]: field === "descripcion" ? value : Number(value) || 0,
            }
          : item
      )
    );
  };

  const removeItem = (key: number) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.key !== key) : prev));
  };

  const limpiar = () => {
    setDocumentoId(null);
    void cargarSiguienteCotizacion();
    setDirigidoA("");
    setCliente("");
    setEntrega("7 DÍAS HÁBILES UNA VEZ RECIBIDO EL ANTICIPO.");
    setFecha(todayInput());
    setEjecutivo(nombre || usuario || "");
    setCelular("");
    setItems([createItem()]);
  };

  const imprimir = async () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      Swal.fire("Aviso", "Habilita ventanas emergentes para imprimir o guardar en PDF", "info");
      return;
    }

    let correlativo = cotizacionNo;
    try {
      const doc = await guardarDocumento();
      correlativo = doc.correlativo || cotizacionNo;
      setCotizacionNo(correlativo);
    } catch (error: any) {
      printWindow.close();
      const msg = error?.response?.data?.message || "No se pudo guardar la cotizacion";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildCotizacionHtml({
        cotizacionNo: correlativo,
        dirigidoA,
        cliente,
        entrega,
        fecha,
        ejecutivo,
        celular,
        items,
        notasCalidad,
        condicionesPago,
        banco,
        cuenta,
        validez,
      })
    );
    printWindow.document.close();
    void cargarDocumentos();
  };

  if (!showForm) {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h4">Cotizaciones</Typography>
          <Button startIcon={<AddOutlined />} variant="contained" onClick={nuevaCotizacion}>
            Nueva cotización
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
                <TableCell>Cliente</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Usuario</TableCell>
                <TableCell align="right">Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documentosFiltrados.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>{doc.correlativo}</TableCell>
                  <TableCell>{doc.titulo || doc.data?.cliente || "Sin cliente"}</TableCell>
                  <TableCell>{doc.data?.fecha || new Date(doc.creadoEn).toLocaleDateString()}</TableCell>
                  <TableCell>{doc.usuario?.nombre || "Desconocido"}</TableCell>
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
                    No hay cotizaciones generadas.
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
        <Stack>
          <Typography variant="h4">Cotizaciones</Typography>
          <Typography variant="body2" color="text.secondary">
            Completa la cotización y genera el PDF sin almacenar datos.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<ArrowBackOutlined />} variant="outlined" size="small" onClick={() => { setShowForm(false); void cargarDocumentos(); }}>
            Volver
          </Button>
          <Button startIcon={<CleaningServicesOutlined />} variant="outlined" size="small" onClick={limpiar}>
            Limpiar
          </Button>
          <Button startIcon={<PictureAsPdfOutlined />} variant="contained" color="secondary" size="small" onClick={imprimir}>
            Imprimir / PDF
          </Button>
        </Stack>
      </Stack>

      <Divider sx={{ mb: 2 }} />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField label="Cotización No." fullWidth size="small" value={cotizacionNo} disabled />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField label="Fecha" type="date" fullWidth size="small" value={fecha} onChange={(e) => setFecha(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField label="Ejecutivo" fullWidth size="small" value={ejecutivo} onChange={(e) => setEjecutivo(e.target.value)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField label="Celular" fullWidth size="small" value={celular} onChange={(e) => setCelular(e.target.value)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label="Dirigido a" fullWidth size="small" value={dirigidoA} onChange={(e) => setDirigidoA(e.target.value)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label="Cliente" fullWidth size="small" value={cliente} onChange={(e) => setCliente(e.target.value)} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField label="Entrega" fullWidth size="small" value={entrega} onChange={(e) => setEntrega(e.target.value)} />
        </Grid>
      </Grid>

      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 110 }}>Cantidad</TableCell>
              <TableCell>Descripción</TableCell>
              <TableCell sx={{ width: 150 }}>P. U</TableCell>
              <TableCell sx={{ width: 150 }}>Total</TableCell>
              <TableCell align="center" sx={{ width: 70 }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.key}>
                <TableCell>
                  <TextField type="number" size="small" fullWidth value={item.cantidad} onChange={(e) => updateItem(item.key, "cantidad", e.target.value)} />
                </TableCell>
                <TableCell>
                  <TextField
                    multiline
                    minRows={2}
                    size="small"
                    fullWidth
                    value={item.descripcion}
                    onChange={(e) => updateItem(item.key, "descripcion", e.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <TextField type="number" size="small" fullWidth value={item.precioUnitario} onChange={(e) => updateItem(item.key, "precioUnitario", e.target.value)} />
                </TableCell>
                <TableCell>{money(Number(item.cantidad || 0) * Number(item.precioUnitario || 0))}</TableCell>
                <TableCell align="center">
                  <IconButton color="error" size="small" onClick={() => removeItem(item.key)} disabled={items.length <= 1}>
                    <DeleteOutlineOutlined />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={5}>
                <Button startIcon={<AddOutlined />} variant="outlined" size="small" onClick={() => setItems((prev) => [...prev, createItem()])}>
                  Agregar fila
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <TextField
            label="Notas de calidad"
            multiline
            minRows={3}
            fullWidth
            value={notasCalidad}
            onChange={(e) => setNotasCalidad(e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2}>
            <TextField label="Condiciones de pago" fullWidth value={condicionesPago} onChange={(e) => setCondicionesPago(e.target.value)} />
            <TextField label="Banco" fullWidth value={banco} disabled />
            <TextField label="Cuenta" fullWidth value={cuenta} disabled />
            <TextField label="Validez" fullWidth value={validez} onChange={(e) => setValidez(e.target.value)} />
          </Stack>
        </Grid>
      </Grid>

      <Stack direction="row" justifyContent="flex-end">
        <Typography variant="h6">Total: {money(total)}</Typography>
      </Stack>
    </Paper>
  );
}
