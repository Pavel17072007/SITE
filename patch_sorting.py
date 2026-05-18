from pathlib import Path
path = Path('script.js')
text = path.read_text(encoding='utf-8')
# Find loadCatalog function end and insert applySortingToItems after it
idx = text.find('async function loadCatalog')
closing = text.find('\n}', idx)  # Find the closing brace
closing = text.find('\n}', closing + 1)  # Find actual end of function

new_func = """

function applySortingToItems(items, mode) {
  if (!mode) {
    return items;
  }

  const list = Array.from(items || []);
  switch (mode) {
    case "price_asc":
      return list.sort((a, b) => Number(a.price) - Number(b.price));
    case "price_desc":
      return list.sort((a, b) => Number(b.price) - Number(a.price));
    case "rating_asc":
      return list.sort((a, b) => Number(a.rating) - Number(b.rating));
    case "rating_desc":
      return list.sort((a, b) => Number(b.rating) - Number(a.rating));
    default:
      return items;
  }
}"""

# Check if applySortingToItems already exists
if 'function applySortingToItems' in text:
    print('already exists')
else:
    # Insert after loadCatalog closing brace
    text = text[:closing+2] + new_func + text[closing+2:]
    path.write_text(text, encoding='utf-8')
    print('added applySortingToItems')
