import React, { useEffect, useState, useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import * as XLSX from 'xlsx';
import { getAllDriverFinalPostings } from '../../services/driverFinalPosting';
import { getAllDriverAPCRecords } from '../../services/driverApc';
import { getAllStates } from '../../services/state';
import { DriverAPCRecord } from '../../types/driverApc';
import { useNotification } from '../../context/NotificationContext';
import { DriverPostingResponse } from '../../types/driverPosting';
import jspdf from 'jspdf';
import autoTable from 'jspdf-autotable';
import HelpModal from '../../components/HelpModal';
import { helpContent } from '../../data/helpContent';
import SearchableSelect from '../../components/SearchableSelect';

interface FlatPostingRow {
    uniqueId: string;
    originalId: string;
    file_no: string;
    name: string;
    station: string;
    conraiss: string;
    sex: string;
    assignment: string;
    mandate: string;
    venue: string;
    code: string;
    state: string;
    count: number;
    year: string;
    posted_for: any;
    to_be_posted: any;
    description?: string;
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
    const parts = venue.split('|').map(p => p.trim()).filter(Boolean);
    const uniqueParts: string[] = [];
    const seen = new Set<string>();
    for (const p of parts) {
        const lower = p.toLowerCase();
        if (!seen.has(lower)) {
            seen.add(lower);
            uniqueParts.push(p);
        }
    }
    return uniqueParts.join(' | ');
};

const REPORT_FIELDS: ReportField[] = [
    { id: 'file_no', label: 'FILE NO', accessor: r => r.file_no, default: true, pdfWidth: 25 },
    { id: 'name', label: 'NAME', accessor: r => r.name, default: true, pdfWidth: 50 },
    { id: 'sex', label: 'SEX', accessor: r => r.sex || '-', default: false, pdfWidth: 15 },
    { id: 'station', label: 'STATION', accessor: r => r.station, default: true, pdfWidth: 35 },
    { id: 'conraiss', label: 'CONR', accessor: r => r.conraiss, default: true, pdfWidth: 20 },
    { id: 'qualification', label: 'QUALIFICATION', accessor: r => '', default: false, pdfWidth: 40 },
    { id: 'mandate', label: 'MANDATE', accessor: r => r.mandate, default: true, pdfWidth: 40 },
    { id: 'assignment', label: 'ASSIGNMENT', accessor: r => r.assignment, default: true, pdfWidth: 40 },
    { id: 'code', label: 'CODE', accessor: r => r.code, default: true, pdfWidth: 20 },
    { id: 'venue', label: 'VENUE', accessor: r => formatVenueName(r.venue), default: true, pdfWidth: 60 },
    { id: 'count', label: 'NO. OF NIGHTS', accessor: r => r.count || 0, default: true, pdfWidth: 20 },
    { id: 'year', label: 'YEAR', accessor: r => r.year, default: false, pdfWidth: 20 },
    { id: 'state', label: 'STATE', accessor: r => r.state, default: true, pdfWidth: 30 },
    { id: 'description', label: 'DESCRIPTION', accessor: r => r.description || '-', default: true, pdfWidth: 40 }
];

const DriverPostingReports: React.FC = () => {
    const { success, error, warning } = useNotification();
    const [loading, setLoading] = useState(true);
    const [exportType, setExportType] = useState<'pdf' | 'csv' | 'xlsx' | null>(null);
    const [apcRecords, setApcRecords] = useState<DriverAPCRecord[]>([]);
    const [filterMandate, setFilterMandate] = useState('');
    const [filterAssignment, setFilterAssignment] = useState('');
    const [filterDescription, setFilterDescription] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 300);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [allFlatRows, setAllFlatRows] = useState<FlatPostingRow[]>([]);
    const [reportTitle1, setReportTitle1] = useState('');
    const [reportTitle2, setReportTitle2] = useState('');
    const [reportTitle3, setReportTitle3] = useState('');
    const [reportTemplate, setReportTemplate] = useState('SSCE');
    const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape'>('landscape');
    const [orderedFieldIds, setOrderedFieldIds] = useState<string[]>(REPORT_FIELDS.filter(f => f.default).map(f => f.id));
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        const widths: Record<string, number> = {};
        REPORT_FIELDS.forEach(f => { widths[f.id] = typeof f.pdfWidth === 'number' ? f.pdfWidth : 30; });
        return widths;
    });
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [sortBy, setSortBy] = useState<string>('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [showHelp, setShowHelp] = useState(false);

    const activeFields = useMemo(() => {
        const fieldMap = new Map(REPORT_FIELDS.map(f => [f.id, f]));
        return orderedFieldIds.map(id => fieldMap.get(id)).filter((f): f is ReportField => !!f);
    }, [orderedFieldIds]);

    useEffect(() => { fetchInitialData(); }, []);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [postingsData, activeAPC, statesData] = await Promise.all([
                getAllDriverFinalPostings(0, 100000),
                getAllDriverAPCRecords(true),
                getAllStates()
            ]);
            const flattened = flattenPostings(postingsData.items, statesData);
            setAllFlatRows(flattened);
            setApcRecords(activeAPC);
        } catch (err) {
            console.error("Failed to fetch data", err);
            error("Failed to fetch reporting data");
        } finally {
            setLoading(false);
        }
    };

    const flattenPostings = (postings: DriverPostingResponse[], states: any[]): FlatPostingRow[] => {
        const stateMap = new Map();
        states.forEach(s => stateMap.set(s.name.toLowerCase().trim(), s.name));

        const normalize = (s: string) => (s || '').toLowerCase().trim();
        const extractCode = (v: string) => {
            const m = v.match(/\((.*?)\)/);
            return m ? m[1] : '';
        };

        const result: FlatPostingRow[] = [];
        postings.forEach(p => {
            const mandates = p.mandates || [];
            const assignments = p.assignments || [];
            const venues = p.venue_code || [];

            const maxLen = Math.max(mandates.length, assignments.length, venues.length, 1);
            for (let i = 0; i < maxLen; i++) {
                const mName = mandates[i] || '';
                const aName = assignments[i] || '';
                const vName = venues[i] || '';
                const vCode = extractCode(vName);

                let state = (p.state && p.state[i]) || '';
                if (!state && vName.includes('|')) {
                    const parts = vName.split('|').map(x => x.trim());
                    if (parts.length >= 2) state = stateMap.get(normalize(parts[parts.length - 1])) || parts[parts.length - 1];
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
                    venue: vName,
                    code: vCode,
                    state: state || '-',
                    count: p.numb_of__nites || 0,
                    year: p.year || '-',
                    posted_for: p.posted_for || 0,
                    to_be_posted: p.to_be_posted || 0,
                    description: p.description || ''
                });
            }
        });
        return result;
    };

    const uniqueMandates = useMemo(() => Array.from(new Set(allFlatRows.map(r => r.mandate).filter(Boolean))).sort(), [allFlatRows]);
    const uniqueAssignments = useMemo(() => Array.from(new Set(allFlatRows.map(r => r.assignment).filter(Boolean))).sort(), [allFlatRows]);
    const uniqueDescriptions = useMemo(() => Array.from(new Set(allFlatRows.map(r => r.description).filter(Boolean))).sort(), [allFlatRows]);

    const filteredFlatRows = useMemo(() => {
        let result = allFlatRows;
        if (debouncedSearchQuery) {
            const lower = debouncedSearchQuery.toLowerCase().trim();
            result = result.filter(r => r.name?.toLowerCase().includes(lower) || r.file_no?.toLowerCase().includes(lower) || r.station?.toLowerCase().includes(lower));
        }
        if (filterMandate) result = result.filter(r => r.mandate === filterMandate);
        if (filterAssignment) result = result.filter(r => r.assignment === filterAssignment);
        if (filterDescription) result = result.filter(r => r.description === filterDescription);

        if (sortBy) {
            const field = REPORT_FIELDS.find(f => f.id === sortBy);
            if (field) {
                result = [...result].sort((a, b) => {
                    const valA = field.accessor(a);
                    const valB = field.accessor(b);
                    if (typeof valA === 'number' && typeof valB === 'number') return sortOrder === 'asc' ? valA - valB : valB - valA;
                    return sortOrder === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
                });
            }
        } else {
            result = [...result].sort((a, b) => {
                const conA = parseInt(a.conraiss?.replace(/\D/g, '') || '0', 10);
                const conB = parseInt(b.conraiss?.replace(/\D/g, '') || '0', 10);
                return conB - conA;
            });
        }
        return result;
    }, [allFlatRows, debouncedSearchQuery, filterMandate, filterAssignment, filterDescription, sortBy, sortOrder]);

    const total = filteredFlatRows.length;
    const paginatedRows = filteredFlatRows.slice((page - 1) * limit, page * limit);

    const handleExport = (type: 'xlsx' | 'csv') => {
        try {
            setExportType(type);
            const exportData = filteredFlatRows.map(record => {
                const row: any = {};
                activeFields.forEach(field => {
                    if (field.id === 'qualification') {
                        const apc = apcRecords.find(a => a.file_no === record.file_no);
                        row[field.label] = apc?.qualification || '-';
                    } else {
                        row[field.label] = field.accessor(record);
                    }
                });
                return row;
            });
            const ws = XLSX.utils.json_to_sheet(exportData);
            const fileName = `Driver_Posting_Report_${new Date().toISOString().split('T')[0]}.${type}`;
            if (type === 'xlsx') {
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Report");
                XLSX.writeFile(wb, fileName);
            } else {
                const csv = XLSX.utils.sheet_to_csv(ws);
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = fileName;
                link.click();
            }
            success(`${type.toUpperCase()} Export successful!`);
        } catch (err) {
            console.error("Export failed", err);
            error("Failed to export data.");
        } finally {
            setExportType(null);
        }
    };

    const handlePDFExport = async () => {
        try {
            setExportType('pdf');
            const doc = new jspdf(pdfOrientation === 'portrait' ? 'p' : 'l', 'mm', 'a4');
            const width = doc.internal.pageSize.getWidth();
            const height = doc.internal.pageSize.getHeight();
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
                    img.onerror = () => resolve(new Image());
                })
            ]);

            const config = {
                NCEE: { headerTitle: "NATIONAL EXAMINATIONS COUNCIL (NECO)", tableHeaderColor: [0, 80, 160], defaultTitle1: "DRIVER POSTING LIST" },
                ACCREDITATION: { headerTitle: "NATIONAL EXAMINATIONS COUNCIL (NECO)", tableHeaderColor: [180, 0, 0], defaultTitle1: "DRIVER POSTING LIST" },
                SSCE: { headerTitle: "NATIONAL EXAMINATIONS COUNCIL (NECO)", tableHeaderColor: [4, 120, 87], defaultTitle1: "DRIVER POSTING LIST" },
                MARKING: { headerTitle: "NATIONAL EXAMINATIONS COUNCIL (NECO)", tableHeaderColor: [0, 128, 0], defaultTitle1: "DRIVER POSTING LIST" }
            }[reportTemplate as keyof typeof config] || { headerTitle: "NATIONAL EXAMINATIONS COUNCIL (NECO)", tableHeaderColor: [4, 120, 87], defaultTitle1: "DRIVER POSTING LIST" };

            const drawPageContent = (data: any) => {
                doc.saveGraphicsState();
                doc.setGState(new (doc as any).GState({ opacity: 0.1 }));
                const wmWidth = pdfOrientation === 'portrait' ? 150 : 200;
                const aspectRatio = logoImg.width / logoImg.height;
                const wmH = wmWidth / aspectRatio;
                doc.addImage(logoImg, 'PNG', (width - wmWidth) / 2, (height - wmH) / 2, wmWidth, wmH);
                doc.restoreGraphicsState();

                const logoSize = pdfOrientation === 'portrait' ? 15 : 20;
                doc.addImage(logoImg, 'PNG', 15, 8, logoSize, logoSize / aspectRatio);
                doc.setTextColor(4, 120, 87);
                doc.setFontSize(pdfOrientation === 'portrait' ? 17 : 18);
                doc.setFont("helvetica", "bold");
                doc.text(config.headerTitle, width / 2, 18, { align: 'center' });
                doc.setTextColor(0);
                doc.setFontSize(pdfOrientation === 'portrait' ? 13 : 14);
                if (reportTitle1 || config.defaultTitle1) doc.text((reportTitle1 || config.defaultTitle1).toUpperCase(), width / 2, 28, { align: 'center' });
                if (reportTitle2) doc.text(reportTitle2.toUpperCase(), width / 2, 34, { align: 'center' });
                if (reportTitle3) doc.text(reportTitle3.toUpperCase(), width / 2, 44, { align: 'center' });

                const signatureY = height - 20;
                if (signatureImg && signatureImg.src) {
                    const sigWidth = 35;
                    const sigH = sigWidth / (signatureImg.width / signatureImg.height);
                    doc.addImage(signatureImg, 'PNG', 15, signatureY - sigH - 8, sigWidth, sigH);
                }
                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");
                doc.text("Prof. Dantani Ibrahim Wushishi", 15, signatureY);
                doc.text("REG/CE", 15, signatureY + 5);
                doc.setFont("helvetica", "normal");
                doc.text(`Generated ${new Date().toLocaleDateString('en-GB')} By NECO APCIC Manager`, 15, height - 10);
                doc.text(`Page ${(doc as any).internal.getNumberOfPages()}`, width - 15, height - 10, { align: 'right' });
            };

            const apcMap = new Map(apcRecords.map(a => [a.file_no, a]));
            const tableColumn = ["S/N", ...activeFields.map(f => f.label)];
            const tableRows = filteredFlatRows.map((post, index) => [
                index + 1,
                ...activeFields.map(f => {
                    if (f.id === 'qualification') {
                        const apc = apcMap.get(post.file_no) as DriverAPCRecord | undefined;
                        return apc?.qualification || '-';
                    }
                    return f.accessor(post);
                })
            ]);

            const colStyles: any = { 0: { halign: 'center', cellWidth: 15 } };
            activeFields.forEach((f, i) => {
                colStyles[i + 1] = { cellWidth: columnWidths[f.id] || 'auto' };
                if (['conraiss', 'count', 'year'].includes(f.id)) colStyles[i + 1].halign = 'center';
            });

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 50,
                theme: 'grid',
                styles: { fontSize: pdfOrientation === 'portrait' ? 12 : 11, cellPadding: 2 },
                headStyles: { fillColor: config.tableHeaderColor as any, textColor: 255 },
                columnStyles: colStyles,
                didDrawPage: drawPageContent
            });

            doc.save(`Driver_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            success("PDF Export successful!");
        } catch (err) {
            console.error("PDF Export failed:", err);
            error("Failed to export PDF.");
        } finally {
            setExportType(null);
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-full bg-background-light dark:bg-[#0b1015] p-4 md:p-8 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
            {exportType && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center">
                    <div className="bg-white dark:bg-[#121b25] p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full mx-4">
                        <div className="w-20 h-20 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                        <h3 className="text-xl font-black">Generating {exportType.toUpperCase()} Report</h3>
                    </div>
                </div>
            )}

            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 to-teal-800 dark:from-emerald-400 dark:to-teal-500">
                        Driver Posting Reports
                    </h1>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setIsConfigOpen(!isConfigOpen)} className="px-4 py-2 rounded-lg border font-bold text-xs bg-white dark:bg-[#121b25] border-slate-200 dark:border-gray-700">Customize Columns</button>
                    <button onClick={handlePDFExport} className="px-4 py-2 rounded-lg bg-white dark:bg-[#121b25] border border-slate-200 text-rose-600 font-bold text-xs">PDF</button>
                    <button onClick={() => handleExport('csv')} className="px-4 py-2 rounded-lg bg-white dark:bg-[#121b25] border border-slate-200 text-emerald-600 font-bold text-xs">CSV</button>
                    <button onClick={() => handleExport('xlsx')} className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs">Excel</button>
                </div>
            </div>

            <div className="bg-white dark:bg-[#121b25] rounded-2xl shadow-xl p-6 flex flex-col gap-6">
                {isConfigOpen && (
                    <div className="bg-indigo-50/30 dark:bg-indigo-900/10 p-5 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                        <div className="flex flex-wrap gap-2">
                            {activeFields.map((field, idx) => (
                                <div key={field.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 bg-white dark:bg-slate-800">
                                    <button onClick={() => setOrderedFieldIds(prev => prev.filter(id => id !== field.id))} className="material-symbols-outlined text-sm text-indigo-500">check_circle</button>
                                    <span className="text-xs font-bold">{field.label}</span>
                                    <div className="flex items-center gap-1 border-l pl-2">
                                        <input type="number" value={columnWidths[field.id] || 0} onChange={e => setColumnWidths(prev => ({ ...prev, [field.id]: parseInt(e.target.value) || 0 }))} className="w-10 h-5 text-[10px] border rounded text-center bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input type="text" placeholder="Search..." className="h-10 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] text-sm outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    <select className="h-10 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] text-sm outline-none" value={filterMandate} onChange={e => setFilterMandate(e.target.value)}>
                        <option value="">All Mandates</option>
                        {uniqueMandates.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select className="h-10 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] text-sm outline-none" value={filterAssignment} onChange={e => setFilterAssignment(e.target.value)}>
                        <option value="">All Assignments</option>
                        {uniqueAssignments.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <select className="h-10 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] text-sm outline-none" value={filterDescription} onChange={e => setFilterDescription(e.target.value)}>
                        <option value="">All Descriptions</option>
                        {uniqueDescriptions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-800">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-[#0f161d] border-b">
                            <tr>
                                {activeFields.map(f => (
                                    <th key={f.id} className="p-4 text-[10px] font-black uppercase text-slate-500">{f.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr><td colSpan={activeFields.length} className="p-8 text-center italic">Loading...</td></tr>
                            ) : paginatedRows.map(r => (
                                <tr key={r.uniqueId} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    {activeFields.map(f => (
                                        <td key={f.id} className="p-4 text-xs font-medium">{f.id === 'file_no' ? <span className="font-mono font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 border rounded">{f.accessor(r)}</span> : f.accessor(r)}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Total: {total} records</span>
                    <div className="flex gap-2">
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-50 text-xs font-bold">Prev</button>
                        <span className="px-3 py-1 text-xs font-bold">{page}</span>
                        <button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-50 text-xs font-bold">Next</button>
                    </div>
                </div>
            </div>
            {showHelp && <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} content={helpContent.postingReports} />}
        </div>
    );
};

export default DriverPostingReports;
