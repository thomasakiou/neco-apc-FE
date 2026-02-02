import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { getAllDriverPostings, bulkDeleteDriverPostings, deleteDriverPosting, updateDriverPosting, bulkCreateDriverPostings } from '../../services/driverPosting';
import { archiveDriverFinalPostings } from '../../services/driverFinalPosting';
import { getAllAssignments } from '../../services/assignment';
import { DriverPostingResponse, DriverPostingCreate } from '../../types/driverPosting';
import { Assignment } from '../../types/assignment';
import { useNotification } from '../../context/NotificationContext';
import HelpModal from '../../components/HelpModal';
import { helpContent } from '../../data/helpContent';
import { getAllDriverAPCRecords, updateDriverAPC, assignmentFieldMap, getAssignmentLimit } from '../../services/driverApc';
import { DriverAPCRecord } from '../../types/driverApc';

interface ReportField {
    id: string;
    label: string;
    accessor: (row: DriverPostingResponse) => any;
    default: boolean;
    pdfWidth?: number;
}

const REPORT_FIELDS: ReportField[] = [
    { id: 'file_no', label: 'FILE NO', accessor: r => r.file_no, default: true, pdfWidth: 25 },
    { id: 'name', label: 'NAME', accessor: r => r.name, default: true, pdfWidth: 45 },
    { id: 'sex', label: 'SEX', accessor: r => r.sex || '-', default: false, pdfWidth: 15 },
    { id: 'station', label: 'STATION', accessor: r => r.station || '-', default: true, pdfWidth: 30 },
    { id: 'state', label: 'STATE', accessor: r => (Array.isArray(r.state) ? r.state.join(', ') : r.state) || '-', default: true, pdfWidth: 30 },
    { id: 'conraiss', label: 'CONRAISS', accessor: r => r.conraiss || '-', default: true, pdfWidth: 25 },
    { id: 'qualification', label: 'QUALIFICATION', accessor: r => r.qualification || '-', default: false, pdfWidth: 30 },
    { id: 'code', label: 'CODE', accessor: r => (Array.isArray(r.venue_code) ? r.venue_code.join(', ') : r.venue_code) || '-', default: true, pdfWidth: 25 },
    { id: 'assignment', label: 'ASSIGNMENT', accessor: r => (r.assignments || []).join(', ') || '-', default: true, pdfWidth: 45 },
    { id: 'mandate', label: 'MANDATE', accessor: r => (r.mandates || []).join(', ') || '-', default: true, pdfWidth: 40 },
    { id: 'venue', label: 'VENUE', accessor: r => (Array.isArray(r.assignment_venue) ? r.assignment_venue.join(' | ') : r.assignment_venue) || '-', default: true, pdfWidth: 60 },
    { id: 'count', label: 'NO. OF NIGHTS', accessor: r => r.numb_of__nites || 0, default: false, pdfWidth: 20 },
    { id: 'description', label: 'DESCRIPTION', accessor: r => r.description || '-', default: false, pdfWidth: 50 },
    { id: 'year', label: 'YEAR', accessor: r => r.year || '-', default: false, pdfWidth: 20 },
];

