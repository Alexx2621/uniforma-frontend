// src/layout/Layout.tsx
import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import { useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const drawerWidth = sidebarOpen ? 240 : 72;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", backgroundColor: "background.default" }}>
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
            backgroundColor: "background.paper",
            boxShadow: "none",
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

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 8,
          ml: { xs: 0, sm: 2 },
          backgroundColor: "background.default",
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
