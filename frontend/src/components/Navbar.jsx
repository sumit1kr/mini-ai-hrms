import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';

const Navbar = () => {
  const { user, isAdmin, logoutUser } = useAuth();
  const { theme, toggleTheme, toggleSidebar, sidebarCollapsed } = useUI();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  return (
    <nav className="navbar-glass sticky top-0 z-50">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to={isAdmin ? '/admin' : '/employee'} className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center brand-badge">
                <span className="text-white font-bold text-sm">HR</span>
              </div>
              <span className="font-bold text-lg hidden sm:block">Mini AI-HRMS</span>
            </Link>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleSidebar}
              className="toggle-chip hidden md:inline-flex"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? '➡️' : '⬅️'}
            </button>

            <button
              onClick={toggleTheme}
              className="toggle-chip"
              title="Toggle theme"
            >
              {theme === 'dark' ? '🌙' : '☀️'}
            </button>

            {user && (
              <>
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/40 border border-white/40">
                    <span className="font-semibold text-sm">
                      {user.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="hidden lg:block">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs opacity-70 capitalize">{user.role}</p>
                  </div>
                </div>

                {/* Org code badge for admin */}
                {isAdmin && user.org_code && (
                  <span className="hidden sm:inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-bold border border-white/50 bg-white/30">
                    {user.org_code}
                  </span>
                )}

                <button
                  onClick={handleLogout}
                  className="text-sm px-3 py-2 rounded-md hover:bg-red-500/10 hover:text-red-500 transition-colors whitespace-nowrap"
                >
                  Logout
                </button>
              </>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-md hover:bg-white/30"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Controls */}
        {menuOpen && (
          <div className="md:hidden py-2 border-t border-white/30">
            <button onClick={toggleSidebar} className="toggle-chip w-full justify-center mb-2">
              {sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            </button>
            <button onClick={toggleTheme} className="toggle-chip w-full justify-center">
              {theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;