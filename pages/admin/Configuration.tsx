import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { listUsers, createUser, getAuditLogs, resetUserPassword } from '../../services/user';
import { deleteAuditLog, clearAllAuditLogs } from '../../services/audit';
import { downloadDatabaseBackup } from '../../services/database';
import { changePassword } from '../../services/auth';
import { UserResponse, UserCreate, UserRole } from '../../types/auth';
import { AuditLogResponse } from '../../types/audit';
import moment from 'moment';

const TabButton = ({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: string }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2.5 py-2.5 px-6 rounded-xl transition-all font-black text-xs uppercase tracking-widest ${active ? 'bg-white dark:bg-[#1e293b] text-teal-600 dark:text-teal-400 shadow-md scale-[1.02]' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
    >
        <span className="material-symbols-outlined text-lg">{icon}</span>
        {label}
    </button>
);

const Configuration: React.FC = () => {
    const { isSuperAdmin, moduleLocks, toggleModuleLock, user: currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'users' | 'modules' | 'audit' | 'database'>((searchParams.get('tab') as any) || 'users');
    const [users, setUsers] = useState<UserResponse[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLogResponse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);

    // Audit Log Deletion State
    const [logToDelete, setLogToDelete] = useState<string | null>(null);
    const [isClearLogsModalOpen, setIsClearLogsModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteLog = async () => {
        if (!logToDelete) return;
        setIsDeleting(true);
        try {
            await deleteAuditLog(logToDelete);
            showNotification('Audit log deleted successfully', 'success');
            fetchLogs();
            setLogToDelete(null);
        } catch (error) {
            showNotification('Failed to delete audit log', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleClearLogs = async () => {
        setIsDeleting(true);
        try {
            await clearAllAuditLogs();
            showNotification('All audit logs cleared successfully', 'success');
            fetchLogs();
            setIsClearLogsModalOpen(false);
        } catch (error) {
            showNotification('Failed to clear audit logs', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['users', 'modules', 'audit', 'database'].includes(tab)) {
            setActiveTab(tab as any);
        }
    }, [searchParams]);

    useEffect(() => {
        if (activeTab === 'users') fetchUsers();
        if (activeTab === 'audit') fetchLogs();

        // Update URL when tab changes internally
        if (activeTab !== searchParams.get('tab')) {
            setSearchParams({ tab: activeTab });
        }
    }, [activeTab]);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const data = await listUsers();
            const filteredData = data.filter(u => u.full_name !== 'Super Admin 1');
            setUsers(filteredData);
        } catch (error: any) {
            showNotification(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const data = await getAuditLogs(0, 50);
            if (data && data.items) {
                setAuditLogs(data.items);
            }
        } catch (error: any) {
            showNotification(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleLock = async (moduleName: string) => {
        try {
            const isCurrentlyLocked = !!moduleLocks[moduleName];
            await toggleModuleLock(moduleName);
            showNotification(`${moduleName.toUpperCase()} module ${isCurrentlyLocked ? 'unlocked' : 'locked'} successfully`, 'success');
        } catch (error: any) {
            showNotification(error.message || `Failed to toggle lock for ${moduleName}`, 'error');
        }
    };

    const handleDownloadBackup = async () => {
        setIsLoading(true);
        try {
            await downloadDatabaseBackup();
            showNotification('Database backup initiated successfully', 'success');
        } catch (error: any) {
            showNotification(error.message || 'Failed to download backup', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isSuperAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <span className="material-symbols-outlined text-red-500 text-6xl">lock</span>
                <div className="text-center">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">Access Denied</h3>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">This section is restricted to Super Administrators only.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full bg-[#f8fafc] dark:bg-[#0b1015] transition-colors duration-300 overflow-hidden">
            <header className="flex-none flex items-center justify-between px-4 md:px-10 py-4 md:py-5 bg-white/40 dark:bg-[#121b25]/40 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/5 z-20">
                <div>
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        System <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">Configuration</span>
                    </h1>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mt-0.5 opacity-70">NECO APCIC Administration Hub</p>
                </div>

                <div className="flex items-center gap-8">
                    <div className="flex bg-slate-100/50 dark:bg-white/5 p-1 rounded-2xl border border-slate-200/50 dark:border-white/5 shadow-inner">
                        <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} label="Users" icon="group" />
                        <TabButton active={activeTab === 'modules'} onClick={() => setActiveTab('modules')} label="Modules" icon="lock_open" />
                        <TabButton active={activeTab === 'database'} onClick={() => setActiveTab('database')} label="Database" icon="database" />
                        <TabButton active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} label="Audit" icon="history" />
                    </div>

                    <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 transition-all group">
                        <div className="size-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                            {currentUser?.full_name.charAt(0) || 'U'}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-900 dark:text-white leading-none">{currentUser?.full_name || 'User'}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mt-1">System Administrator</span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 pb-12">
                <div className="max-w-[1400px] mx-auto">
                    <div className="bg-white/70 dark:bg-[#121b25]/60 dark:backdrop-blur-md rounded-[2.5rem] border border-slate-200/50 dark:border-white/5 p-4 md:p-8 shadow-xl shadow-slate-200/20 dark:shadow-none min-h-[600px] transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 size-96 bg-emerald-500/5 blur-[100px] rounded-full -mr-48 -mt-48 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 size-96 bg-blue-500/5 blur-[100px] rounded-full -ml-48 -mb-48 pointer-events-none"></div>

                        <div className="relative z-10">
                            {activeTab === 'users' && (
                                <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex justify-between items-center bg-slate-50/50 dark:bg-white/5 p-6 rounded-3xl border border-slate-200/50 dark:border-white/5">
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">User Directory</h2>
                                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">Manage administrative access control</p>
                                        </div>
                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => setIsUserModalOpen(true)}
                                                className="group flex items-center gap-3 px-6 py-3 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl hover:shadow-xl hover:shadow-emerald-500/20 transition-all font-black text-sm active:scale-95"
                                            >
                                                <span className="material-symbols-outlined text-xl group-hover:rotate-90 transition-transform">add_circle</span>
                                                Register New User
                                            </button>
                                        </div>
                                    </div>

                                    <div className="overflow-hidden rounded-[2rem] border border-slate-200/60 dark:border-white/10 bg-white/30 dark:bg-white/5 backdrop-blur-sm shadow-inner">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-100/50 dark:bg-white/5 border-b border-slate-200/60 dark:border-white/10">
                                                    <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Profile</th>
                                                    <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Identity / Role</th>
                                                    <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-center">Security Status</th>
                                                    <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-right">Operations</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200/40 dark:divide-white/5">
                                                {users.map(u => (
                                                    <tr key={u.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all">
                                                        <td className="px-8 py-6">
                                                            <div className="flex items-center gap-4">
                                                                <div className="size-12 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-400 dark:text-white/20 font-black text-xl group-hover:scale-110 transition-transform">
                                                                    {u.full_name.charAt(0)}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-base font-black text-slate-900 dark:text-white leading-tight">{u.full_name}</span>
                                                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{u.email}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <div className="flex flex-col gap-1.5">
                                                                <span className={`inline-flex px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider w-fit ${u.role === 'super_admin' ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'}`}>
                                                                    {u.role.replace('_', ' ')}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Access Level</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <div className="flex justify-center">
                                                                <span className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm border ${u.is_active ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                                                                    <span className={`size-1.5 rounded-full ${u.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                                                                    {u.is_active ? 'Operational' : 'Deactivated'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                {u.role === 'user' && (
                                                                    <button
                                                                        onClick={async () => {
                                                                            if (window.confirm(`Are you sure you want to reset password for ${u.full_name}? Their password will be reset to the default.`)) {
                                                                                try {
                                                                                    await resetUserPassword(u.id);
                                                                                    showNotification(`Password for ${u.full_name} has been reset to: password123`, 'success');
                                                                                } catch (error: any) {
                                                                                    showNotification(error.message || 'Failed to reset password', 'error');
                                                                                }
                                                                            }
                                                                        }}
                                                                        className="size-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all shadow-sm active:scale-90"
                                                                        title="Reset Password"
                                                                    >
                                                                        <span className="material-symbols-outlined text-lg">lock_reset</span>
                                                                    </button>
                                                                )}
                                                                {currentUser?.id !== u.id && (
                                                                    <button
                                                                        onClick={() => {
                                                                            if (window.confirm(`WARNING: This will permanently delete user ${u.full_name}. Proceed?`)) {
                                                                                showNotification('User deletion is a placeholder action in this version', 'warning');
                                                                            }
                                                                        }}
                                                                        className="size-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-90"
                                                                        title="Delete User"
                                                                    >
                                                                        <span className="material-symbols-outlined text-lg font-bold">delete</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'modules' && (
                                <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="bg-slate-50/50 dark:bg-white/5 p-8 rounded-3xl border border-slate-200/50 dark:border-white/5 flex flex-col md:flex-row items-center gap-8 shadow-inner">
                                        <div className="size-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white shadow-xl shadow-orange-500/20">
                                            <span className="material-symbols-outlined text-4xl">security</span>
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Module Access Control</h2>
                                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                                                Globally enable or disable entire system components. Locking a module will restrict access for all non-superadmin users immediately.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <ModuleToggle
                                            label="Staff Data Module"
                                            description="Lock/Unlock access to SDL and Juxtapose features."
                                            isLocked={moduleLocks['staff_data']}
                                            onToggle={() => handleToggleLock('staff_data')}
                                            icon="badge"
                                        />
                                        <ModuleToggle
                                            label="APC Module"
                                            description="Lock/Unlock access to Generate APC, Posting Modes, and APC List."
                                            isLocked={moduleLocks['apc']}
                                            onToggle={() => handleToggleLock('apc')}
                                            icon="assignment_ind"
                                        />
                                        <ModuleToggle
                                            label="HODs Management Module"
                                            description="Lock/Unlock access to HOD's APC and HOD Posting features."
                                            isLocked={moduleLocks['hod']}
                                            onToggle={() => handleToggleLock('hod')}
                                            icon="supervisor_account"
                                        />
                                        <ModuleToggle
                                            label="Meta Data Module"
                                            description="Lock/Unlock access to States, Stations, Venues, etc."
                                            isLocked={moduleLocks['metadata']}
                                            onToggle={() => handleToggleLock('metadata')}
                                            icon="database"
                                        />
                                        <ModuleToggle
                                            label="Posting Module"
                                            description="Lock/Unlock access to Board and Randomized Post Generator."
                                            isLocked={moduleLocks['posting']}
                                            onToggle={() => handleToggleLock('posting')}
                                            icon="send"
                                        />
                                        <ModuleToggle
                                            label="Reports Module"
                                            description="Lock/Unlock access to Assignment History and Reports."
                                            isLocked={moduleLocks['reports']}
                                            onToggle={() => handleToggleLock('reports')}
                                            icon="analytics"
                                        />
                                    </div>

                                    {/* Staff Portal Controls - Separate Section */}
                                    <div className="mt-4 bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/20 dark:to-teal-950/20 p-8 rounded-3xl border border-cyan-200/50 dark:border-cyan-800/30 flex flex-col md:flex-row items-center gap-8 shadow-inner">
                                        <div className="size-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-white shadow-xl shadow-cyan-500/20">
                                            <span className="material-symbols-outlined text-4xl">public</span>
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Staff Portal Controls</h2>
                                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                                                Control staff access to the external Staff Portal. Staff can login with their File Number and Date of Birth to view their own data.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <ModuleToggle
                                            label="Portal Login"
                                            description="Allow/Block staff from logging into the Staff Portal."
                                            isLocked={moduleLocks['staff_portal_login']}
                                            onToggle={() => handleToggleLock('staff_portal_login')}
                                            icon="login"
                                        />
                                        <ModuleToggle
                                            label="SDL Access"
                                            description="Allow/Block staff from viewing their Staff Data (SDL)."
                                            isLocked={moduleLocks['staff_portal_sdl']}
                                            onToggle={() => handleToggleLock('staff_portal_sdl')}
                                            icon="badge"
                                        />
                                        <ModuleToggle
                                            label="APC Access"
                                            description="Allow/Block staff from viewing their APC and Posting data."
                                            isLocked={moduleLocks['staff_portal_apc']}
                                            onToggle={() => handleToggleLock('staff_portal_apc')}
                                            icon="assignment_ind"
                                        />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'database' && (
                                <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="bg-slate-50/50 dark:bg-white/5 p-8 rounded-3xl border border-slate-200/50 dark:border-white/5 flex flex-col md:flex-row items-center gap-8 shadow-inner">
                                        <div className="size-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20">
                                            <span className="material-symbols-outlined text-4xl">database</span>
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Database Maintenance</h2>
                                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                                                Manage system data integrity and backups. Regularly downloading backups ensures that you can recover your data in case of unforeseen system failure.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="bg-white dark:bg-white/5 p-8 rounded-[2rem] border border-slate-200/50 dark:border-white/10 flex flex-col justify-between items-start gap-6 hover:shadow-xl transition-all duration-300">
                                            <div className="flex flex-col gap-2">
                                                <div className="size-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-2">
                                                    <span className="material-symbols-outlined text-2xl">download_for_offline</span>
                                                </div>
                                                <h3 className="text-xl font-black text-slate-900 dark:text-white">Full System Dump</h3>
                                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                                    Generates a complete SQL snapshot of all tables, including APCIC records, staff disposition list, and configuration settings.
                                                </p>
                                            </div>
                                            <button
                                                onClick={handleDownloadBackup}
                                                disabled={isLoading}
                                                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
                                            >
                                                {isLoading ? (
                                                    <span className="material-symbols-outlined animate-spin">refresh</span>
                                                ) : (
                                                    <span className="material-symbols-outlined">backup</span>
                                                )}
                                                Generate & Download .SQL
                                            </button>
                                        </div>

                                        <div className="bg-slate-50/50 dark:bg-white/5 p-8 rounded-[2rem] border border-slate-200/50 dark:border-white/10 flex flex-col gap-6 opacity-60">
                                            <div className="flex flex-col gap-2">
                                                <div className="size-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-2">
                                                    <span className="material-symbols-outlined text-2xl">lock_reset</span>
                                                </div>
                                                <h3 className="text-xl font-black text-slate-900 dark:text-white">Factory Reset</h3>
                                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                                    WIPE all postings and reset APC statuses to default. Use only for end-of-year maintenance.
                                                </p>
                                            </div>
                                            <button disabled className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-white/10 rounded-2xl text-slate-400 font-bold text-xs uppercase cursor-not-allowed">
                                                Feature Restricted
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'audit' && (
                                <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex justify-between items-center bg-slate-50/50 dark:bg-white/5 p-6 rounded-3xl border border-slate-200/50 dark:border-white/5 shadow-inner">
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">System Audit Log</h2>
                                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">Tracking administrative operations</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {isSuperAdmin && (
                                                <button
                                                    onClick={() => setIsClearLogsModalOpen(true)}
                                                    disabled={isLoading || auditLogs.length === 0}
                                                    className="h-12 px-6 flex items-center justify-center gap-2 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 transition-all active:scale-95 disabled:opacity-50 font-bold text-xs uppercase tracking-wider"
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete_sweep</span>
                                                    Clear All
                                                </button>
                                            )}
                                            <button
                                                onClick={fetchLogs}
                                                disabled={isLoading}
                                                className="size-12 flex items-center justify-center rounded-2xl bg-white dark:bg-white/10 text-slate-600 dark:text-white border border-slate-200/60 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/20 transition-all active:scale-95 disabled:opacity-50"
                                            >
                                                <span className={`material-symbols-outlined ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="overflow-hidden rounded-[2rem] border border-slate-200/60 dark:border-white/10 bg-white/30 dark:bg-white/5 backdrop-blur-sm shadow-inner">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-100/50 dark:bg-white/5 border-b border-slate-200/60 dark:border-white/10">
                                                    <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Timestamp / Identity</th>
                                                    <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Operation performed</th>
                                                    <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Operational Details</th>
                                                    <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-right">Target Entity</th>
                                                    {isSuperAdmin && <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200/40 dark:divide-white/5">
                                                {auditLogs.map(log => (
                                                    <tr key={log.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all">
                                                        <td className="px-8 py-6">
                                                            <div className="flex items-center gap-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-black text-slate-900 dark:text-white">{log.user_name}</span>
                                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">{moment(log.timestamp).format('MMM DD, YYYY · HH:mm:ss')}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <span className="inline-flex px-3 py-1 rounded-lg bg-indigo-500/5 text-indigo-500 border border-indigo-500/10 text-xs font-bold">
                                                                {log.action}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-6 max-w-[250px]">
                                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed italic line-clamp-2 hover:line-clamp-none transition-all cursor-help" title={log.details || ''}>
                                                                {log.details || '---'}
                                                            </p>
                                                        </td>
                                                        <td className="px-8 py-6 text-right">
                                                            <span className="text-xs font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-slate-200/50 dark:border-white/5">
                                                                {log.entity_name}
                                                            </span>
                                                        </td>
                                                        {isSuperAdmin && (
                                                            <td className="px-8 py-6 text-right">
                                                                <button
                                                                    onClick={() => setLogToDelete(log.id)}
                                                                    className="size-8 inline-flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                                                                    title="Delete Log"
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                                </button>
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {auditLogs.length === 0 && (
                                            <div className="p-12 text-center">
                                                <span className="material-symbols-outlined text-slate-200 dark:text-white/5 text-6xl">database_off</span>
                                                <p className="text-slate-500 dark:text-slate-400 font-bold mt-4 tracking-tight">No administrative trails found.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {
                isUserModalOpen && (
                    <UserCreateModal
                        onClose={() => setIsUserModalOpen(false)}
                        onSuccess={() => {
                            setIsUserModalOpen(false);
                            fetchUsers();
                        }}
                    />
                )
            }

            {/* Delete Single Log Modal */}
            {
                logToDelete && (
                    <ConfirmationModal
                        isOpen={!!logToDelete}
                        onClose={() => setLogToDelete(null)}
                        onConfirm={handleDeleteLog}
                        title="Delete Audit Log"
                        message="Are you sure you want to delete this audit log entry? This action cannot be undone."
                        isDanger={true}
                        isLoading={isDeleting}
                    />
                )
            }

            {/* Clear All Logs Modal */}
            {
                isClearLogsModalOpen && (
                    <ConfirmationModal
                        isOpen={isClearLogsModalOpen}
                        onClose={() => setIsClearLogsModalOpen(false)}
                        onConfirm={handleClearLogs}
                        title="Clear All Audit Logs"
                        message="Are you sure you want to delete ALL audit logs? This action is irreversible and will wipe the entire history."
                        isDanger={true}
                        isLoading={isDeleting}
                    />
                )
            }

        </div >
    );
};

function ModuleToggle({ label, description, isLocked, onToggle, icon }: { label: string, description: string, isLocked: boolean, onToggle: () => void, icon: string }) {
    return (
        <div className="group relative flex items-center justify-between p-6 rounded-[2rem] bg-slate-50/50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 hover:bg-white dark:hover:bg-white/[0.08] transition-all duration-300">
            <div className="flex items-center gap-5">
                <div className={`size-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${isLocked ? 'bg-rose-500/10 text-rose-500 rotate-12' : 'bg-emerald-500/10 text-emerald-500 group-hover:scale-110'}`}>
                    <span className="material-symbols-outlined text-3xl">{isLocked ? 'lock' : icon}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-lg font-black text-slate-900 dark:text-white leading-tight flex items-center gap-2">
                        {label}
                        {isLocked && <span className="text-[10px] bg-rose-500 text-white px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter">Locked</span>}
                    </span>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 max-w-[200px]">{description}</span>
                </div>
            </div>
            <button
                onClick={onToggle}
                className={`relative inline-flex h-9 w-16 items-center rounded-2xl transition-all focus:outline-none shadow-inner border ${isLocked ? 'bg-rose-500/20 border-rose-500/30' : 'bg-emerald-500/20 border-emerald-500/30'}`}
            >
                <div className={`absolute top-1 size-7 rounded-[0.6rem] bg-white shadow-lg transition-all duration-500 flex items-center justify-center ${isLocked ? 'left-1 rotate-[360deg]' : 'left-8'}`}>
                    <span className={`material-symbols-outlined text-lg ${isLocked ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {isLocked ? 'close' : 'check'}
                    </span>
                </div>
            </button>
        </div>
    );
}

function UserCreateModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
    const { showNotification } = useNotification();
    const [formData, setFormData] = useState<UserCreate>({
        email: '',
        full_name: '',
        role: 'user',
        is_active: true,
        password: '',
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await createUser(formData);
            showNotification('User created successfully', 'success');
            onSuccess();
        } catch (error: any) {
            showNotification(error.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}></div>
            <div className="relative bg-white dark:bg-[#1e293b] rounded-[3rem] shadow-2xl w-full max-w-lg border border-slate-200/50 dark:border-white/10 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
                <div className="absolute top-0 right-0 size-64 bg-emerald-500/5 blur-[80px] rounded-full -mr-32 -mt-32 pointer-events-none"></div>

                <div className="relative p-10 flex flex-col gap-8">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white">New Administrator</h2>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">Register a system access profile</p>
                        </div>
                        <button onClick={onClose} className="size-10 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all flex items-center justify-center active:scale-90">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <InputField
                            label="Full Legal Name"
                            icon="person"
                            placeholder="e.g. John Doe"
                            value={formData.full_name}
                            onChange={(v) => setFormData({ ...formData, full_name: v })}
                            required
                        />
                        <InputField
                            label="Email Address"
                            icon="mail"
                            type="email"
                            placeholder="admin@neco.gov.ng"
                            value={formData.email}
                            onChange={(v) => setFormData({ ...formData, email: v })}
                            required
                        />
                        <InputField
                            label="Initial Access Password"
                            icon="key"
                            type="password"
                            placeholder="Set complex password"
                            value={formData.password}
                            onChange={(v) => setFormData({ ...formData, password: v })}
                            required
                        />

                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Assign Permission Role</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, role: 'user' })}
                                    className={`p-4 rounded-2xl border transition-all text-left flex flex-col gap-1 ${formData.role === 'user' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-500' : 'bg-slate-50 dark:bg-white/5 border-slate-200/50 dark:border-white/5 text-slate-400'}`}
                                >
                                    <span className="text-xs font-black uppercase">Standard Admin</span>
                                    <span className="text-[9px] font-medium leading-tight opacity-70">Operate system modules</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, role: 'super_admin' })}
                                    className={`p-4 rounded-2xl border transition-all text-left flex flex-col gap-1 ${formData.role === 'super_admin' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-500' : 'bg-slate-50 dark:bg-white/5 border-slate-200/50 dark:border-white/5 text-slate-400'}`}
                                >
                                    <span className="text-xs font-black uppercase">Super Admin</span>
                                    <span className="text-[9px] font-medium leading-tight opacity-70">Full system control</span>
                                </button>
                            </div>
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-6 py-4 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-500 font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="flex-[1.5] px-6 py-4 bg-slate-900 dark:bg-emerald-600 text-white rounded-2xl font-black text-sm hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSaving ? <span className="material-symbols-outlined animate-spin">refresh</span> : <span className="material-symbols-outlined">how_to_reg</span>}
                                Complete Registration
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    isDanger = false,
    isLoading = false
}: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    isDanger?: boolean;
    isLoading?: boolean;
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
                <div className="p-8 flex flex-col items-center text-center">
                    <div className={`size-16 rounded-2xl flex items-center justify-center mb-6 ${isDanger ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-100 dark:bg-white/5 text-slate-500'}`}>
                        <span className="material-symbols-outlined text-3xl">
                            {isDanger ? 'warning' : 'help'}
                        </span>
                    </div>

                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                        {title}
                    </h3>

                    <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        {message}
                    </p>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-white/5 flex gap-4">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 py-3.5 px-6 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 hover:shadow-md transition-all disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 py-3.5 px-6 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2 ${isDanger
                            ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/25'
                            : 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/25'
                            }`}
                    >
                        {isLoading && <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>}
                        {isDanger ? 'Delete' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function InputField({ label, value, onChange, type = 'text', placeholder, required = false, icon }: { label: string, value: string, onChange: (v: string) => void, type?: string, placeholder?: string, required?: boolean, icon: string }) {
    return (
        <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
            <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 group-focus-within:text-indigo-500 transition-colors">{icon}</span>
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    required={required}
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white text-sm font-bold focus:bg-white dark:focus:bg-white/10 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none"
                />
            </div>
        </div>
    );
}


export default Configuration;
