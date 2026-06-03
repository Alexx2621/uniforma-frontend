import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import uniformaLogo from "../assets/3-logos.png";

export interface ProduccionArticuloUnificadoPdf {
  tipo: string;
  genero: string;
  tela: string;
  talla: string;
  color: string;
  descripcion: string;
  cantidad: number;
}

export interface ProduccionDetallePedidoPdf extends ProduccionArticuloUnificadoPdf {
  orden: string;
  usuario: string;
  codigo?: string;
  nombre?: string;
}

const normalizeDateKey = (value: unknown) => {
  const raw = `${value || ""}`.trim();
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)?.[0];
  if (dateOnly) return dateOnly;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateKey = (value: string) => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("es-GT");
};

const formatPedidoDateRange = (values: unknown[] = []) => {
  const dates = Array.from(new Set(values.map(normalizeDateKey).filter(Boolean))).sort();
  if (!dates.length) return "-";
  if (dates.length === 1) return formatDateKey(dates[0]);
  return `${formatDateKey(dates[0])} - ${formatDateKey(dates[dates.length - 1])}`;
};

const loadImageAsDataUrl = async (src: string) =>
  new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo preparar el logo"));
          return;
        }
        ctx.drawImage(image, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error("No se pudo cargar el logo"));
    image.src = src;
  });

