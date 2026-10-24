import { imageUrl, uploadImage } from './api';
import { shrinkImage } from './image';

const MAX_COLS = { main: 5, side: 4, drink: 2, treat: 2 };
// Spread items evenly across rows (7 items, max 5 -> 4 + 3) so cells shrink as items are added.
const colsFor = (n, max) => (n <= max ? Math.max(n, 1) : Math.ceil(n / Math.ceil(n / max)));

export default function Section({ section, onChange, onAdd, onRemove, onDelete }) {
  const { id, step, title, items } = section;
  const layout = section.layout ?? (id === 'main' || id === 'side' ? 'row' : 'grid');
  const patch = (itemId, p) => onChange((s) => ({
    ...s,
    items: s.items.map((item) => (item.id === itemId ? { ...item, ...p } : item)),
  }));

  const upload = async (itemId, file) => {
    if (!file) return;
    const { id: imageId } = await uploadImage(await shrinkImage(file));
    patch(itemId, { imageId });
  };

  const cols = colsFor(items.length, MAX_COLS[id] ?? 4);

  return (
    <section className={`panel panel-${id} layout-${layout}`}>
      <div className="panel-head">
        {step && (
          <div className="step">
            <span className="step-word">STEP</span>
            <span className="step-num">{step}</span>
          </div>
        )}
        <textarea
          className={step ? 'panel-title stacked' : 'panel-title inline'}
          rows={title.split('\n').length}
          value={title}
          onChange={(e) => onChange((s) => ({ ...s, title: e.target.value.toUpperCase() }))}
          aria-label="Section title"
        />
        <label className="layout-control">Layout
          <select value={layout} onChange={(e) => onChange((s) => ({ ...s, layout: e.target.value }))}>
            <option value="grid">Stacked</option>
            <option value="row">Side-by-side</option>
          </select>
        </label>
        <button className="add no-export" onClick={onAdd}>+ Add item</button>
        {onDelete && <button className="remove-area no-export" onClick={onDelete} aria-label="Remove area">Remove area</button>}
      </div>

      <div className="items" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {items.map((item) => (
          <div className="item" key={item.id}>
            <label className="pic" title="Click to upload a photo">
              {item.imageId ? (
                <img src={imageUrl(item.imageId)} alt={item.name} crossOrigin="anonymous" />
              ) : (
                <span className="ph no-export">📷<br />Add photo</span>
              )}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => { upload(item.id, e.target.files[0]); e.target.value = ''; }}
              />
            </label>
            <input
              className="name"
              value={item.name}
              placeholder="Item name"
              onChange={(e) => patch(item.id, { name: e.target.value })}
            />
            <button className="del no-export" onClick={() => onRemove(item.id)} aria-label="Remove item">×</button>
          </div>
        ))}
      </div>
    </section>
  );
}
