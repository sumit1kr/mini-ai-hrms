import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';

const navConfig = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: '🏠' },
    { to: '/admin/employees', label: 'Employees', icon: '👥' },
    { to: '/admin/tasks', label: 'Tasks', icon: '📋' },
    { to: '/admin/requests', label: 'Requests', icon: '⏳' },
    { to: '/admin/ai-insights', label: 'AI Insights', icon: '🤖' },
  ],
  employee: [
    { to: '/employee', label: 'Dashboard', icon: '🏠' },
    { to: '/employee/tasks', label: 'My Tasks', icon: '✅' },
  ],
};

const Sidebar = () => {
  const { user } = useAuth();
  const { sidebarCollapsed } = useUI();
  const location = useLocation();

  if (!user) return null;

  const links = user.role === 'admin' ? navConfig.admin : navConfig.employee;

  return (
    <aside className={`sidebar-glass ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
      <div className="space-y-2">
        {links.map((link) => {
          const active = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`sidebar-link ${active ? 'active' : ''}`}
              title={sidebarCollapsed ? link.label : undefined}
            >
              <span className="sidebar-link-icon">{link.icon}</span>
              {!sidebarCollapsed && <span className="sidebar-link-text">{link.label}</span>}
            </Link>
          );
        })}
      </div>
    </aside>
  );
};

export default Sidebar;
