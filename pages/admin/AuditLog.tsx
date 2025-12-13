import React, { useEffect, useState, useMemo } from 'react';
import { getAllStaff } from '../../services/staff';
import { getAllAssignments } from '../../services/assignment';
import { getAllMandates } from '../../services/mandate';
import { getAllStations } from '../../services/station';
import { getAllStates } from '../../services/state';
import { getAllSchools } from '../../services/school';
import { getAllMarkingVenues } from '../../services/markingVenue';
import { getAllCustodians } from '../../services/custodian';
import moment from 'moment';
import * as XLSX from 'xlsx';

interface AuditEvent {
   id: string;
   user: string;
   action: string; // "Created" | "Updated"
   module: string;
   entity: string;
   timestamp: string; // ISO string
   originalDate: Date;
}

const AuditLog: React.FC = () => {
   const [events, setEvents] = useState<AuditEvent[]>([]);
   const [loading, setLoading] = useState(true);
   const [searchTerm, setSearchTerm] = useState('');
   const [page, setPage] = useState(1);
   const [limit] = useState(10);
   const [clearTimestamp, setClearTimestamp] = useState<number>(0);

   useEffect(() => {
      const stored = localStorage.getItem('audit_clear_timestamp');
      if (stored) {
         setClearTimestamp(parseInt(stored, 10));
      }
      fetchAuditData();
   }, []);

   const fetchAuditData = async () => {
      setLoading(true);
      try {
         const [
            staff,
            assignments,
            mandates,
            stations,
            states,
            schools,
            venues,
            custodians
         ] = await Promise.all([
            getAllStaff(),
            getAllAssignments(),
            getAllMandates(),
            getAllStations(),
            getAllStates(),
            getAllSchools(),
            getAllMarkingVenues(),
            getAllCustodians()
         ]);

         const allEvents: AuditEvent[] = [];

         const processEntity = (list: any[], moduleName: string, nameField: string, codeField?: string) => {
            list.forEach(item => {
               const entityName = codeField ? `${item[nameField]} (${item[codeField]})` : item[nameField];

               if (item.created_at) {
                  allEvents.push({
                     id: `create-${item.id}`,
                     user: item.created_by || 'System Admin',
                     action: `Created new ${moduleName}`,
                     module: moduleName,
                     entity: entityName,
                     timestamp: item.created_at,
                     originalDate: new Date(item.created_at)
                  });
               }

               if (item.updated_at && item.updated_at !== item.created_at) {
                  allEvents.push({
                     id: `update-${item.id}`,
                     user: item.updated_by || 'System Admin',
                     action: `Updated ${moduleName}`,
                     module: moduleName,
                     entity: entityName,
                     timestamp: item.updated_at,
                     originalDate: new Date(item.updated_at)
                  });
               }
            });
         };

         processEntity(staff, 'Staff', 'full_name', 'fileno');
         processEntity(assignments, 'Assignment', 'assignment', 'code');
         processEntity(mandates, 'Mandate', 'mandate', 'code');
         processEntity(stations, 'Station', 'station', 'station_code');
         processEntity(states, 'State', 'name', 'state_code');
         processEntity(schools, 'School', 'name', 'code');
         processEntity(venues, 'Marking Venue', 'name', 'code');
         processEntity(custodians, 'Custodian', 'name', 'code');

         // Sort by timestamp desc
         allEvents.sort((a, b) => b.originalDate.getTime() - a.originalDate.getTime());

         setEvents(allEvents);
      } catch (error) {
         console.error("Failed to fetch audit data", error);
      } finally {
         setLoading(false);
      }
   };

   const filteredEvents = useMemo(() => {
      return events.filter(event => {
         const matchesSearch =
            event.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
            event.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            event.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
            event.entity.toLowerCase().includes(searchTerm.toLowerCase());

         const isRecent = clearTimestamp === 0 || event.originalDate.getTime() > clearTimestamp;

         return matchesSearch && isRecent;
      });
   }, [events, searchTerm, clearTimestamp]);

   const totalPages = Math.ceil(filteredEvents.length / limit);
   const paginatedEvents = filteredEvents.slice((page - 1) * limit, page * limit);

   const handleExport = () => {
      const dataToExport = filteredEvents.map(event => ({
         User: event.user,
         Action: event.action,
         Module: event.module,
         Entity: event.entity,
         Timestamp: moment(event.timestamp).format('YYYY-MM-DD HH:mm:ss')
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Audit Logs");
      XLSX.writeFile(wb, "audit_logs.xlsx");
   };

   const handleClearHistory = () => {
      if (window.confirm('Are you sure you want to clear the audit history? This will hide all current logs from your view.')) {
         const now = Date.now();
         localStorage.setItem('audit_clear_timestamp', now.toString());
         setClearTimestamp(now);
         setPage(1);
      }
   };

   return (
      <div className="p-8 max-w-[1600px] mx-auto flex flex-col gap-6 bg-slate-50 dark:bg-[#101922] min-h-screen transition-colors duration-200">
         <div className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-gray-800">
            <div className="flex flex-col gap-2">
               <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 via-teal-800 to-emerald-700 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-500 tracking-tight">
                  Logging & Audit Trail
               </h1>
               <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">View and manage system activity logs.</p>
            </div>
            <div className="flex flex-wrap gap-3">
               <button
                  onClick={handleClearHistory}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-red-600 dark:text-rose-400 bg-red-50 dark:bg-rose-900/30 hover:bg-red-100 dark:hover:bg-rose-900/50 border border-red-200 dark:border-rose-800 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
               >
                  <span className="material-symbols-outlined text-lg">delete_sweep</span>
                  Clear History
               </button>
               <button onClick={handleExport} className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                  <span className="material-symbols-outlined text-lg">download</span>
                  Export
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
               <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400">search</span>
               <input
                  className="form-input w-full pl-10 h-10 rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-slate-900 dark:text-slate-200 focus:ring-primary focus:border-primary text-sm"
                  placeholder="Search by user, action, module, or entity..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
               />
            </div>
         </div>

         <div className="bg-white dark:bg-[#121b25] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm transition-colors">
            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-400">
               <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-600 dark:text-slate-400 font-medium border-b border-gray-200 dark:border-gray-800">
                  <tr>
                     <th className="px-4 py-3">User</th>
                     <th className="px-4 py-3">Action</th>
                     <th className="px-4 py-3">Module</th>
                     <th className="px-4 py-3">Affected Entity</th>
                     <th className="px-4 py-3">Timestamp</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {loading ? (
                     <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">Loading audit trails...</td>
                     </tr>
                  ) : paginatedEvents.length === 0 ? (
                     <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 dark:text-slate-400">No logs found.</td>
                     </tr>
                  ) : (
                     paginatedEvents.map(event => (
                        <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                           <td className="px-4 py-3 text-slate-900 dark:text-slate-200 font-bold">{event.user}</td>
                           <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{event.action}</td>
                           <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                              <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">
                                 {event.module}
                              </span>
                           </td>
                           <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">{event.entity}</td>
                           <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {moment(event.timestamp).format('MMM D, YYYY h:mm A')}
                           </td>
                        </tr>
                     ))
                  )}
               </tbody>
            </table>

            {/* Pagination */}
            {!loading && filteredEvents.length > 0 && (
               <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-6 border-t border-slate-100 dark:border-gray-800 bg-gray-50 dark:bg-[#0b1015]">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                     Showing <span className="text-slate-900 dark:text-slate-200 font-bold">{(page - 1) * limit + 1}</span> to <span className="text-slate-900 dark:text-slate-200 font-bold">{Math.min(page * limit, filteredEvents.length)}</span> of <span className="text-slate-900 dark:text-slate-200 font-bold">{filteredEvents.length}</span> results
                  </p>
                  <div className="flex gap-2">
                     <button
                        disabled={page === 1}
                        onClick={() => setPage(1)}
                        className="group flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#121b25] hover:border-primary hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                        title="First Page"
                     >
                        <span className="material-symbols-outlined text-lg">first_page</span>
                     </button>
                     <button
                        disabled={page === 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className="group flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#121b25] hover:border-primary hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                     >
                        <span className="material-symbols-outlined text-lg">chevron_left</span>
                     </button>
                     <span className="flex items-center px-4 text-xs font-bold text-slate-700 dark:text-slate-300">
                        Page {page} of {totalPages}
                     </span>
                     <button
                        disabled={page === totalPages}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        className="group flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#121b25] hover:border-primary hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                     >
                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                     </button>
                     <button
                        disabled={page === totalPages}
                        onClick={() => setPage(totalPages)}
                        className="group flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#121b25] hover:border-primary hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                        title="Last Page"
                     >
                        <span className="material-symbols-outlined text-lg">last_page</span>
                     </button>
                  </div>
               </div>
            )}
         </div>
      </div>
   );
};

export default AuditLog;