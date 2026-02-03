
import React, { useEffect, useState } from 'react';
import { getStaffLoginLogs, clearStaffLoginLogs } from '../../services/audit';
import { AuditLogResponse } from '../../types/audit';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import moment from 'moment';
import * as XLSX from 'xlsx';

const StaffLoginLogs: React.FC = () => {
    const { isSuperAdmin } = useAuth();
    const { showNotification } = useNotification();
    const [events, setEvents] = useState<AuditLogResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [total, setTotal] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');

    const [isClearLogsModalOpen, setIsClearLogsModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        fetchAuditData();
    }, [page, limit]);

    const fetchAuditData = async () => {
        setLoading(true);
        try {
            const skip = (page - 1) * limit;
            const data = await getStaffLoginLogs(skip, limit, searchTerm);

            if (data && data.items) {
                setEvents(data.items);
                setTotal(data.total);
            }
        } catch (error) {
            console.error("Failed to fetch staff login logs", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchAuditData();
    };

    const totalPages = Math.ceil(total / limit);

    const handleClearLogs = async () => {
        setIsDeleting(true);
        try {
            await clearStaffLoginLogs();
            showNotification('All staff login logs cleared', 'success');
            fetchAuditData();
            setIsClearLogsModalOpen(false);
        } catch (error) {
            showNotification('Failed to clear logs', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleExport = () => {
        const dataToExport = events.map(event => ({
            User: event.user_name || 'Staff',
            Action: event.action,
            Entity: event.entity_name,
            Details: event.details || '',
            Timestamp: moment(event.timestamp).format('YYYY-MM-DD HH:mm:ss')
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Staff Login Logs");
        XLSX.writeFile(wb, "staff_login_logs.xlsx");
    };

    return (
        <div className="flex flex-col h-full w-full bg-background-light dark:bg-[#0b1015] transition-colors duration-200 overflow-hidden">
            <header className="flex-none flex items-center justify-between px-4 md:px-10 py-4 md:py-6 bg-surface-light/40 dark:bg-[#121b25]/40 backdrop-blur-xl border-b border-slate-300 dark:border-white/5 z-20">
                <div>
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 to-teal-800 dark:from-emerald-400 dark:to-teal-500 tracking-tight">
                        Staff Login Logs
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] opacity-70">Monitor Staff Access</p>
                        <span className="text-xs font-black text-slate-300 dark:text-slate-600">•</span>
                        <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">{total.toLocaleString()} Records</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <form onSubmit={handleSearch} className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="material-symbols-outlined text-slate-400 group-focus-within:text-emerald-500 transition-colors">search</span>
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by name or file no..."
                            className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm rounded-xl focus:ring-emerald-500 focus:border-emerald-500 block w-full pl-10 p-2.5 transition-all w-64 shadow-sm"
                        />
                    </form>

                    <button
                        onClick={handleExport}
                        className="group flex items-center gap-3 px-6 py-3 bg-white dark:bg-white/5 text-slate-900 dark:text-white rounded-2xl border border-slate-200 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all font-black text-sm shadow-sm"
                    >
                        <span className="material-symbols-outlined text-xl group-hover:translate-y-0.5 transition-transform text-emerald-500">download_for_offline</span>
                        Export
                    </button>

                    {isSuperAdmin && (
                        <button
                            onClick={() => setIsClearLogsModalOpen(true)}
                            disabled={loading || events.length === 0}
                            className="group flex items-center justify-center size-12 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20 hover:bg-rose-500/20 transition-all font-black text-sm active:scale-95 disabled:opacity-50"
                            title="Clear All Logs"
                        >
                            <span className="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">delete_sweep</span>
                        </button>
                    )}

                    <button
                        onClick={fetchAuditData}
                        disabled={loading}
                        className="size-12 flex items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                    >
                        <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>sync</span>
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 pb-12">
                <div className="max-w-[1400px] mx-auto flex flex-col gap-8">
                    <div className="bg-surface-light/70 dark:bg-[#121b25]/60 dark:backdrop-blur-md rounded-[2.5rem] border border-slate-200/50 dark:border-white/5 p-8 shadow-xl shadow-slate-200/20 dark:shadow-none min-h-[500px] relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="absolute top-0 right-0 size-96 bg-indigo-500/5 blur-[100px] rounded-full -mr-48 -mt-48 pointer-events-none"></div>

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="overflow-hidden rounded-[2rem] border border-slate-200/60 dark:border-white/10 bg-surface-light/30 dark:bg-white/5 backdrop-blur-sm shadow-inner flex-1">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100/50 dark:bg-white/5 border-b border-slate-300 dark:border-white/10">
                                            <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Staff Member</th>
                                            <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Action</th>
                                            <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Details</th>
                                            <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-right">Entity</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-300 dark:divide-white/5">
                                        {loading ? (
                                            [...Array(limit)].map((_, i) => (
                                                <tr key={i} className="animate-pulse">
                                                    <td colSpan={4} className="px-8 py-6 h-16 bg-slate-50/50 dark:bg-white/5"></td>
                                                </tr>
                                            ))
                                        ) : events.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-8 py-20 text-center">
                                                    <span className="material-symbols-outlined text-6xl text-slate-200 dark:text-white/5">layers_clear</span>
                                                    <p className="mt-4 text-slate-400 font-bold uppercase tracking-widest text-xs">No login records found</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            events.map(event => (
                                                <tr key={event.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all">
                                                    <td className="px-8 py-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className="size-10 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 dark:text-white/20">
                                                                <span className="material-symbols-outlined text-xl">person</span>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-black text-slate-900 dark:text-white">{event.user_name || 'Staff Member'}</span>
                                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-tighter">
                                                                    {moment(event.timestamp).format('MMM DD, YYYY · HH:mm:ss')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <span className="inline-flex px-3 py-1.5 rounded-xl bg-indigo-500/5 text-indigo-500 dark:text-indigo-400 border border-indigo-500/10 text-[11px] font-black uppercase tracking-wider">
                                                            {event.action}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-6 max-w-[500px]">
                                                        <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold leading-relaxed line-clamp-2 hover:line-clamp-none transition-all cursor-help" title={event.details || ''}>
                                                            {event.details || '---'}
                                                        </p>
                                                    </td>
                                                    <td className="px-8 py-6 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-xs font-black text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-slate-200/50 dark:border-white/5">
                                                                {event.entity_name}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {!loading && total > 0 && (
                                <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
                                    <div className="flex items-center gap-4">
                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden sm:block">
                                            Page <span className="text-slate-900 dark:text-white">{page}</span> of {totalPages}
                                        </p>

                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Rows:</span>
                                            <select
                                                value={limit}
                                                onChange={(e) => {
                                                    setLimit(Number(e.target.value));
                                                    setPage(1);
                                                }}
                                                className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-1.5 font-bold"
                                            >
                                                <option value={10}>10</option>
                                                <option value={20}>20</option>
                                                <option value={50}>50</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <PaginationButton
                                            icon="first_page"
                                            disabled={page === 1}
                                            onClick={() => setPage(1)}
                                        />
                                        <PaginationButton
                                            icon="chevron_left"
                                            disabled={page === 1}
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                        />

                                        <div className="flex items-center gap-1 mx-2">
                                            <span className="text-sm font-bold text-slate-700 dark:text-white">{page}</span>
                                        </div>

                                        <PaginationButton
                                            icon="chevron_right"
                                            disabled={page === totalPages}
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        />
                                        <PaginationButton
                                            icon="last_page"
                                            disabled={page === totalPages}
                                            onClick={() => setPage(totalPages)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isClearLogsModalOpen && (
                <ConfirmationModal
                    isOpen={isClearLogsModalOpen}
                    onClose={() => setIsClearLogsModalOpen(false)}
                    onConfirm={handleClearLogs}
                    title="Clear All Staff Login Logs"
                    message="Are you sure you want to delete ALL staff login logs? This action is irreversible."
                    isDanger={true}
                    isLoading={isDeleting}
                />
            )}
        </div>
    );
};

const PaginationButton = ({ icon, disabled, onClick }: { icon: string, disabled: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
    >
        <span className="material-symbols-outlined text-xl">{icon}</span>
    </button>
);

const ConfirmationModal = ({
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
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface-light dark:bg-[#1e293b] rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-white/10">
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
};

export default StaffLoginLogs;
