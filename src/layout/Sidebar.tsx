// src/layout/Sidebar.tsx
import {
  Box,
  Drawer,
  ListSubheader,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import { useEffect, useMemo, useState } from "react";
import { menuSections, MenuItem } from "./menuItems";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import { isModuleAccessible } from "../config/moduleAccess";
import { useAuthStore } from "../auth/useAuthStore";
import { canAccessPath, getRequiredPermission, hasPermission } from "../auth/permissions";

interface Props {
  open: boolean;
  width: number;
  onToggle: () => void;
}

export default function Sidebar({ open, width, onToggle }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const collapsed = !open;
  const { disabledPaths, userDisabledPaths, fetchConfig } = useSystemConfigStore();
  const { usuario, rol, permisos } = useAuthStore();
  const usuarioKey = (usuario || "").trim().toUpperCase();
  const effectiveDisabledPaths = useMemo(
    () => [...disabledPaths, ...(userDisabledPaths[usuarioKey] || [])],
    [disabledPaths, userDisabledPaths, usuarioKey]
  );

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const toggle = (label: string) => {
    setOpenMap((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = useMemo(
    () => (path?: string) => (path ? location.pathname.startsWith(path) : false),
    [location.pathname]
  );

  const renderItem = (item: MenuItem) => {
    const visibleChildren =
      item.children?.filter(
        (child) =>
          (!child.path || isModuleAccessible(child.path, effectiveDisabledPaths)) &&
          canAccessPath(rol, permisos, child.path)
      ) || [];
    const hasChildren = visibleChildren.length > 0;
    if (!hasChildren && !item.path) return null;
    if (item.path && (!isModuleAccessible(item.path, effectiveDisabledPaths) || !canAccessPath(rol, permisos, item.path))) {
      return null;
    }
    const open = openMap[item.label] ?? isActive(item.path);
    const disabledByConfig = item.path ? !isModuleAccessible(item.path, effectiveDisabledPaths) : false;
    const disabledByPermission = item.path ? !hasPermission(rol, permisos, getRequiredPermission(item.path)) : false;
    const disabled = disabledByConfig || disabledByPermission;

    return (
      <Box key={item.label}>
        <ListItemButton
          disabled={disabled}
          onClick={() => (hasChildren ? toggle(item.label) : item.path && navigate(item.path))}
          sx={{
            borderRadius: 2,
            mx: 1,
            my: 0.25,
            backgroundColor: isActive(item.path) ? "#eef2ff" : "transparent",
            justifyContent: collapsed ? "center" : "flex-start",
            px: collapsed ? 1 : 2,
            opacity: disabled ? 0.55 : 1,
          }}
        >
          <ListItemIcon sx={{ color: "#6f7884", minWidth: collapsed ? 32 : 40 }}>
            {item.icon}
          </ListItemIcon>
          <ListItemText
            primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }}
            primary={item.label}
            sx={{ display: collapsed ? "none" : "block" }}
          />
          {hasChildren ? open ? <ExpandLess /> : <ExpandMore /> : null}
        </ListItemButton>

        {hasChildren && (
          <Collapse in={open} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {visibleChildren.map((child) => {
                const childDisabledByConfig = child.path ? !isModuleAccessible(child.path, effectiveDisabledPaths) : false;
                const childDisabledByPermission = child.path
                  ? !hasPermission(rol, permisos, getRequiredPermission(child.path))
                  : false;
                const childDisabled = childDisabledByConfig || childDisabledByPermission;
                return (
                <ListItemButton
                  key={child.label}
                  disabled={childDisabled}
                  onClick={() => child.path && navigate(child.path)}
                  sx={{
                    pl: collapsed ? 2 : 6,
                    borderRadius: 2,
                    mx: 1,
                    my: 0.25,
                    backgroundColor: isActive(child.path) ? "#eef2ff" : "transparent",
                    justifyContent: collapsed ? "center" : "flex-start",
                    opacity: childDisabled ? 0.55 : 1,
                  }}
                  >
                    <ListItemIcon sx={{ color: "#6f7884", minWidth: collapsed ? 32 : 36 }}>
                      {child.icon}
                  </ListItemIcon>
                  <ListItemText
                    primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
                    primary={child.label}
                    sx={{ display: collapsed ? "none" : "block" }}
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
          mt: 8,
          borderRight: "1px solid #e6e9ef",
          paddingTop: 2,
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 64px)",
          overflowY: "auto",
        },
      }}
    >
      <List disablePadding sx={{ flex: 1 }}>
        {menuSections.map((section) => (
          <Box key={section.title ?? "root"}>
            {section.title && !collapsed && (
              <ListSubheader
                component="div"
                sx={{ fontSize: 12, fontWeight: 700, color: "#98a0ad", lineHeight: "28px" }}
              >
                {section.title}
              </ListSubheader>
            )}

            {section.items.map(renderItem)}
          </Box>
        ))}
      </List>
    </Drawer>
  );
}
