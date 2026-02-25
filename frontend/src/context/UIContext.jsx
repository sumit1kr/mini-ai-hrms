import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const UIContext = createContext(null);

export const UIProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => localStorage.getItem('hrms_theme') || 'light');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('hrms_sidebar_collapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('hrms_theme', theme);
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('hrms_sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  const value = useMemo(
    () => ({
      theme,
      sidebarCollapsed,
      toggleTheme,
      toggleSidebar,
    }),
    [theme, sidebarCollapsed]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = () => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside UIProvider');
  return ctx;
};
