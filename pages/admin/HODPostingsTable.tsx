import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { getAllHODPostings, bulkDeleteHODPostings } from '../../services/hodPosting';
import { getAllAssignments } from '../../services/assignment';
import { PostingResponse } from '../../types/posting';
import { Assignment } from '../../types/assignment';
import { useNotification } from '../../context/NotificationContext';

interface ReportField {
    id: string;
    label: string;
    accessor: (row: PostingResponse) => any;
    default: boolean;
    pdfWidth?: number;
}

const REPORT_FIELDS: ReportField[] = [
    { id: 'file_no', label: 'FILE NO', accessor: r => r.file_no, default: true, pdfWidth: 25 },
    { id: 'name', label: 'NAME', accessor: r => r.name, default: true, pdfWidth: 65 },
    { id: 'sex', label: 'SEX', accessor: r => r.sex || '-', default: false, pdfWidth: 15 },
    { id: 'station', label: 'STATION', accessor: r => r.station || '-', default: true, pdfWidth: 40 },
    {
        id: 'state', label: 'STATE', accessor: r => {
            const venueStr = (r.assignment_venue || []).join(' ');
            if (venueStr && venueStr.includes('|')) {
                const parts = venueStr.split('|');
                return parts[parts.length - 1].trim();
            }
            return r.station || '-';
        }, default: false, pdfWidth: 30
    },
    { id: 'conraiss', label: 'CONRAISS', accessor: r => r.conraiss || '-', default: true, pdfWidth: 25 },
    { id: 'assignment', label: 'ASSIGNMENT', accessor: r => (r.assignments || []).map((a: any) => typeof a === 'string' ? a : a.name || a.code).join(', ') || '-', default: true, pdfWidth: 45 },
    { id: 'mandate', label: 'MANDATE', accessor: r => (r.mandates || []).map((m: any) => typeof m === 'string' ? m : m.mandate || m.code).join(', ') || '-', default: true, pdfWidth: 40 },
    { id: 'venue', label: 'VENUE', accessor: r => (r.assignment_venue || []).join(', ') || '-', default: true, pdfWidth: 60 },
    { id: 'count', label: 'NO. OF NIGHTS', accessor: r => r.count || 0, default: false, pdfWidth: 20 },
    { id: 'posted_for', label: 'POSTED FOR', accessor: r => r.posted_for || 0, default: false, pdfWidth: 20 },
    { id: 'to_be_posted', label: 'TO BE POSTED', accessor: r => r.to_be_posted || 0, default: false, pdfWidth: 20 },
    { id: 'description', label: 'DESCRIPTION', accessor: r => r.description || '-', default: false, pdfWidth: 50 },
    { id: 'year', label: 'YEAR', accessor: r => r.year || '-', default: false, pdfWidth: 20 }
];

