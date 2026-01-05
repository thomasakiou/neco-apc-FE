import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getAllHODApcRecords, assignmentFieldMap } from '../../services/hodApc';
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
import { getAllBECECustodians, getAllSSCECustodians } from '../../services/custodianSpecific';
import { getAllTTCenters } from '../../services/ttCenter';
import { State } from '../../types/state';
import { getAllStations } from '../../services/station';
import { Station } from '../../types/station';


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

    // Personalized Posting States
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvData, setCsvData] = useState<{ fileNo: string; venue: string }[]>([]);
    const [csvErrors, setCsvErrors] = useState<string[]>([]);
    const [csvPreview, setCsvPreview] = useState<PostingCreate[]>([]);

    // Preview
    const [generatedPostings, setGeneratedPostings] = useState<PostingCreate[]>([]);
    const [previewMode, setPreviewMode] = useState(false);

    // Modals
    const [isStationModalOpen, setIsStationModalOpen] = useState(false);
    const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' }>({ isOpen: false, title: '', message: '', type: 'info' as any });

    useEffect(() => {
        fetchInitialData();
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

    // Get eligible HODs for selected assignment
    const eligibleHODs = useMemo(() => {
        if (!selectedAssignment || allHODs.length === 0) {
            console.log('[HOD Filter] No assignment selected or no HODs loaded', { selectedAssignment, hodCount: allHODs.length });
            return [];
        }
        const assignmentRecord = assignments.find(a => a.id === selectedAssignment);
        if (!assignmentRecord) {
            console.log('[HOD Filter] Assignment record not found', { selectedAssignment });
            return [];
        }
        const apcField = assignmentFieldMap[assignmentRecord.code] || assignmentFieldMap[assignmentRecord.name];
        if (!apcField) {
            console.log('[HOD Filter] No APC field mapping found', {
                assignmentCode: assignmentRecord.code,
                assignmentName: assignmentRecord.name,
                availableFields: Object.keys(assignmentFieldMap)
            });
            return [];
        }

        console.log('[HOD Filter] Using APC field:', apcField, 'for assignment:', assignmentRecord.name);

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

        console.log('[HOD Filter] Results:', {
            totalHODs: allHODs.length,
            activeHODs: allHODs.filter(h => h.active).length,
            withFieldValue: allHODs.filter(h => {
                const val = h[apcField as keyof HODApcRecord];
                return val && val.toString().trim() !== '';
            }).length,
            eligibleCount: filtered.length
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
            existingPostings.forEach(p => {
                if (Array.isArray(p.mandates) && p.mandates.some(m => m === targetMandate)) {
                    alreadyAssignedStaffIds.add(p.file_no);
                }
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

                            const currentCount = pickedHOD.count || 0;
                            // Calculate posted count (mocking simpler version here as we don't have existing postings map in this scope easily, 
                            // but simpler logic: to_be_posted = currentCount - 1 because we are adding 1)
                            const newToBePosted = Math.max(0, currentCount - 1); // Assuming 1 new posting

                            newPostings.push({
                                file_no: pickedHOD.file_no,
                                name: pickedHOD.name,
                                station: pickedHOD.station || '',
                                conraiss: pickedHOD.conraiss || '',
                                year: new Date().getFullYear().toString(),
                                count: numberOfNights,
                                posted_for: 1,
                                to_be_posted: newToBePosted,
                                assignments: [assignmentCode],
                                mandates: [targetMandate],
                                assignment_venue: [`${vNeed.venue.code ? `${vNeed.venue.code} | ` : ''}${vNeed.venue.name} | ${vNeed.venue.state_name}`],
                                state: vNeed.venue.state_name,
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
                warning(`${skippedDueToDuplicate} HOD(s) were skipped because they are already posted for this mandate.`);
            }
        } catch (err) {
            console.error("Error generating postings", err);
            error('An error occurred during generation.');
        } finally {
            setLoading(false);
        }
    };

    const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCsvFile(file);
        setCsvErrors([]);
        setCsvPreview([]);

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length <= 1) {
                setCsvErrors(['CSV file is empty or only contains headers.']);
                return;
            }

            const errors: string[] = [];
            const parsedData: { fileNo: string; venue: string }[] = [];
            const validPostings: PostingCreate[] = [];

            // Create lookup maps
            const hodMap = new Map<string, HODApcRecord>(allHODs.map(h => [h.file_no.toString().padStart(4, '0'), h]));
            const venueMap = new Map(venues.map(v => [v.name.toLowerCase(), v]));

            // Duplicate Check
            const targetMandate = mandates.find(m => m.id === selectedMandate)?.mandate || selectedMandate;
            const alreadyAssignedStaffIds = new Set<string>();
            existingPostings.forEach(p => {
                if (Array.isArray(p.mandates) && p.mandates.some(m => m === targetMandate)) {
                    alreadyAssignedStaffIds.add(p.file_no);
                }
            });

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => c.trim());
                if (cols.length < 2) {
                    errors.push(`Row ${i + 1}: Invalid format. Expected FileNo,Venue`);
                    continue;
                }
                const fileNo = cols[0].toString().padStart(4, '0');
                const venueName = cols[1];

                const hod = hodMap.get(fileNo);
                if (!hod) {
                    errors.push(`Row ${i + 1}: Staff ${fileNo} not found in HOD records.`);
                    continue;
                }

                if (alreadyAssignedStaffIds.has(hod.file_no)) {
                    errors.push(`Row ${i + 1}: Staff ${fileNo} is already posted for mandate ${targetMandate}.`);
                    continue;
                }

                const venue = venueMap.get(venueName.toLowerCase()) || venues.find(v => v.name.toLowerCase().includes(venueName.toLowerCase()));
                if (!venue) {
                    errors.push(`Row ${i + 1}: Venue "${venueName}" not found.`);
                    continue;
                }

                parsedData.push({ fileNo, venue: venue.name });
                validPostings.push({
                    file_no: hod.file_no,
                    name: hod.name,
                    station: hod.station || '',
                    conraiss: hod.conraiss || '',
                    year: new Date().getFullYear().toString(),
                    count: numberOfNights,
                    posted_for: 1,
                    to_be_posted: Math.max(0, (hod.count || 0) - 1),
                    assignments: selectedAssignment ? [assignments.find(a => a.id === selectedAssignment)?.code || ''] : [],
                    mandates: selectedMandate ? [mandates.find(m => m.id === selectedMandate)?.mandate || ''] : [],
                    assignment_venue: [`${venue.code ? `${venue.code} | ` : ''}${venue.name} | ${venue.state_name}`],
                    state: venue.state_name,
                    zone: venue.zone,
                    description: description || null
                } as any);
            }

            setCsvData(parsedData);
            setCsvErrors(errors);
            setCsvPreview(validPostings);
        };
        reader.readAsText(file);
    };

    const handleSavePostings = async (postings: PostingCreate[]) => {
        if (postings.length === 0) return;
        setLoading(true);
        try {
            await bulkCreateHODPostings({ items: postings });
            success(`Successfully posted ${postings.length} HODs!`);
            setGeneratedPostings([]);
            setCsvPreview([]);
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
                    <div className="space-y-6">
                        {/* Assignment/Mandate Selection */}
                        <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
                            <h3 className="text-lg font-bold mb-4">1. Select Assignment & Mandate</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Assignment</label>
                                    <select className="w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700" value={selectedAssignment} onChange={e => setSelectedAssignment(e.target.value)}>
                                        <option value="">Select Assignment</option>
                                        {assignments.filter(a => a.active).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Mandate</label>
                                    <select className="w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 disabled:opacity-50" value={selectedMandate} onChange={e => setSelectedMandate(e.target.value)} disabled={!selectedAssignment}>
                                        <option value="">Select Mandate</option>
                                        {mandates.filter(m => {
                                            if (!selectedAssignment) return false;
                                            const assignment = assignments.find(a => a.id === selectedAssignment);
                                            return assignment?.mandates?.includes(m.code);
                                        }).map(m => <option key={m.id} value={m.id}>{m.mandate}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Nights</label>
                                    <input type="number" min="0" className="w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700" value={numberOfNights} onChange={e => setNumberOfNights(parseInt(e.target.value) || 0)} />
                                </div>
                            </div>
                        </div>

                        {/* CSV Upload */}
                        <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold">2. Upload CSV File</h3>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const csvContent = "FileNo,Venue\n0001,MAMP SCHOOL\n0002,GOVERNMENT COLLEGE (001)";
                                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                        const link = document.createElement('a');
                                        link.href = URL.createObjectURL(blob);
                                        link.download = 'hod_posting_template.csv';
                                        link.click();
                                    }}
                                    className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                                >
                                    <span className="material-symbols-outlined text-lg">download</span>
                                    Download Template
                                </button>
                            </div>
                            <p className="text-sm text-slate-500 mb-4">CSV format: <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">FileNo,Venue</code></p>
                            <input type="file" accept=".csv" onChange={handleCsvUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />

                            {csvErrors.length > 0 && (
                                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                                    <h4 className="font-bold text-red-700 dark:text-red-400 mb-2">Errors Found:</h4>
                                    <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-300 space-y-1">
                                        {csvErrors.map((err, i) => <li key={i}>{err}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* CSV Preview */}
                        {csvPreview.length > 0 && (
                            <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold">3. Preview ({csvPreview.length} Valid Rows)</h3>
                                    <button
                                        onClick={() => handleSavePostings(csvPreview)}
                                        disabled={loading}
                                        className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                        {loading ? 'Saving...' : 'Commit All'}
                                    </button>
                                </div>
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 dark:bg-[#0f161d] text-sm uppercase font-bold text-slate-500">
                                        <tr><th className="p-3">File No</th><th className="p-3">Name</th><th className="p-3">Venue</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                                        {csvPreview.slice(0, 20).map((p, idx) => (
                                            <tr key={idx}><td className="p-3 font-mono">{p.file_no}</td><td className="p-3">{p.name}</td><td className="p-3 text-purple-600 dark:text-purple-400">{p.assignment_venue?.[0]}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                                {csvPreview.length > 20 && <p className="text-sm text-slate-500 mt-2 text-center">... and {csvPreview.length - 20} more</p>}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            <StationTypeSelectionModal isOpen={isStationModalOpen} onClose={() => setIsStationModalOpen(false)} onSelect={handleStationTypeSelect} />
            <AlertModal isOpen={alertModal.isOpen} onClose={() => setAlertModal({ ...alertModal, isOpen: false })} title={alertModal.title} message={alertModal.message} type={alertModal.type} />

            {loading && <div className="fixed inset-0 bg-white/10 dark:bg-black/10 backdrop-blur-[1px] z-50 pointer-events-none"></div>}
        </div>
    );
};

export default HODPostings;
