import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getAllTypesettingAPCRecords, assignmentFieldMap as typesettingApcFieldMap } from '../../services/typesettingApc';
import { getAllAssignments } from '../../services/assignment';
import { getAllMandates } from '../../services/mandate';
import { getAllStates } from '../../services/state';
import { bulkCreateTypesettingPostings, getAllTypesettingPostings, bulkDeleteTypesettingPostings } from '../../services/typesettingPosting';
import { TypesettingAPCRecord } from '../../types/typesettingApc';
import { Assignment } from '../../types/assignment';
import { Mandate } from '../../types/mandate';
import { TypesettingPostingCreate as PostingCreate, TypesettingPostingResponse as PostingResponse } from '../../types/typesettingPosting';
import { TypesettingFinalPostingResponse } from '../../types/typesettingFinalPosting';
import { getAllTypesettingFinalPostings } from '../../services/typesettingFinalPosting';
import { useNotification } from '../../context/NotificationContext';
import AlertModal from '../../components/AlertModal';
import StationTypeSelectionModal from '../../components/StationTypeSelectionModal';
import { getAllSchools } from '../../services/school';
import { getAllNCEECenters } from '../../services/nceeCenter';
import { getAllGiftedCenters } from '../../services/giftedCenter';
import { getAllBECECustodians, getAllSSCECustodians } from '../../services/custodianSpecific';
import { getAllTTCenters } from '../../services/ttCenter';
import { getAllPrintingPoints } from '../../services/printingPoint';
import { getAllMarkingVenues } from '../../services/markingVenue';
import { State } from '../../types/state';
import { getAllStations } from '../../services/station';
import { Station } from '../../types/station';
import { getTypesettingAssignmentBoardData, bulkSaveTypesettingAssignments } from '../../services/typesettingPersonalizedPost';
import { AssignmentBoardData, StaffMandateAssignment } from '../../types/apc';
import { MandateColumn } from '../../components/MandateColumn';
import SearchableSelect from '../../components/SearchableSelect';
import CsvUploadModal from '../../components/CsvUploadModal';
import HelpModal from '../../components/HelpModal';
import { helpContent } from '../../data/helpContent';

