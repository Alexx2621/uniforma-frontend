import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Paper,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  Stack,
  Grid,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  IconButton,
  MenuItem,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import NotificationsActiveOutlined from "@mui/icons-material/NotificationsActiveOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import ScheduleOutlined from "@mui/icons-material/ScheduleOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import { useAuthStore } from "../auth/useAuthStore";
import { hasPermission } from "../auth/permissions";
import { UniformaLoader } from "../components/UniformaLoader";
import { formatCurrency } from "../utils/currency";
import {
  DEFAULT_DAILY_REPORT_SCHEDULE_RULES,
  DAY_LABELS,
  ReportScheduleRule,
  expandReportScheduleRulesByDay,
  formatReportSchedule,
  normalizeReportScheduleRules,
} from "../utils/reportSchedule";

interface NotifConfig {
  emailTo: string;
  whatsappTo: string;
  stockThreshold: number;
  highSaleThreshold: number;
  pedidoAlertRoleIds: number[];
  vendedorDropdownBodegaIds: number[];
  salesInventoryEnabled: boolean;
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
  dailyReportScheduleEnabled: boolean;
  dailyReportScheduleRules: ReportScheduleRule[];
  fortnightlyReportEnabled: boolean;
  fortnightlyReportEmailTo: string;
  fortnightlyReportSubject: string;
  productMassConfig?: unknown;
}

interface RolOption {
  id: number;
  nombre: string;
}

