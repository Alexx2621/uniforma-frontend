import { useEffect, useMemo, useRef, useState } from "react";
import {
  Paper,
  Typography,
  Stack,
  Button,
  Chip,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import MergeTypeOutlined from "@mui/icons-material/MergeTypeOutlined";
import PlaylistAddCheckOutlined from "@mui/icons-material/PlaylistAddCheckOutlined";
import BlockOutlined from "@mui/icons-material/BlockOutlined";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { io, Socket } from "socket.io-client";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import uniformaLogo from "../assets/3-logos.png";

interface ProductoCatalogo {
  id: number;
  codigo?: string;
  nombre?: string;
  tipo?: string | null;
  genero?: string | null;
  telaId?: number | null;
  tallaId?: number | null;
  colorId?: number | null;
  tela_id?: number | null;
  talla_id?: number | null;
  color_id?: number | null;
  telaNombre?: string | null;
  tallaNombre?: string | null;
  colorNombre?: string | null;
  tela?: { id?: number | null; nombre?: string | null } | null;
  talla?: { id?: number | null; nombre?: string | null } | null;
  color?: { id?: number | null; nombre?: string | null } | null;
}

interface PedidoDetalle {
  productoId: number;
  cantidad: number;
  descripcion?: string | null;
  producto?: ProductoCatalogo | null;
}

interface PedidoRow {
  id: number;
  fecha: string;
  estado: string;
  totalEstimado: number;
  anticipo: number;
  saldoPendiente: number;
  cliente?: { nombre: string };
  clienteId?: number | null;
  clienteNombre?: string;
  clienteDisplay?: string;
  bodega?: { nombre: string };
  bodegaId?: number | null;
  bodegaNombre?: string;
  bodegaDisplay?: string;
  folio?: string;
  displayFolio?: string;
  solicitadoPor?: string | null;
  detalle?: PedidoDetalle[];
}

interface Bodega {
  id: number;
  nombre: string;
}

interface CatalogoItem {
  id: number;
  nombre?: string | null;
}

interface ArticuloUnificado {
  key: string;
  codigo: string;
  nombre: string;
  tipo: string;
  genero: string;
  tela: string;
  talla: string;
  color: string;
  descripcion: string;
  cantidad: number;
  fuentes: {
    pedidoId: number;
    folio: string;
    solicitadoPor: string;
    cantidad: number;
  }[];
}

const getTodayDateInputValue = () => {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().slice(0, 10);
};

const formatDateForFilename = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const sanitizeFilename = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_");

const PEDIDOS_AUTO_REFRESH_MS = 30000;

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

const buildResumenUnificacion = (
  articulos: ArticuloUnificado[],
  pedidos: PedidoRow[],
  bodegaId: number | null,
  filtroTienda: string
) => ({
  bodegaId,
  filtroTienda,
  pedidos: [...pedidos]
    .map((pedido) => ({
      id: Number(pedido.id) || 0,
      folio: pedido.displayFolio || `P-${pedido.id}`,
      fecha: pedido.fecha || "",
      solicitadoPor: `${pedido.solicitadoPor || ""}`.trim(),
      bodegaId: pedido.bodegaId ?? null,
    }))
    .sort((a, b) => a.id - b.id),
  articulos: [...articulos].map((articulo) => ({
    key: articulo.key,
    codigo: articulo.codigo,
    nombre: articulo.nombre,
    tipo: articulo.tipo,
    genero: articulo.genero,
    tela: articulo.tela,
    talla: articulo.talla,
    color: articulo.color,
    descripcion: articulo.descripcion,
    cantidad: articulo.cantidad,
    fuentes: [...articulo.fuentes]
      .map((fuente) => ({
        pedidoId: Number(fuente.pedidoId) || 0,
        folio: fuente.folio,
        solicitadoPor: fuente.solicitadoPor,
        cantidad: Number(fuente.cantidad) || 0,
      }))
      .sort((a, b) => {
        const porPedido = a.pedidoId - b.pedidoId;
        if (porPedido !== 0) return porPedido;
        const porFolio = a.folio.localeCompare(b.folio);
        if (porFolio !== 0) return porFolio;
        const porUsuario = a.solicitadoPor.localeCompare(b.solicitadoPor);
        if (porUsuario !== 0) return porUsuario;
        return a.cantidad - b.cantidad;
      }),
  })),
});

export default function Pedidos() {
  const [rows, setRows] = useState<PedidoRow[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [telas, setTelas] = useState<CatalogoItem[]>([]);
  const [tallas, setTallas] = useState<CatalogoItem[]>([]);
  const [colores, setColores] = useState<CatalogoItem[]>([]);
  const [filterCliente, setFilterCliente] = useState("");
  const [filterFechaInicio, setFilterFechaInicio] = useState(() => getTodayDateInputValue());
  const [filterFechaFin, setFilterFechaFin] = useState(() => getTodayDateInputValue());
  const [filterBodega, setFilterBodega] = useState<number | "all">("all");
  const [generandoUnificado, setGenerandoUnificado] = useState(false);
  const navigate = useNavigate();
  const cargandoPedidosRef = useRef(false);
  const pedidosSocketRef = useRef<Socket | null>(null);
  const { rol, rolId, bodegaId: userBodegaId } = useAuthStore();
  const { crossStoreRoleIds, unifyOrderRoleIds, fetchConfig } = useSystemConfigStore();
  const canAccessAllBodegas = rol === "ADMIN" || crossStoreRoleIds.includes(Number(rolId));
  const canUnifyPedidos = rol === "ADMIN" || unifyOrderRoleIds.includes(Number(rolId));

  const obtenerNombreCliente = (row: any) =>
    row?.clienteDisplay ||
    row?.clienteNombre ||
    row?.cliente?.nombre ||
    row?.cliente_name ||
    row?.nombreCliente ||
    row?.nombre_cliente ||
    (typeof row?.cliente === "string" ? row?.cliente : undefined) ||
    "Mostrador";

  const obtenerNombreBodega = (row: any) =>
    row?.bodegaDisplay ||
    row?.bodegaNombre ||
    row?.bodega?.nombre ||
    row?.bodega_name ||
    (typeof row?.bodega === "string" ? row?.bodega : undefined) ||
    "N/D";

  const obtenerGenerosPedido = (row: PedidoRow) => {
    const generos = (row.detalle || [])
      .map((detalle) => detalle.producto?.genero || productosMap.get(Number(detalle.productoId))?.genero || "")
      .map((genero) => `${genero || ""}`.trim())
      .filter(Boolean);
    const unicos = Array.from(new Set(generos));
    return unicos.length ? unicos.join(", ") : "N/D";
  };

  const normalizarTexto = (value?: string | null) => {
    const limpio = `${value || ""}`.trim();
    return limpio || "N/D";
  };

  const toDateOnly = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  };

  const buscarNombreCatalogo = (
    producto: ProductoCatalogo | PedidoDetalle["producto"] | undefined | null,
    tipo: "tela" | "talla" | "color"
  ) => {
    if (!producto) return "N/D";

    const fromNested =
      tipo === "tela"
        ? producto.tela?.nombre
        : tipo === "talla"
          ? producto.talla?.nombre
          : producto.color?.nombre;
    if (`${fromNested || ""}`.trim()) return normalizarTexto(fromNested);

    const fromNamed =
      tipo === "tela"
        ? (producto as any).telaNombre
        : tipo === "talla"
          ? (producto as any).tallaNombre
          : (producto as any).colorNombre;
    if (`${fromNamed || ""}`.trim()) return normalizarTexto(fromNamed);

    const itemId =
      tipo === "tela"
        ? producto.telaId ?? producto.tela_id ?? (producto as any).telaid ?? producto.tela?.id
        : tipo === "talla"
          ? producto.tallaId ?? producto.talla_id ?? (producto as any).tallaid ?? producto.talla?.id
          : producto.colorId ?? producto.color_id ?? (producto as any).colorid ?? producto.color?.id;

    const source = tipo === "tela" ? telas : tipo === "talla" ? tallas : colores;
    const found = source.find((item) => Number(item.id) === Number(itemId))?.nombre;
    return normalizarTexto(found);
  };

  const cargar = async (silent = false) => {
    if (cargandoPedidosRef.current) return;
    cargandoPedidosRef.current = true;

    try {
      const [resp, respClientes, respBodegas, respProductos, respTelas, respTallas, respColores] = await Promise.all([
        api.get("/produccion"),
        api.get("/clientes").catch(() => ({ data: [] })),
        api.get("/bodegas").catch(() => ({ data: [] })),
        api.get("/productos").catch(() => ({ data: [] })),
        api.get("/telas").catch(() => ({ data: [] })),
        api.get("/tallas").catch(() => ({ data: [] })),
        api.get("/colores").catch(() => ({ data: [] })),
      ]);
      const clientes = respClientes.data || [];
      const bodegas = respBodegas.data || [];
      const productos = respProductos.data || [];
      const telas = respTelas.data || [];
      const tallas = respTallas.data || [];
      const colores = respColores.data || [];
      const clienteMap = new Map<number, string>(clientes.map((c: any) => [Number(c.id), c.nombre]));
      const bodegaMap = new Map<number, string>(bodegas.map((b: any) => [Number(b.id), b.nombre]));

      const normalizados = (resp.data || []).map((p: any, idx: number) => {
        const rawId =
          p?.id ??
          p?.pedidoId ??
          p?.pedido_id ??
          p?.folioId ??
          (typeof p?.folio === "number" ? p.folio : undefined) ??
          (typeof p?.folio === "string" ? Number(p.folio.replace(/\D/g, "")) : undefined);
        const numericId = Number(rawId);
        const id = Number.isFinite(numericId) && numericId > 0 ? numericId : idx + 1;
        const folioTexto = p?.folio != null ? `${p.folio}`.trim() : "";
        const folioNormalizado =
          folioTexto !== ""
            ? /^\d+$/.test(folioTexto)
              ? `P-${folioTexto}`
              : folioTexto
            : `P-${id}`;
        const clienteId = p?.clienteId ?? p?.cliente_id ?? p?.clienteid ?? null;
        const clienteNombre =
          p?.cliente?.nombre ||
          p?.clienteNombre ||
          p?.cliente_name ||
          p?.nombreCliente ||
          p?.nombre_cliente ||
          (clienteMap.get(Number(clienteId)) as string | undefined) ||
          (typeof p?.cliente === "string" ? p.cliente : undefined) ||
          "Mostrador";
        const bodegaId = p?.bodegaId ?? p?.bodega_id ?? p?.bodegaid ?? null;
        const bodegaNombre =
          p?.bodega?.nombre ||
          p?.bodegaNombre ||
          p?.bodega_name ||
          (bodegaMap.get(Number(bodegaId)) as string | undefined) ||
          (typeof p?.bodega === "string" ? p.bodega : undefined) ||
          "N/D";
        return {
          ...p,
          id,
          folio: folioNormalizado,
          displayFolio: folioNormalizado,
          clienteId,
          clienteNombre,
          clienteDisplay: clienteNombre,
          bodegaId,
          bodegaNombre,
          bodegaDisplay: bodegaNombre,
        };
      });
      setBodegas(bodegas);
      setProductos(productos);
      setTelas(telas);
      setTallas(tallas);
      setColores(colores);
      setRows(normalizados);
    } catch {
      if (!silent) {
        Swal.fire("Error", "No se pudieron cargar pedidos", "error");
      }
    } finally {
      cargandoPedidosRef.current = false;
    }
  };

  useEffect(() => {
    void cargar();
    void fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    const refrescarSilencioso = () => {
      if (document.visibilityState !== "visible") return;
      void cargar(true);
    };

    const intervalId = window.setInterval(refrescarSilencioso, PEDIDOS_AUTO_REFRESH_MS);
    window.addEventListener("focus", refrescarSilencioso);
    document.addEventListener("visibilitychange", refrescarSilencioso);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refrescarSilencioso);
      document.removeEventListener("visibilitychange", refrescarSilencioso);
    };
  }, []);

  useEffect(() => {
    const socket = io(api.defaults.baseURL || window.location.origin, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    pedidosSocketRef.current = socket;

    const manejarPedidosActualizados = () => {
      void cargar(true);
    };

    const manejarConexion = () => {
      void cargar(true);
    };

    socket.on("connect", manejarConexion);
    socket.on("produccion:pedidos-actualizados", manejarPedidosActualizados);

    return () => {
      socket.off("connect", manejarConexion);
      socket.off("produccion:pedidos-actualizados", manejarPedidosActualizados);
      socket.disconnect();
      pedidosSocketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (canAccessAllBodegas) {
      setFilterBodega("all");
      return;
    }

    const parsedBodegaId = Number(userBodegaId);
    setFilterBodega(Number.isFinite(parsedBodegaId) && parsedBodegaId > 0 ? parsedBodegaId : "all");
  }, [canAccessAllBodegas, userBodegaId]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const cli = obtenerNombreCliente(r).toLowerCase();
      const parsedUserBodegaId = Number(userBodegaId);
      const fechaPedido = toDateOnly(r.fecha);
      const bodegaUsuario =
        !canAccessAllBodegas && Number.isFinite(parsedUserBodegaId) && parsedUserBodegaId > 0
          ? Number(r.bodegaId) === parsedUserBodegaId
          : true;
      const bodegaSeleccionada =
        filterBodega === "all" ? true : Number(r.bodegaId) === Number(filterBodega);
      const cumpleFechaInicio = !filterFechaInicio || (!!fechaPedido && fechaPedido >= filterFechaInicio);
      const cumpleFechaFin = !filterFechaFin || (!!fechaPedido && fechaPedido <= filterFechaFin);

      return (
        cli.includes(filterCliente.toLowerCase()) &&
        bodegaUsuario &&
        bodegaSeleccionada &&
        cumpleFechaInicio &&
        cumpleFechaFin
      );
    });
  }, [rows, filterCliente, filterBodega, filterFechaInicio, filterFechaFin, canAccessAllBodegas, userBodegaId]);

  const bodegasDisponibles = useMemo(() => {
    if (canAccessAllBodegas) return bodegas;
    const parsedUserBodegaId = Number(userBodegaId);
    if (!Number.isFinite(parsedUserBodegaId) || parsedUserBodegaId <= 0) return [];
    return bodegas.filter((b) => b.id === parsedUserBodegaId);
  }, [bodegas, canAccessAllBodegas, userBodegaId]);

  const productosMap = useMemo(
    () => new Map<number, ProductoCatalogo>(productos.map((producto) => [Number(producto.id), producto])),
    [productos]
  );

  const pedidosUnificables = useMemo(() => {
    if (!canUnifyPedidos) return [];
    return filtered.filter((pedido) => {
      const estado = `${pedido.estado || ""}`.trim().toLowerCase();
      return estado !== "anulado";
    });
  }, [filtered, canUnifyPedidos]);

  const anularPedido = async (pedido: PedidoRow) => {
    const estado = `${pedido.estado || ""}`.trim().toLowerCase();
    if (estado === "anulado") {
      Swal.fire("Aviso", "Este pedido ya esta anulado", "info");
      return;
    }
    if (["completado", "recibido"].includes(estado)) {
      Swal.fire("Aviso", "No se puede anular un pedido recibido", "info");
      return;
    }

    const confirm = await Swal.fire({
      title: "Anular pedido",
      text: `El pedido ${pedido.displayFolio || `P-${pedido.id}`} pasara a estado anulado y ya no se incluira en el unificado. Deseas continuar?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Si, anular",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d32f2f",
    });

    if (!confirm.isConfirmed) return;

    try {
      await api.post(`/produccion/${pedido.id}/anular`);
      await cargar();
      Swal.fire("Listo", "Pedido anulado correctamente", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo anular el pedido", "error");
    }
  };

  const descargarArchivoUnificado = async (
    articulos: ArticuloUnificado[],
    fileName: string,
    pedidoNo: string,
    filtroTienda: string,
    totalPedidos: number
  ) => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "letter",
    });
    const pageWidth = doc.internal.pageSize.getWidth();

    const fechaGeneracion = new Date();
    const fechaDocumento = fechaGeneracion.toLocaleDateString("es-GT");
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

    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text(fechaDocumento, pageWidth - 6, 12, { align: "right" });

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
        fontSize: 9.5,
        cellPadding: { top: 3.2, right: 2.8, bottom: 3.2, left: 2.8 },
        minCellHeight: 13,
        halign: "center",
        valign: "middle",
        lineColor: [0, 0, 0],
        lineWidth: 0.08,
        textColor: [0, 0, 0],
        overflow: "hidden",
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
        0: { cellWidth: 17 },
        1: { cellWidth: 46 },
        2: { cellWidth: 22 },
        3: { cellWidth: 28, overflow: "linebreak" },
        4: { cellWidth: 20 },
        5: { cellWidth: 25 },
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

  const abrirVistaPreviaUnificada = async () => {
    if (!canUnifyPedidos || generandoUnificado) return;
    if (!pedidosUnificables.length) {
      Swal.fire("Aviso", "No hay pedidos disponibles para unificar", "info");
      return;
    }

    setGenerandoUnificado(true);

    try {
      const agrupados = new Map<string, ArticuloUnificado>();

      pedidosUnificables.forEach((pedido) => {
        (pedido.detalle || []).forEach((detalle) => {
          const producto = detalle.producto || productosMap.get(Number(detalle.productoId));
          const codigo = normalizarTexto(producto?.codigo);
          const nombre = normalizarTexto(producto?.nombre);
          const tipo = normalizarTexto(producto?.tipo);
          const genero = normalizarTexto(producto?.genero);
          const tela = buscarNombreCatalogo(producto, "tela");
          const talla = buscarNombreCatalogo(producto, "talla");
          const color = buscarNombreCatalogo(producto, "color");
          const descripcion = normalizarTexto(detalle.descripcion);
          const key = [
            Number(detalle.productoId) || 0,
            codigo,
            nombre,
            tipo,
            genero,
            tela,
            talla,
            color,
            descripcion,
          ].join("|");

          const fuente = {
            pedidoId: pedido.id,
            folio: pedido.displayFolio || `P-${pedido.id}`,
            solicitadoPor: normalizarTexto(pedido.solicitadoPor),
            cantidad: Number(detalle.cantidad) || 0,
          };

          const existente = agrupados.get(key);
          if (existente) {
            existente.cantidad += Number(detalle.cantidad) || 0;
            existente.fuentes.push(fuente);
            return;
          }

          agrupados.set(key, {
            key,
            codigo,
            nombre,
            tipo,
            genero,
            tela,
            talla,
            color,
            descripcion,
            cantidad: Number(detalle.cantidad) || 0,
            fuentes: [fuente],
          });
        });
      });

      const articulos = Array.from(agrupados.values()).sort((a, b) => {
        const porCodigo = a.codigo.localeCompare(b.codigo);
        if (porCodigo !== 0) return porCodigo;
        return a.nombre.localeCompare(b.nombre);
      });

      const bodegaCorrelativo = filterBodega === "all" ? null : Number(filterBodega);
      const filtroTienda =
        filterBodega === "all"
          ? "Todas las tiendas"
          : bodegas.find((b) => b.id === Number(filterBodega))?.nombre || "Tienda filtrada";
      const resumenCorrelativo = buildResumenUnificacion(articulos, pedidosUnificables, bodegaCorrelativo, filtroTienda);
      const pedidoIds = pedidosUnificables
        .map((pedido) => Number(pedido.id))
        .filter((pedidoId) => Number.isInteger(pedidoId) && pedidoId > 0);

      let correlativo = "";
      const resp = await api.post("/correlativos/produccion/generar", {
        bodegaId: bodegaCorrelativo,
        pedidoIds,
        resumen: resumenCorrelativo,
      });
      correlativo = resp.data?.correlativo || "";

      const fechaGeneracion = new Date();
      const fechaArchivo = formatDateForFilename(fechaGeneracion);
      const pedidoNo = correlativo || `UNI-${fechaGeneracion.getFullYear()}${String(fechaGeneracion.getMonth() + 1).padStart(2, "0")}${String(
        fechaGeneracion.getDate()
      ).padStart(2, "0")}`;
      const fileName = `${sanitizeFilename(pedidoNo)}_${fechaArchivo}.pdf`;
      const articulosUnificados = articulos.filter((articulo) => articulo.fuentes.length > 1);

      const pedidosHtml = articulosUnificados.length
        ? `<div style="text-align:left;max-height:260px;overflow:auto;">
          <p style="margin:0 0 10px 0;">Se detectaron ${articulosUnificados.length} articulo(s) unificados:</p>
          <ul style="margin:0;padding-left:18px;">
            ${articulosUnificados
              .map((articulo) => {
                const usuarios = Array.from(new Set(articulo.fuentes.map((fuente) => fuente.solicitadoPor))).join(", ");
                const pedidos = Array.from(new Set(articulo.fuentes.map((fuente) => fuente.folio))).join(", ");
                const nombreArticulo = [articulo.tipo, articulo.tela, articulo.color, articulo.talla, articulo.genero]
                  .filter((value) => value && value !== "N/D")
                  .join(" / ");
                const descripcion = articulo.descripcion !== "N/D" ? ` | ${articulo.descripcion}` : "";
                return `<li><strong>${nombreArticulo || articulo.nombre}</strong>${descripcion}<br/>Usuarios: ${usuarios}<br/>Pedidos: ${pedidos}</li>`;
              })
              .join("")}
          </ul>
        </div>`
        : `<p style="margin:0;">Los pedidos se unificaron, pero no hubieron articulos unificados. Se descargara el PDF igualmente.</p>`;

      await Swal.fire({
        title: articulosUnificados.length ? "Articulos unificados" : "Sin articulos unificados",
        html: pedidosHtml,
        icon: articulosUnificados.length ? "success" : "info",
        confirmButtonText: "Descargar PDF",
        width: 640,
      });

      await descargarArchivoUnificado(articulos, fileName, pedidoNo, filtroTienda, pedidosUnificables.length);
    } catch (error: any) {
      Swal.fire(
        "Error",
        error?.response?.data?.message || "No se pudo generar el correlativo del reporte unificado",
        "error"
      );
    } finally {
      setGenerandoUnificado(false);
    }
  };

  const columns: GridColDef[] = [
    {
      field: "folio",
      headerName: "Folio",
      width: 120,
      valueGetter: (p) => {
        const row = (p as any)?.row || {};
        if (row.displayFolio) return row.displayFolio;
        if (row.folio && `${row.folio}`.trim() !== "") return `${row.folio}`;
        const idVal = row.id ?? row.pedidoId ?? row.pedido_id ?? (p as any)?.id;
        return idVal ? `P-${idVal}` : "";
      },
      renderCell: (p) => {
        const row = (p as any)?.row || {};
        const idVal = row.id ?? row.pedidoId ?? row.pedido_id ?? (p as any)?.id;
        const folioVal =
          row.displayFolio ||
          (row.folio && `${row.folio}`.trim() !== "" ? `${row.folio}` : undefined) ||
          (idVal ? `P-${idVal}` : "");
        return <span>{folioVal}</span>;
      },
    },
    {
      field: "fecha",
      headerName: "Fecha",
      width: 150,
      valueFormatter: (v: string) => (v ? new Date(v).toLocaleDateString() : ""),
    },
    {
      field: "cliente",
      headerName: "Cliente",
      flex: 1,
      renderCell: (p) => <span>{obtenerNombreCliente((p as any)?.row)}</span>,
    },
    {
      field: "bodega",
      headerName: "Bodega",
      flex: 1,
      renderCell: (p) => <span>{obtenerNombreBodega((p as any)?.row)}</span>,
    },
    {
      field: "genero",
      headerName: "Genero",
      width: 150,
      sortable: false,
      renderCell: (p) => <span>{obtenerGenerosPedido((p as any)?.row)}</span>,
    },
    {
      field: "solicitadoPor",
      headerName: "Registrado por",
      width: 200,
      renderCell: (p) => <span>{p.row.solicitadoPor || "N/D"}</span>,
    },
    {
      field: "estado",
      headerName: "Estado",
      width: 140,
      renderCell: (p) => {
        const estado = `${p.value || ""}`.trim().toLowerCase();
        const color = estado === "anulado" ? "error" : ["completado", "recibido"].includes(estado) ? "success" : "info";
        return <Chip label={p.value} size="small" color={color} />;
      },
    },
    {
      field: "totalEstimado",
      headerName: "Total",
      width: 120,
      valueFormatter: (v: number) => `Q ${Number(v || 0).toFixed(2)}`,
    },
    {
      field: "anticipo",
      headerName: "Anticipo",
      width: 120,
      valueFormatter: (v: number) => `Q ${Number(v || 0).toFixed(2)}`,
    },
    {
      field: "saldoPendiente",
      headerName: "Saldo",
      width: 120,
      valueFormatter: (v: number) => `Q ${Number(v || 0).toFixed(2)}`,
    },
    {
      field: "acciones",
      headerName: "Acciones",
      width: 220,
      sortable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" onClick={() => navigate(`/produccion/${p.row.id}`)}>
            Ver
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<BlockOutlined />}
            disabled={["anulado", "completado", "recibido"].includes(`${p.row.estado || ""}`.trim().toLowerCase())}
            onClick={() => anularPedido(p.row)}
          >
            Anular
          </Button>
        </Stack>
      ),
    },
  ];

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <PlaylistAddCheckOutlined color="primary" />
          <Typography variant="h4">Pedidos de produccion</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          {canUnifyPedidos && (
            <Button
              startIcon={<MergeTypeOutlined />}
              variant="outlined"
              onClick={abrirVistaPreviaUnificada}
              disabled={generandoUnificado}
            >
              Unificar
            </Button>
          )}
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => navigate("/produccion/nuevo")}>
            Nuevo pedido
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label="Buscar por cliente"
            size="small"
            fullWidth
            value={filterCliente}
            onChange={(e) => setFilterCliente(e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth size="small" disabled={!canAccessAllBodegas}>
            <InputLabel>Tienda</InputLabel>
            <Select
              label="Tienda"
              value={filterBodega === "all" ? "all" : String(filterBodega)}
              onChange={(e) => setFilterBodega(e.target.value === "all" ? "all" : Number(e.target.value))}
            >
              {canAccessAllBodegas && <MenuItem value="all">Todas</MenuItem>}
              {bodegasDisponibles.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label="Fecha inicio"
            type="date"
            size="small"
            fullWidth
            value={filterFechaInicio}
            onChange={(e) => setFilterFechaInicio(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label="Fecha fin"
            type="date"
            size="small"
            fullWidth
            value={filterFechaFin}
            onChange={(e) => setFilterFechaFin(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
      </Grid>

      <div style={{ height: 620, width: "100%" }}>
        <DataGrid
          rows={filtered}
          columns={columns}
          getRowId={(row) => row.id}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        />
      </div>
    </Paper>
  );
}
