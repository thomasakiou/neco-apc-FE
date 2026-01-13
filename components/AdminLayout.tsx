import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTheme } from './ThemeContext';
import { useAuth } from '../context/AuthContext';
import { PasswordChangeModal } from './PasswordChangeModal';
import EnvironmentSwitcher from './EnvironmentSwitcher';

const AdminLayout: React.FC = () => {
  const location = useLocation();
  const { user, isSuperAdmin, isModuleLocked, logout } = useAuth();
  const isActive = (path: string) => location.pathname.includes(path);
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = React.useState(false);

  // Close mobile menu on navigation
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-full bg-background-light dark:bg-[#101922] transition-colors duration-200 overflow-hidden">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SideNavBar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121b25] 
        transition-transform duration-300 ease-in-out h-full overflow-y-auto
        lg:translate-x-0 lg:static lg:h-screen
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        <div className="flex flex-col p-4 gap-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-white">
                <span className="material-symbols-outlined">local_library</span>
              </div>
              <div className="flex flex-col">
                <h1 className="text-slate-900 dark:text-white text-base font-bold leading-normal truncate max-w-[120px]">{user?.full_name || 'NECO APCIC'}</h1>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] font-normal leading-normal capitalize">{user?.role?.replace('_', ' ') || 'Admin Panel'}</p>
              </div>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <nav className="flex flex-col gap-2">
            <NavItem to="/admin/dashboard" icon="dashboard" label="Dashboard" active={isActive('/admin/dashboard')} />

            <CollapsibleNavSection title="STAFF DATA" icon="badge" isLocked={isModuleLocked('staff_data') && !isSuperAdmin} active={
              isActive('/admin/metadata/sdl') ||
              isActive('/admin/metadata/compare') ||
              isActive('/admin/metadata/flagged') ||
              isActive('/admin/metadata/validation') ||
              isActive('/admin/metadata/outstanding')
            }>
              <NavItem to="/admin/metadata/sdl" icon="fact_check" label="SDL" active={isActive('/admin/metadata/sdl')} isLocked={isModuleLocked('staff_data') && !isSuperAdmin} />
              <NavItem to="/admin/metadata/compare" icon="compare_arrows" label="Juxtapose" active={isActive('/admin/metadata/compare')} isLocked={isModuleLocked('staff_data') && !isSuperAdmin} />
              <NavItem to="/admin/metadata/flagged" icon="flag" label="Flagged Staff" active={isActive('/admin/metadata/flagged')} isLocked={isModuleLocked('staff_data') && !isSuperAdmin} />
              <NavItem to="/admin/metadata/validation" icon="fact_check" label="Validation" active={isActive('/admin/metadata/validation')} isLocked={isModuleLocked('staff_data') && !isSuperAdmin} />
              <NavItem to="/admin/metadata/outstanding" icon="pending_actions" label="Outstanding" active={isActive('/admin/metadata/outstanding')} isLocked={isModuleLocked('staff_data') && !isSuperAdmin} />
            </CollapsibleNavSection>

            <CollapsibleNavSection title="Meta Data" icon="dataset" isLocked={isModuleLocked('metadata') && !isSuperAdmin} active={
              isActive('/admin/states') ||
              isActive('/admin/stations') ||
              isActive('/admin/marking-venues') ||
              isActive('/admin/ncee-centers') ||
              isActive('/admin/tt-centers') ||
              isActive('/admin/bece-custodians') ||
              isActive('/admin/ssce-custodians') ||
              isActive('/admin/mandates/config') ||
              isActive('/admin/assignments/config')
            }>
              <NavItem to="/admin/states" icon="map" label="States" active={isActive('/admin/states')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} />
              <NavItem to="/admin/stations" icon="location_on" label="Stations" active={isActive('/admin/stations')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} />
              <NavItem to="/admin/marking-venues" icon="edit_location" label="Marking Venues" active={isActive('/admin/marking-venues')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} />
              <NavItem to="/admin/ncee-centers" icon="school" label="NCEE Centers" active={isActive('/admin/ncee-centers')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} />
              <NavItem to="/admin/tt-centers" icon="science" label="TT Centers" active={isActive('/admin/tt-centers')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} />
              <NavItem to="/admin/bece-custodians" icon="security" label="BECE Custodians" active={isActive('/admin/bece-custodians')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} />
              <NavItem to="/admin/ssce-custodians" icon="verified_user" label="SSCE Custodians" active={isActive('/admin/ssce-custodians')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} />
              <NavItem to="/admin/mandates/config" icon="admin_panel_settings" label="Mandates" active={isActive('/admin/mandates/config')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} />
              <NavItem to="/admin/assignments/config" icon="assignment_ind" label="Assignments" active={isActive('/admin/assignments/config')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} />
            </CollapsibleNavSection>


            <CollapsibleNavSection title="APC Management" icon="work" isLocked={isModuleLocked('apc') && !isSuperAdmin} active={
              isActive('/admin/apc/list')
            }>
              <NavItem to="/admin/apc/list" icon="table_view" label="Staff APC" active={isActive('/admin/apc/list')} isLocked={isModuleLocked('apc') && !isSuperAdmin} />
              <NavItem to="/admin/apc/custom" icon="person_add" label="Custom APC" active={isActive('/admin/apc/custom')} isLocked={isModuleLocked('apc') && !isSuperAdmin} />
              <NavItem to="/admin/apc/random" icon="casino" label="Random APC" active={isActive('/admin/apc/random')} isLocked={isModuleLocked('apc') && !isSuperAdmin} />
            </CollapsibleNavSection>


            <CollapsibleNavSection title="HOD's Management" icon="supervisor_account" isLocked={isModuleLocked('hod') && !isSuperAdmin} active={
              isActive('/admin/apc/hod') ||
              isActive('/admin/assignments/hod') ||
              isActive('/admin/assignments/hod/table')
            }>
              <NavItem to="/admin/apc/hod" icon="assignment_ind" label="HOD's APC" active={isActive('/admin/apc/hod')} isLocked={isModuleLocked('hod') && !isSuperAdmin} />
              <NavItem to="/admin/assignments/hod" icon="shuffle" label="HOD Posting" active={location.pathname === '/admin/assignments/hod'} isLocked={isModuleLocked('hod') && !isSuperAdmin} />
              <NavItem to="/admin/assignments/hod/table" icon="table_view" label="Posting Reports" active={isActive('/admin/assignments/hod/table')} isLocked={isModuleLocked('hod') && !isSuperAdmin} />
            </CollapsibleNavSection>


            <CollapsibleNavSection title="Posting Management" icon="folder_shared" isLocked={isModuleLocked('posting') && !isSuperAdmin} active={
              isActive('/admin/apc/modes') ||
              isActive('/admin/apc/annual') ||
              isActive('/admin/assignments/board') ||
              isActive('/admin/assignments/random')
            }>
              <NavItem to="/admin/apc/modes" icon="tune" label="Posting Modes" active={isActive('/admin/apc/modes')} isLocked={isModuleLocked('posting') && !isSuperAdmin} />
              <NavItem to="/admin/apc/annual" icon="list_alt" label="Post Table" active={isActive('/admin/apc/annual')} isLocked={isModuleLocked('posting') && !isSuperAdmin} />
              <NavItem to="/admin/assignments/board" icon="view_kanban" label="Personalized-Post" active={isActive('/admin/assignments/board')} isLocked={isModuleLocked('posting') && !isSuperAdmin} />
              <NavItem to="/admin/assignments/random" icon="shuffle" label="Randomized-Post" active={isActive('/admin/assignments/random')} isLocked={isModuleLocked('posting') && !isSuperAdmin} />
            </CollapsibleNavSection>


            <CollapsibleNavSection title="Reports" icon="summarize" isLocked={isModuleLocked('reports') && !isSuperAdmin} active={
              isActive('/admin/mandates/history')
            }>
              <NavItem to="/admin/mandates/history" icon="summarize" label="Generate Reports" active={isActive('/admin/mandates/history')} isLocked={isModuleLocked('reports') && !isSuperAdmin} />
            </CollapsibleNavSection>

            <NavItem to="/admin/statistics" icon="bar_chart" label="Statistics" active={isActive('/admin/statistics')} isLocked={isModuleLocked('reports') && !isSuperAdmin} />


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
          <a
            href="https://docs.google.com/document/d/1JCXg8fvNSwwtJrBIF2Q4ftUbxWL8tkCgbGebPrDkCBU/edit?tab=t.0"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors w-full text-left"
          >
            <span className="material-symbols-outlined text-xl">menu_book</span>
            <p className="text-sm font-medium leading-normal">User Manual</p>
          </a>

          <a
            href="https://docs.google.com/document/d/1l60rxdaFD6r-nOG3nuLe56qvTjgUQiRoIiuocXzlfTw/edit?tab=t.0"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-full text-left"
          >
            <span className="material-symbols-outlined text-xl">summarize</span>
            <p className="text-sm font-medium leading-normal">App Summary</p>
          </a>

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
            onClick={() => setIsPasswordModalOpen(true)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors w-full text-left"
          >
            <span className="material-symbols-outlined text-xl">lock_reset</span>
            <p className="text-sm font-medium leading-normal">Change Password</p>
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

      {isPasswordModalOpen && (
        <PasswordChangeModal onClose={() => setIsPasswordModalOpen(false)} />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto w-full">
        {/* Mobile Header Bar */}
        <div className="lg:hidden h-16 flex-shrink-0 flex items-center justify-between px-4 bg-white dark:bg-[#121b25] border-b border-gray-200 dark:border-gray-800 z-30">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded bg-primary text-white">
              <span className="material-symbols-outlined text-sm">local_library</span>
            </div>
            <span className="font-bold text-slate-900 dark:text-white text-sm">NECO APCIC</span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <Outlet />
        </div>
      </main>

      <EnvironmentSwitcher />
    </div>
  );
};

const NavItem = ({ to, icon, label, active, isLocked }: { to: string; icon: string; label: string; active: boolean, isLocked?: boolean }) => {
  const content = (
    <>
      <div className="flex items-center gap-3">
        <span className={`material-symbols-outlined ${active ? 'fill' : ''}`}>{icon}</span>
        <p className="text-sm font-medium leading-normal">{label}</p>
      </div>
      {isLocked && (
        <span className="material-symbols-outlined text-xs text-rose-500">lock</span>
      )}
    </>
  );

  const className = `flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${active
    ? 'bg-primary/10 text-primary'
    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
    } ${isLocked ? 'opacity-60 cursor-not-allowed grayscale-[0.5]' : ''}`;

  if (isLocked) {
    return (
      <div className={className} title="Module Locked">
        {content}
      </div>
    );
  }

  return (
    <Link to={to} className={className}>
      {content}
    </Link>
  );
};

const CollapsibleNavSection = ({ title, icon, children, active, isLocked }: { title: string; icon: string; children: React.ReactNode; active: boolean, isLocked?: boolean }) => {
  const [isOpen, setIsOpen] = React.useState(active);

  React.useEffect(() => {
    if (active) setIsOpen(true);
  }, [active]);

  const handleToggle = () => {
    if (isLocked) return;
    setIsOpen(!isOpen);
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleToggle}
        disabled={isLocked}
        className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors w-full text-left ${active ? 'text-primary bg-primary/5 dark:bg-primary/10' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined text-xl">{icon}</span>
            {isLocked && (
              <span className="absolute -top-1 -right-1 size-3 rounded-full bg-rose-500 border-2 border-white dark:border-[#121b25] flex items-center justify-center">
                <span className="material-symbols-outlined text-[8px] text-white font-black">lock</span>
              </span>
            )}
          </div>
          <p className="text-sm font-semibold uppercase tracking-wide">{title}</p>
        </div>
        {!isLocked && (
          <span className={`material-symbols-outlined transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        )}
      </button>

      <div className={`flex flex-col gap-1 pl-4 border-l-2 border-slate-100 dark:border-slate-800 ml-5 overflow-hidden transition-all duration-300 ${isOpen && !isLocked ? 'max-h-[1000px] opacity-100 mt-1' : 'max-h-0 opacity-0'
        }`}>
        {children}
      </div>
    </div>
  );
};

export default AdminLayout;