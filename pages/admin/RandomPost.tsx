import React, { useState, useEffect } from 'react';
import { getAllAPCRecords } from '../../services/apc';
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
import { useNotification } from '../../context/NotificationContext';

const RandomPost: React.FC = () => {
    // Notifications
    const { success, error, warning, info } = useNotification();

    // Data States
    const [allAPC, setAllAPC] = useState<APCRecord[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [mandates, setMandates] = useState<Mandate[]>([]);
    const [existingPostings, setExistingPostings] = useState<PostingResponse[]>([]);
    // Using simple object structure for flexible station types
    const [venues, setVenues] = useState<{ id: string, name: string, type: string }[]>([]);
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

    // Generated Preview
    const [generatedPostings, setGeneratedPostings] = useState<PostingCreate[]>([]);
    const [previewMode, setPreviewMode] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [apcData, assignmentsData, mandatesData, venuesData, postingsData] = await Promise.all([
                getAllAPCRecords(true),
                getAllAssignments(),
                getAllMandates(),
                getAllMarkingVenues(),
                getAllPostingRecords()
            ]);
            setAllAPC(apcData);
            setAssignments(assignmentsData);
            setMandates(mandatesData);
            setExistingPostings(postingsData || []); // Ensure safe fallback
            // Default to Marking Venues
            setVenues(venuesData.map(v => ({ id: v.id, name: v.name, type: 'marking_venue' })));
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
            let options: { id: string; name: string; type: string }[] = [];

            if (type === 'state') {
                const data = await getAllStates();
                options = data.map(s => ({
                    id: s.id,
                    name: s.state_code ? `(${s.state_code}) - ${s.name}` : s.name,
                    type: 'state'
                }));
            } else if (type === 'school') {
                const data = await getAllSchools();
                options = data.map(s => ({
                    id: s.id,
                    name: s.code ? `(${s.code}) - ${s.name}` : s.name,
                    type: 'school'
                }));
            } else if (type === 'bece_custodian') {
                const data = await getAllBECECustodians();
                options = data.map(s => ({
                    id: s.id,
                    name: s.code ? `(${s.code}) - ${s.name}` : s.name,
                    type: 'bece_custodian'
                }));
            } else if (type === 'ssce_custodian') {
                const data = await getAllSSCECustodians();
                options = data.map(s => ({
                    id: s.id,
                    name: s.code ? `(${s.code}) - ${s.name}` : s.name,
                    type: 'ssce_custodian'
                }));
            } else if (type === 'ncee_center') {
                const data = await getAllNCEECenters();
                options = data.map(s => ({
                    id: s.id,
                    name: s.code ? `(${s.code}) - ${s.name}` : s.name,
                    type: 'ncee_center'
                }));
            } else if (type === 'marking_venue') {
                const data = await getAllMarkingVenues();
                options = data.map(s => ({
                    id: s.id,
                    name: s.code ? `(${s.code}) - ${s.name}` : s.name,
                    type: 'marking_venue'
                }));
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

    const totalStaffRequired = Object.values(conraissConfig).reduce((a, b) => a + b, 0);

    const generatePostings = async () => {
        if (!selectedAssignment || !selectedMandate) {
            warning('Please select an Assignment and Mandate.');
            return;
        }

        if (!selectedVenue && !isAllVenues) {
            warning('Please select a Venue or check "All Venues".');
            return;
        }

        if (totalStaffRequired === 0) {
            warning('Please configure the number of staff required.');
            return;
        }

        setLoading(true);

        // Allow UI to update before heavy calculation
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const assignmentName = assignments.find(a => a.id === selectedAssignment)?.name || selectedAssignment;
            const apcField = assignmentFieldMap[assignmentName];

            // 1. Existing Assignments Lookup (duplicate prevention)
            const targetMandate = mandates.find(m => m.id === selectedMandate)?.mandate || selectedMandate;
            const alreadyAssignedStaffIds = new Set<string>();
            existingPostings.forEach(p => {
                if (Array.isArray(p.mandates) && p.mandates.some(m => m === targetMandate)) {
                    alreadyAssignedStaffIds.add(p.file_no);
                }
            });

            // 2. Filter Eligible Staff
            const eligibleStaff = allAPC.filter(staff => {
                if (!staff.active) return false;
                if (alreadyAssignedStaffIds.has(staff.file_no)) return false;
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

            // Shuffle pools
            const shuffle = <T,>(array: T[]): T[] => array.sort(() => Math.random() - 0.5);
            Object.keys(staffByLevel).forEach(key => {
                const lvl = parseInt(key);
                staffByLevel[lvl] = shuffle(staffByLevel[lvl]);
            });

            const newPostings: PostingCreate[] = [];
            const targetVenues = isAllVenues ? venues : venues.filter(v => v.id === selectedVenue);
            const usedStaffIds = new Set<string>();

            // 4. Distribute (Target-Capped Logic)
            targetVenues.forEach(venue => {
                // Calculate Existing Total for Venue
                let venueExistingTotal = 0;
                const venueExistingLevels: { [key: number]: number } = {};

                existingPostings.forEach(p => {
                    const matchesAssignment = Array.isArray(p.assignments) && p.assignments.includes(assignmentName);
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

                // Determine Effective Target
                const effectiveTarget = targetQuota > 0 ? targetQuota : totalStaffRequired;

                let venueNeeded = Math.max(0, effectiveTarget - venueExistingTotal);
                if (venueNeeded <= 0) return; // Venue full

                // Get configured levels and SHUFFLE them to ensure fair distribution for loose targets
                const activeLevels = Object.entries(conraissConfig)
                    .filter(([_, count]) => count > 0)
                    .map(([lvl, count]) => ({ level: parseInt(lvl), limit: count }));

                const shuffledLevels = shuffle(activeLevels);

                for (const config of shuffledLevels) {
                    if (venueNeeded <= 0) break;

                    const levelExisting = venueExistingLevels[config.level] || 0;
                    // How many can we add for this level specifically?
                    const levelSpace = Math.max(0, config.limit - levelExisting);

                    // Add minimum of (VenueNeed, LevelLimit)
                    const countToAdd = Math.min(venueNeeded, levelSpace);

                    if (countToAdd > 0) {
                        let addedForLevel = 0;
                        const pool = staffByLevel[config.level] || [];

                        for (const staff of pool) {
                            if (addedForLevel >= countToAdd) break;
                            if (!usedStaffIds.has(staff.id)) {
                                usedStaffIds.add(staff.id);

                                const currentCount = staff.count || 0;
                                const toBePosted = Math.max(0, currentCount - 1);

                                newPostings.push({
                                    file_no: staff.file_no,
                                    name: staff.name,
                                    station: staff.station,
                                    conraiss: staff.conraiss,
                                    year: new Date().getFullYear().toString(),
                                    count: currentCount,
                                    posted_for: 1,
                                    to_be_posted: toBePosted,
                                    assignments: [assignmentName],
                                    mandates: [targetMandate],
                                    assignment_venue: [venue.name],
                                });
                                addedForLevel++;
                            }
                        }

                        venueNeeded -= addedForLevel;
                    }
                }
            });

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
            <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#0b1015] p-6 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 overflow-y-auto w-full max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">Generated Preview ({generatedPostings.length})</h2>
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
                            <thead className="bg-slate-50 dark:bg-[#0f161d] text-xs uppercase font-bold text-slate-500 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-3">File No</th>
                                    <th className="p-3">Name</th>
                                    <th className="p-3">CON</th>
                                    <th className="p-3">Station</th>
                                    <th className="p-3">Venue</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-gray-800 text-sm">
                                {generatedPostings.map((p, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                        <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">{p.file_no}</td>
                                        <td className="p-3">{p.name}</td>
                                        <td className="p-3">{p.conraiss}</td>
                                        <td className="p-3">{p.station}</td>
                                        <td className="p-3 font-medium text-purple-600 dark:text-purple-400">{p.assignment_venue?.[0]}</td>
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
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#0b1015] p-6 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 overflow-y-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400 drop-shadow-sm">
                    Random Post Generator
                </h1>
                <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">
                    Configure quotas and randomly assign staff to venues.
                </p>
            </div>

            <div className="flex flex-col gap-6 max-w-5xl">
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
                                className="w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700"
                                value={selectedAssignment}
                                onChange={e => setSelectedAssignment(e.target.value)}
                            >
                                <option value="">Select Assignment</option>
                                {assignments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Mandate</label>
                            <select
                                className="w-full h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700"
                                value={selectedMandate}
                                onChange={e => setSelectedMandate(e.target.value)}
                            >
                                <option value="">Select Mandate</option>
                                {mandates.map(m => <option key={m.id} value={m.mandate}>{m.mandate}</option>)}
                            </select>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-bold uppercase text-slate-500">Venue</label>
                                <button
                                    onClick={() => setIsStationModalOpen(true)}
                                    className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded hover:bg-emerald-100 transition-colors"
                                >
                                    Pick Station
                                </button>
                            </div>
                            <div className="flex gap-2 min-w-0">
                                <select
                                    className="flex-1 w-full min-w-0 h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 disabled:opacity-50 text-ellipsis"
                                    value={selectedVenue}
                                    onChange={e => setSelectedVenue(e.target.value)}
                                    disabled={isAllVenues}
                                >
                                    <option value="">Select Venue</option>
                                    {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
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
                            <div className={`text-sm font-bold px-3 py-2 rounded-lg flex flex-col items-center border ${totalStaffRequired === targetQuota ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                                <span className="text-[10px] uppercase opacity-70">Current</span>
                                <span className="text-lg">{totalStaffRequired}</span>
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
                            Generate Random List
                        </>
                    )}
                </button>
            </div>

            <StationTypeSelectionModal
                isOpen={isStationModalOpen}
                onClose={() => setIsStationModalOpen(false)}
                onSelect={handleStationTypeSelect}
            />
        </div>
    );
};

export default RandomPost;
