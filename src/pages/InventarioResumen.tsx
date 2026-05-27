import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Divider,
  FormControl,
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
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";

interface Bodega {
  id: number;
  nombre: string;
}

interface ReporteRow {
  id: number;
  productoId: number;
  codigo: string;
  producto: string;
  tipo?: string | null;
  genero?: string | null;
  talla: string | null;
  color: string | null;
  tela: string | null;
  stockMax: number;
  stock: number;
  bodega: string;
  bodegaId?: number;
  total?: number;
  stocks?: Record<string | number, number>;
  [key: string]: any;
}

const sortOptions = (values: string[]) => values.sort((a, b) => a.localeCompare(b));

export default function InventarioResumen() {
  const { rol, permisos } = useAuthStore();
  const canViewKardex = hasPermission(rol, permisos, "inventario.kardex.view");
  const canViewMinimos = hasPermission(rol, permisos, "inventario.minimos.view") || hasPermission(rol, permisos, "inventario.minimos.manage");
  const canManageMinimos = hasPermission(rol, permisos, "inventario.minimos.manage");
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [rows, setRows] = useState<ReporteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroGenero, setFiltroGenero] = useState("");
  const [filtroTela, setFiltroTela] = useState("");
  const [filtroTalla, setFiltroTalla] = useState("");
  const [filtroColor, setFiltroColor] = useState("");

  const cargar = async () => {
    setLoading(true);
    try {
      const [respBod, respRep] = await Promise.all([
        api.get("/bodegas"),
        api.get("/inventario/resumen"),
      ]);
      const bodegasList = respBod.data as Bodega[];
      const rawRows = (respRep.data as ReporteRow[]) || [];

      const expanded: ReporteRow[] = rawRows.map((r) => {
        const copy: any = { ...r, id: Number(r.id ?? r.productoId) };
        const tipoNormalizado = r.tipo && r.tipo !== "N/D" ? r.tipo : r.producto;
        copy.tipo = tipoNormalizado || "N/D";
        copy.genero = r.genero || "N/D";
        bodegasList.forEach((b) => {
          copy[`bodega_${b.id}`] = r.stocks?.[b.id] ?? r.stocks?.[String(b.id)] ?? 0;
        });
        return copy;
      });

      setBodegas(bodegasList);
      setRows(expanded);
    } catch (error) {
      Swal.fire("Error", "No se pudo cargar inventario o bodegas", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const uniqueOptions = (field: keyof ReporteRow) =>
    sortOptions(
      Array.from(
        new Set(
          rows
            .map((row) => `${row[field] || ""}`.trim())
            .filter((value) => value && value !== "N/D"),
        ),
      ),
    );

  const filteredRows = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesCodigo = !term || r.codigo.toLowerCase().includes(term);
      const matchesTipo = !filtroTipo || r.tipo === filtroTipo;
      const matchesGenero = !filtroGenero || r.genero === filtroGenero;
      const matchesTela = !filtroTela || r.tela === filtroTela;
      const matchesTalla = !filtroTalla || r.talla === filtroTalla;
      const matchesColor = !filtroColor || r.color === filtroColor;
      return matchesCodigo && matchesTipo && matchesGenero && matchesTela && matchesTalla && matchesColor;
    });
  }, [rows, busqueda, filtroTipo, filtroGenero, filtroTela, filtroTalla, filtroColor]);

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroTipo("");
    setFiltroGenero("");
    setFiltroTela("");
    setFiltroTalla("");
    setFiltroColor("");
  };

  const pedirBodega = async (titulo: string) => {
    if (!bodegas.length) {
      Swal.fire("Aviso", "No hay bodegas disponibles", "info");
      return null;
    }
    const resp = await Swal.fire({
      title: titulo,
      input: "select",
      inputOptions: bodegas.reduce<Record<string, string>>((acc, bodega) => {
        acc[String(bodega.id)] = bodega.nombre;
        return acc;
      }, {}),
      inputPlaceholder: "Selecciona bodega",
      showCancelButton: true,
      confirmButtonText: "Continuar",
    });
    return resp.isConfirmed && resp.value ? Number(resp.value) : null;
  };

  const verKardex = async (row: ReporteRow) => {
    const bodegaId = await pedirBodega(`Kardex de ${row.codigo}`);
    if (!bodegaId) return;
    try {
      const resp = await api.get("/inventario/kardex", {
        params: { productoId: row.id, bodegaId },
      });
      const movimientos = Array.isArray(resp.data) ? resp.data : [];
      const rowsHtml = movimientos
        .slice(0, 30)
        .map(
          (mov: any) =>
            `<tr><td>${new Date(mov.fecha).toLocaleString("es-GT")}</td><td>${mov.tipo}</td><td>${mov.cantidad}</td><td>${mov.referencia || "-"}</td></tr>`,
        )
        .join("");
      await Swal.fire({
        title: `Kardex ${row.codigo}`,
        width: 760,
        html: movimientos.length
          ? `<table style="width:100%;text-align:left;border-collapse:collapse"><thead><tr><th>Fecha</th><th>Tipo</th><th>Cantidad</th><th>Referencia</th></tr></thead><tbody>${rowsHtml}</tbody></table>`
          : "No hay movimientos registrados para este articulo en la bodega seleccionada.",
      });
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo cargar el kardex", "error");
    }
  };

  const guardarMinimo = async (row: ReporteRow) => {
    const bodegaId = await pedirBodega(`Stock minimo de ${row.codigo}`);
    if (!bodegaId) return;
    const resp = await Swal.fire({
      title: "Stock minimo",
      input: "number",
      inputValue: 0,
      inputAttributes: { min: "0", step: "1" },
      showCancelButton: true,
      confirmButtonText: "Guardar",
    });
    if (!resp.isConfirmed) return;
    try {
      await api.put("/inventario/minimos", {
        bodegaId,
        productoId: row.id,
        minimo: Number(resp.value || 0),
      });
      Swal.fire("Guardado", "Minimo actualizado", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo guardar el minimo", "error");
    }
  };

  const verAlertas = async () => {
    try {
      const resp = await api.get("/inventario/alertas-bodega");
      const alertas = Array.isArray(resp.data) ? resp.data : [];
      const rowsHtml = alertas
        .map(
          (alerta: any) =>
            `<tr><td>${alerta.bodega?.nombre || "N/D"}</td><td>${alerta.producto?.codigo || alerta.productoId}</td><td>${alerta.stock}</td><td>${alerta.minimo}</td><td>${alerta.faltan}</td></tr>`,
        )
        .join("");
      Swal.fire({
        title: "Alertas de stock por bodega",
        width: 760,
        html: alertas.length
          ? `<table style="width:100%;text-align:left;border-collapse:collapse"><thead><tr><th>Bodega</th><th>Codigo</th><th>Stock</th><th>Minimo</th><th>Faltan</th></tr></thead><tbody>${rowsHtml}</tbody></table>`
          : "No hay articulos por debajo de su minimo.",
      });
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudieron cargar las alertas", "error");
    }
  };

  const renderFilterSelect = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: string[],
  ) => (
    <FormControl size="small" sx={{ minWidth: 160, flex: "1 1 160px" }}>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        <MenuItem value="">Todos</MenuItem>
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  const columns: GridColDef<ReporteRow>[] = (() => {
    const base: GridColDef<ReporteRow>[] = [
      { field: "codigo", headerName: "Codigo", width: 140 },
      { field: "tipo", headerName: "Tipo", width: 140 },
      { field: "genero", headerName: "Genero", width: 120 },
      { field: "talla", headerName: "Talla", width: 100 },
      { field: "color", headerName: "Color", width: 120 },
      { field: "tela", headerName: "Tela", width: 140 },
      { field: "total", headerName: "Total", width: 100 },
      ...(canViewKardex || canManageMinimos ? [{
        field: "acciones",
        headerName: "Acciones",
        width: 180,
        sortable: false,
        renderCell: ({ row }: { row: ReporteRow }) => (
          <Stack direction="row" spacing={0.5}>
            {canViewKardex && (
              <Button size="small" onClick={() => verKardex(row)}>
                Kardex
              </Button>
            )}
            {canManageMinimos && (
              <Button size="small" onClick={() => guardarMinimo(row)}>
                Minimo
              </Button>
            )}
          </Stack>
        ),
      }] : []),
    ];

    const dynamic = bodegas.map((b) => ({
      field: `bodega_${b.id}`,
      headerName: b.nombre,
      renderHeader: () => (
        <Typography
          variant="caption"
          sx={{ whiteSpace: "normal", textAlign: "center", lineHeight: 1.1 }}
        >
          {b.nombre}
        </Typography>
      ),
      width: 110,
    }));

    return [...base, ...dynamic];
  })();

  return (
    <Paper sx={{ p: 3, height: "100%" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 1 }}
      >
        <Typography variant="h4">Resumen de inventario por bodega</Typography>
      </Stack>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        sx={{ mb: 2 }}
        alignItems={{ xs: "stretch", md: "center" }}
        flexWrap="wrap"
      >
        <TextField
          size="small"
          placeholder="Buscar por codigo"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: busqueda ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setBusqueda("")}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          }}
          sx={{ minWidth: 220, flex: "1 1 220px" }}
        />
        {renderFilterSelect("Tipo", filtroTipo, setFiltroTipo, uniqueOptions("tipo"))}
        {renderFilterSelect("Genero", filtroGenero, setFiltroGenero, uniqueOptions("genero"))}
        {renderFilterSelect("Tela", filtroTela, setFiltroTela, uniqueOptions("tela"))}
        {renderFilterSelect("Talla", filtroTalla, setFiltroTalla, uniqueOptions("talla"))}
        {renderFilterSelect("Color", filtroColor, setFiltroColor, uniqueOptions("color"))}
        <Button variant="outlined" onClick={limpiarFiltros} sx={{ flex: "0 0 auto" }}>
          Limpiar
        </Button>
        {canViewMinimos && (
          <Button variant="contained" onClick={verAlertas} sx={{ flex: "0 0 auto" }}>
            Alertas
          </Button>
        )}
      </Stack>

      <Divider sx={{ mb: 2 }} />

      <div style={{ height: 650, width: "100%" }}>
        <DataGrid
          loading={loading}
          rows={filteredRows}
          columns={columns}
          getRowId={(row) => row.id}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        />
      </div>
    </Paper>
  );
}
