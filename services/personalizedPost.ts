import { AssignmentBoardData, MandateColumn, StaffMandateAssignment, APCRecord } from '../types/apc';
import { getAllStaff } from './staff';
import { getMandatesByAssignment } from './assignment';
import { getAllAPC, createAPC, updateAPC, deleteAPC } from './apc';
import { Assignment } from '../types/assignment';
import { getAllPostingRecords, bulkCreatePostings, bulkDeletePostings, createPosting, updatePosting } from './posting';
import { getAllFinalPostings } from './finalPosting';
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
    const [mandates, allStaff, apcResponse, allPostings, allFinalPostings] = await Promise.all([
        getMandatesByAssignment(assignment),
        useCache ? Promise.resolve(staffCache) : getAllStaff(true),
        useCache ? Promise.resolve({ items: apcCacheFull }) : getAllAPC(0, 100000, '', true),
        getAllPostingRecords(true), // Always fetch postings fresh as they change frequently
        getAllFinalPostings() // Also fetch final postings to exclude already archived staff
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
        const normalizedFileNo = record.file_no.toString().padStart(4, '0');
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

    // Process Posting table records
    allPostings.forEach(p => {
        const normalizedFileNo = p.file_no.toString().padStart(4, '0');
        const assignmentsArr = Array.isArray(p.assignments) ? p.assignments : [];
        staffPostingsCount.set(normalizedFileNo, (staffPostingsCount.get(normalizedFileNo) || 0) + assignmentsArr.length);

        if (assignmentsArr.length > 0) {
            const specificSet = staffPostedSpecifics.get(normalizedFileNo) || new Set();
            assignmentsArr.forEach(code => {
                if (code) specificSet.add(code.toString().trim().toUpperCase());
            });
            staffPostedSpecifics.set(normalizedFileNo, specificSet);
        }
    });

    // Process Final Posting table records (to also exclude archived staff)
    const finalPostingItems = allFinalPostings.items || (Array.isArray(allFinalPostings) ? allFinalPostings : []);
    finalPostingItems.forEach((p: any) => {
        const normalizedFileNo = p.file_no.toString().padStart(4, '0');
        const assignmentsArr = Array.isArray(p.assignments) ? p.assignments : [];
        // Add to count for final postings too
        staffPostingsCount.set(normalizedFileNo, (staffPostingsCount.get(normalizedFileNo) || 0) + assignmentsArr.length);

        if (assignmentsArr.length > 0) {
            const specificSet = staffPostedSpecifics.get(normalizedFileNo) || new Set();
            assignmentsArr.forEach((code: any) => {
                if (code) specificSet.add(code.toString().trim().toUpperCase());
            });
            staffPostedSpecifics.set(normalizedFileNo, specificSet);
        }
    });

    // 4. Distribute staff
    const unassignedStaff: StaffMandateAssignment[] = [];
    const usedApcIds = new Set<string>();

    allStaff!.forEach((staff: any) => {
        const normalizedStaffFileNo = staff.fileno.toString().padStart(4, '0');
        const postedSpecifics = staffPostedSpecifics.get(normalizedStaffFileNo);

        // Hide if already posted for THIS assignment type (Case-Insensitive)
        // Check both assignment code AND name since postings may store either
        const normalize = (s: string) => s.toString().trim().toUpperCase();
        const assignmentCode = normalize(assignment.code);
        const assignmentName = normalize(assignment.name);

        if (postedSpecifics) {
            // Check if any stored value matches the code or name
            const isPosted = Array.from(postedSpecifics).some(stored =>
                stored === assignmentCode ||
                stored === assignmentName ||
                assignmentName.includes(stored) ||
                stored.includes(assignmentCode)
            );
            if (isPosted) return;
        }

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
            qualification: existingApcRecord?.qualification || '',
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
            const normalizedFileNo = record.file_no.toString().padStart(4, '0');
            const postedSpecifics = staffPostedSpecifics.get(normalizedFileNo);

            // Hide if already posted for THIS assignment type (Case-Insensitive)
            // Check both assignment code AND name since postings may store either
            const normalize = (s: string) => s.toString().trim().toUpperCase();
            const assignmentCode = normalize(assignment.code);
            const assignmentName = normalize(assignment.name);

            if (postedSpecifics) {
                // Check if any stored value matches the code or name
                const isPosted = Array.from(postedSpecifics).some(stored =>
                    stored === assignmentCode ||
                    stored === assignmentName ||
                    assignmentName.includes(stored) ||
                    stored.includes(assignmentCode)
                );

                if (isPosted) return;
            }

            const val = record[fieldName as keyof APCRecord];
            if (val && val.toString().trim() !== '') {
                const mandateId = assignedStaffMap.get(normalizedFileNo);
                const assignLeft = Math.max(0, (record.count || 0) - (staffPostingsCount.get(normalizedFileNo) || 0));

                if (assignLeft <= 0 && !mandateId) return;

                const orphanStaff: StaffMandateAssignment = {
                    id: `orphan-${record.id}`,
                    staff_no: record.file_no,
                    staff_name: record.name,
                    rank: 'N/A',
                    current_station: record.station || 'Unknown',
                    qualification: record.qualification || '',
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
        station?: { id: string; name: string; type: string; state?: string | null; code?: string };
        changes: { staff: StaffMandateAssignment; action: 'add' | 'remove' | 'move'; targetMandateId: string | null; station?: { name: string; state?: string; code?: string } }[];
        numberOfNights?: number;
        description?: string;
    }
): Promise<void> => {
    const { assignment, changes, station, numberOfNights, description } = payload;
    if (!assignment || !changes || changes.length === 0) return;

    // Load heavy dependencies once
    const [allPostings, allAPCResp, mandates] = await Promise.all([
        getAllPostingRecords(true),
        getAllAPC(0, 100000, '', true),
        getMandatesByAssignment(assignment)
    ]);
    const postingMap = new Map<string, any>(allPostings.map(p => [p.file_no.toString().padStart(4, '0'), p]));
    const apcMap = new Map<string, any>(allAPCResp.items.map(a => [a.file_no.toString().padStart(4, '0'), a]));
    const mandateLookup = new Map<string, any>(mandates.map(m => [m.id, m]));
    const modifiedStaffNos = new Set<string>();
    const fieldName = assignmentFieldMap[assignment.code];

    // Process all changes in memory first
    for (const change of changes) {
        const normalizedStaffNo = change.staff.staff_no.toString().padStart(4, '0');
        const apcRecord = apcMap.get(normalizedStaffNo);

        if (!apcRecord && change.action === 'add') throw new Error(`Staff ${change.staff.staff_no} not found in APC records.`);

        const allottedCount = numberOfNights !== undefined ? numberOfNights : (apcRecord?.count || 0);
        const apcLimit = apcRecord?.count || 0; // Use APC limit for validation
        const postingRecord = postingMap.get(normalizedStaffNo);
        const totalPosted = postingRecord ? (postingRecord.assignments || []).length : 0;

        let mandateName = 'Unknown Mandate';
        if (change.targetMandateId) {
            mandateName = mandateLookup.get(change.targetMandateId)?.mandate || 'Unknown Mandate';
        } else if (payload.mandate) {
            mandateName = payload.mandate.title;
        }

        // Use override station if provided, otherwise fallback to global station
        const venue = change.station?.name || station?.name || '';
        const venueCode = change.station?.code || station?.code || '';

        if (change.action === 'add' || change.action === 'move') {
            const existingAssignments = postingRecord?.assignments || [];
            if (change.action === 'add' && existingAssignments.some((a: any) => {
                const code = typeof a === 'string' ? a : a.code || a.name;
                return code?.toString().trim().toUpperCase() === assignment.code.toString().trim().toUpperCase();
            })) {
                throw new Error(`${change.staff.staff_name} is already posted for ${assignment.name}.`);
            }

            if (change.action === 'add' && apcLimit - totalPosted <= 0) {
                throw new Error(`Limit reached for ${change.staff.staff_name}. (Allowed: ${apcLimit}, Used: ${totalPosted})`);
            }

            // APC Sync (Immediate but could be batched later if needed)
            // Removed: APC fields are now only cleared during Archiving to Final Postings.
            /*
            if (change.action === 'add' && apcRecord && fieldName) {
                const { id, created_at, updated_at, created_by, updated_by, ...clean } = apcRecord;
                await updateAPC(id, { ...clean, [fieldName]: '' });
            }
            */

            // Ensure all arrays exist and are synchronized
            const newAssignments = postingRecord?.assignments ? [...postingRecord.assignments] : [];
            const newMandates = postingRecord?.mandates ? [...postingRecord.mandates] : newAssignments.map(_ => '');
            const newVenues = postingRecord?.assignment_venue ? [...postingRecord.assignment_venue] : newAssignments.map(_ => '');
            const newVenueCodes = postingRecord?.venue_code ? [...postingRecord.venue_code] : (postingRecord?.assignment_venue?.map(_ => '') || []);
            const newStates = postingRecord?.state ? [...postingRecord.state] : newAssignments.map(_ => '');

            // Pad if out of sync
            while (newMandates.length < newAssignments.length) newMandates.push('');
            while (newVenues.length < newAssignments.length) newVenues.push('');
            while (newVenueCodes.length < newAssignments.length) newVenueCodes.push('');
            while (newStates.length < newAssignments.length) newStates.push('');

            const normalize = (s: string) => s.toString().trim().toUpperCase();
            const targetCode = normalize(assignment.code);
            const existingIdx = newAssignments.findIndex(a => {
                const code = typeof a === 'string' ? a : a.code || a.name;
                return code && normalize(code) === targetCode;
            });

            if (existingIdx !== -1) {
                newAssignments.splice(existingIdx, 1);
                newMandates.splice(existingIdx, 1);
                newVenues.splice(existingIdx, 1);
                newVenueCodes.splice(existingIdx, 1);
                newStates.splice(existingIdx, 1);
            }

            // Determine specific venue for this assignment
            const matchedMandate = mandateLookup.get(change.targetMandateId || '');

            // Priority: Mandate Default > Change Override > Global Selection
            const finalVenue = matchedMandate?.station || change.station?.name || venue;
            // Extract code from final venue name if not explicitly provided
            let finalVenueCode = change.station?.code || station?.code || venueCode;
            if (!finalVenueCode && finalVenue) {
                const match = finalVenue.match(/^\(([^)]+)\)/); // match "(CODE)" at start
                if (match) finalVenueCode = match[1];
            }
            // Ensure we handle defaults if still missing
            finalVenueCode = finalVenueCode || '';

            let finalState = change.station?.state || station?.state || '';

            if (matchedMandate?.station?.includes('|')) {
                finalState = matchedMandate.station.split('|').pop()?.trim() || finalState;
            }

            newAssignments.push(assignment.code);
            newMandates.push(mandateName.substring(0, 50));
            newVenues.push(finalVenue);
            newVenueCodes.push(finalVenueCode);
            newStates.push(finalState);

            postingMap.set(normalizedStaffNo, {
                ...(postingRecord || {}),
                file_no: normalizedStaffNo,
                name: change.staff.staff_name,
                station: change.staff.current_station,
                conraiss: change.staff.conr,
                year: new Date().getFullYear().toString(),
                count: allottedCount,
                posted_for: newAssignments.length,
                to_be_posted: apcLimit - newAssignments.length,
                assignments: newAssignments,
                mandates: newMandates,
                assignment_venue: newVenues,
                venue_code: newVenueCodes,
                state: newStates,
                description: description || (postingRecord?.description) || null
            });
            modifiedStaffNos.add(normalizedStaffNo);

        } else if (change.action === 'remove') {
            // Removed: APC fields are now only restored during Deletion from Final Postings.
            /*
            if (apcRecord && fieldName) {
                const { id, created_at, updated_at, created_by, updated_by, ...clean } = apcRecord;
                await updateAPC(id, { ...clean, [fieldName]: 'Returned' });
            }
            */

            if (postingRecord) {
                const assignments = postingRecord.assignments ? [...postingRecord.assignments] : [];
                const mandates = postingRecord.mandates ? [...postingRecord.mandates] : [];
                const venues = postingRecord.assignment_venue ? [...postingRecord.assignment_venue] : [];
                const venueCodes = postingRecord.venue_code ? [...postingRecord.venue_code] : [];
                const states = postingRecord.state ? [...postingRecord.state] : [];

                const normalize = (s: string) => s.toString().trim().toUpperCase();
                const targetCode = normalize(assignment.code);

                const idx = assignments.findIndex(a => {
                    const code = typeof a === 'string' ? a : a.code || a.name;
                    return code && normalize(code) === targetCode;
                });

                if (idx !== -1) {
                    assignments.splice(idx, 1);
                    mandates.splice(idx, 1);
                    venues.splice(idx, 1);
                    if (venueCodes.length > idx) venueCodes.splice(idx, 1);
                    if (states.length > idx) states.splice(idx, 1);

                    postingMap.set(normalizedStaffNo, {
                        ...postingRecord,
                        assignments,
                        mandates,
                        assignment_venue: venues,
                        venue_code: venueCodes,
                        state: states,
                        posted_for: assignments.length,
                        to_be_posted: allottedCount - assignments.length
                    });
                    modifiedStaffNos.add(normalizedStaffNo);
                }
            }
        }
    }

    // Final Batch Update (Parallel for speed)
    if (modifiedStaffNos.size > 0) {
        // To prevent duplicate ROWS for the same staff, we delete the old records before bulk creating new ones
        const idsToDelete = Array.from(modifiedStaffNos)
            .map(s => postingMap.get(s)?.id)
            .filter(id => id);

        if (idsToDelete.length > 0) {
            await bulkDeletePostings(idsToDelete as string[]);
        }

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

            const splitCsvLine = (line: string) => {
                const result = [];
                let current = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        result.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
                result.push(current.trim());
                return result.map(val => val.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
            };

            const headers = splitCsvLine(lines[0].toLowerCase());

            // Detect indices - be more specific to avoid collisions
            const idxStaffNo = headers.findIndex(h => h === 'fileno' || h === 'staffno' || h.includes('file') || (h.includes('staff') && h.includes('no')));
            const idxName = headers.findIndex(h => h === 'name' || h.includes('staff name') || h.includes('full name'));
            const idxStation = headers.findIndex(h => h === 'station' || h === 'current station');
            const idxVenue = headers.findIndex(h => h === 'venue' || h === 'venues' || h === 'assignment venue');
            const idxAssignments = headers.findIndex(h => h === 'assignments' || h === 'assignment');
            const idxMandate = headers.findIndex(h => h === 'mandate' || h === 'mandates');
            const idxMandateCode = headers.findIndex(h => h === 'mandatecode' || h === 'code');
            const idxConraiss = headers.findIndex(h => h === 'conraiss' || h === 'rank');
            const idxCount = headers.findIndex(h => h === 'count' || h.includes('night'));
            const idxDescription = headers.findIndex(h => h === 'description');
            const idxState = headers.findIndex(h => h === 'state');

            if (idxStaffNo === -1) return resolve([]);

            const result = lines.slice(1).map(line => {
                if (!line.trim()) return null;
                const cols = splitCsvLine(line);
                if (!cols[idxStaffNo]) return null;

                const assignmentsRaw = idxAssignments !== -1 ? cols[idxAssignments] : undefined;
                const assignmentsArr = assignmentsRaw ? assignmentsRaw.split(/[;|]/).map(a => a.trim()).filter(Boolean) : undefined;

                return {
                    staffNo: cols[idxStaffNo].padStart(4, '0'),
                    mandateCode: idxMandateCode !== -1 ? cols[idxMandateCode] : (idxMandate !== -1 ? cols[idxMandate] : undefined),
                    name: idxName !== -1 ? cols[idxName] : undefined,
                    station: idxStation !== -1 ? cols[idxStation] : undefined,
                    conraiss: idxConraiss !== -1 ? cols[idxConraiss] : undefined,
                    count: idxCount !== -1 ? parseInt(cols[idxCount]) || 0 : undefined,
                    assignments: assignmentsArr,
                    mandate: idxMandate !== -1 ? cols[idxMandate] : undefined,
                    venue: idxVenue !== -1 ? cols[idxVenue] : undefined,
                    description: idxDescription !== -1 ? cols[idxDescription] : undefined,
                    state: idxState !== -1 ? cols[idxState] : undefined
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
    conraiss?: string;
    count?: number;
    assignments?: string[];
    mandate?: string;
    venue?: string;
    description?: string;
    state?: string;
}
