(function() {
    window.TWS3 = window.TWS3 || {};

    const SEAT_COLUMNS = [2, 3, 5, 6, 8, 9, 11, 12];
    const GROUP_COLUMNS = [[2, 3], [5, 6], [8, 9], [11, 12]];

    function escapeXml(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function columnName(column) {
        let value = column;
        let result = '';
        while (value > 0) {
            value--;
            result = String.fromCharCode(65 + (value % 26)) + result;
            value = Math.floor(value / 26);
        }
        return result;
    }

    function parseCellReference(reference) {
        const match = /^([A-Z]+)(\d+)$/i.exec(reference || '');
        if (!match) return null;
        let column = 0;
        for (const char of match[1].toUpperCase()) column = column * 26 + char.charCodeAt(0) - 64;
        return { column, row: Number(match[2]) };
    }

    function getCellText(cell, sharedStrings) {
        const type = cell.getAttribute('t');
        if (type === 'inlineStr') {
            const inline = cell.getElementsByTagName('is')[0];
            return inline ? inline.textContent || '' : '';
        }
        const value = cell.getElementsByTagName('v')[0];
        if (!value) return '';
        if (type === 's') return sharedStrings[Number(value.textContent)] || '';
        return value.textContent || '';
    }

    async function parseSeatWorkbook(fileBufferOrBlob, students) {
        const JSZipLib = await window.TWS3.dependencies.ensureJSZip();
        const zip = await JSZipLib.loadAsync(fileBufferOrBlob);
        const parser = new DOMParser();
        const sharedStrings = [];
        const sharedFile = zip.file('xl/sharedStrings.xml');
        if (sharedFile) {
            const documentNode = parser.parseFromString(await sharedFile.async('text'), 'application/xml');
            Array.from(documentNode.getElementsByTagName('si')).forEach(node => sharedStrings.push(node.textContent || ''));
        }

        const sheetFiles = Object.keys(zip.files)
            .filter(path => /^xl\/worksheets\/sheet\d+\.xml$/i.test(path))
            .sort((left, right) => Number(left.match(/sheet(\d+)/i)[1]) - Number(right.match(/sheet(\d+)/i)[1]));
        if (!sheetFiles.length) throw new Error('文件中没有可读取的工作表');
        const sheetDocument = parser.parseFromString(await zip.file(sheetFiles[0]).async('text'), 'application/xml');
        const cells = new Map();
        Array.from(sheetDocument.getElementsByTagName('c')).forEach(cell => {
            const position = parseCellReference(cell.getAttribute('r'));
            if (position) cells.set(`${position.row}:${position.column}`, getCellText(cell, sharedStrings).trim());
        });

        const valueAt = (row, column) => cells.get(`${row}:${column}`) || '';
        let groupRow = 0;
        cells.forEach((value, key) => {
            if (!/^第\s*\d+\s*组$/.test(value)) return;
            const row = Number(key.split(':')[0]);
            if (!groupRow || row < groupRow) groupRow = row;
        });
        if (!groupRow) {
            const populatedRows = Array.from(cells.keys()).map(key => Number(key.split(':')[0]));
            groupRow = Math.max(3, Math.max.apply(null, populatedRows) + 1);
        }

        const groupNames = GROUP_COLUMNS.map(([column], index) => valueAt(groupRow, column) || `第${index + 1}组`);
        let className = '';
        cells.forEach((value, key) => {
            const row = Number(key.split(':')[0]);
            if (row > groupRow && /班/.test(value) && !className) className = value;
        });

        const importedSeats = [];
        for (let nameRow = 1; nameRow < groupRow; nameRow += 2) {
            SEAT_COLUMNS.forEach((column, index) => {
                const name = valueAt(nameRow, column);
                const studentNo = valueAt(nameRow + 1, column);
                if (!name && !studentNo) return;
                importedSeats.push({
                    name,
                    studentNo: String(studentNo || '').replace(/\.0$/, ''),
                    row: Math.floor((nameRow - 1) / 2),
                    group: Math.floor(index / 2),
                    side: index % 2
                });
            });
        }

        if (!importedSeats.length) throw new Error('未识别到座位数据，请使用与示例一致的表格结构');
        const byNumber = new Map();
        const byName = new Map();
        (students || []).forEach(student => {
            const numberKey = String(student.studentNo || student.id).trim();
            if (!byNumber.has(numberKey)) byNumber.set(numberKey, []);
            byNumber.get(numberKey).push(student);
            const nameKey = String(student.name || '').trim();
            if (!byName.has(nameKey)) byName.set(nameKey, []);
            byName.get(nameKey).push(student);
        });

        const used = new Set();
        const layout = [];
        const unmatched = [];
        importedSeats.forEach(seat => {
            const numberMatches = byNumber.get(seat.studentNo) || [];
            const nameMatches = byName.get(seat.name) || [];
            const student = numberMatches.find(entry => !used.has(String(entry.id)))
                || nameMatches.find(entry => !used.has(String(entry.id)));
            if (!student) {
                unmatched.push(seat.name || seat.studentNo || '未命名座位');
                return;
            }
            used.add(String(student.id));
            layout.push({ studentId: student.id, row: seat.row, group: seat.group, side: seat.side });
        });

        return { layout, groupNames, className, importedCount: importedSeats.length, matchedCount: layout.length, unmatched };
    }

    function inlineCell(reference, value, style) {
        if (value === '' || value === null || value === undefined) return `<c r="${reference}" s="${style}"/>`;
        return `<c r="${reference}" s="${style}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
    }

    function buildSheetXml(state) {
        const studentsById = new Map(state.students.map(student => [String(student.id), student]));
        const seatMap = new Map((state.seatLayout || []).map(item => [`${item.row}:${item.group}:${item.side}`, studentsById.get(String(item.studentId))]));
        const maxLayoutRow = (state.seatLayout || []).reduce((max, item) => Math.max(max, Number(item.row) || 0), 0);
        const seatRows = Math.max(6, maxLayoutRow + 1);
        const groupRow = seatRows * 2 + 1;
        const classRow = groupRow + 4;
        let rowsXml = '';

        for (let seatRow = 0; seatRow < seatRows; seatRow++) {
            const nameRow = seatRow * 2 + 1;
            const numberRow = nameRow + 1;
            let names = '';
            let numbers = '';
            for (let column = 1; column <= 12; column++) {
                const seatColumnIndex = SEAT_COLUMNS.indexOf(column);
                if (seatColumnIndex >= 0) {
                    const group = Math.floor(seatColumnIndex / 2);
                    const side = seatColumnIndex % 2;
                    const student = seatMap.get(`${seatRow}:${group}:${side}`);
                    names += inlineCell(`${columnName(column)}${nameRow}`, student ? student.name : '', 1);
                    numbers += inlineCell(`${columnName(column)}${numberRow}`, student ? (student.studentNo || student.id) : '', 2);
                } else {
                    names += inlineCell(`${columnName(column)}${nameRow}`, '', 3);
                    numbers += inlineCell(`${columnName(column)}${numberRow}`, '', 3);
                }
            }
            rowsXml += `<row r="${nameRow}" ht="54" customHeight="1">${names}</row>`;
            rowsXml += `<row r="${numberRow}" ht="18" customHeight="1">${numbers}</row>`;
        }

        let groupCells = '';
        GROUP_COLUMNS.forEach(([start], index) => {
            groupCells += inlineCell(`${columnName(start)}${groupRow}`, (state.seatGroupNames || [])[index] || `第${index + 1}组`, 4);
        });
        rowsXml += `<row r="${groupRow}" ht="20" customHeight="1">${groupCells}</row>`;
        rowsXml += `<row r="${classRow}" ht="24" customHeight="1">${inlineCell(`F${classRow}`, state.currentClass || '班级座位表', 5)}</row>`;
        const merges = GROUP_COLUMNS.map(([start, end]) => `<mergeCell ref="${columnName(start)}${groupRow}:${columnName(end)}${groupRow}"/>`).join('');

        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:L${classRow}"/>
<sheetViews><sheetView tabSelected="1" workbookViewId="0" showGridLines="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="2.5" customWidth="1"/><col min="2" max="3" width="9" customWidth="1"/><col min="4" max="4" width="3" customWidth="1"/><col min="5" max="6" width="9" customWidth="1"/><col min="7" max="7" width="3" customWidth="1"/><col min="8" max="9" width="9" customWidth="1"/><col min="10" max="10" width="3" customWidth="1"/><col min="11" max="12" width="9" customWidth="1"/></cols>
<sheetData>${rowsXml}</sheetData><mergeCells count="5">${merges}<mergeCell ref="F${classRow}:H${classRow}"/></mergeCells>
<printOptions horizontalCentered="1" verticalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.3" bottom="0.3" header="0" footer="0"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1"/>
</worksheet>`;
    }

    function buildStylesXml() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4"><font><sz val="11"/><name val="等线"/></font><font><b/><sz val="15"/><name val="等线"/></font><font><sz val="10"/><color rgb="FF666666"/><name val="等线"/></font><font><b/><sz val="13"/><name val="等线"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F6F5"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF7F8C88"/></left><right style="thin"><color rgb="FF7F8C88"/></right><top style="thin"><color rgb="FF7F8C88"/></top><bottom style="thin"><color rgb="FF7F8C88"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs>
<cellStyles count="1"><cellStyle name="常规" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    }

    async function exportSeatWorkbook(storeInstance, date = new Date()) {
        const JSZipLib = await window.TWS3.dependencies.ensureJSZip();
        const state = storeInstance.getState();
        const zip = new JSZipLib();
        zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
        zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
        zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>TWS3</Application></Properties>`);
        zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>TWS3</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${date.toISOString()}</dcterms:created></cp:coreProperties>`);
        zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029"/></workbook>`);
        zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
        zip.file('xl/styles.xml', buildStylesXml());
        zip.file('xl/worksheets/sheet1.xml', buildSheetXml({ ...state, seatLayout: storeInstance.getSeatLayout() }));
        const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const dateText = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
        const className = String(state.currentClass || '班级').replace(/[\\/:*?"<>|]/g, '_');
        return { blob, fileName: `${className}_座位表_${dateText}.xlsx` };
    }

    window.TWS3.seatWorkbook = { parseSeatWorkbook, exportSeatWorkbook };
})();
