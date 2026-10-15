// Importar Firebase y Realtime Database desde los CDN oficiales
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAxG7HliJEd7XITfsra-eRR2w-XjZ-aGCA",
  authDomain: "modulo-asistencia-866bd.firebaseapp.com",
  databaseURL: "https://modulo-asistencia-866bd-default-rtdb.firebaseio.com",
  projectId: "modulo-asistencia-866bd",
  storageBucket: "modulo-asistencia-866bd.firebasestorage.app",
  messagingSenderId: "302635712434",
  appId: "1:302635712434:web:e33cfa50bccc4caa3feeab",
  measurementId: "G-JLY0P34DH7"
};

// Inicializar Firebase y la Base de Datos
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ---------- Datos iniciales por defecto ----------
const estudiantesBase = [
  { codigo: "1142925222", nombre: "Ana Victoria Barrios Romedo", grado: "11-A" },
  { codigo: "1062607932", nombre: "Juan Pablo Tabera Ubarnes", grado: "11-A" },
  { codigo: "1062439213", nombre: "Jhon Maycol Buelvas Garcia", grado: "11-A" }
];

let cacheEstudiantes = [];
let cacheAsistencias = [];

// Escuchar cambios en tiempo real desde la nube de Firebase
onValue(ref(db, "estudiantes"), (snapshot) => {
  const data = snapshot.val();
  if (!data) {
    set(ref(db, "estudiantes"), estudiantesBase);
    cacheEstudiantes = estudiantesBase;
  } else {
    cacheEstudiantes = Array.isArray(data) ? data : Object.values(data);
  }
  actualizarTodo();
});

onValue(ref(db, "asistencias"), (snapshot) => {
  const data = snapshot.val();
  cacheAsistencias = data ? (Array.isArray(data) ? data : Object.values(data)) : [];
  actualizarTodo();
});

// ---------- Almacenamiento en la Nube (Firebase) ----------
const leer = (key) => {
  if (key === "estudiantes") return cacheEstudiantes;
  if (key === "asistencias") return cacheAsistencias;
  return [];
};

const guardar = (key, data) => {
  set(ref(db, key), data);
};

// ---------- Utilidades de Tiempo ----------
const fechaHoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fechaLegible = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const horaActual = () => new Date().toLocaleTimeString("es-CO", { hour12: false });

// Variables globales para la cámara
let html5QrCode = null;
let camaraActiva = false;

// ---------- Inicialización General ----------
document.addEventListener("DOMContentLoaded", () => {
  
  const elMetricFecha = document.getElementById("metricFecha");
  if (elMetricFecha) elMetricFecha.textContent = fechaLegible();
  
  const filtroFecha = document.getElementById("filtroFecha");
  if (filtroFecha) filtroFecha.value = fechaHoy();

  // ---------- Navegación por Pestañas (Tabs) ----------
  const tabBtns = document.querySelectorAll(".tab-btn");
  const panelSecciones = document.querySelectorAll(".panel-seccion");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      // Si nos movemos fuera del Dashboard, detenemos la cámara por seguridad
      const targetId = btn.getAttribute("data-target");
      if (targetId !== "tab-dashboard" && camaraActiva) {
        detenerCamara();
      }

      tabBtns.forEach(b => b.classList.remove("activo"));
      panelSecciones.forEach(s => s.classList.remove("activo"));

      btn.classList.add("activo");
      const targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.classList.add("activo");
    });
  });

  // ---------- Botones de Control de Cámara ----------
  const btnIniciarCamara = document.getElementById("btnIniciarCamara");
  const btnDetenerCamara = document.getElementById("btnDetenerCamara");

  if (btnIniciarCamara) btnIniciarCamara.addEventListener("click", iniciarCamara);
  if (btnDetenerCamara) btnDetenerCamara.addEventListener("click", detenerCamara);

  // ---------- Botón Agregar Estudiante ----------
  const btnAgregar = document.getElementById("btnAgregar");
  if (btnAgregar) btnAgregar.addEventListener("click", agregarEstudiante);

  // ---------- Filtro y Búsqueda ----------
  if (filtroFecha) filtroFecha.addEventListener("change", renderAsistencias);

  const buscarEstudiante = document.getElementById("buscarEstudiante");
  if (buscarEstudiante) buscarEstudiante.addEventListener("input", renderEstudiantes);

  // ---------- Botones de Exportación CSV ----------
  const btnExportarHoy = document.getElementById("btnExportarHoy");
  if (btnExportarHoy) {
    btnExportarHoy.addEventListener("click", () => {
      const hoy = filtroFecha ? filtroFecha.value : fechaHoy();
      const lista = leer("asistencias").filter(a => a.fecha === hoy);
      exportarCSV(lista, `Asistencias_${hoy}`);
    });
  }

  const btnExportarTodo = document.getElementById("btnExportarTodo");
  if (btnExportarTodo) {
    btnExportarTodo.addEventListener("click", () => {
      exportarCSV(leer("asistencias"), "Historial_General_Asistencia");
    });
  }

  // ---------- Lector / Input USB ----------
  const inputLector = document.getElementById("inputLector");
  let temporizadorLector = null;

  if (inputLector) {
    function procesarCodigo() {
      const cod = inputLector.value.trim().toUpperCase();
      clearTimeout(temporizadorLector);
      inputLector.value = "";
      if (cod) registrarAsistencia(cod);
      inputLector.focus();
    }

    inputLector.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        procesarCodigo();
      }
    });

    inputLector.addEventListener("input", () => {
      clearTimeout(temporizadorLector);
      temporizadorLector = setTimeout(() => {
        if (inputLector.value.trim()) procesarCodigo();
      }, 700);
    });

    inputLector.addEventListener("blur", () => {
      clearTimeout(temporizadorLector);
    });
  }

  actualizarTodo();
});

