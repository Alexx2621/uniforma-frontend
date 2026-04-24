import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Paper,
  Typography,
  Grid,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Stack,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  createFilterOptions,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditOutlined from "@mui/icons-material/EditOutlined";
import PaymentIcon from "@mui/icons-material/Payment";
import Autocomplete from "@mui/material/Autocomplete";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../auth/useAuthStore";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import LOGO_URL from "../assets/3-logos.png";
import { buildVentaPdfHtml } from "../utils/ventaPdf";

interface Cliente {
  id: number;
  nombre: string;
  telefono?: string | null;
}

const CLIENTE_CF_ID = -1;
const CLIENTE_CF_OPTION: Cliente = {
  id: CLIENTE_CF_ID,
  nombre: "CF",
};

const formatClienteOption = (cliente: Cliente) => {
  const telefono = `${cliente.telefono || ""}`.trim();
  return telefono ? `${telefono} - ${cliente.nombre}` : cliente.nombre;
};

const filterClienteOptions = createFilterOptions<Cliente>({
  stringify: (cliente) => `${cliente.nombre || ""} ${cliente.telefono || ""}`,
});

type ClienteVenta = {
  id?: number | null;
  nombre: string;
  telefono?: string | null;
};

const normalizeTelefono = (value?: string | null) => `${value || ""}`.replace(/\D/g, "");

const escapeInputValue = (value?: string | null) =>
  `${value || ""}`
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  precio: number;
  tipo?: string;
  genero?: string;
  tela?: { id?: number; nombre?: string } | null;
  talla?: { id?: number; nombre?: string } | null;
  color?: { id?: number; nombre?: string } | null;
  telaId?: number | null;
  tallaId?: number | null;
  colorId?: number | null;
  tela_id?: number | null;
  talla_id?: number | null;
  color_id?: number | null;
}

interface Bodega {
  id: number;
  nombre: string;
  ubicacion?: string | null;
}

interface DetalleRow {
  key: number;
  productoId: number;
  cantidad: number;
  precio: number;
  bordado: number;
  descuento: number;
  descripcion: string;
  stock: number | null;
}

interface CapturaArticulo {
  productoId: number | "";
  cantidad: number;
  precio: number;
  bordado: number;
  descuento: number;
  descripcion: string;
  stock: number | null;
}

const detalleInicial: CapturaArticulo = {
  productoId: "",
  cantidad: 1,
  precio: 0,
  bordado: 0,
  descuento: 0,
  descripcion: "",
  stock: null,
};

const resolveTelaNombre = (prod: Producto | undefined, telas: any[]) => {
  if (!prod) return "N/D";
  const telaId =
    prod.telaId ?? prod.tela_id ?? prod.tela?.id ?? (prod as any).telaid ?? (prod as any).tela_id ?? null;
  return (
    prod.tela?.nombre ||
    (prod as any).telaNombre ||
    telas.find((t) => Number(t.id) === Number(telaId))?.nombre ||
    "N/D"
  );
};

const resolveTallaNombre = (prod: Producto | undefined, tallas: any[]) => {
  if (!prod) return "N/D";
  const tallaId =
    prod.tallaId ?? prod.talla_id ?? prod.talla?.id ?? (prod as any).tallaid ?? (prod as any).talla_id ?? null;
  return (
    prod.talla?.nombre ||
    (prod as any).tallaNombre ||
    tallas.find((t) => Number(t.id) === Number(tallaId))?.nombre ||
    "N/D"
  );
};

const resolveColorNombre = (prod: Producto | undefined, colores: any[]) => {
  if (!prod) return "N/D";
  const colorId =
    prod.colorId ?? prod.color_id ?? prod.color?.id ?? (prod as any).colorid ?? (prod as any).color_id ?? null;
  return (
    prod.color?.nombre ||
    (prod as any).colorNombre ||
    colores.find((c) => Number(c.id) === Number(colorId))?.nombre ||
    "N/D"
  );
};

const uniqueSorted = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

