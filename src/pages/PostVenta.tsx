import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  createFilterOptions,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import AssignmentReturnOutlined from "@mui/icons-material/AssignmentReturnOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import SwapHorizOutlined from "@mui/icons-material/SwapHorizOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";
import uniformaLogo from "../assets/3-logos.png";
import { PDF_FONT_FAMILY, PDF_FONT_SEMIBOLD_FAMILY } from "../utils/fontFamily";

type PostventaTipo = "cambio" | "devolucion";
type Vista = "lista" | "form";

interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  precio?: number | null;
  tipo?: string | null;
  genero?: string | null;
  tela?: { id?: number; nombre?: string | null } | null;
  talla?: { id?: number; nombre?: string | null } | null;
  color?: { id?: number; nombre?: string | null } | null;
  telaId?: number | null;
  tallaId?: number | null;
  colorId?: number | null;
  tela_id?: number | null;
  talla_id?: number | null;
  color_id?: number | null;
}

interface CatalogoItem {
  id: number;
  nombre?: string | null;
}

interface Cliente {
  id: number;
  nombre: string;
  telefono?: string | null;
}

interface Usuario {
  id: number;
  nombre?: string | null;
  usuario?: string | null;
  usuarioCorrelativo?: string | null;
}

interface DetallePostventa {
  key: number;
  productoId?: number | null;
  codigo: string;
  producto: string;
  tipoProducto?: string;
  genero?: string;
  tela?: string;
  talla: string;
  color: string;
  cantidad: number;
  precio: number;
  observaciones: string;
}

interface CapturaArticulo {
  productoId: number | "";
  cantidad: number;
  precio: number;
  observaciones: string;
}

interface RegistroPostventa {
  id: number;
  folio: string;
  tipo: PostventaTipo;
  fecha: string;
  clienteNombre: string;
  clienteTelefono?: string | null;
  documentoReferencia?: string | null;
  motivo: string;
  estado: string;
  resolucion?: string | null;
  monto: number;
  observaciones?: string | null;
  detalle: DetallePostventa[];
  usuario?: { nombre?: string | null; usuario?: string | null };
}

const estadoLabels: Record<string, string> = {
  pendiente: "Pendiente",
  en_revision: "En revision",
  cerrado: "Cerrado",
  anulado: "Anulado",
};

const capturaInicial = (): CapturaArticulo => ({
  productoId: "",
  cantidad: 1,
  precio: 0,
  observaciones: "",
});

