import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardPage from './pages/DashboardPage'
import CompaniesPage from './pages/CompaniesPage'
import SitesPage from './pages/SitesPage'
import HousesPage from './pages/HousesPage'
import GeneticsPage from './pages/GeneticsPage'
import IncidentsPage from './pages/IncidentsPage'
import FindingsPage from './pages/FindingsPage'
import TreatmentsPage from './pages/TreatmentsPage'
import InventoryPage from './pages/InventoryPage'
import MirfeDashboardPage from './pages/MirfeDashboardPage'
import MirfeMonitoringPage from './pages/MirfeMonitoringPage'
import MirfeProgramsPage from './pages/MirfeProgramsPage'
import MirfeReinforcementsPage from './pages/MirfeReinforcementsPage'
import MirfeHistoryPage from './pages/MirfeHistoryPage'
import SettingsPage from './pages/SettingsPage'
import OperationsCenterPage from './pages/OperationsCenterPage'
import FormulationPage from './pages/FormulationPage'
import PreparationsPage from './pages/PreparationsPage'
import WorkOrdersPage from './pages/WorkOrdersPage'
import CostsPage from './pages/CostsPage'
import UsersPage from './pages/UsersPage'
import LoginPage from './pages/LoginPage'
import PlantProfilePage from './pages/PlantProfilePage'
import InventoryMovementsPage from './pages/InventoryMovementsPage'
import IrrigationWorkflowPage from './pages/IrrigationWorkflowPage'
import AuditLogPage from './pages/AuditLogPage'
import InsightsPage from './pages/InsightsPage'
import SystemDiagnosticsPage from './pages/SystemDiagnosticsPage'
import MotherPlantsPage from './pages/MotherPlantsPage'
import PropagationPage from './pages/PropagationPage'
import PhaseTransitionsPage from './pages/PhaseTransitionsPage'
import LineagePage from './pages/LineagePage'
import GrandmotherPlantsPage from './pages/GrandmotherPlantsPage'
import LotDetailPage from './pages/LotDetailPage'
import PhaseTargetsPage from './pages/PhaseTargetsPage'
import CultivationMapPage from './pages/CultivationMapPage'
import MipeDashboardPage from './pages/MipeDashboardPage'
import WaterAnalysisPage from './pages/WaterAnalysisPage'
import NutrientProductsPage from './pages/NutrientProductsPage'
import NutrientObjectivesPage from './pages/NutrientObjectivesPage'
import IrrigationPlanPage from './pages/IrrigationPlanPage'
import FinishedGoodsPage from './pages/FinishedGoodsPage'
import SalesPage from './pages/SalesPage'
import CurrenciesPage from './pages/CurrenciesPage'
import InfrastructurePage from './pages/InfrastructurePage'
import InfrastructureMapPage from './pages/InfrastructureMapPage'
import InfrastructureOperationsPage from './pages/InfrastructureOperationsPage'
import SyncCenterPage from './pages/SyncCenterPage'

