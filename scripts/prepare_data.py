"""Convert the user-provided workbook without dropping or inventing sales rows."""
import argparse
import datetime as dt
import json
from pathlib import Path
import openpyxl

parser = argparse.ArgumentParser()
parser.add_argument('workbook', type=Path)
parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'data' / 'sales.json')
args = parser.parse_args()
workbook = openpyxl.load_workbook(args.workbook, data_only=True)
rows = []
for source_row, row in enumerate(workbook.active.iter_rows(min_row=2, values_only=True), 2):
    date, region, store, category, plan, quantity, revenue, staff = row
    if isinstance(date, dt.datetime):
        date = date.date()
    elif isinstance(date, (int, float)):
        date = dt.datetime.strptime(str(int(date)), '%Y%m%d').date()
    else:
        date = dt.datetime.strptime(date.strip(), '%Y.%m.%d').date()
    region = next((name for name in ['서울', '경기', '부산', '인천', '대구', '광주', '대전'] if region.startswith(name)), region)
    revenue = int(str(revenue).replace(',', '').replace('원', '').split('.')[0])
    rows.append(dict(id=source_row, date=date.isoformat(), region=region, store=store, category=category, plan=plan, quantity=int(quantity) if quantity is not None else None, revenue=revenue, staff=staff))
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(f'{len(rows)} rows; revenue {sum(r["revenue"] for r in rows):,} KRW; quantity {sum(r["quantity"] or 0 for r in rows):,}; missing quantity {sum(r["quantity"] is None for r in rows)}')
