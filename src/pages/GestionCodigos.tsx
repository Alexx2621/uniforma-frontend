import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, FormControlLabel, Grid, Paper, Stack,
  MenuItem,
  Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TextField, Typography,
} from "@mui/material";
import AddBoxOutlined from "@mui/icons-material/AddBoxOutlined";
import AutoFixHighOutlined from "@mui/icons-material/AutoFixHighOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";

type TabValue = "crear" | "actualizar" | "sin-uso" | "instrucciones";
type Filters = { tipos: string; generos: string; telas: string; tallas: string; colores: string };
type UnusedFilters = { tipo: string; genero: string; tela: string; talla: string; color: string; categoria: string };
type UnusedProduct = {
  id: number; codigo: string; nombre: string; tipo?: string; genero?: string;
  precio: number; stockMax: number; categoria?: string; tela?: string; talla?: string; color?: string;
};

const emptyFilters = (): Filters => ({ tipos: "", generos: "", telas: "", tallas: "", colores: "" });
const emptyUnusedFilters = (): UnusedFilters => ({ tipo: "", genero: "", tela: "", talla: "", color: "", categoria: "" });
const csv = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
const normalize = (value: unknown) => `${value ?? ""}`.trim().toLocaleLowerCase("es-GT");
const uniqueOptions = (values: unknown[]) => Array.from(new Set(values.map((value) => `${value ?? ""}`.trim()).filter(Boolean)))
  .sort((a, b) => a.localeCompare(b, "es"));
const getMessage = (error: any, fallback: string) => {
  const message = error?.response?.data?.message || error?.message || fallback;
  return Array.isArray(message) ? message.join(", ") : message;
};
const escapeHtml = (value: unknown) => `${value ?? ""}`
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

const previewStyles = `
  <style>
    .code-preview{text-align:left;color:#17243a;font-family:Arial,sans-serif}
    .code-preview__intro{color:#64748b;font-size:13px;margin:0 0 16px}
    .code-preview__summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:18px}
    .code-preview__card{border:1px solid #e6ebf2;border-radius:12px;padding:13px;background:#f8fafc}
    .code-preview__value{display:block;font-size:24px;font-weight:700;line-height:1.1;color:#18366f}
    .code-preview__label{display:block;color:#64748b;font-size:12px;margin-top:5px}
    .code-preview__table-wrap{border:1px solid #e6ebf2;border-radius:12px;overflow:auto;max-height:360px}
    .code-preview table{width:100%;border-collapse:collapse;font-size:12px;min-width:700px}
    .code-preview th{position:sticky;top:0;background:#f3f5f8;color:#475569;padding:10px;text-align:left;font-weight:700;border-bottom:1px solid #e6ebf2}
    .code-preview td{padding:9px 10px;border-bottom:1px solid #edf0f5;vertical-align:middle}
    .code-preview tr:last-child td{border-bottom:0}
    .code-preview__code{font-family:Consolas,monospace;font-weight:700;color:#18366f}
    .code-preview__badge{display:inline-block;border-radius:999px;padding:3px 8px;font-weight:700;font-size:11px}
    .code-preview__badge--create{background:#dcfce7;color:#166534}
    .code-preview__badge--skip{background:#f1f5f9;color:#475569}
    .code-preview__badge--update{background:#dbeafe;color:#1e40af}
    .code-preview__note{display:flex;gap:8px;margin-top:14px;padding:11px 12px;border-radius:10px;background:#eff6ff;color:#1e3a8a;font-size:12px;line-height:1.45}
    @media(max-width:640px){.code-preview__summary{grid-template-columns:1fr}.code-preview__value{font-size:20px}}
  </style>`;

