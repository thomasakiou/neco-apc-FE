import React, { useEffect, useState, useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import * as XLSX from 'xlsx';
import { getAllPostingRecords } from '../../services/posting';
import { getAllAPCRecords } from '../../services/apc';
import { getAllStates } from '../../services/state';
import { getAllNCEECenters } from '../../services/nceeCenter';
import { getAllGiftedCenters } from '../../services/giftedCenter';
import { APCRecord } from '../../types/apc';
import { useNotification } from '../../context/NotificationContext';
import { PostingResponse } from '../../types/posting';
import { NCEECenter } from '../../types/nceeCenter';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import HelpModal from '../../components/HelpModal';
import { helpContent } from '../../data/helpContent';

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
    location: string;
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
    if (venue === 'Returned') return venue;

    // Robust deduplication (e.g. "Ondo | Ondo" -> "Ondo")
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
    { id: 'qualification', label: 'QUALIFICATION', accessor: r => '', default: false, pdfWidth: 40 }, // Populated via APC lookup
    { id: 'mandate', label: 'MANDATE', accessor: r => r.mandate, default: true, pdfWidth: 40 },
    { id: 'assignment', label: 'ASSIGNMENT', accessor: r => r.assignment, default: true, pdfWidth: 40 },
    { id: 'venue', label: 'VENUE', accessor: r => formatVenueName(r.venue), default: true, pdfWidth: 60 },
    { id: 'count', label: 'NO. OF NIGHTS', accessor: r => r.count || 0, default: true, pdfWidth: 20 },
    { id: 'year', label: 'YEAR', accessor: r => r.year, default: false, pdfWidth: 20 },
    { id: 'location', label: 'LOCATION', accessor: r => r.location, default: false, pdfWidth: 40 },
    { id: 'state', label: 'STATE', accessor: r => r.state, default: true, pdfWidth: 30 },
    { id: 'posting', label: 'POSTING', accessor: r => r.posting, default: false, pdfWidth: 30 },
    { id: 'description', label: 'DESCRIPTION', accessor: r => r.description || '-', default: true, pdfWidth: 40 }
];

