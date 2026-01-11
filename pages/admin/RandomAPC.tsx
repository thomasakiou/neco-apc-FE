import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllAssignments } from '../../services/assignment';
import { getAllMandates } from '../../services/mandate';
import {
    getEligibleStaffForAPC,
    getAllAPCRecords,
    getAssignmentLimit,
    getAssignmentUsage,
    updateAPC,
    createAPC
} from '../../services/apc';
import { assignmentFieldMap } from '../../services/personalizedPost';
import { Assignment } from '../../types/assignment';
import { Mandate } from '../../types/mandate';
import { APCCreate } from '../../types/apc';
import AlertModal from '../../components/AlertModal';

const RandomAPC: React.FC = () => {
    const navigate = useNavigate();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [availableMandates, setAvailableMandates] = useState<Mandate[]>([]);
    const [selectedAssignment, setSelectedAssignment] = useState('');
    const [selectedMandate, setSelectedMandate] = useState('');
    const [countNeeded, setCountNeeded] = useState(1);
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<{ total: number; slots: number; breakdown: Record<string, number> } | null>(null);

    // NEW FILTERS
    const [selectedStations, setSelectedStations] = useState<string[]>([]);
    const [educationOnly, setEducationOnly] = useState(false);
    const [uniqueStations, setUniqueStations] = useState<string[]>([]);

    const [alertModal, setAlertModal] = useState<{
        isOpen: boolean;
        title: string;
        message?: string;
        type: 'success' | 'error' | 'warning' | 'info';
    }>({ isOpen: false, title: '', type: 'info' });

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const data = await getAllAssignments(true);
                setAssignments(data);

                const [eligibleStaff, allAPC] = await Promise.all([
                    getEligibleStaffForAPC(),
                    getAllAPCRecords(false, true)
                ]);

                const apcMap = new Map(allAPC.map(r => [r.file_no, r]));
                let totalSlots = 0;
                const breakdown: Record<string, number> = {};

                eligibleStaff.forEach(s => {
                    const limit = getAssignmentLimit(s.conr);
                    const apcRec = apcMap.get(s.fileno);
                    const usage = apcRec ? getAssignmentUsage(apcRec) : 0;
                    const remaining = Math.max(0, limit - usage);

                    if (remaining > 0) {
                        totalSlots += remaining;
                        const conr = s.conr || 'Unknown';
                        breakdown[conr] = (breakdown[conr] || 0) + remaining;
                    }
                });

                setSummary({ total: eligibleStaff.length, slots: totalSlots, breakdown });

                // Extract unique stations
                const stations = new Set(eligibleStaff.map(s => s.station).filter(Boolean) as string[]);
                setUniqueStations(Array.from(stations).sort());
            } catch (e) {
                console.error("Failed to load data", e);
            }
        };
        loadInitialData();
    }, []);

    useEffect(() => {
        if (selectedAssignment) {
            const assignment = assignments.find(a => a.code === selectedAssignment);
            if (assignment) {
                getAllMandates().then(mandates => {
                    const filtered = mandates.filter(m => assignment.mandates?.includes(m.code));
                    setAvailableMandates(filtered);
                });
            }
        } else {
            setAvailableMandates([]);
        }
    }, [selectedAssignment, assignments]);

    const handleGenerate = async () => {
        if (!selectedAssignment || countNeeded <= 0) return;
        setLoading(true);
        try {
            const [eligibleStaff, allAPC] = await Promise.all([
                getEligibleStaffForAPC(),
                getAllAPCRecords(false, true)
            ]);

            const apcMap = new Map(allAPC.map(r => [r.file_no, r]));
            const fieldName = assignmentFieldMap[selectedAssignment];

            if (!fieldName) throw new Error(`Invalid assignment code: ${selectedAssignment}`);

            // Filter for staff with remaining slots AND match new criteria
            const availableStaff = eligibleStaff.filter(s => {
                const limit = getAssignmentLimit(s.conr);
                const apcRec = apcMap.get(s.fileno);
                const usage = apcRec ? getAssignmentUsage(apcRec) : 0;
                if (limit - usage <= 0) return false;

                // Station filter
                if (selectedStations.length > 0 && !selectedStations.includes(s.station || '')) return false;

                // Education filter
                if (educationOnly && !s.is_education) return false;

                return true;
            });

            if (availableStaff.length < countNeeded) {
                throw new Error(`Only ${availableStaff.length} eligible staff available, but ${countNeeded} requested.`);
            }

            // Shuffle
            const shuffled = [...availableStaff].sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, countNeeded);

            // Resolve selectedMandate (which is a code) to its Name for saving
            const mandateRecord = availableMandates.find(m => m.code === selectedMandate);
            const val = mandateRecord ? mandateRecord.mandate : (selectedMandate || 'Post');

            let successCount = 0;

            for (const staff of selected) {
                const existing = apcMap.get(staff.fileno);
                const limit = getAssignmentLimit(staff.conr);
                if (existing) {
                    const { id, created_at, updated_at, created_by, updated_by, ...clean } = existing;
                    await updateAPC(id, { ...clean, [fieldName]: val, count: limit });
                } else {
                    const newRecord: APCCreate = {
                        file_no: staff.fileno,
                        name: staff.full_name,
                        conraiss: staff.conr,
                        station: staff.station,
                        qualification: staff.qualification,
                        sex: staff.sex,
                        count: limit,
                        active: true,
                        year: new Date().getFullYear().toString(),
                        [fieldName]: val
                    };
                    await createAPC(newRecord);
                }
                successCount++;
            }

            setAlertModal({
                isOpen: true,
                title: 'Generation Complete',
                message: `Successfully assigned ${successCount} staff to ${selectedAssignment}.`,
                type: 'success'
            });
        } catch (error: any) {
            setAlertModal({
                isOpen: true,
                title: 'Generation Failed',
                message: error.message || 'An error occurred during generation',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#101922] p-4 md:p-8 gap-8 overflow-y-auto">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/admin/apc/list')}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a2530] border border-slate-200 dark:border-gray-800 text-slate-600 dark:text-slate-400 hover:text-primary transition-all shadow-sm"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 to-teal-800 dark:from-emerald-400 dark:to-teal-500 tracking-tight">
                        Random APC Generation
                    </h1>
                    <p className="text-sm md:text-base lg:text-lg text-slate-500 dark:text-slate-400 font-medium">Algorithm-Based Assignment Distribution</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 flex flex-col gap-8">
                    <div className="bg-white dark:bg-[#121b25] p-8 rounded-3xl border border-slate-100 dark:border-gray-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
                        <h2 className="text-lg font-black text-slate-800 dark:text-slate-200 mb-6 uppercase italic">Generation Criteria</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Assignment</label>
                                <select
                                    value={selectedAssignment}
                                    onChange={(e) => setSelectedAssignment(e.target.value)}
                                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] font-bold text-sm text-slate-700 dark:text-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                                >
                                    <option value="" className="bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-200">Select Assignment</option>
                                    {assignments.map(a => <option key={a.id} value={a.code} className="bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-200">{a.name}</option>)}
                                </select>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mandate Restriction (Optional)</label>
                                <select
                                    value={selectedMandate}
                                    onChange={(e) => setSelectedMandate(e.target.value)}
                                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] font-bold text-sm text-slate-700 dark:text-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                                >
                                    <option value="" className="bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-200">Full Post (No Specific Mandate)</option>
                                    {availableMandates.map(m => <option key={m.id} value={m.code} className="bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-200">{m.mandate}</option>)}
                                </select>
                            </div>

                            <div className="flex flex-col gap-2 md:col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff Count Required</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={countNeeded}
                                    onChange={(e) => setCountNeeded(parseInt(e.target.value) || 0)}
                                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] font-bold text-sm text-slate-700 dark:text-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                                    placeholder="Enter number of staff to assign"
                                />
                            </div>

                            {/* NEW FILTERS SECTION */}
                            <div className="md:col-span-2 pt-4 border-t border-slate-100 dark:border-gray-800 mt-2">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Optional Filters</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter by Station(s)</label>
                                        <select
                                            multiple
                                            value={selectedStations}
                                            onChange={(e) => setSelectedStations(Array.from(e.target.selectedOptions, (opt: HTMLOptionElement) => opt.value))}
                                            className="w-full h-28 px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] font-bold text-sm text-slate-700 dark:text-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                                        >
                                            {uniqueStations.map(st => <option key={st} value={st} className="bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-200">{st}</option>)}
                                        </select>
                                        <p className="text-[9px] text-slate-400 italic">Hold Ctrl/Cmd to select multiple. Leave empty for all.</p>
                                    </div>
                                    <div className="flex flex-col justify-center gap-2">
                                        <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] cursor-pointer hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-gray-600 transition-all">
                                            <input
                                                type="checkbox"
                                                checked={educationOnly}
                                                onChange={(e) => setEducationOnly(e.target.checked)}
                                                className="w-5 h-5 rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            />
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Education Staff Only</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-gray-800">
                            <button
                                onClick={handleGenerate}
                                disabled={loading || !selectedAssignment || countNeeded <= 0 || (summary && countNeeded > summary.slots)}
                                className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-400 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                            >
                                {loading ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : <span className="material-symbols-outlined">casino</span>}
                                {summary && countNeeded > summary.slots ? 'INSUFFICIENT ELIGIBLE STAFF' : (loading ? 'GENERATING ASSIGNMENTS...' : 'START RANDOM GENERATION')}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-8">
                    {summary ? (
                        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-500">
                                <span className="material-symbols-outlined text-9xl">analytics</span>
                            </div>

                            <h2 className="text-xl font-black italic uppercase mb-8 relative z-10">Eligible Pool</h2>

                            <div className="flex flex-col gap-8 relative z-10">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 mb-1">Total Available Slots</p>
                                    <p className="text-5xl font-black">{summary.slots}</p>
                                </div>

                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 mb-1">Eligible Individuals</p>
                                    <p className="text-2xl font-bold">{summary.total} <span className="text-xs text-indigo-400 font-medium lowercase">active staff</span></p>
                                </div>

                                <div className="pt-6 border-t border-white/10">
                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-300 mb-4 italic">Breakdown by Conraiss Slots</p>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(summary.breakdown).map(([conr, count]) => (
                                            <div key={conr} className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-xs font-black">
                                                {conr}: <span className="text-indigo-300">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-64 rounded-3xl bg-slate-100 dark:bg-[#121b25] animate-pulse flex items-center justify-center">
                            <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Summary...</span>
                        </div>
                    )}

                    <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-3xl border border-amber-100 dark:border-amber-800/50">
                        <div className="flex items-center gap-3 mb-4 text-amber-600 dark:text-amber-400">
                            <span className="material-symbols-outlined">rule</span>
                            <h3 className="font-bold uppercase italic text-sm">Eligibility Rules</h3>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex gap-2 text-[11px] font-medium text-amber-800 dark:text-amber-200/70">
                                <span className="material-symbols-outlined text-xs mt-0.5">check_circle</span>
                                Staff must be in ACTIVE status
                            </li>
                            <li className="flex gap-2 text-[11px] font-medium text-amber-800 dark:text-amber-200/70">
                                <span className="material-symbols-outlined text-xs mt-0.5">cancel</span>
                                Directors, HODs, State Coordinators, Secretaries & Others are excluded
                            </li>
                            <li className="flex gap-2 text-[11px] font-medium text-amber-800 dark:text-amber-200/70">
                                <span className="material-symbols-outlined text-xs mt-0.5">hourglass_empty</span>
                                Must have remaining assignment slots based on CONRAISS
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <AlertModal
                {...alertModal}
                onClose={() => {
                    setAlertModal(prev => ({ ...prev, isOpen: false }));
                    if (alertModal.type === 'success') navigate('/admin/apc/list');
                }}
            />
        </div>
    );
};

export default RandomAPC;
