
import { useEffect, useState, useCallback } from "react";
import "./App.css";

const TOTAL_NUMBERS = 100;

const API_URL =
  "https://script.google.com/macros/s/AKfycbz4HotRCOUuqM9zqQFBgBE9YTxL3JS6KK2V91J9pyFgbgJ2HwLzS3dv9Nf0BksTU77h/exec";

// ==========================================
// CONSULTAR GOOGLE SHEETS MEDIANTE JSONP
// ==========================================

function loadRecordsFromGoogle() {
  return new Promise((resolve, reject) => {
    const callbackName =
      "rifaCallback_" +
      Date.now() +
      "_" +
      Math.floor(Math.random() * 100000);

    const script = document.createElement("script");
    let timeout;
    let completed = false;

    const cleanup = () => {
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    };

    const fail = (error) => {
      if (completed) return;
      completed = true;
      cleanup();
      reject(error);
    };

    timeout = setTimeout(() => {
      fail(
        new Error(
          "Tiempo de espera agotado al consultar Google Sheets."
        )
      );
    }, 20000);

    window[callbackName] = (result) => {
      if (completed) return;

      if (!result || !result.success) {
        fail(
          new Error(
            result?.message ||
              "Google Sheets no pudo cargar los registros."
          )
        );
        return;
      }

      completed = true;
      cleanup();
      resolve(result);
    };

    script.onerror = () => {
      fail(
        new Error(
          "No fue posible conectar con Google Sheets."
        )
      );
    };

    script.src =
      `${API_URL}?callback=${callbackName}&t=${Date.now()}`;

    document.head.appendChild(script);
  });
}

// ==========================================
// ENVIAR INFORMACIÓN MEDIANTE FORMULARIO
// ==========================================

function sendToGoogle(data) {
  return new Promise((resolve, reject) => {
    const iframeName =
      "rifa_frame_" +
      Date.now() +
      "_" +
      Math.floor(Math.random() * 100000);

    const iframe = document.createElement("iframe");

    iframe.name = iframeName;
    iframe.src = "about:blank";
    iframe.style.display = "none";
    iframe.setAttribute("aria-hidden", "true");

    const form = document.createElement("form");

    form.method = "POST";
    form.action = API_URL;
    form.target = iframeName;
    form.enctype = "application/x-www-form-urlencoded";
    form.style.display = "none";

    const payload = document.createElement("input");

    payload.type = "hidden";
    payload.name = "payload";
    payload.value = JSON.stringify(data);

    form.appendChild(payload);

    let completed = false;
    let submitted = false;
    let timeout;

    const cleanup = () => {
      clearTimeout(timeout);
      iframe.removeEventListener("load", handleLoad);
      form.remove();
      iframe.remove();
    };

    const fail = (error) => {
      if (completed) return;

      completed = true;
      cleanup();
      reject(error);
    };

    const handleLoad = () => {
      if (completed) return;

      // Primera carga: about:blank.
      // En este momento enviamos el formulario.
      if (!submitted) {
        submitted = true;

        try {
          form.submit();
        } catch (error) {
          fail(
            new Error(
              "No fue posible enviar los datos a Google."
            )
          );
        }

        return;
      }

      // Segunda carga: respuesta de Google Apps Script.
      completed = true;
      cleanup();
      resolve(true);
    };

    iframe.addEventListener("load", handleLoad);

    timeout = setTimeout(() => {
      fail(
        new Error(
          "Google no respondió a tiempo. Verifica tu conexión e intenta nuevamente."
        )
      );
    }, 30000);

    // Agregar primero el iframe y después el formulario.
    document.body.appendChild(iframe);
    document.body.appendChild(form);
  });
}

// ==========================================
// ESPERAR
// ==========================================

function wait(milliseconds) {
  return new Promise((resolve) =>
    setTimeout(resolve, milliseconds)
  );
}

// ==========================================
// APLICACIÓN PRINCIPAL
// ==========================================

