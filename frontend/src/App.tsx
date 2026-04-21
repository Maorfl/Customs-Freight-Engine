import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import CarrierManagement from './pages/CarrierManagement.tsx';
import PreparationTable from './pages/PreparationTable';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-100" dir="rtl">
        <Navbar />
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/preparation" element={<PreparationTable />} />
            <Route path="/carriers" element={<CarrierManagement />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
