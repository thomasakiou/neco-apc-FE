import { AssignmentBoardData, MandateColumn, StaffMandateAssignment, APCRecord } from '../types/apc';
import { getAllStaff } from './staff';
import { getMandatesByAssignment } from './assignment';
import { getAllAPC, createAPC, updateAPC, deleteAPC } from './apc';
import { Assignment } from '../types/assignment';
import { getAllPostingRecords, bulkCreatePostings, createPosting, updatePosting } from './posting';
import { PostingCreate, PostingUpdate, BulkPostingCreateRequest } from '../types/posting';

// Map assignment codes to APC field names
export const assignmentFieldMap: { [key: string]: string } = {
    'TT': 'tt',
    'SSCE-INT': 'ssce_int',
    'SSCE-EXT': 'ssce_ext',
    'SSCE-INT-MRK': 'ssce_int_mrk',
    'SSCE-EXT-MRK': 'ssce_ext_mrk',
    'NCEE': 'ncee',
    'BECEP': 'becep',
    'BECE-MRK-P': 'bece_mrkp',
    'BECE-MRKP': 'bece_mrkp',
    'MAR-ACCR': 'mar_accr',
    'OCT-ACCR': 'oct_accr',
    'PUR-SAMP': 'pur_samp',
    'GIFTED': 'gifted',
    'SWAPPING': 'swapping',
    'INT-AUDIT': 'int_audit',
    'STOCK-TK': 'stock_tk'
};

export const getAssignmentBoardData = async (assignment: Assignment): Promise<AssignmentBoardData> => {
    // 1. Fetch all mandates for this assignment
    const mandates = await getMandatesByAssignment(assignment);

    // 2. Fetch all staff 
    // 2. Fetch all staff 
    const allStaff = await getAllStaff(true);

    // 3. Fetch all APC records 
    const apcResponse = await getAllAPC(0, 100000, '', true);

    const fieldName = assignmentFieldMap[assignment.code];
    // We want ALL records to map them, not just filtered ones for this specific field yet
    // But we need to identify who is "Eligible" (has text in field)

    // 4. Map mandates to columns
    const mandateColumns: MandateColumn[] = mandates.map(mandate => ({
        id: mandate.id,
        title: mandate.mandate,
        code: mandate.code,
        station: mandate.station,
        active: mandate.active,
        staff: []
    }));

    // 5. Create maps
    const assignedStaffMap = new Map<string, string>(); // staff_no -> mandate_id
    const apcMap = new Map<string, any>(); // staff_no -> apc_record (normalized)

    apcResponse.items.forEach(record => {
        const normalizedFileNo = record.file_no.padStart(4, '0');
        apcMap.set(normalizedFileNo, record);

        if (fieldName) {
            const assignmentValue = record[fieldName as keyof APCRecord];
            if (assignmentValue && typeof assignmentValue === 'string' && assignmentValue.trim() !== '') {
                // Check if this value matches a mandate title or code
                // This puts them in the "Target" column if they are already assigned specifically
                const matchedMandate = mandateColumns.find(m =>
                    m.title.toLowerCase() === assignmentValue.toLowerCase() ||
                    m.code.toLowerCase() === assignmentValue.toLowerCase()
                );

                if (matchedMandate) {
                    assignedStaffMap.set(normalizedFileNo, matchedMandate.id);
                }
            }
        }
    });

    // 6. Distribute staff 
    const unassignedStaff: StaffMandateAssignment[] = [];

    // Fetch Postings to exclude already posted staff
    const allPostings = await getAllPostingRecords();
    const postedStaffMap = new Map<string, Set<string>>(); // staff_no -> Set of assignment codes
    allPostings.forEach(p => {
        if (p.assignments && Array.isArray(p.assignments)) {
            postedStaffMap.set(p.file_no, new Set(p.assignments));
        }
    });

    const usedApcIds = new Set<string>();

    allStaff.forEach(staff => {
        const normalizedStaffFileNo = staff.fileno.padStart(4, '0');

        // Check if already posted for THIS assignment
        const postedAssignments = postedStaffMap.get(normalizedStaffFileNo);
        if (postedAssignments && postedAssignments.has(assignment.code)) {
            // Already posted for this assignment type. Skip / Hide.
            return;
        }

        const existingApcRecord = apcMap.get(normalizedStaffFileNo);
        if (existingApcRecord) {
            usedApcIds.add(existingApcRecord.id);
        }

        const mandateId = assignedStaffMap.get(normalizedStaffFileNo); // Use normalized key

        const staffAssignment: StaffMandateAssignment = {
            id: staff.id,
            staff_no: staff.fileno,
            staff_name: staff.full_name,
            rank: staff.rank || '',
            current_station: staff.station || '',
            conr: staff.conr || '',
            mandate_id: mandateId || null,
            apc_id: existingApcRecord?.id
        };

        if (mandateId) {
            // Add to specific mandate column
            const col = mandateColumns.find(c => c.id === mandateId);
            if (col) {
                col.staff.push(staffAssignment);
            }
        } else {
            // Not assigned to a SPECIFIC mandate in this list.
            // Check eligibility: MUST have text in the assignment column to be in "Source" box

            if (existingApcRecord && fieldName) {
                const val = existingApcRecord[fieldName as keyof APCRecord];
                if (val && val.toString().trim() !== '') {
                    // Has text, but didn't match a mandate above.
                    // This means they are "Eligible" but currently "Unassigned" (or assigned to something else effectively)
                    // We put them in Unassigned Pool
                    unassignedStaff.push(staffAssignment);
                }
            }
            // If no APC record or no text in column, they are NOT eligible for this assignment view
        }
    });

    // 7. Handle Orphans (APC records with no corresponding Staff record)
    apcResponse.items.forEach(record => {
        if (!usedApcIds.has(record.id)) {
            // Check if this orphan is relevant for THIS assignment
            if (fieldName) {
                const assignmentValue = record[fieldName as keyof APCRecord];
                if (assignmentValue && typeof assignmentValue === 'string' && assignmentValue.trim() !== '') {
                    // It's an eligible orphan

                    const normalizedFileNo = record.file_no.padStart(4, '0');
                    const mandateId = assignedStaffMap.get(normalizedFileNo);

                    const orphanStaff: StaffMandateAssignment = {
                        id: `orphan-${record.id}`, // Temporary ID for UI
                        staff_no: record.file_no,
                        staff_name: record.name,
                        rank: 'N/A',
                        current_station: record.station || 'Unknown',
                        conr: record.conraiss || '',
                        apc_id: record.id,
                        mandate_id: mandateId || null
                    };

                    if (mandateId) {
                        const col = mandateColumns.find(c => c.id === mandateId);
                        if (col) {
                            col.staff.push(orphanStaff);
                        }
                    } else {
                        unassignedStaff.push(orphanStaff);
                    }
                }
            }
        }
    });

    return {
        assignmentId: assignment.id,
        unassignedStaff,
        mandateColumns
    };
};

