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
  Typography,
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
import uniformaLogo from "../assets/uniforma-logo.png";

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
          minHeight: 38,
          borderRadius: 1.25,
          mx: collapsed ? 0.9 : 1.5,
          my: 0.25,
          color: itemActive ? "primary.contrastText" : "text.primary",
          bgcolor: itemActive ? "primary.main" : "transparent",
          justifyContent: collapsed ? "center" : "flex-start",
          px: collapsed ? 1 : 1.35,
          opacity: disabled ? 0.55 : 1,
          boxShadow: "none",
          transition: "background-color 160ms ease, color 160ms ease",
          "&:hover": {
            bgcolor: itemActive ? "primary.dark" : "rgba(15, 23, 42, 0.045)",
          },
          ".MuiListItemIcon-root": {
            color: itemActive ? "primary.contrastText" : "rgba(15, 23, 42, 0.58)",
          },
          ".MuiSvgIcon-root": {
            color: itemActive ? "primary.contrastText" : undefined,
            fontSize: 19,
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
          primaryTypographyProps={{ fontSize: 14, fontWeight: itemActive ? 700 : 500 }}
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
                    pl: 5.6,
                    borderRadius: 1.25,
                    mx: 1.5,
                    my: 0.25,
                    backgroundColor: active ? "rgba(37, 99, 235, 0.1)" : "transparent",
                    color: active ? "primary.main" : "text.primary",
                    justifyContent: "flex-start",
                    opacity: childDisabled ? 0.55 : 1,
                    minHeight: 34,
                    "&:hover": { backgroundColor: "rgba(15, 23, 42, 0.045)" },
                  }}
                  >
                    <ListItemIcon sx={{ color: active ? "primary.main" : "rgba(15, 23, 42, 0.55)", minWidth: 32 }}>
                      {child.icon}
                    </ListItemIcon>
                  <ListItemText
                    primaryTypographyProps={{ fontSize: 13.25, fontWeight: active ? 700 : 500 }}
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
          top: 0,
          left: 0,
          mt: 0,
          ml: 0,
          mb: 0,
          border: "none",
          borderRight: "1px solid",
          borderRightColor: "divider",
          borderRadius: 0,
          backgroundColor: "background.paper",
          boxShadow: "none",
          paddingTop: 1.25,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          zIndex: (theme) => theme.zIndex.drawer + 2,
          overflowY: "auto",
          overflowX: "hidden",
          "&::-webkit-scrollbar": { width: 6 },
          "&::-webkit-scrollbar-thumb": { backgroundColor: "divider", borderRadius: 8 },
        },
      }}
    >
      <Box sx={{ px: collapsed ? 1 : 2, pb: collapsed ? 0.75 : 1.25 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 1,
            minHeight: 68,
            mb: collapsed ? 0.75 : 1.4,
          }}
        >
          <Box
            component="img"
            src={uniformaLogo}
            alt="Uniforma"
            sx={{
              width: collapsed ? 40 : 166,
              height: collapsed ? 40 : 58,
              objectFit: "contain",
              objectPosition: collapsed ? "center" : "left center",
            }}
          />
        </Box>
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
                bgcolor: "#f5f7fb",
                fontSize: 13.5,
                height: 42,
              },
              "& fieldset": { borderColor: "transparent" },
              "& .MuiOutlinedInput-root:hover fieldset": { borderColor: "transparent" },
              "& .MuiOutlinedInput-root.Mui-focused fieldset": { borderColor: "primary.main" },
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
                  mt: 1.45,
                  mb: 0.45,
                  px: 1.25,
                  borderRadius: 1,
                  bgcolor: "transparent",
                  fontSize: 9.5,
                  letterSpacing: 0,
                  fontWeight: 800,
                  color: "rgba(15, 23, 42, 0.48)",
                  lineHeight: "24px",
                  textTransform: "none",
                }}
              >
                <Typography component="span" variant="caption" sx={{ fontSize: 9.5, fontWeight: 800 }}>
                  {section.title.charAt(0).toUpperCase() + section.title.slice(1).toLowerCase()}
                </Typography>
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
