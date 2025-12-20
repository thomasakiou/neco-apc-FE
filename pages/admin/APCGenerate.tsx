import React from 'react';

const APCGenerate: React.FC = () => {
    return (
        <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-6 bg-slate-50 dark:bg-[#101922] transition-colors duration-200">
            <div className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-gray-800">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 via-teal-800 to-emerald-700 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-500 tracking-tight">
                        Generate Annual Posting Calendar (APC)
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Select a generation method and preview the posting calendar before finalizing.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Configuration Panel */}
                <div className="lg:col-span-1 flex flex-col gap-6 bg-white dark:bg-[#121b25] p-6 rounded-xl border border-gray-200 dark:border-gray-800 h-fit transition-colors">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-slate-200">Generation Method</h3>
                    <div className="space-y-3">
                        <RadioOption title="Automatic (Rules-Based)" desc="Generate APC based on predefined system rules." checked={true} />
                        <RadioOption title="Custom (CSV Upload)" desc="Upload a CSV with specific assignments." checked={false} />
                    </div>

                    <h3 className="font-bold text-lg text-slate-900 dark:text-slate-200 mt-2">Configuration</h3>
                    <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 px-6 py-10 cursor-pointer hover:border-primary dark:hover:border-primary bg-gray-50 dark:bg-[#0b1015] hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
                        <span className="material-symbols-outlined text-4xl text-gray-400">upload_file</span>
                        <div className="text-center">
                            <p className="text-slate-900 dark:text-slate-200 font-bold">Drag & Drop CSV file here</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">or click to browse</p>
                        </div>
                        <button className="px-4 py-2 bg-white dark:bg-[#121b25] border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold shadow-sm text-slate-700 dark:text-slate-300">Download Template</button>
                    </div>

                    <div className="flex flex-col gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                        <button className="btn-primary w-full h-11">Generate Preview</button>
                        <button className="btn-secondary w-full h-11">Reset</button>
                    </div>
                </div>

                {/* Preview Panel */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <SummaryCard label="Total Postings" value="1,204" />
                        <SummaryCard label="Manual Assignments" value="85" />
                        <SummaryCard label="Conflicts" value="12" isWarning />
                    </div>

                    <div className="bg-white dark:bg-[#121b25] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
                        <div className="p-4 sm:p-6 flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800">
                            <div>
                                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-200">APC Preview</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Review the generated postings before finalizing.</p>
                            </div>
                            <div className="flex gap-2">
                                <button className="btn-secondary h-9 text-sm">Download Preview</button>
                                <button className="btn-primary h-9 text-sm opacity-50 cursor-not-allowed">Approve & Finalize</button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                                <thead className="bg-gray-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 uppercase text-xs">
                                    <tr>
                                        <th className="px-6 py-3">Staff Name</th>
                                        <th className="px-6 py-3">Staff ID</th>
                                        <th className="px-6 py-3">Department</th>
                                        <th className="px-6 py-3">Current</th>
                                        <th className="px-6 py-3">New</th>
                                        <th className="px-6 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                    <PreviewRow name="John Doe" id="S12345" dept="Operations" curr="Lagos" newLoc="Abuja" status="OK" />
                                    <PreviewRow name="Jane Smith" id="S67890" dept="Finance" curr="Kano" newLoc="Port Harcourt" status="Conflict" isWarning />
                                    <PreviewRow name="Michael Johnson" id="S11223" dept="IT" curr="Abuja" newLoc="Enugu" status="OK" />
                                    <PreviewRow name="Emily Davis" id="S44556" dept="HR" curr="Ibadan" newLoc="Jos" status="OK" />
                                    <PreviewRow name="Chris Brown" id="S77889" dept="Marketing" curr="Lagos" newLoc="Lagos" status="No Change" isWarning />
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const RadioOption = ({ title, desc, checked }: any) => (
    <label className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${checked ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50'}`}>
        <input type="radio" name="method" className="mt-1 h-4 w-4 text-primary border-gray-300 focus:ring-primary" defaultChecked={checked} />
        <div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-200">{title}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>
        </div>
    </label>
);

const SummaryCard = ({ label, value, isWarning }: any) => (
    <div className={`p-4 rounded-xl border flex flex-col gap-1 bg-white dark:bg-[#121b25] ${isWarning ? 'border-amber-200 dark:border-amber-900/40' : 'border-gray-200 dark:border-gray-800'}`}>
        <p className={`text-sm ${isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>{label}</p>
        <p className={`text-2xl font-bold ${isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-200'}`}>{value}</p>
    </div>
);

const PreviewRow = ({ name, id, dept, curr, newLoc, status, isWarning }: any) => (
    <tr className={isWarning ? 'bg-amber-50 dark:bg-amber-900/10' : 'bg-white dark:bg-[#121b25]'}>
        <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-200">{name}</td>
        <td className="px-6 py-4">{id}</td>
        <td className="px-6 py-4">{dept}</td>
        <td className="px-6 py-4">{curr}</td>
        <td className="px-6 py-4">{newLoc}</td>
        <td className="px-6 py-4">
            {isWarning ? (
                <span className="flex items-center gap-1 text-amber-600 font-bold text-xs">
                    <span className="material-symbols-outlined text-sm">warning</span> {status}
                </span>
            ) : (
                <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs font-bold px-2 py-0.5 rounded-full">{status}</span>
            )}
        </td>
    </tr>
);

export default APCGenerate;