const renderCreationPreview = (data: any) => {
  const samples = Array.isArray(data?.muestras) ? data.muestras : [];
  const rows = samples.map((item: any) => `
    <tr>
      <td class="code-preview__code">${escapeHtml(item.codigo)}</td>
      <td>${escapeHtml(item.tipo)} / ${escapeHtml(item.genero)}</td>
      <td>${escapeHtml([item.tela, item.talla, item.color].filter(Boolean).join(" / "))}</td>
      <td>Q ${Number(item.precio || 0).toFixed(2)}</td>
      <td><span class="code-preview__badge ${item.existe ? "code-preview__badge--skip" : "code-preview__badge--create"}">${item.existe ? "Omitir" : "Crear"}</span></td>
    </tr>`).join("");
  return `${previewStyles}<div class="code-preview">
    <p class="code-preview__intro">Resultado de validar las combinaciones solicitadas contra el catalogo actual.</p>
    <div class="code-preview__summary">
      <div class="code-preview__card"><span class="code-preview__value">${Number(data?.totalCombinaciones || 0)}</span><span class="code-preview__label">Combinaciones evaluadas</span></div>
      <div class="code-preview__card"><span class="code-preview__value" style="color:#15803d">${Number(data?.seCrearian || 0)}</span><span class="code-preview__label">Codigos nuevos</span></div>
      <div class="code-preview__card"><span class="code-preview__value" style="color:#64748b">${Number(data?.existentes || 0)}</span><span class="code-preview__label">Existentes omitidos</span></div>
    </div>
    <div class="code-preview__table-wrap"><table><thead><tr><th>Codigo</th><th>Producto</th><th>Combinacion</th><th>Precio</th><th>Accion</th></tr></thead><tbody>${rows || '<tr><td colspan="5" style="text-align:center;padding:28px">Sin combinaciones para mostrar</td></tr>'}</tbody></table></div>
    <div class="code-preview__note"><b>Validacion:</b><span>Si la combinacion de tipo, genero, tela, talla y color ya existe, se omite. No se crea otro codigo cambiando la abreviacion o agregando un sufijo.</span></div>
  </div>`;
};

const renderUpdatePreview = (data: any) => {
  const samples = Array.isArray(data?.muestras) ? data.muestras : [];
  const changes = data?.cambios || {};
  const changeLabels = [changes.precio !== undefined && `Precio → Q ${Number(changes.precio).toFixed(2)}`, changes.stockMax !== undefined && `Stock max. → ${changes.stockMax}`, changes.mermaPorcentaje !== undefined && `Merma → ${changes.mermaPorcentaje}%`].filter(Boolean);
  const rows = samples.map((item: any) => `
    <tr><td class="code-preview__code">${escapeHtml(item.codigo)}</td><td>${escapeHtml(item.tipo)} / ${escapeHtml(item.genero)}</td><td>${escapeHtml([item.tela,item.talla,item.color].filter(Boolean).join(" / "))}</td><td>${escapeHtml(changeLabels.join(" · "))}</td><td><span class="code-preview__badge code-preview__badge--update">Actualizar</span></td></tr>`).join("");
  return `${previewStyles}<div class="code-preview">
    <p class="code-preview__intro">Productos que coinciden con los filtros y valores que cambiaran.</p>
    <div class="code-preview__summary">
      <div class="code-preview__card"><span class="code-preview__value">${Number(data?.totalCoincidencias || 0)}</span><span class="code-preview__label">Codigos encontrados</span></div>
      <div class="code-preview__card" style="grid-column:span 2"><span style="display:block;font-weight:700;margin-bottom:6px">Cambios seleccionados</span><span style="color:#64748b;font-size:13px">${escapeHtml(changeLabels.join(" · ") || "Ningun cambio")}</span></div>
    </div>
    <div class="code-preview__table-wrap"><table><thead><tr><th>Codigo</th><th>Producto</th><th>Combinacion</th><th>Cambios</th><th>Accion</th></tr></thead><tbody>${rows || '<tr><td colspan="5" style="text-align:center;padding:28px">Sin coincidencias</td></tr>'}</tbody></table></div>
    <div class="code-preview__note"><b>Importante:</b><span>La vista muestra hasta 12 ejemplos. El contador superior indica el total real que sera actualizado.</span></div>
  </div>`;
};

