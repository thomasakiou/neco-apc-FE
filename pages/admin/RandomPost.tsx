import React, { useState, useEffect } from 'react';
import { getAllAPCRecords } from '../../services/apc';
import { getAllAssignments } from '../../services/assignment';
import { getAllMandates } from '../../services/mandate';
import { getAllMarkingVenues } from '../../services/markingVenue';
import { bulkCreatePostings } from '../../services/posting';
import { APCRecord } from '../../types/apc';
import { Assignment } from '../../types/assignment';
import { Mandate } from '../../types/mandate';
import { MarkingVenue } from '../../types/markingVenue';
import { PostingCreate } from '../../types/posting';
import { assignmentFieldMap } from '../../services/personalizedPost';
import AlertModal from '../../components/AlertModal';
import StationTypeSelectionModal from '../../components/StationTypeSelectionModal';
import { getAllSchools } from '../../services/school';
import { getAllNCEECenters } from '../../services/nceeCenter';
import { getAllBECECustodians, getAllSSCECustodians } from '../../services/custodianSpecific';
import { getAllStates } from '../../services/state';

const RandomPost: React.FC = () => {
    // Data States
    const [allAPC, setAllAPC] = useState<APCRecord[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [mandates, setMandates] = useState<Mandate[]>([]);
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
    const [conraissConfig, setConraissConfig] = useState<{ [key: number]: number }>({
        6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0
    });

    // Generated Preview
    const [generatedPostings, setGeneratedPostings] = useState<PostingCreate[]>([]);
    const [previewMode, setPreviewMode] = useState(false);

    const [alert, setAlert] = useState<{ isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'warning' }>({
        isOpen: false, title: '', message: '', type: 'success'
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [apcData, assignmentsData, mandatesData, venuesData] = await Promise.all([
                getAllAPCRecords(),
                getAllAssignments(),
                getAllMandates(),
                getAllMarkingVenues()
            ]);
            setAllAPC(apcData);
            setAssignments(assignmentsData);
            setMandates(mandatesData);
            // Default to Marking Venues
            setVenues(venuesData.map(v => ({ id: v.id, name: v.name, type: 'marking_venue' })));
        } catch (error) {
            console.error("Failed to load initial data", error);
            showAlert('Error', 'Failed to load initial data.', 'error');
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
            setIsAllVenues(false); // Reset "All" toggle when list changes? Or keep it? Safer to reset.

            showAlert('Station Loaded', `Loaded ${options.length} stations.`, 'success');
        } catch (error) {
            console.error('Failed to load stations', error);
            showAlert('Error', 'Failed to load stations', 'error');
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
            showAlert('Validation Error', 'Please select an Assignment and Mandate.', 'warning');
            return;
        }

        if (!selectedVenue && !isAllVenues) {
            showAlert('Validation Error', 'Please select a Venue or check "All Venues".', 'warning');
            return;
        }

        if (totalStaffRequired === 0) {
            showAlert('Validation Error', 'Please configure the number of staff required.', 'warning');
            return;
        }

        setLoading(true);

        // Allow UI to update before heavy calculation
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            // 1. Filter Eligible Staff based on Assignment
            const assignmentName = assignments.find(a => a.id === selectedAssignment)?.name || selectedAssignment;
            const apcField = assignmentFieldMap[assignmentName];

            const eligibleStaff = allAPC.filter(staff => {
                if (!staff.active) return false;
                if (apcField) {
                    const val = staff[apcField as keyof APCRecord];
                    return !!val;
                }
                return true;
            });

            // Group staff by CONRAISS for O(1) access
            const staffByLevel: { [key: number]: APCRecord[] } = {};
            eligibleStaff.forEach(s => {
                const lvl = parseInt(s.conraiss);
                if (!staffByLevel[lvl]) staffByLevel[lvl] = [];
                staffByLevel[lvl].push(s);
            });

            // Shuffle each level pool once
            const shuffle = <T,>(array: T[]): T[] => array.sort(() => Math.random() - 0.5);
            Object.keys(staffByLevel).forEach(key => {
                const lvl = parseInt(key);
                staffByLevel[lvl] = shuffle(staffByLevel[lvl]);
            });

            const newPostings: PostingCreate[] = [];
            const targetVenues = isAllVenues ? venues : venues.filter(v => v.id === selectedVenue);
            const usedStaffIds = new Set<string>();

            // 2. Distribute
            targetVenues.forEach(venue => {
                Object.entries(conraissConfig).forEach(([levelStr, count]) => {
                    const level = parseInt(levelStr);
                    if (count <= 0) return;

                    let addedCount = 0;
                    const pool = staffByLevel[level] || []; // already shuffled

                    // Iterate through pool ensuring uniqueness
                    // Since we iterate venues typically, we can just consume from the pool pointer-style or filter used
                    // Filtering used is safer if we want strict global uniqueness for this batch

                    // Optimization: We can just loop through pool and pick unmatched
                    // To avoid O(N) filter every time, let's keep a pointer if possible? 
                    // But "usedStaffIds" is global for this batch.
                    // Simpler efficient approach: Just find first N unused

                    for (const staff of pool) {
                        if (addedCount >= count) break;
                        if (!usedStaffIds.has(staff.id)) {
                            usedStaffIds.add(staff.id);
                            newPostings.push({
                                file_no: staff.file_no,
                                name: staff.name,
                                station: staff.station,
                                conraiss: staff.conraiss,
                                year: new Date().getFullYear().toString(),
                                count: staff.count || 0,
                                posted_for: 1,
                                to_be_posted: 0,
                                assignments: [assignmentName],
                                mandates: [mandates.find(m => m.id === selectedMandate)?.mandate || selectedMandate],
                                assignment_venue: [venue.name],
                            });
                            addedCount++;
                        }
                    }
                });
            });

            setGeneratedPostings(newPostings);
            setLoading(false); // Unset loading BEFORE setting preview mode to ensure UI responsiveness

            if (newPostings.length > 0) {
                setPreviewMode(true);
            } else {
                showAlert('Generation Result', 'No staff matched criteria.', 'info');
            }

            if (newPostings.length > 0 && newPostings.length < totalStaffRequired * targetVenues.length) {
                showAlert('Generation Result', `Generated ${newPostings.length} records. Some quotas could not be fully met due to staff shortage.`, 'warning');
            }

        } catch (e) {
            console.error("Error generating postings", e);
            setLoading(false);
            showAlert('Error', 'An error occurred during generation.', 'error');
        }
    };

    const handleSave = async () => {
        if (generatedPostings.length === 0) return;
        setLoading(true);
        try {
            await bulkCreatePostings({ items: generatedPostings });
            showAlert('Success', `Successfully posted ${generatedPostings.length} staff!`, 'success');
            setGeneratedPostings([]);
            setPreviewMode(false);
        } catch (error: any) {
            console.error("Save failed", error);
            showAlert('Error', `Failed to save postings: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning') => {
        setAlert({ isOpen: true, title, message, type });
    };

    if (previewMode) {
        return (
            <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#0b1015] p-6 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 overflow-y-auto w-full max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">Generated Preview ({generatedPostings.length})</h2>
                    <div className="flex gap-3">
                        <button onClick={() => setPreviewMode(false)} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold">Back to Config</button>
                        <button onClick={handleSave} className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-emerald-700">Confirm & Post</button>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#121b25] rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 dark:bg-[#0f161d] text-xs uppercase font-bold text-slate-500">
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
                <AlertModal isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title={alert.title} message={alert.message} type={alert.type} />
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
                            <div className="flex gap-2">
                                <select
                                    className="flex-1 h-11 px-3 rounded-xl border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 disabled:opacity-50"
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
                        <div className="text-sm font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                            Total: <span className="text-emerald-600 text-lg">{totalStaffRequired}</span> Staff
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

            <AlertModal isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title={alert.title} message={alert.message} type={alert.type} />

            <StationTypeSelectionModal
                isOpen={isStationModalOpen}
                onClose={() => setIsStationModalOpen(false)}
                onSelect={handleStationTypeSelect}
            />
        </div>
    );
};

export default RandomPost;
