import { PDF_FONT_FAMILY, PDF_FONT_SEMIBOLD_FAMILY } from "./fontFamily";
import { formatCurrency } from "./currency";

export interface VentaPdfBordado {
  monto?: number | null;
  color?: string | null;
  tamano?: string | null;
  posicion?: string | null;
  observaciones?: string | null;
  fechaEntrega?: string | null;
}

export interface VentaPdfItem {
  codigo: string;
  nombre: string;
  cantidad: number;
  precio: number;
  bordado: number;
  bordados?: VentaPdfBordado[];
  bordadoColor?: string | null;
  bordadoTamano?: string | null;
  bordadoPosicion?: string | null;
  bordadoObservaciones?: string | null;
  bordadoFechaEntrega?: string | null;
  estiloEspecial?: boolean;
  estiloEspecialMonto?: number;
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
  envio?: number;
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

const formatMoney = formatCurrency;

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

const normalizarBordados = (item: VentaPdfItem): VentaPdfBordado[] => {
  if (Array.isArray(item.bordados) && item.bordados.length) {
    return item.bordados.filter((bordado) =>
      Boolean(
        Number(bordado?.monto || 0) ||
          bordado?.color ||
          bordado?.tamano ||
          bordado?.posicion ||
          bordado?.observaciones ||
          bordado?.fechaEntrega,
      ),
    );
  }

  if (
    Number(item.bordado || 0) ||
    item.bordadoColor ||
    item.bordadoTamano ||
    item.bordadoPosicion ||
    item.bordadoObservaciones ||
    item.bordadoFechaEntrega
  ) {
    return [
      {
        monto: item.bordado,
        color: item.bordadoColor,
        tamano: item.bordadoTamano,
        posicion: item.bordadoPosicion,
        observaciones: item.bordadoObservaciones,
        fechaEntrega: item.bordadoFechaEntrega,
      },
    ];
  }

  return [];
};

const renderBordadosDetalle = (item: VentaPdfItem) => {
  const bordados = normalizarBordados(item);
  if (!bordados.length) return "";

  return bordados
    .map((bordado, index) => {
      const descripcion = [bordado.posicion, bordado.color, bordado.tamano].filter(Boolean).join(" / ");
      const observaciones = bordado.observaciones ? ` - ${bordado.observaciones}` : "";
      return `<div class="item-note">Bordado ${index + 1}: ${escapeHtml(descripcion || "Detalle")}${escapeHtml(
        observaciones,
      )}</div>`;
    })
    .join("");
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
  envio = 0,
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
  const totalArticulos = items.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);

