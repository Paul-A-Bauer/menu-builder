const json = async (res) => {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.status === 204 ? null : res.json();
};

export const listMenus = () => fetch('/api/menus').then(json);
export const createMenu = () => fetch('/api/menus', { method: 'POST' }).then(json);
export const createMenuFromTemplate = (templateId) =>
  fetch(`/api/menus/from-template/${templateId}`, { method: 'POST' }).then(json);
export const getMenu = (id) => fetch(`/api/menus/${id}`).then(json);
export const addItem = (menuId, sectionId) =>
  fetch(`/api/menus/${menuId}/sections/${sectionId}/items`, { method: 'POST' }).then(json);
export const removeItem = (menuId, sectionId, itemId) =>
  fetch(`/api/menus/${menuId}/sections/${sectionId}/items/${itemId}`, { method: 'DELETE' }).then(json);
export const addLibraryItem = (menuId, sectionId, libraryItemId) =>
  fetch(`/api/menus/${menuId}/sections/${sectionId}/items/from-library/${libraryItemId}`, { method: 'POST' }).then(json);
export const listLibraryItems = () => fetch('/api/library/items').then(json);
export const createLibraryItem = (name, imageId) =>
  fetch('/api/library/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, imageId }),
  }).then(json);
export const addSection = (menuId, title, layout) =>
  fetch(`/api/menus/${menuId}/sections`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, layout }),
  }).then(json);
export const removeSection = (menuId, sectionId) =>
  fetch(`/api/menus/${menuId}/sections/${sectionId}`, { method: 'DELETE' }).then(json);
export const moveSection = (menuId, sectionId, direction) =>
  fetch(`/api/menus/${menuId}/sections/${sectionId}/move`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ direction }),
  }).then(json);
export const listTemplates = () => fetch('/api/templates').then(json);
export const deleteTemplate = (templateId) => fetch(`/api/templates/${templateId}`, { method: 'DELETE' }).then(json);
export const saveTemplate = (menuId, name) =>
  fetch(`/api/menus/${menuId}/templates`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }).then(json);
export const saveMenu = (menu) =>
  fetch(`/api/menus/${menu.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(menu),
  }).then(json);
export const deleteMenu = (id) => fetch(`/api/menus/${id}`, { method: 'DELETE' }).then(json);
export const uploadImage = (blob) => {
  const form = new FormData();
  form.append('file', blob, 'photo');
  return fetch('/api/images', { method: 'POST', body: form }).then(json);
};
export const imageUrl = (id) => `/api/images/${id}`;
