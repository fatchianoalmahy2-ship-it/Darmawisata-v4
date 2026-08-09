'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Student, SchoolClass, AuthUser, AppSettings, GenderType, DestinationType, TShirtSize, WaiverType } from '@/types';
import { calculateWaliAllocation } from '@/lib/waliAllocation';
import { WaveBadge, GenderBadge, WaiverBadge } from '@/components/ui/Badge';
import { formatWhatsAppLink } from '@/lib/utils';
import { RecapGeneratorService } from '@/services/recapGenerator';
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  Copy,
  Printer,
  Bus,
  BedDouble,
  Shirt,
  Sparkles,
  Lock,
  Trash2,
  AlertTriangle,
  UserPlus,
  Edit,
  Plus,
  MapPin,
  User,
  Compass,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { WaliKelasManager } from '@/components/admin/WaliKelasManager';
import { ClassManager } from '@/components/admin/ClassManager';
import { StatusAngketA4Report } from '@/components/recap/StatusAngketA4Report';
import { SuratIzinView } from '@/components/surat/SuratIzinView';

interface WaliKelasPortalProps {
  classes: SchoolClass[];
  students: Student[];
  thresholdPercentage: number;
  currentUser?: AuthUser;
  settings?: AppSettings;
  onUpdateSettings?: (newSettings: AppSettings) => Promise<void>;
  onClearClassData?: (
    className: string,
    actionType: 'REGISTRATION_ONLY' | 'DELETE_STUDENTS'
  ) => Promise<void>;
  onUpdateClass?: (updatedClass: SchoolClass) => void;
  onAddClass?: (newClass: SchoolClass) => void;
  onDeleteClass?: (classId: string) => void;
  onAddStudent?: (newStudent: Student) => void;
  onUpdateStudent?: (updatedStudent: Student) => void;
  onDeleteStudent?: (studentId: string) => void;
}