function Guard({ permission, children }) {
  return <ProtectedRoute permission={permission}>{children}</ProtectedRoute>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/operations" element={<OperationsCenterPage />} />
        <Route path="/cultivation-map" element={<CultivationMapPage />} />
        <Route path="/infrastructure-map" element={<InfrastructureMapPage />} />
        <Route path="/infrastructure/operations" element={<Guard permission="manage_settings"><InfrastructureOperationsPage /></Guard>} />
        <Route path="/operational-map" element={<Navigate to="/cultivation-map" replace />} />
        <Route path="/site-map" element={<Navigate to="/cultivation-map" replace />} />
        <Route path="/house-map" element={<Navigate to="/cultivation-map" replace />} />
        <Route path="/plant/:plantId" element={<PlantProfilePage />} />

        <Route path="/companies" element={<Guard permission="manage_settings"><CompaniesPage /></Guard>} />
        <Route path="/sites" element={<Guard permission="manage_settings"><SitesPage /></Guard>} />
        <Route path="/houses" element={<Guard permission="manage_settings"><HousesPage /></Guard>} />
        <Route path="/infrastructure" element={<Guard permission="manage_settings"><InfrastructurePage /></Guard>} />

        <Route path="/propagation/grandmothers" element={<GrandmotherPlantsPage />} />
        <Route path="/propagation/mothers" element={<MotherPlantsPage />} />
        <Route path="/lots" element={<Navigate to="/propagation/batches" replace />} />
        <Route path="/lots/:lotId" element={<LotDetailPage />} />
        <Route path="/phase-targets" element={<PhaseTargetsPage />} />
        <Route path="/propagation/batches" element={<PropagationPage />} />
        <Route path="/propagation/transitions" element={<PhaseTransitionsPage />} />
        <Route path="/propagation/lineage" element={<LineagePage />} />
        <Route path="/genetics" element={<GeneticsPage />} />

        <Route path="/mirfe/dashboard" element={<Guard permission="view_dashboards"><MirfeDashboardPage /></Guard>} />
        <Route path="/mirfe/monitoring" element={<Guard permission="manage_mirfe"><MirfeMonitoringPage /></Guard>} />
        <Route path="/mirfe/programs" element={<Guard permission="manage_mirfe"><MirfeProgramsPage /></Guard>} />
        <Route path="/mirfe/reinforcements" element={<Guard permission="manage_mirfe"><MirfeReinforcementsPage /></Guard>} />
        <Route path="/mirfe/history" element={<Guard permission="manage_mirfe"><MirfeHistoryPage /></Guard>} />

        <Route path="/mipe/dashboard" element={<Guard permission="view_dashboards"><MipeDashboardPage /></Guard>} />
        <Route path="/mipe/incidents" element={<Guard permission="manage_mipe"><IncidentsPage /></Guard>} />
        <Route path="/mipe/findings" element={<Guard permission="manage_mipe"><FindingsPage /></Guard>} />
        <Route path="/mipe/treatments" element={<Guard permission="manage_mipe"><TreatmentsPage /></Guard>} />

        <Route path="/irrigation/water" element={<Guard permission="manage_irrigation"><WaterAnalysisPage /></Guard>} />
        <Route path="/irrigation/products" element={<Guard permission="manage_irrigation"><NutrientProductsPage /></Guard>} />
        <Route path="/irrigation/objectives" element={<Guard permission="manage_irrigation"><NutrientObjectivesPage /></Guard>} />
        <Route path="/irrigation/plan" element={<Guard permission="manage_irrigation"><IrrigationPlanPage /></Guard>} />
        <Route path="/irrigation/formulation" element={<Guard permission="manage_irrigation"><FormulationPage /></Guard>} />
        <Route path="/irrigation/preparations" element={<Guard permission="manage_irrigation"><PreparationsPage /></Guard>} />
        <Route path="/irrigation/orders" element={<Guard permission="execute_orders"><WorkOrdersPage /></Guard>} />
        <Route path="/irrigation/workflow" element={<Guard permission="record_irrigation"><IrrigationWorkflowPage /></Guard>} />

        <Route path="/production/harvest" element={<Navigate to="/propagation/batches" replace />} />
        <Route path="/production/drying" element={<Navigate to="/propagation/batches" replace />} />
        <Route path="/production/trimming" element={<Navigate to="/propagation/batches" replace />} />
        <Route path="/production/selection" element={<Navigate to="/propagation/batches" replace />} />
        <Route path="/production/packing" element={<Navigate to="/propagation/batches" replace />} />
        <Route path="/production/flow" element={<Navigate to="/propagation/batches" replace />} />
        <Route path="/finished-goods" element={<Guard permission="view_production"><FinishedGoodsPage /></Guard>} />
        <Route path="/sales" element={<Guard permission="manage_inventory"><SalesPage /></Guard>} />
        <Route path="/currencies" element={<Guard permission="manage_settings"><CurrenciesPage /></Guard>} />
        <Route path="/costs" element={<Guard permission="view_costs"><CostsPage /></Guard>} />
        <Route path="/inventory/movements" element={<Guard permission="view_inventory"><InventoryMovementsPage /></Guard>} />
        <Route path="/inventory" element={<Guard permission="view_inventory"><InventoryPage /></Guard>} />

        <Route path="/sync" element={<Guard permission="manage_settings"><SyncCenterPage /></Guard>} />
        <Route path="/audit" element={<Guard permission="view_audit"><AuditLogPage /></Guard>} />
        <Route path="/insights" element={<Guard permission="view_dashboards"><InsightsPage /></Guard>} />
        <Route path="/diagnostics" element={<Guard permission="manage_settings"><SystemDiagnosticsPage /></Guard>} />
        <Route path="/users" element={<Guard permission="manage_users"><UsersPage /></Guard>} />
        <Route path="/settings" element={<Guard permission="manage_settings"><SettingsPage /></Guard>} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
