import { AssignmentBoardData, MandateColumn, StaffMandateAssignment, APCRecord } from '../types/apc';
import { getAllStaff } from './staff';
import { getMandatesByAssignment } from './assignment';
import { getAllAPC, createAPC, updateAPC, deleteAPC } from './apc';
import { Assignment } from '../types/assignment';

// This service orchestrates data between Staff, APC, and Mandates to power the drag-and-drop UI

export const getAssignmentBoardData = async (assignment: Assignment): Promise<AssignmentBoardData> => {
    // 1. Fetch all mandates for this assignment
    const mandates = await getMandatesByAssignment(assignment);

    // 2. Fetch all staff (in a real app, this might be filtered by some criteria, e.g., active staff)
    const allStaff = await getAllStaff();

    // 3. Fetch all APC records for this assignment
    const apcResponse = await getAllAPC(0, 10000, '');
    
    // Map assignment codes to APC field names
    const assignmentFieldMap: { [key: string]: string } = {
        'TT': 'tt',
        'SSCE-INT': 'ssce_int',
        'SSCE-EXT': 'ssce_ext',
        'SSCE-INT-MRK': 'ssce_int_mrk',
        'SSCE-EXT-MRK': 'ssce_ext_mrk',
        'NCEE': 'ncee',
        'BECE-P': 'becep',
        'BECE-MRK-P': 'bece_mrkp',
        'MAR-ACCR': 'mar_accr',
        'OCT-ACCR': 'oct_accr',
        'PUR-SAMP': 'pur_samp',
        'GIFTED': 'gifted',
        'SWAPPING': 'swapping',
        'INT-AUDIT': 'int_audit',
        'STOCK-TK': 'stock_tk'
    };
    
    const fieldName = assignmentFieldMap[assignment.code];
    const apcRecords = apcResponse.items.filter(item => {
        if (!fieldName) return false;
        const assignmentField = item[fieldName as keyof APCRecord];
        return assignmentField && assignmentField.toString().trim() !== '';
    });

    // 4. Map mandates to columns
    const mandateColumns: MandateColumn[] = mandates.map(mandate => ({
        id: mandate.id,
        title: mandate.mandate,
        code: mandate.code,
        station: mandate.station,
        staff: []
    }));

    // 5. Create a map of staff assigned to mandates via APC records
    const assignedStaffMap = new Map<string, string>(); // staff_no -> mandate_id
    const apcMap = new Map<string, any>(); // staff_no -> apc_record

    apcRecords.forEach(record => {
        // Normalize file_no by padding with zeros to 4 digits
        const normalizedFileNo = record.file_no.padStart(4, '0');
        apcMap.set(normalizedFileNo, record);
    });

    // 6. Distribute staff into unassigned or mandate columns
    const unassignedStaff: StaffMandateAssignment[] = [];

    // Helper to check if staff matches assignment criteria (e.g. CONRAISS)
    // For now, we'll include all staff, or you can implement logic to filter based on mandate CONRAISS ranges

    allStaff.forEach(staff => {
        const mandateId = assignedStaffMap.get(staff.fileno);
        // Normalize staff fileno by padding with zeros to 4 digits
        const normalizedStaffFileNo = staff.fileno.padStart(4, '0');
        const hasAssignmentRecord = apcMap.has(normalizedStaffFileNo);

        // Only include staff who have an assignment record (APC record) for this assignment
        if (!hasAssignmentRecord) {
            return; // Skip staff without assignment records
        }

        const staffAssignment: StaffMandateAssignment = {
            id: staff.id,
            staff_no: staff.fileno,
            staff_name: staff.full_name,
            rank: staff.rank || '',
            current_station: staff.station || '',
            conr: staff.conr || '',
            mandate_id: mandateId || null,
            apc_id: apcMap.get(normalizedStaffFileNo)?.id
        };

        // All staff with APC records but no specific mandate assignment go to unassigned pool
        unassignedStaff.push(staffAssignment);
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
    mandateName: string // Need name for APC text field in mock
): Promise<string> => {
    // If staff already has an APC record for this assignment, update it
    if (staff.apc_id) {
        await updateAPC(staff.apc_id, {
            mandate_id: mandateId, // If APC supports ID
            // For mock that uses strings:
            // mandate: mandateName 
            // We might need to update the mock/type to support mandate_id if we want robust linking
        } as any);

        // Since the generic updateAPC might not handle the specific logic of "moving" mandates well if looking up by ID,
        // and our mock uses strings. Let's assume we are updating the mandate field.
        // real implementation would hit an endpoint like POST /api/assignments/{id}/assign
        return staff.apc_id;
    } else {
        // Create new APC record
        const newRecord = await createAPC({
            staff_id: staff.id,
            new_station_id: 'pending-allocation', // Placeholder
            assignment_id: assignment.id,
            mandate_id: mandateId,
            posting_date: new Date().toISOString(),
            remarks: 'Assigned via Board'
        });
        return newRecord.id;
    }
};

export const removeStaffFromMandate = async (staff: StaffMandateAssignment): Promise<void> => {
    if (staff.apc_id) {
        await deleteAPC(staff.apc_id);
    }
};

export const bulkSaveAssignments = async (
    assignment: Assignment,
    changes: { staff: StaffMandateAssignment; action: 'add' | 'remove' | 'move'; targetMandateId: string | null }[]
): Promise<void> => {
    // Process changes in sequence
    for (const change of changes) {
        try {
            if (change.action === 'remove') {
                if (change.staff.apc_id) {
                    await deleteAPC(change.staff.apc_id);
                }
            } else if (change.action === 'add' || change.action === 'move') {
                if (change.targetMandateId) {
                    // Get mandate name for the mock
                    // In real app we pass ID
                    // We need to fetch mandate details or pass it in. 
                    // For now, let's assume we can simplify or we might need to look it up.
                    // Ideally the `changes` payload should include the mandate name if needed by the mock.

                    // Re-using singular assign logic which handles create/update
                    await assignStaffToMandate(
                        change.staff,
                        change.targetMandateId,
                        assignment,
                        "Mandate Name Placeholder" // This is a limitation of the current mock service structure needing name
                    );
                }
            }
        } catch (error) {
            console.error(`Failed to process change for staff ${change.staff.staff_no}`, error);
            // In a real app, might want to stop or collect errors
        }
    }
};

export const parseAssignmentCSV = async (file: File): Promise<{ staffNo: string; mandateCode: string }[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (!text) return resolve([]);

            const lines = text.split('\n');
            const result: { staffNo: string; mandateCode: string }[] = [];

            // Simple parsing, assumes Header is Row 0
            // Expected columns: StaffNo, MandateCode
            // Case insensitive search for headers

            const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
            const staffNoIndex = headers.findIndex(h => h.includes('staff') || h.includes('no'));
            const mandateCodeIndex = headers.findIndex(h => h.includes('mandate') || h.includes('code'));

            if (staffNoIndex === -1 || mandateCodeIndex === -1) {
                // Fallback to index 0 and 1 if headers not found
            }

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const cols = line.split(',').map(c => c.trim());

                const staffNo = cols[staffNoIndex !== -1 ? staffNoIndex : 0];
                const mandateCode = cols[mandateCodeIndex !== -1 ? mandateCodeIndex : 1];

                if (staffNo && mandateCode) {
                    result.push({ staffNo, mandateCode });
                }
            }
            resolve(result);
        };
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
};