export const WaliKelasPortal: React.FC<WaliKelasPortalProps> = ({
  classes,
  students,
  thresholdPercentage = 75,
  currentUser,
  settings,
  onUpdateSettings,
  onClearClassData,
  onUpdateClass,
  onAddClass,
  onDeleteClass,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
}) => {
  const isWaliKelasRole = currentUser?.role === 'WALI_KELAS';
  const assignedClass = currentUser?.assignedClassName;

  const [activeSubTab, setActiveSubTab] = useState<'MONITORING' | 'STATUS_REPORT' | 'WALI_KELAS' | 'CLASSES' | 'SURAT_IZIN'>('MONITORING');

  const isAngketClosed = (() => {
    if (settings?.isAngketClosed) return true;
    if (settings?.angketDeadline) {
      const deadline = new Date(settings.angketDeadline + 'T23:59:59');
      return new Date() > deadline;
    }
    return false;
  })();

  const [userSelectedClassName, setUserSelectedClassName] = useState<string>('');

  const firstClassName = classes[0]?.name || 'XII TKR 1';
  const resolvedUserClassName = userSelectedClassName && classes.some((c) => c.name === userSelectedClassName)
    ? userSelectedClassName
    : firstClassName;

  const selectedClassName = (isWaliKelasRole && assignedClass) ? assignedClass : resolvedUserClassName;

  const [copiedWA, setCopiedWA] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearActionType, setClearActionType] = useState<'REGISTRATION_ONLY' | 'DELETE_STUDENTS'>('REGISTRATION_ONLY');
  const [confirmText, setConfirmText] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  // Student Add / Edit Modal States
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const [formNis, setFormNis] = useState('');
  const [formName, setFormName] = useState('');
  const [formClassName, setFormClassName] = useState('');
  const [formGender, setFormGender] = useState<GenderType>('LAKI-LAKI');
  const [formDestination, setFormDestination] = useState<DestinationType | ''>('');
  const [formTShirtSize, setFormTShirtSize] = useState<TShirtSize | ''>('');
  const [formTShirtDesign, setFormTShirtDesign] = useState<'A' | 'B' | ''>('');
  const [formStudentPhone, setFormStudentPhone] = useState('');
  const [formParentPhone, setFormParentPhone] = useState('');
  const [formParentName, setFormParentName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formMedicalHistory, setFormMedicalHistory] = useState('');
  const [formWaiverType, setFormWaiverType] = useState<WaiverType>('NONE');
  const [formIsRegistered, setFormIsRegistered] = useState<boolean>(false);

  const handleExecuteClear = async () => {
    if (confirmText.trim().toUpperCase() !== 'KOSONGKAN') return;
    setIsClearing(true);
    try {
      if (onClearClassData) {
        await onClearClassData(selectedClassName, clearActionType);
      }
      setIsClearModalOpen(false);
      setConfirmText('');
    } catch (err) {
      console.error(err);
      alert('Gagal mengosongkan data. Silakan coba lagi.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleOpenAddStudentModal = () => {
    setEditingStudent(null);
    setFormNis('');
    setFormName('');
    setFormClassName(selectedClassName);
    setFormGender('LAKI-LAKI');
    setFormDestination('');
    setFormTShirtSize('');
    setFormTShirtDesign('');
    setFormStudentPhone('');
    setFormParentPhone('');
    setFormParentName('');
    setFormAddress('');
    setFormMedicalHistory('');
    setFormWaiverType('NONE');
    setFormIsRegistered(false);
    setIsStudentModalOpen(true);
  };

  const handleOpenEditStudentModal = (st: Student) => {
    setEditingStudent(st);
    setFormNis(st.nis || '');
    setFormName(st.name || '');
    setFormClassName(st.className || selectedClassName);
    setFormGender(st.gender || 'LAKI-LAKI');
    setFormDestination(st.destination || '');
    setFormTShirtSize(st.tShirtSize || '');
    setFormTShirtDesign(st.tShirtDesign || '');
    setFormStudentPhone(st.studentPhone || '');
    setFormParentPhone(st.parentPhone || '');
    setFormParentName(st.parentName || '');
    setFormAddress(st.address || st.parentAddress || '');
    setFormMedicalHistory(st.medicalHistory || '');
    setFormWaiverType(st.waiverType || 'NONE');
    setFormIsRegistered(st.isRegistered ?? false);
    setIsStudentModalOpen(true);
  };

  const handleSaveStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNis = formNis.trim();
    const trimmedName = formName.trim();
    const targetClass = formClassName || selectedClassName;

    if (!trimmedName) {
      alert('Nama siswa wajib diisi.');
      return;
    }

    // Duplicate Check logic: Prevent existing NIS or existing Name+Class
    const duplicate = students.find(
      (s) => s.id !== editingStudent?.id && (
        (trimmedNis && s.nis.trim().toLowerCase() === trimmedNis.toLowerCase()) ||
        (s.name.trim().toLowerCase() === trimmedName.toLowerCase() && s.className.trim().toLowerCase() === targetClass.toLowerCase())
      )
    );

    if (duplicate) {
      alert(`⚠️ PERINGATAN DATA DUPLIKAT!\n\nSiswa dengan NIS "${trimmedNis}" atau Nama "${trimmedName}" sudah terdaftar di kelas ${duplicate.className}.\n\nSilakan periksa kembali data siswa untuk menghindari duplikasi.`);
      return;
    }

    const trimmedAddress = formAddress.trim();
    const trimmedParentName = formParentName.trim();

    if (editingStudent) {
      const updated: Student = {
        ...editingStudent,
        nis: trimmedNis || editingStudent.nis,
        name: trimmedName,
        className: targetClass,
        gender: formGender,
        destination: formDestination || undefined,
        tShirtSize: formTShirtSize || undefined,
        tShirtDesign: formTShirtDesign || undefined,
        studentPhone: formStudentPhone.trim(),
        parentPhone: formParentPhone.trim(),
        parentName: trimmedParentName || editingStudent.parentName,
        address: trimmedAddress || editingStudent.address,
        parentAddress: trimmedAddress || editingStudent.parentAddress,
        medicalHistory: formMedicalHistory.trim(),
        waiverType: formWaiverType,
        isRegistered: formIsRegistered,
        updatedAt: new Date().toISOString(),
      };
      onUpdateStudent?.(updated);
    } else {
      const newStudent: Student = {
        id: `st_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        nis: trimmedNis || `NIS${Math.floor(1000 + Math.random() * 9000)}`,
        name: trimmedName,
        className: targetClass,
        gender: formGender,
        destination: formDestination || undefined,
        tShirtSize: formTShirtSize || undefined,
        tShirtDesign: formTShirtDesign || undefined,
        studentPhone: formStudentPhone.trim(),
        parentPhone: formParentPhone.trim(),
        parentName: trimmedParentName || undefined,
        address: trimmedAddress || undefined,
        parentAddress: trimmedAddress || undefined,
        medicalHistory: formMedicalHistory.trim(),
        waiverType: formWaiverType,
        isRegistered: formIsRegistered,
        updatedAt: new Date().toISOString(),
      };
      onAddStudent?.(newStudent);
    }

    setIsStudentModalOpen(false);
  };

  const handleDeleteStudentClick = (st: Student) => {
    if (confirm(`Apakah Anda yakin ingin menghapus data siswa ${st.name} (${st.nis})?`)) {
      onDeleteStudent?.(st.id);
    }
  };

  const activeClass = classes.find((c) => c.name === selectedClassName) || classes[0];
  const classStudents = students
    .filter((s) => s.className === selectedClassName)
    .sort((a, b) => a.nis.localeCompare(b.nis, undefined, { numeric: true, sensitivity: 'base' }));

  const registeredStudents = classStudents.filter((s) => s.isRegistered);
  const totalInClass = activeClass ? activeClass.totalStudents : classStudents.length;
  const registeredCount = registeredStudents.length;

  const participationPct = totalInClass > 0
    ? parseFloat(((registeredCount / totalInClass) * 100).toFixed(1))
    : 0;

  const isTeacherEligible = participationPct >= thresholdPercentage;

  // Wali Kelas Allocation (Bali / Jogja & Ranking) Calculation
  const waliAllocation = useMemo(() => {
    return calculateWaliAllocation(classes, students, settings);
  }, [classes, students, settings]);

  const currentWaliItem = activeClass ? waliAllocation.itemsByClassName[activeClass.name] : null;
  const isStatusVisibleToWali = Boolean(settings?.showWaliParticipationStatusInPortal);
  const canShowWaliStatusCard = currentUser?.role === 'ADMIN' || isStatusVisibleToWali;

  const handleToggleWaliStatusVisibility = async () => {
    if (!settings || !onUpdateSettings) return;
    await onUpdateSettings({
      ...settings,
      showWaliParticipationStatusInPortal: !isStatusVisibleToWali,
    });
  };

  // Wave stats
  const bali1 = registeredStudents.filter((s) => s.wave === 'BALI_GEL_1').length;
  const bali2 = registeredStudents.filter((s) => s.wave === 'BALI_GEL_2').length;
  const yogya1 = registeredStudents.filter((s) => s.wave === 'YOGYA_GEL_1').length;

  // T-Shirt breakdown
  const sizeCounts: Record<string, number> = {};
  registeredStudents.forEach((s) => {
    if (s.tShirtSize) sizeCounts[s.tShirtSize] = (sizeCounts[s.tShirtSize] || 0) + 1;
  });

  const handleCopyWA = () => {
    if (!activeClass) return;
    const waText = RecapGeneratorService.generateWhatsAppRecap(activeClass, classStudents, settings);
    navigator.clipboard.writeText(waText);
    setCopiedWA(true);
    setTimeout(() => setCopiedWA(false), 2500);
  };

  const handlePrintClass = () => {
    setActiveSubTab('STATUS_REPORT');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Sub Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2.5 p-3 bg-white rounded-2xl border border-slate-200 shadow-xs no-print">
        <button
          type="button"
          onClick={() => setActiveSubTab('MONITORING')}
          className={`flex-1 h-11 sm:h-12 py-2.5 px-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'MONITORING'
              ? 'bg-[#0284c7] text-white shadow-xs font-black'
              : 'bg-sky-50 text-sky-900 hover:bg-sky-100 border border-sky-200'
          }`}
        >
          📊 Monitoring & Hasil Angket
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('STATUS_REPORT')}
          className={`flex-1 h-11 sm:h-12 py-2.5 px-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'STATUS_REPORT'
              ? 'bg-[#00875a] text-white shadow-xs font-black'
              : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200'
          }`}
        >
          📋 Laporan Status (PDF)
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('SURAT_IZIN')}
          className={`flex-1 h-11 sm:h-12 py-2.5 px-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'SURAT_IZIN'
              ? 'bg-[#9333ea] text-white shadow-xs font-black'
              : 'bg-purple-50 text-purple-900 hover:bg-purple-100 border border-purple-200'
          }`}
        >
          ✉️ Surat Izin / Pernyataan
        </button>
        {currentUser?.role === 'ADMIN' && (
          <>
            <button
              type="button"
              onClick={() => setActiveSubTab('WALI_KELAS')}
              className={`flex-1 h-11 sm:h-12 py-2.5 px-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeSubTab === 'WALI_KELAS'
                  ? 'bg-slate-900 text-white shadow-xs font-black'
                  : 'bg-slate-200 text-slate-800 hover:bg-slate-300 border border-slate-300'
              }`}
            >
              👥 Kelola Wali
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('CLASSES')}
              className={`flex-1 h-11 sm:h-12 py-2.5 px-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeSubTab === 'CLASSES'
                  ? 'bg-amber-600 text-white shadow-xs font-black'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              🏫 Kelola Kelas
            </button>
          </>
        )}
      </div>

      {/* Top Banner & Class Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 mb-1">
            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Portal Khusus Wali Kelas</span>
            {isWaliKelasRole && (
              <span className="ml-1 bg-emerald-600 text-white px-2 py-0.2 rounded-md text-[10px] uppercase font-black">
                Terautentikasi: {assignedClass}
              </span>
            )}
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {isWaliKelasRole ? `Dashboard Wali Kelas ${selectedClassName}` : `Dashboard Pendamping Wali Kelas (${classes.length} Kelas)`}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isWaliKelasRole
              ? `Menampilkan data khusus kelas yang Anda ampu (${selectedClassName}).`
              : 'Pilih kelas untuk melihat persentase partisipasi siswa, kelayakan keberangkatan, dan rekap bus/kamar.'}
          </p>
        </div>

        {/* Class Selector Dropdown */}
        {activeSubTab === 'MONITORING' && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
            <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
              {isWaliKelasRole ? 'Kelas Anda:' : 'Pilih Kelas:'}
            </label>
            {isWaliKelasRole ? (
              <div className="px-4 py-2.5 bg-slate-900 text-emerald-400 font-black text-sm rounded-xl flex items-center gap-2 border border-slate-700 shadow-sm w-full sm:w-auto justify-center sm:justify-start">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>{selectedClassName}</span>
              </div>
            ) : (
              <select
                value={selectedClassName}
                onChange={(e) => setUserSelectedClassName(e.target.value)}
                className="w-full sm:w-72 px-4 py-2.5 bg-slate-900 text-white font-bold text-sm rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-sm text-ellipsis overflow-hidden whitespace-nowrap"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.name}>
                    {cls.name} ({cls.department})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {activeSubTab === 'STATUS_REPORT' ? (
        <StatusAngketA4Report
          selectedClassName={selectedClassName}
          classes={classes}
          students={students}
          settings={settings}
        />
      ) : activeSubTab === 'SURAT_IZIN' ? (
        <SuratIzinView
          students={students}
          classes={classes}
          currentUser={currentUser}
          settings={settings}
        />
      ) : activeSubTab === 'MONITORING' ? (
        <>
          {/* Class Overview Cards & Eligibility Banner (Standardized 2-Column Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Homeroom Info & Participation % */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Informasi Kelas & Progres
                </span>
                <h3 className="text-2xl font-black text-slate-900 mt-0.5">
                  {activeClass?.name}
                </h3>
                <p className="text-xs font-medium text-slate-500">{activeClass?.department}</p>
              </div>

              <div className="pt-2 border-t border-slate-100 text-xs space-y-1.5 text-slate-700 font-medium">
                <p>👨‍🏫 Wali Kelas: <strong>{activeClass?.homeroomTeacher}</strong></p>
                <p>📱 Telepon Wali Kelas: <strong>{activeClass?.teacherPhone || '-'}</strong></p>
                <p>👥 Total Siswa Terdaftar: <strong>{totalInClass} Siswa</strong></p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1 pt-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600">Partisipasi Siswa</span>
                  <span className="text-emerald-600">{participationPct}% ({registeredCount}/{totalInClass})</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${Math.min(participationPct, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Card 2: Status Keikutsertaan Wali Kelas (Dinamis & Configurable) */}
            <div className={`rounded-2xl border p-6 space-y-4 shadow-xs flex flex-col justify-between ${
              !canShowWaliStatusCard
                ? 'bg-slate-50 border-slate-200'
                : currentWaliItem?.finalStatus === 'BALI_GEL_1'
                ? 'bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white border-emerald-300'
                : currentWaliItem?.finalStatus === 'BALI_GEL_2'
                ? 'bg-gradient-to-br from-teal-50 via-cyan-50/40 to-white border-teal-300'
                : 'bg-gradient-to-br from-amber-50 via-orange-50/30 to-white border-amber-300'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Status Keikutsertaan Wali Kelas
                </span>
                
                {/* Admin Quick Show/Hide Toggle */}
                {currentUser?.role === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={handleToggleWaliStatusVisibility}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black border transition-all cursor-pointer flex items-center gap-1 ${
                      isStatusVisibleToWali
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                        : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'
                    }`}
                    title="Klik untuk mengubah visibilitas status keikutsertaan di portal Wali Kelas"
                  >
                    {isStatusVisibleToWali ? '👁️ Tampil di Wali (Default: Sembunyi)' : '🔒 Sembunyi dari Wali (Klik Tampilkan)'}
                  </button>
                )}
              </div>

              {!canShowWaliStatusCard ? (
                <div className="space-y-2 py-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-extrabold">
                    🔒 DALAM PROSES PENETAPAN PANITIA
                  </div>
                  <h4 className="text-base font-bold text-slate-800">
                    Penetapan Kuota Armada Bus Wali Kelas
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Status resmi keikutsertaan dan penetapan gelombang Wali Kelas sedang dikalkulasi oleh Panitia Darmawisata berdasarkan rekapitulasi data pendaftaran siswa. Hasil resmi akan dibuka secara serentak.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    {currentWaliItem?.finalStatus === 'BALI_GEL_1' && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-black shadow-xs">
                        <CheckCircle2 className="w-4 h-4" /> LOLOS KE BALI (GELOMBANG 1) • RANK #{currentWaliItem.rank}
                      </div>
                    )}
                    {currentWaliItem?.finalStatus === 'BALI_GEL_2' && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-600 text-white rounded-lg text-xs font-black shadow-xs">
                        <CheckCircle2 className="w-4 h-4" /> LOLOS KE BALI (GELOMBANG 2) • RANK #{currentWaliItem.rank}
                      </div>
                    )}
                    {currentWaliItem?.finalStatus === 'YOGYAKARTA' && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-black shadow-xs">
                        <Compass className="w-4 h-4" /> KE JOGJA / STANDBY • RANK #{currentWaliItem?.rank || '-'}
                      </div>
                    )}
                    {currentWaliItem?.finalStatus === 'NOT_PARTICIPATING' && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-black shadow-xs">
                        <XCircle className="w-4 h-4" /> TIDAK IKUT BERANGKAT
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-white/80 rounded-xl border border-slate-200/80 text-xs space-y-1 font-medium text-slate-700">
                    <div className="flex justify-between">
                      <span>Siswa Ikut Ke Bali:</span>
                      <strong className="text-emerald-700">{currentWaliItem?.baliCount || 0} Siswa ({currentWaliItem?.baliPercentage || 0}%)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Batas Kuota Wali Bali:</span>
                      <strong>Top {waliAllocation.totalQuotaWaliBali} Kelas ({waliAllocation.totalBusesNeeded} Bus)</strong>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {currentWaliItem?.finalStatus === 'NOT_PARTICIPATING' ? (
                      <>
                        Status Keikutsertaan Anda ditetapkan sebagai <strong>Tidak Ikut Berangkat</strong> oleh Panitia berdasarkan penyesuaian/alasan khusus pendampingan.
                      </>
                    ) : currentWaliItem?.finalStatus.startsWith('BALI') ? (
                      <>
                        Selamat! Berdasarkan hasil perhitungan otomatis pembagian bus, kelas Anda berada di <strong>Ranking #{currentWaliItem.rank}</strong> (masuk kuota {waliAllocation.totalQuotaWaliBali} Bus Bali) sehingga Wali Kelas berhak berangkat pendampingan ke Bali.
                      </>
                    ) : (
                      <>
                        Kelas Anda berada di <strong>Ranking #{currentWaliItem?.rank || '-'}</strong> ({currentWaliItem?.baliCount || 0} siswa ke Bali). Saat ini berada di luar batas {waliAllocation.totalQuotaWaliBali} kuota armada bus Bali, sehingga dialokasikan mendampingi siswa ke Yogyakarta.
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Card 3: Destination & Shirt Quick Summary (Spans 2 cols for perfect balance) */}
            <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {isAngketClosed ? 'Rincian Sebaran Gelombang Keberangkatan' : 'Rincian Pilihan Tujuan Sementara'}
                </span>
                {isAngketClosed ? (
                  <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                    <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="text-xs text-emerald-800 font-semibold">Bali Gel I</p>
                      <p className="text-lg font-black text-emerald-900">{bali1}</p>
                    </div>
                    <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-xs text-blue-800 font-semibold">Bali Gel II</p>
                      <p className="text-lg font-black text-blue-900">{bali2}</p>
                    </div>
                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                      <p className="text-xs text-amber-800 font-semibold">Yogya Gel I</p>
                      <p className="text-lg font-black text-amber-900">{yogya1}</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 mt-2 text-center">
                    <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="text-xs text-emerald-800 font-semibold">Peminat Bali</p>
                      <p className="text-lg font-black text-emerald-900">
                        {registeredStudents.filter((s) => s.destination === 'BALI').length}
                      </p>
                    </div>
                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                      <p className="text-xs text-amber-800 font-semibold">Peminat Yogyakarta</p>
                      <p className="text-lg font-black text-amber-900">
                        {registeredStudents.filter((s) => s.destination === 'YOGYAKARTA').length}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                <button
                  onClick={handleCopyWA}
                  className="h-11 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-xs shrink-0 cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copiedWA ? 'Tersalin ke WA!' : 'Salin Format WA Group'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintClass}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Cetak Rekap Kelas"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak PDF
                </button>

                {currentUser?.role === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={() => setIsClearModalOpen(true)}
                    className="col-span-2 w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs"
                    title="Kosongkan Data Kelas Ini"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Kosongkan Data Kelas
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Class Students Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Daftar Siswa Kelas {activeClass?.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Menampilkan {classStudents.length} siswa terdaftar di sistem.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {currentUser?.role === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={handleOpenAddStudentModal}
                    className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Siswa</span>
                  </button>
                )}

                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <Shirt className="w-4 h-4 text-slate-400" />
                  <span>Ukuran Kaos Terdata: </span>
                  <div className="flex gap-1.5">
                    {Object.entries(sizeCounts).map(([sz, count]) => (
                      <span key={sz} className="bg-slate-200 px-2 py-0.5 rounded font-bold text-slate-800">
                        {sz}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 uppercase tracking-wider font-extrabold border-b border-slate-200">
                    <th className="py-3.5 px-4 w-12 text-center">No</th>
                    <th className="py-3.5 px-4">NIS</th>
                    <th className="py-3.5 px-4">Nama Siswa</th>
                    <th className="py-3.5 px-4">L/P</th>
                    <th className="py-3.5 px-4">Tujuan / Gelombang</th>
                    <th className="py-3.5 px-4">Kaos</th>
                    <th className="py-3.5 px-4">Bus / Kamar</th>
                    <th className="py-3.5 px-4">Kontak & Riwayat</th>
                    <th className="py-3.5 px-4">Jalur Tidak Mampu</th>
                    <th className="py-3.5 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classStudents.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400 font-medium">
                        Belum ada data siswa untuk kelas ini.
                      </td>
                    </tr>
                  ) : (
                    classStudents.map((st, idx) => (
                      <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-400 text-center">{idx + 1}</td>
                        <td className="py-3 px-4 font-extrabold text-slate-900">{st.nis}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          <div>{st.name}</div>
                          {st.address && (
                            <div className="text-[10px] text-slate-500 font-normal flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[200px]" title={st.address}>{st.address}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <GenderBadge gender={st.gender} />
                        </td>
                        <td className="py-3 px-4">
                          {isAngketClosed ? (
                            <WaveBadge wave={st.wave} />
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                              Menunggu Angket Ditutup
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-extrabold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                            {st.tShirtSize || '-'} {st.tShirtDesign ? `(${st.tShirtDesign})` : ''}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">
                          {isAngketClosed ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                <Bus className="w-3 h-3 text-slate-500" />
                                {st.busNumber ? `Bus ${st.busNumber} (#${st.seatNumber || '-'})` : '-'}
                              </span>
                              <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                <BedDouble className="w-3 h-3 text-slate-500" />
                                {st.roomNumber ? `Kmr ${st.roomNumber}` : '-'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-medium italic">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap gap-1">
                              {st.studentPhone ? (
                                <a
                                  href={formatWhatsAppLink(st.studentPhone, `Halo ${st.name}, mohon konfirmasi data Darmawisata Anda.`)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 font-bold text-[10px] transition-colors animate-in fade-in"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  <span>Siswa</span>
                                </a>
                              ) : null}

                              {st.parentPhone ? (
                                <a
                                  href={formatWhatsAppLink(st.parentPhone, `Halo Orang Tua dari ${st.name}, mohon konfirmasi data Darmawisata anak Anda.`)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 hover:bg-sky-100 px-2 py-0.5 rounded-full border border-sky-200 font-bold text-[10px] transition-colors"
                                >
                                  <span>Ortu</span>
                                </a>
                              ) : null}

                              {!st.studentPhone && !st.parentPhone ? (
                                <span className="text-slate-400 text-[10px] font-medium italic">Belum mengisi WA</span>
                              ) : null}
                            </div>

                            {st.medicalHistory && st.medicalHistory.trim().toUpperCase() !== 'TIDAK ADA' && st.medicalHistory.trim() !== '-' && (
                              <div className="text-[10px] text-rose-600 font-extrabold flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 w-fit">
                                <span className="w-1 h-1 bg-rose-500 rounded-full animate-ping"></span>
                                <span className="truncate max-w-[120px]" title={st.medicalHistory}>Sakit: {st.medicalHistory}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <WaiverBadge waiver={st.waiverType} />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditStudentModal(st)}
                              className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Siswa"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {currentUser?.role === 'ADMIN' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteStudentClick(st)}
                                className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Hapus Siswa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : activeSubTab === 'WALI_KELAS' ? (
        <WaliKelasManager
          classes={classes}
          students={students}
          settings={settings!}
          onUpdateClass={onUpdateClass!}
          onAddClass={onAddClass!}
        />
      ) : (
        <ClassManager
          classes={classes}
          students={students}
          onAddClass={onAddClass!}
          onUpdateClass={onUpdateClass!}
          onDeleteClass={onDeleteClass!}
        />
      )}

      {/* Modal Kosongkan Data Kelas */}
      <Modal
        isOpen={isClearModalOpen}
        onClose={() => {
          setIsClearModalOpen(false);
          setConfirmText('');
        }}
        title={`Kosongkan Data Kelas - ${selectedClassName}`}
        subtitle="Pilih metode pengosongan data secara hati-hati"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex gap-2.5 text-xs text-rose-800 font-medium">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <span className="font-extrabold text-rose-950">PERINGATAN KRUSIAL:</span> Tindakan ini tidak dapat dibatalkan. Data yang dikosongkan akan langsung dihapus dari sistem Firebase Firestore.
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">Pilih Mode Pengosongan:</label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setClearActionType('REGISTRATION_ONLY')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  clearActionType === 'REGISTRATION_ONLY'
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="font-bold text-xs text-slate-900">Reset Status Pendaftaran Angket</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Menghapus semua respon angket (kaos, bus, kamar, kontak) tetapi <strong>tetap mempertahankan daftar nama siswa</strong> di kelas ini.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setClearActionType('DELETE_STUDENTS')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  clearActionType === 'DELETE_STUDENTS'
                    ? 'border-rose-600 bg-rose-50/30 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="font-bold text-xs text-rose-950">Hapus Seluruh Data Siswa</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Menghapus seluruh record siswa kelas ini dari sistem master data secara total.
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              Ketik <span className="font-extrabold text-rose-600 font-mono select-all">KOSONGKAN</span> untuk konfirmasi:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="KOSONGKAN"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsClearModalOpen(false);
                setConfirmText('');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={confirmText.trim().toUpperCase() !== 'KOSONGKAN' || isClearing}
              onClick={handleExecuteClear}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-extrabold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {isClearing ? 'Memproses...' : 'Ya, Kosongkan Data'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Tambah / Edit Siswa */}
      <Modal
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        title={editingStudent ? `Edit Data Siswa - ${editingStudent.name}` : 'Tambah Siswa Baru'}
        subtitle={`Kelas ${selectedClassName}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveStudentSubmit} className="space-y-4 text-xs font-serif">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                NIS (Nomor Induk Siswa) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formNis}
                onChange={(e) => setFormNis(e.target.value)}
                placeholder="Contoh: 12345"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Lengkap Siswa <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nama Lengkap Siswa"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kelas</label>
              <select
                value={formClassName}
                onChange={(e) => setFormClassName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {classes.map((c) => (
                  <option key={c.id || c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Jenis Kelamin</label>
              <select
                value={formGender}
                onChange={(e) => setFormGender(e.target.value as GenderType)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="LAKI-LAKI">LAKI-LAKI</option>
                <option value="PEREMPUAN">PEREMPUAN</option>
              </select>
            </div>
          </div>

          {/* Alamat Lengkap & Nama Orang Tua */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>Alamat Lengkap Siswa / Orang Tua</span>
            </label>
            <textarea
              rows={2}
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              placeholder="Contoh: RT 02 RW 01, Desa/Kel. Kertosari, Kec. Babadan, Kab. Ponorogo"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">
              Alamat ini akan dicetak otomatis pada dokumen Surat Izin Orang Tua dan Surat Pernyataan JTM.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Orang Tua / Wali</label>
              <input
                type="text"
                value={formParentName}
                onChange={(e) => setFormParentName(e.target.value)}
                placeholder="Nama Orang Tua"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Jalur / Beasiswa</label>
              <select
                value={formWaiverType}
                onChange={(e) => setFormWaiverType(e.target.value as WaiverType)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="NONE">Reguler (Normal)</option>
                <option value="25%">Diskon 25% (Jalur Tidak Mampu)</option>
                <option value="50%">Diskon 50% (Jalur Tidak Mampu)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">No. WA Siswa</label>
              <input
                type="text"
                value={formStudentPhone}
                onChange={(e) => setFormStudentPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">No. WA Orang Tua</label>
              <input
                type="text"
                value={formParentPhone}
                onChange={(e) => setFormParentPhone(e.target.value)}
                placeholder="Contoh: 081987654321"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Riwayat Kesehatan / Penyakit</label>
            <input
              type="text"
              value={formMedicalHistory}
              onChange={(e) => setFormMedicalHistory(e.target.value)}
              placeholder="Contoh: Asma, Alergi Udara Dingin (atau 'TIDAK ADA')"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsStudentModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              {editingStudent ? 'Simpan Perubahan' : 'Tambah Siswa'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
