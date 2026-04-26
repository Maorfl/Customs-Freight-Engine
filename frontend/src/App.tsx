import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { NotificationProvider } from './context/NotificationContext';
import socket from './services/socket';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import NewShipment from './pages/NewShipment';
import CarrierManagement from './pages/CarrierManagement.tsx';
import PreparationTable from './pages/PreparationTable';

function App() {
  // Global carrier-reply toast — fires regardless of which page is active
  useEffect(() => {
    function onCarrierReply(data: { fileNumber: string; carrierName: string }) {
      toast.success(
        <div className="flex flex-col text-right">
          <span className="font-bold text-gray-900">התקבל מענה חדש!</span>
          <span className="text-sm text-gray-600 mt-1">
            מהמוביל{' '}
            <span className="font-semibold">{data.carrierName}</span>
            {' '}עבור תיק{' '}
            <span className="font-semibold">{data.fileNumber}</span>
          </span>
        </div>,
        { duration: 6000, position: 'top-center', icon: '🔔' }
      );
    }

    socket.on('carrier_reply_received', onCarrierReply);
    return () => {
      socket.off('carrier_reply_received', onCarrierReply);
    };
  }, []);

  return (
    <NotificationProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-100" dir="rtl">
          <Toaster
            position="bottom-left"
            toastOptions={{
              style: { direction: 'rtl', fontFamily: 'inherit' },
              success: { duration: 5000 },
            }}
          />
          <Navbar />
          <main className="container mx-auto px-4 py-8 max-w-8xl">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/new-shipment" element={<NewShipment />} />
              <Route path="/preparation" element={<PreparationTable />} />
              <Route path="/carriers" element={<CarrierManagement />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </NotificationProvider>
  );
}

export default App;
