import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getStaffList, deleteStaff, createStaff, updateStaff, uploadStaffCsv, appendStaffCsv, promoteStaff, getAllStaff, bulkDeleteStaff, isRetiring } from '../../../services/staff';
import { Staff, StaffCreate } from '../../../types/staff';
import { getPageCache, setPageCache } from '../../../services/pageCache';
import StaffModal from '../StaffModal';
import AlertModal from '../../../components/AlertModal';
import { parseSDLFile, compareSDLData } from '../../../utils/sdlParser';




const SDLPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // Cache Initialization
    const cachedData = getPageCache('sdl');

    const [staffList, setStaffList] = useState<Staff[]>(cachedData?.data || []);
    const [allStaff, setAllStaff] = useState<Staff[]>(cachedData?.allStaff || []);
    const [loading, setLoading] = useState(!cachedData);
    const [total, setTotal] = useState(cachedData?.total || 0);
    const [page, setPage] = useState(cachedData?.page || 1);
    const [limit, setLimit] = useState(cachedData?.limit || 10);
    const [sortField, setSortField] = useState<keyof Staff | null>(cachedData?.sortField as any || null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(cachedData?.sortDirection || 'asc');
    const [searchTerm, setSearchTerm] = useState(cachedData?.searchTerm || '');
    const [selectedStation, setSelectedStation] = useState(cachedData?.filters?.selectedStation || 'All');
    const [selectedRank, setSelectedRank] = useState(cachedData?.filters?.selectedRank || 'All');
    const [selectedConr, setSelectedConr] = useState(cachedData?.filters?.selectedConr || 'All');
    const [selectedState, setSelectedState] = useState(cachedData?.filters?.selectedState || 'All');
    const [selectedHOD, setSelectedHOD] = useState(cachedData?.filters?.selectedHOD || 'All');
    const [selectedStateCoord, setSelectedStateCoord] = useState(cachedData?.filters?.selectedStateCoord || 'All');
    const [selectedDirector, setSelectedDirector] = useState(cachedData?.filters?.selectedDirector || 'All');
    const [selectedEducation, setSelectedEducation] = useState(cachedData?.filters?.selectedEducation || 'All');
    const [selectedSecretary, setSelectedSecretary] = useState(cachedData?.filters?.selectedSecretary || 'All');
    const [selectedOthers, setSelectedOthers] = useState(cachedData?.filters?.selectedOthers || 'All');
    const [selectedDriver, setSelectedDriver] = useState(cachedData?.filters?.selectedDriver || 'All');
    const [selectedTypesetting, setSelectedTypesetting] = useState(cachedData?.filters?.selectedTypesetting || 'All');
    const [selectedPromotionDate, setSelectedPromotionDate] = useState(cachedData?.filters?.selectedPromotionDate || 'All');

    const [selectedDOB, setSelectedDOB] = useState(cachedData?.filters?.selectedDOB || 'All');
    const [selectedRetiring, setSelectedRetiring] = useState(cachedData?.filters?.selectedRetiring || 'All');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Flag to prevent redundant fetch on mount if cache exists
    const hasInitialized = useRef(!!cachedData);

    // New state for collapsible rows
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    // Station search state
    const [stationSearchText, setStationSearchText] = useState('');
    const [showStationDropdown, setShowStationDropdown] = useState(false);
    const stationDropdownRef = useRef<HTMLDivElement>(null);

    // Rank search state
    const [rankSearchText, setRankSearchText] = useState('');
    const [showRankDropdown, setShowRankDropdown] = useState(false);
    const rankDropdownRef = useRef<HTMLDivElement>(null);

    // State search state
    const [stateSearchText, setStateSearchText] = useState('');
    const [showStateDropdown, setShowStateDropdown] = useState(false);
    const stateDropdownRef = useRef<HTMLDivElement>(null);

    // DOPA search state
    const [dopaSearchText, setDopaSearchText] = useState('');
    const [showDopaDropdown, setShowDopaDropdown] = useState(false);
    const dopaDropdownRef = useRef<HTMLDivElement>(null);

    // DOB search state
    const [dobSearchText, setDobSearchText] = useState('');
    const [showDobDropdown, setShowDobDropdown] = useState(false);
    const dobDropdownRef = useRef<HTMLDivElement>(null);

    const uniqueStations = useMemo(() => Array.from(new Set(allStaff.map(s => s.station).filter(Boolean))) as string[], [allStaff]);
    const uniqueRanks = useMemo(() => Array.from(new Set(allStaff.map(s => s.rank).filter(Boolean))) as string[], [allStaff]);
    const uniqueConrs = useMemo(() => Array.from(new Set(allStaff.map(s => s.conr).filter(Boolean))) as string[], [allStaff]);
    const uniqueStates = useMemo(() => Array.from(new Set(allStaff.map(s => s.state).filter(Boolean))).sort() as string[], [allStaff]);
    const uniquePromotionDates = useMemo(() => Array.from(new Set(allStaff.map(s => s.dopa?.split('T')[0]?.split(' ')[0]).filter(Boolean))).sort() as string[], [allStaff]);
    const uniqueDOBs = useMemo(() => Array.from(new Set(allStaff.map(s => s.dob?.split('-')[0]).filter(Boolean))).sort().reverse() as string[], [allStaff]);

    const hasActiveFilters = selectedStation !== 'All' || selectedRank !== 'All' || selectedConr !== 'All' || selectedState !== 'All' ||
        selectedHOD !== 'All' || selectedStateCoord !== 'All' || selectedDirector !== 'All' || selectedEducation !== 'All' ||
        selectedSecretary !== 'All' || selectedOthers !== 'All' || selectedDriver !== 'All' || selectedTypesetting !== 'All' || selectedPromotionDate !== 'All' || selectedDOB !== 'All' || selectedRetiring !== 'All';

    const filteredStaff = staffList.filter(staff => {
        const matchesStation = selectedStation === 'All' || staff.station === selectedStation;
        const matchesRank = selectedRank === 'All' || staff.rank === selectedRank;
        const matchesConr = selectedConr === 'All' || staff.conr === selectedConr;
        const matchesState = selectedState === 'All' || staff.state === selectedState;

        const remarkLower = (staff.remark || '').toLowerCase();
        const qualLower = (staff.qualification || '').toLowerCase();
        const educationKeywords = ['b.ed', 'pgd', 'pgde', 'nce', 'm.ed', 'edu', 'trcn'];
        const hasEducationQual = educationKeywords.some(keyword => qualLower.includes(keyword));
        const matchesHOD = selectedHOD === 'All' || (selectedHOD === 'Yes' ? !!staff.is_hod : !staff.is_hod);
        const matchesStateCoord = selectedStateCoord === 'All' || (selectedStateCoord === 'Yes' ? !!staff.is_state_coordinator : !staff.is_state_coordinator);
        const matchesDirector = selectedDirector === 'All' || (selectedDirector === 'Yes' ? !!staff.is_director : !staff.is_director);
        const matchesEducation = selectedEducation === 'All' || (selectedEducation === 'Yes' ? !!staff.is_education : !staff.is_education);
        const matchesSecretary = selectedSecretary === 'All' || (selectedSecretary === 'Yes' ? !!staff.is_secretary : !staff.is_secretary);
        const matchesOthers = selectedOthers === 'All' || (selectedOthers === 'Yes' ? !!staff.others : !staff.others);
        const matchesDriver = selectedDriver === 'All' || (selectedDriver === 'Yes' ? !!staff.is_driver : !staff.is_driver);
        const matchesTypesetting = selectedTypesetting === 'All' || (selectedTypesetting === 'Yes' ? !!staff.is_typesetting : !staff.is_typesetting);
        const matchesPromotionDate = selectedPromotionDate === 'All' || (staff.dopa && (staff.dopa.split('T')[0].split(' ')[0] === selectedPromotionDate));

        // DOB Year Check
        const matchesDOB = selectedDOB === 'All' || (staff.dob && staff.dob.startsWith(selectedDOB));

        const matchesRetiring = selectedRetiring === 'All' || (selectedRetiring === 'Yes' ? isRetiring(staff) : !isRetiring(staff));

        return matchesStation && matchesRank && matchesConr && matchesState && matchesHOD && matchesStateCoord && matchesDirector && matchesEducation && matchesSecretary && matchesOthers && matchesDriver && matchesTypesetting && matchesPromotionDate && matchesDOB && matchesRetiring;
    });

    const sortedStaff = [...filteredStaff].sort((a, b) => {
        if (!sortField) return 0;

        const aValue = a[sortField];
        const bValue = b[sortField];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
            const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
            return sortDirection === 'asc' ? comparison : -comparison;
        }

        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return sortDirection === 'asc' ? comparison : -comparison;
    });

    const allFilteredStaff = allStaff.filter(staff => {
        const matchesStation = selectedStation === 'All' || staff.station === selectedStation;
        const matchesRank = selectedRank === 'All' || staff.rank === selectedRank;
        const matchesConr = selectedConr === 'All' || staff.conr === selectedConr;
        const matchesState = selectedState === 'All' || staff.state === selectedState;

        const remarkLower = (staff.remark || '').toLowerCase();
        const qualLower = (staff.qualification || '').toLowerCase();
        const educationKeywords = ['b.ed', 'pgd', 'pgde', 'nce', 'm.ed', 'edu', 'trcn'];
        const hasEducationQual = educationKeywords.some(keyword => qualLower.includes(keyword));
        const matchesHOD = selectedHOD === 'All' || (selectedHOD === 'Yes' ? !!staff.is_hod : !staff.is_hod);
        const matchesStateCoord = selectedStateCoord === 'All' || (selectedStateCoord === 'Yes' ? !!staff.is_state_coordinator : !staff.is_state_coordinator);
        const matchesDirector = selectedDirector === 'All' || (selectedDirector === 'Yes' ? !!staff.is_director : !staff.is_director);
        const matchesEducation = selectedEducation === 'All' || (selectedEducation === 'Yes' ? !!staff.is_education : !staff.is_education);
        const matchesSecretary = selectedSecretary === 'All' || (selectedSecretary === 'Yes' ? !!staff.is_secretary : !staff.is_secretary);
        const matchesOthers = selectedOthers === 'All' || (selectedOthers === 'Yes' ? !!staff.others : !staff.others);
        const matchesDriver = selectedDriver === 'All' || (selectedDriver === 'Yes' ? !!staff.is_driver : !staff.is_driver);
        const matchesTypesetting = selectedTypesetting === 'All' || (selectedTypesetting === 'Yes' ? !!staff.is_typesetting : !staff.is_typesetting);
        const matchesPromotionDate = selectedPromotionDate === 'All' || (staff.dopa && (staff.dopa.split('T')[0].split(' ')[0] === selectedPromotionDate));

        const matchesDOB = selectedDOB === 'All' || (staff.dob && (staff.dob.split('T')[0].split(' ')[0] === selectedDOB));

        const matchesRetiring = selectedRetiring === 'All' || (selectedRetiring === 'Yes' ? isRetiring(staff) : !isRetiring(staff));

        return matchesStation && matchesRank && matchesConr && matchesState && matchesHOD && matchesStateCoord && matchesDirector && matchesEducation && matchesSecretary && matchesOthers && matchesDriver && matchesTypesetting && matchesPromotionDate && matchesDOB && matchesRetiring;
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

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
    const promoteFileInputRef = useRef<HTMLInputElement>(null);
    const previewFileInputRef = useRef<HTMLInputElement>(null);

    const [promotionDate, setPromotionDate] = useState(new Date().toISOString().split('T')[0]);
    const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
    const [pendingPromoteFile, setPendingPromoteFile] = useState<File | null>(null);

    const fetchData = useCallback(async (force: boolean = false) => {
        // Skip fetch if we have cached data and it's the initial mount
        if (hasInitialized.current && !force) {
            hasInitialized.current = false;
            return;
        }

        setLoading(true);
        try {
            if (hasActiveFilters) {
                // ALL_STAFF_CACHE_TTL in services/staff.ts is 30 mins
                // This leverages service-level memory cache automatically
                const allData = await getAllStaff(false, force);
                const filtered = allData.filter(staff => {
                    const matchesSearch = !searchTerm ||
                        staff.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        staff.fileno?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        staff.email?.toLowerCase().includes(searchTerm.toLowerCase());
                    const matchesStation = selectedStation === 'All' || staff.station === selectedStation;
                    const matchesRank = selectedRank === 'All' || staff.rank === selectedRank;
                    const matchesConr = selectedConr === 'All' || staff.conr === selectedConr;
                    const matchesState = selectedState === 'All' || staff.state === selectedState;

                    const matchesHOD = selectedHOD === 'All' || (selectedHOD === 'Yes' ? !!staff.is_hod : !staff.is_hod);
                    const matchesStateCoord = selectedStateCoord === 'All' || (selectedStateCoord === 'Yes' ? !!staff.is_state_coordinator : !staff.is_state_coordinator);
                    const matchesDirector = selectedDirector === 'All' || (selectedDirector === 'Yes' ? !!staff.is_director : !staff.is_director);
                    const matchesEducation = selectedEducation === 'All' || (selectedEducation === 'Yes' ? !!staff.is_education : !staff.is_education);
                    const matchesSecretary = selectedSecretary === 'All' || (selectedSecretary === 'Yes' ? !!staff.is_secretary : !staff.is_secretary);
                    const matchesOthers = selectedOthers === 'All' || (selectedOthers === 'Yes' ? !!staff.others : !staff.others);
                    const matchesDriver = selectedDriver === 'All' || (selectedDriver === 'Yes' ? !!staff.is_driver : !staff.is_driver);
                    const matchesTypesetting = selectedTypesetting === 'All' || (selectedTypesetting === 'Yes' ? !!staff.is_typesetting : !staff.is_typesetting);
                    const matchesPromotionDate = selectedPromotionDate === 'All' || (staff.dopa && (staff.dopa.split('T')[0].split(' ')[0] === selectedPromotionDate));
                    const matchesRetiring = selectedRetiring === 'All' || (selectedRetiring === 'Yes' ? isRetiring(staff) : !isRetiring(staff));

                    return matchesSearch && matchesStation && matchesRank && matchesConr && matchesState && matchesHOD && matchesStateCoord && matchesDirector && matchesEducation && matchesSecretary && matchesOthers && matchesDriver && matchesTypesetting && matchesPromotionDate && matchesRetiring;
                });

                const startIndex = (page - 1) * limit;
                const endIndex = startIndex + limit;
                setStaffList(filtered.slice(startIndex, endIndex));
                setTotal(filtered.length);
            } else {
                const response = await getStaffList(page, limit, searchTerm);
                setStaffList(response.items);
                setTotal(response.total);
            }
        } catch (error) {
            console.error('Error fetching staff:', error);
        } finally {
            setLoading(false);
        }
    }, [page, limit, searchTerm, selectedStation, selectedRank, selectedConr, selectedState, selectedHOD, selectedStateCoord, selectedDirector, selectedEducation, selectedSecretary, selectedOthers, selectedDriver, selectedTypesetting, selectedPromotionDate, selectedRetiring, hasActiveFilters]);

    const fetchAllStaffData = useCallback(async (force: boolean = false) => {
        try {
            const all = await getAllStaff(false, force);
            setAllStaff(all);
        } catch (error) {
            console.error('Error fetching all staff:', error);
        }
    }, []);

    const handlePromoteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingPromoteFile(file);
        setIsPromoteModalOpen(true);
        if (promoteFileInputRef.current) promoteFileInputRef.current.value = '';
    };

    const confirmPromotion = async () => {
        if (!pendingPromoteFile) return;
        setIsPromoteModalOpen(false);

        setLoading(true);
        try {
            const response = await promoteStaff(pendingPromoteFile, true, promotionDate);
            setAlertModal({
                isOpen: true,
                title: 'Promotion Complete',
                message: `Successfully processed ${response.total_processed} records. ${response.updated_count} updated, ${response.missing_count} missing.`,
                type: 'success',
                details: {
                    updated_count: response.updated_count,
                    missing_count: response.missing_count,
                    missing_filenos: response.missing_filenos || [],
                    message: response.message
                }
            });
            fetchData(true);
            fetchAllStaffData(true);
        } catch (error: any) {
            console.error('Promotion failed:', error);
            setAlertModal({
                isOpen: true,
                title: 'Promotion Failed',
                message: error.message || 'An error occurred during promotion.',
                type: 'error'
            });
        } finally {
            setLoading(false);
            setPendingPromoteFile(null);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            const response = await uploadStaffCsv(file);
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
            fetchData(true);
            fetchAllStaffData(true);
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
    };

    const handlePreviewUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);

            // Parse the uploaded file
            const importedRecords = await parseSDLFile(file);

            if (importedRecords.length === 0) {
                setAlertModal({
                    isOpen: true,
                    title: 'No Data Found',
                    message: 'The uploaded file contains no valid records.',
                    type: 'warning'
                });
                return;
            }

            // Fetch current staff data for comparison
            const existingStaff = await getAllStaff(false, true);

            // Compare and generate staging records
            const stagingRecords = compareSDLData(importedRecords, existingStaff);

            // Navigate to staging page with data
            navigate('/admin/metadata/sdl-staging', {
                state: { stagingRecords }
            });

        } catch (error: any) {
            console.error('Preview upload failed:', error);
            setAlertModal({
                isOpen: true,
                title: 'Preview Failed',
                message: error.message || 'An error occurred while processing the file.',
                type: 'error'
            });
        } finally {
            if (previewFileInputRef.current) {
                previewFileInputRef.current.value = '';
            }
            setLoading(false);
        }
    };

    const handleAppendUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            const response = await appendStaffCsv(file);
            setAlertModal({
                isOpen: true,
                title: 'Append Complete',
                message: 'Staff data has been appended successfully (existing records skipped).',
                type: 'success',
                details: {
                    created: response.created_count,
                    skipped: response.skipped_count,
                    errors: response.error_count,
                    skippedData: response.skipped || [],
                    errorData: response.errors || []
                }
            });
            fetchData(true);
            fetchAllStaffData(true);
        } catch (error: any) {
            console.error('Append failed:', error);
            setAlertModal({
                isOpen: true,
                title: 'Append Failed',
                message: error.message || 'An error occurred while appending the file.',
                type: 'error'
            });
        } finally {
            if (appendFileInputRef.current) {
                appendFileInputRef.current.value = '';
            }
            setLoading(false);
        }
    };

    useEffect(() => {
        const q = searchParams.get('q');
        if (q) {
            setSearchTerm(q);
        }
    }, [searchParams]);

    useEffect(() => {
        setPage(1);
    }, [searchTerm]);

    useEffect(() => {
        setPage(1);
    }, [selectedStation, selectedRank, selectedConr, selectedState, selectedHOD, selectedStateCoord, selectedDirector, selectedEducation, selectedSecretary, selectedOthers, selectedDriver, selectedTypesetting, selectedPromotionDate, selectedRetiring]);

    // Update Cache whenever relevant state changes
    useEffect(() => {
        setPageCache('sdl', {
            data: staffList,
            allStaff,
            total,
            page,
            limit,
            sortField,
            sortDirection,
            searchTerm,
            filters: {
                selectedStation,
                selectedRank,
                selectedConr,
                selectedState,
                selectedHOD,
                selectedStateCoord,
                selectedDirector,
                selectedEducation,
                selectedSecretary,
                selectedOthers,
                selectedDriver,
                selectedTypesetting,
                selectedPromotionDate,
                selectedRetiring,
            }
        });
    }, [staffList, allStaff, total, page, limit, sortField, sortDirection, searchTerm, selectedStation, selectedRank, selectedConr, selectedState, selectedHOD, selectedStateCoord, selectedDirector, selectedEducation, selectedSecretary, selectedOthers, selectedDriver, selectedTypesetting, selectedPromotionDate, selectedRetiring]);



    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        fetchAllStaffData();
    }, [fetchAllStaffData]);

    // Click outside handler for station dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (stationDropdownRef.current && !stationDropdownRef.current.contains(event.target as Node)) {
                setShowStationDropdown(false);
            }
        };

        if (showStationDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showStationDropdown]);

    // Click outside handler for rank dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (rankDropdownRef.current && !rankDropdownRef.current.contains(event.target as Node)) {
                setShowRankDropdown(false);
            }
        };

        if (showRankDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showRankDropdown]);

    // Click outside handler for state dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (stateDropdownRef.current && !stateDropdownRef.current.contains(event.target as Node)) {
                setShowStateDropdown(false);
            }
        };

        if (showStateDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showStateDropdown]);

    // Click outside handler for DOPA dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dopaDropdownRef.current && !dopaDropdownRef.current.contains(event.target as Node)) {
                setShowDopaDropdown(false);
            }
        };

        if (showDopaDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDopaDropdown]);

    const handleDelete = async (id: string) => {
        setAlertModal({
            isOpen: true,
            title: 'Confirm Delete',
            message: 'Are you sure you want to delete this staff member? This action cannot be undone.',
            type: 'warning',
            onConfirm: async () => {
                try {
                    setLoading(true);
                    await deleteStaff(id);
                    fetchData(true);
                    fetchAllStaffData(true);
                    setAlertModal({
                        isOpen: true,
                        title: 'Success',
                        message: 'Staff member deleted successfully.',
                        type: 'success'
                    });
                } catch (error) {
                    console.error('Error deleting staff:', error);
                    setAlertModal({
                        isOpen: true,
                        title: 'Error',
                        message: 'Failed to delete staff member.',
                        type: 'error'
                    });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) {
            setAlertModal({
                isOpen: true,
                title: 'No Selection',
                message: 'Please select staff members to delete.',
                type: 'warning'
            });
            return;
        }

        setAlertModal({
            isOpen: true,
            title: 'Confirm Bulk Delete',
            message: `Are you sure you want to delete ${selectedIds.size} staff member(s)? This action cannot be undone.`,
            type: 'warning',
            onConfirm: async () => {
                try {
                    setLoading(true);
                    await bulkDeleteStaff(Array.from(selectedIds));
                    setSelectedIds(new Set());
                    fetchData(true);
                    fetchAllStaffData(true);
                    setAlertModal({
                        isOpen: true,
                        title: 'Success',
                        message: `Successfully deleted ${selectedIds.size} staff member(s).`,
                        type: 'success'
                    });
                } catch (error) {
                    console.error('Error deleting staff:', error);
                    setAlertModal({
                        isOpen: true,
                        title: 'Error',
                        message: 'Failed to delete selected staff members.',
                        type: 'error'
                    });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const handleOpenAdd = () => {
        setEditingStaff(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (staff: Staff) => {
        setEditingStaff(staff);
        setIsModalOpen(true);
    };

    const handleModalSubmit = async (data: StaffCreate) => {
        try {
            if (editingStaff) {
                await updateStaff(editingStaff.id, data);
            } else {
                await createStaff(data);
            }
            fetchData(true);
            fetchAllStaffData(true);
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving staff:', error);
            setAlertModal({
                isOpen: true,
                title: 'Error',
                message: 'Failed to save staff. Please check your inputs and try again.',
                type: 'error'
            });
            throw error;
        }
    };

    const handleExportPdf = () => {
        try {
            setLoading(true);
            const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation for more columns

            // Add title
            doc.setFontSize(22);
            doc.setTextColor(20, 158, 136); // Emerald-600
            doc.text('Staff Disposition List (SDL)', 14, 20);

            // Add metadata
            doc.setFontSize(10);
            doc.setTextColor(100);
            const dateStr = new Date().toLocaleString();
            doc.text(`Generated on: ${dateStr}`, 14, 28);

            // Calculate full filtered data (including search term)
            const exportStaff = allStaff.filter(staff => {
                const matchesSearch = !searchTerm ||
                    staff.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    staff.fileno?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    staff.email?.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesStation = selectedStation === 'All' || staff.station === selectedStation;
                const matchesRank = selectedRank === 'All' || staff.rank === selectedRank;
                const matchesConr = selectedConr === 'All' || staff.conr === selectedConr;
                const matchesState = selectedState === 'All' || staff.state === selectedState;
                const matchesHOD = selectedHOD === 'All' || (selectedHOD === 'Yes' ? !!staff.is_hod : !staff.is_hod);
                const matchesStateCoord = selectedStateCoord === 'All' || (selectedStateCoord === 'Yes' ? !!staff.is_state_coordinator : !staff.is_state_coordinator);
                const matchesDirector = selectedDirector === 'All' || (selectedDirector === 'Yes' ? !!staff.is_director : !staff.is_director);
                const matchesEducation = selectedEducation === 'All' || (selectedEducation === 'Yes' ? !!staff.is_education : !staff.is_education);
                const matchesSecretary = selectedSecretary === 'All' || (selectedSecretary === 'Yes' ? !!staff.is_secretary : !staff.is_secretary);
                const matchesOthers = selectedOthers === 'All' || (selectedOthers === 'Yes' ? !!staff.others : !staff.others);
                const matchesDriver = selectedDriver === 'All' || (selectedDriver === 'Yes' ? !!staff.is_driver : !staff.is_driver);
                const matchesTypesetting = selectedTypesetting === 'All' || (selectedTypesetting === 'Yes' ? !!staff.is_typesetting : !staff.is_typesetting);
                const matchesRetiring = selectedRetiring === 'All' || (selectedRetiring === 'Yes' ? isRetiring(staff) : !isRetiring(staff));

                return matchesSearch && matchesStation && matchesRank && matchesConr && matchesState && matchesHOD && matchesStateCoord && matchesDirector && matchesEducation && matchesSecretary && matchesOthers && matchesDriver && matchesTypesetting && matchesRetiring;
            });

            doc.text(`Total Records: ${exportStaff.length}`, 14, 33);

            const tableColumn = [
                "S/N", "Staff ID", "Full Name", "Station", "Rank", "CONR", "State", "LGA", "Qual.", "Sex", "Email", "Phone", "Status"
            ];
            const tableRows = exportStaff.map((staff, index) => [
                (index + 1).toString(),
                staff.fileno || '',
                staff.full_name || '',
                staff.station || '',
                staff.rank || '',
                staff.conr || '',
                staff.state || '',
                staff.lga || '',
                staff.qualification || '',
                staff.sex || '',
                staff.email || '',
                staff.phone || '',
                staff.active ? 'Active' : 'Inactive'
            ]);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 38,
                styles: { fontSize: 8.5, font: 'helvetica', cellPadding: 2 },
                headStyles: { fillColor: [20, 158, 136], textColor: [255, 255, 255], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 247, 250] },
                margin: { top: 38, left: 10, right: 10 },
                didDrawPage: (data) => {
                    // Footer
                    const str = "Page " + doc.getNumberOfPages();
                    doc.setFontSize(10);
                    const pageSize = doc.internal.pageSize;
                    const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
                    doc.text(str, data.settings.margin.left, pageHeight - 10);
                }
            });

            doc.save(`SDL_Filtered_Export_${new Date().toISOString().split('T')[0]}.pdf`);

            setAlertModal({
                isOpen: true,
                title: 'Export Successful',
                message: `${exportStaff.length} SDL records have been exported to PDF.`,
                type: 'success'
            });
        } catch (error) {
            console.error('PDF Export Failed:', error);
            setAlertModal({
                isOpen: true,
                title: 'Export Failed',
                message: 'Failed to export SDL records to PDF.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = new Set(allFilteredStaff.map(s => s.id));
            setSelectedIds(allIds);
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds);
        if (checked) {
            newSelected.add(id);
        } else {
            newSelected.delete(id);
        }
        setSelectedIds(newSelected);
    };

    const handleSort = (field: keyof Staff) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const toggleRow = (id: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedRows(newExpanded);
    };

    const totalPages = Math.ceil(total / limit);
    const isAllSelected = allFilteredStaff.length > 0 && allFilteredStaff.every(s => selectedIds.has(s.id));

    const downloadCsvTemplate = () => {
        const headers = [
            'fileno', 'full_name', 'station', 'qualification', 'sex',
            'dob', 'dofa', 'doan', 'dopa', 'rank', 'conr', 'state', 'lga', 'email', 'phone', 'remark',
            'is_hod', 'is_state_coordinator', 'is_director', 'is_education', 'is_secretary', 'is_driver', 'is_typesetting', 'others'
        ];
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "staff_upload_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExport = async () => {
        try {
            setLoading(true);
            const allStaffData = await getAllStaff();

            const exportData = allStaffData.map(staff => ({
                'File No': staff.fileno,
                'Full Name': staff.full_name,
                'Station': staff.station,
                'Rank': staff.rank,
                'CONR': staff.conr,
                'Phone': staff.phone,
                'Email': staff.email,
                'State': staff.state,
                'LGA': staff.lga,
                'Qualification': staff.qualification,
                'Sex': staff.sex,
                'DOB': staff.dob,
                'DOFA': staff.dofa,
                'DOAN': staff.doan,
                'DOPA': staff.dopa,
                'Active': staff.active ? 'Yes' : 'No',
                'HOD': staff.is_hod ? 'Yes' : 'No',
                'State Coord': staff.is_state_coordinator ? 'Yes' : 'No',
                'Director': staff.is_director ? 'Yes' : 'No',
                'Education': staff.is_education ? 'Yes' : 'No',
                'Secretary': staff.is_secretary ? 'Yes' : 'No',
                'Driver': staff.is_driver ? 'Yes' : 'No',
                'Typesetting': staff.is_typesetting ? 'Yes' : 'No',
                'Others': staff.others ? 'Yes' : 'No',
                'Remark': staff.remark
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Staff List");

            // Adjust column widths
            const colWidths = [
                { wch: 15 }, // File No
                { wch: 30 }, // Name
                { wch: 20 }, // Station
                { wch: 15 }, // Rank
                { wch: 10 }, // CONR
                { wch: 15 }, // Phone
                { wch: 25 }, // Email
                { wch: 15 }, // State
                { wch: 15 }, // LGA
                { wch: 15 }, // Qual
                { wch: 8 },  // Sex
                { wch: 12 }, // DOB
                { wch: 12 }, // DOFA
                { wch: 12 }, // DOAN
                { wch: 12 }, // DOPA
                { wch: 8 },  // Active
                { wch: 8 },  // HOD
                { wch: 8 },  // State Coord
                { wch: 8 },  // Director
                { wch: 8 },  // Education
                { wch: 8 },  // Secretary
                { wch: 8 },  // Driver
                { wch: 8 },  // Typesetting
                { wch: 8 },  // Others
                { wch: 30 }  // Remark
            ];
            ws['!cols'] = colWidths;

            XLSX.writeFile(wb, `SDL_Export_${new Date().toISOString().split('T')[0]}.xlsx`);

            setAlertModal({
                isOpen: true,
                title: 'Export Successful',
                message: 'The full staff list has been exported to Excel.',
                type: 'success'
            });

        } catch (error) {
            console.error('Export failed:', error);
            setAlertModal({
                isOpen: true,
                title: 'Export Failed',
                message: 'Failed to export staff list.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background-light dark:bg-[#101922] p-4 md:p-8 gap-6 md:gap-8 overflow-y-auto transition-colors duration-200">
            <StaffModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleModalSubmit}
                initialData={editingStaff}
            />

            <AlertModal
                isOpen={alertModal.isOpen}
                onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
                title={alertModal.title}
                message={alertModal.message}
                type={alertModal.type}
                details={alertModal.details}
                onConfirm={alertModal.onConfirm}
            />

            {/* Promotion Date Modal */}
            {isPromoteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-surface-light dark:bg-[#121b25] rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-gray-800">
                        <div className="p-6 border-b border-slate-100 dark:border-gray-800">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-200">Confirm Promotion</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-slate-600 dark:text-slate-400">
                                Please specify the <strong>Date of Present Appointment (DOPA)</strong> for this promotion.
                            </p>
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Promotion Date (DOPA)
                                </label>
                                <input
                                    type="date"
                                    value={promotionDate}
                                    onChange={(e) => setPromotionDate(e.target.value)}
                                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-background-light dark:bg-[#0b1015] focus:bg-white dark:focus:bg-[#0b1015] focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-bold text-slate-700 dark:text-slate-200"
                                />
                            </div>
                            <p className="text-xs text-amber-600 dark:text-amber-500 font-medium bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg flex items-start gap-2">
                                <span className="material-symbols-outlined text-base">warning</span>
                                This will update Rank, CONRAISS, and DOPA for all matched staff.
                            </p>
                        </div>
                        <div className="p-6 border-t border-slate-100 dark:border-gray-800 bg-background-light dark:bg-[#0b1015] rounded-b-2xl flex justify-end gap-3">
                            <button
                                onClick={() => setIsPromoteModalOpen(false)}
                                className="px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 bg-surface-light dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-background-light dark:hover:bg-slate-800 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmPromotion}
                                className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                            >
                                Confirm Promotion
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-slate-300">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 to-teal-800 dark:from-emerald-400 dark:to-teal-500 tracking-tight">
                        Staff Disposition List (SDL)
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">View and manage staff disposition records.</p>
                </div>
                <div className="flex flex-wrap items-center justify-center md:justify-end gap-3">
                    <button
                        onClick={() => { fetchData(true); fetchAllStaffData(true); }}
                        disabled={loading}
                        className={`group flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light dark:bg-[#0b1015] border border-slate-200 dark:border-gray-800 text-indigo-600 dark:text-indigo-400 font-bold text-xs shadow-sm hover:shadow-md hover:border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all duration-200 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <span className={`material-symbols-outlined text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-indigo-600 dark:from-indigo-300 dark:to-indigo-500 group-hover:scale-110 transition-transform text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
                        Refresh
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
                        onClick={handleExportPdf}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-rose-600 dark:text-rose-400 font-bold text-xs shadow-sm hover:shadow-md hover:border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined text-transparent bg-clip-text bg-gradient-to-br from-rose-400 to-rose-600 dark:from-rose-300 dark:to-rose-500 group-hover:scale-110 transition-transform text-lg">picture_as_pdf</span>
                        Export PDF
                    </button>
                    <button
                        onClick={handleExport}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-slate-300 font-bold text-xs shadow-sm hover:shadow-md hover:border-slate-300 hover:bg-background-light dark:hover:bg-slate-800 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-indigo-600 dark:from-indigo-300 dark:to-indigo-500 group-hover:scale-110 transition-transform text-lg">download</span>
                        Export List
                    </button>
                    <button
                        onClick={downloadCsvTemplate}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-slate-500 dark:text-slate-400 font-bold text-xs shadow-sm hover:shadow-md hover:border-slate-300 hover:bg-background-light dark:hover:bg-slate-800 transition-all duration-200"
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
                    <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        ref={promoteFileInputRef}
                        onChange={handlePromoteUpload}
                        style={{ display: 'none' }}
                    />
                    <button
                        onClick={() => promoteFileInputRef.current?.click()}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-indigo-600 dark:text-indigo-400 font-bold text-xs shadow-sm hover:shadow-md hover:border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 to-blue-600 dark:from-indigo-400 dark:to-blue-500 group-hover:scale-110 transition-transform text-lg">trending_up</span>
                        Promote Staff
                    </button>

                    <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        ref={previewFileInputRef}
                        onChange={handlePreviewUpload}
                        style={{ display: 'none' }}
                    />
                    <button
                        onClick={() => previewFileInputRef.current?.click()}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white font-bold text-xs shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:-translate-y-0.5 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined group-hover:scale-110 transition-transform text-lg">preview</span>
                        Import with Preview
                    </button>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-emerald-600 dark:text-emerald-400 font-bold text-xs shadow-sm hover:shadow-md hover:border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined text-transparent bg-clip-text bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-400 dark:to-teal-500 group-hover:scale-110 transition-transform text-lg">upload_file</span>
                        Import
                    </button>
                    {/* <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        ref={appendFileInputRef}
                        onChange={handleAppendUpload}
                        style={{ display: 'none' }}
                    />
                    <button
                        onClick={() => appendFileInputRef.current?.click()}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-teal-600 dark:text-teal-400 font-bold text-xs shadow-sm hover:shadow-md hover:border-teal-200 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined text-transparent bg-clip-text bg-gradient-to-br from-teal-500 to-emerald-600 dark:from-teal-400 dark:to-emerald-500 group-hover:scale-110 transition-transform text-lg">library_add</span>
                        Append New Staff
                    </button> */}
                    <button
                        onClick={handleOpenAdd}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined group-hover:rotate-90 transition-transform text-lg">add</span>
                        Add Staff
                    </button>
                </div>
            </div>

            <div className="bg-surface-light dark:bg-[#121b25] p-6 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-6 transition-colors duration-200">
                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-col md:flex-row gap-4 items-center w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
                            </div>
                            <input
                                className="w-full pl-10 h-10 rounded-lg border-slate-200 dark:border-gray-700 bg-background-light dark:bg-[#0b1015] focus:bg-white dark:focus:bg-[#0b1015] focus:border-primary focus:ring-[3px] focus:ring-primary/20 transition-all duration-200 text-slate-700 dark:text-slate-200 font-medium text-sm placeholder:text-slate-400"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Per page:</label>
                            <select
                                value={limit}
                                onChange={(e) => {
                                    setLimit(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-surface-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-300 font-bold text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        {/* Searchable Station Dropdown */}
                        <div ref={stationDropdownRef} className="relative min-w-[200px]">
                            <button
                                type="button"
                                onClick={() => setShowStationDropdown(!showStationDropdown)}
                                className="appearance-none w-full h-10 pl-3 pr-8 rounded-lg bg-surface-light dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 hover:border-primary/50 text-slate-600 dark:text-slate-300 font-bold text-xs shadow-sm transition-all cursor-pointer text-left flex items-center justify-between"
                            >
                                <span className="truncate">
                                    {selectedStation === 'All' ? 'Department: All' : selectedStation}
                                </span>
                                <span className="material-symbols-outlined text-slate-400 text-lg">
                                    {showStationDropdown ? 'expand_less' : 'arrow_drop_down'}
                                </span>
                            </button>

                            {showStationDropdown && (
                                <div className="absolute z-50 top-full left-0 mt-1 w-[300px] max-h-80 overflow-y-auto bg-surface-light dark:bg-[#1a2533] border border-slate-200 dark:border-gray-700 rounded-xl shadow-xl">
                                    {/* Search Input */}
                                    <div className="sticky top-0 bg-surface-light dark:bg-[#1a2533] p-2 border-b border-slate-100 dark:border-gray-700 z-20">
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                                            <input
                                                type="text"
                                                placeholder="Search department..."
                                                value={stationSearchText}
                                                onChange={(e) => setStationSearchText(e.target.value)}
                                                className="w-full h-9 pl-8 pr-8 rounded-lg border border-slate-200 dark:border-gray-700 bg-background-light dark:bg-[#0f161d] text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/20"
                                                autoFocus
                                            />
                                            {stationSearchText && (
                                                <button
                                                    type="button"
                                                    onClick={() => setStationSearchText('')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 flex items-center justify-center p-0.5"
                                                >
                                                    <span className="material-symbols-outlined text-sm">close</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* All Option */}
                                    <div
                                        onClick={() => {
                                            setSelectedStation('All');
                                            setShowStationDropdown(false);
                                            setStationSearchText('');
                                        }}
                                        className={`px-3 py-2 cursor-pointer transition-colors ${selectedStation === 'All' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold' : 'hover:bg-background-light dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                                    >
                                        Department: All
                                    </div>

                                    {/* Filtered Options */}
                                    {uniqueStations
                                        .filter(station => station.toLowerCase().includes(stationSearchText.toLowerCase()))
                                        .map(station => (
                                            <div
                                                key={station}
                                                onClick={() => {
                                                    setSelectedStation(station);
                                                    setShowStationDropdown(false);
                                                    setStationSearchText('');
                                                }}
                                                className={`px-3 py-2 cursor-pointer transition-colors ${selectedStation === station ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                                            >
                                                {station}
                                            </div>
                                        ))}

                                    {uniqueStations.filter(station => station.toLowerCase().includes(stationSearchText.toLowerCase())).length === 0 && (
                                        <div className="px-3 py-4 text-center text-slate-400 text-sm">
                                            No departments found
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {/* Searchable Rank Dropdown */}
                        <div ref={rankDropdownRef} className="relative min-w-[200px]">
                            <button
                                type="button"
                                onClick={() => setShowRankDropdown(!showRankDropdown)}
                                className="appearance-none w-full h-10 pl-3 pr-8 rounded-lg bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 hover:border-primary/50 text-slate-600 dark:text-slate-300 font-bold text-xs shadow-sm transition-all cursor-pointer text-left flex items-center justify-between"
                            >
                                <span className="truncate">
                                    {selectedRank === 'All' ? 'Rank: All' : selectedRank}
                                </span>
                                <span className="material-symbols-outlined text-slate-400 text-lg">
                                    {showRankDropdown ? 'expand_less' : 'arrow_drop_down'}
                                </span>
                            </button>

                            {showRankDropdown && (
                                <div className="absolute z-50 top-full left-0 mt-1 w-[300px] max-h-80 overflow-y-auto bg-white dark:bg-[#1a2533] border border-slate-200 dark:border-gray-700 rounded-xl shadow-xl">
                                    <div className="sticky top-0 bg-white dark:bg-[#1a2533] p-2 border-b border-slate-100 dark:border-gray-700 z-20">
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                                            <input
                                                type="text"
                                                placeholder="Search rank..."
                                                value={rankSearchText}
                                                onChange={(e) => setRankSearchText(e.target.value)}
                                                className="w-full h-9 pl-8 pr-8 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/20"
                                                autoFocus
                                            />
                                            {rankSearchText && (
                                                <button
                                                    type="button"
                                                    onClick={() => setRankSearchText('')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 flex items-center justify-center p-0.5"
                                                >
                                                    <span className="material-symbols-outlined text-sm">close</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div
                                        onClick={() => {
                                            setSelectedRank('All');
                                            setShowRankDropdown(false);
                                            setRankSearchText('');
                                        }}
                                        className={`px-3 py-2 cursor-pointer transition-colors ${selectedRank === 'All' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                                    >
                                        Rank: All
                                    </div>

                                    {uniqueRanks
                                        .filter(rank => rank.toLowerCase().includes(rankSearchText.toLowerCase()))
                                        .map(rank => (
                                            <div
                                                key={rank}
                                                onClick={() => {
                                                    setSelectedRank(rank);
                                                    setShowRankDropdown(false);
                                                    setRankSearchText('');
                                                }}
                                                className={`px-3 py-2 cursor-pointer transition-colors ${selectedRank === rank ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                                            >
                                                {rank}
                                            </div>
                                        ))}

                                    {uniqueRanks.filter(rank => rank.toLowerCase().includes(rankSearchText.toLowerCase())).length === 0 && (
                                        <div className="px-3 py-4 text-center text-slate-400 text-sm">
                                            No ranks found
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <FilterSelect
                            label="CONR"
                            value={selectedConr}
                            options={uniqueConrs}
                            onChange={setSelectedConr}
                        />
                        {/* Searchable State Dropdown */}
                        <div ref={stateDropdownRef} className="relative min-w-[200px]">
                            <button
                                type="button"
                                onClick={() => setShowStateDropdown(!showStateDropdown)}
                                className="appearance-none w-full h-10 pl-3 pr-8 rounded-lg bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 hover:border-primary/50 text-slate-600 dark:text-slate-300 font-bold text-xs shadow-sm transition-all cursor-pointer text-left flex items-center justify-between"
                            >
                                <span className="truncate">
                                    {selectedState === 'All' ? 'State of Origin: All' : selectedState}
                                </span>
                                <span className="material-symbols-outlined text-slate-400 text-lg">
                                    {showStateDropdown ? 'expand_less' : 'arrow_drop_down'}
                                </span>
                            </button>

                            {showStateDropdown && (
                                <div className="absolute z-50 top-full left-0 mt-1 w-[300px] max-h-80 overflow-y-auto bg-white dark:bg-[#1a2533] border border-slate-200 dark:border-gray-700 rounded-xl shadow-xl">
                                    <div className="sticky top-0 bg-white dark:bg-[#1a2533] p-2 border-b border-slate-100 dark:border-gray-700 z-20">
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                                            <input
                                                type="text"
                                                placeholder="Search state..."
                                                value={stateSearchText}
                                                onChange={(e) => setStateSearchText(e.target.value)}
                                                className="w-full h-9 pl-8 pr-8 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/20"
                                                autoFocus
                                            />
                                            {stateSearchText && (
                                                <button
                                                    type="button"
                                                    onClick={() => setStateSearchText('')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 flex items-center justify-center p-0.5"
                                                >
                                                    <span className="material-symbols-outlined text-sm">close</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div
                                        onClick={() => {
                                            setSelectedState('All');
                                            setShowStateDropdown(false);
                                            setStateSearchText('');
                                        }}
                                        className={`px-3 py-2 cursor-pointer transition-colors ${selectedState === 'All' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                                    >
                                        State of Origin: All
                                    </div>

                                    {uniqueStates
                                        .filter(state => state.toLowerCase().includes(stateSearchText.toLowerCase()))
                                        .map(state => (
                                            <div
                                                key={state}
                                                onClick={() => {
                                                    setSelectedState(state);
                                                    setShowStateDropdown(false);
                                                    setStateSearchText('');
                                                }}
                                                className={`px-3 py-2 cursor-pointer transition-colors ${selectedState === state ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                                            >
                                                {state}
                                            </div>
                                        ))}

                                    {uniqueStates.filter(state => state.toLowerCase().includes(stateSearchText.toLowerCase())).length === 0 && (
                                        <div className="px-3 py-4 text-center text-slate-400 text-sm">
                                            No states found
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <FilterSelect
                            label="HOD"
                            value={selectedHOD}
                            options={['Yes', 'No']}
                            onChange={setSelectedHOD}
                        />
                        <FilterSelect
                            label="State Coord"
                            value={selectedStateCoord}
                            options={['Yes', 'No']}
                            onChange={setSelectedStateCoord}
                        />
                        <FilterSelect
                            label="Director"
                            value={selectedDirector}
                            options={['Yes', 'No']}
                            onChange={setSelectedDirector}
                        />
                        <FilterSelect
                            label="Education"
                            value={selectedEducation}
                            options={['Yes', 'No']}
                            onChange={setSelectedEducation}
                        />
                        <FilterSelect
                            label="Secretary"
                            value={selectedSecretary}
                            options={['Yes', 'No']}
                            onChange={setSelectedSecretary}
                        />
                        <FilterSelect
                            label="Others"
                            value={selectedOthers}
                            options={['Yes', 'No']}
                            onChange={setSelectedOthers}
                        />
                        <FilterSelect
                            label="Driver"
                            value={selectedDriver}
                            options={['Yes', 'No']}
                            onChange={setSelectedDriver}
                        />
                        <FilterSelect
                            label="Typesetting"
                            value={selectedTypesetting}
                            options={['Yes', 'No']}
                            onChange={setSelectedTypesetting}
                        />
                        <FilterSelect
                            label="Retiring Staff"
                            value={selectedRetiring}
                            options={['Yes', 'No']}
                            onChange={setSelectedRetiring}
                        />
                        {/* Searchable DOPA Dropdown */}
                        <div ref={dopaDropdownRef} className="relative min-w-[200px]">
                            <button
                                type="button"
                                onClick={() => setShowDopaDropdown(!showDopaDropdown)}
                                className="appearance-none w-full h-10 pl-3 pr-8 rounded-lg bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 hover:border-primary/50 text-slate-600 dark:text-slate-300 font-bold text-xs shadow-sm transition-all cursor-pointer text-left flex items-center justify-between"
                            >
                                <span className="truncate">
                                    {selectedPromotionDate === 'All' ? 'DOPA (Appt. Date): All' : selectedPromotionDate}
                                </span>
                                <span className="material-symbols-outlined text-slate-400 text-lg">
                                    {showDopaDropdown ? 'expand_less' : 'arrow_drop_down'}
                                </span>
                            </button>

                            {showDopaDropdown && (
                                <div className="absolute z-50 top-full left-0 mt-1 w-[300px] max-h-80 overflow-y-auto bg-white dark:bg-[#1a2533] border border-slate-200 dark:border-gray-700 rounded-xl shadow-xl">
                                    <div className="sticky top-0 bg-white dark:bg-[#1a2533] p-2 border-b border-slate-100 dark:border-gray-700 z-20">
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                                            <input
                                                type="text"
                                                placeholder="Search date..."
                                                value={dopaSearchText}
                                                onChange={(e) => setDopaSearchText(e.target.value)}
                                                className="w-full h-9 pl-8 pr-8 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/20"
                                                autoFocus
                                            />
                                            {dopaSearchText && (
                                                <button
                                                    type="button"
                                                    onClick={() => setDopaSearchText('')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 flex items-center justify-center p-0.5"
                                                >
                                                    <span className="material-symbols-outlined text-sm">close</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div
                                        onClick={() => {
                                            setSelectedPromotionDate('All');
                                            setShowDopaDropdown(false);
                                            setDopaSearchText('');
                                        }}
                                        className={`px-3 py-2 cursor-pointer transition-colors ${selectedPromotionDate === 'All' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                                    >
                                        DOPA (Appt. Date): All
                                    </div>

                                    {uniquePromotionDates
                                        .filter(date => date.toLowerCase().includes(dopaSearchText.toLowerCase()))
                                        .map(date => (
                                            <div
                                                key={date}
                                                onClick={() => {
                                                    setSelectedPromotionDate(date);
                                                    setShowDopaDropdown(false);
                                                    setDopaSearchText('');
                                                }}
                                                className={`px-3 py-2 cursor-pointer transition-colors ${selectedPromotionDate === date ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                                            >
                                                {date}
                                            </div>
                                        ))}

                                    {uniquePromotionDates.filter(date => date.toLowerCase().includes(dopaSearchText.toLowerCase())).length === 0 && (
                                        <div className="px-3 py-4 text-center text-slate-400 text-sm">
                                            No dates found
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {/* Searchable DOB Dropdown */}
                        <div ref={dobDropdownRef} className="relative min-w-[200px]">
                            <button
                                type="button"
                                onClick={() => setShowDobDropdown(!showDobDropdown)}
                                className="appearance-none w-full h-10 pl-3 pr-8 rounded-lg bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 hover:border-primary/50 text-slate-600 dark:text-slate-300 font-bold text-xs shadow-sm transition-all cursor-pointer text-left flex items-center justify-between"
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
                        {/* Button moved to header */}
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-xl border border-slate-200/60 dark:border-gray-800 bg-slate-50/50 dark:bg-[#121b25]">
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
                                <thead className="bg-slate-100/80 dark:bg-slate-800/50 text-slate-900 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-300 dark:border-gray-700">
                                    <tr>
                                        <th className="p-4 w-10 text-center">
                                            <button
                                                onClick={() => {
                                                    if (expandedRows.size > 0) {
                                                        setExpandedRows(new Set());
                                                    } else {
                                                        const allIds = new Set(sortedStaff.map(s => s.id));
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
                                        <th className="p-4 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                                                checked={isAllSelected}
                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                            />
                                        </th>
                                        <SortableHeader field="fileno" label="Staff ID" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="full_name" label="Full Name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="station" label="Station" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="rank" label="Rank" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="conr" label="CONR" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="state" label="State" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="active" label="Status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} center />
                                        <th className="px-4 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-300 dark:divide-gray-800 bg-white dark:bg-[#121b25]">
                                    {filteredStaff.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="p-10 text-center">
                                                <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-1">
                                                        <span className="material-symbols-outlined text-2xl">inbox</span>
                                                    </div>
                                                    <span className="text-sm font-medium">No records found</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedStaff.map((staff) => (
                                            <StaffRow
                                                key={staff.id}
                                                staff={staff}
                                                isSelected={selectedIds.has(staff.id)}
                                                onSelect={(checked) => handleSelectOne(staff.id, checked)}
                                                onEdit={() => handleOpenEdit(staff)}
                                                onDelete={() => handleDelete(staff.id)}
                                                isExpanded={expandedRows.has(staff.id)}
                                                onToggleExpand={() => toggleRow(staff.id)}
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
                        Showing <span className="text-slate-900 dark:text-white font-bold">{total === 0 ? 0 : (page - 1) * limit + 1}</span> to <span className="text-slate-900 dark:text-white font-bold">{total === 0 ? 0 : (page - 1) * limit + filteredStaff.length}</span> of <span className="text-slate-900 dark:text-white font-bold">{total}</span> results
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
                            Page {page} of {Math.max(1, totalPages)}
                        </div>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="group flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                        >
                            <span className="material-symbols-outlined text-xl group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                        </button>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(totalPages)}
                            className="group flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                            title="Last Page"
                        >
                            <span className="material-symbols-outlined text-xl">last_page</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

    );
};

const SortableHeader = ({
    field,
    label,
    sortField,
    sortDirection,
    onSort,
    center = false
}: {
    field: keyof Staff;
    label: string;
    sortField: keyof Staff | null;
    sortDirection: 'asc' | 'desc';
    onSort: (field: keyof Staff) => void;
    center?: boolean;
}) => {
    const isActive = sortField === field;

    return (
        <th
            className={`px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors select-none ${center ? 'text-center' : ''}`}
            onClick={() => onSort(field)}
        >
            <div className={`flex items-center gap-2 ${center ? 'justify-center' : ''}`}>
                <span>{label}</span>
                <span className={`material-symbols-outlined text-lg transition-all ${isActive ? 'text-emerald-600' : 'text-slate-300'
                    }`}>
                    {isActive && sortDirection === 'desc' ? 'arrow_downward' : 'arrow_upward'}
                </span>
            </div>
        </th>
    );
};

const FilterSelect = ({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (val: string) => void }) => (
    <div className="relative min-w-[200px]">
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="appearance-none w-full h-10 pl-3 pr-8 rounded-lg bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 hover:border-primary/50 text-slate-600 dark:text-slate-300 font-bold text-xs shadow-sm transition-all cursor-pointer focus:ring-primary focus:border-primary truncate"
        >
            <option value="All">{label}: All</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">arrow_drop_down</span>
    </div>
);

const StaffRow: React.FC<{
    staff: Staff;
    isSelected: boolean;
    onSelect: (checked: boolean) => void;
    onEdit: () => void;
    onDelete: () => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
}> = ({ staff, isSelected, onSelect, onEdit, onDelete, isExpanded, onToggleExpand }) => {
    return (
        <React.Fragment>
            <tr className={`group hover:bg-primary/[0.02] dark:hover:bg-slate-800/50 transition-colors duration-150 ${isExpanded ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : ''}`}>
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
                <td className="p-4 text-center">
                    <input
                        type="checkbox"
                        className="rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                        checked={isSelected}
                        onChange={(e) => onSelect(e.target.checked)}
                    />
                </td>
                <td className="px-4 py-4 font-mono text-base font-black text-slate-700 dark:text-slate-300">{staff.fileno}</td>
                <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-200 font-bold text-sm ring-2 ring-white dark:ring-slate-800 shadow-sm">
                            {staff.full_name.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{staff.full_name}</span>
                        <div className="flex gap-1">
                            {!!staff.is_hod && <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 uppercase" title="Head of Division">HOD</span>}
                            {!!staff.is_state_coordinator && <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase" title="State Coordinator">COORD</span>}
                            {!!staff.is_director && <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase" title="Director">DIR</span>}
                            {!!staff.is_education && <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 uppercase" title="Education">EDU</span>}
                            {!!staff.is_secretary && <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 uppercase" title="Secretary">SEC</span>}
                            {!!staff.others && <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300 border border-slate-200 dark:border-slate-800 uppercase" title="Others">OTH</span>}
                            {!!staff.is_driver && <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800 uppercase" title="Driver">DRV</span>}
                            {!!staff.is_typesetting && <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300 border border-pink-200 dark:border-pink-800 uppercase" title="Typesetting">TYP</span>}

                        </div>
                    </div>
                </td>
                <td className="px-4 py-4">
                    <span className="inline-flex px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700">
                        {staff.station || '-'}
                    </span>
                </td>
                <td className="px-4 py-4 font-medium text-slate-700 dark:text-slate-300 text-sm">{staff.rank || '-'}</td>
                <td className="px-4 py-4 text-slate-500 dark:text-slate-400 text-sm">{staff.conr || '-'}</td>
                <td className="px-4 py-4 text-slate-500 dark:text-slate-400 text-sm">{staff.state || '-'}</td>
                <td className="px-4 py-4 text-center">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${staff.active
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                        }`}>
                        {staff.active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                        <ActionBtn icon="edit" onClick={onEdit} tooltip="Edit Staff" />
                        {/* <ActionBtn icon="delete" isDanger onClick={onDelete} tooltip="Delete Staff" /> */}
                    </div>
                </td>
            </tr>
            {isExpanded && (
                <tr className="bg-gray-100 dark:bg-slate-800/50">
                    <td colSpan={10} className="p-4 pl-16">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm text-slate-600 dark:text-slate-400">
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">Email</span>
                                <span>{staff.email || '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">Phone</span>
                                <span>{staff.phone || '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">LGA</span>
                                <span>{staff.lga || '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">Qualification</span>
                                <span>{staff.qualification || '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">Gender</span>
                                <span>{staff.sex || '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">DOB</span>
                                <span>{staff.dob || '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">Date of First Appt.</span>
                                <span>{staff.dofa || '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">Date of Appt. to NECO</span>
                                <span>{staff.doan || '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">Date of Present Appt.</span>
                                <span>{staff.dopa || '-'}</span>
                            </div>
                            <div className="col-span-2 md:col-span-4">
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-2 border-b border-slate-200 dark:border-gray-700 pb-1">Quick Roles & Designation</span>
                                <div className="flex flex-wrap gap-4">
                                    <RoleIndicator label="Head of Division" active={staff.is_hod} icon="account_balance" color="purple" />
                                    <RoleIndicator label="State Coordinator" active={staff.is_state_coordinator} icon="location_on" color="amber" />
                                    <RoleIndicator label="Director" active={staff.is_director} icon="grade" color="blue" />
                                    <RoleIndicator label="Education" active={staff.is_education} icon="school" color="indigo" />
                                    <RoleIndicator label="Secretary" active={staff.is_secretary} icon="person_apron" color="cyan" />
                                    <RoleIndicator label="Driver" active={staff.is_driver} icon="directions_car" color="orange" />
                                    <RoleIndicator label="Typesetting" active={staff.is_typesetting} icon="keyboard" color="pink" />
                                    <RoleIndicator label="Others" active={staff.others} icon="more_horiz" color="slate" />
                                </div>
                            </div>
                            <div className="col-span-2 md:col-span-4 mt-2">
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">Remark</span>
                                <span className="italic text-slate-500">{staff.remark || 'No remarks provided.'}</span>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
}

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

const RoleIndicator = ({ label, active, icon, color }: { label: string; active: boolean; icon: string; color: string }) => (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-300 ${active
        ? `bg-${color}-50 dark:bg-${color}-900/20 border-${color}-200 dark:border-${color}-800 text-${color}-700 dark:text-${color}-300 shadow-sm shadow-${color}-500/10`
        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-gray-800 text-slate-400 dark:text-slate-600 grayscale opacity-60'
        }`}>
        <span className={`material-symbols-outlined text-lg ${active ? `text-${color}-500 dark:text-${color}-400` : ''}`}>{icon}</span>
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
        {active && (
            <span className={`material-symbols-outlined text-sm ml-1 text-${color}-500 dark:text-${color}-400 animate-pulse`}>check_circle</span>
        )}
    </div>
);

export default SDLPage;
