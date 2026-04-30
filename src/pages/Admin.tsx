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
  Checkbox,
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
import { hasPermission } from "../auth/permissions";

interface NotifConfig {
  emailTo: string;
  whatsappTo: string;
  stockThreshold: number;
  highSaleThreshold: number;
  pedidoAlertRoleIds: number[];
  crossStoreRoleIds: number[];
  unifyOrderRoleIds: number[];
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  resendEnabled: boolean;
  resendFrom: string;
  resendTemplateId: string;
  reportesConfig?: unknown;
  dailyReportEnabled: boolean;
  dailyReportEmailTo: string;
  dailyReportSubject: string;
  fortnightlyReportEnabled: boolean;
  fortnightlyReportEmailTo: string;
  fortnightlyReportSubject: string;
  productMassConfig?: unknown;
}

interface UsuarioModulo {
  id: number;
  usuario: string;
  nombre: string;
}

interface RolOption {
  id: number;
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

interface ProductBulkUpdateDraft {
  tipos: string;
  generos: string;
  telas: string;
  tallas: string;
  colores: string;
  actualizarPrecio: boolean;
  precio: number;
  actualizarStockMax: boolean;
  stockMax: number;
  actualizarMerma: boolean;
  mermaPorcentaje: number;
}

interface ProductBulkCreateDraft {
  tipos: string;
  tipoAbreviacion: string;
  categoria: string;
  generos: string;
  telas: string;
  tallas: string;
  colores: string;
  precio: number;
  stockMax: number;
  mermaPorcentaje: number;
}

const createKey = () => Date.now() + Math.floor(Math.random() * 100000);

const parseCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const formatCsv = (values: string[]) => values.join(", ");

const createEmptyBulkUpdateDraft = (): ProductBulkUpdateDraft => ({
  tipos: "",
  generos: "",
  telas: "",
  tallas: "",
  colores: "",
  actualizarPrecio: true,
  precio: 0,
  actualizarStockMax: false,
  stockMax: 0,
  actualizarMerma: false,
  mermaPorcentaje: 0,
});

const createEmptyBulkCreateDraft = (): ProductBulkCreateDraft => ({
  tipos: "",
  tipoAbreviacion: "",
  categoria: "",
  generos: "",
  telas: "",
  tallas: "",
  colores: "",
  precio: 275,
  stockMax: 10,
  mermaPorcentaje: 0,
});

const normalizeRoleIds = (raw: unknown): number[] => {
  if (Array.isArray(raw)) {
    return Array.from(
      new Set(
        raw
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0),
      ),
    );
  }

