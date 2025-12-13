import React from 'react';
import { useNavigate } from 'react-router-dom';

const StaffDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background-light font-display">
      {/* Staff Header */}
      <header className="flex items-center justify-between px-10 py-3 bg-white border-b border-gray-200">
         <div className="flex items-center gap-4">
            <div className="bg-primary rounded-lg p-1 text-white"><span className="material-symbols-outlined">local_library</span></div>
            <h2 className="text-lg font-bold text-slate-900">NECO APCIC</h2>
         </div>
         <div className="flex items-center gap-4">
            <button className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"><span className="material-symbols-outlined text-slate-600">notifications</span></button>
            <div className="w-10 h-10 rounded-full bg-slate-300"></div>
         </div>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        <div className="mb-8">
            <h1 className="text-4xl font-black text-slate-900">Staff Portal Dashboard</h1>
            <p className="text-slate-500 mt-1">Welcome, John Doe!</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Col */}
            <div className="lg:col-span-1 flex flex-col gap-8">
                {/* Profile */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-slate-200"></div>
                    <div>
                        <p className="text-xl font-bold text-slate-900">John Doe</p>
                        <p className="text-sm text-slate-500">Staff ID: 12345</p>
                        <p className="text-sm text-slate-500">Senior Officer</p>
                    </div>
                </div>
                {/* Actions */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4">
                    <h3 className="font-bold text-slate-900 text-lg">Quick Actions</h3>
                    <button 
                        onClick={() => navigate('/staff/posting')}
                        className="btn-primary h-12 flex items-center justify-center gap-2 text-base"
                    >
                        <span className="material-symbols-outlined">download</span> Download APC
                    </button>
                    <button className="btn-secondary h-12 flex items-center justify-center gap-2 text-base">
                        <span className="material-symbols-outlined">print</span> Print Assignment Letter
                    </button>
                </div>
            </div>

            {/* Right Col */}
            <div className="lg:col-span-2 flex flex-col gap-8">
                {/* Current Posting */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="h-48 bg-slate-200 w-full relative">
                        {/* Placeholder for building image */}
                        <div className="absolute inset-0 flex items-center justify-center text-slate-400">Building Image</div>
                    </div>
                    <div className="p-6">
                        <h3 className="text-xl font-bold text-slate-900 mb-4">Current Posting</h3>
                        <div className="grid gap-3">
                            <InfoRow icon="location_on" label="Location" value="Abuja, FCT" />
                            <InfoRow icon="calendar_today" label="Effective Date" value="October 26, 2023" />
                            <InfoRow icon="person" label="Reporting To" value="Jane Smith" />
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary">task_alt</span>
                                <p className="text-slate-500 text-base"><span className="font-semibold text-slate-900">Status: </span>
                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-sm font-bold">Active</span></p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mandate */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-xl font-bold text-slate-900 mb-4">Your Mandate</h3>
                    <p className="text-slate-500 mb-4">Your primary responsibilities for the current posting period include:</p>
                    <ul className="list-disc pl-5 space-y-2 text-slate-600">
                        <li>Oversee implementation of new digital records system.</li>
                        <li>Prepare monthly reports for department head.</li>
                        <li>Coordinate with regional offices.</li>
                        <li>Mentor junior staff.</li>
                    </ul>
                </div>

                {/* Timeline */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-xl font-bold text-slate-900 mb-6">Annual Posting Calendar (APC)</h3>
                    <div className="space-y-0">
                         <TimelineItem location="Lagos State Office" date="Jan 2023 - Jun 2023" />
                         <TimelineItem location="Port Harcourt Zonal" date="Jul 2023 - Oct 2023" />
                         <TimelineItem location="Abuja, FCT (Current)" date="Oct 2023 - Present" isCurrent />
                    </div>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
};

const InfoRow = ({ icon, label, value }: any) => (
    <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-primary">{icon}</span>
        <p className="text-slate-500 text-base flex-1">
            <span className="font-semibold text-slate-900">{label}: </span>{value}
        </p>
    </div>
);

const TimelineItem = ({ location, date, isCurrent }: any) => (
    <div className="flex gap-4 min-h-16 relative">
        <div className="flex flex-col items-center">
            <div className={`w-4 h-4 rounded-full z-10 ${isCurrent ? 'bg-primary ring-4 ring-primary/20' : 'bg-slate-300'}`}></div>
            {!isCurrent && <div className="w-px h-full bg-slate-300 absolute top-4 bottom-[-10px]"></div>}
        </div>
        <div className="-mt-1 pb-6">
            <p className={`font-bold ${isCurrent ? 'text-primary' : 'text-slate-900'}`}>{location}</p>
            <p className="text-sm text-slate-500">{date}</p>
        </div>
    </div>
);

export default StaffDashboard;