export const descargarProduccionUnificadoPdf = async ({
  articulos,
  fileName,
  pedidoNo,
  filtroTienda,
  totalPedidos,
  fechasPedidos = [],
}: {
  articulos: ProduccionArticuloUnificadoPdf[];
  fileName: string;
  pedidoNo: string;
  filtroTienda: string;
  totalPedidos: number;
  fechasPedidos?: unknown[];
}) => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "letter",
  });
  const pageWidth = doc.internal.pageSize.getWidth();

  const fechaGeneracion = new Date();
  const fechaImpresion = fechaGeneracion.toLocaleDateString("es-GT");
  const fechaPedidos = formatPedidoDateRange(fechasPedidos);
  const logoDataUrl = await loadImageAsDataUrl(uniformaLogo);

  doc.addImage(logoDataUrl, "PNG", 4, 4, 24, 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(23);
  doc.setTextColor(20, 55, 125);
  const titleLabel = "PEDIDO No.:";
  const titleY = 14;
  const titleWidth = doc.getTextWidth(titleLabel);
  doc.setFontSize(23);
  doc.setTextColor(214, 0, 0);
  const correlativoWidth = doc.getTextWidth(` ${pedidoNo}`);
  const titleStartX = (pageWidth - (titleWidth + correlativoWidth)) / 2;

  doc.setTextColor(20, 55, 125);
  doc.text(titleLabel, titleStartX, titleY);
  doc.setTextColor(214, 0, 0);
  doc.text(` ${pedidoNo}`, titleStartX + titleWidth, titleY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`Fecha pedidos: ${fechaPedidos}`, pageWidth - 6, 10, { align: "right" });
  doc.text(`Fecha impresion: ${fechaImpresion}`, pageWidth - 6, 16, { align: "right" });

  doc.setFontSize(17);
  doc.setTextColor(214, 0, 0);
  doc.text("VENDEDOR", pageWidth / 2, 33, { align: "center" });

  const sellerBoxY = 37;
  const sellerBoxHeight = 15;
  const sellerLeftWidth = 50;
  const sellerRightWidth = 45;
  const sellerLeftX = (pageWidth - (sellerLeftWidth + sellerRightWidth)) / 2;
  doc.setFillColor(18, 48, 114);
  doc.rect(sellerLeftX, sellerBoxY, sellerLeftWidth, sellerBoxHeight, "F");
  doc.setFillColor(255, 32, 10);
  doc.rect(sellerLeftX + sellerLeftWidth, sellerBoxY, sellerRightWidth, sellerBoxHeight, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.4);
  doc.setTextColor(255, 255, 255);
  doc.text(filtroTienda.toUpperCase(), sellerLeftX + sellerLeftWidth / 2, sellerBoxY + 9.5, { align: "center" });
  doc.text("RECIBIDO CONFORME", sellerLeftX + sellerLeftWidth + sellerRightWidth / 2, sellerBoxY + 9.5, {
    align: "center",
  });

  autoTable(doc, {
    startY: 61,
    theme: "grid",
    head: [["CANT", "PEDIDO", "TELA", "COLOR", "TALLA", "SEXO", "OBSERVACIONES"]],
    body: articulos.length
      ? articulos.map((item) => [
          item.cantidad,
          item.tipo,
          item.tela,
          item.color,
          item.talla,
          item.genero,
          item.descripcion === "N/D" ? "" : item.descripcion,
        ])
      : [["-", "No hay articulos detallados en los pedidos seleccionados", "", "", "", "", ""]],
    styles: {
      fontSize: 8.7,
      cellPadding: { top: 2.8, right: 2.4, bottom: 2.8, left: 2.4 },
      minCellHeight: 13,
      halign: "center",
      valign: "middle",
      lineColor: [0, 0, 0],
      lineWidth: 0.08,
      textColor: [0, 0, 0],
      overflow: "linebreak",
      fillColor: [255, 255, 255],
      fontStyle: "normal",
    },
    headStyles: {
      fillColor: [26, 62, 132],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 11.2,
      lineColor: [0, 0, 0],
      lineWidth: 0,
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.08,
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 16 },
      1: { cellWidth: 39 },
      2: { cellWidth: 24 },
      3: { cellWidth: 31, overflow: "linebreak" },
      4: { cellWidth: 42, overflow: "linebreak" },
      5: { cellWidth: 25, overflow: "linebreak" },
      6: { cellWidth: "auto", halign: "left", overflow: "linebreak" },
    },
    margin: { left: 4, right: 4 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 61;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(75, 85, 99);
  doc.text(
    `Generado con ${totalPedidos} pedidos visibles y filtro de tienda: ${filtroTienda}.`,
    4,
    Math.min(finalY + 8, 205)
  );

  doc.save(fileName);
};

export const descargarProduccionDetallePedidosPdf = async ({
  articulos,
  fileName,
  titulo = "DETALLE DE PEDIDOS",
  filtroTienda,
  totalPedidos,
  fechasPedidos = [],
}: {
  articulos: ProduccionDetallePedidoPdf[];
  fileName: string;
  titulo?: string;
  filtroTienda: string;
  totalPedidos: number;
  fechasPedidos?: unknown[];
}) => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "letter",
  });
  const pageWidth = doc.internal.pageSize.getWidth();

  const fechaGeneracion = new Date();
  const fechaImpresion = fechaGeneracion.toLocaleDateString("es-GT");
  const fechaPedidos = formatPedidoDateRange(fechasPedidos);
  const logoDataUrl = await loadImageAsDataUrl(uniformaLogo);

  doc.addImage(logoDataUrl, "PNG", 4, 4, 24, 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.setTextColor(20, 55, 125);
  doc.text(titulo, pageWidth / 2, 14, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`Fecha pedidos: ${fechaPedidos}`, pageWidth - 6, 10, { align: "right" });
  doc.text(`Fecha impresion: ${fechaImpresion}`, pageWidth - 6, 16, { align: "right" });

  doc.setFontSize(17);
  doc.setTextColor(214, 0, 0);
  doc.text("PRODUCCION", pageWidth / 2, 33, { align: "center" });

  const sellerBoxY = 37;
  const sellerBoxHeight = 15;
  const sellerLeftWidth = 66;
  const sellerRightWidth = 49;
  const sellerLeftX = (pageWidth - (sellerLeftWidth + sellerRightWidth)) / 2;
  doc.setFillColor(18, 48, 114);
  doc.rect(sellerLeftX, sellerBoxY, sellerLeftWidth, sellerBoxHeight, "F");
  doc.setFillColor(255, 32, 10);
  doc.rect(sellerLeftX + sellerLeftWidth, sellerBoxY, sellerRightWidth, sellerBoxHeight, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.8);
  doc.setTextColor(255, 255, 255);
  doc.text(filtroTienda.toUpperCase(), sellerLeftX + sellerLeftWidth / 2, sellerBoxY + 9.5, { align: "center" });
  doc.text(`${totalPedidos} PEDIDO(S)`, sellerLeftX + sellerLeftWidth + sellerRightWidth / 2, sellerBoxY + 9.5, {
    align: "center",
  });

  autoTable(doc, {
    startY: 61,
    theme: "grid",
    head: [["CANT", "ORDEN", "USUARIO", "PRENDA", "TELA", "COLOR", "TALLA", "SEXO", "OBSERVACIONES"]],
    body: articulos.length
      ? articulos.map((item) => [
          item.cantidad,
          item.orden,
          item.usuario,
          item.tipo,
          item.tela,
          item.color,
          item.talla,
          item.genero,
          item.descripcion === "N/D" ? "" : item.descripcion,
        ])
      : [["-", "No hay articulos detallados en los pedidos seleccionados", "", "", "", "", "", "", ""]],
    styles: {
      fontSize: 7.8,
      cellPadding: { top: 2.2, right: 1.8, bottom: 2.2, left: 1.8 },
      minCellHeight: 10.5,
      halign: "center",
      valign: "middle",
      lineColor: [0, 0, 0],
      lineWidth: 0.08,
      textColor: [0, 0, 0],
      overflow: "linebreak",
      fillColor: [255, 255, 255],
      fontStyle: "normal",
    },
    headStyles: {
      fillColor: [26, 62, 132],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9.2,
      lineColor: [0, 0, 0],
      lineWidth: 0,
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.08,
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 13 },
      1: { cellWidth: 27 },
      2: { cellWidth: 34, overflow: "linebreak" },
      3: { cellWidth: 25, overflow: "linebreak" },
      4: { cellWidth: 23 },
      5: { cellWidth: 30, overflow: "linebreak" },
      6: { cellWidth: 22, overflow: "linebreak" },
      7: { cellWidth: 22, overflow: "linebreak" },
      8: { cellWidth: "auto", halign: "left", overflow: "linebreak" },
    },
    margin: { left: 4, right: 4 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 61;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(75, 85, 99);
  doc.text(
    `Generado con ${totalPedidos} pedidos visibles, ${articulos.length} linea(s) de detalle y filtro de tienda: ${filtroTienda}.`,
    4,
    Math.min(finalY + 8, 205)
  );

  doc.save(fileName);
};
