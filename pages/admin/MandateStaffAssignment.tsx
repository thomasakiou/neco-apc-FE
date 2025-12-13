import React, { useEffect, useState } from 'react';
import { getAllAssignments } from '../../services/assignment';
import { getAssignmentBoardData, bulkSaveAssignments } from '../../services/mandateStaffAssignment';
import { getAllStates } from '../../services/state';
import { Assignment } from '../../types/assignment';
import { AssignmentBoardData, StaffMandateAssignment, MandateColumn as MandateColumnType } from '../../types/apc';
import { State } from '../../types/state';
import { MandateColumn } from '../../components/MandateColumn';
import AlertModal from '../../components/AlertModal';
import CsvUploadModal from '../../components/CsvUploadModal';

const MandateStaffAssignment: React.FC = () => {
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
    const [selectedMandateId, setSelectedMandateId] = useState<string>('');
    const [selectedStationId, setSelectedStationId] = useState<string>('');
    const [stationOptions, setStationOptions] = useState<{id: string; name: string; type: string}[]>([]);
    const [boardData, setBoardData] = useState<AssignmentBoardData | null>(null);
    const [loading, setLoading] = useState(false);

    // State Tracking
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<{ staffId: string; action: 'add' | 'remove' | 'move'; targetMandateId: string | null }[]>([]);

    // Search States
    const [sourceSearch, setSourceSearch] = useState('');
    const [targetSearch, setTargetSearch] = useState('');

    // Modals
    const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
    const [alert, setAlert] = useState<{ open: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' }>({
        open: false,
        title: '',
        message: '',
        type: 'success'
    });

    useEffect(() => {
        loadAssignments();
        loadStationOptions();
    }, []);

    useEffect(() => {
        if (selectedAssignmentId) {
            loadBoardData(selectedAssignmentId);
        } else {
            setBoardData(null);
            setHasUnsavedChanges(false);
            setPendingChanges([]);
            setSelectedMandateId('');
        }
    }, [selectedAssignmentId]);

    const loadAssignments = async () => {
        try {
            const data = await getAllAssignments();
            setAssignments(data.filter(a => a.active));
        } catch (error) {
            console.error('Failed to load assignments', error);
        }
    };

    const loadStationOptions = async () => {
        try {
            // Load all possible stations
            const [states, ssceCustodians, beceCustodians, nceeCenters, markingVenues] = await Promise.all([
                getAllStates(),
                // Add API calls for custodians, centers, venues
            ]);
            
            const options = [
                ...states.map(s => ({id: s.id, name: s.name, type: 'state'})),
                // Add other station types
            ];
            setStationOptions(options);
        } catch (error) {
            console.error('Failed to load station options', error);
        }
    };

    const loadBoardData = async (assignmentId: string) => {
        setLoading(true);
        try {
            const assignment = assignments.find(a => a.id === assignmentId);
            if (!assignment) {
                console.error('Assignment not found:', assignmentId);
                return;
            }
            const data = await getAssignmentBoardData(assignment);
            setBoardData(data);
            setHasUnsavedChanges(false);
            setPendingChanges([]);
        } catch (error) {
            console.error('Failed to load board data', error);
            showAlert('Error', 'Failed to load assignment board', 'error');
            setSelectedAssignmentId(''); // Clear assignment on error
        } finally {
            setLoading(false);
        }
    };

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning') => {
        setAlert({ open: true, title, message, type });
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const onDrop = async (e: React.DragEvent, targetColumnId: string) => {
        e.preventDefault();
        const staffData = e.dataTransfer.getData('application/json');
        if (!staffData || !boardData) return;

        const staff: StaffMandateAssignment = JSON.parse(staffData);

        // Define Source ID based on current location of staff
        // Note: Staff object comes with mandate_id it currently has.
        // If coming from left (Unassigned), mandate_id is null.
        // If coming from right (Selected Mandate), mandate_id matches selectedMandateId.

        // Prevent drop on same column logic handled in handleLocalMove implicitly or check here
        const currentMandateId = staff.mandate_id || 'unassigned';
        if (currentMandateId === targetColumnId) return;

        // Apply Local Change
        handleLocalMove(staff, targetColumnId);
    };

    const handleLocalMove = (staff: StaffMandateAssignment, targetColumnId: string) => {
        if (!boardData) return;

        // Clone state
        const newBoardData = { ...boardData };
        let action: 'move' | 'add' | 'remove' = 'move';

        // targetColumnId is either 'unassigned' (Left Box) or the actual Mandate ID (Right Box)

        // 1. Remove from Source
        if (!staff.mandate_id) {
            // Unassigned -> Mandate (Add)
            newBoardData.unassignedStaff = newBoardData.unassignedStaff.filter(s => s.id !== staff.id);
            action = 'add';
        } else {
            // Mandate -> Unassigned (Remove)
            // Or Mandate -> Mandate (Move) - though in this 2-box UI, we only move between specific mandate and unassigned
            const oldCol = newBoardData.mandateColumns.find(c => c.id === staff.mandate_id);
            if (oldCol) {
                oldCol.staff = oldCol.staff.filter(s => s.id !== staff.id);
            }
            if (targetColumnId === 'unassigned') action = 'remove';
        }

        // 2. Add to Target
        const updatedStaff = {
            ...staff,
            mandate_id: targetColumnId === 'unassigned' ? null : targetColumnId,
            pendingAction: action
        };

        if (targetColumnId === 'unassigned') {
            newBoardData.unassignedStaff.push(updatedStaff);
        } else {
            const newCol = newBoardData.mandateColumns.find(c => c.id === targetColumnId);
            if (newCol) {
                newCol.staff.push(updatedStaff);
            }
        }

        setBoardData(newBoardData);
        setHasUnsavedChanges(true);

        setPendingChanges(prev => [...prev, {
            staffId: staff.id,
            staff: updatedStaff,
            action,
            targetMandateId: targetColumnId === 'unassigned' ? null : targetColumnId
        }]);
    };

    const handleSaveChanges = async () => {
        if (!boardData || pendingChanges.length === 0) return;
        if (!selectedStationId) {
            showAlert('Error', 'Please select a station before saving.', 'error');
            return;
        }
        
        const currentAssignment = assignments.find(a => a.id === selectedAssignmentId);
        if (!currentAssignment) return;

        setLoading(true);
        try {
            // Include station information in save payload
            const savePayload = {
                assignment: currentAssignment,
                mandate: selectedColumn,
                station: stationOptions.find(s => s.id === selectedStationId),
                changes: pendingChanges
            };
            
            await bulkSaveAssignments(savePayload as any);
            showAlert('Success', 'Staff posted successfully!', 'success');
            await loadBoardData(selectedAssignmentId);
        } catch (error) {
            console.error('Save failed', error);
            showAlert('Error', 'Failed to save posting', 'error');
            setLoading(false);
        }
    };

    const handleCsvUpload = (data: { staffNo: string; mandateCode?: string }[]) => {
        if (!boardData || !selectedMandateId) {
            showAlert('Import Error', 'Please select a mandate first.', 'error');
            return;
        }
        
        if (!selectedStationId) {
            showAlert('Import Error', 'Please select a station for this mandate.', 'error');
            return;
        }

        let changesCount = 0;
        const newBoardData = { ...boardData };
        const newPendingChanges = [...pendingChanges];
        const targetCol = newBoardData.mandateColumns.find(c => c.id === selectedMandateId);
        if (!targetCol) return;

        data.forEach(row => {
            // Find in unassigned pool first
            let staff = newBoardData.unassignedStaff.find(s => s.staff_no.toLowerCase() === row.staffNo.toLowerCase());
            let currentMandateId: string | null = null;

            if (!staff) {
                // If not in unassigned, check other mandates (maybe moving from another mandate to this one?)
                // In this 2-box view, we might restricted to only unassigned, but let's allow "stealing" from other mandates implicitly
                for (const col of newBoardData.mandateColumns) {
                    const s = col.staff.find(st => st.staff_no.toLowerCase() === row.staffNo.toLowerCase());
                    if (s) {
                        staff = s;
                        currentMandateId = col.id;
                        break;
                    }
                }
            }

            if (staff) {
                if (currentMandateId === selectedMandateId) return; // Already here

                // Remove from Source
                if (!currentMandateId) {
                    newBoardData.unassignedStaff = newBoardData.unassignedStaff.filter(s => s.id !== staff!.id);
                } else {
                    const oldCol = newBoardData.mandateColumns.find(c => c.id === currentMandateId);
                    if (oldCol) oldCol.staff = oldCol.staff.filter(s => s.id !== staff!.id);
                }

                // Add to Target (Selected Mandate)
                const updatedStaff = { ...staff, mandate_id: selectedMandateId, pendingAction: 'add' as const }; // Or move
                targetCol.staff.push(updatedStaff);

                newPendingChanges.push({
                    staffId: staff.id,
                    staff: updatedStaff,
                    action: !currentMandateId ? 'add' : 'move',
                    targetMandateId: selectedMandateId
                });
                changesCount++;
            }
            // Else: Staff not found in the system at all - currently ignored, or could alert
        });

        if (changesCount > 0) {
            setBoardData(newBoardData);
            setPendingChanges(newPendingChanges);
            setHasUnsavedChanges(true);
            showAlert('Import Successful', `Added ${changesCount} staff to ${targetCol.code}.`, 'success');
        } else {
            showAlert('Import Info', 'No matching available staff found to add.', 'warning');
        }
    };

    // Get selected column for station dropdown check
    const selectedColumn = boardData?.mandateColumns.find(c => c.id === selectedMandateId);
    
    // Filter stations based on mandate station type
    const getFilteredStations = () => {
        if (!selectedColumn?.station) return [];
        const stationType = selectedColumn.station.toLowerCase();
        
        if (stationType === 'state') {
            return stationOptions.filter(s => s.type === 'state');
        } else if (stationType.includes('custodian')) {
            return stationOptions.filter(s => s.type.includes('custodian'));
        } else if (stationType.includes('ncee')) {
            return stationOptions.filter(s => s.type === 'ncee');
        } else if (stationType.includes('marking')) {
            return stationOptions.filter(s => s.type === 'marking');
        }
        return stationOptions;
    };
    
    // Filter Logic
    const filteredSource = boardData?.unassignedStaff.filter(s => {
        // First apply search filter
        const matchesSearch = s.staff_name.toLowerCase().includes(sourceSearch.toLowerCase()) ||
            s.staff_no.toLowerCase().includes(sourceSearch.toLowerCase());
        
        if (!matchesSearch) return false;
        
        // If a mandate is selected and has a station filter, apply station-based filtering
        if (selectedMandateId && selectedColumn?.station) {
            const mandateStation = selectedColumn.station.toLowerCase();
            const staffStation = s.current_station?.toLowerCase() || '';
            
            // Match staff station with mandate station requirement
            if (mandateStation === 'state') {
                // For 'State' station, show all staff
                return true;
            } else if (mandateStation.includes('custodian')) {
                // For custodian stations, match station type
                return staffStation.includes('custodian') && staffStation.includes(mandateStation.split(' ')[0]);
            } else {
                // For other station types, show all staff (remove strict filtering)
                return true;
            }
        }
        
        return true;
    }) || [];

    const filteredTarget = selectedColumn?.staff.filter(s =>
        s.staff_name.toLowerCase().includes(targetSearch.toLowerCase()) ||
        s.staff_no.toLowerCase().includes(targetSearch.toLowerCase())
    ) || [];


    return (
        <div className="h-full flex flex-col bg-slate-50/50 dark:bg-[#101922] transition-colors duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-[#121b25] shadow-sm flex flex-col gap-4 transition-colors">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-200 flex items-center gap-3">
                            Personalized Posting
                            {hasUnsavedChanges && (
                                <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full border border-amber-200 animate-pulse">
                                    Unsaved Changes
                                </span>
                            )}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Assign staff to specific mandates manually</p>
                    </div>
                    <button
                        onClick={handleSaveChanges}
                        disabled={!hasUnsavedChanges}
                        className="h-10 px-6 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:shadow-none"
                    >
                        <span className="material-symbols-outlined text-lg">save</span>
                        Save Changes
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-4 w-full">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">1. Select Assignment</label>
                        <select
                            value={selectedAssignmentId}
                            onChange={(e) => setSelectedAssignmentId(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-sm text-slate-700 dark:text-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium"
                        >
                            <option value="">-- Select Assignment --</option>
                            {assignments.map(assign => (
                                <option key={assign.id} value={assign.id}>{assign.name} ({assign.code})</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">2. Select Mandate</label>
                        <select
                            value={selectedMandateId}
                            onChange={(e) => {
                                setSelectedMandateId(e.target.value);
                                setSelectedStationId('');
                            }}
                            disabled={!selectedAssignmentId || !boardData}
                            className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-sm text-slate-700 dark:text-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium disabled:opacity-50"
                        >
                            <option value="">-- Select Mandate --</option>
                            {boardData?.mandateColumns.filter(col => col.active === true).map(col => (
                                <option key={col.id} value={col.id}>{col.title} ({col.code})</option>
                            ))}
                        </select>
                    </div>
                    {selectedMandateId && (
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-500 mb-1">3. Select Station</label>
                            <select
                                value={selectedStationId}
                                onChange={(e) => setSelectedStationId(e.target.value)}
                                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-sm text-slate-700 dark:text-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium"
                            >
                                <option value="">-- Select Station --</option>
                                {getFilteredStations().map(station => (
                                    <option key={station.id} value={station.id}>{station.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* 2-Column Board Area */}
            <div className="flex-1 p-6 overflow-hidden">
                {!selectedAssignmentId ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-4 opacity-60">
                        <span className="material-symbols-outlined text-6xl">assignment_ind</span>
                        <p className="text-xl font-bold">Select an Assignment to begin</p>
                    </div>
                ) : loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-emerald-600 gap-3">
                        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                        <p className="text-sm font-bold animate-pulse">Loading data...</p>
                    </div>
                ) : (
                    <div className="flex h-full gap-8">
                        {/* Left Column: Source / Unassigned */}
                        <div className="flex-1 flex flex-col h-full min-w-0"> {/* min-w-0 for truncate consistency */}
                            <div className="mb-2 flex justify-between items-end">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200">Eligible Staff (Source)</h3>
                                <span className="text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
                                    {boardData?.unassignedStaff.length}
                                </span>
                            </div>
                            <div className="mb-3 relative">
                                <span className="material-symbols-outlined absolute left-2 top-2 text-slate-400 text-lg">search</span>
                                <input
                                    type="text"
                                    placeholder="Search eligible staff..."
                                    value={sourceSearch}
                                    onChange={(e) => setSourceSearch(e.target.value)}
                                    className="w-full h-8 pl-8 pr-3 rounded-md border border-slate-300 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-sm text-slate-700 dark:text-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>

                            {/* We reuse MandateColumn but constrained to this layout */}
                            <div className="flex-1 overflow-hidden rounded-xl border border-dashed border-slate-300 dark:border-gray-700 bg-slate-50 dark:bg-slate-900/30">
                                <MandateColumn
                                    columnId="unassigned"
                                    title="Unassigned Pool"
                                    subtitle="Drag staff from here"
                                    staffList={filteredSource}
                                    onDragOver={onDragOver}
                                    onDrop={onDrop}
                                    colorTheme="slate"
                                />
                            </div>
                        </div>

                        {/* Center Icon */}
                        <div className="flex flex-col justify-center gap-2 text-slate-300 dark:text-slate-600">
                            <span className="material-symbols-outlined text-4xl">arrow_forward</span>
                            <span className="material-symbols-outlined text-4xl rotate-180">arrow_forward</span>
                        </div>

                        {/* Right Column: Target / Selected Mandate */}
                        <div className="flex-1 flex flex-col h-full min-w-0">
                            <div className="mb-2 flex justify-between items-end">
                                <div className="flex flex-col">
                                    <h3 className="font-bold text-emerald-800 dark:text-emerald-400">Target Mandate</h3>
                                    <span className="text-xs text-emerald-600 dark:text-emerald-500">{selectedColumn?.title || 'No mandate selected'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setIsCsvModalOpen(true)}
                                        disabled={!selectedMandateId}
                                        className="text-xs px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-gray-700 rounded hover:bg-slate-50 shadow-sm flex items-center gap-1 font-bold text-slate-600 dark:text-slate-300 disabled:opacity-50"
                                    >
                                        <span className="material-symbols-outlined text-sm">upload_file</span>
                                        Import CSV
                                    </button>
                                    <span className="text-xs font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full">
                                        {selectedColumn?.staff.length || 0}
                                    </span>
                                </div>
                            </div>
                            <div className="mb-3 relative">
                                <span className="material-symbols-outlined absolute left-2 top-2 text-slate-400 text-lg">search</span>
                                <input
                                    type="text"
                                    placeholder="Search assigned staff..."
                                    value={targetSearch}
                                    onChange={(e) => setTargetSearch(e.target.value)}
                                    disabled={!selectedMandateId}
                                    className="w-full h-8 pl-8 pr-3 rounded-md border border-slate-300 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-sm text-slate-700 dark:text-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                                />
                            </div>

                            <div className="flex-1 overflow-hidden rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/20 dark:bg-emerald-900/10">
                                {selectedColumn ? (
                                    <MandateColumn
                                        columnId={selectedColumn.id}
                                        title={selectedColumn.title}
                                        subtitle={selectedColumn.code}
                                        staffList={filteredTarget}
                                        onDragOver={onDragOver}
                                        onDrop={onDrop}
                                        colorTheme="emerald"
                                        isDropTarget={true}
                                    />
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-4 opacity-60">
                                        <span className="material-symbols-outlined text-6xl">checklist</span>
                                        <p className="text-xl font-bold">Select a Mandate to manage staff</p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                )}
            </div>

            <AlertModal
                isOpen={alert.open}
                onClose={() => setAlert({ ...alert, open: false })}
                title={alert.title}
                message={alert.message}
                type={alert.type}
            />

            <CsvUploadModal
                isOpen={isCsvModalOpen}
                onClose={() => setIsCsvModalOpen(false)}
                onUpload={handleCsvUpload}
            />
        </div>
    );
};

// Helper for rotating colors
const getMandateColor = (index: number): 'slate' | 'emerald' | 'blue' | 'purple' | 'amber' => {
    const colors: ('emerald' | 'blue' | 'purple' | 'amber')[] = ['emerald', 'blue', 'purple', 'amber'];
    return colors[index % colors.length];
};

export default MandateStaffAssignment;
