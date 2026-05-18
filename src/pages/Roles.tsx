import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Box,
  Checkbox,
  Chip,
  Divider,
  Grid,
  InputAdornment,
  LinearProgress,
  Paper,
  Typography,
  Stack,
  Button,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
} from "@mui/material";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import AdminPanelSettingsOutlined from "@mui/icons-material/AdminPanelSettingsOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import ConstructionOutlined from "@mui/icons-material/ConstructionOutlined";
import SelectAllOutlined from "@mui/icons-material/SelectAllOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { getRequiredPermission, hasPermission } from "../auth/permissions";
import UniformaTableLoadingRow from "../components/UniformaTableLoadingRow";
import { menuPathItems } from "../layout/menuItems";
import { useTablePagination } from "../utils/useTablePagination";

interface Rol {
  id: number;
  nombre: string;
  descripcion?: string | null;
  permisos?: Array<{ permiso: { nombre: string; descripcion?: string | null } }>;
}

interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  category: string;
}

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const getCatalogWithMenuModules = (catalog: PermissionDefinition[]) => {
  const byKey = new Map(catalog.map((permission) => [permission.key, permission]));

  menuPathItems.forEach((item) => {
    const permissionKey = getRequiredPermission(item.path);
    if (!permissionKey || byKey.has(permissionKey)) return;

    const label = item.parentLabel ? `${item.parentLabel} / ${item.label}` : item.label;
    const category = item.sectionTitle ? titleCase(item.sectionTitle) : "General";
    byKey.set(permissionKey, {
      key: permissionKey,
      label,
      description: `Ver modulo ${label.toLowerCase()}`,
      category,
    });
  });

  [
    {
      key: "bordados.view",
      label: "Bordados",
      description: "Ver modulo de bordados",
      category: "Bordados",
    },
    {
      key: "bordados.manage",
      label: "Gestionar bordados",
      description: "Actualizar estado y fecha estimada de bordados",
      category: "Bordados",
    },
    {
      key: "tracking.manage",
      label: "Gestionar tracking",
      description: "Reenviar correos de tracking de pedidos",
      category: "Produccion",
    },
  ].forEach((permission) => {
    byKey.set(permission.key, permission);
  });

  return Array.from(byKey.values());
};

interface PermissionGroup {
  category: string;
  permissions: PermissionDefinition[];
}

const actionPriority: Record<string, number> = {
  view: 1,
  manage: 2,
};

const getPermissionAction = (key: string) => {
  const parts = key.split(".");
  return parts[parts.length - 1] || "access";
};

const getViewPermissionFor = (key: string) => {
  const parts = key.split(".");
  if (parts.length < 2 || parts[parts.length - 1] === "view") return key;
  return [...parts.slice(0, -1), "view"].join(".");
};

const getActionLabel = (key: string) => {
  const action = getPermissionAction(key);
  if (action === "view") return "Ver";
  if (action === "manage") return "Gestionar";
  return "Especial";
};

const getActionIcon = (key: string) =>
  getPermissionAction(key) === "view" ? <VisibilityOutlined fontSize="small" /> : <ConstructionOutlined fontSize="small" />;

const permissionMatchesSearch = (permission: PermissionDefinition, search: string) => {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return [permission.key, permission.label, permission.description, permission.category]
    .join(" ")
    .toLowerCase()
    .includes(term);
};

