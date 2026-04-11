import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const navLink = (path, label, icon) => {
    const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
    return (
      <Link to={path} aria-label={label} title={label}
        className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          active
            ? 'bg-[#8b6914]/15 text-[#d4a537] shadow-sm shadow-[#d4a537]/10'
            : 'text-[#e8dfd4]/70 hover:text-white hover:bg-[#e8dfd4]/5'
        }`}>
        {icon}
        <span className="hidden md:inline">{label}</span>
      </Link>
    );
  };

  return (
    <nav className="bg-[#4a1c1c] backdrop-blur-xl border-b border-[#d4a537]/15 sticky top-0 z-30 print:hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 flex items-center justify-between h-14 gap-2">
        <div className="flex items-center gap-2 sm:gap-5 min-w-0">
          <Link to="/" className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 group">
            <div className="w-8 h-8 bg-gradient-to-br from-[#7b2d2d] to-[#d4a537] rounded-lg flex items-center justify-center shadow-lg shadow-[#d4a537]/20 group-hover:shadow-[#d4a537]/40 transition-shadow">
              <span className="text-white font-black text-sm">MM</span>
            </div>
            <span className="hidden sm:inline font-bold text-white text-sm tracking-tight">MM <span className="text-[#d4a537]">Jewels</span></span>
          </Link>

          <div className="flex items-center gap-0.5 sm:ml-2">
            {navLink('/', 'Dashboard',
              <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            )}
            {navLink('/new-bill', 'New Order',
              <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4"/></svg>
            )}
            {navLink('/bills', 'Orders',
              <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            )}
            {navLink('/customers', 'Customers',
              <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            )}
            {user?.role === 'admin' && navLink('/data-load', 'Data Load',
              <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 8l-4-4m0 0L8 8m4-4v12"/></svg>
            )}
            {navLink('/settings', 'Settings',
              <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-semibold text-[#e8dfd4] leading-tight">{user?.name}</p>
            <p className="text-xs text-[#e8dfd4]/50 capitalize leading-tight">{user?.role}</p>
          </div>
          <button onClick={handleLogout}
            className="text-xs text-[#e8dfd4]/70 hover:text-[#e8dfd4] border border-[#e8dfd4]/20 hover:border-[#e8dfd4]/40 hover:bg-[#e8dfd4]/5 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all">
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
