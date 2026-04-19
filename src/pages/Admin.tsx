import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Paper,
  Typography,
  Stack,
  Grid,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  MenuItem,
} from "@mui/material";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import NotificationsActiveOutlined from "@mui/icons-material/NotificationsActiveOutlined";
import TuneOutlined from "@mui/icons-material/TuneOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import { menuPathItems } from "../layout/menuItems";
import { useAuthStore } from "../auth/useAuthStore";

interface NotifConfig {
  emailTo: string;
  whatsappTo: string;
  stockThreshold: number;
  highSaleThreshold: number;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  productMassConfig?: unknown;
}

interface UsuarioModulo {
  id: number;
  usuario: string;
  nombre: string;
}

interface MassGeneroDraft {
  key: number;
  nombre: string;
  abreviacion: string;
}

interface MassTelaDraft {
  key: number;
  nombre: string;
  abreviacion: string;
}

interface MassColorAbreviacionDraft {
  key: number;
  nombre: string;
  abreviacion: string;
}

interface MassTipoDraft {
  key: number;
  nombre: string;
  abreviacion: string;
  categoria: string;
  generos: string[];
  telas: string[];
  colores: string[];
}

interface ProductMassConfigDraft {
  precio: number;
  stockMax: number;
  mermaPorcentaje: number;
  generos: MassGeneroDraft[];
  telas: MassTelaDraft[];
  colorAbreviaciones: MassColorAbreviacionDraft[];
  tipos: MassTipoDraft[];
}

const createKey = () => Date.now() + Math.floor(Math.random() * 100000);

const parseCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const formatCsv = (values: string[]) => values.join(", ");

const createEmptyMassConfigDraft = (): ProductMassConfigDraft => ({
  precio: 275,
  stockMax: 10,
  mermaPorcentaje: 0,
  generos: [],
  telas: [],
  colorAbreviaciones: [],
  tipos: [],
});

const mapMassConfigToDraft = (raw: any): ProductMassConfigDraft => ({
  precio: Number(raw?.precio) || 275,
  stockMax: Number(raw?.stockMax) || 10,
  mermaPorcentaje: Number(raw?.mermaPorcentaje) || 0,
  generos: Array.isArray(raw?.generos)
    ? raw.generos.map((item: any) => ({
        key: createKey(),
        nombre: item?.nombre || "",
        abreviacion: item?.abreviacion || "",
      }))
    : [],
  telas: Array.isArray(raw?.telas)
    ? raw.telas.map((item: any) => ({
        key: createKey(),
        nombre: item?.nombre || "",
        abreviacion: item?.abreviacion || "",
      }))
    : [],
  colorAbreviaciones:
    raw?.colorAbreviaciones && typeof raw.colorAbreviaciones === "object"
      ? Object.entries(raw.colorAbreviaciones).map(([nombre, abreviacion]) => ({
          key: createKey(),
          nombre,
          abreviacion: `${abreviacion || ""}`,
        }))
      : [],
  tipos: Array.isArray(raw?.tipos)
    ? raw.tipos.map((item: any) => ({
        key: createKey(),
        nombre: item?.nombre || "",
        abreviacion: item?.abreviacion || "",
        categoria: item?.categoria || item?.nombre || "",
        generos: Array.isArray(item?.generos) ? item.generos.filter(Boolean) : [],
        telas: Array.isArray(item?.telas) ? item.telas.filter(Boolean) : [],
        colores: Array.isArray(item?.colores) ? item.colores.filter(Boolean) : [],
      }))
    : [],
});

