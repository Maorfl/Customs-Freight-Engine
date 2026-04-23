import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useNotifications } from '../context/NotificationContext';

export default function Navbar() {
  const location = useLocation();
  const { unviewedPrepCount, hasDashboardUpdate, clearPrepCount } = useNotifications();

  // Clear the preparation badge whenever the user visits the preparation page
  useEffect(() => {
    if (location.pathname === '/preparation') {
      clearPrepCount();
    }
  }, [location.pathname, clearPrepCount]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-semibold px-1 pb-1 transition-colors hover:text-white ${
      isActive
        ? 'text-white border-b-2 border-white'
        : 'text-blue-200'
    }`;

  return (
    <nav className="bg-blue-800 shadow-lg">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <span className="text-2xl select-none">🚢</span>
            <div>
              <p className="text-white font-bold text-base leading-tight">
                מנוע הצעות מחיר להובלות
              </p>
              <p className="text-blue-300 text-xs leading-tight">כספי סוכני מכס ושילוח בין לאומי</p>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-8">

            {/* לוח בקרה — red dot when there's an unread carrier reply */}
            <div className="relative">
              <NavLink to="/" end className={linkClass}>
                לוח בקרה
              </NavLink>
              <AnimatePresence>
                {hasDashboardUpdate && (
                  <motion.span
                    key="dashboard-dot"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="absolute -top-1.5 -right-2 h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm"
                  />
                )}
              </AnimatePresence>
            </div>

            <div className='relative'>
              <NavLink to="/new-shipment" className={linkClass}>
                משלוח חדש
              </NavLink>
            </div>

            {/* הכנה למשלוח — count badge with ping when new items arrive */}
            <div className="relative">
              <NavLink to="/preparation" className={linkClass}>
                הכנה למשלוח
              </NavLink>
              <AnimatePresence>
                {unviewedPrepCount > 0 && (
                  <motion.span
                    key="prep-badge"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="absolute -top-2.5 -right-4 flex items-center justify-center"
                  >
                    {/* Ping ring — re-keyed on count so it restarts on each new item */}
                    <span
                      key={unviewedPrepCount}
                      className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"
                    />
                    {/* Solid badge */}
                    <span className="relative inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold h-[18px] min-w-[18px] px-1 leading-none">
                      {unviewedPrepCount > 99 ? '99+' : unviewedPrepCount}
                    </span>
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <div className='relative'>
              <NavLink to="/carriers" className={linkClass}>
                ניהול מובילים
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
