'use client';

import React, { useState } from 'react';
import { SchoolClass, Student } from '@/types';
import { motion, AnimatePresence } from 'motion/react';
import { Modal } from '@/components/ui/Modal';
import { normalizeClassName } from '@/lib/utils';
import { useTableQuery } from '@/hooks/useTableQuery';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { 
  FolderPlus, 
  Edit3, 
  Trash2, 
  Users, 
  Phone, 
  User, 
  Award,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
  AlertCircle
} from 'lucide-react';

interface ClassManagerProps {
  classes: SchoolClass[];
  students: Student[];
  onAddClass: (newClass: SchoolClass) => void;
  onUpdateClass: (updatedClass: SchoolClass) => void;
  onDeleteClass: (classId: string) => void;
}

export const ClassManager: React.FC<ClassManagerProps> = ({
  classes,
  students,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [deletingClass, setDeletingClass] = useState<SchoolClass | null>(null);

  // Import State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importStatus, setImportStatus] = useState({ type: '', msg: '' });

  // Form State
  const [formName, setFormName] = useState('');
  const [formDepartment, setFormDepartment] = useState('Teknik Otomotif');
  const [formTeacher, setFormTeacher] = useState('');
  const [formPhone, setFormPhone] = useState('');

  // Extract department options for filtering
  const departmentList = Array.from(new Set(classes.map((c) => c.department))).filter(Boolean);

  // Unified Query Hook
  const {
    search,
    setSearch,
    filters,
    setFilters,
    handleClearFilters,
    pagination,
    processedData: filteredClasses,
    paginatedData,
    totalPages,
    handlePageChange,
  } = useTableQuery<SchoolClass>(classes, {
    searchFields: ['name', 'homeroomTeacher', 'department'],
    initialPageSize: 6,
    filterFn: (item, activeFilters) => {
      const deptVal = activeFilters.department;
      if (deptVal && item.department !== deptVal) return false;
      return true;
    },
    initialSort: { field: 'name', direction: 'asc' },
  });

  const handleOpenAdd = () => {
    setEditingClass(null);
    setFormName('');
    setFormDepartment('Teknik Otomotif');
    setFormTeacher('');
    setFormPhone('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cls: SchoolClass) => {
    setEditingClass(cls);
    setFormName(cls.name);
    setFormDepartment(cls.department);
    setFormTeacher(cls.homeroomTeacher);
    setFormPhone(cls.teacherPhone || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formTeacher) return;

    const normalizedName = normalizeClassName(formName);

    if (editingClass) {
      const updated: SchoolClass = {
        ...editingClass,
        name: normalizedName,
        department: formDepartment,
        homeroomTeacher: formTeacher,
        teacherPhone: formPhone,
      };
      onUpdateClass(updated);
    } else {
      const newCls: SchoolClass = {
        id: `class-${Date.now()}`,
        name: normalizedName,
        department: formDepartment,
        homeroomTeacher: formTeacher,
        teacherPhone: formPhone,
        totalStudents: 0,
      };
      onAddClass(newCls);
    }
    setIsModalOpen(false);
  };

  const handleExportExcel = () => {
    const exportData = filteredClasses.map((c, idx) => {
      const classStudents = students.filter((s) => s.className === c.name);
      const registeredCount = classStudents.filter((s) => s.isRegistered).length;
      return {
        No: idx + 1,
        Kelas: c.name,
        Kejuruan: c.department,
        'Wali Kelas': c.homeroomTeacher,
        'No Kontak': c.teacherPhone || '',
        'Total Siswa Terdaftar': registeredCount,
        'Total Siswa Kelas': classStudents.length,
      };
    });
    import('@/services/excelService').then(({ ExcelService }) => {
      ExcelService.exportToExcel(exportData, 'Data_Rombongan_Belajar', 'Rombel');
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

          let addedCount = 0;
          jsonData.forEach((row: any, idx: number) => {
            const keys = Object.keys(row);
            const findKeyVal = (searchTerms: string[]) => {
              const matchedKey = keys.find(k => searchTerms.some(term => k.toLowerCase().includes(term)));
              return matchedKey ? String(row[matchedKey]).trim() : '';
            };

            const className = normalizeClassName(findKeyVal(['kelas', 'rombel', 'nama kelas']));
            if (!className) return;

            // Check if class already exists to avoid duplication
            const existing = classes.find(c => normalizeClassName(c.name) === normalizeClassName(className));
            if (existing) return;

            const department = findKeyVal(['kejuruan', 'departemen', 'kompetensi', 'jurusan']) || 'Teknik Otomotif';
            const teacher = findKeyVal(['wali kelas', 'guru', 'nama wali']) || 'Belum Diisi';
            const phone = findKeyVal(['no hp', 'no wa', 'telepon', 'kontak', 'hp', 'phone']);

            const newCls: SchoolClass = {
              id: `class-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
              name: className,
              department,
              homeroomTeacher: teacher,
              teacherPhone: phone || undefined,
              totalStudents: 0,
            };
            onAddClass(newCls);
            addedCount++;
          });

          if (addedCount === 0) {
            setImportStatus({
              type: 'success',
              msg: 'Proses selesai. Tidak ada Rombel Kelas baru yang ditambahkan (semua kelas sudah ada).'
            });
          } else {
            setImportStatus({
              type: 'success',
              msg: `Berhasil mengimpor ${addedCount} Rombel Kelas baru!`
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
    <div className="space-y-6" id="class-manager-section">
      {/* Upper Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 mb-1">
            <Award className="w-3.5 h-3.5" /> Management Wali Kelas & Rombel
          </div>
          <h2 className="text-lg font-black text-slate-900">Kelola Data Rombongan Belajar (Rombel)</h2>
          <p className="text-xs text-slate-500">
            Atur nama kelas, departemen kejuruan, dan wali kelas pendamping yang bertanggung jawab atas proses verifikasi angket siswa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setImportStatus({ type: '', msg: '' });
              setIsImportOpen(true);
            }}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <FolderPlus className="w-4 h-4 text-amber-400" /> Tambah Rombel Baru
          </button>
        </div>
      </div>

      {/* Print only Header */}
      <div className="p-4 border-b border-slate-100 hidden print:block">
        <h3 className="font-extrabold text-lg text-slate-900">REKAP DATA ROMBONGAN BELAJAR (ROMBEL)</h3>
        <p className="text-xs text-slate-600">TOTAL ROMBEL: {filteredClasses.length} KELAS</p>
      </div>

      {/* Search Bar & Filter */}
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari kelas, wali kelas, atau kejuruan..."
        activeFilters={filters}
        onFilterChange={setFilters}
        onClearFilters={handleClearFilters}
        onPrint={handlePrint}
        onExportExcel={handleExportExcel}
        filters={[
          {
            key: 'department',
            label: 'Kompetensi Keahlian',
            placeholder: 'Semua Keahlian',
            options: departmentList.map((d) => ({ value: d, label: d })),
          },
        ]}
      />

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="class-grid-list">
        {paginatedData.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">Tidak ada rombel ditemukan</p>
            <p className="text-xs text-slate-400">Silakan tambahkan rombel baru atau sesuaikan pencarian Anda.</p>
          </div>
        ) : (
          paginatedData.map((cls) => {
            const classStudents = students.filter((s) => s.className === cls.name);
            const actualCount = classStudents.length;
            const registeredCount = classStudents.filter((s) => s.isRegistered).length;
            
            return (
              <motion.div
                key={cls.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between shadow-xs hover:border-slate-300 transition-all group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900 text-lg tracking-tight">
                      {cls.name}
                    </span>
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {cls.department}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Wali Kelas</p>
                        <p className="font-extrabold text-slate-800">{cls.homeroomTeacher}</p>
                      </div>
                    </div>

                    {cls.teacherPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">No. Kontak WA</p>
                          <p className="font-bold text-slate-700">{cls.teacherPhone}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-slate-500 font-bold text-xs">
                    <Users className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      {registeredCount} / {actualCount} Siswa Terdaftar
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity no-print">
                    <button
                      onClick={() => handleOpenEdit(cls)}
                      className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit Kelas"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingClass(cls)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Hapus Kelas"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
            totalItems={filteredClasses.length}
            pageSize={pagination.pageSize}
            onPageChange={handlePageChange}
            itemName="kelas"
          />
        </div>
      )}

      {/* Modal Add/Edit Class */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingClass ? 'Edit Rombel Kelas' : 'Tambah Rombel Baru'}
        subtitle="Kelola data kelas dan penanggung jawab wali kelas pendamping"
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Rombel / Kelas *
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: XII TAB 1, XII TKR A"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Kejuruan / Departemen</label>
            <select
              value={formDepartment}
              onChange={(e) => setFormDepartment(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Teknik Otomotif">Teknik Otomotif</option>
              <option value="Tata Busana">Tata Busana</option>
              <option value="Teknik Pemesinan">Teknik Pemesinan</option>
              <option value="Teknik Komputer & Jaringan">Teknik Komputer & Jaringan</option>
              <option value="Teknik Elektronika">Teknik Elektronika</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Lengkap Guru Wali Kelas *
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Siti Aminah, S.Pd."
              value={formTeacher}
              onChange={(e) => setFormTeacher(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              No. HP / WA Wali Kelas
            </label>
            <input
              type="text"
              placeholder="0812xxxxxxxx"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer animate-none"
            >
              <CheckCircle2 className="w-4 h-4" /> Simpan Rombel
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Import Excel */}
      <Modal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title="Import Rombel dari Excel"
        subtitle="Unduh/unggah format Excel data rombel untuk mengisi otomatis data kelas"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 space-y-1">
              <p className="font-extrabold">Ketentuan Format Kolom Excel:</p>
              <p className="font-medium leading-relaxed">
                Pastikan file spreadsheet Anda memiliki header baris pertama dengan kolom:
                <strong> Kelas </strong>, 
                <strong> Wali Kelas / Guru </strong>, 
                <strong> Kejuruan / Departemen </strong> (opsional), 
                <strong> No HP </strong> (opsional).
              </p>
            </div>
          </div>

          <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-6 transition-colors relative flex flex-col items-center justify-center text-center cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls,.ods"
              onChange={handleImportExcel}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 mb-3">
              <Upload className="w-6 h-6 animate-pulse" />
            </div>
            <p className="text-xs font-extrabold text-slate-800">Pilih atau Seret File Excel</p>
            <p className="text-[10px] text-slate-400 mt-1">Format yang didukung: XLSX, XLS, ODS up to 10MB</p>
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

      {/* Delete Confirmation Modal */}
      {deletingClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-800">Hapus Rombel Kelas</h3>
                <p className="text-xs text-slate-500 font-medium">Konfirmasi Penghapusan Kelas</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">
              Apakah Anda yakin ingin menghapus Rombel Kelas <strong className="text-slate-900 font-black">{deletingClass.name}</strong>? Menghapus kelas tidak akan menghapus data siswa yang terdaftar.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingClass(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteClass(deletingClass.id);
                  setDeletingClass(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Kelas</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