// ---------- Funciones de la Cámara QR ----------
function iniciarCamara() {
  if (camaraActiva) return;

  if (typeof Html5Qrcode === "undefined") {
    alert("La librería de la cámara no se ha cargado correctamente. Verifique su conexión a internet.");
    return;
  }

  html5QrCode = new Html5Qrcode("reader");
  
  html5QrCode.start(
    { facingMode: "environment" }, 
    {
      fps: 10,
      qrbox: { width: 220, height: 220 }
    },
    (decodedText) => {
      const codigoLimpio = decodedText.trim().toUpperCase();
      registrarAsistencia(codigoLimpio);
      if (navigator.vibrate) navigator.vibrate(200);
    },
    (errorMessage) => {}
  ).then(() => {
    camaraActiva = true;
    document.getElementById("btnIniciarCamara").style.display = "none";
    document.getElementById("btnDetenerCamara").style.display = "inline-block";
  }).catch((err) => {
    alert("No se pudo iniciar la cámara. Verifique los permisos de su navegador.");
  });
}

function detenerCamara() {
  if (!camaraActiva || !html5QrCode) return;

  html5QrCode.stop().then(() => {
    html5QrCode.clear();
    camaraActiva = false;
    document.getElementById("btnIniciarCamara").style.display = "inline-block";
    document.getElementById("btnDetenerCamara").style.display = "none";
  }).catch((err) => {
    console.error("Error al detener la cámara:", err);
  });
}

