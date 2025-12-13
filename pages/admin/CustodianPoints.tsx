import React from 'react';

const CustodianPoints: React.FC = () => {
    return (
        <div className="p-8 max-w-7xl mx-auto flex flex-col gap-6 bg-slate-50 dark:bg-[#101922] transition-colors duration-200 min-h-screen">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-200">Custodian Points Management</h1>
                <button className="btn-primary h-10 px-4 flex items-center gap-2 text-sm font-bold"><span className="material-symbols-outlined text-lg">add_circle</span> Add New Custodian Point</button>
            </div>

            <div className="bg-white dark:bg-[#121b25] rounded-xl border border-gray-200 dark:border-gray-800 p-6 transition-colors">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="md:col-span-2 relative">
                        <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400">search</span>
                        <input className="form-input w-full pl-10 h-10 rounded-lg bg-gray-50 dark:bg-[#0b1015] border-none text-slate-900 dark:text-slate-200" placeholder="Search by Point Name or Mandate..." />
                    </div>
                    <select className="form-select h-10 rounded-lg bg-gray-50 dark:bg-[#0b1015] border-gray-200 dark:border-gray-700 text-sm text-slate-900 dark:text-slate-200"><option>All Statuses</option></select>
                    <select className="form-select h-10 rounded-lg bg-gray-50 dark:bg-[#0b1015] border-gray-200 dark:border-gray-700 text-sm text-slate-900 dark:text-slate-200"><option>All Mandate Categories</option></select>
                </div>

                <div className="flex items-center gap-4 py-3 border-y border-gray-100 dark:border-gray-800 mb-4">
                    <span className="text-sm text-slate-500 dark:text-slate-400">3 items selected</span>
                    <button className="text-green-600 dark:text-green-400 text-sm font-medium flex items-center gap-1 hover:text-green-700"><span className="material-symbols-outlined text-base">task_alt</span> Activate</button>
                    <button className="text-red-600 dark:text-red-400 text-sm font-medium flex items-center gap-1 hover:text-red-700"><span className="material-symbols-outlined text-base">cancel</span> Deactivate</button>
                </div>

                <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                    <thead className="bg-gray-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 uppercase text-xs">
                        <tr>
                            <th className="p-4 w-4"><input type="checkbox" className="rounded text-primary focus:ring-primary dark:bg-gray-700 dark:border-gray-600" /></th>
                            <th className="px-6 py-3">Point Name</th>
                            <th className="px-6 py-3">Linked Mandate</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Date Created</th>
                            <th className="px-6 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        <CustRow name="Main Registry Safe" mandate="Chief Registrar" status="Active" date="2023-10-26" />
                        <CustRow name="Exam Hall A Key Cabinet" mandate="Head of Examinations" status="Active" date="2023-10-25" checked />
                        <CustRow name="Finance Vault" mandate="Director of Finance" status="Inactive" date="2023-09-12" color="red" checked />
                        <CustRow name="Server Room Access" mandate="Head of IT" status="Active" date="2023-08-30" checked />
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const CustRow = ({ name, mandate, status, date, color = 'green', checked }: any) => (
    <tr className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
        <td className="p-4"><input type="checkbox" className="rounded text-primary focus:ring-primary dark:bg-gray-700 dark:border-gray-600" defaultChecked={checked} /></td>
        <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-200">{name}</td>
        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{mandate}</td>
        <td className="px-6 py-4">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${color === 'green' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'}`}>
                <span className={`w-2 h-2 rounded-full ${color === 'green' ? 'bg-green-500' : 'bg-red-500'}`}></span> {status}
            </span>
        </td>
        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{date}</td>
        <td className="px-6 py-4 text-center flex justify-center gap-2">
            <ActionIcon icon="edit" />
            <ActionIcon icon="visibility" />
            <ActionIcon icon={status === 'Active' ? 'toggle_on' : 'toggle_off'} isRed={status !== 'Active'} />
        </td>
    </tr>
);

const ActionIcon = ({ icon, isRed }: any) => (
    <button className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 ${isRed ? 'text-slate-400 dark:text-slate-500' : 'text-slate-500 dark:text-slate-400 hover:text-primary'}`}>
        <span className="material-symbols-outlined text-xl">{icon}</span>
    </button>
);

export default CustodianPoints;