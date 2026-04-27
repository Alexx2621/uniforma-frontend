import { ReactNode } from "react";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import PointOfSaleOutlined from "@mui/icons-material/PointOfSaleOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import PeopleOutline from "@mui/icons-material/PeopleOutline";
import AssessmentOutlined from "@mui/icons-material/AssessmentOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import ShoppingBagOutlined from "@mui/icons-material/ShoppingBagOutlined";
import CategoryOutlined from "@mui/icons-material/CategoryOutlined";
import PaletteOutlined from "@mui/icons-material/PaletteOutlined";
import StraightenOutlined from "@mui/icons-material/StraightenOutlined";
import CheckroomOutlined from "@mui/icons-material/CheckroomOutlined";
import AddBusinessOutlined from "@mui/icons-material/AddBusinessOutlined";
import TableChartOutlined from "@mui/icons-material/TableChartOutlined";
import CompareArrowsOutlined from "@mui/icons-material/CompareArrowsOutlined";
import TimelineOutlined from "@mui/icons-material/TimelineOutlined";
import TrendingUpOutlined from "@mui/icons-material/TrendingUpOutlined";
import PeopleAltOutlined from "@mui/icons-material/PeopleAltOutlined";
import WarningAmberOutlined from "@mui/icons-material/WarningAmberOutlined";
import AdminPanelSettingsOutlined from "@mui/icons-material/AdminPanelSettingsOutlined";
import SummarizeOutlined from "@mui/icons-material/SummarizeOutlined";
import RequestQuoteOutlined from "@mui/icons-material/RequestQuoteOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import PaidOutlined from "@mui/icons-material/PaidOutlined";

export interface MenuItem {
  label: string;
  icon: ReactNode;
  path?: string;
  children?: MenuItem[];
}

export interface MenuSection {
  title?: string;
  items: MenuItem[];
}

export interface MenuPathItem {
  label: string;
  path: string;
  parentLabel?: string;
  sectionTitle?: string;
}

export const menuSections: MenuSection[] = [
  {
    items: [
      { label: "Dashboard", icon: <DashboardOutlined />, path: "/" },
      { label: "Ventas", icon: <PointOfSaleOutlined />, path: "/ventas" },
    ],
  },
  {
    title: "PRODUCTOS",
    items: [
      {
        label: "Productos",
        icon: <ShoppingBagOutlined />,
        children: [{ label: "Listado", path: "/productos", icon: <Inventory2Outlined /> }],
      },
      {
        label: "Catalogos",
        icon: <CategoryOutlined />,
        children: [
          { label: "Categorias", path: "/catalogos/categorias", icon: <CategoryOutlined /> },
          { label: "Telas", path: "/catalogos/telas", icon: <CheckroomOutlined /> },
          { label: "Colores", path: "/catalogos/colores", icon: <PaletteOutlined /> },
          { label: "Tallas", path: "/catalogos/tallas", icon: <StraightenOutlined /> },
        ],
      },
    ],
  },
  {
    title: "INVENTARIO",
    items: [
      { label: "Ingreso", icon: <AddBusinessOutlined />, path: "/inventario" },
      { label: "Bodegas", icon: <Inventory2Outlined />, path: "/bodegas" },
      { label: "Resumen", icon: <TableChartOutlined />, path: "/inventario/resumen" },
      { label: "Traslados", icon: <CompareArrowsOutlined />, path: "/inventario/traslados" },
    ],
  },
  {
    title: "PRODUCCION",
    items: [{ label: "Pedidos", icon: <ShoppingBagOutlined />, path: "/produccion" }],
  },
  {
    title: "PAGOS",
    items: [
      { label: "Pagos pedidos", icon: <ReceiptLongOutlined />, path: "/pagos/pedidos" },
      { label: "Pagos recibidos", icon: <PaidOutlined />, path: "/pagos/recibidos" },
    ],
  },
  {
    title: "GESTION",
    items: [
      { label: "Cotizaciones", icon: <RequestQuoteOutlined />, path: "/cotizaciones" },
      { label: "Clientes", icon: <PeopleOutline />, path: "/clientes" },
      { label: "Usuarios", icon: <SettingsOutlined />, path: "/usuarios" },
      { label: "Roles", icon: <AdminPanelSettingsOutlined />, path: "/roles" },
      { label: "Correlativos", icon: <SettingsOutlined />, path: "/correlativos" },
      { label: "Configuracion", icon: <SettingsOutlined />, path: "/admin" },
    ],
  },
  {
    title: "REPORTES",
    items: [
      {
        label: "Reportes",
        icon: <AssessmentOutlined />,
        children: [
          { label: "Reporte diario", path: "/reportes/reporte-diario", icon: <SummarizeOutlined /> },
          { label: "Reporte quincenal", path: "/reportes/reporte-quincenal", icon: <SummarizeOutlined /> },
          { label: "Ventas diarias", path: "/reportes/ventas-diarias", icon: <TimelineOutlined /> },
          { label: "Ventas por producto", path: "/reportes/ventas-producto", icon: <TrendingUpOutlined /> },
          { label: "Top clientes", path: "/reportes/top-clientes", icon: <PeopleAltOutlined /> },
          { label: "Ingresos de inventario", path: "/reportes/ingresos", icon: <AddBusinessOutlined /> },
          { label: "Traslados", path: "/reportes/traslados", icon: <CompareArrowsOutlined /> },
          { label: "Stock bajo", path: "/reportes/stock-bajo", icon: <WarningAmberOutlined /> },
        ],
      },
    ],
  },
];

export const menuPathItems: MenuPathItem[] = menuSections.flatMap((section) =>
  section.items.flatMap((item) => {
    if (item.children?.length) {
      return item.children
        .filter((child): child is MenuItem & { path: string } => Boolean(child.path))
        .map((child) => ({
          label: child.label,
          path: child.path,
          parentLabel: item.label,
          sectionTitle: section.title,
        }));
    }

    if (!item.path) return [];
    return [
      {
        label: item.label,
        path: item.path,
        sectionTitle: section.title,
      },
    ];
  })
);
