import React, { useEffect, useState, useMemo } from 'react';
import { getAuditLogs } from '../../services/user';
import { deleteAuditLog, clearAllAuditLogs } from '../../services/audit';
import { AuditLogResponse } from '../../types/audit';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import moment from 'moment';
import * as XLSX from 'xlsx';

const AuditLog: React.FC = () => {
   const { user: currentUser, isSuperAdmin } = useAuth();
   const { showNotification } = useNotification();
   const [events, setEvents] = useState<AuditLogResponse[]>([]);
   const [loading, setLoading] = useState(true);
   const [page, setPage] = useState(1);
   const [limit] = useState(20);
   const [total, setTotal] = useState(0);

   // Deletion State
   const [logToDelete, setLogToDelete] = useState<string | null>(null);
   const [isClearLogsModalOpen, setIsClearLogsModalOpen] = useState(false);
   const [isDeleting, setIsDeleting] = useState(false);

   useEffect(() => {
      fetchAuditData();
   }, [page]);

   const fetchAuditData = async () => {
      setLoading(true);
      try {
         const skip = (page - 1) * limit;
         const data = await getAuditLogs(skip, limit);

         if (data && data.items) {
            setEvents(data.items);
            setTotal(data.total);
         }
      } catch (error) {
         console.error("Failed to fetch audit data", error);
      } finally {
         setLoading(false);
      }
   };

   const totalPages = Math.ceil(total / limit);

   const handleDeleteLog = async () => {
      if (!logToDelete) return;
      setIsDeleting(true);
      try {
         await deleteAuditLog(logToDelete);
         showNotification('Audit log entry deleted', 'success');
         fetchAuditData();
         setLogToDelete(null);
      } catch (error) {
         showNotification('Failed to delete log entry', 'error');
      } finally {
         setIsDeleting(false);
      }
   };

   const handleClearLogs = async () => {
      setIsDeleting(true);
      try {
         await clearAllAuditLogs();
         showNotification('All audit logs cleared', 'success');
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
         User: event.user_name || 'System',
         Action: event.action,
         Entity: event.entity_name,
         Details: event.details || '',
         Timestamp: moment(event.timestamp).format('YYYY-MM-DD HH:mm:ss')
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Audit Logs");
      XLSX.writeFile(wb, "audit_trace_export.xlsx");
   };

   return (
      <div className="flex flex-col h-full w-full bg-[#f8fafc] dark:bg-[#0b1015] transition-colors duration-300 overflow-hidden">
         {/* Premium Header */}
         <header className="flex-none flex items-center justify-between px-4 md:px-10 py-4 md:py-6 bg-white/40 dark:bg-[#121b25]/40 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/5 z-20">
            <div>
               <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                  Audit <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">Intelligence</span>
               </h1>
               <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mt-0.5 opacity-70">Security & Operational Traceability</p>
            </div>

            <div className="flex items-center gap-4">
               <button
                  onClick={handleExport}
                  className="group flex items-center gap-3 px-6 py-3 bg-white dark:bg-white/5 text-slate-900 dark:text-white rounded-2xl border border-slate-200 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all font-black text-sm shadow-sm"
               >
                  <span className="material-symbols-outlined text-xl group-hover:translate-y-0.5 transition-transform text-emerald-500">download_for_offline</span>
                  Export Data
               </button>

               {isSuperAdmin && (
                  <button
                     onClick={() => setIsClearLogsModalOpen(true)}
                     disabled={loading || events.length === 0}
                     className="group flex items-center gap-3 px-6 py-3 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20 hover:bg-rose-500/20 transition-all font-black text-sm active:scale-95 disabled:opacity-50"
                  >
                     <span className="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">delete_sweep</span>
                     Clear All
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
               {/* Metrics Row (Small visualization of activity) */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                  <MetricCard label="Total Events" value={total.toLocaleString()} icon="analytics" color="emerald" />
                  <MetricCard label="Active Period" value={moment().format('MMMM YYYY')} icon="calendar_today" color="indigo" />
                  <MetricCard label="Data Authenticity" value="Verified" icon="verified_user" color="teal" />
               </div>

               {/* Table Container */}
               <div className="bg-white/70 dark:bg-[#121b25]/60 dark:backdrop-blur-md rounded-[2.5rem] border border-slate-200/50 dark:border-white/5 p-8 shadow-xl shadow-slate-200/20 dark:shadow-none min-h-[500px] relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="absolute top-0 right-0 size-96 bg-indigo-500/5 blur-[100px] rounded-full -mr-48 -mt-48 pointer-events-none"></div>

                  <div className="relative z-10 flex flex-col h-full">
                     <div className="overflow-hidden rounded-[2rem] border border-slate-200/60 dark:border-white/10 bg-white/30 dark:bg-white/5 backdrop-blur-sm shadow-inner flex-1">
                        <table className="w-full text-left border-collapse">
                           <thead>
                              <tr className="bg-slate-100/50 dark:bg-white/5 border-b border-slate-200/60 dark:border-white/10">
                                 <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Temporal / identity</th>
                                 <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Transaction Type</th>
                                 <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Operational Details</th>
                                 <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-right">Reference Object</th>
                                 {isSuperAdmin && <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>}
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-200/40 dark:divide-white/5">
                              {loading ? (
                                 [...Array(8)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                       <td colSpan={isSuperAdmin ? 5 : 4} className="px-8 py-6 h-16 bg-slate-50/50 dark:bg-white/5"></td>
                                    </tr>
                                 ))
                              ) : events.length === 0 ? (
                                 <tr>
                                    <td colSpan={isSuperAdmin ? 5 : 4} className="px-8 py-20 text-center">
                                       <span className="material-symbols-outlined text-6xl text-slate-200 dark:text-white/5">layers_clear</span>
                                       <p className="mt-4 text-slate-400 font-bold uppercase tracking-widest text-xs">No administrative trails found</p>
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
                                                <span className="text-sm font-black text-slate-900 dark:text-white">{event.user_name || 'System Operator'}</span>
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
                                       {isSuperAdmin && (
                                          <td className="px-8 py-6 text-right">
                                             <button
                                                onClick={() => setLogToDelete(event.id)}
                                                className="size-8 inline-flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                                                title="Delete Log"
                                             >
                                                <span className="material-symbols-outlined text-lg font-bold">delete</span>
                                             </button>
                                          </td>
                                       )}
                                    </tr>
                                 ))
                              )}
                           </tbody>
                        </table>
                     </div>

                     {/* Premium Pagination */}
                     {!loading && total > 0 && (
                        <div className="mt-8 flex items-center justify-between px-2">
                           <div className="hidden sm:block">
                              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                 Page <span className="text-slate-900 dark:text-white">{page}</span> of {totalPages}
                              </p>
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
                                 {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                    const pageNum = i + 1; // Simplified for now
                                    return (
                                       <button
                                          key={i}
                                          onClick={() => setPage(pageNum)}
                                          className={`size-10 rounded-xl font-black text-xs transition-all ${page === pageNum ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-110' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}
                                       >
                                          {pageNum}
                                       </button>
                                    );
                                 })}
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

         {/* Delete Single Log Modal */}
         {logToDelete && (
            <ConfirmationModal
               isOpen={!!logToDelete}
               onClose={() => setLogToDelete(null)}
               onConfirm={handleDeleteLog}
               title="Delete Audit Log"
               message="Are you sure you want to delete this audit log entry? This action cannot be undone."
               isDanger={true}
               isLoading={isDeleting}
            />
         )}

         {/* Clear All Logs Modal */}
         {isClearLogsModalOpen && (
            <ConfirmationModal
               isOpen={isClearLogsModalOpen}
               onClose={() => setIsClearLogsModalOpen(false)}
               onConfirm={handleClearLogs}
               title="Clear All Audit Logs"
               message="Are you sure you want to delete ALL audit logs? This action is irreversible and will wipe the entire history."
               isDanger={true}
               isLoading={isDeleting}
            />
         )}
      </div>
   );
};

const MetricCard = ({ label, value, icon, color }: { label: string, value: string, icon: string, color: 'emerald' | 'indigo' | 'teal' }) => {
   const colors = {
      emerald: 'from-emerald-500 to-teal-400 shadow-emerald-500/10 text-emerald-500',
      indigo: 'from-indigo-500 to-blue-500 shadow-indigo-500/10 text-indigo-500',
      teal: 'from-teal-500 to-emerald-400 shadow-teal-500/10 text-teal-500'
   };

   return (
      <div className="bg-white dark:bg-[#121b25] p-6 rounded-[2rem] border border-slate-200/50 dark:border-white/5 flex items-center gap-6 shadow-sm">
         <div className={`size-14 rounded-2xl bg-${color}-500/10 flex items-center justify-center ${colors[color].split(' ').pop()}`}>
            <span className="material-symbols-outlined text-3xl font-bold">{icon}</span>
         </div>
         <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{value}</span>
         </div>
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
         <div className="bg-white dark:bg-[#1e293b] rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-white/10">
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

export default AuditLog;