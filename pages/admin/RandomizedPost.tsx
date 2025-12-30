import React, { useState, useEffect, useMemo } from 'react';
import { getAllAPCRecords, updateAPC } from '../../services/apc';
import { getAllAssignments } from '../../services/assignment';
import { getAllMandates } from '../../services/mandate';
import { getAllMarkingVenues } from '../../services/markingVenue';
import { bulkCreatePostings, getAllPostingRecords } from '../../services/posting';
import { APCRecord } from '../../types/apc';
import { Assignment } from '../../types/assignment';
import { Mandate } from '../../types/mandate';
import { PostingCreate } from '../../types/posting';
import { assignmentFieldMap } from '../../services/personalizedPost';
import StationTypeSelectionModal from '../../components/StationTypeSelectionModal';
import { getAllSchools } from '../../services/school';
import { PostingResponse } from '../../types/posting';
import { getAllNCEECenters } from '../../services/nceeCenter';
import { getAllBECECustodians, getAllSSCECustodians } from '../../services/custodianSpecific';
import { getAllStates } from '../../services/state';
import { getAllTTCenters } from '../../services/ttCenter';
import { getAllStations } from '../../services/station';
import { Station } from '../../types/station';
import { State } from '../../types/state';
import { useNotification } from '../../context/NotificationContext';

