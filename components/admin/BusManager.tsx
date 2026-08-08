'use client';

import React, { useState } from 'react';
import { Bus, Student, WaveType, AppSettings } from '@/types';
import { motion } from 'motion/react';
import { WaveBadge } from '@/components/ui/Badge';
import { 
  Bus as BusIcon, 
  User, 
  Trash2, 
  Plus, 
  Check,
  FileSpreadsheet,
  Upload,
  AlertCircle,
  Edit2
} from 'lucide-react';
import { useTableQuery } from '@/hooks/useTableQuery';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { Modal } from '@/components/ui/Modal';

interface BusManagerProps {
  buses: Bus[];
  students: Student[];
  onUpdateStudent: (student: Student) => void;
  onBulkImportStudents?: (importedStudents: Student[]) => void;
  settings?: AppSettings;
  onSaveSettings?: (settings: AppSettings) => void;
}

export const BusManager: React.FC<BusManagerProps> = ({
  buses,
  students,
  onUpdateStudent,
  onBulkImportStudents,
  settings,
  onSaveSettings,
}) => {
  const [assigningStudentId, setAssigningStudentId] = useState('');
  const [assigningBusNum, setAssigningBusNum] = useState<number | null>(null);
  const [assigningSeatNum, setAssigningSeatNum] = useState<number>(3);

  // Custom bus guide editing state
  const [editingBusId, setEditingBusId] = useState<string | null>(null);
  const [editGuide1, setEditGuide1] = useState('');
  const [editGuide2, setEditGuide2] = useState('');

  const handleStartEditingGuides = (busId: string, current1: string, current2: string) => {
    setEditingBusId(busId);
    setEditGuide1(current1);
    setEditGuide2(current2);
  };

  const handleSaveBusGuides = (busId: string) => {
    if (!onSaveSettings || !settings) return;

    const updatedCustomGuides = {
      ...(settings.customBusGuides || {}),
      [busId]: {
        guide1: editGuide1,
        guide2: editGuide2,
      },
    };

    onSaveSettings({
      ...settings,
      customBusGuides: updatedCustomGuides,
    });

    setEditingBusId(null);
  };

  // Import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importStatus, setImportStatus] = useState({ type: '', msg: '' });

  const getStudentDept = (clsName: string) => {
    const parts = clsName.split(' ');
    if (parts.length >= 2) return parts[1];
    return clsName;
  };

  const compareStudentsDefault = (a: Student, b: Student) => {
    const deptA = getStudentDept(a.className);
    const deptB = getStudentDept(b.className);
    const deptCompare = deptA.localeCompare(deptB, undefined, { numeric: true, sensitivity: 'base' });
    if (deptCompare !== 0) return deptCompare;

    const classCompare = a.className.localeCompare(b.className, undefined, { numeric: true, sensitivity: 'base' });
    if (classCompare !== 0) return classCompare;

    return a.nis.localeCompare(b.nis, undefined, { numeric: true, sensitivity: 'base' });
  };

  // Find students who are registered and eligible for assignment
  const unassignedStudents = students.filter(
    (s) => s.isRegistered && !s.busNumber
  );

  // Unified Table Query for buses list
  const {
    search,
    setSearch,
    filters,
    setFilters,
    handleClearFilters,
    pagination,
    processedData: filteredBuses,
    paginatedData,
    totalPages,
    handlePageChange,
  } = useTableQuery<Bus>(buses, {
    searchFields: ['busNumber'],
    initialPageSize: 4,
    filterFn: (bus, activeFilters) => {
      const { wave } = activeFilters;
      if (wave && bus.wave !== wave) return false;
      return true;
    },
    initialSort: { field: 'busNumber', direction: 'asc' },
  });

  const handleAssignStudent = (busNum: number, wave: WaveType) => {
    if (!assigningStudentId) return;
    const student = students.find((s) => s.id === assigningStudentId);
    if (!student) return;

    // Perform check: Is seat already taken in this bus?
    const seatTaken = students.some(
      (s) => s.wave === wave && s.busNumber === busNum && s.seatNumber === assigningSeatNum
    );

    if (seatTaken) {
      alert(`Kursi nomor ${assigningSeatNum} sudah ditempati siswa lain di Bus ${busNum}. Silakan pilih nomor kursi lain.`);
      return;
    }

    onUpdateStudent({
      ...student,
      busNumber: busNum,
      seatNumber: assigningSeatNum,
      wave: wave, // Ensure they are on the correct wave
    });

    // Reset Form
    setAssigningStudentId('');
    setAssigningBusNum(null);
    setAssigningSeatNum(3);
  };

  const handleRemoveStudent = (student: Student) => {
    onUpdateStudent({
      ...student,
      busNumber: undefined,
      seatNumber: undefined,
    });
  };

  const handleExportExcel = () => {
    const exportData = filteredBuses.flatMap((bus) => {
      const busPassengers = students
        .filter((s) => s.busNumber === bus.busNumber && s.wave === bus.wave)
        .sort((a, b) => (a.seatNumber || 0) - (b.seatNumber || 0));

      if (busPassengers.length === 0) {
        return [{
          'No Bus': bus.busNumber,
          Gelombang: bus.wave,
          Kapasitas: bus.capacity,
          Pendamping: `${bus.guide1} & ${bus.guide2}`,
          'No Kursi': '-',
          Penumpang: '(Bus Kosong)',
          Kelas: '-',
          NIS: '-',
        }];
      }

      return busPassengers.map((psg) => ({
        'No Bus': bus.busNumber,
        Gelombang: bus.wave,
        Kapasitas: bus.capacity,
        Pendamping: `${bus.guide1} & ${bus.guide2}`,
        'No Kursi': psg.seatNumber || '-',
        Penumpang: psg.name,
        Kelas: psg.className,
        NIS: psg.nis || '-',
      }));
    });

    import('@/services/excelService').then(({ ExcelService }) => {
      ExcelService.exportToExcel(exportData, 'Data_Manifes_Daftar_Kursi_Bus', 'Manifes Bus');
    });
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus({ type: 'info', msg: 'Membaca file...' });

    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const workbook = XLSX.read(bstr, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { defval: '' });

          if (jsonData.length === 0) {
            setImportStatus({ type: 'error', msg: 'File Excel kosong atau tidak valid.' });
            return;
          }

          let assignedCount = 0;
          const updatedStudents = [...students];

          jsonData.forEach((row: any) => {
            const keys = Object.keys(row);
            const findKeyVal = (searchTerms: string[]) => {
              const matchedKey = keys.find(k => searchTerms.some(term => k.toLowerCase().includes(term)));
              return matchedKey ? String(row[matchedKey]).trim() : '';
            };

            const studentName = findKeyVal(['nama', 'siswa', 'peserta']);
            const busNumberRaw = findKeyVal(['bus', 'no bus', 'nomor bus']);
            const busNumber = parseInt(busNumberRaw) || null;
            const seatNumberRaw = findKeyVal(['kursi', 'no kursi', 'nomor kursi', 'seat']);
            const seatNumber = parseInt(seatNumberRaw) || null;

            if (!studentName || !busNumber || !seatNumber) return;

            // Find matching student
            const studentIdx = updatedStudents.findIndex(
              (s) => s.name.toLowerCase() === studentName.toLowerCase() || (s.nis && s.nis === studentName)
            );

            if (studentIdx !== -1) {
              updatedStudents[studentIdx] = {
                ...updatedStudents[studentIdx],
                busNumber,
                seatNumber,
              };
              assignedCount++;
            }
          });

          if (assignedCount > 0 && onBulkImportStudents) {
            onBulkImportStudents(updatedStudents);
            setImportStatus({
              type: 'success',
              msg: `Berhasil mencocokkan dan menempatkan kursi untuk ${assignedCount} siswa di armada Bus!`
            });
          } else {
            setImportStatus({
              type: 'error',
              msg: 'Gagal mengimpor. Pastikan nama siswa di Excel cocok dengan nama terdaftar di database.'
            });
          }
        } catch (err: any) {
          setImportStatus({ type: 'error', msg: `Gagal membaca Excel: ${err.message}` });
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      setImportStatus({ type: 'error', msg: `Gagal memuat modul excel: ${err.message}` });
    }
  };

  return (
    <div className="space-y-6" id="bus-manager-section">
      {/* Upper Information Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 mb-1">
            <BusIcon className="w-3.5 h-3.5 text-indigo-600" /> Fleet & Seat Allocator
          </div>
          <h2 className="text-lg font-black text-slate-900">Kelola Kursi & Rombongan Bus</h2>
          <p className="text-xs text-slate-500">
            Daftar bus terbit secara otomatis berdasarkan data siswa terdaftar. Anda dapat memantau keterisian kursi, mengimpor manifes Excel, atau mengunduh lembar PDF cetak.
          </p>
        </div>

        {onBulkImportStudents && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setImportStatus({ type: '', msg: '' });
                setIsImportOpen(true);
              }}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              <span>Import Kursi Excel</span>
            </button>
          </div>
        )}
      </div>

      {/* Print only Header */}
      <div className="p-4 border-b border-slate-100 hidden print:block">
        <h3 className="font-extrabold text-lg text-slate-900">MANIFES DAN DAFTAR KURSI ARMADA BUS</h3>
        <p className="text-xs text-slate-600">TOTAL DATA: {filteredBuses.length} BUS</p>
      </div>

      {/* Standardized Search & Filter Bar */}
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari nomor bus armada..."
        activeFilters={filters}
        onFilterChange={setFilters}
        onClearFilters={handleClearFilters}
        onPrint={handlePrint}
        onExportExcel={handleExportExcel}
        filters={[
          {
            key: 'wave',
            label: 'Gelombang Wisata',
            placeholder: 'Semua Gelombang',
            options: [
              { value: 'BALI_GEL_1', label: 'Bali Gelombang 1' },
              { value: 'BALI_GEL_2', label: 'Bali Gelombang 2' },
              { value: 'YOGYA_GEL_1', label: 'Yogyakarta Gelombang 1' },
            ],
          },
        ]}
      />

      {/* Grid of Buses */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6" id="bus-grid-list">
        {paginatedData.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <BusIcon className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">Tidak ada bus yang cocok</p>
            <p className="text-xs text-slate-400">Cobalah menyesuaikan nomor bus pencarian atau filter gelombang Anda.</p>
          </div>
        ) : (
          paginatedData.map((bus) => {
            const busPassengers = students
              .filter((s) => s.busNumber === bus.busNumber && s.wave === bus.wave)
              .sort((a, b) => (a.seatNumber || 0) - (b.seatNumber || 0));

            const isAssigningThisBus = assigningBusNum === bus.busNumber;

            return (
              <motion.div
                key={`${bus.wave}-${bus.busNumber}`}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col"
              >
                {/* Card Header */}
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                      <BusIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                        Bus Nomor {bus.busNumber}
                        <WaveBadge wave={bus.wave} />
                      </h3>
                      {editingBusId === bus.id ? (
                        <div className="flex flex-col gap-1 mt-1.5 max-w-xs">
                          <input
                            type="text"
                            value={editGuide1}
                            onChange={(e) => setEditGuide1(e.target.value)}
                            placeholder="Nama Pendamping 1..."
                            className="text-[11px] font-bold px-2 py-0.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 w-full"
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editGuide2}
                              onChange={(e) => setEditGuide2(e.target.value)}
                              placeholder="Nama Pendamping 2..."
                              className="text-[11px] font-bold px-2 py-0.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 w-full"
                            />
                            <button
                              onClick={() => handleSaveBusGuides(bus.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white p-1 rounded-lg shrink-0 cursor-pointer"
                              title="Simpan"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setEditingBusId(null)}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-600 px-1.5 py-1 rounded-lg shrink-0 text-[10px] font-bold cursor-pointer"
                              title="Batal"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                          <span>Pendamping: {bus.guide1} & {bus.guide2}</span>
                          <button
                            onClick={() => handleStartEditingGuides(bus.id, bus.guide1, bus.guide2)}
                            className="p-1 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                            title="Edit Guru Pendamping"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-black text-slate-900">
                      {busPassengers.length} / {bus.capacity}
                    </span>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Siswa Terisi</p>
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  
                  {/* Quick Passenger Table */}
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Daftar Kursi Penumpang</p>
                    
                    {busPassengers.length === 0 ? (
                      <div className="py-6 text-center text-slate-400 text-xs italic">
                        Bus ini masih kosong. Klik Tambah Siswa di bawah untuk mengalokasikan kursi.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {busPassengers.map((psg) => (
                          <div
                            key={psg.id}
                            className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-black flex items-center justify-center shrink-0" title="Nomor Kursi">
                                #{psg.seatNumber || '-'}
                              </span>
                              <div className="truncate text-left">
                                <p className="font-extrabold text-slate-800 text-[11px] truncate leading-tight">
                                  {psg.name}
                                </p>
                                <p className="text-[9px] text-slate-400 font-bold leading-none">
                                  {psg.className}
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => handleRemoveStudent(psg)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors shrink-0 cursor-pointer no-print"
                              title="Hapus Penempatan Kursi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Manual Assignment Form */}
                  <div className="border-t border-slate-100 pt-4 mt-auto no-print">
                    {isAssigningThisBus ? (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                        <p className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                          Alokasikan Kursi Baru di Bus {bus.busNumber}
                        </p>
                        
                        <div className="space-y-2">
                          <div>
                            <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Pilih Siswa (Belum Ada Bus):</label>
                            <select
                              value={assigningStudentId}
                              onChange={(e) => setAssigningStudentId(e.target.value)}
                              className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                            >
                              <option value="">-- Pilih Siswa ({unassignedStudents.length}) --</option>
                              {unassignedStudents
                                .filter((s) => s.wave === bus.wave)
                                .sort(compareStudentsDefault)
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name} ({s.className})
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <label className="block text-[10px] text-slate-500 font-bold mb-0.5">No. Kursi:</label>
                              <input
                                type="number"
                                min={3}
                                max={bus.capacity}
                                value={assigningSeatNum}
                                onChange={(e) => setAssigningSeatNum(parseInt(e.target.value) || 3)}
                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                              />
                            </div>
                            
                            <div className="flex items-end gap-1 pt-4">
                              <button
                                onClick={() => handleAssignStudent(bus.busNumber, bus.wave)}
                                disabled={!assigningStudentId}
                                className="px-3 py-2 bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-300 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" /> Simpan
                              </button>
                              <button
                                onClick={() => setAssigningBusNum(null)}
                                className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setAssigningBusNum(bus.busNumber);
                          setAssigningStudentId('');
                          // Set seat number automatically to next free seat
                          const occupiedSeats = busPassengers.map((s) => s.seatNumber || 0);
                          let nextFree = 3;
                          while (occupiedSeats.includes(nextFree) && nextFree <= bus.capacity) {
                            nextFree++;
                          }
                          setAssigningSeatNum(nextFree);
                        }}
                        className="w-full py-2 border border-dashed border-slate-300 hover:border-indigo-400 text-slate-600 hover:text-indigo-600 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah Siswa ke Bus Ini
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="pt-2">
          <PaginationControls
            currentPage={pagination.currentPage}
            totalPages={totalPages}
            totalItems={filteredBuses.length}
            pageSize={pagination.pageSize}
            onPageChange={handlePageChange}
            itemName="bus"
          />
        </div>
      )}

      {/* Modal Import Excel */}
      <Modal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title="Import Alokasi Kursi Bus"
        subtitle="Unduh/unggah spreadsheet penempatan nomor bus dan kursi siswa secara cepat"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 space-y-1">
              <p className="font-extrabold">Petunjuk Kolom Import:</p>
              <p className="font-medium leading-relaxed font-sans">
                Spreadsheet Anda wajib memiliki kolom header berupa:
                <strong> Nama Siswa </strong> (atau NIS), 
                <strong> No Bus </strong> (atau Bus), dan 
                <strong> No Kursi </strong> (atau Kursi).
                <br />
                Sistem akan memproses kecocokan identitas siswa dan memperbarui data penempatan kursi bus mereka secara real-time.
              </p>
            </div>
          </div>

          <div className="border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-2xl p-6 transition-colors relative flex flex-col items-center justify-center text-center cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls,.ods"
              onChange={handleImportExcel}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-xs font-extrabold text-slate-800">Seret file Excel penempatan kursi di sini</p>
            <p className="text-[10px] text-slate-400 mt-1">XLSX, XLS, ODS up to 10MB</p>
          </div>

          {importStatus.type && (
            <div className={`p-3.5 rounded-xl text-xs font-bold border ${
              importStatus.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' :
              importStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
              'bg-blue-50 text-blue-800 border-blue-200'
            }`}>
              {importStatus.msg}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              onClick={() => setIsImportOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
