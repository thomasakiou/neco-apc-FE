import React, { useState, useMemo, useEffect } from 'react';
import { getAllAPCRecords } from '../../../services/apc';
import { getAllPostingRecords } from '../../../services/posting';
import { getAllFinalPostings } from '../../../services/finalPosting';
import { getPageCache, setPageCache } from '../../../services/pageCache';
import { getAllStaff } from '../../../services/staff';
import { APCRecord } from '../../../types/apc';
import { assignmentFieldMap } from '../../../services/personalizedPost';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ValidationResult {
    fileNo: string;
    name: string;
    station: string;
    issue: string;
}

const AssignmentValidationPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState<string>('');
    const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
    const [hasRun, setHasRun] = useState(false);

    // Search Filters
    const [searchFileNo, setSearchFileNo] = useState('');
    const [searchName, setSearchName] = useState('');
    const [searchStation, setSearchStation] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const filteredResults = useMemo(() => {
        return validationResults.filter(result => {
            const matchesFileNo = result.fileNo.toLowerCase().includes(searchFileNo.toLowerCase());
            const matchesName = result.name.toLowerCase().includes(searchName.toLowerCase());
            const matchesStation = result.station.toLowerCase().includes(searchStation.toLowerCase());
            return matchesFileNo && matchesName && matchesStation;
        });
    }, [validationResults, searchFileNo, searchName, searchStation]);

    // State persistence via PageCache
    useEffect(() => {
        const cached = getPageCache('assignment-validation');
        if (cached) {
            setSelectedAssignment(cached.selectedAssignment || '');
            setSearchFileNo(cached.filters?.fileNo || '');
            setSearchName(cached.filters?.name || '');
            setSearchStation(cached.filters?.station || '');
            setCurrentPage(cached.page || 1);
            setRowsPerPage(cached.rowsPerPage || 10);
            if (cached.results) {
                setValidationResults(cached.results);
                setHasRun(true);
            }
        }
    }, []);

    // Save cache on relevant state changes
    useEffect(() => {
        setPageCache('assignment-validation', {
            selectedAssignment,
            filters: {
                fileNo: searchFileNo,
                name: searchName,
                station: searchStation
            },
            page: currentPage,
            rowsPerPage,
            results: validationResults, // Cache the expensive results
            hasRun
        });
    }, [selectedAssignment, searchFileNo, searchName, searchStation, currentPage, rowsPerPage, validationResults, hasRun]);

    // Reset page on filter or rowsPerPage change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchFileNo, searchName, searchStation, rowsPerPage]);

    const totalPages = Math.ceil(filteredResults.length / rowsPerPage);

    const paginatedResults = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredResults.slice(start, start + rowsPerPage);
    }, [filteredResults, currentPage, rowsPerPage]);

    // Invert the map to get Code -> Field (if needed) or just use the keys
    // The keys of assignmentFieldMap seem to be the Codes (e.g. 'SSCE-INT') and values are fields (e.g. 'ssce_int').
    // Let's create options for the dropdown.
    const assignmentOptions = useMemo(() => {
        const unique = new Map<string, { code: string; field: string; label: string }>();

        Object.entries(assignmentFieldMap).forEach(([code, field]) => {
            // Prefer short codes (uppercase, no spaces)
            const isCode = code === code.toUpperCase() && !code.includes(' ');

            if (isCode && !unique.has(field)) {
                unique.set(field, {
                    code,
                    field,
                    label: code.replace(/-/g, ' ')
                });
            }
        });

        // Fallback: if some fields are ONLY in common names, add them (rare)
        Object.entries(assignmentFieldMap).forEach(([code, field]) => {
            if (!unique.has(field)) {
                unique.set(field, {
                    code,
                    field,
                    label: code.replace(/-/g, ' ')
                });
            }
        });

        return Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, []);

    const handleExportCSV = () => {
        try {
            const exportData = filteredResults.map(r => ({
                'File No': r.fileNo,
                'Name': r.name,
                'Station': r.station,
                'Discrepancy Issue': r.issue
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Validation Results");
            XLSX.writeFile(wb, `Assignment_Validation_${selectedAssignment}_${new Date().toISOString().split('T')[0]}.xlsx`);
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
                doc.text(`VALIDATION REPORT: ${selectedAssignment.toUpperCase()}`, width / 2, 26, { align: 'center' });

                doc.setFontSize(8);
                doc.setTextColor(100);
                doc.text(`Generated: ${new Date().toLocaleDateString()}`, 15, height - 10);
                doc.text(`Page ${(doc as any).internal.getNumberOfPages()}`, width - 15, height - 10, { align: 'right' });
            };

            const columns = ["S/N", "FILE NO", "NAME", "STATION", "ISSUE"];
            const rows = filteredResults.map((r, i) => [
                i + 1,
                r.fileNo,
                r.name,
                r.station,
                r.issue
            ]);

            autoTable(doc, {
                head: [columns],
                body: rows,
                startY: 40,
                margin: { top: 40, bottom: 20 },
                theme: 'grid',
                headStyles: { fillColor: [0, 128, 0], textColor: 255, fontStyle: 'bold' }, // Green
                styles: { fontSize: 9 },
                didDrawPage: (data) => drawHeader(data)
            });

            doc.save(`Validation_Report_${selectedAssignment}_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error("PDF Export failed", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRunCheck = async (force: boolean = false) => {
        if (!selectedAssignment) return;
        setLoading(true);
        setHasRun(true);
        // setValidationResults([]); // Keep existing results to prevent flicker if fetching from cache

        try {
            const [apcRecords, postingRecords, finalPostingRecords, allStaff] = await Promise.all([
                getAllAPCRecords(true, force), // only active
                getAllPostingRecords(force),
                getAllFinalPostings(0, 100000, force),
                getAllStaff(force)
            ]);

            const targetField = assignmentFieldMap[selectedAssignment];
            if (!targetField) {
                console.error("Invalid assignment code selected");
                setLoading(false);
                return;
            }

            // Create a Set of file numbers for secretaries
            const secretaryFileNos = new Set<string>();
            allStaff.forEach(s => {
                if (s.is_secretary) {
                    secretaryFileNos.add(s.fileno.trim().padStart(4, '0'));
                }
            });

            // Get all valid aliases for this field (e.g. 'OCT-ACCR' also matches 'OCTOBER ACCREDITATION')
            const validAliases = Object.keys(assignmentFieldMap)
                .filter(key => assignmentFieldMap[key] === targetField)
                .map(key => key.toUpperCase());

            // Extract assignment code/name from selectedAssignment for comparison
            const assignmentCode = selectedAssignment;
            const assignmentName = selectedAssignment;

            // 1. Get final posting items first
            const finalPostingItems = finalPostingRecords.items || (Array.isArray(finalPostingRecords) ? finalPostingRecords : []);

            // 2. Filter APC records that are SCHEDULED for this assignment (field is not empty)
            // AND ensure they are not returned
            // AND ensure they are NOT secretaries
            const scheduledStaff = apcRecords.filter(apc => {
                const normFileNo = apc.file_no.trim().padStart(4, '0');
                if (secretaryFileNos.has(normFileNo)) return false;

                const val = (apc as any)[targetField];
                return val && val.toString().trim() !== '' && val.toString().trim().toUpperCase() !== 'RETURNED';
            });

            // 3. Build set of staff already posted for THIS specific assignment
            const alreadyPostedForAssignment = new Set<string>();

            const normalize = (s: any) => s ? String(s).trim().toUpperCase() : '';

            [...postingRecords, ...finalPostingItems].forEach((p: any) => {
                const key = p.file_no.trim().padStart(4, '0');
                const assignmentsRaw = p.assignments;

                let hasThisAssignment = false;
                if (Array.isArray(assignmentsRaw)) {
                    hasThisAssignment = assignmentsRaw.some((a: any) => {
                        const code = typeof a === 'string' ? a : a.code || a.name || '';
                        const normCode = normalize(code);
                        // Check against all valid aliases
                        return validAliases.some(alias => normCode === alias);
                    });
                } else if (typeof assignmentsRaw === 'string' && assignmentsRaw) {
                    hasThisAssignment = assignmentsRaw.split(',').some(s => {
                        const normCode = normalize(s);
                        return validAliases.some(alias => normCode === alias);
                    });
                }

                if (hasThisAssignment) {
                    alreadyPostedForAssignment.add(key);
                }
            });

            const issues: ValidationResult[] = [];

            // 4. Cross-reference - Only show staff scheduled but NOT posted for this assignment
            scheduledStaff.forEach(staff => {
                const normFileNo = staff.file_no.trim().padStart(4, '0');

                // If staff is NOT in the alreadyPostedForAssignment set, they need to be posted
                if (!alreadyPostedForAssignment.has(normFileNo)) {
                    issues.push({
                        fileNo: staff.file_no.trim(),
                        name: staff.name,
                        station: staff.station || '-',
                        issue: 'Scheduled in APC but Not posted yet'
                    });
                }
            });

            setValidationResults(issues);

        } catch (error) {
            console.error("Validation failed", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background-light dark:bg-[#101922] p-4 md:p-8 gap-6 md:gap-8 overflow-y-auto transition-colors duration-200">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-300">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 dark:from-emerald-400 dark:via-teal-400 dark:to-emerald-400 tracking-tight">
                        Assignment Validation
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                        Verify that staff scheduled for assignments in APC are correctly reflected in the Posting Table.
                    </p>
                </div>

                {hasRun && !loading && (
                    <div className="flex flex-wrap items-center justify-center md:justify-end gap-3">
                        <button
                            onClick={() => handleRunCheck(true)}
                            className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-slate-300 font-bold text-xs shadow-sm hover:shadow-md hover:border-slate-300 hover:bg-background-light dark:hover:bg-slate-800 transition-all duration-200"
                            title="Rerun validation check with fresh data from server"
                        >
                            <span className="material-symbols-outlined text-emerald-500 group-hover:rotate-180 transition-transform duration-500 text-lg">refresh</span>
                            Refresh Data
                        </button>
                        {validationResults.length > 0 && (
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

                {/* Controls */}
                <div className="flex flex-wrap items-end gap-4 p-4 bg-background-light dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <div className="flex flex-col gap-2 w-full md:w-80">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Assignment</label>
                        <select
                            value={selectedAssignment}
                            onChange={(e) => setSelectedAssignment(e.target.value)}
                            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-background-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-200 font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        >
                            <option value="">-- Choose Assignment to Validate --</option>
                            {assignmentOptions.map(opt => (
                                <option key={opt.code} value={opt.code}>{opt.label} ({opt.code})</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => handleRunCheck()}
                        disabled={loading || !selectedAssignment}
                        className="h-11 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none transition-all flex items-center gap-2"
                    >
                        {loading ? (
                            <span className="material-symbols-outlined animate-spin text-xl">sync</span>
                        ) : (
                            <span className="material-symbols-outlined text-xl">fact_check</span>
                        )}
                        Run Validation
                    </button>

                    {/* Search Filters */}
                    {hasRun && !loading && validationResults.length > 0 && (
                        <div className="w-full flex flex-col md:flex-row gap-4 mt-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex-1 relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">tag</span>
                                <input
                                    type="text"
                                    placeholder="Filter by File No..."
                                    value={searchFileNo}
                                    onChange={(e) => setSearchFileNo(e.target.value)}
                                    className="w-full pl-9 h-10 rounded-lg border border-slate-200 dark:border-gray-700 bg-background-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-200 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                            </div>
                            <div className="flex-1 relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                                <input
                                    type="text"
                                    placeholder="Filter by Name..."
                                    value={searchName}
                                    onChange={(e) => setSearchName(e.target.value)}
                                    className="w-full pl-9 h-10 rounded-lg border border-slate-200 dark:border-gray-700 bg-background-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-200 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                            </div>
                            <div className="flex-1 relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">location_on</span>
                                <input
                                    type="text"
                                    placeholder="Filter by Station..."
                                    value={searchStation}
                                    onChange={(e) => setSearchStation(e.target.value)}
                                    className="w-full pl-9 h-10 rounded-lg border border-slate-200 dark:border-gray-700 bg-background-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-200 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500 text-xs font-bold uppercase whitespace-nowrap">Rows:</span>
                                <select
                                    value={rowsPerPage}
                                    onChange={(e) => setRowsPerPage(Number(e.target.value))}
                                    className="h-10 rounded-lg border border-slate-200 dark:border-gray-700 bg-surface-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-200 text-sm font-bold px-2 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col">
                    {!hasRun ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4 min-h-[300px]">
                            <div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-4xl opacity-50">search_check</span>
                            </div>
                            <p className="font-medium text-sm">Select an assignment and run validation to see discrepancies.</p>
                        </div>
                    ) : loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-[300px]">
                            <span className="material-symbols-outlined animate-spin text-4xl text-indigo-500">grid_view</span>
                            <div className="flex flex-col items-center">
                                <span className="font-black text-slate-700 dark:text-slate-200 text-lg">Analyzing Data...</span>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Please Wait</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-500">Validation Results for:</span>
                                    <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded text-xs font-black uppercase border border-indigo-100 dark:border-indigo-900/50">
                                        {selectedAssignment}
                                    </span>
                                </div>
                                <span className={`text-xs font-black uppercase px-3 py-1 rounded-full ${filteredResults.length === 0
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                    }`}>
                                    {filteredResults.length} Issues Found
                                </span>
                            </div>

                            {filteredResults.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 bg-background-light dark:bg-emerald-900/5 rounded-xl border border-emerald-100 dark:border-emerald-900/20 gap-4">
                                    <span className="material-symbols-outlined text-6xl text-emerald-500/50">verified</span>
                                    <div className="text-center">
                                        <h3 className="text-lg font-black text-emerald-700 dark:text-emerald-400">All Clear!</h3>
                                        <p className="text-emerald-600/80 dark:text-emerald-500/80 text-sm font-medium">
                                            {validationResults.length === 0
                                                ? <>Every staff member scheduled for <b>{selectedAssignment}</b> has been correctly posted.</>
                                                : "No issues match your search criteria."
                                            }
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-700">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-background-light dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-bold uppercase text-xs tracking-wider">
                                                <tr>
                                                    <th className="px-6 py-4">Staff Details</th>
                                                    <th className="px-6 py-4">Station</th>
                                                    <th className="px-6 py-4">Discrepancy Issue</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-300 dark:divide-gray-800">
                                                {paginatedResults.map((result, idx) => (
                                                    <tr key={idx} className="hover:bg-background-light dark:hover:bg-slate-800/30 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-slate-900 dark:text-white">{result.name}</span>
                                                                <span className="font-mono text-xs text-slate-500 font-bold uppercase">{result.fileNo}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-400">
                                                            {result.station}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2 px-3 py-1 rounded bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 w-fit max-w-full">
                                                                <span className="material-symbols-outlined text-base flex-shrink-0">warning</span>
                                                                <span className="text-xs font-bold break-words">{result.issue}</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {/* Pagination Controls */}
                                    {totalPages > 1 && (
                                        <div className="flex justify-between items-center px-4 py-3 bg-background-light dark:bg-slate-800/30 border border-slate-200 dark:border-gray-700 rounded-xl">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-2">
                                                Page {currentPage} of {totalPages}
                                            </span>
                                            <div className="flex gap-2">
                                                <button
                                                    disabled={currentPage === 1}
                                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-700 text-xs font-bold text-slate-600 dark:text-slate-300 disabled:opacity-50 hover:bg-background-light dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                                                >
                                                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                                                    Previous
                                                </button>
                                                <button
                                                    disabled={currentPage === totalPages}
                                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-700 text-xs font-bold text-slate-600 dark:text-slate-300 disabled:opacity-50 hover:bg-background-light dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                                                >
                                                    Next
                                                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AssignmentValidationPage;