const mapDraftToMassConfig = (draft: ProductMassConfigDraft) => ({
  precio: Number(draft.precio) || 0,
  stockMax: Number(draft.stockMax) || 0,
  mermaPorcentaje: Number(draft.mermaPorcentaje) || 0,
  generos: draft.generos
    .map((item) => ({
      nombre: item.nombre.trim(),
      abreviacion: item.abreviacion.trim(),
    }))
    .filter((item) => item.nombre && item.abreviacion),
  telas: draft.telas
    .map((item) => ({
      nombre: item.nombre.trim(),
      abreviacion: item.abreviacion.trim(),
    }))
    .filter((item) => item.nombre && item.abreviacion),
  colorAbreviaciones: Object.fromEntries(
    draft.colorAbreviaciones
      .map((item) => [item.nombre.trim(), item.abreviacion.trim()])
      .filter(([nombre, abreviacion]) => nombre && abreviacion)
  ),
  tipos: draft.tipos
    .map((item) => ({
      nombre: item.nombre.trim(),
      abreviacion: item.abreviacion.trim(),
      categoria: (item.categoria || item.nombre).trim(),
      generos: item.generos.map((value) => value.trim()).filter(Boolean),
      telas: item.telas.map((value) => value.trim()).filter(Boolean),
      colores: item.colores.map((value) => value.trim()).filter(Boolean),
    }))
    .filter((item) => item.nombre && item.abreviacion && item.generos.length && item.telas.length),
});