// ---------- Audio Sintético ----------
function reproducirSonido(tipo) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (tipo === 'exito') {
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else {
      osc.frequency.value = 220;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {}
}

// ---------- Métricas del Panel ----------
function actualizarMetricas() {
  const estudiantes = leer("estudiantes");
  const asistencias = leer("asistencias");
  const hoy = fechaHoy();

  const totalEst = document.getElementById("metricTotalEst");
  const presHoy = document.getElementById("metricPresentes");

  if (totalEst) totalEst.textContent = estudiantes.length;
  if (presHoy) presHoy.textContent = asistencias.filter(a => a.fecha === hoy).length;
}

// ---------- Gestión de Estudiantes ----------
function agregarEstudiante() {
  const codigoInput = document.getElementById("codigo");
  const nombreInput = document.getElementById("nombre");
  const gradoInput = document.getElementById("grado");

  const codigo = codigoInput ? codigoInput.value.trim().toUpperCase() : "";
  const nombre = nombreInput ? nombreInput.value.trim() : "";
  const grado = gradoInput ? gradoInput.value.trim() : "";

  if (!codigo || !nombre) {
    alert("Debe rellenar al menos el código y el nombre del estudiante.");
    return;
  }

  let estudiantes = leer("estudiantes");
  if (estudiantes.some(e => e.codigo === codigo)) {
    alert("Ya existe un alumno registrado con este código.");
    return;
  }

  estudiantes.push({ codigo, nombre, grado });
  guardar("estudiantes", estudiantes);

  if (codigoInput) codigoInput.value = "";
  if (nombreInput) nombreInput.value = "";
  if (gradoInput) gradoInput.value = "";

  actualizarTodo();
  alert("¡Estudiante registrado con éxito!");
}

function eliminarEstudiante(codigo) {
  if (confirm(`¿Desea eliminar al estudiante con código ${codigo}?`)) {
    let estudiantes = leer("estudiantes").filter(e => e.codigo !== codigo);
    guardar("estudiantes", estudiantes);
    actualizarTodo();
  }
}

window.eliminarEstudiante = eliminarEstudiante;

function renderEstudiantes() {
  const tbody = document.getElementById("tablaEstudiantes");
  if (!tbody) return;
  tbody.innerHTML = "";

  const buscarInput = document.getElementById("buscarEstudiante");
  const filtro = buscarInput ? buscarInput.value.trim().toLowerCase() : "";
  
  const estudiantes = leer("estudiantes").filter(e => 
    e.nombre.toLowerCase().includes(filtro) || e.codigo.toLowerCase().includes(filtro)
  );

  if (estudiantes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No se encontraron estudiantes registrados.</td></tr>`;
    return;
  }

  estudiantes.forEach(est => {
    tbody.innerHTML += `
      <tr>
        <td><strong>${est.codigo}</strong></td>
        <td>${est.nombre}</td>
        <td>${est.grado || 'N/A'}</td>
        <td><button onclick="eliminarEstudiante('${est.codigo}')" class="btn-danger" type="button">Eliminar</button></td>
      </tr>
    `;
  });
}

// ---------- Registro de Asistencia ----------
function registrarAsistencia(codigo) {
  const estudiantes = leer("estudiantes");
  const est = estudiantes.find(e => e.codigo === codigo);
  const statusCard = document.getElementById("statusCard");

  if (!est) {
    reproducirSonido('error');
    if (statusCard) {
      statusCard.className = "status-display error";
      statusCard.innerHTML = `
        <div class="status-icon-big">❌</div>
        <h4>Código No Encontrado</h4>
        <p>El código <strong>${codigo}</strong> no pertenece a ningún alumno registrado.</p>
      `;
    }
    return;
  }

  let asistencias = leer("asistencias");
  const hoy = fechaHoy();

  if (asistencias.some(a => a.codigo === codigo && a.fecha === hoy)) {
    reproducirSonido('error');
    if (statusCard) {
      statusCard.className = "status-display warning";
      statusCard.innerHTML = `
        <div class="status-icon-big">⚠️</div>
        <h4>Acceso Duplicado</h4>
        <p><strong>${est.nombre}</strong><br>Ya registró su ingreso el día de hoy.</p>
      `;
    }
    return;
  }

  const hora = horaActual();
  asistencias.push({ codigo, nombre: est.nombre, fecha: hoy, hora });
  guardar("asistencias", asistencias);

  reproducirSonido('exito');
  if (statusCard) {
    statusCard.className = "status-display success";
    statusCard.innerHTML = `
      <div class="status-icon-big">✅</div>
      <h4>Asistencia Registrada</h4>
      <p><strong>${est.nombre}</strong><br>Grado: ${est.grado || 'N/A'}<br>Hora: ${hora}</p>
    `;
  }

  actualizarTodo();
}

// ---------- Renderizado de Tablas ----------
function renderAsistencias() {
  const tbody = document.getElementById("tablaAsistencia");
  if (!tbody) return;
  tbody.innerHTML = "";
  
  const filtroFecha = document.getElementById("filtroFecha");
  const fechaFiltro = filtroFecha ? filtroFecha.value : fechaHoy();
  const lista = leer("asistencias").filter(a => a.fecha === fechaFiltro);

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Sin asistencias registradas para esta fecha.</td></tr>`;
    return;
  }

  lista.forEach(item => {
    tbody.innerHTML += `
      <tr>
        <td><strong>${item.codigo}</strong></td>
        <td>${item.nombre}</td>
        <td>${item.fecha}</td>
        <td>${item.hora}</td>
      </tr>
    `;
  });
}

function renderHistorial() {
  const tbody = document.getElementById("tablaHistorial");
  if (!tbody) return;
  tbody.innerHTML = "";
  const historial = leer("asistencias");

  if (historial.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Historial vacío.</td></tr>`;
    return;
  }

  historial.slice().reverse().forEach(item => {
    tbody.innerHTML += `
      <tr>
        <td><strong>${item.codigo}</strong></td>
        <td>${item.nombre}</td>
        <td>${item.fecha}</td>
        <td>${item.hora}</td>
      </tr>
    `;
  });
}

// ---------- Exportar a CSV ----------
function exportarCSV(datos, nombreArchivo) {
  if (datos.length === 0) {
    alert("No hay datos disponibles para exportar.");
    return;
  }

  let csvContent = "\uFEFFCódigo,Nombre,Fecha,Hora\n";
  datos.forEach(row => {
    csvContent += `"${row.codigo}","${row.nombre}","${row.fecha}","${row.hora}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${nombreArchivo}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ---------- Renderizado de Carnets y Generación QR ----------
function renderCarnets() {
  const container = document.getElementById("gridCarnets");
  if (!container) return;
  container.innerHTML = "";
  const estudiantes = leer("estudiantes");

  if (estudiantes.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align:center;">No hay alumnos registrados para mostrar carnets.</p>`;
    return;
  }

  estudiantes.forEach(est => {
    const div = document.createElement("div");
    div.className = "carnet-card";
    div.innerHTML = `
      <h5>${est.nombre}</h5>
      <p>${est.grado || 'Sin curso'}</p>
      <div class="codigo-badge-card">${est.codigo}</div>
      <div class="qr-box-mini" id="qr-card-${est.codigo}"></div>
    `;
    container.appendChild(div);

    if (typeof QRCode !== "undefined") {
      try {
        new QRCode(document.getElementById(`qr-card-${est.codigo}`), {
          text: est.codigo,
          width: 80,
          height: 80
        });
      } catch(e) {}
    }
  });
}

// ---------- Actualización General ----------
function actualizarTodo() {
  actualizarMetricas();
  renderEstudiantes();
  renderAsistencias();
  renderHistorial();
  renderCarnets();
}
