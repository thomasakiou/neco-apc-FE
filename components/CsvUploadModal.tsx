import React, { useState, useRef } from 'react';
import { parseAssignmentCSV, CSVPostingData } from '../services/personalizedPost';

interface CsvUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (data: CSVPostingData[]) => void;
}

const CsvUploadModal: React.FC<CsvUploadModalProps> = ({ isOpen, onClose, onUpload }) => {
    const [dragging, setDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<CSVPostingData[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [parsing, setParsing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(true);
    };

    const handleDragLeave = () => {
        setDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv')) {
            processFile(droppedFile);
        } else {
            setError('Please upload a valid CSV file');
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            processFile(selectedFile);
        }
    };

    const processFile = async (f: File) => {
        setFile(f);
        setParsing(true);
        setError(null);
        try {
            const data = await parseAssignmentCSV(f);
            if (data.length === 0) {
                setError('No valid data found in CSV. Please check headers (StaffNo - MandateCode is optional).');
            } else {
                setPreviewData(data);
            }
        } catch (err) {
            setError('Failed to parse CSV file.');
            console.error(err);
        } finally {
            setParsing(false);
        }
    };

    const handleConfirm = () => {
        onUpload(previewData);
        onClose();
        // Reset state
        setFile(null);
        setPreviewData([]);
        setError(null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-sm p-4 transition-colors">
            <div className="bg-white dark:bg-[#121b25] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 border dark:border-gray-800">
                <div className="p-6 border-b border-slate-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-[#121b25]">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Import Assignments CSV</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <span className="material-symbols-outlined text-slate-500 dark:text-slate-400">close</span>
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-4">
                    {!file ? (
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${dragging ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-slate-300 dark:border-gray-700 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                }`}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept=".csv"
                                className="hidden"
                            />
                            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                <span className="material-symbols-outlined text-3xl">upload_file</span>
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-slate-700 dark:text-slate-200">Click to upload or drag and drop</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">CSV files only (Max 5MB)</p>
                            </div>
                            <div className="text-xs text-slate-400 absolute bottom-4 font-mono">
                                Required Column: StaffNo (MandateCode optional)
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#0b1015] rounded-lg border border-slate-200 dark:border-gray-800 icon-row">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                        <span className="material-symbols-outlined">description</span>
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{file.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setFile(null); setPreviewData([]); }}
                                    className="text-slate-400 hover:text-rose-500 transition-colors"
                                >
                                    <span className="material-symbols-outlined">delete</span>
                                </button>
                            </div>

                            {parsing ? (
                                <div className="py-4 text-center text-slate-500 text-sm">Parsing file...</div>
                            ) : error ? (
                                <div className="p-3 bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-800 rounded-lg text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">error</span>
                                    {error}
                                </div>
                            ) : (
                                <div className="bg-slate-50 dark:bg-[#0b1015] rounded-lg border border-slate-200 dark:border-gray-800 p-3 max-h-48 overflow-y-auto">
                                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200 dark:border-gray-800">
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Preview ({previewData.length} records)</span>
                                    </div>
                                    <table className="w-full text-xs text-left">
                                        <thead>
                                            <tr className="text-slate-500 dark:text-slate-400">
                                                <th className="pb-1">Staff No</th>
                                                <th className="pb-1">Name</th>
                                                <th className="pb-1">Station</th>
                                                <th className="pb-1">Mandate</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-slate-700 dark:text-slate-300">
                                            {previewData.slice(0, 5).map((row, i) => (
                                                <tr key={i} className="border-b border-slate-100 dark:border-gray-800 last:border-0">
                                                    <td className="py-1 font-mono">{row.staffNo}</td>
                                                    <td className="py-1 truncate max-w-[100px]">{row.name}</td>
                                                    <td className="py-1">{row.station}</td>
                                                    <td className="py-1">{row.mandate}</td>
                                                </tr>
                                            ))}
                                            {previewData.length > 5 && (
                                                <tr>
                                                    <td colSpan={4} className="py-1 text-slate-400 italic">...and {previewData.length - 5} more</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-50 dark:bg-[#0b1015] border-t border-slate-100 dark:border-gray-800 flex justify-end gap-3 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#121b25] hover:shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-gray-700 rounded-lg transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!file || parsing || !!error || previewData.length === 0}
                        className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-lg shadow-sm hover:shadow hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        Import Data
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CsvUploadModal;
