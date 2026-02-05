import * as XLSX from 'xlsx';
import { Staff, StaffCreate } from '../types/staff';
import { SDLStagingRecord, FieldChange, ChangeType } from '../types/sdlStaging';

/**
 * Field labels for display purposes
 */
const FIELD_LABELS: Record<string, string> = {
    fileno: 'File No',
    full_name: 'Full Name',
    station: 'Station',
    qualification: 'Qualification',
    sex: 'Sex',
    dob: 'DOB',
    dofa: 'DOFA',
    doan: 'DOAN',
    dopa: 'DOPA',
    rank: 'Rank',
    conr: 'CONR',
    state: 'State',
    lga: 'LGA',
    email: 'Email',
    phone: 'Phone',
    remark: 'Remark',
    is_hod: 'HOD',
    is_state_coordinator: 'State Coordinator',
    is_director: 'Director',
    is_education: 'Education',
    is_secretary: 'Secretary',
    is_driver: 'Driver',
    is_typesetting: 'Typesetting',
    others: 'Others',
    active: 'Active'
};

/**
 * Fields to compare for change detection
 */
const COMPARABLE_FIELDS = [
    'full_name', 'station', 'qualification', 'sex', 'dob', 'dofa', 'doan', 'dopa',
    'rank', 'conr', 'state', 'lga', 'email', 'phone', 'remark',
    'is_hod', 'is_state_coordinator', 'is_director', 'is_education',
    'is_secretary', 'is_driver', 'is_typesetting', 'others'
];

/**
 * Normalize header names to match expected field names
 */
const normalizeHeader = (header: string): string => {
    const normalized = header.toLowerCase().trim().replace(/\s+/g, '_');

    // Map common variations
    const headerMap: Record<string, string> = {
        'file_no': 'fileno',
        'file_number': 'fileno',
        'name': 'full_name',
        'fullname': 'full_name',
        'gender': 'sex',
        'date_of_birth': 'dob',
        'date_of_first_appointment': 'dofa',
        'date_of_appointment_to_neco': 'doan',
        'date_of_present_appointment': 'dopa',
        'conraiss': 'conr',
        'conr_level': 'conr',
        'hod': 'is_hod',
        'state_coordinator': 'is_state_coordinator',
        'state_coord': 'is_state_coordinator',
        'director': 'is_director',
        'education': 'is_education',
        'secretary': 'is_secretary',
        'driver': 'is_driver',
        'typesetting': 'is_typesetting',
        'phoneno': 'phone',
        'phone_number': 'phone',
        'email_address': 'email'
    };

    return headerMap[normalized] || normalized;
};

/**
 * Parse boolean values from various formats
 */
const parseBool = (val: any): boolean => {
    if (val === undefined || val === null || val === '') return false;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val === 1;
    if (typeof val === 'string') {
        const lower = val.toLowerCase().trim();
        return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'y';
    }
    return Boolean(val);
};

/**
 * Normalize a value for comparison (handle null, undefined, empty strings)
 */
const normalizeValue = (val: any): string | boolean | null => {
    if (val === undefined || val === null || val === '') return null;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return val.trim();
    return String(val);
};

/**
 * Parse CSV or XLSX file and return StaffCreate array
 */
export const parseSDLFile = async (file: File): Promise<StaffCreate[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                // Convert to JSON with header row
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

                if (jsonData.length < 2) {
                    throw new Error('File must contain at least a header row and one data row');
                }

                // Normalize headers
                const headers = (jsonData[0] as string[]).map(normalizeHeader);
                const filenoIndex = headers.indexOf('fileno');

                if (filenoIndex === -1) {
                    throw new Error('File must contain a "fileno" or "File No" column');
                }

                const staffRecords: StaffCreate[] = [];

                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (!row || row.length === 0) continue;

                    const fileno = row[filenoIndex];
                    if (!fileno) continue; // Skip rows without file number

                    const record: any = { fileno: String(fileno).trim() };

                    headers.forEach((header, idx) => {
                        if (header === 'fileno') return;

                        const value = row[idx];

                        // Handle boolean fields
                        if (header.startsWith('is_') || header === 'others' || header === 'active') {
                            record[header] = parseBool(value);
                        } else if (value !== undefined && value !== null && value !== '') {
                            record[header] = String(value).trim();
                        }
                    });

                    // Set full_name from first data if not present
                    if (!record.full_name) {
                        record.full_name = '';
                    }

                    staffRecords.push(record as StaffCreate);
                }

                resolve(staffRecords);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsBinaryString(file);
    });
};

/**
 * Compare imported data with existing staff data to detect changes
 */
export const compareSDLData = (
    imported: StaffCreate[],
    existing: Staff[]
): SDLStagingRecord[] => {
    // Create lookup map for existing staff by fileno
    const existingMap = new Map<string, Staff>();
    existing.forEach(staff => {
        if (staff.fileno) {
            existingMap.set(staff.fileno.toUpperCase().trim(), staff);
        }
    });

    const stagingRecords: SDLStagingRecord[] = [];

    for (const importedRecord of imported) {
        const fileno = importedRecord.fileno?.toUpperCase().trim();
        if (!fileno) continue;

        const existingRecord = existingMap.get(fileno);

        if (!existingRecord) {
            // New record
            stagingRecords.push({
                fileno: importedRecord.fileno,
                fullName: importedRecord.full_name || '',
                importedData: importedRecord,
                existingData: undefined,
                changeType: 'NEW',
                fieldChanges: [],
                isSelected: true
            });
        } else {
            // Check for modifications
            const fieldChanges: FieldChange[] = [];

            for (const field of COMPARABLE_FIELDS) {
                const importedVal = normalizeValue((importedRecord as any)[field]);
                const existingVal = normalizeValue((existingRecord as any)[field]);

                // Only compare if imported value is provided
                if (importedVal === null) continue;

                // Compare values
                if (importedVal !== existingVal) {
                    fieldChanges.push({
                        field,
                        fieldLabel: FIELD_LABELS[field] || field,
                        oldValue: existingVal,
                        newValue: importedVal
                    });
                }
            }

            const changeType: ChangeType = fieldChanges.length > 0 ? 'MODIFIED' : 'UNCHANGED';

            stagingRecords.push({
                fileno: importedRecord.fileno,
                fullName: existingRecord.full_name || importedRecord.full_name || '',
                importedData: importedRecord,
                existingData: existingRecord,
                changeType,
                fieldChanges,
                isSelected: changeType !== 'UNCHANGED' // Only select NEW and MODIFIED by default
            });
        }
    }

    return stagingRecords;
};

/**
 * Format a value for display
 */
export const formatDisplayValue = (value: string | boolean | null): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return value || '—';
};
