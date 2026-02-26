import React, { useEffect, useState, useMemo } from 'react';
import { getAllAPCRecords, getAssignmentUsage } from '../../../services/apc';
import { getAllStaff } from '../../../services/staff';
import { APCRecord } from '../../../types/apc';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface FlaggedReason {
    type: 'count_mismatch' | 'assignment_count_mismatch' | 'data_inconsistency';
    message: string;
}

interface FlaggedStaff {
    id: string;
    fileNo: string;
    name: string;
    conraiss: string;
    expectedCount: number;
    apcCount: number;
    actualUsage: number;
    reasons: FlaggedReason[];
}

const FlaggedStaffPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [apcRecords, setApcRecords] = useState<APCRecord[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);
    const [ignoredStaff, setIgnoredStaff] = useState<Set<string>>(new Set());
    const [staffCategoryMap, setStaffCategoryMap] = useState<Map<string, { is_hod: boolean; is_state_coordinator: boolean }>>(new Map());

    useEffect(() => {
        fetchData();
        loadIgnoredStaff();
    }, []);

    const loadIgnoredStaff = () => {
        const ignored = localStorage.getItem('ignoredFlaggedStaff');
        if (ignored) {
            setIgnoredStaff(new Set(JSON.parse(ignored)));
        }
    };

    const saveIgnoredStaff = (ignoredSet: Set<string>) => {
        localStorage.setItem('ignoredFlaggedStaff', JSON.stringify([...ignoredSet]));
    };

    const handleIgnoreStaff = (staffId: string) => {
        const newIgnored = new Set<string>(ignoredStaff);
        newIgnored.add(staffId);
        setIgnoredStaff(newIgnored);
        saveIgnoredStaff(newIgnored);
    };

    const handleUnignoreStaff = (staffId: string) => {
        const newIgnored = new Set<string>(ignoredStaff);
        newIgnored.delete(staffId);
        setIgnoredStaff(newIgnored);
        saveIgnoredStaff(newIgnored);
    };

    const handleExportCSV = () => {
        try {
            const exportData = filteredData.map(s => ({
                'File No': s.fileNo,
                'Name': s.name,
                'CONRAISS': s.conraiss,
                'Expected': s.expectedCount,
                'APC Count': s.apcCount,
                'Reasons': s.reasons.map(r => r.message).join(' | ')
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Flagged Staff");
            XLSX.writeFile(wb, `Flagged_Staff_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (error) {
            console.error("CSV Export failed", error);
        }
    };

    const handleExportPDF = async () => {
        try {
            setLoading(true);
            const doc = new jsPDF('p', 'mm', 'a4');
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
                const wmWidth = 100;
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
                doc.text("FLAGGED STAFF RECORDS REPORT", width / 2, 26, { align: 'center' });

                doc.setFontSize(8);
                doc.setTextColor(100);
                doc.text(`Generated: ${new Date().toLocaleDateString()}`, 15, height - 10);
                doc.text(`Page ${(doc as any).internal.getNumberOfPages()}`, width - 15, height - 10, { align: 'right' });
            };

            const columns = ["S/N", "FILE NO", "NAME", "CONR", "EXPECT", "RECORD", "FOUND", "REASONS"];
            const rows = filteredData.map((s, i) => [
                i + 1,
                s.fileNo,
                s.name,
                s.conraiss,
                s.expectedCount,
                s.apcCount,
                s.actualUsage,
                s.reasons.map(r => r.message).join('\n')
            ]);

            autoTable(doc, {
                head: [columns],
                body: rows,
                startY: 40,
                margin: { top: 40, bottom: 20 },
                theme: 'grid',
                headStyles: { fillColor: [0, 128, 0], textColor: 255, fontStyle: 'bold' }, // Green
                styles: { fontSize: 8 },
                columnStyles: {
                    0: { cellWidth: 10 },
                    1: { cellWidth: 20 },
                    2: { cellWidth: 40 },
                    3: { cellWidth: 15 },
                    4: { cellWidth: 15 },
                    5: { cellWidth: 15 },
                    6: { cellWidth: 'auto' }
                },
                didDrawPage: (data) => drawHeader(data)
            });

            doc.save(`Flagged_Staff_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error("PDF Export failed", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchData = async (force: boolean = false) => {
        setLoading(true);
        try {
            const [apcList, staffData] = await Promise.all([
                getAllAPCRecords(true, force),
                getAllStaff(true, force)
            ]);

            const catMap = new Map<string, { is_hod: boolean; is_state_coordinator: boolean }>();
            staffData.forEach(s => {
                catMap.set(s.fileno, {
                    is_hod: !!s.is_hod,
                    is_state_coordinator: !!s.is_state_coordinator
                });
            });

            setStaffCategoryMap(catMap);
            setApcRecords(apcList);
        } catch (error) {
            console.error("Error fetching flagging data:", error);
        } finally {
            setLoading(false);
        }
    };

    const getExpectedCount = (conraiss: string): number => {
        const match = conraiss.match(/\d+/);
        if (!match) return 0;
        const grade = parseInt(match[0]);

        // Align with services/apc.ts getAssignmentLimit
        if (grade >= 3 && grade <= 7) return 1;
        if (grade >= 8 && grade <= 9) return 2;
        if (grade >= 10 && grade <= 12) return 3;
        if (grade >= 13 && grade <= 14) return 4;
        return 0;
    };

    const flaggedStaffList = useMemo(() => {
        const results: FlaggedStaff[] = [];

        apcRecords.forEach(apc => {
            const conraiss = apc.conraiss || '';
            const expectedBaseCount = getExpectedCount(conraiss);

            if (expectedBaseCount === 0) return; // Skip those not in the defined ranges
            if (ignoredStaff.has(apc.id)) return; // Skip ignored staff

            // Exclude HOD, State Coordinators, and Inactive SDL staff
            const categories = staffCategoryMap.get(apc.file_no);
            if (!categories || categories.is_hod || categories.is_state_coordinator) return;

            const apcCount = apc.count || 0;
            const actualUsage = getAssignmentUsage(apc);

            const reasons: FlaggedReason[] = [];

            // Flagging Condition 1: Actual assignments found vs CONRAISS rule
            if (actualUsage !== expectedBaseCount) {
                reasons.push({
                    type: 'assignment_count_mismatch',
                    message: `CONRAISS grade rules expect ${expectedBaseCount} assignments, but ${actualUsage} assignments were found in the record.`
                });
            }

            // Flagging Condition 2: APC 'count' field mismatch with actual assignments (Data Inconsistency)
            if (apcCount !== actualUsage) {
                reasons.push({
                    type: 'data_inconsistency',
                    message: `APC Record "Count" field (${apcCount}) does not match the actual numbering of assignments (${actualUsage}).`
                });
            }

            // Flagging Condition 3: Database count mismatch vs CONRAISS rule (Legacy Check)
            if (apcCount !== expectedBaseCount && actualUsage === expectedBaseCount) {
                reasons.push({
                    type: 'count_mismatch',
                    message: `APC Record specifies ${apcCount} assignments, but CONRAISS grade rules expect ${expectedBaseCount}.`
                });
            }

            if (reasons.length > 0) {
                results.push({
                    id: apc.id,
                    fileNo: apc.file_no,
                    name: apc.name,
                    conraiss: conraiss,
                    expectedCount: expectedBaseCount,
                    apcCount: apcCount,
                    actualUsage: actualUsage,
                    reasons: reasons
                });
            }
        });

        return results;
    }, [apcRecords, ignoredStaff]);

    const filteredData = useMemo(() => {
        if (!searchQuery) return flaggedStaffList;
        const q = searchQuery.toLowerCase();
        return flaggedStaffList.filter(s =>
            s.fileNo.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q)
        );
    }, [flaggedStaffList, searchQuery]);

    const paginatedData = useMemo(() => {
        const start = (page - 1) * limit;
        return filteredData.slice(start, start + limit);
    }, [filteredData, page, limit]);

    const totalPages = Math.ceil(filteredData.length / limit);

    return (
        <div className="flex-1 flex flex-col h-full bg-background-light dark:bg-[#101922] p-8 gap-8 overflow-y-auto transition-colors duration-200">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-300">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 dark:from-emerald-400 dark:via-teal-400 dark:to-emerald-400 tracking-tight">
                        Flagged Staff Records
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Identifying staff with assignment count violations based on CONRAISS grade rules.</p>
                </div>

                {!loading && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => fetchData(true)}
                            className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-teal-600 dark:text-teal-400 font-bold text-xs shadow-sm hover:shadow-md hover:border-teal-200 hover:bg-background-light dark:hover:bg-slate-800 transition-all duration-200"
                            title="Force refresh data from server"
                        >
                            <span className="material-symbols-outlined group-hover:rotate-180 transition-transform duration-500 text-lg">refresh</span>
                            Refresh Data
                        </button>
                        {filteredData.length > 0 && (
                            <>
                                <button
                                    onClick={handleExportPDF}
                                    className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-slate-300 font-bold text-xs shadow-sm hover:shadow-md hover:border-slate-300 hover:bg-background-light dark:hover:bg-slate-800 transition-all duration-200"
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
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-surface-light dark:bg-[#121b25] p-6 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-6 min-h-[500px] transition-colors duration-200">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{filteredData.length}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Flagged Personnel</span>
                        </div>
                        {ignoredStaff.size > 0 && (
                            <>
                                <div className="h-10 w-px bg-slate-100 dark:bg-gray-800 hidden md:block"></div>
                                <div className="flex flex-col">
                                    <span className="text-2xl font-black text-slate-500 dark:text-slate-400">{ignoredStaff.size}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ignored</span>
                                </div>
                                <button
                                    onClick={() => {
                                        setIgnoredStaff(new Set<string>());
                                        saveIgnoredStaff(new Set<string>());
                                    }}
                                    className="px-2 py-1 rounded-lg bg-background-light hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs transition-colors"
                                    title="Clear all ignored staff"
                                >
                                    Clear Ignored
                                </button>
                            </>
                        )}
                        <div className="h-10 w-px bg-slate-100 dark:bg-gray-800 hidden md:block"></div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-600">Rows:</label>
                            <select
                                value={limit}
                                onChange={(e) => {
                                    setLimit(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="h-9 px-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-surface-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-300 text-sm font-bold"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>

                    <div className="relative w-full md:w-64">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                        <input
                            type="text"
                            placeholder="Search by File No or Name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-background-light dark:bg-slate-800/50 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <span className="material-symbols-outlined animate-spin text-4xl text-rose-500/50">data_exploration</span>
                            <span className="text-slate-400 font-medium text-xs tracking-widest uppercase">Analyzing Records...</span>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-700">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-background-light dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-bold uppercase text-xs tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Staff Details</th>
                                    <th className="px-6 py-4">CONRAISS</th>
                                    <th className="px-6 py-4 text-center">Expected</th>
                                    <th className="px-6 py-4 text-center">Record</th>
                                    <th className="px-6 py-4 text-center">Found</th>
                                    <th className="px-6 py-4">Flagging Reasons</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-300 dark:divide-gray-800">
                                {paginatedData.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-20">
                                            <div className="flex flex-col items-center gap-3 text-slate-400">
                                                <span className="material-symbols-outlined text-5xl opacity-20">verified_user</span>
                                                <p className="font-medium">No flagging violations discovered.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedData.map((staff) => (
                                        <tr key={staff.id} className="hover:bg-background-light dark:hover:bg-slate-800/30 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-900 dark:text-white">{staff.name}</span>
                                                    <span className="font-mono text-sm text-rose-500 font-bold uppercase">{staff.fileNo}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400">{staff.conraiss}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-2 py-1 rounded bg-background-light dark:bg-slate-800 font-black text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-gray-700">{staff.expectedCount}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded font-black ${staff.apcCount === staff.expectedCount ? 'text-slate-700 dark:text-slate-300' : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'}`}>
                                                    {staff.apcCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded font-black ${staff.actualUsage === staff.expectedCount ? 'text-slate-700 dark:text-slate-300' : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20'}`}>
                                                    {staff.actualUsage}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    {staff.reasons.map((r, i) => (
                                                        <div key={i} className="flex items-start gap-2 text-[11px] leading-tight">
                                                            <span className="material-symbols-outlined text-rose-500 text-sm mt-0.5">error_outline</span>
                                                            <span className="text-slate-500 dark:text-slate-400 font-medium">{r.message}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => handleIgnoreStaff(staff.id)}
                                                    className="px-3 py-1 rounded-lg bg-background-light hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs transition-colors"
                                                    title="Ignore this flagged staff"
                                                >
                                                    <span className="material-symbols-outlined text-sm">visibility_off</span>
                                                    Ignore
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && totalPages > 1 && (
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-100 dark:border-gray-800">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            Page {page} of {totalPages}
                        </p>
                        <div className="flex gap-1">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(1)}
                                className="size-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-gray-700 hover:bg-background-light dark:hover:bg-slate-800 disabled:opacity-30 transition-all font-black text-rose-500"
                            >
                                <span className="material-symbols-outlined">first_page</span>
                            </button>
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                                className="size-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-gray-700 hover:bg-background-light dark:hover:bg-slate-800 disabled:opacity-30 transition-all font-black text-rose-500"
                            >
                                <span className="material-symbols-outlined">chevron_left</span>
                            </button>
                            <div className="px-4 flex items-center font-black text-sm text-slate-700 dark:text-slate-300 bg-background-light dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-gray-700">
                                {page}
                            </div>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="size-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-gray-700 hover:bg-background-light dark:hover:bg-slate-800 disabled:opacity-30 transition-all font-black text-rose-500"
                            >
                                <span className="material-symbols-outlined">chevron_right</span>
                            </button>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage(totalPages)}
                                className="size-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-gray-700 hover:bg-background-light dark:hover:bg-slate-800 disabled:opacity-30 transition-all font-black text-rose-500"
                            >
                                <span className="material-symbols-outlined">last_page</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FlaggedStaffPage;
