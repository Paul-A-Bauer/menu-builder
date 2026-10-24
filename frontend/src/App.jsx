import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import * as api from './api';
import { shrinkImage } from './image';
import ItemPicker from './ItemPicker';
import Section from './Section';

const DEFAULT_THEME = { background: '#bfe1f1', panel: '#ffffff', accent: '#d8212f', text: '#1f2933' };
const DEFAULT_PRINT = { paperSize: 'Letter', orientation: 'Landscape' };
const PAPER_SIZES = [
  ['Letter', 'Letter · 8.5 × 11 in'],
  ['Legal', 'Legal · 8.5 × 14 in'],
  ['Tabloid', 'Tabloid · 11 × 17 in'],
  ['A3', 'A3 · 297 × 420 mm'],
  ['A4', 'A4 · 210 × 297 mm'],
  ['A5', 'A5 · 148 × 210 mm'],
];
const PAPER_DIMENSIONS = {
  Letter: [8.5, 11],
  Legal: [8.5, 14],
  Tabloid: [11, 17],
  A3: [297, 420],
  A4: [210, 297],
  A5: [148, 210],
};

export default function App() {
  const [menus, setMenus] = useState([]);
  const [menu, setMenu] = useState(null);
  const [status, setStatus] = useState('');
  const [libraryItems, setLibraryItems] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [itemTarget, setItemTarget] = useState(null);
  const [newAreaOpen, setNewAreaOpen] = useState(false);
  const [newAreaTitle, setNewAreaTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const paperRef = useRef(null);
  const menuRef = useRef(null);
  const skipSave = useRef(true);
  const printSettings = menu?.print ?? DEFAULT_PRINT;
  const [paperWidth, paperHeight] = PAPER_DIMENSIONS[printSettings.paperSize] ?? PAPER_DIMENSIONS.Letter;
  const paperRatio = printSettings.orientation === 'Landscape'
    ? paperHeight / paperWidth
    : paperWidth / paperHeight;
  const paperStyle = { '--paper-ratio': paperRatio };

  const refreshList = useCallback(async () => setMenus(await api.listMenus()), []);
  const refreshLibrary = useCallback(async () => setLibraryItems(await api.listLibraryItems()), []);
  const refreshTemplates = useCallback(async () => setTemplates(await api.listTemplates()), []);

  const open = useCallback(async (id) => {
    skipSave.current = true;
    setMenu(await api.getMenu(id));
  }, []);

  const create = useCallback(async (templateId = '') => {
    const m = templateId ? await api.createMenuFromTemplate(templateId) : await api.createMenu();
    await refreshList();
    skipSave.current = true;
    setMenu(m);
  }, [refreshList]);

  useEffect(() => {
    (async () => {
      const list = await api.listMenus();
      setMenus(list);
      await Promise.all([refreshLibrary(), refreshTemplates()]);
      list.length ? open(list[0].id) : create();
    })().catch((e) => setStatus(`Can't reach the server: ${e.message}`));
  }, [open, create, refreshLibrary, refreshTemplates]);

  useEffect(() => {
    const print = menu?.print ?? DEFAULT_PRINT;
    let style = document.getElementById('menu-print-page-size');
    if (!style) {
      style = document.createElement('style');
      style.id = 'menu-print-page-size';
      document.head.append(style);
    }
    style.textContent = `@page { size: ${print.paperSize.toLowerCase()} ${print.orientation.toLowerCase()}; margin: .4in; }`;
  }, [menu?.print?.paperSize, menu?.print?.orientation]);

  useLayoutEffect(() => {
    const frame = paperRef.current;
    const content = menuRef.current;
    if (!frame || !content) return;

    const fit = () => {
      const availableHeight = frame.clientHeight;
      const contentHeight = content.offsetHeight;
      if (availableHeight && contentHeight) {
        content.style.setProperty('--fit-scale', Math.min(1, availableHeight / contentHeight));
      }
    };

    const frameId = requestAnimationFrame(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    observer.observe(content);
    document.fonts?.ready.then(fit);
    window.addEventListener('resize', fit);
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [menu, paperRatio]);

  // Debounced autosave
  useEffect(() => {
    if (!menu) return;
    if (skipSave.current) { skipSave.current = false; return; }
    setStatus('Saving…');
    const t = setTimeout(() => {
      api.saveMenu(menu).then(() => { setStatus('Saved'); refreshList(); })
        .catch((e) => setStatus(`Save failed: ${e.message}`));
    }, 600);
    return () => clearTimeout(t);
  }, [menu, refreshList]);

  const field = (k) => (e) => setMenu((m) => ({ ...m, [k]: e.target.value }));
  const updateSection = (sid) => (fn) =>
    setMenu((m) => ({ ...m, sections: m.sections.map((s) => (s.id === sid ? fn(s) : s)) }));

  const updateItems = async (operation) => {
    if (!menu) return;
    setBusy(true);
    setStatus('Saving…');
    try {
      await api.saveMenu(menu);
      const updated = await operation(menu.id);
      skipSave.current = true;
      setMenu(updated);
      setStatus('Saved');
      return true;
    } catch (e) {
      setStatus(`Save failed: ${e.message}`);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const removeItem = (sectionId, itemId) =>
    updateItems((menuId) => api.removeItem(menuId, sectionId, itemId));

  const chooseLibraryItem = async (libraryItemId) => {
    if (await updateItems((menuId) => api.addLibraryItem(menuId, itemTarget.sectionId, libraryItemId)))
      setItemTarget(null);
  };

  const createAndAddItem = async (name, file) => {
    if (!menu || !itemTarget) return;
    setBusy(true);
    setStatus('Saving…');
    try {
      await api.saveMenu(menu);
      const image = file ? await api.uploadImage(await shrinkImage(file)) : null;
      const item = await api.createLibraryItem(name, image?.id ?? null);
      const updated = await api.addLibraryItem(menu.id, itemTarget.sectionId, item.id);
      skipSave.current = true;
      setMenu(updated);
      await refreshLibrary();
      setItemTarget(null);
      setStatus('Saved');
    } catch (e) {
      setStatus(`Save failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const addSection = () => {
    setNewAreaTitle('');
    setNewAreaOpen(true);
  };

  const createSection = async (event) => {
    event.preventDefault();
    if (!newAreaTitle.trim() || !menu) return;
    setStatus('Saving…');
    try {
      await api.saveMenu(menu);
      const updated = await api.addSection(menu.id, newAreaTitle.trim(), 'grid');
      skipSave.current = true;
      setMenu(updated);
      setNewAreaOpen(false);
      setStatus('Saved');
    } catch (e) { setStatus(`Save failed: ${e.message}`); }
  };

  const deleteSection = async (sectionId) => {
    if (!menu || !confirm('Remove this area and its items?')) return;
    setStatus('Saving…');
    try {
      await api.saveMenu(menu);
      const updated = await api.removeSection(menu.id, sectionId);
      skipSave.current = true;
      setMenu(updated);
      setStatus('Saved');
    } catch (e) { setStatus(`Save failed: ${e.message}`); }
  };

  const moveSection = async (sectionId, direction) => {
    if (!menu) return;
    setStatus('Saving…');
    try {
      await api.saveMenu(menu);
      const updated = await api.moveSection(menu.id, sectionId, direction);
      skipSave.current = true;
      setMenu(updated);
      setStatus('Saved');
    } catch (e) { setStatus(`Save failed: ${e.message}`); }
  };

  const saveAsTemplate = async () => {
    if (!menu || !templateName.trim()) return;
    setStatus('Saving…');
    try {
      await api.saveMenu(menu);
      await api.saveTemplate(menu.id, templateName.trim());
      setTemplateName('');
      await refreshTemplates();
      setStatus('Template saved');
    } catch (e) { setStatus(`Save failed: ${e.message}`); }
  };

  const removeTemplate = async () => {
    if (!selectedTemplate || !confirm('Delete this saved template?')) return;
    try {
      await api.deleteTemplate(selectedTemplate);
      setSelectedTemplate('');
      await refreshTemplates();
      setStatus('Template deleted');
    } catch (e) { setStatus(`Delete failed: ${e.message}`); }
  };

  const remove = async () => {
    if (!confirm('Delete this menu?')) return;
    await api.deleteMenu(menu.id);
    const list = await api.listMenus();
    setMenus(list);
    list.length ? open(list[0].id) : create();
  };

  // Hide editing controls while rendering for export/print
  const render = async () => {
    const el = paperRef.current;
    el.classList.add('exporting');
    const menuElement = menuRef.current;
    const previousScale = menuElement.style.getPropertyValue('--fit-scale');
    const fitScale = Math.min(1, el.clientHeight / menuElement.offsetHeight);
    menuElement.style.setProperty('--fit-scale', fitScale);
    try {
      return await toPng(el, {
        pixelRatio: Math.max(2, 2000 / el.offsetWidth),
        backgroundColor: '#fff',
        skipFonts: true,
      });
    } finally {
      el.classList.remove('exporting');
      if (previousScale) menuElement.style.setProperty('--fit-scale', previousScale);
      else menuElement.style.removeProperty('--fit-scale');
    }
  };
  const fileName = () => (menu.title || 'menu').replace(/[^\w]+/g, '-').toLowerCase();

  const exportPng = async () => {
    const a = document.createElement('a');
    a.href = await render();
    a.download = `${fileName()}.png`;
    a.click();
  };

  const exportPdf = async () => {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const preview = isIos ? window.open('about:blank', '_blank') : null;
    const el = paperRef.current;
    const url = await render();
    const print = menu.print ?? DEFAULT_PRINT;
    const pdf = new jsPDF({
      orientation: print.orientation.toLowerCase(),
      unit: 'in',
      format: print.paperSize.toLowerCase(),
    });
    const pw = pdf.internal.pageSize.getWidth() - 0.8;
    const ph = pdf.internal.pageSize.getHeight() - 0.8;
    const ratio = el.offsetWidth / el.offsetHeight;
    const w = Math.min(pw, ph * ratio);
    const x = (pdf.internal.pageSize.getWidth() - w) / 2;
    const y = (pdf.internal.pageSize.getHeight() - w / ratio) / 2;
    pdf.addImage(url, 'PNG', x, y, w, w / ratio);
    const pdfUrl = URL.createObjectURL(pdf.output('blob'));
    if (preview) {
      preview.location.href = pdfUrl;
    } else {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `${fileName()}.pdf`;
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
  };

  const print = () => {
    const frame = paperRef.current;
    const content = menuRef.current;
    const previousScale = content.style.getPropertyValue('--fit-scale');
    frame.classList.add('exporting');
    content.style.setProperty('--fit-scale', Math.min(1, frame.clientHeight / content.offsetHeight));
    const finishPrint = () => {
      frame.classList.remove('exporting');
      if (previousScale) content.style.setProperty('--fit-scale', previousScale);
      else content.style.removeProperty('--fit-scale');
      window.removeEventListener('beforeprint', fitPrintedContent);
      window.removeEventListener('afterprint', finishPrint);
      clearTimeout(fallbackTimer);
    };
    const fitPrintedContent = () => {
      content.style.setProperty('--fit-scale', Math.min(1, frame.clientHeight / content.offsetHeight));
    };
    window.addEventListener('beforeprint', fitPrintedContent);
    window.addEventListener('afterprint', finishPrint);
    const fallbackTimer = setTimeout(finishPrint, 60_000);
    window.print();
  };

  const theme = menu?.theme ?? DEFAULT_THEME;
  const menuStyle = menu ? {
    '--menu-bg': theme.background,
    '--panel-bg': theme.panel,
    '--accent': theme.accent,
    '--menu-text': theme.text,
    '--item-photo-ratio': printSettings.orientation === 'Landscape' ? 1.7 : 1.25,
    gridTemplateColumns: `repeat(${Math.min(Math.max(menu.columns || 2, 1), 6)}, minmax(0, 1fr))`,
  } : undefined;
  return (
    <div className="app">
      <header className="toolbar">
        <select value={menu?.id ?? ''} onChange={(e) => open(e.target.value)}>
          {menus.map((m) => <option key={m.id} value={m.id}>{m.title || 'Untitled'}</option>)}
        </select>
        <button onClick={() => create()}>New menu</button>
        <select aria-label="Saved templates" value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
          <option value="">Choose template</option>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
        <button onClick={() => selectedTemplate && create(selectedTemplate)} disabled={!selectedTemplate}>Use template</button>
        <button onClick={removeTemplate} disabled={!selectedTemplate}>Delete template</button>
        <button onClick={remove} disabled={!menu}>Delete</button>
        <span className="spacer" />
        <span className="status">{status}</span>
        <button onClick={print} disabled={!menu}>Print</button>
        <button onClick={exportPng} disabled={!menu}>Export image</button>
        <button className="primary" onClick={exportPdf} disabled={!menu}>Export PDF</button>
      </header>

      <div className="editor-tools">
        <div className="tool-group colors" aria-label="Menu colors">
          {[['background', 'Canvas'], ['panel', 'Areas'], ['accent', 'Accent'], ['text', 'Text']].map(([key, label]) => (
            <label key={key}>{label}<input type="color" value={theme[key]} onChange={(e) => setMenu((current) => ({
              ...current, theme: { ...(current.theme ?? DEFAULT_THEME), [key]: e.target.value },
            }))} /></label>
          ))}
        </div>
        <label className="columns-control">Areas per row
          <select value={menu?.columns ?? 2} onChange={(e) => {
            const columns = Number(e.target.value);
            setMenu((current) => ({
              ...current,
              columns,
              sections: current.sections.map((section) => ({
                ...section,
                columnSpan: Math.min(section.columnSpan ?? 1, columns),
              })),
            }));
          }} disabled={!menu}>
            {[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}</option>)}
          </select>
        </label>
        <label className="paper-control">Paper size
          <select value={(menu?.print ?? DEFAULT_PRINT).paperSize} onChange={(e) => setMenu((current) => ({
            ...current,
            print: { ...(current.print ?? DEFAULT_PRINT), paperSize: e.target.value },
          }))} disabled={!menu}>
            {PAPER_SIZES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <div className="orientation-control" role="group" aria-label="Page orientation">
          {['Portrait', 'Landscape'].map((orientation) => (
            <button
              key={orientation}
              type="button"
              aria-pressed={(menu?.print ?? DEFAULT_PRINT).orientation === orientation}
              onClick={() => setMenu((current) => ({
                ...current,
                print: { ...(current.print ?? DEFAULT_PRINT), orientation },
              }))}
              disabled={!menu}
            >{orientation}</button>
          ))}
        </div>
        <button onClick={addSection} disabled={!menu}>Add area</button>
        <div className="tool-group template-save">
          <input aria-label="Template name" placeholder="Template name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
          <button onClick={saveAsTemplate} disabled={!menu || !templateName.trim()}>Save template</button>
        </div>
      </div>

      {menu && (
        <main className="stage">
          <div className={`paper-frame paper-${printSettings.orientation.toLowerCase()}`} ref={paperRef} style={paperStyle}>
            <article className="menu" ref={menuRef} style={menuStyle}>
              <div className="menu-top">
                <input className="brand" value={menu.brand} onChange={field('brand')} aria-label="Restaurant name" />
                <div className="title-box">
                  <input className="subtitle" value={menu.subtitle} onChange={field('subtitle')} aria-label="Subtitle" />
                  <input className="title" value={menu.title} onChange={field('title')} aria-label="Menu title" />
                </div>
              </div>

              <div className="menu-areas" style={menuStyle}>
                {menu.sections.map((section, index) => (
                  <Section
                    key={section.id}
                    section={section}
                    columns={menu.columns}
                    index={index}
                    sectionCount={menu.sections.length}
                    onChange={updateSection(section.id)}
                    onAdd={() => setItemTarget({ sectionId: section.id, title: section.title })}
                    onRemove={(itemId) => removeItem(section.id, itemId)}
                    onDelete={() => deleteSection(section.id)}
                    onMove={(direction) => moveSection(section.id, direction)}
                    style={{ gridColumn: `span ${Math.min(section.columnSpan ?? 1, menu.columns)}` }}
                  />
                ))}
              </div>

              <input className="footer" value={menu.footer} onChange={field('footer')} aria-label="Footer note" />
            </article>
          </div>
        </main>
      )}
      {itemTarget && (
        <ItemPicker
          sectionTitle={itemTarget.title}
          items={libraryItems}
          busy={busy}
          onClose={() => setItemTarget(null)}
          onChoose={chooseLibraryItem}
          onCreate={createAndAddItem}
        />
      )}
      {newAreaOpen && (
        <div className="dialog-backdrop">
          <form className="item-dialog new-item-form" role="dialog" aria-modal="true" aria-labelledby="area-dialog-title" onSubmit={createSection}>
            <header className="dialog-head">
              <div><p className="eyebrow">Menu layout</p><h2 id="area-dialog-title">Add area</h2></div>
              <button type="button" className="icon-button" aria-label="Close" onClick={() => setNewAreaOpen(false)}>×</button>
            </header>
            <label>Area title<input autoFocus maxLength="80" required value={newAreaTitle} onChange={(e) => setNewAreaTitle(e.target.value)} /></label>
            <div className="dialog-actions">
              <button type="button" onClick={() => setNewAreaOpen(false)}>Cancel</button>
              <button type="submit" className="primary">Add area</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
