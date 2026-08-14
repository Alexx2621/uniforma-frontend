// src/layout/Layout.tsx
import { useState } from "react";
import { Box, IconButton, Tooltip, useMediaQuery, useTheme } from "@mui/material";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isCompactDesktop = useMediaQuery("(min-width:900px) and (max-width:1535.95px)");
  const expandedDrawerWidth = isCompactDesktop ? 236 : 280;
  const drawerWidth = isMobile ? 0 : sidebarOpen ? expandedDrawerWidth : 68;
  const sidebarWidth = isMobile ? 292 : drawerWidth;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", width: "100%", overflowX: "hidden", backgroundColor: "background.default" }}>
      <Navbar sidebarWidth={drawerWidth} showMenuButton={isMobile} onMenuClick={() => setMobileSidebarOpen(true)} />

      <Sidebar
        open={isMobile ? mobileSidebarOpen : sidebarOpen}
        onToggle={() => (isMobile ? setMobileSidebarOpen((current) => !current) : setSidebarOpen((current) => !current))}
        width={sidebarWidth}
        mobile={isMobile}
      />

      {!isMobile && (
        <Tooltip title={sidebarOpen ? "Contraer menu" : "Expandir menu"} placement="right">
          <IconButton
            onClick={() => setSidebarOpen((current) => !current)}
            size="small"
            sx={{
              position: "fixed",
              top: 84,
              left: drawerWidth - 1,
              zIndex: 1300,
              width: 24,
              height: 36,
              borderRadius: "0 999px 999px 0",
              backgroundColor: "background.paper",
              boxShadow: "0 6px 16px rgba(15, 23, 42, 0.10)",
              border: "1px solid",
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              "&:hover": { backgroundColor: "action.hover" },
            }}
          >
            {sidebarOpen ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      )}

      <Box
        component="main"
        className="uniforma-main-content"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          maxWidth: isMobile ? "100%" : `calc(100vw - ${drawerWidth}px)`,
          width: isMobile ? "100%" : `calc(100% - ${drawerWidth}px)`,
          boxSizing: "border-box",
          overflowX: "hidden",
          p: { xs: 1.25, sm: 1.75, md: 2, xl: 3 },
          mt: { xs: 7, md: 8 },
          backgroundColor: "background.default",
          transition: "width 180ms ease",
        }}
      >
        <Box sx={{ minWidth: 0, maxWidth: "100%", overflowX: "hidden" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
