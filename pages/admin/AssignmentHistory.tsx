import React, { useEffect, useState, useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import * as XLSX from 'xlsx';
import { getAllPostingRecords } from '../../services/posting';
import { getAllAPCRecords } from '../../services/apc';
import { getAllAssignments } from '../../services/assignment';
import { getAllMandates } from '../../services/mandate';
import { getAllStates } from '../../services/state';
import { APCRecord } from '../../types/apc';
import { useNotification } from '../../context/NotificationContext';
import { PostingResponse } from '../../types/posting';
import { Assignment } from '../../types/assignment';
import { Mandate } from '../../types/mandate';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface FlatPostingRow {
    uniqueId: string; // composite of id + index
    originalId: string;
    file_no: string;
    name: string;
    station: string;
    conraiss: string;
    sex: string;
    assignment: string;
    mandate: string;
    venue: string;
    posting: string;
    state: string;
    count: number;
    year: string;
    posted_for: any;
    to_be_posted: any;
}

interface ReportField {
    id: string;
    label: string;
    accessor: (row: FlatPostingRow) => any;
    default: boolean;
    pdfWidth?: number | 'auto';
}

const formatVenueName = (venue: string | null | undefined): string => {
    if (!venue) return '-';
    if (venue === 'Returned') return venue;
    const parts = venue.split('-').map(p => p.trim());
    return parts.length > 0 ? parts[parts.length - 1] : venue;
};

const REPORT_FIELDS: ReportField[] = [
    { id: 'file_no', label: 'FILE NO', accessor: r => r.file_no, default: true, pdfWidth: 25 },
    { id: 'name', label: 'NAME', accessor: r => r.name, default: true, pdfWidth: 65 },
    { id: 'sex', label: 'SEX', accessor: r => r.sex || '-', default: false, pdfWidth: 15 },
    { id: 'station', label: 'STATION', accessor: r => r.station, default: true, pdfWidth: 35 },
    { id: 'conraiss', label: 'CONR', accessor: r => r.conraiss, default: true, pdfWidth: 20 },
    { id: 'qualification', label: 'QUALIFICATION', accessor: r => '', default: false, pdfWidth: 40 }, // Populated via APC lookup
    { id: 'mandate', label: 'MANDATE', accessor: r => r.mandate, default: true, pdfWidth: 40 },
    { id: 'assignment', label: 'ASSIGNMENT', accessor: r => r.assignment, default: true, pdfWidth: 40 },
    { id: 'venue', label: 'VENUE', accessor: r => formatVenueName(r.venue), default: true, pdfWidth: 40 },
    { id: 'count', label: 'NIGHTS', accessor: r => r.count, default: false, pdfWidth: 20 },
    { id: 'year', label: 'YEAR', accessor: r => r.year, default: false, pdfWidth: 20 },
    { id: 'state', label: 'STATE', accessor: r => r.state, default: false, pdfWidth: 30 },
    { id: 'posting', label: 'POSTING', accessor: r => r.posting, default: false, pdfWidth: 30 }
];

const GeneratePage: React.FC = () => {
    const { success, error } = useNotification();
    const [loading, setLoading] = useState(true);

    // Filters
    const [assignments, setAssignments] = useState<Assignment[]>([]);

    const [mandates, setMandates] = useState<Mandate[]>([]);
    const [states, setStates] = useState<any[]>([]);
    const [apcRecords, setApcRecords] = useState<APCRecord[]>([]);

    const [filterAssignment, setFilterAssignment] = useState('');
    const [filterMandate, setFilterMandate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    // Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [allFlatRows, setAllFlatRows] = useState<FlatPostingRow[]>([]); // Store all flattened rows

    // Report Customization
    const [reportTitle1, setReportTitle1] = useState('');

    const [reportTitle2, setReportTitle2] = useState('');
    const [reportTemplate, setReportTemplate] = useState('SSCE');

    // Dynamic Fields
    const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(
        new Set(REPORT_FIELDS.filter(f => f.default).map(f => f.id))
    );
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    const activeFields = useMemo(() =>
        REPORT_FIELDS.filter(f => selectedFieldIds.has(f.id)),
        [selectedFieldIds]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [postingsData, assignmentsData, mandatesData, activeAPC, statesData] = await Promise.all([
                getAllPostingRecords(),
                getAllAssignments(),
                getAllMandates(),
                getAllAPCRecords(true),
                getAllStates()
            ]);

            const activeFileNos = new Set(activeAPC.map(a => a.file_no));
            const activePostings = postingsData.filter(p => activeFileNos.has(p.file_no));

            // FLATTEN DATA
            const flattened = flattenPostings(activePostings, statesData);

            setAllFlatRows(flattened);
            setAssignments(assignmentsData);
            setMandates(mandatesData);
            setStates(statesData);
            setApcRecords(activeAPC);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredFlatRows = useMemo(() => {
        let result = allFlatRows;

        if (debouncedSearchQuery) {
            const lowerQuery = debouncedSearchQuery.toLowerCase().trim();
            result = result.filter(r =>
                (r.name && r.name.toLowerCase().includes(lowerQuery)) ||
                (r.file_no && r.file_no.toLowerCase().includes(lowerQuery)) ||
                (r.station && r.station.toLowerCase().includes(lowerQuery))
            );
        }

        if (filterAssignment) {
            result = result.filter(r => r.assignment === filterAssignment);
        }

        if (filterMandate) {
            result = result.filter(r => r.mandate === filterMandate);
        }

        return result;
    }, [allFlatRows, debouncedSearchQuery, filterAssignment, filterMandate]);

    const total = filteredFlatRows.length;

    const paginatedRows = useMemo(() => {
        const startIndex = (page - 1) * limit;
        return filteredFlatRows.slice(startIndex, startIndex + limit);
    }, [filteredFlatRows, page, limit]);

    // Check 'page' validity when filtered count changes
    useEffect(() => {
        const maxPage = Math.ceil(total / limit) || 1;
        if (page > maxPage) setPage(maxPage);
    }, [total, limit]);

    const flattenPostings = (list: PostingResponse[], stateList: any[] = []): FlatPostingRow[] => {
        const result: FlatPostingRow[] = [];
        const stateNames = new Set(stateList.map(s => s.name.toUpperCase()));
        list.forEach(p => {
            // Determine the max length among the arrays to iterate
            const assigns = p.assignments || [];
            const mands = p.mandates || [];
            const venues = p.assignment_venue || [];
            const maxLen = Math.max(assigns.length, mands.length, venues.length, 1); // Ensure at least 1 row

            for (let i = 0; i < maxLen; i++) {
                const a = assigns[i];
                const m = mands[i];
                const v = venues[i];

                const aName = typeof a === 'string' ? a : a?.name || a?.code || '';
                const mName = typeof m === 'string' ? m : m?.mandate || m?.code || '';
                const vName = typeof v === 'string' ? v : v?.name || v?.code || '';

                // Extract State and Posting from Venue
                let state = '';
                let posting = vName;

                if (vName.includes(' | ')) {
                    const parts = vName.split(' | ').map(p => p.trim());
                    // Format: (CODE) | POSTING | STATE
                    if (parts.length === 3) {
                        posting = parts[1];
                        state = parts[2];
                    } else if (parts.length === 2) {
                        posting = parts[0];
                        state = parts[1];
                    }
                } else if (vName.includes(' - ')) {
                    const parts = vName.split(' - ').map(p => p.trim());
                    if (parts.length === 3) {
                        posting = parts[1];
                        state = parts[2];
                    } else if (parts.length === 2) {
                        if (parts[0].startsWith('(')) {
                            // Format: (CODE) - NAME
                            // Check if NAME is a state
                            const possibleName = parts[1];
                            if (stateNames.has(possibleName.toUpperCase())) {
                                posting = possibleName;
                                state = possibleName;
                            } else {
                                posting = possibleName;
                                state = '';
                            }
                        } else {
                            posting = parts[0];
                            state = parts[1];
                        }
                    }
                } else {
                    // Fallback for raw names
                    if (stateNames.has(vName.toUpperCase())) {
                        state = vName;
                    }
                }

                result.push({
                    uniqueId: `${p.id}_${i}`,
                    originalId: p.id,
                    file_no: p.file_no,
                    name: p.name,
                    station: p.station || '-',
                    conraiss: p.conraiss || '-',
                    sex: p.sex || '-',
                    assignment: aName,
                    mandate: mName,
                    venue: formatVenueName(vName),
                    posting: posting || '-',
                    state: state || '-',
                    count: p.count || 0,
                    year: p.year || '-',
                    posted_for: p.posted_for || 0,
                    to_be_posted: p.to_be_posted || 0
                });
            }
        });
        return result;
    };



    const handleExport = (type: 'xlsx' | 'csv') => {
        try {
            setLoading(true);
            const exportData = filteredFlatRows.map(record => {
                const row: any = {};
                activeFields.forEach(field => {
                    row[field.label] = field.accessor(record);
                });
                return row;
            });

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

            success(`${type.toUpperCase()} Export successful!`);
        } catch (error) {
            console.error("Export failed", error);
            error("Failed to export data.");
        } finally {
            setLoading(false);
        }
    };

    const handlePDFExport = async () => {
        try {
            setLoading(true);
            const doc = new jsPDF('l', 'mm', 'a4');
            const width = doc.internal.pageSize.getWidth();
            const height = doc.internal.pageSize.getHeight();

            // Load Logo and Signature
            const logoUrl = '/images/neco.png';
            const signatureUrl = '/images/signature.png';

            const [logoImg, signatureImg] = await Promise.all([
                new Promise<HTMLImageElement>((resolve, reject) => {
                    const img = new Image();
                    img.src = logoUrl;
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                }),
                new Promise<HTMLImageElement>((resolve, reject) => {
                    const img = new Image();
                    img.src = signatureUrl;
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                })
            ]);

            // Template Configurations
            const getTemplateConfig = () => {
                switch (reportTemplate) {
                    case 'NCEE':
                        return {
                            headerTitle: "NATIONAL EXAMINATIONS COUNCIL (NECO)",
                            headerColor: [0, 80, 160], // Blue-ish
                            tableHeaderColor: [0, 80, 160],
                            defaultTitle1: "2026 NATIONAL COMMON ENTRANCE EXAMINATION",
                            defaultTitle2: "NCEE OFFICERS POSTING LIST"
                        };
                    case 'ACCREDITATION':
                        return {
                            headerTitle: "NATIONAL EXAMINATIONS COUNCIL (NECO)",
                            headerColor: [180, 0, 0], // Red-ish
                            tableHeaderColor: [180, 0, 0],
                            defaultTitle1: "2026 ACCREDITATION EXERCISE",
                            defaultTitle2: "ACCREDITATION OFFICERS POSTING LIST"
                        };
                    case 'SSCE':
                    default:
                        return {
                            headerTitle: "NATIONAL EXAMINATIONS COUNCIL (NECO)",
                            headerColor: [0, 0, 0], // Black text for header, Green for table
                            tableHeaderColor: [4, 120, 87], // Green
                            defaultTitle1: reportTitle1 || "2026 SENIOR SCHOOL CERTIFICATE EXAMINATION (SSCE)",
                            defaultTitle2: reportTitle2 || "SSCE OFFICERS POSTING LIST"
                        };
                }
            };

            const config = getTemplateConfig();

            // --- Shared Page Draw Function (Define this right before the if block or inside shared scope) ---
            const drawPageContent = (data: any) => {
                const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
                const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();

                // --- Watermark ---
                doc.saveGraphicsState();
                doc.setGState(new (doc as any).GState({ opacity: 0.1 }));
                const wmWidth = 200;
                const aspectRatio = logoImg.width / logoImg.height;
                const wmH = wmWidth / aspectRatio;
                doc.addImage(logoImg, 'PNG', (width - wmWidth) / 2, (height - wmH) / 2, wmWidth, wmH);
                doc.restoreGraphicsState();

                // --- Header ---
                doc.addImage(logoImg, 'PNG', 15, 8, 20, 20 / aspectRatio);

                // Header Color Check inside function
                if (reportTemplate !== 'SSCE') {
                    doc.setTextColor(config.headerColor[0], config.headerColor[1], config.headerColor[2]);
                } else {
                    doc.setTextColor(0);
                }

                doc.setFontSize(18);
                doc.setFont("helvetica", "bold");
                doc.text(config.headerTitle, width / 2, 18, { align: 'center' });

                doc.setTextColor(0);
                doc.setFontSize(14);
                const t1 = reportTitle1 || config.defaultTitle1;
                if (t1) doc.text(t1.toUpperCase(), width / 2, 28, { align: 'center' });

                doc.setFontSize(12);
                const t2 = reportTitle2 || config.defaultTitle2;
                if (t2) doc.text(t2.toUpperCase(), width / 2, 34, { align: 'center' });

                // --- Signature ---
                const signatureY = pageHeight - 20;

                // Add actual signature image if available
                if (signatureImg) {
                    const sigWidth = 35;
                    const sigAspectRatio = signatureImg.width / signatureImg.height;
                    const sigH = sigWidth / sigAspectRatio;
                    // Position it above the name with better spacing (8 units gap)
                    doc.addImage(signatureImg, 'PNG', 15, signatureY - sigH - 8, sigWidth, sigH);
                }

                doc.setFontSize(11);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(0);
                doc.text("Prof. Dantani Ibrahim Wushishi", 15, signatureY);
                doc.setFontSize(10);
                doc.text("REG/CE", 15, signatureY + 5);

                // --- Footer ---
                doc.setFontSize(8);
                doc.setTextColor(100);
                doc.setFont("helvetica", "normal");
                doc.text(`Generated ${new Date().toLocaleDateString()} By NECO APCIC Manager`, 15, pageHeight - 10);
                doc.text(`Page ${(doc as any).internal.getNumberOfPages()}`, pageWidth - 15, pageHeight - 10, { align: 'right' });
            };

            // --- Shared Generation Logic ---

            // 1. Watermark (Every Page in didDrawPage) - Just setup here? 
            // We can just rely on didDrawPage.

            // 2. Table Data Generation
            if (reportTemplate === 'ACCREDITATION') {
                // Group by State (Venue)
                const groupedByState: { [key: string]: any[] } = {};
                // Create lookup for Qualification
                const apcMap = new Map<string, APCRecord>(apcRecords.map(a => [a.file_no, a] as [string, APCRecord]));

                filteredFlatRows.forEach(post => {
                    const stateKey = post.state || 'UNKNOWN STATE';
                    if (!groupedByState[stateKey]) groupedByState[stateKey] = [];
                    groupedByState[stateKey].push(post);
                });

                const sortedStates = Object.keys(groupedByState).sort();
                let currentY = 55; // Initial Start Y for first table

                const accreditationColumns = activeFields.map(f => f.label);
                if (!accreditationColumns.includes("S/N")) accreditationColumns.unshift("S/N");

                for (const state of sortedStates) {
                    const stateRows = groupedByState[state].map((post, index) => {
                        const apc = apcMap.get(post.file_no);
                        const rowData = activeFields.map(f => {
                            if (f.id === 'qualification') {
                                return apc?.qualification || '-';
                            }
                            return f.accessor(post);
                        });
                        return [index + 1, ...rowData];
                    });

                    // Check space for Title + Table Header (approx 20 + 20)
                    // If near bottom, add page
                    if (currentY > height - 40) {
                        doc.addPage();
                        currentY = 55;
                    }

                    // Print State Title
                    doc.setFontSize(12);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(config.tableHeaderColor[0], config.tableHeaderColor[1], config.tableHeaderColor[2]);
                    doc.text(state.toUpperCase(), 15, currentY);

                    // Generate dynamic column styles
                    const colStyles: any = { 0: { halign: 'center', cellWidth: 15 } };
                    activeFields.forEach((f, i) => {
                        colStyles[i + 1] = { cellWidth: f.pdfWidth || 'auto' };
                        if (f.id === 'conraiss' || f.id === 'count' || f.id === 'year') {
                            colStyles[i + 1].halign = 'center';
                        }
                    });

                    // Generate Table
                    autoTable(doc, {
                        head: [accreditationColumns],
                        body: stateRows,
                        startY: currentY + 5,
                        margin: { top: 45, bottom: 40 },
                        theme: 'grid',
                        styles: { fontSize: 11, cellPadding: 2, minCellHeight: 8 },
                        bodyStyles: { fontStyle: 'bold' },
                        headStyles: { fillColor: (config.tableHeaderColor as any), textColor: 255, fontStyle: 'bold' },
                        columnStyles: colStyles,
                        didDrawPage: (data) => {
                            // Use the shared didDrawPage logic, but we need to pass it here.
                            // Duplicating the function body for simplicity or defining it outside loop.
                            // Actually, since autoTable calls it, we can define it once above loop and pass it.
                            // BUT, didDrawPage in loop replaces the callback. 
                            // We should define `drawPageContent` function outside.
                            drawPageContent(data);
                        }
                    });

                    // Update Y for next table
                    currentY = (doc as any).lastAutoTable.finalY + 15;
                }

            } else {
                // SSCE / NCEE (Standard Single Table)
                const tableColumn = ["S/N", ...activeFields.map(f => f.label)];

                // Sort by State ascending
                const sortedRows = [...filteredFlatRows].sort((a, b) => {
                    const stateA = a.state || '';
                    const stateB = b.state || '';
                    return stateA.localeCompare(stateB);
                });

                const tableRows = sortedRows.map((post, index) => {
                    return [
                        index + 1,
                        ...activeFields.map(f => f.accessor(post))
                    ];
                });

                const colStyles: any = { 0: { halign: 'center', cellWidth: 15 } };
                activeFields.forEach((f, i) => {
                    colStyles[i + 1] = { cellWidth: f.pdfWidth || 'auto' };
                    if (f.id === 'conraiss' || f.id === 'count' || f.id === 'year') {
                        colStyles[i + 1].halign = 'center';
                    }
                });

                autoTable(doc, {
                    head: [tableColumn],
                    body: tableRows,
                    startY: 45,
                    margin: { top: 45, bottom: 40 },
                    theme: 'grid',
                    styles: { fontSize: 11, cellPadding: 2, minCellHeight: 8 },
                    bodyStyles: { fontStyle: 'bold' },
                    headStyles: { fillColor: (config.tableHeaderColor as any), textColor: 255, fontStyle: 'bold' },
                    columnStyles: colStyles,
                    alternateRowStyles: { fillColor: [240, 253, 244] },
                    didDrawPage: (data) => drawPageContent(data)
                });
            }

            doc.save(`NECO_${reportTemplate}_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            success("PDF Export successful!");
        } catch (err) {
            console.error("PDF Export failed:", err);
            error("Failed to export PDF. Ensure the logo exists at /images/neco.png");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#0b1015] p-6 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 overflow-y-auto">
            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 to-teal-800 dark:from-emerald-400 dark:to-teal-500 tracking-tight">
                        Generate Reports
                    </h1>
                    <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">
                        Filter and export posting assignment reports.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsConfigOpen(!isConfigOpen)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-bold text-xs shadow-sm transition-all ${isConfigOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white dark:bg-[#121b25] border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300'}`}
                    >
                        <span className="material-symbols-outlined text-lg">settings_suggest</span>
                        Customize Columns
                    </button>
                    <button
                        onClick={handlePDFExport}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 text-rose-600 dark:text-rose-400 font-bold text-xs shadow-sm hover:bg-slate-50 dark:hover:bg-gray-800 transition-all"
                        title="Export as PDF"
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

                {/* Column Customizer Panel */}
                {isConfigOpen && (
                    <div className="bg-indigo-50/30 dark:bg-indigo-900/10 p-5 rounded-xl border border-indigo-100 dark:border-indigo-900/30 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined">view_column</span>
                                Select Columns to Include in Reports
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedFieldIds(new Set(REPORT_FIELDS.map(f => f.id)))}
                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase"
                                >
                                    Select All
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                    onClick={() => setSelectedFieldIds(new Set(REPORT_FIELDS.filter(f => f.default).map(f => f.id)))}
                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase"
                                >
                                    Reset to Default
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                            {REPORT_FIELDS.map(field => (
                                <label key={field.id} className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            className="peer hidden"
                                            checked={selectedFieldIds.has(field.id)}
                                            onChange={(e) => {
                                                const next = new Set(selectedFieldIds);
                                                if (e.target.checked) next.add(field.id);
                                                else if (next.size > 1) next.delete(field.id);
                                                setSelectedFieldIds(next);
                                            }}
                                        />
                                        <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-all flex items-center justify-center">
                                            <span className="material-symbols-outlined text-white text-sm scale-0 peer-checked:scale-100 transition-transform">check</span>
                                        </div>
                                    </div>
                                    <span className={`text-xs font-bold transition-colors ${selectedFieldIds.has(field.id) ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-400 group-hover:text-slate-600'}`}>
                                        {field.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-indigo-100 dark:border-indigo-900/30 flex items-center gap-2 text-[10px] text-indigo-700/60 dark:text-indigo-400/60 italic">
                            <span className="material-symbols-outlined text-sm">info</span>
                            Changes are applied immediately to the preview table and all export formats (PDF, Excel, CSV).
                        </div>
                    </div>
                )}

                {/* PDF Template Selection */}
                <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">PDF Report Design</label>
                    <div className="flex gap-4">
                        {['SSCE', 'NCEE', 'ACCREDITATION'].map((template) => (
                            <label key={template} className={`flex-1 cursor-pointer relative px-4 py-3 rounded-lg border-2 transition-all duration-200 flex items-center justify-center gap-2 ${reportTemplate === template ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-emerald-200'}`}>
                                <input
                                    type="radio"
                                    name="reportTemplate"
                                    className="hidden"
                                    checked={reportTemplate === template}
                                    onChange={() => setReportTemplate(template)}
                                />
                                <span className={`material-symbols-outlined text-xl ${reportTemplate === template ? 'font-filled' : ''}`}>
                                    {template === 'SSCE' ? 'school' : template === 'NCEE' ? 'child_care' : 'verified'}
                                </span>
                                <span className="font-bold text-sm">{template}</span>
                                {reportTemplate === template && (
                                    <span className="absolute -top-2 -right-2 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                                        <span className="material-symbols-outlined text-[14px] font-bold block">check</span>
                                    </span>
                                )}
                            </label>
                        ))}
                    </div>
                </div>

                {/* Report Titles */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Report Title 1</label>
                        <input
                            type="text"
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-sm font-medium"
                            value={reportTitle1}
                            onChange={(e) => setReportTitle1(e.target.value)}
                            placeholder="e.g. 2026 SENIOR SCHOOL CERTIFICATE EXAMINATION (SSCE INTERNAL)"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Report Title 2</label>
                        <input
                            type="text"
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-sm font-medium"
                            value={reportTitle2}
                            onChange={(e) => setReportTitle2(e.target.value)}
                            placeholder="e.g. SSCE CUSTODIAN OFFICERS POSTING"
                        />
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Search Records</label>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="material-symbols-outlined text-slate-400">search</span>
                        </span>
                        <input
                            type="text"
                            className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-sm font-medium"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by Name, Station, or File No..."
                        />
                    </div>
                </div>

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
                                    {activeFields.map(field => (
                                        <th key={field.id} className={`p-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${field.id === 'count' ? 'text-center' : ''}`}>
                                            {field.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                                {loading ? (
                                    <tr><td colSpan={activeFields.length} className="p-8 text-center text-slate-500 italic">Loading data...</td></tr>
                                ) : paginatedRows.length === 0 ? (
                                    <tr><td colSpan={activeFields.length} className="p-8 text-center text-slate-500 italic">No records found.</td></tr>
                                ) : (
                                    paginatedRows.map((record) => (
                                        <tr key={record.uniqueId} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors duration-150">
                                            {activeFields.map(field => (
                                                <td key={field.id} className={`p-4 align-top ${field.id === 'count' ? 'text-center' : ''}`}>
                                                    {field.id === 'file_no' ? (
                                                        <span className="font-mono text-sm font-black text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded w-fit shadow-sm border border-slate-200 dark:border-slate-700">{field.accessor(record)}</span>
                                                    ) : field.id === 'name' ? (
                                                        <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">{field.accessor(record)}</span>
                                                    ) : field.id === 'conraiss' ? (
                                                        <span className="text-xs font-semibold text-sky-600 bg-sky-50 dark:bg-sky-900/20 dark:text-sky-300 px-2 py-0.5 rounded-full w-fit">
                                                            {field.accessor(record)}
                                                        </span>
                                                    ) : field.id === 'mandate' ? (
                                                        <span className="text-xs uppercase font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 dark:bg-emerald-900/50 dark:border-emerald-700 dark:text-emerald-300 px-2 py-1 rounded w-fit">
                                                            {field.accessor(record) || '-'}
                                                        </span>
                                                    ) : field.id === 'assignment' ? (
                                                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300 px-2 py-1 rounded">
                                                            {field.accessor(record) || '-'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{field.accessor(record) || '-'}</span>
                                                    )}
                                                </td>
                                            ))}
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
        </div >
    );
};

export default GeneratePage;