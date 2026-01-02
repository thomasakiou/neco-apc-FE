import { ModuleHelp } from '../components/HelpModal';

export const helpContent: Record<string, ModuleHelp> = {
    dashboard: {
        title: 'Admin Dashboard',
        description: 'Comprehensive overview of the APCIC system status and metrics.',
        sections: [
            {
                title: 'Overview',
                icon: 'dashboard',
                content: 'The Dashboard provides a real-time snapshot of the entire posting ecosystem. It aggregates data from all modules to give you high-level insights into staff deployment, posting progress, and system health.',
                tips: ['Check this page daily for a quick systematic health check.']
            },
            {
                title: 'Executive Metrics',
                icon: 'insert_chart',
                content: 'The top row displaying 4 key metrics (Global Staff Pool, Active APC Records, Postings Completed, Operational States) gives you an immediate understanding of the scale and progress of current operations.',
            },
            {
                title: 'Live Data Refresh',
                icon: 'sync',
                content: 'The "Live Data" button in the header forces a fresh fetch of all statistics from the backend, ensuring you are seeing the most up-to-the-minute numbers.',
                tips: ['Use this if you suspect data has changed recently due to other admin actions.']
            },
            {
                title: 'Deployment Distribution',
                icon: 'bar_chart',
                content: 'This bar chart visualizes the distribution of staff across the top 10 most active stations. It helps identifying heavy-traffic areas that might need more resources or attention.',
            },
            {
                title: 'Posting Integrity',
                icon: 'pie_chart',
                content: 'The "Posting Target Status" pie chart shows the completion rate of postings versus the total active APC records. It helps track how close you are to 100% deployment.',
            }
        ]
    },
    apcList: {
        title: 'APC List Management',
        description: 'Master record of all staff mandates, qualifications, and assignment eligibility.',
        sections: [
            {
                title: 'Search & Filter',
                icon: 'search',
                content: 'Use the powerful search bar to find staff by File Number or Name. You can also filter the entire list by CONRAISS level, Station, or specific Assignment eligibility.',
                tips: ['Search covers the entire database, not just the current page.']
            },
            {
                title: 'Managing Records',
                icon: 'edit_note',
                content: 'Click the "Add Record" button to manually add a new staff member. To edit an existing staff, click the Edit (pencil) icon in their row. This allows you to update their bio-data, station, or assignment entitlements.',
            },
            {
                title: 'Bulk Operations',
                icon: 'library_add_check',
                content: 'Select multiple staff using the checkboxes to perform bulk actions like "Delete Selected". This is useful for cleaning up erroneous or obsolete records.',
                tips: ['Be careful with bulk delete; it cannot be undone.']
            },
            {
                title: 'Import & Export',
                icon: 'import_export',
                content: 'You can upload a CSV file to bulk import staff records using the "Import" button. Templates are available for download. Conversely, use "Export List" to download the current view (filtered) to Excel.',
            },
            {
                title: 'Posting Sync',
                icon: 'sync_alt',
                content: 'When you update a staff record here (e.g., change their quota count), the system automatically validates and updates their corresponding Posting record if one exists, ensuring data consistency.',
            }
        ]
    },
    // Add placeholders for other modules to be filled incrementally
    annualPostings: {
        title: 'Annual Postings',
        description: 'Manage the actual deployment of staff to assignments and venues.',
        sections: [
            {
                title: 'The Posting Board',
                icon: 'table_view',
                content: 'This is the control center for assigning staff. You can view all currently posted staff, their assigned venue, and mandates.',
            }
        ]
    },
    hodPostings: {
        title: 'HOD Posting Generator',
        description: 'Assign HODs to venues using random or personalized methods.',
        sections: [
            {
                title: 'Method Selection',
                icon: 'settings_suggest',
                content: 'Choose between "Random" (system-generated distribution) or "Personalized" (CSV upload) modes.',
            },
            {
                title: 'Random Generation',
                icon: 'shuffle',
                content: 'Select Assignment, Mandate, and Venue criteria. The system will randomly pick eligible HODs who match the state/zone of the venue where possible.',
                tips: ['HODs must have the appropriate assignment field cleared in their record to be eligible.']
            },
            {
                title: 'Personalized Upload',
                icon: 'upload_file',
                content: 'Upload a CSV file with "FileNo" and "Venue" columns to manually assign specific HODs to specific venues.',
                tips: ['Use the "Download Template" button to see the correct format.']
            },
            {
                title: 'Venue Selection',
                icon: 'hub',
                content: 'Use "Pick Station" to choose from Schools, Custodians, or other center types as venues.',
            }
        ]
    },
    hodPostingsTable: {
        title: 'HOD Postings Table',
        description: 'View, filter, and export the generated HOD postings.',
        sections: [
            {
                title: 'Data Management',
                icon: 'table_view',
                content: 'View all generated postings in a table format. Use the checkboxes to select multiple records for bulk deletion.',
            },
            {
                title: 'Filtering & Customization',
                icon: 'filter_alt',
                content: 'Use the filter bar to search by File No, Name, Assignment, or Venue. Click "Customize Columns" to toggle and reorder table columns for your reports.',
            },
            {
                title: 'Export Options',
                icon: 'download',
                content: 'Export the filtered data to PDF, CSV, or Excel formats using the export buttons in the header.',
            },
            {
                title: 'Staff Actions',
                icon: 'manage_accounts',
                content: 'Use the action buttons in each row to swap venues between staff, replace a posted staff member, or delete a single posting.',
            }
        ]
    },
    assignmentHistory: {
        title: 'Assignment History & Reports',
        description: 'Generate comprehensive reports and tracks the deployment history of staff.',
        sections: [
            {
                title: 'Report Configuration',
                icon: 'settings',
                content: 'Select a "Report Template" (SSCE, NCEE, or Accreditation) to automatically format the output style and headers. You can also define custom titles.',
            },
            {
                title: 'Column Customization',
                icon: 'view_column',
                content: 'Click "Customize Columns" to select exactly which data points (File No, Name, Sex, etc.) appear in your generated report.',
            },
            {
                title: 'Exporting',
                icon: 'file_download',
                content: 'Generate high-quality PDF reports with watermarks and signatures, or export raw data to CSV/Excel for further analysis.',
            }
        ]
    },
    personalizedPost: {
        title: 'Personalized Posting Board',
        description: 'Interactive workspace for manual, precision-based staff deployment.',
        sections: [
            {
                title: 'The Workspace',
                icon: 'view_kanban',
                content: 'The screen is divided into the "Active Staff Pool" (left) and the "Distribution Grid" (right). The Grid represents different mandates or venues for the selected assignment.',
            },
            {
                title: 'Drag & Drop',
                icon: 'drag_indicator',
                content: 'Simply drag a staff member from the Pool to a column in the Grid to assign them. You can also move staff between columns.',
            },
            {
                title: 'Bulk Operations',
                icon: 'select_all',
                content: 'Click names to select multiple staff, then use the floating "Move To This" button on a column to assign them all at once.',
            },
            {
                title: 'Committing Changes',
                icon: 'save',
                content: 'Changes are staged locally first. Click "Commit Changes" in the top bar to permanently save your new assignments to the database.',
            }
        ]
    },
    hodApcList: {
        title: 'HOD APC Management',
        description: 'Master record for Heads of Division (HOD) eligibility and assignments.',
        sections: [
            {
                title: 'Synchronization',
                icon: 'sync',
                content: 'Use "Sync with SDL" to pull the latest HOD bio-data from the central Staff Data List. This ensures your records are up-to-date.',
            },
            {
                title: 'Auto-Generation',
                icon: 'auto_fix_high',
                content: 'The "Generate Assignments" button allows you to automatically populate assignment eligibility for HODs based on predefined rules.',
            },
            {
                title: 'Reports & Export',
                icon: 'print',
                content: 'Generate PDF reports specifically formatted for HOD lists or export the entire table to Excel.',
            }
        ]
    },
    // ... we will populate more as we integrate them
};