export const assignStaffToMandate = async (
    staff: StaffMandateAssignment,
    mandateId: string,
    assignment: Assignment,
    mandateName: string,
    existingRecord?: APCRecord
): Promise<string> => {
    const fieldName = assignmentFieldMap[assignment.code];
    if (!fieldName) throw new Error(`Unknown assignment code: ${assignment.code}`);

    // If staff already has an APC record for this assignment, update it
    let apcId = staff.apc_id;

    if (apcId) {
        let payload: any = {
            file_no: staff.staff_no,
            name: staff.staff_name,
            [fieldName]: mandateName,
        };

        if (existingRecord) {
            // Merge valid fields from existing record
            // We destructure to remove fields that should not be in the update payload
            const { id, created_at, updated_at, created_by, updated_by, ...rest } = existingRecord;
            payload = {
                ...rest,
                ...payload // Overwrite with new values
            };
        }

        await updateAPC(apcId, payload);
    } else {
        // Should not happen if we enforce eligibility (must have APC record), 
        // but for safety/fallback:
        const newData: any = {
            file_no: staff.staff_no,
            name: staff.staff_name,
            conraiss: staff.conr,
            station: staff.current_station,
            remark: 'Assigned via Board',
            active: true
        };
        newData[fieldName] = mandateName;
        const newRecord = await createAPC(newData);
        apcId = newRecord.id;
    }
    return apcId;
};

// Helper: Get Posting Record
const getPostingRecord = async (staffNo: string) => {
    // In a real scenario, use a specific endpoint search.
    // Assuming getAllPostingRecords supports search? Or filtering client side.
    // The current service `getAllPostingRecords` takes no arguments and returns ALL records.
    // This is a performance bottleneck but we proceed with getAllPostingRecords().
    const all = await getAllPostingRecords();
    return all.find(p => p.file_no === staffNo);
};

