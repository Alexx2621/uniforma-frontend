// src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import Layout from "./layout/Layout";
import Ventas from "./pages/Ventas";
import Productos from "./pages/Productos";
import ProductoNuevo from "./pages/ProductoNuevo";
import Categorias from "./pages/Categorias";
import Telas from "./pages/Telas";
import Colores from "./pages/Colores";
import Tallas from "./pages/Tallas";
import IngresoInventario from "./pages/IngresoInventario";
import InventarioPanel from "./pages/InventarioPanel";
import InventarioResumen from "./pages/InventarioResumen";
import InventarioTelas from "./pages/InventarioTelas";
import ConteosFisicos from "./pages/ConteosFisicos";
import KardexInventario from "./pages/KardexInventario";
import Traslados from "./pages/Traslados";
import VentaNueva from "./pages/VentaNueva";
import Bodegas from "./pages/Bodegas";
import Clientes from "./pages/Clientes";
import ClienteFicha from "./pages/ClienteFicha";
import Proveedores from "./pages/Proveedores";
import Cotizaciones from "./pages/Cotizaciones";
import Usuarios from "./pages/Usuarios";
import Admin from "./pages/Admin";
import Auditoria from "./pages/Auditoria";
import Correcciones from "./pages/Correcciones";
import Correlativos from "./pages/Correlativos";
import WhatsappConfig from "./pages/WhatsappConfig";
import Roles from "./pages/Roles";
import Pedidos from "./pages/Pedidos";
import PedidoNuevo from "./pages/PedidoNuevo";
import PedidoDetalle from "./pages/PedidoDetalle";
import Bordados from "./pages/Bordados";
import Envios from "./pages/Envios";
import EnvioNuevo from "./pages/EnvioNuevo";
import TrackingPedidos from "./pages/TrackingPedidos";
import PagosPedidos from "./pages/PagosPedidos";
import PagosRecibidos from "./pages/PagosRecibidos";
import { Cambios, Devoluciones } from "./pages/PostVenta";
import VentasDiarias from "./pages/reportes/VentasDiarias";
import ReporteDiario from "./pages/reportes/ReporteDiario";
import ReporteQuincenal from "./pages/reportes/ReporteQuincenal";
import VentasProducto from "./pages/reportes/VentasProducto";
import TopClientes from "./pages/reportes/TopClientes";
import IngresosInventarioReporte from "./pages/reportes/IngresosInventarioReporte";
import TrasladosReporte from "./pages/reportes/TrasladosReporte";
import StockBajo from "./pages/reportes/StockBajo";
import ProduccionUnificados from "./pages/reportes/ProduccionUnificados";
import ComparativoTiendas from "./pages/reportes/ComparativoTiendas";
import MetasMensuales from "./pages/MetasMensuales";
import NotFound from "./pages/NotFound";
import { useTextInputStandards } from "./utils/useTextInputStandards";
import { whatsappFeatureEnabled } from "./config/features";

export default function App() {
  useTextInputStandards();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/ventas/nueva" element={<VentaNueva />} />
          <Route path="/cambios" element={<Cambios />} />
          <Route path="/devoluciones" element={<Devoluciones />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/productos/nuevo" element={<ProductoNuevo />} />
          <Route path="/inventario" element={<IngresoInventario />} />
          <Route path="/inventario/panel" element={<InventarioPanel />} />
          <Route path="/inventario/resumen" element={<InventarioResumen />} />
          <Route path="/inventario/telas" element={<InventarioTelas />} />
          <Route path="/inventario/conteos" element={<ConteosFisicos />} />
          <Route path="/inventario/kardex" element={<KardexInventario />} />
          <Route path="/inventario/traslados" element={<Traslados />} />
          <Route path="/bodegas" element={<Bodegas />} />
          <Route path="/cotizaciones" element={<Cotizaciones />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/clientes/:id/ficha" element={<ClienteFicha />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/roles" element={<Roles />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/auditoria" element={<Auditoria />} />
          <Route path="/correcciones" element={<Correcciones />} />
          <Route path="/metas-mensuales" element={<MetasMensuales />} />
          {whatsappFeatureEnabled && <Route path="/whatsapp/config" element={<WhatsappConfig />} />}
          <Route path="/correlativos" element={<Correlativos />} />
          <Route path="/produccion/correlativos" element={<Correlativos />} />
          <Route path="/produccion" element={<Pedidos />} />
          <Route path="/produccion/nuevo" element={<PedidoNuevo />} />
          <Route path="/produccion/:id" element={<PedidoDetalle />} />
          <Route path="/bordados" element={<Bordados />} />
          <Route path="/envios" element={<Envios />} />
          <Route path="/envios/nuevo" element={<EnvioNuevo />} />
          <Route path="/tracking-pedidos" element={<TrackingPedidos />} />
          <Route path="/pagos/pedidos" element={<PagosPedidos />} />
          <Route path="/pagos/recibidos" element={<PagosRecibidos />} />
          <Route path="/reportes/reporte-diario" element={<ReporteDiario />} />
          <Route path="/reportes/reporte-quincenal" element={<ReporteQuincenal />} />
          <Route path="/reportes/ventas-diarias" element={<VentasDiarias />} />
          <Route path="/reportes/ventas-producto" element={<VentasProducto />} />
          <Route path="/reportes/top-clientes" element={<TopClientes />} />
          <Route path="/reportes/ingresos" element={<IngresosInventarioReporte />} />
          <Route path="/reportes/traslados" element={<TrasladosReporte />} />
          <Route path="/reportes/stock-bajo" element={<StockBajo />} />
          <Route path="/reportes/produccion-unificados" element={<ProduccionUnificados />} />
          <Route path="/reportes/comparativo-tiendas" element={<ComparativoTiendas />} />
          <Route path="/catalogos/categorias" element={<Categorias />} />
          <Route path="/catalogos/telas" element={<Telas />} />
          <Route path="/catalogos/colores" element={<Colores />} />
          <Route path="/catalogos/tallas" element={<Tallas />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