const money = (value: number) =>
  `Q ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const escapeHtml = (value?: string | number | null) =>
  `${value ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const uniqueSorted = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

const normalizeTelefono = (value?: string | null) => `${value || ""}`.replace(/\D/g, "");

const formatClienteOption = (cliente: Cliente) => {
  const telefono = `${cliente.telefono || ""}`.trim();
  return telefono ? `${telefono} - ${cliente.nombre}` : cliente.nombre;
};

const filterClienteOptions = createFilterOptions<Cliente>({
  stringify: (cliente) => `${cliente.nombre || ""} ${cliente.telefono || ""}`,
});

const resolveTelaNombre = (prod: Producto | undefined, telas: CatalogoItem[]) => {
  if (!prod) return "N/D";
  const telaId = prod.telaId ?? prod.tela_id ?? prod.tela?.id ?? (prod as any).telaid ?? null;
  return prod.tela?.nombre || (prod as any).telaNombre || telas.find((t) => Number(t.id) === Number(telaId))?.nombre || "N/D";
};

const resolveTallaNombre = (prod: Producto | undefined, tallas: CatalogoItem[]) => {
  if (!prod) return "N/D";
  const tallaId = prod.tallaId ?? prod.talla_id ?? prod.talla?.id ?? (prod as any).tallaid ?? null;
  return prod.talla?.nombre || (prod as any).tallaNombre || tallas.find((t) => Number(t.id) === Number(tallaId))?.nombre || "N/D";
};

const resolveColorNombre = (prod: Producto | undefined, colores: CatalogoItem[]) => {
  if (!prod) return "N/D";
  const colorId = prod.colorId ?? prod.color_id ?? prod.color?.id ?? (prod as any).colorid ?? null;
  return prod.color?.nombre || (prod as any).colorNombre || colores.find((c) => Number(c.id) === Number(colorId))?.nombre || "N/D";
};

const buildPdfHtml = (registro: RegistroPostventa, titulo: string) => {
  const detalle = Array.isArray(registro.detalle) ? registro.detalle : [];
  const filas = detalle
    .map(
      (item, index) => `<tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.codigo)}</td>
        <td>${escapeHtml(item.producto)}</td>
        <td>${escapeHtml(item.talla || "-")}</td>
        <td>${escapeHtml(item.color || "-")}</td>
        <td>${escapeHtml(item.cantidad)}</td>
        <td>${money(Number(item.precio || 0))}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(titulo)} ${escapeHtml(registro.folio)}</title>
      <style>
        @page { size: letter portrait; margin: 10mm; }
        body { font-family: ${PDF_FONT_FAMILY}; margin: 0; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .page { padding: 8px; }
        .top { display: grid; grid-template-columns: 110px 1fr 130px; align-items: start; gap: 12px; }
        .logo { width: 86px; height: 86px; object-fit: contain; }
        h1 { margin: 8px 0 0; text-align: center; color: #123072; font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; font-size: 26px; }
        .folio { color: #d60000; }
        .date { text-align: right; font-size: 13px; padding-top: 12px; }
        .band { margin: 12px auto 14px; width: 360px; text-align: center; background: #d60000; color: #fff; padding: 5px 10px; font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; }
        .info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
        .box { border: 1px solid #d7dce5; padding: 8px; min-height: 46px; }
        .label { font-size: 10px; color: #123072; font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; text-transform: uppercase; }
        .value { margin-top: 3px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { background: #123072; color: #fff; padding: 6px 4px; text-transform: uppercase; }
        td { border: 1px solid #d7dce5; padding: 5px 4px; text-align: center; }
        .notes { margin-top: 12px; border: 1px solid #d7dce5; padding: 8px; font-size: 11px; }
        .total { margin-top: 14px; text-align: right; font-family: ${PDF_FONT_SEMIBOLD_FAMILY}; color: #d60000; font-size: 15px; }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="top">
          <img class="logo" src="${uniformaLogo}" alt="Uniforma" />
          <h1>${escapeHtml(titulo)} <span class="folio">${escapeHtml(registro.folio)}</span></h1>
          <div class="date">${new Date(registro.fecha).toLocaleDateString("es-GT")}</div>
        </div>
        <div class="band">${escapeHtml(estadoLabels[registro.estado] || registro.estado).toUpperCase()}</div>
        <div class="info">
          <div class="box"><div class="label">Cliente</div><div class="value">${escapeHtml(registro.clienteNombre)}</div></div>
          <div class="box"><div class="label">Telefono</div><div class="value">${escapeHtml(registro.clienteTelefono || "N/D")}</div></div>
          <div class="box"><div class="label">Referencia</div><div class="value">${escapeHtml(registro.documentoReferencia || "N/D")}</div></div>
          <div class="box"><div class="label">Motivo</div><div class="value">${escapeHtml(registro.motivo)}</div></div>
          <div class="box"><div class="label">Resolucion</div><div class="value">${escapeHtml(registro.resolucion || "N/D")}</div></div>
          <div class="box"><div class="label">Registrado por</div><div class="value">${escapeHtml(registro.usuario?.nombre || registro.usuario?.usuario || "N/D")}</div></div>
        </div>
        <table>
          <thead>
            <tr><th>#</th><th>Codigo</th><th>Producto</th><th>Talla</th><th>Color</th><th>Cant.</th><th>Monto</th></tr>
          </thead>
          <tbody>${filas || `<tr><td colspan="7">Sin detalle</td></tr>`}</tbody>
        </table>
        <div class="notes"><strong>Observaciones:</strong> ${escapeHtml(registro.observaciones || "N/D")}</div>
        <div class="total">Monto de referencia: ${money(Number(registro.monto || 0))}</div>
      </div>
      <script>window.onload = function(){ window.print(); }</script>
    </body>
  </html>`;
};

function PostVentaPage({ tipo }: { tipo: PostventaTipo }) {
  const isCambio = tipo === "cambio";
  const titulo = isCambio ? "Cambios" : "Devoluciones";
  const singular = isCambio ? "Cambio" : "Devolucion";
  const icon = isCambio ? <SwapHorizOutlined color="primary" /> : <AssignmentReturnOutlined color="primary" />;
  const { rol, permisos } = useAuthStore();
  const isAdmin = `${rol || ""}`.toUpperCase() === "ADMIN";
  const canManage = hasPermission(rol, permisos, "postventa.manage");

  const [vista, setVista] = useState<Vista>("lista");
  const [rows, setRows] = useState<RegistroPostventa[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [telas, setTelas] = useState<CatalogoItem[]>([]);
  const [tallas, setTallas] = useState<CatalogoItem[]>([]);
  const [colores, setColores] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<RegistroPostventa | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [vendedorFiltro, setVendedorFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [form, setForm] = useState({
    clienteNombre: "",
    clienteTelefono: "",
    documentoReferencia: "",
    motivo: "",
    estado: "pendiente",
    resolucion: "",
    observaciones: "",
  });
  const [detalle, setDetalle] = useState<DetallePostventa[]>([]);
  const [clienteId, setClienteId] = useState<number | "">("");
  const [articuloActual, setArticuloActual] = useState<CapturaArticulo>(() => capturaInicial());
  const [cantidadInput, setCantidadInput] = useState("1");
  const [editingDetalleKey, setEditingDetalleKey] = useState<number | null>(null);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroGenero, setFiltroGenero] = useState("");
  const [filtroTela, setFiltroTela] = useState("");
  const [filtroTalla, setFiltroTalla] = useState("");
  const [filtroColor, setFiltroColor] = useState("");

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { tipo };
      if (estadoFiltro) params.estado = estadoFiltro;
      if (isAdmin && vendedorFiltro) params.usuarioId = vendedorFiltro;
      const resp = await api.get("/postventa", { params });
      setRows(resp.data || []);
    } catch {
      Swal.fire("Error", `No se pudieron cargar ${titulo.toLowerCase()}`, "error");
    } finally {
      setLoading(false);
    }
  }, [estadoFiltro, isAdmin, tipo, titulo, vendedorFiltro]);

  const cargarCatalogos = useCallback(async () => {
    try {
      const [respClientes, respProductos, respTelas, respTallas, respColores] = await Promise.all([
        api.get("/clientes"),
        api.get("/productos"),
        api.get("/telas").catch(() => ({ data: [] })),
        api.get("/tallas").catch(() => ({ data: [] })),
        api.get("/colores").catch(() => ({ data: [] })),
      ]);
      setClientes(respClientes.data || []);
      setProductos(respProductos.data || []);
      setTelas(respTelas.data || []);
      setTallas(respTallas.data || []);
      setColores(respColores.data || []);
      if (isAdmin) {
        const respUsuarios = await api.get("/usuarios").catch(() => ({ data: [] }));
        setUsuarios(respUsuarios.data || []);
      } else {
        setUsuarios([]);
      }
    } catch {
      Swal.fire("Error", "No se pudieron cargar clientes o catalogos de productos", "error");
    }
  }, [isAdmin]);

  useEffect(() => {
    void cargar();
    void cargarCatalogos();
  }, [cargar, cargarCatalogos]);

  const clienteSeleccionado = clientes.find((cliente) => cliente.id === clienteId) || null;

  const sincronizarCliente = (cliente: Cliente) => {
    setClienteId(cliente.id);
    setForm((prev) => ({
      ...prev,
      clienteNombre: cliente.nombre || "",
      clienteTelefono: `${cliente.telefono || ""}`.trim(),
    }));
  };

  const buscarClientePorTelefono = (telefono: string) => {
    const normalizado = normalizeTelefono(telefono);
    if (!normalizado) return null;
    return clientes.find((cliente) => normalizeTelefono(cliente.telefono) === normalizado) || null;
  };

  const manejarTelefonoCliente = (value: string) => {
    setForm((prev) => ({ ...prev, clienteTelefono: value }));
    const encontrado = buscarClientePorTelefono(value);
    if (encontrado) {
      sincronizarCliente(encontrado);
      return;
    }
    if (clienteId !== "" && Number(clienteId) > 0) setClienteId("");
  };

  const obtenerTela = (prod?: Producto) => resolveTelaNombre(prod, telas);
  const obtenerTalla = (prod?: Producto) => resolveTallaNombre(prod, tallas);
  const obtenerColor = (prod?: Producto) => resolveColorNombre(prod, colores);

  const filtrarProductos = useCallback(
    ({
      tipo: tipoFiltro = filtroTipo,
      genero = filtroGenero,
      tela = filtroTela,
      talla = filtroTalla,
      color = filtroColor,
    }: {
      tipo?: string;
      genero?: string;
      tela?: string;
      talla?: string;
      color?: string;
    }) =>
      productos.filter((producto) => {
        const matchesTipo = !tipoFiltro || (producto.tipo || "").trim() === tipoFiltro;
        const matchesGenero = !genero || (producto.genero || "").trim() === genero;
        const matchesTela = !tela || resolveTelaNombre(producto, telas).trim() === tela;
        const matchesTalla = !talla || resolveTallaNombre(producto, tallas).trim() === talla;
        const matchesColor = !color || resolveColorNombre(producto, colores).trim() === color;
        return matchesTipo && matchesGenero && matchesTela && matchesTalla && matchesColor;
      }),
    [productos, filtroTipo, filtroGenero, filtroTela, filtroTalla, filtroColor, telas, tallas, colores],
  );

  const tiposDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({ tipo: "", genero: filtroGenero, tela: filtroTela, talla: filtroTalla, color: filtroColor }).map(
          (producto) => (producto.tipo || "").trim(),
        ),
      ),
    [filtrarProductos, filtroGenero, filtroTela, filtroTalla, filtroColor],
  );

  const generosDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({ tipo: filtroTipo, genero: "", tela: filtroTela, talla: filtroTalla, color: filtroColor }).map(
          (producto) => (producto.genero || "").trim(),
        ),
      ),
    [filtrarProductos, filtroTipo, filtroTela, filtroTalla, filtroColor],
  );

  const telasDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({ tipo: filtroTipo, genero: filtroGenero, tela: "", talla: filtroTalla, color: filtroColor })
          .map((producto) => resolveTelaNombre(producto, telas).trim())
          .filter((nombre) => nombre !== "N/D"),
      ),
    [filtrarProductos, filtroTipo, filtroGenero, filtroTalla, filtroColor, telas],
  );

  const tallasDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({ tipo: filtroTipo, genero: filtroGenero, tela: filtroTela, talla: "", color: filtroColor })
          .map((producto) => resolveTallaNombre(producto, tallas).trim())
          .filter((nombre) => nombre !== "N/D"),
      ),
    [filtrarProductos, filtroTipo, filtroGenero, filtroTela, filtroColor, tallas],
  );

  const coloresDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({ tipo: filtroTipo, genero: filtroGenero, tela: filtroTela, talla: filtroTalla, color: "" })
          .map((producto) => resolveColorNombre(producto, colores).trim())
          .filter((nombre) => nombre !== "N/D"),
      ),
    [filtrarProductos, filtroTipo, filtroGenero, filtroTela, filtroTalla, colores],
  );

  const productosBaseFiltrados = useMemo(
    () => filtrarProductos({ tipo: filtroTipo, genero: filtroGenero, tela: filtroTela, talla: "", color: "" }),
    [filtrarProductos, filtroTipo, filtroGenero, filtroTela],
  );

  const productosCoincidentes = useMemo(
    () =>
      productosBaseFiltrados.filter((producto) => {
        const matchesTalla = !filtroTalla || resolveTallaNombre(producto, tallas).trim() === filtroTalla;
        const matchesColor = !filtroColor || resolveColorNombre(producto, colores).trim() === filtroColor;
        return matchesTalla && matchesColor;
      }),
    [productosBaseFiltrados, tallas, colores, filtroTalla, filtroColor],
  );

  const productoDetectado = productosCoincidentes.length === 1 ? productosCoincidentes[0] : undefined;

  useEffect(() => {
    if (filtroTipo && !tiposDisponibles.includes(filtroTipo)) setFiltroTipo("");
  }, [filtroTipo, tiposDisponibles]);

  useEffect(() => {
    if (filtroGenero && !generosDisponibles.includes(filtroGenero)) setFiltroGenero("");
  }, [filtroGenero, generosDisponibles]);

  useEffect(() => {
    if (filtroTela && !telasDisponibles.includes(filtroTela)) setFiltroTela("");
  }, [filtroTela, telasDisponibles]);

  useEffect(() => {
    if (filtroTalla && !tallasDisponibles.includes(filtroTalla)) setFiltroTalla("");
  }, [filtroTalla, tallasDisponibles]);

  useEffect(() => {
    if (filtroColor && !coloresDisponibles.includes(filtroColor)) setFiltroColor("");
  }, [filtroColor, coloresDisponibles]);

  useEffect(() => {
    setArticuloActual((prev) => ({
      ...prev,
      productoId: productoDetectado?.id || "",
      precio: productoDetectado ? Number(productoDetectado.precio || 0) : 0,
    }));
  }, [productoDetectado]);

  const totalDetalle = useMemo(
    () => detalle.reduce((sum, item) => sum + Number(item.precio || 0) * Number(item.cantidad || 0), 0),
    [detalle],
  );

  const filtrados = useMemo(() => {
    const query = busqueda.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row.folio, row.clienteNombre, row.clienteTelefono, row.documentoReferencia, row.motivo].some((value) =>
        `${value || ""}`.toLowerCase().includes(query),
      ),
    );
  }, [rows, busqueda]);

  const limpiarArticulo = () => {
    setArticuloActual(capturaInicial());
    setCantidadInput("1");
    setEditingDetalleKey(null);
    setFiltroTipo("");
    setFiltroGenero("");
    setFiltroTela("");
    setFiltroTalla("");
    setFiltroColor("");
  };

  const resetForm = () => {
    setEditing(null);
    setClienteId("");
    setForm({
      clienteNombre: "",
      clienteTelefono: "",
      documentoReferencia: "",
      motivo: "",
      estado: "pendiente",
      resolucion: "",
      observaciones: "",
    });
    setDetalle([]);
    limpiarArticulo();
  };

  const abrirNuevo = () => {
    if (!canManage) return;
    resetForm();
    setVista("form");
  };

  const abrirEditar = (row: RegistroPostventa) => {
    if (!canManage) return;
    setEditing(row);
    setClienteId("");
    setForm({
      clienteNombre: row.clienteNombre || "",
      clienteTelefono: row.clienteTelefono || "",
      documentoReferencia: row.documentoReferencia || "",
      motivo: row.motivo || "",
      estado: row.estado || "pendiente",
      resolucion: row.resolucion || "",
      observaciones: row.observaciones || "",
    });
    setDetalle(
      Array.isArray(row.detalle)
        ? row.detalle.map((item) => ({ ...item, key: item.key || Date.now() + Math.random() }))
        : [],
    );
    limpiarArticulo();
    setVista("form");
  };

  const volverLista = () => {
    setVista("lista");
    resetForm();
  };

  const agregarArticulo = () => {
    if (!articuloActual.productoId || !productoDetectado) {
      Swal.fire("Validacion", "Selecciona una combinacion de producto valida", "warning");
      return;
    }
    const cantidad = Number(cantidadInput) || 0;
    if (cantidad <= 0) {
      Swal.fire("Validacion", "Ingresa una cantidad mayor a 0", "warning");
      return;
    }

    const row: DetallePostventa = {
      key: editingDetalleKey ?? Date.now(),
      productoId: productoDetectado.id,
      codigo: productoDetectado.codigo || "",
      producto: productoDetectado.nombre || "",
      tipoProducto: productoDetectado.tipo || "",
      genero: productoDetectado.genero || "",
      tela: obtenerTela(productoDetectado),
      talla: obtenerTalla(productoDetectado),
      color: obtenerColor(productoDetectado),
      cantidad,
      precio: Number(articuloActual.precio || 0),
      observaciones: articuloActual.observaciones.trim(),
    };

    setDetalle((prev) =>
      editingDetalleKey === null ? [...prev, row] : prev.map((item) => (item.key === editingDetalleKey ? row : item)),
    );
    limpiarArticulo();
  };

  const editarArticulo = (row: DetallePostventa) => {
    const producto = productos.find((p) => p.id === Number(row.productoId)) || productos.find((p) => p.codigo === row.codigo);
    setEditingDetalleKey(row.key);
    setArticuloActual({
      productoId: Number(producto?.id || row.productoId || ""),
      cantidad: row.cantidad,
      precio: Number(row.precio || producto?.precio || 0),
      observaciones: row.observaciones || "",
    });
    setCantidadInput(String(row.cantidad || 1));
    setFiltroTipo(producto?.tipo || row.tipoProducto || "");
    setFiltroGenero(producto?.genero || row.genero || "");
    setFiltroTela(obtenerTela(producto) === "N/D" ? "" : obtenerTela(producto));
    setFiltroTalla(obtenerTalla(producto) === "N/D" ? "" : obtenerTalla(producto));
    setFiltroColor(obtenerColor(producto) === "N/D" ? "" : obtenerColor(producto));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const eliminarArticulo = (key: number) => {
    setDetalle((prev) => prev.filter((item) => item.key !== key));
    if (editingDetalleKey === key) limpiarArticulo();
  };

  const guardar = async () => {
    if (!canManage || saving) return;
    if (!form.clienteNombre.trim()) {
      Swal.fire("Validacion", "Ingresa el nombre del cliente", "info");
      return;
    }
    if (!form.motivo.trim()) {
      Swal.fire("Validacion", "Ingresa el motivo", "info");
      return;
    }
    if (!detalle.length) {
      Swal.fire("Validacion", "Agrega al menos un producto a la lista temporal", "info");
      return;
    }

    const payload = {
      tipo,
      ...form,
      monto: totalDetalle,
      detalle: detalle.map(({ key, ...item }) => item),
    };

    const pdfWindow = window.open("", "_blank");

    try {
      setSaving(true);
      let saved: RegistroPostventa;
      if (editing) {
        const resp = await api.patch(`/postventa/${editing.id}`, payload);
        saved = resp.data;
        Swal.fire("Actualizado", `${singular} actualizado`, "success");
      } else {
        const resp = await api.post("/postventa", payload);
        saved = resp.data;
        Swal.fire("Creado", `${singular} registrado`, "success");
      }
      if (pdfWindow) {
        escribirPdfRegistro(saved, pdfWindow);
      } else {
        Swal.fire("Aviso", "Habilita ventanas emergentes para abrir el PDF automaticamente", "info");
      }
      setVista("lista");
      resetForm();
      await cargar();
    } catch (error: any) {
      pdfWindow?.close();
      const msg = error?.response?.data?.message || `No se pudo guardar el ${singular.toLowerCase()}`;
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const cambiarEstado = async (row: RegistroPostventa, action: "cerrar" | "anular") => {
    if (!canManage) return;
    const confirm = await Swal.fire({
      title: action === "cerrar" ? `Cerrar ${singular.toLowerCase()}` : `Anular ${singular.toLowerCase()}`,
      text: `Se actualizara el estado de ${row.folio}.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: action === "cerrar" ? "Cerrar" : "Anular",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
    try {
      await api.post(`/postventa/${row.id}/${action}`);
      await cargar();
    } catch {
      Swal.fire("Error", "No se pudo actualizar el estado", "error");
    }
  };

  const escribirPdfRegistro = (row: RegistroPostventa, win: Window) => {
    win.document.write(buildPdfHtml(row, singular));
    win.document.close();
  };

  const imprimirRegistro = (row: RegistroPostventa) => {
    const win = window.open("", "_blank");
    if (!win) {
      Swal.fire("Aviso", "Habilita ventanas emergentes para imprimir el comprobante", "info");
      return;
    }
    escribirPdfRegistro(row, win);
  };

  const imprimirListado = () => {
    const win = window.open("", "_blank");
    if (!win) {
      Swal.fire("Aviso", "Habilita ventanas emergentes para imprimir el reporte", "info");
      return;
    }
    const rowsHtml = filtrados
      .map(
        (row) => `<tr>
          <td>${escapeHtml(row.folio)}</td>
          <td>${new Date(row.fecha).toLocaleDateString("es-GT")}</td>
          <td>${escapeHtml(row.clienteNombre)}</td>
          <td>${escapeHtml(row.documentoReferencia || "")}</td>
          <td>${escapeHtml(row.motivo)}</td>
          <td>${escapeHtml(estadoLabels[row.estado] || row.estado)}</td>
          <td>${money(Number(row.monto || 0))}</td>
        </tr>`,
      )
      .join("");
    win.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${titulo}</title>
      <style>body{font-family:${PDF_FONT_FAMILY};margin:24px;color:#0f172a}h1{font-family:${PDF_FONT_SEMIBOLD_FAMILY};color:#123072}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#123072;color:#fff}th,td{border:1px solid #d7dce5;padding:7px;text-align:left}.total{text-align:right;margin-top:14px;font-weight:700;color:#d60000}</style>
      </head><body><h1>${titulo}</h1><table><thead><tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th>Referencia</th><th>Motivo</th><th>Estado</th><th>Monto</th></tr></thead><tbody>${rowsHtml}</tbody></table><div class="total">Total registros: ${filtrados.length}</div><script>window.onload=function(){window.print();}</script></body></html>`);
    win.document.close();
  };

  if (vista === "form") {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            {icon}
            <Typography variant="h4">{editing ? `Editar ${singular.toLowerCase()}` : `Nuevo ${singular.toLowerCase()}`}</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<ArrowBackOutlined />} variant="outlined" onClick={volverLista}>
              Volver
            </Button>
          </Stack>
        </Stack>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Autocomplete<Cliente, false, false, true>
              freeSolo
              options={clientes.filter((cliente) => `${cliente.telefono || ""}`.trim())}
              getOptionLabel={(option) => (typeof option === "string" ? option : `${option.telefono || ""}`.trim())}
              filterOptions={filterClienteOptions}
              inputValue={form.clienteTelefono}
              value={clienteSeleccionado?.telefono ? clienteSeleccionado : null}
              onInputChange={(_, value, reason) => {
                if (reason === "reset") return;
                manejarTelefonoCliente(value);
              }}
              onChange={(_, value) => {
                if (typeof value === "string") {
                  manejarTelefonoCliente(value);
                  return;
                }
                if (value) {
                  sincronizarCliente(value);
                  return;
                }
                setClienteId("");
                setForm((prev) => ({ ...prev, clienteTelefono: "" }));
              }}
              renderOption={(props, option) => <li {...props}>{formatClienteOption(option)}</li>}
              renderInput={(params) => (
                <TextField {...params} label="Telefono del cliente" fullWidth helperText="Busca por telefono o escribe uno nuevo" />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="Factura / recibo / pedido" fullWidth value={form.documentoReferencia} onChange={(e) => setForm({ ...form, documentoReferencia: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Nombre del cliente"
              fullWidth
              value={form.clienteNombre}
              onChange={(e) => {
                const value = e.target.value;
                setForm({ ...form, clienteNombre: value });
                if (clienteSeleccionado && value.trim() !== `${clienteSeleccionado.nombre || ""}`.trim()) {
                  setClienteId("");
                }
              }}
              helperText="Se guardara con el registro"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="Motivo" fullWidth value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField select label="Estado" fullWidth value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
              {Object.entries(estadoLabels).map(([key, label]) => (
                <MenuItem key={key} value={key}>{label}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="Monto calculado" fullWidth value={money(totalDetalle)} InputProps={{ readOnly: true }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Resolucion" fullWidth value={form.resolucion} onChange={(e) => setForm({ ...form, resolucion: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Observaciones generales" fullWidth value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />
        <Typography variant="h6" sx={{ mb: 1 }}>Seleccion de codigo</Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          Selecciona la combinacion del producto y agregala a la lista temporal antes de guardar. Esta accion no modifica inventario.
        </Alert>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Tipo</InputLabel>
              <Select label="Tipo" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                {tiposDisponibles.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Genero</InputLabel>
              <Select label="Genero" value={filtroGenero} onChange={(e) => setFiltroGenero(e.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                {generosDisponibles.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Tela</InputLabel>
              <Select label="Tela" value={filtroTela} onChange={(e) => setFiltroTela(e.target.value)}>
                <MenuItem value="">Todas</MenuItem>
                {telasDisponibles.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Talla</InputLabel>
              <Select label="Talla" value={filtroTalla} onChange={(e) => setFiltroTalla(e.target.value)}>
                <MenuItem value="">Todas</MenuItem>
                {tallasDisponibles.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Color</InputLabel>
              <Select label="Color" value={filtroColor} onChange={(e) => setFiltroColor(e.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                {coloresDisponibles.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 2 }}>
            <TextField
              label="Codigo"
              fullWidth
              value={productoDetectado?.codigo || ""}
              InputProps={{ readOnly: true }}
              helperText={
                productoDetectado
                  ? productoDetectado.nombre
                  : productosCoincidentes.length > 1
                    ? "Coincide con varios productos"
                    : productosCoincidentes.length === 0
                      ? "Sin coincidencias"
                      : ""
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 2 }}>
            <TextField label="Cantidad" type="number" fullWidth value={cantidadInput} onChange={(e) => setCantidadInput(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 2 }}>
            <TextField label="Monto" type="number" fullWidth value={articuloActual.precio} onChange={(e) => setArticuloActual({ ...articuloActual, precio: Number(e.target.value) || 0 })} />
          </Grid>
          <Grid size={{ xs: 12, sm: 8 }}>
            <TextField label="Observaciones del articulo" fullWidth value={articuloActual.observaciones} onChange={(e) => setArticuloActual({ ...articuloActual, observaciones: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={agregarArticulo}>
                {editingDetalleKey === null ? "Agregar a lista" : "Actualizar articulo"}
              </Button>
              <Button variant="outlined" onClick={limpiarArticulo}>Limpiar</Button>
            </Stack>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6">Lista temporal</Typography>
          <Chip label={`Total: ${money(totalDetalle)}`} color="primary" variant="outlined" />
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell align="center">Codigo</TableCell>
                <TableCell align="center">Producto</TableCell>
                <TableCell align="center">Tipo</TableCell>
                <TableCell align="center">Tela</TableCell>
                <TableCell align="center">Talla</TableCell>
                <TableCell align="center">Color</TableCell>
                <TableCell align="center">Cant.</TableCell>
                <TableCell align="center">Monto</TableCell>
                <TableCell align="center">Opciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {detalle.map((row) => (
                <TableRow key={row.key}>
                  <TableCell align="center">{row.codigo}</TableCell>
                  <TableCell align="center">{row.producto}</TableCell>
                  <TableCell align="center">{row.tipoProducto || "N/D"}</TableCell>
                  <TableCell align="center">{row.tela || "N/D"}</TableCell>
                  <TableCell align="center">{row.talla || "N/D"}</TableCell>
                  <TableCell align="center">{row.color || "N/D"}</TableCell>
                  <TableCell align="center">{row.cantidad}</TableCell>
                  <TableCell align="center">{money(Number(row.precio || 0))}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => editarArticulo(row)}><EditOutlined fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => eliminarArticulo(row.key)}><DeleteOutlineOutlined fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!detalle.length && (
                <TableRow>
                  <TableCell colSpan={9} align="center">Agrega productos a la lista temporal.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Divider sx={{ my: 3 }} />
        <Stack direction="row" justifyContent="flex-end" spacing={1}>
          <Button startIcon={<ArrowBackOutlined />} variant="outlined" onClick={volverLista}>
            Volver
          </Button>
          <Button startIcon={<SaveOutlined />} variant="contained" onClick={guardar} disabled={!canManage || saving}>
            Guardar
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          {icon}
          <Typography variant="h4">{titulo}</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<PictureAsPdfOutlined />} variant="outlined" size="small" onClick={imprimirListado} disabled={!filtrados.length}>
            PDF listado
          </Button>
          <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={abrirNuevo} disabled={!canManage}>
            Nuevo {singular.toLowerCase()}
          </Button>
          <Button startIcon={<RefreshOutlined />} variant="outlined" size="small" onClick={cargar} disabled={loading}>
            Recargar
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: isAdmin ? 4 : 6 }}>
          <TextField label="Buscar" fullWidth size="small" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </Grid>
        <Grid size={{ xs: 12, sm: isAdmin ? 3 : 3 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Estado</InputLabel>
            <Select label="Estado" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
              <MenuItem value="">Todos</MenuItem>
              {Object.entries(estadoLabels).map(([key, label]) => (
                <MenuItem key={key} value={key}>{label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        {isAdmin && (
          <Grid size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Vendedor</InputLabel>
              <Select label="Vendedor" value={vendedorFiltro} onChange={(e) => setVendedorFiltro(e.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                {usuarios.map((usuario) => (
                  <MenuItem key={usuario.id} value={`${usuario.id}`}>
                    {usuario.nombre || usuario.usuario}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}
        <Grid size={{ xs: 12, sm: isAdmin ? 2 : 3 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ height: "100%" }}>
            <Chip label={`${filtrados.length} registros`} color="primary" variant="outlined" />
          </Stack>
        </Grid>
      </Grid>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Folio</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>Cliente</TableCell>
              {isAdmin && <TableCell>Vendedor</TableCell>}
              <TableCell>Referencia</TableCell>
              <TableCell>Motivo</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Monto</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtrados.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.folio}</TableCell>
                <TableCell>{new Date(row.fecha).toLocaleDateString("es-GT")}</TableCell>
                <TableCell>{row.clienteNombre}</TableCell>
                {isAdmin && <TableCell>{row.usuario?.nombre || row.usuario?.usuario || "N/D"}</TableCell>}
                <TableCell>{row.documentoReferencia || "N/D"}</TableCell>
                <TableCell>{row.motivo}</TableCell>
                <TableCell>
                  <Chip
                    label={estadoLabels[row.estado] || row.estado}
                    size="small"
                    color={row.estado === "cerrado" ? "success" : row.estado === "anulado" ? "error" : "info"}
                  />
                </TableCell>
                <TableCell>{money(Number(row.monto || 0))}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" variant="outlined" onClick={() => imprimirRegistro(row)}>PDF</Button>
                    <Button size="small" variant="text" disabled={!canManage} onClick={() => abrirEditar(row)}>Editar</Button>
                    <Button size="small" variant="text" color="success" disabled={!canManage || row.estado === "cerrado"} onClick={() => cambiarEstado(row, "cerrar")}>Cerrar</Button>
                    <Button size="small" variant="text" color="error" disabled={!canManage || row.estado === "anulado"} onClick={() => cambiarEstado(row, "anular")}>Anular</Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {!filtrados.length && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 9 : 8} align="center">No hay registros.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export function Cambios() {
  return <PostVentaPage tipo="cambio" />;
}

export function Devoluciones() {
  return <PostVentaPage tipo="devolucion" />;
}
