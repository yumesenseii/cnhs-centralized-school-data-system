import zipfile
import xml.etree.ElementTree as ET

path = r'public/templates/UPDATED G4-10  School Form 9 (SY 26-27).xlsx.ods'

with zipfile.ZipFile(path, 'r') as z:
    content = z.read('content.xml')
    root = ET.fromstring(content)

NS = {
    'table': 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
    'text': 'urn:oasis:names:tc:opendocument:xmlns:text:1.0'
}

sheet = next(s for s in root.findall('.//table:table', NS) if s.attrib.get(f"{{{NS['table']}}}name") == 'SF9 - GRADE 4-10')

print("=== SF9 - GRADE 4-10 ROWS 1 TO 13 ===")
for r_idx, row in enumerate(sheet.findall('table:table-row', NS), 1):
    if r_idx > 13:
        break
    c_idx = 0
    row_cells = []
    for cell in row.findall('table:table-cell', NS):
        rep = int(cell.attrib.get(f"{{{NS['table']}}}number-columns-repeated", 1))
        formula = cell.attrib.get(f"{{{NS['table']}}}formula", '')
        texts = [p.text for p in cell.findall('.//text:p', NS) if p.text]
        txt = ' '.join(texts).strip() if texts else ''
        if txt or formula:
            row_cells.append((c_idx, txt, formula))
        c_idx += rep
    if row_cells:
        print(f"Row {r_idx:2d}: {row_cells}")

