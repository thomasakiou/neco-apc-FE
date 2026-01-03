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
import HelpModal from '../../components/HelpModal';
import { helpContent } from '../../data/helpContent';
import { getAllStaff } from '../../services/staff';

// Utility for robust string matching
const normalizeStr = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

const stateToZoneFallback: { [key: string]: string } = {
    'abia': 'South East', 'anambra': 'South East', 'ebonyi': 'South East', 'enugu': 'South East', 'imo': 'South East',
    'akwa ibom': 'South South', 'bayelsa': 'South South', 'cross river': 'South South', 'delta': 'South South', 'edo': 'South South', 'rivers': 'South South',
    'ekiti': 'South West', 'lagos': 'South West', 'ogun': 'South West', 'ondo': 'South West', 'osun': 'South West', 'oyo': 'South West',
    'benue': 'North Central', 'fct': 'North Central', 'abuja': 'North Central', 'kogi': 'North Central', 'kwara': 'North Central', 'nasarawa': 'North Central', 'niger': 'North Central', 'plateau': 'North Central',
    'adamawa': 'North East', 'bauchi': 'North East', 'borno': 'North East', 'gombe': 'North East', 'taraba': 'North East', 'yobe': 'North East',
    'jigawa': 'North West', 'kaduna': 'North West', 'kano': 'North West', 'katsina': 'North West', 'kebbi': 'North West', 'sokoto': 'North West', 'zamfara': 'North West'
};

const getEffectiveZone = (stateName: string, dbZone?: string | null): string | undefined => {
    if (dbZone && dbZone.toUpperCase() !== 'N/A' && dbZone.trim() !== '') return dbZone;
    return stateToZoneFallback[stateName.toLowerCase()] || undefined;
};