export const bulkSaveAssignments = async (
    payload: {
        assignment: Assignment;
        mandate?: MandateColumn;
        station?: { id: string; name: string; type: string };
        changes: { staff: StaffMandateAssignment; action: 'add' | 'remove' | 'move'; targetMandateId: string | null }[];
    }
): Promise<void> => {
    const { assignment, changes, station } = payload;
    const errors: string[] = [];

    // Pre-fetch all posting records once
    let allPostingsRequest = await getAllPostingRecords();
    const postingMap = new Map<string, any>(allPostingsRequest.map(p => [p.file_no, p]));
    const modifiedStaffNos = new Set<string>();

    // NEW: Fetch all APC records once for in-memory lookup (User Request)
    // This bypasses unreliable backend search for specific file numbers
    const allAPCResponse = await getAllAPC(0, 100000, '', true);
    const allAPCItems = allAPCResponse.items || [];

    for (const change of changes) {
        try {
            // 1. Validate APC (Count)
            // Normalize inputs
            const rawStaffNo = change.staff.staff_no ? change.staff.staff_no.toString().trim() : '';
            const normalizedStaffNo = rawStaffNo.padStart(4, '0');

            // Find match in memory
            const findMatch = (items: any[]) => {
                return items.find(i => {
                    if (!i.file_no) return false;
                    const iRaw = i.file_no.toString().trim();
                    const iNorm = iRaw.padStart(4, '0');

                    // Direct string matches
                    if (iRaw === rawStaffNo || iNorm === normalizedStaffNo || iRaw === normalizedStaffNo) return true;

                    // Numeric match (robust against leading zeros differences like 003411 vs 3411)
                    const iNum = parseInt(iRaw, 10);
                    const rawNum = parseInt(rawStaffNo, 10);
                    if (!isNaN(iNum) && !isNaN(rawNum) && iNum === rawNum) return true;

                    return false;
                });
            };

            let apcRecord = findMatch(allAPCItems);

            // Debug failure
            if (!apcRecord) {
                // If not found in the entire loaded list
                console.warn(`APC Look up failed for ${rawStaffNo} (Norm: ${normalizedStaffNo}). Checked against ${allAPCItems.length} loaded records.`);
                if (change.action === 'add') throw new Error(`Staff ${change.staff.staff_no} not found in APC records.`);
            }

            // Update local staff object with normalized data from APC Record
            if (apcRecord) {
                change.staff.apc_id = apcRecord.id;
                change.staff.staff_no = apcRecord.file_no;
                change.staff.staff_name = apcRecord.name;
                // We ensure we send exactly what is in DB to avoid validation errors
            }

            const allottedCount = apcRecord ? (apcRecord.count || 0) : 0;
            // Use normalized staff no for map lookup too
            let postingRecord = postingMap.get(change.staff.staff_no); // now change.staff.staff_no is normalized

            // Calculate current posted count from Posting Record
            let currentPostedCount = 0;
            if (postingRecord) {
                // Use posted_for or array length? Trust array length if available
                currentPostedCount = postingRecord.assignments?.length || 0;
            }

            let mandateName = payload.mandate?.title || 'Unknown Mandate';
            const assignmentVenue = station ? station.name : '';

            // 2. Perform Action
            if (change.action === 'add') {
                // CHECK LIMIT & COUNT
                // Strict check: Count must be > 0 to post (Quota Logic)
                if (allottedCount <= 0) {
                    throw new Error(`Posting limit reached for ${change.staff.staff_name}. Allotted count is 0. Cannot post.`);
                }

                // Truncate mandate name to fit DB schema
                if (mandateName.length > 50) {
                    mandateName = mandateName.substring(0, 50);
                }

                // Update APC - Clear eligibility field
                if (apcRecord && change.staff.apc_id) {
                    const fieldName = assignmentFieldMap[assignment.code];
                    if (fieldName) {
                        // PRESERVE DATA: Spread existing record
                        // STATIC COUNT: Do not change count
                        const newCount = apcRecord.count || 0;

                        const { id, created_at, updated_at, created_by, updated_by, ...cleanRecord } = apcRecord;

                        await updateAPC(change.staff.apc_id, {
                            ...cleanRecord, // Preserve other fields!
                            [fieldName]: '', // Clear assignment
                            count: newCount,
                            file_no: change.staff.staff_no, // Update/Ensure these are correct
                            name: change.staff.staff_name
                        } as any);
                    }
                }

                // Update Posting
                const newAssignments = postingRecord?.assignments ? [...postingRecord.assignments, assignment.code] : [assignment.code];
                const newMandates = postingRecord?.mandates ? [...postingRecord.mandates, mandateName] : [mandateName];
                const newVenues = postingRecord?.assignment_venue ? [...postingRecord.assignment_venue, assignmentVenue] : [assignmentVenue];

                // Posting record count logic
                const newCount = allottedCount;
                const newPostedFor = newAssignments.length;
                const newToBePosted = newCount - newPostedFor;

                const postingPayload: PostingCreate | PostingUpdate = {
                    file_no: change.staff.staff_no,
                    name: change.staff.staff_name,
                    station: change.staff.current_station,
                    conraiss: change.staff.conr,
                    year: new Date().getFullYear().toString(),
                    count: newCount,
                    posted_for: newPostedFor,
                    to_be_posted: newToBePosted,
                    assignment_venue: newVenues,
                    assignments: newAssignments,
                    mandates: newMandates
                };

                if (postingRecord) {
                    await updatePosting(postingRecord.id, postingPayload);
                } else {
                    await createPosting(postingPayload as PostingCreate);
                }

            } else if (change.action === 'remove') {
                // Logic for REMOVE (Un-assign)

                // Update APC - Set to 'Returned'
                if (apcRecord && change.staff.apc_id) {
                    const fieldName = assignmentFieldMap[assignment.code];
                    if (fieldName) {
                        // PRESERVE DATA: Spread existing record
                        // STATIC COUNT: Do not change count
                        const newCount = apcRecord.count || 0;

                        const { id, created_at, updated_at, created_by, updated_by, ...cleanRecord } = apcRecord;

                        await updateAPC(change.staff.apc_id, {
                            ...cleanRecord, // Preserve other fields!
                            [fieldName]: 'Returned',
                            count: newCount,
                            file_no: change.staff.staff_no,
                            name: change.staff.staff_name
                        } as any);
                    }
                }

                // Remove from Posting
                if (postingRecord) {
                    const idx = postingRecord.assignments?.indexOf(assignment.code);
                    if (idx !== -1 && idx !== undefined) {
                        const newAssignments = [...(postingRecord.assignments || [])];
                        const newMandates = [...(postingRecord.mandates || [])];
                        const newVenues = [...(postingRecord.assignment_venue || [])];

                        // Remove at index
                        newAssignments.splice(idx, 1);
                        newMandates.splice(idx, 1);
                        newVenues.splice(idx, 1);

                        const newCount = allottedCount;

                        const newPostedFor = newAssignments.length;
                        const newToBePosted = newCount - newPostedFor;

                        const updatedRecord = {
                            count: newCount,
                            posted_for: newPostedFor,
                            to_be_posted: newToBePosted,
                            assignments: newAssignments,
                            mandates: newMandates,
                            assignment_venue: newVenues
                        };

                        await updatePosting(postingRecord.id, updatedRecord);
                    }
                }
            } else if (change.action === 'move') {
                // Move = Remove Old + Add New
                // Technically we just update values.
                // Verify Limit? If moving, count stays same.

                // Update APC (Already done by assignStaffToMandate which serves as upsert)
                // await assignStaffToMandate(change.staff, change.targetMandateId!, assignment, mandateName, apcRecord);

                // Update Posting:
                // Find existing assignment index?
                // If they are moving mandates within SAME assignment type?
                // Yes, 'move' implies same assignment, different mandate column.

                if (postingRecord) {
                    const idx = postingRecord.assignments?.indexOf(assignment.code);
                    if (idx !== -1 && idx !== undefined) {
                        // Update existing entry
                        const newMandates = [...(postingRecord.mandates || [])];
                        const newVenues = [...(postingRecord.assignment_venue || [])];

                        newMandates[idx] = mandateName;
                        newVenues[idx] = assignmentVenue;

                        const updatedRecord = {
                            ...postingRecord,
                            mandates: newMandates,
                            assignment_venue: newVenues
                            // counts don't change
                        };
                        Object.assign(postingRecord, updatedRecord);
                        modifiedStaffNos.add(change.staff.staff_no);
                    } else {
                        // Weird, moving but not in posting? Treat as Add
                        // This resembles 'Add' logic.
                        const newAssignments = postingRecord?.assignments ? [...postingRecord.assignments, assignment.code] : [assignment.code];
                        const newMandates = postingRecord?.mandates ? [...postingRecord.mandates, mandateName] : [mandateName];
                        const newVenues = postingRecord?.assignment_venue ? [...postingRecord.assignment_venue, assignmentVenue] : [assignmentVenue];

                        const newCount = allottedCount;
                        const newPostedFor = newAssignments.length;
                        const newToBePosted = newCount - newPostedFor;

                        if (newToBePosted < 0) throw new Error("Limit reached (correction).");

                        const updatedRecord = {
                            ...postingRecord,
                            count: newCount,
                            posted_for: newPostedFor,
                            to_be_posted: newToBePosted,
                            assignments: newAssignments,
                            mandates: newMandates,
                            assignment_venue: newVenues
                        };
                        Object.assign(postingRecord, updatedRecord);
                        modifiedStaffNos.add(change.staff.staff_no);
                    }
                } else {
                    // Create new
                    const postingPayload: PostingCreate = {
                        file_no: change.staff.staff_no,
                        name: change.staff.staff_name,
                        station: change.staff.current_station,
                        conraiss: change.staff.conr,
                        year: new Date().getFullYear().toString(),
                        count: allottedCount,
                        posted_for: 1,
                        to_be_posted: allottedCount - 1,
                        assignments: [assignment.code],
                        mandates: [mandateName],
                        assignment_venue: [assignmentVenue]
                    };
                    if (postingPayload.to_be_posted! < 0) throw new Error("Limit reached.");
                    postingMap.set(change.staff.staff_no, postingPayload);
                    modifiedStaffNos.add(change.staff.staff_no);
                }
            }

        } catch (error: any) {
            console.error(`Failed to process change for ${change.staff.staff_no}`, error);
            errors.push(error.message || `Failed to save ${change.staff.staff_name}`);
        }
    }



    if (errors.length > 0) {
        throw new Error(errors.join('\n'));
    }

    // Bulk Save Postings
    if (modifiedStaffNos.size > 0) {
        const batch: PostingCreate[] = [];
        for (const staffNo of modifiedStaffNos) {
            const record = postingMap.get(staffNo);
            if (record) {
                // Sanitize for PostingCreate (remove ID, dates, etc if present from existing record merging)
                // Actually PostingCreate doesn't forbid extra fields if we cast, but better to be clean
                const { id, created_at, updated_at, created_by, updated_by, ...cleanRecord } = record;
                batch.push(cleanRecord as PostingCreate);
            }
        }
        if (batch.length > 0) {
            await bulkCreatePostings({ items: batch });
        }
    }
};

