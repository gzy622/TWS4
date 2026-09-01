(function() {
    window.TWS3 = window.TWS3 || {};

    const {
        INITIAL_STUDENTS,
        INITIAL_TASKS,
        INITIAL_RECORDS,
        INITIAL_CLASS_NAME,
        INITIAL_CLASS_2_NAME,
        INITIAL_STUDENTS_CLASS_2,
        INITIAL_TASKS_CLASS_2,
        INITIAL_RECORDS_CLASS_2,
        INITIAL_SCHEDULE,
        INITIAL_SCHEDULE_LIBRARY,
        DEFAULT_PERIOD_TIMES,
        INITIAL_SCHEDULE_TEMPLATE_VERSION,
        LEGACY_SCHEDULE_TEMPLATE,
        INITIAL_OFFICERS,
        INITIAL_DUTY
    } = window.TWS3.initialData;
    const STORAGE_KEY = 'tws4_grid_seat_store_v1';
    const STORAGE_PENDING_KEY = `${STORAGE_KEY}_pending`;
    const RECOVERY_DB_NAME = 'tws4_recovery';
    const RECOVERY_STORE_NAME = 'snapshots';
    const OLD_STORAGE_KEYS = [];

    function getUtcNowIso() {
        return new Date().toISOString();
    }

    function generateId(prefix = 'id') {
        return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
    }

    const EMPTY_TIME = '1970-01-01T00:00:00.000Z';
    const SUBJECT_OPTIONS = ['未设置', '语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理', '其他'];

    function inferSubjectFromName(name) {
        const text = String(name || '').trim();
        if (/语文|默写|文言文|古诗|作文/.test(text)) return '语文';
        if (/数学|几何|代数|函数|算术/.test(text)) return '数学';
        if (/英语|单词|听力|改错|完形|阅读|背诵/.test(text)) return '英语';
        if (/物理|力学|电学|光学/.test(text)) return '物理';
        if (/化学/.test(text)) return '化学';
        if (/生物/.test(text)) return '生物';
        if (/政治|道法|道德与法治/.test(text)) return '政治';
        if (/历史/.test(text)) return '历史';
        if (/地理/.test(text)) return '地理';
        return '未设置';
    }

    function normalizeTaskName(name) {
        return String(name || '').normalize('NFKC').replace(/\s+/g, '').trim().toLowerCase();
    }
    function normalizeRecord(record) {
        const source = record || {};
        return {
            status: source.status || 'white',
            badge: source.badge || null,
            score: source.score === undefined ? null : source.score,
            note: source.note || null
        };
    }

    function isBlankRecord(record) {
        const value = normalizeRecord(record);
        return value.status === 'white' && !value.badge && value.score === null && !value.note;
    }

    function recordsEqual(left, right) {
        const a = normalizeRecord(left);
        const b = normalizeRecord(right);
        return a.status === b.status && a.badge === b.badge && a.score === b.score && a.note === b.note;
    }

    function recordDisplay(record) {
        const value = normalizeRecord(record);
        const labels = [];
        if (value.status === 'dark') labels.push('已交');
        else if (value.status === 'muted') labels.push('灰色状态');
        else labels.push('未交');
        if (value.score !== null && value.score !== undefined && value.score !== '') labels.push(`${value.score}分`);
        if (value.badge && String(value.badge).trim() && String(value.badge) !== `${value.score}分` && String(value.badge) !== `${value.score}`) labels.push(String(value.badge));
        if (value.note && String(value.note).trim() && value.note !== value.badge) labels.push(String(value.note));
        return labels.join('，');
    }

    function sideValue(value, exists, rawValue, updatedAt) {
        const semantic = typeof value === 'object' && value !== null ? JSON.parse(JSON.stringify(value)) : value;
        return {
            value: semantic,
            display: typeof semantic === 'object' ? recordDisplay(semantic) : (semantic === null || semantic === undefined || semantic === '' ? '' : String(semantic)),
            rawValue: rawValue === undefined ? null : rawValue,
            exists: !!exists,
            updatedAt: updatedAt || null
        };
    }

    function getEntityTime(entity, deleted = false) {
        if (!entity) return EMPTY_TIME;
        return entity[deleted ? 'deletedAt' : 'updatedAt'] || entity.updatedAt || entity.createdAt || EMPTY_TIME;
    }

    function deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(obj);
            } catch (_) {}
        }
        return JSON.parse(JSON.stringify(obj));
    }

    function stableStringify(value) {
        if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
        if (value && typeof value === 'object') {
            return '{' + Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',') + '}';
        }
        return JSON.stringify(value);
    }

    function scheduleTemplatePayload(schedule) {
        const payload = deepClone(schedule);
        delete payload.updatedAt;
        delete payload.templateVersion;
        return payload;
    }

    function isLegacyDefaultSchedule(schedule) {
        if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return false;
        if (schedule.templateVersion === INITIAL_SCHEDULE_TEMPLATE_VERSION || Number(schedule.templateVersion) >= Number(INITIAL_SCHEDULE_TEMPLATE_VERSION)) return false;
        if (!schedule.grid || Object.keys(schedule.grid).length === 0) return false;
        return stableStringify(scheduleTemplatePayload(schedule)) === stableStringify(LEGACY_SCHEDULE_TEMPLATE);
    }

    function normalizeSchedule(schedule) {
        if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) {
            return { schedule: deepClone(INITIAL_SCHEDULE), changed: true };
        }

        if (isLegacyDefaultSchedule(schedule)) {
            return { schedule: deepClone(INITIAL_SCHEDULE), changed: true, migrated: true };
        }

        // 版本与结构完整时直接快速返回，避免对大数据集执行深拷贝与二次解析
        if (
            schedule.templateVersion === INITIAL_SCHEDULE_TEMPLATE_VERSION &&
            Array.isArray(schedule.days) &&
            Array.isArray(schedule.periods) &&
            Array.isArray(schedule.courseLibrary) &&
            schedule.grid && typeof schedule.grid === 'object' &&
            schedule.lunchBreak && typeof schedule.lunchBreak === 'object' &&
            schedule.updatedAt
        ) {
            return { schedule, changed: false };
        }

        const normalized = deepClone(schedule);
        let changed = false;
        if (!Array.isArray(normalized.days)) {
            normalized.days = deepClone(INITIAL_SCHEDULE.days);
            changed = true;
        }
        if (!Array.isArray(normalized.periods)) {
            normalized.periods = deepClone(INITIAL_SCHEDULE.periods);
            changed = true;
        }
        if (!Array.isArray(normalized.courseLibrary)) {
            normalized.courseLibrary = deepClone(INITIAL_SCHEDULE.courseLibrary);
            changed = true;
        }
        if (!normalized.grid || typeof normalized.grid !== 'object' || Array.isArray(normalized.grid)) {
            normalized.grid = deepClone(INITIAL_SCHEDULE.grid);
            changed = true;
        }
        if (!normalized.lunchBreak || typeof normalized.lunchBreak !== 'object') {
            normalized.lunchBreak = {
                enabled: true,
                afterPeriod: 4,
                 name: '午间休息'
             };
             changed = true;
         } else {
             if (typeof normalized.lunchBreak.enabled !== 'boolean') {
                 normalized.lunchBreak.enabled = true;
                 changed = true;
             }
             if (typeof normalized.lunchBreak.afterPeriod !== 'number') {
                 normalized.lunchBreak.afterPeriod = 4;
                 changed = true;
             }
             if (typeof normalized.lunchBreak.name !== 'string' || !normalized.lunchBreak.name.trim()) {
                 normalized.lunchBreak.name = '午间休息';
                 changed = true;
             }
         }
         if (!normalized.updatedAt) {
             normalized.updatedAt = getUtcNowIso();
             changed = true;
         }
         if (normalized.templateVersion !== INITIAL_SCHEDULE_TEMPLATE_VERSION) {
             normalized.templateVersion = INITIAL_SCHEDULE_TEMPLATE_VERSION;
             changed = true;
         }
         return { schedule: normalized, changed };
     }

    function hasScheduleData(state) {
        return !!(state && state.schedule && typeof state.schedule === 'object' && !Array.isArray(state.schedule));
    }

    function compareTimes(localTime, importedTime) {
        const local = localTime || EMPTY_TIME;
        const imported = importedTime || EMPTY_TIME;
        if (imported > local) return 'file';
        if (imported < local) return 'local';
        return 'conflict';
    }

    function createDefaultSeatLayout(students) {
        return (students || []).map((student, index) => ({
            studentId: student.id,
            row: Math.floor(index / 8),
            group: Math.floor((index % 8) / 2),
            side: index % 2
        }));
    }

    function makeResolution(localSide, importedSide, importedDeleted = false) {
        if (!localSide.exists && importedSide.exists) {
            return { choice: 'file', label: '采用文件', reason: '文件中存在，本地不存在' };
        }
        if (localSide.exists && !importedSide.exists) {
            if (importedDeleted) {
                const deleteChoice = compareTimes(localSide.updatedAt, importedSide.updatedAt);
                if (deleteChoice === 'file') return { choice: 'file', label: '采用文件', reason: '文件标记删除且删除时间较新' };
                if (deleteChoice === 'conflict') return { choice: 'local', conflict: true, label: '保留本地', reason: '文件标记删除且双方时间相同，按规则保留本地' };
                return { choice: 'local', label: '保留本地', reason: '本地修改时间较新，忽略文件删除' };
            }
            return { choice: 'local', label: '保留本地', reason: '文件中不存在对应项' };
        }
        const choice = compareTimes(localSide.updatedAt, importedSide.updatedAt);
        if (choice === 'file') return { choice, label: '采用文件', reason: '文件修改时间较新' };
        if (choice === 'local') return { choice, label: '保留本地', reason: '本地修改时间较新' };
        return { choice: 'local', conflict: true, label: '保留本地', reason: '双方修改时间相同，按规则保留本地' };
    }

    function matchStudents(localStudents, importedStudents, useStableIds) {
        const localById = new Map((localStudents || []).map(student => [String(student.id), student]));
        const localByNo = new Map((localStudents || []).map(student => [String(student.studentNo || student.id), student]));
        const used = new Set();
        const pairs = [];
        const importedUnmatched = [];

        (importedStudents || []).forEach(imported => {
            let localStudent = useStableIds ? localById.get(String(imported.id)) : null;
            if (!localStudent) localStudent = localByNo.get(String(imported.studentNo || imported.id));
            if (localStudent && !used.has(localStudent.id)) {
                used.add(localStudent.id);
                pairs.push({ local: localStudent, imported });
            } else {
                importedUnmatched.push(imported);
            }
        });

        return {
            pairs,
            localUnmatched: (localStudents || []).filter(student => !used.has(student.id)),
            importedUnmatched
        };
    }

    function matchTasks(localTasks, importedTasks, useStableIds) {
        const localById = new Map((localTasks || []).map(task => [String(task.id), task]));
        const localByName = new Map();
        (localTasks || []).forEach(task => {
            const key = normalizeTaskName(task.name);
            if (!localByName.has(key)) localByName.set(key, []);
            localByName.get(key).push(task);
        });
        const used = new Set();
        const nameIndexes = new Map();
        const pairs = [];
        const importedUnmatched = [];

        (importedTasks || []).forEach(imported => {
            let localTask = useStableIds ? localById.get(String(imported.id)) : null;
            if (localTask && used.has(localTask.id)) localTask = null;
            if (!localTask) {
                const key = normalizeTaskName(imported.name);
                const candidates = localByName.get(key) || [];
                const index = nameIndexes.get(key) || 0;
                localTask = candidates.slice(index).find(task => !used.has(task.id));
                nameIndexes.set(key, index + 1);
            }
            if (localTask && !used.has(localTask.id)) {
                used.add(localTask.id);
                pairs.push({ local: localTask, imported });
            } else {
                importedUnmatched.push(imported);
            }
        });

        return {
            pairs,
            localUnmatched: (localTasks || []).filter(task => !used.has(task.id)),
            importedUnmatched
        };
    }

    function getRawCell(preparedData, taskName, studentNo) {
        const rawCells = preparedData.visibleRawCells || {};
        const keys = [`${taskName.id || taskName}_${studentNo}`, `${taskName.name || taskName}_${studentNo}`];
        for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(rawCells, key)) return rawCells[key];
        }
        return null;
    }

    class Store {
        constructor() {
            this.listeners = new Set();
            this.storageSaveHandle = null;
            this.deviceId = this._getOrCreateDeviceId();
            this.loadedFromLocalStorage = false;
            this.state = this._loadFromStorage() || this._getInitialState();
            // 清除旧版本存储以释放空间并避免混淆
            OLD_STORAGE_KEYS.forEach(k => {
                try { localStorage.removeItem(k); } catch (_) {}
            });
            window.addEventListener('pagehide', () => this._flushStorageSave());
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') this._flushStorageSave();
            });
            this._applyFontSettings(this.state.fontPreset, this.state.customFont);
            if (!this.loadedFromLocalStorage) {
                this._recoverFromIndexedDb();
            }
        }

        _getOrCreateDeviceId() {
            try {
                let id = localStorage.getItem('tws3_device_id');
                if (!id) {
                    id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
                    localStorage.setItem('tws3_device_id', id);
                }
                return id;
            } catch (_) {
                return 'dev_ephemeral_' + Math.random().toString(36).substring(2, 9);
            }
        }
        _createDefaultClassState(classId, className, initialStudents, initialTasks, initialRecords) {
            const now = getUtcNowIso();
            const students = JSON.parse(JSON.stringify(initialStudents || [])).map(s => ({
                ...s,
                isNonEnglish: !!s.isNonEnglish,
                updatedAt: s.updatedAt || now
            }));
            const tasks = JSON.parse(JSON.stringify(initialTasks || [])).map(t => ({
                ...t,
                subject: t.subject || inferSubjectFromName(t.name)
            }));
            const records = JSON.parse(JSON.stringify(initialRecords || {}));
            tasks.forEach(t => {
                if (!records[t.id]) records[t.id] = {};
                students.forEach(s => {
                    if (!records[t.id][s.id]) {
                        records[t.id][s.id] = { status: 'white', badge: null, score: null, note: null, updatedAt: now };
                    }
                });
            });
            return {
                id: classId,
                name: className,
                classUpdatedAt: now,
                students,
                deletedStudents: [],
                tasks,
                deletedTasks: [],
                currentTaskId: tasks.find(t => !t.archived)?.id || (tasks[0] ? tasks[0].id : ''),
                records,
                seatLayout: createDefaultSeatLayout(students),
                seatGroupNames: ['第1组', '第2组', '第3组', '第4组'],
                seatPodiumPosition: 'bottom',
                seatLayoutUpdatedAt: now,
                schedule: JSON.parse(JSON.stringify(INITIAL_SCHEDULE)),
                officerTable: JSON.parse(JSON.stringify(INITIAL_OFFICERS)),
                dutyTable: JSON.parse(JSON.stringify(INITIAL_DUTY))
            };
        }

        _syncActiveClassPointers(state = this.state) {
            if (!state || !Array.isArray(state.classes) || state.classes.length === 0) return;
            let activeClass = state.classes.find(c => c.id === state.currentClassId);
            if (!activeClass) {
                activeClass = state.classes[0];
                state.currentClassId = activeClass.id;
            }
            state.currentClass = activeClass.name;
            state.classUpdatedAt = activeClass.classUpdatedAt || getUtcNowIso();
            state.students = activeClass.students;
            state.deletedStudents = activeClass.deletedStudents;
            state.tasks = activeClass.tasks;
            state.deletedTasks = activeClass.deletedTasks;
            state.currentTaskId = activeClass.currentTaskId || (activeClass.tasks[0] ? activeClass.tasks[0].id : '');
            state.records = activeClass.records;
            state.seatLayout = activeClass.seatLayout;
            state.seatGroupNames = activeClass.seatGroupNames;
            state.seatPodiumPosition = activeClass.seatPodiumPosition || 'bottom';
            state.seatLayoutUpdatedAt = activeClass.seatLayoutUpdatedAt || state.classUpdatedAt;
            state.schedule = activeClass.schedule;
            state.officerTable = activeClass.officerTable;
            state.dutyTable = activeClass.dutyTable;
        }

        _normalizeClass(cls, fallbackIndex = 0) {
            if (!cls || typeof cls !== 'object') cls = {};
            const fallbackId = `class_${fallbackIndex + 1}`;
            const fallbackName = fallbackIndex === 0 ? (INITIAL_CLASS_NAME || '高二 (3) 班') : (INITIAL_CLASS_2_NAME || '高二 (4) 班');
            const id = cls.id || fallbackId;
            const name = cls.name || cls.currentClass || fallbackName;
            const classUpdatedAt = cls.classUpdatedAt || getUtcNowIso();
            const students = Array.isArray(cls.students) ? cls.students : [];
            students.forEach(s => {
                if (s.isNonEnglish === undefined) s.isNonEnglish = false;
                if (!s.updatedAt) s.updatedAt = classUpdatedAt;
            });
            const deletedStudents = Array.isArray(cls.deletedStudents) ? cls.deletedStudents : [];
            const tasks = Array.isArray(cls.tasks) ? cls.tasks : [];
            tasks.forEach(t => {
                if (!t.subject) t.subject = inferSubjectFromName(t.name);
            });
            const deletedTasks = Array.isArray(cls.deletedTasks) ? cls.deletedTasks : [];
            let currentTaskId = cls.currentTaskId;
            if (!currentTaskId || !tasks.some(t => t.id === currentTaskId)) {
                currentTaskId = tasks.find(t => !t.archived)?.id || (tasks[0] ? tasks[0].id : '');
            }
            const records = (cls.records && typeof cls.records === 'object') ? cls.records : {};
            const seatLayout = Array.isArray(cls.seatLayout) ? cls.seatLayout : createDefaultSeatLayout(students);
            const seatGroupNames = (Array.isArray(cls.seatGroupNames) && cls.seatGroupNames.length === 4)
                ? cls.seatGroupNames
                : ['第1组', '第2组', '第3组', '第4组'];
            const seatPodiumPosition = cls.seatPodiumPosition === 'top' ? 'top' : 'bottom';
            const seatLayoutUpdatedAt = cls.seatLayoutUpdatedAt || classUpdatedAt;

            const normalizedSchedule = normalizeSchedule(cls.schedule);
            const schedule = normalizedSchedule.schedule;

            let officerTable = cls.officerTable;
            if (!officerTable || typeof officerTable !== 'object') {
                officerTable = deepClone(INITIAL_OFFICERS);
            } else {
                if (!Array.isArray(officerTable.roles)) officerTable.roles = [];
                if (!officerTable.updatedAt) officerTable.updatedAt = classUpdatedAt;
            }

            let dutyTable = cls.dutyTable;
            if (!dutyTable || typeof dutyTable !== 'object') {
                dutyTable = deepClone(INITIAL_DUTY);
            } else {
                if (!Array.isArray(dutyTable.days)) dutyTable.days = [];
                if (!Array.isArray(dutyTable.roles)) dutyTable.roles = [];
                if (!dutyTable.assignments || typeof dutyTable.assignments !== 'object') dutyTable.assignments = {};
                if (!dutyTable.updatedAt) dutyTable.updatedAt = classUpdatedAt;
            }

            return {
                id,
                name,
                classUpdatedAt,
                students,
                deletedStudents,
                tasks,
                deletedTasks,
                currentTaskId,
                records,
                seatLayout,
                seatGroupNames,
                seatPodiumPosition,
                seatLayoutUpdatedAt,
                schedule,
                officerTable,
                dutyTable
            };
        }

        _getInitialState() {
            const class1 = this._createDefaultClassState(
                'class_1',
                INITIAL_CLASS_NAME || '高二 (3) 班',
                INITIAL_STUDENTS,
                INITIAL_TASKS,
                INITIAL_RECORDS
            );
            const class2 = this._createDefaultClassState(
                'class_2',
                INITIAL_CLASS_2_NAME || '高二 (4) 班',
                INITIAL_STUDENTS_CLASS_2 || INITIAL_STUDENTS,
                INITIAL_TASKS_CLASS_2 || INITIAL_TASKS,
                INITIAL_RECORDS_CLASS_2 || {}
            );

            const state = {
                schemaVersion: 4,
                currentClassId: 'class_1',
                classes: [class1, class2],
                operationMode: 'check',
                viewMode: 'grid',
                showStudentNumbers: true,
                showSubjectTags: true,
                showNonEnglishTags: true,
                fontPreset: 'default',
                customFont: '',
                scheduleLibrary: JSON.parse(JSON.stringify(INITIAL_SCHEDULE_LIBRARY || [])),
                scheduleLibraryTitle: '畲江中学2026-2027学年第一学期初二课程表',
                selectedScheduleClassId: 'class_sched_chu2_3',
                scheduleHighlightedSubject: '',
                scheduleTeacherSubject: '英语',
                scheduleTeacherClassIds: []
            };
            this._syncActiveClassPointers(state);
            return state;
        }

        _loadFromStorage() {
            try {
                let parsed = null;
                let isOld = false;
                const candidates = [
                    { raw: localStorage.getItem(STORAGE_KEY), old: false },
                    { raw: localStorage.getItem(STORAGE_PENDING_KEY), old: false },
                    ...OLD_STORAGE_KEYS.map(key => ({ raw: localStorage.getItem(key), old: true }))
                ];
                for (const candidate of candidates) {
                    if (!candidate.raw) continue;
                    try {
                        const value = JSON.parse(candidate.raw);
                        if (value && typeof value === 'object') {
                            parsed = value;
                            isOld = candidate.old;
                            break;
                        }
                    } catch (_) {}
                }
                if (!parsed) return null;
                this.loadedFromLocalStorage = true;

                // 旧格式迁移：若无 classes 数组
                if (!Array.isArray(parsed.classes) || parsed.classes.length === 0) {
                    if (!Array.isArray(parsed.students) || !Array.isArray(parsed.tasks)) {
                        return null;
                    }
                    const class1 = this._normalizeClass({
                        id: 'class_1',
                        name: parsed.currentClass || INITIAL_CLASS_NAME || '高二 (3) 班',
                        classUpdatedAt: parsed.classUpdatedAt,
                        students: parsed.students,
                        deletedStudents: parsed.deletedStudents,
                        tasks: parsed.tasks,
                        deletedTasks: parsed.deletedTasks,
                        currentTaskId: parsed.currentTaskId,
                        records: parsed.records,
                        seatLayout: parsed.seatLayout,
                        seatGroupNames: parsed.seatGroupNames,
                        seatPodiumPosition: parsed.seatPodiumPosition,
                        seatLayoutUpdatedAt: parsed.seatLayoutUpdatedAt,
                        schedule: parsed.schedule,
                        officerTable: parsed.officerTable,
                        dutyTable: parsed.dutyTable
                    }, 0);

                    const class2 = this._createDefaultClassState(
                        'class_2',
                        INITIAL_CLASS_2_NAME || '高二 (4) 班',
                        INITIAL_STUDENTS_CLASS_2 || INITIAL_STUDENTS,
                        INITIAL_TASKS_CLASS_2 || INITIAL_TASKS,
                        INITIAL_RECORDS_CLASS_2 || {}
                    );

                    parsed.classes = [class1, class2];
                    parsed.currentClassId = 'class_1';
                    isOld = true;
                } else {
                    // 确保至少有 2 个班级
                    parsed.classes = parsed.classes.map((cls, idx) => this._normalizeClass(cls, idx));
                    if (parsed.classes.length === 1) {
                        const class2 = this._createDefaultClassState(
                            'class_2',
                            INITIAL_CLASS_2_NAME || '高二 (4) 班',
                            INITIAL_STUDENTS_CLASS_2 || INITIAL_STUDENTS,
                            INITIAL_TASKS_CLASS_2 || INITIAL_TASKS,
                            INITIAL_RECORDS_CLASS_2 || {}
                        );
                        parsed.classes.push(class2);
                        isOld = true;
                    }
                }

                parsed.schemaVersion = 4;
                if (!parsed.currentClassId || !parsed.classes.some(c => c.id === parsed.currentClassId)) {
                    parsed.currentClassId = parsed.classes[0].id;
                }
                if (!parsed.operationMode) parsed.operationMode = 'check';
                if (typeof parsed.showStudentNumbers !== 'boolean') parsed.showStudentNumbers = true;
                if (typeof parsed.showSubjectTags !== 'boolean') parsed.showSubjectTags = true;
                if (typeof parsed.showNonEnglishTags !== 'boolean') parsed.showNonEnglishTags = true;
                if (!parsed.fontPreset) parsed.fontPreset = 'default';
                if (typeof parsed.customFont !== 'string') parsed.customFont = '';
                if (!Array.isArray(parsed.scheduleLibrary) || parsed.scheduleLibrary.length === 0) {
                    parsed.scheduleLibrary = JSON.parse(JSON.stringify(INITIAL_SCHEDULE_LIBRARY || []));
                } else {
                    const isPresetLib = parsed.scheduleLibrary.length === 2 &&
                        parsed.scheduleLibrary.some(c => c.id === 'class_sched_chu2_3' || c.id === 'class_sched_高二3') &&
                        parsed.scheduleLibrary.some(c => c.id === 'class_sched_chu2_4' || c.id === 'class_sched_高二4');
                    if (isPresetLib && (parsed.scheduleLibrary[0].totalCourses === 50 || parsed.scheduleLibrary[0].grid?.['day_1_p_afterschool'] || parsed.scheduleLibrary[0].grid?.['day_1_p_morning']?.name !== '英')) {
                        parsed.scheduleLibrary = JSON.parse(JSON.stringify(INITIAL_SCHEDULE_LIBRARY || []));
                        isOld = true;
                    }
                }
                if (typeof parsed.scheduleLibraryTitle !== 'string' || !parsed.scheduleLibraryTitle) {
                    parsed.scheduleLibraryTitle = '畲江中学2026-2027学年第一学期初二课程表';
                }
                if (typeof parsed.selectedScheduleClassId !== 'string' || !parsed.selectedScheduleClassId) {
                    parsed.selectedScheduleClassId = 'class_sched_chu2_3';
                }
                if (typeof parsed.scheduleHighlightedSubject !== 'string') {
                    parsed.scheduleHighlightedSubject = '';
                }
                if (typeof parsed.scheduleTeacherSubject !== 'string' || !parsed.scheduleTeacherSubject) {
                    parsed.scheduleTeacherSubject = '英语';
                }
                if (!Array.isArray(parsed.scheduleTeacherClassIds)) {
                    parsed.scheduleTeacherClassIds = [];
                }
                const validViews = ['grid', 'wide', 'seat', 'table', 'schedule', 'officers', 'duty'];
                if (!validViews.includes(parsed.viewMode)) parsed.viewMode = 'grid';

                this._syncActiveClassPointers(parsed);

                if (isOld) {
                    try {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
                    } catch (_) {}
                }
                return parsed;
            } catch {
                return null;
            }
        }

        _saveToStorage() {
            try {
                const serialized = JSON.stringify(this.state);
                localStorage.setItem(STORAGE_PENDING_KEY, serialized);
                localStorage.setItem(STORAGE_KEY, serialized);
                localStorage.removeItem(STORAGE_PENDING_KEY);
                this._saveToIndexedDb(serialized);
            } catch (e) {
                console.error('Failed to save application state', e);
            }
        }

        _openRecoveryDb() {
            if (!window.indexedDB) return Promise.resolve(null);
            return new Promise(resolve => {
                const request = window.indexedDB.open(RECOVERY_DB_NAME, 1);
                request.onupgradeneeded = () => {
                    const db = request.result;
                    if (!db.objectStoreNames.contains(RECOVERY_STORE_NAME)) {
                        db.createObjectStore(RECOVERY_STORE_NAME);
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(null);
            });
        }

        async _saveToIndexedDb(serialized) {
            const db = await this._openRecoveryDb();
            if (!db) return;
            try {
                const transaction = db.transaction(RECOVERY_STORE_NAME, 'readwrite');
                const store = transaction.objectStore(RECOVERY_STORE_NAME);
                const currentRequest = store.get('current');
                currentRequest.onsuccess = () => {
                    if (currentRequest.result) store.put(currentRequest.result, 'previous');
                    store.put(serialized, 'current');
                };
                transaction.oncomplete = () => db.close();
                transaction.onerror = () => db.close();
            } catch (_) {
                db.close();
            }
        }

        async _recoverFromIndexedDb() {
            const db = await this._openRecoveryDb();
            if (!db || this.loadedFromLocalStorage) return;
            const read = key => new Promise(resolve => {
                const transaction = db.transaction(RECOVERY_STORE_NAME, 'readonly');
                const request = transaction.objectStore(RECOVERY_STORE_NAME).get(key);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => resolve(null);
            });
            let restored = null;
            for (const key of ['current', 'previous']) {
                const raw = await read(key);
                if (!raw) continue;
                try {
                    restored = JSON.parse(raw);
                    if (restored && typeof restored === 'object') break;
                } catch (_) {}
            }
            db.close();
            if (!restored || this.loadedFromLocalStorage) return;
            try {
                this.overrideWith({ state: restored });
            } catch (_) {}
        }

        _scheduleStorageSave() {
            if (this.storageSaveHandle !== null) return;

            const save = () => {
                this.storageSaveHandle = null;
                this._saveToStorage();
            };
            if (typeof window.requestIdleCallback === 'function') {
                this.storageSaveHandle = window.requestIdleCallback(save, { timeout: 500 });
            } else {
                this.storageSaveHandle = window.setTimeout(save, 100);
            }
        }

        _flushStorageSave() {
            if (this.storageSaveHandle === null) return;
            if (typeof window.cancelIdleCallback === 'function') {
                window.cancelIdleCallback(this.storageSaveHandle);
            } else {
                window.clearTimeout(this.storageSaveHandle);
            }
            this.storageSaveHandle = null;
            this._saveToStorage();
        }

        _notify(eventType, payload) {
            this._scheduleStorageSave();
            for (const listener of this.listeners) {
                try {
                    listener(this.state, eventType, payload);
                } catch (err) {
                    console.error('Store listener error:', err);
                }
            }
        }

        subscribe(listener) {
            this.listeners.add(listener);
            return () => this.listeners.delete(listener);
        }

        getState() {
            return this.state;
        }

        getDeviceId() {
            return this.deviceId;
        }

        getOperationMode() {
            return this.state.operationMode || 'check';
        }

        getViewMode() {
            const allowed = ['grid', 'wide', 'seat', 'table', 'schedule'];
            return allowed.includes(this.state.viewMode) ? this.state.viewMode : 'grid';
        }

        getLastHomeworkViewMode() {
            const allowed = ['grid', 'wide', 'seat', 'table'];
            return allowed.includes(this.state.lastHomeworkViewMode) ? this.state.lastHomeworkViewMode : 'grid';
        }

        setViewMode(mode) {
            const allowed = ['grid', 'wide', 'seat', 'table', 'schedule'];
            if (!allowed.includes(mode)) return;
            if (['grid', 'wide', 'seat', 'table'].includes(mode)) {
                this.state.lastHomeworkViewMode = mode;
            }
            if (this.state.viewMode === mode) return;
            this.state.viewMode = mode;
            this._notify('VIEW_MODE_CHANGED', { mode });
        }

        getStudentFilter() {
            return this.studentFilter || { query: '', status: 'all' };
        }

        setStudentFilter(filter = {}) {
            const query = (filter.query !== undefined ? filter.query : (this.studentFilter?.query || '')).trim().toLowerCase();
            const status = filter.status !== undefined ? filter.status : (this.studentFilter?.status || 'all');
            this.studentFilter = { query, status };
            this._notify('STUDENT_FILTER_CHANGED', { filter: this.studentFilter });
        }

        getShowStudentNumbers() {
            return this.state.showStudentNumbers !== false;
        }

        setShowStudentNumbers(show) {
            const nextValue = show !== false;
            if (this.state.showStudentNumbers === nextValue) return;
            this.state.showStudentNumbers = nextValue;
            this._notify('STUDENT_NUMBER_VISIBILITY_CHANGED', { show: nextValue });
        }

        getShowSubjectTags() {
            return this.state.showSubjectTags !== false;
        }

        setShowSubjectTags(show) {
            const nextValue = show !== false;
            if (this.state.showSubjectTags === nextValue) return;
            this.state.showSubjectTags = nextValue;
            this._notify('SUBJECT_TAG_VISIBILITY_CHANGED', { show: nextValue });
        }

        getShowNonEnglishTags() {
            return this.state.showNonEnglishTags !== false;
        }

        setShowNonEnglishTags(show) {
            const nextValue = show !== false;
            if (this.state.showNonEnglishTags === nextValue) return;
            this.state.showNonEnglishTags = nextValue;
            this._notify('NON_ENGLISH_TAG_VISIBILITY_CHANGED', { show: nextValue });
        }

        // ==========================================
        _applyFontSettings(preset = 'default', customFont = '') {
            if (window.TWS3 && window.TWS3.fontManager && typeof window.TWS3.fontManager.computeFontFamily === 'function') {
                const fontFamily = window.TWS3.fontManager.computeFontFamily(preset, customFont);
                window.TWS3.fontManager.applyFont(fontFamily, preset);
            }
        }

        getFontSettings() {
            const preset = (this.state && this.state.fontPreset) || 'default';
            const customFont = (this.state && this.state.customFont) || '';
            const fontFamily = window.TWS3 && window.TWS3.fontManager && typeof window.TWS3.fontManager.computeFontFamily === 'function'
                ? window.TWS3.fontManager.computeFontFamily(preset, customFont)
                : '';
            return { preset, customFont, fontFamily };
        }

        setFontSettings({ preset = 'default', customFont = '' } = {}) {
            const nextPreset = preset || 'default';
            const nextCustom = (customFont || '').trim();
            if (this.state.fontPreset === nextPreset && this.state.customFont === nextCustom) {
                return;
            }
            this.state.fontPreset = nextPreset;
            this.state.customFont = nextCustom;
            this._applyFontSettings(nextPreset, nextCustom);
            this._scheduleStorageSave();
            this._notify('FONT_SETTINGS_CHANGED', {
                fontPreset: nextPreset,
                customFont: nextCustom,
                fontFamily: this.getFontSettings().fontFamily
            });
        }

        // 课程表 (Schedule) 相关 API
        // ==========================================
        getSchedule() {
            if (!this.state.schedule) {
                this.state.schedule = JSON.parse(JSON.stringify(INITIAL_SCHEDULE));
            }
            return this.state.schedule;
        }

        setSchedule(scheduleData) {
            if (!scheduleData || typeof scheduleData !== 'object') return false;
            this.state.schedule = normalizeSchedule(scheduleData).schedule;
            this.state.schedule.updatedAt = getUtcNowIso();
            this._notify('SCHEDULE_CHANGED', { schedule: this.state.schedule });
            return true;
        }

        addScheduleDay(name) {
            const trimmed = String(name || '').trim();
            if (!trimmed) return null;
            const schedule = this.getSchedule();
            const newId = generateId('day');
            const newDay = {
                id: newId,
                name: trimmed,
                order: schedule.days.length + 1
            };
            schedule.days.push(newDay);
            schedule.updatedAt = getUtcNowIso();
            this._notify('SCHEDULE_DAYS_CHANGED', { days: schedule.days });
            return newDay;
        }

        updateScheduleDay(dayId, newName) {
            const trimmed = String(newName || '').trim();
            if (!trimmed) return false;
            const schedule = this.getSchedule();
            const day = schedule.days.find(d => d.id === dayId);
            if (!day) return false;
            day.name = trimmed;
            schedule.updatedAt = getUtcNowIso();
            this._notify('SCHEDULE_DAYS_CHANGED', { days: schedule.days });
            return true;
        }

        removeScheduleDay(dayId) {
            const schedule = this.getSchedule();
            const idx = schedule.days.findIndex(d => d.id === dayId);
            if (idx === -1) return false;
            schedule.days.splice(idx, 1);
            // 清理相关的单元格
            if (schedule.grid) {
                Object.keys(schedule.grid).forEach(key => {
                    if (key.startsWith(dayId + '_')) {
                        delete schedule.grid[key];
                    }
                });
            }
            schedule.updatedAt = getUtcNowIso();
            this._notify('SCHEDULE_DAYS_CHANGED', { days: schedule.days });
            return true;
        }

        reorderScheduleDays(dayIds) {
            if (!Array.isArray(dayIds)) return false;
            const schedule = this.getSchedule();
            const dayMap = new Map(schedule.days.map(d => [d.id, d]));
            const reordered = [];
            dayIds.forEach((id, idx) => {
                if (dayMap.has(id)) {
                    const day = dayMap.get(id);
                    day.order = idx + 1;
                    reordered.push(day);
                    dayMap.delete(id);
                }
            });
            dayMap.forEach(d => {
                d.order = reordered.length + 1;
                reordered.push(d);
            });
            schedule.days = reordered;
            schedule.updatedAt = getUtcNowIso();
            this._notify('SCHEDULE_DAYS_CHANGED', { days: schedule.days });
            return true;
        }

        addSchedulePeriod(name) {
            const trimmed = String(name || '').trim();
            if (!trimmed) return null;
            const schedule = this.getSchedule();
            const newId = generateId('p');
            const newPeriod = {
                id: newId,
                name: trimmed,
                order: schedule.periods.length + 1
            };
            schedule.periods.push(newPeriod);
            schedule.updatedAt = getUtcNowIso();
            this._notify('SCHEDULE_PERIODS_CHANGED', { periods: schedule.periods });
            return newPeriod;
        }

        updateSchedulePeriod(periodId, newName) {
            const trimmed = String(newName || '').trim();
            if (!trimmed) return false;
            const schedule = this.getSchedule();
            const period = schedule.periods.find(p => p.id === periodId);
            if (!period) return false;
            period.name = trimmed;
            schedule.updatedAt = getUtcNowIso();
            this._notify('SCHEDULE_PERIODS_CHANGED', { periods: schedule.periods });
            return true;
        }

        removeSchedulePeriod(periodId) {
            const schedule = this.getSchedule();
            const idx = schedule.periods.findIndex(p => p.id === periodId);
            if (idx === -1) return false;
            schedule.periods.splice(idx, 1);
            if (schedule.grid) {
                Object.keys(schedule.grid).forEach(key => {
                    if (key.endsWith('_' + periodId)) {
                        delete schedule.grid[key];
                    }
                });
            }
            schedule.updatedAt = getUtcNowIso();
            this._notify('SCHEDULE_PERIODS_CHANGED', { periods: schedule.periods });
            return true;
        }

        reorderSchedulePeriods(periodIds) {
            if (!Array.isArray(periodIds)) return false;
            const schedule = this.getSchedule();
            const pMap = new Map(schedule.periods.map(p => [p.id, p]));
            const reordered = [];
            periodIds.forEach((id, idx) => {
                if (pMap.has(id)) {
                    const p = pMap.get(id);
                    p.order = idx + 1;
                    reordered.push(p);
                    pMap.delete(id);
                }
            });
            pMap.forEach(p => {
                p.order = reordered.length + 1;
                reordered.push(p);
            });
            schedule.periods = reordered;
            schedule.updatedAt = getUtcNowIso();
            this._notify('SCHEDULE_PERIODS_CHANGED', { periods: schedule.periods });
            return true;
        }

        addCourse(name, color = 'blue') {
            const trimmed = String(name || '').trim();
            if (!trimmed) return null;
            const schedule = this.getSchedule();
            const newId = generateId('c');
            const newCourse = {
                id: newId,
                name: trimmed,
                color: color || 'blue'
            };
            schedule.courseLibrary.push(newCourse);
            schedule.updatedAt = getUtcNowIso();
            this._notify('SCHEDULE_COURSES_CHANGED', { courses: schedule.courseLibrary });
            return newCourse;
        }

        updateCourse(courseId, updates = {}) {
            const schedule = this.getSchedule();
            const course = schedule.courseLibrary.find(c => c.id === courseId);
            if (!course) return false;
            if (updates.name !== undefined) course.name = String(updates.name || '').trim();
            if (updates.color !== undefined) course.color = updates.color;
            schedule.updatedAt = getUtcNowIso();
            this._notify('SCHEDULE_COURSES_CHANGED', { courses: schedule.courseLibrary });
            return true;
        }

        removeCourse(courseId) {
            const schedule = this.getSchedule();
            const idx = schedule.courseLibrary.findIndex(c => c.id === courseId);
            if (idx === -1) return false;
            schedule.courseLibrary.splice(idx, 1);
            schedule.updatedAt = getUtcNowIso();
            this._notify('SCHEDULE_COURSES_CHANGED', { courses: schedule.courseLibrary });
            return true;
        }

        setScheduleCell(dayId, periodId, cellData = {}, targetClassId = null) {
            const classId = targetClassId || this.getSelectedScheduleClassId();
            let targetSchedule = null;
            const lib = this.getScheduleLibrary();

            if (classId && classId !== 'combined') {
                targetSchedule = lib.find(c => c.id === classId || c.shortName === classId || c.name === classId);
            }
            if (!targetSchedule) {
                targetSchedule = this.getSchedule();
            }

            if (!targetSchedule.grid) targetSchedule.grid = {};
            const key = `${dayId}_${periodId}`;

            const courseId = cellData.courseId || null;
            const name = String(cellData.name || '').trim();
            const fullName = String(cellData.fullName || name).trim();
            const color = cellData.color || 'default';
            const char = String(cellData.char || (name ? name.charAt(0) : '')).trim();
            const customName = String(cellData.customName || '').trim();

            if (!name && !courseId && !customName && !char) {
                delete targetSchedule.grid[key];
            } else {
                targetSchedule.grid[key] = {
                    courseId: courseId || null,
                    name: name || char || '课',
                    fullName: fullName || name || '课程',
                    color: color || 'default',
                    char: char || (name ? name.charAt(0) : '课'),
                    customName
                };
            }

            // 更新课程总数
            targetSchedule.totalCourses = Object.keys(targetSchedule.grid).filter(k => {
                const c = targetSchedule.grid[k];
                return c && (c.name || c.courseId || c.customName || c.char);
            }).length;
            targetSchedule.updatedAt = getUtcNowIso();

            if (this.state.schedule && (this.state.schedule.id === targetSchedule.id || this.state.schedule.name === targetSchedule.name)) {
                this.state.schedule.grid = targetSchedule.grid;
                this.state.schedule.totalCourses = targetSchedule.totalCourses;
                this.state.schedule.updatedAt = targetSchedule.updatedAt;
            }

            this._scheduleStorageSave();
            this._notify('SCHEDULE_GRID_CHANGED', { key, cell: targetSchedule.grid[key], classId: targetSchedule.id });
            this._notify('SCHEDULE_CHANGED', { schedule: targetSchedule });
            return targetSchedule.grid[key] || null;
        }

        clearScheduleCell(dayId, periodId, targetClassId = null) {
            return this.setScheduleCell(dayId, periodId, {}, targetClassId);
        }

        updateScheduleClassInfo(classId, updates = {}) {
            const lib = this.getScheduleLibrary();
            const target = lib.find(c => c.id === classId || c.name === classId);
            if (!target) return false;
            if (updates.name !== undefined) target.name = String(updates.name || '').trim();
            if (updates.shortName !== undefined) target.shortName = String(updates.shortName || '').trim();
            if (updates.teacher !== undefined) target.teacher = String(updates.teacher || '').trim();
            if (updates.grade !== undefined) target.grade = String(updates.grade || '').trim();
            target.updatedAt = getUtcNowIso();

            if (this.state.schedule && (this.state.schedule.id === classId || this.state.schedule.name === target.name)) {
                if (updates.name !== undefined) this.state.schedule.name = target.name;
                if (updates.shortName !== undefined) this.state.schedule.shortName = target.shortName;
                if (updates.teacher !== undefined) this.state.schedule.teacher = target.teacher;
                if (updates.grade !== undefined) this.state.schedule.grade = target.grade;
                this.state.schedule.updatedAt = target.updatedAt;
            }

            this._scheduleStorageSave();
            this._notify('SCHEDULE_CLASS_UPDATED', { classId, schedule: target });
            this._notify('SCHEDULE_CHANGED', { schedule: target });
            return true;
        }
        updateScheduleLunchBreak(updates = {}) {
            const schedule = this.getSchedule();
            if (!schedule.lunchBreak) {
                schedule.lunchBreak = { enabled: true, afterPeriod: 4, name: '午间休息' };
            }
            if (updates.enabled !== undefined) schedule.lunchBreak.enabled = !!updates.enabled;
            if (updates.afterPeriod !== undefined) schedule.lunchBreak.afterPeriod = Number(updates.afterPeriod);
            if (updates.name !== undefined) schedule.lunchBreak.name = String(updates.name || '').trim() || '午间休息';
            schedule.updatedAt = getUtcNowIso();
            this._notify('SCHEDULE_LUNCH_BREAK_CHANGED', { lunchBreak: schedule.lunchBreak });
            return schedule.lunchBreak;
        }

        // 多班级课程表库 (Schedule Library) 与高亮科目相关 API
        // ==========================================
        getScheduleHighlightedSubject() {
            return this.state.scheduleHighlightedSubject || '';
        }

        setScheduleHighlightedSubject(subject) {
            const trimmed = String(subject || '').trim();
            if (this.state.scheduleHighlightedSubject === trimmed) {
                // 再次点击相同科目则取消高亮
                this.state.scheduleHighlightedSubject = '';
            } else {
                this.state.scheduleHighlightedSubject = trimmed;
            }
            this._scheduleStorageSave();
            this._notify('SCHEDULE_HIGHLIGHT_CHANGED', {
                highlightedSubject: this.state.scheduleHighlightedSubject
            });
            return true;
        }

        getScheduleLibrary() {
            if (!Array.isArray(this.state.scheduleLibrary) || this.state.scheduleLibrary.length === 0) {
                if (INITIAL_SCHEDULE_LIBRARY && INITIAL_SCHEDULE_LIBRARY.length > 0) {
                    this.state.scheduleLibrary = JSON.parse(JSON.stringify(INITIAL_SCHEDULE_LIBRARY));
                } else {
                    this.state.scheduleLibrary = [];
                }
            }
            return this.state.scheduleLibrary;
        }

        getScheduleLibraryTitle() {
            return this.state.scheduleLibraryTitle || '学校课程表';
        }

        getSelectedScheduleClassId() {
            if (this.state.selectedScheduleClassId === 'combined') {
                return 'combined';
            }
            const lib = this.getScheduleLibrary();
            if (this.state.selectedScheduleClassId) {
                const exists = lib.some(c => c.id === this.state.selectedScheduleClassId);
                if (exists) return this.state.selectedScheduleClassId;
            }
            if (lib.length > 0) {
                return lib[0].id;
            }
            return '';
        }

        isCombinedScheduleMode() {
            return this.getSelectedScheduleClassId() === 'combined';
        }

        getScheduleTeacherSubject() {
            return this.state.scheduleTeacherSubject || '英语';
        }

        setScheduleTeacherSubject(subject) {
            const trimmed = String(subject || '').trim() || '英语';
            this.state.scheduleTeacherSubject = trimmed;
            this._scheduleStorageSave();
            this._notify('SCHEDULE_TEACHER_SUBJECT_CHANGED', {
                teacherSubject: this.state.scheduleTeacherSubject,
                schedule: this.getActiveSchedule()
            });
            return true;
        }

        setSelectedScheduleClassId(classId) {
            if (!classId) return false;
            this.state.selectedScheduleClassId = String(classId);
            this._scheduleStorageSave();
            this._notify('SCHEDULE_CLASS_CHANGED', {
                selectedClassId: this.state.selectedScheduleClassId,
                schedule: this.getActiveSchedule()
            });
            return true;
        }

        getScheduleTeacherClasses() {
            const lib = this.getScheduleLibrary();
            if (!lib || lib.length === 0) return [];
            if (lib.length <= 2) return lib;

            // 如果用户自定义了任教班级 ID 列表
            if (Array.isArray(this.state.scheduleTeacherClassIds) && this.state.scheduleTeacherClassIds.length > 0) {
                const selected = lib.filter(c => this.state.scheduleTeacherClassIds.includes(c.id));
                if (selected.length > 0) return selected;
            }

            // 智能匹配 state.classes 中配置的班级名称
            const appClasses = (this.state.classes || []).map(c => String(c.name || '').trim()).filter(Boolean);
            if (appClasses.length > 0) {
                const matched = lib.filter(c => {
                    return appClasses.some(appClsName => {
                        if (c.name === appClsName || c.shortName === appClsName) return true;
                        const num1 = c.name.replace(/[^0-9一二三四五六七八九十]/g, '');
                        const num2 = appClsName.replace(/[^0-9一二三四五六七八九十]/g, '');
                        if (num1 && num2 && num1 === num2) {
                            const grade1 = c.grade || (c.name.includes('初') ? '初' : (c.name.includes('高') ? '高' : ''));
                            const grade2 = appClsName.includes('初') ? '初' : (appClsName.includes('高') ? '高' : '');
                            if (!grade1 || !grade2 || grade1 === grade2) return true;
                        }
                        return false;
                    });
                });
                if (matched.length > 0) return matched;
            }

            // 默认返回前 2 个班级（双班）
            return lib.slice(0, 2);
        }

        setScheduleTeacherClassIds(classIds) {
            this.state.scheduleTeacherClassIds = Array.isArray(classIds) ? classIds : [];
            this._scheduleStorageSave();
            this._notify('SCHEDULE_TEACHER_CLASSES_CHANGED', {
                teacherClassIds: this.state.scheduleTeacherClassIds,
                schedule: this.getActiveSchedule()
            });
            return true;
        }

        toggleScheduleTeacherClass(classId) {
            const current = this.getScheduleTeacherClasses().map(c => c.id);
            const idx = current.indexOf(classId);
            let next;
            if (idx >= 0) {
                if (current.length <= 1) {
                    return false; // 至少保留一个班级
                }
                next = current.filter(id => id !== classId);
            } else {
                next = [...current, classId];
            }
            return this.setScheduleTeacherClassIds(next);
        }

        getCombinedSchedule(targetSubject) {
            const subject = String(targetSubject || this.getScheduleTeacherSubject() || '英语').trim();
            const classes = this.getScheduleTeacherClasses();
            const lib = this.getScheduleLibrary();
            const effectiveClasses = classes.length > 0 ? classes : (lib.length > 0 ? lib : [this.getSchedule()]);

            // 获取基准天数和节次
            const baseClass = effectiveClasses[0] || {};
            const days = (baseClass.days && baseClass.days.length > 0) ? baseClass.days : (INITIAL_SCHEDULE_DAYS || []);
            const periods = (baseClass.periods && baseClass.periods.length > 0) ? baseClass.periods : (INITIAL_SCHEDULE_PERIODS || []);

            const combinedGrid = {};
            const classStats = {};
            let totalLessons = 0;

            effectiveClasses.forEach((c, idx) => {
                classStats[c.id] = {
                    id: c.id,
                    name: c.name || c.shortName || `班级${idx + 1}`,
                    shortName: c.shortName || (c.name ? c.name.replace(/[^0-9一二三四五六七八九十]/g, '') : '') || `${idx + 1}班`,
                    teacher: c.teacher || '',
                    grade: c.grade || '',
                    count: 0
                };
            });
            // 规范化目标科目单字与全称
            const targetNorm = (window.TWS3?.scheduleWorkbook?.normalizeSubject)
                ? window.TWS3.scheduleWorkbook.normalizeSubject(subject)
                : null;
            const targetChar = targetNorm ? targetNorm.char : subject.charAt(0);
            const targetFull = targetNorm ? targetNorm.fullName : subject;

            function isMatchSubject(cell) {
                if (!cell) return false;
                const cellChar = cell.char || cell.name || '';
                const cellFull = cell.fullName || '';
                if (cellChar === targetChar || cellChar === subject || cellChar === targetFull) return true;
                if (cellFull === targetFull || cellFull === subject || (cellFull && cellFull.includes(subject))) return true;
                if (cell.name === targetChar || cell.name === targetFull || cell.name === subject) return true;
                if (cell.customName && cell.customName.includes(subject)) return true;
                if (cell.courseId && subject === '英语' && (cell.courseId === 'c_yy' || cell.courseId.includes('yy'))) return true;
                return false;
            }

            // 遍历所有星期和节次，聚合所有班级在该时段的排课
            days.forEach(day => {
                periods.forEach(p => {
                    const pName = String(p.name || p.id || '').replace(/^p_/, '');
                    const matchedClasses = [];

                    classes.forEach((cls, classIdx) => {
                        const grid = cls.grid || {};
                        let cell = grid[`${day.id}_${p.id}`] || grid[`${day.id}_p_${pName}`] || grid[`${day.id}_${pName}`];
                        if (isMatchSubject(cell)) {
                            matchedClasses.push({
                                classId: cls.id,
                                 className: cls.name || cls.shortName,
                                classShortName: cls.shortName || (cls.name ? cls.name.replace(/[^0-9一二三四五六七八九十]/g, '') : `${classIdx + 1}班`),
                                classIndex: classIdx,
                                teacher: cls.teacher || '',
                                grade: cls.grade || '',
                                cell
                            });
                            if (classStats[cls.id]) {
                                classStats[cls.id].count++;
                            }
                            totalLessons++;
                        }
                    });

                    const key = `${day.id}_${p.id}`;
                    if (matchedClasses.length === 1) {
                        const m = matchedClasses[0];
                        combinedGrid[key] = {
                            type: 'single',
                            classId: m.classId,
                            className: m.className,
                            classShortName: m.classShortName,
                            classIndex: m.classIndex,
                            teacher: m.teacher,
                            grade: m.grade,
                            courseId: m.cell.courseId,
                            name: m.cell.name || targetChar,
                            char: m.cell.char || targetChar,
                            fullName: m.cell.fullName || targetFull,
                            color: m.cell.color || 'english',
                            customName: m.cell.customName || '',
                            timeSlot: p.time || ''
                        };
                    } else if (matchedClasses.length > 1) {
                        combinedGrid[key] = {
                            type: 'multi',
                            isConflict: false,
                            classes: matchedClasses,
                            classNames: matchedClasses.map(c => c.className).join('、'),
                            shortClassNames: matchedClasses.map(c => c.classShortName).join(' · '),
                            teachers: matchedClasses.map(c => c.teacher).filter(Boolean).join('、'),
                            name: targetChar,
                            char: targetChar,
                            fullName: targetFull,
                            color: 'english',
                            timeSlot: p.time || ''
                        };
                    }
                });
            });

            const classList = Object.values(classStats);
            const classNamesStr = classList.map(c => c.shortName || c.name).join(' + ');

            return {
                id: 'combined',
                isCombined: true,
                subject,
                subjectChar: targetChar,
                subjectFullName: targetFull,
                name: '双班任课课表',
                shortName: `任课总览 (${classNamesStr})`,
                grade: `${classNamesStr} · ${targetFull}`,
                sheet: '总览',
                teacher: classList.map(c => c.teacher).filter(Boolean).join(' / ') || '任课教师',
                days,
                periods,
                lunchBreak: baseClass.lunchBreak || { enabled: true, afterPeriod: 4, name: '午间休息' },
                grid: combinedGrid,
                totalCourses: totalLessons,
                classStats: classList,
                updatedAt: getUtcNowIso()
            };
        }

        getActiveSchedule() {
            if (this.isCombinedScheduleMode()) {
                return this.getCombinedSchedule();
            }
            const lib = this.getScheduleLibrary();
            if (lib && lib.length > 0) {
                const selectedId = this.getSelectedScheduleClassId();
                const found = lib.find(c => c.id === selectedId || c.shortName === selectedId || c.name === selectedId);
                if (found) return found;
                // 若未直接匹配，尝试模糊匹配当前班级名称
                const currentName = this.state.currentClass || '';
                const match = lib.find(c => c.name === currentName || (c.shortName && currentName.includes(c.shortName)));
                if (match) return match;
                return lib[0];
            }
            // 降级为当前班级本身的内置 schedule
            return this.getSchedule();
        }

        importScheduleLibrary(payload) {
            if (!payload || !Array.isArray(payload.classes) || payload.classes.length === 0) {
                return false;
            }
            this.state.scheduleLibrary = payload.classes;
            this.state.scheduleLibraryTitle = payload.title || '学校课程表';

            // 智能设置默认选中的班级：优先匹配当前班级
            const currentClassName = this.state.currentClass || '';
            const matching = payload.classes.find(c => c.name === currentClassName || (c.shortName && currentClassName.includes(c.shortName)));
            this.state.selectedScheduleClassId = matching ? matching.id : payload.classes[0].id;

            // 若当前班级有匹配课表，同步更新当前班级课表
            if (matching) {
                this.setSchedule({
                    templateVersion: 2,
                    days: matching.days,
                    periods: matching.periods,
                    courseLibrary: matching.courseLibrary,
                    grid: matching.grid,
                    lunchBreak: matching.lunchBreak,
                    teacher: matching.teacher,
                    updatedAt: getUtcNowIso()
                });
            }

            this._scheduleStorageSave();
            this._notify('SCHEDULE_LIBRARY_UPDATED', {
                title: this.state.scheduleLibraryTitle,
                classes: this.state.scheduleLibrary,
                selectedClassId: this.state.selectedScheduleClassId,
                schedule: this.getActiveSchedule()
            });
            return true;
        }

        clearScheduleLibrary() {
            this.state.scheduleLibrary = [];
            this.state.scheduleLibraryTitle = '';
            this.state.selectedScheduleClassId = '';
            this._scheduleStorageSave();
            this._notify('SCHEDULE_LIBRARY_UPDATED', {
                title: '',
                classes: [],
                selectedClassId: '',
                schedule: this.getActiveSchedule()
            });
            return true;
        }

        // 班干部表 (Officer Table) 相关 API
        // ==========================================
        getOfficerTable() {
            if (!this.state.officerTable) {
                this.state.officerTable = JSON.parse(JSON.stringify(INITIAL_OFFICERS));
            }
            return this.state.officerTable;
        }

        setOfficerTable(officerData) {
            if (!officerData || typeof officerData !== 'object') return false;
            this.state.officerTable = JSON.parse(JSON.stringify(officerData));
            this.state.officerTable.updatedAt = getUtcNowIso();
            this._notify('OFFICERS_CHANGED', { officerTable: this.state.officerTable });
            return true;
        }

        addOfficerRole(name) {
            const trimmed = String(name || '').trim();
            if (!trimmed) return null;
            const table = this.getOfficerTable();
            const newId = generateId('role');
            const newRole = {
                id: newId,
                name: trimmed,
                order: table.roles.length + 1,
                students: [] // [{ studentId, nameSnapshot }]
            };
            table.roles.push(newRole);
            table.updatedAt = getUtcNowIso();
            this._notify('OFFICERS_CHANGED', { officerTable: table });
            return newRole;
        }

        updateOfficerRole(roleId, updates = {}) {
            const table = this.getOfficerTable();
            const role = table.roles.find(r => r.id === roleId);
            if (!role) return false;
            if (updates.name !== undefined) role.name = String(updates.name || '').trim();
            table.updatedAt = getUtcNowIso();
            this._notify('OFFICERS_CHANGED', { officerTable: table });
            return true;
        }

        removeOfficerRole(roleId) {
            const table = this.getOfficerTable();
            const idx = table.roles.findIndex(r => r.id === roleId);
            if (idx === -1) return false;
            table.roles.splice(idx, 1);
            table.updatedAt = getUtcNowIso();
            this._notify('OFFICERS_CHANGED', { officerTable: table });
            return true;
        }

        reorderOfficerRoles(roleIds) {
            if (!Array.isArray(roleIds)) return false;
            const table = this.getOfficerTable();
            const rMap = new Map(table.roles.map(r => [r.id, r]));
            const reordered = [];
            roleIds.forEach((id, idx) => {
                if (rMap.has(id)) {
                    const r = rMap.get(id);
                    r.order = idx + 1;
                    reordered.push(r);
                    rMap.delete(id);
                }
            });
            rMap.forEach(r => {
                r.order = reordered.length + 1;
                reordered.push(r);
            });
            table.roles = reordered;
            table.updatedAt = getUtcNowIso();
            this._notify('OFFICERS_CHANGED', { officerTable: table });
            return true;
        }

        setRoleStudents(roleId, studentList = []) {
            const table = this.getOfficerTable();
            const role = table.roles.find(r => r.id === roleId);
            if (!role) return false;

            // 职位内去重
            const seen = new Set();
            const normalized = [];
            (studentList || []).forEach(item => {
                const sId = String(item.studentId || item.id);
                if (sId && !seen.has(sId)) {
                    seen.add(sId);
                    normalized.push({
                        studentId: item.studentId || item.id,
                        nameSnapshot: item.nameSnapshot || item.name || ''
                    });
                }
            });
            role.students = normalized;
            table.updatedAt = getUtcNowIso();
            this._notify('OFFICERS_CHANGED', { officerTable: table });
            return true;
        }

        // ==========================================
        // 值日生表 (Duty Table) 相关 API
        // ==========================================
        getDutyTable() {
            if (!this.state.dutyTable) {
                this.state.dutyTable = JSON.parse(JSON.stringify(INITIAL_DUTY));
            }
            return this.state.dutyTable;
        }

        setDutyTable(dutyData) {
            if (!dutyData || typeof dutyData !== 'object') return false;
            this.state.dutyTable = JSON.parse(JSON.stringify(dutyData));
            this.state.dutyTable.updatedAt = getUtcNowIso();
            this._notify('DUTY_CHANGED', { dutyTable: this.state.dutyTable });
            return true;
        }

        addDutyDay(name) {
            const trimmed = String(name || '').trim();
            if (!trimmed) return null;
            const table = this.getDutyTable();
            const newId = generateId('dday');
            const newDay = {
                id: newId,
                name: trimmed,
                order: table.days.length + 1
            };
            table.days.push(newDay);
            table.updatedAt = getUtcNowIso();
            this._notify('DUTY_CHANGED', { dutyTable: table });
            return newDay;
        }

        updateDutyDay(dayId, updates = {}) {
            const table = this.getDutyTable();
            const day = table.days.find(d => d.id === dayId);
            if (!day) return false;
            if (updates.name !== undefined) day.name = String(updates.name || '').trim();
            table.updatedAt = getUtcNowIso();
            this._notify('DUTY_CHANGED', { dutyTable: table });
            return true;
        }

        removeDutyDay(dayId) {
            const table = this.getDutyTable();
            const idx = table.days.findIndex(d => d.id === dayId);
            if (idx === -1) return false;
            table.days.splice(idx, 1);
            if (table.assignments) {
                Object.keys(table.assignments).forEach(key => {
                    if (key.startsWith(dayId + '_')) delete table.assignments[key];
                });
            }
            table.updatedAt = getUtcNowIso();
            this._notify('DUTY_CHANGED', { dutyTable: table });
            return true;
        }

        reorderDutyDays(dayIds) {
            if (!Array.isArray(dayIds)) return false;
            const table = this.getDutyTable();
            const dMap = new Map(table.days.map(d => [d.id, d]));
            const reordered = [];
            dayIds.forEach((id, idx) => {
                if (dMap.has(id)) {
                    const d = dMap.get(id);
                    d.order = idx + 1;
                    reordered.push(d);
                    dMap.delete(id);
                }
            });
            dMap.forEach(d => {
                d.order = reordered.length + 1;
                reordered.push(d);
            });
            table.days = reordered;
            table.updatedAt = getUtcNowIso();
            this._notify('DUTY_CHANGED', { dutyTable: table });
            return true;
        }

        addDutyRole(name) {
            const trimmed = String(name || '').trim();
            if (!trimmed) return null;
            const table = this.getDutyTable();
            const newId = generateId('drole');
            const newRole = {
                id: newId,
                name: trimmed,
                order: table.roles.length + 1
            };
            table.roles.push(newRole);
            table.updatedAt = getUtcNowIso();
            this._notify('DUTY_CHANGED', { dutyTable: table });
            return newRole;
        }

        updateDutyRole(roleId, updates = {}) {
            const table = this.getDutyTable();
            const role = table.roles.find(r => r.id === roleId);
            if (!role) return false;
            if (updates.name !== undefined) role.name = String(updates.name || '').trim();
            table.updatedAt = getUtcNowIso();
            this._notify('DUTY_CHANGED', { dutyTable: table });
            return true;
        }

        removeDutyRole(roleId) {
            const table = this.getDutyTable();
            const idx = table.roles.findIndex(r => r.id === roleId);
            if (idx === -1) return false;
            table.roles.splice(idx, 1);
            if (table.assignments) {
                Object.keys(table.assignments).forEach(key => {
                    if (key.endsWith('_' + roleId)) delete table.assignments[key];
                });
            }
            table.updatedAt = getUtcNowIso();
            this._notify('DUTY_CHANGED', { dutyTable: table });
            return true;
        }

        reorderDutyRoles(roleIds) {
            if (!Array.isArray(roleIds)) return false;
            const table = this.getDutyTable();
            const rMap = new Map(table.roles.map(r => [r.id, r]));
            const reordered = [];
            roleIds.forEach((id, idx) => {
                if (rMap.has(id)) {
                    const r = rMap.get(id);
                    r.order = idx + 1;
                    reordered.push(r);
                    rMap.delete(id);
                }
            });
            rMap.forEach(r => {
                r.order = reordered.length + 1;
                reordered.push(r);
            });
            table.roles = reordered;
            table.updatedAt = getUtcNowIso();
            this._notify('DUTY_CHANGED', { dutyTable: table });
            return true;
        }

        setDutyAssignment(dayId, roleId, studentList = []) {
            const table = this.getDutyTable();
            if (!table.assignments) table.assignments = {};
            const key = `${dayId}_${roleId}`;

            // 单单元格内去重
            const seen = new Set();
            const normalized = [];
            (studentList || []).forEach(item => {
                const sId = String(item.studentId || item.id);
                if (sId && !seen.has(sId)) {
                    seen.add(sId);
                    normalized.push({
                        studentId: item.studentId || item.id,
                        nameSnapshot: item.nameSnapshot || item.name || ''
                    });
                }
            });
            table.assignments[key] = normalized;
            table.updatedAt = getUtcNowIso();
            this._notify('DUTY_CHANGED', { dutyTable: table });
            return normalized;
        }

        // ==========================================
        // 学生显示名称解析（用于班干部与值日生表）
        // ==========================================
        resolveStudentDisplay(item) {
            if (!item) return { studentId: '', studentNo: '', name: '未知', isDeparted: true };
            const studentId = item.studentId !== undefined ? item.studentId : item.id;
            const student = (this.state.students || []).find(s => String(s.id) === String(studentId));
            if (student) {
                return {
                    studentId: student.id,
                    studentNo: student.studentNo || String(student.id),
                    name: student.name,
                    isDeparted: false
                };
            }
            return {
                studentId: studentId,
                studentNo: '',
                name: item.nameSnapshot || item.name || '已离班学生',
                isDeparted: true
            };
        }

        getSeatLayout() {
            if (!Array.isArray(this.state.seatLayout)) {
                this.state.seatLayout = createDefaultSeatLayout(this.state.students);
            }
            return this.state.seatLayout;
        }

        setSeatLayout(layout, groupNames) {
            const validIds = new Set(this.state.students.map(student => String(student.id)));
            const usedIds = new Set();
            const usedSlots = new Set();
            const normalized = [];

            (layout || []).forEach(item => {
                const student = this.state.students.find(entry => String(entry.id) === String(item.studentId));
                const row = Number(item.row);
                const group = Number(item.group);
                const side = Number(item.side);
                const slotKey = `${row}:${group}:${side}`;
                if (!student || !validIds.has(String(student.id)) || usedIds.has(String(student.id)) || usedSlots.has(slotKey)) return;
                if (!Number.isInteger(row) || row < 0 || !Number.isInteger(group) || group < 0 || group > 3 || (side !== 0 && side !== 1)) return;
                usedIds.add(String(student.id));
                usedSlots.add(slotKey);
                normalized.push({ studentId: student.id, row, group, side });
            });

            let cursor = 0;
            this.state.students.forEach(student => {
                if (usedIds.has(String(student.id))) return;
                while (usedSlots.has(`${Math.floor(cursor / 8)}:${Math.floor((cursor % 8) / 2)}:${cursor % 2}`)) cursor++;
                const row = Math.floor(cursor / 8);
                const group = Math.floor((cursor % 8) / 2);
                const side = cursor % 2;
                normalized.push({ studentId: student.id, row, group, side });
                usedSlots.add(`${row}:${group}:${side}`);
                cursor++;
            });

            this.state.seatLayout = normalized;
            if (Array.isArray(groupNames) && groupNames.length === 4) {
                this.state.seatGroupNames = groupNames.map((name, index) => String(name || `第${index + 1}组`));
            }
            this.state.seatLayoutUpdatedAt = getUtcNowIso();
            this._notify('SEAT_LAYOUT_CHANGED', { count: normalized.length });
            return normalized;
        }

        setSeatPodiumPosition(position) {
            const normalized = position === 'top' ? 'top' : 'bottom';
            if (this.state.seatPodiumPosition === normalized) return;
            this.state.seatPodiumPosition = normalized;
            this.state.seatLayoutUpdatedAt = getUtcNowIso();
            this._notify('SEAT_PODIUM_CHANGED', { position: normalized });
        }

        setOperationMode(mode) {
            if (mode !== 'check' && mode !== 'grade') return;
            if (this.state.operationMode === mode) return;
            this.state.operationMode = mode;
            this._notify('OPERATION_MODE_CHANGED', { mode });
        }

        getCurrentTask() {
            return this.state.tasks.find(t => t.id === this.state.currentTaskId) || this.state.tasks[0];
        }

        isEnglishTask(task = this.getCurrentTask()) {
            if (!task) return false;
            return task.subject === '英语' || (!task.subject && /英语/.test(task.name));
        }

        getStudentRecords(taskId = this.state.currentTaskId) {
            if (!this.state.records[taskId]) {
                this.state.records[taskId] = {};
                const now = getUtcNowIso();
                const task = this.state.tasks.find(t => t.id === taskId);
                const isEnglish = this.isEnglishTask(task);
                for (const s of this.state.students) {
                    const defaultStatus = (isEnglish && s.isNonEnglish) ? 'muted' : 'white';
                    this.state.records[taskId][s.id] = { status: defaultStatus, badge: null, score: null, note: null, updatedAt: now };
                }
            }
            return this.state.records[taskId];
        }

        getStudentRecord(studentId, taskId = this.state.currentTaskId) {
            const records = this.getStudentRecords(taskId);
            if (!records[studentId]) {
                records[studentId] = { status: 'white', badge: null, score: null, note: null, updatedAt: getUtcNowIso() };
            }
            return records[studentId];
        }

        setCurrentTask(taskId) {
            if (this.state.currentTaskId === taskId) return;
            this.state.currentTaskId = taskId;
            const activeClass = this.state.classes?.find(c => c.id === this.state.currentClassId);
            if (activeClass) {
                activeClass.currentTaskId = taskId;
            }
            this.getStudentRecords(taskId);
            this._notify('TASK_CHANGED', { taskId });
        }

        addTaskToClasses(name, subject = '未设置', classIds = [this.state.currentClassId]) {
            const trimmed = (name || '').trim();
            if (!trimmed) return null;

            const finalSubject = subject && subject !== '未设置' ? subject : inferSubjectFromName(trimmed);
            const now = getUtcNowIso();
            const id = generateId('task');
            const requestedIds = new Set(Array.isArray(classIds) ? classIds : [classIds]);
            const targetClasses = (this.state.classes || []).filter(cls => requestedIds.has(cls.id));
            if (targetClasses.length === 0) {
                const activeClass = this.state.classes?.find(cls => cls.id === this.state.currentClassId);
                if (activeClass) targetClasses.push(activeClass);
            }

            let activeTask = null;
            targetClasses.forEach(cls => {
                const newTask = {
                    id,
                    assignmentGroupId: id,
                    name: trimmed,
                    subject: finalSubject,
                    archived: false,
                    createdAt: now,
                    updatedAt: now
                };
                cls.tasks.unshift(newTask);
                cls.records[id] = {};
                const isEnglish = finalSubject === '英语' || (finalSubject === '未设置' && /英语/.test(trimmed));
                cls.students.forEach(student => {
                    const defaultStatus = isEnglish && student.isNonEnglish ? 'muted' : 'white';
                    cls.records[id][student.id] = {
                        status: defaultStatus,
                        badge: null,
                        score: null,
                        note: null,
                        updatedAt: now
                    };
                });
                if (cls.id === this.state.currentClassId) {
                    cls.currentTaskId = id;
                    activeTask = newTask;
                }
            });

            this._syncActiveClassPointers(this.state);
            this._notify('TASK_ADDED', {
                task: activeTask || targetClasses[0]?.tasks[0] || null,
                classIds: targetClasses.map(cls => cls.id)
            });
            return {
                task: activeTask || targetClasses[0]?.tasks[0] || null,
                classIds: targetClasses.map(cls => cls.id)
            };
        }

        addTask(name, subject = '未设置') {
            const result = this.addTaskToClasses(name, subject, [this.state.currentClassId]);
            return result ? result.task : null;
        }

        updateTaskName(taskId, newName) {
            const trimmed = (newName || '').trim();
            if (!trimmed) return false;
            const task = this.state.tasks.find(t => t.id === taskId);
            if (!task) return false;
            task.name = trimmed;
            if (!task.subject || task.subject === '未设置') {
                task.subject = inferSubjectFromName(trimmed);
            }
            task.updatedAt = getUtcNowIso();
            this._notify('TASK_RENAMED', { taskId, name: trimmed });
            return true;
        }

        setTaskSubject(taskId, subject) {
            const task = this.state.tasks.find(t => t.id === taskId);
            if (!task) return false;
            const normalized = (subject || '').trim() || '未设置';
            if (task.subject === normalized) return true;
            task.subject = normalized;
            task.updatedAt = getUtcNowIso();

            if (this.isEnglishTask(task) && this.state.records[taskId]) {
                const taskRecs = this.state.records[taskId];
                this.state.students.forEach(s => {
                    if (s.isNonEnglish && (!taskRecs[s.id] || taskRecs[s.id].status === 'white')) {
                        if (!taskRecs[s.id]) {
                            taskRecs[s.id] = { status: 'muted', badge: null, score: null, note: null, updatedAt: getUtcNowIso() };
                        } else if (!taskRecs[s.id].badge && taskRecs[s.id].score === null) {
                            taskRecs[s.id].status = 'muted';
                            taskRecs[s.id].updatedAt = getUtcNowIso();
                        }
                    }
                });
            }

            this._notify('TASK_SUBJECT_CHANGED', { taskId, subject: normalized });
            return true;
        }

        deleteTask(taskId) {
            if (this.state.tasks.length <= 1) {
                return { success: false, reason: '至少需保留一个作业任务' };
            }
            const taskIndex = this.state.tasks.findIndex(t => t.id === taskId);
            if (taskIndex === -1) return { success: false, reason: '任务不存在' };

            const [deletedTask] = this.state.tasks.splice(taskIndex, 1);
            const now = getUtcNowIso();
            deletedTask.deletedAt = now;
            deletedTask.updatedAt = now;

            if (!this.state.deletedTasks) this.state.deletedTasks = [];
            this.state.deletedTasks.push(deletedTask);

            if (this.state.records[taskId]) {
                delete this.state.records[taskId];
            }

            if (this.state.currentTaskId === taskId) {
                this.state.currentTaskId = this.state.tasks[0].id;
                const activeClass = this.state.classes?.find(c => c.id === this.state.currentClassId);
                if (activeClass) {
                    activeClass.currentTaskId = this.state.currentTaskId;
                }
            }
            this._notify('TASK_DELETED', { taskId, task: deletedTask });
            return { success: true };
        }

        toggleArchiveTask(taskId) {
            const task = this.state.tasks.find(t => t.id === taskId);
            if (!task) return;
            task.archived = !task.archived;
            task.updatedAt = getUtcNowIso();
            this._notify('TASK_ARCHIVE_TOGGLED', { taskId, archived: task.archived });
        }

        archiveTask(taskId) {
            const task = this.state.tasks.find(t => t.id === taskId);
            if (!task || task.archived) return;
            task.archived = true;
            task.updatedAt = getUtcNowIso();
            this._notify('TASK_ARCHIVE_TOGGLED', { taskId, archived: true });
        }

        unarchiveTask(taskId) {
            const task = this.state.tasks.find(t => t.id === taskId);
            if (!task || !task.archived) return;
            task.archived = false;
            task.updatedAt = getUtcNowIso();
            this._notify('TASK_ARCHIVE_TOGGLED', { taskId, archived: false });
        }

        cycleStudentStatus(studentId) {
            return this.cycleStudentRecord(studentId, this.state.currentTaskId);
        }

        cycleStudentRecord(studentId, taskId = this.state.currentTaskId) {
            const task = this.state.tasks.find(t => t.id === taskId) || this.getCurrentTask();
            if (task && task.archived) return false;
            const isEnglish = this.isEnglishTask(task);
            const student = this.state.students.find(s => s.id === studentId);
            const isNonEnglish = student && !!student.isNonEnglish;

            const record = this.getStudentRecord(studentId, taskId);

            // 单击仅二态切换：dark 与 该学生的默认未提交态（英语作业免交生为 muted，普通生为 white），
            // 不再出现 white→dark→muted 三态循环。
            record.status = record.status === 'dark'
                ? ((isEnglish && isNonEnglish) ? 'muted' : 'white')
                : 'dark';
            record.updatedAt = getUtcNowIso();
            this._notify('STUDENT_STATUS_CHANGED', { studentId, taskId, status: record.status });
            return true;
        }

        setStudentNonEnglish(studentId, isNonEnglish) {
            const student = this.state.students.find(s => s.id === studentId);
            if (!student) return false;
            const boolVal = !!isNonEnglish;
            student.isNonEnglish = boolVal;
            student.updatedAt = getUtcNowIso();

            // 若当前作业为英语作业，联动更新未修改记录的状态
            const curTask = this.getCurrentTask();
            if (this.isEnglishTask(curTask)) {
                const rec = this.getStudentRecord(studentId);
                if (boolVal && rec.status === 'white' && !rec.badge && rec.score === null) {
                    rec.status = 'muted';
                    rec.updatedAt = getUtcNowIso();
                } else if (!boolVal && rec.status === 'muted' && !rec.badge && rec.score === null) {
                    rec.status = 'white';
                    rec.updatedAt = getUtcNowIso();
                }
            }

            this._notify('STUDENT_NON_ENGLISH_CHANGED', { studentId, isNonEnglish: boolVal });
            return true;
        }

        updateStudent(studentId, { name, studentNo, isNonEnglish }) {
            const student = this.state.students.find(s => s.id === studentId);
            if (!student) return false;
            if (name !== undefined) student.name = String(name || '').trim();
            if (studentNo !== undefined) student.studentNo = String(studentNo || '').trim();
            if (isNonEnglish !== undefined) this.setStudentNonEnglish(studentId, isNonEnglish);
            student.updatedAt = getUtcNowIso();
            this._notify('STUDENT_UPDATED', { studentId, student });
            return true;
        }

        addStudent({ name, studentNo, isNonEnglish }) {
            const trimmedName = String(name || '').trim();
            if (!trimmedName) return null;
            const nextId = this.state.students.reduce((max, s) => Math.max(max, Number(s.id) || 0), 0) + 1;
            const newStudent = {
                id: nextId,
                studentNo: String(studentNo || nextId).trim(),
                name: trimmedName,
                isNonEnglish: !!isNonEnglish,
                updatedAt: getUtcNowIso()
            };
            this.state.students.push(newStudent);

            const occupied = new Set(this.getSeatLayout().map(item => `${item.row}:${item.group}:${item.side}`));
            let seatIndex = 0;
            while (occupied.has(`${Math.floor(seatIndex / 8)}:${Math.floor((seatIndex % 8) / 2)}:${seatIndex % 2}`)) seatIndex++;
            this.state.seatLayout.push({
                studentId: newStudent.id,
                row: Math.floor(seatIndex / 8),
                group: Math.floor((seatIndex % 8) / 2),
                side: seatIndex % 2
            });
            this.state.seatLayoutUpdatedAt = getUtcNowIso();

            const now = getUtcNowIso();
            this.state.tasks.forEach(t => {
                if (!this.state.records[t.id]) this.state.records[t.id] = {};
                const defaultStatus = (this.isEnglishTask(t) && newStudent.isNonEnglish) ? 'muted' : 'white';
                this.state.records[t.id][newStudent.id] = {
                    status: defaultStatus,
                    badge: null,
                    score: null,
                    note: null,
                    updatedAt: now
                };
            });

            this._notify('STUDENT_ADDED', { student: newStudent });
            return newStudent;
        }

        deleteStudent(studentId) {
            if (this.state.students.length <= 1) {
                return { success: false, reason: '至少需保留一名学生' };
            }
            const idx = this.state.students.findIndex(s => s.id === studentId);
            if (idx === -1) return { success: false, reason: '学生不存在' };

            const [deleted] = this.state.students.splice(idx, 1);
            this.state.seatLayout = this.getSeatLayout().filter(item => String(item.studentId) !== String(studentId));
            this.state.seatLayoutUpdatedAt = getUtcNowIso();
            const now = getUtcNowIso();
            deleted.deletedAt = now;
            deleted.updatedAt = now;
            if (!this.state.deletedStudents) this.state.deletedStudents = [];
            this.state.deletedStudents.push(deleted);

            this._notify('STUDENT_DELETED', { studentId, student: deleted });
            return { success: true };
        }

        setStudentBadge(studentId, badgeText) {
            const record = this.getStudentRecord(studentId);
            const trimmed = badgeText ? String(badgeText).trim() : null;
            record.badge = trimmed;
            record.updatedAt = getUtcNowIso();
            this._notify('STUDENT_BADGE_CHANGED', { studentId, badge: record.badge });
        }

        clearStudentBadge(studentId) {
            const record = this.getStudentRecord(studentId);
            record.badge = null;
            record.score = null;
            record.note = null;
            record.updatedAt = getUtcNowIso();
            this._notify('STUDENT_BADGE_CHANGED', { studentId, badge: null });
        }

        updateStudentRecord(studentId, { status, badge, score, note }, taskId = this.state.currentTaskId) {
            const record = this.getStudentRecord(studentId, taskId);
            if (status !== undefined) record.status = status;
            if (badge !== undefined) record.badge = badge;
            if (score !== undefined) record.score = score;
            if (note !== undefined) record.note = note;
            record.updatedAt = getUtcNowIso();
            this._notify('STUDENT_RECORD_UPDATED', { studentId, taskId, record });
        }

        resetCurrentTaskRoster() {
            const currentRecords = this.getStudentRecords();
            const now = getUtcNowIso();
            for (const s of this.state.students) {
                currentRecords[s.id] = { status: 'white', badge: null, score: null, note: null, updatedAt: now };
            }
            this._notify('ROSTER_RESET', { taskId: this.state.currentTaskId });
        }

        switchClass(targetIdOrName) {
            if (!this.state.classes || this.state.classes.length === 0) return null;
            let targetClass = this.state.classes.find(c => c.id === targetIdOrName || c.name === targetIdOrName);
            if (!targetClass && (targetIdOrName === 0 || targetIdOrName === 1 || targetIdOrName === '0' || targetIdOrName === '1')) {
                targetClass = this.state.classes[Number(targetIdOrName)];
            }
            if (!targetClass) {
                targetClass = this.state.classes.find(c => c.id !== this.state.currentClassId) || this.state.classes[0];
            }
            if (!targetClass) return null;

            this.state.currentClassId = targetClass.id;
            this._syncActiveClassPointers(this.state);
            this._notify('CLASS_CHANGED', { classId: targetClass.id, className: targetClass.name });
            return targetClass;
        }

        renameClass(classId, newName) {
            const trimmed = String(newName || '').trim();
            if (!trimmed) return false;
            if (!this.state.classes) return false;
            const cls = this.state.classes.find(c => c.id === classId);
            if (!cls) return false;
            cls.name = trimmed;
            cls.classUpdatedAt = getUtcNowIso();
            if (cls.id === this.state.currentClassId) {
                this.state.currentClass = trimmed;
                this.state.classUpdatedAt = cls.classUpdatedAt;
            }
            this._notify('CLASS_CHANGED', { classId: cls.id, className: cls.name });
            return true;
        }

        getClasses() {
            if (!this.state.classes) return [];
            return this.state.classes.map(c => ({
                id: c.id,
                name: c.name,
                studentCount: (c.students || []).length,
                taskCount: (c.tasks || []).length,
                isCurrent: c.id === this.state.currentClassId
            }));
        }

        getCurrentClassId() {
            return this.state.currentClassId || (this.state.classes && this.state.classes[0] ? this.state.classes[0].id : 'class_1');
        }

        getTaskComparison(taskId = this.state.currentTaskId, mode = this.state.operationMode) {
            const sourceTask = this.state.tasks.find(task => task.id === taskId) || this.getCurrentTask();
            if (!sourceTask) return { task: null, classes: [] };
            const normalizedName = normalizeTaskName(sourceTask.name);

            const classes = (this.state.classes || []).map(cls => {
                const matchedTask = cls.tasks.find(task =>
                    (sourceTask.assignmentGroupId && task.assignmentGroupId === sourceTask.assignmentGroupId) ||
                    task.id === sourceTask.id
                ) || cls.tasks.find(task =>
                    normalizeTaskName(task.name) === normalizedName &&
                    (task.subject || '未设置') === (sourceTask.subject || '未设置')
                );
                if (!matchedTask) {
                    return {
                        id: cls.id,
                        name: cls.name,
                        isCurrent: cls.id === this.state.currentClassId,
                        taskId: null,
                        total: cls.students.length,
                        submitted: 0,
                        graded: 0,
                        exempt: 0,
                        required: cls.students.length,
                        percentage: 0
                    };
                }

                const taskRecords = cls.records[matchedTask.id] || {};
                const isEnglish = matchedTask.subject === '英语' ||
                    (!matchedTask.subject && /英语/.test(matchedTask.name));
                let submitted = 0;
                let graded = 0;
                let exempt = 0;
                cls.students.forEach(student => {
                    const record = taskRecords[student.id];
                    if (record && record.status === 'dark') {
                        submitted++;
                    }
                    if (record && ((record.score !== null && record.score !== undefined && record.score !== '') || (record.badge && String(record.badge).trim())) && record.status !== 'muted') {
                        graded++;
                    }
                    if (isEnglish && student.isNonEnglish && (!record || record.status === 'muted')) {
                        exempt++;
                    }
                });
                const required = Math.max(0, cls.students.length - exempt);
                const completed = mode === 'grade' ? graded : submitted;
                const percentage = required > 0 ? (completed / required) * 100 : (cls.students.length ? 100 : 0);
                return {
                    id: cls.id,
                    name: cls.name,
                    isCurrent: cls.id === this.state.currentClassId,
                    taskId: matchedTask.id,
                    total: cls.students.length,
                    submitted,
                    graded,
                    exempt,
                    required,
                    percentage: Math.min(100, percentage)
                };
            });
            return { task: sourceTask, classes };
        }

        switchClassForTask(classId, taskId = this.state.currentTaskId) {
            const comparison = this.getTaskComparison(taskId);
            const targetSummary = comparison.classes.find(cls => cls.id === classId);
            const targetClass = this.state.classes?.find(cls => cls.id === classId);
            if (!targetClass) return null;
            if (targetSummary?.taskId) targetClass.currentTaskId = targetSummary.taskId;
            this.state.currentClassId = targetClass.id;
            this._syncActiveClassPointers(this.state);
            this._notify('CLASS_CHANGED', {
                classId: targetClass.id,
                className: targetClass.name,
                taskId: targetSummary?.taskId || this.state.currentTaskId
            });
            return targetClass;
        }

        getStats(taskId = this.state.currentTaskId, mode = this.state.operationMode) {
            const task = this.state.tasks.find(t => t.id === taskId);
            const isEnglish = this.isEnglishTask(task);
            const records = this.getStudentRecords(taskId);
            const total = this.state.students.length;
            let submitted = 0;
            let graded = 0;
            let exempt = 0;

            for (const s of this.state.students) {
                const rec = records[s.id];
                if (rec && rec.status === 'dark') {
                    submitted++;
                }
                if (rec && ((rec.score !== null && rec.score !== undefined && rec.score !== '') || (rec.badge && String(rec.badge).trim())) && rec.status !== 'muted') {
                    graded++;
                }
                if (isEnglish && s.isNonEnglish && (!rec || rec.status === 'muted')) {
                    exempt++;
                }
            }

            const required = Math.max(0, total - exempt);
            const completed = mode === 'grade' ? graded : submitted;
            const percentage = required > 0 ? (completed / required) * 100 : (total > 0 ? 100 : 0);
            return { total, submitted, graded, exempt, required, percentage: Math.min(100, percentage), mode };
        }

        /**
         * 导出完整应用状态快照，用于隐藏备份页 `_TWS3_BACKUP`
         */
        exportStateSnapshot(visibleSheetHash = '') {
            this._syncActiveClassPointers(this.state);
            return {
                metadata: {
                    schemaVersion: 4,
                    backupVersion: 4,
                    exportedAt: getUtcNowIso(),
                    deviceId: this.deviceId,
                    visibleSheetHash: visibleSheetHash || ''
                },
                state: JSON.parse(JSON.stringify(this.state))
            };
        }

        /**
         * 使用远程数据完整覆盖本地状态
         */
        overrideWith(remoteData) {
            const incomingState = remoteData.state || remoteData;
            if (!incomingState || typeof incomingState !== 'object') {
                throw new Error('无效的状态数据格式');
            }

            // 多班级格式覆盖
            if (Array.isArray(incomingState.classes) && incomingState.classes.length > 0) {
                this.state.classes = incomingState.classes.map((cls, idx) => this._normalizeClass(cls, idx));
                this.state.currentClassId = incomingState.currentClassId || this.state.classes[0].id;
                this.state.operationMode = incomingState.operationMode || 'check';
                this.state.viewMode = incomingState.viewMode || 'grid';
                this.state.showStudentNumbers = incomingState.showStudentNumbers !== false;
                this.state.showSubjectTags = incomingState.showSubjectTags !== false;
                this.state.showNonEnglishTags = incomingState.showNonEnglishTags !== false;
                if (incomingState.fontPreset) this.state.fontPreset = incomingState.fontPreset;
                if (typeof incomingState.customFont === 'string') this.state.customFont = incomingState.customFont;
                this.state.schemaVersion = 4;
                this._syncActiveClassPointers(this.state);
                this._applyFontSettings(this.state.fontPreset, this.state.customFont);
                this._notify('STORE_OVERRIDDEN', { state: this.state });
                return true;
            }

            // 单班级格式覆盖当前激活班级
            if (!Array.isArray(incomingState.students) || !Array.isArray(incomingState.tasks)) {
                throw new Error('无效的状态数据格式');
            }

            const activeClass = this.state.classes?.find(c => c.id === this.state.currentClassId);
            const normalizedClass = this._normalizeClass({
                id: activeClass ? activeClass.id : 'class_1',
                name: incomingState.currentClass || (activeClass ? activeClass.name : INITIAL_CLASS_NAME),
                classUpdatedAt: incomingState.classUpdatedAt || getUtcNowIso(),
                students: incomingState.students,
                deletedStudents: incomingState.deletedStudents,
                tasks: incomingState.tasks,
                deletedTasks: incomingState.deletedTasks,
                currentTaskId: incomingState.currentTaskId,
                records: incomingState.records,
                seatLayout: incomingState.seatLayout,
                seatGroupNames: incomingState.seatGroupNames,
                seatPodiumPosition: incomingState.seatPodiumPosition,
                seatLayoutUpdatedAt: incomingState.seatLayoutUpdatedAt,
                schedule: incomingState.schedule,
                officerTable: incomingState.officerTable,
                dutyTable: incomingState.dutyTable
            });

            if (activeClass) {
                Object.assign(activeClass, normalizedClass);
            } else {
                this.state.classes = [normalizedClass];
            }
            this._syncActiveClassPointers(this.state);
            this._notify('STORE_OVERRIDDEN', { state: this.state });
            return true;
        }

        /**
         * 计算本地状态与传入数据（备份或解析出的可见表）的差异
         */
        diff(preparedData) {
            const local = this.state;
            const remoteState = preparedData.state || preparedData;
            const useStableIds = !!preparedData.hasBackup;
            const items = [];
            let itemIndex = 0;

            const addItem = ({ category, operation, conflict = false, context, localSide, importedSide, importedDeleted = false }) => {
                const resolution = makeResolution(localSide, importedSide, importedDeleted);
                const searchText = [
                    context.className,
                    context.studentNo,
                    context.studentName,
                    context.taskName,
                    context.fieldName,
                    localSide.display,
                    importedSide.display,
                    localSide.rawValue,
                    importedSide.rawValue
                ].filter(value => value !== null && value !== undefined).join(' ').toLowerCase();
                items.push({
                    id: `diff_${Date.now().toString(36)}_${itemIndex++}`,
                    category,
                    operation,
                    conflict: conflict || !!resolution.conflict || resolution.choice === 'conflict',
                    context,
                    local: localSide,
                    imported: importedSide,
                    resolution,
                    reason: resolution.reason,
                    searchText
                });
            };

            const classChanged = local.currentClass !== remoteState.currentClass;
            if (classChanged) {
                const localSide = sideValue(local.currentClass, true, local.currentClass, local.classUpdatedAt);
                const importedSide = sideValue(remoteState.currentClass, !!remoteState.currentClass, remoteState.currentClass, remoteState.classUpdatedAt);
                addItem({
                    category: 'class',
                    operation: 'modify',
                    context: { entity: 'class', className: remoteState.currentClass || local.currentClass, fieldName: '班级名称' },
                    localSide,
                    importedSide
                });
            }

            const studentMatch = matchStudents(local.students || [], remoteState.students || [], useStableIds);
            const localStudentPairs = new Map(studentMatch.pairs.map(pair => [pair.local.id, pair]));
            const importedStudentPairs = new Map(studentMatch.pairs.map(pair => [pair.imported.id, pair]));
            const remoteDeletedStudents = remoteState.deletedStudents || [];
            const remoteDeletedStudentKeys = new Set(remoteDeletedStudents.map(student => String(student.studentNo || student.id)));
            const hasRemoteStudentDeletion = student => remoteDeletedStudentKeys.has(String(student.studentNo || student.id))
                || (useStableIds && remoteDeletedStudents.some(deleted => String(deleted.id) === String(student.id)));

            studentMatch.pairs.forEach(({ local: localStudent, imported: importedStudent }) => {
                if (localStudent.name !== importedStudent.name) {
                    addItem({
                        category: 'student',
                        operation: 'modify',
                        context: { entity: 'student', studentNo: String(importedStudent.studentNo || localStudent.studentNo || localStudent.id), studentName: importedStudent.name || localStudent.name, fieldName: '姓名' },
                        localSide: sideValue(localStudent.name, true, localStudent.name, localStudent.updatedAt),
                        importedSide: sideValue(importedStudent.name, true, importedStudent.name, importedStudent.updatedAt)
                    });
                }
            });

            const localStudentOrder = (local.students || []).map(student => student.id).filter(id => localStudentPairs.has(id));
            const importedStudentOrder = (remoteState.students || []).map(student => student.id).filter(id => importedStudentPairs.has(id));
            studentMatch.pairs.forEach(({ local: localStudent, imported: importedStudent }) => {
                if (localStudentOrder.indexOf(localStudent.id) !== importedStudentOrder.indexOf(importedStudent.id)) {
                    addItem({
                        category: 'student',
                        operation: 'modify',
                        context: { entity: 'student', studentNo: String(importedStudent.studentNo || localStudent.studentNo || localStudent.id), studentName: importedStudent.name || localStudent.name, fieldName: '排序' },
                        localSide: sideValue(localStudentOrder.indexOf(localStudent.id) + 1, true, null, localStudent.updatedAt),
                        importedSide: sideValue(importedStudentOrder.indexOf(importedStudent.id) + 1, true, null, importedStudent.updatedAt)
                    });
                }
            });

            studentMatch.localUnmatched.filter(student => !hasRemoteStudentDeletion(student)).forEach(student => {
                addItem({
                    category: 'student',
                    operation: 'local-only',
                    context: { entity: 'student', studentNo: String(student.studentNo || student.id), studentName: student.name, fieldName: '学生' },
                    localSide: sideValue(student.name, true, student.name, student.updatedAt),
                    importedSide: sideValue(null, false, null, null)
                });
            });

            studentMatch.importedUnmatched.forEach(student => {
                addItem({
                    category: 'student',
                    operation: 'file-only',
                    context: { entity: 'student', studentNo: String(student.studentNo || student.id), studentName: student.name, fieldName: '学生' },
                    localSide: sideValue(null, false, null, null),
                    importedSide: sideValue(student.name, true, student.name, student.updatedAt)
                });
            });

            const localStudentByKey = new Map((local.students || []).map(student => [String(student.studentNo || student.id), student]));
            remoteDeletedStudents.forEach(deletedStudent => {
                const key = String(deletedStudent.studentNo || deletedStudent.id);
                const localStudent = localStudentByKey.get(key) || (useStableIds ? (local.students || []).find(student => String(student.id) === String(deletedStudent.id)) : null);
                if (localStudent) {
                    addItem({
                        category: 'delete',
                        operation: 'delete',
                        context: { entity: 'student', studentNo: key, studentName: deletedStudent.name || localStudent.name, fieldName: '学生' },
                        localSide: sideValue(localStudent.name, true, localStudent.name, localStudent.updatedAt),
                        importedSide: sideValue(null, false, deletedStudent.name || null, getEntityTime(deletedStudent, true)),
                        importedDeleted: true
                    });
                }
            });

            const taskMatch = matchTasks(local.tasks || [], remoteState.tasks || [], useStableIds);
            const localTaskPairs = new Map(taskMatch.pairs.map(pair => [pair.local.id, pair]));
            const importedTaskPairs = new Map(taskMatch.pairs.map(pair => [pair.imported.id, pair]));
            const remoteDeletedTasks = remoteState.deletedTasks || [];
            const remoteDeletedTaskIds = new Set(remoteDeletedTasks.map(task => String(task.id)));
            const remoteDeletedTaskNames = new Set(remoteDeletedTasks.map(task => normalizeTaskName(task.name)));

            taskMatch.pairs.forEach(({ local: localTask, imported: importedTask }) => {
                if (localTask.name !== importedTask.name) {
                    addItem({
                        category: 'task',
                        operation: 'modify',
                        context: { entity: 'task', taskName: importedTask.name || localTask.name, localTaskName: localTask.name, fieldName: '任务名称' },
                        localSide: sideValue(localTask.name, true, localTask.name, localTask.updatedAt),
                        importedSide: sideValue(importedTask.name, true, importedTask.name, importedTask.updatedAt)
                    });
                }
                if (!!localTask.archived !== !!importedTask.archived) {
                    addItem({
                        category: 'task',
                        operation: 'modify',
                        context: { entity: 'task', taskName: importedTask.name || localTask.name, fieldName: '归档状态' },
                        localSide: sideValue(localTask.archived ? '已归档' : '未归档', true, localTask.archived, localTask.updatedAt),
                        importedSide: sideValue(importedTask.archived ? '已归档' : '未归档', true, importedTask.archived, importedTask.updatedAt)
                    });
                }
            });

            const localTaskOrder = (local.tasks || []).map(task => task.id).filter(id => localTaskPairs.has(id));
            const importedTaskOrder = (remoteState.tasks || []).map(task => task.id).filter(id => importedTaskPairs.has(id));
            taskMatch.pairs.forEach(({ local: localTask, imported: importedTask }) => {
                if (localTaskOrder.indexOf(localTask.id) !== importedTaskOrder.indexOf(importedTask.id)) {
                    addItem({
                        category: 'task',
                        operation: 'modify',
                        context: { entity: 'task', taskName: importedTask.name || localTask.name, fieldName: '排序' },
                        localSide: sideValue(localTaskOrder.indexOf(localTask.id) + 1, true, null, localTask.updatedAt),
                        importedSide: sideValue(importedTaskOrder.indexOf(importedTask.id) + 1, true, null, importedTask.updatedAt)
                    });
                }
            });

            taskMatch.localUnmatched.filter(task => !remoteDeletedTaskIds.has(String(task.id)) && !remoteDeletedTaskNames.has(normalizeTaskName(task.name))).forEach(task => {
                addItem({
                    category: 'task',
                    operation: 'local-only',
                    context: { entity: 'task', taskName: task.name, fieldName: '任务' },
                    localSide: sideValue(task.name, true, task.name, getEntityTime(task)),
                    importedSide: sideValue(null, false, null, null)
                });
            });

            taskMatch.importedUnmatched.forEach(task => {
                addItem({
                    category: 'task',
                    operation: 'file-only',
                    context: { entity: 'task', taskName: task.name, fieldName: '任务' },
                    localSide: sideValue(null, false, null, null),
                    importedSide: sideValue(task.name, true, task.name, getEntityTime(task))
                });
            });

            const localTaskById = new Map((local.tasks || []).map(task => [String(task.id), task]));
            const localTaskByName = new Map((local.tasks || []).map(task => [normalizeTaskName(task.name), task]));
            remoteDeletedTasks.forEach(deletedTask => {
                const localTask = localTaskById.get(String(deletedTask.id)) || localTaskByName.get(normalizeTaskName(deletedTask.name));
                if (localTask) {
                    addItem({
                        category: 'delete',
                        operation: 'delete',
                        context: { entity: 'task', taskName: deletedTask.name || localTask.name, fieldName: '任务' },
                        localSide: sideValue(localTask.name, true, localTask.name, getEntityTime(localTask)),
                        importedSide: sideValue(null, false, deletedTask.name || null, getEntityTime(deletedTask, true)),
                        importedDeleted: true
                    });
                }
            });

            const localStudentById = new Map((local.students || []).map(student => [String(student.id), student]));
            const importedStudentById = new Map((remoteState.students || []).map(student => [String(student.id), student]));
            const addRecordItem = (taskPair, studentPair, localRecord, importedRecord, localRecordExists, importedRecordExists, importedRaw) => {
                const localTask = taskPair.local;
                const importedTask = taskPair.imported;
                const localStudent = studentPair ? studentPair.local : null;
                const importedStudent = studentPair ? studentPair.imported : null;
                const studentNo = String((importedStudent || localStudent || {}).studentNo || (importedStudent || localStudent || {}).id || '');
                const studentName = (importedStudent || localStudent || {}).name || `学生${studentNo}`;
                const localValue = normalizeRecord(localRecord);
                const importedValue = normalizeRecord(importedRecord);
                const localSide = sideValue(localValue, localRecordExists, localRecordExists ? recordDisplay(localValue) : null, localRecord && localRecord.updatedAt);
                const importedSide = sideValue(importedValue, importedRecordExists, importedRaw === null || importedRaw === undefined ? recordDisplay(importedValue) : importedRaw, importedRecord && importedRecord.updatedAt);
                const importedCleared = !isBlankRecord(importedValue) ? false : !isBlankRecord(localValue);
                addItem({
                    category: 'record',
                    operation: importedCleared ? 'clear' : 'modify',
                    context: {
                        entity: 'record',
                        taskName: importedTask.name || localTask.name,
                        studentNo,
                        studentName,
                        fieldName: importedCleared ? '记录清空' : '提交记录',
                        changedFields: ['状态', '分数', '备注'].filter(field => {
                            if (field === '状态') return localValue.status !== importedValue.status;
                            if (field === '分数') return localValue.score !== importedValue.score || localValue.badge !== importedValue.badge;
                            return localValue.note !== importedValue.note;
                        })
                    },
                    localSide,
                    importedSide
                });
            };

            const recordPairs = [];
            taskMatch.pairs.forEach(taskPair => {
                studentMatch.pairs.forEach(studentPair => recordPairs.push({ taskPair, studentPair }));
            });

            recordPairs.forEach(({ taskPair, studentPair }) => {
                const localTaskId = taskPair.local.id;
                const importedTaskId = taskPair.imported.id;
                const localStudentId = studentPair.local.id;
                const importedStudentId = studentPair.imported.id;
                const localRecord = local.records && local.records[localTaskId] ? local.records[localTaskId][localStudentId] : null;
                const importedRecord = remoteState.records && remoteState.records[importedTaskId] ? remoteState.records[importedTaskId][importedStudentId] : null;
                const localExists = !!localRecord;
                const importedExists = !!importedRecord;
                if ((localRecord || importedRecord) && !recordsEqual(localRecord, importedRecord)) {
                    addRecordItem(taskPair, studentPair, localRecord, importedRecord, localExists, importedExists, getRawCell(preparedData, taskPair.imported, studentPair.imported.studentNo || studentPair.imported.id));
                }
            });

            // 学生仅本地或仅文件时，仍展示其非空记录，确保覆盖删除统计与详情一致。
            studentMatch.localUnmatched.forEach(localStudent => {
                taskMatch.pairs.forEach(taskPair => {
                    const record = local.records && local.records[taskPair.local.id] && local.records[taskPair.local.id][localStudent.id];
                    if (!record || isBlankRecord(record)) return;
                    addRecordItem(taskPair, { local: localStudent, imported: localStudent }, record, null, true, false, null);
                });
            });

            studentMatch.importedUnmatched.forEach(importedStudent => {
                taskMatch.pairs.forEach(taskPair => {
                    const record = remoteState.records && remoteState.records[taskPair.imported.id] && remoteState.records[taskPair.imported.id][importedStudent.id];
                    if (!record || isBlankRecord(record)) return;
                    addRecordItem(taskPair, { local: importedStudent, imported: importedStudent }, null, record, false, true, getRawCell(preparedData, taskPair.imported, importedStudent.studentNo || importedStudent.id));
                });
            });

            const localUnmatchedTaskPairs = taskMatch.localUnmatched;
            const importedUnmatchedTaskPairs = taskMatch.importedUnmatched;
            localUnmatchedTaskPairs.forEach(localTask => {
                const taskPair = { local: localTask, imported: { name: localTask.name } };
                Object.keys((local.records && local.records[localTask.id]) || {}).forEach(studentId => {
                    const record = local.records[localTask.id][studentId];
                    if (!isBlankRecord(record)) {
                        const student = localStudentById.get(String(studentId));
                        addRecordItem(taskPair, student ? { local: student, imported: student } : null, record, null, true, false, null);
                    }
                });
            });

            importedUnmatchedTaskPairs.forEach(importedTask => {
                const taskPair = { local: { name: importedTask.name }, imported: importedTask };
                Object.keys((remoteState.records && remoteState.records[importedTask.id]) || {}).forEach(studentId => {
                    const record = remoteState.records[importedTask.id][studentId];
                    if (!isBlankRecord(record)) {
                        const student = importedStudentById.get(String(studentId));
                        addRecordItem(taskPair, student ? { local: student, imported: student } : null, null, record, false, true, getRawCell(preparedData, importedTask.name, student && (student.studentNo || student.id)));
                    }
                });
            });
            // 课程表、班干部表、值日生表差异对比
            const localSchedule = local.schedule || INITIAL_SCHEDULE;
            const remoteSchedule = hasScheduleData(remoteState)
                ? normalizeSchedule(remoteState.schedule).schedule
                : null;
            if (remoteSchedule && JSON.stringify(localSchedule) !== JSON.stringify(remoteSchedule)) {
                const localSide = sideValue('已配置课程安排', true, JSON.stringify(localSchedule), localSchedule.updatedAt);
                const importedSide = sideValue('导入课程安排', true, JSON.stringify(remoteSchedule), remoteSchedule.updatedAt);
                addItem({
                    category: 'table',
                    operation: 'modify',
                    context: { entity: 'table', tableName: '课程表', fieldName: '课程表数据' },
                    localSide,
                    importedSide
                });
            }

            const localOfficers = local.officerTable || INITIAL_OFFICERS;
            const remoteOfficers = remoteState.officerTable || (useStableIds ? null : localOfficers);
            if (remoteOfficers && JSON.stringify(localOfficers) !== JSON.stringify(remoteOfficers)) {
                const localSide = sideValue(`${(localOfficers.roles || []).length}个职位`, true, JSON.stringify(localOfficers), localOfficers.updatedAt);
                const importedSide = sideValue(`${(remoteOfficers.roles || []).length}个职位`, true, JSON.stringify(remoteOfficers), remoteOfficers.updatedAt);
                addItem({
                    category: 'table',
                    operation: 'modify',
                    context: { entity: 'table', tableName: '班干部表', fieldName: '职位与成员' },
                    localSide,
                    importedSide
                });
            }

            const localDuty = local.dutyTable || INITIAL_DUTY;
            const remoteDuty = remoteState.dutyTable || (useStableIds ? null : localDuty);
            if (remoteDuty && JSON.stringify(localDuty) !== JSON.stringify(remoteDuty)) {
                const localSide = sideValue(`${(localDuty.days || []).length}天/${(localDuty.roles || []).length}岗位`, true, JSON.stringify(localDuty), localDuty.updatedAt);
                const importedSide = sideValue(`${(remoteDuty.days || []).length}天/${(remoteDuty.roles || []).length}岗位`, true, JSON.stringify(remoteDuty), remoteDuty.updatedAt);
                addItem({
                    category: 'table',
                    operation: 'modify',
                    context: { entity: 'table', tableName: '值日生表', fieldName: '值日安排' },
                    localSide,
                    importedSide
                });
            }


            const summary = {
                total: items.length,
                conflicts: items.filter(item => item.conflict).length,
                byCategory: { class: 0, student: 0, task: 0, record: 0, delete: 0, table: 0 },
                byOperation: { add: 0, modify: 0, clear: 0, delete: 0, 'local-only': 0, 'file-only': 0 },
                adoptedFromFile: items.filter(item => item.resolution.choice === 'file').length,
                keptLocal: items.filter(item => item.resolution.choice === 'local' && !item.conflict).length,
                externalEdits: preparedData.externalEditCount || (preparedData.isExternalEdited ? 1 : 0)
            };
            items.forEach(item => {
                summary.byCategory[item.category] = (summary.byCategory[item.category] || 0) + 1;
                summary.byOperation[item.operation] = (summary.byOperation[item.operation] || 0) + 1;
            });

            const sourceInfo = {
                fileName: preparedData.fileName || preparedData.sourceInfo && preparedData.sourceInfo.fileName || '导入记分册.xlsx',
                fileMtime: preparedData.fileMtime || preparedData.sourceInfo && preparedData.sourceInfo.fileMtime || null,
                backupExportedAt: preparedData.metadata && preparedData.metadata.exportedAt || preparedData.sourceInfo && preparedData.sourceInfo.backupExportedAt || null,
                type: preparedData.isExternalEdited ? 'external-edited' : (preparedData.hasBackup ? 'backup' : 'template'),
                label: preparedData.isExternalEdited ? '检测到 Excel/WPS 外部编辑' : (preparedData.hasBackup ? '完整备份' : '普通模板')
            };

            const mergePreview = {
                adoptFile: summary.adoptedFromFile,
                keepLocal: summary.keptLocal,
                conflicts: summary.conflicts,
                unresolved: summary.conflicts
            };

            return {
                hasDifference: items.length > 0 || !!preparedData.isExternalEdited,
                sourceInfo,
                summary,
                mergePreview,
                items,
                isExternalEdited: !!preparedData.isExternalEdited
            };
        }

        _alignImportedState(preparedData) {
            const source = preparedData.state || preparedData;
            const aligned = JSON.parse(JSON.stringify(source));
            if (preparedData.hasBackup) {
                if (hasScheduleData(aligned)) {
                    aligned.schedule = normalizeSchedule(aligned.schedule).schedule;
                }
                return aligned;
            }

            const studentMatch = matchStudents(this.state.students || [], aligned.students || [], false);
            const studentIdMap = new Map();
            studentMatch.pairs.forEach(({ local, imported }) => {
                studentIdMap.set(String(imported.id), String(local.id));
                imported.id = local.id;
            });

            const taskMatch = matchTasks(this.state.tasks || [], aligned.tasks || [], false);
            const taskIdMap = new Map();
            taskMatch.pairs.forEach(({ local, imported }) => {
                taskIdMap.set(String(imported.id), String(local.id));
                imported.id = local.id;
            });

            const alignedRecords = {};
            Object.keys(aligned.records || {}).forEach(importedTaskId => {
                const targetTaskId = taskIdMap.get(String(importedTaskId)) || importedTaskId;
                if (!alignedRecords[targetTaskId]) alignedRecords[targetTaskId] = {};
                Object.keys(aligned.records[importedTaskId] || {}).forEach(importedStudentId => {
                    const targetStudentId = studentIdMap.get(String(importedStudentId)) || importedStudentId;
                    alignedRecords[targetTaskId][targetStudentId] = aligned.records[importedTaskId][importedStudentId];
                });
            });
            aligned.records = alignedRecords;

            (aligned.deletedStudents || []).forEach(student => {
                const local = (this.state.students || []).find(item => String(item.studentNo || item.id) === String(student.studentNo || student.id));
                if (local) student.id = local.id;
            });
            (aligned.deletedTasks || []).forEach(task => {
                const local = (this.state.tasks || []).find(item => String(item.id) === String(task.id) || normalizeTaskName(item.name) === normalizeTaskName(task.name));
                if (local) task.id = local.id;
            });
            if (hasScheduleData(aligned)) {
                aligned.schedule = normalizeSchedule(aligned.schedule).schedule;
            }
            if (!aligned.officerTable) aligned.officerTable = JSON.parse(JSON.stringify(INITIAL_OFFICERS));
            if (!aligned.dutyTable) aligned.dutyTable = JSON.parse(JSON.stringify(INITIAL_DUTY));
            return aligned;
        }

        /**
         * 智能合并：按实体与字段修改时间（updatedAt）合并，保留较新者；
         * 时间相同但内容不同时保留本地值，并记录冲突数。
         */
        smartMerge(preparedData) {
            const remoteState = this._alignImportedState(preparedData);
            let conflictCount = 0;

            // 1. 班级合并
            if (remoteState.currentClass && remoteState.currentClass !== this.state.currentClass) {
                const remoteTime = remoteState.classUpdatedAt || '1970-01-01T00:00:00.000Z';
                const localTime = this.state.classUpdatedAt || '1970-01-01T00:00:00.000Z';
                if (remoteTime > localTime) {
                    this.state.currentClass = remoteState.currentClass;
                    this.state.classUpdatedAt = remoteTime;
                } else if (remoteTime === localTime) {
                    // 时间相同内容不同，保留本地
                    conflictCount++;
                }
            }

            // 2. 学生花名册合并
            const localStudentMap = new Map(this.state.students.map(s => [String(s.studentNo || s.id), s]));
            const localDeletedStudentMap = new Map((this.state.deletedStudents || []).map(s => [String(s.studentNo || s.id), s]));

            const remoteStudents = remoteState.students || [];
            const remoteDeletedStudents = remoteState.deletedStudents || [];

            // 2.1 处理远程墓碑
            remoteDeletedStudents.forEach(rds => {
                const key = String(rds.studentNo || rds.id);
                const ls = localStudentMap.get(key);
                if (ls) {
                    const rDelTime = rds.deletedAt || rds.updatedAt || '1970-01-01T00:00:00.000Z';
                    const lUpdTime = ls.updatedAt || '1970-01-01T00:00:00.000Z';
                    if (rDelTime > lUpdTime) {
                        // 删除本地学生
                        const idx = this.state.students.findIndex(s => String(s.studentNo || s.id) === key);
                        if (idx !== -1) {
                            const [deleted] = this.state.students.splice(idx, 1);
                            if (!this.state.deletedStudents) this.state.deletedStudents = [];
                            this.state.deletedStudents.push({ ...deleted, deletedAt: rDelTime, updatedAt: rDelTime });
                        }
                    } else if (rDelTime === lUpdTime) {
                        conflictCount++;
                    }
                }
            });

            // 2.2 处理远程活跃学生
            remoteStudents.forEach(rs => {
                const key = String(rs.studentNo || rs.id);
                const ls = localStudentMap.get(key);
                const lds = localDeletedStudentMap.get(key);
                const rUpdTime = rs.updatedAt || '1970-01-01T00:00:00.000Z';

                if (lds) {
                    const lDelTime = lds.deletedAt || lds.updatedAt || '1970-01-01T00:00:00.000Z';
                    if (rUpdTime > lDelTime) {
                        // 远程修改在本地删除之后，恢复学生
                        const delIdx = this.state.deletedStudents.findIndex(s => String(s.studentNo || s.id) === key);
                        if (delIdx !== -1) this.state.deletedStudents.splice(delIdx, 1);
                        this.state.students.push({ ...rs });
                    }
                } else if (!ls) {
                    // 本地没有，直接添加
                    this.state.students.push({ ...rs });
                } else {
                    // 本地已有，逐字段对比
                    const lUpdTime = ls.updatedAt || '1970-01-01T00:00:00.000Z';
                    if (rUpdTime > lUpdTime) {
                        ls.name = rs.name;
                        ls.updatedAt = rUpdTime;
                    } else if (rUpdTime === lUpdTime && ls.name !== rs.name) {
                        conflictCount++;
                    }
                }
            });

            // 3. 任务列表合并
            const localTaskMap = new Map(this.state.tasks.map(t => [t.id, t]));
            const localTaskNameMap = new Map(this.state.tasks.map(t => [t.name, t]));
            const localDeletedTaskMap = new Map((this.state.deletedTasks || []).map(t => [t.id, t]));

            const remoteTasks = remoteState.tasks || [];
            const remoteDeletedTasks = remoteState.deletedTasks || [];

            // 3.1 处理远程任务墓碑
            remoteDeletedTasks.forEach(rdt => {
                const lt = localTaskMap.get(rdt.id) || localTaskNameMap.get(rdt.name);
                if (lt) {
                    const rDelTime = rdt.deletedAt || rdt.updatedAt || '1970-01-01T00:00:00.000Z';
                    const lUpdTime = lt.updatedAt || '1970-01-01T00:00:00.000Z';
                    if (rDelTime > lUpdTime) {
                        const idx = this.state.tasks.findIndex(t => t.id === lt.id);
                        if (idx !== -1) {
                            const [deleted] = this.state.tasks.splice(idx, 1);
                            if (!this.state.deletedTasks) this.state.deletedTasks = [];
                            this.state.deletedTasks.push({ ...deleted, deletedAt: rDelTime, updatedAt: rDelTime });
                        }
                    } else if (rDelTime === lUpdTime) {
                        conflictCount++;
                    }
                }
            });

            // 3.2 处理远程活跃任务
            remoteTasks.forEach(rt => {
                const lt = localTaskMap.get(rt.id) || localTaskNameMap.get(rt.name);
                const ldt = localDeletedTaskMap.get(rt.id);
                const rUpdTime = rt.updatedAt || rt.createdAt || '1970-01-01T00:00:00.000Z';

                if (ldt) {
                    const lDelTime = ldt.deletedAt || ldt.updatedAt || '1970-01-01T00:00:00.000Z';
                    if (rUpdTime > lDelTime) {
                        const delIdx = this.state.deletedTasks.findIndex(t => t.id === rt.id);
                        if (delIdx !== -1) this.state.deletedTasks.splice(delIdx, 1);
                        this.state.tasks.push({ ...rt });
                    }
                } else if (!lt) {
                    this.state.tasks.push({ ...rt });
                } else {
                    const lUpdTime = lt.updatedAt || lt.createdAt || '1970-01-01T00:00:00.000Z';
                    if (rUpdTime > lUpdTime) {
                        lt.name = rt.name;
                        lt.archived = rt.archived;
                        lt.updatedAt = rUpdTime;
                    } else if (rUpdTime === lUpdTime) {
                        if (lt.name !== rt.name || lt.archived !== rt.archived) {
                            conflictCount++;
                        }
                    }
                }
            });

            // 4. 提交记录合并
            const remoteRecords = remoteState.records || {};
            for (const taskId of Object.keys(remoteRecords)) {
                if (!this.state.records[taskId]) {
                    this.state.records[taskId] = {};
                }
                const lTaskRecords = this.state.records[taskId];
                const rTaskRecords = remoteRecords[taskId];

                for (const studentId of Object.keys(rTaskRecords)) {
                    const rRec = rTaskRecords[studentId];
                    const lRec = lTaskRecords[studentId];

                    if (!lRec) {
                        lTaskRecords[studentId] = { ...rRec };
                    } else {
                        const rTime = rRec.updatedAt || '1970-01-01T00:00:00.000Z';
                        const lTime = lRec.updatedAt || '1970-01-01T00:00:00.000Z';

                        if (rTime > lTime) {
                            lTaskRecords[studentId] = { ...rRec };
                        } else if (rTime === lTime) {
                            const isDifferent = rRec.status !== lRec.status || rRec.badge !== lRec.badge || rRec.score !== lRec.score || rRec.note !== lRec.note;
                            if (isDifferent) {
                                conflictCount++;
                            }
                        }
                    }
                }
            }
            // 5. 课程表合并
            if (remoteState.schedule && typeof remoteState.schedule === 'object') {
                const lTime = (this.state.schedule && this.state.schedule.updatedAt) || '1970-01-01T00:00:00.000Z';
                const rTime = remoteState.schedule.updatedAt || '1970-01-01T00:00:00.000Z';
                if (rTime > lTime) {
                    this.state.schedule = JSON.parse(JSON.stringify(remoteState.schedule));
                } else if (rTime === lTime) {
                    if (JSON.stringify(this.state.schedule) !== JSON.stringify(remoteState.schedule)) {
                        conflictCount++;
                    }
                }
            }

            // 6. 班干部表合并
            if (remoteState.officerTable && typeof remoteState.officerTable === 'object') {
                const lTime = (this.state.officerTable && this.state.officerTable.updatedAt) || '1970-01-01T00:00:00.000Z';
                const rTime = remoteState.officerTable.updatedAt || '1970-01-01T00:00:00.000Z';
                if (rTime > lTime) {
                    this.state.officerTable = JSON.parse(JSON.stringify(remoteState.officerTable));
                } else if (rTime === lTime) {
                    if (JSON.stringify(this.state.officerTable) !== JSON.stringify(remoteState.officerTable)) {
                        conflictCount++;
                    }
                }
            }

            // 7. 值日生表合并
            if (remoteState.dutyTable && typeof remoteState.dutyTable === 'object') {
                const lTime = (this.state.dutyTable && this.state.dutyTable.updatedAt) || '1970-01-01T00:00:00.000Z';
                const rTime = remoteState.dutyTable.updatedAt || '1970-01-01T00:00:00.000Z';
                if (rTime > lTime) {
                    this.state.dutyTable = JSON.parse(JSON.stringify(remoteState.dutyTable));
                } else if (rTime === lTime) {
                    if (JSON.stringify(this.state.dutyTable) !== JSON.stringify(remoteState.dutyTable)) {
                        conflictCount++;
                    }
                }
            }


            // 确保当前选中的任务合法
            if (!this.state.tasks.some(t => t.id === this.state.currentTaskId)) {
                this.state.currentTaskId = this.state.tasks[0] ? this.state.tasks[0].id : '';
            }

            this._notify('STORE_SMART_MERGED', { conflictCount });
            return { success: true, conflictCount };
        }
    }

    window.TWS3.SUBJECT_OPTIONS = SUBJECT_OPTIONS;
    window.TWS3.store = new Store();
    window.TWS3.store.SUBJECT_OPTIONS = SUBJECT_OPTIONS;
})();