const GeneratePage: React.FC = () => {
    const { success, error } = useNotification();
    const [loading, setLoading] = useState(true);
    const [exportType, setExportType] = useState<'pdf' | 'csv' | 'xlsx' | null>(null);

    const [states, setStates] = useState<any[]>([]);
    const [apcRecords, setApcRecords] = useState<APCRecord[]>([]);

    const [filterMandate, setFilterMandate] = useState('');
    const [filterAssignment, setFilterAssignment] = useState(''); // New filter state
    const [filterDescription, setFilterDescription] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    // Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [allFlatRows, setAllFlatRows] = useState<FlatPostingRow[]>([]); // Store all flattened rows

    // Report Customization
    const [reportTitle1, setReportTitle1] = useState('');
    const [reportTitle2, setReportTitle2] = useState('');
    const [reportTitle3, setReportTitle3] = useState('');
    const [reportTemplate, setReportTemplate] = useState('SSCE');

    // Dynamic Fields
    const [orderedFieldIds, setOrderedFieldIds] = useState<string[]>(
        REPORT_FIELDS.filter(f => f.default).map(f => f.id)
    );
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [sortBy, setSortBy] = useState<string>(''); // empty means template default
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [showHelp, setShowHelp] = useState(false);

    const activeFields = useMemo(() => {
        const fieldMap = new Map(REPORT_FIELDS.map(f => [f.id, f]));
        return orderedFieldIds
            .map(id => fieldMap.get(id))
            .filter((f): f is ReportField => !!f);
    }, [orderedFieldIds]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [postingsData, activeAPC, statesData, nceeCenters, giftedCenters] = await Promise.all([
                getAllPostingRecords(),
                getAllAPCRecords(true),
                getAllStates(),
                getAllNCEECenters(),
                getAllGiftedCenters()
            ]);

            const activeFileNos = new Set(activeAPC.map(a => a.file_no));
            const activePostings = postingsData.filter(p => activeFileNos.has(p.file_no));

            // FLATTEN DATA
            const flattened = flattenPostings(activePostings, statesData, nceeCenters, giftedCenters);

            setAllFlatRows(flattened);
            setStates(statesData);
            setApcRecords(activeAPC);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    const uniqueMandates = useMemo(() => {
        const set = new Set(allFlatRows.map(r => r.mandate).filter(Boolean));
        return Array.from(set).sort();
    }, [allFlatRows]);

    const uniqueAssignments = useMemo(() => {
        const set = new Set(allFlatRows.map(r => r.assignment).filter(Boolean));
        return Array.from(set).sort();
    }, [allFlatRows]);

    const uniqueDescriptions = useMemo(() => {
        const set = new Set(allFlatRows.map(r => r.description).filter(Boolean));
        return Array.from(set).sort();
    }, [allFlatRows]);

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


        if (filterMandate) {
            result = result.filter(r => r.mandate === filterMandate);
        }

        if (filterAssignment) {
            result = result.filter(r => r.assignment === filterAssignment);
        }

        if (filterDescription) {
            result = result.filter(r => r.description === filterDescription);
        }

        return result;
    }, [allFlatRows, debouncedSearchQuery, filterMandate, filterAssignment, filterDescription]);

    const total = filteredFlatRows.length;

    const paginatedRows = useMemo(() => {
        const sortField = sortBy || (reportTemplate === 'ACCREDITATION' ? 'state' : 'state');
        const sortDir = sortOrder === 'asc' ? 1 : -1;

        const sorted = [...filteredFlatRows].sort((a, b) => {
            const valA = (a as any)[sortField]?.toString().trim() || '';
            const valB = (b as any)[sortField]?.toString().trim() || '';
            const comp = valA.localeCompare(valB, undefined, { sensitivity: 'base', numeric: true });

            if (comp !== 0) return comp * sortDir;

            // Secondary sort by venue if primary is state
            if (sortField === 'state') {
                const venueA = a.venue || '';
                const venueB = b.venue || '';
                return venueA.localeCompare(venueB) * sortDir;
            }
            return 0;
        });

        const startIndex = (page - 1) * limit;
        return sorted.slice(startIndex, startIndex + limit);
    }, [filteredFlatRows, page, limit, sortBy, sortOrder, reportTemplate]);

    // Check 'page' validity when filtered count changes
    useEffect(() => {
        const maxPage = Math.ceil(total / limit) || 1;
        if (page > maxPage) setPage(maxPage);
    }, [total, limit]);

    const flattenPostings = (list: PostingResponse[], stateList: any[] = [], nceeList: NCEECenter[] = [], giftedList: any[] = []): FlatPostingRow[] => {
        const result: FlatPostingRow[] = [];
        const normalize = (name: string) => name.toUpperCase().replace(/[-\s]/g, '');
        const stateMap = new Map<string, string>();
        stateList.forEach(s => stateMap.set(normalize(s.name), s.name));

        const nceeMap = new Map<string, string>();
        nceeList.forEach(c => {
            const label = c.within_capital ? 'Within Capital' : c.outside_capital ? 'Outside Capital' : '-';
            if (c.name) nceeMap.set(normalize(c.name), label);
            if (c.code) nceeMap.set(normalize(c.code), label);
        });

        const giftedMap = new Map<string, string>();
        giftedList.forEach(c => {
            // Assuming Gifted Centers follow similar structure or just default to 'Gifted Center'
            // If Gifted Centers have within_capital/outside_capital, use that. 
            // Looking at GiftedCenter type (copied from NCEE), it should have them.
            const label = c.within_capital ? 'Within Capital' : c.outside_capital ? 'Outside Capital' : '-';
            if (c.name) giftedMap.set(normalize(c.name), label);
            if (c.code) giftedMap.set(normalize(c.code), label);
        });

        const extractCode = (text: string) => {
            const match = text.match(/\((.*?)\)/);
            return match ? normalize(match[1]) : null;
        };

        const cleanName = (text: string) => {
            return normalize(text.replace(/\(.*?\)/g, '').split('|')[0].split('-')[0].trim());
        };

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
                let state = p.state || '';
                // CRITICAL FIX: Preserve the original full string for 'venue' property so PDF parser can handle it
                // 'posting' variable holds the CLEAN name for display in the table, but 'venue' logic below was overwriting it with partial data
                // We need to differentiate: 
                // 1. 'venue' -> FULL STRING for internal logic and PDF parsing
                // 2. 'posting' -> CLEAN NAME for UI display if needed (though UI uses 'venue' accessor usually)

                let posting = vName; // Default posting to full name
                let cleanVenueName = vName; // Will hold just the name part

                if (!state && vName.includes('|')) {
                    const parts = vName.split('|').map(p => p.trim());
                    // Format: (CODE) | POSTING | STATE
                    if (parts.length === 3) {
                        // posting = parts[1]; // KEEP FULL STRING
                        state = stateMap.get(normalize(parts[2])) || parts[2];
                    } else if (parts.length === 2) {
                        // posting = parts[0]; // KEEP FULL STRING
                        state = stateMap.get(normalize(parts[1])) || parts[1];
                    }
                } else if (!state && vName.includes(' - ')) {
                    const parts = vName.split(' - ').map(p => p.trim());
                    if (parts.length === 3) {
                        // posting = parts[1];
                        state = stateMap.get(normalize(parts[2])) || parts[2];
                    } else if (parts.length === 2) {
                        if (parts[0].startsWith('(')) {
                            // Format: (CODE) - NAME
                            // Check if NAME is a state
                            const possibleName = parts[1];
                            const matchedState = stateMap.get(normalize(possibleName));
                            if (matchedState) {
                                // posting = possibleName;
                                state = matchedState;
                            } else {
                                // posting = possibleName;
                                state = '';
                            }
                        } else {
                            // posting = parts[0];
                            state = stateMap.get(normalize(parts[1])) || parts[1];
                        }
                    }
                } else if (!state) {
                    // Fallback for raw names
                    state = stateMap.get(normalize(vName)) || '';
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
                    venue: vName, // formatVenueName(vName) might be stripping code, using raw vName ensures PDF parser gets full string
                    posting: posting || '-',
                    state: state || '-',
                    count: p.count || 0,
                    year: p.year || '-',
                    location: nceeMap.get(normalize(vName)) ||
                        nceeMap.get(normalize(posting)) ||
                        giftedMap.get(normalize(vName)) ||
                        giftedMap.get(normalize(posting)) ||
                        (extractCode(vName) ? nceeMap.get(extractCode(vName)!) : null) ||
                        (extractCode(vName) ? giftedMap.get(extractCode(vName)!) : null) ||
                        nceeMap.get(cleanName(vName)) ||
                        nceeMap.get(cleanName(posting)) ||
                        giftedMap.get(cleanName(vName)) ||
                        giftedMap.get(cleanName(posting)) ||
                        '-',
                    posted_for: p.posted_for || 0,
                    to_be_posted: p.to_be_posted || 0,
                    description: p.description || '' // Populate description
                });
            }
        });
        return result;
    };



    const handleExport = (type: 'xlsx' | 'csv') => {
        try {
            setExportType(type);
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
                if (reportTitle1?.trim()) doc.text(reportTitle1.toUpperCase(), width / 2, 28, { align: 'center' });

                doc.setFontSize(12);
                if (reportTitle2?.trim()) doc.text(reportTitle2.toUpperCase(), width / 2, 34, { align: 'center' });

                doc.setFontSize(11); // Slightly smaller for T3 if needed
                if (reportTitle3?.trim()) doc.text(reportTitle3.toUpperCase(), width / 2, 44, { align: 'center' });

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
                let currentY = 60; // Initial Start Y for first table (Increased for spacing)

                const accreditationColumns = activeFields.map(f => f.label);
                if (!accreditationColumns.includes("S/N")) accreditationColumns.unshift("S/N");

                // --- Sort within and across states ---
                const sortField = sortBy || 'state';
                const sortDir = sortOrder === 'asc' ? 1 : -1;

                for (const state of sortedStates) {
                    const stateRows = groupedByState[state].sort((a, b) => {
                        // For ACCREDITATION, always sort by CONRAISS descending (15, 14, 13...)
                        const conraissA = parseInt(a.conraiss?.replace(/\D/g, '') || '0', 10);
                        const conraissB = parseInt(b.conraiss?.replace(/\D/g, '') || '0', 10);
                        if (conraissA !== conraissB) {
                            return conraissB - conraissA; // Descending order
                        }
                        // Secondary sort by venue if CONRAISS is equal
                        const venueA = a.venue || '';
                        const venueB = b.venue || '';
                        return venueA.localeCompare(venueB);
                    }).map((post, index) => {
                        const apc = apcMap.get(post.file_no);
                        const rowData = activeFields.map(f => {
                            if (f.id === 'qualification') {
                                return apc?.qualification || '-';
                            }
                            return f.accessor(post);
                        });
                        return [index + 1, ...rowData];
                    });

                    // Check space for Title + Table Header + at least one row (approx 20 + 20 + 20)
                    // If near bottom, add page to keep title with table
                    if (currentY > height - 60) {
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
                        margin: { top: 45, bottom: 45 },
                        theme: 'grid',
                        styles: { fontSize: 11, cellPadding: 2, minCellHeight: 8 },
                        bodyStyles: { fontStyle: 'bold' },
                        headStyles: { fillColor: (config.tableHeaderColor as any), textColor: 255, fontStyle: 'bold' },
                        columnStyles: colStyles,
                        rowPageBreak: 'avoid',
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

            } else if (reportTemplate === 'MARKING') {
                // --- MARKING FORMAT (Group by Venue) ---

                // Helper to extract venue details
                // Helper to extract venue details
                const parseVenue = (venue: string): { code: string; name: string; state: string } => {
                    if (!venue) return { code: '', name: 'Unknown', state: 'Unknown' };

                    // Clean first to handle "Ondo | Ondo"
                    const cleaned = formatVenueName(venue);

                    let parts: string[] = [];
                    if (cleaned.includes('|')) parts = cleaned.split('|').map(p => p.trim());
                    else if (cleaned.includes(' - ')) parts = cleaned.split(' - ').map(p => p.trim());
                    else return { code: '', name: cleaned, state: 'Unknown' };

                    let code = '';
                    let name = '';
                    let state = '';

                    if (parts.length >= 3) {
                        code = parts[0]; name = parts[1]; state = parts[2];
                    } else if (parts.length === 2) {
                        name = parts[0]; state = parts[1];
                        // Try extract code (123) from name
                        const codeMatch = name.match(/^\((\w+)\)\s*(.+)$/);
                        if (codeMatch) {
                            code = codeMatch[1];
                            name = codeMatch[2];
                        }
                    } else {
                        name = cleaned; state = 'Unknown';
                    }
                    return { code, name, state };
                };

                // Group by Normalized Venue (Name + State) to merge strict/loose formats
                const groupedData: { [key: string]: { details: any; staff: any[] } } = {};

                filteredFlatRows.forEach(post => {
                    const venueStr = post.venue || 'Unknown Venue';
                    const details = parseVenue(venueStr);
                    // Create normalized key: NAME|STATE (uppercased for safety)
                    const normKey = `${details.name.toUpperCase()}|${details.state.toUpperCase()}`;

                    if (!groupedData[normKey]) {
                        groupedData[normKey] = {
                            details: details,
                            staff: []
                        };
                    } else {
                        // If existing details lack code but new one has it, update details to prefer full info
                        if (!groupedData[normKey].details.code && details.code) {
                            groupedData[normKey].details = details;
                        }
                    }
                    groupedData[normKey].staff.push(post);
                });

                // Sort Grouped Venues by State Name (Ascending), then by Venue Code (Ascending)
                const sortedVenueKeys = Object.keys(groupedData).sort((a, b) => {
                    const stateA = groupedData[a].details.state.toLowerCase();
                    const stateB = groupedData[b].details.state.toLowerCase();
                    const stateCompare = stateA.localeCompare(stateB);
                    if (stateCompare !== 0) return stateCompare;

                    // Secondary sort by venue code (ascending)
                    const codeA = groupedData[a].details.code || '';
                    const codeB = groupedData[b].details.code || '';
                    return codeA.localeCompare(codeB, undefined, { numeric: true });
                });

                // Helper to determine priority based on partial match
                const getMandatePriority = (mandate: string): number => {
                    const m = (mandate || '').toUpperCase();
                    // Priority 1: VC
                    if (m.includes('VC')) return 1;
                    // Priority 2: SRO
                    if (m.includes('SRO')) return 2;
                    // Priority 3: CS
                    if (m.includes('CS')) return 3;
                    // Priority 5: ATSO (Check before SO to ensure ATSO isn't caught as SO)
                    if (m.includes('ATSO')) return 5;
                    // Priority 4: SO
                    if (m.includes('SO')) return 4;
                    // Priority 6: ICT/ERO
                    if (m.includes('ICT') || m.includes('ERO')) return 6;
                    // Priority 7: ACCOUNT
                    if (m.includes('ACCOUNT') || m.includes('ACCT')) return 7;

                    return 99; // Others last
                };

                let currentY = 55;
                let isFirstTable = true;
                const markingColumns = activeFields.map(f => f.label);

                for (const venueKey of sortedVenueKeys) {
                    const venueData = groupedData[venueKey];
                    const { code, name, state } = venueData.details;

                    // Sort Staff by Mandate Priority
                    const sortedStaff = venueData.staff.sort((a, b) => {
                        const prioA = getMandatePriority(a.mandate);
                        const prioB = getMandatePriority(b.mandate);
                        return prioA - prioB;
                    }).map((post, index) => activeFields.map(f => {
                        if (f.id === 'count') return index + 1; // Recalculate S/N per table
                        return f.accessor(post);
                    }));

                    // Check page break logic
                    // Estimate table height: Header (20) + Row (10) * Count
                    const estTableHeight = 40 + (sortedStaff.length * 10);

                    if (!isFirstTable && (currentY + estTableHeight > height - 40)) {
                        doc.addPage();
                        currentY = 45;
                    }

                    // Print Venue Header: Center Code | Center Name | State Name
                    doc.setFontSize(11);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(0, 0, 0);

                    // Box for Header
                    doc.setFillColor(240, 255, 240); // Light Green Tint
                    doc.setDrawColor(0, 100, 0);
                    doc.rect(15, currentY - 6, width - 30, 8, 'FD');

                    const headerText = `${code ? code + ' | ' : ''}${name} | ${state}`;
                    doc.text(headerText.toUpperCase(), width / 2, currentY, { align: 'center' });

                    currentY += 5;

                    // Dynamic Column Sizing
                    const colStyles: any = { 0: { halign: 'center', cellWidth: 15 } };
                    activeFields.forEach((f, i) => {
                        // Adjust index if S/N is not in activeFields but we want to map styles. 
                        // But here activeFields drives columns.
                        colStyles[i] = { cellWidth: f.pdfWidth || 'auto' };
                        if (f.id === 'conraiss' || f.id === 'count' || f.id === 'year') {
                            colStyles[i].halign = 'center';
                        }
                    });

                    // Draw Table
                    autoTable(doc, {
                        head: [markingColumns],
                        body: sortedStaff,
                        startY: currentY,
                        theme: 'grid',
                        headStyles: {
                            fillColor: [0, 128, 0], // Green
                            textColor: [255, 255, 255],
                            fontStyle: 'bold',
                            fontSize: 10,
                            valign: 'middle'
                        },
                        bodyStyles: {
                            fontSize: 10.5,
                            cellPadding: 3,
                            fontStyle: 'bold',
                            valign: 'top',
                            overflow: 'linebreak'
                        },
                        styles: {
                            overflow: 'linebreak',
                            cellWidth: 'wrap'
                        },
                        columnStyles: colStyles,
                        margin: { top: 55, bottom: 45, left: 15, right: 15 },
                        didDrawPage: drawPageContent
                    });

                    currentY = (doc as any).lastAutoTable.finalY + 15;
                    isFirstTable = false;
                }

            } else {
                // SSCE / NCEE (Standard Single Table)
                const tableColumn = ["S/N", ...activeFields.map(f => f.label)];

                const sortField = sortBy || 'state';
                const sortDir = sortOrder === 'asc' ? 1 : -1;

                const sortedRows = [...filteredFlatRows].sort((a, b) => {
                    const valA = (a as any)[sortField]?.toString().trim() || '';
                    const valB = (b as any)[sortField]?.toString().trim() || '';

                    // Specific behavior for NCEE/SSCE default: if sorting by state, also sub-sort by venue
                    if (!sortBy && sortField === 'state') {
                        const stateComp = valA.localeCompare(valB, undefined, { sensitivity: 'base', numeric: true });
                        if (stateComp !== 0) return stateComp * sortDir;
                        const venueA = a.venue || '';
                        const venueB = b.venue || '';
                        return venueA.localeCompare(venueB) * sortDir;
                    }

                    return valA.localeCompare(valB, undefined, { sensitivity: 'base', numeric: true }) * sortDir;
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
                    startY: 55,
                    margin: { top: 45, bottom: 45 },
                    theme: 'grid',
                    styles: { fontSize: 11, cellPadding: 2, minCellHeight: 8 },
                    bodyStyles: { fontStyle: 'bold' },
                    headStyles: { fillColor: (config.tableHeaderColor as any), textColor: 255, fontStyle: 'bold' },
                    columnStyles: colStyles,
                    alternateRowStyles: { fillColor: [240, 253, 244] },
                    rowPageBreak: 'avoid',
                    didDrawPage: (data) => drawPageContent(data)
                });
            }

            doc.save(`NECO_${reportTemplate}_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            success("PDF Export successful!");
        } catch (err) {
            console.error("PDF Export failed:", err);
            error("Failed to export PDF. Ensure the logo exists at /images/neco.png");
        } finally {
            setExportType(null);
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-full bg-slate-50 dark:bg-[#0b1015] p-4 md:p-8 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">

            {/* Export Loading Overlay */}
            {exportType && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center animate-fadeIn">
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
                            Processing {filteredFlatRows.length} records
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 to-teal-800 dark:from-emerald-400 dark:to-teal-500 tracking-tight">
                        Generate Reports
                    </h1>
                    <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">
                        Filter and export posting assignment reports.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowHelp(true)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all shadow-sm font-bold text-xs"
                        title="Page Guide"
                    >
                        <span className="material-symbols-outlined text-lg">help</span>
                        Help
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
                        <div className="space-y-6">
                            {/* Active Columns (Ordered) */}
                            <div>
                                <label className="text-[10px] font-black text-indigo-400 uppercase mb-3 block tracking-widest">Active Columns (Drag or Move to Reorder)</label>
                                <div className="flex flex-wrap gap-2">
                                    {activeFields.map((field, orderIdx) => (
                                        <div
                                            key={field.id}
                                            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-900/20 shadow-sm animate-in fade-in zoom-in duration-200"
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

                                            <span className="text-xs font-bold text-indigo-900 dark:text-indigo-100">
                                                {field.label}
                                            </span>

                                            <div className="flex gap-0.5 ml-1 border-l border-indigo-200 dark:border-indigo-900/50 pl-1">
                                                <button
                                                    disabled={orderIdx === 0}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const next = [...orderedFieldIds];
                                                        [next[orderIdx - 1], next[orderIdx]] = [next[orderIdx], next[orderIdx - 1]];
                                                        setOrderedFieldIds(next);
                                                    }}
                                                    className="w-5 h-5 flex items-center justify-center hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded disabled:opacity-20 text-indigo-600 dark:text-indigo-400"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                                                </button>
                                                <button
                                                    disabled={orderIdx === orderedFieldIds.length - 1}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const next = [...orderedFieldIds];
                                                        [next[orderIdx], next[orderIdx + 1]] = [next[orderIdx + 1], next[orderIdx]];
                                                        setOrderedFieldIds(next);
                                                    }}
                                                    className="w-5 h-5 flex items-center justify-center hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded disabled:opacity-20 text-indigo-600 dark:text-indigo-400"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Available Columns */}
                            {orderedFieldIds.length < REPORT_FIELDS.length && (
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Available Columns</label>
                                    <div className="flex flex-wrap gap-2">
                                        {REPORT_FIELDS.filter(f => !orderedFieldIds.includes(f.id)).map(field => (
                                            <button
                                                key={field.id}
                                                onClick={() => setOrderedFieldIds(prev => [...prev, field.id])}
                                                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-indigo-300 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all group"
                                            >
                                                <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 group-hover:text-indigo-500 flex items-center justify-center transition-colors">
                                                    <span className="material-symbols-outlined text-sm font-bold">add</span>
                                                </div>
                                                <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                                    {field.label}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
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
                        {[{ key: 'SSCE', label: 'SSCE FORMAT' }, { key: 'NCEE', label: 'NCEE FORMAT' }, { key: 'ACCREDITATION', label: 'ACCREDITATION FORMAT' }, { key: 'MARKING', label: 'MARKING FORMAT' }].map(({ key: template, label }) => (
                            <label key={template} className={`flex-1 cursor-pointer relative px-4 py-3 rounded-lg border-2 transition-all duration-200 flex items-center justify-center gap-2 ${reportTemplate === template ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-emerald-200'}`}>
                                <input
                                    type="radio"
                                    name="reportTemplate"
                                    className="hidden"
                                    checked={reportTemplate === template}
                                    onChange={() => setReportTemplate(template)}
                                />
                                <span className={`material-symbols-outlined text-xl ${reportTemplate === template ? 'font-filled' : ''}`}>
                                    {template === 'SSCE' ? 'school' : template === 'NCEE' ? 'child_care' : template === 'ACCREDITATION' ? 'verified' : 'history_edu'}
                                </span>
                                <span className="font-bold text-sm">{label}</span>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Report Title 1</label>
                        <select
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-sm font-medium"
                            value={reportTitle1}
                            onChange={(e) => setReportTitle1(e.target.value)}
                        >
                            <option value="">Select a Title or Leave Blank</option>
                            {[
                                "2026 SENIOR SCHOOL CERTIFICATE EXAMINATION (SSCE INTERNAL)",
                                "2026 SENIOR SCHOOL CERTIFICATE EXAMINATION (SSCE EXTERNAL)",
                                "2026 NATIONAL COMMON ENTRANCE EXAMINATION (NCEE)",
                                "2026 BASIC EDUCATION CERTIFICATE EXAMINATION (BECE)",
                                "2026 ACCREDITATION EXERCISE"
                            ].map(val => (
                                <option key={val} value={val}>{val}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Report Title 2</label>
                        <input
                            type="text"
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-sm font-medium"
                            value={reportTitle2}
                            onChange={(e) => setReportTitle2(e.target.value)}
                            placeholder="e.g. OFFICERS POSTING"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Report Title 3</label>
                        <input
                            type="text"
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-sm font-medium"
                            value={reportTitle3}
                            onChange={(e) => setReportTitle3(e.target.value)}
                            placeholder="e.g. FINAL LIST"
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Mandate</label>
                        <select
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-sm font-medium"
                            value={filterMandate}
                            onChange={(e) => setFilterMandate(e.target.value)}
                        >
                            <option value="">All Mandates</option>
                            {uniqueMandates.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div className="relative">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Assignment</label>
                        <select
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-sm font-medium"
                            value={filterAssignment}
                            onChange={(e) => setFilterAssignment(e.target.value)}
                        >
                            <option value="">All Assignments</option>
                            {uniqueAssignments.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                    <div className="relative">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Description</label>
                        <select
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-sm font-medium"
                            value={filterDescription}
                            onChange={(e) => setFilterDescription(e.target.value)}
                        >
                            <option value="">All Descriptions</option>
                            {uniqueDescriptions.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                </div>

                {/* Sorting Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Sort By</label>
                        <div className="flex gap-2">
                            <select
                                className="flex-1 h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-sm font-medium"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="">Template Default</option>
                                {REPORT_FIELDS.map(f => (
                                    <option key={f.id} value={f.id}>{f.label}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                className="h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition-all"
                                title={`Currently ${sortOrder.toUpperCase()}`}
                            >
                                <span className="material-symbols-outlined text-xl">
                                    {sortOrder === 'asc' ? 'south' : 'north'}
                                </span>
                            </button>
                        </div>
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

            <HelpModal
                isOpen={showHelp}
                onClose={() => setShowHelp(false)}
                helpData={helpContent.assignmentHistory}
            />
        </div >
    );
};

export default GeneratePage;