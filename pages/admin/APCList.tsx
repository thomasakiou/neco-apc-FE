import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebounce } from '../../hooks/useDebounce';
import { APCRecord, APCCreate, APCUpdate } from '../../types/apc';
import { getAllAPC, createAPC, updateAPC, deleteAPC, uploadAPC, appendAPC, bulkDeleteAPC, getAllAPCRecords } from '../../services/apc';
import { getAllAssignments } from '../../services/assignment';
import { getAllStaff, isRetiring } from '../../services/staff';
import { getAllPostingRecords, updatePosting } from '../../services/posting';
import { getPageCache, setPageCache } from '../../services/pageCache';
import { PostingResponse } from '../../types/posting';
import { assignmentFieldMap } from '../../services/personalizedPost';
import { Assignment } from '../../types/assignment';
import AlertModal from '../../components/AlertModal';
import HelpModal from '../../components/HelpModal';
import { helpContent } from '../../data/helpContent';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SearchableSelect from '../../components/SearchableSelect';
const APCList: React.FC = () => {
    const cached = getPageCache('APCList');

    const [allRecords, setAllRecords] = useState<APCRecord[]>(cached?.data || []);
    const [allPostings, setAllPostings] = useState<PostingResponse[]>(cached?.allPostings || []);
    const [loading, setLoading] = useState(!cached);
    const [showHelp, setShowHelp] = useState(false);
    // Search and Filter States
    const [page, setPage] = useState(cached?.page || 1);
    const [limit, setLimit] = useState(cached?.limit || 10);

    // Sorting State
    const [sortField, setSortField] = useState<keyof APCRecord | null>(cached?.sortField || null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(cached?.sortDirection || 'asc');


    const [assignmentOptions, setAssignmentOptions] = useState<Assignment[]>(cached?.assignmentOptions || []);

    // Filters
    const [searchFileNo, setSearchFileNo] = useState(cached?.searchTerm || '');
    const [searchName, setSearchName] = useState(cached?.filters?.searchName || '');
    const [filterConraiss, setFilterConraiss] = useState(cached?.filters?.filterConraiss || '');
    const [filterStation, setFilterStation] = useState(cached?.filters?.filterStation || '');
    const [filterAssignment, setFilterAssignment] = useState(cached?.filters?.filterAssignment || '');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>(cached?.filters?.filterStatus || 'all');
    const [selectedDOB, setSelectedDOB] = useState(cached?.filters?.selectedDOB || 'All');
    const [selectedRetiring, setSelectedRetiring] = useState(cached?.filters?.selectedRetiring || 'All');
    const [viewMode, setViewMode] = useState<'full' | 'unified'>(cached?.viewMode || 'full');

    const hasInitialized = useRef(!!cached);

    // Debounced search
    const debouncedSearchFileNo = useDebounce(searchFileNo, 300);
    const debouncedSearchName = useDebounce(searchName, 300);
    const debouncedFilterStation = useDebounce(filterStation, 300);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchParams, setSearchParams] = useSearchParams();
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState<APCRecord | null>(null);
    const [alertModal, setAlertModal] = useState<{
        isOpen: boolean;
        title: string;
        message?: string;
        type: 'success' | 'error' | 'warning' | 'info';
        details?: any;
        onConfirm?: () => void;
    }>({ isOpen: false, title: '', type: 'info' });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const appendFileInputRef = useRef<HTMLInputElement>(null);
    const customFileInputRef = useRef<HTMLInputElement>(null);

    const [showCustomModal, setShowCustomModal] = useState(false);
    const [showRandomModal, setShowRandomModal] = useState(false);

    // DOB Map and Search State
    const [staffDobMap, setStaffDobMap] = useState<Map<string, string>>(new Map());
    const [staffRetiringMap, setStaffRetiringMap] = useState<Map<string, boolean>>(new Map());
    const [dobSearchText, setDobSearchText] = useState('');
    const [showDobDropdown, setShowDobDropdown] = useState(false);
    const dobDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const f = searchParams.get('f');
        if (f) {
            setSearchFileNo(f);
        }
    }, [searchParams]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearchFileNo, debouncedSearchName, filterConraiss, debouncedFilterStation, filterAssignment, filterStatus, selectedDOB, selectedRetiring]);

    const filteredRecords = useMemo(() => {
        let result = [...allRecords];

        // FILTER LOGIC
        if (debouncedSearchFileNo) {
            const lowerFileNo = debouncedSearchFileNo.toLowerCase().trim();
            result = result.filter(record => record.file_no.toLowerCase().includes(lowerFileNo));
        }
        if (debouncedSearchName) {
            const lowerName = debouncedSearchName.toLowerCase().trim();
            result = result.filter(record => record.name.toLowerCase().includes(lowerName));
        }
        if (filterConraiss) {
            result = result.filter(record => record.conraiss === filterConraiss);
        }
        if (debouncedFilterStation) {
            const lowerStation = debouncedFilterStation.toLowerCase().trim();
            result = result.filter(record => record.station && record.station.toLowerCase().includes(lowerStation));
        }

        if (filterAssignment) {
            const fieldName = assignmentFieldMap[filterAssignment];
            if (fieldName) {
                result = result.filter(record => {
                    const val = record[fieldName as keyof APCRecord];
                    return !!(val && val.toString().trim() !== '' && val.toString().trim().toUpperCase() !== 'RETURNED');
                });
            }
        }

        // Status Filter
        if (filterStatus === 'active') {
            result = result.filter(record => record.active === true);
        } else if (filterStatus === 'inactive') {
            result = result.filter(record => record.active === false);
        }

        // DOB Filter
        if (selectedDOB && selectedDOB !== 'All') {
            result = result.filter(record => {
                const dob = staffDobMap.get(record.file_no);
                return dob && dob.startsWith(selectedDOB);
            });
        }

        // Retiring Filter
        if (selectedRetiring !== 'All') {
            result = result.filter(record => {
                const isRetiringStaff = staffRetiringMap.get(record.file_no);
                return selectedRetiring === 'Yes' ? isRetiringStaff : !isRetiringStaff;
            });
        }

        // SORT LOGIC
        if (sortField) {
            result.sort((a, b) => {
                const aValue = a[sortField];
                const bValue = b[sortField];

                if (aValue === bValue) return 0;
                if (aValue === undefined || aValue === null) return 1;
                if (bValue === undefined || bValue === null) return -1;

                const compareResult = aValue < bValue ? -1 : 1;
                return sortDirection === 'asc' ? compareResult : -compareResult;
            });
        }

        return result;
    }, [allRecords, debouncedSearchFileNo, debouncedSearchName, filterConraiss, debouncedFilterStation, filterAssignment, filterStatus, sortField, sortDirection, selectedDOB, staffDobMap, selectedRetiring, staffRetiringMap]);

    const total = filteredRecords.length;

    const records = useMemo(() => {
        const startIndex = (page - 1) * limit;
        return filteredRecords.slice(startIndex, startIndex + limit);
    }, [filteredRecords, page, limit]);

    // Update dropdown options based on allRecords
    const conraissOptions = useMemo(() => {
        return Array.from(new Set(allRecords.map(r => r.conraiss).filter(Boolean))).sort() as string[];
    }, [allRecords]);

    const stationOptions = useMemo(() => {
        const stations = Array.from(new Set(allRecords.map(r => r.station).filter(Boolean))).sort() as string[];
        return stations.map(s => ({ id: s, name: s }));
    }, [allRecords]);

    const uniqueDOBs = useMemo(() => {
        const dobs = new Set<string>();
        staffDobMap.forEach((dob) => {
            if (dob) dobs.add(dob.split('-')[0].split('T')[0]);
        });
        return Array.from(dobs).sort().reverse();
    }, [staffDobMap]);

    // Update cache
    useEffect(() => {
        setPageCache('APCList', {
            data: allRecords,
            allPostings,
            page,
            limit,
            sortField,
            sortDirection,
            searchTerm: searchFileNo,
            filters: {
                searchName,
                filterConraiss,
                filterStation,
                filterAssignment,
                filterStatus,
                selectedDOB,
                selectedRetiring
            },
            assignmentOptions,
            viewMode
        });
    }, [allRecords, allPostings, page, limit, sortField, sortDirection, searchFileNo, searchName, filterConraiss, filterStation, filterAssignment, filterStatus, assignmentOptions, viewMode, selectedDOB, selectedRetiring]);

    const fetchAllRecords = useCallback(async (force: boolean = false) => {
        if (hasInitialized.current && !force) {
            hasInitialized.current = false;
            return;
        }

        setLoading(true);
        try {
            const [all, postingsData] = await Promise.all([
                getAllAPCRecords(false, force),
                getAllPostingRecords(force)
            ]);
            setAllRecords(all);
            setAllPostings(postingsData);
        } catch (error) {
            console.error('Error fetching all records:', error);
            setAlertModal({
                isOpen: true,
                title: 'Error',
                message: 'Failed to fetch records. Please try again.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    }, []);

    const toggleRow = useCallback((id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleSelectAll = useCallback((checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(allRecords.map(r => r.id)));
        } else {
            setSelectedIds(new Set());
        }
    }, [allRecords]);

    const handleSelectOne = useCallback((id: string, checked: boolean) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    }, []);

    const handleSort = useCallback((field: keyof APCRecord) => {
        setSortField(prevField => {
            if (prevField === field) {
                setSortDirection(prevDir => (prevDir === 'asc' ? 'desc' : 'asc'));
                return field;
            }
            setSortDirection('asc');
            return field;
        });
    }, []);

    useEffect(() => {
        const loadAssignments = async () => {
            if (cached?.assignmentOptions) return;
            try {
                const data = await getAllAssignments(true);
                setAssignmentOptions(data);
            } catch (e) {
                console.error("Failed to load assignments", e);
            }
        };

        const loadStaffDOBs = async () => {
            try {
                const staffData = await getAllStaff(true);
                const dobMap = new Map<string, string>();
                const retiringMap = new Map<string, boolean>();
                staffData.forEach(s => {
                    if (s.dob) dobMap.set(s.fileno, s.dob);
                    retiringMap.set(s.fileno, isRetiring(s));
                });
                setStaffDobMap(dobMap);
                setStaffRetiringMap(retiringMap);
            } catch (e) {
                console.error("Failed to load staff DOBs", e);
            }
        };

        loadAssignments();
        loadStaffDOBs();
        fetchAllRecords();
    }, [fetchAllRecords, cached?.assignmentOptions]);

    const handleBulkDelete = useCallback(() => {
        if (selectedIds.size === 0) return;

        setAlertModal({
            isOpen: true,
            title: 'Confirm Delete',
            message: `Are you sure you want to delete ${selectedIds.size} APC record(s)?`,
            type: 'warning',
            onConfirm: async () => {
                try {
                    setLoading(true);
                    await bulkDeleteAPC(Array.from(selectedIds));

                    setSelectedIds(new Set());

                    // Background re-sync
                    fetchAllRecords();

                    setAlertModal({ isOpen: true, title: 'Success', message: 'Records deleted successfully.', type: 'success' });
                } catch (error) {
                    setAlertModal({ isOpen: true, title: 'Error', message: 'Failed to delete records.', type: 'error' });
                } finally {
                    setLoading(false);
                }
            }
        });
    }, [selectedIds, fetchAllRecords]);

    const handleExport = useCallback(async () => {
        try {
            setLoading(true);
            const allData = await getAllAPC(0, 100000, '');

            const filteredExport = allData.items.filter(record => {
                const matchFileNo = record.file_no.toLowerCase().includes(searchFileNo.toLowerCase().trim());
                const matchName = record.name.toLowerCase().includes(searchName.toLowerCase().trim());
                const matchConraiss = filterConraiss ? record.conraiss === filterConraiss : true;
                const matchStation = filterStation ? record.station === filterStation : true;
                return matchFileNo && matchName && matchConraiss && matchStation;
            });

            const exportData = filteredExport.map(record => ({
                'File Number': record.file_no,
                'Name': record.name,
                'CONRAISS': record.conraiss,
                'Station': record.station,
                'Qualification': record.qualification,
                'Sex': record.sex,
                'TT': record.tt,
                'MAR-ACCR': record.mar_accr,
                'NCEE': record.ncee,
                'GIFTED': record.gifted,
                'BECEP': record.becep,
                'BECE-MRKP': record.bece_mrkp,
                'SSCE-INT': record.ssce_int,
                'SWAPPING': record.swapping,
                'SSCE-INT-MRK': record.ssce_int_mrk,
                'OCT-ACCR': record.oct_accr,
                'SSCE-EXT': record.ssce_ext,
                'SSCE-EXT-MRK': record.ssce_ext_mrk,
                'PUR-SAMP': record.pur_samp,
                'INT-AUDIT': record.int_audit,
                'STOCK-TK': record.stock_tk,
                'Count': record.count ? Math.floor(record.count) : '',
                'Year': record.year ? Math.floor(Number(record.year)) : '',
                'Active': record.active ? 'Yes' : 'No',
                'Remark': record.remark
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "APC List");
            XLSX.writeFile(wb, `APC_List_${new Date().toISOString().split('T')[0]}.xlsx`);

            setAlertModal({
                isOpen: true,
                title: 'Export Successful',
                message: 'APC records have been exported to Excel.',
                type: 'success'
            });
        } catch (error) {
            setAlertModal({
                isOpen: true,
                title: 'Export Failed',
                message: 'Failed to export APC records.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    }, [searchFileNo, searchName, filterConraiss, filterStation]);

    // Report Modal State for PDF Title
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportTitle, setReportTitle] = useState('2026 STAFF APC REPORT');

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
                    img.onerror = () => resolve(null as any);
                })
            ]);

            // Build dynamic filter title
            const buildFilterTitle = (): string => {
                const parts: string[] = [];

                // Assignment filter
                if (filterAssignment) {
                    const assignmentName = assignmentOptions.find(a => a.code === filterAssignment)?.name || filterAssignment;
                    parts.push(`FOR ${assignmentName.toUpperCase()} ASSIGNMENT`);
                }

                // CONRAISS filter
                if (filterConraiss) {
                    parts.push(`FOR CONRAISS ${filterConraiss} STAFF`);
                }

                // Station filter
                if (filterStation) {
                    parts.push(`IN ${filterStation.toUpperCase()} OFFICE`);
                }

                if (parts.length === 0) {
                    return ''; // No filters active
                }

                return `APC REPORT ${parts.join(' ')}`;
            };

            const filterTitle = buildFilterTitle();

            const drawPageHeader = (data: any) => {
                const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
                const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();

                // Watermark
                doc.saveGraphicsState();
                doc.setGState(new (doc as any).GState({ opacity: 0.1 }));
                const wmWidth = 120;
                const imgAspectRatio = logoImg.width / logoImg.height;
                const wmHeight = wmWidth / imgAspectRatio;
                doc.addImage(logoImg, 'PNG', (width - wmWidth) / 2, (height - wmHeight) / 2, wmWidth, wmHeight);
                doc.restoreGraphicsState();

                // --- Header ---
                const aspectRatio = logoImg.width / logoImg.height;
                doc.addImage(logoImg, 'PNG', 15, 8, 20, 20 / aspectRatio);

                doc.setTextColor(0, 128, 0); // Green for NECO
                doc.setFontSize(18);
                doc.setFont("helvetica", "bold");
                doc.text("NATIONAL EXAMINATIONS COUNCIL (NECO)", width / 2, 18, { align: 'center' });

                doc.setTextColor(0);
                doc.setFontSize(14);
                doc.text(reportTitle.toUpperCase(), width / 2, 26, { align: 'center' });

                // Third header line for filter context
                if (filterTitle) {
                    doc.setFontSize(11);
                    doc.setFont("helvetica", "normal");
                    doc.text(filterTitle, width / 2, 32, { align: 'center' });
                }

                // --- Signature ---
                const signatureY = pageHeight - 20;

                if (signatureImg) {
                    const sigWidth = 35;
                    const sigAspectRatio = signatureImg.width / signatureImg.height;
                    const sigH = sigWidth / sigAspectRatio;
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

            const tableColumn = ["S/N", "FILE NO", "NAME", "CONRAISS", "STATION", "ASSIGNMENT"];

            // Create a map for code to name lookup
            const assignmentNameMap = new Map<string, string>(assignmentOptions.map(a => [a.code, a.name]));

            // Sort by CONRAISS descending (14, 13, 12...) before generating PDF
            const sortedRecords = [...filteredRecords].sort((a, b) => {
                const conrA = parseInt((a.conraiss || '0').replace(/\D/g, ''), 10);
                const conrB = parseInt((b.conraiss || '0').replace(/\D/g, ''), 10);
                return conrB - conrA; // Descending
            });

            // Roman numeral helper
            const toRoman = (num: number): string => {
                const romanNumerals = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv'];
                return romanNumerals[num - 1] || num.toString();
            };

            // Prepare Data
            const tableRows = sortedRecords.map((record, index) => {
                // Aggregate Assignments with Roman numerals
                const assignments: string[] = [];
                const processedFields = new Set<string>();

                // 1. Iterate over official assignments (codes) first
                assignmentOptions.forEach(opt => {
                    const field = assignmentFieldMap[opt.code];
                    // Skip if we don't know the field for this code
                    if (!field) return;

                    if (!processedFields.has(field)) {
                        const val = record[field as keyof APCRecord];
                        if (val && val.toString().trim() !== '' && val.toString().trim().toUpperCase() !== 'RETURNED') {
                            assignments.push(opt.name);
                            processedFields.add(field);
                        }
                    }
                });

                // 2. Fallback check for any extra fields in assignmentFieldMap not covered by options (just in case)
                Object.entries(assignmentFieldMap).forEach(([key, field]) => {
                    if (processedFields.has(field)) return;

                    const val = record[field as keyof APCRecord];
                    if (val && val.toString().trim() !== '' && val.toString().trim().toUpperCase() !== 'RETURNED') {
                        assignments.push(assignmentNameMap.get(key) || key);
                        processedFields.add(field);
                    }
                });

                // Format with Roman numerals
                const formattedAssignments = assignments.map((a, i) => `${toRoman(i + 1)}. ${a}`).join('\n');

                return [
                    index + 1,
                    record.file_no,
                    record.name,
                    record.conraiss,
                    record.station || '-',
                    formattedAssignments || '-'
                ];
            });

            // Increase line spacing slightly for readability
            doc.setLineHeightFactor(1.4);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 35,
                margin: { top: 35, bottom: 50 },
                theme: 'grid',
                styles: { fontSize: 10, cellPadding: 1.5, minCellHeight: 6 },
                bodyStyles: { fontStyle: 'bold' },
                headStyles: { fillColor: [0, 128, 0], textColor: 255, fontStyle: 'bold' }, // Green header
                columnStyles: {
                    0: { cellWidth: 12, halign: 'center' }, // S/N
                    1: { cellWidth: 25 }, // File No
                    2: { cellWidth: 70 }, // Name
                    3: { cellWidth: 20, halign: 'center' }, // CONRAISS
                    4: { cellWidth: 40 }, // Station
                    5: { cellWidth: 'auto' } // Assignment
                },
                alternateRowStyles: { fillColor: [240, 253, 244] },
                didDrawPage: (data) => drawPageHeader(data)
            });

            doc.save(`Staff_APC_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            setShowReportModal(false);
            setAlertModal({ isOpen: true, title: 'Success', message: 'PDF Report generated successfully.', type: 'success' });
        } catch (error: any) {
            console.error("PDF Export failed:", error);
            setAlertModal({ isOpen: true, title: 'Error', message: `Failed to generate PDF: ${error.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            const response = await uploadAPC(file);
            setAlertModal({
                isOpen: true,
                title: 'Upload Complete',
                message: 'CSV file has been processed successfully.',
                type: 'success',
                details: {
                    created: response.created_count,
                    skipped: response.skipped_count,
                    errors: response.error_count,
                    skippedData: response.skipped || [],
                    errorData: response.errors || []
                }
            });
            fetchAllRecords();
        } catch (error: any) {
            console.error('Upload failed:', error);
            setAlertModal({
                isOpen: true,
                title: 'Upload Failed',
                message: error.message || 'An error occurred while uploading the file.',
                type: 'error'
            });
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            setLoading(false);
        }
    }, [fetchAllRecords]);

    const handleAppendUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            const response = await appendAPC(file);
            setAlertModal({
                isOpen: true,
                title: 'Append Complete',
                message: 'APC records have been appended successfully (existing records skipped).',
                type: 'success',
                details: {
                    created: response.created_count,
                    skipped: response.skipped_count,
                    errors: response.error_count,
                    skippedData: response.skipped || [],
                    errorData: response.errors || []
                }
            });
            fetchAllRecords();
        } catch (error: any) {
            console.error('Append failed:', error);
            setAlertModal({
                isOpen: true,
                title: 'Append Failed',
                message: error.message || 'An error occurred while appending the records.',
                type: 'error'
            });
        } finally {
            if (appendFileInputRef.current) {
                appendFileInputRef.current.value = '';
            }
            setLoading(false);
        }
    }, [fetchAllRecords]);

    const handleEdit = useCallback((record: APCRecord) => {
        setEditingRecord(record);
        setShowAddModal(true);
    }, []);


    const handleDelete = useCallback(async (id: string) => {
        setAlertModal({
            isOpen: true,
            title: 'Confirm Delete',
            message: 'Are you sure you want to delete this APC record? This action cannot be undone.',
            type: 'warning',
            onConfirm: async () => {
                try {
                    setLoading(true);
                    await deleteAPC(id);

                    // Background re-sync
                    fetchAllRecords();

                    setAlertModal({
                        isOpen: true,
                        title: 'Success',
                        message: 'APC record deleted successfully.',
                        type: 'success'
                    });
                } catch (error) {
                    console.error('Error deleting APC record:', error);
                    setAlertModal({
                        isOpen: true,
                        title: 'Error',
                        message: 'Failed to delete APC record.',
                        type: 'error'
                    });
                } finally {
                    setLoading(false);
                }
            }
        });
    }, [fetchAllRecords]);

    const downloadCsvTemplate = () => {
        const headers = [
            'file_no', 'name', 'conraiss', 'station', 'qualification', 'sex',
            'tt', 'mar_accr', 'ncee', 'gifted', 'becep', 'bece_mrkp',
            'ssce_int', 'swapping', 'ssce_int_mrk', 'oct_accr', 'ssce_ext',
            'ssce_ext_mrk', 'pur_samp', 'int_audit', 'stock_tk', 'count', 'year', 'remark'
        ];
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "apc_upload_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background-light dark:bg-[#101922] p-4 md:p-8 gap-6 md:gap-8 overflow-y-auto transition-colors duration-200">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-slate-300">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 to-teal-800 dark:from-emerald-400 dark:to-teal-500 tracking-tight">
                        Annual Posting Calendar (APC)
                    </h1>
                    <p className="text-sm md:text-base lg:text-lg text-slate-500 dark:text-slate-400 font-medium">Manage staff mandate assignments and qualifications.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowHelp(true)}
                        className="flex items-center justify-center p-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all shadow-sm"
                        title="Page Guide"
                    >
                        <span className="material-symbols-outlined text-xl">help</span>
                    </button>
                    <button
                        onClick={fetchAllRecords}
                        disabled={loading}
                        className={`flex items-center justify-center p-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all shadow-sm ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Refresh Data"
                    >
                        <span className={`material-symbols-outlined text-xl ${loading ? 'animate-spin' : ''}`}>refresh</span>
                    </button>
                    {selectedIds.size > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                        >
                            <span className="material-symbols-outlined text-lg">delete</span>
                            Delete Selected ({selectedIds.size})
                        </button>
                    )}
                    <button
                        onClick={() => setShowReportModal(true)}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-rose-600 dark:text-rose-400 font-bold text-xs shadow-sm hover:shadow-md hover:border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined text-transparent bg-clip-text bg-gradient-to-br from-rose-400 to-rose-600 dark:from-rose-300 dark:to-rose-500 group-hover:scale-110 transition-transform text-lg">picture_as_pdf</span>
                        Print Report
                    </button>
                    <button
                        onClick={handleExport}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-slate-300 font-bold text-xs shadow-sm hover:shadow-md hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-indigo-600 dark:from-indigo-300 dark:to-indigo-500 group-hover:scale-110 transition-transform text-lg">download</span>
                        Export List
                    </button>
                    <button
                        onClick={downloadCsvTemplate}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-slate-500 dark:text-slate-400 font-bold text-xs shadow-sm hover:shadow-md hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined text-transparent bg-clip-text bg-gradient-to-br from-slate-400 to-slate-600 dark:from-slate-300 dark:to-slate-500 group-hover:scale-110 transition-transform text-lg">download</span>
                        Template
                    </button>
                    <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 font-bold text-xs shadow-sm hover:shadow-md hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined text-transparent bg-clip-text bg-gradient-to-br from-slate-500 to-slate-600 dark:from-slate-400 dark:to-slate-500 group-hover:scale-110 transition-transform text-lg">upload_file</span>
                        Import
                    </button>
                    <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        ref={appendFileInputRef}
                        onChange={handleAppendUpload}
                        style={{ display: 'none' }}
                    />
                    <button
                        onClick={() => appendFileInputRef.current?.click()}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-teal-600 dark:text-teal-400 font-bold text-xs shadow-sm hover:shadow-md hover:border-teal-200 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined text-transparent bg-clip-text bg-gradient-to-br from-teal-500 to-emerald-600 dark:from-teal-400 dark:to-emerald-500 group-hover:scale-110 transition-transform text-lg">library_add</span>
                        Append New Staff
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined group-hover:rotate-90 transition-transform text-lg">add</span>
                        Add Record
                    </button>
                </div>
            </div>


            <div className="bg-surface-light dark:bg-[#121b25] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-6 transition-colors duration-200">
                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-col gap-4 w-full">
                        {/* Search Row */}
                        <div className="flex flex-col md:flex-row gap-4 w-full">
                            {/* File No Search */}
                            <div className="relative flex-1 md:max-w-xs">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-slate-400 text-lg">tag</span>
                                </div>
                                <input
                                    className="w-full pl-10 h-10 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-[#0b1015] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm text-slate-700 dark:text-slate-200"
                                    placeholder="Search by File No..."
                                    value={searchFileNo}
                                    onChange={(e) => setSearchFileNo(e.target.value)}
                                />
                            </div>

                            {/* Name Search */}
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
                                </div>
                                <input
                                    className="w-full pl-10 h-10 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-[#0b1015] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm text-slate-700 dark:text-slate-200"
                                    placeholder="Search by Name..."
                                    value={searchName}
                                    onChange={(e) => setSearchName(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Filter Row */}
                        <div className="flex flex-col md:flex-row gap-4 w-full items-center">
                            {/* CONRAISS Filter */}
                            <div className="relative w-full md:w-48">
                                <select
                                    value={filterConraiss}
                                    onChange={(e) => setFilterConraiss(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-sm text-slate-700 dark:text-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                >
                                    <option value="">All CONRAISS</option>
                                    {conraissOptions.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Station Filter */}
                            <div className="relative w-full md:w-64">
                                <SearchableSelect
                                    options={[{ id: '', name: 'All Stations' }, ...stationOptions]}
                                    value={filterStation}
                                    onChange={setFilterStation}
                                    placeholder="Filter Station"
                                />
                            </div>

                            {/* Assignment Filter */}
                            <div className="relative w-full md:w-64">
                                <select
                                    value={filterAssignment}
                                    onChange={(e) => setFilterAssignment(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-sm font-bold text-black dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                >
                                    <option value="">All Assignments</option>
                                    {assignmentOptions.map(opt => (
                                        <option key={opt.id} value={opt.code}>{opt.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Status Filter */}
                            <div className="relative w-full md:w-40">
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
                                    className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-sm font-bold text-slate-700 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                >
                                    <option value="all">All Status</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>

                            {/* Retiring Status Filter */}
                            <div className="relative w-full md:w-40">
                                <select
                                    value={selectedRetiring}
                                    onChange={(e) => setSelectedRetiring(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-sm font-bold text-slate-700 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                >
                                    <option value="All">Retiring: All</option>
                                    <option value="Yes">Retiring: Yes</option>
                                    <option value="No">Retiring: No</option>
                                </select>
                            </div>

                            {/* Searchable DOB Dropdown */}
                            <div ref={dobDropdownRef} className="relative w-full md:w-56">
                                <button
                                    type="button"
                                    onClick={() => setShowDobDropdown(!showDobDropdown)}
                                    className="appearance-none w-full h-10 pl-3 pr-8 rounded-lg bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 hover:border-emerald-500 text-slate-700 dark:text-slate-200 font-bold text-sm shadow-sm transition-all cursor-pointer text-left flex items-center justify-between focus:ring-1 focus:ring-emerald-500"
                                >
                                    <span className="truncate">
                                        {selectedDOB === 'All' ? 'Year of Birth: All' : selectedDOB}
                                    </span>
                                    <span className="material-symbols-outlined text-slate-400 text-lg">
                                        {showDobDropdown ? 'expand_less' : 'arrow_drop_down'}
                                    </span>
                                </button>

                                {showDobDropdown && (
                                    <div className="absolute z-50 top-full right-0 mt-1 w-[300px] max-h-80 overflow-y-auto bg-white dark:bg-[#1a2533] border border-slate-200 dark:border-gray-700 rounded-xl shadow-xl">
                                        <div className="sticky top-0 bg-white dark:bg-[#1a2533] p-2 border-b border-slate-100 dark:border-gray-700 z-20">
                                            <div className="relative">
                                                <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                                                <input
                                                    type="text"
                                                    placeholder="Search year..."
                                                    value={dobSearchText}
                                                    onChange={(e) => setDobSearchText(e.target.value)}
                                                    className="w-full h-9 pl-8 pr-8 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/20"
                                                    autoFocus
                                                />
                                                {dobSearchText && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setDobSearchText('')}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 flex items-center justify-center p-0.5"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">close</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div
                                            onClick={() => {
                                                setSelectedDOB('All');
                                                setShowDobDropdown(false);
                                                setDobSearchText('');
                                            }}
                                            className={`px-3 py-2 cursor-pointer transition-colors ${selectedDOB === 'All' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                                        >
                                            Year of Birth: All
                                        </div>

                                        {uniqueDOBs
                                            .filter(date => date.toLowerCase().includes(dobSearchText.toLowerCase()))
                                            .map(date => (
                                                <div
                                                    key={date}
                                                    onClick={() => {
                                                        setSelectedDOB(date);
                                                        setShowDobDropdown(false);
                                                        setDobSearchText('');
                                                    }}
                                                    className={`px-3 py-2 cursor-pointer transition-colors ${selectedDOB === date ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                                                >
                                                    {date}
                                                </div>
                                            ))}

                                        {uniqueDOBs.filter(date => date.toLowerCase().includes(dobSearchText.toLowerCase())).length === 0 && (
                                            <div className="px-3 py-4 text-center text-slate-400 text-sm">
                                                No dates found
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex-1"></div>

                            {/* Pagination Limit */}
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Per page:</label>
                                <select
                                    value={limit}
                                    onChange={(e) => {
                                        setLimit(Number(e.target.value));
                                        setPage(1);
                                    }}
                                    className="h-10 px-3 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-300 font-bold text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                        </div>

                        {/* View Mode Toggle */}
                        <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl border border-slate-300 dark:border-gray-700">
                            <button
                                onClick={() => setViewMode('full')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'full' ? 'bg-white dark:bg-[#1a242f] text-primary shadow-sm ring-1 ring-slate-200 dark:ring-gray-700' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <span className="material-symbols-outlined text-lg">vertical_split</span>
                                Full View
                            </button>
                            <button
                                onClick={() => setViewMode('unified')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'unified' ? 'bg-white dark:bg-[#1a242f] text-primary shadow-sm ring-1 ring-slate-200 dark:ring-gray-700' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <span className="material-symbols-outlined text-lg">view_agenda</span>
                                Unified View
                            </button>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-[#121b25]">
                    {loading ? (
                        <div className="flex h-80 items-center justify-center">
                            <div className="flex flex-col items-center gap-3">
                                <span className="material-symbols-outlined animate-spin text-4xl text-primary/50">donut_large</span>
                                <span className="text-slate-400 font-medium text-xs">Loading records...</span>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                                <thead className="bg-slate-200/80 dark:bg-slate-800/50 text-slate-900 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-300 dark:border-gray-700">
                                    <tr>
                                        {viewMode !== 'unified' && (
                                            <th className="p-4 w-10 text-center">
                                                <button
                                                    onClick={() => {
                                                        if (expandedRows.size > 0) {
                                                            setExpandedRows(new Set());
                                                        } else {
                                                            const allIds = new Set(records.map(r => r.id));
                                                            setExpandedRows(allIds);
                                                        }
                                                    }}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                                    title={expandedRows.size > 0 ? "Collapse All" : "Expand All"}
                                                >
                                                    <span className="material-symbols-outlined text-lg">
                                                        {expandedRows.size > 0 ? 'unfold_less' : 'unfold_more'}
                                                    </span>
                                                </button>
                                            </th>
                                        )}
                                        <th className="p-4 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                                                checked={allRecords.length > 0 && allRecords.every(r => selectedIds.has(r.id))}
                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                            />
                                        </th>
                                        <SortableHeader field="file_no" label="File No" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="name" label="Name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="conraiss" label="CONRAISS" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="station" label="Station" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        {viewMode === 'unified' && (
                                            <>
                                                <th className="px-4 py-4 font-bold uppercase tracking-wider text-slate-900 dark:text-slate-300">Count</th>
                                                <th className="px-4 py-4 font-bold uppercase tracking-wider text-slate-900 dark:text-slate-300">Assignments</th>
                                            </>
                                        )}
                                        <SortableHeader field="active" label="Status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <th className="px-4 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-300 dark:divide-gray-800 bg-surface-light dark:bg-[#121b25]">
                                    {records.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="p-10 text-center">
                                                <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-1">
                                                        <span className="material-symbols-outlined text-2xl">inbox</span>
                                                    </div>
                                                    <span className="text-sm font-medium">No records found</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        records.map((record) => (
                                            <APCRow
                                                key={record.id}
                                                record={record}
                                                isSelected={selectedIds.has(record.id)}
                                                onSelect={(checked) => handleSelectOne(record.id, checked)}
                                                onEdit={() => handleEdit(record)}
                                                onDelete={() => handleDelete(record.id)}
                                                isExpanded={expandedRows.has(record.id)}
                                                onToggleExpand={() => toggleRow(record.id)}
                                                viewMode={viewMode}
                                                assignmentOptions={assignmentOptions}
                                                staffRetiringMap={staffRetiringMap}
                                            />
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-2 border-t border-slate-100 dark:border-gray-800">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Showing <span className="text-slate-900 dark:text-white font-bold">{total === 0 ? 0 : (page - 1) * limit + 1}</span> to <span className="text-slate-900 dark:text-white font-bold">{total === 0 ? 0 : Math.min((page - 1) * limit + records.length, total)}</span> of <span className="text-slate-900 dark:text-white font-bold">{total}</span> results
                    </p>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(1)}
                            className="group flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                            title="First Page"
                        >
                            <span className="material-symbols-outlined text-xl">first_page</span>
                        </button>
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="group flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                        >
                            <span className="material-symbols-outlined text-xl group-hover:-translate-x-0.5 transition-transform">chevron_left</span>
                        </button>
                        <div className="flex items-center px-4 rounded-lg bg-slate-50 dark:bg-purple-900/20 text-sm font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent">
                            Page {page} of {total > 0 ? Math.ceil(total / limit) : 1}
                        </div>
                        <button
                            disabled={page >= Math.ceil(total / limit) || total === 0}
                            onClick={() => setPage(p => p + 1)}
                            className="group flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                        >
                            <span className="material-symbols-outlined text-xl group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                        </button>
                        <button
                            disabled={page >= Math.ceil(total / limit) || total === 0}
                            onClick={() => setPage(Math.ceil(total / limit))}
                            className="group flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                            title="Last Page"
                        >
                            <span className="material-symbols-outlined text-xl">last_page</span>
                        </button>
                    </div>
                </div>
            </div>

            <AlertModal
                isOpen={alertModal.isOpen}
                onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
                title={alertModal.title}
                message={alertModal.message}
                type={alertModal.type}
                details={alertModal.details}
                onConfirm={alertModal.onConfirm}
            />

            {showReportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-[#121b25] rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-gray-800 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Report Configuration</h3>

                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                Report Title
                            </label>
                            <input
                                type="text"
                                value={reportTitle}
                                onChange={(e) => setReportTitle(e.target.value)}
                                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                placeholder="e.g. 2025 STAFF APC"
                            />
                            <p className="text-xs text-slate-400 mt-2">This title will appear at the top of the generated PDF report.</p>
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowReportModal(false)}
                                className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-sm transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePDFExport}
                                disabled={loading}
                                className={`px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {loading && <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>}
                                {loading ? 'Generating...' : 'Generate PDF'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <APCModal
                isOpen={showAddModal}
                onClose={() => {
                    setShowAddModal(false);
                    setEditingRecord(null);
                }}
                onSubmit={async (data) => {
                    try {
                        if (editingRecord) {
                            await updateAPC(editingRecord.id, data);

                            // SYNC LOGIC: Fetch FRESH postings to ensure we have latest counts
                            const currentPostings = await getAllPostingRecords(true);
                            const normFileNo = data.file_no.toString().padStart(4, '0');
                            const posting = currentPostings.find(p => p.file_no.toString().padStart(4, '0') === normFileNo);

                            if (posting) {
                                const newCount = Number(data.count || 0);
                                const postedFor = posting.posted_for || 0;
                                const newToBePosted = Math.max(0, newCount - postedFor);

                                await updatePosting(posting.id, {
                                    ...posting as any,
                                    count: newCount,
                                    posted_for: postedFor,
                                    to_be_posted: newToBePosted
                                });
                            }
                            setAlertModal({ isOpen: true, title: 'Success', message: 'APC record updated and posting synced successfully.', type: 'success' });
                        } else {
                            await createAPC(data);
                            setAlertModal({ isOpen: true, title: 'Success', message: 'APC record created successfully.', type: 'success' });
                        }
                        fetchAllRecords();
                    } catch (error: any) {
                        console.error("Submit failed", error);
                        setAlertModal({ isOpen: true, title: 'Error', message: `Failed to save record: ${error.message}`, type: 'error' });
                    }
                }}
                initialData={editingRecord}
            />

            <HelpModal
                isOpen={showHelp}
                onClose={() => setShowHelp(false)}
                helpData={helpContent.apcList}
            />
        </div>
    );
};

const APCRow = React.memo<{
    record: APCRecord;
    isSelected: boolean;
    onSelect: (checked: boolean) => void;
    onEdit: () => void;
    onDelete: () => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
    viewMode: 'full' | 'unified';
    assignmentOptions: Assignment[];
    staffRetiringMap: Map<string, boolean>;
}>(({ record, isSelected, onSelect, onEdit, onDelete, isExpanded, onToggleExpand, viewMode, assignmentOptions, staffRetiringMap }) => {
    const assignmentNameMap = useMemo(() => {
        return new Map(assignmentOptions.map(a => [a.code, a.name]));
    }, [assignmentOptions]);

    const activeAssignments = useMemo(() => {
        const canonicalAssignmentMap = {
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

        return Object.entries(canonicalAssignmentMap)
            .filter(([fieldName, _]) => {
                const val = (record as any)[fieldName];
                return val && val.toString().trim() !== '' && val.toString().trim().toUpperCase() !== 'RETURNED';
            })
            .map(([_, code]) => assignmentNameMap.get(code) || code);
    }, [record, assignmentNameMap]);

    return (
        <React.Fragment>
            <tr className={`group hover:bg-primary/[0.02] dark:hover:bg-slate-800/50 transition-colors duration-150 ${(viewMode !== 'unified' && isExpanded) ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : ''}`}>
                {viewMode !== 'unified' && (
                    <td className="p-4 text-center">
                        <button
                            onClick={onToggleExpand}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                            <span className={`material-symbols-outlined transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                chevron_right
                            </span>
                        </button>
                    </td>
                )}
                <td className="p-4 text-center">
                    <input
                        type="checkbox"
                        className="rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                        checked={isSelected}
                        onChange={(e) => onSelect(e.target.checked)}
                    />
                </td>
                <td className="px-4 py-4 font-mono text-base font-black text-slate-700 dark:text-slate-300">{record.file_no}</td>
                <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-200 font-bold text-sm ring-2 ring-white dark:ring-slate-800 shadow-sm">
                            {record.name.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-200 text-base">
                            {record.name} {staffRetiringMap.get(record.file_no) ? '(Retiring)' : ''}
                        </span>
                    </div>
                </td>
                <td className="px-4 py-4">
                    <span className="inline-flex px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold border border-slate-200 dark:border-slate-700">
                        {record.conraiss || '-'}
                    </span>
                </td>
                <td className="px-4 py-4 font-medium text-slate-700 dark:text-slate-300 text-base">{record.station || '-'}</td>
                {viewMode === 'unified' && (
                    <>
                        <td className="px-4 py-4 font-bold text-primary dark:text-primary-light">
                            {record.count || 0}
                        </td>
                        <td className="px-4 py-4">
                            <div className="flex flex-col gap-1">
                                {activeAssignments.length > 0 ? (
                                    activeAssignments.map((name, idx) => (
                                        <span key={idx} className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 w-fit">
                                            {name}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-xs font-medium text-slate-400 italic">No active assignments</span>
                                )}
                            </div>
                        </td>
                    </>
                )}
                <td className="px-4 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${record.active
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                            }`}>
                            {record.active ? 'Active' : 'Inactive'}
                        </span>
                        {!record.active && record.reactivation_date && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold border border-amber-200 dark:border-amber-800" title="Scheduled auto-reactivation date">
                                <span className="material-symbols-outlined text-[10px]">schedule</span>
                                {new Date(record.reactivation_date).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </td>
                <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                        <ActionBtn icon="edit" onClick={onEdit} tooltip="Edit Record" />
                        <ActionBtn icon="delete" isDanger onClick={onDelete} tooltip="Delete Record" />
                    </div>
                </td>
            </tr>
            {isExpanded && (
                <tr className="bg-gray-100 dark:bg-slate-800/50">
                    <td colSpan={8} className="p-4 pl-16">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm text-slate-600 dark:text-slate-400">
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">Qualification</span>
                                <span>{record.qualification || '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">Sex</span>
                                <span>{record.sex || '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">TT</span>
                                <span>{record.tt ? (record.tt.includes('.') ? parseFloat(record.tt).toString() : record.tt) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">MAR-ACCR</span>
                                <span>{record.mar_accr ? (record.mar_accr.includes('.') ? parseFloat(record.mar_accr).toString() : record.mar_accr) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">NCEE</span>
                                <span>{record.ncee ? (record.ncee.includes('.') ? parseFloat(record.ncee).toString() : record.ncee) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">GIFTED</span>
                                <span>{record.gifted ? (record.gifted.includes('.') ? parseFloat(record.gifted).toString() : record.gifted) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">BECEP</span>
                                <span>{record.becep ? (record.becep.includes('.') ? parseFloat(record.becep).toString() : record.becep) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">BECE-MRKP</span>
                                <span>{record.bece_mrkp ? (record.bece_mrkp.includes('.') ? parseFloat(record.bece_mrkp).toString() : record.bece_mrkp) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">SSCE-INT</span>
                                <span>{record.ssce_int ? (record.ssce_int.includes('.') ? parseFloat(record.ssce_int).toString() : record.ssce_int) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">SWAPPING</span>
                                <span>{record.swapping ? (record.swapping.includes('.') ? parseFloat(record.swapping).toString() : record.swapping) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">SSCE-INT-MRK</span>
                                <span>{record.ssce_int_mrk ? (record.ssce_int_mrk.includes('.') ? parseFloat(record.ssce_int_mrk).toString() : record.ssce_int_mrk) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">OCT-ACCR</span>
                                <span>{record.oct_accr ? (record.oct_accr.includes('.') ? parseFloat(record.oct_accr).toString() : record.oct_accr) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">SSCE-EXT</span>
                                <span>{record.ssce_ext ? (record.ssce_ext.includes('.') ? parseFloat(record.ssce_ext).toString() : record.ssce_ext) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">SSCE-EXT-MRK</span>
                                <span>{record.ssce_ext_mrk ? (record.ssce_ext_mrk.includes('.') ? parseFloat(record.ssce_ext_mrk).toString() : record.ssce_ext_mrk) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">PUR-SAMP</span>
                                <span>{record.pur_samp ? (record.pur_samp.includes('.') ? parseFloat(record.pur_samp).toString() : record.pur_samp) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">INT-AUDIT</span>
                                <span>{record.int_audit ? (record.int_audit.includes('.') ? parseFloat(record.int_audit).toString() : record.int_audit) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">STOCK-TK</span>
                                <span>{record.stock_tk ? (record.stock_tk.includes('.') ? parseFloat(record.stock_tk).toString() : record.stock_tk) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">Count</span>
                                <span>{record.count ? Math.floor(record.count) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">Year</span>
                                <span>{record.year ? Math.floor(Number(record.year)) : '-'}</span>
                            </div>
                            <div className="col-span-2 md:col-span-4">
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">Remark</span>
                                <span>{record.remark || '-'}</span>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
});

const ActionBtn = ({ icon, isDanger, onClick, tooltip }: { icon: string; isDanger?: boolean; onClick?: () => void; tooltip?: string }) => (
    <button
        onClick={onClick}
        title={tooltip}
        className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 ${isDanger
            ? 'text-rose-400 hover:text-rose-600 hover:bg-rose-50'
            : 'text-slate-400 hover:text-primary hover:bg-primary/5'
            }`}
    >
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
    </button>
);

const APCModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: APCCreate) => Promise<void>;
    initialData?: APCRecord | null;
}> = ({ isOpen, onClose, onSubmit, initialData }) => {
    const [formData, setFormData] = useState<APCCreate>({
        file_no: '',
        name: '',
        conraiss: '',
        station: '',
        qualification: '',
        sex: '',
        count: 1,
        active: true,
        reactivation_date: null
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                file_no: initialData.file_no,
                name: initialData.name,
                conraiss: initialData.conraiss || '',
                station: initialData.station || '',
                qualification: initialData.qualification || '',
                sex: initialData.sex || '',
                tt: initialData.tt || '',
                mar_accr: initialData.mar_accr || '',
                ncee: initialData.ncee || '',
                gifted: initialData.gifted || '',
                becep: initialData.becep || '',
                bece_mrkp: initialData.bece_mrkp || '',
                ssce_int: initialData.ssce_int || '',
                swapping: initialData.swapping || '',
                ssce_int_mrk: initialData.ssce_int_mrk || '',
                oct_accr: initialData.oct_accr || '',
                ssce_ext: initialData.ssce_ext || '',
                ssce_ext_mrk: initialData.ssce_ext_mrk || '',
                pur_samp: initialData.pur_samp || '',
                int_audit: initialData.int_audit || '',
                stock_tk: initialData.stock_tk || '',
                count: initialData.count || 1,
                year: initialData.year || '',
                remark: initialData.remark || '',
                active: initialData.active ?? true,
                reactivation_date: initialData.reactivation_date || null
            });
        } else {
            setFormData({
                file_no: '',
                name: '',
                conraiss: '',
                station: '',
                qualification: '',
                sex: '',
                count: 1,
                active: true,
                reactivation_date: null
            });
        }
    }, [initialData, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        // Convert empty date string to null for date fields
        if (name === 'reactivation_date' && value === '') {
            setFormData(prev => ({ ...prev, [name]: null }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        // Clear reactivation_date when setting to active
        if (name === 'active' && checked) {
            setFormData(prev => ({ ...prev, [name]: checked, reactivation_date: null }));
        } else {
            setFormData(prev => ({ ...prev, [name]: checked }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Prepare data for submission - convert date to ISO datetime format
            const submitData = { ...formData };
            if (submitData.reactivation_date) {
                // Convert YYYY-MM-DD to ISO 8601 datetime (backend expects datetime format)
                submitData.reactivation_date = new Date(submitData.reactivation_date).toISOString();
            }
            // Debug: log what we're submitting
            console.log('Submitting APC data:', submitData);
            await onSubmit(submitData);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const assignmentFields = [
        { key: 'tt', label: 'TT' },
        { key: 'mar_accr', label: 'MAR ACCR' },
        { key: 'ncee', label: 'NCEE' },
        { key: 'gifted', label: 'GIFTED' },
        { key: 'becep', label: 'BECEP' },
        { key: 'bece_mrkp', label: 'BECE MRKP' },
        { key: 'ssce_int', label: 'SSCE INT' },
        { key: 'swapping', label: 'SWAPPING' },
        { key: 'ssce_int_mrk', label: 'SSCE INT MRK' },
        { key: 'oct_accr', label: 'OCT ACCR' },
        { key: 'ssce_ext', label: 'SSCE EXT' },
        { key: 'ssce_ext_mrk', label: 'SSCE EXT MRK' },
        { key: 'pur_samp', label: 'PUR SAMP' },
        { key: 'int_audit', label: 'INT AUDIT' },
        { key: 'stock_tk', label: 'STOCK TK' }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 transition-all duration-300">
            <div className="bg-white/95 dark:bg-[#121b25]/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] border border-slate-200/50 dark:border-gray-700/50">
                <div className="flex-none flex items-center justify-between p-6 border-b border-slate-100 dark:border-gray-700 bg-gradient-to-r from-emerald-50/50 via-white to-teal-50/50 dark:from-emerald-900/20 dark:via-[#121b25] dark:to-teal-900/20 rounded-t-2xl">
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 to-teal-800 dark:from-emerald-400 dark:to-teal-400 tracking-tight">
                            {initialData ? 'Edit APC Record' : 'Add New APC Record'}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">Annual Posting Calendar</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all duration-200 shadow-sm border border-transparent hover:border-rose-100 dark:hover:border-rose-800"
                    >
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    <form id="apc-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2 pb-2 border-b border-slate-100 dark:border-gray-700 mb-2 flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-500 dark:text-emerald-400">person</span>
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Basic Information</span>
                            </div>

                            <FloatingInput label="File Number" name="file_no" value={formData.file_no} onChange={handleChange} required />
                            <FloatingInput label="Name" name="name" value={formData.name} onChange={handleChange} required />
                            <FloatingInput label="CONRAISS" name="conraiss" value={formData.conraiss} onChange={handleChange} />
                            <FloatingInput label="Station" name="station" value={formData.station} onChange={handleChange} />
                            <FloatingInput label="Qualification" name="qualification" value={formData.qualification} onChange={handleChange} />
                            <SelectInput label="Gender" name="sex" value={formData.sex} onChange={handleChange} options={[{ value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }]} />
                            <FloatingInput label="Count" type="number" name="count" value={formData.count} onChange={handleChange} />
                            <FloatingInput label="Year" name="year" value={formData.year} onChange={handleChange} />

                            <div className="md:col-span-2 pb-2 border-b border-slate-100 dark:border-gray-700 mb-2 mt-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-teal-500 dark:text-teal-400">assignment</span>
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Assignment Codes</span>
                            </div>

                            {assignmentFields.map(field => (
                                <FloatingInput key={field.key} label={field.label} name={field.key} value={(formData as any)[field.key] || ''} onChange={handleChange} />
                            ))}

                            <div className="md:col-span-2 pb-2 border-b border-slate-100 dark:border-gray-700 mb-2 mt-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">note_alt</span>
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Remarks & Status</span>
                            </div>

                            <div className="md:col-span-2">
                                <textarea
                                    name="remark"
                                    value={formData.remark || ''}
                                    onChange={handleChange}
                                    className="w-full min-h-[80px] p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] focus:bg-white dark:focus:bg-[#0b1015] focus:border-emerald-500 focus:ring-[3px] focus:ring-emerald-500/10 transition-all font-medium text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm resize-none"
                                    placeholder="Add any additional remarks or notes here..."
                                />
                            </div>

                            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] cursor-pointer hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-gray-600 transition-all md:col-span-2">
                                <input
                                    type="checkbox"
                                    name="active"
                                    checked={formData.active !== false}
                                    onChange={handleCheckboxChange}
                                    className="w-5 h-5 rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Active Record</span>
                            </label>

                            {/* Reactivation Date - Only show when inactive */}
                            {formData.active === false && (
                                <div className="md:col-span-2 p-4 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="material-symbols-outlined text-amber-600 dark:text-amber-400">schedule</span>
                                        <span className="text-sm font-bold text-amber-800 dark:text-amber-300">Auto-Reactivation Date (Optional)</span>
                                    </div>
                                    <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">Set a date when this staff will automatically become active again.</p>
                                    <input
                                        type="date"
                                        name="reactivation_date"
                                        value={formData.reactivation_date || ''}
                                        onChange={handleChange}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full h-12 px-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-[#0b1015] focus:border-amber-500 focus:ring-[3px] focus:ring-amber-500/10 transition-all font-bold text-slate-700 dark:text-slate-300 text-sm"
                                    />
                                </div>
                            )}
                        </div>
                    </form>
                </div>

                <div className="flex-none flex justify-end gap-4 p-6 border-t border-slate-100 dark:border-gray-700 bg-white dark:bg-[#121b25] rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-gray-600 hover:text-slate-900 dark:hover:text-slate-300 transition-all shadow-sm"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="apc-form"
                        disabled={loading}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none flex items-center gap-2"
                    >
                        {loading && <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>}
                        {initialData ? 'Save Changes' : 'Create Record'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const FloatingInput = React.memo(({ label, type = "text", value, ...props }: any) => (
    <div className="relative group">
        <input
            type={type}
            value={value}
            {...props}
            className="peer w-full h-12 px-4 pt-5 pb-1 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] focus:bg-white dark:focus:bg-[#0b1015] focus:border-emerald-500 focus:ring-[3px] focus:ring-emerald-500/10 transition-all font-bold text-slate-700 dark:text-slate-300 text-sm"
        />
        <label className={`absolute left-4 text-[10px] font-bold uppercase tracking-wider transition-all pointer-events-none ${value ? 'top-1.5 text-emerald-500 dark:text-emerald-400' : 'top-4 text-slate-400 dark:text-slate-500 peer-focus:top-1.5 peer-focus:text-emerald-500 dark:peer-focus:text-emerald-400'
            }`}>
            {label}
        </label>
    </div>
));

const SelectInput = React.memo(({ label, options, ...props }: any) => (
    <div className="relative group">
        <select
            {...props}
            className="peer w-full h-12 px-4 pt-3 pb-1 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] focus:bg-white dark:focus:bg-[#0b1015] focus:border-emerald-500 focus:ring-[3px] focus:ring-emerald-500/10 transition-all font-bold text-slate-700 dark:text-slate-300 text-sm appearance-none cursor-pointer"
        >
            <option value="" disabled hidden></option>
            {options.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <label className="absolute left-4 top-1 text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider pointer-events-none">
            {label}
        </label>
        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">expand_more</span>
    </div>
));

const SortableHeader = React.memo(({ field, label, sortField, sortDirection, onSort }: any) => (
    <th
        className="px-4 py-3 cursor-pointer group hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors text-sm font-bold uppercase tracking-wider"
        onClick={() => onSort(field)}
    >
        <div className="flex items-center gap-2">
            {label}
            <div className="flex flex-col text-[10px] text-slate-400 group-hover:text-slate-500">
                <span className={`material-symbols-outlined text-[10px] -mb-1 ${sortField === field && sortDirection === 'asc' ? 'text-primary' : ''}`}>expand_less</span>
                <span className={`material-symbols-outlined text-[10px] ${sortField === field && sortDirection === 'desc' ? 'text-primary' : ''}`}>expand_more</span>
            </div>
        </div>
    </th>
));

export default APCList;