const TypesettingPostings: React.FC = () => {
    const { success, error, warning, info } = useNotification();

    // Tab State
    const [activeTab, setActiveTab] = useState<'random' | 'personalized'>('random');

    // Data States
    const [allTypesetters, setAllTypesetters] = useState<TypesettingAPCRecord[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [mandates, setMandates] = useState<Mandate[]>([]);
    const [existingPostings, setExistingPostings] = useState<PostingResponse[]>([]);
    const [finalPostings, setFinalPostings] = useState<TypesettingFinalPostingResponse[]>([]);
    const [allStates, setAllStates] = useState<State[]>([]);
    const [allStations, setAllStations] = useState<Station[]>([]);
    const [venues, setVenues] = useState<{ id: string; name: string; display_name?: string; type: string; state_name?: string; zone?: string; code?: string }[]>([]);
    const [loading, setLoading] = useState(false);

    // Random Posting Selections
    const [selectedAssignment, setSelectedAssignment] = useState<string>('');
    const [selectedMandate, setSelectedMandate] = useState<string>('');
    const [selectedVenues, setSelectedVenues] = useState<string[]>([]);
    const [showVenueDropdown, setShowVenueDropdown] = useState(false);
    const venueDropdownRef = useRef<HTMLDivElement>(null);

    // Click-outside handler for venue dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (venueDropdownRef.current && !venueDropdownRef.current.contains(event.target as Node)) {
                setShowVenueDropdown(false);
            }
        };

        if (showVenueDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showVenueDropdown]);

    const [isAllVenues, setIsAllVenues] = useState(false);
    const [targetQuota, setTargetQuota] = useState<number>(0);
    const [numberOfNights, setNumberOfNights] = useState<number>(0);
    const [description, setDescription] = useState<string>('');
    const [venueSearchText, setVenueSearchText] = useState('');

    // Preview
    const [generatedPostings, setGeneratedPostings] = useState<PostingCreate[]>([]);
    const [previewMode, setPreviewMode] = useState(false);

    // Modals
    const [isStationModalOpen, setIsStationModalOpen] = useState(false);
    const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' }>({ isOpen: false, title: '', message: '', type: 'info' as any });

    // Board States (Personalized)
    const [boardData, setBoardData] = useState<AssignmentBoardData | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<{ staffId: string; staff: StaffMandateAssignment; action: 'add' | 'remove' | 'move'; targetMandateId: string | null }[]>([]);
    const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
    const [poolSearch, setPoolSearch] = useState('');
    const [boardSearch, setBoardSearch] = useState('');
    const [selectedStationIdsPersonalized, setSelectedStationIdsPersonalized] = useState<string[]>([]);
    const [showPersonalizedStationDropdown, setShowPersonalizedStationDropdown] = useState(false);
    const personalizedStationDropdownRef = useRef<HTMLDivElement>(null);
    const [stationOptions, setStationOptions] = useState<{ id: string; name: string; type: string; state?: string | null; group?: string }[]>([]);
    const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    // Click outside to close personalized station dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (personalizedStationDropdownRef.current && !personalizedStationDropdownRef.current.contains(event.target as Node)) {
                setShowPersonalizedStationDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [typesettersData, assignmentsData, mandatesData, venuesData, postingsData, finalPostingsData, statesData, stationsData] = await Promise.all([
                getAllTypesettingAPCRecords(true),
                getAllAssignments(true),
                getAllMandates(true),
                getAllMarkingVenues(true),
                getAllTypesettingPostings(),
                getAllTypesettingFinalPostings(),
                getAllStates(),
                getAllStations(true)
            ]);

            setAllTypesetters(typesettersData);
            setAssignments(assignmentsData);
            setMandates(mandatesData);
            setExistingPostings(postingsData || []);
            setFinalPostings(finalPostingsData?.items || []);
            setAllStates(statesData);
            setAllStations(stationsData);

            const stateNameMap = new Map<string, State>(statesData.map(s => [s.name.toLowerCase(), s]));
            setVenues(venuesData.map(v => {
                const state = stateNameMap.get((v.state || '').toLowerCase());
                return {
                    id: v.id,
                    name: v.name,
                    display_name: v.name,
                    code: v.code,
                    type: 'marking_venue',
                    state_name: state?.name || v.state,
                    zone: state?.zone || undefined
                };
            }));
        } catch (err) {
            console.error("Failed to load initial data", err);
            error('Failed to load initial data.');
        } finally {
            setLoading(false);
        }
    };

    const handleStationTypeSelect = async (type: string) => {
        setLoading(true);
        try {
            let options: any[] = [];
            if (type === 'state') {
                const states = await getAllStates();
                options = states.map(s => ({ id: s.id, name: s.name, type: 'state', state_name: s.name, zone: s.zone || undefined }));
            } else {
                const [statesData, specificData] = await Promise.all([
                    getAllStates(),
                    type === 'school' ? getAllSchools(true) :
                        type === 'bece_custodian' ? getAllBECECustodians(true) :
                            type === 'ssce_custodian' ? getAllSSCECustodians(true) :
                                type === 'ncee_center' ? getAllNCEECenters(true) :
                                    type === 'gifted_center' ? getAllGiftedCenters(true) :
                                        type === 'tt_center' ? getAllTTCenters(true) :
                                            type === 'printing_point' ? getAllPrintingPoints(true) :
                                                getAllMarkingVenues(true)
                ]);
                const stateNameMap = new Map<string, State>(statesData.map(s => [s.name.toLowerCase(), s]));

                options = specificData.map((s: any) => {
                    let stateObj: State | undefined;
                    if (s.state_id) stateObj = statesData.find(st => st.id === s.state_id);
                    else if (s.state) stateObj = stateNameMap.get(s.state.toLowerCase());
                    const stateName = stateObj?.name || s.state || '';
                    const code = s.code || s.state_code || s.sch_no || '';
                    const displayName = `${s.name || s.sch_name}${code ? ` (${code})` : ''}`;

                    return {
                        id: s.id,
                        name: displayName,
                        display_name: displayName,
                        type: type,
                        state_name: stateName,
                        zone: stateObj?.zone || undefined
                    };
                });
            }
            setVenues(options);
            setStationOptions(options.map(s => {
                const stateVal = type === 'state' ? s.name : (s.state_name || s.state || null);
                const baseName = s.display_name || s.name;
                const finalName = (type !== 'state' && stateVal && !baseName.toLowerCase().includes(stateVal.toLowerCase()))
                    ? `${baseName} | ${stateVal}`
                    : baseName;

                return {
                    id: s.id,
                    name: finalName,
                    type,
                    state: stateVal,
                    group: type === 'state' ? 'All States' : (stateVal || 'Others')
                };
            }));
            setSelectedVenues([]);
            setIsAllVenues(false);
            setVenueSearchText('');
            success(`Loaded ${options.length} stations.`);
        } catch (err) {
            console.error('Failed to load stations', err);
            error('Failed to load stations');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'personalized' && selectedAssignment) {
            loadBoardData(selectedAssignment);
        } else {
            setBoardData(null);
            setHasUnsavedChanges(false);
            setPendingChanges([]);
            setSelectedStaffIds(new Set());
        }
    }, [activeTab, selectedAssignment]);

    const loadBoardData = async (assignmentId: string) => {
        setLoading(true);
        try {
            const assignment = assignments.find(a => a.id === assignmentId);
            if (!assignment) return;
            const data = await getTypesettingAssignmentBoardData(assignment);
            setBoardData(data);
            setHasUnsavedChanges(false);
            setPendingChanges([]);
            setSelectedStaffIds(new Set());
        } catch (err) {
            console.error(err);
            error('Failed to load board data');
            setSelectedAssignment('');
        } finally { setLoading(false); }
    };

    const handleLocalMove = useCallback((staff: StaffMandateAssignment, targetColumnId: string) => {
        if (!staff || !targetColumnId) return false;
        if (staff.mandate_id === targetColumnId) return false;

        setBoardData(prev => {
            if (!prev) return prev;
            const newBoard = { ...prev, unassignedStaff: [...prev.unassignedStaff], mandateColumns: prev.mandateColumns.map(c => ({ ...c, staff: [...c.staff] })) };

            const isFromPool = !staff.mandate_id;
            const isToPool = targetColumnId === 'unassigned';

            // 1. Remove from source
            if (isFromPool) {
                newBoard.unassignedStaff = newBoard.unassignedStaff.filter(s => s.id !== staff.id);
            } else {
                const col = newBoard.mandateColumns.find(c => c.id === staff.mandate_id);
                if (col) col.staff = col.staff.filter(s => s.id !== staff.id);
            }

            // 2. Add to target
            const action = isFromPool ? 'add' : (isToPool ? 'remove' : 'move');
            const updatedStaff = { ...staff, mandate_id: isToPool ? null : targetColumnId, pendingAction: action };

            if (isToPool) {
                newBoard.unassignedStaff.push(updatedStaff);
            } else {
                const col = newBoard.mandateColumns.find(c => c.id === targetColumnId);
                if (col) col.staff.push(updatedStaff);
            }

            setPendingChanges(old => [...old.filter(p => p.staffId !== staff.id), {
                staffId: staff.id, staff: updatedStaff, action, targetMandateId: isToPool ? null : targetColumnId
            }]);
            setHasUnsavedChanges(true);
            return newBoard;
        });
        return true;
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, targetColumnId: string) => {
        e.preventDefault();
        const staffData = e.dataTransfer.getData('application/json');
        if (!staffData) return;
        const staff: StaffMandateAssignment = JSON.parse(staffData);
        if ((staff.mandate_id || 'unassigned') === targetColumnId) return;
        handleLocalMove(staff, targetColumnId);
    }, [handleLocalMove]);

    const handleBulkMove = (targetMandateId: string) => {
        if (selectedStaffIds.size === 0) return;
        if (!boardData) return;

        const staffToMove = [...boardData.unassignedStaff, ...boardData.mandateColumns.flatMap(c => c.staff)]
            .filter(s => selectedStaffIds.has(s.id));

        staffToMove.forEach(s => handleLocalMove(s, targetMandateId));
        setSelectedStaffIds(new Set());
    };

    const handleBoardSaveChanges = async () => {
        if (!boardData || pendingChanges.length === 0) return;
        if (selectedStationIdsPersonalized.length === 0) {
            warning('Please select at least one Target Station.');
            return;
        }

        const assignment = assignments.find(a => a.id === selectedAssignment);

        setLoading(true);
        try {
            const selectedStations = stationOptions.filter(s => selectedStationIdsPersonalized.includes(s.id));
            const combinedStationName = selectedStations.map(s => s.name).join(' | ');
            const primaryStation = selectedStations[0];

            await bulkSaveTypesettingAssignments({
                assignment: assignment!,
                station: {
                    id: selectedStationIdsPersonalized.join(','),
                    name: combinedStationName,
                    type: primaryStation.type,
                    state: primaryStation.state
                },
                changes: pendingChanges,
                numberOfNights: numberOfNights,
                description: description
            });
            success(`${pendingChanges.length} changes committed successfully!`);
            await loadBoardData(selectedAssignment);
        } catch (err: any) {
            error(err.message || 'Failed to save board changes');
        } finally { setLoading(false); }
    };

    const onToggleSelect = useCallback((id: string) => {
        setSelectedStaffIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const downloadCsvTemplate = () => {
        const headers = ['StaffNo', 'MandateCode'];
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "bulk_typesetting_assignment_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredPool = useMemo(() => {
        if (!boardData) return [];
        const search = poolSearch.toLowerCase();
        return boardData.unassignedStaff.filter(s =>
            s.staff_name.toLowerCase().includes(search) ||
            s.staff_no.includes(search) ||
            s.current_station.toLowerCase().includes(search)
        );
    }, [boardData?.unassignedStaff, poolSearch]);

    const filteredBoard = useMemo(() => {
        if (!boardData) return [];
        const search = boardSearch.toLowerCase();
        return boardData.mandateColumns.map(col => ({
            ...col,
            staff: col.staff.filter(s =>
                s.staff_name.toLowerCase().includes(search) ||
                s.staff_no.includes(search) ||
                s.current_station.toLowerCase().includes(search)
            )
        }));
    }, [boardData?.mandateColumns, boardSearch]);

    // Get eligible Typesetters for selected assignment
    const eligibleTypesetters = useMemo(() => {
        if (!selectedAssignment || allTypesetters.length === 0) {
            return [];
        }
        const assignmentRecord = assignments.find(a => a.id === selectedAssignment);
        if (!assignmentRecord) {
            return [];
        }
        const apcField = typesettingApcFieldMap[assignmentRecord.code] || typesettingApcFieldMap[assignmentRecord.name];
        if (!apcField) {
            return [];
        }

        const alreadyPostedFileNos = new Set<string>();
        existingPostings.forEach(p => alreadyPostedFileNos.add(String(p.file_no).padStart(4, '0')));
        finalPostings.forEach(p => alreadyPostedFileNos.add(String(p.file_no).padStart(4, '0')));

        const filtered = allTypesetters.filter(t => {
            const normalizedFileNo = String(t.file_no).padStart(4, '0');
            if (alreadyPostedFileNos.has(normalizedFileNo)) return false;

            const val = (t as any)[apcField];
            if (!val || val.toString().trim() === '') return false;

            return true;
        });

        return filtered;
    }, [selectedAssignment, allTypesetters, assignments, existingPostings, finalPostings]);

    const generateRandomPostings = async () => {
        if (!selectedAssignment || !selectedMandate) {
            warning('Please select an Assignment and Mandate.');
            return;
        }
        if (selectedVenues.length === 0 && !isAllVenues) {
            warning('Please select at least one Venue or check "All Venues".');
            return;
        }

        if (targetQuota === 0) {
            warning('Please configure the target quota per venue.');
            return;
        }

        setLoading(true);
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const assignmentRecord = assignments.find(a => a.id === selectedAssignment);
            const assignmentCode = assignmentRecord?.code || selectedAssignment;
            const targetMandate = mandates.find(m => m.id === selectedMandate)?.mandate || selectedMandate;

            const alreadyPostedFileNos = new Set<string>();
            existingPostings.forEach(p => alreadyPostedFileNos.add(String(p.file_no).padStart(4, '0')));
            finalPostings.forEach(p => alreadyPostedFileNos.add(String(p.file_no).padStart(4, '0')));

            const apcField = typesettingApcFieldMap[assignmentCode];
            const eligibleTypesettersList = allTypesetters.filter(t => {
                const normalizedFileNo = String(t.file_no).padStart(4, '0');
                if (alreadyPostedFileNos.has(normalizedFileNo)) return false;

                if (apcField) {
                    const val = (t as any)[apcField];
                    if (!val || val.toString().trim() === '') return false;
                }
                return true;
            });

            const shuffle = <T,>(array: T[]): T[] => {
                const arr = [...array];
                for (let i = arr.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                }
                return arr;
            };

            const targetVenues = isAllVenues ? venues : venues.filter(v => selectedVenues.includes(v.id));
            const stationToZoneMap = new Map(allStations.map(s => [s.station.toLowerCase(), s.zone]));
            const typesetterToStateMap = new Map<string, string>();

            eligibleTypesettersList.forEach(t => {
                const station = (t.station || '').toLowerCase();
                const matchedState = allStates.find(s => station.includes(s.name.toLowerCase()));
                if (matchedState) typesetterToStateMap.set(t.id, matchedState.name);
            });

            const newPostings: PostingCreate[] = [];
            const venueNeeds = targetVenues.map(v => ({ venue: v, remaining: targetQuota }));
            const usedTypesetterIds = new Set<string>();

            for (let stage = 0; stage <= 2; stage++) {
                let madeProgress = true;
                while (madeProgress) {
                    madeProgress = false;
                    const shuffledVenues = shuffle([...venueNeeds]);

                    for (const vNeed of shuffledVenues) {
                        if (vNeed.remaining <= 0) continue;

                        const venueState = vNeed.venue.state_name;
                        const venueZone = vNeed.venue.zone;

                        const compatibleTypesetters = eligibleTypesettersList.filter(t => {
                            if (usedTypesetterIds.has(t.id)) return false;
                            const tStation = (t.station || '').toLowerCase();
                            const tZone = stationToZoneMap.get(tStation);
                            const tState = typesetterToStateMap.get(t.id);

                            const isStateMatch = venueState && tState === venueState;
                            const isZoneMatch = !isStateMatch && venueZone && tZone === venueZone;

                            if (stage === 0) return isStateMatch;
                            if (stage === 1) return isZoneMatch;
                            if (stage === 2) return true;
                            return false;
                        });

                        if (compatibleTypesetters.length > 0) {
                            const pickedTypesetter = shuffle(compatibleTypesetters)[0] as TypesettingAPCRecord;
                            usedTypesetterIds.add(pickedTypesetter.id);

                            const baseVenueName = `${vNeed.venue.code ? `(${vNeed.venue.code}) ` : ''}${vNeed.venue.name}`;
                            const vStateVal = (vNeed.venue.state_name || vNeed.venue.state || '').trim();
                            const finalVenue = (vStateVal && !baseVenueName.toLowerCase().includes(vStateVal.toLowerCase()))
                                ? `${baseVenueName} | ${vStateVal}`
                                : baseVenueName;

                            newPostings.push({
                                file_no: pickedTypesetter.file_no,
                                name: pickedTypesetter.name,
                                station: pickedTypesetter.station || '',
                                conraiss: pickedTypesetter.conraiss || '',
                                year: new Date().getFullYear().toString(),
                                assignments: [assignmentCode],
                                mandates: [targetMandate],
                                assignment_venue: [finalVenue],
                                state: [vNeed.venue.state_name || ''],
                                numb_of__nites: numberOfNights,
                                description: description || null
                            } as any);

                            vNeed.remaining--;
                            madeProgress = true;
                        }
                    }
                }
            }

            setGeneratedPostings(newPostings);
            if (newPostings.length > 0) setPreviewMode(true);
            else info('No typesetters matched criteria or quotas already met.');
        } catch (err) {
            console.error("Error generating postings", err);
            error('An error occurred during generation.');
        } finally {
            setLoading(false);
        }
    };

    const handleSavePostings = async (postingsToSave: PostingCreate[]) => {
        if (postingsToSave.length === 0) return;
        setLoading(true);
        try {
            const idsToDelete = postingsToSave
                .map(p => existingPostings.find(ep => String(ep.file_no).padStart(4, '0') === String(p.file_no).padStart(4, '0'))?.id)
                .filter(id => id);

            if (idsToDelete.length > 0) {
                await bulkDeleteTypesettingPostings(idsToDelete as string[]);
            }

            await bulkCreateTypesettingPostings({ items: postingsToSave });
            success(`Successfully posted ${postingsToSave.length} Typesetters!`);
            setGeneratedPostings([]);
            setPreviewMode(false);
            fetchInitialData();
        } catch (err: any) {
            console.error("Save failed", err);
            error(`Failed to save postings: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (previewMode) {
        return (
            <div className="flex-1 flex flex-col min-h-full bg-slate-50 dark:bg-[#0b1015] p-4 md:p-8 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 w-full max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl md:text-2xl lg:text-3xl font-bold">Generated Preview ({generatedPostings.length})</h2>
                    <div className="flex gap-3">
                        <button onClick={() => setPreviewMode(false)} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold">Back</button>
                        <button
                            onClick={() => handleSavePostings(generatedPostings)}
                            disabled={loading}
                            className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> : null}
                            Confirm & Post
                        </button>
                    </div>
                </div>
                <div className="bg-white dark:bg-[#121b25] rounded-xl border border-slate-200 dark:border-gray-800 overflow-auto max-h-[600px]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-[#0f161d] text-sm uppercase font-bold text-slate-500 sticky top-0">
                            <tr>
                                <th className="p-3">File No</th>
                                <th className="p-3">Name</th>
                                <th className="p-3">Station</th>
                                <th className="p-3">CON</th>
                                <th className="p-3">Venue</th>
                                <th className="p-3">State</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300 dark:divide-gray-800">
                            {generatedPostings.map((p, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                    <td className="p-3 font-mono font-bold">{p.file_no}</td>
                                    <td className="p-3 font-medium">{p.name}</td>
                                    <td className="p-3 font-bold text-xs text-slate-500">{p.station || '-'}</td>
                                    <td className="p-3 font-bold">{p.conraiss}</td>
                                    <td className="p-3 text-purple-600 dark:text-purple-400 font-bold">{p.assignment_venue?.[0]}</td>
                                    <td className="p-3">{p.state?.[0] || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-full bg-slate-50 dark:bg-[#0b1015] p-4 md:p-8 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
            <div className="mb-8">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400 drop-shadow-sm">
                    Typesetting Posting Generator
                </h1>
                <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">Assign Typesetters using random or personalized methods.</p>
            </div>

            <div className="flex gap-2 mb-6 bg-white dark:bg-[#121b25] p-1 rounded-xl w-fit border border-slate-200 dark:border-gray-800">
                <button onClick={() => setActiveTab('random')} className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'random' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    <span className="material-symbols-outlined text-lg mr-2 align-middle">shuffle</span> Random
                </button>
                <button onClick={() => setActiveTab('personalized')} className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'personalized' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    <span className="material-symbols-outlined text-lg mr-2 align-middle">upload_file</span> Personalized (CSV)
                </button>
            </div>

            <div className="flex-1 max-w-5xl">
                {activeTab === 'random' && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">1</span> Select Criteria
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Assignment</label>
                                    <select className="w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700" value={selectedAssignment} onChange={e => { setSelectedAssignment(e.target.value); setSelectedMandate(''); }}>
                                        <option value="">Select Assignment</option>
                                        {assignments.filter(a => a.active).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Mandate</label>
                                    <select className="w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 disabled:opacity-50" value={selectedMandate} onChange={e => setSelectedMandate(e.target.value)} disabled={!selectedAssignment}>
                                        <option value="">Select Mandate</option>
                                        {mandates.filter(m => assignments.find(a => a.id === selectedAssignment)?.mandates?.includes(m.code)).map(m => <option key={m.id} value={m.id}>{m.mandate}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-bold uppercase text-slate-500">Venue</label>
                                        <button onClick={() => setIsStationModalOpen(true)} className="text-[10px] font-black text-white bg-indigo-600 px-3 py-1 rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm">hub</span> Pick Station
                                        </button>
                                    </div>
                                    <div className="flex gap-2 min-w-0">
                                        <div ref={venueDropdownRef} className="relative flex-1 min-w-0">
                                            <button type="button" onClick={() => !isAllVenues && setShowVenueDropdown(!showVenueDropdown)} disabled={isAllVenues} className={`w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-left flex items-center justify-between ${isAllVenues ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-emerald-400'}`}>
                                                <span className="truncate">{isAllVenues ? 'All Venues' : selectedVenues.length === 0 ? 'Select Venue(s)...' : `${selectedVenues.length} selected`}</span>
                                                <span className="material-symbols-outlined text-slate-400">{showVenueDropdown ? 'expand_less' : 'expand_more'}</span>
                                            </button>
                                            {showVenueDropdown && !isAllVenues && (
                                                <div className="absolute z-50 top-full left-0 mt-1 w-[400px] max-h-80 overflow-y-auto bg-white dark:bg-[#1a2533] border border-slate-200 dark:border-gray-700 rounded-xl shadow-xl">
                                                    <div className="sticky top-0 bg-white dark:bg-[#1a2533] p-2 border-b border-slate-100 dark:border-gray-700 flex flex-col gap-2 z-20">
                                                        <div className="flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const filtered = venues.filter(v => v.name.toLowerCase().includes(venueSearchText.toLowerCase()));
                                                                    setSelectedVenues(filtered.map(v => v.id));
                                                                }}
                                                                className="flex-1 text-xs font-bold px-2 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                                                            >
                                                                Select All
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedVenues([])}
                                                                className="flex-1 text-xs font-bold px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                            >
                                                                Clear All
                                                            </button>
                                                        </div>
                                                        <input type="text" placeholder="Search..." value={venueSearchText} onChange={e => setVenueSearchText(e.target.value)} className="w-full h-9 pl-4 pr-4 rounded-lg bg-slate-50 dark:bg-[#0f161d] border border-slate-200 dark:border-gray-700 text-sm" />
                                                    </div>
                                                    <div className="pb-2">
                                                        {(() => {
                                                            const filtered = venues.filter(v => v.name.toLowerCase().includes(venueSearchText.toLowerCase()));
                                                            const grouped = filtered.reduce((acc, venue) => {
                                                                const state = venue.state_name || 'Others';
                                                                if (!acc[state]) acc[state] = [];
                                                                acc[state].push(venue);
                                                                return acc;
                                                            }, {} as { [key: string]: typeof venues });

                                                            const sortedStates = Object.keys(grouped).sort((a, b) => {
                                                                if (a === 'Others') return 1;
                                                                if (b === 'Others') return -1;
                                                                return a.localeCompare(b);
                                                            });

                                                            return sortedStates.map(state => {
                                                                const stateVenues = grouped[state].sort((a, b) => a.name.localeCompare(b.name));
                                                                const allStateSelected = stateVenues.every(v => selectedVenues.includes(v.id));
                                                                const someStateSelected = stateVenues.some(v => selectedVenues.includes(v.id));

                                                                return (
                                                                    <div key={state}>
                                                                        <div
                                                                            className="sticky top-[85px] px-3 py-2 bg-slate-100 dark:bg-[#0f161d] border-b border-slate-200 dark:border-gray-700 flex items-center gap-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 z-10"
                                                                            onClick={() => {
                                                                                if (allStateSelected) {
                                                                                    setSelectedVenues(prev => prev.filter(id => !stateVenues.some(v => v.id === id)));
                                                                                } else {
                                                                                    setSelectedVenues(prev => [...new Set([...prev, ...stateVenues.map(v => v.id)])]);
                                                                                }
                                                                            }}
                                                                        >
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={allStateSelected}
                                                                                ref={input => {
                                                                                    if (input) input.indeterminate = someStateSelected && !allStateSelected;
                                                                                }}
                                                                                onChange={() => { }}
                                                                                className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                                                                            />
                                                                            <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">{state}</span>
                                                                            <span className="text-[10px] text-slate-500">({stateVenues.length})</span>
                                                                        </div>
                                                                        <div className="space-y-1 p-1">
                                                                            {stateVenues.map(v => {
                                                                                const isSelected = selectedVenues.includes(v.id);
                                                                                return (
                                                                                    <div
                                                                                        key={v.id}
                                                                                        onClick={() => setSelectedVenues(prev => prev.includes(v.id) ? prev.filter(x => x !== v.id) : [...prev, v.id])}
                                                                                        className={`px-3 py-2 flex items-center gap-2 cursor-pointer rounded-lg ${isSelected ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                                                                    >
                                                                                        <input type="checkbox" checked={isSelected} onChange={() => { }} className="w-4 h-4 text-emerald-600 rounded" />
                                                                                        <span className={`text-sm ${isSelected ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                                            {v.name}
                                                                                        </span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                    <div className="sticky bottom-0 bg-white dark:bg-[#1a2533] p-2 border-t border-slate-100 dark:border-gray-700">
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowVenueDropdown(false)}
                                                            className="w-full text-sm font-bold px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                                                        >
                                                            Done ({selectedVenues.length} selected)
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 rounded-xl border border-slate-200 dark:border-gray-700">
                                            <input type="checkbox" id="allVenues" checked={isAllVenues} onChange={e => setIsAllVenues(e.target.checked)} className="w-4 h-4" />
                                            <label htmlFor="allVenues" className="text-sm font-bold">All</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">2</span> Configuration
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Quota Per Venue</label>
                                    <input type="number" min="0" className="w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700" value={targetQuota || ''} onChange={e => setTargetQuota(parseInt(e.target.value) || 0)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Nights</label>
                                    <input type="number" min="0" className="w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700" value={numberOfNights} onChange={e => setNumberOfNights(parseInt(e.target.value) || 0)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Description</label>
                                    <input type="text" className="w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional..." />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500">Eligible Typesetters:</p>
                                <p className="text-3xl font-black text-emerald-600">{eligibleTypesetters.length}</p>
                            </div>
                            <button onClick={generateRandomPostings} disabled={loading || eligibleTypesetters.length === 0} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg h-12 flex items-center gap-2">
                                {loading && <span className="material-symbols-outlined animate-spin">progress_activity</span>} Generate Postings
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'personalized' && (
                    <div className="flex-1 flex flex-col min-h-[600px] bg-white dark:bg-[#121b25] rounded-2xl border border-slate-200 dark:border-gray-800 overflow-hidden">
                        <header className="p-4 border-b border-slate-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-3 flex-1">
                                <select className="h-10 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-sm font-medium min-w-[200px]" value={selectedAssignment} onChange={e => setSelectedAssignment(e.target.value)}>
                                    <option value="">Select Assignment</option>
                                    {assignments.filter(a => a.active).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                                <div ref={personalizedStationDropdownRef} className="relative min-w-[240px]">
                                    <button
                                        type="button"
                                        onClick={() => setShowPersonalizedStationDropdown(!showPersonalizedStationDropdown)}
                                        className="w-full h-10 px-4 rounded-xl border-2 border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] text-sm font-bold flex items-center justify-between dark:text-white"
                                    >
                                        <span className="truncate">{selectedStationIdsPersonalized.length === 0 ? 'Select Target Stations...' : `${selectedStationIdsPersonalized.length} selected`}</span>
                                        <span className="material-symbols-outlined text-slate-400">{showPersonalizedStationDropdown ? 'expand_less' : 'expand_more'}</span>
                                    </button>
                                    {showPersonalizedStationDropdown && (
                                        <div className="absolute z-50 top-full left-0 mt-2 w-[400px] max-h-80 overflow-y-auto bg-white dark:bg-[#1a2533] border border-slate-200 dark:border-gray-700 rounded-xl shadow-2xl">
                                            {/* Quick Actions */}
                                            <div className="sticky top-0 bg-white dark:bg-[#1a2533] p-2 border-b border-slate-100 dark:border-gray-700 flex gap-2 z-20">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedStationIdsPersonalized(stationOptions.map(v => v.id))}
                                                    className="flex-1 text-xs font-bold px-2 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                                                >
                                                    Select All
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedStationIdsPersonalized([])}
                                                    className="flex-1 text-xs font-bold px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                >
                                                    Clear All
                                                </button>
                                            </div>

                                            <div className="pb-2">
                                                {(() => {
                                                    const grouped = stationOptions.reduce((acc, opt) => {
                                                        const group = opt.group || 'Others';
                                                        if (!acc[group]) acc[group] = [];
                                                        acc[group].push(opt);
                                                        return acc;
                                                    }, {} as { [key: string]: typeof stationOptions });

                                                    const sortedGroups = Object.keys(grouped).sort((a, b) => {
                                                        if (a === 'All States') return -1;
                                                        if (b === 'All States') return 1;
                                                        if (a === 'Others') return 1;
                                                        if (b === 'Others') return -1;
                                                        return a.localeCompare(b);
                                                    });

                                                    return sortedGroups.map(group => {
                                                        const groupOpts = grouped[group].sort((a, b) => a.name.localeCompare(b.name));
                                                        const allGroupSelected = groupOpts.every(v => selectedStationIdsPersonalized.includes(v.id));
                                                        const someGroupSelected = groupOpts.some(v => selectedStationIdsPersonalized.includes(v.id));

                                                        return (
                                                            <div key={group}>
                                                                <div
                                                                    className="sticky top-[45px] px-3 py-2 bg-slate-100 dark:bg-[#0f161d] border-b border-slate-200 dark:border-gray-700 flex items-center gap-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 z-10"
                                                                    onClick={() => {
                                                                        if (allGroupSelected) {
                                                                            setSelectedStationIdsPersonalized(prev => prev.filter(id => !groupOpts.some(v => v.id === id)));
                                                                        } else {
                                                                            setSelectedStationIdsPersonalized(prev => [...new Set([...prev, ...groupOpts.map(v => v.id)])]);
                                                                        }
                                                                    }}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={allGroupSelected}
                                                                        ref={input => {
                                                                            if (input) input.indeterminate = someGroupSelected && !allGroupSelected;
                                                                        }}
                                                                        onChange={() => { }}
                                                                        className="w-4 h-4 text-indigo-600 rounded cursor-pointer accent-indigo-600"
                                                                    />
                                                                    <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">{group}</span>
                                                                    <span className="text-[10px] text-slate-500">({groupOpts.length})</span>
                                                                </div>
                                                                <div className="space-y-1 p-1">
                                                                    {groupOpts.map(s => {
                                                                        const isSelected = selectedStationIdsPersonalized.includes(s.id);
                                                                        return (
                                                                            <div
                                                                                key={s.id}
                                                                                onClick={() => setSelectedStationIdsPersonalized(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                                                                                className={`px-3 py-2 flex items-center gap-2 cursor-pointer rounded-lg ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                                                            >
                                                                                <input type="checkbox" checked={isSelected} onChange={() => { }} className="w-4 h-4 text-indigo-600 rounded accent-indigo-600" />
                                                                                <span className={`text-sm ${isSelected ? 'font-semibold text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                                    {s.name}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                            <div className="sticky bottom-0 bg-white dark:bg-[#1a2533] p-2 border-t border-slate-100 dark:border-gray-700">
                                                <button
                                                    onClick={() => setShowPersonalizedStationDropdown(false)}
                                                    className="w-full text-sm font-bold px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                                                >
                                                    Done
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => setIsStationModalOpen(true)} className="h-10 px-4 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 text-xs">
                                    <span className="material-symbols-outlined text-sm">hub</span> Pick Station
                                </button>
                                <input type="text" placeholder="Description..." value={description} onChange={e => setDescription(e.target.value)} className="h-10 px-4 rounded-xl border border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] text-sm flex-1 dark:text-white" />
                                <input type="number" placeholder="Nites" value={numberOfNights} onChange={e => setNumberOfNights(parseInt(e.target.value) || 0)} className="h-10 px-3 rounded-xl border border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] text-sm w-20 dark:text-white" />
                            </div>
                            <button onClick={handleBoardSaveChanges} disabled={!hasUnsavedChanges || loading} className="h-10 px-6 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-lg flex items-center gap-2">
                                {loading ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> : <span className="material-symbols-outlined text-sm">commit</span>} Commit
                            </button>
                        </header>
                        <div className="flex-1 flex overflow-hidden">
                            <aside className="w-80 border-r border-slate-100 dark:border-gray-800 flex flex-col bg-slate-50/50 dark:bg-[#0f161d]/50">
                                <div className="p-4">
                                    <input
                                        type="text"
                                        placeholder="Search pool..."
                                        value={poolSearch}
                                        onChange={e => setPoolSearch(e.target.value)}
                                        className="w-full h-9 px-3 bg-white dark:bg-[#1a2533] border border-slate-100 dark:border-gray-700 rounded-lg text-xs dark:text-white"
                                    />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <MandateColumn columnId="unassigned" title="Eligible Pool" staffList={filteredPool} onDragOver={e => e.preventDefault()} onDrop={handleDrop} selectedStaffIds={selectedStaffIds} onToggleSelect={onToggleSelect} />
                                </div>
                            </aside>
                            <section className="flex-1 flex flex-col overflow-hidden">
                                <div className="h-12 px-6 flex items-center justify-between border-b border-slate-100 dark:border-gray-800 bg-white/50 dark:bg-[#121b25]/50">
                                    <input
                                        type="text"
                                        placeholder="Filter board..."
                                        value={boardSearch}
                                        onChange={e => setBoardSearch(e.target.value)}
                                        className="h-8 px-2 bg-transparent text-xs font-bold outline-none dark:text-white"
                                    />
                                    <div className="flex items-center gap-4">
                                        <button onClick={downloadCsvTemplate} className="text-[10px] font-black text-slate-400 dark:text-slate-500 hover:text-indigo-500 uppercase flex items-center gap-1"><span className="material-symbols-outlined text-sm">download</span> Template</button>
                                        <button onClick={() => setIsCsvModalOpen(true)} className="text-[10px] font-black text-slate-400 dark:text-slate-500 hover:text-indigo-500 uppercase flex items-center gap-1"><span className="material-symbols-outlined text-sm">cloud_upload</span> Bulk CSV</button>
                                        <button onClick={() => setShowHelp(true)} className="text-[10px] font-black text-slate-400 dark:text-slate-500 hover:text-indigo-500 uppercase flex items-center gap-1"><span className="material-symbols-outlined text-sm">help</span> Help</button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-x-auto custom-scrollbar p-6">
                                    <div className="flex gap-4 h-full min-w-max">
                                        {!selectedAssignment ? <div className="flex-1 flex items-center justify-center opacity-30 italic text-xs uppercase dark:text-slate-400">Choose an assignment to begin</div> :
                                            boardData?.mandateColumns.map((col, idx) => (
                                                <div key={col.id} className="w-[300px] flex flex-col relative h-full">
                                                    <MandateColumn columnId={col.id} title={col.title} subtitle={col.code} staffList={filteredBoard.find(c => c.id === col.id)?.staff || []} onDragOver={e => e.preventDefault()} onDrop={handleDrop} colorTheme={['emerald', 'blue', 'purple', 'amber'][idx % 4] as any} isDropTarget={true} selectedStaffIds={selectedStaffIds} onToggleSelect={onToggleSelect} />
                                                    {selectedStaffIds.size > 0 && <button onClick={() => handleBulkMove(col.id)} className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-full shadow-lg border-2 border-white dark:border-gray-800 z-20">MOVE {selectedStaffIds.size} TO THIS</button>}
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                )}
            </div>

            <StationTypeSelectionModal isOpen={isStationModalOpen} onClose={() => setIsStationModalOpen(false)} onSelect={handleStationTypeSelect} />
            <AlertModal isOpen={alertModal.isOpen} onClose={() => setAlertModal({ ...alertModal, isOpen: false })} title={alertModal.title} message={alertModal.message} type={alertModal.type} />
            <CsvUploadModal
                isOpen={isCsvModalOpen}
                onClose={() => setIsCsvModalOpen(false)}
                staffPool={boardData ? [...boardData.unassignedStaff, ...boardData.mandateColumns.flatMap(c => c.staff)] : []}
                onUpload={(csvData) => {
                    if (!boardData) return;
                    let successCount = 0;
                    const staffMap = new Map();
                    [...boardData.unassignedStaff, ...boardData.mandateColumns.flatMap(c => c.staff)].forEach(s => staffMap.set(s.staff_no.toString().padStart(4, '0'), s));
                    const mandateMap = new Map();
                    boardData.mandateColumns.forEach(c => { mandateMap.set(c.code.toLowerCase(), c.id); mandateMap.set(c.title.toLowerCase(), c.id); });

                    csvData.forEach(record => {
                        const staffNo = record.staffNo.toString().padStart(4, '0');
                        const staff = staffMap.get(staffNo);
                        const targetId = record.mandateCode ? mandateMap.get(record.mandateCode.toLowerCase()) : null;
                        if (staff && targetId && staff.mandate_id !== targetId) {
                            if (handleLocalMove(staff, targetId)) successCount++;
                        }
                    });
                    if (successCount > 0) success(`Successfully assigned ${successCount} typesetters.`);
                }}
            />
            <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} helpData={helpContent.personalizedPost} />
            {loading && <div className="fixed inset-0 bg-white/10 dark:bg-black/10 backdrop-blur-[1px] z-50 pointer-events-none"></div>}
        </div>
    );
};

export default TypesettingPostings;
