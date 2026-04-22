export interface VentaPdfItem {
  codigo: string;
  nombre: string;
  cantidad: number;
  precio: number;
  bordado: number;
  descuento: number;
  subtotal: number;
}

interface VentaPdfOptions {
  folio: string;
  fecha: Date;
  cliente: string;
  metodoPago: string;
  referenciaPago?: string | null;
  bodega: string;
  ubicacion: string;
  vendedor: string;
  subtotal: number;
  recargo: number;
  total: number;
  recargoEtiqueta?: string;
  logoUrl?: string;
  items: VentaPdfItem[];
}

const escapeHtml = (value: unknown) =>
  `${value ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatMoney = (value: number) => `Q ${Number(value || 0).toFixed(2)}`;

const formatVendedorNombre = (value: string) => {
  const limpio = `${value || ""}`.trim();
  if (!limpio) return "Vendedor";

  const separadores = [" - ", " | ", " / "];
  for (const separador of separadores) {
    if (limpio.includes(separador)) {
      return limpio.split(separador)[0].trim() || limpio;
    }
  }

  return limpio;
};

export const buildVentaPdfHtml = ({
  folio,
  fecha,
  cliente,
  metodoPago,
  referenciaPago,
  bodega,
  ubicacion,
  vendedor,
  subtotal,
  recargo,
  total,
  recargoEtiqueta,
  logoUrl,
  items,
}: VentaPdfOptions) => {
  const fechaDocumento = fecha.toLocaleDateString("es-GT");
  const horaDocumento = fecha.toLocaleTimeString("es-GT", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const vendedorFormateado = formatVendedorNombre(vendedor);

  const filasHtml =
    items
      .map(
        (item, idx) => `<tr>
          <td class="cell-center">${idx + 1}</td>
          <td class="cell-center">${escapeHtml(item.codigo)}</td>
          <td>${escapeHtml(item.nombre)}</td>
          <td class="cell-center">${escapeHtml(item.cantidad)}</td>
          <td class="cell-right">${formatMoney(item.precio)}</td>
          <td class="cell-right">${formatMoney(item.bordado)}</td>
          <td class="cell-center">${Number(item.descuento || 0).toFixed(2)}%</td>
          <td class="cell-right">${formatMoney(item.subtotal)}</td>
        </tr>`,
      )
      .join("") ||
    `<tr><td colspan="8" class="empty-row">No hay articulos registrados en esta venta.</td></tr>`;

  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Venta ${escapeHtml(folio)}</title>
        <style>
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: letter; margin: 12mm; }
          body {
            margin: 0;
            font-family: Arial, Helvetica, sans-serif;
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
            width: 86px;
            height: 86px;
            object-fit: contain;
          }
          .logo-fallback {
            display: none;
            width: 86px;
            height: 86px;
            border: 2px solid #173a7d;
            border-radius: 50%;
            align-items: center;
            justify-content: center;
            text-align: center;
            font-weight: 800;
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
            font-weight: 800;
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
            font-weight: 800;
            color: #000000;
          }
          .date-block .time {
            margin-top: 4px;
            color: #475569;
            font-weight: 600;
          }
          .section-title {
            margin: 4px 0 10px;
            text-align: center;
            color: #d60000;
            font-size: 17px;
            font-weight: 800;
            letter-spacing: 0.4px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin: 0 auto 16px;
            max-width: 780px;
          }
          .summary-card {
            border: 1px solid #000000;
            background: #ffffff;
          }
          .summary-label {
            padding: 7px 11px;
            color: #ffffff;
            font-size: 10px;
            font-weight: 800;
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
            font-weight: 800;
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
          tbody tr:first-child td {
            border-top-width: 0.8px;
          }
          .cell-center { text-align: center; }
          .cell-right { text-align: right; }
          .empty-row {
            text-align: center;
            color: #475569;
            padding: 16px 10px;
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
            font-weight: 700;
          }
          .totals-row:last-child { border-bottom: 0; }
          .totals-row.total {
            background: #173a7d;
            color: #ffffff;
            font-size: 15px;
            font-weight: 800;
          }
          .totals-row.total .amount {
            color: #ffffff;
          }
          .amount {
            color: #d60000;
            font-weight: 800;
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
              <h1 class="title">VENTA No.: <span>${escapeHtml(folio)}</span></h1>
              <div class="subtitle">Comprobante de venta</div>
            </div>
            <div class="date-block">
              <div class="date">${escapeHtml(fechaDocumento)}</div>
              <div class="time">${escapeHtml(horaDocumento)}</div>
            </div>
          </div>

          <div class="section-title">DATOS DE LA VENTA</div>

          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-label blue">Cliente</div>
              <div class="summary-value">${escapeHtml(cliente || "CF")}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label red">Vendedor</div>
              <div class="summary-value">${escapeHtml(vendedorFormateado)}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label blue">Bodega / Tienda</div>
              <div class="summary-value small">${escapeHtml(bodega || "N/D")}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label red">Ubicacion</div>
              <div class="summary-value">${escapeHtml(ubicacion || "N/D")}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label blue">Metodo de pago</div>
              <div class="summary-value">${escapeHtml(metodoPago || "N/D")}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label red">Referencia</div>
              <div class="summary-value small">${escapeHtml(referenciaPago || "No aplica")}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 44px;">#</th>
                <th style="width: 88px;">Codigo</th>
                <th>Producto</th>
                <th style="width: 62px;">Cant</th>
                <th style="width: 96px;">Precio</th>
                <th style="width: 96px;">Bordado</th>
                <th style="width: 84px;">Desc.</th>
                <th style="width: 108px;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${filasHtml}
            </tbody>
          </table>

          <div class="totals-wrap">
            <div class="totals-box">
              <div class="totals-row">
                <span>Subtotal</span>
                <span class="amount">${formatMoney(subtotal)}</span>
              </div>
              ${
                recargo
                  ? `<div class="totals-row">
                      <span>${escapeHtml(recargoEtiqueta || "Recargo")}</span>
                      <span class="amount">${formatMoney(recargo)}</span>
                    </div>`
                  : ""
              }
              <div class="totals-row total">
                <span>Total</span>
                <span class="amount">${formatMoney(total)}</span>
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