const groupPermissions = (catalog: PermissionDefinition[], search: string): PermissionGroup[] => {
  const grouped = catalog
    .filter((permission) => permissionMatchesSearch(permission, search))
    .reduce((acc, permission) => {
      const list = acc.get(permission.category) || [];
      list.push(permission);
      acc.set(permission.category, list);
      return acc;
    }, new Map<string, PermissionDefinition[]>());

  return Array.from(grouped.entries())
    .map(([category, permissions]) => ({
      category,
      permissions: permissions.sort((a, b) => {
        const actionA = actionPriority[getPermissionAction(a.key)] || 99;
        const actionB = actionPriority[getPermissionAction(b.key)] || 99;
        return a.label.localeCompare(b.label) || actionA - actionB;
      }),
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
};

export default function Roles() {
  const [roles, setRoles] = useState<Rol[]>([]);
  const [catalogo, setCatalogo] = useState<PermissionDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Rol | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [permisosSeleccionados, setPermisosSeleccionados] = useState<string[]>([]);
  const [permissionSearch, setPermissionSearch] = useState("");
  const denyAlertShown = useRef(false);
  const { rol, permisos } = useAuthStore();
  const canView = hasPermission(rol, permisos, "roles.view");
  const canManage = hasPermission(rol, permisos, "roles.manage");
  const permissionGroups = useMemo(
    () => groupPermissions(catalogo, permissionSearch),
    [catalogo, permissionSearch]
  );
  const selectedPermissionSet = useMemo(() => new Set(permisosSeleccionados), [permisosSeleccionados]);
  const catalogKeys = useMemo(() => new Set(catalogo.map((permission) => permission.key)), [catalogo]);
  const totalPermissions = catalogo.length;
  const selectedCount = permisosSeleccionados.length;
  const { paginatedRows, paginationProps } = useTablePagination(roles, 10);

  const cargar = async () => {
    try {
      setLoading(true);
      const [rolesResp, catalogoResp] = await Promise.all([
        api.get("/roles"),
        api.get("/roles/permisos/catalogo"),
      ]);
      setRoles(rolesResp.data || []);
      setCatalogo(getCatalogWithMenuModules(catalogoResp.data || []));
    } catch {
      Swal.fire("Error", "No se pudieron cargar los roles", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      if (!denyAlertShown.current) {
        denyAlertShown.current = true;
        Swal.fire("Acceso restringido", "No tienes permisos para ingresar a Roles", "warning");
      }
      return;
    }
    cargar();
  }, [canView]);

  if (!canView) {
    return <Navigate to="/" replace />;
  }

  const abrirNuevo = () => {
    setEditing(null);
    setNombre("");
    setDescripcion("");
    setPermisosSeleccionados([]);
    setPermissionSearch("");
    setOpenForm(true);
  };

  const abrirEditar = (item: Rol) => {
    setEditing(item);
    setNombre(item.nombre);
    setDescripcion(item.descripcion || "");
    setPermisosSeleccionados(item.permisos?.map((permiso) => permiso.permiso.nombre) || []);
    setPermissionSearch("");
    setOpenForm(true);
  };

  const togglePermission = (permissionKey: string, checked: boolean) => {
    const viewKey = getViewPermissionFor(permissionKey);
    const impliedKeys = catalogKeys.has(viewKey) ? [permissionKey, viewKey] : [permissionKey];
    setPermisosSeleccionados((current) =>
      checked
        ? Array.from(new Set([...current, ...impliedKeys]))
        : current.filter((item) => item !== permissionKey)
    );
  };

  const setGroupPermissions = (permissions: PermissionDefinition[], checked: boolean) => {
    const keys = permissions.map((permission) => permission.key);
    setPermisosSeleccionados((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...keys]));
      }
      return current.filter((item) => !keys.includes(item));
    });
  };

  const setActionPermissions = (action: "view" | "manage", checked: boolean) => {
    const keys = catalogo
      .filter((permission) => getPermissionAction(permission.key) === action)
      .flatMap((permission) => {
        const viewKey = getViewPermissionFor(permission.key);
        return action === "manage" && catalogKeys.has(viewKey) ? [permission.key, viewKey] : [permission.key];
      });
    setPermisosSeleccionados((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...keys]));
      }
      return current.filter((item) => !keys.includes(item));
    });
  };

  const guardar = async () => {
    if (!editing && !nombre.trim()) {
      Swal.fire("Validacion", "Ingresa el nombre del rol", "info");
      return;
    }

    const payload = {
      descripcion: descripcion.trim() || null,
      permisos: permisosSeleccionados,
    } as { nombre?: string; descripcion: string | null; permisos: string[] };

    if (!editing) {
      payload.nombre = nombre.trim();
    }

    try {
      if (editing) {
        await api.put(`/roles/${editing.id}`, payload);
        Swal.fire("Actualizado", "Rol actualizado", "success");
      } else {
        await api.post("/roles", payload);
        Swal.fire("Creado", "Rol creado", "success");
      }
      setOpenForm(false);
      await cargar();
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo guardar el rol", "error");
    }
  };

  const eliminar = async (item: Rol) => {
    const confirm = await Swal.fire({
      title: "Eliminar rol",
      text: `Se eliminara "${item.nombre}".`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Si, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;

    try {
      await api.delete(`/roles/${item.id}`);
      Swal.fire("Eliminado", "Rol eliminado", "success");
      await cargar();
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo eliminar el rol", "error");
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AdminPanelSettingsOutlined color="primary" />
          <Typography variant="h4">Roles</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<AddOutlined />} variant="contained" size="small" onClick={abrirNuevo} disabled={!canManage}>
            Nuevo rol
          </Button>
          <Button
            startIcon={<RefreshOutlined />}
            variant="outlined"
            size="small"
            onClick={cargar}
            disabled={loading}
          >
            Recargar
          </Button>
        </Stack>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Administra desde aqui el acceso a modulos y las acciones permitidas para cada rol.
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Descripcion</TableCell>
              <TableCell>Permisos</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <UniformaTableLoadingRow colSpan={5} />
            ) : paginatedRows.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.id}</TableCell>
                <TableCell>{item.nombre}</TableCell>
                <TableCell>{item.descripcion || "N/D"}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={`${item.permisos?.length || 0} permisos`}
                    color={(item.permisos?.length || 0) ? "primary" : "default"}
                    variant={(item.permisos?.length || 0) ? "filled" : "outlined"}
                  />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<EditOutlined />}
                      disabled={!canManage}
                      onClick={() => abrirEditar(item)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      color="error"
                      startIcon={<DeleteOutline />}
                      disabled={!canManage}
                      onClick={() => eliminar(item)}
                    >
                      Eliminar
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {!loading && !roles.length && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No hay roles registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination {...paginationProps} />

      <Dialog open={openForm} onClose={() => setOpenForm(false)} fullWidth maxWidth="lg">
        <DialogTitle>{editing ? "Editar rol" : "Nuevo rol"}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  fullWidth
                  disabled={Boolean(editing)}
                  helperText={editing ? "El nombre del rol no se puede modificar" : undefined}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  label="Descripcion"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  fullWidth
                />
              </Grid>
            </Grid>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "stretch", md: "center" }}
                  spacing={1.5}
                >
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Acceso y acciones por modulo
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Marca Ver para mostrar el modulo, Gestionar para editar/operar y Especial para accesos como filtros multi-tienda.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip size="small" color="primary" label={`${selectedCount}/${totalPermissions} permisos`} />
                    <Button size="small" variant="outlined" startIcon={<VisibilityOutlined />} onClick={() => setActionPermissions("view", true)}>
                      Ver todos
                    </Button>
                    <Button size="small" variant="outlined" startIcon={<ConstructionOutlined />} onClick={() => setActionPermissions("manage", true)}>
                      Acciones
                    </Button>
                    <Button size="small" variant="text" onClick={() => setPermisosSeleccionados([])}>
                      Limpiar
                    </Button>
                  </Stack>
                </Stack>

                <LinearProgress
                  variant="determinate"
                  value={totalPermissions ? Math.min(100, (selectedCount / totalPermissions) * 100) : 0}
                  sx={{ height: 6, borderRadius: 1 }}
                />

                <TextField
                  size="small"
                  label="Buscar modulo o permiso"
                  value={permissionSearch}
                  onChange={(e) => setPermissionSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchOutlined fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />

                <Stack spacing={1.5} sx={{ maxHeight: "52vh", overflow: "auto", pr: 0.5 }}>
                  {permissionGroups.map((group) => {
                    const groupKeys = group.permissions.map((permission) => permission.key);
                    const checkedCount = groupKeys.filter((key) => selectedPermissionSet.has(key)).length;
                    const allChecked = checkedCount === groupKeys.length && groupKeys.length > 0;
                    const partialChecked = checkedCount > 0 && !allChecked;

                    return (
                      <Paper key={group.category} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                              <Checkbox
                                size="small"
                                checked={allChecked}
                                indeterminate={partialChecked}
                                onChange={(e) => setGroupPermissions(group.permissions, e.target.checked)}
                              />
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle2" noWrap>
                                  {group.category}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {checkedCount} de {group.permissions.length} permisos activos
                                </Typography>
                              </Box>
                            </Stack>
                            <Tooltip title="Seleccionar todos los permisos de este modulo">
                              <Button
                                size="small"
                                variant="text"
                                startIcon={<SelectAllOutlined />}
                                onClick={() => setGroupPermissions(group.permissions, true)}
                              >
                                Todo
                              </Button>
                            </Tooltip>
                          </Stack>
                          <Divider />
                          <Grid container spacing={1}>
                            {group.permissions.map((permission) => {
                              const checked = selectedPermissionSet.has(permission.key);
                              return (
                                <Grid key={permission.key} size={{ xs: 12, md: 6 }}>
                                  <Paper
                                    variant="outlined"
                                    sx={{
                                      p: 1,
                                      height: "100%",
                                      borderColor: checked ? "primary.main" : "divider",
                                      bgcolor: checked ? "action.selected" : "background.paper",
                                    }}
                                  >
                                    <Stack direction="row" spacing={1} alignItems="flex-start">
                                      <Checkbox
                                        size="small"
                                        checked={checked}
                                        onChange={(e) => togglePermission(permission.key, e.target.checked)}
                                      />
                                      <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }} flexWrap="wrap" useFlexGap>
                                          <Chip
                                            size="small"
                                            icon={getActionIcon(permission.key)}
                                            label={getActionLabel(permission.key)}
                                            color={
                                              getPermissionAction(permission.key) === "view"
                                                ? "info"
                                                : getPermissionAction(permission.key) === "manage"
                                                  ? "warning"
                                                  : "success"
                                            }
                                            variant={checked ? "filled" : "outlined"}
                                          />
                                          <Typography variant="body2" fontWeight={700}>
                                            {permission.label}
                                          </Typography>
                                        </Stack>
                                        <Typography variant="caption" color="text.secondary" display="block">
                                          {permission.description}
                                        </Typography>
                                        <Typography variant="caption" color="text.disabled" display="block">
                                          {permission.key}
                                        </Typography>
                                      </Box>
                                    </Stack>
                                  </Paper>
                                </Grid>
                              );
                            })}
                          </Grid>
                        </Stack>
                      </Paper>
                    );
                  })}
                  {!permissionGroups.length && (
                    <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
                      <Typography variant="body2" color="text.secondary">
                        No hay permisos que coincidan con la busqueda.
                      </Typography>
                    </Paper>
                  )}
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenForm(false)}>Cancelar</Button>
          <Button variant="contained" onClick={guardar} disabled={!canManage}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
