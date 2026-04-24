import { useEffect, useMemo, useState } from "react";
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
} from "@mui/material";
import AddCircleOutlineOutlined from "@mui/icons-material/AddCircleOutlineOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import CleaningServicesOutlined from "@mui/icons-material/CleaningServicesOutlined";
import Swal from "sweetalert2";
import { api } from "../../api/axios";
import { useAuthStore } from "../../auth/useAuthStore";
import LOGO_URL from "../../assets/3-logos.png";
import { PDF_FONT_BOLD_FAMILY, PDF_FONT_FAMILY, PDF_FONT_SEMIBOLD_FAMILY } from "../../utils/fontFamily";

interface PagoVenta {
  referencia?: string | null;
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

const hasCapitalRowData = (row: CapitalRow) =>
  Boolean(
    `${row.envio || ""}`.trim() ||
      `${row.autorizacion || ""}`.trim() ||
      `${row.boleta || ""}`.trim() ||
      `${row.banco || ""}`.trim() ||
      `${row.observaciones || ""}`.trim() ||
      Number(row.transferencia || 0) > 0 ||
      Number(row.deposito || 0) > 0 ||
      Number(row.efectivo || 0) > 0
  );

const hasDepartamentoRowData = (row: DepartamentoRow) =>
  Boolean(
    `${row.envio || ""}`.trim() ||
      `${row.autorizacion || ""}`.trim() ||
      `${row.boleta || ""}`.trim() ||
      `${row.banco || ""}`.trim() ||
      `${row.observaciones || ""}`.trim() ||
      Number(row.transferencia || 0) > 0 ||
      Number(row.deposito || 0) > 0
  );

const buildReporteDiarioHtml = ({
  fecha,
  liquidacionNo,
  generadoPor,
  capitalRows,
  departamentoRows,
  tiendaRows,
  subtotalCapital,
  subtotalDepartamento,
  subtotalTienda,
  totalResumen,
}: {
  fecha: string;
  liquidacionNo: string;
  generadoPor: string;
  capitalRows: CapitalRow[];
  departamentoRows: DepartamentoRow[];
  tiendaRows: TiendaRow[];
  subtotalCapital: number;
  subtotalDepartamento: number;
  subtotalTienda: number;
  totalResumen: number;
}) => {
  const buildRows = (rows: string, colspan = 10) => (rows || `<tr><td colspan="${colspan}" class="empty">Sin datos</td></tr>`);
  const capitalRowsWithData = capitalRows.filter(hasCapitalRowData);
  const departamentoRowsWithData = departamentoRows.filter(hasDepartamentoRowData);
  const tiendaRowsWithData = tiendaRows.filter(hasTiendaRowData);
  const totalCapitalTransferencia = capitalRowsWithData.reduce((sum, row) => sum + Number(row.transferencia || 0), 0);
  const totalCapitalDeposito = capitalRowsWithData.reduce((sum, row) => sum + Number(row.deposito || 0), 0);
  const totalCapitalEfectivo = capitalRowsWithData.reduce((sum, row) => sum + Number(row.efectivo || 0), 0);
  const totalCapitalGeneral = capitalRowsWithData.reduce(
    (sum, row) => sum + Number(row.transferencia || 0) + Number(row.deposito || 0) + Number(row.efectivo || 0),
    0
  );
  const totalDepartamentoTransferencia = departamentoRowsWithData.reduce((sum, row) => sum + Number(row.transferencia || 0), 0);
  const totalDepartamentoDeposito = departamentoRowsWithData.reduce((sum, row) => sum + Number(row.deposito || 0), 0);
  const totalDepartamentoGeneral = departamentoRowsWithData.reduce(
    (sum, row) => sum + Number(row.transferencia || 0) + Number(row.deposito || 0),
    0
  );
  const totalTiendaTransferencia = tiendaRowsWithData.reduce((sum, row) => sum + Number(row.transferencia || 0), 0);
  const totalTiendaTarjeta = tiendaRowsWithData.reduce((sum, row) => sum + Number(row.tarjeta || 0), 0);
  const totalTiendaEfectivo = tiendaRowsWithData.reduce((sum, row) => sum + Number(row.efectivo || 0), 0);
  const totalTiendaGeneral = tiendaRowsWithData.reduce((sum, row) => sum + getTiendaRowTotal(row), 0);

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Reporte diario ${fecha}</title>
      <style>
        @page { size: portrait; margin: 10mm; }
        html, body, .page, table, th, td, .section-title, .summary-box {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body {
          font-family: ${PDF_FONT_FAMILY};
          color: #111827;
          margin: 0;
          background: #fff;
        }
        .page {
          padding: 10px 12px 18px;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          margin-bottom: 6px;
        }
        .brand {
          display: flex;
          align-items: center;
        }
        .brand img {
          width: 112px;
          height: 112px;
          object-fit: contain;
        }
        .top-info-row {
          position: relative;
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          gap: 16px;
          width: 100%;
          margin: 4px 0 8px;
          min-height: 36px;
        }
        .top-meta-row {
          display: flex;
          justify-content: flex-end;
          margin-left: auto;
          width: 100%;
        }
        .report-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          gap: 4px;
          margin-left: auto;
        }
        .report-date {
          font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
          font-weight: 600;
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
          font-size: 10px;
          line-height: 1.1;
          width: 100%;
          text-align: center;
        }
        .report-user {
          display: inline-block;
          background-color: #1f3f87;
          color: #fff;
          padding: 4px 24px;
          text-align: center;
          text-transform: uppercase;
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
          font-size: 10px;
          line-height: 1.1;
          border: none;
        }
        .liquidacion-wrap {
          margin: 0;
          text-align: center;
          position: absolute;
          left: 50%;
          bottom: 0;
          transform: translateX(-50%);
        }
        .liquidacion-row {
          background-color: #d90000;
          color: #fff;
          padding: 4px 10px;
          font-size: 11px;
          display: inline-block;
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
        }
        .liquidacion-label {
          letter-spacing: 0.2px;
        }
        .liquidacion-number {
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
        }
        .section-title, th, .summary-box h3, .summary-label, .summary-value {
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
        }
        .section {
          margin-top: 10px;
        }
        .section-title {
          background-color: #d90000;
          color: #fff;
          padding: 3px 10px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          text-align: center;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 10px;
        }
        thead tr:last-child th {
          border-bottom: 3px solid #fff !important;
        }
        tbody tr:first-child td {
          box-shadow: inset 0 1px 0 #000;
        }
        th, td {
          border: 1px solid #000;
          padding: 2px 5px;
          vertical-align: middle;
          text-align: center;
          word-break: break-word;
          background-color: #fff;
        }
        th {
          background-color: #1f3f87;
          color: #fff;
          text-align: center;
          text-transform: uppercase;
          border-left: none;
          border-right: none;
          border-top: none;
        }
        .compact-table th {
          white-space: nowrap;
          font-size: 8.5px;
          padding: 3px 4px;
        }
        .compact-table td {
          font-size: 8.5px;
        }
        .block-total-cell {
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
          color: #fff;
          text-align: center;
          white-space: nowrap;
          padding: 2px 6px;
          border: none !important;
        }
        .block-total-blue {
          background-color: #1f3f87 !important;
        }
        .block-total-red {
          background-color: #d90000 !important;
        }
        .block-total-empty {
          background-color: #fff !important;
          border: none !important;
        }
        .block-total-spacer td {
          height: 3px;
          padding: 0;
          background-color: #fff !important;
          border: none !important;
        }
        .tienda-table th {
          white-space: nowrap;
          font-size: 8.5px;
          padding: 3px 4px;
        }
        .tienda-table td {
          font-size: 8.5px;
        }
        .aligned-grid col:nth-child(1) { width: 8.5%; }
        .aligned-grid col:nth-child(2) { width: 6.5%; }
        .aligned-grid col:nth-child(3) { width: 11%; }
        .aligned-grid col:nth-child(4) { width: 12%; }
        .aligned-grid col:nth-child(5) { width: 9.5%; }
        .aligned-grid col:nth-child(6) { width: 9.5%; }
        .aligned-grid col:nth-child(7) { width: 9.5%; }
        .aligned-grid col:nth-child(8) { width: 9.5%; }
        .aligned-grid col:nth-child(9) { width: 11%; }
        .aligned-grid col:nth-child(10) { width: 13%; }
        .obs-span {
          padding-left: 8px;
          padding-right: 8px;
          text-align: left;
        }
        td.obs-cell {
          text-align: left;
        }
        @media print {
          html, body, .page, table, th, td, .section-title, .summary-box {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          th,
          .section-title {
            background-color: #d90000 !important;
            color: #fff !important;
          }
          th {
            background-color: #1f3f87 !important;
          }
        }
        td.num {
          text-align: center;
          white-space: nowrap;
        }
        td.center {
          text-align: center;
        }
        td.empty {
          text-align: center;
          color: #6b7280;
          padding: 10px 0;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          margin-top: 36px;
          width: 50%;
          min-width: 320px;
        }
        .summary-box {
          padding: 0;
          box-sizing: border-box;
          overflow: visible;
        }
        .summary-box h3 {
          margin: 0;
          padding: 3px 10px;
          font-size: 10px;
          text-transform: uppercase;
          text-align: center;
          color: #fff;
          background-color: #1f3f87;
          border-bottom: none;
          border: none;
        }
        .summary-spacer {
          height: 3px;
          background-color: #fff;
          border: none;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 3px 10px;
          border-left: 1px solid #000;
          border-right: 1px solid #000;
          border-top: 1px solid #000;
          font-size: 10px;
          background-color: #fff;
          text-transform: uppercase;
        }
        .summary-row:first-of-type {
          border-top: none;
        }
        .summary-row.before-total {
          border-bottom: 1px solid #000;
        }
        .summary-row.total {
          border: none;
          font-size: 10px;
          color: #fff;
          background-color: #d90000;
          font-family: ${PDF_FONT_BOLD_FAMILY};
          font-weight: 700;
        }
        .footer-note {
          margin-top: 8px;
          font-size: 10px;
          color: #4b5563;
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="brand">
            <img src="${LOGO_URL}" alt="Uniforma" />
          </div>
        </div>
        <div class="top-info-row">
          <div class="liquidacion-wrap">
            <div class="liquidacion-row"><span class="liquidacion-label">LIQUIDACIÓN No.:</span> <span class="liquidacion-number">${liquidacionNo || "-"}</span></div>
          </div>
          <div class="top-meta-row">
            <div class="report-meta">
              <div class="report-date">${formatDisplayDate(fecha)}</div>
              <div class="report-user">${generadoPor || "-"}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Capital / Mensajero</div>
          <table class="compact-table aligned-grid">
            <colgroup>
              <col /><col /><col /><col /><col /><col /><col /><col /><col /><col />
            </colgroup>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Envío</th>
                <th>Transferencia</th>
                <th>Autorización</th>
                <th>Depósito</th>
                <th>Boleta</th>
                <th>Banco</th>
                <th>Efectivo</th>
                <th>Total</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              ${buildRows(
                capitalRowsWithData
                  .map((row) => {
                    const total = Number(row.transferencia || 0) + Number(row.deposito || 0) + Number(row.efectivo || 0);
                    return `<tr>
                      <td class="center">${formatDisplayDate(row.fecha)}</td>
                      <td>${row.envio || ""}</td>
                      <td class="num">${money(row.transferencia)}</td>
                      <td>${row.autorizacion || ""}</td>
                      <td class="num">${money(row.deposito)}</td>
                      <td>${row.boleta || ""}</td>
                      <td>${row.banco || ""}</td>
                      <td class="num">${money(row.efectivo)}</td>
                      <td class="num">${money(total)}</td>
                      <td class="obs-cell">${row.observaciones || ""}</td>
                    </tr>`;
                  })
                  .join("")
              , 10)}
              <tr class="block-total-spacer">
                <td colspan="10"></td>
              </tr>
              <tr>
                <td class="block-total-empty"></td>
                <td class="block-total-empty"></td>
                <td class="block-total-cell block-total-blue">${money(totalCapitalTransferencia)}</td>
                <td class="block-total-empty"></td>
                <td class="block-total-cell block-total-blue">${money(totalCapitalDeposito)}</td>
                <td class="block-total-empty"></td>
                <td class="block-total-empty"></td>
                <td class="block-total-cell block-total-blue">${money(totalCapitalEfectivo)}</td>
                <td class="block-total-cell block-total-red">${money(totalCapitalGeneral)}</td>
                <td class="block-total-empty"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Departamentos / Cargo Expreso</div>
          <table class="compact-table aligned-grid">
            <colgroup>
              <col /><col /><col /><col /><col /><col /><col /><col /><col /><col />
            </colgroup>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Envío</th>
                <th>Transferencia</th>
                <th>Autorización</th>
                <th>Depósito</th>
                <th>Boleta</th>
                <th>Banco</th>
                <th>Total</th>
                <th colspan="2">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              ${buildRows(
                departamentoRowsWithData
                  .map((row) => {
                    const total = Number(row.transferencia || 0) + Number(row.deposito || 0);
                    return `<tr>
                      <td class="center">${formatDisplayDate(row.fecha)}</td>
                      <td>${row.envio || ""}</td>
                      <td class="num">${money(row.transferencia)}</td>
                      <td>${row.autorizacion || ""}</td>
                      <td class="num">${money(row.deposito)}</td>
                      <td>${row.boleta || ""}</td>
                      <td>${row.banco || ""}</td>
                      <td class="num">${money(total)}</td>
                      <td class="obs-span" colspan="2">${row.observaciones || ""}</td>
                    </tr>`;
                  })
                  .join("")
              , 10)}
              <tr class="block-total-spacer">
                <td colspan="10"></td>
              </tr>
              <tr>
                <td class="block-total-empty"></td>
                <td class="block-total-empty"></td>
                <td class="block-total-cell block-total-blue">${money(totalDepartamentoTransferencia)}</td>
                <td class="block-total-empty"></td>
                <td class="block-total-cell block-total-blue">${money(totalDepartamentoDeposito)}</td>
                <td class="block-total-empty"></td>
                <td class="block-total-empty"></td>
                <td class="block-total-cell block-total-red">${money(totalDepartamentoGeneral)}</td>
                <td class="block-total-empty" colspan="2"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Tienda</div>
          <table class="tienda-table aligned-grid">
            <colgroup>
              <col /><col /><col /><col /><col /><col /><col /><col /><col /><col />
            </colgroup>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Recibo</th>
                <th>Transferencia</th>
                <th>Autorización</th>
                <th>Tarjeta</th>
                <th>Autorización</th>
                <th>Efectivo</th>
                <th>Total</th>
                <th colspan="2">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              ${buildRows(
                tiendaRowsWithData
                  .map(
                    (row) => `<tr>
                      <td class="center">${formatDisplayDate(row.fecha)}</td>
                      <td>${row.recibo}</td>
                      <td class="num">${money(row.transferencia)}</td>
                      <td>${row.autorizacionTransferencia || ""}</td>
                      <td class="num">${money(row.tarjeta)}</td>
                      <td>${row.autorizacionTarjeta || ""}</td>
                      <td class="num">${money(row.efectivo)}</td>
                      <td class="num">${money(getTiendaRowTotal(row))}</td>
                      <td class="obs-span" colspan="2">${row.observaciones || ""}</td>
                    </tr>`
                  )
                  .join("")
              , 10)}
              <tr class="block-total-spacer">
                <td colspan="10"></td>
              </tr>
              <tr>
                <td class="block-total-empty"></td>
                <td class="block-total-empty"></td>
                <td class="block-total-cell block-total-blue">${money(totalTiendaTransferencia)}</td>
                <td class="block-total-empty"></td>
                <td class="block-total-cell block-total-blue">${money(totalTiendaTarjeta)}</td>
                <td class="block-total-empty"></td>
                <td class="block-total-cell block-total-blue">${money(totalTiendaEfectivo)}</td>
                <td class="block-total-cell block-total-red">${money(totalTiendaGeneral)}</td>
                <td class="block-total-empty" colspan="2"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="summary-grid">
          <div class="summary-box">
            <h3>Resumen</h3>
            <div class="summary-spacer"></div>
            <div class="summary-row"><span class="summary-label">CAPITAL</span><span class="summary-value">${money(subtotalCapital)}</span></div>
            <div class="summary-row"><span class="summary-label">DEPARTAMENTO</span><span class="summary-value">${money(subtotalDepartamento)}</span></div>
            <div class="summary-row before-total"><span class="summary-label">TIENDA</span><span class="summary-value">${money(subtotalTienda)}</span></div>
            <div class="summary-spacer"></div>
            <div class="summary-row total"><span class="summary-label">TOTAL</span><span class="summary-value">${money(totalResumen)}</span></div>
          </div>
        </div>

        <div class="footer-note">
          Generado desde Uniforma el ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}.
        </div>
      </div>
      <script>window.onload = function(){ window.print(); }</script>
    </body>
  </html>`;
};

export default function ReporteDiario() {
  const today = toDateOnly(new Date());
  const { nombre, primerNombre, primerApellido, usuario } = useAuthStore();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [fecha, setFecha] = useState(today);
  const [liquidacionNo, setLiquidacionNo] = useState("001");
  const [capitalRows, setCapitalRows] = useState<CapitalRow[]>(() => [createCapitalRow(today)]);
  const [departamentoRows, setDepartamentoRows] = useState<DepartamentoRow[]>(() => [createDepartamentoRow(today)]);
  const [tiendaManualRows, setTiendaManualRows] = useState<TiendaRow[]>(() => [createTiendaRow(today)]);
  const [loading, setLoading] = useState(false);

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
    void cargar();
  }, []);

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

  const imprimir = () => {
    const win = window.open("", "_blank");
    if (!win) {
      Swal.fire("Aviso", "Habilita ventanas emergentes para imprimir o guardar en PDF", "info");
      return;
    }

    const generadoPor =
      [primerNombre?.trim(), primerApellido?.trim()].filter(Boolean).join(" ") ||
      nombre?.trim() ||
      usuario?.trim() ||
      "Usuario";

    const html = buildReporteDiarioHtml({
      fecha,
      liquidacionNo,
      generadoPor,
      capitalRows,
      departamentoRows,
      tiendaRows,
      subtotalCapital,
      subtotalDepartamento,
      subtotalTienda,
      totalResumen,
    });

    win.document.write(html);
    win.document.close();
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">Reporte diario</Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RefreshOutlined />} variant="outlined" size="small" onClick={cargar} disabled={loading}>
            Recargar ventas
          </Button>
          <Button
            startIcon={<CleaningServicesOutlined />}
            variant="outlined"
            size="small"
            onClick={limpiarCapturas}
          >
            Limpiar capturas
          </Button>
          <Button
            startIcon={<PictureAsPdfOutlined />}
            variant="contained"
            color="secondary"
            size="small"
            onClick={imprimir}
          >
            Imprimir / PDF
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
            onChange={(e) => setFecha(e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField
            label="Liquidación No."
            fullWidth
            size="small"
            value={liquidacionNo}
            onChange={(e) => setLiquidacionNo(e.target.value)}
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
