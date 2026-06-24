import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import ClearIcon from "@mui/icons-material/Clear";
import DeleteIcon from "@mui/icons-material/Delete";
import InventoryOutlined from "@mui/icons-material/InventoryOutlined";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";

interface Bodega {
  id: number;
  nombre: string;
}

interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  tipo?: string | null;
  genero?: string | null;
  tela?: { nombre?: string | null } | null;
  talla?: { nombre?: string | null } | null;
  color?: { nombre?: string | null } | null;
}

interface ConteoDetalle {
  id?: number;
  productoId: number;
  stockSistema: number;
  stockFisico: number;
  diferencia: number;
  producto?: Producto | null;
}

interface ConteoRegistro {
  id: number;
  folio?: string | null;
  fecha: string;
  bodegaId: number;
  responsable?: string | null;
  observaciones?: string | null;
  estado?: string | null;
  bodega?: Bodega | null;
  detalle?: ConteoDetalle[];
}

interface DetalleCaptura {
  key: number;
  productoId: number;
  codigo: string;
  producto: string;
  stockSistema: number;
  stockFisico: number;
}

const toInputDate = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 10);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "N/D";
  return new Date(value).toLocaleString("es-GT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const uniqueSorted = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));

export default function ConteosFisicos() {
  const today = useMemo(() => toInputDate(new Date()), []);
  const [vista, setVista] = useState<"listado" | "nuevo">("listado");
  const [conteos, setConteos] = useState<ConteoRegistro[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(false);
  const [guardandoConteo, setGuardandoConteo] = useState(false);
  const guardandoConteoRef = useRef(false);
  const [filtroDesde, setFiltroDesde] = useState(today);
  const [filtroHasta, setFiltroHasta] = useState(today);
  const [filtroBodega, setFiltroBodega] = useState<number | "">("");
  const [bodegaId, setBodegaId] = useState<number | "">("");
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [filtroTipoProducto, setFiltroTipoProducto] = useState("");
  const [filtroGeneroProducto, setFiltroGeneroProducto] = useState("");
  const [filtroTelaProducto, setFiltroTelaProducto] = useState("");
  const [filtroTallaProducto, setFiltroTallaProducto] = useState("");
  const [filtroColorProducto, setFiltroColorProducto] = useState("");
  const [stockFisico, setStockFisico] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [detalle, setDetalle] = useState<DetalleCaptura[]>([]);
  const [conteoSeleccionado, setConteoSeleccionado] = useState<ConteoRegistro | null>(null);

  const { rol, permisos, bodegaId: userBodegaId, usuario } = useAuthStore();
  const canAccessAllBodegas = hasPermission(rol, permisos, "sistema.multi-tienda");

  const cargarCatalogos = useCallback(async () => {
    try {
      const [respBodegas, respProductos] = await Promise.all([
        api.get("/bodegas", { params: { operacion: "ajustes" } }),
        api.get("/productos"),
      ]);
      setBodegas(Array.isArray(respBodegas.data) ? respBodegas.data : []);
      setProductos(Array.isArray(respProductos.data) ? respProductos.data : []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar bodegas o productos", "error");
    }
  }, []);

  const cargarConteos = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await api.get("/inventario/conteos", {
        params: {
          desde: filtroDesde || undefined,
          hasta: filtroHasta || undefined,
          bodegaId: filtroBodega || undefined,
        },
      });
      setConteos(Array.isArray(resp.data) ? resp.data : []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar los conteos fisicos", "error");
    } finally {
      setLoading(false);
    }
  }, [filtroDesde, filtroHasta, filtroBodega]);

  useEffect(() => {
    void cargarCatalogos();
  }, [cargarCatalogos]);

  useEffect(() => {
    void cargarConteos();
  }, [cargarConteos]);

  useEffect(() => {
    if (userBodegaId && !canAccessAllBodegas && !bodegaId) {
      const parsed = Number(userBodegaId);
      const exists = bodegas.some((bodega) => bodega.id === parsed);
      setBodegaId(exists ? parsed : "");
      setFiltroBodega((prev) => prev || (exists ? parsed : ""));
    }
  }, [userBodegaId, canAccessAllBodegas, bodegas, bodegaId]);

  const productoTexto = (producto?: Producto | null) => {
    if (!producto) return "Producto";
    return [
      producto.nombre || producto.codigo,
      producto.tipo,
      producto.genero,
      producto.tela?.nombre,
      producto.talla?.nombre,
      producto.color?.nombre,
    ]
      .filter(Boolean)
      .join(" | ");
  };

  const obtenerTela = (producto?: Producto | null) => producto?.tela?.nombre?.trim() || "N/D";
  const obtenerTalla = (producto?: Producto | null) => producto?.talla?.nombre?.trim() || "N/D";
  const obtenerColor = (producto?: Producto | null) => producto?.color?.nombre?.trim() || "N/D";

  const filtrarProductos = useCallback(
    ({
      tipo = filtroTipoProducto,
      genero = filtroGeneroProducto,
      tela = filtroTelaProducto,
      talla = filtroTallaProducto,
      color = filtroColorProducto,
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
        const matchesTela = !tela || obtenerTela(producto) === tela;
        const matchesTalla = !talla || obtenerTalla(producto) === talla;
        const matchesColor = !color || obtenerColor(producto) === color;
        return matchesTipo && matchesGenero && matchesTela && matchesTalla && matchesColor;
      }),
    [productos, filtroTipoProducto, filtroGeneroProducto, filtroTelaProducto, filtroTallaProducto, filtroColorProducto],
  );

  const tiposDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({
          tipo: "",
          genero: filtroGeneroProducto,
          tela: filtroTelaProducto,
          talla: filtroTallaProducto,
          color: filtroColorProducto,
        }).map((producto) => producto.tipo || ""),
      ),
    [filtrarProductos, filtroGeneroProducto, filtroTelaProducto, filtroTallaProducto, filtroColorProducto],
  );

  const generosDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({
          tipo: filtroTipoProducto,
          genero: "",
          tela: filtroTelaProducto,
          talla: filtroTallaProducto,
          color: filtroColorProducto,
        }).map((producto) => producto.genero || ""),
      ),
    [filtrarProductos, filtroTipoProducto, filtroTelaProducto, filtroTallaProducto, filtroColorProducto],
  );

  const telasDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({
          tipo: filtroTipoProducto,
          genero: filtroGeneroProducto,
          tela: "",
          talla: filtroTallaProducto,
          color: filtroColorProducto,
        }).map((producto) => obtenerTela(producto)),
      ),
    [filtrarProductos, filtroTipoProducto, filtroGeneroProducto, filtroTallaProducto, filtroColorProducto],
  );

  const tallasDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({
          tipo: filtroTipoProducto,
          genero: filtroGeneroProducto,
          tela: filtroTelaProducto,
          talla: "",
          color: filtroColorProducto,
        }).map((producto) => obtenerTalla(producto)),
      ),
    [filtrarProductos, filtroTipoProducto, filtroGeneroProducto, filtroTelaProducto, filtroColorProducto],
  );

  const coloresDisponibles = useMemo(
    () =>
      uniqueSorted(
        filtrarProductos({
          tipo: filtroTipoProducto,
          genero: filtroGeneroProducto,
          tela: filtroTelaProducto,
          talla: filtroTallaProducto,
          color: "",
        }).map((producto) => obtenerColor(producto)),
      ),
    [filtrarProductos, filtroTipoProducto, filtroGeneroProducto, filtroTelaProducto, filtroTallaProducto],
  );

  const productosCoincidentes = useMemo(() => filtrarProductos({}), [filtrarProductos]);

  const productoDetectado = useMemo(() => {
    const term = busquedaProducto.trim().toLowerCase();
    if (term) {
      return (
        productos.find((producto) => producto.codigo.toLowerCase() === term) ||
        productos.find((producto) => producto.codigo.toLowerCase().includes(term)) ||
        null
      );
    }
    return productosCoincidentes.length === 1 ? productosCoincidentes[0] : null;
  }, [productos, productosCoincidentes, busquedaProducto]);

  const limpiarSeleccionProducto = () => {
    setBusquedaProducto("");
    setFiltroTipoProducto("");
    setFiltroGeneroProducto("");
    setFiltroTelaProducto("");
    setFiltroTallaProducto("");
    setFiltroColorProducto("");
  };

  const agregarLinea = async () => {
    if (!bodegaId) {
      Swal.fire("Validacion", "Selecciona la bodega del conteo", "warning");
      return;
    }
    if (!productoDetectado) {
      Swal.fire("Validacion", "Selecciona un producto valido por codigo o por filtros", "warning");
      return;
    }
    const fisico = Number(stockFisico);
    if (!Number.isFinite(fisico) || fisico < 0) {
      Swal.fire("Validacion", "Ingresa el stock fisico contado", "warning");
      return;
    }
    if (detalle.some((row) => row.productoId === productoDetectado.id)) {
      Swal.fire("Validacion", "Este producto ya esta agregado al conteo", "warning");
      return;
    }

    let stockSistema = 0;
    try {
      const resp = await api.get(`/inventario/${bodegaId}/${productoDetectado.id}`);
      stockSistema = Number(resp.data?.stock || 0);
    } catch {
      stockSistema = 0;
    }

    setDetalle((prev) => [
      ...prev,
      {
        key: Date.now(),
        productoId: productoDetectado.id,
        codigo: productoDetectado.codigo,
        producto: productoTexto(productoDetectado),
        stockSistema,
        stockFisico: fisico,
      },
    ]);
    limpiarSeleccionProducto();
    setStockFisico("");
  };

  const guardarConteo = async () => {
    if (guardandoConteoRef.current) return;
    if (!bodegaId) {
      Swal.fire("Validacion", "Selecciona la bodega del conteo", "warning");
      return;
    }
    if (!detalle.length) {
      Swal.fire("Validacion", "Agrega al menos un articulo al conteo", "warning");
      return;
    }
    const diferencias = detalle.filter((row) => row.stockFisico !== row.stockSistema).length;
    const confirmar = await Swal.fire({
      title: "Aplicar conteo fisico",
      text: `Se aplicaran ${detalle.length} linea(s), con ${diferencias} diferencia(s) contra el sistema.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Aplicar",
      cancelButtonText: "Cancelar",
    });
    if (!confirmar.isConfirmed) return;
    if (guardandoConteoRef.current) return;

    try {
      guardandoConteoRef.current = true;
      setGuardandoConteo(true);
      await api.post("/inventario/conteos", {
        bodegaId,
        responsable: usuario || null,
        observaciones: observaciones || null,
        detalle: detalle.map((row) => ({
          productoId: row.productoId,
          stockFisico: row.stockFisico,
        })),
      });
      Swal.fire("Aplicado", "Conteo fisico registrado correctamente", "success");
      setDetalle([]);
      setObservaciones("");
      limpiarSeleccionProducto();
      setStockFisico("");
      await cargarConteos();
      setVista("listado");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo guardar el conteo", "error");
    } finally {
      guardandoConteoRef.current = false;
      setGuardandoConteo(false);
    }
  };

  const columnasConteos: GridColDef<ConteoRegistro>[] = [
    {
      field: "folio",
      headerName: "Folio",
      width: 150,
      renderCell: ({ row }) => <Chip size="small" color="primary" variant="outlined" label={row.folio || `CT-${row.id}`} />,
    },
    { field: "fecha", headerName: "Fecha", width: 170, valueGetter: (_, row) => formatDateTime(row.fecha) },
    { field: "bodega", headerName: "Bodega", width: 180, valueGetter: (_, row) => row.bodega?.nombre || "N/D" },
    { field: "responsable", headerName: "Responsable", width: 180, valueGetter: (_, row) => row.responsable || "N/D" },
    {
      field: "lineas",
      headerName: "Lineas",
      width: 90,
      align: "center",
      headerAlign: "center",
      valueGetter: (_, row) => row.detalle?.length || 0,
    },
    {
      field: "diferencias",
      headerName: "Diferencias",
      width: 110,
      align: "center",
      headerAlign: "center",
      valueGetter: (_, row) => row.detalle?.filter((item) => Number(item.diferencia || 0) !== 0).length || 0,
    },
    {
      field: "estado",
      headerName: "Estado",
      width: 120,
      renderCell: ({ row }) => <Chip size="small" color="success" label={row.estado || "APLICADO"} />,
    },
    {
      field: "acciones",
      headerName: "Acciones",
      width: 120,
      sortable: false,
      renderCell: ({ row }) => (
        <Button size="small" startIcon={<VisibilityOutlined />} onClick={() => setConteoSeleccionado(row)}>
          Ver
        </Button>
      ),
    },
  ];

  const columnasDetalle: GridColDef<DetalleCaptura>[] = [
    { field: "codigo", headerName: "Codigo", width: 140 },
    { field: "producto", headerName: "Producto", flex: 1, minWidth: 260 },
    { field: "stockSistema", headerName: "Sistema", width: 100, align: "center", headerAlign: "center" },
    { field: "stockFisico", headerName: "Fisico", width: 100, align: "center", headerAlign: "center" },
    {
      field: "diferencia",
      headerName: "Diferencia",
      width: 120,
      align: "center",
      headerAlign: "center",
      valueGetter: (_, row) => row.stockFisico - row.stockSistema,
      renderCell: ({ row }) => {
        const diff = row.stockFisico - row.stockSistema;
        return <Chip size="small" color={diff === 0 ? "default" : diff > 0 ? "success" : "error"} label={diff} />;
      },
    },
    {
      field: "acciones",
      headerName: "Acciones",
      width: 100,
      sortable: false,
      renderCell: ({ row }) => (
        <IconButton color="error" onClick={() => setDetalle((prev) => prev.filter((item) => item.key !== row.key))}>
          <DeleteIcon />
        </IconButton>
      ),
    },
  ];

  if (vista === "nuevo") {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1} sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <InventoryOutlined color="primary" />
            <Typography variant="h4">Nuevo conteo fisico</Typography>
          </Stack>
          <Button startIcon={<ArrowBackOutlined />} variant="outlined" onClick={() => setVista("listado")}>
            Regresar
          </Button>
        </Stack>

        <Divider sx={{ mb: 2 }} />

        <Stack spacing={2}>
          <Alert severity="info">
            El conteo fisico ajusta el stock al valor contado y registra la diferencia en el Kardex.
          </Alert>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Bodega</InputLabel>
              <Select
                label="Bodega"
                value={bodegaId}
                onChange={(e) => {
                  setBodegaId(Number(e.target.value));
                  setDetalle([]);
                }}
                disabled={!canAccessAllBodegas && bodegas.length <= 1}
              >
                {bodegas.map((bodega) => (
                  <MenuItem key={bodega.id} value={bodega.id}>
                    {bodega.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Observaciones"
              fullWidth
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </Stack>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Grid container spacing={2} alignItems="flex-start">
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Codigo de producto"
                  value={busquedaProducto}
                  onChange={(e) => setBusquedaProducto(e.target.value)}
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                  helperText={productoDetectado ? productoTexto(productoDetectado) : "Puedes escribir el codigo o usar los filtros"}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Tipo</InputLabel>
                  <Select label="Tipo" value={filtroTipoProducto} onChange={(e) => setFiltroTipoProducto(e.target.value)}>
                    <MenuItem value="">Todos</MenuItem>
                    {tiposDisponibles.map((tipo) => (
                      <MenuItem key={tipo} value={tipo}>
                        {tipo}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Genero</InputLabel>
                  <Select label="Genero" value={filtroGeneroProducto} onChange={(e) => setFiltroGeneroProducto(e.target.value)}>
                    <MenuItem value="">Todos</MenuItem>
                    {generosDisponibles.map((genero) => (
                      <MenuItem key={genero} value={genero}>
                        {genero}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Tela</InputLabel>
                  <Select label="Tela" value={filtroTelaProducto} onChange={(e) => setFiltroTelaProducto(e.target.value)}>
                    <MenuItem value="">Todas</MenuItem>
                    {telasDisponibles.map((tela) => (
                      <MenuItem key={tela} value={tela}>
                        {tela}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Talla</InputLabel>
                  <Select label="Talla" value={filtroTallaProducto} onChange={(e) => setFiltroTallaProducto(e.target.value)}>
                    <MenuItem value="">Todas</MenuItem>
                    {tallasDisponibles.map((talla) => (
                      <MenuItem key={talla} value={talla}>
                        {talla}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Color</InputLabel>
                  <Select label="Color" value={filtroColorProducto} onChange={(e) => setFiltroColorProducto(e.target.value)}>
                    <MenuItem value="">Todos</MenuItem>
                    {coloresDisponibles.map((color) => (
                      <MenuItem key={color} value={color}>
                        {color}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                <TextField
                  label="Producto detectado"
                  value={productoDetectado?.codigo || ""}
                  fullWidth
                  disabled
                  helperText={
                    busquedaProducto.trim()
                      ? productoDetectado
                        ? "Codigo encontrado"
                        : "No existe ese codigo"
                      : productosCoincidentes.length === 1
                        ? "Detectado por filtros"
                        : productosCoincidentes.length > 1
                          ? `${productosCoincidentes.length} coincidencias`
                          : "Sin coincidencias"
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                <TextField
                  label="Stock fisico"
                  value={stockFisico}
                  onChange={(e) => setStockFisico(e.target.value.replace(/[^\d]/g, ""))}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <Button startIcon={<AddIcon />} variant="contained" onClick={agregarLinea} fullWidth sx={{ minHeight: 56 }}>
                  Agregar
                </Button>
              </Grid>
            </Grid>
          </Paper>

          <div style={{ height: 420, width: "100%" }}>
            <DataGrid
              rows={detalle}
              columns={columnasDetalle}
              getRowId={(row) => row.key}
              pageSizeOptions={[10, 25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            />
          </div>

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography>
              Lineas: {detalle.length} | Diferencias: {detalle.filter((row) => row.stockFisico !== row.stockSistema).length}
            </Typography>
            <Button variant="contained" color="success" onClick={guardarConteo} disabled={guardandoConteo}>
              {guardandoConteo ? "Aplicando..." : "Aplicar conteo"}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1} sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <InventoryOutlined color="primary" />
          <Typography variant="h4">Conteos fisicos</Typography>
        </Stack>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setVista("nuevo")}>
          Nuevo conteo
        </Button>
      </Stack>

      <Divider sx={{ mb: 2 }} />

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            label="Desde"
            type="date"
            value={filtroDesde}
            onChange={(e) => setFiltroDesde(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Hasta"
            type="date"
            value={filtroHasta}
            onChange={(e) => setFiltroHasta(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel>Bodega</InputLabel>
            <Select
              label="Bodega"
              value={filtroBodega}
              onChange={(e) => {
                const value = e.target.value as number | "";
                setFiltroBodega(value === "" ? "" : Number(value));
              }}
              disabled={!canAccessAllBodegas && bodegas.length <= 1}
            >
              {canAccessAllBodegas && <MenuItem value="">Todas</MenuItem>}
              {bodegas.map((bodega) => (
                <MenuItem key={bodega.id} value={bodega.id}>
                  {bodega.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<ClearIcon />}
            onClick={() => {
              setFiltroDesde(today);
              setFiltroHasta(today);
              setFiltroBodega("");
            }}
          >
            Limpiar
          </Button>
        </Stack>
      </Paper>

      <div style={{ height: 620, width: "100%" }}>
        <DataGrid
          loading={loading}
          rows={conteos}
          columns={columnasConteos}
          getRowId={(row) => row.id}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        />
      </div>

      {conteoSeleccionado && (
        <SwalDetail conteo={conteoSeleccionado} onClose={() => setConteoSeleccionado(null)} />
      )}
    </Paper>
  );
}

function SwalDetail({ conteo, onClose }: { conteo: ConteoRegistro; onClose: () => void }) {
  useEffect(() => {
    const rows = (conteo.detalle || [])
      .map((item) => {
        const diff = Number(item.diferencia || 0);
        return `<tr><td>${item.producto?.codigo || item.productoId}</td><td>${item.producto?.nombre || "Producto"}</td><td>${item.stockSistema}</td><td>${item.stockFisico}</td><td style="color:${diff < 0 ? "#d32f2f" : diff > 0 ? "#2e7d32" : "#555"}">${diff}</td></tr>`;
      })
      .join("");
    void Swal.fire({
      title: conteo.folio || `Conteo #${conteo.id}`,
      width: 820,
      html: `
        <div style="text-align:left;margin-bottom:12px">
          <b>Bodega:</b> ${conteo.bodega?.nombre || "N/D"}<br/>
          <b>Fecha:</b> ${formatDateTime(conteo.fecha)}<br/>
          <b>Responsable:</b> ${conteo.responsable || "N/D"}
        </div>
        <table style="width:100%;text-align:left;border-collapse:collapse">
          <thead><tr><th>Codigo</th><th>Producto</th><th>Sistema</th><th>Fisico</th><th>Diferencia</th></tr></thead>
          <tbody>${rows || "<tr><td colspan='5'>Sin detalle</td></tr>"}</tbody>
        </table>
      `,
      willClose: onClose,
    });
  }, [conteo, onClose]);

  return null;
}
