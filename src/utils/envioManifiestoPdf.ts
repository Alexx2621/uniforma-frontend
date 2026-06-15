import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import uniformaLogo from "../assets/3-logos.png";

export interface EnvioManifiestoDetallePdf {
  numeroGuia?: string | null;
  destinatario?: string | null;
  vendedor?: string | null;
  estado?: string | null;
}

export interface EnvioManifiestoPdf {
  folio?: string | null;
  fecha?: string | Date | null;
  totalLineas?: number;
  costoPorLinea?: number;
  totalConsumido?: number;
  saldoAntes?: number;
  saldoDespues?: number;
  detalles: EnvioManifiestoDetallePdf[];
}

const loadImageAsDataUrl = async (src: string) =>
  new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
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
    };
    image.onerror = () => reject(new Error("No se pudo cargar el logo"));
    image.src = src;
  });

const formatDate = (value?: string | Date | null) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString("es-GT");
  return date.toLocaleDateString("es-GT");
};

const estadoLabel = (value?: string | null) => {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (normalized === "pendiente") return "Pendiente de recoleccion";
  if (normalized === "preparado") return "Preparado";
  if (normalized === "enviado") return "Enviado";
  if (normalized === "entregado") return "Entregado";
  if (normalized === "anulado") return "Anulado";
  return value || "";
};

export const descargarEnvioManifiestoPdf = async (manifiesto: EnvioManifiestoPdf) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const blue: [number, number, number] = [23, 42, 76];
  const red: [number, number, number] = [214, 0, 0];
  const logoDataUrl = await loadImageAsDataUrl(uniformaLogo);
  const fecha = formatDate(manifiesto.fecha);

  doc.addImage(logoDataUrl, "PNG", 47, 15, 27, 27);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...blue);
  doc.text("MANIFIESTO CARGO EXPRESO", pageWidth / 2, 22, { align: "center" });

  doc.setFontSize(10.5);
  doc.setTextColor(...red);
  doc.text(`No. ${manifiesto.folio || "PENDIENTE"}`, pageWidth / 2, 29, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(fecha, pageWidth - 43, 18, { align: "right" });

  doc.setFillColor(...blue);
  doc.rect(93, 36, pageWidth - 186, 13, "F");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("UNIFORMA / UNIFORMED", pageWidth / 2, 44.5, { align: "center" });

  const detalles = manifiesto.detalles || [];
  const rows = detalles.map((item) => [
    item.numeroGuia || "",
    item.destinatario || "",
    item.vendedor || "",
    estadoLabel(item.estado),
  ]);

  autoTable(doc, {
    startY: 58,
    theme: "grid",
    head: [["No. Guia", "Destinatario", "Vendedor", "Estado"]],
    body: rows,
    margin: { left: 37, right: 37 },
    styles: {
      minCellHeight: 15.2,
      fontSize: 12,
      halign: "center",
      valign: "middle",
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.16,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: blue,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 12,
      minCellHeight: 8.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.16,
    },
    columnStyles: {
      0: { cellWidth: 51 },
      1: { cellWidth: 58 },
      2: { cellWidth: 58 },
      3: { cellWidth: "auto" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3) {
        const text = `${data.cell.raw || ""}`.trim().toLowerCase();
        if (text && !["pendiente", "preparado", "enviado", "entregado", "pendiente de recoleccion"].includes(text)) {
          data.cell.styles.fillColor = [245, 221, 65];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 225;
  const footerY = Math.min(finalY + 7, 205);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`${manifiesto.folio || "MANIFIESTO"} | Lineas: ${manifiesto.totalLineas || detalles.length}`, 37, footerY);

  doc.save(`${manifiesto.folio || "manifiesto-cargo-expreso"}.pdf`);
};