export default function Admin() {
  const [config, setConfig] = useState<NotifConfig>({
    emailTo: "",
    whatsappTo: "",
    stockThreshold: 5,
    highSaleThreshold: 1000,
    emailEnabled: false,
    whatsappEnabled: false,
  });
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioModulo[]>([]);
  const [disabledPathsDraft, setDisabledPathsDraft] = useState<string[]>([]);
  const [userDisabledPathsDraft, setUserDisabledPathsDraft] = useState<Record<string, string[]>>({});
  const [selectedUsuario, setSelectedUsuario] = useState("");
  const [selectedUserDisabledPathsDraft, setSelectedUserDisabledPathsDraft] = useState<string[]>([]);
  const [productionInternalDraft, setProductionInternalDraft] = useState(false);
  const [productMassConfigDraft, setProductMassConfigDraft] = useState<ProductMassConfigDraft>(
    createEmptyMassConfigDraft()
  );
  const {
    disabledPaths,
    userDisabledPaths,
    productionInternalMode,
    setDisabledPaths,
    setProductionInternalMode,
    fetchConfig,
  } = useSystemConfigStore();
  const { rol } = useAuthStore();

  const modulesBySection = useMemo(() => {
    const grouped = new Map<string, typeof menuPathItems>();
    menuPathItems.forEach((item) => {
      const key = item.sectionTitle || "GENERAL";
      const current = grouped.get(key) || [];
      current.push(item);
      grouped.set(key, current);
    });
    return Array.from(grouped.entries()).map(([section, items]) => ({
      section,
      items,
    }));
  }, []);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const [respConfig, respUsuarios] = await Promise.all([
        api.get("/config/notificaciones"),
        rol === "ADMIN" ? api.get("/usuarios").catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      const data = respConfig.data || {};
      setConfig({
        emailTo: data.emailTo || "",
        whatsappTo: data.whatsappTo || "",
        stockThreshold: data.stockThreshold ?? 5,
        highSaleThreshold: data.highSaleThreshold ?? 1000,
        emailEnabled: Boolean(data.emailTo),
        whatsappEnabled: Boolean(data.whatsappTo),
        productMassConfig: data.productMassConfig,
      });
      setProductMassConfigDraft(mapMassConfigToDraft(data.productMassConfig || {}));
      setDisabledPathsDraft(Array.isArray(data.disabledPaths) ? data.disabledPaths : []);
      setUserDisabledPathsDraft(
        data.userDisabledPaths && typeof data.userDisabledPaths === "object" ? data.userDisabledPaths : {}
      );
      setProductionInternalDraft(Boolean(data.productionInternalMode));
      const usuariosData = Array.isArray(respUsuarios.data) ? respUsuarios.data : [];
      setUsuarios(
        usuariosData
          .filter((item: any) => typeof item?.usuario === "string")
          .map((item: any) => ({
            id: Number(item.id),
            usuario: item.usuario,
            nombre: item.nombre || item.usuario,
          }))
      );
    } catch {
      Swal.fire("Error", "No se pudo cargar la configuracion", "error");
    } finally {
      setLoading(false);
    }
  }, [rol]);

  useEffect(() => {
    void fetchConfig();
    void cargar();
  }, [fetchConfig, cargar]);

  useEffect(() => {
    setDisabledPathsDraft(disabledPaths);
  }, [disabledPaths]);

  useEffect(() => {
    setUserDisabledPathsDraft(userDisabledPaths);
  }, [userDisabledPaths]);

  useEffect(() => {
    setProductionInternalDraft(productionInternalMode);
  }, [productionInternalMode]);

  useEffect(() => {
    if (!usuarios.length) {
      setSelectedUsuario("");
      return;
    }

    const exists = usuarios.some((item) => item.usuario === selectedUsuario);
    if (!selectedUsuario || !exists) {
      setSelectedUsuario(usuarios[0].usuario);
    }
  }, [usuarios, selectedUsuario]);

  const selectedUsuarioKey = selectedUsuario.trim().toUpperCase();

  useEffect(() => {
    if (!selectedUsuarioKey) {
      setSelectedUserDisabledPathsDraft([]);
      return;
    }
    setSelectedUserDisabledPathsDraft(userDisabledPathsDraft[selectedUsuarioKey] || []);
  }, [selectedUsuarioKey, userDisabledPathsDraft]);

  const guardar = async () => {
    try {
      setLoading(true);
      await api.put("/config/notificaciones", {
        emailTo: config.emailEnabled ? config.emailTo : "",
        whatsappTo: config.whatsappEnabled ? config.whatsappTo : "",
        stockThreshold: config.stockThreshold,
        highSaleThreshold: config.highSaleThreshold,
      });
      Swal.fire("Guardado", "Preferencias de notificacion actualizadas", "success");
    } catch {
      Swal.fire("Error", "No se pudo guardar la configuracion", "error");
    } finally {
      setLoading(false);
    }
  };

  const guardarModulos = async () => {
    try {
      setLoading(true);
      await setDisabledPaths(disabledPathsDraft);
      Swal.fire("Guardado", "La configuracion de modulos fue actualizada", "success");
    } catch {
      Swal.fire("Error", "No se pudo guardar la configuracion de modulos", "error");
    } finally {
      setLoading(false);
    }
  };

  const guardarModulosPorUsuario = async () => {
    if (!selectedUsuarioKey) return;
    try {
      setLoading(true);
      const nextUserDisabledPaths = {
        ...userDisabledPathsDraft,
        [selectedUsuarioKey]: selectedUserDisabledPathsDraft,
      };
      await api.put("/config/notificaciones", {
        userDisabledPaths: nextUserDisabledPaths,
      });
      await fetchConfig();
      setUserDisabledPathsDraft(nextUserDisabledPaths);
      Swal.fire(
        "Guardado",
        `La configuracion de modulos para ${selectedUsuarioKey} fue actualizada`,
        "success"
      );
    } catch {
      Swal.fire("Error", "No se pudo guardar la configuracion por usuario", "error");
    } finally {
      setLoading(false);
    }
  };

  const guardarModoProduccion = async () => {
    try {
      setLoading(true);
      await setProductionInternalMode(productionInternalDraft);
      Swal.fire(
        "Guardado",
        productionInternalDraft
          ? "Los pedidos de produccion ahora funcionan sin cliente ni pagos."
          : "Los pedidos de produccion volvieron al modo normal con pagos.",
        "success"
      );
    } catch {
      Swal.fire("Error", "No se pudo guardar el modo de produccion", "error");
    } finally {
      setLoading(false);
    }
  };

  const togglePath = (path: string, enabled: boolean) => {
    setDisabledPathsDraft((prev) =>
      enabled ? prev.filter((item) => item !== path) : Array.from(new Set([...prev, path]))
    );
  };

  const toggleUserPath = (path: string, enabled: boolean) => {
    if (!selectedUsuarioKey) return;
    const current = selectedUserDisabledPathsDraft;
    const nextPaths = enabled
      ? current.filter((item) => item !== path)
      : Array.from(new Set([...current, path]));
    setSelectedUserDisabledPathsDraft(nextPaths);
  };

  const ejecutarCargaMasivaProductos = async () => {
    const result = await Swal.fire({
      title: "Carga masiva de productos",
      text: "Se generaran o actualizaran todas las combinaciones base de productos usando categorias, telas, tallas y colores actuales.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ejecutar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      setLoading(true);
      const resp = await api.post("/productos/carga-masiva-base", {
        config: mapDraftToMassConfig(productMassConfigDraft),
      });
      const data = resp.data || {};
      Swal.fire(
        "Proceso completado",
        `Creados: ${data.creados ?? 0}\nActualizados: ${data.actualizados ?? 0}\nTotal: ${data.total ?? 0}`,
        "success"
      );
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo ejecutar la carga masiva";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const verVistaPreviaCargaMasivaProductos = async () => {
    try {
      setLoading(true);
      const resp = await api.post("/productos/carga-masiva-base/preview", {
        config: mapDraftToMassConfig(productMassConfigDraft),
      });
      const data = resp.data || {};
      const detalleTipos = Array.isArray(data.detalleTipos) ? data.detalleTipos : [];

      const html = `
        <div style="text-align:left;max-height:60vh;overflow:auto;padding-right:8px;">
          <p style="margin:0 0 12px 0;"><strong>Total de combinaciones:</strong> ${data?.configuracion?.combinacionesEsperadas ?? 0}</p>
          <p style="margin:0 0 12px 0;"><strong>Se crearian:</strong> ${data.creados ?? 0} <br /><strong>Se actualizarian:</strong> ${data.actualizados ?? 0}</p>
          ${detalleTipos
            .map(
              (item: any) => `
                <div style="border:1px solid #dbe3ea;border-radius:8px;padding:12px;margin-bottom:12px;">
                  <div style="font-weight:700;margin-bottom:6px;">${item.tipo}</div>
                  <div style="font-size:14px;margin-bottom:6px;">
                    Total: ${item.total ?? 0} | Crear: ${item.creados ?? 0} | Actualizar: ${item.actualizados ?? 0}
                  </div>
                  <div style="font-size:13px;color:#475569;margin-bottom:4px;">Codigos de muestra:</div>
                  <div style="font-family:Consolas, monospace;font-size:13px;white-space:pre-wrap;">${(item.muestras || []).join("\n") || "Sin muestras"}</div>
                </div>
              `
            )
            .join("")}
        </div>
      `;

      await Swal.fire({
        title: "Vista previa de carga masiva",
        html,
        width: 900,
        confirmButtonText: "Cerrar",
      });
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo generar la vista previa";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const guardarConfiguracionCargaMasiva = async () => {
    try {
      setLoading(true);
      const productMassConfig = mapDraftToMassConfig(productMassConfigDraft);
      await api.put("/config/notificaciones", { productMassConfig });
      setConfig((prev) => ({ ...prev, productMassConfig }));
      Swal.fire("Guardado", "La configuracion de carga masiva fue actualizada", "success");
    } catch (error: any) {
      const msg = error?.message || error?.response?.data?.message || "No se pudo guardar la configuracion de carga masiva";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const updateGeneroDraft = (key: number, field: "nombre" | "abreviacion", value: string) => {
    setProductMassConfigDraft((prev) => ({
      ...prev,
      generos: prev.generos.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    }));
  };

  const updateTelaDraft = (key: number, field: "nombre" | "abreviacion", value: string) => {
    setProductMassConfigDraft((prev) => ({
      ...prev,
      telas: prev.telas.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    }));
  };

  const updateColorAbreviacionDraft = (key: number, field: "nombre" | "abreviacion", value: string) => {
    setProductMassConfigDraft((prev) => ({
      ...prev,
      colorAbreviaciones: prev.colorAbreviaciones.map((item) =>
        item.key === key ? { ...item, [field]: value } : item
      ),
    }));
  };

  const updateTipoDraft = (
    key: number,
    field: "nombre" | "abreviacion" | "categoria" | "generos" | "telas" | "colores",
    value: string
  ) => {
    setProductMassConfigDraft((prev) => ({
      ...prev,
      tipos: prev.tipos.map((item) =>
        item.key === key
          ? {
              ...item,
              [field]:
                field === "generos" || field === "telas" || field === "colores" ? parseCsv(value) : value,
            }
          : item
      ),
    }));
  };

  const generosDisponibles = productMassConfigDraft.generos.map((item) => item.nombre).filter(Boolean);
  const telasDisponibles = productMassConfigDraft.telas.map((item) => item.nombre).filter(Boolean);
  const coloresDisponibles = productMassConfigDraft.colorAbreviaciones.map((item) => item.nombre).filter(Boolean);

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <NotificationsActiveOutlined color="primary" />
        <Typography variant="h4">Notificaciones</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configura alertas de stock bajo, ventas altas o errores por correo o WhatsApp.
      </Typography>

      <Divider sx={{ mb: 2 }} />

      <Stack spacing={1.5} sx={{ mb: 2 }}>
        {rol === "ADMIN" && (
          <>
            <Stack direction="row" spacing={1} alignItems="center">
              <TuneOutlined color="primary" />
              <Typography variant="h6">Modulos del sistema</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Activa o desactiva modulos y submodulos globalmente. Los nuevos modulos que se agreguen al menu apareceran aqui automaticamente.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="outlined" onClick={() => setDisabledPathsDraft([])} disabled={loading}>
                Habilitar todos
              </Button>
              <Button
                variant="outlined"
                color="warning"
                onClick={() =>
                  setDisabledPathsDraft(menuPathItems.map((item) => item.path).filter((path) => path !== "/" && path !== "/admin"))
                }
                disabled={loading}
              >
                Deshabilitar todos menos Dashboard y Configuracion
              </Button>
              <Button variant="contained" onClick={guardarModulos} disabled={loading}>
                Guardar modulos
              </Button>
            </Stack>
            <Grid container spacing={2}>
              {modulesBySection.map((section) => (
                <Grid key={section.section} size={{ xs: 12, md: 6 }}>
                  <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      {section.section}
                    </Typography>
                    <List dense disablePadding>
                      {section.items.map((item) => {
                        const enabled = !disabledPathsDraft.includes(item.path);
                        const label = item.parentLabel ? `${item.parentLabel} / ${item.label}` : item.label;
                        return (
                          <ListItem
                            key={item.path}
                            disableGutters
                            secondaryAction={
                              <Switch
                                edge="end"
                                checked={enabled}
                                onChange={(e) => togglePath(item.path, e.target.checked)}
                              />
                            }
                          >
                            <ListItemText primary={label} secondary={item.path} />
                          </ListItem>
                        );
                      })}
                    </List>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </>
        )}
      </Stack>

      {rol === "ADMIN" && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle2">Modulos por usuario</Typography>
            <Typography variant="body2" color="text.secondary">
              Define accesos especificos por usuario. Estas restricciones se suman a las restricciones globales.
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  select
                  label="Usuario"
                  fullWidth
                  value={selectedUsuario}
                  onChange={(e) => setSelectedUsuario(e.target.value)}
                  disabled={!usuarios.length}
                >
                  {usuarios.map((item) => (
                    <MenuItem key={item.id} value={item.usuario}>
                      {item.usuario} - {item.nombre}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                variant="outlined"
                disabled={!selectedUsuarioKey || loading}
                onClick={() => setSelectedUserDisabledPathsDraft([])}
              >
                Habilitar todo para el usuario
              </Button>
              <Button
                variant="outlined"
                color="warning"
                disabled={!selectedUsuarioKey || loading}
                onClick={() =>
                  setSelectedUserDisabledPathsDraft(
                    menuPathItems.map((item) => item.path).filter((path) => path !== "/" && path !== "/admin")
                  )
                }
              >
                Deshabilitar todo menos Dashboard y Configuracion
              </Button>
              <Button variant="contained" onClick={guardarModulosPorUsuario} disabled={!selectedUsuarioKey || loading}>
                Guardar configuracion por usuario
              </Button>
            </Stack>
            <Grid container spacing={2}>
              {modulesBySection.map((section) => (
                <Grid key={`user-${section.section}`} size={{ xs: 12, md: 6 }}>
                  <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      {section.section}
                    </Typography>
                    <List dense disablePadding>
                      {section.items.map((item) => {
                        const enabled = !selectedUserDisabledPathsDraft.includes(item.path);
                        const label = item.parentLabel ? `${item.parentLabel} / ${item.label}` : item.label;
                        return (
                          <ListItem
                            key={`user-${selectedUsuarioKey}-${item.path}`}
                            disableGutters
                            secondaryAction={
                              <Switch
                                edge="end"
                                checked={enabled}
                                disabled={!selectedUsuarioKey}
                                onChange={(e) => toggleUserPath(item.path, e.target.checked)}
                              />
                            }
                          >
                            <ListItemText primary={label} secondary={item.path} />
                          </ListItem>
                        );
                      })}
                    </List>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </Paper>
      )}

      {rol === "ADMIN" && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle2">Modo interno de produccion</Typography>
            <Typography variant="body2" color="text.secondary">
              Deshabilita globalmente todo lo relacionado con pagos en pedidos y usa el modulo solo con datos internos de produccion.
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={productionInternalDraft}
                  onChange={(e) => setProductionInternalDraft(e.target.checked)}
                />
              }
              label="Usar pedidos internos sin cliente ni pagos"
            />
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="contained" onClick={guardarModoProduccion} disabled={loading}>
                Guardar modo de produccion
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {rol === "ADMIN" && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Inventory2Outlined color="primary" />
              <Typography variant="subtitle2">Carga masiva de productos base</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Genera o actualiza masivamente las combinaciones base de BATA LARGA, BATA PACIENTE, BATA SACO,
              BATA ZIPPER y CHUMPA segun las reglas definidas de genero, tela, talla y color.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Reglas actuales: precio `275`, stock max `10`, merma `0`, nombre igual al tipo y colores
              restringidos para CHUMPA.
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Precio"
                  type="number"
                  fullWidth
                  value={productMassConfigDraft.precio}
                  onChange={(e) =>
                    setProductMassConfigDraft((prev) => ({ ...prev, precio: Number(e.target.value) || 0 }))
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Stock maximo"
                  type="number"
                  fullWidth
                  value={productMassConfigDraft.stockMax}
                  onChange={(e) =>
                    setProductMassConfigDraft((prev) => ({ ...prev, stockMax: Number(e.target.value) || 0 }))
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Merma %"
                  type="number"
                  fullWidth
                  value={productMassConfigDraft.mermaPorcentaje}
                  onChange={(e) =>
                    setProductMassConfigDraft((prev) => ({
                      ...prev,
                      mermaPorcentaje: Number(e.target.value) || 0,
                    }))
                  }
                />
              </Grid>
            </Grid>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">Generos</Typography>
                  <Button
                    variant="outlined"
                    startIcon={<AddOutlined />}
                    onClick={() =>
                      setProductMassConfigDraft((prev) => ({
                        ...prev,
                        generos: [...prev.generos, { key: createKey(), nombre: "", abreviacion: "" }],
                      }))
                    }
                  >
                    Agregar genero
                  </Button>
                </Stack>
                {productMassConfigDraft.generos.map((item) => (
                  <Stack key={item.key} direction={{ xs: "column", md: "row" }} spacing={1}>
                    <TextField
                      label="Nombre"
                      fullWidth
                      value={item.nombre}
                      onChange={(e) => updateGeneroDraft(item.key, "nombre", e.target.value)}
                    />
                    <TextField
                      label="Abreviacion"
                      fullWidth
                      value={item.abreviacion}
                      onChange={(e) => updateGeneroDraft(item.key, "abreviacion", e.target.value)}
                    />
                    <IconButton
                      color="error"
                      onClick={() =>
                        setProductMassConfigDraft((prev) => ({
                          ...prev,
                          generos: prev.generos.filter((row) => row.key !== item.key),
                        }))
                      }
                    >
                      <DeleteOutlineOutlined />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">Telas</Typography>
                  <Button
                    variant="outlined"
                    startIcon={<AddOutlined />}
                    onClick={() =>
                      setProductMassConfigDraft((prev) => ({
                        ...prev,
                        telas: [...prev.telas, { key: createKey(), nombre: "", abreviacion: "" }],
                      }))
                    }
                  >
                    Agregar tela
                  </Button>
                </Stack>
                {productMassConfigDraft.telas.map((item) => (
                  <Stack key={item.key} direction={{ xs: "column", md: "row" }} spacing={1}>
                    <TextField
                      label="Nombre"
                      fullWidth
                      value={item.nombre}
                      onChange={(e) => updateTelaDraft(item.key, "nombre", e.target.value)}
                    />
                    <TextField
                      label="Abreviacion"
                      fullWidth
                      value={item.abreviacion}
                      onChange={(e) => updateTelaDraft(item.key, "abreviacion", e.target.value)}
                    />
                    <IconButton
                      color="error"
                      onClick={() =>
                        setProductMassConfigDraft((prev) => ({
                          ...prev,
                          telas: prev.telas.filter((row) => row.key !== item.key),
                        }))
                      }
                    >
                      <DeleteOutlineOutlined />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">Abreviaciones de color</Typography>
                  <Button
                    variant="outlined"
                    startIcon={<AddOutlined />}
                    onClick={() =>
                      setProductMassConfigDraft((prev) => ({
                        ...prev,
                        colorAbreviaciones: [
                          ...prev.colorAbreviaciones,
                          { key: createKey(), nombre: "", abreviacion: "" },
                        ],
                      }))
                    }
                  >
                    Agregar color
                  </Button>
                </Stack>
                {productMassConfigDraft.colorAbreviaciones.map((item) => (
                  <Stack key={item.key} direction={{ xs: "column", md: "row" }} spacing={1}>
                    <TextField
                      label="Color"
                      fullWidth
                      value={item.nombre}
                      onChange={(e) => updateColorAbreviacionDraft(item.key, "nombre", e.target.value)}
                    />
                    <TextField
                      label="Abreviacion"
                      fullWidth
                      value={item.abreviacion}
                      onChange={(e) => updateColorAbreviacionDraft(item.key, "abreviacion", e.target.value)}
                    />
                    <IconButton
                      color="error"
                      onClick={() =>
                        setProductMassConfigDraft((prev) => ({
                          ...prev,
                          colorAbreviaciones: prev.colorAbreviaciones.filter((row) => row.key !== item.key),
                        }))
                      }
                    >
                      <DeleteOutlineOutlined />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">Tipos</Typography>
                  <Button
                    variant="outlined"
                    startIcon={<AddOutlined />}
                    onClick={() =>
                      setProductMassConfigDraft((prev) => ({
                        ...prev,
                        tipos: [
                          ...prev.tipos,
                          {
                            key: createKey(),
                            nombre: "",
                            abreviacion: "",
                            categoria: "",
                            generos: [],
                            telas: [],
                            colores: [],
                          },
                        ],
                      }))
                    }
                  >
                    Agregar tipo
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Generos disponibles: {generosDisponibles.join(", ") || "Ninguno"} | Telas disponibles:{" "}
                  {telasDisponibles.join(", ") || "Ninguna"} | Colores configurados:{" "}
                  {coloresDisponibles.join(", ") || "Ninguno"}
                </Typography>
                {productMassConfigDraft.tipos.map((item) => (
                  <Paper key={item.key} variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle2">{item.nombre || "Nuevo tipo"}</Typography>
                        <IconButton
                          color="error"
                          onClick={() =>
                            setProductMassConfigDraft((prev) => ({
                              ...prev,
                              tipos: prev.tipos.filter((row) => row.key !== item.key),
                            }))
                          }
                        >
                          <DeleteOutlineOutlined />
                        </IconButton>
                      </Stack>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <TextField
                            label="Nombre"
                            fullWidth
                            value={item.nombre}
                            onChange={(e) => updateTipoDraft(item.key, "nombre", e.target.value)}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <TextField
                            label="Abreviacion"
                            fullWidth
                            value={item.abreviacion}
                            onChange={(e) => updateTipoDraft(item.key, "abreviacion", e.target.value)}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <TextField
                            label="Categoria"
                            fullWidth
                            value={item.categoria}
                            onChange={(e) => updateTipoDraft(item.key, "categoria", e.target.value)}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <TextField
                            label="Generos"
                            fullWidth
                            value={formatCsv(item.generos)}
                            onChange={(e) => updateTipoDraft(item.key, "generos", e.target.value)}
                            helperText="Separados por coma"
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <TextField
                            label="Telas"
                            fullWidth
                            value={formatCsv(item.telas)}
                            onChange={(e) => updateTipoDraft(item.key, "telas", e.target.value)}
                            helperText="Separadas por coma"
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <TextField
                            label="Colores"
                            fullWidth
                            value={formatCsv(item.colores)}
                            onChange={(e) => updateTipoDraft(item.key, "colores", e.target.value)}
                            helperText="Opcional. Dejalo vacio para usar todos"
                          />
                        </Grid>
                      </Grid>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Paper>
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="outlined" onClick={guardarConfiguracionCargaMasiva} disabled={loading}>
                Guardar configuracion
              </Button>
              <Button variant="outlined" onClick={verVistaPreviaCargaMasivaProductos} disabled={loading}>
                Vista previa
              </Button>
              <Button variant="contained" onClick={ejecutarCargaMasivaProductos} disabled={loading}>
                Ejecutar carga masiva
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      <Divider sx={{ my: 2 }} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={1.5}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.emailEnabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      emailEnabled: e.target.checked,
                      emailTo: e.target.checked ? config.emailTo : "",
                    })
                  }
                />
              }
              label="Alertas por correo"
            />
            <TextField
              label="Correo de destino"
              type="email"
              fullWidth
              disabled={!config.emailEnabled}
              value={config.emailTo}
              onChange={(e) => setConfig({ ...config, emailTo: e.target.value })}
            />
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={1.5}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.whatsappEnabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      whatsappEnabled: e.target.checked,
                      whatsappTo: e.target.checked ? config.whatsappTo : "",
                    })
                  }
                />
              }
              label="Alertas por WhatsApp"
            />
            <TextField
              label="Numero WhatsApp (con codigo de pais)"
              fullWidth
              disabled={!config.whatsappEnabled}
              value={config.whatsappTo}
              onChange={(e) => setConfig({ ...config, whatsappTo: e.target.value })}
            />
          </Stack>
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Umbral de stock bajo"
            type="number"
            fullWidth
            value={config.stockThreshold}
            onChange={(e) => setConfig({ ...config, stockThreshold: Number(e.target.value) || 0 })}
            helperText="Se notificara cuando el stock este por debajo de este valor."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Alerta por venta alta (monto)"
            type="number"
            fullWidth
            value={config.highSaleThreshold}
            onChange={(e) => setConfig({ ...config, highSaleThreshold: Number(e.target.value) || 0 })}
            helperText="Disparara notificacion para ventas iguales o mayores a este monto."
          />
        </Grid>
      </Grid>

      <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 3 }}>
        <Button variant="contained" startIcon={<SaveOutlined />} onClick={guardar} disabled={loading}>
          Guardar
        </Button>
      </Stack>
    </Paper>
  );
}
