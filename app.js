// Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Configuración
const firebaseConfig = {
  apiKey: "AIzaSyBpiOd3mlaX0fBnpVTykLNl4KSVYGz2E4U",
  authDomain: "gestor-ecoferia2025.firebaseapp.com",
  projectId: "gestor-ecoferia2025",
  storageBucket: "gestor-ecoferia2025.firebasestorage.app",
  messagingSenderId: "893091181845",
  appId: "1:893091181845:web:e291f17e4f5f851f64e51c"
};

// Inicializar
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Variables para edición
let editIndex = null;
let editSection = null;
let editId = null;

// ---- Cargar sección ----
window.openSection = function (sectionName) {
  fetch(`sections/${sectionName}.html`)
    .then(res => res.text())
    .then(html => {
      document.getElementById('sectionContainer').innerHTML = html;
      loadData(sectionName);
    });
    
};

window.closeSection = function() {
    const container = document.getElementById('sectionContainer');
    container.innerHTML = '';
    container.classList.remove('active'); // Vuelve la imagen de fondo
};

// ---- Cargar datos ----
window.loadData = async function (sectionName) {
  const tableBody = document.getElementById('tableBody');
  if (!tableBody) return;
  tableBody.innerHTML = '';

  let items = [];

  // Intentamos traer desde Firebase
  try {
    const querySnapshot = await getDocs(collection(db, sectionName));
    querySnapshot.forEach(docSnap => {
      const item = docSnap.data();
      item._docId = docSnap.id;       // Guardamos el id de Firebase
      items.push(item);
    });

    // Ordenar por timestamp (ascendente: primero agregado arriba)
    items.sort((a, b) => (a._createdAt || 0) - (b._createdAt || 0));
  } catch (err) {
    console.warn("⚠️ No se pudo leer Firebase, usando localStorage", err);
  }

  // Si Firebase falla o no hay datos, usamos localStorage
  if (items.length === 0) {
    items = JSON.parse(localStorage.getItem(sectionName)) || [];
  }

  // Renderizamos filas
  items.forEach((item, index) => {
    renderRow(sectionName, item, item._docId || null, index);
  });
};

// ---- Renderizar fila ----
function renderRow(sectionName, item, docId = null, index = null) {
  const tableBody = document.getElementById('tableBody');
  const row = document.createElement('tr');

  // Definir columnas según formulario
  const form = document.querySelector('form');
  const inputs = form ? form.querySelectorAll('input') : [];
  const columns = Array.from(inputs).map(input => input.placeholder);
  const select = form ? form.querySelector('select') : null;
  if (select) columns.push(select.name || 'Concurso');

  // Crear celdas
  columns.forEach(col => {
    const cell = document.createElement('td');
    cell.textContent = item[col] || '';
    row.appendChild(cell);
  });

  // Botones de acción
  const actions = document.createElement('td');
  actions.innerHTML = `
    <button onclick="deleteItem('${sectionName}', '${docId}', ${index})">Eliminar</button>
    <button onclick="editItem('${sectionName}', '${docId}', ${index})">Editar</button>
  `;
  row.appendChild(actions);

  tableBody.appendChild(row);
}

// ---- Guardar datos ----
window.saveData = async function (sectionName, newItem) {
  let data = JSON.parse(localStorage.getItem(sectionName)) || [];

  // Si es edición, reemplazamos
  if (editIndex !== null && editSection === sectionName) {
    data[editIndex] = newItem;
  } else {
    data.push(newItem);
  }

  localStorage.setItem(sectionName, JSON.stringify(data));

  try {
    if (editId) {
      const ref = doc(db, sectionName, editId);
      await updateDoc(ref, newItem);
    } else {
      await addDoc(collection(db, sectionName), newItem);
    }
  } catch (err) {
    console.warn("⚠️ No se pudo guardar en Firebase", err);
  }

  editIndex = null;
  editSection = null;
  editId = null;

  loadData(sectionName);
};

// ---- Eliminar ----
window.deleteItem = async function (sectionName, docId = null, index = null) {
  if (index !== null) {
    let data = JSON.parse(localStorage.getItem(sectionName)) || [];
    data.splice(index, 1);
    localStorage.setItem(sectionName, JSON.stringify(data));
  }

  if (docId) {
    try {
      await deleteDoc(doc(db, sectionName, docId));
    } catch (err) {
      console.warn("⚠️ No se pudo eliminar en Firebase", err);
    }
  }

  loadData(sectionName);
};

// ---- Editar ----
window.editItem = function (sectionName, docId = null, index = null) {
  const form = document.querySelector('form');
  const inputs = form ? form.querySelectorAll('input') : [];
  const select = form ? form.querySelector('select') : null;

  let item = null;

  if (docId) {
    const row = event.target.closest('tr');
    const values = [...row.querySelectorAll('td')].slice(0, inputs.length + (select ? 1 : 0))
                                             .map(td => td.textContent);
    item = {};
    inputs.forEach((input, i) => item[input.placeholder] = values[i]);
    if (select) item[select.name || 'Concurso'] = values[inputs.length];
  } else {
    const data = JSON.parse(localStorage.getItem(sectionName));
    item = data[index];
  }

  inputs.forEach(input => input.value = item[input.placeholder] || '');
  if (select && item[select.name || 'Concurso']) {
    select.value = item[select.name || 'Concurso'];
  }

  editIndex = index;
  editSection = sectionName;
  editId = docId;
};

// ---- Exportar PDF ----
window.exportPDF = function (sectionName) {
  const { jsPDF } = window.jspdf;
  let pdfDoc = new jsPDF();
  const table = document.getElementById('table');
  pdfDoc.autoTable({ html: table });
  pdfDoc.save(`${sectionName}.pdf`);
};

// ---- addItem ----
window.addItem = function (e, section) {
  e.preventDefault();
  const form = e.target;
  const inputs = form.querySelectorAll('input');
  const select = form.querySelector('select');
  let newItem = {};
  inputs.forEach(input => newItem[input.placeholder] = input.value);
  if (select) newItem[select.name || 'Concurso'] = select.value;

  // Guardamos timestamp para orden de entrada
  newItem._createdAt = Date.now();

  saveData(section, newItem);
  form.reset();
};