function App() {
  // ==========================================
  // REGISTROS
  // ==========================================

  const [records, setRecords] = useState(() => {
    try {
      return (
        JSON.parse(
          localStorage.getItem("rifa-registros")
        ) || {}
      );
    } catch {
      return {};
    }
  });

  const [connected, setConnected] = useState(false);

  // ==========================================
  // SELECCIÓN
  // ==========================================

  const [selected, setSelected] = useState([]);

  // ==========================================
  // FORMULARIO
  // ==========================================

  const [showForm, setShowForm] = useState(false);
  const [editingNumber, setEditingNumber] = useState(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [payment, setPayment] = useState("Debe");
  const [proof, setProof] = useState(null);
  const [performedBy, setPerformedBy] = useState("");

  // ==========================================
  // MENSAJES
  // ==========================================

  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // ==========================================
  // ADMINISTRADOR
  // ==========================================

  const [showAdmin, setShowAdmin] = useState(false);
  const [adminNumber, setAdminNumber] = useState(null);
  const [adminCode, setAdminCode] = useState("");
  const [adminError, setAdminError] = useState("");
  const [releasing, setReleasing] = useState(false);

  // ==========================================
  // FORMATEAR NÚMEROS
  // ==========================================

  const formatNumber = (number) =>
    String(number).padStart(2, "0");

  // ==========================================
  // CONSULTAR GOOGLE SHEETS
  // ==========================================

  const refreshRecords = useCallback(async () => {
    const result = await loadRecordsFromGoogle();

    if (!result || !result.success) {
      throw new Error(
        result?.message ||
          "Google Sheets devolvió una respuesta no válida."
      );
    }

    const recordsFromGoogle = result.records || {};

    setRecords(recordsFromGoogle);
    setConnected(true);

    localStorage.setItem(
      "rifa-registros",
      JSON.stringify(recordsFromGoogle)
    );

    return recordsFromGoogle;
  }, []);

  // ==========================================
  // CARGAR AUTOMÁTICAMENTE AL ABRIR
  // ==========================================

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const data = await refreshRecords();

        if (active) {
          console.log(
            "Registros recibidos de Google:",
            data
          );
        }
      } catch (error) {
        console.error(
          "Error cargando Google Sheets:",
          error
        );

        if (active) {
          setConnected(false);

          setMessage(
            "No fue posible conectar con Google Sheets. Los datos guardados en este dispositivo pueden estar desactualizados. No realices reservas hasta recuperar la conexión."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [refreshRecords]);

  // ==========================================
  // RESPALDAR REGISTROS LOCALES
  // ==========================================

  useEffect(() => {
    if (!loading) {
      localStorage.setItem(
        "rifa-registros",
        JSON.stringify(records)
      );
    }
  }, [records, loading]);

  // ==========================================
  // SELECCIONAR NÚMEROS
  // ==========================================

  const selectNumber = (number) => {
    const key = formatNumber(number);
    const record = records[key];

    setMessage("");

    if (!connected || loading) {
      setMessage(
        "No hay conexión confirmada con Google Sheets. Intenta actualizar la página."
      );
      return;
    }

    if (record?.status === "Pagó") {
      setMessage(`El número ${key} ya está pagado.`);
      return;
    }

    if (record?.status === "Debe") {
      setEditingNumber(key);
      setName(record.name || "");
      setPhone(record.phone || "");
      setPayment("Debe");
      setProof(null);
      setSelected([key]);
      setShowForm(true);
      setPerformedBy("");
      return;
    }

    setSelected((previous) =>
      previous.includes(key)
        ? previous.filter((item) => item !== key)
        : [...previous, key]
    );
  };

  // ==========================================
  // ABRIR FORMULARIO
  // ==========================================

  const openForm = () => {
    if (!connected || loading) {
      setMessage(
        "No hay conexión con Google Sheets. No es posible reservar en este momento."
      );
      return;
    }

    if (selected.length === 0) {
      setMessage(
        "Selecciona primero uno o varios números."
      );
      return;
    }

    setEditingNumber(null);
    setName("");
    setPhone("");
    setPayment("Debe");
    setProof(null);
    setMessage("");
    setShowForm(true);
    setPerformedBy("");
  };

  // ==========================================
  // CERRAR FORMULARIO
  // ==========================================

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingNumber(null);
    setName("");
    setPhone("");
    setPayment("Debe");
    setProof(null);
    setPerformedBy("");
  };

  // ==========================================
  // GUARDAR O ACTUALIZAR REGISTRO
  // ==========================================

  const saveRegistration = async (event) => {
    event.preventDefault();

    if (saving) return;

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanPerformedBy = performedBy.trim();

    if (!cleanPerformedBy) {
      setMessage(
        "Ingresa el nombre de la persona que realiza el registro."
      );
      return;
    }

    if (!cleanName || !cleanPhone) {
      setMessage(
        "Completa el nombre y el celular."
      );
      return;
    }

    if (
      payment === "Pagó" &&
      !proof &&
      !(editingNumber && records[editingNumber]?.proofName)
    ) {
      setMessage(
        "Adjunta el comprobante de pago."
      );
      return;
    }

    setSaving(true);
    setMessage("Verificando disponibilidad...");

    try {
      // Consultar información actual del servidor.
      const currentRecords = await refreshRecords();

      // Validar que el número que se edita siga existiendo.
      if (
        editingNumber &&
        !currentRecords[editingNumber]
      ) {
        throw new Error(
          `El número ${editingNumber} ya no tiene un registro activo. Actualiza la página.`
        );
      }

      // Validar que el celular no esté asociado a otro número.
      const duplicate = Object.entries(
        currentRecords
      ).some(
        ([number, record]) =>
          String(record.phone || "").trim() === cleanPhone &&
          number !== editingNumber
      );

      if (duplicate) {
        throw new Error(
          "Este celular ya tiene un registro en la rifa."
        );
      }

      const updated = { ...currentRecords };

      // ==========================================
      // ACTUALIZAR REGISTRO EXISTENTE
      // ==========================================

      if (editingNumber) {
        updated[editingNumber] = {
          ...currentRecords[editingNumber],
          name: cleanName,
          phone: cleanPhone,
          status: payment,
          performedBy: cleanPerformedBy,
          date: new Date().toISOString(),
          proofName:
            proof?.name ||
            currentRecords[editingNumber]?.proofName ||
            "",
        };
      } else {
        // ==========================================
        // VALIDAR DISPONIBILIDAD DE NUEVOS NÚMEROS
        // ==========================================

        for (const number of selected) {
          if (currentRecords[number]) {
            throw new Error(
              `El número ${number} ya fue seleccionado por otra persona. Actualiza la página y elige otro.`
            );
          }
        }

        // ==========================================
        // PREPARAR NUEVOS REGISTROS
        // ==========================================

        for (const number of selected) {
          updated[number] = {
            name: cleanName,
            phone: cleanPhone,
            status: payment,
            performedBy: cleanPerformedBy,
            date: new Date().toISOString(),
            proofName: proof?.name || "",
          };
        }
      }

      // ==========================================
      // ENVIAR ÚNICAMENTE REGISTROS MODIFICADOS
      // ==========================================

      setMessage(
        "Enviando registro a Google Sheets..."
      );

      const numbersToCheck = editingNumber
        ? [editingNumber]
        : [...selected];

      const recordsToSave = {};

      numbersToCheck.forEach((number) => {
        recordsToSave[number] = updated[number];
      });

      console.log(
        "Registros enviados a Google Sheets:",
        recordsToSave
      );

      await sendToGoogle({
        action: "save",
        records: recordsToSave,
      });

      // ==========================================
      // CONFIRMAR GUARDADO EN GOOGLE SHEETS
      // ==========================================

      setMessage(
        "Guardando y verificando información..."
      );

      let confirmed = false;
      let lastReadError = null;

      for (let attempt = 0; attempt < 8; attempt++) {
        await wait(1500);

        try {
          const savedRecords = await refreshRecords();

          confirmed = numbersToCheck.every((number) => {
            const saved = savedRecords[number];

            return (
              saved &&
              String(saved.phone || "").trim() === cleanPhone &&
              saved.name === cleanName &&
              saved.status === payment
            );
          });

          if (confirmed) {
            console.log(
              "Registro confirmado en Google Sheets."
            );
            break;
          }
        } catch (readError) {
          lastReadError = readError;

          console.warn(
            `Verificación ${attempt + 1} fallida:`,
            readError
          );
        }
      }

      if (!confirmed) {
        throw new Error(
          lastReadError
            ? "No fue posible confirmar el registro con Google Sheets. Revisa la hoja antes de volver a intentarlo."
            : "Google Sheets no confirmó el registro. Revisa la hoja antes de volver a intentarlo."
        );
      }

      // ==========================================
      // LIMPIAR FORMULARIO
      // ==========================================

      setSelected([]);
      setShowForm(false);
      setEditingNumber(null);
      setName("");
      setPhone("");
      setPayment("Debe");
      setProof(null);
      setPerformedBy("");

      setMessage(
        "¡Registro guardado correctamente!"
      );

    } catch (error) {
      console.error(
        "Error guardando registro:",
        error
      );

      setMessage(
        error.message ||
          "No se pudo guardar el registro. Intenta nuevamente."
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // SOLICITAR LIBERACIÓN
  // ==========================================

  const requestRelease = (number) => {
    setAdminNumber(number);
    setAdminCode("");
    setAdminError("");
    setShowAdmin(true);
  };

  // ==========================================
  // LIBERAR NÚMERO CON AUTORIZACIÓN
  // ==========================================

  const releaseNumber = async (event) => {
    event.preventDefault();

    if (releasing) return;

    if (!adminCode.trim()) {
      setAdminError(
        "Ingresa el código de administrador."
      );
      return;
    }

    setReleasing(true);
    setAdminError("");

    try {
      // Confirmar que el número exista en Google.
      const currentRecords = await refreshRecords();

      if (!currentRecords[adminNumber]) {
        throw new Error(
          "El número ya no aparece registrado. Actualiza la página."
        );
      }

      // Enviar solicitud de liberación.
      await sendToGoogle({
        action: "release",
        number: adminNumber,
        code: adminCode.trim(),
      });

      // ==========================================
      // CONFIRMAR LIBERACIÓN
      // ==========================================

      let released = false;
      let lastReadError = null;

      for (let attempt = 0; attempt < 8; attempt++) {
        await wait(1500);

        try {
          const updatedRecords = await refreshRecords();

          if (!updatedRecords[adminNumber]) {
            released = true;
            break;
          }
        } catch (readError) {
          lastReadError = readError;

          console.warn(
            `Verificación de liberación ${attempt + 1} fallida:`,
            readError
          );
        }
      }

      if (!released) {
        throw new Error(
          lastReadError
            ? "No fue posible confirmar la liberación. Revisa Google Sheets."
            : "Google Sheets no confirmó la liberación. Verifica el código y el registro."
        );
      }

      setShowAdmin(false);
      setAdminCode("");
      setAdminError("");

      setMessage(
        `El número ${adminNumber} está disponible nuevamente.`
      );

      setAdminNumber(null);

    } catch (error) {
      console.error(
        "Error liberando número:",
        error
      );

      setAdminError(
        error.message ||
          "No fue posible liberar el número."
      );
    } finally {
      setReleasing(false);
    }
  };

  // ==========================================
  // COMPARTIR APLICACIÓN
  // ==========================================

  const sharePage = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Registro Rifa",
          text: "Participa en nuestra rifa.",
          url: window.location.href,
        });
      } catch {
        // El usuario canceló el menú de compartir.
      }
    } else {
      window.print();
    }
  };

  // ==========================================
  // INTERFAZ
  // ==========================================

  return (
    <main className="page">
      <div className="raffle-card">

        {/* ENCABEZADO */}
        <header className="hero">
          <h1>REGISTRO RIFA</h1>
        </header>

        {/* INFORMACIÓN */}
        <section className="raffle-info">
          <div className="info-item turquoise">
            <span>⭐</span>
            <strong>00 AL 99</strong>
            <small>NÚMEROS</small>
          </div>

          <div className="info-item pink">
            <span>🎟️</span>
            <strong>$20.000</strong>
            <small>VALOR BOLETA</small>
          </div>

          <div className="info-item turquoise">
            <span>📅</span>
            <strong>12 DIC 2026</strong>
            <small>SORTEO</small>
          </div>
        </section>

        {/* PREMIO */}
        <section className="prize">
          <div>
            ⭐ JUEGA CON LAS 2 ÚLTIMAS CIFRAS DE LA LOTERÍA DE BOYACÁ ⭐
          </div>

          <strong>
            PREMIO: $1.000.000 PESOS
          </strong>
        </section>

        {/* NÚMEROS */}
        <section className="numbers-section">
          <h3>💚 ¡ELIGE TUS NÚMEROS! 💚</h3>

          <p className="instruction">
            Toca los números verdes para seleccionarlos.
            Los amarillos pueden actualizarse o liberarse
            con autorización.
          </p>

          {/* ESTADO DE CONEXIÓN */}
          <div className="connection-status">
            {loading ? (
              <span>Consultando registros...</span>
            ) : connected ? (
              <span>
                🟢 Conectado: registros actualizados
              </span>
            ) : (
              <span>
                🔴 Sin conexión con Google Sheets
              </span>
            )}
          </div>

          {/* LEYENDA */}
          <div className="legend">
            <span>
              <i className="green-dot" />
              Disponible
            </span>

            <span>
              <i className="red-dot" />
              Ocupado
            </span>

            <span>
              <i className="yellow-dot" />
              Pendiente
            </span>
          </div>

          {/* CUADRÍCULA */}
          <div className="numbers-grid">
            {Array.from(
              { length: TOTAL_NUMBERS },
              (_, number) => {
                const key = formatNumber(number);
                const record = records[key];

                const isSelected =
                  selected.includes(key);

                let statusClass = "available";

                if (record?.status === "Pagó") {
                  statusClass = "occupied";
                } else if (record?.status === "Debe") {
                  statusClass = "pending";
                } else if (isSelected) {
                  statusClass = "chosen";
                }

                return (
                  <button
                    key={key}
                    type="button"
                    className={`number ${statusClass}`}
                    onClick={() => selectNumber(number)}
                    disabled={loading || !connected}
                    onContextMenu={(event) => {
                      if (record?.status === "Debe") {
                        event.preventDefault();
                        requestRelease(key);
                      }
                    }}
                    title={
                      record?.status === "Debe"
                        ? `${key} - Pendiente. Clic para actualizar. Clic derecho para liberar.`
                        : record?.status === "Pagó"
                        ? `${key} - Pagado`
                        : `Seleccionar ${key}`
                    }
                  >
                    {key}
                  </button>
                );
              }
            )}
          </div>

          {/* NÚMEROS SELECCIONADOS */}
          {selected.length > 0 && (
            <div className="selection-info">
              Números seleccionados:{" "}
              <strong>
                {selected.join(", ")}
              </strong>

              <button
                type="button"
                onClick={openForm}
              >
                CONTINUAR CON EL REGISTRO
              </button>
            </div>
          )}

          {/* MENSAJES */}
          {message && (
            <div className="alert-message">
              {message}
            </div>
          )}
        </section>

        {/* PIE DE PÁGINA */}
        <footer>
          <p>
            ⚠️ La boleta que no esté pagada o sea
            cancelada no participa en el sorteo.
          </p>
        </footer>
      </div>

      {/* ====================================== */}
      {/* MODAL DE REGISTRO */}
      {/* ====================================== */}

      {showForm && (
        <div
          className="modal-backdrop"
          onClick={closeForm}
        >
          <form
            className="registration-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={saveRegistration}
          >
            <button
              type="button"
              className="close-modal"
              onClick={closeForm}
              disabled={saving}
            >
              ×
            </button>

            <h2>💗 ¡Reserva tus números!</h2>

            <p className="modal-numbers">
              Números:{" "}
              {editingNumber || selected.join(", ")}
            </p>

            <label>Nombre completo</label>

            <input
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="Tu nombre"
              required
            />

            <label>Número de celular</label>

            <input
              value={phone}
              onChange={(event) =>
                setPhone(event.target.value)
              }
              placeholder="Tu celular"
              type="tel"
              required
            />

            <label>Estado del pago</label>

            <select
              value={payment}
              onChange={(event) =>
                setPayment(event.target.value)
              }
            >
              <option value="Debe">Debe</option>
              <option value="Pagó">Pago</option>
            </select>

            <label>
              Nombre de quien realiza el registro
            </label>

            <input
              type="text"
              value={performedBy}
              onChange={(event) =>
                setPerformedBy(event.target.value)
              }
              placeholder="Nombre de quien registra"
              required
            />

            {payment === "Pagó" && (
              <>
                <label>Adjunta tu comprobante</label>

                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(event) =>
                    setProof(
                      event.target.files[0] || null
                    )
                  }
                />

                {proof && (
                  <small className="file-name">
                    {proof.name}
                  </small>
                )}

                {!proof &&
                  editingNumber &&
                  records[editingNumber]?.proofName && (
                    <small className="file-name">
                      Comprobante registrado:{" "}
                      {records[editingNumber].proofName}
                    </small>
                  )}
              </>
            )}

            {message && (
              <div className="alert-message">
                {message}
              </div>
            )}

            <button
              type="submit"
              className="submit-button"
              disabled={saving || !connected}
            >
              {saving
                ? "GUARDANDO..."
                : editingNumber
                ? "ACTUALIZAR REGISTRO"
                : "GUARDAR REGISTRO"}
            </button>
          </form>
        </div>
      )}

      {/* ====================================== */}
      {/* MODAL DE ADMINISTRADOR */}
      {/* ====================================== */}

      {showAdmin && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!releasing) {
              setShowAdmin(false);
            }
          }}
        >
          <form
            className="registration-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={releaseNumber}
          >
            <button
              type="button"
              className="close-modal"
              onClick={() => setShowAdmin(false)}
              disabled={releasing}
            >
              ×
            </button>

            <h2>🔐 Liberar número</h2>

            <p>
              Vas a liberar el número{" "}
              <strong>{adminNumber}</strong>.
            </p>

            <label>Código de administrador</label>

            <input
              type="password"
              value={adminCode}
              onChange={(event) =>
                setAdminCode(event.target.value)
              }
              placeholder="Ingresa tu código"
              inputMode="numeric"
              required
            />

            {adminError && (
              <div className="alert-message">
                {adminError}
              </div>
            )}

            <button
              type="submit"
              className="submit-button"
              disabled={releasing}
            >
              {releasing
                ? "PROCESANDO..."
                : "CONFIRMAR LIBERACIÓN"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

export default App;
