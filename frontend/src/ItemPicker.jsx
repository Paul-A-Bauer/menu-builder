import { useState } from 'react';
import { imageUrl } from './api';

export default function ItemPicker({ sectionTitle, items, busy, onClose, onChoose, onCreate }) {
  const [mode, setMode] = useState(items.length ? 'existing' : 'new');
  const [name, setName] = useState('');
  const [image, setImage] = useState(null);
  const [search, setSearch] = useState('');
  const filteredItems = items.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="dialog-backdrop">
      <section className="item-dialog" role="dialog" aria-modal="true" aria-labelledby="item-dialog-title">
        <header className="dialog-head">
          <div>
            <p className="eyebrow">{sectionTitle}</p>
            <h2 id="item-dialog-title">Add menu item</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>×</button>
        </header>
        <div className="segmented" role="tablist" aria-label="Item source">
          <button type="button" role="tab" aria-selected={mode === 'new'} onClick={() => setMode('new')}>New item</button>
          <button type="button" role="tab" aria-selected={mode === 'existing'} onClick={() => setMode('existing')}>Saved items ({items.length})</button>
        </div>
        {mode === 'new' ? (
          <form className="new-item-form" onSubmit={(event) => { event.preventDefault(); onCreate(name, image); }}>
            <label>Item title<input autoFocus maxLength="120" required value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label>Photo<input type="file" accept="image/*" onChange={(event) => setImage(event.target.files?.[0] ?? null)} /></label>
            <div className="dialog-actions">
              <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="submit" className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save and add'}</button>
            </div>
          </form>
        ) : (
          <div className="library-list">
            {items.length > 5 && <input className="library-search" type="search" placeholder="Search saved items" value={search} onChange={(event) => setSearch(event.target.value)} />}
            {filteredItems.length ? filteredItems.map((item) => (
              <button type="button" className="library-item" key={item.id} disabled={busy} onClick={() => onChoose(item.id)}>
                {item.imageId ? <img src={imageUrl(item.imageId)} alt="" /> : <span className="library-placeholder">No photo</span>}
                <span>{item.name}</span>
                <span className="library-add" aria-hidden="true">+</span>
              </button>
            )) : <p className="empty-library">{items.length ? 'No matching items.' : 'No saved items yet. Create one in the New item tab.'}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
