import { PDF_FONT_FAMILY, PDF_FONT_SEMIBOLD_FAMILY } from "./fontFamily";

interface TrasladoPdfItem {
  codigo: string;
  nombre: string;
  tipo: string;
  genero: string;
  tela: string;
  talla: string;
  color: string;
  cantidad: number;
}

interface TrasladoPdfOptions {
  folio: string;
  fecha: Date;
  origen: string;
  destino: string;
  responsable: string;
  observaciones?: string | null;
  totalItems: number;
  logoUrl?: string;
  items: TrasladoPdfItem[];
}

const escapeHtml = (value: unknown) =>
  `${value ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatResponsable = (value: string) => {
  const limpio = `${value || ""}`.trim();
  if (!limpio) return "Responsable";

  const separadores = [" - ", " | ", " / "];
  for (const separador of separadores) {
    if (limpio.includes(separador)) {
      return limpio.split(separador)[0].trim() || limpio;
    }
  }

  return limpio;
};

export const buildTrasladoPdfHtml = ({
  folio,
  fecha,
  origen,
  destino,
  responsable,
  observaciones,
  totalItems,
  logoUrl,
  items,
}: TrasladoPdfOptions) => {
  const fechaDocumento = fecha.toLocaleDateString("es-GT");
  const horaDocumento = fecha.toLocaleTimeString("es-GT", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const responsableFormateado = formatResponsable(responsable);

  const filasHtml =
    items
      .map(
        (item, idx) => `<tr>
          <td class="cell-center">${idx + 1}</td>
          <td class="cell-center">${escapeHtml(item.codigo)}</td>
          <td>${escapeHtml(item.nombre)}</td>
          <td class="cell-center">${escapeHtml(item.tipo)}</td>
          <td class="cell-center">${escapeHtml(item.genero)}</td>
          <td class="cell-center">${escapeHtml(item.tela)}</td>
          <td class="cell-center">${escapeHtml(item.talla)}</td>
          <td class="cell-center">${escapeHtml(item.color)}</td>
          <td class="cell-center">${escapeHtml(item.cantidad)}</td>
        </tr>`,
      )
      .join("") ||
    `<tr><td colspan="9" class="empty-row">No hay articulos registrados en este traslado.</td></tr>`;

  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Traslado ${escapeHtml(folio)}</title>
        <style>
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: letter landscape; margin: 12mm; }
          body {
            margin: 0;
            font-family: ${PDF_FONT_FAMILY};
            color: #0f172a;
            background: #ffffff;
          }
          .page {
            width: 100%;
            padding: 4px 4px 0;
          }
          .header {
            display: grid;
            grid-template-columns: 92px 1fr 170px;
            align-items: start;
            gap: 12px;
            margin-bottom: 10px;
          }
          .logo-wrap {
            display: flex;
            align-items: flex-start;
            justify-content: flex-start;
            min-height: 92px;
          }
          .logo {
            width: 74px;
            height: 74px;
            object-fit: contain;
          }
          .logo-fallback {
            display: none;
            width: 74px;
            height: 74px;
            border: 2px solid #173a7d;
            border-radius: 50%;
            align-items: center;
            justify-content: center;
            text-align: center;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
            color: #173a7d;
            font-size: 13px;
            line-height: 1.2;
          }
          .title-block {
            text-align: center;
            padding-top: 8px;
          }
          .title {
            margin: 0;
            color: #173a7d;
            font-size: 28px;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
            letter-spacing: 0.5px;
          }
          .title span {
            color: #d60000;
          }
          .subtitle {
            margin-top: 6px;
            color: #475569;
            font-size: 12px;
            letter-spacing: 0.4px;
          }
          .date-block {
            text-align: right;
            padding-top: 6px;
            font-size: 12px;
          }
          .date-block .date {
            font-size: 16px;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
            color: #000000;
          }
          .date-block .time {
            margin-top: 4px;
            color: #475569;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
          }
          .section-title {
            margin: 4px 0 10px;
            text-align: center;
            color: #d60000;
            font-size: 17px;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
            letter-spacing: 0.4px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin: 0 auto 16px;
            max-width: 860px;
          }
          .summary-card {
            border: 1px solid #000000;
            background: #ffffff;
          }
          .summary-label {
            padding: 7px 11px;
            color: #ffffff;
            font-size: 10px;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
            letter-spacing: 0.6px;
            text-transform: uppercase;
          }
          .summary-label.blue { background: #173a7d; }
          .summary-label.red { background: #ff2a12; }
          .summary-value {
            min-height: 34px;
            padding: 8px 11px;
            font-size: 12px;
            font-weight: 400;
            color: #0f172a;
            display: flex;
            align-items: center;
            line-height: 1.25;
          }
          .summary-value.small {
            font-size: 11px;
            font-weight: 400;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 12px;
          }
          thead th {
            background: #1a3e84;
            color: #ffffff;
            font-size: 11px;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            padding: 9px 8px;
            text-align: center;
            border: 0;
          }
          tbody td {
            border: 0.8px solid #000000;
            padding: 10px 8px;
            vertical-align: middle;
            background: #ffffff;
            word-break: break-word;
          }
          .cell-center { text-align: center; }
          .empty-row {
            text-align: center;
            color: #475569;
            padding: 16px 10px;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
          }
          .totals-wrap {
            display: flex;
            justify-content: flex-end;
            margin-top: 12px;
          }
          .totals-box {
            width: 320px;
            border: 1px solid #000000;
            background: #ffffff;
          }
          .totals-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 10px 12px;
            border-bottom: 0.8px solid #000000;
            font-size: 13px;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
          }
          .totals-row:last-child { border-bottom: 0; }
          .totals-row.total {
            background: #173a7d;
            color: #ffffff;
            font-size: 15px;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
          }
          .amount {
            color: #d60000;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
          }
          .totals-row.total .amount {
            color: #ffffff;
          }
          .footer-note {
            margin-top: 10px;
            color: #475569;
            font-size: 11px;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div class="logo-wrap">
              ${
                logoUrl
                  ? `<img class="logo" src="${logoUrl}" alt="Uniforma" onerror="this.style.display='none';document.getElementById('logo-fallback').style.display='flex';" />`
                  : ""
              }
              <div id="logo-fallback" class="logo-fallback" style="${logoUrl ? "" : "display:flex;"}">UNIFORMA</div>
            </div>
            <div class="title-block">
              <h1 class="title">TRASLADO No.: <span>${escapeHtml(folio)}</span></h1>
              <div class="subtitle">Comprobante de traslado entre bodegas</div>
            </div>
            <div class="date-block">
              <div class="date">${escapeHtml(fechaDocumento)}</div>
              <div class="time">${escapeHtml(horaDocumento)}</div>
            </div>
          </div>

          <div class="section-title">DATOS DEL TRASLADO</div>

          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-label blue">Bodega origen</div>
              <div class="summary-value small">${escapeHtml(origen || "N/D")}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label red">Bodega destino</div>
              <div class="summary-value small">${escapeHtml(destino || "N/D")}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label blue">Responsable</div>
              <div class="summary-value">${escapeHtml(responsableFormateado)}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label red">Observaciones</div>
              <div class="summary-value small">${escapeHtml(observaciones || "Sin observaciones")}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 44px;">#</th>
                <th style="width: 92px;">Codigo</th>
                <th style="width: 180px;">Producto</th>
                <th style="width: 90px;">Tipo</th>
                <th style="width: 90px;">Genero</th>
                <th style="width: 90px;">Tela</th>
                <th style="width: 80px;">Talla</th>
                <th style="width: 100px;">Color</th>
                <th style="width: 72px;">Cant</th>
              </tr>
            </thead>
            <tbody>
              ${filasHtml}
            </tbody>
          </table>

          <div class="totals-wrap">
            <div class="totals-box">
              <div class="totals-row total">
                <span>Total trasladado</span>
                <span class="amount">${escapeHtml(totalItems)}</span>
              </div>
            </div>
          </div>

          <div class="footer-note">Documento generado automaticamente por Uniforma.</div>
        </div>
        <script>
          window.onload = function() {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>`;
};
