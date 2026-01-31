import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getAllAPCRecords } from '../../../services/apc';
import { getAllFinalPostings } from '../../../services/finalPosting';
import { getPageCache, setPageCache } from '../../../services/pageCache';
import { assignmentFieldMap } from '../../../services/personalizedPost';
import { APCRecord } from '../../../types/apc';
import { FinalPostingResponse } from '../../../types/finalPosting';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface OutstandingStaff {
    fileNo: string;
    name: string;
    station: string;
    conraiss: string;
    scheduled: string[];
    posted: string[];
    pending: string[];
    limit: number;
}

const OutstandingPostingsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [outstandingList, setOutstandingList] = useState<OutstandingStaff[]>([]);

    // Search Filters
    const [searchName, setSearchName] = useState('');
    const [searchFileNo, setSearchFileNo] = useState('');
    const [searchStation, setSearchStation] = useState('');
    const [countRatioFilter, setCountRatioFilter] = useState<'all' | 'none' | 'partial' | 'full'>('all');

    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchName, searchFileNo, searchStation, rowsPerPage, countRatioFilter]);

    // State persistence via PageCache
    useEffect(() => {
        const cached = getPageCache('outstanding-postings');
        if (cached) {
            setSearchName(cached.searchTerm || '');
            setSearchFileNo(cached.filters?.fileNo || '');
            setSearchStation(cached.filters?.station || '');
            setCountRatioFilter(cached.filters?.countRatio || 'all');
            setCurrentPage(cached.page || 1);
            setRowsPerPage(cached.limit || 10);
        }
        fetchData();
    }, []);

    // Save cache on state change
    useEffect(() => {
        setPageCache('outstanding-postings', {
            searchTerm: searchName,
            page: currentPage,
            limit: rowsPerPage,
            filters: {
                fileNo: searchFileNo,
                station: searchStation,
                countRatio: countRatioFilter
            }
        });
    }, [searchName, searchFileNo, searchStation, countRatioFilter, currentPage, rowsPerPage]);

    const handleExportCSV = () => {
        try {
            const exportData = filteredList.map(item => ({
                'File No': item.fileNo,
                'Name': item.name,
                'Station': item.station,
                'CONR': item.conraiss,
                'Alloted': `${item.scheduled.length} (${item.scheduled.join(', ')})`,
                'Assigned': `${item.posted.length} (${item.posted.join(', ')})`,
                'Outstanding': `${item.pending.length} (${item.pending.join(', ')})`
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Outstanding Postings");
            XLSX.writeFile(wb, `Outstanding_Postings_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (error) {
            console.error("CSV Export failed", error);
        }
    };

    const handleExportPDF = async () => {
        try {
            setLoading(true);
            const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for more horizontal room
            const width = doc.internal.pageSize.getWidth();
            const height = doc.internal.pageSize.getHeight();

            // Load Logo
            const logoUrl = '/images/neco.png';
            const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.src = logoUrl;
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Logo load failed'));
            });

            const drawHeader = (data: any) => {
                // Watermark
                doc.saveGraphicsState();
                doc.setGState(new (doc as any).GState({ opacity: 0.1 }));
                const wmWidth = 120;
                const aspect = logoImg.width / logoImg.height;
                const wmHeight = wmWidth / aspect;
                doc.addImage(logoImg, 'PNG', (width - wmWidth) / 2, (height - wmHeight) / 2, wmWidth, wmHeight);
                doc.restoreGraphicsState();

                // Header
                const logoAspect = logoImg.width / logoImg.height;
                doc.addImage(logoImg, 'PNG', 15, 8, 20, 20 / logoAspect);

                doc.setTextColor(0, 128, 0); // Green
                doc.setFontSize(18);
                doc.setFont("helvetica", "bold");
                doc.text("NATIONAL EXAMINATIONS COUNCIL (NECO)", width / 2, 18, { align: 'center' });

                doc.setTextColor(0);
                doc.setFontSize(14);
                doc.text("OUTSTANDING POSTINGS REPORT", width / 2, 26, { align: 'center' });

                doc.setFontSize(8);
                doc.setTextColor(100);
                doc.text(`Generated: ${new Date().toLocaleDateString()}`, 15, height - 10);
                doc.text(`Page ${(doc as any).internal.getNumberOfPages()}`, width - 15, height - 10, { align: 'right' });
            };

            const columns = ["S/N", "FILE NO", "NAME", "STATION", "CONR", "ALLOTED", "ASSIGNED", "OUTSTANDING"];
            const rows = filteredList.map((item, i) => [
                i + 1,
                item.fileNo,
                item.name,
                item.station,
                item.conraiss,
                `${item.scheduled.length} (${item.scheduled.join(', ')})`,
                `${item.posted.length} (${item.posted.join(', ')})`,
                `${item.pending.length} (${item.pending.join(', ')})`
            ]);

            autoTable(doc, {
                head: [columns],
                body: rows,
                startY: 40,
                margin: { top: 40, bottom: 20 },
                theme: 'grid',
                headStyles: { fillColor: [225, 29, 72], textColor: 255, fontStyle: 'bold' }, // Rose 600
                styles: { fontSize: 7 }, // Sligthly smaller for more content
                columnStyles: {
                    0: { cellWidth: 8 },
                    1: { cellWidth: 15 },
                    2: { cellWidth: 35 },
                    3: { cellWidth: 30 },
                    4: { cellWidth: 12 },
                    5: { cellWidth: 45 },
                    6: { cellWidth: 45 },
                    7: { cellWidth: 'auto' }
                },
                didDrawPage: (data) => drawHeader(data)
            });

            doc.save(`Outstanding_Postings_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error("PDF Export failed", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchData = async (force: boolean = false) => {
        setLoading(true);
        try {
            const [apcRecords, finalPostingData] = await Promise.all([
                getAllAPCRecords(true, force), // Active records only
                getAllFinalPostings(0, 100000, force) // Get final postings with limit
            ]);

            // Handle both array and object response formats
            const finalPostingRecords: FinalPostingResponse[] = finalPostingData.items || (Array.isArray(finalPostingData) ? finalPostingData : []);

            // Create Final Posting Map for fast lookup (Aggregated by File No)
            // Optimization: Use Sets for faster membership checks and deduplication
            const postingMap = new Map<string, Set<string>>();
            finalPostingRecords.forEach(p => {
                const normFileNo = p.file_no.trim().padStart(4, '0');
                if (!postingMap.has(normFileNo)) {
                    postingMap.set(normFileNo, new Set());
                }
                const set = postingMap.get(normFileNo)!;
                (p.assignments || []).forEach((a: any) => {
                    const code = typeof a === 'string' ? a : a.code || a.name;
                    if (code) set.add(code);
                });
            });

            // Static deterministic map for display codes
            const fieldToDisplayCode: { [key: string]: string } = {
                'tt': 'TT',
                'ssce_int': 'SSCE-INT',
                'ssce_ext': 'SSCE-EXT',
                'ssce_int_mrk': 'SSCE-INT-MRK',
                'ssce_ext_mrk': 'SSCE-EXT-MRK',
                'ncee': 'NCEE',
                'becep': 'BECEP',
                'bece_mrkp': 'BECE-MRKP',
                'mar_accr': 'MAR-ACCR',
                'oct_accr': 'OCT-ACCR',
                'pur_samp': 'PUR-SAMP',
                'gifted': 'GIFTED',
                'swapping': 'SWAPPING',
                'int_audit': 'INT-AUDIT',
                'stock_tk': 'STOCK-TK'
            };

            const results: OutstandingStaff[] = [];

            apcRecords.forEach(staff => {
                const pendingFromApc: string[] = [];

                // Iterate over specific assignment fields
                Object.entries(fieldToDisplayCode).forEach(([field, code]) => {
                    const val = (staff as any)[field];
                    const trimmedVal = val ? val.toString().trim() : '';
                    if (trimmedVal !== '' && trimmedVal.toUpperCase() !== 'RETURNED') {
                        pendingFromApc.push(code);
                    }
                });

                const normFileNo = staff.file_no.trim().padStart(4, '0');
                const postedSet = postingMap.get(normFileNo);
                const posted = postedSet ? Array.from(postedSet) : [];

                // Combine Pending + Posted to get the Original Schedule
                const allScheduled = Array.from(new Set([...pendingFromApc, ...posted]));

                if (allScheduled.length > 0) {
                    results.push({
                        fileNo: staff.file_no,
                        name: staff.name,
                        station: staff.station || '-',
                        conraiss: staff.conraiss || (staff as any).conr || '-',
                        scheduled: allScheduled,
                        posted,
                        pending: pendingFromApc,
                        limit: staff.count || 0
                    });
                }
            });

            setOutstandingList(results);

        } catch (err) {
            console.error("Failed to fetch data", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredList = useMemo(() => {
        return outstandingList.filter(item => {
            const matchName = item.name.toLowerCase().includes(searchName.toLowerCase());
            const matchFileNo = item.fileNo.toLowerCase().includes(searchFileNo.toLowerCase());
            const matchStation = item.station.toLowerCase().includes(searchStation.toLowerCase());

            // Count Ratio Filter
            let matchCountRatio = true;
            if (countRatioFilter === 'none') {
                matchCountRatio = item.posted.length === 0;
            } else if (countRatioFilter === 'partial') {
                matchCountRatio = item.posted.length > 0 && item.posted.length < item.scheduled.length;
            } else if (countRatioFilter === 'full') {
                matchCountRatio = item.posted.length >= item.scheduled.length;
            }

            return matchName && matchFileNo && matchStation && matchCountRatio;
        });
    }, [outstandingList, searchName, searchFileNo, searchStation, countRatioFilter]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredList.length / rowsPerPage);
    const paginatedList = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredList.slice(start, start + rowsPerPage);
    }, [filteredList, currentPage, rowsPerPage]);

    return (
        <div className="flex-1 flex flex-col h-full bg-background-light dark:bg-[#101922] p-8 gap-8 overflow-y-auto transition-colors duration-200">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-300">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-600 via-orange-600 to-rose-600 dark:from-rose-400 dark:via-orange-400 dark:to-rose-400 tracking-tight">
                        Outstanding Postings
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                        Staff members with scheduled APC assignments that have not yet been posted.
                    </p>
                </div>

                {!loading && filteredList.length > 0 && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => fetchData(true)}
                            className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light dark:bg-[#0b1015] border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-slate-300 font-bold text-xs shadow-sm hover:shadow-md hover:border-slate-300 hover:bg-background-light dark:hover:bg-slate-800 transition-all duration-200"
                            title="Reload data from server"
                        >
                            <span className="material-symbols-outlined text-emerald-500 group-hover:rotate-180 transition-transform duration-500 text-lg">refresh</span>
                            Refresh Data
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light dark:bg-[#0b1015] border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-slate-300 font-bold text-xs shadow-sm hover:shadow-md hover:border-slate-300 hover:bg-background-light dark:hover:bg-slate-800 transition-all duration-200"
                        >
                            <span className="material-symbols-outlined text-rose-500 group-hover:scale-110 transition-transform text-lg">picture_as_pdf</span>
                            Export PDF
                        </button>
                        <button
                            onClick={handleExportCSV}
                            className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-slate-300 font-bold text-xs shadow-sm hover:shadow-md hover:border-slate-300 hover:bg-background-light dark:hover:bg-slate-800 transition-all duration-200"
                        >
                            <span className="material-symbols-outlined text-indigo-500 group-hover:scale-110 transition-transform text-lg">download</span>
                            Export CSV
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-surface-light dark:bg-[#121b25] p-6 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-6 min-h-[500px] transition-colors duration-200">

                {/* Search Controls */}
                <div className="flex flex-wrap gap-4 items-end p-4 bg-background-light dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    {/* Text Filters */}
                    <div className="relative flex-1 min-w-[150px]">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                        <input
                            type="text"
                            placeholder="Filter by Name..."
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            className="w-full pl-9 h-10 rounded-lg border border-slate-200 dark:border-gray-700 bg-background-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-200 text-sm font-medium focus:ring-2 focus:ring-rose-500/20 outline-none"
                        />
                    </div>
                    <div className="relative flex-1 min-w-[120px]">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">tag</span>
                        <input
                            type="text"
                            placeholder="File No..."
                            value={searchFileNo}
                            onChange={(e) => setSearchFileNo(e.target.value)}
                            className="w-full pl-9 h-10 rounded-lg border border-slate-200 dark:border-gray-700 bg-background-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-200 text-sm font-medium focus:ring-2 focus:ring-rose-500/20 outline-none"
                        />
                    </div>
                    <div className="relative flex-1 min-w-[120px]">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">location_on</span>
                        <input
                            type="text"
                            placeholder="Station..."
                            value={searchStation}
                            onChange={(e) => setSearchStation(e.target.value)}
                            className="w-full pl-9 h-10 rounded-lg border border-slate-200 dark:border-gray-700 bg-background-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-200 text-sm font-medium focus:ring-2 focus:ring-rose-500/20 outline-none"
                        />
                    </div>

                    {/* Dropdown Filters */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500 text-xs font-bold uppercase">Status:</span>
                            <select
                                value={countRatioFilter}
                                onChange={(e) => setCountRatioFilter(e.target.value as any)}
                                className="h-10 rounded-lg border border-slate-200 dark:border-gray-700 bg-surface-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-200 text-sm font-bold px-2 outline-none focus:ring-2 focus:ring-rose-500/20"
                            >
                                <option value="all">All</option>
                                <option value="none">Not Posted (0/X)</option>
                                <option value="partial">Partially Posted</option>
                                <option value="full">Fully Posted (X/X)</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500 text-xs font-bold uppercase">Rows:</span>
                            <select
                                value={rowsPerPage}
                                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                                className="h-10 rounded-lg border border-slate-200 dark:border-gray-700 bg-surface-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-200 text-sm font-bold px-2 outline-none focus:ring-2 focus:ring-rose-500/20"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col">
                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-[300px]">
                            <span className="material-symbols-outlined animate-spin text-4xl text-rose-500">grid_view</span>
                            <div className="flex flex-col items-center">
                                <span className="font-black text-slate-700 dark:text-slate-200 text-lg">Analyzing Assignments...</span>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Please Wait</span>
                            </div>
                        </div>
                    ) : filteredList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-background-light dark:bg-emerald-900/5 rounded-xl border border-emerald-100 dark:border-emerald-900/20 gap-4">
                            <span className="material-symbols-outlined text-6xl text-emerald-500/50">verified</span>
                            <div className="text-center">
                                <h3 className="text-lg font-black text-emerald-700 dark:text-emerald-400">All Caught Up!</h3>
                                <p className="text-emerald-600/80 dark:text-emerald-500/80 text-sm font-medium">
                                    {outstandingList.length === 0
                                        ? "No staff members have pending assignments."
                                        : "No outstanding postings match your search filters."}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-gray-700">
                                <div className="p-3 bg-background-light dark:bg-slate-800/50 border-b border-slate-300 dark:border-gray-700 flex justify-between items-center">
                                    <span className="text-xs font-black uppercase text-slate-500">Staff with Pending Items</span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                                        {filteredList.length} Found
                                    </span>
                                </div>
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-background-light dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-bold uppercase text-xs tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4">Staff Details</th>
                                            <th className="px-6 py-4">Conr</th>
                                            <th className="px-6 py-4">Alloted</th>
                                            <th className="px-6 py-4">Assigned</th>
                                            <th className="px-6 py-4">Outstanding</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                                        {paginatedList.map((item, idx) => {
                                            return (
                                                <tr key={idx} className="hover:bg-background-light dark:hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="font-bold text-slate-900 dark:text-white text-base">{item.name}</span>
                                                            <div className="flex flex-col">
                                                                <span className="font-mono text-slate-500 font-bold uppercase text-sm">{item.fileNo}</span>
                                                                <span className="text-slate-500 font-medium text-sm">{item.station}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400">
                                                        {item.conraiss}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-2">
                                                            <span className="text-base font-black text-slate-700 dark:text-slate-200">
                                                                {item.scheduled.length}
                                                            </span>
                                                            <div className="flex flex-wrap gap-1">
                                                                {item.scheduled.map(code => (
                                                                    <span key={code} className="px-1.5 py-0.5 rounded bg-background-light dark:bg-slate-800 text-slate-500 text-[10px] font-bold">
                                                                        {code}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-2">
                                                            <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                                                                {item.posted.length}
                                                            </span>
                                                            <div className="flex flex-wrap gap-1">
                                                                {item.posted.length > 0 ? item.posted.map(code => (
                                                                    <span key={code} className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 text-[10px] font-bold">
                                                                        {code}
                                                                    </span>
                                                                )) : <span className="text-slate-400 text-xs italic">None</span>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-2">
                                                            <span className={`text-base font-black ${item.pending.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                                                                {item.pending.length}
                                                            </span>
                                                            <div className="flex flex-wrap gap-1">
                                                                {item.pending.length > 0 ? item.pending.map(code => (
                                                                    <span key={code} className="px-2 py-1 rounded bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 text-[10px] font-bold">
                                                                        {code}
                                                                    </span>
                                                                )) : <span className="text-slate-400 font-bold">-</span>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="flex justify-between items-center px-4">
                                    <span className="text-xs font-bold text-slate-500">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            disabled={currentPage === 1}
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-700 text-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-50 hover:bg-background-light dark:hover:bg-slate-800 transition-colors"
                                        >
                                            Previous
                                        </button>
                                        <button
                                            disabled={currentPage === totalPages}
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-700 text-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-50 hover:bg-background-light dark:hover:bg-slate-800 transition-colors"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OutstandingPostingsPage;
