(function() {
    window.TWS3 = window.TWS3 || {};

    const SUBJECT_MAP = {
        '语': { fullName: '语文', color: 'chinese', category: 'humanities' },
        '语文': { fullName: '语文', color: 'chinese', category: 'humanities' },
        '数': { fullName: '数学', color: 'math', category: 'stem' },
        '数学': { fullName: '数学', color: 'math', category: 'stem' },
        '英': { fullName: '英语', color: 'english', category: 'language' },
        '英语': { fullName: '英语', color: 'english', category: 'language' },
        '物': { fullName: '物理', color: 'physics', category: 'stem' },
        '物理': { fullName: '物理', color: 'physics', category: 'stem' },
        '化': { fullName: '化学', color: 'chemistry', category: 'stem' },
        '化学': { fullName: '化学', color: 'chemistry', category: 'stem' },
        '生': { fullName: '生物', color: 'biology', category: 'stem' },
        '生物': { fullName: '生物', color: 'biology', category: 'stem' },
        '政': { fullName: '道法/政治', color: 'politics', category: 'humanities' },
        '政治': { fullName: '道法/政治', color: 'politics', category: 'humanities' },
        '道法': { fullName: '道德与法治', color: 'politics', category: 'humanities' },
        '历': { fullName: '历史', color: 'history', category: 'humanities' },
        '历史': { fullName: '历史', color: 'history', category: 'humanities' },
        '地': { fullName: '地理', color: 'geography', category: 'humanities' },
        '地理': { fullName: '地理', color: 'geography', category: 'humanities' },
        '体': { fullName: '体育', color: 'pe', category: 'activity' },
        '体育': { fullName: '体育', color: 'pe', category: 'activity' },
        '音': { fullName: '音乐', color: 'music', category: 'art' },
        '音乐': { fullName: '音乐', color: 'music', category: 'art' },
        '美': { fullName: '美术', color: 'art', category: 'art' },
        '美术': { fullName: '美术', color: 'art', category: 'art' },
        '美/心': { fullName: '美术/心理', color: 'art', category: 'art' },
        '心': { fullName: '心理健康', color: 'art', category: 'art' },
        '心理': { fullName: '心理健康', color: 'art', category: 'art' },
        '信': { fullName: '信息技术', color: 'tech', category: 'stem' },
        '信息': { fullName: '信息技术', color: 'tech', category: 'stem' },
        '班': { fullName: '班会', color: 'class', category: 'activity' },
        '班会': { fullName: '班会', color: 'class', category: 'activity' },
        '通': { fullName: '通用技术', color: 'tech', category: 'stem' },
        '通用': { fullName: '通用技术', color: 'tech', category: 'stem' },
        '生选': { fullName: '生物选修', color: 'biology', category: 'stem' },
        '化选': { fullName: '化学选修', color: 'chemistry', category: 'stem' },
        '地选': { fullName: '地理选修', color: 'geography', category: 'humanities' },
        '政选': { fullName: '政治选修', color: 'politics', category: 'humanities' },
        '物合': { fullName: '物理学考', color: 'physics', category: 'stem' },
        '化合': { fullName: '化学学考', color: 'chemistry', category: 'stem' },
        '政合': { fullName: '政治学考', color: 'politics', category: 'humanities' },
        '地合': { fullName: '地理学考', color: 'geography', category: 'humanities' },
        '生合': { fullName: '生物学考', color: 'biology', category: 'stem' }
    };

    const DAY_ORDER_MAP = {
        '周一': 1, '星期一': 1,
        '周二': 2, '星期二': 2,
        '周三': 3, '星期三': 3,
        '周四': 4, '星期四': 4,
        '周五': 5, '星期五': 5,
        '周六': 6, '星期六': 6,
        '周日': 7, '星期日': 7, '周天': 7, '星期天': 7
    };

    function normalizeSubject(rawName) {
        const text = String(rawName || '').trim();
        if (!text) return null;
        if (SUBJECT_MAP[text]) {
            return {
                raw: text,
                name: text,
                fullName: SUBJECT_MAP[text].fullName,
                color: SUBJECT_MAP[text].color,
                category: SUBJECT_MAP[text].category
            };
        }
        // 前缀或包含匹配
        for (const [key, meta] of Object.entries(SUBJECT_MAP)) {
            if (text === key || text.startsWith(key)) {
                return {
                    raw: text,
                    name: text,
                    fullName: meta.fullName,
                    color: meta.color,
                    category: meta.category
                };
            }
        }
        return {
            raw: text,
            name: text,
            fullName: text,
            color: 'default',
            category: 'other'
        };
    }

    function colLetterToIndex(letters) {
        let col = 0;
        const upper = letters.toUpperCase();
        for (let i = 0; i < upper.length; i++) {
            col = col * 26 + (upper.charCodeAt(i) - 64);
        }
        return col;
    }

    function parseCellCoordinate(ref) {
        const match = /^([A-Z]+)(\d+)$/i.exec(ref || '');
        if (!match) return { col: 0, row: 0 };
        return {
            col: colLetterToIndex(match[1]),
            row: parseInt(match[2], 10)
        };
    }

    function normalizeDayName(rawDay) {
        const clean = String(rawDay || '').replace(/\s+/g, '');
        if (clean.includes('一') || clean.includes('1')) return '周一';
        if (clean.includes('二') || clean.includes('2')) return '周二';
        if (clean.includes('三') || clean.includes('3')) return '周三';
        if (clean.includes('四') || clean.includes('4')) return '周四';
        if (clean.includes('五') || clean.includes('5')) return '周五';
        if (clean.includes('六') || clean.includes('6')) return '周六';
        if (clean.includes('日') || clean.includes('天') || clean.includes('7')) return '周日';
        return clean.replace('星期', '周');
    }

    function formatClassDisplayName(grade, rawClass) {
        const raw = String(rawClass || '').trim();
        // 如果已经包含 "班"，例如 "初一(1)班"
        if (raw.includes('班')) return raw;
        // 如果是 "初一1" -> "初一 (1) 班"
        const m = /^([^\d]+)(\d+)$/.exec(raw);
        if (m) {
            return `${m[1]} (${m[2]}) 班`;
        }
        // 如果只有数字且有 grade
        if (/^\d+$/.test(raw) && grade) {
            return `${grade} (${raw}) 班`;
        }
        return raw;
    }

    /**
     * 解析课程表 .xlsx 文件
     */
    async function parseScheduleWorkbook(fileBufferOrBlob) {
        const JSZipLib = await window.TWS3.dependencies.ensureJSZip();
        const zip = await JSZipLib.loadAsync(fileBufferOrBlob);
        const domParser = new DOMParser();

        // 1. 读取 sharedStrings.xml
        const sharedStrings = [];
        const ssFile = zip.file('xl/sharedStrings.xml');
        if (ssFile) {
            const ssXmlText = await ssFile.async('text');
            const ssDoc = domParser.parseFromString(ssXmlText, 'application/xml');
            const siNodes = ssDoc.getElementsByTagName('si');
            for (let i = 0; i < siNodes.length; i++) {
                sharedStrings.push(siNodes[i].textContent || '');
            }
        }

        // 2. 读取工作簿结构
        const wbFile = zip.file('xl/workbook.xml');
        const wbRelsFile = zip.file('xl/_rels/workbook.xml.rels');
        if (!wbFile) {
            throw new Error('无效的 Excel 文件：缺少 xl/workbook.xml');
        }

        const wbDoc = domParser.parseFromString(await wbFile.async('text'), 'application/xml');
        const relsMap = new Map();
        if (wbRelsFile) {
            const relsDoc = domParser.parseFromString(await wbRelsFile.async('text'), 'application/xml');
            const relNodes = relsDoc.getElementsByTagName('Relationship');
            for (let i = 0; i < relNodes.length; i++) {
                const id = relNodes[i].getAttribute('Id') || relNodes[i].getAttribute('id');
                const target = relNodes[i].getAttribute('Target') || relNodes[i].getAttribute('target') || '';
                if (id && target) {
                    relsMap.set(id, target.startsWith('/') ? target.substring(1) : (target.startsWith('xl/') ? target : 'xl/' + target));
                }
            }
        }
        const sheetNodes = wbDoc.getElementsByTagName('sheet');
        const visibleSheets = [];

        for (let i = 0; i < sheetNodes.length; i++) {
            const name = sheetNodes[i].getAttribute('name');
            const rId = sheetNodes[i].getAttribute('r:id') || sheetNodes[i].getAttribute('id');
            const state = sheetNodes[i].getAttribute('state');
            const targetPath = relsMap.get(rId) || `xl/worksheets/sheet${i + 1}.xml`;

            // 跳过兼容性报表或隐藏工作表
            if (name && (name.includes('兼容') || name.includes('报表') || name.toLowerCase().includes('report'))) {
                continue;
            }
            if (state !== 'hidden' && state !== 'veryHidden') {
                visibleSheets.push({ name, path: targetPath, index: i + 1 });
            }
        }

        if (visibleSheets.length === 0) {
            throw new Error('Excel 文件中没有包含课程表的数据工作表');
        }

        let overallTitle = '';
        const parsedClasses = [];
        const gradeSet = new Set();
        const globalCourseSet = new Map();

        // 3. 解析各 Sheet
        for (let sheetIdx = 0; sheetIdx < visibleSheets.length; sheetIdx++) {
            const sheetMeta = visibleSheets[sheetIdx];
            const sFile = zip.file(sheetMeta.path);
            if (!sFile) continue;

            const sXmlText = await sFile.async('text');
            const sDoc = domParser.parseFromString(sXmlText, 'application/xml');

            // 构建单元格坐标字典
            const cells = new Map(); // key: `${row}_${col}` -> value
            const rowNodes = sDoc.getElementsByTagName('row');

            for (let r = 0; r < rowNodes.length; r++) {
                const rNode = rowNodes[r];
                const cNodes = rNode.getElementsByTagName('c');
                for (let c = 0; c < cNodes.length; c++) {
                    const cNode = cNodes[c];
                    const ref = cNode.getAttribute('r');
                    if (!ref) continue;
                    const coord = parseCellCoordinate(ref);
                    const type = cNode.getAttribute('t');
                    let val = '';
                    if (type === 'inlineStr') {
                        const isNode = cNode.getElementsByTagName('is')[0];
                        val = isNode ? (isNode.textContent || '') : '';
                    } else if (type === 's') {
                        const vNode = cNode.getElementsByTagName('v')[0];
                        if (vNode) {
                            const idx = parseInt(vNode.textContent, 10);
                            val = sharedStrings[idx] || '';
                        }
                    } else {
                        const vNode = cNode.getElementsByTagName('v')[0];
                        val = vNode ? (vNode.textContent || '') : '';
                    }
                    cells.set(`${coord.row}_${coord.col}`, val);
                }
            }

            // 处理合并单元格（主要用于星期栏横向跨列）
            const mergeNodes = sDoc.getElementsByTagName('mergeCell');
            for (let m = 0; m < mergeNodes.length; m++) {
                const ref = mergeNodes[m].getAttribute('ref');
                if (!ref || !ref.includes(':')) continue;
                const parts = ref.split(':');
                const start = parseCellCoordinate(parts[0]);
                const end = parseCellCoordinate(parts[1]);
                const rootVal = cells.get(`${start.row}_${start.col}`) || '';
                if (rootVal) {
                    for (let r = start.row; r <= end.row; r++) {
                        for (let c = start.col; c <= end.col; c++) {
                            const key = `${r}_${c}`;
                            if (!cells.has(key) || !cells.get(key)) {
                                cells.set(key, rootVal);
                            }
                        }
                    }
                }
            }

            // 提取大标题 (Row 1 ~ 2 中最长的有意义文本)
            for (let r = 1; r <= 3; r++) {
                for (let c = 1; c <= 10; c++) {
                    const txt = (cells.get(`${r}_${c}`) || '').trim();
                    if (txt && (txt.includes('课程表') || txt.includes('学年') || txt.includes('学期'))) {
                        if (!overallTitle || txt.length > overallTitle.length) {
                            overallTitle = txt;
                        }
                    }
                }
            }

            // 查找星期表头行 (包含 星期一/星 期 一/周一) 与 节次行 (包含 1, 2, 3...)
            let dayRow = null;
            let periodRow = null;
            for (let r = 1; r <= 10; r++) {
                let hasDay = false;
                for (let c = 1; c <= 45; c++) {
                    const v = (cells.get(`${r}_${c}`) || '').replace(/\s+/g, '');
                    if (v.includes('星期') || v.includes('周一') || v.includes('周二')) {
                        hasDay = true;
                        break;
                    }
                }
                if (hasDay) {
                    dayRow = r;
                    periodRow = r + 1;
                    break;
                }
            }

            if (!dayRow) continue;

            // 映射列结构 -> { col, day, period, dayId, periodId }
            const columnMetaList = [];
            const daySet = new Set();
            const periodSet = new Set();

            let currentDay = '';
            for (let c = 1; c <= 50; c++) {
                const rawDay = (cells.get(`${dayRow}_${c}`) || '').replace(/\s+/g, '');
                if (rawDay && (rawDay.includes('星') || rawDay.includes('周'))) {
                    currentDay = normalizeDayName(rawDay);
                }
                const rawPeriod = (cells.get(`${periodRow}_${c}`) || '').replace(/\s+/g, '');
                if (currentDay && rawPeriod && (/^\d+$/.test(rawPeriod) || ['早', '午', '晚'].includes(rawPeriod))) {
                    const dayId = `day_${DAY_ORDER_MAP[currentDay] || currentDay}`;
                    const periodId = `p_${rawPeriod}`;
                    columnMetaList.push({
                        col: c,
                        day: currentDay,
                        period: rawPeriod,
                        dayId,
                        periodId
                    });
                    daySet.add(currentDay);
                    periodSet.add(rawPeriod);
                }
            }

            if (columnMetaList.length === 0) continue;

            // 构建标准天数列表与节次列表
            const days = Array.from(daySet)
                .sort((a, b) => (DAY_ORDER_MAP[a] || 99) - (DAY_ORDER_MAP[b] || 99))
                .map((name, idx) => ({
                    id: `day_${DAY_ORDER_MAP[name] || (idx + 1)}`,
                    name,
                    order: idx + 1
                }));

            const periods = Array.from(periodSet)
                .sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0))
                .map((name, idx) => ({
                    id: `p_${name}`,
                    name,
                    order: idx + 1
                }));

            // 遍历班级行
            let currentGrade = '';
            for (let r = periodRow + 1; r <= 80; r++) {
                const rawClass = (cells.get(`${r}_1`) || '').trim();
                const rawTeacher = (cells.get(`${r}_2`) || '').trim();

                // 遇到备注或空白行停止或跳过
                if (!rawClass && !rawTeacher) continue;
                if (rawClass.includes('注：') || rawClass.includes('注:') || rawClass.includes('说明') || rawTeacher.includes('注：')) {
                    continue;
                }

                // 识别年级与班级全称
                let classShortName = rawClass;
                const mGrade = /^([^\d]+)(\d+.*)$/.exec(rawClass);
                if (mGrade) {
                    currentGrade = mGrade[1];
                    classShortName = rawClass;
                } else if (/^\d+$/.test(rawClass) && currentGrade) {
                    classShortName = `${currentGrade}${rawClass}`;
                } else if (!currentGrade && sheetMeta.name) {
                    currentGrade = sheetMeta.name;
                }

                if (currentGrade) {
                    gradeSet.add(currentGrade);
                }

                const classFullName = formatClassDisplayName(currentGrade, classShortName);
                const classId = `class_sched_${classShortName.replace(/[\s\(\)]+/g, '_')}`;

                // 构建课表格子映射
                const scheduleGrid = {};
                const classCourseLib = new Map();

                columnMetaList.forEach(meta => {
                    const rawCourse = (cells.get(`${r}_${meta.col}`) || '').trim();
                    if (!rawCourse) return;

                    const normalized = normalizeSubject(rawCourse);
                    if (!normalized) return;

                    const courseId = `c_${encodeURIComponent(normalized.name)}`;
                    scheduleGrid[`${meta.dayId}_${meta.periodId}`] = {
                        courseId,
                        name: normalized.name,
                        fullName: normalized.fullName,
                        color: normalized.color,
                        category: normalized.category,
                        customName: ''
                    };

                    if (!classCourseLib.has(courseId)) {
                        classCourseLib.set(courseId, {
                            id: courseId,
                            name: normalized.name,
                            fullName: normalized.fullName,
                            color: normalized.color,
                            category: normalized.category
                        });
                    }

                    if (!globalCourseSet.has(courseId)) {
                        globalCourseSet.set(courseId, {
                            id: courseId,
                            name: normalized.name,
                            fullName: normalized.fullName,
                            color: normalized.color,
                            category: normalized.category
                        });
                    }
                });

                const courseCount = Object.keys(scheduleGrid).length;
                if (courseCount > 0) {
                    parsedClasses.push({
                        id: classId,
                        shortName: classShortName,
                        name: classFullName,
                        grade: currentGrade || '其他',
                        sheet: sheetMeta.name,
                        teacher: rawTeacher || '未设置',
                        days: JSON.parse(JSON.stringify(days)),
                        periods: JSON.parse(JSON.stringify(periods)),
                        courseLibrary: Array.from(classCourseLib.values()),
                        grid: scheduleGrid,
                        lunchBreak: {
                            enabled: true,
                            afterPeriod: 4,
                            name: '午间休息'
                        },
                        totalCourses: courseCount,
                        updatedAt: new Date().toISOString()
                    });
                }
            }
        }

        if (parsedClasses.length === 0) {
            throw new Error('未从 Excel 中解析到有效的班级课程表数据');
        }

        return {
            success: true,
            title: overallTitle || '学校课程表',
            totalClasses: parsedClasses.length,
            classes: parsedClasses,
            grades: Array.from(gradeSet),
            globalCourses: Array.from(globalCourseSet.values()),
            importedAt: new Date().toISOString()
        };
    }

    window.TWS3.scheduleWorkbook = {
        parseScheduleWorkbook,
        normalizeSubject,
        SUBJECT_MAP
    };
})();
