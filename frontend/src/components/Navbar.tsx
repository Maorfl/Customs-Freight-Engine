import { NavLink } from 'react-router-dom';

export default function Navbar() {
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
            <NavLink to="/" end className={linkClass}>
              לוח בקרה
            </NavLink>
            <NavLink to="/carriers" className={linkClass}>
              ניהול מובילים
            </NavLink>
          </div>
        </div>
      </div>
    </nav>
  );
}
