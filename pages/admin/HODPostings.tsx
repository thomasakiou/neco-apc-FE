import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getAllHODApcRecords, assignmentFieldMap as hodApcFieldMap } from '../../services/hodApc';
import { getAllAssignments } from '../../services/assignment';
import { getAllMandates } from '../../services/mandate';
import { getAllMarkingVenues } from '../../services/markingVenue';
import { getAllStates } from '../../services/state';
import { bulkCreateHODPostings, getAllHODPostings } from '../../services/hodPosting';
import { HODApcRecord } from '../../types/hodApc';
import { Assignment } from '../../types/assignment';
import { Mandate } from '../../types/mandate';
import { PostingCreate, PostingResponse } from '../../types/posting';
import { useNotification } from '../../context/NotificationContext';
import AlertModal from '../../components/AlertModal';
import StationTypeSelectionModal from '../../components/StationTypeSelectionModal';
import { getAllSchools } from '../../services/school';
import { getAllNCEECenters } from '../../services/nceeCenter';
import { getAllGiftedCenters } from '../../services/giftedCenter';
import { getAllBECECustodians, getAllSSCECustodians } from '../../services/custodianSpecific';
import { getAllTTCenters } from '../../services/ttCenter';
import { State } from '../../types/state';
import { getAllStations } from '../../services/station';
import { Station } from '../../types/station';
import { getHODAssignmentBoardData, bulkSaveHODAssignments } from '../../services/hodPersonalizedPost';
import { AssignmentBoardData, StaffMandateAssignment } from '../../types/apc';
import { MandateColumn } from '../../components/MandateColumn';
import SearchableSelect from '../../components/SearchableSelect';
import CsvUploadModal from '../../components/CsvUploadModal';
import HelpModal from '../../components/HelpModal';
import { helpContent } from '../../data/helpContent';


