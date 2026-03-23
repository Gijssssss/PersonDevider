const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const path = require('path');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx / .xls) are accepted.'));
    }
  },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * POST /api/upload
 * Accepts an Excel file, parses column A (name) and column B (count).
 * Returns: { people: [{ name, count }], headers: [colA, colB] }
 */
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ error: 'The Excel file contains no worksheets.' });
    }

    const people = [];
    let firstRow = true;

    worksheet.eachRow((row, rowNumber) => {
      const cellA = row.getCell(1).value;
      const cellB = row.getCell(2).value;

      // Skip empty rows
      if (cellA === null && cellB === null) return;

      // Detect and skip header row (row 1 with non-numeric name column)
      if (firstRow && rowNumber === 1) {
        firstRow = false;
        const isHeader =
          typeof cellA === 'string' &&
          isNaN(Number(cellA)) &&
          (typeof cellB === 'string' || cellB === null || isNaN(Number(cellB)));
        if (isHeader) return;
      }
      firstRow = false;

      const name = cellA !== null ? String(cellA).trim() : '';
      const rawCount = cellB !== null ? cellB : 1;
      const count = Math.max(1, Math.round(Number(rawCount)) || 1);

      if (name) {
        people.push({ name, count });
      }
    });

    if (people.length === 0) {
      return res.status(400).json({ error: 'No valid data found in the Excel file. Make sure column A has names and column B has counts.' });
    }

    res.json({ people });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to parse the Excel file: ' + err.message });
  }
});

/**
 * POST /api/export
 * Accepts { groups: [{ id, members: [{ name, count }], totalPeople }] }
 * Returns an .xlsx file with one sheet per group.
 */
app.post('/api/export', async (req, res) => {
  const { groups } = req.body;

  if (!Array.isArray(groups) || groups.length === 0) {
    return res.status(400).json({ error: 'No groups provided.' });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PersonDevider';
    workbook.created = new Date();

    // Summary sheet
    const summary = workbook.addWorksheet('Summary');
    summary.columns = [
      { header: 'Group', key: 'group', width: 12 },
      { header: 'Members', key: 'members', width: 30 },
      { header: 'Total People', key: 'total', width: 14 },
    ];
    styleHeaderRow(summary.getRow(1));

    groups.forEach((group) => {
      summary.addRow({
        group: `Group ${group.id}`,
        members: group.members.map((m) => m.name).join(', '),
        total: group.totalPeople,
      });
    });

    // One sheet per group
    groups.forEach((group) => {
      const sheet = workbook.addWorksheet(`Group ${group.id}`);
      sheet.columns = [
        { header: 'Name', key: 'name', width: 24 },
        { header: 'People', key: 'count', width: 10 },
      ];
      styleHeaderRow(sheet.getRow(1));

      group.members.forEach((m) => {
        sheet.addRow({ name: m.name, count: m.count });
      });

      // Total row
      const totalRow = sheet.addRow({ name: 'Total', count: group.totalPeople });
      totalRow.font = { bold: true };
      totalRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2EFDA' },
      };
      totalRow.getCell(2).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2EFDA' },
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Disposition', 'attachment; filename="groups.xlsx"');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.send(buffer);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to generate Excel file: ' + err.message });
  }
});

function styleHeaderRow(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F81BD' },
  };
  row.alignment = { horizontal: 'center' };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PersonDevider is running at http://localhost:${PORT}`);
});