interface BodegaOption {
  id: number;
  nombre: string;
  ubicacion?: string | null;
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

const SettingsSection = ({
  title,
  description,
  icon,
  children,
  defaultExpanded = false,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
}) => (
  <Accordion
    defaultExpanded={defaultExpanded}
    disableGutters
    sx={{
      mb: 1.5,
      border: "1px solid",
      borderColor: "divider",
      borderRadius: 1,
      boxShadow: "none",
      "&:before": { display: "none" },
      "&.Mui-expanded": { my: 1.5 },
    }}
  >
    <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ width: "100%" }}>
        {icon}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            {title}
          </Typography>
          {description ? (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          ) : null}
        </Box>
      </Stack>
    </AccordionSummary>
    <AccordionDetails sx={{ pt: 0 }}>
      {children}
    </AccordionDetails>
  </Accordion>
);

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
    vendedorDropdownBodegaIds: [],
    salesInventoryEnabled: true,
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
    dailyReportScheduleEnabled: true,
    dailyReportScheduleRules: DEFAULT_DAILY_REPORT_SCHEDULE_RULES,
    fortnightlyReportEnabled: false,
    fortnightlyReportEmailTo: "",
    fortnightlyReportSubject: "Reporte quincenal {periodo}",
  });
  const [savedPedidoAlertRoleIds, setSavedPedidoAlertRoleIds] = useState<number[]>([]);
  const [savedVendedorDropdownBodegaIds, setSavedVendedorDropdownBodegaIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaderPreviewOpen, setLoaderPreviewOpen] = useState(false);
  const [roles, setRoles] = useState<RolOption[]>([]);
  const [bodegas, setBodegas] = useState<BodegaOption[]>([]);
  const [smtpPassDraft, setSmtpPassDraft] = useState('');
  const [resendApiKeyDraft, setResendApiKeyDraft] = useState('');
  const [mensajeActualizacion, setMensajeActualizacion] = useState("");
  const [productMassConfigDraft, setProductMassConfigDraft] = useState<ProductMassConfigDraft>(
    () => createEmptyMassConfigDraft()
  );
  const [productBulkUpdateDraft, setProductBulkUpdateDraft] = useState<ProductBulkUpdateDraft>(
    () => createEmptyBulkUpdateDraft()
  );
  const [productBulkCreateDraft, setProductBulkCreateDraft] = useState<ProductBulkCreateDraft>(
    () => createEmptyBulkCreateDraft()
  );
  const {
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
  const getBodegaNames = useCallback(
    (bodegaIds: number[]) =>
      normalizeRoleIds(bodegaIds)
        .map((id) => bodegas.find((bodega) => bodega.id === id)?.nombre || `Tienda #${id}`)
        .join(", "),
    [bodegas]
  );

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const [respConfig, respRoles, respBodegas] = await Promise.all([
        api.get("/config/notificaciones"),
        canManageAdmin ? api.get("/roles").catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        canManageAdmin ? api.get("/bodegas").catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
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
      const dailyReportSchedule = reporteDiario?.schedule || {};

      setConfig({
        emailTo: data.emailTo || "",
        whatsappTo: data.whatsappTo || "",
        stockThreshold: data.stockThreshold ?? 5,
        highSaleThreshold: data.highSaleThreshold ?? 1000,
        pedidoAlertRoleIds: normalizeRoleIds(data.pedidoAlertRoleIds),
        vendedorDropdownBodegaIds: normalizeRoleIds(data.vendedorDropdownBodegaIds),
        salesInventoryEnabled: data.salesInventoryEnabled !== false,
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
        dailyReportScheduleEnabled: Boolean(dailyReportSchedule?.enabled),
        dailyReportScheduleRules: expandReportScheduleRulesByDay(dailyReportSchedule?.rules),
        fortnightlyReportEnabled: Boolean(reporteQuincenal?.enabled),
        fortnightlyReportEmailTo: reporteQuincenal?.emailTo || '',
        fortnightlyReportSubject: reporteQuincenal?.subject || 'Reporte quincenal {periodo}',
        productMassConfig: data.productMassConfig,
      });
      setSmtpPassDraft('');
      setResendApiKeyDraft('');
      setSavedPedidoAlertRoleIds(normalizeRoleIds(data.pedidoAlertRoleIds));
      setSavedVendedorDropdownBodegaIds(normalizeRoleIds(data.vendedorDropdownBodegaIds));
      setProductMassConfigDraft(mapMassConfigToDraft(data.productMassConfig || {}));
      const rolesData = Array.isArray(respRoles.data) ? respRoles.data : [];
      setRoles(
        rolesData
          .filter((item: any) => Number.isFinite(Number(item?.id)) && typeof item?.nombre === "string")
          .map((item: any) => ({
            id: Number(item.id),
            nombre: item.nombre,
          }))
      );
      const bodegasData = Array.isArray(respBodegas.data) ? respBodegas.data : [];
      setBodegas(
        bodegasData
          .filter((item: any) => Number.isFinite(Number(item?.id)) && typeof item?.nombre === "string")
          .map((item: any) => ({
            id: Number(item.id),
            nombre: item.nombre,
            ubicacion: item.ubicacion || null,
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

  const guardar = async () => {
    try {
      setLoading(true);
      await api.put("/config/notificaciones", {
        emailTo: config.emailEnabled ? config.emailTo : "",
        whatsappTo: config.whatsappEnabled ? config.whatsappTo : "",
        stockThreshold: config.stockThreshold,
        highSaleThreshold: config.highSaleThreshold,
        pedidoAlertRoleIds: config.pedidoAlertRoleIds,
        salesInventoryEnabled: config.salesInventoryEnabled,
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
              schedule: {
                enabled: config.dailyReportScheduleEnabled,
                rules: normalizeReportScheduleRules(config.dailyReportScheduleRules),
              },
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
      await fetchConfig();
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

  const guardarAccesoDropdownVendedores = async () => {
    try {
      setLoading(true);
      const payload = {
        vendedorDropdownBodegaIds: normalizeRoleIds(config.vendedorDropdownBodegaIds),
      };
      const { data } = await api.put("/config/notificaciones", payload);
      const nextBodegaIds = normalizeRoleIds(data?.vendedorDropdownBodegaIds ?? payload.vendedorDropdownBodegaIds);
      setConfig((prev) => ({
        ...prev,
        vendedorDropdownBodegaIds: nextBodegaIds,
      }));
      setSavedVendedorDropdownBodegaIds(nextBodegaIds);
      await fetchConfig();
      await cargar();
      Swal.fire("Guardado", "El alcance del selector de vendedores fue actualizado", "success");
    } catch {
      Swal.fire("Error", "No se pudo guardar el alcance del selector de vendedores", "error");
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
                          <td style="border-bottom:1px solid #eef2f6;padding:6px;text-align:right;">${formatCurrency(item.precioActual)} -> ${formatCurrency(item.precioNuevo)}</td>
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
                          <td style="border-bottom:1px solid #eef2f6;padding:6px;text-align:right;">${formatCurrency(item.precio)}</td>
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

  const updateDailyScheduleRule = (index: number, field: "start" | "end", value: string) => {
    setConfig((prev) => ({
      ...prev,
      dailyReportScheduleRules: expandReportScheduleRulesByDay(prev.dailyReportScheduleRules).map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, [field]: value } : rule
      ),
    }));
  };

  const toggleDailyScheduleRule = (index: number, enabled: boolean) => {
    setConfig((prev) => ({
      ...prev,
      dailyReportScheduleRules: expandReportScheduleRulesByDay(prev.dailyReportScheduleRules).map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, enabled } : rule
      ),
    }));
  };

  const generosDisponibles = productMassConfigDraft.generos.map((item) => item.nombre).filter(Boolean);
  const telasDisponibles = productMassConfigDraft.telas.map((item) => item.nombre).filter(Boolean);
  const coloresDisponibles = productMassConfigDraft.colorAbreviaciones.map((item) => item.nombre).filter(Boolean);

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <NotificationsActiveOutlined color="primary" />
          <Typography variant="h4">Notificaciones</Typography>
        </Stack>
        <Button variant="outlined" onClick={() => setLoaderPreviewOpen(true)}>
          Ver animacion de carga
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configura alertas de stock bajo, ventas altas o errores por correo o WhatsApp.
      </Typography>

      <Divider sx={{ mb: 2 }} />

      {canManageAdmin && (
        <SettingsSection
          title="Comunicados del sistema"
          description="Avisos globales para usuarios activos y cierre de sesiones cuando aplique."
          icon={<NotificationsActiveOutlined color="primary" />}
        >
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
        </SettingsSection>
      )}

      {canManageAdmin && (
        <SettingsSection
          title="Inventario"
          description="Reglas de inventario que aplican al guardar ventas."
          icon={<Inventory2Outlined color="primary" />}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Inventory2Outlined color="primary" />
              <Typography variant="h6">Inventario en ventas</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Controla si una venta valida stock disponible y descuenta inventario al guardarse.
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={config.salesInventoryEnabled}
                  onChange={(e) => setConfig((prev) => ({ ...prev, salesInventoryEnabled: e.target.checked }))}
                />
              }
              label={config.salesInventoryEnabled ? "Usar inventario en ventas" : "No usar inventario en ventas"}
            />
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="contained" onClick={guardar} disabled={loading}>
                Guardar configuracion
              </Button>
            </Stack>
          </Stack>
        </SettingsSection>
      )}

      {canManageAdmin && (
        <SettingsSection
          title="Selector de vendedores"
          description="Tiendas visibles para roles con permiso de selector de vendedores."
          icon={<NotificationsActiveOutlined color="primary" />}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <NotificationsActiveOutlined color="primary" />
              <Typography variant="subtitle2">Alcance del selector de vendedores</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              El permiso para usar este selector se asigna en Roles con "Selector de vendedores". Aqui solo se limita que tiendas aparecen en la lista.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Tiendas visibles actualmente:{" "}
              {savedVendedorDropdownBodegaIds.length ? getBodegaNames(savedVendedorDropdownBodegaIds) : "todas"}
            </Typography>
            <TextField
              select
              fullWidth
              label="Tiendas visibles en el selector"
              value={config.vendedorDropdownBodegaIds}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  vendedorDropdownBodegaIds: normalizeRoleIds(e.target.value),
                }))
              }
              SelectProps={{
                multiple: true,
                renderValue: (selected) => {
                  const ids = normalizeRoleIds(selected);
                  return ids.length ? getBodegaNames(ids) : "Todas";
                },
              }}
              helperText="Si no seleccionas tiendas, el selector muestra usuarios de todas las tiendas."
            >
              {bodegas.map((bodega) => (
                <MenuItem key={bodega.id} value={bodega.id}>
                  <Checkbox checked={config.vendedorDropdownBodegaIds.includes(bodega.id)} />
                  {bodega.nombre}
                  {bodega.ubicacion ? ` - ${bodega.ubicacion}` : ""}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="contained" onClick={guardarAccesoDropdownVendedores} disabled={loading}>
                Guardar tiendas visibles
              </Button>
            </Stack>
          </Stack>
        </SettingsSection>
      )}

      {canManageAdmin && (
        <SettingsSection
          title="Reportes y horarios"
          description="Correo y plantillas para reportes automaticos."
          icon={<NotificationsActiveOutlined color="primary" />}
        >
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
        </SettingsSection>
      )}

      {canManageAdmin && (
        <SettingsSection
          title="Tareas por horario"
          description="Define ventanas de tiempo para acciones especificas del sistema."
          icon={<ScheduleOutlined color="primary" />}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ScheduleOutlined color="primary" />
              <Typography variant="subtitle2">Nuevo reporte diario</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Cuando esta regla esta activa, el boton Nuevo reporte del modulo Reporte diario solo se habilita en los dias y horarios configurados.
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={config.dailyReportScheduleEnabled}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      dailyReportScheduleEnabled: e.target.checked,
                    }))
                  }
                />
              }
              label={
                config.dailyReportScheduleEnabled
                  ? "Limitar Nuevo reporte por horario"
                  : "Permitir Nuevo reporte en cualquier horario"
              }
            />
            <Grid container spacing={2}>
              {expandReportScheduleRulesByDay(config.dailyReportScheduleRules).map((rule, index) => {
                const day = rule.days[0];
                const enabled = rule.enabled !== false;
                return (
                  <Grid key={day} size={{ xs: 12, md: 6, lg: 4 }}>
                    <Paper variant="outlined" sx={{ p: 1.5, height: "100%" }}>
                      <Stack spacing={1.5}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={enabled}
                              onChange={(e) => toggleDailyScheduleRule(index, e.target.checked)}
                              disabled={!config.dailyReportScheduleEnabled}
                            />
                          }
                          label={`${DAY_LABELS[day] || `dia ${day}`}`.toUpperCase()}
                        />
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          <TextField
                            label="Desde"
                            type="time"
                            fullWidth
                            value={rule.start}
                            onChange={(e) => updateDailyScheduleRule(index, "start", e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ step: 300 }}
                            disabled={!config.dailyReportScheduleEnabled || !enabled}
                          />
                          <TextField
                            label="Hasta"
                            type="time"
                            fullWidth
                            value={rule.end}
                            onChange={(e) => updateDailyScheduleRule(index, "end", e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ step: 300 }}
                            disabled={!config.dailyReportScheduleEnabled || !enabled}
                          />
                        </Stack>
                      </Stack>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
            <Typography variant="caption" color="text.secondary">
              Horario actual: {formatReportSchedule({ rules: config.dailyReportScheduleRules })}
            </Typography>
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="contained" onClick={guardar} disabled={loading}>
                Guardar tareas por horario
              </Button>
            </Stack>
          </Stack>
        </SettingsSection>
      )}

      {canManageAdmin && (
        <SettingsSection
          title="Actualizacion masiva"
          description="Filtros para actualizar productos existentes por combinaciones."
          icon={<Inventory2Outlined color="primary" />}
        >
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
        </SettingsSection>
      )}

      {canManageAdmin && (
        <SettingsSection
          title="Creacion masiva"
          description="Crea codigos nuevos usando combinaciones de tipo, genero, tela, talla y color."
          icon={<Inventory2Outlined color="primary" />}
        >
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
        </SettingsSection>
      )}

      {canManageAdmin && (
        <SettingsSection
          title="Carga masiva de productos base"
          description="Reglas para generar o actualizar combinaciones base."
          icon={<Inventory2Outlined color="primary" />}
        >
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
        </SettingsSection>
      )}

      <Divider sx={{ my: 2 }} />

      {canManageAdmin && (
        <SettingsSection
          title="Alertas internas de pedidos"
          description="Roles que reciben notificaciones internas por pedidos de produccion."
          icon={<NotificationsActiveOutlined color="primary" />}
        >
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
        </SettingsSection>
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

      <Dialog open={loaderPreviewOpen} onClose={() => setLoaderPreviewOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Animacion de carga</DialogTitle>
        <DialogContent dividers>
          <Box
            sx={{
              minHeight: 220,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <UniformaLoader size={120} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoaderPreviewOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
