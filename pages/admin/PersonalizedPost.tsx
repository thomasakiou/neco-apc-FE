import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { getAllAssignments } from '../../services/assignment';
import { getAssignmentBoardData, bulkSaveAssignments } from '../../services/personalizedPost';
import { getAllStates } from '../../services/state';
import { Assignment } from '../../types/assignment';
import { AssignmentBoardData, StaffMandateAssignment } from '../../types/apc';
import { MandateColumn } from '../../components/MandateColumn';
import AlertModal from '../../components/AlertModal';
import StationTypeSelectionModal from '../../components/StationTypeSelectionModal';
import { getAllSchools } from '../../services/school';
import { getAllNCEECenters } from '../../services/nceeCenter';
import { getAllBECECustodians, getAllSSCECustodians } from '../../services/custodianSpecific';
import { getAllMarkingVenues } from '../../services/markingVenue';
import { getAllTTCenters } from '../../services/ttCenter';
import CsvUploadModal from '../../components/CsvUploadModal';
import SearchableSelect from '../../components/SearchableSelect';
import HelpModal from '../../components/HelpModal';
import { helpContent } from '../../data/helpContent';

const PersonalizedPost: React.FC = () => {
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
    const [selectedStationId, setSelectedStationId] = useState<string>('');
    const [stationOptions, setStationOptions] = useState<{ id: string; name: string; type: string }[]>([]);
    const [boardData, setBoardData] = useState<AssignmentBoardData | null>(null);
    const [loading, setLoading] = useState(false);

    // Modern State Management
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<{ staffId: string; staff: StaffMandateAssignment; action: 'add' | 'remove' | 'move'; targetMandateId: string | null }[]>([]);
    const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
    const [poolSearch, setPoolSearch] = useState('');
    const [boardSearch, setBoardSearch] = useState('');
    const [showHelp, setShowHelp] = useState(false);

    // Modals & UI
    const [isStationModalOpen, setIsStationModalOpen] = useState(false);
    const [manualStationType, setManualStationType] = useState<string>('');
    const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
    const [numberOfNights, setNumberOfNights] = useState<number>(0);
    const [description, setDescription] = useState<string>(''); // Added Description State
    const [alert, setAlert] = useState<{ open: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' }>({
        open: false, title: '', message: '', type: 'success'
    });

    useEffect(() => {
        loadAssignments();
    }, []);

    useEffect(() => {
        if (selectedAssignmentId) {
            loadBoardData(selectedAssignmentId);
        } else {
            setBoardData(null);
            setHasUnsavedChanges(false);
            setPendingChanges([]);
            setSelectedStaffIds(new Set());
        }
    }, [selectedAssignmentId]);

    const loadAssignments = async () => {
        try {
            const data = await getAllAssignments(true);
            setAssignments(data);
        } catch (error) { console.error(error); }
    };

    const loadBoardData = async (assignmentId: string) => {
        setLoading(true);
        try {
            const assignment = assignments.find(a => a.id === assignmentId);
            if (!assignment) return;
            const data = await getAssignmentBoardData(assignment);
            setBoardData(data);
            setHasUnsavedChanges(false);
            setPendingChanges([]);
            setSelectedStaffIds(new Set());
        } catch (error) {
            console.error(error);
            showAlert('Error', 'Failed to load board', 'error');
            setSelectedAssignmentId('');
        } finally { setLoading(false); }
    };

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning') => {
        setAlert({ open: true, title, message, type });
    };

    // --- Performance Optimized Callbacks ---

    const onToggleSelect = useCallback((id: string) => {
        setSelectedStaffIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

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

    const handleBulkMove = (targetMandateId: string) => {
        if (selectedStaffIds.size === 0) return;
        if (!boardData) return;

        const staffToMove = [...boardData.unassignedStaff, ...boardData.mandateColumns.flatMap(c => c.staff)]
            .filter(s => selectedStaffIds.has(s.id));

        staffToMove.forEach(s => handleLocalMove(s, targetMandateId));
        setSelectedStaffIds(new Set());
    };

    const handleDrop = useCallback((e: React.DragEvent, targetColumnId: string) => {
        e.preventDefault();
        const staffData = e.dataTransfer.getData('application/json');
        if (!staffData) return;
        const staff: StaffMandateAssignment = JSON.parse(staffData);
        if ((staff.mandate_id || 'unassigned') === targetColumnId) return;
        handleLocalMove(staff, targetColumnId);
    }, [handleLocalMove]);

    const handleSaveChanges = async () => {
        if (!boardData || pendingChanges.length === 0) return;
        if (!selectedStationId) {
            showAlert('Requirement', 'Please select a Target Station first.', 'warning');
            return;
        }

        const assignment = assignments.find(a => a.id === selectedAssignmentId);

        setLoading(true);
        try {
            await bulkSaveAssignments({
                assignment: assignment!,
                station: stationOptions.find(s => s.id === selectedStationId),
                changes: pendingChanges,
                numberOfNights: (assignment?.code === 'MAR-ACCR' || assignment?.code === 'OCT-ACCR') ? numberOfNights : undefined,
                description: description // Pass description
            });
            showAlert('Success', `${pendingChanges.length} changes committed successfully!`, 'success');
            await loadBoardData(selectedAssignmentId);
        } catch (error: any) {
            showAlert('Save Error', error.message, 'error');
        } finally { setLoading(false); }
    };

    // --- Station Loading Utility ---

    const handleStationTypeSelect = async (type: string) => {
        setLoading(true);
        try {
            let data: any[] = [];
            if (type === 'state') {
                const stateData = await getAllStates();
                data = stateData.sort((a, b) => a.name.localeCompare(b.name));
            } else if (type === 'school') data = await getAllSchools(true);
            else if (type === 'bece_custodian') data = await getAllBECECustodians(true);
            else if (type === 'ssce_custodian') data = await getAllSSCECustodians(true);
            else if (type === 'ncee_center') data = await getAllNCEECenters(true);
            else if (type === 'tt_center') data = await getAllTTCenters(true);
            else data = await getAllMarkingVenues(true);

            setStationOptions(data.map(s => ({
                id: s.id,
                name: `${(s.code || s.sch_no) ? `(${(s.code || s.sch_no)}) ` : ''}${s.name || s.sch_name || s.station || s.venue_name || ''}`,
                type
            })));
            setManualStationType(type);
            setIsStationModalOpen(false);
        } catch (error) { showAlert('Error', 'Failed to load stations', 'error'); }
        finally { setLoading(false); }
    };

    const downloadCsvTemplate = () => {
        const headers = ['StaffNo', 'MandateCode'];
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "bulk_assignment_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Memoized Filtering ---

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

    return (
        <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0F172A]">
            {/* Action Bar */}
            <header className="min-h-20 py-4 flex-shrink-0 bg-white dark:bg-[#1E293B] border-b border-slate-200 dark:border-slate-800 px-4 md:px-10 flex flex-col lg:flex-row items-start lg:items-center justify-between shadow-sm z-30 gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:gap-6 w-full lg:w-auto">
                    <div className="flex-shrink-0">
                        <h1 className="text-lg md:text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                            Board Workspace
                            {hasUnsavedChanges && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Unsaved Changes"></span>}
                            <button
                                onClick={() => setShowHelp(true)}
                                className="ml-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all shadow-sm font-bold text-xs"
                                title="Board Guide"
                            >
                                <span className="material-symbols-outlined text-sm">help</span>
                                Help
                            </button>
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Personnel Distribution Engine</p>
                    </div>

                    <div className="hidden sm:block h-10 w-[1px] bg-slate-200 dark:bg-slate-700"></div>

                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        <select
                            value={selectedAssignmentId}
                            onChange={(e) => setSelectedAssignmentId(e.target.value)}
                            className="h-10 px-4 rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:border-indigo-500 outline-none transition-all w-full sm:min-w-[200px] flex-1"
                        >
                            <option value="">Select Assignment...</option>
                            {assignments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>

                        <SearchableSelect
                            options={stationOptions}
                            value={selectedStationId}
                            onChange={setSelectedStationId}
                            placeholder="Target Station..."
                            className="w-full sm:min-w-[240px] flex-1"
                        />

                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-indigo-500 dark:text-indigo-400 animate-point text-lg">pan_tool_alt</span>
                            <button
                                onClick={() => setIsStationModalOpen(true)}
                                className="pick-station-btn h-9 px-3 flex items-center justify-center rounded-xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-wider shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all gap-1.5 flex-shrink-0"
                                title="Filter Station Types"
                            >
                                <span className="material-symbols-outlined text-sm">hub</span>
                                Pick Station
                            </button>
                        </div>

                        <input
                            type="text"
                            placeholder="Description..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="h-10 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium focus:border-indigo-500 outline-none transition-all w-full sm:min-w-[200px] flex-1"
                        />

                        <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1 ml-1">Nights</label>
                            <input
                                type="number"
                                placeholder="Nights..."
                                min="0"
                                value={numberOfNights}
                                onChange={(e) => setNumberOfNights(parseInt(e.target.value) || 0)}
                                className="h-10 px-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium focus:border-indigo-500 outline-none transition-all w-20 sm:w-24"
                            />
                        </div>

                    </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0">
                    {selectedStaffIds.size > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{selectedStaffIds.size} Selected</span>
                            <div className="h-4 w-[1px] bg-indigo-500/20 mx-1"></div>
                            <button onClick={() => setSelectedStaffIds(new Set())} className="text-[10px] font-bold text-slate-500 hover:text-rose-500 uppercase tracking-tighter">Clear</button>
                        </div>
                    )}

                    <button
                        onClick={handleSaveChanges}
                        disabled={!hasUnsavedChanges}
                        className="h-11 px-4 sm:px-8 rounded-xl bg-emerald-600 text-white font-black text-sm shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 disabled:grayscale disabled:opacity-50 transition-all flex items-center gap-2 whitespace-nowrap"
                    >
                        <span className="material-symbols-outlined text-xl">commit</span>
                        <span className="hidden sm:inline">Commit Changes</span>
                        <span className="sm:hidden">Commit</span>
                    </button>
                </div>
            </header>

            {/* Main Area */}
            <main className="flex-1 workspace-grid">
                {/* Left Drawer: Staff Pool */}
                <aside className="border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex flex-col z-20 shadow-2xl shadow-black/5">
                    <div className="p-5 flex-shrink-0 border-b border-slate-100 dark:border-slate-800/50">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Staff Pool</h2>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500">{filteredPool.length} Ready</span>
                        </div>
                        <div className="relative group">
                            <input
                                type="text"
                                placeholder="Search pool..."
                                value={poolSearch}
                                onChange={(e) => setPoolSearch(e.target.value)}
                                className="w-full h-11 pl-11 pr-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 ring-indigo-500/20 outline-none transition-all"
                            />
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg group-focus-within:text-indigo-500 transition-colors">person_search</span>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 relative">
                        <div className="h-[600px] lg:h-[650px] xl:h-[700px]">
                            <MandateColumn
                                columnId="unassigned"
                                title="Eligible Pool"
                                subtitle="All qualified candidates"
                                staffList={filteredPool}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDrop}
                                selectedStaffIds={selectedStaffIds}
                                onToggleSelect={onToggleSelect}
                            />
                        </div>
                    </div>
                </aside>

                {/* Right Area: Board */}
                <section className="flex-1 flex flex-col min-w-0 bg-[#F1F5F9]/30 dark:bg-transparent">
                    {/* View Controls */}
                    <div className="h-auto py-3 md:h-14 px-4 md:px-8 flex flex-col md:flex-row items-start md:items-center justify-between flex-shrink-0 border-b border-slate-200/50 dark:border-slate-800/50 gap-4">
                        <div className="flex items-center gap-4 md:gap-8 w-full md:w-auto overflow-x-auto no-scrollbar">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Distribution Grid
                            </h3>
                            <div className="relative flex-1 md:flex-none">
                                <span className="material-symbols-outlined absolute left-0 top-1/2 -translate-y-1/2 text-slate-300 text-lg">search</span>
                                <input
                                    type="text"
                                    placeholder="Filter grid..."
                                    value={boardSearch}
                                    onChange={(e) => setBoardSearch(e.target.value)}
                                    className="h-8 pl-6 bg-transparent border-none text-xs font-bold text-slate-900 dark:text-white outline-none placeholder:text-slate-300 w-full"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
                            <button
                                onClick={downloadCsvTemplate}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-500 hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 whitespace-nowrap"
                            >
                                <span className="material-symbols-outlined text-sm">download</span>
                                <span className="hidden sm:inline">Template</span>
                            </button>
                            <button onClick={() => setIsCsvModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-500 hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 whitespace-nowrap">
                                <span className="material-symbols-outlined text-sm">cloud_upload</span>
                                <span className="hidden sm:inline">Import CSV</span>
                                <span className="sm:hidden">Import</span>
                            </button>
                            <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 mx-1"></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">Cols: {boardData?.mandateColumns.length || 0}</span>
                        </div>
                    </div>

                    {/* Columns Grid */}
                    <div className="flex-1 overflow-x-auto custom-scrollbar">
                        <div className="flex p-4 md:p-8 gap-4 md:gap-6 min-w-max">
                            {!selectedAssignmentId ? (
                                <div className="flex-1 w-full flex flex-col items-center justify-center opacity-30 gap-4 grayscale">
                                    <span className="material-symbols-outlined text-6xl md:text-8xl font-thin">dashboard_customize</span>
                                    <p className="text-xs md:text-sm font-black uppercase tracking-widest italic text-center">Choose an assignment to initialize workspace</p>
                                </div>
                            ) : loading ? (
                                <div className="flex-1 w-full flex flex-col items-center justify-center gap-4">
                                    <div className="w-10 h-10 md:w-12 md:h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] animate-pulse">Syncing Engine</p>
                                </div>
                            ) : (
                                filteredBoard.map((col, idx) => (
                                    <div key={col.id} className="w-[280px] md:w-[320px] flex flex-col relative h-[600px] lg:h-[650px] xl:h-[700px]">
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
                                                className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-full shadow-lg shadow-indigo-600/30 border-2 border-white dark:border-slate-900 z-20 hover:scale-110 active:scale-95 transition-all animate-bounce"
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
            </main>

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

                    // 3. Format error summary
                    if (notFoundStaffNos.length > 0) {
                        errorDetails.unshift(`File Nos: ${notFoundStaffNos.join(', ')} are not in the eligible pool of staff for this assignment/mandate`);
                    }

                    if (successCount > 0) {
                        const msg = `Successfully assigned ${successCount} staff members. Review and click "Commit Changes" to save.`;
                        if (errorCount === 0) {
                            showAlert('Import Complete', msg, 'success');
                        } else {
                            showAlert('Partial Success', `${msg}\n\n${errorDetails.join('\n')}`, 'warning');
                        }
                    } else if (errorCount > 0) {
                        showAlert('Import Failed', errorDetails.join('\n'), 'error');
                    }
                }}
            />

            <StationTypeSelectionModal
                isOpen={isStationModalOpen}
                onClose={() => setIsStationModalOpen(false)}
                onSelect={handleStationTypeSelect}
            />

            {/* Global Layer: Notifications / Floating elements */}
            {loading && (
                <div className="fixed inset-0 bg-white/10 dark:bg-black/10 backdrop-blur-[1px] z-50 pointer-events-none"></div>
            )}

            <HelpModal
                isOpen={showHelp}
                onClose={() => setShowHelp(false)}
                helpData={helpContent.personalizedPost}
            />
        </div>
    );
};

export default PersonalizedPost;
