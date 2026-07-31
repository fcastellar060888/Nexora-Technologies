import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import DashboardPage from './pages/DashboardPage'
import CompaniesPage from './pages/CompaniesPage'
import SitesPage from './pages/SitesPage'
import SiteMapPage from './pages/SiteMapPage'
import HousesPage from './pages/HousesPage'
import HouseMapPage from './pages/HouseMapPage'
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
import ProductionPage from './pages/ProductionPage'
import DryingPage from './pages/DryingPage'
import TrimmingPage from './pages/TrimmingPage'
import SelectionPage from './pages/SelectionPage'
import PackingPage from './pages/PackingPage'
import CostsPage from './pages/CostsPage'
import UsersPage from './pages/UsersPage'
import LoginPage from './pages/LoginPage'
import OperationalMapPage from './pages/OperationalMapPage'
import PlantProfilePage from './pages/PlantProfilePage'
import InventoryMovementsPage from './pages/InventoryMovementsPage'
import ProductionFlowPage from './pages/ProductionFlowPage'
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

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/operations" element={<OperationsCenterPage />} />
        <Route path="/cultivation-map" element={<CultivationMapPage />} />
        <Route path="/infrastructure-map" element={<InfrastructureMapPage />} />
        <Route path="/operational-map" element={<Navigate to="/cultivation-map" replace />} />
        <Route path="/site-map" element={<Navigate to="/cultivation-map" replace />} />
        <Route path="/house-map" element={<Navigate to="/cultivation-map" replace />} />
        <Route path="/plant/:plantId" element={<PlantProfilePage />} />

        <Route path="/companies" element={<CompaniesPage />} />
        <Route path="/sites" element={<SitesPage />} />
        
        <Route path="/houses" element={<HousesPage />} />
        <Route path="/infrastructure" element={<InfrastructurePage />} />
        <Route path="/propagation/grandmothers" element={<GrandmotherPlantsPage />} />
        <Route path="/propagation/mothers" element={<MotherPlantsPage />} />
        <Route path="/lots" element={<Navigate to="/propagation/batches" replace />} />
        <Route path="/lots/:lotId" element={<LotDetailPage />} />
        <Route path="/phase-targets" element={<PhaseTargetsPage />} />
        <Route path="/propagation/batches" element={<PropagationPage />} />
        <Route path="/propagation/transitions" element={<PhaseTransitionsPage />} />
        <Route path="/propagation/lineage" element={<LineagePage />} />
        <Route path="/genetics" element={<GeneticsPage />} />
        

        <Route path="/mirfe/dashboard" element={<MirfeDashboardPage />} />
        <Route path="/mirfe/monitoring" element={<MirfeMonitoringPage />} />
        <Route path="/mirfe/programs" element={<MirfeProgramsPage />} />
        <Route path="/mirfe/reinforcements" element={<MirfeReinforcementsPage />} />
        <Route path="/mirfe/history" element={<MirfeHistoryPage />} />

        <Route path="/mipe/dashboard" element={<MipeDashboardPage />} />
        <Route path="/mipe/incidents" element={<IncidentsPage />} />
        <Route path="/mipe/findings" element={<FindingsPage />} />
        <Route path="/mipe/treatments" element={<TreatmentsPage />} />

        <Route path="/irrigation/water" element={<WaterAnalysisPage />} />
        <Route path="/irrigation/products" element={<NutrientProductsPage />} />
        <Route path="/irrigation/objectives" element={<NutrientObjectivesPage />} />
        <Route path="/irrigation/plan" element={<IrrigationPlanPage />} />
        <Route path="/irrigation/formulation" element={<FormulationPage />} />
        <Route path="/irrigation/preparations" element={<PreparationsPage />} />
        <Route path="/irrigation/orders" element={<WorkOrdersPage />} />
        <Route path="/irrigation/workflow" element={<IrrigationWorkflowPage />} />
        <Route path="/production/harvest" element={<Navigate to="/propagation/batches" replace />} />
        <Route path="/production/drying" element={<Navigate to="/propagation/batches" replace />} />
        <Route path="/production/trimming" element={<Navigate to="/propagation/batches" replace />} />
        <Route path="/production/selection" element={<Navigate to="/propagation/batches" replace />} />
        <Route path="/production/packing" element={<Navigate to="/propagation/batches" replace />} />
        <Route path="/production/flow" element={<Navigate to="/propagation/batches" replace />} />
        <Route path="/finished-goods" element={<FinishedGoodsPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/currencies" element={<CurrenciesPage />} />
        <Route path="/costs" element={<CostsPage />} />
        <Route path="/inventory/movements" element={<InventoryMovementsPage />} />
        <Route path="/audit" element={<AuditLogPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/diagnostics" element={<SystemDiagnosticsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
