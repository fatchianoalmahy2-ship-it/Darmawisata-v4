import { Student, Bus, WaveType, SchoolClass } from '@/types';

export class SeatAllocatorEngine {
  /**
   * Auto allocates bus seats for students in a specific wave.
   */
  public static autoAllocateBuses(
    students: Student[],
    busCapacity: number = 50,
    classes?: SchoolClass[],
    customBusGuides?: { [busId: string]: { guide1: string; guide2: string } }
  ): { updatedStudents: Student[]; buses: Bus[] } {
    const updated = [...students];
    const buses: Bus[] = [];

    const waves: WaveType[] = ['BALI_GEL_1', 'BALI_GEL_2', 'YOGYA_GEL_1'];

    waves.forEach((wave) => {
      const waveStudents = updated.filter((s) => s.isRegistered && s.wave === wave);
      if (waveStudents.length === 0) return;

      // Group students by class
      const classMap = new Map<string, Student[]>();
      waveStudents.forEach((st) => {
        const list = classMap.get(st.className) || [];
        list.push(st);
        classMap.set(st.className, list);
      });

      let currentBusNum = 1;
      let currentSeatNum = 3; // Seats 1 and 2 usually reserved for Tour Guides / Teachers
      let currentBusAssignedIds: string[] = [];

      classMap.forEach((classStudents) => {
        classStudents.forEach((student) => {
          if (currentSeatNum > busCapacity) {
            const busId = `bus-${wave}-${currentBusNum}`;
            let guide1 = 'Belum Ditentukan';
            let guide2 = 'Belum Ditentukan';

            if (customBusGuides && customBusGuides[busId]) {
              guide1 = customBusGuides[busId].guide1;
              guide2 = customBusGuides[busId].guide2;
            } else if (classes && classes.length > 0) {
              const classNamesInBus = Array.from(new Set(
                currentBusAssignedIds.map(id => updated.find(s => s.id === id)?.className).filter(Boolean)
              ));
              const teachers: string[] = [];
              classNamesInBus.forEach((cName) => {
                const cls = classes.find((c) => c.name === cName);
                if (cls && cls.homeroomTeacher) {
                  teachers.push(`${cls.homeroomTeacher} (${cls.name})`);
                }
              });

              if (teachers.length > 0) guide1 = teachers[0];
              if (teachers.length > 1) guide2 = teachers[1];
              else if (teachers.length === 1) guide2 = 'Pendamping Umum';
            }

            // Push current bus
            buses.push({
              id: busId,
              busNumber: currentBusNum,
              wave,
              capacity: busCapacity,
              guide1,
              guide2,
              assignedStudentIds: currentBusAssignedIds,
            });

            currentBusNum++;
            currentSeatNum = 3;
            currentBusAssignedIds = [];
          }

          student.busNumber = currentBusNum;
          student.seatNumber = currentSeatNum;
          currentBusAssignedIds.push(student.id);
          currentSeatNum++;
        });
      });

      if (currentBusAssignedIds.length > 0) {
        const busId = `bus-${wave}-${currentBusNum}`;
        let guide1 = 'Belum Ditentukan';
        let guide2 = 'Belum Ditentukan';

        if (customBusGuides && customBusGuides[busId]) {
          guide1 = customBusGuides[busId].guide1;
          guide2 = customBusGuides[busId].guide2;
        } else if (classes && classes.length > 0) {
          const classNamesInBus = Array.from(new Set(
            currentBusAssignedIds.map(id => updated.find(s => s.id === id)?.className).filter(Boolean)
          ));
          const teachers: string[] = [];
          classNamesInBus.forEach((cName) => {
            const cls = classes.find((c) => c.name === cName);
            if (cls && cls.homeroomTeacher) {
              teachers.push(`${cls.homeroomTeacher} (${cls.name})`);
            }
          });

          if (teachers.length > 0) guide1 = teachers[0];
          if (teachers.length > 1) guide2 = teachers[1];
          else if (teachers.length === 1) guide2 = 'Pendamping Umum';
        }

        buses.push({
          id: busId,
          busNumber: currentBusNum,
          wave,
          capacity: busCapacity,
          guide1,
          guide2,
          assignedStudentIds: currentBusAssignedIds,
        });
      }
    });

    return { updatedStudents: updated, buses };
  }

  /**
   * Returns list of buses derived from students' bus numbers.
   */
  public static deriveBusesFromStudents(
    students: Student[], 
    busCapacity: number = 50,
    classes?: SchoolClass[],
    customBusGuides?: { [busId: string]: { guide1: string; guide2: string } }
  ): Bus[] {
    const busMap = new Map<number, Bus>();

    students.forEach((s) => {
      if (!s.busNumber || !s.wave) return;
      const bNum = s.busNumber;
      if (!busMap.has(bNum)) {
        const busId = `bus-${bNum}`;
        let guide1 = 'Belum Ditentukan';
        let guide2 = 'Belum Ditentukan';

        if (customBusGuides && customBusGuides[busId]) {
          guide1 = customBusGuides[busId].guide1;
          guide2 = customBusGuides[busId].guide2;
        }

        busMap.set(bNum, {
          id: busId,
          busNumber: bNum,
          wave: s.wave,
          capacity: busCapacity,
          guide1,
          guide2,
          assignedStudentIds: [],
        });
      }
      busMap.get(bNum)!.assignedStudentIds.push(s.id);
    });

    const busesList = Array.from(busMap.values()).sort((a, b) => a.busNumber - b.busNumber);

    // Dynamic guide/homeroom teacher integration fallback
    busesList.forEach((bus) => {
      if (customBusGuides && customBusGuides[bus.id]) {
        bus.guide1 = customBusGuides[bus.id].guide1;
        bus.guide2 = customBusGuides[bus.id].guide2;
        return;
      }

      if (classes && classes.length > 0) {
        const busStudents = students.filter((s) => s.busNumber === bus.busNumber && s.wave === bus.wave);
        const classNamesInBus = Array.from(new Set(busStudents.map((s) => s.className).filter(Boolean)));
        
        const teachers: string[] = [];
        classNamesInBus.forEach((cName) => {
          const cls = classes.find((c) => c.name === cName);
          if (cls && cls.homeroomTeacher) {
            teachers.push(`${cls.homeroomTeacher} (${cls.name})`);
          }
        });

        if (teachers.length > 0) {
          bus.guide1 = teachers[0];
        } else {
          bus.guide1 = 'Belum Ditentukan';
        }
        if (teachers.length > 1) {
          bus.guide2 = teachers[1];
        } else if (teachers.length === 1) {
          bus.guide2 = 'Pendamping Umum';
        } else {
          bus.guide2 = 'Belum Ditentukan';
        }
      }
    });

    return busesList;
  }
}
