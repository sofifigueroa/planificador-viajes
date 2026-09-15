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
  function mostrarPuerta(estado, detalle, copiable){
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
    puerta.style.display = 'flex';
    puerta.innerHTML =
      '<div style="max-width:20rem">' +
        '<div style="font-size:2.6rem;line-height:1;margin-bottom:.8rem">🏔️</div>' +
        '<h1 style="margin:0 0 .5rem;font-size:1.35rem">Bariloche Juntos</h1>' +
        '<p id="brcPuertaTxt" style="margin:0 0 1.3rem;font-size:.9rem;' +
          'color:var(--muted,#6E848F);line-height:1.5"></p>' +
        '<button id="brcEntrar" type="button" style="font:inherit;font-size:.95rem;' +
          'font-weight:700;cursor:pointer;padding:.7rem 1.4rem;border-radius:.6rem;' +
          'border:0;background:var(--brand,#DD5F3B);color:#fff">Entrar con Google</button>' +
        '<div id="brcCopia" hidden style="margin-top:1rem">' +
          '<code id="brcUid" style="display:block;font-size:.78rem;word-break:break-all;' +
            'background:var(--gold-soft,#FBEED4);color:var(--ink,#1E3038);' +
            'padding:.55rem .6rem;border-radius:.45rem;user-select:all"></code>' +
          '<button id="brcCopiar" type="button" style="font:inherit;font-size:.85rem;' +
            'font-weight:700;cursor:pointer;margin-top:.6rem;padding:.55rem 1rem;' +
            'border-radius:.5rem;border:1px solid var(--brand,#DD5F3B);' +
            'background:transparent;color:var(--brand,#DD5F3B)">Copiar mi identificador</button>' +
        '</div>' +
      '</div>';
    puerta.querySelector('#brcPuertaTxt').textContent = detalle;
    var btn = puerta.querySelector('#brcEntrar');
    btn.hidden = (estado !== 'pedir');

    var caja = puerta.querySelector('#brcCopia');
    caja.hidden = !copiable;
    if (copiable){
      caja.style.display = 'block';
      puerta.querySelector('#brcUid').textContent = copiable;
      var cp = puerta.querySelector('#brcCopiar');
      cp.addEventListener('click', function(){
        function ok(){ cp.textContent = '✓ Copiado, mandáselo a Sofi'; }
        if (navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(copiable).then(ok, seleccionar);
        } else seleccionar();
        function seleccionar(){
          var r = document.createRange();
          r.selectNodeContents(puerta.querySelector('#brcUid'));
          var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
          try { document.execCommand('copy'); ok(); }
          catch(e){ cp.textContent = 'Copialo a mano de arriba'; }
        }
      });
    }
    return btn;
  }

  function cerrarPuerta(){
    /* ojo: puerta lleva display:flex en el atributo style, y eso le gana
       a [hidden]. Hay que apagarla por display o no se va nunca. */
    if (puerta){ puerta.hidden = true; puerta.style.display = 'none'; }
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
  function esIPhone(){
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
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

    /* que la sesión sobreviva al cierre de la app */
    authMod.setPersistence(auth, authMod.browserLocalPersistence).catch(function(){});

    function entrar(){
      mostrarPuerta('esperando', 'Abriendo Google…');
      var p = esIPhone()
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

    /* Primero resolvemos la vuelta de la redirección y recién después
       decidimos si mostrar la puerta. Si no, se ve un parpadeo de login
       aunque la persona haya entrado bien. */
    mostrarPuerta('esperando', 'Un segundo…');

    /* La vuelta de la redirección se resuelve en paralelo. No colgamos la
       pantalla esperándola: quien manda es onAuthStateChanged. */
    authMod.getRedirectResult(auth).catch(function(err){
      console.warn('[sync] getRedirectResult', err && err.code);
    });

    var contestó = false;
    authMod.onAuthStateChanged(auth, function(usuario){
      contestó = true;
      if (usuario){
        cerrarPuerta();
        arrancarSync(fs, db, auth, authMod, usuario);
        return;
      }
      mostrarPuerta('pedir',
        'Entrá con tu cuenta de Google para ver el viaje y que lo que cargues le aparezca al otro.'
      ).addEventListener('click', entrar);
      señal('Sin entrar', 'solo');
    }, function(err){
      contestó = true;
      mostrarPuerta('pedir', 'Hubo un problema con el login (' +
        (err && err.code || 'error') + '). Probá de nuevo.'
      ).addEventListener('click', entrar);
    });

    /* Red de seguridad: pase lo que pase, nunca quedarse en "Un segundo…" */
    setTimeout(function(){
      if (contestó) return;
      mostrarPuerta('pedir',
        'Está tardando más de lo normal. Tocá para entrar de nuevo.'
      ).addEventListener('click', entrar);
    }, 8000);

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
          'Entraste bien, pero todavía falta habilitar tu cuenta. Copiá esto de abajo ' +
          'y mandáselo a Sofi, que lo agrega y ya podés entrar.',
          usuario.uid
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
