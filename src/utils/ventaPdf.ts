import { PDF_FONT_FAMILY, PDF_FONT_SEMIBOLD_FAMILY } from "./fontFamily";

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
  const referenciaFormateada = referenciaPago && `${referenciaPago}`.trim() ? referenciaPago : "No aplica";
  const metodoFormateado = metodoPago || "N/D";
  const clienteFormateado = cliente || "CF";
  const bodegaFormateada = bodega || "N/D";
  const ubicacionFormateada = ubicacion || "N/D";

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
            grid-template-columns: minmax(0, 1.35fr) 290px;
            align-items: start;
            gap: 20px;
            margin-bottom: 16px;
          }
          .header-left {
            min-width: 0;
          }
          .doc-title {
            margin: 0 0 14px;
            text-align: center;
            color: #000000;
            font-size: 20px;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
            letter-spacing: 0.3px;
          }
          .header-section {
            margin-bottom: 16px;
          }
          .section-heading {
            margin: 0 0 6px;
            text-align: center;
            color: #000000;
            font-size: 14px;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
            letter-spacing: 0.3px;
          }
          .section-name {
            margin: 0 0 10px;
            text-align: center;
            color: #000000;
            font-size: 15px;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
            line-height: 1.25;
          }
          .data-lines {
            display: grid;
            gap: 5px;
          }
          .data-line {
            display: grid;
            grid-template-columns: 155px 1fr;
            gap: 8px;
            align-items: start;
            font-size: 12px;
            line-height: 1.25;
          }
          .data-label {
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
            color: #000000;
          }
          .data-value {
            color: #0f172a;
            word-break: break-word;
          }
          .header-right {
            min-width: 0;
          }
          .logo-wrap {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            min-height: 106px;
            margin-bottom: 14px;
          }
          .logo {
            width: 168px;
            max-width: 100%;
            height: auto;
            object-fit: contain;
          }
          .logo-fallback {
            display: none;
            width: 168px;
            min-height: 62px;
            align-items: center;
            justify-content: center;
            text-align: center;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
            color: #173a7d;
            font-size: 18px;
            border: 2px solid #173a7d;
            border-radius: 14px;
          }
          .doc-box {
            padding-left: 10px;
          }
          .doc-box-title {
            margin: 0 0 8px;
            color: #000000;
            font-size: 18px;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
          }
          .doc-lines {
            display: grid;
            gap: 5px;
          }
          .doc-line {
            display: grid;
            grid-template-columns: 120px 1fr;
            gap: 8px;
            align-items: start;
            font-size: 12px;
            line-height: 1.25;
          }
          .doc-label {
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
            color: #000000;
          }
          .doc-value {
            color: #0f172a;
            word-break: break-word;
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
          tbody tr:first-child td {
            border-top-width: 0.8px;
          }
          .cell-center { text-align: center; }
          .cell-right { text-align: right; }
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
            color: #000000;
          }
          .totals-row:last-child { border-bottom: 0; }
          .totals-row.total {
            background: #ffffff;
            color: #000000;
            font-size: 13px;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
          }
          .totals-row.total .amount {
            color: #000000;
          }
          .amount {
            color: #000000;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
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
            <div class="header-left">
              <h1 class="doc-title">DOCUMENTO DE VENTA</h1>

              <div class="header-section">
                <div class="section-heading">DATOS DEL VENDEDOR</div>
                <div class="section-name">${escapeHtml(vendedorFormateado)}</div>
                <div class="data-lines">
                  <div class="data-line">
                    <div class="data-label">Bodega / tienda:</div>
                    <div class="data-value">${escapeHtml(bodegaFormateada)}</div>
                  </div>
                  <div class="data-line">
                    <div class="data-label">Ubicacion:</div>
                    <div class="data-value">${escapeHtml(ubicacionFormateada)}</div>
                  </div>
                  <div class="data-line">
                    <div class="data-label">Metodo de pago:</div>
                    <div class="data-value">${escapeHtml(metodoFormateado)}</div>
                  </div>
                  <div class="data-line">
                    <div class="data-label">Referencia:</div>
                    <div class="data-value">${escapeHtml(referenciaFormateada)}</div>
                  </div>
                </div>
              </div>

              <div class="header-section">
                <div class="section-heading">DATOS DEL COMPRADOR</div>
                <div class="data-lines">
                  <div class="data-line">
                    <div class="data-label">Cliente:</div>
                    <div class="data-value">${escapeHtml(clienteFormateado)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="header-right">
              <div class="logo-wrap">
                ${
                  logoUrl
                    ? `<img class="logo" src="${logoUrl}" alt="Uniforma" onerror="this.style.display='none';document.getElementById('logo-fallback').style.display='flex';" />`
                    : ""
                }
                <div id="logo-fallback" class="logo-fallback" style="${logoUrl ? "" : "display:flex;"}">UNIFORMA</div>
              </div>

              <div class="doc-box">
                <div class="doc-box-title">VENTA</div>
                <div class="doc-lines">
                  <div class="doc-line">
                    <div class="doc-label">Numero:</div>
                    <div class="doc-value">${escapeHtml(folio)}</div>
                  </div>
                  <div class="doc-line">
                    <div class="doc-label">Fecha:</div>
                    <div class="doc-value">${escapeHtml(fechaDocumento)}</div>
                  </div>
                  <div class="doc-line">
                    <div class="doc-label">Hora:</div>
                    <div class="doc-value">${escapeHtml(horaDocumento)}</div>
                  </div>
                  <div class="doc-line">
                    <div class="doc-label">Moneda:</div>
                    <div class="doc-value">GTQ</div>
                  </div>
                </div>
              </div>
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