function PageHeader() {
  return (
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
      <Box>
        <Typography variant="h4">Gestion de codigos</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Crea, actualiza y depura codigos de producto desde un espacio controlado.
        </Typography>
      </Box>
      <Chip icon={<FactCheckOutlined />} label="Vista previa antes de cada cambio" color="primary" variant="outlined" />
    </Stack>
  );
}

function FilterFields({ value, onChange }: { value: Filters; onChange: (value: Filters) => void }) {
  const fields: Array<[keyof Filters, string, string]> = [
    ["tipos", "Tipos", "FILIPINA, PANTALON"], ["generos", "Generos", "DAMA, CABALLERO"],
    ["telas", "Telas", "REPEL, SWAN"], ["tallas", "Tallas", "S, M, L"],
    ["colores", "Colores", "AZUL, BLANCO"],
  ];
  return (
    <Grid container spacing={2}>
      {fields.map(([key, label, placeholder]) => (
        <Grid key={key} size={{ xs: 12, sm: 6, lg: key === "colores" ? 4 : 2 }}>
          <TextField label={label} placeholder={placeholder} value={value[key]} fullWidth
            onChange={(event) => onChange({ ...value, [key]: event.target.value })}
            helperText="Separar con comas" />
        </Grid>
      ))}
    </Grid>
  );
}

