import React, { useState, useEffect, useMemo } from 'react';
import { getAllFinalPostings, updateFinalPosting, getAllFinalPostings as fetchAllFinalPostings } from '../../services/finalPosting'; // Alias for clarity
import { getAllAPCRecords } from '../../services/apc';
import { getAllAssignments } from '../../services/assignment';
import { assignmentFieldMap } from '../../services/personalizedPost';
import { FinalPostingResponse } from '../../types/finalPosting';
import { APCRecord } from '../../types/apc';
import { Assignment } from '../../types/assignment';
import { getPageCache, setPageCache } from '../../services/pageCache';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ReplacementHistoryItem {
    original: {
        fileNo: string;
        name: string;
        conraiss: string;
    };
    replacement: {
        fileNo: string;
        name: string;
        conraiss: string;
    };
    date: string;
    reason: 'Replacement' | 'Swapping';
    remark: string;
    venue: string;
    mandate: string;
}

// Extended interface for internal use
interface ExtendedHistoryItem extends ReplacementHistoryItem {
    _id: string; // Internal unique ID for selection (parentId_timestamp_index)
    parentId: string;
}

const ReplacementPostPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [finalPostings, setFinalPostings] = useState<FinalPostingResponse[]>([]);
    const [apcRecords, setApcRecords] = useState<APCRecord[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [filterAssignment, setFilterAssignment] = useState('');

    // Selection States
    const [selectedPostingId, setSelectedPostingId] = useState<string>('');
    const [selectedReplacementId, setSelectedReplacementId] = useState<string>('');
    const [reason, setReason] = useState<'Replacement' | 'Swapping'>('Replacement');
    const [remark, setRemark] = useState('');

    // Search for Dropdowns
    const [searchPosted, setSearchPosted] = useState('');
    const [searchReplacement, setSearchReplacement] = useState('');

    // History selection state
    const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
    const [reportTitle, setReportTitle] = useState('STAFF REPLACEMENT / SWAPPING REPORT');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [finalData, apcData, assignmentsData] = await Promise.all([
                getAllFinalPostings(0, 10000),
                getAllAPCRecords(false),
                getAllAssignments(false)
            ]);

            const finalItems = finalData.items || (Array.isArray(finalData) ? finalData : []);
            const apcItems = Array.isArray(apcData) ? apcData : [];

            setFinalPostings(finalItems);
            setApcRecords(apcItems);
            setAssignments(assignmentsData);
        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            setLoading(false);
        }
    };

    // Derived Data Map for Assignments
    const assignmentMap = useMemo(() => {
        const map = new Map<string, string>();
        assignments.forEach(a => {
            if (a.code) map.set(a.code, a.name);
            if (a.name) map.set(a.name, a.name);
        });
        return map;
    }, [assignments]);

    // Unique Assignments in Final Postings
    const uniqueAssignments = useMemo(() => {
        const set = new Set<string>();
        finalPostings.forEach(p => {
            p.assignments?.forEach((a: any) => {
                const val = typeof a === 'string' ? a : a.name || a.code;
                const name = assignmentMap.get(val) || val;
                if (name) set.add(name);
            });
        });
        return Array.from(set).sort();
    }, [finalPostings, assignmentMap]);

    // Filtered Options
    const postedOptions = useMemo(() => {
        let filtered = finalPostings;

        if (filterAssignment) {
            filtered = filtered.filter(p => p.assignments?.some((a: any) => {
                const val = typeof a === 'string' ? a : a.name || a.code;
                const name = assignmentMap.get(val) || val;
                return name === filterAssignment;
            }));
        }

        if (!searchPosted) return filtered.slice(0, 50);

        const q = searchPosted.toLowerCase();
        return filtered.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.file_no.toLowerCase().includes(q)
        ).slice(0, 50);
    }, [finalPostings, searchPosted, filterAssignment, assignmentMap]);

    // Derived state for quick lookup of posted file numbers
    const postedFileNumbers = useMemo(() => {
        return new Set(finalPostings.map(p => p.file_no.trim()));
    }, [finalPostings]);

    const replacementOptions = useMemo(() => {
        const q = searchReplacement.toLowerCase();
        let source: any[] = [];

        if (reason === 'Replacement') {
            // Requirement check: When Action is replacement, I expect the name area to be empty until and Assignment is choosen 
            if (!filterAssignment) return [];

            // Staff who are scheduled for the selected assignment (having the assignment in their APC) but not posted yet
            const fieldName = assignmentFieldMap[filterAssignment] ||
                Object.keys(assignmentFieldMap).find(k => k.toUpperCase() === filterAssignment.toUpperCase()) ? assignmentFieldMap[Object.keys(assignmentFieldMap).find(k => k.toUpperCase() === filterAssignment.toUpperCase()) as string] : null;

            if (!fieldName) {
                // If we can't map the assignment name to a field, we show empty as we enforcement scheduling.
                return [];
            }

            source = apcRecords.filter(p => {
                const isUnposted = !postedFileNumbers.has(p.file_no.trim());
                const val = (p as any)[fieldName];
                const isScheduled = val && typeof val === 'string' && val.trim() !== '' && val.toUpperCase() !== 'RETURNED';
                return isUnposted && isScheduled;
            });
        } else {
            // Swapping: Show POSTED staff (excluding the currently selected one)
            let pool = finalPostings;
            if (filterAssignment) {
                pool = pool.filter(p => p.assignments?.some((a: any) => {
                    const val = typeof a === 'string' ? a : a.name || a.code;
                    const name = assignmentMap.get(val) || val;
                    return name === filterAssignment;
                }));
            }

            source = pool.filter(p => String(p.id) !== String(selectedPostingId));
        }

        if (q) {
            source = source.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.file_no.toLowerCase().includes(q)
            );
        }

        return source.slice(0, 50);
    }, [apcRecords, finalPostings, searchReplacement, reason, selectedPostingId, postedFileNumbers, filterAssignment, assignmentMap]);

    const handleSwap = async () => {
        if (!selectedPostingId || !selectedReplacementId) {
            alert("Please select both staff members.");
            return;
        }

        // Convert IDs to strings for comparison
        const originalPosting = finalPostings.find(p => String(p.id) === String(selectedPostingId));

        let newStaff: any = null;
        if (reason === 'Replacement') {
            newStaff = apcRecords.find(p => String(p.id) === String(selectedReplacementId));
        } else {
            newStaff = finalPostings.find(p => String(p.id) === String(selectedReplacementId));
        }

        if (!originalPosting || !newStaff) {
            console.error("Selection not found", { selectedPostingId, selectedReplacementId });
            alert("Error: Could not identify the selected records. Please refresh and try again.");
            return;
        }

        const actionText = reason === 'Swapping' ? 'swap venues between' : 'replace';
        if (!confirm(`Are you sure you want to ${actionText} ${originalPosting.name} and ${newStaff.name}?`)) return;

        setLoading(true);
        try {
            if (reason === 'Replacement') {
                // --- ONE WAY REPLACEMENT ---
                const historyItem: ReplacementHistoryItem = {
                    original: {
                        fileNo: originalPosting.file_no,
                        name: originalPosting.name,
                        conraiss: originalPosting.conraiss || ''
                    },
                    replacement: {
                        fileNo: newStaff.file_no,
                        name: newStaff.name,
                        conraiss: newStaff.conraiss || (newStaff as any).conr || ''
                    },
                    date: new Date().toISOString(),
                    reason,
                    remark,
                    venue: (originalPosting.assignment_venue || []).join(', '),
                    mandate: (originalPosting.mandates || []).map((m: any) => typeof m === 'string' ? m : m.mandate).join(', ')
                };

                let currentDesc = originalPosting.description || '';
                let historyArray: ReplacementHistoryItem[] = [];
                const historyMarker = "||REPLACEMENT_HISTORY||";
                const parts = currentDesc.split(historyMarker);
                let visibleDesc = parts[0];
                if (parts.length > 1) {
                    try { historyArray = JSON.parse(parts[1]); } catch (e) { }
                }
                historyArray.push(historyItem);
                const newDescription = `${visibleDesc}${historyMarker}${JSON.stringify(historyArray)}`;

                await updateFinalPosting(originalPosting.id, {
                    file_no: newStaff.file_no,
                    name: newStaff.name,
                    conraiss: newStaff.conraiss || (newStaff as any).conr,
                    sex: newStaff.sex,
                    description: newDescription,
                });
            } else {
                // --- SWAPPING (Bi-directional) ---
                // Staff A (originalPosting) goes to Staff B's slot (newStaff record) ?? 
                // Wait, "Select Posted Staff to Replace and New Staff will have the posted staff and they will only swap venues"
                // This means Record A (Venue A) should now have Person B.
                // And Record B (Venue B) should now have Person A.

                // 1. Prepare Data for Record A (will hold Person B)
                const personA = {
                    file_no: originalPosting.file_no,
                    name: originalPosting.name,
                    conraiss: originalPosting.conraiss,
                    sex: originalPosting.sex
                };

                const personB = {
                    file_no: newStaff.file_no,
                    name: newStaff.name,
                    conraiss: newStaff.conraiss,
                    sex: newStaff.sex
                };

                // History for Record A (Venue A, now Person B)
                const historyItemA: ReplacementHistoryItem = {
                    original: { fileNo: personA.file_no, name: personA.name, conraiss: personA.conraiss || '' },
                    replacement: { fileNo: personB.file_no, name: personB.name, conraiss: personB.conraiss || '' },
                    date: new Date().toISOString(),
                    reason: 'Swapping',
                    remark: `Swapped with ${personB.name}`,
                    venue: (originalPosting.assignment_venue || []).join(', '),
                    mandate: (originalPosting.mandates || []).map((m: any) => typeof m === 'string' ? m : m.mandate).join(', ')
                };

                // History for Record B (Venue B, now Person A)
                const historyItemB: ReplacementHistoryItem = {
                    original: { fileNo: personB.file_no, name: personB.name, conraiss: personB.conraiss || '' },
                    replacement: { fileNo: personA.file_no, name: personA.name, conraiss: personA.conraiss || '' },
                    date: new Date().toISOString(),
                    reason: 'Swapping',
                    remark: `Swapped with ${personA.name}`,
                    venue: (newStaff.assignment_venue || []).join(', '),
                    mandate: (newStaff.mandates || []).map((m: any) => typeof m === 'string' ? m : m.mandate).join(', ')
                };

                // Helper to build description
                const buildDesc = (record: any, item: ReplacementHistoryItem) => {
                    let currentDesc = record.description || '';
                    let historyArray: ReplacementHistoryItem[] = [];
                    const historyMarker = "||REPLACEMENT_HISTORY||";
                    const parts = currentDesc.split(historyMarker);
                    let visibleDesc = parts[0];
                    if (parts.length > 1) { try { historyArray = JSON.parse(parts[1]); } catch (e) { } }
                    historyArray.push(item);
                    return `${visibleDesc}${historyMarker}${JSON.stringify(historyArray)}`;
                };

                // Perform Parallel Updates
                await Promise.all([
                    updateFinalPosting(originalPosting.id, {
                        ...personB,
                        description: buildDesc(originalPosting, historyItemA)
                    }),
                    updateFinalPosting(newStaff.id, {
                        ...personA,
                        description: buildDesc(newStaff, historyItemB)
                    })
                ]);
            }

            alert("Operation successful!");
            setSelectedPostingId('');
            setSelectedReplacementId('');
            setRemark('');
            loadData();

        } catch (error) {
            console.error("Action failed", error);
            alert("Failed to process request.");
        } finally {
            setLoading(false);
        }
    };

    // Derived History with IDs
    const replacementHistory = useMemo(() => {
        const history: ExtendedHistoryItem[] = [];
        const historyMarker = "||REPLACEMENT_HISTORY||";

        finalPostings.forEach(p => {
            if (p.description && p.description.includes(historyMarker)) {
                const parts = p.description.split(historyMarker);
                if (parts.length > 1) {
                    try {
                        const items: ReplacementHistoryItem[] = JSON.parse(parts[1]);
                        if (Array.isArray(items)) {
                            items.forEach((item, idx) => {
                                history.push({
                                    ...item,
                                    parentId: p.id,
                                    _id: `${p.id}_${item.date}_${idx}` // Composite ID
                                });
                            });
                        }
                    } catch (e) { }
                }
            }
        });

        // Sort by date desc
        return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [finalPostings]);

    // Selection Handlers
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedHistoryIds(new Set(replacementHistory.map(h => h._id)));
        } else {
            setSelectedHistoryIds(new Set());
        }
    };

    const handleSelectRow = (id: string) => {
        const next = new Set(selectedHistoryIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedHistoryIds(next);
    };

    const handleDeleteSelected = async () => {
        if (selectedHistoryIds.size === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedHistoryIds.size} history record(s)? This will remove them from the staff profiles.`)) return;

        setLoading(true);
        try {
            // Group by parent Posting ID to batch updates
            const grouped = new Map<string, Set<string>>(); // parentId -> Set(composite_ids)
            selectedHistoryIds.forEach(id => {
                const parentId = id.split('_')[0];
                if (!grouped.has(parentId)) grouped.set(parentId, new Set());
                grouped.get(parentId)!.add(id);
            });

            const updates: Promise<any>[] = [];

            for (const [parentId, idsToRemove] of grouped.entries()) {
                const posting = finalPostings.find(p => p.id === parentId);
                if (!posting) continue;

                const historyMarker = "||REPLACEMENT_HISTORY||";
                const parts = (posting.description || '').split(historyMarker);
                if (parts.length < 2) continue; // Should not happen if history exists

                let visibleDesc = parts[0];
                let historyItems: ReplacementHistoryItem[] = [];
                try {
                    historyItems = JSON.parse(parts[1]);
                } catch (e) { continue; }

                // Filter out items that match the IDs to remove
                // We reconstruct the ID logic check: `${p.id}_${item.date}_${idx}`
                // Warning: Indices shift if we remove items. Better to filter by matching the composite ID generated *now* matching the *target*.
                // Actually, simply re-generating the ID for each item and checking if it's in the set is robust enough provided distinct timestamps/indices.

                const keptItems = historyItems.filter((item, idx) => {
                    const itemId = `${parentId}_${item.date}_${idx}`;
                    return !idsToRemove.has(itemId);
                });

                const newDescription = keptItems.length > 0
                    ? `${visibleDesc}${historyMarker}${JSON.stringify(keptItems)}`
                    : visibleDesc; // Remove marker if empty? Or keep it? keeping it is safer for future appends.
                // If empty, cleaner to remove the marker to avoid empty JSON array clutter, but code handles empty array fine.
                // Let's remove marker if empty to be clean.

                const finalDesc = keptItems.length > 0
                    ? `${visibleDesc}${historyMarker}${JSON.stringify(keptItems)}`
                    : visibleDesc;

                updates.push(updateFinalPosting(parentId, { ...posting, description: finalDesc }));
            }

            await Promise.all(updates);
            alert("Delete successful.");
            setSelectedHistoryIds(new Set());
            loadData();

        } catch (error) {
            console.error("Delete failed", error);
            alert("Failed to delete records.");
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = async () => {
        // Filter if Selection Exists, otherwise export all?
        // User asked: "print pdf for only selected data".
        // If selection exists, export ONLY selection. If no selection, functionality implies "Export All" or "Export Selection"
        // Let's default to: If selection > 0, export selection. Else export all.

        const dataToExport = selectedHistoryIds.size > 0
            ? replacementHistory.filter(h => selectedHistoryIds.has(h._id))
            : replacementHistory;

        if (dataToExport.length === 0) {
            alert("No data to export.");
            return;
        }

        try {
            setLoading(true);
            const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
            const width = doc.internal.pageSize.getWidth();
            const height = doc.internal.pageSize.getHeight();

            // Load Logo and Signature
            const logoUrl = '/images/neco.png';
            const signatureUrl = '/images/signature.png';

            const [logoImg, signatureImg] = await Promise.all([
                new Promise<HTMLImageElement>((resolve, reject) => {
                    const img = new Image();
                    img.src = logoUrl;
                    img.onload = () => resolve(img);
                    img.onerror = () => reject(new Error('Logo load failed'));
                }),
                new Promise<HTMLImageElement | null>((resolve) => {
                    const img = new Image();
                    img.src = signatureUrl;
                    img.onload = () => resolve(img);
                    img.onerror = () => resolve(null); // Optional, so resolve null if fails
                })
            ]);

            // reportTitle is now in state

            const drawHeader = (data: any) => {
                // Watermark
                doc.saveGraphicsState();
                doc.setGState(new (doc as any).GState({ opacity: 0.1 }));
                const wmWidth = 120;
                if (logoImg) {
                    const aspect = logoImg.width / logoImg.height;
                    const wmHeight = wmWidth / aspect;
                    doc.addImage(logoImg, 'PNG', (width - wmWidth) / 2, (height - wmHeight) / 2, wmWidth, wmHeight);
                }
                doc.restoreGraphicsState();

                // Header
                if (logoImg) {
                    const logoAspect = logoImg.width / logoImg.height;
                    doc.addImage(logoImg, 'PNG', 15, 8, 20, 20 / logoAspect);
                }

                doc.setTextColor(0, 128, 0); // Green
                doc.setFontSize(18);
                doc.setFont("helvetica", "bold");
                doc.text("NATIONAL EXAMINATIONS COUNCIL (NECO)", width / 2, 18, { align: 'center' });

                doc.setTextColor(0);
                doc.setFontSize(14);
                doc.text(reportTitle.toUpperCase(), width / 2, 26, { align: 'center' });

                // Footer / Page Number
                doc.setFontSize(8);
                doc.setTextColor(100);
                doc.text(`Generated: ${new Date().toLocaleDateString()}`, 15, height - 10);
                doc.text(`Page ${(doc as any).internal.getNumberOfPages()}`, width - 15, height - 10, { align: 'right' });

                // Signature
                const signatureY = height - 20;
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.setTextColor(0);

                if (signatureImg) {
                    const sigWidth = 35;
                    const sigAspectRatio = signatureImg.width / signatureImg.height;
                    const sigH = sigWidth / sigAspectRatio;
                    doc.addImage(signatureImg, 'PNG', 15, signatureY - sigH - 5, sigWidth, sigH);
                }
                doc.text("Prof. Dantani Ibrahim Wushishi", 15, signatureY);
                doc.text("REG/CE", 15, signatureY + 5);
            };

            const columns = [
                { header: "S/N", dataKey: "sn" },
                { header: "OUTGOING STAFF (VACATED)", dataKey: "outgoing" },
                { header: "INCOMING STAFF (FILLED BY)", dataKey: "incoming" },
                { header: "MANDATE", dataKey: "mandate" },
                { header: "VENUE", dataKey: "venue" },
                { header: "ACTION TYPE", dataKey: "type" },
                { header: "REMARK", dataKey: "remark" }
            ];

            const rows = dataToExport.map((item, i) => ({
                sn: i + 1,
                outgoing: `${item.original.name}\n(${item.original.fileNo})`,
                incoming: `${item.replacement.name}\n(${item.replacement.fileNo})`,
                mandate: item.mandate,
                venue: item.venue,
                type: item.reason.toUpperCase(),
                remark: item.remark || '-'
            }));

            autoTable(doc, {
                columns: columns,
                body: rows,
                startY: 40,
                margin: { top: 40, bottom: 20 },
                theme: 'grid',
                headStyles: {
                    fillColor: [22, 163, 74], // Green-600
                    textColor: 255,
                    fontStyle: 'bold',
                    halign: 'center',
                    valign: 'middle',
                    fontSize: 12
                },
                bodyStyles: {
                    valign: 'middle',
                    fontSize: 10,
                    cellPadding: 4
                },
                columnStyles: {
                    sn: { halign: 'center', cellWidth: 10 },
                    outgoing: { cellWidth: 55, fontStyle: 'bold' },
                    incoming: { cellWidth: 55, fontStyle: 'bold', textColor: [22, 163, 74] }, // Green text for incoming
                    mandate: { cellWidth: 20 },
                    type: { halign: 'center', cellWidth: 40 },
                    remark: { cellWidth: 'auto' }
                },
                didDrawPage: (data) => drawHeader(data)
            });

            doc.save(`Replacement_Report_${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (error) {
            console.error("PDF Export failed", error);
        } finally {
            setLoading(false);
        }
    };


    const handleUndo = async (item: ExtendedHistoryItem) => {
        if (!confirm(`Are you sure you want to undo this action?\n\nThis will revert the position at ${item.venue} back to ${item.original.name} (${item.original.fileNo}).\n\nCurrent staff will be removed from this position.`)) return;

        setLoading(true);
        try {
            const parentPosting = finalPostings.find(p => p.id === item.parentId);
            if (!parentPosting) {
                alert("Parent posting record not found.");
                return;
            }

            // Find full details of original staff to restore (need Sex, etc.)
            const originalStaff = apcRecords.find(s => s.file_no === item.original.fileNo) ||
                finalPostings.find(s => s.file_no === item.original.fileNo); // Check both lists

            if (!originalStaff && !confirm(`Original staff record (${item.original.name}) not found in active records. Proceed with partial restoration (Name/FileNo only)?`)) {
                return;
            }

            const historyMarker = "||REPLACEMENT_HISTORY||";
            const parts = (parentPosting.description || '').split(historyMarker);
            let visibleDesc = parts[0];
            let historyItems: ReplacementHistoryItem[] = [];

            if (parts.length > 1) {
                try {
                    historyItems = JSON.parse(parts[1]);
                } catch (e) { }
            }

            // Remove *this* specific history item.
            // Using logic similar to deletion: composite ID check.
            const keptItems = historyItems.filter((h, idx) => {
                const hId = `${item.parentId}_${h.date}_${idx}`;
                return hId !== item._id;
            });

            const newDescription = keptItems.length > 0
                ? `${visibleDesc}${historyMarker}${JSON.stringify(keptItems)}`
                : visibleDesc;

            await updateFinalPosting(parentPosting.id, {
                file_no: item.original.fileNo,
                name: item.original.name,
                conraiss: item.original.conraiss,
                sex: (originalStaff as any)?.sex || (parentPosting as any).sex || 'M', // Fallback if not found
                description: newDescription
            });

            alert("Undo successful. Staff position reverted.");
            loadData();
            setSelectedHistoryIds(new Set()); // Clear selection to avoid stale IDs

        } catch (error) {
            console.error("Undo failed", error);
            alert("Failed to undo action.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background-light dark:bg-[#101922] p-8 gap-8 overflow-y-auto transition-colors duration-200">
            {/* ... (Previous Header/Action Card code remains same) ... */}

            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-300">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-600 via-emerald-600 to-green-600 dark:from-green-400 dark:via-emerald-400 dark:to-green-400 tracking-tight">
                        Staff Replacement / Swapping
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                        Replace posted staff (One-way) or swap venues between two posted staff.
                    </p>
                </div>
                {replacementHistory.length > 0 && (
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-3 items-center">
                            <input
                                type="text"
                                value={reportTitle}
                                onChange={(e) => setReportTitle(e.target.value)}
                                className="h-10 px-3 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200"
                                placeholder="Report Title..."
                            />
                            {selectedHistoryIds.size > 0 && (
                                <button
                                    onClick={handleDeleteSelected}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    <span className="material-symbols-outlined">delete</span>
                                    Delete ({selectedHistoryIds.size})
                                </button>
                            )}
                            <button
                                onClick={handleExportPDF}
                                disabled={loading}
                                className="group flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold shadow-lg shadow-rose-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                            >
                                <span className="material-symbols-outlined">picture_as_pdf</span>
                                {selectedHistoryIds.size > 0 ? `Export Selected (${selectedHistoryIds.size})` : 'Export All Results'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Action Card */}
            <div className="bg-surface-light dark:bg-[#121b25] p-6 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-6">
                {/* ... (Selection inputs code remains same) ... */}
                <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-gray-800 justify-between">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-indigo-500">swap_horiz</span>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Action Config</h3>
                    </div>
                    <div className="flex gap-6 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="type" checked={reason === 'Replacement'} onChange={() => { setReason('Replacement'); setSelectedReplacementId(''); }} className="accent-indigo-600 w-5 h-5" />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Replacement (One-way)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="type" checked={reason === 'Swapping'} onChange={() => { setReason('Swapping'); setSelectedReplacementId(''); }} className="accent-indigo-600 w-5 h-5" />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Swapping (Two-way)</span>
                        </label>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Filter by Assignment (Optional)</label>
                    <select
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-slate-100"
                        value={filterAssignment}
                        onChange={e => setFilterAssignment(e.target.value)}
                    >
                        <option value="">All Assignments</option>
                        {uniqueAssignments.map(a => (
                            <option key={a} value={a}>{a}</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Original Staff Selection */}
                    <div className="flex flex-col gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-gray-700">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            1. Select Posted Staff {reason === 'Swapping' ? '(Staff A)' : 'to Replace'}
                        </label>
                        <input
                            type="text"
                            placeholder="Search Posted Staff..."
                            className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100"
                            value={searchPosted}
                            onChange={e => setSearchPosted(e.target.value)}
                        />
                        <select
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-slate-100 custom-scrollbar"
                            value={selectedPostingId}
                            onChange={e => setSelectedPostingId(e.target.value)}
                            size={12}
                        >
                            {postedOptions.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.file_no}) - {p.assignment_venue?.join(', ')}</option>
                            ))}
                        </select>
                    </div>

                    {/* New Staff Selection */}
                    <div className="flex flex-col gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-gray-700">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            2. Select {reason === 'Swapping' ? 'Corresponding Staff to Swap (Staff B)' : 'New Replacement Staff'}
                        </label>
                        <input
                            type="text"
                            placeholder={reason === 'Swapping' ? "Search Other Posted Staff..." : "Search Available Unposted Staff..."}
                            className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100"
                            value={searchReplacement}
                            onChange={e => setSearchReplacement(e.target.value)}
                        />
                        <select
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-slate-100 custom-scrollbar"
                            value={selectedReplacementId}
                            onChange={e => setSelectedReplacementId(e.target.value)}
                            size={12}
                        >
                            {replacementOptions.length === 0 ? (
                                <option disabled className="text-slate-400 italic">No eligible staff found</option>
                            ) : (
                                replacementOptions.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} ({p.file_no})
                                        {reason === 'Swapping' && (p as any).assignment_venue ? ` - ${(p as any).assignment_venue.join(', ')}` : ''}
                                    </option>
                                ))
                            )}
                        </select>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Remark (Optional)</label>
                    <input
                        type="text"
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100"
                        value={remark}
                        onChange={e => setRemark(e.target.value)}
                        placeholder="e.g. Medical grounds, Absenteeism..."
                    />
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-gray-800">
                    <button
                        onClick={handleSwap}
                        disabled={loading || !selectedPostingId || !selectedReplacementId}
                        className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-500/20 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
                    >
                        {loading ? 'Processing...' : `Confirm ${reason}`}
                    </button>
                </div>
            </div>

            {/* History Table */}
            <div className="bg-surface-light dark:bg-[#121b25] p-6 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-6">
                <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-gray-800">
                    <span className="material-symbols-outlined text-slate-500">history</span>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Replacement / Swapping History</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-xs font-bold">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300 dark:border-gray-600"
                                        checked={replacementHistory.length > 0 && selectedHistoryIds.size === replacementHistory.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                    />
                                </th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Original Staff</th>
                                <th className="px-4 py-3">Replacement Staff</th>
                                <th className="px-4 py-3">Mandate</th>
                                <th className="px-4 py-3">Venue</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Remark</th>
                                <th className="px-4 py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {replacementHistory.length === 0 ? (
                                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500 italic">No replacements recorded yet.</td></tr>
                            ) : (
                                replacementHistory.map((item, i) => (
                                    <tr key={item._id} className={`group hover:bg-slate-50 dark:hover:bg-slate-800/30 ${selectedHistoryIds.has(item._id) ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''}`}>
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 dark:border-gray-600"
                                                checked={selectedHistoryIds.has(item._id)}
                                                onChange={() => handleSelectRow(item._id)}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-xs">{new Date(item.date).toLocaleDateString()}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 dark:text-slate-300">{item.original.name}</span>
                                                <span className="text-xs text-slate-500">{item.original.fileNo}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{item.replacement.name}</span>
                                                <span className="text-xs text-slate-500">{item.replacement.fileNo}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">{item.mandate}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.venue}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${item.reason === 'Replacement' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {item.reason}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 italic">{item.remark || '-'}</td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => handleUndo(item)}
                                                className="opacity-0 group-hover:opacity-100 flex items-center justify-center p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 transition-all"
                                                title="Undo / Revert this action"
                                            >
                                                <span className="material-symbols-outlined text-[20px]">undo</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ReplacementPostPage;