const HODPostingsTable: React.FC = () => {
    const { success, error } = useNotification();

    // Data States
    const [postings, setPostings] = useState<PostingResponse[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);

    // Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);

    // Filter States
    const [searchFileNo, setSearchFileNo] = useState('');
    const [searchName, setSearchName] = useState('');
    const [filterAssignment, setFilterAssignment] = useState('');
    const [filterVenue, setFilterVenue] = useState('');

    // Debounced Search
    const debouncedFileNo = useDebounce(searchFileNo, 300);
    const debouncedName = useDebounce(searchName, 300);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Report Customization
    const [orderedFieldIds, setOrderedFieldIds] = useState<string[]>(
        REPORT_FIELDS.filter(f => f.default).map(f => f.id)
    );
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [reportTitle, setReportTitle] = useState('HOD POSTING REPORT'); // Kept for backward compat or general use if needed, but we'll use Title1/2 primarily
    const [reportTitle1, setReportTitle1] = useState('');
    const [reportTitle2, setReportTitle2] = useState('');
    const [reportTemplate, setReportTemplate] = useState('SSCE');
    const [exportType, setExportType] = useState<'pdf' | 'csv' | 'xlsx' | null>(null);

    const activeFields = useMemo(() => {
        const fieldMap = new Map(REPORT_FIELDS.map(f => [f.id, f]));
        return orderedFieldIds
            .map(id => fieldMap.get(id))
            .filter((f): f is ReportField => !!f);
    }, [orderedFieldIds]);

    const fetchData = useCallback(async (force: boolean = false) => {
        try {
            setLoading(true);
            const [postingsData, assignmentsData] = await Promise.all([
                getAllHODPostings(force),
                getAllAssignments(force)
            ]);
            setPostings(postingsData || []);
            setAssignments(assignmentsData || []);
        } catch (err) {
            console.error("Failed to fetch data", err);
            error('Failed to load HOD postings.');
        } finally {
            setLoading(false);
        }
    }, [error]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Unique values for filters
    const uniqueAssignments = useMemo(() => {
        const set = new Set<string>();
        postings.forEach(p => {
            p.assignments?.forEach((a: any) => {
                const val = typeof a === 'string' ? a : a.name || a.code;
                if (val) set.add(val);
            });
        });
        return Array.from(set).sort();
    }, [postings]);

    const uniqueVenues = useMemo(() => {
        const set = new Set<string>();
        postings.forEach(p => {
            if (Array.isArray(p.assignment_venue)) {
                p.assignment_venue.forEach((v: any) => {
                    if (v) set.add(typeof v === 'string' ? v : v.name || v);
                });
            }
        });
        return Array.from(set).sort();
    }, [postings]);

    // Filtered Data
    const filteredPostings = useMemo(() => {
        let result = postings;

        if (debouncedFileNo) {
            result = result.filter(p => p.file_no?.toLowerCase().includes(debouncedFileNo.toLowerCase()));
        }
        if (debouncedName) {
            result = result.filter(p => p.name?.toLowerCase().includes(debouncedName.toLowerCase()));
        }
        if (filterAssignment) {
            result = result.filter(p =>
                p.assignments?.some((a: any) =>
                    (typeof a === 'string' ? a : a.name || a.code) === filterAssignment
                )
            );
        }
        if (filterVenue) {
            result = result.filter(p =>
                p.assignment_venue?.some((v: any) =>
                    (typeof v === 'string' ? v : v.name || v) === filterVenue
                )
            );
        }

        return result;
    }, [postings, debouncedFileNo, debouncedName, filterAssignment, filterVenue]);

    const total = filteredPostings.length;

    const paginatedPostings = useMemo(() => {
        const startIndex = (page - 1) * limit;
        return filteredPostings.slice(startIndex, startIndex + limit);
    }, [filteredPostings, page, limit]);

    // Selection handlers
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(filteredPostings.map(p => p.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`Delete ${selectedIds.size} posting(s)?`)) return;

        try {
            setLoading(true);
            await bulkDeleteHODPostings(Array.from(selectedIds));
            success(`Deleted ${selectedIds.size} postings.`);
            setSelectedIds(new Set());
            fetchData(true);
        } catch (err: any) {
            console.error("Delete failed", err);
            error(`Failed to delete: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handlePrintReport = () => {
        const dataToExport = filteredPostings;
        if (dataToExport.length === 0) {
            error('No postings to export.');
            return;
        }

        const reportTitle = filterAssignment
            ? `HOD POSTING REPORT - ${(assignments.find(a => a.code === filterAssignment || a.name === filterAssignment)?.name || filterAssignment).toUpperCase()}`
            : 'HOD POSTING REPORT - ALL POSTINGS';

        const fileNameSuffix = filterAssignment
            ? (assignments.find(a => a.code === filterAssignment || a.name === filterAssignment)?.name || filterAssignment).replace(/\s+/g, '_')
            : 'All_Postings';

        const doc = new jsPDF('l', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Load logo and signature
        const logoUrl = '/images/neco.png';
        const signatureUrl = '/images/signature.png';

        Promise.all([
            new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.src = logoUrl;
                img.onload = () => resolve(img);
                img.onerror = reject;
            }),
            new Promise<HTMLImageElement | null>((resolve) => {
                const img = new Image();
                img.src = signatureUrl;
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
            })
        ]).then(([logoImg, signatureImg]) => {
            const drawPageHeader = (data: any) => {
                // Logo on the left
                const aspectRatio = logoImg.width / logoImg.height;
                doc.addImage(logoImg, 'PNG', 15, 8, 20, 20 / aspectRatio);

                // Header text
                doc.setTextColor(0, 128, 0); // Green
                doc.setFontSize(18);
                doc.setFont("helvetica", "bold");
                doc.text("NATIONAL EXAMINATIONS COUNCIL (NECO)", pageWidth / 2, 18, { align: 'center' });

                doc.setTextColor(0, 0, 0);
                doc.setFontSize(14);
                doc.text(reportTitle, pageWidth / 2, 26, { align: 'center' });

                // Page number at bottom right
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text(`Page ${data.pageNumber}`, pageWidth - 15, pageHeight - 10, { align: 'right' });
            };

            const tableData = dataToExport.map((p, idx) => [
                idx + 1,
                p.file_no,
                p.name,
                p.conraiss || '-',
                p.station || '-',
                p.assignment_venue?.join(', ') || '-',
                p.mandates?.map((m: any) => typeof m === 'string' ? m : m.mandate || m.code).join(', ') || '-'
            ]);

            autoTable(doc, {
                head: [['#', 'File No', 'Name', 'CONRAISS', 'Station', 'Venue', 'Mandate']],
                body: tableData,
                startY: 35,
                theme: 'grid',
                headStyles: {
                    fillColor: [0, 128, 0],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 10
                },
                bodyStyles: {
                    fontSize: 9,
                    cellPadding: 3
                },
                columnStyles: {
                    0: { cellWidth: 12 },
                    1: { cellWidth: 25 },
                    2: { cellWidth: 60 },
                    3: { cellWidth: 25 },
                    4: { cellWidth: 45 },
                    5: { cellWidth: 60 },
                    6: { cellWidth: 45 }
                },
                margin: { top: 35, bottom: 30 },
                didDrawPage: drawPageHeader
            });

            // Add signature area and generated date on the last page
            const signatureY = pageHeight - 25;

            // Signature area
            if (signatureImg) {
                doc.addImage(signatureImg, 'PNG', 15, signatureY - 15, 30, 15);
            }
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "bold");
            doc.text("_______________________", 15, signatureY + 5);
            doc.setFont("helvetica", "normal");
            doc.text("Registrar", 15, signatureY + 10);
            doc.text("National Examinations Council", 15, signatureY + 15);

            // Generated date at bottom center
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 5, { align: 'center' });

            doc.save(`HOD_Posting_Report_${fileNameSuffix}_${new Date().toISOString().split('T')[0]}.pdf`);
            success('Report generated successfully!');
        }).catch(() => {
            error('Failed to load logo image. Report not generated.');
        });
    };

    const handleCSVExport = () => {
        if (filteredPostings.length === 0) {
            error('No postings to export.');
            return;
        }

        setExportType('csv');
        try {
            const headers = activeFields.map(f => f.label);
            const rows = filteredPostings.map(posting =>
                activeFields.map(field => field.accessor(posting))
            );

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `HOD_Posting_Report_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();

            success('CSV report exported successfully!');
        } catch (err) {
            error('Failed to export CSV report.');
        } finally {
            setExportType(null);
        }
    };

    const handleExcelExport = () => {
        if (filteredPostings.length === 0) {
            error('No postings to export.');
            return;
        }

        setExportType('xlsx');
        try {
            const headers = activeFields.map(f => f.label);
            const rows = filteredPostings.map(posting =>
                activeFields.map(field => field.accessor(posting))
            );

            const wsData = [headers, ...rows];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "HOD Postings");
            XLSX.writeFile(wb, `HOD_Posting_Report_${new Date().toISOString().split('T')[0]}.xlsx`);

            success('Excel report exported successfully!');
        } catch (err) {
            error('Failed to export Excel report.');
        } finally {
            setExportType(null);
        }
    };

    const handlePDFExport = async () => {
        if (filteredPostings.length === 0) {
            error('No postings to export.');
            return;
        }

        setExportType('pdf');
        try {
            const doc = new jsPDF('l', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            const logoUrl = '/images/neco.png';
            const signatureUrl = '/images/signature.png';

            const [logoImg, signatureImg] = await Promise.all([
                new Promise<HTMLImageElement>((resolve, reject) => {
                    const img = new Image();
                    img.src = logoUrl;
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                }),
                new Promise<HTMLImageElement | null>((resolve) => {
                    const img = new Image();
                    img.src = signatureUrl;
                    img.onload = () => resolve(img);
                    img.onerror = () => resolve(null);
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
                            defaultTitle1: reportTitle1 || "2026 NATIONAL COMMON ENTRANCE EXAMINATION",
                            defaultTitle2: reportTitle2 || "NCEE MONITORING OFFICERS POSTING LIST"
                        };
                    case 'ACCREDITATION':
                        return {
                            headerTitle: "NATIONAL EXAMINATIONS COUNCIL (NECO)",
                            headerColor: [180, 0, 0], // Red-ish
                            tableHeaderColor: [180, 0, 0],
                            defaultTitle1: reportTitle1 || "2026 ACCREDITATION EXERCISE",
                            defaultTitle2: reportTitle2 || "ACCREDITATION OFFICERS POSTING LIST"
                        };
                    case 'SSCE':
                    default:
                        return {
                            headerTitle: "NATIONAL EXAMINATIONS COUNCIL (NECO)",
                            headerColor: [0, 128, 0], // Green
                            tableHeaderColor: [0, 128, 0],
                            defaultTitle1: reportTitle1 || "2026 SENIOR SCHOOL CERTIFICATE EXAMINATION (SSCE)",
                            defaultTitle2: reportTitle2 || "SSCE MONITORING OFFICERS POSTING LIST"
                        };
                }
            };

            const config = getTemplateConfig();

            const drawPageHeader = (data: any) => {
                const aspectRatio = logoImg.width / logoImg.height;
                // Logo
                doc.addImage(logoImg, 'PNG', 15, 8, 20, 20 / aspectRatio);

                // Header Title
                doc.setTextColor(config.headerColor[0], config.headerColor[1], config.headerColor[2]);
                doc.setFontSize(18);
                doc.setFont("helvetica", "bold");
                doc.text(config.headerTitle, pageWidth / 2, 18, { align: 'center' });

                // Custom Titles
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(14);
                // Use custom title 1 or default
                const t1 = config.defaultTitle1;
                if (t1) doc.text(t1.toUpperCase(), pageWidth / 2, 26, { align: 'center' });

                doc.setFontSize(12);
                const t2 = config.defaultTitle2;
                if (t2) doc.text(t2.toUpperCase(), pageWidth / 2, 32, { align: 'center' });

                // Page Number
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text(`Page ${data.pageNumber}`, pageWidth - 15, pageHeight - 10, { align: 'right' });

                // Generated Date
                doc.setFontSize(8);
                doc.text(`Generated: ${new Date().toLocaleString()}`, 15, pageHeight - 10);
            };

            // --- ACCREDITATION FORMAT (Group by State) ---
            if (reportTemplate === 'ACCREDITATION') {
                // Group postings by State (extracted from venue or station)
                const groupedData: { [key: string]: any[] } = {};

                filteredPostings.forEach(post => {
                    // Try to extract state from assignment_venue
                    let state = 'UNKNOWN';
                    const venueStr = (post.assignment_venue || []).join(' ');
                    if (venueStr && venueStr.includes('|')) {
                        const parts = venueStr.split('|');
                        state = parts[parts.length - 1].trim();
                    } else if (post.station) {
                        // Fallback to station if venue parse fails, simplified assumption
                        state = post.station;
                    }

                    if (!groupedData[state]) groupedData[state] = [];
                    groupedData[state].push(post);
                });

                const sortedStates = Object.keys(groupedData).sort();
                let currentY = 40;

                // Add S/N column if not present
                const accColumns = activeFields.map(f => f.label);
                // We use autoTable's index feature usually, but let's conform to the standard structure

                for (const state of sortedStates) {
                    // Sort items in state by Rank (CONRAISS) descending
                    const stateRows = groupedData[state].sort((a, b) => {
                        const cA = parseInt((a.conraiss || '0').replace(/\D/g, ''), 10);
                        const cB = parseInt((b.conraiss || '0').replace(/\D/g, ''), 10);
                        return cB - cA;
                    }).map(post => activeFields.map(f => f.accessor(post)));

                    // Check if we need a new page for the State Title
                    if (currentY > pageHeight - 50) {
                        doc.addPage();
                        currentY = 40;
                    }

                    // Print State Header
                    doc.setFontSize(12);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(config.headerColor[0], config.headerColor[1], config.headerColor[2]);
                    doc.text(state.toUpperCase(), 15, currentY);

                    // Draw Table
                    autoTable(doc, {
                        head: [accColumns],
                        body: stateRows,
                        startY: currentY + 5,
                        theme: 'grid',
                        headStyles: {
                            fillColor: [config.tableHeaderColor[0], config.tableHeaderColor[1], config.tableHeaderColor[2]],
                            textColor: [255, 255, 255],
                            fontStyle: 'bold',
                            fontSize: 10
                        },
                        bodyStyles: { fontSize: 9, cellPadding: 3 },
                        columnStyles: { 0: { cellWidth: 15 } }, // Assume first col is S/N-like or small
                        margin: { top: 40, bottom: 30 },
                        didDrawPage: drawPageHeader
                    });

                    currentY = (doc as any).lastAutoTable.finalY + 15;
                }

            } else {
                // --- STANDARD FORMAT (SSCE / NCEE) ---
                const headers = activeFields.map(f => f.label);
                const tableData = filteredPostings.map(posting =>
                    activeFields.map(field => field.accessor(posting))
                );

                const columnStyles: any = {};
                activeFields.forEach((field, idx) => {
                    if (field.pdfWidth) {
                        columnStyles[idx] = { cellWidth: field.pdfWidth };
                    }
                });

                autoTable(doc, {
                    head: [headers],
                    body: tableData,
                    startY: 40,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [config.tableHeaderColor[0], config.tableHeaderColor[1], config.tableHeaderColor[2]],
                        textColor: [255, 255, 255],
                        fontStyle: 'bold',
                        fontSize: 10
                    },
                    bodyStyles: { fontSize: 9, cellPadding: 3 },
                    columnStyles,
                    margin: { top: 40, bottom: 30 },
                    didDrawPage: drawPageHeader
                });
            }

            // Signature area (on last page)
            const signatureY = pageHeight - 25;
            if (signatureImg) {
                doc.addImage(signatureImg, 'PNG', 15, signatureY - 15, 30, 15);
            }
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "bold");
            doc.text("_______________________", 15, signatureY + 5);
            doc.setFont("helvetica", "normal");
            doc.text("Registrar", 15, signatureY + 10);
            doc.text("National Examinations Council", 15, signatureY + 15);

            doc.save(`HOD_Posting_Report_${reportTemplate}_${new Date().toISOString().split('T')[0]}.pdf`);
            success(`${reportTemplate} report generated successfully!`);
        } catch (err) {
            console.error(err);
            error('Failed to generate PDF report.');
        } finally {
            setExportType(null);
        }
    };


    const clearFilters = () => {
        setSearchFileNo('');
        setSearchName('');
        setFilterAssignment('');
        setFilterVenue('');
        setPage(1);
    };

    return (
        <div className="flex-1 flex flex-col min-h-full bg-slate-50 dark:bg-[#0b1015] p-4 md:p-8 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
            {/* Header */}
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400 drop-shadow-sm">
                        HOD Postings Table
                    </h1>
                    <p className="mt-1 text-slate-500 dark:text-slate-400 font-medium">
                        View and manage all generated HOD postings.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-rose-600 rounded-lg shadow-lg hover:bg-rose-700"
                        >
                            <span className="material-symbols-outlined text-lg">delete</span>
                            Delete ({selectedIds.size})
                        </button>
                    )}
                    <button
                        onClick={() => fetchData(true)}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 text-emerald-600 dark:text-emerald-400 font-bold text-xs shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    >
                        <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
                        Refresh
                    </button>
                    <button
                        onClick={() => setIsConfigOpen(!isConfigOpen)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-bold text-xs shadow-sm transition-all ${isConfigOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white dark:bg-[#121b25] border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300'}`}
                    >
                        <span className="material-symbols-outlined text-lg">settings_suggest</span>
                        Customize Columns
                    </button>
                    <button
                        onClick={handlePDFExport}
                        disabled={loading || filteredPostings.length === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 text-rose-600 dark:text-rose-400 font-bold text-xs shadow-sm hover:bg-slate-50 dark:hover:bg-gray-800 transition-all disabled:opacity-50"
                        title="Export as PDF"
                    >
                        <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                        PDF
                    </button>
                    <button
                        onClick={handleCSVExport}
                        disabled={loading || filteredPostings.length === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 text-emerald-600 dark:text-emerald-400 font-bold text-xs shadow-sm hover:bg-slate-50 dark:hover:bg-gray-800 transition-all disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined text-lg">csv</span>
                        CSV
                    </button>
                    <button
                        onClick={handleExcelExport}
                        disabled={loading || filteredPostings.length === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined text-lg">table_view</span>
                        Excel
                    </button>
                </div>
            </div>

            {/* Export Loading Overlay */}
            {exportType && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white dark:bg-[#121b25] p-8 rounded-3xl shadow-2xl border border-slate-200 dark:border-gray-800 flex flex-col items-center gap-6 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-300">
                        <div className="relative">
                            <div className="w-20 h-20 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl text-emerald-500">
                                    {exportType === 'pdf' ? 'picture_as_pdf' : exportType === 'csv' ? 'csv' : 'table_view'}
                                </span>
                            </div>
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">
                                Generating {exportType.toUpperCase()} Report
                            </h3>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                Please wait while your report is being prepared...
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            Processing {filteredPostings.length} records
                        </div>
                    </div>
                </div>
            )}

            {/* Column Customization Panel */}
            {isConfigOpen && (
                <div className="bg-indigo-50/30 dark:bg-indigo-900/10 p-5 rounded-xl border border-indigo-100 dark:border-indigo-900/30 mb-6 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                            <span className="material-symbols-outlined">view_column</span>
                            Customize Report Columns
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setOrderedFieldIds(REPORT_FIELDS.map(f => f.id))}
                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase"
                            >
                                Select All
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                                onClick={() => setOrderedFieldIds(REPORT_FIELDS.filter(f => f.default).map(f => f.id))}
                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase"
                            >
                                Reset to Default
                            </button>
                        </div>
                    </div>

                    {/* Report Configuration */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-[10px] font-black text-indigo-400 uppercase mb-2 tracking-widest">Report Template</label>
                            <select
                                value={reportTemplate}
                                onChange={(e) => setReportTemplate(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-900/50 bg-white dark:bg-[#0f161d] text-sm font-bold text-indigo-900 dark:text-indigo-100"
                            >
                                <option value="SSCE">SSCE Format (Green)</option>
                                <option value="NCEE">NCEE Format (Blue)</option>
                                <option value="ACCREDITATION">Accreditation Format (Red)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-indigo-400 uppercase mb-2 tracking-widest">Main Title (Optional)</label>
                            <input
                                type="text"
                                value={reportTitle1}
                                onChange={(e) => setReportTitle1(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-900/50 bg-white dark:bg-[#0f161d] text-sm font-medium"
                                placeholder="Default: Based on Template"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-indigo-400 uppercase mb-2 tracking-widest">Sub Title (Optional)</label>
                            <input
                                type="text"
                                value={reportTitle2}
                                onChange={(e) => setReportTitle2(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-900/50 bg-white dark:bg-[#0f161d] text-sm font-medium"
                                placeholder="Default: Based on Template"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Active Columns */}
                        <div>
                            <label className="text-[10px] font-black text-indigo-400 uppercase mb-3 block tracking-widest">Active Columns ({activeFields.length})</label>
                            <div className="flex flex-wrap gap-2">
                                {activeFields.map((field, idx) => (
                                    <div
                                        key={field.id}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-900/20 shadow-sm"
                                    >
                                        <button
                                            onClick={() => {
                                                if (orderedFieldIds.length > 1) {
                                                    setOrderedFieldIds(prev => prev.filter(id => id !== field.id));
                                                }
                                            }}
                                            className="w-6 h-6 rounded-lg bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600 transition-colors"
                                            title="Remove Column"
                                        >
                                            <span className="material-symbols-outlined text-sm font-bold">check</span>
                                        </button>
                                        <span className="text-xs font-bold text-indigo-900 dark:text-indigo-100">{field.label}</span>
                                        <div className="flex gap-0.5 ml-1 border-l border-indigo-200 dark:border-indigo-900/50 pl-1">
                                            <button
                                                onClick={() => {
                                                    if (idx > 0) {
                                                        const newOrder = [...orderedFieldIds];
                                                        [newOrder[idx], newOrder[idx - 1]] = [newOrder[idx - 1], newOrder[idx]];
                                                        setOrderedFieldIds(newOrder);
                                                    }
                                                }}
                                                disabled={idx === 0}
                                                className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center hover:bg-indigo-200 disabled:opacity-30"
                                                title="Move Left"
                                            >
                                                <span className="material-symbols-outlined text-xs">chevron_left</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (idx < orderedFieldIds.length - 1) {
                                                        const newOrder = [...orderedFieldIds];
                                                        [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
                                                        setOrderedFieldIds(newOrder);
                                                    }
                                                }}
                                                disabled={idx === orderedFieldIds.length - 1}
                                                className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center hover:bg-indigo-200 disabled:opacity-30"
                                                title="Move Right"
                                            >
                                                <span className="material-symbols-outlined text-xs">chevron_right</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Available Columns */}
                        {REPORT_FIELDS.filter(f => !orderedFieldIds.includes(f.id)).length > 0 && (
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Available Columns</label>
                                <div className="flex flex-wrap gap-2">
                                    {REPORT_FIELDS.filter(f => !orderedFieldIds.includes(f.id)).map(field => (
                                        <button
                                            key={field.id}
                                            onClick={() => setOrderedFieldIds(prev => [...prev, field.id])}
                                            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 dark:border-gray-700 dark:bg-gray-800 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                        >
                                            <span className="w-6 h-6 rounded-lg border-2 border-dashed border-slate-300 dark:border-gray-600 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-sm text-slate-400">add</span>
                                            </span>
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{field.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white dark:bg-[#121b25] p-4 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">File No</label>
                        <input
                            type="text"
                            placeholder="Search..."
                            className="w-full h-10 px-3 rounded-lg border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-sm"
                            value={searchFileNo}
                            onChange={e => setSearchFileNo(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Name</label>
                        <input
                            type="text"
                            placeholder="Search..."
                            className="w-full h-10 px-3 rounded-lg border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-sm"
                            value={searchName}
                            onChange={e => setSearchName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Assignment</label>
                        <select
                            className="w-full h-10 px-3 rounded-lg border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-sm"
                            value={filterAssignment}
                            onChange={e => setFilterAssignment(e.target.value)}
                        >
                            <option value="">All Assignments</option>
                            {uniqueAssignments.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Venue</label>
                        <select
                            className="w-full h-10 px-3 rounded-lg border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-sm"
                            value={filterVenue}
                            onChange={e => setFilterVenue(e.target.value)}
                        >
                            <option value="">All Venues</option>
                            {uniqueVenues.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={clearFilters}
                            className="h-10 px-4 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 mb-4">
                <span className="text-sm font-bold text-slate-500">
                    Showing <span className="text-emerald-600">{paginatedPostings.length}</span> of <span className="text-emerald-600">{total}</span> postings
                </span>
                {filterAssignment && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                        <span className="material-symbols-outlined text-sm">filter_alt</span>
                        {filterAssignment}
                    </span>
                )}
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-[#121b25] rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden flex-1 flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-[#0f161d] text-xs uppercase font-bold text-slate-500 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 text-center w-12">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size === filteredPostings.length && filteredPostings.length > 0}
                                        onChange={e => handleSelectAll(e.target.checked)}
                                        className="w-4 h-4 rounded"
                                    />
                                </th>
                                <th className="px-4 py-3">File No</th>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Station</th>
                                <th className="px-4 py-3">CON</th>
                                <th className="px-4 py-3">Assignment</th>
                                <th className="px-4 py-3">Venue</th>
                                <th className="px-4 py-3">Mandate</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="p-16 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="material-symbols-outlined text-4xl text-emerald-500 animate-spin">progress_activity</span>
                                            <span className="text-slate-500">Loading postings...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedPostings.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-16 text-center text-slate-500">
                                        No postings found.
                                    </td>
                                </tr>
                            ) : (
                                paginatedPostings.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                        <td className="p-4 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(p.id)}
                                                onChange={e => handleSelectOne(p.id, e.target.checked)}
                                                className="w-4 h-4 rounded"
                                            />
                                        </td>
                                        <td className="px-4 py-3 font-mono font-bold text-sm">{p.file_no}</td>
                                        <td className="px-4 py-3 font-medium">{p.name}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{p.station || '-'}</td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">
                                                {p.conraiss || '-'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1">
                                                {p.assignments?.map((a: any, idx: number) => (
                                                    <span key={idx} className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 uppercase">
                                                        {typeof a === 'string' ? a : a.name || a.code}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-bold text-teal-600 dark:text-teal-400">
                                            {p.assignment_venue?.join(', ') || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                            {p.mandates?.map((m: any) => typeof m === 'string' ? m : m.mandate || m.code).join(', ') || '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-[#0f161d]">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-500">Rows per page:</span>
                        <select
                            value={limit}
                            onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                            className="h-8 px-2 rounded border bg-white dark:bg-[#121b25] border-slate-200 dark:border-gray-700 text-xs"
                        >
                            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-lg">chevron_left</span>
                        </button>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                            Page {page} of {Math.ceil(total / limit) || 1}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(Math.ceil(total / limit), p + 1))}
                            disabled={page >= Math.ceil(total / limit)}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-lg">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HODPostingsTable;