const DriverPostingReports: React.FC = () => {
    const { success, error, warning } = useNotification();
    const [postings, setPostings] = useState<DriverPostingResponse[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);
    const [searchFileNo, setSearchFileNo] = useState('');
    const [searchName, setSearchName] = useState('');
    const [filterAssignment, setFilterAssignment] = useState('');
    const [filterVenue, setFilterVenue] = useState('');
    const debouncedFileNo = useDebounce(searchFileNo, 300);
    const debouncedName = useDebounce(searchName, 300);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [orderedFieldIds, setOrderedFieldIds] = useState<string[]>(REPORT_FIELDS.filter(f => f.default).map(f => f.id));
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [reportTitle1, setReportTitle1] = useState('');
    const [reportTitle2, setReportTitle2] = useState('');
    const [reportTemplate, setReportTemplate] = useState('SSCE');
    const [exportType, setExportType] = useState<'pdf' | 'csv' | 'xlsx' | null>(null);
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        const widths: Record<string, number> = {};
        REPORT_FIELDS.forEach(f => {
            widths[f.id] = f.pdfWidth || 30;
        });
        return widths;
    });
    const [showHelp, setShowHelp] = useState(false);

    // Swap and Replace State
    const [swapSource, setSwapSource] = useState<DriverPostingResponse | null>(null);
    const [replacementSource, setReplacementSource] = useState<DriverPostingResponse | null>(null);
    const [isReplacementModalOpen, setIsReplacementModalOpen] = useState(false);
    const [replacementPool, setReplacementPool] = useState<DriverAPCRecord[]>([]);
    const [modalSearchFileNo, setModalSearchFileNo] = useState('');
    const [modalSearchName, setModalSearchName] = useState('');
    const [modalSearchConraiss, setModalSearchConraiss] = useState('');

    const activeFields = useMemo(() => {
        const fieldMap = new Map(REPORT_FIELDS.map(f => [f.id, f]));
        return orderedFieldIds.map(id => fieldMap.get(id)).filter((f): f is ReportField => !!f);
    }, [orderedFieldIds]);

    const fetchData = useCallback(async (force: boolean = false) => {
        try {
            setLoading(true);
            const [postingsData, assignmentsData] = await Promise.all([
                getAllDriverPostings(force),
                getAllAssignments(force)
            ]);
            setPostings(postingsData || []);
            setAssignments(assignmentsData || []);
        } catch (err) {
            console.error("Failed to fetch data", err);
            error('Failed to load Driver postings.');
        } finally {
            setLoading(false);
        }
    }, [error]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleExecuteSwap = useCallback(async (target: DriverPostingResponse) => {
        if (!swapSource) return;
        try {
            setLoading(true);

            // 1. Mandate Validation
            const sourceMandates = swapSource.mandates || [];
            const targetMandates = target.mandates || [];
            const sharedMandates = sourceMandates.filter(m => targetMandates.includes(m));

            if (sharedMandates.length === 0) {
                throw new Error(`Staff members must share the same mandate to swap venues. ${swapSource.name} and ${target.name} do not share any mandates.`);
            }

            // 2. Prepare New Posting Records (Venue-based Swap)
            const isSameCount = (swapSource.assignments || []).length === (target.assignments || []).length;
            if (!isSameCount) {
                throw new Error(`Staff members must have the same number of assignments to swap venues.`);
            }

            await Promise.all([
                updateDriverPosting(swapSource.id, {
                    assignment_venue: [...(target.assignment_venue || [])],
                    venue_code: [...(target.venue_code || [])],
                    state: [...(target.state || [])]
                }),
                updateDriverPosting(target.id, {
                    assignment_venue: [...(swapSource.assignment_venue || [])],
                    venue_code: [...(swapSource.venue_code || [])],
                    state: [...(swapSource.state || [])]
                })
            ]);

            setSwapSource(null);
            await fetchData();
            success(`Successfully swapped venues between ${swapSource.name} and ${target.name}.`);
        } catch (err: any) {
            console.error("Swap failed", err);
            error(err.message || "Failed to execute swap.");
        } finally {
            setLoading(false);
        }
    }, [swapSource, fetchData, success, error]);

    const handleExecuteReplacement = useCallback(async (targetAPC: DriverAPCRecord) => {
        if (!replacementSource) return;
        try {
            setLoading(true);

            // Fetch Source Staff APC Record to update (Return to Pool)
            const allAPC = await getAllDriverAPCRecords(false);
            const sourceAPC = allAPC.find(a => a.file_no === replacementSource.file_no);

            if (!sourceAPC) throw new Error("Original staff not found in Driver APC database.");

            // Prepare New Posting
            const numberOfAssignments = (replacementSource.assignments || []).length;

            const newTargetRecord: DriverPostingCreate = {
                file_no: targetAPC.file_no,
                name: targetAPC.name,
                station: targetAPC.station,
                conraiss: targetAPC.conraiss || '',
                year: replacementSource.year,
                numb_of__nites: replacementSource.numb_of__nites || 0,
                posted_for: numberOfAssignments,
                to_be_posted: getAssignmentLimit(targetAPC.conraiss) - numberOfAssignments,
                assignments: replacementSource.assignments || [],
                mandates: replacementSource.mandates || [],
                assignment_venue: replacementSource.assignment_venue || [],
                venue_code: replacementSource.venue_code || [],
                description: replacementSource.description || '',
                state: replacementSource.state,
                sex: targetAPC.sex || 'M',
                qualification: targetAPC.qualification || null,
            };

            // Update Source APC (Return to Pool)
            const sourceUpdatePayload: any = {};
            (replacementSource.assignments || []).forEach((code: string) => {
                const field = assignmentFieldMap[code];
                if (field) sourceUpdatePayload[field] = 'Returned';
            });

            await updateDriverAPC(sourceAPC.id, sourceUpdatePayload);

            // Update Target APC (Assign Posting)
            const targetUpdatePayload: any = {};
            (replacementSource.assignments || []).forEach((code: string, idx: number) => {
                const field = assignmentFieldMap[code];
                if (field) {
                    targetUpdatePayload[field] = (replacementSource.venue_code || [])[idx] || '';
                }
            });
            await updateDriverAPC(targetAPC.id, targetUpdatePayload);

            // Mod Postings: Delete old, Create new
            await Promise.all([
                deleteDriverPosting(replacementSource.id),
                bulkCreateDriverPostings({ items: [newTargetRecord] })
            ]);

            success(`Successfully replaced ${replacementSource.name} with ${targetAPC.name}`);
            setIsReplacementModalOpen(false);
            setReplacementSource(null);
            await fetchData();

        } catch (err: any) {
            console.error("Replacement failed", err);
            error(err.message || "Failed to replace staff.");
        } finally {
            setLoading(false);
        }
    }, [replacementSource, fetchData, success, error]);

    const filteredReplacementPool = useMemo(() => {
        return replacementPool.filter(staff => {
            const matchesFileNo = !modalSearchFileNo || staff.file_no.toLowerCase().includes(modalSearchFileNo.toLowerCase());
            const matchesName = !modalSearchName || staff.name.toLowerCase().includes(modalSearchName.toLowerCase());
            const matchesConraiss = !modalSearchConraiss || staff.conraiss?.toLowerCase().includes(modalSearchConraiss.toLowerCase());
            return matchesFileNo && matchesName && matchesConraiss;
        });
    }, [replacementPool, modalSearchFileNo, modalSearchName, modalSearchConraiss]);

    const uniqueAssignments = useMemo(() => {
        const set = new Set<string>();
        postings.forEach(p => p.assignments?.forEach((a: string) => { if (a) set.add(a); }));
        return Array.from(set).sort();
    }, [postings]);

    const uniqueVenues = useMemo(() => {
        const set = new Set<string>();
        postings.forEach(p => p.venue_code?.forEach((v: string) => { if (v) set.add(v); }));
        return Array.from(set).sort();
    }, [postings]);

    const filteredPostings = useMemo(() => {
        let result = postings;
        if (debouncedFileNo) result = result.filter(p => p.file_no?.toLowerCase().includes(debouncedFileNo.toLowerCase()));
        if (debouncedName) result = result.filter(p => p.name?.toLowerCase().includes(debouncedName.toLowerCase()));
        if (filterAssignment) result = result.filter(p => p.assignments?.includes(filterAssignment));
        if (filterVenue) result = result.filter(p => p.venue_code?.includes(filterVenue));
        return result;
    }, [postings, debouncedFileNo, debouncedName, filterAssignment, filterVenue]);

    const total = filteredPostings.length;
    const paginatedPostings = useMemo(() => filteredPostings.slice((page - 1) * limit, page * limit), [filteredPostings, page, limit]);

    const handleSelectAll = (checked: boolean) => setSelectedIds(checked ? new Set(filteredPostings.map(p => p.id)) : new Set());
    const handleSelectOne = (id: string, checked: boolean) => setSelectedIds(prev => { const next = new Set(prev); checked ? next.add(id) : next.delete(id); return next; });

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0 || !window.confirm(`Delete ${selectedIds.size} posting(s)?`)) return;
        try {
            setLoading(true);
            await bulkDeleteDriverPostings(Array.from(selectedIds));
            success(`Deleted ${selectedIds.size} postings.`);
            setSelectedIds(new Set());
            fetchData(true);
        } catch (err: any) {
            error(`Failed to delete: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSingleDelete = async (record: DriverPostingResponse) => {
        if (!window.confirm(`Delete posting for ${record.name}?`)) return;
        try {
            setLoading(true);
            await deleteDriverPosting(record.id);
            success("Posting deleted.");
            fetchData(true);
        } catch (err: any) {
            error(`Failed to delete: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCommitToFinal = async () => {
        if (postings.length === 0) { warning('No postings to commit.'); return; }
        if (!window.confirm('Commit postings to Final Driver Postings?')) return;
        try {
            setLoading(true);
            await archiveDriverFinalPostings();
            success('Successfully committed postings to Final!');
            fetchData(true);
        } catch (err: any) {
            error(`Failed to commit: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCSVExport = () => {
        if (filteredPostings.length === 0) { error('No postings to export.'); return; }
        setExportType('csv');
        try {
            const headers = activeFields.map(f => f.label);
            const rows = filteredPostings.map(p => activeFields.map(f => f.accessor(p)));
            const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Driver_Posting_Report_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            success('CSV exported!');
        } catch { error('Failed to export CSV.'); } finally { setExportType(null); }
    };

    const handleExcelExport = () => {
        if (filteredPostings.length === 0) { error('No postings to export.'); return; }
        setExportType('xlsx');
        try {
            const headers = activeFields.map(f => f.label);
            const rows = filteredPostings.map(p => activeFields.map(f => f.accessor(p)));
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Driver Postings");
            XLSX.writeFile(wb, `Driver_Posting_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
            success('Excel exported!');
        } catch { error('Failed to export Excel.'); } finally { setExportType(null); }
    };

    const handlePDFExport = async () => {
        if (filteredPostings.length === 0) { error('No postings to export.'); return; }
        setExportType('pdf');
        try {
            const doc = new jsPDF('l', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.src = '/images/neco.png'; img.onload = () => resolve(img); img.onerror = reject; });
            const signatureImg = await new Promise<HTMLImageElement | null>((resolve) => { const img = new Image(); img.src = '/images/signature.png'; img.onload = () => resolve(img); img.onerror = () => resolve(null); });

            const config = { NCEE: { color: [0, 80, 160] }, ACCREDITATION: { color: [180, 0, 0] }, SSCE: { color: [0, 128, 0] }, MARKING: { color: [0, 128, 0] } }[reportTemplate as keyof typeof Object] || { color: [0, 128, 0] };

            const drawPageHeader = (data: any) => {
                const aspectRatio = logoImg.width / logoImg.height;
                doc.saveGraphicsState();
                doc.setGState(new (doc as any).GState({ opacity: 0.1 }));
                doc.addImage(logoImg, 'PNG', (pageWidth - 140) / 2, (pageHeight - 140 / aspectRatio) / 2, 140, 140 / aspectRatio);
                doc.restoreGraphicsState();
                doc.addImage(logoImg, 'PNG', 15, 8, 20, 20 / aspectRatio);
                doc.setTextColor((config as any).color[0], (config as any).color[1], (config as any).color[2]);
                doc.setFontSize(18); doc.setFont("helvetica", "bold");
                doc.text("NATIONAL EXAMINATIONS COUNCIL (NECO)", pageWidth / 2, 18, { align: 'center' });
                doc.setTextColor(0, 0, 0); doc.setFontSize(14);
                if (reportTitle1) doc.text(reportTitle1.toUpperCase(), pageWidth / 2, 26, { align: 'center' });
                if (reportTitle2) { doc.setFontSize(12); doc.text(reportTitle2.toUpperCase(), pageWidth / 2, 32, { align: 'center' }); }
                doc.setFontSize(10); doc.setTextColor(100);
                doc.text(`Page ${data.pageNumber}`, pageWidth - 15, pageHeight - 10, { align: 'right' });
                doc.text(`Generated: ${new Date().toLocaleString()}`, 15, pageHeight - 10);
                if (signatureImg) { const sigW = 35; doc.addImage(signatureImg, 'PNG', 15, pageHeight - 35, sigW, sigW / (signatureImg.width / signatureImg.height)); }
                doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
                doc.text("Prof. Dantani Ibrahim Wushishi", 15, pageHeight - 20);
                doc.setFontSize(10); doc.text("REG/CE", 15, pageHeight - 15);
            };

            const headers = activeFields.map(f => f.label);
            const tableData = filteredPostings.map(p => activeFields.map(f => f.accessor(p)));

            const columnStyles: any = {};
            activeFields.forEach((field, idx) => {
                columnStyles[idx] = { cellWidth: columnWidths[field.id] || 'auto' };
            });

            autoTable(doc, {
                head: [headers], body: tableData, startY: 40, theme: 'grid',
                headStyles: { fillColor: (config as any).color, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
                bodyStyles: { fontSize: 10.5, cellPadding: 3, fontStyle: 'bold', overflow: 'linebreak' },
                columnStyles, margin: { top: 40, bottom: 45, left: 15, right: 15 }, didDrawPage: drawPageHeader
            });
            doc.save(`Driver_Posting_Report_${reportTemplate}_${new Date().toISOString().split('T')[0]}.pdf`);
            success(`${reportTemplate} report generated!`);
        } catch (err) { console.error(err); error('Failed to generate PDF.'); } finally { setExportType(null); }
    };

    const clearFilters = () => { setSearchFileNo(''); setSearchName(''); setFilterAssignment(''); setFilterVenue(''); setPage(1); };

    return (
        <div className="flex-1 flex flex-col min-h-full bg-slate-50 dark:bg-[#0b1015] p-4 md:p-8 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
            {/* Header */}
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400 drop-shadow-sm tracking-tight">
                        Driver Postings Table
                    </h1>
                    <p className="mt-1 text-slate-500 dark:text-slate-400 font-medium">View and manage all generated Driver postings.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {selectedIds.size > 0 && <button onClick={handleBulkDelete} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-rose-600 rounded-lg shadow-lg hover:bg-rose-700"><span className="material-symbols-outlined text-lg">delete</span>Delete ({selectedIds.size})</button>}
                    <button onClick={() => setShowHelp(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all shadow-sm font-bold text-xs" title="Help"><span className="material-symbols-outlined text-lg">help</span>Help</button>
                    <button onClick={() => fetchData(true)} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 text-emerald-600 dark:text-emerald-400 font-bold text-xs shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20"><span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>Refresh</button>
                    <button onClick={() => setIsConfigOpen(!isConfigOpen)} className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-bold text-xs shadow-sm transition-all ${isConfigOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white dark:bg-[#121b25] border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300'}`}><span className="material-symbols-outlined text-lg">settings_suggest</span>Customize</button>
                    <button onClick={handlePDFExport} disabled={loading || filteredPostings.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 text-rose-600 dark:text-rose-400 font-bold text-xs shadow-sm disabled:opacity-50"><span className="material-symbols-outlined text-lg">picture_as_pdf</span>PDF</button>
                    <button onClick={handleCSVExport} disabled={loading || filteredPostings.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 text-emerald-600 dark:text-emerald-400 font-bold text-xs shadow-sm disabled:opacity-50"><span className="material-symbols-outlined text-lg">csv</span>CSV</button>
                    <button onClick={handleExcelExport} disabled={loading || filteredPostings.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg disabled:opacity-50"><span className="material-symbols-outlined text-lg">table_view</span>Excel</button>
                    <div className="h-6 w-px bg-slate-300 dark:bg-gray-700 mx-1"></div>
                    <button onClick={handleCommitToFinal} disabled={loading || postings.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg disabled:opacity-50" title="Commit to Final"><span className="material-symbols-outlined text-lg">verified</span>Commit</button>
                </div>
            </div>

            {/* Export Loading Overlay */}
            {exportType && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white dark:bg-[#121b25] p-8 rounded-3xl shadow-2xl border border-slate-200 dark:border-gray-800 flex flex-col items-center gap-6 max-w-sm w-full mx-4">
                        <div className="relative"><div className="w-20 h-20 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div><div className="absolute inset-0 flex items-center justify-center"><span className="material-symbols-outlined text-2xl text-emerald-500">{exportType === 'pdf' ? 'picture_as_pdf' : exportType === 'csv' ? 'csv' : 'table_view'}</span></div></div>
                        <div className="text-center"><h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">Generating {exportType.toUpperCase()} Report</h3><p className="text-sm font-medium text-slate-500 dark:text-slate-400">Please wait...</p></div>
                        <div className="flex items-center gap-2 text-xs text-slate-400"><span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>Processing {filteredPostings.length} records</div>
                    </div>
                </div>
            )}

            {/* Column Customization Panel */}
            {isConfigOpen && (
                <div className="bg-indigo-50/30 dark:bg-indigo-900/10 p-5 rounded-xl border border-indigo-100 dark:border-indigo-900/30 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-2"><span className="material-symbols-outlined">view_column</span>Customize Report Columns</h3>
                        <div className="flex gap-2"><button onClick={() => setOrderedFieldIds(REPORT_FIELDS.map(f => f.id))} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase">Select All</button><span className="text-slate-300">|</span><button onClick={() => setOrderedFieldIds(REPORT_FIELDS.filter(f => f.default).map(f => f.id))} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase">Reset</button></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div><label className="block text-[10px] font-black text-indigo-400 uppercase mb-2 tracking-widest">Report Template</label><select value={reportTemplate} onChange={(e) => setReportTemplate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-900/50 bg-white dark:bg-[#0f161d] text-sm font-bold"><option value="SSCE">SSCE Format (Green)</option><option value="NCEE">NCEE Format (Blue)</option><option value="ACCREDITATION">Accreditation Format (Red)</option><option value="MARKING">Marking Format (Green)</option></select></div>
                        <div><label className="block text-[10px] font-black text-indigo-400 uppercase mb-2 tracking-widest">Main Title</label><input type="text" value={reportTitle1} onChange={(e) => setReportTitle1(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-900/50 bg-white dark:bg-[#0f161d] text-sm font-medium" placeholder="Optional" /></div>
                        <div><label className="block text-[10px] font-black text-indigo-400 uppercase mb-2 tracking-widest">Sub Title</label><input type="text" value={reportTitle2} onChange={(e) => setReportTitle2(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-900/50 bg-white dark:bg-[#0f161d] text-sm font-medium" placeholder="Optional" /></div>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-indigo-400 uppercase mb-3 block tracking-widest">Active Columns ({activeFields.length})</label>
                            <div className="flex flex-wrap gap-2">
                                {activeFields.map((field, idx) => (
                                    <div key={field.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-900/20 shadow-sm">
                                        <button onClick={() => { if (orderedFieldIds.length > 1) setOrderedFieldIds(prev => prev.filter(id => id !== field.id)); }} className="w-6 h-6 rounded-lg bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600">
                                            <span className="material-symbols-outlined text-sm font-bold">check</span>
                                        </button>
                                        <span className="text-xs font-bold text-indigo-900 dark:text-indigo-100">{field.label}</span>
                                        <div className="flex gap-0.5 ml-1 border-l border-indigo-200 dark:border-indigo-900/50 pl-1">
                                            <button onClick={() => { if (idx > 0) { const n = [...orderedFieldIds];[n[idx], n[idx - 1]] = [n[idx - 1], n[idx]]; setOrderedFieldIds(n); } }} disabled={idx === 0} className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center hover:bg-indigo-200 disabled:opacity-30">
                                                <span className="material-symbols-outlined text-xs">chevron_left</span>
                                            </button>
                                            <button onClick={() => { if (idx < orderedFieldIds.length - 1) { const n = [...orderedFieldIds];[n[idx], n[idx + 1]] = [n[idx + 1], n[idx]]; setOrderedFieldIds(n); } }} disabled={idx === orderedFieldIds.length - 1} className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center hover:bg-indigo-200 disabled:opacity-30">
                                                <span className="material-symbols-outlined text-xs">chevron_right</span>
                                            </button>
                                        </div>
                                        <div className="border-l border-indigo-200 dark:border-indigo-900/50 pl-2 ml-1 flex items-center gap-1">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase">W:</span>
                                            <input
                                                type="number"
                                                value={columnWidths[field.id] || 0}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    setColumnWidths(prev => ({ ...prev, [field.id]: val }));
                                                }}
                                                className="w-10 h-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-[10px] text-center font-bold outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {REPORT_FIELDS.filter(f => !orderedFieldIds.includes(f.id)).length > 0 && (<div><label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Available Columns</label><div className="flex flex-wrap gap-2">{REPORT_FIELDS.filter(f => !orderedFieldIds.includes(f.id)).map(field => (<button key={field.id} onClick={() => setOrderedFieldIds(prev => [...prev, field.id])} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 dark:border-gray-700 dark:bg-gray-800 hover:border-indigo-300 hover:bg-indigo-50"><span className="w-6 h-6 rounded-lg border-2 border-dashed border-slate-300 dark:border-gray-600 flex items-center justify-center"><span className="material-symbols-outlined text-sm text-slate-400">add</span></span><span className="text-xs font-bold text-slate-600 dark:text-slate-300">{field.label}</span></button>))}</div></div>)}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white dark:bg-[#121b25] p-4 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">File No</label><input type="text" placeholder="Search..." className="w-full h-10 px-3 rounded-lg border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-sm" value={searchFileNo} onChange={e => setSearchFileNo(e.target.value)} /></div>
                    <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Name</label><input type="text" placeholder="Search..." className="w-full h-10 px-3 rounded-lg border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-sm" value={searchName} onChange={e => setSearchName(e.target.value)} /></div>
                    <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Assignment</label><select className="w-full h-10 px-3 rounded-lg border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-sm" value={filterAssignment} onChange={e => setFilterAssignment(e.target.value)}><option value="">All Assignments</option>{uniqueAssignments.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                    <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Venue</label><select className="w-full h-10 px-3 rounded-lg border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-sm" value={filterVenue} onChange={e => setFilterVenue(e.target.value)}><option value="">All Venues</option>{uniqueVenues.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                    <div className="flex items-end"><button onClick={clearFilters} className="h-10 px-4 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700">Clear Filters</button></div>
                </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 mb-4">
                <span className="text-sm font-bold text-slate-500">Showing <span className="text-emerald-600">{paginatedPostings.length}</span> of <span className="text-emerald-600">{total}</span> postings</span>
                {filterAssignment && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold"><span className="material-symbols-outlined text-sm">filter_alt</span>{filterAssignment}</span>}
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-[#121b25] rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden flex-1 flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-[#0f161d] text-xs uppercase font-bold text-slate-500 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 text-center w-12"><input type="checkbox" checked={selectedIds.size === filteredPostings.length && filteredPostings.length > 0} onChange={e => handleSelectAll(e.target.checked)} className="w-4 h-4 rounded" /></th>
                                <th className="px-4 py-3">File No</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Station</th><th className="px-4 py-3">State</th><th className="px-4 py-3">CON</th><th className="px-4 py-3">Assignment</th><th className="px-4 py-3">Venue</th><th className="px-4 py-3">Mandate</th><th className="px-4 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300 dark:divide-gray-800">
                            {loading ? (<tr><td colSpan={9} className="p-16 text-center"><div className="flex flex-col items-center gap-2"><span className="material-symbols-outlined text-4xl text-emerald-500 animate-spin">progress_activity</span><span className="text-slate-500">Loading postings...</span></div></td></tr>
                            ) : paginatedPostings.length === 0 ? (<tr><td colSpan={9} className="p-16 text-center text-slate-500">No postings found.</td></tr>
                            ) : paginatedPostings.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                    <td className="p-4 text-center"><input type="checkbox" checked={selectedIds.has(p.id)} onChange={e => handleSelectOne(p.id, e.target.checked)} className="w-4 h-4 rounded" /></td>
                                    <td className="px-4 py-3 font-mono font-bold text-sm">{p.file_no}</td>
                                    <td className="px-4 py-3 font-medium">{p.name}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{p.station || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{p.state?.join(', ') || '-'}</td>
                                    <td className="px-4 py-3"><span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">{p.conraiss || '-'}</span></td>
                                    <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{p.assignments?.map((a: string, idx: number) => (<span key={idx} className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 uppercase">{a}</span>))}</div></td>
                                    <td className="px-4 py-3 text-sm font-bold text-teal-600 dark:text-teal-400">{p.assignment_venue?.join(' | ') || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{p.mandates?.join(', ') || '-'}</td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => {
                                                    if (swapSource?.id === p.id) {
                                                        setSwapSource(null);
                                                    } else if (swapSource) {
                                                        handleExecuteSwap(p);
                                                    } else {
                                                        setSwapSource(p);
                                                        success(`Select another staff to swap venues with ${p.name}`);
                                                    }
                                                }}
                                                className={`p-2 rounded-lg transition-all duration-300 ${swapSource?.id === p.id ? 'bg-amber-100 text-amber-600' : swapSource ? 'text-emerald-600 hover:bg-emerald-50' : 'text-indigo-400 hover:bg-slate-50'}`}
                                                title={swapSource?.id === p.id ? "Cancel Swap" : swapSource ? "Swap Venue with this Staff" : "Swap Staff Venue"}
                                            >
                                                <span className="material-symbols-outlined text-lg">{swapSource?.id === p.id ? 'sync' : swapSource ? 'published_with_changes' : 'swap_horiz'}</span>
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    setReplacementSource(p);
                                                    setLoading(true);
                                                    try {
                                                        const allAPC = await getAllDriverAPCRecords(true);
                                                        const eligible = allAPC.filter(s => s.file_no !== p.file_no);
                                                        setReplacementPool(eligible);
                                                        setIsReplacementModalOpen(true);
                                                    } catch (e) {
                                                        error("Failed to load replacement pool.");
                                                    } finally {
                                                        setLoading(false);
                                                    }
                                                }}
                                                className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Replace Staff"
                                            >
                                                <span className="material-symbols-outlined text-lg">person_remove</span>
                                            </button>
                                            <button onClick={() => handleSingleDelete(p)} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors" title="Delete"><span className="material-symbols-outlined text-lg">delete</span></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2"><span className="text-xs text-slate-500">Rows per page:</span><select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }} className="h-8 px-2 rounded border bg-white dark:bg-[#121b25] text-sm">{[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                <div className="flex items-center gap-2"><button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg border bg-white dark:bg-[#121b25] text-sm font-bold disabled:opacity-50">Prev</button><span className="px-3 py-1.5 text-sm font-bold">{page} / {Math.ceil(total / limit) || 1}</span><button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg border bg-white dark:bg-[#121b25] text-sm font-bold disabled:opacity-50">Next</button></div>
            </div>

            {showHelp && <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} content={helpContent.postingReports} />}

            {/* Replacement Modal */}
            {isReplacementModalOpen && replacementSource && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#121b25] w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-200 dark:border-gray-800 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Replace Staff</h3>
                                <p className="text-sm text-slate-500">Select a staff member to replace <span className="font-bold text-rose-600">{replacementSource.name}</span></p>
                            </div>
                            <button onClick={() => { setIsReplacementModalOpen(false); setReplacementSource(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-gray-800 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <input type="text" placeholder="Search File No..." value={modalSearchFileNo} onChange={e => setModalSearchFileNo(e.target.value)} className="h-10 px-3 rounded-lg border text-sm" />
                            <input type="text" placeholder="Search Name..." value={modalSearchName} onChange={e => setModalSearchName(e.target.value)} className="h-10 px-3 rounded-lg border text-sm" />
                            <input type="text" placeholder="Search CONRAISS (e.g. 07)..." value={modalSearchConraiss} onChange={e => setModalSearchConraiss(e.target.value)} className="h-10 px-3 rounded-lg border text-sm" />
                        </div>
                        <div className="flex-1 overflow-auto p-0">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-[#0f161d] sticky top-0 font-bold text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-6 py-4">File No</th>
                                        <th className="px-6 py-4">Name</th>
                                        <th className="px-6 py-4">Station</th>
                                        <th className="px-6 py-4">CON</th>
                                        <th className="px-6 py-4 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                                    {filteredReplacementPool.slice(0, 50).map(staff => (
                                        <tr key={staff.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-6 py-4 font-mono text-sm">{staff.file_no}</td>
                                            <td className="px-6 py-4 font-medium">{staff.name}</td>
                                            <td className="px-6 py-4 text-sm text-slate-500">{staff.station || '-'}</td>
                                            <td className="px-6 py-4 text-center"><span className="px-2 py-1 rounded bg-slate-100 text-xs font-bold">{staff.conraiss || '-'}</span></td>
                                            <td className="px-6 py-4 text-center">
                                                <button onClick={() => handleExecuteReplacement(staff)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md">Select</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredReplacementPool.length === 0 && (
                                        <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">No eligible staff found for replacement.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-500 text-center">
                            Showing top 50 eligible staff matching criteria
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DriverPostingReports;