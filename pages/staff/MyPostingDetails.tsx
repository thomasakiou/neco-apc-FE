import React from 'react';
import { useNavigate } from 'react-router-dom';

const MyPostingDetails: React.FC = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-background-light font-display">
       <header className="flex items-center justify-between px-10 py-3 bg-white border-b border-gray-200">
         <div className="flex items-center gap-4">
            <div className="bg-primary rounded-lg p-1 text-white"><span className="material-symbols-outlined">local_library</span></div>
            <h2 className="text-lg font-bold text-slate-900">NECO APCIC</h2>
         </div>
         <div className="flex items-center gap-6">
            <div className="hidden md:flex gap-6 text-sm font-medium">
                <button onClick={() => navigate('/staff/dashboard')} className="text-slate-600 hover:text-primary">Dashboard</button>
                <button className="text-primary font-bold">Profile</button>
            </div>
            <button className="btn-secondary h-9 text-sm">Logout</button>
            <div className="w-10 h-10 rounded-full bg-slate-300"></div>
         </div>
      </header>

      <main className="flex justify-center py-10 px-4">
        <div className="w-full max-w-4xl flex flex-col gap-6">
            <h1 className="text-4xl font-black text-slate-900">My Posting Details</h1>
            
            <div className="bg-primary/10 text-primary-hover p-4 rounded-xl flex items-center gap-4">
                <span className="material-symbols-outlined">info</span>
                <p className="text-sm font-medium">Your posting for the upcoming year is now available. Please review and download your official letter.</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col md:flex-row gap-8">
                <div className="flex-1 flex flex-col gap-6">
                    <div>
                        <p className="text-slate-500 text-sm">Annual Posting Cycle 2024</p>
                        <p className="text-2xl font-bold text-slate-900">John Doe</p>
                        <p className="text-slate-500 text-sm">Staff ID: 12345</p>
                    </div>
                    <div className="h-px bg-gray-200"></div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <DetailBox icon="badge" label="Status" value="Active" valueColor="text-green-600" />
                        <DetailBox icon="person" label="Reporting Manager" value="Jane Smith" />
                        <div className="sm:col-span-2">
                            <DetailBox icon="pin_drop" label="Assigned Location" value="Headquarters, Abuja" sub="Federal Capital Territory" />
                        </div>
                         <div className="sm:col-span-2">
                            <DetailBox icon="date_range" label="Posting Period" value="01 August, 2024 - 31 July, 2025" />
                        </div>
                    </div>
                </div>

                <div className="hidden md:block w-px bg-gray-200"></div>

                <div className="flex flex-col items-center justify-center text-center gap-4 md:w-1/3">
                    <p className="text-lg font-bold text-slate-900">Your Official Posting Letter</p>
                    <p className="text-sm text-slate-500">Download for documentation. Contains all necessary details.</p>
                    <button className="btn-primary w-full h-12 flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined">download</span> Download PDF
                    </button>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
};

const DetailBox = ({ icon, label, value, sub, valueColor = 'text-slate-900' }: any) => (
    <div className="flex gap-4">
        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-slate-800 shrink-0">
            <span className="material-symbols-outlined">{icon}</span>
        </div>
        <div>
            <p className="text-slate-500 text-sm">{label}</p>
            <p className={`font-bold text-base ${valueColor}`}>{value}</p>
            {sub && <p className="text-slate-500 text-sm">{sub}</p>}
        </div>
    </div>
);

export default MyPostingDetails;