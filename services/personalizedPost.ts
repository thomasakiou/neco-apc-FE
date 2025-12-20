import { AssignmentBoardData, MandateColumn, StaffMandateAssignment, APCRecord } from '../types/apc';
import { getAllStaff } from './staff';
import { getMandatesByAssignment } from './assignment';
import { getAllAPC, createAPC, updateAPC, deleteAPC } from './apc';
import { Assignment } from '../types/assignment';
import { getAllPostingRecords, bulkCreatePostings, createPosting, updatePosting } from './posting';
import { PostingCreate, PostingUpdate, BulkPostingCreateRequest } from '../types/posting';

// Map assignment codes and common names to APC field names
export const assignmentFieldMap: { [key: string]: string } = {
    // Codes
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
    'STOCK-TK': 'stock_tk',

    // Common Names (Fallback for existing records)
    'TEACHING TABLE': 'tt',
    'SSCE INTERNAL': 'ssce_int',
    'SSCE EXTERNAL': 'ssce_ext',
    'SSCE INTERNAL MARKING': 'ssce_int_mrk',
    'SSCE EXTERNAL MARKING': 'ssce_ext_mrk',
    'NATIONAL COMMON ENTRANCE EXAMINATION': 'ncee',
    'BASIC EDUCATION CERTIFICATE EXAMINATION': 'becep',
    'BASIC EDUCATION CERTIFICATE EXAMINATION MARKING': 'bece_mrkp',
    'MARCH ACCREDITATION': 'mar_accr',
    'OCTOBER ACCREDITATION': 'oct_accr',
    'PURCHASE SAMPLES': 'pur_samp',
    'GIFTED EXAMINATION': 'gifted',
    'INTERNAL AUDIT': 'int_audit',
    'STOCK TAKING': 'stock_tk'
};