export default function GestionCodigos() {
  const [tab, setTab] = useState<TabValue>("crear");
  const [loading, setLoading] = useState(false);
  const [createFilters, setCreateFilters] = useState(emptyFilters);
  const [createExtra, setCreateExtra] = useState({ categoria: "", abreviacion: "", especial: "", precio: 275, stockMax: 10, merma: 0 });
  const [updateFilters, setUpdateFilters] = useState(emptyFilters);
  const [changes, setChanges] = useState({ precioOn: true, precio: 0, stockOn: false, stock: 0, mermaOn: false, merma: 0 });
  const [unused, setUnused] = useState<UnusedProduct[]>([]);
  const [search, setSearch] = useState("");
  const [unusedFilters, setUnusedFilters] = useState<UnusedFilters>(emptyUnusedFilters);
  const [unusedPage, setUnusedPage] = useState(0);
  const [unusedRowsPerPage, setUnusedRowsPerPage] = useState(25);
  const [selectedUnusedIds, setSelectedUnusedIds] = useState<Set<number>>(() => new Set());

  const createPayload = () => ({
    filtros: { ...Object.fromEntries(Object.entries(createFilters).map(([key, value]) => [key, csv(value)])), categoria: createExtra.categoria, tipoAbreviacion: createExtra.abreviacion, codigoEspecial: createExtra.especial },
    valores: { precio: Number(createExtra.precio), stockMax: Number(createExtra.stockMax), mermaPorcentaje: Number(createExtra.merma) },
  });
  const updatePayload = () => ({
    filtros: Object.fromEntries(Object.entries(updateFilters).map(([key, value]) => [key, csv(value)])),
    cambios: { ...(changes.precioOn ? { precio: Number(changes.precio) } : {}), ...(changes.stockOn ? { stockMax: Number(changes.stock) } : {}), ...(changes.mermaOn ? { mermaPorcentaje: Number(changes.merma) } : {}) },
  });

  const preview = async (kind: "creacion" | "actualizacion") => {
    try {
      setLoading(true);
      const { data } = await api.post(`/productos/${kind}-masiva/preview`, kind === "creacion" ? createPayload() : updatePayload());
      const total = kind === "creacion" ? data?.totalCombinaciones : data?.totalCoincidencias;
      const affected = kind === "creacion" ? data?.seCrearian : total;
      await Swal.fire({
        title: kind === "creacion" ? "Vista previa de creacion" : "Vista previa de actualizacion",
        html: kind === "creacion" ? renderCreationPreview(data) : renderUpdatePreview(data),
        width: 980,
        confirmButtonText: "Entendido",
        customClass: { popup: "uniforma-preview-modal" },
      });
      return Number(affected || 0);
    } catch (error) { Swal.fire("Error", getMessage(error, "No se pudo generar la vista previa"), "error"); return -1; }
    finally { setLoading(false); }
  };

  const execute = async (kind: "creacion" | "actualizacion") => {
    const count = await preview(kind);
    if (count <= 0) return;
    const result = await Swal.fire({ title: `Confirmar ${kind}`, text: `Se procesaran ${count} codigos.`, icon: "warning", showCancelButton: true, confirmButtonText: "Confirmar", cancelButtonText: "Cancelar" });
    if (!result.isConfirmed) return;
    try {
      setLoading(true);
      const { data } = await api.post(`/productos/${kind}-masiva`, kind === "creacion" ? createPayload() : updatePayload());
      Swal.fire("Proceso completado", kind === "creacion" ? `Codigos creados: ${data?.creados || 0}` : `Codigos actualizados: ${data?.actualizados || 0}`, "success");
    } catch (error) { Swal.fire("Error", getMessage(error, "No se pudo completar el proceso"), "error"); }
    finally { setLoading(false); }
  };

  const loadUnused = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/productos/gestion/codigos-sin-uso");
      const products: UnusedProduct[] = data?.productos || [];
      const availableIds = new Set(products.map((item) => item.id));
      setUnused(products);
      setSelectedUnusedIds((current) => new Set([...current].filter((id) => availableIds.has(id))));
    }
    catch (error) { Swal.fire("Error", getMessage(error, "No se pudieron revisar los codigos"), "error"); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (tab === "sin-uso") void loadUnused(); }, [tab]);

  const removeUnused = async (product: UnusedProduct) => {
    const result = await Swal.fire({ title: `Eliminar ${product.codigo}`, text: "Solo se eliminara si continua sin stock ni historial relacionado.", icon: "warning", showCancelButton: true, confirmButtonText: "Eliminar codigo", confirmButtonColor: "#d32f2f" });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/productos/${product.id}`);
      setUnused((items) => items.filter((item) => item.id !== product.id));
      setSelectedUnusedIds((current) => {
        const next = new Set(current);
        next.delete(product.id);
        return next;
      });
      Swal.fire("Eliminado", "El codigo fue eliminado.", "success");
    }
    catch (error) { Swal.fire("No se pudo eliminar", getMessage(error, "El codigo tiene referencias relacionadas"), "error"); }
  };
  const unusedOptions = useMemo(() => ({
    tipo: uniqueOptions(unused.map((item) => item.tipo)),
    genero: uniqueOptions(unused.map((item) => item.genero)),
    tela: uniqueOptions(unused.map((item) => item.tela)),
    talla: uniqueOptions(unused.map((item) => item.talla)),
    color: uniqueOptions(unused.map((item) => item.color)),
    categoria: uniqueOptions(unused.map((item) => item.categoria)),
  }), [unused]);
  const visibleUnused = useMemo(() => {
    const query = normalize(search);
    return unused.filter((item) => {
      const searchable = normalize([item.codigo, item.nombre, item.tipo, item.genero, item.tela, item.talla, item.color, item.categoria].filter(Boolean).join(" "));
      return (!query || searchable.includes(query))
        && (!unusedFilters.tipo || normalize(item.tipo) === normalize(unusedFilters.tipo))
        && (!unusedFilters.genero || normalize(item.genero) === normalize(unusedFilters.genero))
        && (!unusedFilters.tela || normalize(item.tela) === normalize(unusedFilters.tela))
        && (!unusedFilters.talla || normalize(item.talla) === normalize(unusedFilters.talla))
        && (!unusedFilters.color || normalize(item.color) === normalize(unusedFilters.color))
        && (!unusedFilters.categoria || normalize(item.categoria) === normalize(unusedFilters.categoria));
    });
  }, [unused, search, unusedFilters]);
  const paginatedUnused = useMemo(
    () => visibleUnused.slice(unusedPage * unusedRowsPerPage, unusedPage * unusedRowsPerPage + unusedRowsPerPage),
    [visibleUnused, unusedPage, unusedRowsPerPage],
  );
  const currentPageUnusedIds = useMemo(
    () => paginatedUnused.map((item) => item.id),
    [paginatedUnused],
  );
  const allCurrentPageSelected = currentPageUnusedIds.length > 0
    && currentPageUnusedIds.every((id) => selectedUnusedIds.has(id));
  const someCurrentPageSelected = currentPageUnusedIds.some((id) => selectedUnusedIds.has(id));
  const toggleCurrentPageSelection = () => {
    setSelectedUnusedIds((current) => {
      const next = new Set(current);
      if (allCurrentPageSelected) currentPageUnusedIds.forEach((id) => next.delete(id));
      else currentPageUnusedIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const toggleUnusedSelection = (id: number) => {
    setSelectedUnusedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  useEffect(() => {
    const lastPage = Math.max(0, Math.ceil(visibleUnused.length / unusedRowsPerPage) - 1);
    if (unusedPage > lastPage) setUnusedPage(lastPage);
  }, [visibleUnused.length, unusedPage, unusedRowsPerPage]);

  const updateUnusedFilter = (key: keyof UnusedFilters, value: string) => {
    setUnusedFilters((current) => ({ ...current, [key]: value }));
    setUnusedPage(0);
  };

  return (
    <Stack spacing={2.5}>
      <PageHeader />
      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ px: 1, borderBottom: 1, borderColor: "divider" }}>
          <Tab value="crear" icon={<AddBoxOutlined />} iconPosition="start" label="Crear codigos" />
          <Tab value="actualizar" icon={<AutoFixHighOutlined />} iconPosition="start" label="Actualizar" />
          <Tab value="sin-uso" icon={<DeleteOutlineOutlined />} iconPosition="start" label="Sin uso" />
          <Tab value="instrucciones" icon={<MenuBookOutlined />} iconPosition="start" label="Instrucciones" />
        </Tabs>

        <Box sx={{ p: { xs: 2, md: 3 } }}>
          {tab === "crear" && <Stack spacing={2.5}>
            <Alert severity="info">Los campos admiten listas separadas por comas. Una vista previa mostrara las combinaciones antes de crearlas.</Alert>
            <FilterFields value={createFilters} onChange={setCreateFilters} />
            <Grid container spacing={2}>
              {[ ["categoria", "Categoria", "Vacio = mismo tipo"], ["abreviacion", "Abreviacion del tipo", "Ej. F"], ["especial", "Sufijo especial", "Ej. OLD"] ].map(([key, label, helper]) => <Grid key={key} size={{ xs: 12, md: 4 }}><TextField fullWidth label={label} helperText={helper} value={(createExtra as any)[key]} onChange={(e) => setCreateExtra({ ...createExtra, [key]: e.target.value })}/></Grid>)}
              {[ ["precio", "Precio"], ["stockMax", "Stock maximo"], ["merma", "Merma %"] ].map(([key, label]) => <Grid key={key} size={{ xs: 12, md: 4 }}><TextField fullWidth type="number" label={label} value={(createExtra as any)[key]} onChange={(e) => setCreateExtra({ ...createExtra, [key]: Number(e.target.value) })}/></Grid>)}
            </Grid>
            <Stack direction="row" justifyContent="flex-end" spacing={1}><Button variant="outlined" disabled={loading} onClick={() => void preview("creacion")}>Vista previa</Button><Button variant="contained" disabled={loading} onClick={() => void execute("creacion")}>Crear codigos</Button></Stack>
          </Stack>}

          {tab === "actualizar" && <Stack spacing={2.5}>
            <Alert severity="warning">Los filtros vacios incluyen todos los valores. Revisa siempre la vista previa.</Alert>
            <FilterFields value={updateFilters} onChange={setUpdateFilters} />
            <Grid container spacing={2}>
              {[ ["precioOn", "precio", "Nuevo precio"], ["stockOn", "stock", "Nuevo stock maximo"], ["mermaOn", "merma", "Nueva merma %"] ].map(([toggle, key, label]) => <Grid key={key} size={{ xs: 12, md: 4 }}><Stack direction="row" alignItems="center"><FormControlLabel control={<Checkbox checked={(changes as any)[toggle]} onChange={(e) => setChanges({ ...changes, [toggle]: e.target.checked })}/>} label=""/><TextField fullWidth type="number" label={label} disabled={!(changes as any)[toggle]} value={(changes as any)[key]} onChange={(e) => setChanges({ ...changes, [key]: Number(e.target.value) })}/></Stack></Grid>)}
            </Grid>
            <Stack direction="row" justifyContent="flex-end" spacing={1}><Button variant="outlined" disabled={loading} onClick={() => void preview("actualizacion")}>Vista previa</Button><Button variant="contained" disabled={loading} onClick={() => void execute("actualizacion")}>Aplicar cambios</Button></Stack>
          </Stack>}

          {tab === "sin-uso" && <Stack spacing={2}>
            <Alert severity="success">Estos codigos tienen stock cero y no aparecen en ventas, ingresos, produccion, traslados, conteos, ordenes mixtas ni movimientos.</Alert>
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "background.default" }}>
              <Grid container spacing={1.25} alignItems="center">
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    size="small"
                    fullWidth
                    label="Buscar código o producto"
                    value={search}
                    onChange={(event) => { setSearch(event.target.value); setUnusedPage(0); }}
                  />
                </Grid>
                {([
                  ["tipo", "Tipo"], ["genero", "Género"], ["tela", "Tela"],
                  ["talla", "Talla"], ["color", "Color"], ["categoria", "Categoría"],
                ] as Array<[keyof UnusedFilters, string]>).map(([key, label]) => (
                  <Grid key={key} size={{ xs: 6, sm: 4, md: 2 }}>
                    <TextField select size="small" fullWidth label={label} value={unusedFilters[key]} onChange={(event) => updateUnusedFilter(key, event.target.value)}>
                      <MenuItem value="">Todos</MenuItem>
                      {unusedOptions[key].map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                    </TextField>
                  </Grid>
                ))}
                <Grid size={{ xs: 12 }}>
                  <Stack direction={{ xs: "column", sm: "row" }} gap={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                      {visibleUnused.length} de {unused.length} códigos sin uso
                      {selectedUnusedIds.size > 0 && ` · ${selectedUnusedIds.size} seleccionado${selectedUnusedIds.size === 1 ? "" : "s"}`}
                    </Typography>
                    <Stack direction="row" gap={1}>
                      {selectedUnusedIds.size > 0 && <Button size="small" onClick={() => setSelectedUnusedIds(new Set())}>Deseleccionar todo</Button>}
                      <Button size="small" onClick={() => { setSearch(""); setUnusedFilters(emptyUnusedFilters()); setUnusedPage(0); }}>Limpiar filtros</Button>
                      <Button size="small" startIcon={<RefreshOutlined />} onClick={() => void loadUnused()} disabled={loading}>Revisar nuevamente</Button>
                    </Stack>
                  </Stack>
                </Grid>
              </Grid>
            </Paper>
            <Paper variant="outlined" sx={{ overflow: "hidden" }}>
              <TableContainer sx={{ maxHeight: 540 }}><Table stickyHeader size="small"><TableHead><TableRow><TableCell padding="checkbox"><Checkbox color="primary" checked={allCurrentPageSelected} indeterminate={!allCurrentPageSelected && someCurrentPageSelected} disabled={!currentPageUnusedIds.length} onChange={toggleCurrentPageSelection} inputProps={{ "aria-label": allCurrentPageSelected ? "Deseleccionar todos los códigos de esta página" : "Seleccionar todos los códigos de esta página" }} /></TableCell><TableCell>Código</TableCell><TableCell>Producto</TableCell><TableCell>Tipo y género</TableCell><TableCell>Combinación</TableCell><TableCell align="right">Precio</TableCell><TableCell align="right">Acciones</TableCell></TableRow></TableHead><TableBody>
                {paginatedUnused.map((item) => <TableRow key={item.id} hover selected={selectedUnusedIds.has(item.id)}><TableCell padding="checkbox"><Checkbox color="primary" checked={selectedUnusedIds.has(item.id)} onChange={() => toggleUnusedSelection(item.id)} inputProps={{ "aria-label": `Seleccionar código ${item.codigo}` }} /></TableCell><TableCell sx={{ fontFamily: "monospace", fontWeight: 700, color: "primary.main" }}>{item.codigo}</TableCell><TableCell><Typography variant="body2">{item.nombre}</Typography>{item.categoria && normalize(item.categoria) !== normalize(item.nombre) && <Typography variant="caption" color="text.secondary">{item.categoria}</Typography>}</TableCell><TableCell>{[item.tipo, item.genero].filter(Boolean).join(" / ") || "—"}</TableCell><TableCell>{[item.tela, item.talla, item.color].filter(Boolean).join(" / ") || "—"}</TableCell><TableCell align="right">Q {Number(item.precio).toFixed(2)}</TableCell><TableCell align="right"><Button color="error" size="small" startIcon={<DeleteOutlineOutlined />} onClick={() => void removeUnused(item)}>Eliminar</Button></TableCell></TableRow>)}
                {!visibleUnused.length && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: "text.secondary" }}>No hay códigos sin uso que coincidan con los filtros.</TableCell></TableRow>}
              </TableBody></Table></TableContainer>
              <TablePagination
                component="div"
                count={visibleUnused.length}
                page={unusedPage}
                onPageChange={(_, page) => setUnusedPage(page)}
                rowsPerPage={unusedRowsPerPage}
                onRowsPerPageChange={(event) => { setUnusedRowsPerPage(Number(event.target.value)); setUnusedPage(0); }}
                rowsPerPageOptions={[10, 25, 50, 100]}
                labelRowsPerPage="Filas por página:"
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
              />
            </Paper>
          </Stack>}

          {tab === "instrucciones" && <Stack spacing={2}>
            <Typography variant="h6">Como se construye un codigo</Typography>
            <Typography color="text.secondary">La estructura recomendada combina abreviaciones estables y legibles:</Typography>
            <Paper variant="outlined" sx={{ p: 2.5, bgcolor: "background.default" }}><Typography sx={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700 }}>TIPO + GENERO + TELA + TALLA + COLOR + SUFIJO</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Ejemplo: F + D + R + M + AM + OLD = FDRMAM-OLD</Typography></Paper>
            <Grid container spacing={2}>{[
              ["1. Tipo", "Define una abreviacion unica por familia: F para FILIPINA."], ["2. Genero", "Usa una letra consistente: D, C, U o N."], ["3. Tela", "Mantiene una abreviacion por material, por ejemplo R para REPEL."], ["4. Talla", "Conserva el nombre normalizado: XS, S, M, L, XL."], ["5. Color", "Usa abreviaciones diferenciadas para evitar codigos duplicados."], ["6. Sufijo", "Reserva sufijos para versiones especiales, antiguas o campañas."],
            ].map(([title, text]) => <Grid key={title} size={{ xs: 12, md: 6, lg: 4 }}><Paper variant="outlined" sx={{ p: 2, height: "100%" }}><Typography fontWeight={650}>{title}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{text}</Typography></Paper></Grid>)}</Grid>
            <Alert severity="info">Antes de crear una regla nueva, verifica que tipo, categoria, tela, talla y color existan en sus catalogos y usa siempre Vista previa.</Alert>
          </Stack>}
        </Box>
      </Paper>
    </Stack>
  );
}