export default function VentaNueva() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [telas, setTelas] = useState<any[]>([]);
  const [tallas, setTallas] = useState<any[]>([]);
  const [colores, setColores] = useState<any[]>([]);
  const [clienteId, setClienteId] = useState<number | "">(CLIENTE_CF_ID);
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [clienteNombre, setClienteNombre] = useState("CF");
  const [bodegaId, setBodegaId] = useState<number | "">("");
  const [metodoPago, setMetodoPago] = useState<string>("efectivo");
  const [ubicacion, setUbicacion] = useState<string>("TIENDA");
  const [porcentajeRecargo, setPorcentajeRecargo] = useState<number>(0);
  const [referenciaPago, setReferenciaPago] = useState("");
  const [detalle, setDetalle] = useState<DetalleRow[]>([]);
  const [articuloActual, setArticuloActual] = useState<CapturaArticulo>(detalleInicial);
  const [cantidadInput, setCantidadInput] = useState("1");
  const [editingDetalleKey, setEditingDetalleKey] = useState<number | null>(null);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroGenero, setFiltroGenero] = useState("");
  const [filtroTela, setFiltroTela] = useState("");
  const [filtroTalla, setFiltroTalla] = useState("");
  const [filtroColor, setFiltroColor] = useState("");

  const navigate = useNavigate();
  const { usuario, rol, rolId, bodegaId: userBodegaId, bodegaNombre: authBodegaNombre } = useAuthStore();
  const { crossStoreRoleIds, fetchConfig } = useSystemConfigStore();
  const canAccessAllBodegas = rol === "ADMIN" || crossStoreRoleIds.includes(Number(rolId));
  const metodoUsaRecargo = metodoPago === "tarjeta" || metodoPago === "visalink";
  const metodoRequiereReferencia = metodoPago !== "efectivo";
  const stockRestanteEstimado =
    articuloActual.stock != null ? Math.max(articuloActual.stock - (Number(cantidadInput) || 0), 0) : null;
  const clientesConCf = useMemo(() => {
    const hasCf = clientes.some((cliente) => `${cliente.nombre || ""}`.trim().toUpperCase() === "CF");
    return hasCf ? clientes : [CLIENTE_CF_OPTION, ...clientes];
  }, [clientes]);
  const clienteSeleccionado = clientesConCf.find((c) => c.id === clienteId) || null;

  const normalizarUbicacion = (val?: string | null) => {
    if (!val) return "";
    const upper = val.toString().toUpperCase();
    if (["TIENDA", "CAPITAL", "DEPARTAMENTO"].includes(upper)) return upper;
    return upper;
  };

  const cargarCatalogos = async () => {
    try {
      const [respCli, respProd, respBod, respTelas, respTallas, respColores] = await Promise.all([
        api.get("/clientes"),
        api.get("/productos"),
        api.get("/bodegas"),
        api.get("/telas").catch(() => ({ data: [] })),
        api.get("/tallas").catch(() => ({ data: [] })),
        api.get("/colores").catch(() => ({ data: [] })),
      ]);
      setClientes(respCli.data || []);
      setProductos(respProd.data || []);
      setBodegas(respBod.data || []);
      setTelas(respTelas.data || []);
      setTallas(respTallas.data || []);
      setColores(respColores.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar catalogos", "error");
    }
  };

  useEffect(() => {
    void fetchConfig();
    void cargarCatalogos();
  }, [fetchConfig]);

  useEffect(() => {
    if (clienteId !== CLIENTE_CF_ID || clienteNombre !== "CF" || clienteTelefono) return;
    const cf = clientes.find((cliente) => `${cliente.nombre || ""}`.trim().toUpperCase() === "CF");
    if (cf) setClienteId(cf.id);
  }, [clientes, clienteId, clienteNombre, clienteTelefono]);

  const sincronizarCliente = (cliente: Cliente) => {
    setClienteId(cliente.id);
    setClienteNombre(cliente.nombre || "CF");
    setClienteTelefono(`${cliente.telefono || ""}`.trim());
  };

  const buscarClientePorTelefono = (telefono: string) => {
    const normalizado = normalizeTelefono(telefono);
    if (!normalizado) return null;
    return clientes.find((cliente) => normalizeTelefono(cliente.telefono) === normalizado) || null;
  };

  const buscarClienteExistente = (nombre: string, telefono: string) => {
    const telefonoNormalizado = normalizeTelefono(telefono);
    const nombreNormalizado = nombre.trim().toLowerCase();
    return (
      (telefonoNormalizado
        ? clientes.find((cliente) => normalizeTelefono(cliente.telefono) === telefonoNormalizado)
        : null) ||
      (nombreNormalizado
        ? clientes.find((cliente) => `${cliente.nombre || ""}`.trim().toLowerCase() === nombreNormalizado)
        : null) ||
      null
    );
  };

  const manejarTelefonoCliente = (value: string) => {
    setClienteTelefono(value);
    const encontrado = buscarClientePorTelefono(value);
    if (encontrado) {
      sincronizarCliente(encontrado);
      return;
    }
    if (clienteId !== "" && Number(clienteId) > 0) setClienteId("");
  };

  useEffect(() => {
    if (userBodegaId && !canAccessAllBodegas) {
      const parsed = Number(userBodegaId);
      const exists = bodegas.some((b) => b.id === parsed);
      setBodegaId(exists ? parsed : "");
      if (exists) {
        const selected = bodegas.find((b) => b.id === parsed);
        const ubic = normalizarUbicacion(selected?.ubicacion);
        setUbicacion(ubic || "TIENDA");
      }
    }
  }, [userBodegaId, canAccessAllBodegas, bodegas]);

  const fetchStock = async (bodega: number, producto: number) => {
    try {
      const resp = await api.get(`/inventario/${bodega}/${producto}`);
      return resp.data?.stock ?? null;
    } catch {
      return null;
    }
  };

  const obtenerTela = (prod?: Producto) => resolveTelaNombre(prod, telas);
  const obtenerTalla = (prod?: Producto) => resolveTallaNombre(prod, tallas);
  const obtenerColor = (prod?: Producto) => resolveColorNombre(prod, colores);

  const filtrarProductos = useCallback(
    ({
      tipo = filtroTipo,
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
        const matchesTipo = !tipo || (producto.tipo || "").trim() === tipo;
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
        filtrarProductos({
          tipo: "",
          genero: filtroGenero,
          tela: filtroTela,
          talla: filtroTalla,
          color: filtroColor,
        }).map((producto) => (producto.tipo || "").trim()),
      ),
    [filtrarProductos, filtroGenero, filtroTela, filtroTalla, filtroColor],
  );

  const generosDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({
          tipo: filtroTipo,
          genero: "",
          tela: filtroTela,
          talla: filtroTalla,
          color: filtroColor,
        }).map((producto) => (producto.genero || "").trim()),
      ),
    [filtrarProductos, filtroTipo, filtroTela, filtroTalla, filtroColor],
  );

  const telasDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({
          tipo: filtroTipo,
          genero: filtroGenero,
          tela: "",
          talla: filtroTalla,
          color: filtroColor,
        })
          .map((producto) => resolveTelaNombre(producto, telas).trim())
          .filter((nombre) => nombre !== "N/D"),
      ),
    [filtrarProductos, filtroTipo, filtroGenero, filtroTalla, filtroColor, telas],
  );

  const tallasDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({
          tipo: filtroTipo,
          genero: filtroGenero,
          tela: filtroTela,
          talla: "",
          color: filtroColor,
        })
          .map((producto) => resolveTallaNombre(producto, tallas).trim())
          .filter((nombre) => nombre !== "N/D"),
      ),
    [filtrarProductos, filtroTipo, filtroGenero, filtroTela, filtroColor, tallas],
  );

  const coloresDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({
          tipo: filtroTipo,
          genero: filtroGenero,
          tela: filtroTela,
          talla: filtroTalla,
          color: "",
        })
          .map((producto) => resolveColorNombre(producto, colores).trim())
          .filter((nombre) => nombre !== "N/D"),
      ),
    [filtrarProductos, filtroTipo, filtroGenero, filtroTela, filtroTalla, colores],
  );

  const productosBaseFiltrados = useMemo(
    () =>
      filtrarProductos({
        tipo: filtroTipo,
        genero: filtroGenero,
        tela: filtroTela,
        talla: "",
        color: "",
      }),
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
    const syncProducto = async () => {
      if (!productoDetectado) {
        setArticuloActual((prev) => ({
          ...prev,
          productoId: "",
          precio: 0,
          stock: null,
        }));
        return;
      }

      const stock = bodegaId ? await fetchStock(Number(bodegaId), productoDetectado.id) : null;
      setArticuloActual((prev) => ({
        ...prev,
        productoId: productoDetectado.id,
        precio: productoDetectado.precio ?? 0,
        stock,
      }));
    };

    void syncProducto();
  }, [productoDetectado, bodegaId]);

  const limpiarArticulo = () => {
    setArticuloActual(detalleInicial);
    setCantidadInput("1");
    setEditingDetalleKey(null);
    setFiltroTipo("");
    setFiltroGenero("");
    setFiltroTela("");
    setFiltroTalla("");
    setFiltroColor("");
  };

  const agregarArticulo = () => {
    if (!articuloActual.productoId) {
      Swal.fire("Validacion", "Selecciona un producto", "warning");
      return;
    }

    const cantidad = Number(cantidadInput) || 0;
    if (cantidad <= 0) {
      Swal.fire("Validacion", "Ingresa una cantidad mayor a 0", "warning");
      return;
    }

    if (articuloActual.stock != null && cantidad > articuloActual.stock) {
      Swal.fire("Validacion", `Solo hay ${articuloActual.stock} unidades disponibles en inventario`, "warning");
      return;
    }

    const row: DetalleRow = {
      key: editingDetalleKey ?? Date.now(),
      productoId: Number(articuloActual.productoId),
      cantidad,
      precio: Number(articuloActual.precio) || 0,
      bordado: Number(articuloActual.bordado) || 0,
      descuento: Number(articuloActual.descuento) || 0,
      descripcion: articuloActual.descripcion.trim(),
      stock: articuloActual.stock,
    };

    setDetalle((prev) =>
      editingDetalleKey === null ? [...prev, row] : prev.map((item) => (item.key === editingDetalleKey ? row : item)),
    );
    limpiarArticulo();
  };

  const editarArticulo = (row: DetalleRow) => {
    const producto = productos.find((p) => p.id === row.productoId);
    setEditingDetalleKey(row.key);
    setArticuloActual({
      productoId: row.productoId,
      cantidad: row.cantidad,
      precio: row.precio,
      bordado: row.bordado,
      descuento: row.descuento,
      descripcion: row.descripcion || "",
      stock: row.stock,
    });
    setCantidadInput(String(row.cantidad));
    setFiltroTipo(producto?.tipo || "");
    setFiltroGenero(producto?.genero || "");
    setFiltroTela(obtenerTela(producto) === "N/D" ? "" : obtenerTela(producto));
    setFiltroTalla(obtenerTalla(producto) === "N/D" ? "" : obtenerTalla(producto));
    setFiltroColor(obtenerColor(producto) === "N/D" ? "" : obtenerColor(producto));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const eliminarArticulo = (key: number) => {
    setDetalle((prev) => prev.filter((item) => item.key !== key));
    if (editingDetalleKey === key) {
      limpiarArticulo();
    }
  };

  const onBodegaChange = async (value: number) => {
    setBodegaId(value);
    const selected = bodegas.find((b) => b.id === value);
    const ubic = normalizarUbicacion(selected?.ubicacion);
    if (ubic) {
      setUbicacion(ubic);
    }

    const updated = await Promise.all(
      detalle.map(async (row) => {
        const stock = await fetchStock(value, row.productoId);
        return { ...row, stock };
      }),
    );
    setDetalle(updated);

    if (articuloActual.productoId) {
      const stock = await fetchStock(value, Number(articuloActual.productoId));
      setArticuloActual((prev) => ({ ...prev, stock }));
    }
  };

  const totals = useMemo(() => {
    const subtotal = detalle.reduce(
      (sum, item) =>
        sum +
        (Number(item.cantidad) || 0) *
          ((Number(item.precio) || 0) * (1 - (Number(item.descuento || 0) / 100)) + Number(item.bordado || 0)),
      0,
    );
    const recargo = metodoUsaRecargo ? subtotal * ((porcentajeRecargo || 0) / 100) : 0;
    const total = subtotal + recargo;
    return { subtotal, recargo, total };
  }, [detalle, metodoUsaRecargo, porcentajeRecargo]);

  const calcularSubtotal = (item: DetalleRow) => {
    const precioConDescuento = (Number(item.precio) || 0) * (1 - (Number(item.descuento || 0) / 100));
    return (Number(item.cantidad) || 0) * (precioConDescuento + (Number(item.bordado) || 0));
  };

  const calcularTotalesDesdeDetalle = (detalleActual: DetalleRow[]) => {
    const subtotal = detalleActual.reduce((sum, item) => sum + calcularSubtotal(item), 0);
    const recargoCalculado = metodoUsaRecargo ? subtotal * ((porcentajeRecargo || 0) / 100) : 0;
    return { subtotal, recargo: recargoCalculado, total: subtotal + recargoCalculado };
  };

  const abrirPdfVenta = (venta: any, detalleUsado: DetalleRow[]) => {
    const nuevaVentana = window.open("", "_blank");
    if (!nuevaVentana) {
      Swal.fire("Aviso", "Habilita las ventanas emergentes para ver el PDF", "info");
      return;
    }

    const clienteNombrePdf =
      venta?.clienteNombre ||
      venta?.cliente?.nombre ||
      clienteNombre.trim() ||
      clientesConCf.find((c) => c.id === (clienteId === "" ? null : Number(clienteId)))?.nombre ||
      "CF";
    const bodegaNombre = bodegas.find((b) => b.id === Number(bodegaId))?.nombre || authBodegaNombre || "N/D";
    const vendedor = usuario || "Vendedor";
    const fecha = venta?.fecha ? new Date(venta.fecha) : new Date();
    const folio = venta?.id ? `V-${venta.id}` : "Pendiente";
    const totalesPdf = calcularTotalesDesdeDetalle(detalleUsado);

    const html = buildVentaPdfHtml({
      folio,
      fecha,
      cliente: clienteNombrePdf,
      metodoPago,
      referenciaPago: metodoRequiereReferencia ? referenciaPago || "N/D" : "No aplica",
      bodega: bodegaNombre,
      ubicacion: ubicacion || "N/D",
      vendedor,
      subtotal: totalesPdf.subtotal,
      recargo: totalesPdf.recargo,
      total: totalesPdf.total,
      recargoEtiqueta: metodoUsaRecargo ? `Recargo (${porcentajeRecargo || 0}%)` : undefined,
      logoUrl: LOGO_URL,
      items: detalleUsado.map((item) => {
        const producto = productos.find((p) => p.id === item.productoId);
        return {
          codigo: producto?.codigo || `${item.productoId}`,
          nombre: producto?.nombre || "Producto",
          cantidad: Number(item.cantidad) || 0,
          precio: Number(item.precio) || 0,
          bordado: Number(item.bordado) || 0,
          descuento: Number(item.descuento) || 0,
          subtotal: calcularSubtotal(item),
        };
      }),
    });

    nuevaVentana.document.write(html);
    nuevaVentana.document.close();
  };

  const mostrarFormularioRegistroCliente = async (datosIniciales: ClienteVenta) => {
    const result = await Swal.fire({
      title: "Registrar cliente",
      html: `
        <input id="cliente-nombre" class="swal2-input" placeholder="Nombre" value="${escapeInputValue(datosIniciales.nombre)}">
        <input id="cliente-telefono" class="swal2-input" placeholder="Telefono" value="${escapeInputValue(datosIniciales.telefono)}">
        <input id="cliente-correo" class="swal2-input" placeholder="Correo (opcional)">
        <input id="cliente-direccion" class="swal2-input" placeholder="Direccion (opcional)">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Registrar",
      cancelButtonText: "Cancelar",
      preConfirm: () => {
        const nombre = (document.getElementById("cliente-nombre") as HTMLInputElement | null)?.value.trim() || "";
        const telefono = (document.getElementById("cliente-telefono") as HTMLInputElement | null)?.value.trim() || "";
        const correo = (document.getElementById("cliente-correo") as HTMLInputElement | null)?.value.trim() || "";
        const direccion = (document.getElementById("cliente-direccion") as HTMLInputElement | null)?.value.trim() || "";
        if (!nombre) {
          Swal.showValidationMessage("Ingresa el nombre del cliente");
          return false;
        }
        return {
          nombre,
          telefono: telefono || null,
          correo: correo || null,
          direccion: direccion || null,
          tipoCliente: "CLIENTE",
        };
      },
    });

    if (!result.isConfirmed || !result.value) return null;

    const resp = await api.post("/clientes", result.value);
    const nuevoCliente = resp.data as Cliente;
    setClientes((prev) => [nuevoCliente, ...prev.filter((cliente) => cliente.id !== nuevoCliente.id)]);
    sincronizarCliente(nuevoCliente);
    return nuevoCliente;
  };

  const resolverClienteVenta = async (): Promise<ClienteVenta | false> => {
    const nombre = clienteNombre.trim() || "CF";
    const telefono = clienteTelefono.trim();
    const consumidorFinal = !telefono && nombre.toUpperCase() === "CF";
    const seleccionado =
      clienteId !== "" && Number(clienteId) > 0
        ? clientes.find((cliente) => cliente.id === Number(clienteId)) || null
        : null;
    const existente = seleccionado || buscarClienteExistente(nombre, telefono);

    if (existente) {
      sincronizarCliente(existente);
      return {
        id: existente.id,
        nombre: existente.nombre,
        telefono: existente.telefono || null,
      };
    }

    if (consumidorFinal) {
      return {
        id: null,
        nombre: "CF",
        telefono: null,
      };
    }

    const respuesta = await Swal.fire({
      icon: "question",
      title: "Cliente no registrado",
      text: "Este cliente no existe. ¿Deseas registrarlo antes de finalizar la venta?",
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: "Registrar cliente",
      denyButtonText: "Continuar sin registrar",
      cancelButtonText: "Cancelar",
    });

    if (respuesta.isDismissed) return false;

    if (respuesta.isDenied) {
      setClienteId("");
      return {
        id: null,
        nombre,
        telefono: telefono || null,
      };
    }

    try {
      const creado = await mostrarFormularioRegistroCliente({ nombre, telefono });
      if (!creado) return false;
      return {
        id: creado.id,
        nombre: creado.nombre,
        telefono: creado.telefono || null,
      };
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo registrar el cliente";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
      return false;
    }
  };

  const guardar = async () => {
    if (!bodegaId) {
      Swal.fire("Validacion", "Selecciona una bodega", "warning");
      return;
    }
    if (!metodoPago) {
      Swal.fire("Validacion", "Selecciona metodo de pago", "warning");
      return;
    }
    if (!ubicacion) {
      Swal.fire("Validacion", "Selecciona ubicacion de la venta", "warning");
      return;
    }
    if (!detalle.length) {
      Swal.fire("Validacion", "Agrega al menos un producto", "warning");
      return;
    }
    if (metodoRequiereReferencia && !`${referenciaPago}`.trim()) {
      Swal.fire("Validacion", "Ingresa la referencia o numero de transaccion", "warning");
      return;
    }

    const clienteParaVenta = await resolverClienteVenta();
    if (clienteParaVenta === false) return;

    const payload = {
      clienteId: clienteParaVenta.id && Number(clienteParaVenta.id) > 0 ? Number(clienteParaVenta.id) : null,
      clienteNombre: clienteParaVenta.nombre,
      clienteTelefono: clienteParaVenta.telefono || null,
      bodegaId: Number(bodegaId),
      ubicacion,
      metodoPago,
      porcentajeRecargo,
      referenciaPago: metodoRequiereReferencia ? referenciaPago.trim() : null,
      vendedor: usuario,
        detalle: detalle.map((d) => ({
          productoId: d.productoId,
          cantidad: d.cantidad,
          precio: d.precio,
          bordado: d.bordado,
          descuento: d.descuento,
          descripcion: d.descripcion || "",
        })),
      };

    try {
      const resp = await api.post("/ventas", payload);
      Swal.fire("Guardado", "Venta registrada", "success");
      abrirPdfVenta(resp.data, detalle);
      navigate("/ventas");
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo guardar";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <PaymentIcon color="primary" />
        <Typography variant="h4">Nueva venta</Typography>
      </Stack>
      <Divider sx={{ mb: 2 }} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel>Bodega</InputLabel>
            <Select
              label="Bodega"
              value={bodegaId === "" ? "" : bodegaId}
              onChange={(e) => void onBodegaChange(Number(e.target.value))}
              disabled={!!userBodegaId && !canAccessAllBodegas}
            >
              {bodegas.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Autocomplete<Cliente, false, false, true>
            freeSolo
            options={clientes.filter((cliente) => `${cliente.telefono || ""}`.trim())}
            getOptionLabel={(option) =>
              typeof option === "string" ? option : `${option.telefono || ""}`.trim()
            }
            filterOptions={filterClienteOptions}
            inputValue={clienteTelefono}
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
              setClienteTelefono("");
            }}
            renderOption={(props, option) => (
              <li {...props}>{formatClienteOption(option)}</li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Telefono del cliente"
                fullWidth
                helperText="Busca por telefono o escribe uno nuevo"
              />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label="Nombre del cliente"
            fullWidth
            value={clienteNombre}
            onChange={(e) => {
              const value = e.target.value;
              setClienteNombre(value);
              if (clienteSeleccionado && value.trim() !== `${clienteSeleccionado.nombre || ""}`.trim()) {
                setClienteId("");
              }
            }}
            helperText="Se guardara con la venta"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel>Ubicacion</InputLabel>
            <Select label="Ubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)}>
              <MenuItem value="TIENDA">TIENDA</MenuItem>
              <MenuItem value="CAPITAL">CAPITAL</MenuItem>
              <MenuItem value="DEPARTAMENTO">DEPARTAMENTO</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel>Metodo de pago</InputLabel>
            <Select label="Metodo de pago" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
              <MenuItem value="efectivo">Efectivo</MenuItem>
              <MenuItem value="tarjeta">Tarjeta</MenuItem>
              <MenuItem value="visalink">Visalink</MenuItem>
              <MenuItem value="transferencia">Transferencia</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        {metodoUsaRecargo && (
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Recargo %"
              type="number"
              fullWidth
              value={porcentajeRecargo}
              onChange={(e) => setPorcentajeRecargo(Number(e.target.value))}
            />
          </Grid>
        )}
        {metodoRequiereReferencia && (
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Referencia"
              fullWidth
              value={referenciaPago}
              onChange={(e) => setReferenciaPago(e.target.value)}
              helperText="Numero de transaccion del metodo de pago"
            />
          </Grid>
        )}
      </Grid>

      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" sx={{ mb: 2 }}>
        Agregar articulo
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Selecciona la combinacion del articulo y agregalo a la lista temporal antes de guardar la venta.
          </Typography>
          {articuloActual.stock != null && articuloActual.productoId ? (
            <Alert severity={stockRestanteEstimado !== null && stockRestanteEstimado <= 0 ? "warning" : "info"}>
              {`Stock actual: ${articuloActual.stock} unidades. `}
              {`Stock restante estimado con esta captura: ${stockRestanteEstimado ?? 0} unidades.`}
            </Alert>
          ) : (
            <Alert severity="info">Selecciona bodega y articulo para visualizar el stock disponible.</Alert>
          )}
        </Stack>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Tipo</InputLabel>
              <Select label="Tipo" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                {tiposDisponibles.map((tipo) => (
                  <MenuItem key={tipo} value={tipo}>
                    {tipo}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Genero</InputLabel>
              <Select label="Genero" value={filtroGenero} onChange={(e) => setFiltroGenero(e.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                {generosDisponibles.map((genero) => (
                  <MenuItem key={genero} value={genero}>
                    {genero}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Tela</InputLabel>
              <Select label="Tela" value={filtroTela} onChange={(e) => setFiltroTela(e.target.value)}>
                <MenuItem value="">Todas</MenuItem>
                {telasDisponibles.map((tela) => (
                  <MenuItem key={tela} value={tela}>
                    {tela}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Talla</InputLabel>
              <Select label="Talla" value={filtroTalla} onChange={(e) => setFiltroTalla(e.target.value)}>
                <MenuItem value="">Todas</MenuItem>
                {tallasDisponibles.map((talla) => (
                  <MenuItem key={talla} value={talla}>
                    {talla}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Color</InputLabel>
              <Select label="Color" value={filtroColor} onChange={(e) => setFiltroColor(e.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                {coloresDisponibles.map((color) => (
                  <MenuItem key={color} value={color}>
                    {color}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField
              label="Codigo"
              fullWidth
              disabled
              value={productoDetectado?.codigo || ""}
              helperText={
                !filtroTipo || !filtroGenero || !filtroTela || !filtroTalla || !filtroColor
                  ? "Completa todos los filtros"
                  : productosCoincidentes.length > 1
                    ? "La combinacion coincide con varios productos"
                    : productosCoincidentes.length === 0
                      ? "No existe un producto con esa combinacion"
                      : "Codigo detectado automaticamente"
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3, md: 2 }}>
            <TextField
              label="Cantidad"
              type="text"
              fullWidth
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              value={cantidadInput}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "");
                const normalizado = raw.replace(/^0+(?=\d)/, "");
                const cantidad = Number(normalizado) || 0;
                setCantidadInput(normalizado);
                setArticuloActual((prev) => ({ ...prev, cantidad }));
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3, md: 2 }}>
            <TextField
              label="Precio"
              type="number"
              fullWidth
              value={articuloActual.precio}
              InputProps={{ readOnly: true }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3, md: 2 }}>
            <TextField
              label="Bordado"
              type="number"
              fullWidth
              value={articuloActual.bordado}
              onChange={(e) => setArticuloActual((prev) => ({ ...prev, bordado: Number(e.target.value) || 0 }))}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3, md: 2 }}>
            <TextField
              label="Descuento %"
              type="number"
              fullWidth
              value={articuloActual.descuento}
              onChange={(e) => setArticuloActual((prev) => ({ ...prev, descuento: Number(e.target.value) || 0 }))}
            />
          </Grid>
        </Grid>

        <Stack spacing={1.5} alignItems="center" sx={{ mt: 2 }}>
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              onClick={agregarArticulo}
              sx={{
                backgroundColor: "#d32f2f",
                color: "#fff",
                px: 4,
                fontWeight: 700,
                "&:hover": {
                  backgroundColor: "#b71c1c",
                },
              }}
            >
              {editingDetalleKey === null ? "Agregar a la venta" : "Guardar cambios"}
            </Button>
            {editingDetalleKey !== null && (
              <Button variant="outlined" onClick={limpiarArticulo}>
                Cancelar edicion
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      <Typography variant="h6" sx={{ mb: 1 }}>
        Articulos agregados
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Codigo</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Tipo</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Tela</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Talla</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Color</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Cantidad</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Precio</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Bordado</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Desc.</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Stock</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Subtotal</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {detalle.map((row) => {
              const producto = productos.find((p) => p.id === row.productoId);
              return (
                <TableRow key={row.key}>
                  <TableCell align="center">{producto?.codigo || row.productoId}</TableCell>
                  <TableCell align="center">{producto?.tipo || producto?.nombre || "Producto"}</TableCell>
                  <TableCell align="center">{obtenerTela(producto)}</TableCell>
                  <TableCell align="center">{obtenerTalla(producto)}</TableCell>
                  <TableCell align="center">{obtenerColor(producto)}</TableCell>
                  <TableCell align="center">{row.cantidad}</TableCell>
                  <TableCell align="center">{`Q ${row.precio.toFixed(2)}`}</TableCell>
                  <TableCell align="center">{`Q ${row.bordado.toFixed(2)}`}</TableCell>
                  <TableCell align="center">{`${row.descuento.toFixed(2)}%`}</TableCell>
                  <TableCell align="center">{row.stock ?? "N/D"}</TableCell>
                  <TableCell align="center">{`Q ${calcularSubtotal(row).toFixed(2)}`}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Button size="small" variant="text" startIcon={<EditOutlined />} onClick={() => editarArticulo(row)}>
                        Editar
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => eliminarArticulo(row.key)}
                      >
                        Eliminar
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {!detalle.length && (
              <TableRow>
                <TableCell colSpan={12} align="center">
                  Aun no has agregado articulos a la venta.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Divider sx={{ my: 2 }} />

      <Grid container spacing={2} justifyContent="flex-end">
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between">
                <Typography>Subtotal</Typography>
                <Typography>{`Q ${totals.subtotal.toFixed(2)}`}</Typography>
              </Stack>
              {metodoUsaRecargo && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography>Recargo</Typography>
                  <Typography>{`Q ${totals.recargo.toFixed(2)}`}</Typography>
                </Stack>
              )}
              <Stack direction="row" justifyContent="space-between">
                <Typography fontWeight={700}>Total</Typography>
                <Typography fontWeight={700}>{`Q ${totals.total.toFixed(2)}`}</Typography>
              </Stack>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ mt: 3 }}>
        <Button variant="outlined" onClick={() => navigate("/ventas")}>
          Cancelar
        </Button>
        <Button variant="contained" color="success" onClick={guardar}>
          Guardar venta
        </Button>
      </Stack>
    </Paper>
  );
}
