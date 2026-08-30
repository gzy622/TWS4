(function() {
    window.TWS3 = window.TWS3 || {};

    /**
     * XML 字符转义工具
     */
    function escapeXml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * 快速 32 位 FNV-1a 哈希算法，用于生成可见工作表内容摘要
     */
    function fnv1aHash(str) {
        let hash = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = (hash * 0x01000193) >>> 0;
        }
        return hash.toString(16).padStart(8, '0');
    }

    /**
     * 计算可见工作表的规范化摘要字符串
     */
    function computeVisibleSummary(className, students, tasks, getCellVal) {
        let summary = `${(className || '').replace(/\s+/g, '')}|`;
        (students || []).forEach(s => {
            summary += `${s.studentNo || s.id}:${s.name};`;
        });
        summary += '|';
        (tasks || []).forEach(t => {
            summary += `TASK:${t.name};`;
            (students || []).forEach(s => {
                const val = getCellVal(t, s) || '';
                summary += `${s.studentNo || s.id}=${val};`;
            });
        });
        return summary;
    }

    /**
     * 将列数字转换为 Excel 列字母 (1 -> A, 2 -> B, ..., 26 -> Z, 27 -> AA)
     */
    function getColumnLetter(colIndex) {
        let temp = colIndex;
        let letter = '';
        while (temp > 0) {
            let rem = (temp - 1) % 26;
            letter = String.fromCharCode(65 + rem) + letter;
            temp = Math.floor((temp - 1) / 26);
        }
        return letter;
    }

    /**
     * 将 Excel 单元格坐标拆解为行号与列号 ("C4" -> { col: 3, row: 4 })
     */
    function parseCellRef(ref) {
        const match = ref.match(/^([A-Z]+)(\d+)$/);
        if (!match) return { col: 0, row: 0 };
        const letters = match[1];
        let col = 0;
        for (let i = 0; i < letters.length; i++) {
            col = col * 26 + (letters.charCodeAt(i) - 64);
        }
        return { col, row: parseInt(match[2], 10) };
    }

    /**
     * 格式化当前 UTC+8 时间为 YYYYMMDD
     */
    function getUtc8DateString(date = new Date()) {
        const utc8 = new Date(date.getTime() + 8 * 3600 * 1000);
        const y = utc8.getUTCFullYear();
        const m = String(utc8.getUTCMonth() + 1).padStart(2, '0');
        const d = String(utc8.getUTCDate()).padStart(2, '0');
        return `${y}${m}${d}`;
    }

    /**
     * 生成导出默认标题 (YYYY年MM月DD日班级名学生名单N人)
     */
    function getDefaultExportTitle(className, studentCount, date = new Date()) {
        const utc8 = new Date(date.getTime() + 8 * 3600 * 1000);
        const y = utc8.getUTCFullYear();
        const m = String(utc8.getUTCMonth() + 1).padStart(2, '0');
        const d = String(utc8.getUTCDate()).padStart(2, '0');
        const cleanClass = (className || '班级').replace(/\s+/g, '');
        return `${y}年${m}月${d}日${cleanClass}学生名单${studentCount}人`;
    }

    /**
     * 生成标准记分册文件名 (班级名_标准记分册_YYYYMMDD.xlsx)
     */
    function getDefaultFileName(className, date = new Date()) {
        const cleanClass = (className || '班级').replace(/[\s\/\\:\*\?"<>\|]+/g, '_');
        const dateStr = getUtc8DateString(date);
        return `${cleanClass}_标准记分册_${dateStr}.xlsx`;
    }

    function parseClassNameFromTitle(title) {
        return String(title || '')
            .replace(/^\s*\d{4}年\d{1,2}月\d{1,2}日\s*/, '')
            .replace(/^\s*\d{4}\s*-\s*\d{4}学年(?:第[一二]学期)?\s*/, '')
            .replace(/学生名单\s*\d+\s*人\s*$/, '')
            .trim();
    }

    /**
     * OOXML 样式表定义 (styles.xml)
     */
    function generateStylesXml() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <fonts count="4">
        <font>
            <sz val="10"/>
            <color rgb="FF1F2328"/>
            <name val="宋体"/>
            <family val="2"/>
        </font>
        <font>
            <b/>
            <sz val="14"/>
            <color rgb="FF111827"/>
            <name val="微软雅黑"/>
            <family val="2"/>
        </font>
        <font>
            <b/>
            <sz val="10.5"/>
            <color rgb="FF374151"/>
            <name val="微软雅黑"/>
            <family val="2"/>
        </font>
        <font>
            <sz val="10"/>
            <color rgb="FF4B5563"/>
            <name val="宋体"/>
            <family val="2"/>
        </font>
    </fonts>
    <fills count="4">
        <fill><patternFill patternType="none"/></fill>
        <fill><patternFill patternType="gray125"/></fill>
        <fill>
            <patternFill patternType="solid">
                <fgColor rgb="FFF3F4F6"/>
                <bgColor indexed="64"/>
            </patternFill>
        </fill>
        <fill>
            <patternFill patternType="solid">
                <fgColor rgb="FFFAFAFA"/>
                <bgColor indexed="64"/>
            </patternFill>
        </fill>
    </fills>
    <borders count="5">
        <border><left/><right/><top/><bottom/><diagonal/></border>
        <!-- 1. 表头普通边框 (双底边) -->
        <border>
            <left style="thin"><color rgb="FFD1D5DB"/></left>
            <right style="thin"><color rgb="FFD1D5DB"/></right>
            <top style="medium"><color rgb="FF9CA3AF"/></top>
            <bottom style="double"><color rgb="FF6B7280"/></bottom>
        </border>
        <!-- 2. 普通数据单元格边框 -->
        <border>
            <left style="thin"><color rgb="FFD1D5DB"/></left>
            <right style="thin"><color rgb="FFD1D5DB"/></right>
            <top style="thin"><color rgb="FFD1D5DB"/></top>
            <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
        </border>
        <!-- 3. 首行数据边框 -->
        <border>
            <left style="thin"><color rgb="FFD1D5DB"/></left>
            <right style="thin"><color rgb="FFD1D5DB"/></right>
            <top style="thin"><color rgb="FF6B7280"/></top>
            <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
        </border>
        <!-- 4. 末行数据边框 -->
        <border>
            <left style="thin"><color rgb="FFD1D5DB"/></left>
            <right style="thin"><color rgb="FFD1D5DB"/></right>
            <top style="thin"><color rgb="FFD1D5DB"/></top>
            <bottom style="medium"><color rgb="FF6B7280"/></bottom>
        </border>
    </borders>
    <cellStyleXfs count="1">
        <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
    </cellStyleXfs>
    <cellXfs count="9">
        <!-- 0: 默认无样式 -->
        <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
        <!-- 1: 大标题 (居中, 14pt 加粗, 无边框) -->
        <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">
            <alignment horizontal="center" vertical="center"/>
        </xf>
        <!-- 2: 表头 (居中, 10.5pt 加粗, 浅灰底, 双下边框) -->
        <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
            <alignment horizontal="center" vertical="center" wrapText="1"/>
        </xf>
        <!-- 3: 学号列 (居中, 普通边框) -->
        <xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
            <alignment horizontal="center" vertical="center"/>
        </xf>
        <!-- 4: 姓名列 (居中, 普通边框) -->
        <xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
            <alignment horizontal="center" vertical="center"/>
        </xf>
        <!-- 5: 提交记录列 (居中, 10.5pt 加粗, 普通边框) -->
        <xf numFmtId="0" fontId="2" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
            <alignment horizontal="center" vertical="center"/>
        </xf>
        <!-- 6: 首行数据记录 -->
        <xf numFmtId="0" fontId="0" fillId="0" borderId="3" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
            <alignment horizontal="center" vertical="center"/>
        </xf>
        <!-- 7: 末行数据记录 -->
        <xf numFmtId="0" fontId="0" fillId="0" borderId="4" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
            <alignment horizontal="center" vertical="center"/>
        </xf>
        <!-- 8: 隐藏备份页原始文本样式 -->
        <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    </cellXfs>
</styleSheet>`;
    }

    function inlineStringCell(ref, styleId, value) {
        return `<c r="${ref}" s="${styleId}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
    }

    function emptyCell(ref, styleId) {
        return `<c r="${ref}" s="${styleId}"/>`;
    }

    /**
     * 仅替换模板工作表中的数据区，模板的列宽、缩放、打印、保护及合并配置保持原样。
     */
    function generateVisibleSheetXml({ templateXml, title, tasksChunk, students, records, selected }) {
        const fixedTasks = Array.from({ length: 10 }, (_, index) => tasksChunk[index] || null);
        let rowsXml = '';

        rowsXml += '<row r="1" spans="1:12">';
        rowsXml += inlineStringCell('A1', 2, title);
        for (let col = 2; col <= 12; col++) rowsXml += emptyCell(`${getColumnLetter(col)}1`, 2);
        rowsXml += '</row>';

        rowsXml += '<row r="2" spans="1:12">';
        rowsXml += inlineStringCell('A2', 3, '学号');
        rowsXml += inlineStringCell('B2', 4, '姓名');
        fixedTasks.forEach((task, index) => {
            const ref = `${getColumnLetter(index + 3)}2`;
            rowsXml += task ? inlineStringCell(ref, 5, task.name) : emptyCell(ref, 5);
        });
        rowsXml += '</row>';

        students.forEach((student, index) => {
            const rowNum = index + 3;
            const isFirst = index === 0;
            const isLast = index === students.length - 1;
            let styles;
            if (isLast) {
                styles = { id: 18, name: 19, middle: 20, end: 21 };
            } else if (isFirst) {
                styles = { id: 6, name: 7, middle: 8, end: 9 };
            } else if (index % 2 === 1) {
                styles = { id: 10, name: 11, middle: 12, end: 13 };
            } else {
                styles = { id: 14, name: 15, middle: 16, end: 17 };
            }

            rowsXml += `<row r="${rowNum}" spans="1:12">`;
            const studentNo = student.studentNo || student.id;
            const numericNo = Number(studentNo);
            rowsXml += Number.isFinite(numericNo)
                ? `<c r="A${rowNum}" s="${styles.id}"><v>${numericNo}</v></c>`
                : inlineStringCell(`A${rowNum}`, styles.id, studentNo);
            rowsXml += inlineStringCell(`B${rowNum}`, styles.name, student.name);

            fixedTasks.forEach((task, taskIndex) => {
                const col = getColumnLetter(taskIndex + 3);
                const styleId = taskIndex === 9 ? styles.end : styles.middle;
                if (!task) {
                    rowsXml += emptyCell(`${col}${rowNum}`, styleId);
                    return;
                }
                const record = (records[task.id] || {})[student.id] || { status: 'white', badge: null };
                let value = '';
                if (record.badge) value = record.badge;
                else if (record.status === 'dark') value = '√';
                else if (record.status === 'muted') value = '/';
                rowsXml += value
                    ? inlineStringCell(`${col}${rowNum}`, styleId, value)
                    : emptyCell(`${col}${rowNum}`, styleId);
            });
            rowsXml += '</row>';
        });

        const lastRow = Math.max(2, students.length + 2);
        let result = templateXml
            .replace(/<dimension\s+ref="[^"]+"\s*\/>/, `<dimension ref="A1:L${lastRow}"/>`)
            .replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${rowsXml}</sheetData>`)
            .replace(
                /<selection\b[^>]*\/>/,
                '<pane xSplit="2" ySplit="2" topLeftCell="C3" activePane="bottomRight" state="frozen"/>' +
                '<selection pane="topRight" activeCell="C1" sqref="C1"/>' +
                '<selection pane="bottomLeft" activeCell="A3" sqref="A3"/>' +
                '<selection pane="bottomRight" activeCell="C3" sqref="C3"/>'
            );

        if (!selected) result = result.replace(/\s+tabSelected="1"/, '');
        return result;
    }

    /**
     * 生成隐藏备份工作表 XML (_tws3_backup.xml)
     */
    function generateBackupSheetXml(backupJsonString) {
        const CHUNK_SIZE = 30000;
        let rowsXml = '';
        let rowIdx = 1;

        for (let i = 0; i < backupJsonString.length; i += CHUNK_SIZE) {
            const chunk = backupJsonString.substring(i, i + CHUNK_SIZE);
            rowsXml += `<row r="${rowIdx}"><c r="A${rowIdx}" t="inlineStr"><is><t>${escapeXml(chunk)}</t></is></c></row>`;
            rowIdx++;
        }

        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <sheetViews>
        <sheetView workbookViewId="0"/>
    </sheetViews>
    <sheetData>
        ${rowsXml}
    </sheetData>
</worksheet>`;
    }

    /**
     * 构建标准记分册 .xlsx 文件 (JSZip 打包)
     */
    async function exportWorkbook({ title, storeInstance, date = new Date() }) {
        const JSZipLib = await window.TWS3.dependencies.ensureJSZip();

        const state = storeInstance.getState();
        const className = state.currentClass || '高二 (3) 班';
        const students = state.students || [];
        const records = state.records || {};

        // 任务按最早到最新排列 (createdAt 升序)
        const sortedTasks = (state.tasks || []).slice().sort((a, b) => {
            const ta = a.createdAt || a.id;
            const tb = b.createdAt || b.id;
            return ta.localeCompare(tb);
        });

        // 每 10 项任务拆分一个可见工作表
        const taskChunks = [];
        if (sortedTasks.length === 0) {
            taskChunks.push([]);
        } else {
            for (let i = 0; i < sortedTasks.length; i += 10) {
                taskChunks.push(sortedTasks.slice(i, i + 10));
            }
        }

        // 1. 生成并计算所有可见工作表的规范化内容哈希
        const visibleSummaryStr = computeVisibleSummary(className, students, sortedTasks, (t, s) => {
            const tRecs = records[t.id] || {};
            const r = tRecs[s.id] || {};
            if (r.badge) return r.badge;
            if (r.status === 'dark') return '√';
            if (r.status === 'muted') return '/';
            return '';
        });
        const visibleSheetHash = fnv1aHash(visibleSummaryStr);

        // 2. 生成完整备份状态快照 JSON 字符串
        const backupSnapshot = storeInstance.exportStateSnapshot(visibleSheetHash);
        const backupJsonString = JSON.stringify(backupSnapshot);

        // 3. 载入学校原始模板并在原包内替换数据，禁止重新生成样式和页面配置。
        const templateResponse = await fetch('assets/standard-roster-template.xlsx', { cache: 'no-store' });
        if (!templateResponse.ok) {
            throw new Error('标准记分册模板加载失败');
        }
        const zip = await JSZipLib.loadAsync(await templateResponse.arrayBuffer());
        const templateSheetFile = zip.file('xl/worksheets/sheet1.xml');
        if (!templateSheetFile) {
            throw new Error('标准记分册模板缺少 Sheet1');
        }
        const templateSheetXml = await templateSheetFile.async('text');

        const outputTitle = title || getDefaultExportTitle(className, students.length, date);
        taskChunks.forEach((chunk, index) => {
            zip.file(`xl/worksheets/sheet${index + 1}.xml`, generateVisibleSheetXml({
                templateXml: templateSheetXml,
                title: outputTitle,
                tasksChunk: chunk,
                students,
                records,
                selected: index === 0
            }));
        });
        zip.file('xl/worksheets/sheet_backup.xml', generateBackupSheetXml(backupJsonString));

        let contentTypesXml = await zip.file('[Content_Types].xml').async('text');
        const worksheetContentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml';
        let addedContentTypes = '';
        for (let index = 1; index < taskChunks.length; index++) {
            addedContentTypes += `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="${worksheetContentType}"/>`;
        }
        addedContentTypes += `<Override PartName="/xl/worksheets/sheet_backup.xml" ContentType="${worksheetContentType}"/>`;
        contentTypesXml = contentTypesXml.replace('</Types>', `${addedContentTypes}</Types>`);
        zip.file('[Content_Types].xml', contentTypesXml);

        let workbookRelsXml = await zip.file('xl/_rels/workbook.xml.rels').async('text');
        let addedRelationships = '';
        for (let index = 1; index < taskChunks.length; index++) {
            addedRelationships += `<Relationship Id="rIdSheet${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`;
        }
        addedRelationships += '<Relationship Id="rIdBackup" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet_backup.xml"/>';
        workbookRelsXml = workbookRelsXml.replace('</Relationships>', `${addedRelationships}</Relationships>`);
        zip.file('xl/_rels/workbook.xml.rels', workbookRelsXml);

        let sheetsXml = '<sheets>';
        taskChunks.forEach((_, index) => {
            const relationshipId = index === 0 ? 'rId1' : `rIdSheet${index + 1}`;
            sheetsXml += `<sheet name="Sheet${index + 1}" sheetId="${index + 1}" r:id="${relationshipId}"/>`;
        });
        sheetsXml += `<sheet name="_TWS3_BACKUP" sheetId="${taskChunks.length + 1}" state="veryHidden" r:id="rIdBackup"/></sheets>`;

        let workbookXml = await zip.file('xl/workbook.xml').async('text');
        workbookXml = workbookXml.replace(/<sheets>[\s\S]*?<\/sheets>/, sheetsXml);
        zip.file('xl/workbook.xml', workbookXml);

        // 4. 打包生成二进制文件
        const blob = await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const fileName = getDefaultFileName(className, date);
        return { blob, fileName };
    }

    /**
     * 辅助解析 XML 中的单元格文本
     */
    function extractTextFromXmlNode(cNode, sharedStrings) {
        const type = cNode.getAttribute('t');
        if (type === 'inlineStr') {
            const isNode = cNode.getElementsByTagName('is')[0];
            return isNode ? (isNode.textContent || '') : '';
        } else if (type === 's') {
            const vNode = cNode.getElementsByTagName('v')[0];
            if (!vNode) return '';
            const idx = parseInt(vNode.textContent, 10);
            return sharedStrings[idx] || '';
        } else {
            const vNode = cNode.getElementsByTagName('v')[0];
            return vNode ? (vNode.textContent || '') : '';
        }
    }

    /**
     * 解析标准记分册 .xlsx 文件 (JSZip 解包)
     */
    async function parseWorkbook(fileBufferOrBlob, fileMtimeIso = null) {
        const JSZipLib = await window.TWS3.dependencies.ensureJSZip();

        const zip = await JSZipLib.loadAsync(fileBufferOrBlob);
        const domParser = new DOMParser();

        // 1. 读取 sharedStrings.xml (如果存在)
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

        // 2. 读取 xl/workbook.xml 与 xl/_rels/workbook.xml.rels 建立 Sheet 映射
        const wbFile = zip.file('xl/workbook.xml');
        const wbRelsFile = zip.file('xl/_rels/workbook.xml.rels');
        if (!wbFile) {
            throw new Error('无效的 Excel 文件：缺少 xl/workbook.xml');
        }

        const wbDoc = domParser.parseFromString(await wbFile.async('text'), 'application/xml');
        let relsMap = new Map();
        if (wbRelsFile) {
            const relsDoc = domParser.parseFromString(await wbRelsFile.async('text'), 'application/xml');
            const relNodes = relsDoc.getElementsByTagName('Relationship');
            for (let i = 0; i < relNodes.length; i++) {
                const id = relNodes[i].getAttribute('Id');
                const target = relNodes[i].getAttribute('Target');
                relsMap.set(id, target.startsWith('/') ? target.substring(1) : (target.startsWith('xl/') ? target : 'xl/' + target));
            }
        }

        const sheetNodes = wbDoc.getElementsByTagName('sheet');
        let backupSheetPath = null;
        const visibleSheetPaths = [];

        for (let i = 0; i < sheetNodes.length; i++) {
            const name = sheetNodes[i].getAttribute('name');
            const rId = sheetNodes[i].getAttribute('r:id');
            const state = sheetNodes[i].getAttribute('state');
            const targetPath = relsMap.get(rId) || `xl/worksheets/sheet${i + 1}.xml`;

            if (name === '_TWS3_BACKUP') {
                backupSheetPath = targetPath;
            } else if (state !== 'hidden' && state !== 'veryHidden') {
                visibleSheetPaths.push({ name, path: targetPath, index: i + 1 });
            }
        }

        // 3. 检查并读取隐藏备份工作表
        let parsedBackup = null;
        if (backupSheetPath && zip.file(backupSheetPath)) {
            try {
                const bText = await zip.file(backupSheetPath).async('text');
                const bDoc = domParser.parseFromString(bText, 'application/xml');
                const cNodes = bDoc.getElementsByTagName('c');
                let fullJsonStr = '';
                for (let i = 0; i < cNodes.length; i++) {
                    fullJsonStr += extractTextFromXmlNode(cNodes[i], sharedStrings);
                }
                if (fullJsonStr) {
                    parsedBackup = JSON.parse(fullJsonStr);
                }
            } catch (err) {
                console.warn('解析隐藏备份页失败，将按普通标准模板读取:', err);
            }
        }

        // 4. 读取与校验所有可见工作表
        if (visibleSheetPaths.length === 0) {
            throw new Error('Excel 文件中没有可见的工作表');
        }

        let parsedClassName = '';
        let baseRoster = null; // 用于跨表校验首表花名册
        const parsedTasks = [];
        const parsedRecords = {};
        const visibleRawCellMap = new Map(); // key: `${taskName}_${studentNo}` -> rawVal

        const effectiveMtime = fileMtimeIso || new Date().toISOString();

        for (let sheetIdx = 0; sheetIdx < visibleSheetPaths.length; sheetIdx++) {
            const sheetMeta = visibleSheetPaths[sheetIdx];
            const sFile = zip.file(sheetMeta.path);
            if (!sFile) continue;

            const sDoc = domParser.parseFromString(await sFile.async('text'), 'application/xml');
            const rowNodes = sDoc.getElementsByTagName('row');
            if (rowNodes.length < 2) {
                throw new Error(`工作表 "${sheetMeta.name}" 数据行数不足`);
            }

            // 解析每个单元格构建二维映射
            const cellMap = new Map();
            for (let r = 0; r < rowNodes.length; r++) {
                const rNode = rowNodes[r];
                const rowNum = parseInt(rNode.getAttribute('r'), 10);
                const cNodes = rNode.getElementsByTagName('c');
                for (let c = 0; c < cNodes.length; c++) {
                    const cNode = cNodes[c];
                    const ref = cNode.getAttribute('r');
                    const text = extractTextFromXmlNode(cNode, sharedStrings).trim();
                    const { col } = parseCellRef(ref);
                    cellMap.set(`${col}_${rowNum}`, text);
                }
            }

            // 4.1 A1 解析班级
            const a1Text = cellMap.get('1_1') || '';
            if (sheetIdx === 0) {
                parsedClassName = parseClassNameFromTitle(a1Text) || '高二 (3) 班';
            }

            // 4.2 第 2 行解析表头 (A: 学号, B: 姓名, C..L: 最多 10 个任务)
            const hA = cellMap.get('1_2') || '';
            const hB = cellMap.get('2_2') || '';
            if (hA !== '学号' || hB !== '姓名') {
                throw new Error(`工作表 "${sheetMeta.name}" 表头格式错误：A2 应为“学号”，B2 应为“姓名”（当前：A2="${hA}", B2="${hB}"）`);
            }

            const currentSheetTasks = [];
            for (let col = 3; col <= 12; col++) {
                const taskName = cellMap.get(`${col}_2`);
                if (taskName) {
                    const taskId = `task_xlsx_${sheetIdx + 1}_${col}_${taskName}`;
                    currentSheetTasks.push({ col, id: taskId, name: taskName });
                    parsedTasks.push({
                        id: taskId,
                        name: taskName,
                        archived: false,
                        createdAt: effectiveMtime,
                        updatedAt: effectiveMtime
                    });
                    if (!parsedRecords[taskId]) parsedRecords[taskId] = {};
                }
            }

            // 4.3 第 3 行及之后解析学生名单与记录
            const currentSheetStudents = [];
            const studentNoSet = new Set();

            for (let r = 3; r <= rowNodes.length + 5; r++) {
                const sNo = cellMap.get(`1_${r}`);
                const sName = cellMap.get(`2_${r}`);
                if (!sNo && !sName) {
                    // 连续空行视为名单结束
                    if (!cellMap.get(`1_${r + 1}`) && !cellMap.get(`1_${r + 2}`)) {
                        break;
                    }
                    continue;
                }

                if (!sNo) {
                    throw new Error(`工作表 "${sheetMeta.name}" 第 ${r} 行学号为空`);
                }
                if (studentNoSet.has(sNo)) {
                    throw new Error(`工作表 "${sheetMeta.name}" 第 ${r} 行学号 "${sNo}" 重复`);
                }
                studentNoSet.add(sNo);

                const studentObj = {
                    id: parseInt(sNo, 10) || sNo,
                    studentNo: String(sNo),
                    name: sName || `学生${sNo}`,
                    updatedAt: effectiveMtime
                };
                currentSheetStudents.push(studentObj);

                // 读取任务记录
                currentSheetTasks.forEach(task => {
                    const rawVal = cellMap.get(`${task.col}_${r}`) || '';
                    visibleRawCellMap.set(`${task.id}_${studentObj.studentNo}`, rawVal);
                    visibleRawCellMap.set(`${task.name}_${studentObj.studentNo}`, rawVal);

                    let status = 'white';
                    let badge = null;
                    let score = null;
                    let note = null;

                    if (!rawVal) {
                        status = 'white';
                    } else if (rawVal === '√' || rawVal === '✔' || rawVal === '对' || rawVal === '1') {
                        status = 'dark';
                    } else if (rawVal === '/' || rawVal === '请假' || rawVal === '-') {
                        status = 'muted';
                    } else {
                        // 数字 / 分数 / 备注
                        const scoreMatch = rawVal.match(/^(\d+(?:\.\d+)?)分?$/);
                        if (scoreMatch) {
                            status = 'dark';
                            badge = scoreMatch[1];
                            score = parseFloat(scoreMatch[1]);
                        } else {
                            status = 'dark';
                            badge = rawVal;
                            note = rawVal;
                        }
                    }

                    parsedRecords[task.id][studentObj.id] = {
                        status,
                        badge,
                        score,
                        note,
                        updatedAt: effectiveMtime
                    };
                });
            }

            // 4.4 跨工作表花名册一致性校验
            if (sheetIdx === 0) {
                baseRoster = currentSheetStudents;
            } else {
                if (baseRoster.length !== currentSheetStudents.length) {
                    throw new Error(`工作表 "${sheetMeta.name}" 学生人数 (${currentSheetStudents.length}人) 与首张工作表 (${baseRoster.length}人) 不一致`);
                }
                for (let i = 0; i < baseRoster.length; i++) {
                    const b = baseRoster[i];
                    const c = currentSheetStudents[i];
                    if (b.studentNo !== c.studentNo || b.name !== c.name) {
                        throw new Error(`工作表 "${sheetMeta.name}" 与首张工作表花名册不一致（第 ${i + 3} 行：首表为 ${b.studentNo}号 ${b.name}，当前表为 ${c.studentNo}号 ${c.name}）`);
                    }
                }
            }
        }

        // 5. 计算当前可见表规范化摘要哈希
        // 如果存在隐藏备份，则使用备份里的班级名作为基准进行归一化（防止大标题与班级名微小空白差异）
        const baseClassName = (parsedBackup && parsedBackup.state && parsedBackup.state.currentClass) ? parsedBackup.state.currentClass : parsedClassName;
        const visibleSummaryStr = computeVisibleSummary(baseClassName, baseRoster, parsedTasks, (t, s) => {
            return visibleRawCellMap.get(`${t.name}_${s.studentNo || s.id}`) || '';
        });
        const currentVisibleHash = fnv1aHash(visibleSummaryStr);

        // 6. 整合构建解析结果包
        const visibleConstructedState = {
            schemaVersion: 2,
            currentClass: parsedClassName,
            classUpdatedAt: effectiveMtime,
            students: baseRoster || [],
            deletedStudents: [],
            tasks: parsedTasks,
            deletedTasks: [],
            currentTaskId: parsedTasks[0] ? parsedTasks[0].id : '',
            operationMode: 'check',
            records: parsedRecords
        };

        if (parsedBackup && parsedBackup.state) {
            const bMeta = parsedBackup.metadata || {};
            const backupHash = bMeta.visibleSheetHash || '';
            const isExternalEdited = backupHash && backupHash !== currentVisibleHash;

            let finalState = JSON.parse(JSON.stringify(parsedBackup.state));
            let externalEditCount = 0;

            if (isExternalEdited) {
                // 计算外部编辑更新时间：取文件修改时间与备份导出时间之后的较晚值
                const backupTime = bMeta.exportedAt || '1970-01-01T00:00:00.000Z';
                const editTime = (effectiveMtime > backupTime) ? effectiveMtime : backupTime;

                // 班级变更
                if (parsedClassName && parsedClassName.replace(/\s+/g, '') !== (finalState.currentClass || '').replace(/\s+/g, '')) {
                    finalState.currentClass = parsedClassName;
                    finalState.classUpdatedAt = editTime;
                    externalEditCount++;
                }

                // 以学号对齐可见花名册，保留隐藏备份中的稳定学生 ID，同时反映改名、增删和排序。
                const backupStudents = finalState.students || [];
                const backupStudentByNo = new Map(backupStudents.map(student => [String(student.studentNo || student.id), student]));
                const visibleStudentPairs = new Map();
                const nextStudents = (baseRoster || []).map((visibleStudent, index) => {
                    const backupStudent = backupStudentByNo.get(String(visibleStudent.studentNo || visibleStudent.id));
                    if (!backupStudent) {
                        externalEditCount++;
                        const created = { ...visibleStudent, updatedAt: editTime };
                        visibleStudentPairs.set(String(visibleStudent.id), created);
                        return created;
                    }
                    if (backupStudent.name !== visibleStudent.name) externalEditCount++;
                    const result = { ...backupStudent, name: visibleStudent.name };
                    if (backupStudent.name !== visibleStudent.name) result.updatedAt = editTime;
                    visibleStudentPairs.set(String(visibleStudent.id), result);
                    return result;
                });
                if (nextStudents.length !== backupStudents.length) externalEditCount++;
                finalState.students = nextStudents;

                // 可见表按创建时间导出。仅当文件中的任务顺序确实偏离备份顺序时，才将新顺序写入待比较状态。
                const backupTasks = finalState.tasks || [];
                const backupTaskSequence = backupTasks.slice().sort((a, b) => (a.createdAt || a.id).localeCompare(b.createdAt || b.id));
                const taskNameQueues = new Map();
                backupTasks.forEach(task => {
                    const key = String(task.name || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
                    if (!taskNameQueues.has(key)) taskNameQueues.set(key, []);
                    taskNameQueues.get(key).push(task);
                });
                const usedTaskIds = new Set();
                const visibleTaskPairs = parsedTasks.map((visibleTask, index) => {
                    const key = String(visibleTask.name || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
                    let backupTask = (taskNameQueues.get(key) || []).find(task => !usedTaskIds.has(task.id));
                    if (!backupTask) backupTask = backupTaskSequence.find(task => !usedTaskIds.has(task.id));
                    if (backupTask) {
                        usedTaskIds.add(backupTask.id);
                        if (backupTask.name !== visibleTask.name) externalEditCount++;
                        return { visible: visibleTask, task: { ...backupTask, name: visibleTask.name, updatedAt: backupTask.name === visibleTask.name ? backupTask.updatedAt : editTime } };
                    }
                    externalEditCount++;
                    return { visible: visibleTask, task: { ...visibleTask, updatedAt: editTime } };
                });
                const visibleTaskIds = visibleTaskPairs.map(pair => pair.task.id);
                const canonicalTaskIds = backupTaskSequence.map(task => task.id);
                const taskOrderChanged = visibleTaskIds.length !== canonicalTaskIds.length || visibleTaskIds.some((id, index) => id !== canonicalTaskIds[index]);
                const backupTaskById = new Map(backupTasks.map(task => [String(task.id), task]));
                const taskMetadataChanged = visibleTaskPairs.some(pair => {
                    const backupTask = backupTaskById.get(String(pair.task.id));
                    return !backupTask || backupTask.name !== pair.task.name;
                }) || visibleTaskPairs.length !== backupTasks.length;
                if (taskOrderChanged) {
                    externalEditCount++;
                    finalState.tasks = visibleTaskPairs.map(pair => pair.task);
                } else if (taskMetadataChanged) {
                    finalState.tasks = backupTasks
                        .filter(task => usedTaskIds.has(task.id))
                        .map(task => visibleTaskPairs.find(pair => String(pair.task.id) === String(task.id)).task)
                        .concat(visibleTaskPairs.filter(pair => !backupTaskById.has(String(pair.task.id))).map(pair => pair.task));
                }

                // 记录变更按已经匹配的任务与学生关联，不使用可见表临时生成的 ID。
                for (const pair of visibleTaskPairs) {
                    const vTask = pair.visible;
                    const bTask = pair.task;
                    const vTaskRecs = parsedRecords[vTask.id] || {};
                    if (!finalState.records[bTask.id]) finalState.records[bTask.id] = {};
                    const bTaskRecs = finalState.records[bTask.id];
                    for (const visibleStudent of (baseRoster || [])) {
                        const stableStudent = visibleStudentPairs.get(String(visibleStudent.id));
                        if (!stableStudent) continue;
                        const vRec = vTaskRecs[visibleStudent.id];
                        const bRec = bTaskRecs[stableStudent.id] || { status: 'white', badge: null, score: null, note: null };
                        if (vRec && (vRec.status !== bRec.status || vRec.badge !== bRec.badge || vRec.score !== bRec.score || vRec.note !== bRec.note)) {
                            bTaskRecs[stableStudent.id] = {
                                status: vRec.status,
                                badge: vRec.badge,
                                score: vRec.score,
                                note: vRec.note,
                                updatedAt: editTime
                            };
                            externalEditCount++;
                        }
                    }
                }
            }

            return {
                hasBackup: true,
                isExternalEdited: !!isExternalEdited,
                externalEditCount: externalEditCount,
                metadata: bMeta,
                fileMtime: effectiveMtime,
                visibleRawCells: Object.fromEntries(visibleRawCellMap),
                state: finalState,
                visibleState: visibleConstructedState,
                sheetHash: currentVisibleHash
            };
        }

        // 普通无隐藏备份文件的学校表格
        return {
            hasBackup: false,
            isExternalEdited: false,
            externalEditCount: 0,
            metadata: null,
            fileMtime: effectiveMtime,
            visibleRawCells: Object.fromEntries(visibleRawCellMap),
            state: visibleConstructedState,
            visibleState: visibleConstructedState,
            sheetHash: currentVisibleHash
        };
    }

    window.TWS3.workbook = {
        exportWorkbook,
        parseWorkbook,
        getDefaultExportTitle,
        getDefaultFileName,
        parseClassNameFromTitle,
        fnv1aHash,
        computeVisibleSummary
    };
})();