const RandomizedPost: React.FC = () => {
    // Notifications
    const { success, error, warning, info } = useNotification();

    // Data States
    const [allAPC, setAllAPC] = useState<APCRecord[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [mandates, setMandates] = useState<Mandate[]>([]);
    const [existingPostings, setExistingPostings] = useState<PostingResponse[]>([]);
    const [allStations, setAllStations] = useState<Station[]>([]);
    const [allStates, setAllStates] = useState<State[]>([]);
    // Using simple object structure for flexible station types
    const [venues, setVenues] = useState<{ id: string, name: string, type: string, state_name?: string, zone?: string }[]>([]);
    const [loading, setLoading] = useState(false);

    // Selections
    const [selectedAssignment, setSelectedAssignment] = useState<string>('');
    const [selectedMandate, setSelectedMandate] = useState<string>('');
    const [selectedVenue, setSelectedVenue] = useState<string>(''); // '' means none selected, 'all' means all venues
    const [isAllVenues, setIsAllVenues] = useState(false);

    // Modals
    const [isStationModalOpen, setIsStationModalOpen] = useState(false);

    // Config: CONRAISS 6-15
    const [targetQuota, setTargetQuota] = useState<number>(0);
    const [conraissConfig, setConraissConfig] = useState<{ [key: number]: number }>({
        6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0
    });
    // Distribution Percentages (0-100)
    const [distRatios, setDistRatios] = useState({ state: 60, zone: 20, hq: 20 });
    const [numberOfNights, setNumberOfNights] = useState<number>(0);
    const [description, setDescription] = useState<string>(''); // Added Description State

    // Generated Preview
    const [generatedPostings, setGeneratedPostings] = useState<PostingCreate[]>([]);
    const [previewMode, setPreviewMode] = useState(false);

    // Memoized Eligible Staff Count and Breakdown for Selected Assignment
    const eligibleStaffData = useMemo(() => {
        if (!selectedAssignment || allAPC.length === 0) return { total: 0, breakdown: {} };

        const assignmentRecord = assignments.find(a => a.id === selectedAssignment);
        if (!assignmentRecord) return { total: 0, breakdown: {} };

        const assignmentName = assignmentRecord.name;
        const assignmentCode = assignmentRecord.code;
        const apcField = assignmentFieldMap[assignmentCode] || assignmentFieldMap[assignmentName];

        if (!apcField) return { total: 0, breakdown: {} };

        // Pre-calculate posted counts
        const postedCountMap = new Map<string, number>();
        existingPostings.forEach(p => {
            const count = (p.assignments || []).length;
            postedCountMap.set(p.file_no, (postedCountMap.get(p.file_no) || 0) + count);
        });

        const breakdown: { [key: number]: number } = {
            6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0
        };
        let total = 0;

        allAPC.forEach(staff => {
            if (!staff.active) return;

            // Capacity Check
            const totalPosted = postedCountMap.get(staff.file_no) || 0;
            const totalAllotted = staff.count || 0;
            if (totalPosted >= totalAllotted) return;

            const val = staff[apcField as keyof APCRecord];
            if (!!val) {
                total++;
                const lvl = parseInt(staff.conraiss || '0');
                if (breakdown[lvl] !== undefined) {
                    breakdown[lvl]++;
                }
            }
        });

        return { total, breakdown };
    }, [selectedAssignment, allAPC, assignments, existingPostings]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [apcData, assignmentsData, mandatesData, venuesData, postingsData, stationsData, statesData] = await Promise.all([
                getAllAPCRecords(true),
                getAllAssignments(true),
                getAllMandates(true),
                getAllMarkingVenues(true),
                getAllPostingRecords(),
                getAllStations(true),
                getAllStates()
            ]);
            setAllAPC(apcData);
            setAssignments(assignmentsData);
            setMandates(mandatesData);
            setExistingPostings(postingsData || []); // Ensure safe fallback
            setAllStations(stationsData);
            setAllStates(statesData);

            const stateMap = new Map<string, State>(statesData.map(s => [s.id, s]));
            const stateNameMap = new Map<string, State>(statesData.map(s => [s.name.toLowerCase(), s]));

            // Default to Marking Venues
            setVenues(venuesData.map(v => {
                const state = stateNameMap.get((v.state || '').toLowerCase());
                return {
                    id: v.id,
                    name: v.name,
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
                options = states.map(s => ({
                    id: s.id,
                    name: s.name,
                    type: 'state',
                    state_name: s.name,
                    zone: s.zone || undefined
                }));
            } else {
                const [statesData, specificData] = await Promise.all([
                    getAllStates(),
                    type === 'school' ? getAllSchools(true) :
                        type === 'bece_custodian' ? getAllBECECustodians(true) :
                            type === 'ssce_custodian' ? getAllSSCECustodians(true) :
                                type === 'ncee_center' ? getAllNCEECenters(true) :
                                    type === 'tt_center' ? getAllTTCenters(true) :
                                        getAllMarkingVenues(true)
                ]);

                const stateMap = new Map<string, State>(statesData.map(s => [s.id, s]));
                const stateNameMap = new Map<string, State>(statesData.map(s => [s.name.toLowerCase(), s]));

                options = specificData.map((s: any) => {
                    let stateObj: State | undefined;
                    if (s.state_id) stateObj = stateMap.get(s.state_id);
                    else if (s.state) stateObj = stateNameMap.get(s.state.toLowerCase());

                    const stateName = stateObj?.name || s.state || '';
                    const code = s.code || s.state_code || s.sch_no || '';

                    // Value format: (CODE) | NAME | STATE
                    const parts = [];
                    parts.push(code ? `(${code})` : '');
                    parts.push(s.name || s.sch_name);
                    parts.push(stateName);

                    // Display format: NAME
                    const displayParts = [];
                    displayParts.push(s.name || s.sch_name);

                    return {
                        id: s.id,
                        name: parts.join(' | '),
                        display_name: displayParts.join(' - '),
                        type: type,
                        state_name: stateName,
                        zone: stateObj?.zone || undefined
                    };
                });
            }

            setVenues(options);
            setSelectedVenue('');
            setIsAllVenues(false);

            success(`Loaded ${options.length} stations.`);
        } catch (err) {
            console.error('Failed to load stations', err);
            error('Failed to load stations');
        } finally {
            setLoading(false);
        }
    };

    const handleConfigChange = (level: number, value: string) => {
        const numVal = parseInt(value) || 0;
        setConraissConfig(prev => ({ ...prev, [level]: numVal }));
    };



    const generatePostings = async () => {
        if (!selectedAssignment || !selectedMandate) {
            warning('Please select an Assignment and Mandate.');
            return;
        }

        if (!selectedVenue && !isAllVenues) {
            warning('Please select a Venue or check "All Venues".');
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
            const assignmentName = assignmentRecord?.name || selectedAssignment;
            const assignmentCode = assignmentRecord?.code || selectedAssignment;
            const apcField = assignmentFieldMap[assignmentCode] || assignmentFieldMap[assignmentName];

            // 1. Existing Assignments Lookup (duplicate prevention)
            const targetMandate = mandates.find(m => m.id === selectedMandate)?.mandate || selectedMandate;
            const alreadyAssignedStaffIds = new Set<string>();

            // 1.5 Calculate Global Posted Counts & Check specific duplication
            const postedCountMap = new Map<string, number>();
            existingPostings.forEach(p => {
                const count = (p.assignments || []).length;
                postedCountMap.set(p.file_no, (postedCountMap.get(p.file_no) || 0) + count);

                if (Array.isArray(p.mandates) && p.mandates.some(m => m === targetMandate)) {
                    alreadyAssignedStaffIds.add(p.file_no);
                }
            });

            // 2. Filter Eligible Staff (Strict check on Global Quota)
            const eligibleStaff = allAPC.filter(staff => {
                if (!staff.active) return false;
                if (alreadyAssignedStaffIds.has(staff.file_no)) return false;

                // Capacity Check
                const totalPosted = postedCountMap.get(staff.file_no) || 0;
                const totalAllotted = staff.count || 0;
                if (totalPosted >= totalAllotted) return false; // Exhausted

                if (apcField) {
                    const val = staff[apcField as keyof APCRecord];
                    return !!val;
                }
                return true;
            });

            // 3. Group Staff by Level
            const staffByLevel: { [key: number]: APCRecord[] } = {};
            eligibleStaff.forEach(s => {
                const lvl = parseInt(s.conraiss || '0');
                if (!isNaN(lvl)) {
                    if (!staffByLevel[lvl]) staffByLevel[lvl] = [];
                    staffByLevel[lvl].push(s);
                }
            });

            // Pre-process staff zones and states for prioritization
            const stationToZoneMap = new Map(allStations.map(s => [s.station, s.zone]));
            const staffToStateMap = new Map<string, string>(); // staff_id -> state_name

            allAPC.forEach(staff => {
                const station = (staff.station || '').toLowerCase();
                // Find the first state name that appears in the station string
                const matchedState = allStates.find(s => station.includes(s.name.toLowerCase()));
                if (matchedState) {
                    staffToStateMap.set(staff.id, matchedState.name);
                }
            });

            // Shuffle pools
            const shuffle = <T,>(array: T[]): T[] => {
                const arr = [...array];
                for (let i = arr.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                }
                return arr;
            };

            // 4. PREPARE VENUE STATES & QUOTAS
            const targetVenues = isAllVenues ? venues : venues.filter(v => v.id === selectedVenue);

            interface VenueQuota {
                venue: typeof targetVenues[0];
                cleanName: string;
                zone?: string;
                remainingNeeded: number;
                usedLevels: number[];
                // Specific layer quotas
                stateQuota: number;
                zoneQuota: number;
                hqQuota: number;
                // Layer pick counters
                statePicks: number;
                zonePicks: number;
                hqPicks: number;
            }

            const sumOfLevelQuotas = (Object.values(conraissConfig) as number[]).reduce((a: number, b: number) => a + (Number(b) || 0), 0);

            const venueQuotas: VenueQuota[] = targetVenues.map(venue => {
                const venueZone = venue.zone;
                const venueState = venue.state_name;
                const venueName = venue.name;
                const cleanVenueName = venue.type === 'state' ? venueState : venueName.split(' | ')[1] || venueName;

                let venueExistingTotal = 0;
                const venueExistingLevels: { [key: number]: number } = {};

                existingPostings.forEach(p => {
                    // Check both code and name since postings might be saved with either
                    const matchesAssignment = Array.isArray(p.assignments) &&
                        (p.assignments.includes(assignmentName) || p.assignments.includes(assignmentCode));
                    const matchesMandate = Array.isArray(p.mandates) && p.mandates.includes(targetMandate);
                    const matchesVenue = Array.isArray(p.assignment_venue) && p.assignment_venue.includes(venue.name);

                    if (matchesAssignment && matchesMandate && matchesVenue) {
                        venueExistingTotal++;
                        if (p.conraiss) {
                            const lvl = parseInt(p.conraiss);
                            if (!isNaN(lvl)) venueExistingLevels[lvl] = (venueExistingLevels[lvl] || 0) + 1;
                        }
                    }
                });

                const effectiveTarget = targetQuota;
                const remainingNeeded = Math.max(0, effectiveTarget - venueExistingTotal);

                // Calculate layer quotas using Math.round for better behavior with small targets (e.g. 50/50 of 2 = 1 and 1)
                const stateQuotaStr = (effectiveTarget * (distRatios.state / 100)).toFixed(2);
                const zoneQuotaStr = (effectiveTarget * (distRatios.zone / 100)).toFixed(2);

                const stateQuota = Math.round(parseFloat(stateQuotaStr));
                const zoneQuota = Math.round(parseFloat(zoneQuotaStr));
                // HQ takes the remainder to ensure we hit the exact target
                const hqQuota = Math.max(0, effectiveTarget - stateQuota - zoneQuota);

                return {
                    venue,
                    cleanName: cleanVenueName || '',
                    zone: venueZone,
                    remainingNeeded,
                    usedLevels: [],
                    stateQuota,
                    zoneQuota,
                    hqQuota,
                    statePicks: 0,
                    zonePicks: 0,
                    hqPicks: 0
                };
            }).filter(vq => vq.remainingNeeded > 0);

            const allPossibleLevels = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
            const activeLevels = allPossibleLevels.filter(lvl => conraissConfig[lvl] > 0);

            // We need at least one level to calculate, but if sumOfLevelQuotas < targetQuota, we use all levels
            const searchLevels = sumOfLevelQuotas < targetQuota ? allPossibleLevels : activeLevels;

            if (searchLevels.length === 0) {
                warning('Please select at least one CONRAISS level.');
                setLoading(false);
                return;
            }

            const usedStaffIds = new Set<string>();
            const newPostings: PostingCreate[] = [];

            /**
             * PRIORITY STAGES (0-7):
             * 0: Primary State (Mandatory levels only)
             * 1: Primary Zone (Mandatory levels only)
             * 2: Primary HQ (Mandatory levels only)
             * 3: Fallback State (Mandatory levels only)
             * 4: Fallback Zone (Mandatory levels only)
             * 5: Fallback HQ (Mandatory levels only)
             * 6: Mandatory Anyone (Try to hit minimums if geo failed)
             * 7: Random Fill (Fill remaining targetQuota from ANY level)
             */
            for (let stage = 0; stage <= 7; stage++) {
                let madeProgressInStage = true;

                while (madeProgressInStage) {
                    madeProgressInStage = false;
                    const localVenueOrder = shuffle([...venueQuotas]);

                    for (const vq of localVenueOrder) {
                        if (vq.remainingNeeded <= 0) continue;

                        // Check if we already filled the quota for specific primary stages
                        if (stage === 0 && vq.statePicks >= vq.stateQuota) continue;
                        if (stage === 1 && vq.zonePicks >= vq.zoneQuota) continue;
                        if (stage === 2 && vq.hqPicks >= vq.hqQuota) continue;

                        const availableLevels = shuffle([...allPossibleLevels]);
                        const levelOrder = availableLevels.sort((a, b) => {
                            const countA = vq.usedLevels.filter(l => l === a).length;
                            const countB = vq.usedLevels.filter(l => l === b).length;
                            return countA - countB;
                        });

                        for (const level of levelOrder) {
                            // Per-level limit check if sub-quotas are set
                            const levelLimit = conraissConfig[level] || 0;
                            const levelUsed = vq.usedLevels.filter(l => l === level).length;

                            // For stages 0-6, we are specifically trying to satisfy the per-level mandatory minimums
                            if (stage <= 6) {
                                if (levelLimit === 0 || levelUsed >= levelLimit) continue;
                            }
                            // Stage 7 fills ANY level up to targetQuota (remainingNeeded)

                            const pool = staffByLevel[level] || [];
                            const priorityMatches = pool.filter(staff => {
                                if (usedStaffIds.has(staff.id)) return false;

                                const staffStation = staff.station || '';
                                const staffZone = stationToZoneMap.get(staffStation);
                                const staffStateName = staffToStateMap.get(staff.id);

                                // Category determination (staff-centric)
                                const isStateStaff = vq.venue.state_name && staffStateName === vq.venue.state_name;
                                const isZoneStaff = !isStateStaff && vq.zone && staffZone === vq.zone;
                                const isHQStaff = !isStateStaff && !isZoneStaff && (staffStation.toUpperCase().includes('HQ') || !staffZone || staffZone === 'HQ');

                                // Stage Filter
                                if (stage === 0) return isStateStaff;
                                if (stage === 1) return isZoneStaff;
                                if (stage === 2) return isHQStaff;
                                if (stage === 3) return isStateStaff;
                                if (stage === 4) return isZoneStaff;
                                if (stage === 5) return isHQStaff;
                                if (stage === 6) return true; // Mandatory Anyone
                                return true; // Stage 7: Random Fill (Anyone)
                            });

                            if (priorityMatches.length > 0) {
                                const staff = shuffle(priorityMatches)[0];
                                usedStaffIds.add(staff.id);

                                const currentCount = staff.count || 0;
                                const totalPostedSoFar = postedCountMap.get(staff.file_no) || 0;
                                const newToBePosted = Math.max(0, currentCount - (totalPostedSoFar + 1));

                                newPostings.push({
                                    file_no: staff.file_no,
                                    name: staff.name,
                                    station: staff.station,
                                    conraiss: staff.conraiss,
                                    year: new Date().getFullYear().toString(),
                                    count: numberOfNights,
                                    posted_for: 1,
                                    to_be_posted: newToBePosted,
                                    assignments: [assignmentCode],
                                    mandates: [targetMandate],
                                    assignment_venue: [vq.venue.name],
                                    state_name: vq.venue.state_name,
                                    zone: vq.venue.zone,
                                    description: description || null // Include description
                                } as any);

                                // Accounting for picks (geographic categories)
                                const staffStation = staff.station || '';
                                const staffZone = stationToZoneMap.get(staffStation);
                                const staffStateName = staffToStateMap.get(staff.id);

                                const isActuallyState = vq.venue.state_name && staffStateName === vq.venue.state_name;
                                const isActuallyZone = !isActuallyState && vq.zone && staffZone === vq.zone;

                                if (isActuallyState) vq.statePicks++;
                                else if (isActuallyZone) vq.zonePicks++;
                                else vq.hqPicks++;

                                vq.usedLevels.push(level);
                                vq.remainingNeeded--;
                                madeProgressInStage = true;
                                break; // Round-robin: move to next venue
                            }
                        }
                    }
                }
            }

            setGeneratedPostings(newPostings);
            setLoading(false);

            if (newPostings.length > 0) {
                setPreviewMode(true);
            } else {
                info('No staff matched criteria or quotas already met.');
            }

        } catch (err) {
            console.error("Error generating postings", err);
            setLoading(false);
            error('An error occurred during generation.');
        }
    };

    const refreshPostings = async () => {
        try {
            const data = await getAllPostingRecords();
            setExistingPostings(data);
        } catch (err) {
            console.error("Failed to refresh postings", err);
        }
    };

    const handleSave = async () => {
        if (generatedPostings.length === 0) return;
        setLoading(true);
        try {
            // 1. Identify APC Field
            const assignmentRecord = assignments.find(a => a.id === selectedAssignment);
            const assignmentCode = assignmentRecord?.code || '';
            const assignmentName = assignmentRecord?.name || '';
            const apcField = assignmentFieldMap[assignmentCode] || assignmentFieldMap[assignmentName];

            if (apcField) {
                // 2. Prepare APC Updates
                const updates = [];
                const apcMap = new Map(allAPC.map(a => [a.file_no.toString().padStart(4, '0'), a]));

                for (const posting of generatedPostings) {
                    const normFileNo = posting.file_no.toString().padStart(4, '0');
                    const apcRecord = apcMap.get(normFileNo) as any;

                    if (apcRecord && apcRecord.id) {
                        const { id, created_at, updated_at, created_by, updated_by, ...cleanRecord } = apcRecord;
                        updates.push(updateAPC(id, {
                            ...cleanRecord,
                            [apcField]: '', // Clear the assignment field
                        } as any));
                    }
                }

                if (updates.length > 0) {
                    await Promise.allSettled(updates);
                }
            }

            // 3. Create Postings
            await bulkCreatePostings({ items: generatedPostings });
            success(`Successfully posted ${generatedPostings.length} staff!`);
            setGeneratedPostings([]);
            setPreviewMode(false);
            refreshPostings(); // Update local cache of postings
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
                        <button onClick={() => setPreviewMode(false)} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold">Back to Config</button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                                    Processing...
                                </>
                            ) : (
                                "Confirm & Post"
                            )}
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#121b25] rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[600px]">
                    <div className="overflow-x-auto overflow-y-auto flex-1">
                        <table className="w-full text-left border-collapse relative">
                            <thead className="bg-slate-50 dark:bg-[#0f161d] text-sm uppercase font-bold text-slate-500 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-3">File No</th>
                                    <th className="p-3">Name</th>
                                    <th className="p-3">CON</th>
                                    <th className="p-3">Station</th>
                                    <th className="p-3">Venue</th>
                                    <th className="p-3">State</th>
                                    <th className="p-3">Zone</th>
                                    <th className="p-3">Nights</th>
                                    <th className="p-3">Description</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-gray-800 text-base">
                                {generatedPostings.map((p, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                        <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300 text-sm">{p.file_no}</td>
                                        <td className="p-3 font-medium text-slate-800 dark:text-slate-100">{p.name}</td>
                                        <td className="p-3 font-bold">{p.conraiss}</td>
                                        <td className="p-3 text-sm">{p.station}</td>
                                        <td className="p-3 font-bold text-purple-600 dark:text-purple-400 text-sm">{p.assignment_venue?.[0]}</td>
                                        <td className="p-3 text-sm">{(p as any).state_name || '-'}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${(p as any).zone ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                {(p as any).zone || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="p-3 font-bold text-slate-600 dark:text-slate-400">{p.count || 0}</td>
                                        <td className="p-3 text-sm italic text-slate-500 max-w-[150px] truncate">{(p as any).description || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-full bg-slate-50 dark:bg-[#0b1015] p-4 md:p-8 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400 drop-shadow-sm">
                    Randomized Post Generator
                </h1>
                <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">
                    Configure quotas and randomly assign staff to venues.
                </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto items-start">
                <div className="flex flex-col gap-6 flex-1 w-full lg:max-w-4xl">
                    {/* 1. Selection Card */}
                    <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">1</span>
                            Select Criteria
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Assignment</label>
                                <select
                                    className="w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white"
                                    value={selectedAssignment}
                                    onChange={e => {
                                        setSelectedAssignment(e.target.value);
                                        setSelectedMandate(''); // Reset mandate on assignment change
                                    }}
                                >
                                    <option value="">Select Assignment</option>
                                    {assignments
                                        .filter(a => a.active)
                                        .map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Mandate</label>
                                <select
                                    className="w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white"
                                    value={selectedMandate}
                                    onChange={e => setSelectedMandate(e.target.value)}
                                    disabled={!selectedAssignment}
                                >
                                    <option value="">Select Mandate</option>
                                    {mandates
                                        .filter(m => {
                                            if (!selectedAssignment) return false;
                                            const assignment = assignments.find(a => a.id === selectedAssignment);
                                            if (!assignment || !Array.isArray(assignment.mandates)) return false;
                                            return assignment.mandates.includes(m.code);
                                        })
                                        .map(m => <option key={m.id} value={m.mandate}>{m.mandate}</option>)}
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
                                    <select
                                        className="flex-1 w-full min-w-0 h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 disabled:opacity-50 text-ellipsis text-slate-900 dark:text-white"
                                        value={selectedVenue}
                                        onChange={e => setSelectedVenue(e.target.value)}
                                        disabled={isAllVenues}
                                    >
                                        <option value="">Select Venue</option>
                                        {venues.map(v => <option key={v.id} value={v.id}>{v.display_name || v.name}</option>)}
                                    </select>
                                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 rounded-xl border border-slate-200 dark:border-gray-700">
                                        <input
                                            type="checkbox"
                                            id="allVenues"
                                            checked={isAllVenues}
                                            onChange={e => {
                                                setIsAllVenues(e.target.checked);
                                                if (e.target.checked) setSelectedVenue('');
                                            }}
                                            className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                                        />
                                        <label htmlFor="allVenues" className="text-sm font-bold whitespace-nowrap cursor-pointer">All</label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Configuration Card */}
                    <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">2</span>
                                Staff Quota (Per Venue)
                            </h3>
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col items-end">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Target</label>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="Total"
                                        className="w-20 h-9 px-2 text-center text-sm font-bold rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d]"
                                        value={targetQuota || ''}
                                        onChange={e => setTargetQuota(parseInt(e.target.value) || 0)}
                                    />
                                </div>

                                <div className="h-10 w-[1px] bg-slate-200 dark:bg-gray-800 mx-2" />

                                <div className="flex items-center gap-3">
                                    {[
                                        { label: 'State', key: 'state' },
                                        { label: 'Zone', key: 'zone' },
                                        { label: 'HQ', key: 'hq' }
                                    ].map(({ label, key }) => (
                                        <div key={key} className="flex flex-col items-center">
                                            <label className="text-[10px] uppercase font-bold text-slate-400">{label}%</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                className="w-16 h-9 px-1 text-center text-sm font-bold rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d]"
                                                value={distRatios[key as keyof typeof distRatios]}
                                                onChange={e => {
                                                    const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                                    setDistRatios(prev => ({ ...prev, [key]: val }));
                                                }}
                                            />
                                        </div>
                                    ))}
                                    <div className="flex flex-col items-center pl-2 border-l border-slate-200 dark:border-gray-800">
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Total</label>
                                        <span className={`text-sm font-bold ${distRatios.state + distRatios.zone + distRatios.hq === 100 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                            {distRatios.state + distRatios.zone + distRatios.hq}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-5 md:grid-cols-10 gap-x-4 gap-y-4">
                            {[6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(level => (
                                <div key={level} className="flex flex-col gap-1">
                                    <label className="text-[10px] uppercase font-bold text-center text-slate-400">CON {level}</label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full h-12 text-center text-lg font-bold rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                        value={conraissConfig[level]}
                                        onChange={e => handleConfigChange(level, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={generatePostings}
                        disabled={loading}
                        className="h-14 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-lg font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                        {loading ? (
                            <>
                                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                Processing...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-2xl">autorenew</span>
                                Generate Randomized List
                            </>
                        )}
                    </button>
                    {/* Assignment Specific configurations (like Number of Nights) */}
                    {selectedAssignment && (
                        <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 mt-4">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Number of Nights</label>
                            <input
                                type="number"
                                min="0"
                                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-medium text-sm"
                                value={numberOfNights}
                                onChange={(e) => setNumberOfNights(parseInt(e.target.value) || 0)}
                                placeholder="Enter number of nights..."
                            />
                        </div>
                    )}

                    {/* Description Input */}
                    <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 mt-4">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Description</label>
                        <input
                            type="text"
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-medium text-sm"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Enter description..."
                        />
                    </div>
                </div>

                {/* 3. Eligibility Breakdown Sidebar */}
                {selectedAssignment && (
                    <div className="w-full lg:w-72 flex-shrink-0 sticky top-8">
                        <div className="bg-white dark:bg-[#121b25] p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                                    <span className="material-symbols-outlined text-xl">analytics</span>
                                    Eligibility Breakdown
                                </h3>
                                <button
                                    onClick={() => fetchInitialData()}
                                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-colors"
                                    title="Refresh eligible staff data"
                                    disabled={loading}
                                >
                                    <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
                                </button>
                            </div>

                            <div className="space-y-2">
                                {Object.entries(eligibleStaffData.breakdown).reverse().map(([level, count]) => (
                                    <div key={level} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-[#0f161d] border border-slate-100 dark:border-gray-800 hover:border-indigo-200 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] uppercase font-black text-slate-400">CON</span>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{level}</span>
                                        </div>
                                        <span className={`text-sm font-black ${Number(count) > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-700'}`}>
                                            {count as number}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-gray-800 flex items-center justify-between px-2">
                                <span className="text-xs font-bold text-slate-500 uppercase">Total Eligible</span>
                                <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{eligibleStaffData.total}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <StationTypeSelectionModal
                isOpen={isStationModalOpen}
                onClose={() => setIsStationModalOpen(false)}
                onSelect={handleStationTypeSelect}
            />
        </div>
    );
};

export default RandomizedPost;