  if (typeof raw === "string") {
    return Array.from(
      new Set(
        raw
          .split(",")
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isFinite(value) && value > 0),
      ),
    );
  }

  return [];
};

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
    pedidoAlertRoleIds: [],
    crossStoreRoleIds: [],
    unifyOrderRoleIds: [],
    emailEnabled: false,
    whatsappEnabled: false,
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "noreply@uniforma.com",
    resendEnabled: false,
    resendFrom: "noreply@uniforma.com",
    resendTemplateId: "",
    dailyReportEnabled: false,
    dailyReportEmailTo: "",
    dailyReportSubject: "Reporte diario {fecha}",
    fortnightlyReportEnabled: false,
    fortnightlyReportEmailTo: "",
    fortnightlyReportSubject: "Reporte quincenal {periodo}",
  });
  const [savedPedidoAlertRoleIds, setSavedPedidoAlertRoleIds] = useState<number[]>([]);
  const [savedCrossStoreRoleIds, setSavedCrossStoreRoleIds] = useState<number[]>([]);
  const [savedUnifyOrderRoleIds, setSavedUnifyOrderRoleIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioModulo[]>([]);
  const [roles, setRoles] = useState<RolOption[]>([]);
  const [disabledPathsDraft, setDisabledPathsDraft] = useState<string[]>([]);
  const [smtpPassDraft, setSmtpPassDraft] = useState('');
  const [resendApiKeyDraft, setResendApiKeyDraft] = useState('');
  const [userDisabledPathsDraft, setUserDisabledPathsDraft] = useState<Record<string, string[]>>({});
  const [selectedUsuario, setSelectedUsuario] = useState("");
  const [selectedUserDisabledPathsDraft, setSelectedUserDisabledPathsDraft] = useState<string[]>([]);
  const [mensajeActualizacion, setMensajeActualizacion] = useState("");
  const [productMassConfigDraft, setProductMassConfigDraft] = useState<ProductMassConfigDraft>(
    createEmptyMassConfigDraft()
  );
  const [productBulkUpdateDraft, setProductBulkUpdateDraft] = useState<ProductBulkUpdateDraft>(
    createEmptyBulkUpdateDraft()
  );
  const [productBulkCreateDraft, setProductBulkCreateDraft] = useState<ProductBulkCreateDraft>(
    createEmptyBulkCreateDraft()
  );
  const {
    disabledPaths,
    userDisabledPaths,
    setDisabledPaths,
    fetchConfig,
  } = useSystemConfigStore();
  const { rol, permisos } = useAuthStore();
  const canManageAdmin = hasPermission(rol, permisos, "admin.manage");
  const getRoleNames = useCallback(
    (roleIds: number[]) =>
      normalizeRoleIds(roleIds)
        .map((id) => roles.find((role) => role.id === id)?.nombre || `Rol #${id}`)
        .join(", "),
    [roles]
  );

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
      const [respConfig, respUsuarios, respRoles] = await Promise.all([
        api.get("/config/notificaciones"),
        canManageAdmin ? api.get("/usuarios").catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        canManageAdmin ? api.get("/roles").catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      const data = respConfig.data || {};
      const reportesConfig = data.reportesConfig || {
        reportes: [
          {
            tipo: 'reporteDiario',
            enabled: false,
            emailTo: '',
            subject: 'Reporte diario {fecha}',
            triggerOn: ['create'],
          },
          {
            tipo: 'reporteQuincenal',
            enabled: false,
            emailTo: '',
            subject: 'Reporte quincenal {periodo}',
            triggerOn: ['create'],
          },
        ],
      };
      const reporteDiario = Array.isArray(reportesConfig.reportes)
        ? reportesConfig.reportes.find((item: any) => item?.tipo === 'reporteDiario')
        : undefined;
      const reporteQuincenal = Array.isArray(reportesConfig.reportes)
        ? reportesConfig.reportes.find((item: any) => item?.tipo === 'reporteQuincenal')
        : undefined;

      setConfig({
        emailTo: data.emailTo || "",
        whatsappTo: data.whatsappTo || "",
        stockThreshold: data.stockThreshold ?? 5,
        highSaleThreshold: data.highSaleThreshold ?? 1000,
        pedidoAlertRoleIds: normalizeRoleIds(data.pedidoAlertRoleIds),
        crossStoreRoleIds: normalizeRoleIds(data.crossStoreRoleIds),
        unifyOrderRoleIds: normalizeRoleIds(data.unifyOrderRoleIds),
        emailEnabled: Boolean(data.emailTo),
        whatsappEnabled: Boolean(data.whatsappTo),
        smtpHost: data.smtpHost || 'smtp.gmail.com',
        smtpPort: Number(data.smtpPort) || 587,
        smtpUser: data.smtpUser || '',
        smtpPass: '',
        smtpFrom: data.smtpFrom || 'noreply@uniforma.com',
        resendEnabled: Boolean(data.resendEnabled),
        resendFrom: data.resendFrom || 'noreply@uniforma.com',
        resendTemplateId: data.resendTemplateId || '',
        reportesConfig,
        dailyReportEnabled: Boolean(reporteDiario?.enabled),
        dailyReportEmailTo: reporteDiario?.emailTo || '',
        dailyReportSubject: reporteDiario?.subject || 'Reporte diario {fecha}',
        fortnightlyReportEnabled: Boolean(reporteQuincenal?.enabled),
        fortnightlyReportEmailTo: reporteQuincenal?.emailTo || '',
        fortnightlyReportSubject: reporteQuincenal?.subject || 'Reporte quincenal {periodo}',
        productMassConfig: data.productMassConfig,
      });
      setSmtpPassDraft('');
      setResendApiKeyDraft('');
      setSavedPedidoAlertRoleIds(normalizeRoleIds(data.pedidoAlertRoleIds));
      setSavedCrossStoreRoleIds(normalizeRoleIds(data.crossStoreRoleIds));
      setSavedUnifyOrderRoleIds(normalizeRoleIds(data.unifyOrderRoleIds));
      setProductMassConfigDraft(mapMassConfigToDraft(data.productMassConfig || {}));
      setDisabledPathsDraft(Array.isArray(data.disabledPaths) ? data.disabledPaths : []);
      setUserDisabledPathsDraft(
        data.userDisabledPaths && typeof data.userDisabledPaths === "object" ? data.userDisabledPaths : {}
      );
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
      const rolesData = Array.isArray(respRoles.data) ? respRoles.data : [];
      setRoles(
        rolesData
          .filter((item: any) => Number.isFinite(Number(item?.id)) && typeof item?.nombre === "string")
          .map((item: any) => ({
            id: Number(item.id),
            nombre: item.nombre,
          }))
      );
    } catch {
      Swal.fire("Error", "No se pudo cargar la configuracion", "error");
    } finally {
      setLoading(false);
    }
  }, [canManageAdmin]);

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
        pedidoAlertRoleIds: config.pedidoAlertRoleIds,
        crossStoreRoleIds: config.crossStoreRoleIds,
        unifyOrderRoleIds: config.unifyOrderRoleIds,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        smtpPass: smtpPassDraft || undefined,
        smtpFrom: config.smtpFrom,
        resendEnabled: config.resendEnabled,
        resendFrom: config.resendFrom,
        resendTemplateId: config.resendTemplateId,
        ...(resendApiKeyDraft ? { resendApiKey: resendApiKeyDraft } : {}),
        reportesConfig: {
          reportes: [
            {
              tipo: 'reporteDiario',
              enabled: config.dailyReportEnabled,
              emailTo: config.dailyReportEmailTo,
              subject: config.dailyReportSubject,
              triggerOn: ['create'],
            },
            {
              tipo: 'reporteQuincenal',
              enabled: config.fortnightlyReportEnabled,
              emailTo: config.fortnightlyReportEmailTo,
              subject: config.fortnightlyReportSubject,
              triggerOn: ['create'],
            },
          ],
        },
      });
      Swal.fire("Guardado", "Preferencias de notificacion actualizadas", "success");
    } catch {
      Swal.fire("Error", "No se pudo guardar la configuracion", "error");
    } finally {
      setLoading(false);
    }
  };

  const guardarAlertasPedido = async () => {
    try {
      setLoading(true);
      const payload = {
        pedidoAlertRoleIds: Array.from(
          new Set(
            (config.pedidoAlertRoleIds || [])
              .map((value) => Number(value))
              .filter((value) => Number.isFinite(value) && value > 0),
          ),
        ),
      };
      const { data } = await api.put("/config/notificaciones", payload);
      const nextSavedRoleIds = normalizeRoleIds(data?.pedidoAlertRoleIds);
      setConfig((prev) => ({
        ...prev,
        pedidoAlertRoleIds: nextSavedRoleIds,
      }));
      setSavedPedidoAlertRoleIds(nextSavedRoleIds);
      await fetchConfig();
      await cargar();
      Swal.fire("Guardado", "Los roles para alertas de pedidos fueron actualizados", "success");
    } catch {
      Swal.fire("Error", "No se pudieron guardar los roles de alertas de pedidos", "error");
    } finally {
      setLoading(false);
    }
  };

  const guardarRolesMultiBodega = async () => {
    try {
      setLoading(true);
      const payload = {
        crossStoreRoleIds: Array.from(
          new Set(
            (config.crossStoreRoleIds || [])
              .map((value) => Number(value))
              .filter((value) => Number.isFinite(value) && value > 0),
          ),
        ),
      };
      const { data } = await api.put("/config/notificaciones", payload);
      const nextSavedRoleIds = normalizeRoleIds(data?.crossStoreRoleIds ?? payload.crossStoreRoleIds);
      setConfig((prev) => ({
        ...prev,
        crossStoreRoleIds: nextSavedRoleIds,
      }));
      setSavedCrossStoreRoleIds(nextSavedRoleIds);
      await fetchConfig();
      await cargar();
      Swal.fire("Guardado", "Los roles con acceso multi-bodega fueron actualizados", "success");
    } catch {
      Swal.fire("Error", "No se pudieron guardar los roles con acceso multi-bodega", "error");
    } finally {
      setLoading(false);
    }
  };

  const guardarRolesUnificarPedidos = async () => {
    try {
      setLoading(true);
      const payload = {
        unifyOrderRoleIds: Array.from(
          new Set(
            (config.unifyOrderRoleIds || [])
              .map((value) => Number(value))
              .filter((value) => Number.isFinite(value) && value > 0),
          ),
        ),
      };
      const { data } = await api.put("/config/notificaciones", payload);
      const nextSavedRoleIds = normalizeRoleIds(data?.unifyOrderRoleIds ?? payload.unifyOrderRoleIds);
      setConfig((prev) => ({
        ...prev,
        unifyOrderRoleIds: nextSavedRoleIds,
      }));
      setSavedUnifyOrderRoleIds(nextSavedRoleIds);
      await fetchConfig();
      await cargar();
      Swal.fire("Guardado", "Los roles con permiso para unificar pedidos fueron actualizados", "success");
    } catch {
      Swal.fire("Error", "No se pudieron guardar los roles con permiso para unificar pedidos", "error");
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

  const enviarMensajeActualizacion = async () => {
    const mensaje = mensajeActualizacion.trim();
    if (!mensaje) {
      Swal.fire("Validacion", "Escribe el mensaje de actualizacion", "info");
      return;
    }

    const result = await Swal.fire({
      title: "Enviar mensaje y cerrar sesiones",
      text: "Todos los usuarios recibiran la notificacion y sus sesiones activas se cerraran.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Enviar y cerrar sesiones",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      setLoading(true);
      const { data } = await api.post("/alertas/mensaje-actualizacion", { mensaje });
      setMensajeActualizacion("");
      Swal.fire(
        "Mensaje enviado",
        `Notificaciones creadas: ${data?.creadas ?? 0}. Las sesiones activas fueron notificadas para cerrar.`,
        "success",
      );
    } catch (error: any) {
      const msg = error?.response?.data?.message || "No se pudo enviar el mensaje de actualizacion";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
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

  const buildActualizacionMasivaPayload = () => {
    const cambios: Record<string, number> = {};
    if (productBulkUpdateDraft.actualizarPrecio) cambios.precio = Number(productBulkUpdateDraft.precio) || 0;
    if (productBulkUpdateDraft.actualizarStockMax) cambios.stockMax = Number(productBulkUpdateDraft.stockMax) || 0;
    if (productBulkUpdateDraft.actualizarMerma) cambios.mermaPorcentaje = Number(productBulkUpdateDraft.mermaPorcentaje) || 0;

    return {
      filtros: {
        tipos: parseCsv(productBulkUpdateDraft.tipos),
        generos: parseCsv(productBulkUpdateDraft.generos),
        telas: parseCsv(productBulkUpdateDraft.telas),
        tallas: parseCsv(productBulkUpdateDraft.tallas),
        colores: parseCsv(productBulkUpdateDraft.colores),
      },
      cambios,
    };
  };

  const renderVistaPreviaActualizacionProductos = (data: any) => {
    const muestras = Array.isArray(data?.muestras) ? data.muestras : [];
    return `
      <div style="text-align:left;max-height:60vh;overflow:auto;padding-right:8px;">
        <p style="margin:0 0 12px 0;"><strong>Coincidencias:</strong> ${data?.totalCoincidencias ?? 0}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr>
              <th style="border-bottom:1px solid #dbe3ea;text-align:left;padding:6px;">Codigo</th>
              <th style="border-bottom:1px solid #dbe3ea;text-align:left;padding:6px;">Producto</th>
              <th style="border-bottom:1px solid #dbe3ea;text-align:left;padding:6px;">Filtro</th>
              <th style="border-bottom:1px solid #dbe3ea;text-align:right;padding:6px;">Precio</th>
              <th style="border-bottom:1px solid #dbe3ea;text-align:right;padding:6px;">Stock max</th>
              <th style="border-bottom:1px solid #dbe3ea;text-align:right;padding:6px;">Merma</th>
            </tr>
          </thead>
          <tbody>
            ${
              muestras.length
                ? muestras
                    .map(
                      (item: any) => `
                        <tr>
                          <td style="border-bottom:1px solid #eef2f6;padding:6px;font-family:Consolas,monospace;">${item.codigo || ""}</td>
                          <td style="border-bottom:1px solid #eef2f6;padding:6px;">${item.tipo || ""}</td>
                          <td style="border-bottom:1px solid #eef2f6;padding:6px;">${[item.genero, item.tela, item.talla, item.color].filter(Boolean).join(" / ")}</td>
                          <td style="border-bottom:1px solid #eef2f6;padding:6px;text-align:right;">Q ${Number(item.precioActual || 0).toFixed(2)} -> Q ${Number(item.precioNuevo || 0).toFixed(2)}</td>
                          <td style="border-bottom:1px solid #eef2f6;padding:6px;text-align:right;">${item.stockMaxActual ?? 0} -> ${item.stockMaxNuevo ?? 0}</td>
                          <td style="border-bottom:1px solid #eef2f6;padding:6px;text-align:right;">${Number(item.mermaPorcentajeActual || 0).toFixed(2)}% -> ${Number(item.mermaPorcentajeNuevo || 0).toFixed(2)}%</td>
                        </tr>
                      `
                    )
                    .join("")
                : `<tr><td colspan="6" style="padding:10px;text-align:center;">Sin coincidencias</td></tr>`
            }
          </tbody>
        </table>
        <p style="margin:10px 0 0;color:#64748b;font-size:12px;">Se muestran hasta 12 codigos de ejemplo.</p>
      </div>
    `;
  };

  const verVistaPreviaActualizacionProductos = async () => {
    try {
      setLoading(true);
      const resp = await api.post("/productos/actualizacion-masiva/preview", buildActualizacionMasivaPayload());
      await Swal.fire({
        title: "Vista previa de actualizacion",
        html: renderVistaPreviaActualizacionProductos(resp.data || {}),
        width: 1100,
        confirmButtonText: "Cerrar",
      });
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo generar la vista previa";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const ejecutarActualizacionMasivaProductos = async () => {
    try {
      setLoading(true);
      const preview = await api.post("/productos/actualizacion-masiva/preview", buildActualizacionMasivaPayload());
      const total = Number(preview.data?.totalCoincidencias || 0);

      const result = await Swal.fire({
        title: "Actualizar productos existentes",
        html: `${renderVistaPreviaActualizacionProductos(preview.data || {})}<p style="text-align:left;margin-top:12px;"><strong>Se actualizaran ${total} productos.</strong></p>`,
        width: 1100,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Aplicar cambios",
        cancelButtonText: "Cancelar",
      });

      if (!result.isConfirmed) return;

      const resp = await api.post("/productos/actualizacion-masiva", buildActualizacionMasivaPayload());
      Swal.fire("Actualizacion completada", `Productos actualizados: ${resp.data?.actualizados ?? 0}`, "success");
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo aplicar la actualizacion masiva";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const buildCreacionMasivaPayload = () => ({
    filtros: {
      tipos: parseCsv(productBulkCreateDraft.tipos),
      tipoAbreviacion: productBulkCreateDraft.tipoAbreviacion.trim(),
      categoria: productBulkCreateDraft.categoria.trim(),
      generos: parseCsv(productBulkCreateDraft.generos),
      telas: parseCsv(productBulkCreateDraft.telas),
      tallas: parseCsv(productBulkCreateDraft.tallas),
      colores: parseCsv(productBulkCreateDraft.colores),
    },
    valores: {
      precio: Number(productBulkCreateDraft.precio) || 0,
      stockMax: Number(productBulkCreateDraft.stockMax) || 0,
      mermaPorcentaje: Number(productBulkCreateDraft.mermaPorcentaje) || 0,
    },
  });

  const renderVistaPreviaCreacionProductos = (data: any) => {
    const muestras = Array.isArray(data?.muestras) ? data.muestras : [];
    return `
      <div style="text-align:left;max-height:60vh;overflow:auto;padding-right:8px;">
        <p style="margin:0 0 12px 0;">
          <strong>Total combinaciones:</strong> ${data?.totalCombinaciones ?? 0}<br />
          <strong>Se crearian:</strong> ${data?.seCrearian ?? data?.creados ?? 0}<br />
          <strong>Ya existen:</strong> ${data?.existentes ?? 0}
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr>
              <th style="border-bottom:1px solid #dbe3ea;text-align:left;padding:6px;">Codigo</th>
              <th style="border-bottom:1px solid #dbe3ea;text-align:left;padding:6px;">Producto</th>
              <th style="border-bottom:1px solid #dbe3ea;text-align:left;padding:6px;">Detalle</th>
              <th style="border-bottom:1px solid #dbe3ea;text-align:right;padding:6px;">Precio</th>
              <th style="border-bottom:1px solid #dbe3ea;text-align:right;padding:6px;">Stock max</th>
              <th style="border-bottom:1px solid #dbe3ea;text-align:center;padding:6px;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${
              muestras.length
                ? muestras
                    .map(
                      (item: any) => `
                        <tr>
                          <td style="border-bottom:1px solid #eef2f6;padding:6px;font-family:Consolas,monospace;">${item.codigo || ""}</td>
                          <td style="border-bottom:1px solid #eef2f6;padding:6px;">${item.tipo || ""} ${item.genero || ""}</td>
                          <td style="border-bottom:1px solid #eef2f6;padding:6px;">${[item.tela, item.talla, item.color].filter(Boolean).join(" / ")}</td>
                          <td style="border-bottom:1px solid #eef2f6;padding:6px;text-align:right;">Q ${Number(item.precio || 0).toFixed(2)}</td>
                          <td style="border-bottom:1px solid #eef2f6;padding:6px;text-align:right;">${item.stockMax ?? 0}</td>
                          <td style="border-bottom:1px solid #eef2f6;padding:6px;text-align:center;">${item.existe ? "Existente" : "Nuevo"}</td>
                        </tr>
                      `
                    )
                    .join("")
                : `<tr><td colspan="6" style="padding:10px;text-align:center;">Sin muestras</td></tr>`
            }
          </tbody>
        </table>
        <p style="margin:10px 0 0;color:#64748b;font-size:12px;">Se muestran hasta 20 codigos de ejemplo.</p>
      </div>
    `;
  };

  const verVistaPreviaCreacionProductos = async () => {
    try {
      setLoading(true);
      const resp = await api.post("/productos/creacion-masiva/preview", buildCreacionMasivaPayload());
      await Swal.fire({
        title: "Vista previa de creacion",
        html: renderVistaPreviaCreacionProductos(resp.data || {}),
        width: 1100,
        confirmButtonText: "Cerrar",
      });
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo generar la vista previa";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const ejecutarCreacionMasivaProductos = async () => {
    try {
      setLoading(true);
      const preview = await api.post("/productos/creacion-masiva/preview", buildCreacionMasivaPayload());
      const total = Number(preview.data?.seCrearian || 0);

      const result = await Swal.fire({
        title: "Crear codigos masivamente",
        html: `${renderVistaPreviaCreacionProductos(preview.data || {})}<p style="text-align:left;margin-top:12px;"><strong>Se crearan ${total} codigos nuevos.</strong></p>`,
        width: 1100,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Crear codigos",
        cancelButtonText: "Cancelar",
      });

      if (!result.isConfirmed) return;

      const resp = await api.post("/productos/creacion-masiva", buildCreacionMasivaPayload());
      Swal.fire("Creacion completada", `Codigos creados: ${resp.data?.creados ?? 0}`, "success");
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "No se pudo ejecutar la creacion masiva";
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
        {canManageAdmin && (
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

      {canManageAdmin && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <NotificationsActiveOutlined color="primary" />
              <Typography variant="h6">Mensaje por actualizacion</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Envia un aviso a todos los usuarios activos, crea una notificacion interna para cada uno y cierra sus sesiones abiertas para aplicar cambios recientes.
            </Typography>
            <TextField
              label="Mensaje para los usuarios"
              value={mensajeActualizacion}
              onChange={(e) => setMensajeActualizacion(e.target.value)}
              multiline
              minRows={3}
              fullWidth
              placeholder="Ej. Se aplico una actualizacion. Inicia sesion nuevamente para cargar la nueva version del sistema."
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end">
              <Button
                variant="contained"
                color="warning"
                onClick={enviarMensajeActualizacion}
                disabled={loading || !mensajeActualizacion.trim()}
              >
                Enviar mensaje y cerrar sesiones
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {canManageAdmin && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <NotificationsActiveOutlined color="primary" />
              <Typography variant="h6">Reportes automáticos</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Configura el envío de reporte diario cuando todas las tiendas completen su reporte y los parámetros SMTP.
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="SMTP Host"
                  fullWidth
                  value={config.smtpHost}
                  onChange={(e) => setConfig((prev) => ({ ...prev, smtpHost: e.target.value }))}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="SMTP Port"
                  type="number"
                  fullWidth
                  value={config.smtpPort}
                  onChange={(e) => setConfig((prev) => ({ ...prev, smtpPort: Number(e.target.value) || 0 }))}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="SMTP User"
                  fullWidth
                  value={config.smtpUser}
                  onChange={(e) => setConfig((prev) => ({ ...prev, smtpUser: e.target.value }))}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="SMTP Pass"
                  type="password"
                  fullWidth
                  value={config.smtpPass}
                  onChange={(e) => setConfig((prev) => ({ ...prev, smtpPass: e.target.value }))}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Correo desde"
                  fullWidth
                  value={config.smtpFrom}
                  onChange={(e) => setConfig((prev) => ({ ...prev, smtpFrom: e.target.value }))}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.resendEnabled}
                      onChange={(e) => setConfig((prev) => ({ ...prev, resendEnabled: e.target.checked }))}
                    />
                  }
                  label="Usar Resend para envíos de correo"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Resend API Key"
                  type="password"
                  fullWidth
                  value={resendApiKeyDraft}
                  onChange={(e) => setResendApiKeyDraft(e.target.value)}
                  helperText="Dejar vacío para mantener la clave actual"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Correo desde Resend"
                  fullWidth
                  value={config.resendFrom}
                  onChange={(e) => setConfig((prev) => ({ ...prev, resendFrom: e.target.value }))}
                  helperText="Opcional: si no se especifica, se usa el remitente SMTP"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Template Resend (opcional)"
                  fullWidth
                  value={config.resendTemplateId}
                  onChange={(e) => setConfig((prev) => ({ ...prev, resendTemplateId: e.target.value }))}
                  helperText="ID de plantilla Resend para envíos con template"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Correo desde"
                  fullWidth
                  value={config.smtpFrom}
                  onChange={(e) => setConfig((prev) => ({ ...prev, smtpFrom: e.target.value }))}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.dailyReportEnabled}
                      onChange={(e) => setConfig((prev) => ({ ...prev, dailyReportEnabled: e.target.checked }))}
                    />
                  }
                  label="Enviar reporte diario al completarse"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Correo destino reporte diario"
                  fullWidth
                  value={config.dailyReportEmailTo}
                  onChange={(e) => setConfig((prev) => ({ ...prev, dailyReportEmailTo: e.target.value }))}
                  helperText="Separar varios correos con comas"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Asunto del correo"
                  fullWidth
                  value={config.dailyReportSubject}
                  onChange={(e) => setConfig((prev) => ({ ...prev, dailyReportSubject: e.target.value }))}
                  helperText="Usa {fecha} para incluir la fecha del reporte"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.fortnightlyReportEnabled}
                      onChange={(e) => setConfig((prev) => ({ ...prev, fortnightlyReportEnabled: e.target.checked }))}
                    />
                  }
                  label="Enviar reporte quincenal al generarse"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Correo destino reporte quincenal"
                  fullWidth
                  value={config.fortnightlyReportEmailTo}
                  onChange={(e) => setConfig((prev) => ({ ...prev, fortnightlyReportEmailTo: e.target.value }))}
                  helperText="Separar varios correos con comas"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Asunto del correo quincenal"
                  fullWidth
                  value={config.fortnightlyReportSubject}
                  onChange={(e) => setConfig((prev) => ({ ...prev, fortnightlyReportSubject: e.target.value }))}
                  helperText="Usa {periodo} para incluir la quincena"
                />
              </Grid>
            </Grid>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
              <Button variant="contained" onClick={guardar} disabled={loading}>
                Guardar configuración de reportes
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {canManageAdmin && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Inventory2Outlined color="primary" />
              <Typography variant="subtitle2">Actualizacion masiva de productos existentes</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Filtra productos ya creados y actualiza campos como precio, stock maximo o merma. Deja un filtro vacio para incluir todos sus valores.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Ejemplo: Tipo `FILIPINA`, genero `DAMA`, tela `REPEL`, tallas y colores vacios, precio nuevo `250`.
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 2.4 }}>
                <TextField
                  label="Tipos"
                  fullWidth
                  value={productBulkUpdateDraft.tipos}
                  onChange={(e) => setProductBulkUpdateDraft((prev) => ({ ...prev, tipos: e.target.value }))}
                  helperText="Ej. FILIPINA"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2.4 }}>
                <TextField
                  label="Generos"
                  fullWidth
                  value={productBulkUpdateDraft.generos}
                  onChange={(e) => setProductBulkUpdateDraft((prev) => ({ ...prev, generos: e.target.value }))}
                  helperText="Ej. DAMA"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2.4 }}>
                <TextField
                  label="Telas"
                  fullWidth
                  value={productBulkUpdateDraft.telas}
                  onChange={(e) => setProductBulkUpdateDraft((prev) => ({ ...prev, telas: e.target.value }))}
                  helperText="Ej. REPEL"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2.4 }}>
                <TextField
                  label="Tallas"
                  fullWidth
                  value={productBulkUpdateDraft.tallas}
                  onChange={(e) => setProductBulkUpdateDraft((prev) => ({ ...prev, tallas: e.target.value }))}
                  helperText="Vacio = todas"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2.4 }}>
                <TextField
                  label="Colores"
                  fullWidth
                  value={productBulkUpdateDraft.colores}
                  onChange={(e) => setProductBulkUpdateDraft((prev) => ({ ...prev, colores: e.target.value }))}
                  helperText="Vacio = todos"
                />
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={productBulkUpdateDraft.actualizarPrecio}
                        onChange={(e) =>
                          setProductBulkUpdateDraft((prev) => ({ ...prev, actualizarPrecio: e.target.checked }))
                        }
                      />
                    }
                    label="Actualizar precio"
                  />
                  <TextField
                    label="Nuevo precio"
                    type="number"
                    fullWidth
                    disabled={!productBulkUpdateDraft.actualizarPrecio}
                    value={productBulkUpdateDraft.precio}
                    onChange={(e) => setProductBulkUpdateDraft((prev) => ({ ...prev, precio: Number(e.target.value) || 0 }))}
                  />
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={productBulkUpdateDraft.actualizarStockMax}
                        onChange={(e) =>
                          setProductBulkUpdateDraft((prev) => ({ ...prev, actualizarStockMax: e.target.checked }))
                        }
                      />
                    }
                    label="Actualizar stock max"
                  />
                  <TextField
                    label="Nuevo stock max"
                    type="number"
                    fullWidth
                    disabled={!productBulkUpdateDraft.actualizarStockMax}
                    value={productBulkUpdateDraft.stockMax}
                    onChange={(e) => setProductBulkUpdateDraft((prev) => ({ ...prev, stockMax: Number(e.target.value) || 0 }))}
                  />
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={productBulkUpdateDraft.actualizarMerma}
                        onChange={(e) =>
                          setProductBulkUpdateDraft((prev) => ({ ...prev, actualizarMerma: e.target.checked }))
                        }
                      />
                    }
                    label="Actualizar merma"
                  />
                  <TextField
                    label="Nueva merma %"
                    type="number"
                    fullWidth
                    disabled={!productBulkUpdateDraft.actualizarMerma}
                    value={productBulkUpdateDraft.mermaPorcentaje}
                    onChange={(e) =>
                      setProductBulkUpdateDraft((prev) => ({ ...prev, mermaPorcentaje: Number(e.target.value) || 0 }))
                    }
                  />
                </Stack>
              </Grid>
            </Grid>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end">
              <Button variant="outlined" onClick={() => setProductBulkUpdateDraft(createEmptyBulkUpdateDraft())} disabled={loading}>
                Limpiar filtros
              </Button>
              <Button variant="outlined" onClick={verVistaPreviaActualizacionProductos} disabled={loading}>
                Vista previa
              </Button>
              <Button variant="contained" onClick={ejecutarActualizacionMasivaProductos} disabled={loading}>
                Aplicar actualizacion
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {canManageAdmin && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Inventory2Outlined color="primary" />
              <Typography variant="subtitle2">Creacion masiva de codigos de productos</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Crea combinaciones nuevas usando tipo, genero, tela, talla y color. Deja tallas o colores vacios para incluir todos los catalogos existentes.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Ejemplo: Tipo `FILIPINA`, abreviacion `F`, categoria `FILIPINA`, genero `DAMA`, tela `REPEL`, tallas y colores vacios.
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Tipos"
                  fullWidth
                  value={productBulkCreateDraft.tipos}
                  onChange={(e) => setProductBulkCreateDraft((prev) => ({ ...prev, tipos: e.target.value }))}
                  helperText="Requerido. Ej. FILIPINA"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Abreviacion tipo"
                  fullWidth
                  value={productBulkCreateDraft.tipoAbreviacion}
                  onChange={(e) =>
                    setProductBulkCreateDraft((prev) => ({ ...prev, tipoAbreviacion: e.target.value }))
                  }
                  helperText="Opcional si ya existe regla"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Categoria"
                  fullWidth
                  value={productBulkCreateDraft.categoria}
                  onChange={(e) => setProductBulkCreateDraft((prev) => ({ ...prev, categoria: e.target.value }))}
                  helperText="Vacio = mismo tipo"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Generos"
                  fullWidth
                  value={productBulkCreateDraft.generos}
                  onChange={(e) => setProductBulkCreateDraft((prev) => ({ ...prev, generos: e.target.value }))}
                  helperText="Requerido. Ej. DAMA"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Telas"
                  fullWidth
                  value={productBulkCreateDraft.telas}
                  onChange={(e) => setProductBulkCreateDraft((prev) => ({ ...prev, telas: e.target.value }))}
                  helperText="Requerido. Ej. REPEL"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Tallas"
                  fullWidth
                  value={productBulkCreateDraft.tallas}
                  onChange={(e) => setProductBulkCreateDraft((prev) => ({ ...prev, tallas: e.target.value }))}
                  helperText="Vacio = todas"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Colores"
                  fullWidth
                  value={productBulkCreateDraft.colores}
                  onChange={(e) => setProductBulkCreateDraft((prev) => ({ ...prev, colores: e.target.value }))}
                  helperText="Vacio = todos"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Precio"
                  type="number"
                  fullWidth
                  value={productBulkCreateDraft.precio}
                  onChange={(e) =>
                    setProductBulkCreateDraft((prev) => ({ ...prev, precio: Number(e.target.value) || 0 }))
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Stock maximo"
                  type="number"
                  fullWidth
                  value={productBulkCreateDraft.stockMax}
                  onChange={(e) =>
                    setProductBulkCreateDraft((prev) => ({ ...prev, stockMax: Number(e.target.value) || 0 }))
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Merma %"
                  type="number"
                  fullWidth
                  value={productBulkCreateDraft.mermaPorcentaje}
                  onChange={(e) =>
                    setProductBulkCreateDraft((prev) => ({
                      ...prev,
                      mermaPorcentaje: Number(e.target.value) || 0,
                    }))
                  }
                />
              </Grid>
            </Grid>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end">
              <Button variant="outlined" onClick={() => setProductBulkCreateDraft(createEmptyBulkCreateDraft())} disabled={loading}>
                Limpiar filtros
              </Button>
              <Button variant="outlined" onClick={verVistaPreviaCreacionProductos} disabled={loading}>
                Vista previa
              </Button>
              <Button variant="contained" onClick={ejecutarCreacionMasivaProductos} disabled={loading}>
                Crear codigos
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {canManageAdmin && (
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

      {canManageAdmin && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <NotificationsActiveOutlined color="primary" />
              <Typography variant="subtitle2">Acceso multi-tienda por rol</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Los roles seleccionados podran operar con varias tiendas y elegir bodega en pantallas donde normalmente se usa la bodega asignada al usuario.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Roles guardados actualmente:{" "}
              {savedCrossStoreRoleIds.length ? getRoleNames(savedCrossStoreRoleIds) : "ninguno"}
            </Typography>
            <TextField
              select
              fullWidth
              label="Roles con acceso multi-tienda"
              value={config.crossStoreRoleIds}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  crossStoreRoleIds: normalizeRoleIds(e.target.value),
                }))
              }
              SelectProps={{
                multiple: true,
                renderValue: (selected) => {
                  const ids = normalizeRoleIds(selected);
                  return getRoleNames(ids);
                },
              }}
              helperText="Se aplica especificamente con el boton de abajo."
            >
              {roles.map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  <Checkbox checked={config.crossStoreRoleIds.includes(role.id)} />
                  {role.nombre}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="contained" onClick={guardarRolesMultiBodega} disabled={loading}>
                Aplicar acceso multi-tienda
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {canManageAdmin && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <NotificationsActiveOutlined color="primary" />
              <Typography variant="subtitle2">Permiso para unificar pedidos por rol</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Los roles seleccionados veran habilitado el boton de unificar pedidos en produccion.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Roles guardados actualmente:{" "}
              {savedUnifyOrderRoleIds.length ? getRoleNames(savedUnifyOrderRoleIds) : "ninguno"}
            </Typography>
            <TextField
              select
              fullWidth
              label="Roles con permiso para unificar pedidos"
              value={config.unifyOrderRoleIds}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  unifyOrderRoleIds: normalizeRoleIds(e.target.value),
                }))
              }
              SelectProps={{
                multiple: true,
                renderValue: (selected) => {
                  const ids = normalizeRoleIds(selected);
                  return getRoleNames(ids);
                },
              }}
              helperText="Se aplica especificamente con el boton de abajo."
            >
              {roles.map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  <Checkbox checked={config.unifyOrderRoleIds.includes(role.id)} />
                  {role.nombre}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="contained" onClick={guardarRolesUnificarPedidos} disabled={loading}>
                Aplicar permiso de unificar pedidos
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {canManageAdmin && (
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

      {canManageAdmin && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <NotificationsActiveOutlined color="primary" />
              <Typography variant="subtitle2">Alertas internas de pedidos</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Selecciona los roles que deben recibir una alerta interna cada vez que se genere un pedido de produccion.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Roles guardados actualmente:{" "}
              {savedPedidoAlertRoleIds.length ? getRoleNames(savedPedidoAlertRoleIds) : "ninguno"}
            </Typography>
            <TextField
              select
              fullWidth
              label="Roles a notificar por nuevo pedido"
              value={config.pedidoAlertRoleIds}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  pedidoAlertRoleIds: normalizeRoleIds(e.target.value),
                }))
              }
              SelectProps={{
                multiple: true,
                renderValue: (selected) => {
                  const ids = normalizeRoleIds(selected);
                  return getRoleNames(ids);
                },
              }}
              helperText="Esta configuracion se guarda con el boton de abajo y aplica por rol, no por usuario individual."
            >
              {roles.map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  <Checkbox checked={config.pedidoAlertRoleIds.includes(role.id)} />
                  {role.nombre}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="contained" onClick={guardarAlertasPedido} disabled={loading}>
                Guardar roles de alertas
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

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