const HODPostings: React.FC = () => {
    const { success, error, warning, info } = useNotification();

    // Tab State
    const [activeTab, setActiveTab] = useState<'random' | 'personalized'>('random');

    // Data States
    const [allHODs, setAllHODs] = useState<HODApcRecord[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [mandates, setMandates] = useState<Mandate[]>([]);
    const [existingPostings, setExistingPostings] = useState<PostingResponse[]>([]);
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
    const [selectedStationId, setSelectedStationId] = useState<string>('');
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
            const [hodsData, assignmentsData, mandatesData, venuesData, postingsData, statesData, stationsData] = await Promise.all([
                getAllHODApcRecords(true),
                getAllAssignments(true),
                getAllMandates(true),
                getAllMarkingVenues(true),
                getAllHODPostings(),
                getAllStates(),
                getAllStations(true)
            ]);

            setAllHODs(hodsData);
            setAssignments(assignmentsData);
            setMandates(mandatesData);
            setExistingPostings(postingsData || []);
            setAllStates(statesData);
            setAllStations(stationsData);

            const stateNameMap = new Map<string, State>(statesData.map(s => [s.name.toLowerCase(), s]));
            setVenues(venuesData.map(v => {
                const state = stateNameMap.get((v.state || '').toLowerCase());
                return {
                    id: v.id,
                    name: v.name, // Marking venues default to just Name
                    display_name: v.name, // Explicit display name
                    code: v.code, // Include code
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
                        name: displayName, // Save as "Name (Code)"
                        display_name: displayName, // Display as "Name (Code)"
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
            const data = await getHODAssignmentBoardData(assignment);
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
            // Join selected station names
            const selectedStations = stationOptions.filter(s => selectedStationIdsPersonalized.includes(s.id));
            const combinedStationName = selectedStations.map(s => s.name).join(' | ');
            const primaryStation = selectedStations[0];

            await bulkSaveHODAssignments({
                assignment: assignment!,
                station: {
                    id: selectedStationIdsPersonalized.join(','),
                    name: combinedStationName,
                    type: primaryStation.type,
                    state: primaryStation.state
                },
                changes: pendingChanges,
                numberOfNights: (assignment?.code === 'MAR-ACCR' || assignment?.code === 'OCT-ACCR') ? numberOfNights : undefined,
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
        link.setAttribute("download", "bulk_hod_assignment_template.csv");
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
            s.current_station.toLowerCase().includes(search) ||
            s.qualification?.toLowerCase().includes(search)
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
                s.current_station.toLowerCase().includes(search) ||
                s.qualification?.toLowerCase().includes(search)
            )
        }));
    }, [boardData?.mandateColumns, boardSearch]);

    // Get eligible HODs for selected assignment
    const eligibleHODs = useMemo(() => {
        if (!selectedAssignment || allHODs.length === 0) {
            return [];
        }
        const assignmentRecord = assignments.find(a => a.id === selectedAssignment);
        if (!assignmentRecord) {
            return [];
        }
        const apcField = hodApcFieldMap[assignmentRecord.code] || hodApcFieldMap[assignmentRecord.name];
        if (!apcField) {
            return [];
        }

        // Pre-calculate posted counts
        const postedCountMap = new Map<string, number>();
        existingPostings.forEach(p => {
            const count = (p.assignments || []).length;
            postedCountMap.set(p.file_no, (postedCountMap.get(p.file_no) || 0) + count);
        });

        const filtered = allHODs.filter(hod => {
            if (!hod.active) return false;
            const val = hod[apcField as keyof HODApcRecord];
            if (!val || val.toString().trim() === '') return false;
            // Capacity check (simple version)
            const totalPosted = postedCountMap.get(hod.file_no) || 0;
            const totalAllotted = hod.count || 0;
            if (totalPosted >= totalAllotted) return false;
            return true;
        });

        return filtered;
    }, [selectedAssignment, allHODs, assignments, existingPostings]);

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

        // Allow UI to update before heavy calculation
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const assignmentRecord = assignments.find(a => a.id === selectedAssignment);
            const assignmentCode = assignmentRecord?.code || selectedAssignment;
            const targetMandate = mandates.find(m => m.id === selectedMandate)?.mandate || selectedMandate;

            // 1. Existing Assignments Lookup (duplicate prevention)
            const alreadyAssignedStaffIds = new Set<string>();
            const assignmentName = assignmentRecord?.name || '';

            // Helper for robust comparison
            const normalize = (s: any) => s ? String(s).trim().toUpperCase() : '';
            const targetCode = normalize(assignmentCode);
            const targetName = normalize(assignmentName);
            const targetMandateNorm = normalize(targetMandate);

            existingPostings.forEach(p => {
                // Check if posted for this assignment (by code or name)
                let matchesAssignment = false;
                if (Array.isArray(p.assignments)) {
                    matchesAssignment = p.assignments.some(a => {
                        const normA = normalize(a);
                        return (targetCode && normA === targetCode) || (targetName && normA === targetName);
                    });
                }

                // Fallback: check mandates if assignment check was insufficient or for specific mandate constraints
                let matchesMandate = false;
                if (Array.isArray(p.mandates)) {
                    matchesMandate = p.mandates.some(m => normalize(m) === targetMandateNorm);
                }

                if (matchesAssignment || matchesMandate) {
                    // Ensure file_no is normalized to match other comparisons
                    alreadyAssignedStaffIds.add(String(p.file_no).padStart(4, '0'));
                }
            });

            console.log('DEBUG: Duplicate Check', {
                assignmentCode,
                assignmentName,
                totalExisting: existingPostings.length,
                foundDuplicates: alreadyAssignedStaffIds.size,
                samplePosting: existingPostings[0]
            });
            // 2. Filter Eligible HODs
            let skippedDueToDuplicate = 0;
            const eligibleHODs = allHODs.filter(hod => {
                if (alreadyAssignedStaffIds.has(hod.file_no)) {
                    skippedDueToDuplicate++;
                    return false;
                }
                // Basic capacity check
                const totalPosted = (hod.posted_for || 0); // Assuming hod.posted_for tracks count
                if (totalPosted >= (hod.count || 0)) return false;

                // --- NEW: Assignment-specific filtering (if HODs have specific assignment flags)
                // For HODs, we might assume they are generally available or check specific flags if present
                // e.g. if (assignmentCode === 'SSCE' && !hod.is_ssce) return false;

                return true;
            });

            // Shuffle
            const shuffle = <T,>(array: T[]): T[] => {
                const arr = [...array];
                for (let i = arr.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                }
                return arr;
            };
            const shuffledHODs = shuffle(eligibleHODs);

            // 3. Prepare Venues & Quotas
            const targetVenues = isAllVenues ? venues : venues.filter(v => selectedVenues.includes(v.id));

            // Map HODs to States/Zones
            const stationToZoneMap = new Map(allStations.map(s => [s.station.toLowerCase(), s.zone]));
            const hodToStateMap = new Map<string, string>();

            eligibleHODs.forEach(hod => {
                const station = (hod.station || '').toLowerCase();
                const matchedState = allStates.find(s => station.includes(s.name.toLowerCase()));
                if (matchedState) {
                    hodToStateMap.set(hod.id, matchedState.name);
                }
            });

            const newPostings: PostingCreate[] = [];

            // Track venue quotas and remaining needs
            interface VenueNeed {
                venue: typeof targetVenues[0];
                remaining: number;
            }

            const venueNeeds: VenueNeed[] = targetVenues.map(v => ({
                venue: v,
                remaining: targetQuota
            }));

            const usedHODIds = new Set<string>();

            // Prioritization Stages
            // 0: Same State
            // 1: Same Zone (and not same state)
            // 2: Fallback (Random)

            for (let stage = 0; stage <= 2; stage++) {
                let madeProgress = true;
                while (madeProgress) {
                    madeProgress = false;
                    const shuffledVenues = shuffle([...venueNeeds]);

                    for (const vNeed of shuffledVenues) {
                        if (vNeed.remaining <= 0) continue;

                        const venueState = vNeed.venue.state_name;
                        const venueZone = vNeed.venue.zone;

                        // Filter compatible HODs
                        const compatibleHODs = eligibleHODs.filter(hod => {
                            if (usedHODIds.has(hod.id)) return false;

                            const hodStation = (hod.station || '').toLowerCase();
                            const hodZone = stationToZoneMap.get(hodStation);
                            const hodStateName = hodToStateMap.get(hod.id);

                            const isStateMatch = venueState && hodStateName === venueState;
                            const isZoneMatch = !isStateMatch && venueZone && hodZone === venueZone;

                            // Stage Logic
                            if (stage === 0) return isStateMatch;
                            if (stage === 1) return isZoneMatch;
                            if (stage === 2) return true; // Random fill
                            return false;
                        });

                        if (compatibleHODs.length > 0) {
                            // Pick one random HOD
                            const pickedHOD = shuffle(compatibleHODs)[0] as HODApcRecord;
                            usedHODIds.add(pickedHOD.id);

                            // Create Map for fast lookup
                            const postingMap = new Map<string, any>(existingPostings.map(p => [p.file_no, p]));
                            const existingRecord = postingMap.get(pickedHOD.file_no);

                            const currentCount = pickedHOD.count || 0;
                            const totalPostedSoFar = existingRecord?.assignments?.length || 0;
                            const newToBePosted = Math.max(0, currentCount - (totalPostedSoFar + 1));

                            const baseVenueName = `${vNeed.venue.code ? `(${vNeed.venue.code}) ` : ''}${vNeed.venue.name}`;
                            const venueState = (vNeed.venue.state_name || vNeed.venue.state || '').trim();
                            const finalVenue = (venueState && !baseVenueName.toLowerCase().includes(venueState.toLowerCase()))
                                ? `${baseVenueName} | ${venueState}`
                                : baseVenueName;
                            const newState = vNeed.venue.state_name || '';

                            // Merge with existing
                            const mergedAssignments = existingRecord?.assignments ? [...existingRecord.assignments] : [];
                            const mergedMandates = existingRecord?.mandates ? [...existingRecord.mandates] : [];
                            const mergedVenues = existingRecord?.assignment_venue ? [...existingRecord.assignment_venue] : [];
                            const mergedStates = existingRecord?.state ? [...existingRecord.state] : (existingRecord?.assignment_venue?.map((_: any) => '') || []);

                            mergedAssignments.push(assignmentCode);
                            mergedMandates.push(targetMandate);
                            mergedVenues.push(finalVenue);
                            mergedStates.push(newState);

                            newPostings.push({
                                file_no: pickedHOD.file_no,
                                name: pickedHOD.name,
                                station: pickedHOD.station || '',
                                conraiss: pickedHOD.conraiss || '',
                                year: new Date().getFullYear().toString(),
                                count: numberOfNights,
                                posted_for: mergedAssignments.length,
                                tree_node_id: null,
                                to_be_posted: newToBePosted,
                                assignments: mergedAssignments,
                                mandates: mergedMandates,
                                assignment_venue: mergedVenues,
                                state: mergedStates,
                                zone: vNeed.venue.zone,
                                description: description || null
                            } as any);

                            vNeed.remaining--;
                            madeProgress = true;
                            // Round robin - go to next venue
                        }
                    }
                }
            }

            setGeneratedPostings(newPostings);
            if (newPostings.length > 0) {
                setPreviewMode(true);
            } else {
                info('No HODs matched criteria or quotas already met.');
            }
            if (skippedDueToDuplicate > 0) {
                warning(`${skippedDueToDuplicate} HOD(s) were skipped because they are already posted for this Assignment.`);
            }
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
            await bulkCreateHODPostings({ items: postingsToSave });
            success(`Successfully posted ${postingsToSave.length} HODs!`);
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

    // --- PREVIEW MODE ---
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
                        <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                            {generatedPostings.map((p, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                    <td className="p-3 font-mono font-bold">{p.file_no}</td>
                                    <td className="p-3 font-medium">{p.name}</td>
                                    <td className="p-3 font-bold text-xs text-slate-500">{p.station || '-'}</td>
                                    <td className="p-3 font-bold">{p.conraiss}</td>
                                    <td className="p-3 text-purple-600 dark:text-purple-400 font-bold">{p.assignment_venue?.[0]}</td>
                                    <td className="p-3">{p.state || (p as any).state_name || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // --- MAIN RENDER ---
    return (
        <div className="flex-1 flex flex-col min-h-full bg-slate-50 dark:bg-[#0b1015] p-4 md:p-8 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400 drop-shadow-sm">
                    HOD Posting Generator
                </h1>
                <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">
                    Assign HODs to venues using random or personalized methods.
                </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-6 bg-white dark:bg-[#121b25] p-1 rounded-xl w-fit border border-slate-200 dark:border-gray-800">
                <button
                    onClick={() => setActiveTab('random')}
                    className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'random' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                    <span className="material-symbols-outlined text-lg mr-2 align-middle">shuffle</span>
                    Random
                </button>
                <button
                    onClick={() => setActiveTab('personalized')}
                    className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'personalized' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                    <span className="material-symbols-outlined text-lg mr-2 align-middle">upload_file</span>
                    Personalized (CSV)
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 max-w-5xl">
                {activeTab === 'random' && (
                    <div className="space-y-6">
                        {/* Selection Card */}
                        <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">1</span>
                                Select Criteria
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Assignment</label>
                                    <select
                                        className="w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700"
                                        value={selectedAssignment}
                                        onChange={e => { setSelectedAssignment(e.target.value); setSelectedMandate(''); }}
                                    >
                                        <option value="">Select Assignment</option>
                                        {assignments.filter(a => a.active).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Mandate</label>
                                    <select
                                        className="w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 disabled:opacity-50"
                                        value={selectedMandate}
                                        onChange={e => setSelectedMandate(e.target.value)}
                                        disabled={!selectedAssignment}
                                    >
                                        <option value="">Select Mandate</option>
                                        {mandates.filter(m => {
                                            if (!selectedAssignment) return false;
                                            const assignment = assignments.find(a => a.id === selectedAssignment);
                                            // Check if mandate code is in assignment's mandates array
                                            return assignment?.mandates?.includes(m.code);
                                        }).map(m => <option key={m.id} value={m.id}>{m.mandate}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-bold uppercase text-slate-500">Venue</label>
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-indigo-500 dark:text-indigo-400 animate-point text-lg">pan_tool_alt</span>
                                            <button
                                                onClick={() => setIsStationModalOpen(true)}
                                                className="pick-station-btn text-[10px] font-black text-white bg-indigo-600 dark:bg-indigo-500 px-3 py-1 rounded-lg shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 hover:bg-indigo-700 transition-all flex items-center gap-1"
                                            >
                                                <span className="material-symbols-outlined text-sm">hub</span>
                                                Pick Station
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 min-w-0">
                                        {/* Multi-Select Venue Dropdown */}
                                        <div ref={venueDropdownRef} className="relative flex-1 min-w-0">
                                            <button
                                                type="button"
                                                onClick={() => !isAllVenues && setShowVenueDropdown(!showVenueDropdown)}
                                                disabled={isAllVenues}
                                                className={`w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-left flex items-center justify-between ${isAllVenues ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-emerald-400'} text-slate-900 dark:text-white`}
                                            >
                                                <span className="truncate">
                                                    {isAllVenues
                                                        ? 'All Venues Selected'
                                                        : selectedVenues.length === 0
                                                            ? 'Select Venue(s)...'
                                                            : selectedVenues.length === 1
                                                                ? (() => {
                                                                    const venue = venues.find(v => v.id === selectedVenues[0]);
                                                                    return venue ? venue.name : '1 venue selected';
                                                                })()
                                                                : `${selectedVenues.length} venues selected`
                                                    }
                                                </span>
                                                <span className="material-symbols-outlined text-slate-400">
                                                    {showVenueDropdown ? 'expand_less' : 'expand_more'}
                                                </span>
                                            </button>

                                            {/* Dropdown Panel */}
                                            {showVenueDropdown && !isAllVenues && (
                                                <div className="absolute z-50 top-full left-0 mt-1 w-[400px] max-h-80 overflow-y-auto bg-white dark:bg-[#1a2533] border border-slate-200 dark:border-gray-700 rounded-xl shadow-xl">
                                                    {/* Quick Actions */}
                                                    <div className="sticky top-0 bg-white dark:bg-[#1a2533] p-2 border-b border-slate-100 dark:border-gray-700 flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedVenues(venues.map(v => v.id))}
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

                                                    {/* Grouped Venues */}
                                                    {(() => {
                                                        const grouped = venues.reduce((acc, venue) => {
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
                                                                    {/* State Header */}
                                                                    <div
                                                                        className="sticky top-[45px] px-3 py-2 bg-slate-100 dark:bg-[#0f161d] border-b border-slate-200 dark:border-gray-700 flex items-center gap-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800"
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

                                                                    {/* Venue Items */}
                                                                    {stateVenues.map(v => {
                                                                        const isSelected = selectedVenues.includes(v.id);
                                                                        return (
                                                                            <div
                                                                                key={v.id}
                                                                                onClick={() => {
                                                                                    if (isSelected) {
                                                                                        setSelectedVenues(prev => prev.filter(id => id !== v.id));
                                                                                    } else {
                                                                                        setSelectedVenues(prev => [...prev, v.id]);
                                                                                    }
                                                                                }}
                                                                                className={`px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isSelected}
                                                                                    onChange={() => { }}
                                                                                    className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                                                                                />
                                                                                <span className={`text-sm ${isSelected ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                                    {v.name}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            );
                                                        });
                                                    })()}

                                                    {/* Done Button */}
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

                                        {/* All Venues Checkbox */}
                                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 rounded-xl border border-slate-200 dark:border-gray-700">
                                            <input
                                                type="checkbox"
                                                id="allVenuesHOD"
                                                checked={isAllVenues}
                                                onChange={e => {
                                                    setIsAllVenues(e.target.checked);
                                                    if (e.target.checked) {
                                                        setSelectedVenues([]);
                                                        setShowVenueDropdown(false);
                                                    }
                                                }}
                                                className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                                            />
                                            <label htmlFor="allVenuesHOD" className="text-sm font-bold whitespace-nowrap cursor-pointer">All</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Config Card */}
                        <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">2</span>
                                Configuration
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Target per Venue</label>
                                    <input type="number" min="0" className="w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700" value={targetQuota || ''} onChange={e => setTargetQuota(parseInt(e.target.value) || 0)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Number of Nights</label>
                                    <input type="number" min="0" className="w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700" value={numberOfNights} onChange={e => setNumberOfNights(parseInt(e.target.value) || 0)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Description</label>
                                    <input type="text" className="w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional..." />
                                </div>
                            </div>
                        </div>

                        {/* Stats & Generate */}
                        <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500">Eligible HODs for selected assignment:</p>
                                <p className="text-3xl font-black text-emerald-600">{eligibleHODs.length}</p>
                            </div>
                            <button
                                onClick={generateRandomPostings}
                                disabled={loading || eligibleHODs.length === 0}
                                className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading && <span className="material-symbols-outlined animate-spin">progress_activity</span>}
                                Generate Postings
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'personalized' && (
                    <div className="flex-1 flex flex-col min-h-[600px] bg-white dark:bg-[#121b25] rounded-2xl border border-slate-200 dark:border-gray-800 overflow-hidden">
                        {/* Board Workspace Header */}
                        <header className="p-4 border-b border-slate-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-3 flex-1">
                                {/* Assignment Dropdown */}
                                <select
                                    className="h-10 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-sm font-medium min-w-[200px]"
                                    value={selectedAssignment}
                                    onChange={e => setSelectedAssignment(e.target.value)}
                                >
                                    <option value="">Select Assignment</option>
                                    {assignments.filter(a => a.active).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                                <div ref={personalizedStationDropdownRef} className="relative min-w-[240px]">
                                    <button
                                        type="button"
                                        onClick={() => setShowPersonalizedStationDropdown(!showPersonalizedStationDropdown)}
                                        className={`w-full h-10 px-4 rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold flex items-center justify-between cursor-pointer hover:border-indigo-400 outline-none transition-all`}
                                    >
                                        <span className="truncate">
                                            {selectedStationIdsPersonalized.length === 0
                                                ? 'Select Target Station(s)...'
                                                : selectedStationIdsPersonalized.length === 1
                                                    ? (() => {
                                                        const s = stationOptions.find(opt => opt.id === selectedStationIdsPersonalized[0]);
                                                        return s ? s.name : '1 station selected';
                                                    })()
                                                    : `${selectedStationIdsPersonalized.length} stations selected`
                                            }
                                        </span>
                                        <span className="material-symbols-outlined text-slate-400">
                                            {showPersonalizedStationDropdown ? 'expand_less' : 'expand_more'}
                                        </span>
                                    </button>

                                    {/* Dropdown Panel */}
                                    {showPersonalizedStationDropdown && (
                                        <div className="absolute z-50 top-full left-0 mt-2 w-[400px] max-h-80 overflow-y-auto bg-white dark:bg-[#1A2533] border border-slate-200 dark:border-gray-700 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                                            {/* Quick Actions */}
                                            <div className="sticky top-0 bg-white dark:bg-[#1A2533] p-3 border-b border-slate-100 dark:border-gray-800 flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedStationIdsPersonalized(stationOptions.map(v => v.id))}
                                                    className="flex-1 text-xs font-bold px-2 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                                                >
                                                    Select All
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedStationIdsPersonalized([])}
                                                    className="flex-1 text-xs font-bold px-2 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                >
                                                    Clear All
                                                </button>
                                            </div>

                                            {/* Grouped Stations */}
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
                                                            {/* Group Header */}
                                                            <div
                                                                className="sticky top-[53px] px-4 py-2.5 bg-slate-100 dark:bg-[#161F2F] border-b border-slate-200 dark:border-gray-800 flex items-center gap-3 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800/50 transition-colors"
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
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider font-mono">{group}</span>
                                                                    <span className="text-[10px] text-slate-500 font-bold">{groupOpts.length} items</span>
                                                                </div>
                                                            </div>

                                                            {/* Station Items */}
                                                            {groupOpts.map(v => {
                                                                const isSelected = selectedStationIdsPersonalized.includes(v.id);
                                                                return (
                                                                    <div
                                                                        key={v.id}
                                                                        onClick={() => {
                                                                            if (isSelected) {
                                                                                setSelectedStationIdsPersonalized(prev => prev.filter(id => id !== v.id));
                                                                            } else {
                                                                                setSelectedStationIdsPersonalized(prev => [...prev, v.id]);
                                                                            }
                                                                        }}
                                                                        className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-all ${isSelected ? 'bg-indigo-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isSelected}
                                                                            onChange={() => { }}
                                                                            className="w-4 h-4 text-indigo-600 rounded cursor-pointer accent-indigo-600"
                                                                        />
                                                                        <span className={`text-sm ${isSelected ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                            {v.name}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                });
                                            })()}

                                            {/* Done Button */}
                                            <div className="sticky bottom-0 bg-white dark:bg-[#1A2533] p-3 border-t border-slate-200 dark:border-gray-800">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPersonalizedStationDropdown(false)}
                                                    className="w-full text-sm font-black px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                                                >
                                                    Done ({selectedStationIdsPersonalized.length} selected)
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => setIsStationModalOpen(true)}
                                    className="h-10 px-4 flex items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all gap-2"
                                >
                                    <span className="material-symbols-outlined text-sm">hub</span>
                                    Pick Station
                                </button>
                                <input
                                    type="text"
                                    placeholder="Description..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="h-10 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium focus:border-indigo-500 outline-none transition-all flex-1"
                                />
                                <div className="flex flex-col">
                                    <input
                                        type="number"
                                        placeholder="Nights..."
                                        min="0"
                                        value={numberOfNights}
                                        onChange={(e) => setNumberOfNights(parseInt(e.target.value) || 0)}
                                        className="h-10 px-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium focus:border-indigo-500 outline-none transition-all w-20"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {selectedStaffIds.size > 0 && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{selectedStaffIds.size} Selected</span>
                                        <button onClick={() => setSelectedStaffIds(new Set())} className="text-[10px] font-bold text-slate-500 hover:text-rose-500 uppercase">Clear</button>
                                    </div>
                                )}
                                <button
                                    onClick={handleBoardSaveChanges}
                                    disabled={!hasUnsavedChanges || loading}
                                    className="h-10 px-6 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 disabled:grayscale disabled:opacity-50 transition-all flex items-center gap-2 whitespace-nowrap"
                                >
                                    {loading ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> : <span className="material-symbols-outlined text-sm">commit</span>}
                                    Commit Changes
                                </button>
                            </div>
                        </header>

                        {/* Board Content */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Pool Side */}
                            <aside className="w-80 border-r border-slate-100 dark:border-gray-800 flex flex-col bg-slate-50/50 dark:bg-[#0f161d]/50">
                                <div className="p-4 border-b border-white dark:border-gray-800">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Search pool..."
                                            value={poolSearch}
                                            onChange={(e) => setPoolSearch(e.target.value)}
                                            className="w-full h-9 pl-9 pr-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-gray-700 rounded-lg text-xs font-medium outline-none focus:ring-2 ring-indigo-500/20"
                                        />
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">person_search</span>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <MandateColumn
                                        columnId="unassigned"
                                        title="Eligible Pool"
                                        staffList={filteredPool}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={handleDrop}
                                        selectedStaffIds={selectedStaffIds}
                                        onToggleSelect={onToggleSelect}
                                    />
                                </div>
                            </aside>

                            {/* Columns Side */}
                            <section className="flex-1 flex flex-col overflow-hidden">
                                <div className="h-12 px-6 flex items-center justify-between border-b border-slate-100 dark:border-gray-800 bg-white/50 dark:bg-transparent">
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Filter board..."
                                                value={boardSearch}
                                                onChange={(e) => setBoardSearch(e.target.value)}
                                                className="h-8 pl-6 bg-transparent border-none text-xs font-bold outline-none placeholder:text-slate-300 w-48"
                                            />
                                            <span className="material-symbols-outlined absolute left-0 top-1/2 -translate-y-1/2 text-slate-300 text-sm">search</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button onClick={downloadCsvTemplate} className="text-[10px] font-black uppercase text-slate-400 hover:text-indigo-500 transition-colors flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm">download</span> Template
                                        </button>
                                        <button onClick={() => setIsCsvModalOpen(true)} className="text-[10px] font-black uppercase text-slate-400 hover:text-indigo-500 transition-colors flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm">cloud_upload</span> Import CSV
                                        </button>
                                        <div className="w-[1px] h-3 bg-slate-200 dark:bg-slate-800"></div>
                                        <button onClick={() => setShowHelp(true)} className="text-[10px] font-black uppercase text-slate-400 hover:text-indigo-500 transition-colors flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm">help</span> Help
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-x-auto custom-scrollbar p-6">
                                    <div className="flex gap-4 h-full min-w-max">
                                        {!selectedAssignment ? (
                                            <div className="flex-1 flex flex-col items-center justify-center opacity-30 gap-4 grayscale h-full w-full">
                                                <span className="material-symbols-outlined text-6xl">dashboard_customize</span>
                                                <p className="text-xs font-black uppercase tracking-widest italic">Choose an assignment to initialize board</p>
                                            </div>
                                        ) : loading && !boardData ? (
                                            <div className="flex-1 flex flex-col items-center justify-center gap-4 h-full w-full">
                                                <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest animate-pulse">Loading Workspace</p>
                                            </div>
                                        ) : (
                                            filteredBoard.map((col, idx) => (
                                                <div key={col.id} className="w-[300px] flex flex-col relative h-full">
                                                    <MandateColumn
                                                        columnId={col.id}
                                                        title={col.title}
                                                        subtitle={col.code}
                                                        staffList={col.staff}
                                                        onDragOver={(e) => e.preventDefault()}
                                                        onDrop={handleDrop}
                                                        colorTheme={['emerald', 'blue', 'purple', 'amber'][idx % 4] as any}
                                                        isDropTarget={true}
                                                        selectedStaffIds={selectedStaffIds}
                                                        onToggleSelect={onToggleSelect}
                                                    />
                                                    {selectedStaffIds.size > 0 && (
                                                        <button
                                                            onClick={() => handleBulkMove(col.id)}
                                                            className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-full shadow-lg border-2 border-white dark:border-slate-900 z-20 hover:scale-110 active:scale-95 transition-all animate-bounce"
                                                        >
                                                            MOVE {selectedStaffIds.size} TO THIS
                                                        </button>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <StationTypeSelectionModal isOpen={isStationModalOpen} onClose={() => setIsStationModalOpen(false)} onSelect={handleStationTypeSelect} />
            <AlertModal isOpen={alertModal.isOpen} onClose={() => setAlertModal({ ...alertModal, isOpen: false })} title={alertModal.title} message={alertModal.message} type={alertModal.type} />
            <CsvUploadModal
                isOpen={isCsvModalOpen}
                onClose={() => setIsCsvModalOpen(false)}
                staffPool={boardData ? [
                    ...boardData.unassignedStaff,
                    ...boardData.mandateColumns.flatMap(c => c.staff)
                ] : []}
                onUpload={(csvData) => {
                    if (!boardData) return;

                    let successCount = 0;
                    let errorCount = 0;
                    const errorDetails: string[] = [];
                    const notFoundStaffNos: string[] = [];

                    // 1. Create maps for faster lookup
                    const staffMap = new Map<string, StaffMandateAssignment>();
                    [...boardData.unassignedStaff, ...boardData.mandateColumns.flatMap(c => c.staff)].forEach(s => {
                        staffMap.set(s.staff_no.toString().padStart(4, '0'), s);
                    });

                    const mandateMap = new Map<string, string>(); // code or title -> id
                    boardData.mandateColumns.forEach(c => {
                        mandateMap.set(c.code.toLowerCase(), c.id);
                        mandateMap.set(c.title.toLowerCase(), c.id);
                    });

                    // 2. Process records
                    csvData.forEach(record => {
                        const staffNo = record.staffNo.toString().padStart(4, '0');
                        const staff = staffMap.get(staffNo);
                        const targetMandateId = record.mandateCode ? mandateMap.get(record.mandateCode.toLowerCase()) : null;

                        if (!staff) {
                            errorCount++;
                            notFoundStaffNos.push(staffNo);
                            return;
                        }

                        if (!targetMandateId) {
                            errorCount++;
                            errorDetails.push(`• Mandate ${record.mandateCode || 'NOT SPECIFIED'} not found on the board.`);
                            return;
                        }

                        if (staff.mandate_id === targetMandateId) return;

                        const moved = handleLocalMove(staff, targetMandateId);
                        if (moved) successCount++;
                        else errorCount++;
                    });

                    if (notFoundStaffNos.length > 0) {
                        errorDetails.unshift(`File Nos: ${notFoundStaffNos.join(', ')} are not in the eligible pool of staff for this assignment/mandate`);
                    }

                    if (successCount > 0) {
                        const msg = `Successfully assigned ${successCount} staff members. Review and click "Commit Changes" to save.`;
                        if (errorCount === 0) {
                            success(msg);
                        } else {
                            warning(`${msg}\n\n${errorDetails.join('\n')}`);
                        }
                    } else if (errorCount > 0) {
                        error(errorDetails.join('\n'));
                    }
                }}
            />
            <HelpModal
                isOpen={showHelp}
                onClose={() => setShowHelp(false)}
                helpData={helpContent.personalizedPost}
            />

            {loading && <div className="fixed inset-0 bg-white/10 dark:bg-black/10 backdrop-blur-[1px] z-50 pointer-events-none"></div>}
        </div>
    );
};

export default HODPostings;
