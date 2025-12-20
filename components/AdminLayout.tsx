import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTheme } from './ThemeContext';
import { useAuth } from '../context/AuthContext';

const AdminLayout: React.FC = () => {
  const location = useLocation();
  const { user, isSuperAdmin, isModuleLocked, logout } = useAuth();
  const isActive = (path: string) => location.pathname.includes(path);
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-screen w-full bg-background-light dark:bg-[#101922] transition-colors duration-200">
      {/* SideNavBar */}
      <aside className="flex w-64 flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121b25] sticky top-0 h-screen overflow-y-auto transition-colors duration-200">
        <div className="flex flex-col p-4 gap-6">
          <div className="flex items-center gap-3 px-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-white">
              <span className="material-symbols-outlined">local_library</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-slate-900 dark:text-white text-base font-bold leading-normal truncate max-w-[150px]">{user?.full_name || 'NECO APCIC'}</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal capitalize">{user?.role?.replace('_', ' ') || 'Admin Panel'}</p>
            </div>
          </div>

          <nav className="flex flex-col gap-2">
            <NavItem to="/admin/dashboard" icon="dashboard" label="Dashboard" active={isActive('/admin/dashboard')} />

            {(!isModuleLocked('apc') || isSuperAdmin) && (
              <NavItem to="/admin/apc/list" icon="table_view" label="APC" active={isActive('/admin/apc/list')} />
            )}

            <NavItem to="/admin/metadata/sdl" icon="fact_check" label="SDL" active={isActive('/admin/metadata/sdl')} />
            <NavItem to="/admin/metadata/compare" icon="compare_arrows" label="Juxtapose" active={isActive('/admin/metadata/compare')} />

            {(!isModuleLocked('metadata') || isSuperAdmin) && (
              <CollapsibleNavSection title="Meta Data" icon="dataset" active={
                isActive('/admin/states') ||
                isActive('/admin/stations') ||
                isActive('/admin/marking-venues') ||
                isActive('/admin/ncee-centers') ||
                isActive('/admin/bece-custodians') ||
                isActive('/admin/ssce-custodians') ||
                isActive('/admin/mandates/config') ||
                isActive('/admin/assignments/config')
              }>
                <NavItem to="/admin/states" icon="map" label="States" active={isActive('/admin/states')} />
                <NavItem to="/admin/stations" icon="location_on" label="Stations" active={isActive('/admin/stations')} />
                <NavItem to="/admin/marking-venues" icon="edit_location" label="Marking Venues" active={isActive('/admin/marking-venues')} />
                <NavItem to="/admin/ncee-centers" icon="school" label="NCEE Centers" active={isActive('/admin/ncee-centers')} />
                <NavItem to="/admin/bece-custodians" icon="security" label="BECE Custodians" active={isActive('/admin/bece-custodians')} />
                <NavItem to="/admin/ssce-custodians" icon="verified_user" label="SSCE Custodians" active={isActive('/admin/ssce-custodians')} />
                <NavItem to="/admin/mandates/config" icon="admin_panel_settings" label="Mandates" active={isActive('/admin/mandates/config')} />
                <NavItem to="/admin/assignments/config" icon="assignment_ind" label="Assignments" active={isActive('/admin/assignments/config')} />
              </CollapsibleNavSection>
            )}

            {(!isModuleLocked('apc') || isSuperAdmin) && (
              <CollapsibleNavSection title="APC Management" icon="work" active={
                isActive('/admin/apc/generate')
              }>
                <NavItem to="/admin/apc/generate" icon="calendar_add_on" label="Generate APC" active={isActive('/admin/apc/generate')} />
              </CollapsibleNavSection>
            )}

            {(!isModuleLocked('posting') || isSuperAdmin) && (
              <CollapsibleNavSection title="Posting Management" icon="folder_shared" active={
                isActive('/admin/apc/modes') ||
                isActive('/admin/apc/annual') ||
                isActive('/admin/assignments/board') ||
                isActive('/admin/assignments/random')
              }>
                <NavItem to="/admin/apc/modes" icon="tune" label="Posting Modes" active={isActive('/admin/apc/modes')} />
                <NavItem to="/admin/apc/annual" icon="list_alt" label="Post Table" active={isActive('/admin/apc/annual')} />
                <NavItem to="/admin/assignments/board" icon="view_kanban" label="Personalized-Post" active={isActive('/admin/assignments/board')} />
                <NavItem to="/admin/assignments/random" icon="shuffle" label="Random-Post" active={isActive('/admin/assignments/random')} />
              </CollapsibleNavSection>
            )}

            {(!isModuleLocked('reports') || isSuperAdmin) && (
              <CollapsibleNavSection title="Reports" icon="summarize" active={
                isActive('/admin/mandates/history')
              }>
                <NavItem to="/admin/mandates/history" icon="summarize" label="Generate Reports" active={isActive('/admin/mandates/history')} />
              </CollapsibleNavSection>
            )}

            {isSuperAdmin && (
              <CollapsibleNavSection title="Configuration" icon="settings" active={
                isActive('/admin/audit') || isActive('/admin/configuration')
              }>
                <NavItem to="/admin/configuration" icon="tune" label="Super Admin" active={isActive('/admin/configuration')} />
                <NavItem to="/admin/audit" icon="visibility" label="Audit Logs" active={isActive('/admin/audit')} />
              </CollapsibleNavSection>
            )}
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-2">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors w-full text-left"
          >
            <span className="material-symbols-outlined text-xl">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
            <p className="text-sm font-medium leading-normal">
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </p>
          </button>

          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors w-full text-left"
          >
            <span className="material-symbols-outlined">logout</span>
            <p className="text-sm font-medium leading-normal">Logout</p>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

const NavItem = ({ to, icon, label, active }: { to: string; icon: string; label: string; active: boolean }) => (
  <Link
    to={to}
    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${active
      ? 'bg-primary/10 text-primary'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
      }`}
  >
    <span className={`material-symbols-outlined ${active ? 'fill' : ''}`}>{icon}</span>
    <p className="text-sm font-medium leading-normal">{label}</p>
  </Link>
);

const CollapsibleNavSection = ({ title, icon, children, active }: { title: string; icon: string; children: React.ReactNode; active: boolean }) => {
  const [isOpen, setIsOpen] = React.useState(active);

  React.useEffect(() => {
    if (active) setIsOpen(true);
  }, [active]);

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors w-full text-left ${active ? 'text-primary bg-primary/5 dark:bg-primary/10' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-xl">{icon}</span>
          <p className="text-sm font-semibold uppercase tracking-wide">{title}</p>
        </div>
        <span className={`material-symbols-outlined transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>

      <div className={`flex flex-col gap-1 pl-4 border-l-2 border-slate-100 dark:border-slate-800 ml-5 overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[1000px] opacity-100 mt-1' : 'max-h-0 opacity-0'
        }`}>
        {children}
      </div>
    </div>
  );
};

export default AdminLayout;