// Module-level caches for heavy data
let staffCache: any[] | null = null;
let apcCacheFull: any[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const getAssignmentBoardData = async (assignment: Assignment): Promise<AssignmentBoardData> => {
    const now = Date.now();
    const useCache = staffCache && apcCacheFull && (now - lastCacheTime < CACHE_TTL);

    // 1. Fetch data (with caching logic)
    const [mandates, allStaff, apcResponse, allPostings] = await Promise.all([
        getMandatesByAssignment(assignment),
        useCache ? Promise.resolve(staffCache) : getAllStaff(true),
        useCache ? Promise.resolve({ items: apcCacheFull }) : getAllAPC(0, 100000, '', true),
        getAllPostingRecords(true) // Always fetch postings fresh as they change frequently
    ]);

    // Update caches
    if (!useCache) {
        staffCache = allStaff;
        apcCacheFull = apcResponse.items;
        lastCacheTime = now;
    }

    const fieldName = assignmentFieldMap[assignment.code];

    // 2. Map mandates to columns
    const mandateColumns: MandateColumn[] = mandates.map(mandate => ({
        id: mandate.id,
        title: mandate.mandate,
        code: mandate.code,
        station: mandate.station,
        active: mandate.active,
        staff: []
    }));

    // 3. Create high-speed maps
    const assignedStaffMap = new Map<string, string>(); // staff_no -> mandate_id
    const apcMap = new Map<string, any>(); // staff_no -> apc_record
    const staffPostingsCount = new Map<string, number>(); // staff_no -> count
    const staffPostedSpecifics = new Map<string, Set<string>>(); // staff_no -> specifics

    apcResponse.items.forEach((record: any) => {
        const normalizedFileNo = record.file_no.padStart(4, '0');
        apcMap.set(normalizedFileNo, record);

        if (fieldName) {
            const assignmentValue = record[fieldName as keyof APCRecord];
            if (assignmentValue && typeof assignmentValue === 'string' && assignmentValue.trim() !== '') {
                const matchedMandate = mandateColumns.find(m =>
                    m.title.toLowerCase() === assignmentValue.toLowerCase() ||
                    m.code.toLowerCase() === assignmentValue.toLowerCase()
                );
                if (matchedMandate) assignedStaffMap.set(normalizedFileNo, matchedMandate.id);
            }
        }
    });

    allPostings.forEach(p => {
        const assignmentsArr = Array.isArray(p.assignments) ? p.assignments : [];
        staffPostingsCount.set(p.file_no, (staffPostingsCount.get(p.file_no) || 0) + assignmentsArr.length);

        if (assignmentsArr.length > 0) {
            const specificSet = staffPostedSpecifics.get(p.file_no) || new Set();
            assignmentsArr.forEach(code => specificSet.add(code));
            staffPostedSpecifics.set(p.file_no, specificSet);
        }
    });

    // 4. Distribute staff
    const unassignedStaff: StaffMandateAssignment[] = [];
    const usedApcIds = new Set<string>();

    allStaff!.forEach((staff: any) => {
        const normalizedStaffFileNo = staff.fileno.padStart(4, '0');
        const postedSpecifics = staffPostedSpecifics.get(normalizedStaffFileNo);

        // Hide if already posted for THIS assignment type
        if (postedSpecifics && postedSpecifics.has(assignment.code)) return;

        const existingApcRecord = apcMap.get(normalizedStaffFileNo);
        const totalPosted = staffPostingsCount.get(normalizedStaffFileNo) || 0;
        const totalAllotted = existingApcRecord?.count || 0;
        const assignLeft = Math.max(0, totalAllotted - totalPosted);
        const mandateId = assignedStaffMap.get(normalizedStaffFileNo);

        if (assignLeft <= 0 && !mandateId) return; // Hide exhausted staff unless they are already assigned on board

        if (existingApcRecord) usedApcIds.add(existingApcRecord.id);

        const staffAssignment: StaffMandateAssignment = {
            id: staff.id,
            staff_no: staff.fileno,
            staff_name: staff.full_name,
            rank: staff.rank || '',
            current_station: staff.station || '',
            conr: staff.conr || '',
            mandate_id: mandateId || null,
            apc_id: existingApcRecord?.id,
            total_allotted: totalAllotted,
            assign_left: assignLeft
        };

        if (mandateId) {
            mandateColumns.find(c => c.id === mandateId)?.staff.push(staffAssignment);
        } else if (existingApcRecord && fieldName) {
            const val = existingApcRecord[fieldName as keyof APCRecord];
            if (val && val.toString().trim() !== '') unassignedStaff.push(staffAssignment);
        }
    });

    // 5. Handle Orphans
    apcResponse.items.forEach((record: any) => {
        if (!usedApcIds.has(record.id) && fieldName) {
            const val = record[fieldName as keyof APCRecord];
            if (val && val.toString().trim() !== '') {
                const normalizedFileNo = record.file_no.padStart(4, '0');
                const mandateId = assignedStaffMap.get(normalizedFileNo);
                const assignLeft = Math.max(0, (record.count || 0) - (staffPostingsCount.get(normalizedFileNo) || 0));

                if (assignLeft <= 0 && !mandateId) return;

                const orphanStaff: StaffMandateAssignment = {
                    id: `orphan-${record.id}`,
                    staff_no: record.file_no,
                    staff_name: record.name,
                    rank: 'N/A',
                    current_station: record.station || 'Unknown',
                    conr: record.conraiss || '',
                    apc_id: record.id,
                    mandate_id: mandateId || null,
                    total_allotted: record.count || 0,
                    assign_left: assignLeft
                };

                if (mandateId) {
                    mandateColumns.find(c => c.id === mandateId)?.staff.push(orphanStaff);
                } else {
                    unassignedStaff.push(orphanStaff);
                }
            }
        }
    });

    return { assignmentId: assignment.id, unassignedStaff, mandateColumns };
};

export const bulkSaveAssignments = async (
    payload: {
        assignment: Assignment;
        mandate?: MandateColumn;
        station?: { id: string; name: string; type: string };
        changes: { staff: StaffMandateAssignment; action: 'add' | 'remove' | 'move'; targetMandateId: string | null }[];
        numberOfNights?: number;
    }
): Promise<void> => {
    const { assignment, changes, station, numberOfNights } = payload;
    if (!assignment || !changes || changes.length === 0) return;

    // Load heavy dependencies once
    const [allPostings, allAPCResp, mandates] = await Promise.all([
        getAllPostingRecords(true),
        getAllAPC(0, 100000, '', true),
        getMandatesByAssignment(assignment)
    ]);
    const postingMap = new Map<string, any>(allPostings.map(p => [p.file_no, p]));
    const apcMap = new Map<string, any>(allAPCResp.items.map(a => [a.file_no.padStart(4, '0'), a]));
    const mandateLookup = new Map<string, any>(mandates.map(m => [m.id, m]));
    const modifiedStaffNos = new Set<string>();
    const fieldName = assignmentFieldMap[assignment.code];

    // Process all changes in memory first
    for (const change of changes) {
        const normalizedStaffNo = change.staff.staff_no.toString().padStart(4, '0');
        const apcRecord = apcMap.get(normalizedStaffNo);

        if (!apcRecord && change.action === 'add') throw new Error(`Staff ${change.staff.staff_no} not found in APC records.`);

        const allottedCount = numberOfNights !== undefined ? numberOfNights : (apcRecord?.count || 0);
        const postingRecord = postingMap.get(normalizedStaffNo);
        const totalPosted = postingRecord ? (postingRecord.assignments || []).length : 0;

        let mandateName = 'Unknown Mandate';
        if (change.targetMandateId) {
            mandateName = mandateLookup.get(change.targetMandateId)?.mandate || 'Unknown Mandate';
        } else if (payload.mandate) {
            mandateName = payload.mandate.title;
        }

        const venue = station?.name || '';

        if (change.action === 'add' || change.action === 'move') {
            if (change.action === 'add' && allottedCount - totalPosted <= 0) {
                throw new Error(`Limit reached for ${change.staff.staff_name}.`);
            }

            // APC Sync (Immediate but could be batched later if needed)
            if (change.action === 'add' && apcRecord && fieldName) {
                const { id, created_at, updated_at, created_by, updated_by, ...clean } = apcRecord;
                await updateAPC(id, { ...clean, [fieldName]: '' });
            }

            // Posting Prep
            const newAssignments = postingRecord?.assignments ? [...postingRecord.assignments] : [];
            const newMandates = postingRecord?.mandates ? [...postingRecord.mandates] : [];
            const newVenues = postingRecord?.assignment_venue ? [...postingRecord.assignment_venue] : [];

            const existingIdx = newAssignments.indexOf(assignment.code);
            if (existingIdx !== -1) {
                newAssignments.splice(existingIdx, 1); newMandates.splice(existingIdx, 1); newVenues.splice(existingIdx, 1);
            }

            newAssignments.push(assignment.code);
            newMandates.push(mandateName.substring(0, 50));
            newVenues.push(venue);

            postingMap.set(normalizedStaffNo, {
                ...(postingRecord || {}),
                file_no: normalizedStaffNo,
                name: change.staff.staff_name,
                station: change.staff.current_station,
                conraiss: change.staff.conr,
                year: new Date().getFullYear().toString(),
                count: allottedCount,
                posted_for: newAssignments.length,
                to_be_posted: allottedCount - newAssignments.length,
                assignments: newAssignments,
                mandates: newMandates,
                assignment_venue: newVenues
            });
            modifiedStaffNos.add(normalizedStaffNo);

        } else if (change.action === 'remove') {
            if (apcRecord && fieldName) {
                const { id, created_at, updated_at, created_by, updated_by, ...clean } = apcRecord;
                await updateAPC(id, { ...clean, [fieldName]: 'Returned' });
            }

            if (postingRecord) {
                const idx = postingRecord.assignments?.indexOf(assignment.code);
                if (idx !== -1 && idx !== undefined) {
                    postingRecord.assignments.splice(idx, 1);
                    postingRecord.mandates.splice(idx, 1);
                    postingRecord.assignment_venue.splice(idx, 1);
                    postingRecord.posted_for = postingRecord.assignments.length;
                    postingRecord.to_be_posted = allottedCount - postingRecord.posted_for;
                    modifiedStaffNos.add(normalizedStaffNo);
                }
            }
        }
    }

    // Final Batch Update (Parallel for speed)
    if (modifiedStaffNos.size > 0) {
        const batch = Array.from(modifiedStaffNos).map(s => {
            const rec = postingMap.get(s);
            const { id, created_at, updated_at, created_by, updated_by, ...clean } = rec;
            return clean as PostingCreate;
        });
        await bulkCreatePostings({ items: batch });
    }

    // Invalidate local caches to force fresh data on next load
    lastCacheTime = 0;
};

export const assignStaffToMandate = async () => { }; // Stub for unused
export const parseAssignmentCSV = async (file: File): Promise<CSVPostingData[]> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (!text) return resolve([]);

            // Handle different line endings
            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) return resolve([]);

            const headers = lines[0].toLowerCase().split(',').map(h => h.trim());

            // Detect indices
            const idxStaffNo = headers.findIndex(h => h.includes('staff') || h.includes('file') || h.includes('no'));
            const idxMandate = headers.findIndex(h => h.includes('mandate') || h.includes('code'));
            const idxName = headers.findIndex(h => h.includes('name'));
            const idxStation = headers.findIndex(h => h.includes('station') || h.includes('venue'));

            if (idxStaffNo === -1) return resolve([]);

            const result = lines.slice(1).map(line => {
                const cols = line.split(',').map(c => c.trim());
                if (!cols[idxStaffNo]) return null;

                return {
                    staffNo: cols[idxStaffNo].padStart(4, '0'),
                    mandateCode: idxMandate !== -1 ? cols[idxMandate] : undefined,
                    name: idxName !== -1 ? cols[idxName] : undefined,
                    station: idxStation !== -1 ? cols[idxStation] : undefined
                };
            }).filter(Boolean) as CSVPostingData[];

            resolve(result);
        };
        reader.readAsText(file);
    });
};
export const removeStaffFromMandate = async (staff: StaffMandateAssignment): Promise<void> => {
    if (staff.apc_id) await deleteAPC(staff.apc_id);
};

export interface CSVPostingData {
    staffNo: string;
    mandateCode?: string;
    name?: string;
    station?: string;
}