const RandomizedPost: React.FC = () => {
    // Notifications
    const { success, error, warning, info } = useNotification();
    const [showHelp, setShowHelp] = useState(false);

    // Data States
    const [allAPC, setAllAPC] = useState<APCRecord[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [mandates, setMandates] = useState<Mandate[]>([]);
    const [existingPostings, setExistingPostings] = useState<PostingResponse[]>([]);
    const [allStations, setAllStations] = useState<Station[]>([]);
    const [allStates, setAllStates] = useState<State[]>([]);
    // Using simple object structure for flexible station types
    const [venues, setVenues] = useState<{ id: string, name: string, code?: string, type: string, state_name?: string, zone?: string, candidates?: number }[]>([]);
    const [loading, setLoading] = useState(false);
    // Lookup for Education Staff (from SDL)
    const [educationStaffSet, setEducationStaffSet] = useState<Set<string>>(new Set());

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

    // Candidate Logic (NCEE)
    const [useCandidateLogic, setUseCandidateLogic] = useState(false);
    const [candidateThreshold, setCandidateThreshold] = useState<number>(200);

    // Generated Preview
    const [generatedPostings, setGeneratedPostings] = useState<PostingCreate[]>([]);
    const [previewMode, setPreviewMode] = useState(false);

    // Preview Mode Filters
    const [previewSearchName, setPreviewSearchName] = useState('');
    const [previewSearchFileNo, setPreviewSearchFileNo] = useState('');
    const [previewSearchStation, setPreviewSearchStation] = useState('');
    const [previewSearchState, setPreviewSearchState] = useState('');
    const [previewSearchZone, setPreviewSearchZone] = useState('');

    const [previewPage, setPreviewPage] = useState(1);
    const [previewLimit, setPreviewLimit] = useState(10);

    useEffect(() => {
        setPreviewPage(1);
    }, [previewSearchName, previewSearchFileNo, previewSearchStation, previewSearchState, previewSearchZone, previewLimit]);

    const filteredGeneratedPostings = useMemo(() => {
        return generatedPostings.filter(p => {
            const matchName = p.name.toLowerCase().includes(previewSearchName.toLowerCase());
            const matchFileNo = p.file_no.toLowerCase().includes(previewSearchFileNo.toLowerCase());
            const matchStation = (p.station || '').toLowerCase().includes(previewSearchStation.toLowerCase());
            const matchState = ((p as any).state_name || '').toLowerCase().includes(previewSearchState.toLowerCase());
            const matchZone = ((p as any).zone || '').toLowerCase().includes(previewSearchZone.toLowerCase());

            return matchName && matchFileNo && matchStation && matchState && matchZone;
        });
    }, [generatedPostings, previewSearchName, previewSearchFileNo, previewSearchStation, previewSearchState, previewSearchZone]);

    const paginatedGeneratedPostings = useMemo(() => {
        const start = (previewPage - 1) * previewLimit;
        return filteredGeneratedPostings.slice(start, start + previewLimit);
    }, [filteredGeneratedPostings, previewPage, previewLimit]);

    const totalPreviewPages = Math.ceil(filteredGeneratedPostings.length / previewLimit);


    // Optional Filters
    const [filterEducation, setFilterEducation] = useState<'all' | 'education'>('all');
    const [filterStation, setFilterStation] = useState<string>(''); // Filters by staff's current station
    const [filterQualification, setFilterQualification] = useState<string>(''); // Filters by specific qualification

    // Derived Options for Filters
    const uniqueStations = useMemo(() => {
        const set = new Set(allAPC.map(s => s.station).filter(Boolean));
        return Array.from(set).sort();
    }, [allAPC]);

    const uniqueQualifications = useMemo(() => {
        const set = new Set(allAPC.map(s => s.qualification).filter(Boolean));
        return Array.from(set).sort();
    }, [allAPC]);

    // Memoized Eligible Staff Count and Breakdown for Selected Assignment
    const eligibleStaffData = useMemo(() => {
        if (!selectedAssignment || allAPC.length === 0) return { total: 0, breakdown: {} };

        const assignmentRecord = assignments.find(a => a.id === selectedAssignment);
        if (!assignmentRecord) return { total: 0, breakdown: {} };

        const assignmentName = assignmentRecord.name;
        const assignmentCode = assignmentRecord.code;
        const apcField = assignmentFieldMap[assignmentCode] || assignmentFieldMap[assignmentName];

        if (!apcField) return { total: 0, breakdown: {} };

        // Get mandate's conraiss_range if a mandate is selected
        let mandateConraissRange: string[] | null = null;
        if (selectedMandate) {
            // selectedMandate contains the mandate string (e.g., "SSCE INT EXAM ADMINISTRATOR")
            const mandateRecord = mandates.find(m => m.mandate === selectedMandate);
            if (mandateRecord && mandateRecord.conraiss_range && mandateRecord.conraiss_range.length > 0) {
                mandateConraissRange = mandateRecord.conraiss_range;
            }
        }

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

            // Check if staff has the assignment field set
            const val = staff[apcField as keyof APCRecord];
            if (!val) return;

            const staffConraiss = staff.conraiss || '0';
            const lvl = parseInt(staffConraiss);

            // Filter by mandate's conraiss_range if a mandate is selected
            if (mandateConraissRange) {
                // Check if staff's conraiss is in the mandate's eligible range
                const isEligibleForMandate = mandateConraissRange.some(range => {
                    // Handle range formats like "13", "14", or potentially "13-14"
                    if (range.includes('-')) {
                        const [min, max] = range.split('-').map(n => parseInt(n.trim()));
                        return lvl >= min && lvl <= max;
                    }
                    return parseInt(range) === lvl;
                });
                if (!isEligibleForMandate) return;
            }

            // --- NEW FILTERS ---
            // 1. Station Filter
            if (filterStation && staff.station !== filterStation) return;

            // 2. Qualification Filter
            if (filterQualification && staff.qualification !== filterQualification) return;

            // 3. Education/Professional Filter
            if (filterEducation === 'education') {
                const isEduSDL = educationStaffSet.has(staff.file_no);
                const qual = (staff.qualification || '').toUpperCase();
                const profKeywords = ['ICAN', 'ANAN', 'ACCT', 'COMP', 'COMPUTER'];
                const hasProf = profKeywords.some(k => qual.includes(k));

                if (!isEduSDL && !hasProf) return;
            }

            total++;
            if (breakdown[lvl] !== undefined) {
                breakdown[lvl]++;
            }
        });

        return { total, breakdown };
    }, [selectedAssignment, selectedMandate, allAPC, assignments, mandates, existingPostings, filterEducation, filterStation, filterQualification, educationStaffSet]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [apcData, assignmentsData, mandatesData, venuesData, postingsData, stationsData, statesData, staffData] = await Promise.all([
                getAllAPCRecords(true),
                getAllAssignments(true),
                getAllMandates(true),
                getAllMarkingVenues(true),
                getAllPostingRecords(),
                getAllStations(true),
                getAllStates(),
                getAllStaff(false) // Fetch ALL staff to ensure we get the flags even if inactive in one list but active in logic? Or just active. APC only uses active. 'false' means fetch all? getAllStaff(onlyActive). services/staff: getAllStaff(onlyActive). Default false. So getting all is safe.
            ]);
            setAllAPC(apcData);
            setAssignments(assignmentsData);
            setMandates(mandatesData);
            setExistingPostings(postingsData || []); // Ensure safe fallback
            setAllStations(stationsData);
            setAllStates(statesData);

            // Populate Education Staff Lookup
            const eduSet = new Set<string>();
            staffData.forEach(s => {
                if (s.is_education) eduSet.add(s.fileno);
            });
            setEducationStaffSet(eduSet);

            const stateMap = new Map<string, State>(statesData.map(s => [s.id, s]));
            const stateNameMap = new Map<string, State>(statesData.map(s => [s.name.toLowerCase(), s]));

            // Default to Marking Venues
            setVenues(venuesData.map(v => {
                const state = stateNameMap.get((v.state || '').toLowerCase());
                return {
                    id: v.id,
                    name: v.name,
                    code: v.code, // Include code for consistent display
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
                    else if (s.state_name) stateObj = stateNameMap.get(s.state_name.toLowerCase());

                    const stateName = stateObj?.name || s.state || s.state_name || '';
                    const code = s.code || s.state_code || s.sch_no || '';

                    // Value format: (CODE) | NAME | STATE
                    const parts = [];
                    parts.push(code ? `(${code})` : '');
                    parts.push(s.name || s.sch_name);
                    parts.push(stateName);

                    // Display format: NAME
                    const displayParts = [];
                    displayParts.push(s.name || s.sch_name);

                    // Include candidate count in display if available
                    // Use 'numb_of_cand' for NCEE centers, 'candidates' for schools
                    const candidateCount = s.numb_of_cand !== undefined ? s.numb_of_cand : s.candidates;
                    if (candidateCount !== undefined) {
                        displayParts.push(`[${candidateCount} Candidates]`);
                    }

                    return {
                        id: s.id,
                        name: parts.join(' | '),
                        display_name: displayParts.join(' - '),
                        type: type,
                        state_name: stateName,
                        zone: stateObj?.zone || undefined,
                        candidates: candidateCount // Store candidate count
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

        if (targetQuota === 0 && !useCandidateLogic) {
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

            // Get mandate's conraiss_range for filtering
            const mandateRecord = mandates.find(m => m.mandate === targetMandate);
            const mandateConraissRange = mandateRecord?.conraiss_range || [];

            // Helper to check if a CONRAISS level is eligible for the mandate
            const isConraissEligibleForMandate = (staffConraiss: string): boolean => {
                if (mandateConraissRange.length === 0) return true; // No restriction if no range defined

                const lvl = parseInt(staffConraiss || '0');
                return mandateConraissRange.some(range => {
                    // Handle range formats like "13", "14", or potentially "13-14"
                    if (range.includes('-')) {
                        const [min, max] = range.split('-').map(n => parseInt(n.trim()));
                        return lvl >= min && lvl <= max;
                    }
                    return parseInt(range) === lvl;
                });
            };

            // 1.5 Calculate Global Posted Counts & Check specific duplication
            const postedCountMap = new Map<string, number>();
            existingPostings.forEach(p => {
                const count = (p.assignments || []).length;
                postedCountMap.set(p.file_no, (postedCountMap.get(p.file_no) || 0) + count);

                if (Array.isArray(p.mandates) && p.mandates.some(m => m === targetMandate)) {
                    alreadyAssignedStaffIds.add(p.file_no);
                }
            });

            // 2. Filter Eligible Staff (Strict check on Global Quota + Mandate CONRAISS Range)
            const eligibleStaff = allAPC.filter(staff => {
                if (!staff.active) return false;
                if (alreadyAssignedStaffIds.has(staff.file_no)) return false;

                // Capacity Check
                const totalPosted = postedCountMap.get(staff.file_no) || 0;
                const totalAllotted = staff.count || 0;
                if (totalPosted >= totalAllotted) return false; // Exhausted

                // Check assignment field
                if (apcField) {
                    const val = staff[apcField as keyof APCRecord];
                    if (!val) return false;
                }

                // Check mandate CONRAISS range eligibility
                if (!isConraissEligibleForMandate(staff.conraiss || '0')) return false;

                // --- NEW FILTERS ---
                // 1. Station Filter
                if (filterStation && staff.station !== filterStation) return false;

                // 2. Qualification Filter
                if (filterQualification && staff.qualification !== filterQualification) return false;

                // 3. Education/Professional Filter
                if (filterEducation === 'education') {
                    const isEduSDL = educationStaffSet.has(staff.file_no);
                    const qual = (staff.qualification || '').toUpperCase();
                    const profKeywords = ['ICAN', 'ANAN', 'ACCT', 'COMP', 'COMPUTER'];
                    const hasProf = profKeywords.some(k => qual.includes(k));

                    if (!isEduSDL && !hasProf) return false;
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
            // Create a map from station name (lowercase) to state info
            const stationToStateMap = new Map<string, { stateName: string; zone: string | undefined }>();

            allStates.forEach(state => {
                // Map capital (e.g., "Minna") to the state ("Niger")
                if (state.capital) {
                    const normalizedCapital = normalizeStr(state.capital);
                    stationToStateMap.set(normalizedCapital, {
                        stateName: state.name,
                        zone: state.zone || getEffectiveZone(state.name, state.zone)
                    });
                }
                // Also map state name itself
                const normalizedStateName = normalizeStr(state.name);
                stationToStateMap.set(normalizedStateName, {
                    stateName: state.name,
                    zone: state.zone || getEffectiveZone(state.name, state.zone)
                });
            });

            // Build helper to get staff's home state based on their station
            const getStaffHomeState = (staff: APCRecord): { stateName: string | undefined; zone: string | undefined } => {
                const station = (staff.station || '').toLowerCase();
                const normalizedStation = normalizeStr(station);

                // First try direct match with station name
                for (const [key, value] of stationToStateMap.entries()) {
                    if (normalizedStation.includes(key) || key.includes(normalizedStation)) {
                        return value;
                    }
                }

                // Fallback: Find state by name OR capital in station string
                const matchedState = allStates.find(s =>
                    normalizedStation.includes(normalizeStr(s.name)) ||
                    (s.capital && normalizedStation.includes(normalizeStr(s.capital)))
                );

                if (matchedState) {
                    return {
                        stateName: matchedState.name,
                        zone: matchedState.zone || getEffectiveZone(matchedState.name, matchedState.zone)
                    };
                }

                return { stateName: undefined, zone: undefined };
            };

            // Pre-compute home state for all eligible staff
            const staffHomeStateMap = new Map<string, { stateName: string | undefined; zone: string | undefined }>();
            eligibleStaff.forEach(staff => {
                staffHomeStateMap.set(staff.id, getStaffHomeState(staff));
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
                // Specific layer quotas (for tracking/stats only now)
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

                // Determine Effective Target Quota
                let effectiveTarget = targetQuota;

                let count = 0;
                if (useCandidateLogic) {
                    // NCEE Candidate-Based Logic
                    // User Request (Step 104):
                    // 0 Candidates -> 0 Staff
                    // <= X Candidates -> 1 Staff (Standard)
                    // > X Candidates -> 2 Staff (Large)

                    const rawCount = venue.candidates;
                    if (rawCount !== undefined && rawCount !== null) {
                        count = Number(rawCount);
                    }
                    if (isNaN(count)) count = 0;

                    if (count <= 0) {
                        effectiveTarget = 0;
                    } else if (count <= candidateThreshold) {
                        // Note: User requested 1 staff for candidates <= threshold
                        effectiveTarget = 1;
                    } else {
                        // Count > Threshold -> 2 Staff
                        effectiveTarget = 2;
                    }
                }

                const remainingNeeded = Math.max(0, effectiveTarget - venueExistingTotal);

                // Calculate layer quotas (for stats tracking only - strict priority overrides these)
                const stateQuotaStr = (effectiveTarget * (distRatios.state / 100)).toFixed(2);
                const zoneQuotaStr = (effectiveTarget * (distRatios.zone / 100)).toFixed(2);

                const stateQuota = Math.round(parseFloat(stateQuotaStr));
                const zoneQuota = Math.round(parseFloat(zoneQuotaStr));
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
            // If useCandidateLogic is true, we fallback to allPossibleLevels to ensure flexibility
            const searchLevels = (useCandidateLogic || sumOfLevelQuotas < targetQuota) ? allPossibleLevels : activeLevels;

            if (searchLevels.length === 0) {
                warning('Please select at least one CONRAISS level.');
                setLoading(false);
                return;
            }

            const usedStaffIds = new Set<string>();
            const newPostings: PostingCreate[] = [];

            // Helper to check if staff is HQ-based (can be posted anywhere)
            // Only staff with station starting with "HQ-" are treated as HQ (e.g., HQ-ADMIN, HQ-OPERATIONS)
            // ABUJA staff are treated as FCT and follow normal geolocal priority
            const isHQStaff = (staff: APCRecord): boolean => {
                const station = (staff.station || '').toUpperCase().trim();
                return station.startsWith('HQ-') || station === 'HQ';
            };

            /**
             * POSTING PRIORITY SYSTEM WITH STATE/ZONE/HQ QUOTAS:
             * 
             * The system respects the configured State/Zone/HQ percentage quotas while
             * applying strict geolocal priority for non-HQ staff.
             * 
             * STAGE 0 (STATE QUOTA): Fill state quota with same-state staff
             *   - Staff whose station (capital) maps to the venue's state
             *   - e.g., Staff with station "Minna" → posted to Niger state venues first
             *   - Limited by stateQuota percentage
             * 
             * STAGE 1 (ZONE QUOTA): Fill zone quota with same-zone staff
             *   - Staff from the same zone but different state (only if their home state has no vacancy)
             *   - Limited by zoneQuota percentage
             * 
             * STAGE 2 (HQ QUOTA): Fill HQ quota with HQ staff or remaining staff
             *   - HQ staff can be posted randomly to any venue
             *   - Non-HQ staff only if their home state AND zone have no vacancies
             *   - Limited by hqQuota percentage
             * 
             * STAGE 3 (OVERFLOW): Fill any remaining quota
             *   - Use any available staff following priority rules
             */
            for (let stage = 0; stage <= 3; stage++) {
                let madeProgressInStage = true;

                while (madeProgressInStage) {
                    madeProgressInStage = false;
                    const localVenueOrder = shuffle([...venueQuotas]);

                    for (const vq of localVenueOrder) {
                        if (vq.remainingNeeded <= 0) continue;

                        // Check quota limits per stage
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

                            // Try to respect per-level limits if set (except in overflow stage)
                            if (stage <= 2 && levelLimit > 0 && levelUsed >= levelLimit) continue;

                            const pool = staffByLevel[level] || [];

                            // PRIORITY FILTER WITH QUOTA AWARENESS
                            const priorityMatches = pool.filter(staff => {
                                if (usedStaffIds.has(staff.id)) return false;

                                const staffIsHQ = isHQStaff(staff);

                                // Get staff's home state and zone
                                const staffHome = staffHomeStateMap.get(staff.id);
                                const staffStateName = staffHome?.stateName;
                                const staffZone = staffHome?.zone;

                                // Venue attributes
                                const venueStateName = vq.venue.state_name;
                                const venueZone = vq.venue.zone;

                                // Determine geographic relationship
                                const isSameState = venueStateName && staffStateName &&
                                    normalizeStr(staffStateName) === normalizeStr(venueStateName);
                                const isSameZone = !isSameState && venueZone && staffZone &&
                                    normalizeStr(staffZone) === normalizeStr(venueZone);

                                // STAGE-BASED PRIORITY ENFORCEMENT
                                if (stage === 0) {
                                    // STATE QUOTA: Only accept non-HQ staff whose home state matches the venue state
                                    return !staffIsHQ && isSameState;
                                } else if (stage === 1) {
                                    // ZONE QUOTA: Only accept non-HQ staff from the same zone (but different state)
                                    // CRITICAL: Check if this staff has vacancies in their home state first
                                    if (staffIsHQ) return false;
                                    if (staffStateName) {
                                        const hasHomeStateVacancy = venueQuotas.some(otherVq =>
                                            otherVq.remainingNeeded > 0 &&
                                            otherVq.venue.state_name &&
                                            normalizeStr(otherVq.venue.state_name) === normalizeStr(staffStateName)
                                        );
                                        if (hasHomeStateVacancy) return false;
                                    }
                                    return isSameZone;
                                } else if (stage === 2) {
                                    // HQ QUOTA: Accept HQ staff (can go anywhere) OR non-HQ staff with no home vacancies
                                    if (staffIsHQ) return true; // HQ staff can be posted to ANY venue

                                    // Non-HQ staff: only if their home state AND zone have no vacancies
                                    if (staffStateName) {
                                        const hasHomeStateVacancy = venueQuotas.some(otherVq =>
                                            otherVq.remainingNeeded > 0 &&
                                            otherVq.venue.state_name &&
                                            normalizeStr(otherVq.venue.state_name) === normalizeStr(staffStateName)
                                        );
                                        if (hasHomeStateVacancy) return false;
                                    }
                                    if (staffZone) {
                                        const hasZoneVacancy = venueQuotas.some(otherVq =>
                                            otherVq.remainingNeeded > 0 &&
                                            otherVq.venue.zone &&
                                            normalizeStr(otherVq.venue.zone) === normalizeStr(staffZone)
                                        );
                                        if (hasZoneVacancy) return false;
                                    }
                                    return !isSameState && !isSameZone;
                                } else {
                                    // OVERFLOW: Fill remaining quota with any available staff
                                    // Still respect strict priority for non-HQ staff
                                    if (staffIsHQ) return true;

                                    // Fix: Allow staff to fill overflow slots in their own state/zone
                                    // (Prevents them from being blocked due to 'home vacancy' check which sees THIS overflow slot)
                                    if (isSameState) return true;
                                    if (isSameZone) return true;

                                    // Non-HQ: check if they should be posted elsewhere first
                                    if (staffStateName) {
                                        const hasHomeStateVacancy = venueQuotas.some(otherVq =>
                                            otherVq.remainingNeeded > 0 &&
                                            otherVq.venue.state_name &&
                                            normalizeStr(otherVq.venue.state_name) === normalizeStr(staffStateName)
                                        );
                                        if (hasHomeStateVacancy) return false;
                                    }
                                    if (staffZone) {
                                        const hasZoneVacancy = venueQuotas.some(otherVq =>
                                            otherVq.remainingNeeded > 0 &&
                                            otherVq.venue.zone &&
                                            normalizeStr(otherVq.venue.zone) === normalizeStr(staffZone)
                                        );
                                        if (hasZoneVacancy) return false;
                                    }
                                    return true;
                                }
                            });

                            if (priorityMatches.length > 0) {
                                const staff = shuffle(priorityMatches)[0];
                                usedStaffIds.add(staff.id);

                                const currentCount = staff.count || 0;
                                const totalPostedSoFar = postedCountMap.get(staff.file_no) || 0;

                                newPostings.push({
                                    file_no: staff.file_no,
                                    name: staff.name,
                                    station: staff.station,
                                    conraiss: staff.conraiss,
                                    year: new Date().getFullYear().toString(),
                                    count: numberOfNights, // Use explicit number of nights (default 0)
                                    posted_for: 1,
                                    to_be_posted: Math.max(0, (staff.count || 0) - (totalPostedSoFar + 1)),
                                    assignments: [assignmentCode],
                                    mandates: [targetMandate],
                                    assignment_venue: [((v) => {
                                        const codePrefix = v.code ? `(${v.code})` : '';
                                        const hasCode = v.code && v.name.includes(codePrefix);
                                        const baseName = (v.code && !hasCode) ? `${codePrefix} ${v.name}` : v.name;
                                        return baseName + (v.state_name ? ' | ' + v.state_name : '');
                                    })(vq.venue)],
                                    state: vq.venue.state_name || null,
                                    state_name: vq.venue.state_name, // Keep for backward compat if needed, or remove if fully migrated
                                    zone: vq.venue.zone,
                                    description: description || null // Include description
                                } as any);

                                // Track picks by geographic category for stats
                                const staffHome = staffHomeStateMap.get(staff.id);
                                const isSameState = vq.venue.state_name && staffHome?.stateName &&
                                    normalizeStr(staffHome.stateName) === normalizeStr(vq.venue.state_name);
                                const isSameZone = !isSameState && vq.venue.zone && staffHome?.zone &&
                                    normalizeStr(staffHome.zone) === normalizeStr(vq.venue.zone);

                                if (isSameState) vq.statePicks++;
                                else if (isSameZone) vq.zonePicks++;
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
                // Log stats for debugging
                console.log('Posting Stats:', {
                    total: newPostings.length,
                    byPriority: venueQuotas.reduce((acc, vq) => ({
                        state: acc.state + vq.statePicks,
                        zone: acc.zone + vq.zonePicks,
                        other: acc.other + vq.hqPicks
                    }), { state: 0, zone: 0, other: 0 })
                });
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
                            [apcField]: '', // Clear the assignment field in APC (Standardized for Add)
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
                    <h2 className="text-xl md:text-2xl lg:text-3xl font-bold">
                        Generated Preview
                        <span className="text-base font-normal text-slate-500 ml-2">
                            (Showing {filteredGeneratedPostings.length} of {generatedPostings.length})
                        </span>
                    </h2>
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

                {/* Search Filters */}
                <div className="bg-white dark:bg-[#121b25] p-4 rounded-xl border border-slate-200 dark:border-gray-800 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                    <input
                        type="text"
                        placeholder="Filter by Name..."
                        value={previewSearchName}
                        onChange={(e) => setPreviewSearchName(e.target.value)}
                        className="h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                    <input
                        type="text"
                        placeholder="Filter by File No..."
                        value={previewSearchFileNo}
                        onChange={(e) => setPreviewSearchFileNo(e.target.value)}
                        className="h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                    <input
                        type="text"
                        placeholder="Filter by Station..."
                        value={previewSearchStation}
                        onChange={(e) => setPreviewSearchStation(e.target.value)}
                        className="h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                    <input
                        type="text"
                        placeholder="Filter by Venue State..."
                        value={previewSearchState}
                        onChange={(e) => setPreviewSearchState(e.target.value)}
                        className="h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                    <input
                        type="text"
                        placeholder="Filter by Zone..."
                        value={previewSearchZone}
                        onChange={(e) => setPreviewSearchZone(e.target.value)}
                        className="h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                    <select
                        value={previewLimit}
                        onChange={(e) => setPreviewLimit(Number(e.target.value))}
                        className="h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] text-sm text-slate-900 dark:text-slate-100 font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                        <option value={10}>10 Rows</option>
                        <option value={25}>25 Rows</option>
                        <option value={50}>50 Rows</option>
                        <option value={100}>100 Rows</option>
                    </select>
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
                                {paginatedGeneratedPostings.map((p, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                        <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300 text-sm">{p.file_no}</td>
                                        <td className="p-3 font-medium text-slate-800 dark:text-slate-100">{p.name}</td>
                                        <td className="p-3 font-bold">{p.conraiss}</td>
                                        <td className="p-3 text-sm">{p.station}</td>
                                        <td className="p-3 font-bold text-purple-600 dark:text-purple-400 text-sm">{p.assignment_venue?.[0]}</td>
                                        <td className="p-3 text-sm">{p.state || (p as any).state_name || '-'}</td>
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

                {/* Pagination Controls */}
                {totalPreviewPages > 1 && (
                    <div className="flex justify-between items-center mt-4 bg-white dark:bg-[#121b25] p-3 rounded-xl border border-slate-200 dark:border-gray-800">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-2">
                            Page {previewPage} of {totalPreviewPages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                disabled={previewPage === 1}
                                onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-700 text-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                Previous
                            </button>
                            <button
                                disabled={previewPage === totalPreviewPages}
                                onClick={() => setPreviewPage(p => Math.min(totalPreviewPages, p + 1))}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-700 text-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-full bg-slate-50 dark:bg-[#0b1015] p-4 md:p-8 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400 drop-shadow-sm">
                        Randomized Post Generator
                    </h1>
                    <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">
                        Configure quotas and randomly assign staff to venues.
                    </p>
                </div>
                <button
                    onClick={() => setShowHelp(true)}
                    className="flex items-center justify-center p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all shadow-sm"
                    title="Guide"
                >
                    <span className="material-symbols-outlined text-2xl">help</span>
                </button>
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
                                        {(() => {
                                            // Group venues by state
                                            const grouped = venues.reduce((acc, venue) => {
                                                const state = venue.state_name || 'Others';
                                                if (!acc[state]) acc[state] = [];
                                                acc[state].push(venue);
                                                return acc;
                                            }, {} as { [key: string]: typeof venues });

                                            // Sort states alphabetically, putting 'Others' last
                                            const sortedStates = Object.keys(grouped).sort((a, b) => {
                                                if (a === 'Others') return 1;
                                                if (b === 'Others') return -1;
                                                return a.localeCompare(b);
                                            });

                                            return sortedStates.map(state => (
                                                <optgroup key={state} label={state}>
                                                    {grouped[state].sort((a, b) => (a.name).localeCompare(b.name)).map(v => {
                                                        const codePart = (v.code && !v.name.includes(`(${v.code})`)) ? `(${v.code}) ` : '';
                                                        const namePart = v.name;
                                                        const statePart = v.state_name || state;
                                                        return (
                                                            <option key={v.id} value={v.id}>
                                                                {`${codePart}${namePart} | ${statePart}`}
                                                            </option>
                                                        );
                                                    })}
                                                </optgroup>
                                            ));
                                        })()}
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

                        {/* Optional Filters Row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-slate-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-4 duration-500 delay-100">
                            {/* 1. Education Filter */}
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Education/Qualifications</label>
                                <select
                                    className="w-full h-11 px-3 rounded-xl border bg-white dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white"
                                    value={filterEducation}
                                    onChange={e => setFilterEducation(e.target.value as 'all' | 'education')}
                                >
                                    <option value="all">All Staff</option>
                                    <option value="education">Qualified Staff Only (Edu/Pro)</option>
                                </select>
                            </div>

                            {/* 2. Station Filter */}
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Filter by Station</label>
                                <select
                                    className="w-full h-11 px-3 rounded-xl border bg-white dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white"
                                    value={filterStation}
                                    onChange={e => setFilterStation(e.target.value)}
                                >
                                    <option value="">All Stations</option>
                                    {uniqueStations.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 3. Qualification Filter */}
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Filter by Qualification</label>
                                <select
                                    className="w-full h-11 px-3 rounded-xl border bg-white dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white"
                                    value={filterQualification}
                                    onChange={e => setFilterQualification(e.target.value)}
                                >
                                    <option value="">All Qualifications</option>
                                    {uniqueQualifications.map(q => (
                                        <option key={q} value={q}>{q}</option>
                                    ))}
                                </select>
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

                        {/* Candidate Count Logic Configuration (Optional) */}
                        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-gray-800">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                        Use Candidate Count Logic only for NCEE Postings.
                                    </h4>
                                    <span className="material-symbols-outlined text-base text-slate-400 cursor-help" title="If enabled, staff quota per venue will be determined by candidate count: 0 candidates = 0 staff, <= X candidates = 1 staff, > X candidates = 2 staff.">help</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={useCandidateLogic}
                                        onChange={(e) => setUseCandidateLogic(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>

                            {useCandidateLogic && (
                                <div className="mt-2 bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                                    <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1 block">
                                        Candidate Threshold (X)
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="number"
                                            min="1"
                                            className="w-24 h-10 px-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-[#0f161d] font-bold text-emerald-900 dark:text-emerald-100"
                                            value={candidateThreshold}
                                            onChange={(e) => setCandidateThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                                        />
                                        <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80 italic">
                                            Centers with &le; {candidateThreshold} candidates get 1 staff. <br />
                                            Centers with &gt; {candidateThreshold} candidates get 2 staff.
                                        </span>
                                    </div>
                                </div>
                            )}
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
                    {/* Assignment Specific configurations (like Number of Nights) */}
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

            <HelpModal
                isOpen={showHelp}
                onClose={() => setShowHelp(false)}
                helpData={{
                    title: 'Randomized Post Generator',
                    description: 'Configure quotas and randomly assign staff to venues.',
                    sections: [
                        {
                            title: 'How it works',
                            icon: 'lightbulb',
                            content: 'This tool randomly assigns eligible staff to marking venues or monitoring stations based on your defined quotas. It ensures staff are not double-booked and respects their CONRAISS levels.',
                            tips: ['Staff must be marked "Active" in the APC List to be eligible.']
                        },
                        {
                            title: 'Step 1: Criteria',
                            icon: 'filter_alt',
                            content: 'Select the Assignment (e.g., SSCE INT) and the specific Mandate (e.g., TEAM LEADER). Only staff who are eligible for this assignment and not already posted for this mandate will be considered.',
                        },
                        {
                            title: 'Step 2: Venues',
                            icon: 'location_on',
                            content: 'Select the target venue type (e.g., Marking Venue, School). You can run this for "All Venues" at once, or focus on a specific venue.',
                            tips: ['Running for "All Venues" will attempt to fill quotas for every single venue in the list.']
                        },
                        {
                            title: 'Step 3: Quotas',
                            icon: 'pie_chart',
                            content: 'Set the "Target / Venue" - this is the total number of staff you want per venue. Then, distribute this total across different CONRAISS levels. The system will try to match this distribution as closely as possible.',
                        },
                        {
                            title: 'Preview',
                            icon: 'visibility',
                            content: 'Click "Generate Preview" to see the proposed postings without saving them. You can review, search, and filter the results. Once satisfied, click "Confirm and Post" to save them to the database.',
                        }
                    ]
                }}
            />
        </div>
    );
};

export default RandomizedPost;
