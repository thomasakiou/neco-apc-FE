import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { getAllPostingRecords } from '../../services/posting';
import { getAllAPCRecords } from '../../services/apc';
import { getAllAssignments } from '../../services/assignment';
import { getAllMandates } from '../../services/mandate';
import { APCRecord } from '../../types/apc';
import { useNotification } from '../../context/NotificationContext';
import { PostingResponse } from '../../types/posting';
import { Assignment } from '../../types/assignment';
import { Mandate } from '../../types/mandate';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const GeneratePage: React.FC = () => {
    const { success, error } = useNotification();
    const [postings, setPostings] = useState<PostingResponse[]>([]);
    const [filteredPostings, setFilteredPostings] = useState<PostingResponse[]>([]);
    const [paginatedPostings, setPaginatedPostings] = useState<PostingResponse[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [assignments, setAssignments] = useState<Assignment[]>([]);

    const [mandates, setMandates] = useState<Mandate[]>([]);
    const [apcRecords, setApcRecords] = useState<APCRecord[]>([]);

    const [filterAssignment, setFilterAssignment] = useState('');
    const [filterMandate, setFilterMandate] = useState('');

    // Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0);

    // Report Customization
    const [reportTitle1, setReportTitle1] = useState('');

    const [reportTitle2, setReportTitle2] = useState('');
    const [reportTemplate, setReportTemplate] = useState('SSCE');

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [postingsData, assignmentsData, mandatesData, activeAPC] = await Promise.all([
                getAllPostingRecords(),
                getAllAssignments(),
                getAllMandates(),
                getAllAPCRecords(true)
            ]);

            const activeFileNos = new Set(activeAPC.map(a => a.file_no));
            const activePostings = postingsData.filter(p => activeFileNos.has(p.file_no));

            setPostings(activePostings);
            setFilteredPostings(activePostings);
            setTotal(activePostings.length);
            setAssignments(assignmentsData);

            setMandates(mandatesData);
            setApcRecords(activeAPC);
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

            // Load Logo
            const logoUrl = '/images/neco.png';
            const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.src = logoUrl;
                img.onload = () => resolve(img);
                img.onerror = reject;
            });

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
                const apcMap = new Map(apcRecords.map(a => [a.file_no, a]));

                filteredPostings.forEach(post => {
                    const venues = post.assignment_venue?.map((v: any) => {
                        let name = typeof v === 'string' ? v : v.name;
                        return name ? name.replace(/^\(\d+\)\s*-\s*/, '').trim() : '';
                    }).join(', ') || 'UNKNOWN STATE';
                    // Utilize the first venue as the state key if multiple (though likely one for accreditation)
                    const stateKey = venues.split(',')[0].trim();
                    if (!groupedByState[stateKey]) groupedByState[stateKey] = [];
                    groupedByState[stateKey].push(post);
                });

                const sortedStates = Object.keys(groupedByState).sort();
                let currentY = 55; // Initial Start Y for first table

                const accreditationColumns = ["S/N", "FILE NO", "NAME", "CONR", "STATION", "QUALIFICATION", "NUMBER OF NIGHTS"];

                for (const state of sortedStates) {
                    const stateRows = groupedByState[state].map((post, index) => {
                        const apc = apcMap.get(post.file_no);
                        const qual = apc?.qualification || '-';
                        return [
                            index + 1,
                            post.file_no,
                            post.name,
                            post.conraiss || '-',
                            post.station,
                            qual,
                            post.count || '' // Number of Nights
                        ];
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

                    // Generate Table
                    autoTable(doc, {
                        head: [accreditationColumns],
                        body: stateRows,
                        startY: currentY + 5,
                        margin: { top: 45, bottom: 40 },
                        theme: 'grid',
                        styles: { fontSize: 10, cellPadding: 3, minCellHeight: 10 }, // Slightly smaller font for more cols?
                        headStyles: { fillColor: (config.tableHeaderColor as any), textColor: 255, fontStyle: 'bold' },
                        columnStyles: {
                            0: { halign: 'center', cellWidth: 15 },  // S/N
                            1: { cellWidth: 25 }, // File No
                            2: { cellWidth: 70 }, // Name
                            3: { halign: 'center', cellWidth: 20 }, // Conraiss
                            4: { cellWidth: 25 }, // Station
                            5: { cellWidth: 80 }, // Qualification
                            6: { halign: 'center', cellWidth: 'auto' } // Nights
                        },
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
                const tableColumn = ["S/N", "FILE No", "NAME", "CONR", "STATION", "POSTING", "MANDATE"];
                const tableRows = filteredPostings.map((post, index) => {
                    const mandates = post.mandates?.map((m: any) => (typeof m === 'string' ? m : m.mandate || m.name)).join(', ') || '-';
                    const venues = post.assignment_venue?.map((v: any) => {
                        let name = typeof v === 'string' ? v : v.name;
                        return name ? name.replace(/^\(\d+\)\s*-\s*/, '').trim() : '';
                    }).join(', ') || '';
                    return [
                        index + 1,
                        post.file_no,
                        post.name,
                        post.conraiss || '-',
                        post.station,
                        venues || '-',
                        mandates
                    ];
                });

                autoTable(doc, {
                    head: [tableColumn],
                    body: tableRows,
                    startY: 45,
                    margin: { top: 45, bottom: 40 },
                    theme: 'grid',
                    styles: { fontSize: 12, cellPadding: 3, minCellHeight: 12 },
                    headStyles: { fillColor: (config.tableHeaderColor as any), textColor: 255, fontStyle: 'bold' },
                    columnStyles: {
                        0: { halign: 'center', cellWidth: 15 },
                        1: { cellWidth: 30 },
                        2: { cellWidth: 60 },
                        3: { halign: 'center', cellWidth: 20 },
                        4: { cellWidth: 30 },
                        5: { cellWidth: 50 },
                        6: { cellWidth: 'auto' }
                    },
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
                            placeholder="e.g. 2024 SENIOR SCHOOL CERTIFICATE EXAMINATION (INTERNAL)"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Report Title 2</label>
                        <input
                            type="text"
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-sm font-medium"
                            value={reportTitle2}
                            onChange={(e) => setReportTitle2(e.target.value)}
                            placeholder="e.g. LIST OF SUPERVISORS"
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