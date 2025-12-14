import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { getAllPostingRecords } from '../../services/posting';
import { getAllAssignments } from '../../services/assignment';
import { getAllMandates } from '../../services/mandate';
import { PostingResponse } from '../../types/posting';
import { Assignment } from '../../types/assignment';
import { Mandate } from '../../types/mandate';

const GeneratePage: React.FC = () => {
    const [postings, setPostings] = useState<PostingResponse[]>([]);
    const [filteredPostings, setFilteredPostings] = useState<PostingResponse[]>([]);
    const [paginatedPostings, setPaginatedPostings] = useState<PostingResponse[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [mandates, setMandates] = useState<Mandate[]>([]);

    const [filterAssignment, setFilterAssignment] = useState('');
    const [filterMandate, setFilterMandate] = useState('');

    // Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [postingsData, assignmentsData, mandatesData] = await Promise.all([
                getAllPostingRecords(),
                getAllAssignments(),
                getAllMandates()
            ]);

            setPostings(postingsData);
            setFilteredPostings(postingsData);
            setTotal(postingsData.length);
            setAssignments(assignmentsData);
            setMandates(mandatesData);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        filterData();
    }, [filterAssignment, filterMandate, postings]);

    // Handle Pagination
    useEffect(() => {
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        setPaginatedPostings(filteredPostings.slice(startIndex, endIndex));
    }, [filteredPostings, page, limit]);

    // Check 'page' validity when filtered count changes
    useEffect(() => {
        const maxPage = Math.ceil(filteredPostings.length / limit) || 1;
        if (page > maxPage) setPage(maxPage);
    }, [filteredPostings.length, limit]);

    const filterData = () => {
        let result = postings;

        if (filterAssignment) {
            result = result.filter(p =>
                p.assignments?.some((a: any) => {
                    const val = typeof a === 'string' ? a : a.name || a.code;
                    // Ensure robust comparison (trim, optional case sensitivity if needed, but IDs are safer if avail)
                    // For now, match string to string
                    return val === filterAssignment;
                })
            );
        }

        if (filterMandate) {
            result = result.filter(p =>
                p.mandates?.some((m: any) =>
                    (typeof m === 'string' ? m : m.mandate || m.code) === filterMandate
                )
            );
        }

        setFilteredPostings(result);
        setTotal(result.length);
    };

    const handleExport = (type: 'xlsx' | 'csv') => {
        try {
            setLoading(true);
            const exportData = filteredPostings.map(record => ({
                'File Number': record.file_no,
                'Name': record.name,
                'Station': record.station,
                'CONRAISS': record.conraiss,
                'Year': record.year,
                'Count': record.count,
                'Assignments': record.assignments?.map((a: any) => typeof a === 'string' ? a : a.name || a.code).join(', '),
                'Mandates': record.mandates?.map((m: any) => typeof m === 'string' ? m : m.mandate || m.code).join(', '),
                'Venue': record.assignment_venue?.map((v: any) => typeof v === 'string' ? v : v.name || v.code).join(', '),
                'Posted For': record.posted_for,
                'To Be Posted': record.to_be_posted
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const fileName = `Report_${new Date().toISOString().split('T')[0]}.${type}`;

            if (type === 'xlsx') {
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Report");
                XLSX.writeFile(wb, fileName);
            } else {
                const csv = XLSX.utils.sheet_to_csv(ws);
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", fileName);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

            alert(`${type.toUpperCase()} Export successful!`);
        } catch (error) {
            console.error("Export failed", error);
            alert("Failed to export data.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#0b1015] p-6 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 overflow-y-auto">
            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-600 dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400 drop-shadow-sm">
                        Generate Reports
                    </h1>
                    <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">
                        Filter and export posting assignment reports.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 text-rose-600 dark:text-rose-400 font-bold text-xs shadow-sm hover:bg-slate-50 dark:hover:bg-gray-800 transition-all opacity-50 cursor-not-allowed"
                        title="PDF Export (Coming Soon)"
                    >
                        <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                        PDF
                    </button>
                    <button
                        onClick={() => handleExport('csv')}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 text-emerald-600 dark:text-emerald-400 font-bold text-xs shadow-sm hover:bg-slate-50 dark:hover:bg-gray-800 transition-all"
                    >
                        <span className="material-symbols-outlined text-lg">csv</span>
                        CSV
                    </button>
                    <button
                        onClick={() => handleExport('xlsx')}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all"
                    >
                        <span className="material-symbols-outlined text-lg">table_view</span>
                        Excel
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-[#121b25] rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-gray-800 p-6 flex flex-col gap-6">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Assignment</label>
                        <select
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-sm font-medium"
                            value={filterAssignment}
                            onChange={(e) => setFilterAssignment(e.target.value)}
                        >
                            <option value="">All Assignments</option>
                            {assignments.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                        </select>
                    </div>
                    <div className="relative">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Mandate</label>
                        <select
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-sm font-medium"
                            value={filterMandate}
                            onChange={(e) => setFilterMandate(e.target.value)}
                        >
                            <option value="">All Mandates</option>
                            {mandates.map(m => <option key={m.id} value={m.mandate}>{m.mandate}</option>)}
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-xl border border-slate-200/60 dark:border-gray-800 bg-white dark:bg-[#121b25] mt-4 shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gradient-to-r from-slate-50 to-white dark:from-[#0f161d] dark:to-[#121b25] border-b border-slate-200 dark:border-gray-800">
                                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">File No / Name</th>
                                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Station / CONRAISS</th>
                                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Assignment</th>
                                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Mandate</th>
                                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Venue</th>
                                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                                {loading ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-slate-500 italic">Loading data...</td></tr>
                                ) : paginatedPostings.length === 0 ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-slate-500 italic">No records found.</td></tr>
                                ) : (
                                    paginatedPostings.map((record) => (
                                        <tr key={record.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors duration-150">
                                            <td className="p-4 align-top">
                                                <div className="flex flex-col">
                                                    <span className="font-mono text-lg font-black text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded w-fit mb-1 shadow-sm border border-slate-200 dark:border-slate-700">{record.file_no}</span>
                                                    <span className="font-bold text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 transition-colors text-sm">{record.name}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 align-top">
                                                <div className="flex flex-col gap-1">
                                                    <div className="text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[16px] text-slate-400">business</span>
                                                        {record.station || '-'}
                                                    </div>
                                                    {record.conraiss && (
                                                        <span className="text-xs font-semibold text-sky-600 bg-sky-50 dark:bg-sky-900/20 dark:text-sky-300 px-2 py-0.5 rounded-full w-fit">
                                                            CON: {record.conraiss}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 align-top max-w-xs">
                                                <div className="flex flex-wrap gap-1">
                                                    {record.assignments?.map((a: any, i) => (
                                                        <span key={i} className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                                                            {typeof a === 'string' ? a : a.name || a.code}
                                                        </span>
                                                    ))}
                                                    {!record.assignments?.length && <span className="text-slate-400 text-xs italic">-</span>}
                                                </div>
                                            </td>
                                            <td className="p-4 align-top max-w-xs">
                                                <div className="flex flex-wrap gap-1">
                                                    {record.mandates?.map((m: any, i) => (
                                                        <span key={i} className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                                                            {typeof m === 'string' ? m : m.mandate || m.code}
                                                        </span>
                                                    ))}
                                                    {!record.mandates?.length && <span className="text-slate-400 text-xs italic">-</span>}
                                                </div>
                                            </td>
                                            <td className="p-4 align-top max-w-xs">
                                                <div className="flex flex-wrap gap-1">
                                                    {record.assignment_venue?.map((v: any, i) => (
                                                        <span key={i} className="text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-100 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-300 px-1.5 py-0.5 rounded">
                                                            {typeof v === 'string' ? v : v.name || v.code}
                                                        </span>
                                                    ))}
                                                    {!record.assignment_venue?.length && <span className="text-slate-400 text-xs italic">-</span>}
                                                </div>
                                            </td>
                                            <td className="p-4 align-top text-center">
                                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border ${(record.to_be_posted || 0) > 0
                                                    ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800'
                                                    : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                                                    }`}>
                                                    {record.to_be_posted || 0}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="p-4 border-t border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0f161d] flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Showing <span className="font-bold text-slate-700 dark:text-slate-200">{(page - 1) * limit + 1}</span> to <span className="font-bold text-slate-700 dark:text-slate-200">{Math.min(page * limit, total)}</span> of <span className="font-bold text-slate-700 dark:text-slate-200">{total}</span> results
                        </div>

                        <div className="flex gap-2">
                            <div className="flex items-center gap-2 mr-4">
                                <label className="text-xs font-bold text-slate-500 whitespace-nowrap">Show:</label>
                                <select
                                    value={limit}
                                    onChange={(e) => {
                                        setLimit(Number(e.target.value));
                                        setPage(1);
                                    }}
                                    className="h-8 px-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0b1015] font-bold text-xs focus:ring-teal-500"
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(1)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-gray-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined text-lg">first_page</span>
                            </button>
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-gray-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined text-lg">chevron_left</span>
                            </button>
                            <div className="flex items-center px-3 text-sm font-bold">
                                {page} / {Math.ceil(total / limit) || 1}
                            </div>
                            <button
                                disabled={page >= Math.ceil(total / limit)}
                                onClick={() => setPage(p => p + 1)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-gray-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined text-lg">chevron_right</span>
                            </button>
                            <button
                                disabled={page >= Math.ceil(total / limit)}
                                onClick={() => setPage(Math.ceil(total / limit))}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-gray-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined text-lg">last_page</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GeneratePage;