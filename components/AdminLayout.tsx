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
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close menus on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        fixed inset-y-0 left-0 z-50 ${isSidebarCollapsed ? 'w-20' : 'w-64'} flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121b25] 
        transition-all duration-300 ease-in-out h-full overflow-y-auto overflow-x-hidden
        lg:translate-x-0 lg:static lg:h-screen
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        <div className="flex flex-col p-4 gap-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-white">
                <span className="material-symbols-outlined">local_library</span>
              </div>
              {!isSidebarCollapsed && (
                <div className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-300">
                  <h1 className="text-slate-900 dark:text-white text-base font-bold leading-normal truncate max-w-[120px]">{user?.full_name || 'NECO APCIC'}</h1>
                  <p className="text-slate-500 dark:text-slate-400 text-[10px] font-normal leading-normal capitalize">{user?.role?.replace('_', ' ') || 'Admin Panel'}</p>
                </div>
              )}
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <nav className="flex flex-col gap-2">
            <NavItem to="/admin/dashboard" icon="dashboard" label="Dashboard" active={isActive('/admin/dashboard')} isCollapsed={isSidebarCollapsed} />

            <CollapsibleNavSection title="STAFF DATA" icon="badge" isLocked={isModuleLocked('staff_data') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} active={
              isActive('/admin/metadata/sdl') ||
              isActive('/admin/metadata/compare') ||
              isActive('/admin/metadata/flagged') ||
              isActive('/admin/metadata/validation') ||
              isActive('/admin/metadata/outstanding')
            }>
              <NavItem to="/admin/metadata/sdl" icon="fact_check" label="SDL" active={isActive('/admin/metadata/sdl')} isLocked={isModuleLocked('staff_data') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/metadata/compare" icon="compare_arrows" label="Juxtapose" active={isActive('/admin/metadata/compare')} isLocked={isModuleLocked('staff_data') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/metadata/flagged" icon="flag" label="Flagged Staff" active={isActive('/admin/metadata/flagged')} isLocked={isModuleLocked('staff_data') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/metadata/validation" icon="fact_check" label="Validation" active={isActive('/admin/metadata/validation')} isLocked={isModuleLocked('staff_data') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/metadata/outstanding" icon="pending_actions" label="Outstanding" active={isActive('/admin/metadata/outstanding')} isLocked={isModuleLocked('staff_data') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
            </CollapsibleNavSection>

            <CollapsibleNavSection title="Meta Data" icon="dataset" isLocked={isModuleLocked('metadata') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} active={
              isActive('/admin/states') ||
              isActive('/admin/stations') ||
              isActive('/admin/marking-venues') ||
              isActive('/admin/ncee-centers') ||
              isActive('/admin/tt-centers') ||
              isActive('/admin/bece-custodians') ||
              isActive('/admin/ssce-custodians') ||
              isActive('/admin/ssce-ext-custodians') ||
              isActive('/admin/ssce-ext-marking-venues') ||
              isActive('/admin/bece-marking-venues') ||
              isActive('/admin/mandates/config') ||
              isActive('/admin/assignments/config')
            }>
              <NavItem to="/admin/states" icon="map" label="States" active={isActive('/admin/states')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/stations" icon="location_on" label="Stations" active={isActive('/admin/stations')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/marking-venues" icon="edit_location" label="SSCE INT Marking Venues" active={isActive('/admin/marking-venues')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/ncee-centers" icon="school" label="NCEE Centers" active={isActive('/admin/ncee-centers')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/gifted-centers" icon="auto_awesome" label="Gifted Centers" active={isActive('/admin/gifted-centers')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/tt-centers" icon="science" label="TT Centers" active={isActive('/admin/tt-centers')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/printing-points" icon="print" label="Printing Points" active={isActive('/admin/printing-points')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/bece-custodians" icon="security" label="BECE Custodians" active={isActive('/admin/bece-custodians')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/ssce-custodians" icon="verified_user" label="SSCE INT Custodians" active={isActive('/admin/ssce-custodians')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/ssce-ext-custodians" icon="verified_user" label="SSCE EXT Custodians" active={isActive('/admin/ssce-ext-custodians')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/ssce-ext-marking-venues" icon="edit_location" label="SSCE EXT Marking Venues" active={isActive('/admin/ssce-ext-marking-venues')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/bece-marking-venues" icon="edit_location" label="BECE Marking Venues" active={isActive('/admin/bece-marking-venues')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/mandates/config" icon="admin_panel_settings" label="Mandates" active={isActive('/admin/mandates/config')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/assignments/config" icon="assignment_ind" label="Assignments" active={isActive('/admin/assignments/config')} isLocked={isModuleLocked('metadata') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
            </CollapsibleNavSection>


            <CollapsibleNavSection title="APC Management" icon="work" isLocked={isModuleLocked('apc') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} active={
              isActive('/admin/apc/list')
            }>
              <NavItem to="/admin/apc/list" icon="table_view" label="Staff APC" active={isActive('/admin/apc/list')} isLocked={isModuleLocked('apc') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/apc/custom" icon="person_add" label="Custom APC" active={isActive('/admin/apc/custom')} isLocked={isModuleLocked('apc') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/apc/random" icon="casino" label="Random APC" active={isActive('/admin/apc/random')} isLocked={isModuleLocked('apc') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
            </CollapsibleNavSection>


            <CollapsibleNavSection title="HOD's Management" icon="supervisor_account" isLocked={isModuleLocked('hod') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} active={
              isActive('/admin/apc/hod') ||
              isActive('/admin/assignments/hod') ||
              isActive('/admin/assignments/hod/final') ||
              isActive('/admin/assignments/hod/table')
            }>
              <NavItem to="/admin/apc/hod" icon="assignment_ind" label="HOD's APC" active={isActive('/admin/apc/hod')} isLocked={isModuleLocked('hod') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/assignments/hod" icon="shuffle" label="HOD Posting" active={location.pathname === '/admin/assignments/hod'} isLocked={isModuleLocked('hod') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/assignments/hod/table" icon="table_view" label="Posting Reports" active={isActive('/admin/assignments/hod/table')} isLocked={isModuleLocked('hod') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/assignments/hod/final" icon="verified" label="Final HOD Post Table" active={isActive('/admin/assignments/hod/final')} isLocked={isModuleLocked('hod') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
            </CollapsibleNavSection>


            <CollapsibleNavSection title="Posting Management" icon="folder_shared" isLocked={isModuleLocked('posting') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} active={
              isActive('/admin/apc/modes') ||
              isActive('/admin/apc/annual') ||
              isActive('/admin/apc/final') ||
              isActive('/admin/assignments/board') ||
              isActive('/admin/assignments/random')
            }>
              <NavItem to="/admin/apc/modes" icon="tune" label="Posting Modes" active={isActive('/admin/apc/modes')} isLocked={isModuleLocked('posting') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/apc/annual" icon="list_alt" label="Post Table" active={isActive('/admin/apc/annual')} isLocked={isModuleLocked('posting') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/assignments/board" icon="view_kanban" label="Personalized-Post" active={isActive('/admin/assignments/board')} isLocked={isModuleLocked('posting') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/assignments/random" icon="shuffle" label="Randomized-Post" active={isActive('/admin/assignments/random')} isLocked={isModuleLocked('posting') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/admin/apc/final" icon="verified" label="Final Post Table" active={isActive('/admin/apc/final')} isLocked={isModuleLocked('posting') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
            </CollapsibleNavSection>


            <CollapsibleNavSection title="Reports" icon="summarize" isLocked={isModuleLocked('reports') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} active={
              isActive('/admin/mandates/history')
            }>
              <NavItem to="/admin/mandates/history" icon="summarize" label="Generate Reports" active={isActive('/admin/mandates/history')} isLocked={isModuleLocked('reports') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />
            </CollapsibleNavSection>

            <NavItem to="/admin/statistics" icon="bar_chart" label="Statistics" active={isActive('/admin/statistics')} isLocked={isModuleLocked('reports') && !isSuperAdmin} isCollapsed={isSidebarCollapsed} />

            {isSuperAdmin && (
              <CollapsibleNavSection title="Configuration" icon="settings" isCollapsed={isSidebarCollapsed} active={
                isActive('/admin/audit') || isActive('/admin/configuration')
              }>
                <NavItem to="/admin/configuration" icon="tune" label="Super Admin" active={isActive('/admin/configuration')} isCollapsed={isSidebarCollapsed} />
                <NavItem to="/admin/audit" icon="visibility" label="Audit Logs" active={isActive('/admin/audit')} isCollapsed={isSidebarCollapsed} />
              </CollapsibleNavSection>
            )}
          </nav>
        </div>
      </aside>

      {isPasswordModalOpen && (
        <PasswordChangeModal onClose={() => setIsPasswordModalOpen(false)} />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden w-full relative">
        {/* Desktop Global Header */}
        <header className="hidden lg:flex h-16 flex-shrink-0 items-center justify-between px-8 bg-white dark:bg-[#121b25] border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 transition-colors">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <span className="material-symbols-outlined">{isSidebarCollapsed ? 'menu_open' : 'menu'}</span>
            </button>
          </div>

          <div className="flex items-center gap-6">
            <div id="header-actions" className="flex items-center gap-3"></div>

            <div className="h-8 w-[1px] bg-gray-200 dark:bg-gray-800"></div>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 p-1.5 pr-3 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group"
              >
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
                  {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AD'}
                </div>
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-[11px] font-bold text-slate-900 dark:text-white truncate max-w-[100px]">{user?.full_name || 'Admin'}</span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 capitalize">{user?.role?.replace('_', ' ') || 'User'}</span>
                </div>
                <span className={`material-symbols-outlined text-sm text-slate-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`}>expand_more</span>
              </button>

              {/* User Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-[#1a242f] rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 py-2 z-50 animate-in fade-in zoom-in duration-200 origin-top-right">
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 mb-1">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Account</p>
                  </div>

                  <a
                    href="https://docs.google.com/document/d/1JCXg8fvNSwwtJrBIF2Q4ftUbxWL8tkCgbGebPrDkCBU/edit?tab=t.0"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <span className="material-symbols-outlined text-lg">menu_book</span>
                    <span className="text-sm font-medium">User Manual</span>
                  </a>

                  <a
                    href="https://docs.google.com/document/d/1l60rxdaFD6r-nOG3nuLe56qvTjgUQiRoIiuocXzlfTw/edit?tab=t.0"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <span className="material-symbols-outlined text-lg">summarize</span>
                    <span className="text-sm font-medium">App Summary</span>
                  </a>

                  <div className="h-px bg-gray-100 dark:bg-gray-800 my-1 mx-2" />

                  <button
                    onClick={() => {
                      toggleTheme();
                      setIsUserMenuOpen(false);
                    }}
                    className="flex items-center gap-3 px-4 py-2 w-full text-left text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                    </span>
                    <span className="text-sm font-medium">
                      {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setIsPasswordModalOpen(true);
                      setIsUserMenuOpen(false);
                    }}
                    className="flex items-center gap-3 px-4 py-2 w-full text-left text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">lock_reset</span>
                    <span className="text-sm font-medium">Change Password</span>
                  </button>

                  <div className="h-px bg-gray-100 dark:bg-gray-800 my-1 mx-2" />

                  <button
                    onClick={() => {
                      logout();
                      setIsUserMenuOpen(false);
                    }}
                    className="flex items-center gap-3 px-4 py-2 w-full text-left text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">logout</span>
                    <span className="text-sm font-medium">Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

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

const NavItem = ({ to, icon, label, active, isLocked, isCollapsed }: { to: string; icon: string; label: string; active: boolean, isLocked?: boolean, isCollapsed?: boolean }) => {
  const content = (
    <div className={`flex items-center justify-center w-full ${isCollapsed ? '' : 'justify-between'}`}>
      <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center w-full' : ''}`}>
        <span className={`material-symbols-outlined ${active ? 'fill' : ''}`}>{icon}</span>
        {!isCollapsed && <p className="text-sm font-medium leading-normal animate-in fade-in duration-300">{label}</p>}
      </div>
      {!isCollapsed && isLocked && (
        <span className="material-symbols-outlined text-xs text-rose-500">lock</span>
      )}
      {isCollapsed && isLocked && (
        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 border border-white dark:border-[#121b25]" />
      )}
    </div>
  );

  const className = `flex items-center relative px-3 py-2 rounded-lg transition-all duration-200 ${active
    ? 'bg-primary/10 text-primary'
    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
    } ${isLocked ? 'opacity-60 cursor-not-allowed grayscale-[0.5]' : ''} ${isCollapsed ? 'justify-center mx-2' : 'justify-between'}`;

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

const CollapsibleNavSection = ({ title, icon, children, active, isLocked, isCollapsed }: { title: string; icon: string; children: React.ReactNode; active: boolean, isLocked?: boolean, isCollapsed?: boolean }) => {
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
        className={`flex items-center relative px-3 py-2 rounded-lg transition-all duration-200 w-full text-left ${active ? 'text-primary bg-primary/5 dark:bg-primary/10' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''} ${isCollapsed ? 'justify-center mx-2' : 'justify-between'}`}
        title={isCollapsed ? title : ''}
      >
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center w-full' : ''}`}>
          <div className="relative">
            <span className="material-symbols-outlined text-xl">{icon}</span>
            {isLocked && (
              <span className={`absolute -top-1 -right-1 rounded-full bg-rose-500 border-2 border-white dark:border-[#121b25] flex items-center justify-center ${isCollapsed ? 'size-2' : 'size-3'}`}>
                {!isCollapsed && <span className="material-symbols-outlined text-[8px] text-white font-black">lock</span>}
              </span>
            )}
          </div>
          {!isCollapsed && <p className="text-sm font-semibold uppercase tracking-wide animate-in fade-in duration-300">{title}</p>}
        </div>
        {!isLocked && !isCollapsed && (
          <span className={`material-symbols-outlined transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        )}
      </button>

      {!isCollapsed && (
        <div className={`flex flex-col gap-1 pl-4 border-l-2 border-slate-100 dark:border-slate-800 ml-5 overflow-hidden transition-all duration-300 ${isOpen && !isLocked ? 'max-h-[1000px] opacity-100 mt-1' : 'max-h-0 opacity-0'
          }`}>
          {children}
        </div>
      )}
    </div>
  );
};

export default AdminLayout;