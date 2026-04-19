// src/layout/Layout.tsx
import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import { useState, useMemo } from "react";
import { IconButton, Tooltip } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const drawerWidth = useMemo(() => (sidebarOpen ? 240 : 72), [sidebarOpen]);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", backgroundColor: "#f7f9fc" }}>
      <Navbar />

      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen((o) => !o)} width={drawerWidth} />

      <Tooltip title={sidebarOpen ? "Contraer menú" : "Expandir menú"} placement="right">
        <IconButton
          onClick={() => setSidebarOpen((o) => !o)}
          size="small"
          sx={{
            position: "fixed",
            top: 88,
            left: drawerWidth,
            zIndex: 1300,
            width: 26,
            height: 48,
            borderRadius: "0 6px 6px 0",
            backgroundColor: "#f1f2f6",
            boxShadow: "none",
            border: "1px solid #d8dbe2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            "&:hover": { backgroundColor: "#e5e7ed" },
          }}
        >
          {sidebarOpen ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </IconButton>
      </Tooltip>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 8,
          ml: { xs: 0, sm: 2 },
          backgroundColor: "#f7f9fc",
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
