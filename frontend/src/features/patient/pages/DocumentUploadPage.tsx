import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../store/LanguageContext';
import {
  Upload, FileText, CheckCircle2, ArrowRight, ArrowLeft,
  AlertCircle, Sparkles, Eye, ShieldCheck, SkipForward
} from 'lucide-react';

export function DocumentUploadPage() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const { language, t } = useLanguage();

  const [activePatient, setActivePatient] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [fileType, setFileType] = useState('PRESCRIPTION');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);
  const [extractedResult, setExtractedResult] = useState<any | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('medikiosk_active_patient');
    if (raw) setActivePatient(JSON.parse(raw));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      if (!title) {
        setTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !activePatient) return;

    setIsUploading(true);
    setExtractedResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('patientId', activePatient.id);
    formData.append('visitId', visitId || '');
    formData.append('title', title || 'Medical Record (PDF / Image)');
    formData.append('fileType', fileType);

    try {
      const token = localStorage.getItem('medikiosk_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('http://localhost:5000/api/documents/upload', {
        method: 'POST',
        headers,
        body: formData,
      });
      const data = await res.json();
      if (data?.document) {
        setUploadedDocs((prev) => [data.document, ...prev]);
        let parsedData = data.extraction?.extractedData;
        if (typeof parsedData === 'string') {
          try { parsedData = JSON.parse(parsedData); } catch {}
        }
        setExtractedResult(parsedData || null);
        setSelectedFile(null);
        setTitle('');
      } else if (data?.error) {
        alert(`Upload error: ${data.error}`);
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      alert(`Network error during upload: ${err.message || 'Server unavailable'}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50">
      <div className="w-full max-w-3xl bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-slate-100 flex flex-col space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center font-bold shadow-sm shrink-0">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
                  {language === 'hi' ? 'पिछली मेडिकल रिपोर्ट या पर्ची अपलोड करें' : language === 'gu' ? 'અગાઉના મેડિકલ રિપોર્ટ કે ફાઇલ અપલોડ કરો' : 'Upload Past Medical Records & Prescriptions'}
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                  Optional
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {language === 'hi'
                  ? 'यदि आपके पास पुरानी पर्ची या PDF रिपोर्ट है, तो यहाँ जोड़ें। डॉक्टर इसे सीधे अपनी स्क्रीन पर देख सकेंगे।'
                  : language === 'gu'
                  ? 'જો આપની પાસે જૂની દવાઓની ચિઠ્ઠી કે PDF રિપોર્ટ હોય તો અહીં ઉમેરો. ડૉક્ટર તેને સીધા જોઈ શકશે.'
                  : 'AI automatically scans your PDF or image reports for doctor review. You can skip if not available.'}
              </p>
            </div>
          </div>

          {/* Quick Skip Button */}
          <button
            onClick={() => navigate(`/kiosk/review/${visitId || 'current'}`)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all self-start sm:self-auto touch-target"
          >
            <span>Skip Upload</span>
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Upload Form */}
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Document Category
              </label>
              <select
                value={fileType}
                onChange={(e) => setFileType(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-blue-600"
              >
                <option value="PRESCRIPTION">Prior Doctor Prescription (PDF / Scan)</option>
                <option value="LAB_REPORT">Blood / Pathology Lab Report</option>
                <option value="DISCHARGE_SUMMARY">Discharge Summary / Hospital Record</option>
                <option value="IMAGING">X-Ray / CT / Ultrasound Report</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Document Title / Doctor Name
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Previous Prescription / Cardiology Record"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Drag & Drop Box */}
          <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-blue-50/20 transition-all">
            <Upload className="w-10 h-10 text-slate-400 mb-2" />
            <span className="text-sm font-semibold text-slate-700">
              {selectedFile ? selectedFile.name : 'Tap to select PDF or image file (JPG, PNG, PDF)'}
            </span>
            <span className="text-xs text-slate-400 mt-1">Maximum file size: 10MB</span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <button
            type="submit"
            disabled={!selectedFile || isUploading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all touch-target-lg"
          >
            <Sparkles className="w-5 h-5" />
            <span>{isUploading ? 'Extracting Medical History from PDF...' : 'Upload PDF & Update Medical Record'}</span>
          </button>
        </form>

        {/* Live Extracted Entities Display */}
        {extractedResult && (
          <div className="p-5 bg-green-50 border-2 border-green-500/40 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-green-800 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span>Extracted Medical History (Saved to Doctor & Nurse Workspaces)</span>
            </div>
            <pre className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-green-200 overflow-x-auto font-mono">
              {JSON.stringify(extractedResult, null, 2)}
            </pre>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            onClick={() => navigate(`/kiosk/intake/${visitId || 'current'}`)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 touch-target text-xs sm:text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to AI Intake</span>
          </button>

          <button
            onClick={() => navigate(`/kiosk/review/${visitId || 'current'}`)}
            className="flex items-center gap-2 px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/30 transition-all touch-target-lg text-sm sm:text-base"
          >
            <span>Proceed to Review & Appointment</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

      </div>
    </div>
  );
}
