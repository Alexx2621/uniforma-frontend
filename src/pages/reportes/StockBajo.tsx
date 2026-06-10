import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  OutlinedInput,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddShoppingCartOutlined from "@mui/icons-material/AddShoppingCartOutlined";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import WarningAmberOutlined from "@mui/icons-material/WarningAmberOutlined";
import Swal from "sweetalert2";
import { api } from "../../api/axios";
import UniformaTableLoadingRow from "../../components/UniformaTableLoadingRow";
import { PDF_FONT_FAMILY, PDF_FONT_SEMIBOLD_FAMILY } from "../../utils/fontFamily";
import { useTablePagination } from "../../utils/useTablePagination";
import { emptyWhenZero, parseNumberInput } from "../../utils/numberInputs";

interface RowInv {
  productoId: number;
  bodegaId: number;
  codigo: string;
  producto: string;
  tipo?: string | null;
  genero?: string | null;
  talla: string | null;
  color: string | null;
  tela: string | null;
  bodega: string;
  stock: number;
  stockMax: number;
  faltan: number;
}

interface RowConsolidado {
  productoId: number;
  codigo: string;
  producto: string;
  tipo: string;
  genero: string;
  tela: string;
  talla: string;
  color: string;
  stock: number;
  stockMax: number;
  faltan5: number;
  faltan10: number;
  faltan15: number;
  faltan20: number;
  bodegas: number;
}

type Prioridad = "critico" | "bajo" | "normal";

const keyOf = (row: RowInv) => `${row.bodegaId}-${row.productoId}`;
const escapeHtml = (value: unknown) =>
  `${value ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
const toStringArray = (value: unknown) =>
  (typeof value === "string" ? value.split(",") : Array.isArray(value) ? value : [])
    .map((item) => `${item}`.trim())
    .filter(Boolean);
const toNumberArray = (value: unknown) =>
  toStringArray(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
const getObjetivoStock = (row: RowInv) => Math.max(0, Number(row.stockMax || 0));
const getSugerido = (row: RowInv) => Math.max(0, getObjetivoStock(row) - Number(row.stock || 0));
const getPrioridad = (row: RowInv): Prioridad => {
  const stock = Number(row.stock || 0);
  if (stock < 10) return "critico";
  if (stock < 20) return "bajo";
  return "normal";
};
const faltanteA = (stock: number, objetivo: number) => Math.max(0, objetivo - Number(stock || 0));
const csvValue = (value: unknown) => `"${`${value ?? ""}`.replace(/"/g, '""')}"`;

