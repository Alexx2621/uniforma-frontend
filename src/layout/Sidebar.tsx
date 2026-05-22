// src/layout/Sidebar.tsx
import {
  Box,
  Drawer,
  InputAdornment,
  ListSubheader,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  TextField,
  Tooltip,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import { useEffect, useMemo, useState } from "react";
import { menuSections, MenuItem } from "./menuItems";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import { useAuthStore } from "../auth/useAuthStore";
import { canAccessPath, getRequiredPermission, hasPermission } from "../auth/permissions";

interface Props {
  open: boolean;
  width: number;
  onToggle: () => void;
}

const normalizeSearchText = (value?: string) =>
  `${value || ""}`
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const searchTokens = (value: string) => {
  const normalized = normalizeSearchText(value);
  if (!normalized) return [];
  const tokens = [normalized];
  if (normalized.endsWith("s") && normalized.length > 3) tokens.push(normalized.slice(0, -1));
  return tokens;
};

const matchesSearch = (tokens: string[], ...values: Array<string | undefined>) => {
  if (!tokens.length) return true;
  const haystack = values.map(normalizeSearchText).filter(Boolean).join(" ");
  return tokens.some((token) => haystack.includes(token));
};

const filterSections = (sections: typeof menuSections, query: string) => {
  const tokens = searchTokens(query);
  if (!tokens.length) return sections;

  return sections
    .map((section) => {
      const sectionMatch = matchesSearch(tokens, section.title);
      const items = sectionMatch
        ? section.items
        : section.items
            .map((item) => {
              const itemMatch = matchesSearch(tokens, item.label, item.path);
              const children =
                item.children?.filter((child) =>
                  matchesSearch(tokens, child.label, child.path, item.label, section.title)
                ) || [];
              if (!itemMatch && !children.length) return null;
              return { ...item, children: item.children ? (itemMatch ? item.children : children) : undefined };
            })
            .filter(Boolean);

      return { ...section, items: items as MenuItem[] };
    })
    .filter((section) => section.items.length > 0);
};

export default function Sidebar({ open, width, onToggle }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const collapsed = !open;
  const { fetchConfig } = useSystemConfigStore();
  const { rol, permisos } = useAuthStore();

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const toggle = (label: string) => {
    setOpenMap((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const goToModule = (path: string) => {
    navigate(path, { state: { sidebarClickAt: Date.now() } });
  };

  const isActive = useMemo(
    () => (path?: string) => {
      if (!path) return false;
      if (path === "/") return pathname === "/";
      return pathname === path || pathname.startsWith(`${path}/`);
    },
    [pathname]
  );

  const normalizedSearch = normalizeSearchText(search);

  const accessibleSections = useMemo(
    () =>
      menuSections
        .map((section) => ({
          ...section,
          items: section.items
            .map((item) => {
              const visibleChildren = item.children?.filter((child) => canAccessPath(rol, permisos, child.path)) || [];
              const itemVisible = item.path ? canAccessPath(rol, permisos, item.path) : visibleChildren.length > 0;
              if (!itemVisible) return null;
              return { ...item, children: item.children ? visibleChildren : undefined };
            })
            .filter(Boolean) as MenuItem[],
        }))
        .filter((section) => section.items.length > 0),
    [permisos, rol]
  );

  const visibleSections = useMemo(
    () => filterSections(accessibleSections, search),
    [accessibleSections, search]
  );

  const renderItem = (item: MenuItem) => {
    const visibleChildren = item.children || [];
    const hasChildren = visibleChildren.length > 0;
    if (!hasChildren && !item.path) return null;
    if (item.path && !canAccessPath(rol, permisos, item.path)) {
      return null;
    }
    const childActive = visibleChildren.some((child) => isActive(child.path));
    const itemActive = isActive(item.path) || childActive;
    const open = normalizedSearch ? true : openMap[item.label] ?? childActive;
    const disabledByPermission = item.path ? !hasPermission(rol, permisos, getRequiredPermission(item.path)) : false;
    const disabled = disabledByPermission;

    const button = (
      <ListItemButton
        disabled={disabled}
        onClick={() => (hasChildren ? toggle(item.label) : item.path && goToModule(item.path))}
        sx={{
          minHeight: 42,
          borderRadius: 1.5,
          mx: 1.25,
          my: 0.35,
          color: itemActive ? "primary.contrastText" : "text.primary",
          bgcolor: itemActive ? "primary.main" : "transparent",
          justifyContent: collapsed ? "center" : "flex-start",
          px: collapsed ? 1 : 1.5,
          opacity: disabled ? 0.55 : 1,
          boxShadow: "none",
          "&:hover": {
            bgcolor: itemActive ? "primary.dark" : "action.hover",
          },
          ".MuiListItemIcon-root": {
            color: itemActive ? "primary.contrastText" : "text.secondary",
          },
          ".MuiSvgIcon-root": {
            color: itemActive ? "primary.contrastText" : undefined,
          },
        }}
      >
        <ListItemIcon
          sx={{
            color: itemActive ? "primary.contrastText" : "text.secondary",
            minWidth: collapsed ? 0 : 36,
            justifyContent: "center",
          }}
        >
          {item.icon}
        </ListItemIcon>
        <ListItemText
          primaryTypographyProps={{ fontSize: 13, fontWeight: itemActive ? 600 : 500 }}
          primary={item.label}
          sx={{ display: collapsed ? "none" : "block", ml: collapsed ? 0 : 0.25 }}
        />
        {hasChildren && !collapsed ? open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" /> : null}
      </ListItemButton>
    );

    return (
      <Box key={item.label}>
        {collapsed ? (
          <Tooltip title={item.label} placement="right">
            <Box>{button}</Box>
          </Tooltip>
        ) : (
          button
        )}

        {hasChildren && (
          <Collapse in={open && !collapsed} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {visibleChildren.map((child) => {
                const childDisabledByPermission = child.path
                  ? !hasPermission(rol, permisos, getRequiredPermission(child.path))
                  : false;
                const childDisabled = childDisabledByPermission;
                const active = isActive(child.path);
                return (
                <ListItemButton
                  key={child.label}
                  disabled={childDisabled}
                  onClick={() => child.path && goToModule(child.path)}
                  sx={{
                    pl: 6,
                    borderRadius: 2,
                    mx: 1,
                    my: 0.25,
                    backgroundColor: active ? "action.selected" : "transparent",
                    justifyContent: "flex-start",
                    opacity: childDisabled ? 0.55 : 1,
                    "&:hover": { backgroundColor: "action.hover" },
                  }}
                  >
                    <ListItemIcon sx={{ color: "text.secondary", minWidth: 36 }}>
                      {child.icon}
                    </ListItemIcon>
                  <ListItemText
                    primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
                    primary={child.label}
                  />
                </ListItemButton>
                );
              })}
            </List>
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        [`& .MuiDrawer-paper`]: {
          width,
          boxSizing: "border-box",
          mt: 8.5,
          ml: 1.25,
          mb: 1.25,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          backgroundColor: "background.paper",
          boxShadow: "none",
          paddingTop: 1.25,
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 78px)",
          overflowY: "auto",
          overflowX: "hidden",
          "&::-webkit-scrollbar": { width: 6 },
          "&::-webkit-scrollbar-thumb": { backgroundColor: "divider", borderRadius: 8 },
        },
      }}
    >
      <Box sx={{ px: collapsed ? 1 : 1.5, pb: collapsed ? 0.5 : 1.25 }}>
        {!collapsed && (
          <TextField
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onInput={(event) => setSearch((event.target as HTMLInputElement).value)}
            onKeyUp={(event) => setSearch((event.target as HTMLInputElement).value)}
            placeholder="Buscar modulo..."
            size="small"
            fullWidth
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 1.5,
                bgcolor: "action.hover",
                fontSize: 13,
              },
              "& fieldset": { borderColor: "transparent" },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        )}
      </Box>

      <List disablePadding sx={{ flex: 1, pb: 1.5 }}>
        {visibleSections.map((section) => (
          <Box key={section.title ?? "root"}>
            {section.title && !collapsed && (
              <ListSubheader
                component="div"
                disableSticky
                sx={{
                  mx: 1.25,
                  mt: 1.25,
                  mb: 0.35,
                  px: 1,
                  borderRadius: 1,
                  bgcolor: "transparent",
                  fontSize: 10.5,
                  letterSpacing: 0,
                  fontWeight: 700,
                  color: "text.secondary",
                  lineHeight: "24px",
                  textTransform: "uppercase",
                }}
              >
                {section.title}
              </ListSubheader>
            )}
            {section.title && collapsed && (
              <Box sx={{ mx: "auto", my: 1.25, width: 28, height: 1, bgcolor: "divider" }} />
            )}

            {section.items.map(renderItem)}
          </Box>
        ))}
      </List>
    </Drawer>
  );
}
