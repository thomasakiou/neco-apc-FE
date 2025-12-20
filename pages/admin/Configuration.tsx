import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { listUsers, createUser, getAuditLogs } from '../../services/user';
import { changePassword } from '../../services/auth';
import { UserResponse, UserCreate, UserRole } from '../../types/auth';
import { AuditLogResponse } from '../../types/audit';
import moment from 'moment';

const Configuration: React.FC = () => {
    const { isSuperAdmin, moduleLocks, toggleModuleLock, user: currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [activeTab, setActiveTab] = useState<'users' | 'modules' | 'audit'>('users');
    const [users, setUsers] = useState<UserResponse[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLogResponse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

    // Filtered users: exclude the Super User (current user if they are the only super admin, or by role)
    // The requirement says "view audit log for all users except the Super User"
    // I will assume "Super User" means the current super admin or a specific account.
    // For now, I'll list all users but maybe visually distinguish the Super Admin.

    useEffect(() => {
        if (activeTab === 'users') fetchUsers();
        if (activeTab === 'audit') fetchLogs();
    }, [activeTab]);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const data = await listUsers();
            // Filter out Super Admin 1 as requested
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
            // Filter out logs from the current Super User if required
            const filteredLogs = data.items.filter(log => log.user_name !== currentUser?.full_name);
            setAuditLogs(filteredLogs);
        } catch (error: any) {
            showNotification(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleLock = (moduleName: string) => {
        toggleModuleLock(moduleName);
        showNotification(`${moduleName.toUpperCase()} module ${moduleLocks[moduleName] ? 'unlocked' : 'locked'} successfully`, 'success');
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
            {/* Premium Header */}
            <header className="flex-none flex items-center justify-between px-10 py-5 bg-white/40 dark:bg-[#121b25]/40 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/5 z-20">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        System <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">Configuration</span>
                    </h1>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mt-0.5 opacity-70">NECO APCIC Administration Hub</p>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex bg-slate-100/50 dark:bg-white/5 p-1 rounded-2xl border border-slate-200/50 dark:border-white/5 shadow-inner">
                        <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} label="Users" icon="group" />
                        <TabButton active={activeTab === 'modules'} onClick={() => setActiveTab('modules')} label="Modules" icon="lock_open" />
                        <TabButton active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} label="Audit" icon="history" />
                    </div>

                    <div className="h-8 w-[1px] bg-slate-200 dark:bg-white/10"></div>

                    <div
                        onClick={() => setIsPasswordModalOpen(true)}
                        className="flex items-center gap-3 bg-white dark:bg-white/5 p-1.5 pr-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm cursor-pointer hover:border-teal-500/50 transition-all group/profile"
                    >
                        <div className="size-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-indigo-500/20 group-hover/profile:scale-110 transition-transform">
                            {currentUser?.full_name.charAt(0) || 'U'}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-900 dark:text-white leading-none">{currentUser?.full_name || 'User'}</span>
                            <span className="text-[10px] font-bold text-indigo-500 uppercase leading-none mt-1">Change Password</span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pb-12">
                <div className="max-w-[1400px] mx-auto">
                    <div className="bg-white/70 dark:bg-[#121b25]/60 dark:backdrop-blur-md rounded-[2.5rem] border border-slate-200/50 dark:border-white/5 p-8 shadow-xl shadow-slate-200/20 dark:shadow-none min-h-[600px] transition-all relative overflow-hidden">
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
                                        <button
                                            onClick={() => setIsUserModalOpen(true)}
                                            className="group flex items-center gap-3 px-6 py-3 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl hover:shadow-xl hover:shadow-emerald-500/20 transition-all font-black text-sm active:scale-95"
                                        >
                                            <span className="material-symbols-outlined text-xl group-hover:rotate-90 transition-transform">add_circle</span>
                                            Register New User
                                        </button>
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
                                                                <button
                                                                    onClick={() => {
                                                                        if (currentUser?.id === u.id) {
                                                                            setIsPasswordModalOpen(true);
                                                                        } else if (window.confirm(`Are you sure you want to reset password for ${u.full_name}?`)) {
                                                                            showNotification('Advanced user management required for remote reset', 'info');
                                                                        }
                                                                    }}
                                                                    className="size-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all shadow-sm active:scale-90"
                                                                    title={currentUser?.id === u.id ? "Change My Password" : "Reset Password"}
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">{currentUser?.id === u.id ? 'password' : 'lock_reset'}</span>
                                                                </button>
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
                                            label="APC Module"
                                            description="Lock/Unlock access to Generate APC, Posting Modes, and APC List."
                                            isLocked={moduleLocks['apc']}
                                            onToggle={() => handleToggleLock('apc')}
                                            icon="assignment_ind"
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
                                            description="Lock/Unlock access to Board and Random Post Generator."
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
                                </div>
                            )}

                            {activeTab === 'audit' && (
                                <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex justify-between items-center bg-slate-50/50 dark:bg-white/5 p-6 rounded-3xl border border-slate-200/50 dark:border-white/5 shadow-inner">
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">System Audit Log</h2>
                                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">Tracking administrative operations (Excluding self)</p>
                                        </div>
                                        <button
                                            onClick={fetchLogs}
                                            disabled={isLoading}
                                            className="size-12 flex items-center justify-center rounded-2xl bg-white dark:bg-white/10 text-slate-600 dark:text-white border border-slate-200/60 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/20 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            <span className={`material-symbols-outlined ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
                                        </button>
                                    </div>

                                    <div className="overflow-hidden rounded-[2rem] border border-slate-200/60 dark:border-white/10 bg-white/30 dark:bg-white/5 backdrop-blur-sm shadow-inner">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-100/50 dark:bg-white/5 border-b border-slate-200/60 dark:border-white/10">
                                                    <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Timestamp / Identity</th>
                                                    <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Operation performed</th>
                                                    <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-right">Target Entity</th>
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
                                                        <td className="px-8 py-6 text-right">
                                                            <span className="text-xs font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-slate-200/50 dark:border-white/5">
                                                                {log.entity_name}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {auditLogs.length === 0 && (
                                            <div className="p-12 text-center">
                                                <span className="material-symbols-outlined text-slate-200 dark:text-white/5 text-6xl">database_off</span>
                                                <p className="text-slate-500 dark:text-slate-400 font-bold mt-4 tracking-tight">No audit logs discovered for others.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isUserModalOpen && (
                <UserCreateModal
                    onClose={() => setIsUserModalOpen(false)}
                    onSuccess={() => {
                        setIsUserModalOpen(false);
                        fetchUsers();
                    }}
                />
            )}

            {isPasswordModalOpen && (
                <PasswordChangeModal
                    onClose={() => setIsPasswordModalOpen(false)}
                />
            )}
        </div>
    );
};

// --- Sub-Components ---

const TabButton = ({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: string }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2.5 py-2.5 px-6 rounded-xl transition-all font-black text-xs uppercase tracking-widest ${active ? 'bg-white dark:bg-[#1e293b] text-teal-600 dark:text-teal-400 shadow-md scale-[1.02]' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
    >
        <span className="material-symbols-outlined text-lg">{icon}</span>
        {label}
    </button>
);

const ModuleToggle = ({ label, description, isLocked, onToggle, icon }: { label: string, description: string, isLocked: boolean, onToggle: () => void, icon: string }) => (
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

const UserCreateModal = ({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) => {
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
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Access Provision</h3>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Register administrative credential</p>
                        </div>
                        <button onClick={onClose} className="size-12 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:bg-rose-500 hover:text-white transition-all active:scale-95">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <InputField label="Full Operational Name" value={formData.full_name} onChange={v => setFormData({ ...formData, full_name: v })} placeholder="e.g. John Doe" required icon="badge" />
                        <InputField label="Email Authorization" type="email" value={formData.email} onChange={v => setFormData({ ...formData, email: v })} placeholder="john@neco.gov.ng" required icon="alternate_email" />
                        <InputField label="Secure Password" type="password" value={formData.password || ''} onChange={v => setFormData({ ...formData, password: v })} placeholder="••••••••" required icon="key" />

                        <div className="grid grid-cols-2 gap-6">
                            <div className="flex flex-col gap-2.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Security Role</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                                    className="w-full h-14 bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 rounded-[1.25rem] px-5 text-sm font-bold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none dark:text-white transition-all"
                                >
                                    <option value="user">Standard User</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-2.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Initial Status</label>
                                <div
                                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                    className={`h-14 flex items-center gap-3 px-5 rounded-[1.25rem] border cursor-pointer transition-all ${formData.is_active ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/5 border-rose-500/20 text-rose-500'}`}
                                >
                                    <span className="material-symbols-outlined text-xl">{formData.is_active ? 'check_circle' : 'cancel'}</span>
                                    <span className="text-xs font-black uppercase tracking-wider">{formData.is_active ? 'Active' : 'Inactive'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-4">
                            <button type="button" onClick={onClose} className="flex-1 py-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition-all active:scale-95">Discard</button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="flex-[1.5] py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-xs uppercase tracking-[0.2em] hover:shadow-2xl hover:shadow-emerald-500/40 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? 'Synchronizing...' : 'Authorize Provision'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

const InputField = ({ label, value, onChange, type = 'text', placeholder, required = false, icon }: { label: string, value: string, onChange: (v: string) => void, type?: string, placeholder?: string, required?: boolean, icon: string }) => (
    <div className="flex flex-col gap-2.5 group">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1 group-focus-within:text-teal-500 transition-colors">{label}</label>
        <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-300 dark:text-white/20 group-focus-within:text-teal-500 transition-colors">{icon}</span>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                required={required}
                className="w-full h-14 bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 rounded-[1.25rem] pl-14 pr-6 text-sm font-bold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none dark:text-white transition-all placeholder:text-slate-300 dark:placeholder:text-white/10"
            />
        </div>
    </div>
);

const PasswordChangeModal = ({ onClose }: { onClose: () => void }) => {
    const { showNotification } = useNotification();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            showNotification('New passwords do not match', 'error');
            return;
        }
        if (newPassword.length < 8) {
            showNotification('Password must be at least 8 characters long', 'error');
            return;
        }

        setIsSaving(true);
        try {
            await changePassword(currentPassword, newPassword);
            showNotification('Password changed successfully', 'success');
            onClose();
        } catch (error: any) {
            showNotification(error.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}></div>
            <div className="relative bg-white dark:bg-[#1e293b] rounded-[3rem] shadow-2xl w-full max-w-lg border border-slate-200/50 dark:border-white/10 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
                <div className="absolute top-0 right-0 size-64 bg-indigo-500/5 blur-[80px] rounded-full -mr-32 -mt-32 pointer-events-none"></div>

                <div className="relative p-10 flex flex-col gap-8">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Modify Credentials</h3>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Update security key</p>
                        </div>
                        <button onClick={onClose} className="size-12 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:bg-rose-500 hover:text-white transition-all active:scale-95">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <InputField label="Current Security Key" type="password" value={currentPassword} onChange={setCurrentPassword} placeholder="••••••••" required icon="lock" />
                        <InputField label="New Security Key" type="password" value={newPassword} onChange={setNewPassword} placeholder="••••••••" required icon="key" />
                        <InputField label="Confirm New Key" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="••••••••" required icon="key_visualizer" />

                        <div className="flex gap-4 mt-4">
                            <button type="button" onClick={onClose} className="flex-1 py-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition-all active:scale-95">Cancel</button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="flex-[1.5] py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black text-xs uppercase tracking-[0.2em] hover:shadow-2xl hover:shadow-indigo-500/40 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? 'Updating...' : 'Save New Key'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Configuration;
