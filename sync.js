/* Sincronización entre los dos teléfonos.
   ───────────────────────────────────────
   Este repositorio es público, así que acá NO hay ningún dato del viaje.
   Los datos viven en Firestore y solo los ven las dos personas del viaje,
   cada una entrando con su cuenta de Google.

   Lo que sí está acá es la configuración de Firebase. Eso es normal y es
   como Firebase está pensado: cualquiera puede verla, pero sin estar en la
   lista de UID de las reglas no lee ni escribe nada. */

(function(){
  'use strict';

  var FIREBASE = {
    apiKey:            'AIzaSyBCg3oqDLCnnckj_1G5vbOpempSiM_fvIQ',
    authDomain:        'bariloche-957c9.firebaseapp.com',
    projectId:         'bariloche-957c9',
    storageBucket:     'bariloche-957c9.firebasestorage.app',
    messagingSenderId: '1011456291981',
    appId:             '1:1011456291981:web:7c34d83be5ff275ce6dec4'
  };

  var DOC    = 'viaje/estado';   // el estado que cambia: precios y tildes
  var ESPERA = 900;              // ms de calma antes de escribir

  var VERSION = '11.0.2';
  var BASE = 'https://www.gstatic.com/firebasejs/' + VERSION + '/';

  /* ───────────────────────── cartelito de estado ───────────────────────── */

  var chip;
  function señal(texto, clase){
    if (!chip){
      chip = document.createElement('div');
      chip.id = 'brcSync';
      document.body.appendChild(chip);
    }
    var color = {
      ok:    ['var(--sage-soft,#DDEDE4)', 'var(--sage,#3F8464)'],
      yendo: ['var(--gold-soft,#FBEED4)', 'var(--gold,#D99326)'],
      mal:   ['var(--brand-soft,#FCE7DE)', 'var(--brand-ink,#B94A2A)'],
      solo:  ['var(--surface-2,#FBF2EC)', 'var(--muted,#6E848F)']
    }[clase] || ['#eee', '#333'];

    chip.style.cssText =
      'position:fixed;right:.7rem;bottom:4.6rem;z-index:150;' +
      'font:600 .72rem/1 var(--sans,sans-serif);padding:.4rem .6rem;' +
      'border-radius:999px;pointer-events:none;white-space:nowrap;' +
      'transition:opacity .35s;opacity:1;' +
      'background:' + color[0] + ';color:' + color[1];
    chip.textContent = texto;

    clearTimeout(chip._t);
    if (clase === 'ok' || clase === 'solo'){
      chip._t = setTimeout(function(){ chip.style.opacity = '0'; }, 2200);
    }
  }

  /* ───────────────────────── pantalla de entrada ───────────────────────── */

  var puerta;
  function mostrarPuerta(estado, detalle){
    if (!puerta){
      puerta = document.createElement('div');
      puerta.id = 'brcPuerta';
      puerta.style.cssText =
        'position:fixed;inset:0;z-index:300;display:flex;align-items:center;' +
        'justify-content:center;padding:1.5rem;' +
        'background:var(--ground,#FFF6F1);color:var(--ink,#1E3038);' +
        'font-family:var(--sans,sans-serif);text-align:center';
      document.body.appendChild(puerta);
    }
    puerta.hidden = false;
    puerta.innerHTML =
      '<div style="max-width:20rem">' +
        '<div style="font-size:2.6rem;line-height:1;margin-bottom:.8rem">🏔️</div>' +
        '<h1 style="margin:0 0 .5rem;font-size:1.35rem">Bariloche Juntos</h1>' +
        '<p id="brcPuertaTxt" style="margin:0 0 1.3rem;font-size:.9rem;' +
          'color:var(--muted,#6E848F);line-height:1.5"></p>' +
        '<button id="brcEntrar" type="button" style="font:inherit;font-size:.95rem;' +
          'font-weight:700;cursor:pointer;padding:.7rem 1.4rem;border-radius:.6rem;' +
          'border:0;background:var(--brand,#DD5F3B);color:#fff">Entrar con Google</button>' +
      '</div>';
    puerta.querySelector('#brcPuertaTxt').textContent = detalle;
    var btn = puerta.querySelector('#brcEntrar');
    btn.hidden = (estado !== 'pedir');
    return btn;
  }

  function cerrarPuerta(){
    if (puerta) puerta.hidden = true;
  }

  function esperarApp(){
    return new Promise(function(listo){
      if (window.BRC) return listo();
      var i = setInterval(function(){
        if (window.BRC){ clearInterval(i); listo(); }
      }, 50);
    });
  }

  /* la app agregada a la pantalla de inicio en iPhone maneja mal las
     ventanitas emergentes, así que ahí vamos por redirección */
  function esAppInstalada(){
    return window.navigator.standalone === true ||
           window.matchMedia('(display-mode: standalone)').matches;
  }

  /* ───────────────────────────── arranque ───────────────────────────── */

  Promise.all([
    import(BASE + 'firebase-app.js'),
    import(BASE + 'firebase-auth.js'),
    import(BASE + 'firebase-firestore.js'),
    esperarApp()
  ]).then(function(m){
    var appMod = m[0], authMod = m[1], fs = m[2];

    var app  = appMod.initializeApp(FIREBASE);
    var auth = authMod.getAuth(app);
    var db   = fs.getFirestore(app);

    var proveedor = new authMod.GoogleAuthProvider();
    proveedor.setCustomParameters({prompt: 'select_account'});

    function entrar(){
      mostrarPuerta('esperando', 'Abriendo Google…');
      var p = esAppInstalada()
        ? authMod.signInWithRedirect(auth, proveedor)
        : authMod.signInWithPopup(auth, proveedor);
      Promise.resolve(p).catch(function(err){
        var codigo = err && err.code || '';
        var texto = codigo === 'auth/popup-blocked'
          ? 'El navegador bloqueó la ventana de Google. Permitila y probá de nuevo.'
          : codigo === 'auth/popup-closed-by-user' || codigo === 'auth/cancelled-popup-request'
            ? 'Se cerró la ventana antes de terminar. Probá de nuevo.'
            : 'No se pudo entrar (' + (codigo || 'error desconocido') + ').';
        mostrarPuerta('pedir', texto).addEventListener('click', entrar);
      });
    }

    /* si volvemos de una redirección, que no quede la pantalla colgada */
    authMod.getRedirectResult(auth).catch(function(){});

    authMod.onAuthStateChanged(auth, function(usuario){
      if (!usuario){
        mostrarPuerta('pedir',
          'Entrá con tu cuenta de Google para ver el viaje y que lo que cargues le aparezca al otro.'
        ).addEventListener('click', entrar);
        señal('Sin entrar', 'solo');
        return;
      }
      cerrarPuerta();
      arrancarSync(fs, db, auth, authMod, usuario);
    });

  }).catch(function(err){
    console.warn('[sync] no pude cargar Firebase', err);
    esperarApp().then(function(){ señal('Sin sincronizar', 'solo'); });
  });

  /* ──────────────────────── sincronización ──────────────────────── */

  function arrancarSync(fs, db, auth, authMod, usuario){
    var ref = fs.doc(db, DOC);
    var pendiente = null, timer = null, primeraVez = true;

    fs.onSnapshot(ref, function(snap){
      if (snap.metadata.hasPendingWrites) return;   // es mi propia escritura

      if (!snap.exists()){
        if (primeraVez){ primeraVez = false; guardarYa(window.BRC.leer()); }
        return;
      }

      var d = snap.data() || {};
      /* cada parte por separado: si una viene rota, las otras igual entran */
      ['plata', 'lista', 'viaje'].forEach(function(parte){
        if (!d[parte]) return;
        try { window.BRC.aplicar(parte, d[parte]); }
        catch (e){ console.warn('[sync] no pude aplicar ' + parte, e); }
      });

      señal(primeraVez ? 'Sincronizado' : 'Actualizado', 'ok');
      primeraVez = false;

    }, function(err){
      var codigo = err && err.code || '';
      if (codigo === 'permission-denied'){
        mostrarPuerta('esperando',
          'Entraste bien, pero tu cuenta todavía no está habilitada en la base. ' +
          'Tu identificador es ' + usuario.uid + ' — hay que agregarlo a las reglas de Firestore.'
        );
        señal('Falta habilitar tu cuenta', 'mal');
        console.warn('[sync] UID a agregar en las reglas:', usuario.uid);
      } else {
        señal('Sin conexión', 'mal');
      }
      console.warn('[sync] onSnapshot', codigo);
    });

    function guardarYa(estado){
      señal('Guardando', 'yendo');
      var paquete = {plata: estado.plata, lista: estado.lista, cuando: fs.serverTimestamp()};
      if (estado.viaje) paquete.viaje = estado.viaje;
      fs.setDoc(ref, paquete, {merge: true})
        .then(function(){ señal('Guardado', 'ok'); })
        .catch(function(err){
          señal('No se pudo guardar', 'mal');
          console.warn('[sync] setDoc', err && err.code);
        });
    }

    window.BRC.alCambiar = function(){
      pendiente = window.BRC.leer();
      clearTimeout(timer);
      timer = setTimeout(function(){
        if (pendiente) guardarYa(pendiente);
        pendiente = null;
      }, ESPERA);
    };

    window.addEventListener('pagehide', function(){
      if (pendiente){ clearTimeout(timer); guardarYa(pendiente); pendiente = null; }
    });

    /* dejamos a mano una forma de salir, por si alguna vez hace falta */
    window.BRC.salir = function(){ authMod.signOut(auth); };
    window.BRC.quienSoy = function(){ return {uid: usuario.uid, mail: usuario.email}; };
  }
})();
