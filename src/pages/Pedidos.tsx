import { useEffect, useMemo, useState } from "react";
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
}

export default function Pedidos() {
  const [rows, setRows] = useState<PedidoRow[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [telas, setTelas] = useState<CatalogoItem[]>([]);
  const [tallas, setTallas] = useState<CatalogoItem[]>([]);
  const [colores, setColores] = useState<CatalogoItem[]>([]);
  const [filterCliente, setFilterCliente] = useState("");
  const [filterFechaInicio, setFilterFechaInicio] = useState("");
  const [filterFechaFin, setFilterFechaFin] = useState("");
  const [filterBodega, setFilterBodega] = useState<number | "all">("all");
  const navigate = useNavigate();
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

  const cargar = async () => {
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
        const folioNormalizado =
          p?.folio && `${p.folio}`.trim() !== ""
            ? `${p.folio}`.startsWith("P-")
              ? `${p.folio}`
              : `P-${p.folio}`
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
      Swal.fire("Error", "No se pudieron cargar pedidos", "error");
    }
  };

  useEffect(() => {
    cargar();
    void fetchConfig();
  }, [fetchConfig]);

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

    const parsedUserBodegaId = Number(userBodegaId);
    return rows.filter((pedido) => {
      const estado = `${pedido.estado || ""}`.trim().toLowerCase();
      if (estado === "anulado") return false;

      if (canAccessAllBodegas) {
        return filterBodega === "all" ? true : Number(pedido.bodegaId) === Number(filterBodega);
      }

      if (!Number.isFinite(parsedUserBodegaId) || parsedUserBodegaId <= 0) return true;
      return Number(pedido.bodegaId) === parsedUserBodegaId;
    });
  }, [rows, canUnifyPedidos, canAccessAllBodegas, filterBodega, userBodegaId]);

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

  const abrirVistaPreviaUnificada = async () => {
    if (!canUnifyPedidos) return;

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

        const existente = agrupados.get(key);
        if (existente) {
          existente.cantidad += Number(detalle.cantidad) || 0;
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
        });
      });
    });

    const articulos = Array.from(agrupados.values()).sort((a, b) => {
      const porCodigo = a.codigo.localeCompare(b.codigo);
      if (porCodigo !== 0) return porCodigo;
      return a.nombre.localeCompare(b.nombre);
    });

    if (!pedidosUnificables.length) {
      Swal.fire("Aviso", "No hay pedidos disponibles para unificar", "info");
      return;
    }

    const popup = window.open("", "_blank", "width=1280,height=840");
    if (!popup) {
      Swal.fire("Aviso", "Habilita las ventanas emergentes para ver la vista previa", "info");
      return;
    }

    let correlativo = "";
    try {
      const resp = await api.post("/correlativos/produccion/generar", {
        bodegaId: filterBodega === "all" ? null : Number(filterBodega),
      });
      correlativo = resp.data?.correlativo || "";
    } catch (error: any) {
      popup.close();
      Swal.fire(
        "Error",
        error?.response?.data?.message || "No se pudo generar el correlativo del reporte unificado",
        "error"
      );
      return;
    }

    const escapeHtml = (value?: string | number | null) =>
      `${value ?? ""}`
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const filasHtml =
      articulos.length > 0
        ? articulos
            .map(
              (item, idx) => `<tr>
          <td class="cantidad">${escapeHtml(item.cantidad)}</td>
          <td>${escapeHtml(item.tipo)}</td>
          <td>${escapeHtml(item.tela)}</td>
          <td>${escapeHtml(item.color)}</td>
          <td>${escapeHtml(item.talla)}</td>
          <td>${escapeHtml(item.genero)}</td>
          <td>${escapeHtml(item.descripcion === "N/D" ? "" : item.descripcion)}</td>
        </tr>`
            )
            .join("")
        : `<tr>
            <td class="cantidad">-</td>
            <td colspan="6" style="text-align:center;">No hay articulos detallados en los pedidos seleccionados</td>
          </tr>`;

    const fechaGeneracion = new Date();
    const fechaDocumento = fechaGeneracion.toLocaleDateString("es-GT");
    const filtroTienda =
      filterBodega === "all"
        ? "Todas las tiendas"
        : bodegas.find((b) => b.id === Number(filterBodega))?.nombre || "Tienda filtrada";
    const pedidoNo = correlativo || `UNI-${fechaGeneracion.getFullYear()}${String(fechaGeneracion.getMonth() + 1).padStart(2, "0")}${String(
      fechaGeneracion.getDate()
    ).padStart(2, "0")}`;
    const vendedorLabel = filtroTienda.toUpperCase();
    const logoUrl = uniformaLogo;
    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Vista previa unificada de produccion</title>
          <style>
            @page { size: letter landscape; margin: 8mm; }
            * { box-sizing:border-box; }
            html, body { width: 100%; height: 100%; }
            body { font-family: Arial, sans-serif; margin: 0; color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { width: 100%; max-width: 1320px; margin: 0 auto; padding: 8px 10px 10px; }
            .topline { display:grid; grid-template-columns: 132px 1fr 170px; align-items:start; gap: 12px; margin-bottom: 4px; }
            .logo-wrap { display:flex; justify-content:center; }
            .logo { width: 110px; height: 110px; object-fit: contain; }
            .title-block { text-align:center; padding-top: 6px; }
            .pedido-no { margin: 0; font-size: 30px; font-weight: 800; color: #0f3274; letter-spacing: 0.4px; }
            .pedido-no .value { color: #d60000; }
            .date { text-align:right; font-size: 18px; font-weight: 800; padding-top: 8px; }
            .seller-wrap { margin: 2px auto 16px; width: 418px; }
            .seller-label { text-align:center; font-size: 18px; font-weight: 800; color: #e10600; margin-bottom: 2px; }
            .seller-boxes { display:grid; grid-template-columns: 1fr 210px; }
            .seller-name { background:#123072; color:#fff; min-height:50px; display:flex; align-items:center; justify-content:center; text-align:center; padding: 8px 12px; font-size: 16px; font-weight: 800; }
            .seller-note { background:#ff1200; color:#fff; min-height:50px; display:flex; align-items:center; justify-content:center; text-align:center; padding: 8px 12px; font-size: 15px; font-weight: 800; }
            table { width:100%; border-collapse:collapse; table-layout:fixed; }
            thead th { background:#0f3274; color:#fff; text-align:center; border:1px solid #0f3274; padding:8px 6px; font-size:15px; font-weight:800; }
            tbody td { border:1px solid #1f1f1f; padding:8px 8px; font-size:14px; text-align:center; height:48px; vertical-align:middle; word-wrap:break-word; }
            tbody td:last-child { text-align:left; }
            .cantidad { width: 78px; }
            .pedido { width: 220px; }
            .tela { width: 104px; }
            .color { width: 104px; }
            .talla { width: 106px; }
            .sexo { width: 104px; }
            .obs { width: auto; }
            .footer-note { margin-top:8px; font-size:11px; color:#475569; }
            .actions { display:flex; justify-content:flex-end; margin-top:18px; padding: 0 28px 28px; }
            button { border:none; background:#0f3274; color:#fff; padding:12px 22px; border-radius:8px; font-size:14px; cursor:pointer; }
            @media print {
              html, body { width: auto; height: auto; }
              body { margin:0; background:#fff; }
              .page { max-width: none; padding: 0; }
              .actions { display:none; }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="topline">
              <div class="logo-wrap">
                <img class="logo" src="${logoUrl}" alt="Uniforma" />
              </div>
              <div class="title-block">
                <h1 class="pedido-no">PEDIDO No.: <span class="value">${escapeHtml(pedidoNo)}</span></h1>
              </div>
              <div class="date">${escapeHtml(fechaDocumento)}</div>
            </div>

            <div class="seller-wrap">
              <div class="seller-label">VENDEDOR</div>
              <div class="seller-boxes">
                <div class="seller-name">${escapeHtml(vendedorLabel)}</div>
                <div class="seller-note">RECIBIDO NOMBRE:</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th class="cantidad">CANT</th>
                  <th class="pedido">PEDIDO</th>
                  <th class="tela">TELA</th>
                  <th class="color">COLOR</th>
                  <th class="talla">TALLA</th>
                  <th class="sexo">SEXO</th>
                  <th class="obs">OBSERVACIONES</th>
                </tr>
              </thead>
              <tbody>${filasHtml}</tbody>
            </table>

            <div class="footer-note">
              Generado con ${escapeHtml(pedidosUnificables.length)} pedidos visibles y filtro de tienda: ${escapeHtml(filtroTienda)}.
            </div>
          </div>

          <div class="actions">
            <button onclick="window.print()">PDF / Imprimir</button>
          </div>
        </body>
      </html>`;

    popup.document.write(html);
    popup.document.close();
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
            <Button startIcon={<MergeTypeOutlined />} variant="outlined" onClick={abrirVistaPreviaUnificada}>
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
