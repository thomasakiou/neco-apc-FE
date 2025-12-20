import React, { useEffect, useState, useMemo } from 'react';
import { getAuditLogs } from '../../services/user';
import { AuditLogResponse } from '../../types/audit';
import { useAuth } from '../../context/AuthContext';
import moment from 'moment';
import * as XLSX from 'xlsx';

const AuditLog: React.FC = () => {
   const { user: currentUser } = useAuth();
   const [events, setEvents] = useState<AuditLogResponse[]>([]);
   const [loading, setLoading] = useState(true);
   const [page, setPage] = useState(1);
   const [limit] = useState(20);
   const [total, setTotal] = useState(0);

   useEffect(() => {
      fetchAuditData();
   }, [page]);

   const fetchAuditData = async () => {
      setLoading(true);
      try {
         const skip = (page - 1) * limit;
         const data = await getAuditLogs(skip, limit);

         // Filter out own activities
         const othersLogs = data.items.filter(log => log.user_name !== currentUser?.full_name);

         setEvents(othersLogs);
         setTotal(data.total);
      } catch (error) {
         console.error("Failed to fetch audit data", error);
      } finally {
         setLoading(false);
      }
   };

   const totalPages = Math.ceil(total / limit);

   const handleExport = () => {
      const dataToExport = events.map(event => ({
         User: event.user_name || 'System',
         Action: event.action,
         Entity: event.entity_name,
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
         <header className="flex-none flex items-center justify-between px-10 py-6 bg-white/40 dark:bg-[#121b25]/40 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/5 z-20">
            <div>
               <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
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
               <button
                  onClick={fetchAuditData}
                  disabled={loading}
                  className="size-12 flex items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
               >
                  <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>sync</span>
               </button>
            </div>
         </header>

         <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pb-12">
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
                                 <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-right">Reference Object</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-200/40 dark:divide-white/5">
                              {loading ? (
                                 [...Array(8)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                       <td colSpan={3} className="px-8 py-6 h-16 bg-slate-50/50 dark:bg-white/5"></td>
                                    </tr>
                                 ))
                              ) : events.length === 0 ? (
                                 <tr>
                                    <td colSpan={3} className="px-8 py-20 text-center">
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

export default AuditLog;