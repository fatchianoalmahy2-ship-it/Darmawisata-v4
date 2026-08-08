'use client';

import React, { useState, useMemo } from 'react';
import { SchoolClass, Student, AppSettings } from '@/types';
import {
  calculateWaliAllocation,
  WaliAllocationItem,
} from '@/lib/waliAllocation';
import {
  Trophy,
  Bus as BusIcon,
  Users,
  Compass,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Search,
  Filter,
  FileSpreadsheet,
  Award,
  Sparkles,
  HelpCircle,
  Send,
  RefreshCw,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { PaginationControls } from '@/components/ui/PaginationControls';

interface WaliAllocationManagerProps {
  classes: SchoolClass[];
  students: Student[];
  settings: AppSettings;
  onUpdateClass: (updatedClass: SchoolClass) => void;
}

export const WaliAllocationManager: React.FC<WaliAllocationManagerProps> = ({
  classes,
  students,
  settings,
  onUpdateClass,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedClassForOverride, setSelectedClassForOverride] = useState<WaliAllocationItem | null>(null);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'PERCENTAGE' | 'COUNT' | 'CLASS_NAME' | 'DEPARTMENT'>('PERCENTAGE');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  // Form override
  const [overrideDest, setOverrideDest] = useState<'AUTO' | 'BALI_GEL_1' | 'BALI_GEL_2' | 'YOGYAKARTA' | 'NOT_PARTICIPATING'>('AUTO');
  const [overrideNotes, setOverrideNotes] = useState('');

  // 1. Calculate Allocation
  const allocationResult = useMemo(() => {
    return calculateWaliAllocation(classes, students, settings, sortBy);
  }, [classes, students, settings, sortBy]);

  const {
    totalBaliStudents,
    totalYogyaStudents,
    busCapacity,
    totalGelombang,
    totalBusesNeeded,
    totalQuotaWaliBali,
    quotaGel1,
    quotaGel2,
    items,
  } = allocationResult;

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search
      const matchesSearch =
        searchTerm === '' ||
        item.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.homeroomTeacher.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.department.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // Status Filter
      if (statusFilter === 'BALI_GEL_1') return item.finalStatus === 'BALI_GEL_1';
      if (statusFilter === 'BALI_GEL_2') return item.finalStatus === 'BALI_GEL_2';
      if (statusFilter === 'BALI_ALL') return item.finalStatus.startsWith('BALI');
      if (statusFilter === 'YOGYAKARTA') return item.finalStatus === 'YOGYAKARTA';
      if (statusFilter === 'NOT_PARTICIPATING') return item.finalStatus === 'NOT_PARTICIPATING';

      return true;
    });
  }, [items, searchTerm, statusFilter]);

  // Open Override Modal
  const handleOpenOverride = (item: WaliAllocationItem) => {
    setSelectedClassForOverride(item);
    setOverrideDest(
      (item.manualWaliDestination as any) || 'AUTO'
    );
    setOverrideNotes(item.manualWaliNotes || '');
    setIsOverrideModalOpen(true);
  };

  // Save Override
  const handleSaveOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassForOverride) return;

    const originalCls = classes.find((c) => c.id === selectedClassForOverride.classId);
    if (!originalCls) return;

    const updated: SchoolClass = {
      ...originalCls,
      manualWaliDestination: overrideDest,
      manualWaliNotes: overrideNotes,
    };

    onUpdateClass(updated);
    setIsOverrideModalOpen(false);
  };

  // Export Excel
  const handleExportExcel = () => {
    const exportData = filteredItems.map((item) => ({
      'Ranking #': item.rank,
      'Nama Kelas': item.className,
      Kejuruan: item.department,
      'Nama Wali Kelas': item.homeroomTeacher,
      'Kontak HP': item.teacherPhone || '',
      'Total Siswa Kelas': item.totalStudents,
      'Siswa Ke Bali': `${item.baliCount} (${item.baliPercentage}%)`,
      'Siswa Ke Jogja': item.yogyaCount,
      'Status Keikutsertaan Wali': item.statusLabel,
      'Penetapan Status': item.isOverride ? 'Manual Override Admin' : 'Otomatis Formula',
      Catatan: item.manualWaliNotes || '',
    }));

    import('@/services/excelService').then(({ ExcelService }) => {
      ExcelService.exportToExcel(
        exportData,
        'Pembagian_Wali_Kelas_Bali_Jogja',
        'Pembagian Wali'
      );
    });
  };

  // WhatsApp Share All
  const handleShareWhatsAppRecap = () => {
    let msg = `*📊 REKAP PEMBAGIAN WALI KELAS DARMAWISATA*\n`;
    msg += `*${settings.schoolName || 'SMK PGRI 2 PONOROGO'}*\n`;
    msg += `--------------------------------------------------\n`;
    msg += `• Total Siswa Bali: *${totalBaliStudents} Siswa*\n`;
    msg += `• Kapasitas Bus: *${busCapacity} Kursi/Bus*\n`;
    msg += `• Total Bus Bali: *${totalBusesNeeded} Armada*\n`;
    msg += `• Total Kuota Wali Ke Bali: *${totalQuotaWaliBali} Wali Kelas*\n`;
    msg += `  - Gelombang 1: *${quotaGel1} Wali Kelas*\n`;
    msg += `  - Gelombang 2: *${quotaGel2} Wali Kelas*\n\n`;
    msg += `*🏆 DAFTAR RANKING & STATUS KEIKUTSERTAAN WALI KELAS:*\n`;

    items.forEach((it) => {
      msg += `*Rank ${it.rank}. ${it.className}* (${it.homeroomTeacher})\n`;
      msg += `   └ Siswa Bali: ${it.baliCount}/${it.totalStudents} (${it.baliPercentage}%) ➔ *${it.statusLabel}*\n`;
    });

    msg += `--------------------------------------------------\n`;
    msg += `*Catatan:* Penentuan batas keikutsertaan wali kelas berdasarkan perbandingan total bus & ranking kepesertaan siswa per kelas.`;

    const waLink = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waLink, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Summary Stats */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-lg relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-black tracking-wide uppercase border border-emerald-500/30">
                <Sparkles className="w-3.5 h-3.5" /> Pembagian Dinamis & Otomatis
              </span>
              <h2 className="text-xl sm:text-2xl font-black mt-2 tracking-tight">
                Pembagian Keikutsertaan Wali Kelas (Bali / Jogja)
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100/80 mt-1 max-w-2xl font-medium">
                Ranking kelas disusun dinamis dari jumlah siswa yang ikut ke Bali. Jumlah kuota Wali Kelas ke Bali disesuaikan secara otomatis dari hasil pembagian total siswa ke Bali dengan kapasitas bus.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShareWhatsAppRecap}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Send className="w-4 h-4" /> Share Rekap WA
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export Excel
              </button>
            </div>
          </div>

          {/* Stat Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <div className="text-[11px] font-extrabold text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400" /> Total Siswa Bali
              </div>
              <div className="text-xl sm:text-2xl font-black mt-1 text-white">
                {totalBaliStudents}{' '}
                <span className="text-xs font-bold text-emerald-200 font-normal">Siswa</span>
              </div>
              <div className="text-[10px] text-emerald-200/70 mt-1">
                Kapasitas Bus: {busCapacity} Kursi/Armada
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <div className="text-[11px] font-extrabold text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
                <BusIcon className="w-4 h-4 text-emerald-400" /> Analisis Total Bus
              </div>
              <div className="text-xl sm:text-2xl font-black mt-1 text-white">
                {totalBusesNeeded}{' '}
                <span className="text-xs font-bold text-emerald-200 font-normal">Armada Bus</span>
              </div>
              <div className="text-[10px] text-emerald-200/70 mt-1">
                1 Bus = 1 Kuota Wali Kelas ke Bali
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <div className="text-[11px] font-extrabold text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-400" /> Kuota Wali Ke Bali
              </div>
              <div className="text-xl sm:text-2xl font-black mt-1 text-white">
                {totalQuotaWaliBali}{' '}
                <span className="text-xs font-bold text-emerald-200 font-normal">Wali Kelas</span>
              </div>
              <div className="text-[10px] text-emerald-200/70 mt-1">
                Gel 1: {quotaGel1} Wali | Gel 2: {quotaGel2} Wali
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <div className="text-[11px] font-extrabold text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-emerald-400" /> Wali Ke Jogja
              </div>
              <div className="text-xl sm:text-2xl font-black mt-1 text-amber-300">
                {items.filter((i) => i.finalStatus === 'YOGYAKARTA').length}{' '}
                <span className="text-xs font-bold text-amber-200 font-normal">Wali Kelas</span>
              </div>
              <div className="text-[10px] text-amber-200/70 mt-1">
                Di luar batas kuota bus Bali
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari kelas, wali kelas, atau jurusan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Sort Selection */}
          <div className="w-full sm:w-60 flex items-center gap-2">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">Urutan:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="PERCENTAGE">📊 Persentase Bali (Tinggi ➔ Rendah)</option>
              <option value="COUNT">👥 Jumlah Siswa Bali (Tinggi ➔ Rendah)</option>
              <option value="CLASS_NAME">🔤 Nama Kelas (Abjad A-Z)</option>
              <option value="DEPARTMENT">🛠️ Kelompok Jurusan</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua Kelas ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('BALI_GEL_1')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === 'BALI_GEL_1'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            Gel 1 ({items.filter((i) => i.finalStatus === 'BALI_GEL_1').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('BALI_GEL_2')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === 'BALI_GEL_2'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
            }`}
          >
            Gel 2 ({items.filter((i) => i.finalStatus === 'BALI_GEL_2').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('YOGYAKARTA')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === 'YOGYAKARTA'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            Jogja ({items.filter((i) => i.finalStatus === 'YOGYAKARTA').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('NOT_PARTICIPATING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === 'NOT_PARTICIPATING'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            Tidak Ikut ({items.filter((i) => i.finalStatus === 'NOT_PARTICIPATING').length})
          </button>
        </div>
      </div>

      {/* Bulk Override Action Bar */}
      {selectedClassIds.length > 0 && (
        <div className="bg-emerald-50 border-2 border-emerald-500 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-black shadow-xs text-sm">
              {selectedClassIds.length}
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Ubah Destinasi Masal Terpilih</h3>
              <p className="text-[11px] text-slate-600 mt-0.5 font-medium">
                Setel status atau destinasi sekaligus untuk <strong>{selectedClassIds.length} kelas</strong> terpilih.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <select
              className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 cursor-pointer w-full md:w-64"
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                
                selectedClassIds.forEach(id => {
                  const originalCls = classes.find(c => c.id === id);
                  if (originalCls) {
                    onUpdateClass({
                      ...originalCls,
                      manualWaliDestination: val as any,
                    });
                  }
                });
                
                setSelectedClassIds([]);
              }}
              defaultValue=""
            >
              <option value="" disabled>-- Pilih Status Untuk Diterapkan --</option>
              <option value="AUTO">🤖 Gunakan Formula Otomatis (AUTO)</option>
              <option value="BALI_GEL_1">🏝️ Lolos Bali - Gelombang 1</option>
              <option value="BALI_GEL_2">🏝️ Lolos Bali - Gelombang 2</option>
              <option value="YOGYAKARTA">🕌 Ke Jogja / Standby</option>
              <option value="NOT_PARTICIPATING">❌ Tidak Ikut / Tidak Berangkat</option>
            </select>
            
            <button
              type="button"
              onClick={() => setSelectedClassIds([])}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Main Ranking Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-black uppercase text-slate-600 tracking-wider">
                <th className="py-3 px-4 text-center w-12">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4.5 h-4.5 cursor-pointer"
                    checked={filteredItems.length > 0 && selectedClassIds.length === filteredItems.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedClassIds(filteredItems.map(item => item.classId));
                      } else {
                        setSelectedClassIds([]);
                      }
                    }}
                  />
                </th>
                <th className="py-3 px-4 text-center w-16">Rank</th>
                <th className="py-3 px-4">Nama Kelas & Jurusan</th>
                <th className="py-3 px-4">Nama Wali Kelas</th>
                <th className="py-3 px-4 text-center">Presensi Ke Bali</th>
                <th className="py-3 px-4 text-center">Presensi Ke Jogja</th>
                <th className="py-3 px-4 text-center">Status Keikutsertaan Wali</th>
                <th className="py-3 px-4 text-center w-28">Aksi Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-800 font-medium">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-medium">
                    Tidak ada data kelas yang sesuai dengan pencarian atau filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isTop3 = item.rank <= 3;
                  const isBali = item.finalStatus.startsWith('BALI');

                  return (
                    <tr
                      key={item.classId}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        item.rank <= totalQuotaWaliBali ? 'bg-emerald-50/20' : ''
                      }`}
                    >
                      {/* Checkbox Column */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4.5 h-4.5 cursor-pointer"
                          checked={selectedClassIds.includes(item.classId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedClassIds(prev => [...prev, item.classId]);
                            } else {
                              setSelectedClassIds(prev => prev.filter(id => id !== item.classId));
                            }
                          }}
                        />
                      </td>

                      {/* Rank Column */}
                      <td className="py-3.5 px-4 text-center font-black">
                        {item.rank === 1 && (
                          <span className="inline-flex items-center justify-center w-7 h-7 bg-amber-400 text-amber-950 font-black rounded-full shadow-xs text-xs">
                            🥇 1
                          </span>
                        )}
                        {item.rank === 2 && (
                          <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-300 text-slate-900 font-black rounded-full shadow-xs text-xs">
                            🥈 2
                          </span>
                        )}
                        {item.rank === 3 && (
                          <span className="inline-flex items-center justify-center w-7 h-7 bg-amber-700 text-amber-50 font-black rounded-full shadow-xs text-xs">
                            🥉 3
                          </span>
                        )}
                        {item.rank > 3 && (
                          <span className="text-slate-500 font-extrabold text-xs">
                            #{item.rank}
                          </span>
                        )}
                      </td>

                      {/* Class Name & Dept */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 text-sm">
                          {item.className}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {item.department} • Total {item.totalStudents} Siswa
                        </div>
                      </td>

                      {/* Homeroom Teacher */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{item.homeroomTeacher}</div>
                        <div className="text-[11px] text-slate-500">{item.teacherPhone || 'Tanpa Kontak HP'}</div>
                      </td>

                      {/* Bali Attendance */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="font-black text-emerald-700 text-sm">
                          {item.baliPercentage}% Kepesertaan
                        </div>
                        <div className="w-24 bg-slate-100 rounded-full h-1.5 mx-auto mt-1 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, item.baliPercentage)}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-slate-500 font-bold mt-0.5">
                          {item.baliCount} Siswa
                        </div>
                      </td>

                      {/* Jogja Attendance */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="font-bold text-slate-700">
                          {item.yogyaCount} Siswa
                        </div>
                      </td>

                      {/* Status Keikutsertaan Wali */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center gap-0.5">
                          {item.finalStatus === 'BALI_GEL_1' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full font-black text-xs shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              Lolos Bali (Gel. 1)
                            </span>
                          )}
                          {item.finalStatus === 'BALI_GEL_2' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-teal-100 text-teal-900 border border-teal-300 rounded-full font-black text-xs shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              Lolos Bali (Gel. 2)
                            </span>
                          )}
                          {item.finalStatus === 'YOGYAKARTA' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full font-extrabold text-xs">
                              <Compass className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              Ke Jogja / Standby
                            </span>
                          )}
                          {item.finalStatus === 'NOT_PARTICIPATING' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-100 text-rose-900 border border-rose-300 rounded-full font-extrabold text-xs">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              Tidak Ikut
                            </span>
                          )}

                          {item.isOverride && (
                            <span className="text-[9px] font-extrabold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                              ✏️ Override Admin
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action Override */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenOverride(item)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 border border-slate-200 hover:border-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Set Status
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Override Modal */}
      {isOverrideModalOpen && selectedClassForOverride && (
        <Modal
          isOpen={isOverrideModalOpen}
          onClose={() => setIsOverrideModalOpen(false)}
          title={`Penetapan Keikutsertaan Wali Kelas - ${selectedClassForOverride.className}`}
          subtitle={`Wali Kelas: ${selectedClassForOverride.homeroomTeacher}`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveOverride} className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <div className="font-bold text-slate-800">
                Data Kepesertaan Kelas:
              </div>
              <div className="text-slate-600">
                • Siswa Bali: <strong>{selectedClassForOverride.baliCount} Siswa ({selectedClassForOverride.baliPercentage}%)</strong><br />
                • Siswa Jogja: <strong>{selectedClassForOverride.yogyaCount} Siswa</strong><br />
                • Ranking Kepesertaan: <strong>Rank #{selectedClassForOverride.rank}</strong><br />
                • Rekomendasi Formula: <strong>{selectedClassForOverride.autoStatus === 'BALI_GEL_1' ? 'Lolos Bali (Gel. 1)' : selectedClassForOverride.autoStatus === 'BALI_GEL_2' ? 'Lolos Bali (Gel. 2)' : 'Ke Jogja'}</strong>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pilih Penetapan Destinasi Wali Kelas
              </label>
              <select
                value={overrideDest}
                onChange={(e) => setOverrideDest(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="AUTO">🤖 Gunakan Formula Otomatis (Rekomendasi)</option>
                <option value="BALI_GEL_1">🏝️ Paksa Lolos Bali - Gelombang 1</option>
                <option value="BALI_GEL_2">🏝️ Paksa Lolos Bali - Gelombang 2</option>
                <option value="YOGYAKARTA">🕌 Paksa Ke Jogja / Standby</option>
                <option value="NOT_PARTICIPATING">❌ Paksa Tidak Ikut / Tidak Berangkat</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan / Alasan Khusus (Opsional)
              </label>
              <textarea
                rows={3}
                value={overrideNotes}
                onChange={(e) => setOverrideNotes(e.target.value)}
                placeholder="Misal: Kebijakan Khusus Panitia / Penugasan Khusus"
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsOverrideModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-extrabold text-xs hover:bg-emerald-700 shadow-xs cursor-pointer"
              >
                Simpan Penetapan
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