  const filasHtml =
    items
      .map((item) => {
        const extras = Number(item.bordado || 0) + (item.estiloEspecial ? Number(item.estiloEspecialMonto || 0) : 0);
        return `<tr>
          <td class="cell-center">${escapeHtml(item.cantidad)}</td>
          <td>
            <div class="item-name">${escapeHtml(item.nombre)}</div>
            <div class="item-code">${escapeHtml(item.codigo)}</div>
            ${renderBordadosDetalle(item)}
          </td>
          <td class="cell-right">${formatMoney(item.precio)}</td>
          <td class="cell-right">${extras ? formatMoney(extras) : "-"}</td>
          <td class="cell-center">${Number(item.descuento || 0) ? `${Number(item.descuento || 0).toFixed(2)}%` : "-"}</td>
          <td class="cell-right amount-dark">${formatMoney(item.subtotal)}</td>
        </tr>`;
      })
      .join("") ||
    `<tr><td colspan="6" class="empty-row">No hay articulos registrados en esta venta.</td></tr>`;

  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Venta ${escapeHtml(folio)}</title>
        <style>
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: letter portrait; margin: 12mm; }
          body {
            margin: 0;
            font-family: ${PDF_FONT_FAMILY};
            color: #0f172a;
            background: #ffffff;
          }
          .page {
            width: 100%;
            padding: 0;
          }
          .header {
            display: grid;
            grid-template-columns: 82px 1fr 132px;
            align-items: start;
            gap: 10px;
            margin-bottom: 10px;
          }
          .logo {
            width: 66px;
            height: 66px;
            object-fit: contain;
          }
          .logo-fallback {
            display: none;
            width: 66px;
            height: 66px;
            border: 2px solid #173a7d;
            border-radius: 50%;
            align-items: center;
            justify-content: center;
            text-align: center;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
            color: #173a7d;
            font-size: 11px;
            line-height: 1.15;
          }
          .title-block {
            text-align: center;
            padding-top: 4px;
          }
          .title {
            margin: 0;
            color: #173a7d;
            font-size: 20px;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
            letter-spacing: 0.2px;
          }
          .folio {
            margin-top: 4px;
            color: #d60000;
            font-size: 16px;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
          }
          .date-block {
            text-align: right;
            padding-top: 4px;
            font-size: 10px;
            color: #475569;
          }
          .date-block .date {
            font-size: 13px;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
            color: #000000;
          }
          .section-title {
            margin: 8px 0 7px;
            padding: 5px 8px;
            text-align: center;
            background: #d60000;
            color: #ffffff;
            font-size: 12px;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
            letter-spacing: 0.35px;
            text-transform: uppercase;
          }
          .info-box {
            border: 1px solid #000000;
            padding: 8px 10px;
            margin-bottom: 10px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px 14px;
            font-size: 10.5px;
            line-height: 1.25;
          }
          .label {
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
            color: #000000;
          }
          .value {
            color: #0f172a;
            word-break: break-word;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 10.5px;
          }
          thead th {
            background: #1a3e84;
            color: #ffffff;
            font-size: 9.5px;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
            text-transform: uppercase;
            padding: 7px 6px;
            text-align: center;
            border: 0.8px solid #1a3e84;
          }
          tbody td {
            border: 0.8px solid #000000;
            padding: 7px 6px;
            vertical-align: middle;
            background: #ffffff;
            word-break: break-word;
          }
          .item-name {
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
            color: #0f172a;
            line-height: 1.25;
          }
          .item-code {
            margin-top: 2px;
            color: #64748b;
            font-size: 9px;
          }
          .item-note {
            margin-top: 3px;
            color: #d60000;
            font-size: 9px;
            line-height: 1.2;
          }
          .cell-center { text-align: center; }
          .cell-right { text-align: right; }
          .amount-dark {
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
          }
          .empty-row {
            text-align: center;
            color: #475569;
            padding: 14px 10px;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
          }
          .totals-wrap {
            display: flex;
            justify-content: flex-end;
            margin-top: 10px;
          }
          .totals-box {
            width: 270px;
            border: 1px solid #000000;
            background: #ffffff;
          }
          .totals-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 7px 10px;
            border-bottom: 0.8px solid #000000;
            font-size: 11px;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
            color: #000000;
          }
          .totals-row:last-child { border-bottom: 0; }
          .totals-row.total {
            background: #d60000;
            color: #ffffff;
            font-size: 14px;
          }
          .totals-row.total .amount { color: #ffffff; }
          .amount {
            color: #000000;
            font-family: ${PDF_FONT_SEMIBOLD_FAMILY};
            font-weight: 600;
          }
          .footer-note {
            margin-top: 10px;
            padding-top: 7px;
            border-top: 1px solid #cbd5e1;
            color: #475569;
            font-size: 9px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div>
              ${
                logoUrl
                  ? `<img class="logo" src="${logoUrl}" alt="Uniforma" onerror="this.style.display='none';document.getElementById('logo-fallback').style.display='flex';" />`
                  : ""
              }
              <div id="logo-fallback" class="logo-fallback" style="${logoUrl ? "" : "display:flex;"}">UNIFORMA</div>
            </div>

            <div class="title-block">
              <h1 class="title">Comprobante de venta</h1>
              <div class="folio">${escapeHtml(folio)}</div>
            </div>

            <div class="date-block">
              <div class="date">${escapeHtml(fechaDocumento)}</div>
              <div>${escapeHtml(horaDocumento)}</div>
            </div>
          </div>

          <div class="info-box">
            <div class="info-grid">
              <div><span class="label">Cliente: </span><span class="value">${escapeHtml(clienteFormateado)}</span></div>
              <div><span class="label">Vendedor: </span><span class="value">${escapeHtml(vendedorFormateado)}</span></div>
              <div><span class="label">Tienda: </span><span class="value">${escapeHtml(bodegaFormateada)}</span></div>
              <div><span class="label">Ubicacion: </span><span class="value">${escapeHtml(ubicacionFormateada)}</span></div>
              <div><span class="label">Pago: </span><span class="value">${escapeHtml(metodoFormateado)}</span></div>
              <div><span class="label">Referencia: </span><span class="value">${escapeHtml(referenciaFormateada)}</span></div>
            </div>
          </div>

          <div class="section-title">Detalle</div>
          <table>
            <thead>
              <tr>
                <th style="width: 44px;">Cant.</th>
                <th>Articulo</th>
                <th style="width: 78px;">Precio</th>
                <th style="width: 74px;">Extras</th>
                <th style="width: 58px;">Desc.</th>
                <th style="width: 86px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${filasHtml}
            </tbody>
          </table>

          <div class="totals-wrap">
            <div class="totals-box">
              <div class="totals-row">
                <span>Articulos</span>
                <span class="amount">${escapeHtml(totalArticulos)}</span>
              </div>
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
              ${
                envio
                  ? `<div class="totals-row">
                      <span>Envio</span>
                      <span class="amount">${formatMoney(envio)}</span>
                    </div>`
                  : ""
              }
              <div class="totals-row total">
                <span>Total</span>
                <span class="amount">${formatMoney(total)}</span>
              </div>
            </div>
          </div>

          <div class="footer-note">Gracias por su compra. Documento generado automaticamente por Uniforma.</div>
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
