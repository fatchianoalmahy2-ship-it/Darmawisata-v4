'use client';

import React, { useState } from 'react';
import { Room, Student, WaveType, GenderType } from '@/types';
import { motion } from 'motion/react';
import { WaveBadge, GenderBadge } from '@/components/ui/Badge';
import { 
  BedDouble, 
  User, 
  Trash2, 
  Plus, 
  Check,
  FileSpreadsheet,
  Upload,
  AlertCircle
} from 'lucide-react';
import { useTableQuery } from '@/hooks/useTableQuery';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { Modal } from '@/components/ui/Modal';

interface RoomManagerProps {
  rooms: Room[];
  students: Student[];
  onUpdateStudent: (student: Student) => void;
  onBulkImportStudents?: (importedStudents: Student[]) => void;
}

export const RoomManager: React.FC<RoomManagerProps> = ({
  rooms,
  students,
  onUpdateStudent,
  onBulkImportStudents,
}) => {
  const [assigningStudentId, setAssigningStudentId] = useState('');
  const [assigningRoomNum, setAssigningRoomNum] = useState<number | null>(null);

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
    (s) => s.isRegistered && !s.roomNumber
  );

  // Unified Table Query for rooms list
  const {
    search,
    setSearch,
    filters,
    setFilters,
    handleClearFilters,
    pagination,
    processedData: filteredRooms,
    paginatedData,
    totalPages,
    handlePageChange,
  } = useTableQuery<Room>(rooms, {
    searchFields: ['roomNumber'],
    initialPageSize: 6,
    filterFn: (room, activeFilters) => {
      const { wave, gender } = activeFilters;
      if (wave && room.wave !== wave) return false;
      if (gender && room.gender !== gender) return false;
      return true;
    },
    initialSort: { field: 'roomNumber', direction: 'asc' },
  });

  const handleAssignStudent = (roomNum: number, wave: WaveType, gender: GenderType, capacity: number) => {
    if (!assigningStudentId) return;
    const student = students.find((s) => s.id === assigningStudentId);
    if (!student) return;

    // Check 1: Is the room already full?
    const currentOccupants = students.filter(
      (s) => s.roomNumber === roomNum && s.wave === wave
    );
    if (currentOccupants.length >= capacity) {
      alert(`Kamar nomor ${roomNum} sudah penuh (Kapasitas maks: ${capacity} siswa).`);
      return;
    }

    // Check 2: Gender restriction (Kamar must match student's gender)
    if (student.gender !== gender) {
      alert(`Gender tidak cocok. Kamar ${roomNum} dikhususkan untuk siswa ${gender}, sedangkan ${student.name} berjenis kelamin ${student.gender}.`);
      return;
    }

    onUpdateStudent({
      ...student,
      roomNumber: roomNum,
      wave: wave, // Sync wave
    });

    // Reset Form
    setAssigningStudentId('');
    setAssigningRoomNum(null);
  };

  const handleRemoveStudent = (student: Student) => {
    onUpdateStudent({
      ...student,
      roomNumber: undefined,
    });
  };

  const handleExportExcel = () => {
    const exportData = filteredRooms.flatMap((room) => {
      const roomOccupants = students.filter(
        (s) => s.roomNumber === room.roomNumber && s.wave === room.wave
      );

      if (roomOccupants.length === 0) {
        return [{
          'No Kamar': room.roomNumber,
          Gelombang: room.wave,
          Gender: room.gender,
          Kapasitas: room.capacity,
          'Siswa Penghuni': '(Kamar Kosong)',
          Kelas: '-',
          NIS: '-',
        }];
      }

      return roomOccupants.map((occ) => ({
        'No Kamar': room.roomNumber,
        Gelombang: room.wave,
        Gender: room.gender,
        Kapasitas: room.capacity,
        'Siswa Penghuni': occ.name,
        Kelas: occ.className,
        NIS: occ.nis || '-',
      }));
    });

    import('@/services/excelService').then(({ ExcelService }) => {
      ExcelService.exportToExcel(exportData, 'Data_Penempatan_Kamar_Hotel', 'Kamar Hotel');
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
            const roomNumberRaw = findKeyVal(['kamar', 'nomor kamar', 'no kamar', 'room']);
            const roomNumber = parseInt(roomNumberRaw) || null;

            if (!studentName || !roomNumber) return;

            // Find matching student
            const studentIdx = updatedStudents.findIndex(
              (s) => s.name.toLowerCase() === studentName.toLowerCase() || (s.nis && s.nis === studentName)
            );

            if (studentIdx !== -1) {
              updatedStudents[studentIdx] = {
                ...updatedStudents[studentIdx],
                roomNumber,
              };
              assignedCount++;
            }
          });

          if (assignedCount > 0 && onBulkImportStudents) {
            onBulkImportStudents(updatedStudents);
            setImportStatus({
              type: 'success',
              msg: `Berhasil mencocokkan dan menempatkan ${assignedCount} siswa ke dalam Kamar!`
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
    <div className="space-y-6" id="room-manager-section">
      {/* Upper Control Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 mb-1">
            <BedDouble className="w-3.5 h-3.5 text-teal-600" /> Hotel Rooming Coordinator
          </div>
          <h2 className="text-lg font-black text-slate-900">Kelola Kamar Hotel & Penempatan Siswa</h2>
          <p className="text-xs text-slate-500">
            Daftar kamar diurutkan berdasarkan pembagian gelombang dan jenis kelamin. Anda dapat mengimpor Excel, mengekspor chart penempatan, atau mengatur penghuni secara manual.
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
              <FileSpreadsheet className="w-4 h-4 text-teal-600" />
              <span>Import Penempatan Kamar</span>
            </button>
          </div>
        )}
      </div>

      {/* Print only Header */}
      <div className="p-4 border-b border-slate-100 hidden print:block">
        <h3 className="font-extrabold text-lg text-slate-900">REKAP ALOKASI KAMAR HOTEL</h3>
        <p className="text-xs text-slate-600">TOTAL DATA: {filteredRooms.length} KAMAR</p>
      </div>

      {/* Standardized Search & Filter Bar */}
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari nomor kamar hotel..."
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
          {
            key: 'gender',
            label: 'Dikhususkan Gender',
            placeholder: 'Semua L/P',
            options: [
              { value: 'LAKI-LAKI', label: 'Laki-Laki' },
              { value: 'PEREMPUAN', label: 'Perempuan' },
            ],
          },
        ]}
      />

      {/* Grid of Rooms */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" id="room-grid-list">
        {paginatedData.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <BedDouble className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">Tidak ada kamar yang cocok</p>
            <p className="text-xs text-slate-400">Cobalah menyesuaikan nomor kamar pencarian atau filter kustom Anda.</p>
          </div>
        ) : (
          paginatedData.map((room) => {
            const roomOccupants = students
              .filter((s) => s.roomNumber === room.roomNumber && s.wave === room.wave)
              .sort(compareStudentsDefault);

            const isAssigningThisRoom = assigningRoomNum === room.roomNumber;

            return (
              <motion.div
                key={`${room.wave}-${room.roomNumber}`}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col justify-between"
              >
                {/* Header */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-teal-50 border border-teal-100 rounded-lg flex items-center justify-center text-teal-600 shrink-0">
                      <BedDouble className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm">
                        Kamar {room.roomNumber}
                      </h3>
                      <div className="flex gap-1 mt-0.5">
                        <WaveBadge wave={room.wave} />
                        <GenderBadge gender={room.gender} />
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-black text-slate-900">
                      {roomOccupants.length} / {room.capacity}
                    </span>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Terisi</p>
                  </div>
                </div>

                {/* Occupants Area */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Penghuni Kamar</p>
                    {roomOccupants.length === 0 ? (
                      <div className="py-4 text-center text-slate-400 text-[11px] italic">
                        Kamar kosong
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {roomOccupants.map((occ) => (
                          <div
                            key={occ.id}
                            className="p-2 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors flex items-center justify-between gap-2"
                          >
                            <div className="truncate text-left flex items-center gap-1.5">
                              <User className="w-3 h-3 text-slate-400 shrink-0" />
                              <div className="truncate">
                                <p className="font-bold text-slate-800 text-[11px] truncate leading-tight">
                                  {occ.name}
                                </p>
                                <p className="text-[9px] text-slate-400 font-bold leading-none">
                                  {occ.className}
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => handleRemoveStudent(occ)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors shrink-0 cursor-pointer no-print"
                              title="Keluarkan dari Kamar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Manual Assignment Form */}
                  <div className="border-t border-slate-100 pt-3 mt-auto no-print">
                    {isAssigningThisRoom ? (
                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div>
                          <label className="block text-[9px] text-slate-500 font-bold mb-0.5">Masukkan Siswa ({room.gender}):</label>
                          <select
                            value={assigningStudentId}
                            onChange={(e) => setAssigningStudentId(e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                          >
                            <option value="">-- Pilih Siswa --</option>
                            {unassignedStudents
                              .filter((s) => s.wave === room.wave && s.gender === room.gender)
                              .sort(compareStudentsDefault)
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({s.className})
                                </option>
                              ))}
                          </select>
                        </div>

                        <div className="flex items-center justify-end gap-1 pt-1">
                          <button
                            onClick={() => handleAssignStudent(room.roomNumber, room.wave, room.gender, room.capacity)}
                            disabled={!assigningStudentId}
                            className="px-2.5 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-300 font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3 h-3" /> Simpan
                          </button>
                          <button
                            onClick={() => setAssigningRoomNum(null)}
                            className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-[10px] transition-colors cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setAssigningRoomNum(room.roomNumber);
                          setAssigningStudentId('');
                        }}
                        className="w-full py-1.5 border border-dashed border-slate-300 hover:border-teal-400 text-slate-600 hover:text-teal-600 font-bold rounded-xl text-[10px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah Penghuni Kamar
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
            totalItems={filteredRooms.length}
            pageSize={pagination.pageSize}
            onPageChange={handlePageChange}
            itemName="kamar"
          />
        </div>
      )}

      {/* Modal Import Excel */}
      <Modal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title="Import Penempatan Kamar Hotel"
        subtitle="Unduh/unggah spreadsheet penempatan kamar siswa untuk otomatisasi input"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 space-y-1">
              <p className="font-extrabold">Ketentuan Import Kamar:</p>
              <p className="font-medium leading-relaxed font-sans">
                Spreadsheet harus memiliki kolom header baris pertama berupa:
                <strong> Nama Siswa </strong> (atau NIS) dan 
                <strong> No Kamar </strong> (atau Kamar).
                <br />
                Sistem akan mencari nama siswa tersebut dalam database lalu memutakhirkan penempatan nomor kamar hotel mereka secara massal.
              </p>
            </div>
          </div>

          <div className="border-2 border-dashed border-slate-200 hover:border-teal-500 rounded-2xl p-6 transition-colors relative flex flex-col items-center justify-center text-center cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls,.ods"
              onChange={handleImportExcel}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="p-3 bg-teal-50 rounded-2xl text-teal-600 mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-xs font-extrabold text-slate-800">Seret file Excel penempatan kamar Anda</p>
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