export interface CSVPostingData {
    staffNo: string;
    name?: string;
    station?: string;
    conraiss?: string;
    count?: number;
    assignments?: string[];
    mandate?: string;
    venue?: string;
    mandateCode?: string; // Legacy support or alias for mandate
}

export const parseAssignmentCSV = async (file: File): Promise<CSVPostingData[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (!text) return resolve([]);
            const lines = text.split('\n');
            const result: CSVPostingData[] = [];

            const headers = lines[0].toLowerCase().split(',').map(h => h.trim());

            // Map headers to indices
            const getIndex = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));

            const idxStaffNo = getIndex(['staff', 'no']);
            const idxName = getIndex(['name']);
            const idxStation = getIndex(['station']);
            const idxConraiss = getIndex(['conr', 'rank']);
            const idxCount = getIndex(['count']);
            const idxAssignments = getIndex(['assignment']);
            const idxMandate = getIndex(['mandate', 'code']);
            const idxVenue = getIndex(['venue']);

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                // Basic CSV split (does not handle quoted commas, but sufficient for simple templates)
                const cols = line.split(',').map(c => c.trim());

                if (idxStaffNo === -1 || !cols[idxStaffNo]) continue;

                const data: CSVPostingData = {
                    staffNo: cols[idxStaffNo],
                };

                if (idxName !== -1) data.name = cols[idxName];
                if (idxStation !== -1) data.station = cols[idxStation];
                if (idxConraiss !== -1) data.conraiss = cols[idxConraiss];
                if (idxCount !== -1) data.count = parseInt(cols[idxCount]) || 0;

                if (idxAssignments !== -1 && cols[idxAssignments]) {
                    // Assume comma-separated or similar in single cell? 
                    // Or typically just one assignment per row for this template?
                    // Template header said "Assignments". Let's assume text.
                    // If multiple, maybe separated by semi-colon to avoid CSV conflict? 
                    // Or simple string is fine.
                    data.assignments = [cols[idxAssignments]];
                }

                if (idxMandate !== -1) {
                    data.mandate = cols[idxMandate];
                    data.mandateCode = cols[idxMandate];
                }

                if (idxVenue !== -1) data.venue = cols[idxVenue];

                result.push(data);
            }
            resolve(result);
        };
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
};

export const removeStaffFromMandate = async (staff: StaffMandateAssignment): Promise<void> => {
    if (staff.apc_id) {
        await deleteAPC(staff.apc_id);
    }
}