const exportCsv = (rows: RowInv[]) => {
  const headers = ["Codigo", "Tipo", "Genero", "Tela", "Talla", "Color", "Bodega", "Stock", "Objetivo", "Sugerido", "Prioridad"];
  const lines = rows.map((r) =>
    [r.codigo, r.tipo || "", r.genero || "", r.tela || "", r.talla || "", r.color || "", r.bodega, r.stock, getObjetivoStock(r), getSugerido(r), getPrioridad(r)].join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "stock-bajo.csv";
  link.click();
  URL.revokeObjectURL(url);
};

const exportPdf = (rows: RowInv[]) => {
  const win = window.open("", "_blank");
  if (!win) {
    Swal.fire("Aviso", "Habilita ventanas emergentes para exportar a PDF", "info");
    return;
  }
  const rowsHtml = rows
    .map(
      (r) => `<tr>
        <td>${r.codigo}</td>
        <td>${r.tipo || ""}</td>
        <td>${r.genero || ""}</td>
        <td>${r.tela || ""}</td>
        <td>${r.talla || ""}</td>
        <td>${r.color || ""}</td>
        <td>${r.bodega}</td>
        <td>${r.stock}</td>
        <td>${getObjetivoStock(r)}</td>
        <td>${getSugerido(r)}</td>
        <td>${getPrioridad(r) === "critico" ? "Critico" : getPrioridad(r) === "bajo" ? "Bajo" : "Normal"}</td>
      </tr>`
    )
    .join("");
  win.document.write(`<!doctype html>
  <html><head>
    <meta charset="utf-8" />
    <title>Stock bajo</title>
    <style>
      body { font-family: ${PDF_FONT_FAMILY}; margin: 24px; color: #1f2937; }
      h2 { margin: 0 0 12px 0; font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; font-weight: 600; }
      table { border-collapse: collapse; width: 100%; font-size: 11px; }
      th, td { border: 1px solid #e2e8f0; padding: 7px; text-align: left; }
      th { background: #0f172a; color: #fff; font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; font-weight: 600; }
    </style>
  </head>
  <body>
    <h2>Stock bajo / reposicion sugerida</h2>
    <table>
      <thead>
        <tr><th>Codigo</th><th>Tipo</th><th>Genero</th><th>Tela</th><th>Talla</th><th>Color</th><th>Bodega</th><th>Stock</th><th>Objetivo</th><th>Sugerido</th><th>Prioridad</th></tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <script>window.onload = function(){window.print();}</script>
  </body></html>`);
  win.document.close();
};

const exportConsolidadoExcel = (rows: RowConsolidado[]) => {
  const headers = [
    "Codigo",
    "Tipo",
    "Genero",
    "Tela",
    "Talla",
    "Color",
    "Stock maximo",
    "Stock actual",
    "Falta a 5",
    "Falta a 10",
    "Falta a 15",
    "Falta a 20",
    "Bodegas",
  ];
  const tableRows = rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.codigo)}</td>
        <td>${escapeHtml(row.tipo)}</td>
        <td>${escapeHtml(row.genero)}</td>
        <td>${escapeHtml(row.tela)}</td>
        <td>${escapeHtml(row.talla)}</td>
        <td>${escapeHtml(row.color)}</td>
        <td>${row.stockMax}</td>
        <td>${row.stock}</td>
        <td>${row.faltan5}</td>
        <td>${row.faltan10}</td>
        <td>${row.faltan15}</td>
        <td>${row.faltan20}</td>
        <td>${row.bodegas}</td>
      </tr>`,
    )
    .join("");
  const html = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; }
          th, td { border: 1px solid #1f2937; padding: 6px; font-size: 11px; }
          th { background: #1f3f87; color: #ffffff; font-weight: 700; }
          .num { text-align: right; }
        </style>
      </head>
      <body>
        <h3>Consolidado de faltantes de stock</h3>
        <table>
          <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
    </html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `consolidado-stock-${new Date().toISOString().slice(0, 10)}.xls`;
  link.click();
  URL.revokeObjectURL(url);
};

const exportConsolidadoCsv = (rows: RowConsolidado[]) => {
  const headers = ["Codigo", "Tipo", "Genero", "Tela", "Talla", "Color", "Stock maximo", "Stock actual", "Falta a 5", "Falta a 10", "Falta a 15", "Falta a 20", "Bodegas"];
  const lines = rows.map((row) =>
    [
      row.codigo,
      row.tipo,
      row.genero,
      row.tela,
      row.talla,
      row.color,
      row.stockMax,
      row.stock,
      row.faltan5,
      row.faltan10,
      row.faltan15,
      row.faltan20,
      row.bodegas,
    ]
      .map(csvValue)
      .join(","),
  );
  const csv = [headers.map(csvValue).join(","), ...lines].join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `consolidado-stock-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const exportConsolidadoPdf = (rows: RowConsolidado[]) => {
  const win = window.open("", "_blank");
  if (!win) {
    Swal.fire("Aviso", "Habilita ventanas emergentes para exportar a PDF", "info");
    return;
  }
  const rowsHtml = rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.codigo)}</td>
        <td>${escapeHtml(row.tipo)}</td>
        <td>${escapeHtml(row.genero)}</td>
        <td>${escapeHtml(row.tela)}</td>
        <td>${escapeHtml(row.talla)}</td>
        <td>${escapeHtml(row.color)}</td>
        <td class="num">${row.stockMax}</td>
        <td class="num">${row.stock}</td>
        <td class="num">${row.faltan5}</td>
        <td class="num">${row.faltan10}</td>
        <td class="num">${row.faltan15}</td>
        <td class="num ${row.faltan20 > 0 ? "need20" : ""}">${row.faltan20}</td>
      </tr>`,
    )
    .join("");
  const totalStock = rows.reduce((sum, row) => sum + row.stock, 0);
  const total20 = rows.reduce((sum, row) => sum + row.faltan20, 0);
  win.document.write(`<!doctype html>
  <html><head>
    <meta charset="utf-8" />
    <title>Consolidado de faltantes de stock</title>
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      body { font-family: ${PDF_FONT_FAMILY}; margin: 0; color: #111827; }
      h1 { margin: 0; font-size: 18px; color: #1f3f87; font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; font-weight: 600; }
      .meta { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #d90000; padding-bottom: 8px; margin-bottom: 10px; }
      .subtitle { font-size: 10px; color: #4b5563; margin-top: 3px; }
      .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 8px 0 10px; }
      .box { border: 1px solid #1f3f87; padding: 5px 7px; font-size: 10px; }
      .box strong { display: block; font-size: 13px; margin-top: 2px; }
      table { border-collapse: collapse; width: 100%; font-size: 8.5px; }
      th, td { border: 1px solid #9ca3af; padding: 4px 5px; text-align: left; vertical-align: middle; }
      th { background: #1f3f87; color: #fff; font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; font-weight: 600; }
      tbody tr:nth-child(even) { background: #f8fafc; }
      .num { text-align: right; font-variant-numeric: tabular-nums; }
      .need20 { color: #b91c1c; font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="meta">
      <div>
        <h1>Consolidado de faltantes de stock</h1>
        <div class="subtitle">Generado el ${new Date().toLocaleDateString("es-GT")} · ${rows.length} producto(s)</div>
      </div>
      <div class="subtitle">Uniforma</div>
    </div>
    <div class="summary">
      <div class="box">Productos<strong>${rows.length}</strong></div>
      <div class="box">Stock actual<strong>${totalStock.toLocaleString("en-US")}</strong></div>
      <div class="box">Falta para llegar a 20<strong>${total20.toLocaleString("en-US")}</strong></div>
      <div class="box">Sin stock<strong>${rows.filter((row) => row.stock <= 0).length}</strong></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Codigo</th><th>Tipo</th><th>Genero</th><th>Tela</th><th>Talla</th><th>Color</th>
          <th>Stock max.</th><th>Stock</th><th>Falta 5</th><th>Falta 10</th><th>Falta 15</th><th>Falta 20</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <script>window.onload = function(){window.print();}</script>
  </body></html>`);
  win.document.close();
};

export default function StockBajo() {
  const [inventario, setInventario] = useState<RowInv[]>([]);
  const [bodegaFiltro, setBodegaFiltro] = useState<number[]>([]);
  const [prioridadFiltro, setPrioridadFiltro] = useState<Prioridad[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<string[]>([]);
  const [generoFiltro, setGeneroFiltro] = useState<string[]>([]);
  const [telaFiltro, setTelaFiltro] = useState<string[]>([]);
  const [tallaFiltro, setTallaFiltro] = useState<string[]>([]);
  const [colorFiltro, setColorFiltro] = useState<string[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [creandoPedido, setCreandoPedido] = useState(false);

  const cargar = async () => {
    try {
      setLoading(true);
      const resp = await api.get("/inventario/reporte");
      setInventario(resp.data || []);
    } catch {
      Swal.fire("Error", "No se pudo cargar inventario", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  useEffect(() => {
    setCantidades((current) => {
      const next = { ...current };
      inventario.forEach((row) => {
        const key = keyOf(row);
        if (next[key] == null) next[key] = getSugerido(row);
      });
      return next;
    });
  }, [inventario]);

  const bodegas = useMemo(() => {
    const map = new Map<number, string>();
    inventario.forEach((r) => map.set(r.bodegaId, r.bodega));
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [inventario]);

  const options = useMemo(() => {
    const values = (field: keyof RowInv) =>
      Array.from(new Set(inventario.map((row) => `${row[field] || ""}`.trim()).filter((value) => value && value !== "N/D"))).sort((a, b) =>
        a.localeCompare(b),
      );
    return {
      tipos: values("tipo"),
      generos: values("genero"),
      telas: values("tela"),
      tallas: values("talla"),
      colores: values("color"),
    };
  }, [inventario]);

  const filas = useMemo(() => {
    const tokens = busqueda
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return inventario
      .filter((r) => getObjetivoStock(r) > 0 && Number(r.stock || 0) < getObjetivoStock(r))
      .filter((r) => {
        if (bodegaFiltro.length && !bodegaFiltro.includes(Number(r.bodegaId))) return false;
        if (tipoFiltro.length && !tipoFiltro.includes(`${r.tipo || ""}`)) return false;
        if (generoFiltro.length && !generoFiltro.includes(`${r.genero || ""}`)) return false;
        if (telaFiltro.length && !telaFiltro.includes(`${r.tela || ""}`)) return false;
        if (tallaFiltro.length && !tallaFiltro.includes(`${r.talla || ""}`)) return false;
        if (colorFiltro.length && !colorFiltro.includes(`${r.color || ""}`)) return false;
        const rowPrioridad = getPrioridad(r);
        if (prioridadFiltro.length && !prioridadFiltro.includes(rowPrioridad)) return false;
        if (!tokens.length) return true;
        const haystack = [r.codigo, r.producto, r.tipo, r.genero, r.tela, r.talla, r.color, r.bodega].join(" ").toLowerCase();
        return tokens.every((token) => haystack.includes(token));
      })
      .sort((a, b) => {
        const rank = { critico: 0, bajo: 1, normal: 2 };
        const diff = rank[getPrioridad(a)] - rank[getPrioridad(b)];
        if (diff) return diff;
        return Number(a.stock || 0) - Number(b.stock || 0);
      });
  }, [inventario, bodegaFiltro, tipoFiltro, generoFiltro, telaFiltro, tallaFiltro, colorFiltro, prioridadFiltro, busqueda]);

  const consolidado = useMemo<RowConsolidado[]>(() => {
    const tokens = busqueda
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const agrupado = new Map<number, RowConsolidado & { bodegaIds: Set<number> }>();

    inventario
      .filter((r) => {
        if (bodegaFiltro.length && !bodegaFiltro.includes(Number(r.bodegaId))) return false;
        if (tipoFiltro.length && !tipoFiltro.includes(`${r.tipo || ""}`)) return false;
        if (generoFiltro.length && !generoFiltro.includes(`${r.genero || ""}`)) return false;
        if (telaFiltro.length && !telaFiltro.includes(`${r.tela || ""}`)) return false;
        if (tallaFiltro.length && !tallaFiltro.includes(`${r.talla || ""}`)) return false;
        if (colorFiltro.length && !colorFiltro.includes(`${r.color || ""}`)) return false;
        if (!tokens.length) return true;
        const haystack = [r.codigo, r.producto, r.tipo, r.genero, r.tela, r.talla, r.color, r.bodega].join(" ").toLowerCase();
        return tokens.every((token) => haystack.includes(token));
      })
      .forEach((row) => {
        const current = agrupado.get(row.productoId);
        if (current) {
          current.stock += Number(row.stock || 0);
          current.stockMax = Math.max(current.stockMax, Number(row.stockMax || 0));
          current.bodegaIds.add(Number(row.bodegaId));
          current.bodegas = current.bodegaIds.size;
          return;
        }

        agrupado.set(row.productoId, {
          productoId: row.productoId,
          codigo: row.codigo,
          producto: row.producto,
          tipo: row.tipo || "N/D",
          genero: row.genero || "N/D",
          tela: row.tela || "N/D",
          talla: row.talla || "N/D",
          color: row.color || "N/D",
          stock: Number(row.stock || 0),
          stockMax: Number(row.stockMax || 0),
          faltan5: 0,
          faltan10: 0,
          faltan15: 0,
          faltan20: 0,
          bodegas: 1,
          bodegaIds: new Set([Number(row.bodegaId)]),
        });
      });

    return Array.from(agrupado.values())
      .map(({ bodegaIds, ...row }) => ({
        ...row,
        faltan5: faltanteA(row.stock, 5),
        faltan10: faltanteA(row.stock, 10),
        faltan15: faltanteA(row.stock, 15),
        faltan20: faltanteA(row.stock, 20),
      }))
      .filter((row) => {
        if (!prioridadFiltro.length) return true;
        const prioridad = row.stock < 10 ? "critico" : row.stock < 20 ? "bajo" : "normal";
        return prioridadFiltro.includes(prioridad as Prioridad);
      })
      .sort((a, b) => {
        const faltaDiff = b.faltan20 - a.faltan20;
        if (faltaDiff) return faltaDiff;
        const stockDiff = a.stock - b.stock;
        if (stockDiff) return stockDiff;
        return a.codigo.localeCompare(b.codigo);
      });
  }, [inventario, bodegaFiltro, tipoFiltro, generoFiltro, telaFiltro, tallaFiltro, colorFiltro, prioridadFiltro, busqueda]);

  const consolidadoStats = useMemo(
    () => ({
      productos: consolidado.length,
      stock: consolidado.reduce((sum, row) => sum + row.stock, 0),
      faltan5: consolidado.reduce((sum, row) => sum + row.faltan5, 0),
      faltan10: consolidado.reduce((sum, row) => sum + row.faltan10, 0),
      faltan15: consolidado.reduce((sum, row) => sum + row.faltan15, 0),
      faltan20: consolidado.reduce((sum, row) => sum + row.faltan20, 0),
      sinStock: consolidado.filter((row) => row.stock <= 0).length,
    }),
    [consolidado],
  );

  const stats = useMemo(() => {
    const criticos = filas.filter((row) => getPrioridad(row) === "critico").length;
    const bajos = filas.filter((row) => getPrioridad(row) === "bajo").length;
    const sugerido = filas.reduce((sum, row) => sum + getSugerido(row), 0);
    const selectedRows = filas.filter((row) => seleccionados.has(keyOf(row)));
    const selectedQty = selectedRows.reduce((sum, row) => sum + Number(cantidades[keyOf(row)] || 0), 0);
    return { criticos, bajos, sugerido, selectedRows, selectedQty };
  }, [filas, seleccionados, cantidades]);

  const { paginatedRows, paginationProps } = useTablePagination(filas, 10);
  const visibleKeys = paginatedRows.map(keyOf);
  const visibleChecked = visibleKeys.length > 0 && visibleKeys.every((key) => seleccionados.has(key));

  const toggleSeleccion = (key: string, checked: boolean) => {
    setSeleccionados((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const seleccionarVisibles = (checked: boolean) => {
    setSeleccionados((current) => {
      const next = new Set(current);
      visibleKeys.forEach((key) => {
        if (checked) next.add(key);
        else next.delete(key);
      });
      return next;
    });
  };

  const seleccionarCriticos = () => {
    setSeleccionados(new Set(filas.filter((row) => getPrioridad(row) === "critico").map(keyOf)));
  };

  const seleccionarTodo = () => {
    setSeleccionados(new Set(filas.map(keyOf)));
  };

  const limpiarSeleccion = () => setSeleccionados(new Set());

  const crearPedidoStock = async () => {
    if (!stats.selectedRows.length) {
      Swal.fire("Selecciona articulos", "Marca al menos una linea para crear el pedido para stock.", "info");
      return;
    }

    const grupos = new Map<number, RowInv[]>();
    stats.selectedRows.forEach((row) => {
      const cantidad = Number(cantidades[keyOf(row)] || 0);
      if (cantidad <= 0) return;
      if (!grupos.has(row.bodegaId)) grupos.set(row.bodegaId, []);
      grupos.get(row.bodegaId)!.push(row);
    });

    if (!grupos.size) {
      Swal.fire("Cantidades requeridas", "Las lineas seleccionadas deben tener cantidad sugerida mayor a 0.", "warning");
      return;
    }

    const resumenHtml = Array.from(grupos.entries())
      .map(([bodegaId, rows]) => {
        const bodegaNombre = rows[0]?.bodega || `Bodega ${bodegaId}`;
        const unidades = rows.reduce((sum, row) => sum + Number(cantidades[keyOf(row)] || 0), 0);
        return `<li><strong>${bodegaNombre}</strong>: ${rows.length} lineas / ${unidades} unidades</li>`;
      })
      .join("");

    const confirm = await Swal.fire({
      title: "Crear pedido para stock",
      html: `<div style="text-align:left"><p>Se creara un pedido para stock por cada bodega seleccionada.</p><ul>${resumenHtml}</ul></div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Crear pedido",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#1f3f87",
    });
    if (!confirm.isConfirmed) return;

    try {
      setCreandoPedido(true);

      const resultados = await Promise.all(Array.from(grupos.entries()).map(async ([, rows]) => {
        const bodegaId = rows[0].bodegaId;
        const bodegaNombre = rows[0].bodega;
        const detalle = rows.map((row) => ({
          productoId: row.productoId,
          cantidad: Number(cantidades[keyOf(row)] || getSugerido(row)),
          precioUnit: 0,
          bordado: 0,
          bordados: [],
          estiloEspecial: false,
          estiloEspecialMonto: 0,
          descuento: 0,
          descripcion: "",
        }));
        const payload = {
          clienteId: null,
          clienteNombre: "Pedido para stock",
          clienteTelefono: null,
          clienteCorreo: null,
          bodegaId,
          ubicacion: "TIENDA",
          observaciones: "",
          solicitadoPor: null,
          totalEstimado: 0,
          anticipo: 0,
          envio: 0,
          metodoPago: "sin_cobro_stock",
          porcentajeRecargo: 0,
          referenciaPago: null,
          bancoPago: null,
          detalle,
        };

        try {
          await api.post("/produccion", payload);
          return { creados: 1, solicitudes: 0 };
        } catch (error: any) {
          const msg = error?.response?.data?.message || "";
          if (`${msg}`.toLowerCase().includes("autorizacion")) {
            await api.post("/produccion/autorizaciones", {
              pedido: payload,
              comentario: `Solicitud automatica desde Stock bajo para ${bodegaNombre}.`,
            });
            return { creados: 0, solicitudes: 1 };
          }
          throw error;
        }
      }));
      const creados = resultados.reduce((sum, item) => sum + item.creados, 0);
      const solicitudes = resultados.reduce((sum, item) => sum + item.solicitudes, 0);

      limpiarSeleccion();
      await Swal.fire(
        "Listo",
        `${creados ? `Pedidos creados: ${creados}. ` : ""}${solicitudes ? `Solicitudes de autorizacion enviadas: ${solicitudes}.` : ""}`,
        "success",
      );
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo crear el pedido para stock";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    } finally {
      setCreandoPedido(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={2}>
        <div>
          <Typography variant="h4">Stock bajo</Typography>
          <Typography variant="body2" color="text.secondary">
            Prioriza reposicion segun el stock maximo configurado en cada producto.
          </Typography>
        </div>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button startIcon={<RefreshOutlined />} variant="outlined" onClick={cargar} disabled={loading}>
            Recargar
          </Button>
          <Button startIcon={<FileDownloadOutlined />} variant="outlined" onClick={() => exportCsv(filas)} disabled={!filas.length}>
            CSV
          </Button>
          <Button startIcon={<PictureAsPdfOutlined />} variant="outlined" onClick={() => exportPdf(filas)} disabled={!filas.length}>
            PDF
          </Button>
          <Button startIcon={<AddShoppingCartOutlined />} variant="contained" onClick={crearPedidoStock} disabled={!stats.selectedRows.length || creandoPedido}>
            Crear pedido stock
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        <Metric title="Criticos" value={stats.criticos} helper="Stock menor a 10" color="#b91c1c" />
        <Metric title="Bajos" value={stats.bajos} helper="Stock de 10 a 19" color="#c2410c" />
        <Metric title="Unidades sugeridas" value={stats.sugerido} helper="Para llegar al objetivo" color="#1d4ed8" />
        <Metric title="Seleccionado" value={stats.selectedQty} helper={`${stats.selectedRows.length} lineas para pedido`} color="#166534" />
      </Grid>

      <Paper sx={{ p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField fullWidth label="Buscar" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="FILIPINA DAMA REPEL AZUL" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Bodega</InputLabel>
              <Select
                multiple
                label="Bodega"
                value={bodegaFiltro}
                input={<OutlinedInput label="Bodega" />}
                onChange={(e) => setBodegaFiltro(toNumberArray(e.target.value))}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={bodegas.find((b) => b.id === Number(value))?.nombre || value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {bodegas.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    <Checkbox checked={bodegaFiltro.includes(b.id)} />
                    {b.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Prioridad</InputLabel>
              <Select
                multiple
                label="Prioridad"
                value={prioridadFiltro}
                input={<OutlinedInput label="Prioridad" />}
                onChange={(e) => setPrioridadFiltro(toStringArray(e.target.value) as Prioridad[])}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value === "critico" ? "Critico" : value === "bajo" ? "Bajo" : "Normal"} size="small" />
                    ))}
                  </Box>
                )}
              >
                <MenuItem value="critico">
                  <Checkbox checked={prioridadFiltro.includes("critico")} />
                  Critico (&lt; 10)
                </MenuItem>
                <MenuItem value="bajo">
                  <Checkbox checked={prioridadFiltro.includes("bajo")} />
                  Bajo (&lt; 20)
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Tipo</InputLabel>
              <Select
                multiple
                label="Tipo"
                value={tipoFiltro}
                input={<OutlinedInput label="Tipo" />}
                onChange={(e) => setTipoFiltro(toStringArray(e.target.value))}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {options.tipos.map((value) => (
                  <MenuItem key={value} value={value}>
                    <Checkbox checked={tipoFiltro.includes(value)} />
                    {value}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Genero</InputLabel>
              <Select
                multiple
                label="Genero"
                value={generoFiltro}
                input={<OutlinedInput label="Genero" />}
                onChange={(e) => setGeneroFiltro(toStringArray(e.target.value))}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {options.generos.map((value) => (
                  <MenuItem key={value} value={value}>
                    <Checkbox checked={generoFiltro.includes(value)} />
                    {value}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Tela</InputLabel>
              <Select
                multiple
                label="Tela"
                value={telaFiltro}
                input={<OutlinedInput label="Tela" />}
                onChange={(e) => setTelaFiltro(toStringArray(e.target.value))}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {options.telas.map((value) => (
                  <MenuItem key={value} value={value}>
                    <Checkbox checked={telaFiltro.includes(value)} />
                    {value}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Talla</InputLabel>
              <Select
                multiple
                label="Talla"
                value={tallaFiltro}
                input={<OutlinedInput label="Talla" />}
                onChange={(e) => setTallaFiltro(toStringArray(e.target.value))}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {options.tallas.map((value) => (
                  <MenuItem key={value} value={value}>
                    <Checkbox checked={tallaFiltro.includes(value)} />
                    {value}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Color</InputLabel>
              <Select
                multiple
                label="Color"
                value={colorFiltro}
                input={<OutlinedInput label="Color" />}
                onChange={(e) => setColorFiltro(toStringArray(e.target.value))}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {options.colores.map((value) => (
                  <MenuItem key={value} value={value}>
                    <Checkbox checked={colorFiltro.includes(value)} />
                    {value}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button size="small" variant="outlined" onClick={seleccionarCriticos} disabled={!filas.some((row) => getPrioridad(row) === "critico")}>
                Seleccionar criticos
              </Button>
              <Button size="small" variant="outlined" onClick={seleccionarTodo} disabled={!filas.length}>
                Seleccionar todo
              </Button>
              <Button size="small" onClick={limpiarSeleccion} disabled={!seleccionados.size}>
                Limpiar
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <Alert severity="info" icon={<WarningAmberOutlined />}>
        La cantidad sugerida repone hasta el stock maximo configurado en cada producto. Puedes editar la cantidad antes de crear el pedido.
      </Alert>

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={1.5} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6">Consolidado de faltantes</Typography>
            <Typography variant="body2" color="text.secondary">
              Suma el stock por producto segun los filtros actuales y calcula cuanto falta para llegar a 5, 10, 15 y 20 unidades.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button startIcon={<FileDownloadOutlined />} variant="outlined" onClick={() => exportConsolidadoCsv(consolidado)} disabled={!consolidado.length}>
              CSV
            </Button>
            <Button startIcon={<FileDownloadOutlined />} variant="outlined" onClick={() => exportConsolidadoExcel(consolidado)} disabled={!consolidado.length}>
              Excel
            </Button>
            <Button startIcon={<PictureAsPdfOutlined />} variant="contained" onClick={() => exportConsolidadoPdf(consolidado)} disabled={!consolidado.length}>
              PDF consolidado
            </Button>
          </Stack>
        </Stack>

        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <MiniMetric title="Productos" value={consolidadoStats.productos} />
          <MiniMetric title="Stock actual" value={consolidadoStats.stock} />
          <MiniMetric title="Sin stock" value={consolidadoStats.sinStock} tone="danger" />
          <MiniMetric title="Falta a 5" value={consolidadoStats.faltan5} />
          <MiniMetric title="Falta a 10" value={consolidadoStats.faltan10} />
          <MiniMetric title="Falta a 15" value={consolidadoStats.faltan15} />
          <MiniMetric title="Falta a 20" value={consolidadoStats.faltan20} tone="warning" />
        </Grid>

        <TableContainer sx={{ maxHeight: 360, border: "1px solid", borderColor: "divider" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Codigo</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Genero</TableCell>
                <TableCell>Tela</TableCell>
                <TableCell>Talla</TableCell>
                <TableCell>Color</TableCell>
                <TableCell align="right">Stock max.</TableCell>
                <TableCell align="right">Stock</TableCell>
                <TableCell align="right">Falta 5</TableCell>
                <TableCell align="right">Falta 10</TableCell>
                <TableCell align="right">Falta 15</TableCell>
                <TableCell align="right">Falta 20</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {consolidado.slice(0, 25).map((row) => (
                <TableRow key={row.productoId} hover>
                  <TableCell>{row.codigo}</TableCell>
                  <TableCell>{row.tipo}</TableCell>
                  <TableCell>{row.genero}</TableCell>
                  <TableCell>{row.tela}</TableCell>
                  <TableCell>{row.talla}</TableCell>
                  <TableCell>{row.color}</TableCell>
                  <TableCell align="right">{row.stockMax}</TableCell>
                  <TableCell align="right">{row.stock}</TableCell>
                  <TableCell align="right">{row.faltan5}</TableCell>
                  <TableCell align="right">{row.faltan10}</TableCell>
                  <TableCell align="right">{row.faltan15}</TableCell>
                  <TableCell align="right">
                    <Typography component="span" color={row.faltan20 > 0 ? "error.main" : "text.primary"} fontWeight={row.faltan20 > 0 ? 700 : 400}>
                      {row.faltan20}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
              {!consolidado.length && (
                <TableRow>
                  <TableCell colSpan={12} align="center">
                    No hay productos para consolidar con los filtros actuales.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {consolidado.length > 25 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Vista previa de 25 lineas. El PDF y Excel incluyen las {consolidado.length.toLocaleString("en-US")} lineas filtradas.
          </Typography>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox checked={visibleChecked} indeterminate={!visibleChecked && visibleKeys.some((key) => seleccionados.has(key))} onChange={(e) => seleccionarVisibles(e.target.checked)} />
                </TableCell>
                <TableCell>Prioridad</TableCell>
                <TableCell>Codigo</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Genero</TableCell>
                <TableCell>Tela</TableCell>
                <TableCell>Talla</TableCell>
                <TableCell>Color</TableCell>
                <TableCell>Bodega</TableCell>
                <TableCell align="right">Stock</TableCell>
                <TableCell align="right">Objetivo</TableCell>
                <TableCell align="right">Pedir</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <UniformaTableLoadingRow colSpan={12} />
              ) : (
                paginatedRows.map((row) => {
                  const key = keyOf(row);
                  const rowPrioridad = getPrioridad(row);
                  const checked = seleccionados.has(key);
                  return (
                    <TableRow
                      key={key}
                      selected={checked}
                      sx={{
                        "& td": rowPrioridad === "critico" ? { borderColor: "#fecaca" } : undefined,
                        backgroundColor: rowPrioridad === "critico" ? "rgba(254, 226, 226, 0.35)" : rowPrioridad === "bajo" ? "rgba(255, 247, 237, 0.5)" : undefined,
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox checked={checked} onChange={(e) => toggleSeleccion(key, e.target.checked)} />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={rowPrioridad === "critico" ? "error" : rowPrioridad === "bajo" ? "warning" : "default"}
                          label={rowPrioridad === "critico" ? "Critico < 10" : rowPrioridad === "bajo" ? "Bajo < 20" : "Normal"}
                        />
                      </TableCell>
                      <TableCell>{row.codigo}</TableCell>
                      <TableCell>{row.tipo || "-"}</TableCell>
                      <TableCell>{row.genero || "-"}</TableCell>
                      <TableCell>{row.tela || "-"}</TableCell>
                      <TableCell>{row.talla || "-"}</TableCell>
                      <TableCell>{row.color || "-"}</TableCell>
                      <TableCell>{row.bodega}</TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={rowPrioridad === "critico" ? 700 : 500} color={rowPrioridad === "critico" ? "error.main" : "text.primary"}>
                          {row.stock}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title={`Stock maximo: ${row.stockMax || 0}. Objetivo usado: ${getObjetivoStock(row)}.`}>
                          <span>{getObjetivoStock(row)}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          size="small"
                          type="number"
                          value={emptyWhenZero(cantidades[key] ?? getSugerido(row))}
                          onChange={(e) => setCantidades((current) => ({ ...current, [key]: Math.max(0, parseNumberInput(e.target.value)) }))}
                          inputProps={{ min: 0, step: 1, style: { textAlign: "right" } }}
                          sx={{ width: 96 }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
              {!loading && !paginatedRows.length && (
                <TableRow>
                  <TableCell colSpan={12} align="center">
                    No hay productos por debajo de su stock maximo con los filtros actuales.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Divider />
        <TablePagination {...paginationProps} />
      </Paper>
    </Stack>
  );
}

function Metric({ title, value, helper, color }: { title: string; value: number; helper: string; color: string }) {
  return (
    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
      <Paper variant="outlined" sx={{ p: 2, borderLeft: `4px solid ${color}` }}>
        <Typography variant="caption" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h5">{Number(value || 0).toLocaleString("en-US")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {helper}
        </Typography>
      </Paper>
    </Grid>
  );
}

function MiniMetric({ title, value, tone = "default" }: { title: string; value: number; tone?: "default" | "warning" | "danger" }) {
  const color = tone === "danger" ? "#b91c1c" : tone === "warning" ? "#c2410c" : "#1f3f87";
  return (
    <Grid size={{ xs: 6, sm: 4, md: 3, lg: 12 / 7 }}>
      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderLeft: `4px solid ${color}`,
          px: 1.5,
          py: 1,
          minHeight: 62,
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="subtitle1" sx={{ color, fontWeight: 700, lineHeight: 1.2 }}>
          {Number(value || 0).toLocaleString("en-US")}
        </Typography>
      </Box>
    </Grid>
  );
}
